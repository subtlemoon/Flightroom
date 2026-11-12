// On-device AI for Develop: masks (subject, sky, people and their parts, the
// parts of a landscape) and noise reduction. Models run with ONNX Runtime, on
// the graphics card through DirectML on Windows and on the CPU otherwise.
// The runtime and each model download the first time a feature is used, from
// the app's ai-models release on GitHub, into the app's data folder. Photos
// never leave the computer.
//
// Masks are worked out from a picture the window renders (the photo upright,
// uncropped, at the size of its mask images) and come back as 8-bit images of
// that same size, their edges traced against the picture with a guided filter.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

const BASE: &str = "https://github.com/subtlemoon/Flightroom/releases/download/ai-models-1/";

#[derive(Deserialize, Serialize, Clone)]
struct FileInfo {
    name: String,
    sha256: String,
    size: u64,
}

/// What can be downloaded: every file, the runtime's files per system, and the models each feature needs.
#[derive(Deserialize, Serialize, Clone)]
struct Manifest {
    files: Vec<FileInfo>,
    runtime: HashMap<String, Vec<String>>,
    features: HashMap<String, Vec<String>>,
}

pub struct Ai {
    dir: PathBuf,
    manifest: Mutex<Option<Manifest>>,
    sessions: Mutex<HashMap<String, Arc<Mutex<ort::session::Session>>>>,
    /// Models the graphics card couldn't run; they run on the processor.
    on_cpu: Mutex<std::collections::HashSet<String>>,
    device: Mutex<Option<String>>,
    /// Where AI masks run: "auto", "gpu" or "cpu" (Settings; kept in the models folder).
    prefer: Mutex<Option<String>>,
    installing: Mutex<()>,
    /// When AI masks last ran, and whether a watcher is waiting to free the models after.
    last_use: Mutex<Option<std::time::Instant>>,
    watching: std::sync::atomic::AtomicBool,
}

/// Models for AI masks stay loaded while you work with them, and go once they've
/// sat unused this long: they take hundreds of MB (and as much again on the graphics card).
const MODELS_IDLE: std::time::Duration = std::time::Duration::from_secs(180);

impl Ai {
    pub fn new(dir: PathBuf) -> Self {
        Ai {
            dir,
            manifest: Mutex::new(None),
            sessions: Mutex::new(HashMap::new()),
            on_cpu: Mutex::default(),
            device: Mutex::new(None),
            prefer: Mutex::new(None),
            installing: Mutex::new(()),
            last_use: Mutex::new(None),
            watching: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Notes that the models were just used; a watcher frees them after MODELS_IDLE.
    fn touch(app: &AppHandle) {
        use std::sync::atomic::Ordering::Relaxed;
        let ai = app.state::<Ai>();
        *ai.last_use.lock().unwrap() = Some(std::time::Instant::now());
        if ai.watching.swap(true, Relaxed) {
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_secs(20));
            let ai = app.state::<Ai>();
            let last = ai.last_use.lock().unwrap();
            if last.map_or(true, |t| t.elapsed() >= MODELS_IDLE) {
                ai.watching.store(false, Relaxed);
                drop(last);
                ai.release();
                return;
            }
        });
    }

    fn base() -> String {
        // A local folder of models, for development.
        std::env::var("FLIGHTROOM_AI_BASE").unwrap_or_else(|_| BASE.to_string())
    }

    fn fetch(url: &str) -> Result<Box<dyn Read + Send + Sync>, String> {
        if let Some(path) = url.strip_prefix("file://") {
            return Ok(Box::new(std::fs::File::open(path).map_err(|e| format!("{path}: {e}"))?));
        }
        let res = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(3600)))
            .build()
            .new_agent()
            .get(url)
            .call()
            .map_err(|e| format!("Couldn't download {url}: {e}"))?;
        Ok(Box::new(res.into_body().into_reader()))
    }

    fn manifest(&self) -> Result<Manifest, String> {
        if let Some(m) = self.manifest.lock().unwrap().clone() {
            return Ok(m);
        }
        let cached = self.dir.join("manifest.json");
        let fresh = Self::fetch(&format!("{}manifest.json", Self::base())).and_then(|mut r| {
            let mut s = String::new();
            r.read_to_string(&mut s).map_err(|e| e.to_string())?;
            serde_json::from_str::<Manifest>(&s).map_err(|e| e.to_string()).map(|m| (m, s))
        });
        let m = match fresh {
            Ok((m, text)) => {
                let _ = std::fs::create_dir_all(&self.dir);
                let _ = std::fs::write(&cached, text);
                m
            }
            // Offline: what was downloaded last time still works.
            Err(e) => serde_json::from_slice(&std::fs::read(&cached).map_err(|_| e)?).map_err(|e| e.to_string())?,
        };
        *self.manifest.lock().unwrap() = Some(m.clone());
        Ok(m)
    }

    /// Files a feature needs: the runtime for this system, then its models.
    /// The AI grade's vision model runs in the window (WebGPU), so it needs no runtime.
    fn needs(m: &Manifest, feature: &str) -> Result<Vec<FileInfo>, String> {
        let none = Vec::new();
        let names = if feature == "grade" { &none } else { m.runtime.get(std::env::consts::OS).ok_or("AI isn't available on this system")? };
        let models = m.features.get(feature).ok_or_else(|| format!("unknown AI feature {feature}"))?;
        names.iter().chain(models).map(|n| m.files.iter().find(|f| &f.name == n).cloned().ok_or_else(|| format!("{n} missing from the manifest"))).collect()
    }

    fn have(&self, f: &FileInfo) -> bool {
        std::fs::metadata(self.dir.join(&f.name)).map(|md| md.len() == f.size).unwrap_or(false)
    }

    fn download(&self, f: &FileInfo, mut progress: impl FnMut(u64)) -> Result<(), String> {
        std::fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        let part = self.dir.join(format!("{}.part", f.name));
        let mut r = Self::fetch(&format!("{}{}", Self::base(), f.name))?;
        let mut out = std::fs::File::create(&part).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        let mut buf = vec![0u8; 1 << 20];
        loop {
            let n = r.read(&mut buf).map_err(|e| format!("Download of {} failed: {e}", f.name))?;
            if n == 0 {
                break;
            }
            hash.update(&buf[..n]);
            out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            progress(n as u64);
        }
        drop(out);
        if hex::encode(hash.finalize()) != f.sha256 {
            let _ = std::fs::remove_file(&part);
            return Err(format!("{} didn't download correctly; try again", f.name));
        }
        std::fs::rename(&part, self.dir.join(&f.name)).map_err(|e| e.to_string())
    }

    /// Starts ONNX Runtime once, from the downloaded library.
    fn engine(&self) -> Result<String, String> {
        let mut device = self.device.lock().unwrap();
        if let Some(d) = device.clone() {
            return Ok(d);
        }
        let lib = self.dir.join(match std::env::consts::OS {
            "windows" => "onnxruntime.dll",
            "macos" => "libonnxruntime.dylib",
            _ => "libonnxruntime.so",
        });
        #[cfg(windows)]
        {
            // ONNX Runtime looks for DirectML.dll by name; loading it first from
            // our folder makes sure it finds this one.
            let dml = self.dir.join("DirectML.dll");
            if dml.exists() {
                if let Ok(l) = unsafe { libloading::Library::new(&dml) } {
                    std::mem::forget(l);
                }
            }
        }
        ort::init_from(&lib).map_err(|e| format!("Couldn't start the AI runtime: {e}"))?.with_name("flightroom").commit();
        let d = if cfg!(windows) { "graphics card" } else { "processor" }.to_string();
        *device = Some(d.clone());
        Ok(d)
    }

    fn preference(&self) -> String {
        let mut p = self.prefer.lock().unwrap();
        p.get_or_insert_with(|| {
            let v = std::fs::read_to_string(self.dir.join("device.txt")).unwrap_or_default();
            match v.trim() {
                "gpu" | "cpu" => v.trim().to_string(),
                _ => "auto".to_string(),
            }
        })
        .clone()
    }

    /// Whether a model runs on the graphics card. AI masks are one long, heavy job:
    /// on a laptop with only built-in graphics (Intel Iris Xe and the like) that
    /// job starves the screen of the same chip, which flickers and can make
    /// Windows reset the driver, and its memory is the computer's own RAM. So
    /// there they run on the processor, unless Settings says otherwise. AI Denoise
    /// works in small tiles, which share the chip well, and would take many
    /// minutes on a processor, so it stays on the graphics card.
    fn gpu_for(&self, model: &str) -> bool {
        if !cfg!(windows) || self.on_cpu.lock().unwrap().contains(model) {
            return false;
        }
        match self.preference().as_str() {
            "cpu" => false,
            "gpu" => true,
            _ => model == DN_MODEL || gpu::dedicated(),
        }
    }

    /// Where AI masks run now, for the app to show.
    fn mask_device(&self) -> &'static str {
        if self.gpu_for("birefnet.onnx") { "graphics card" } else { "processor" }
    }

    fn session(&self, model: &str) -> Result<Arc<Mutex<ort::session::Session>>, String> {
        self.engine()?;
        if let Some(s) = self.sessions.lock().unwrap().get(model) {
            return Ok(s.clone());
        }
        let path = self.dir.join(model);
        if !path.exists() {
            return Err(format!("{model} isn't downloaded"));
        }
        let gpu = self.gpu_for(model);
        let s = match open(&path, gpu) {
            Ok(s) => Ok(s),
            // Some graphics drivers reject a model DirectML would otherwise run.
            Err(e) if gpu => {
                eprintln!("[ai] {model} on the graphics card: {e}; using the processor");
                self.on_cpu.lock().unwrap().insert(model.to_string());
                open(&path, false)
            }
            Err(e) => Err(e),
        };
        let s = match s {
            Ok(s) => s,
            // Out of memory ("bad allocation"): the other models make room and it tries once more.
            Err(e) => {
                eprintln!("[ai] {model}: {e}; freeing the other models and trying again");
                self.release();
                open(&path, false).map_err(|_| format!("Couldn't load {model}: {e}. The computer is short of memory: close other apps and try again"))?
            }
        };
        let s = Arc::new(Mutex::new(s));
        self.sessions.lock().unwrap().insert(model.to_string(), s.clone());
        Ok(s)
    }

    /// Runs a model on one input. When the graphics card fails at it, the model
    /// moves to the processor for good (this run included).
    fn infer(&self, model: &str, shape: Vec<i64>, data: Vec<f32>) -> Result<(Vec<i64>, Vec<f32>), String> {
        let s = self.session(model)?;
        if !self.gpu_for(model) {
            return run(&s, shape, data);
        }
        match run(&s, shape.clone(), data.clone()) {
            Ok(r) => Ok(r),
            Err(e) => {
                eprintln!("[ai] {model} failed on the graphics card: {e}; using the processor");
                self.on_cpu.lock().unwrap().insert(model.to_string());
                self.sessions.lock().unwrap().remove(model);
                run(&*self.session(model)?, shape, data)
            }
        }
    }

    /// Frees the models (they take a lot of memory); they load again when needed.
    pub fn release(&self) {
        self.sessions.lock().unwrap().clear();
    }
}

fn open(path: &Path, gpu: bool) -> Result<ort::session::Session, ort::Error> {
    let mut b = ort::session::Session::builder()?;
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    if gpu {
        // DirectML wants these. The fast graphics card, on laptops with two.
        b = b.with_memory_pattern(false)?.with_parallel_execution(false)?;
        b = b.with_execution_providers([ort::ep::DirectML::default().with_performance_preference(ort::ep::directml::PerformancePreference::HighPerformance).build()])?;
        b = b.with_intra_threads(cores)?;
    } else {
        // Memory goes back after each run instead of being kept for the next,
        // and one core is left so the window keeps up while a model runs.
        b = b.with_execution_providers([ort::ep::CPU::default().with_arena_allocator(false).build()])?;
        b = b.with_intra_threads(cores.saturating_sub(1).max(2))?;
    }
    b.commit_from_file(path)
}

fn run(s: &Mutex<ort::session::Session>, shape: Vec<i64>, data: Vec<f32>) -> Result<(Vec<i64>, Vec<f32>), String> {
    let t = ort::value::Tensor::from_array((shape, data)).map_err(|e| e.to_string())?;
    let mut s = s.lock().unwrap();
    let out = s.run(ort::inputs![t]).map_err(|e| format!("The AI model failed: {e}"))?;
    let (shape, v) = out[0].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
    Ok((shape.iter().copied().collect(), v.to_vec()))
}

// --- images ------------------------------------------------------------------

/// A w x h image with c channels of floats.
struct Img {
    w: usize,
    h: usize,
    c: usize,
    v: Vec<f32>,
}

impl Img {
    fn at(&self, x: f32, y: f32, ch: usize) -> f32 {
        let x = x.clamp(0.0, (self.w - 1) as f32);
        let y = y.clamp(0.0, (self.h - 1) as f32);
        let (x0, y0) = (x as usize, y as usize);
        let (x1, y1) = ((x0 + 1).min(self.w - 1), (y0 + 1).min(self.h - 1));
        let (fx, fy) = (x - x0 as f32, y - y0 as f32);
        let p = |x: usize, y: usize| self.v[(y * self.w + x) * self.c + ch];
        (p(x0, y0) * (1.0 - fx) + p(x1, y0) * fx) * (1.0 - fy) + (p(x0, y1) * (1.0 - fx) + p(x1, y1) * fx) * fy
    }

    /// Part (x, y, w, h in pixels) stretched to dw x dh, bilinear.
    fn crop_resize(&self, x: f32, y: f32, w: f32, h: f32, dw: usize, dh: usize) -> Img {
        let mut v = Vec::with_capacity(dw * dh * self.c);
        for j in 0..dh {
            let sy = y + (j as f32 + 0.5) * h / dh as f32 - 0.5;
            for i in 0..dw {
                let sx = x + (i as f32 + 0.5) * w / dw as f32 - 0.5;
                for ch in 0..self.c {
                    v.push(self.at(sx, sy, ch));
                }
            }
        }
        Img { w: dw, h: dh, c: self.c, v }
    }

    fn resize(&self, dw: usize, dh: usize) -> Img {
        // Big reductions average first so nothing aliases.
        if self.w >= dw * 2 && self.h >= dh * 2 {
            return self.halve().resize(dw, dh);
        }
        self.crop_resize(0.0, 0.0, self.w as f32, self.h as f32, dw, dh)
    }

    fn halve(&self) -> Img {
        let (w, h) = (self.w / 2, self.h / 2);
        let mut v = vec![0.0; w * h * self.c];
        for y in 0..h {
            for x in 0..w {
                for ch in 0..self.c {
                    let p = |dx: usize, dy: usize| self.v[((2 * y + dy) * self.w + 2 * x + dx) * self.c + ch];
                    v[(y * w + x) * self.c + ch] = (p(0, 0) + p(1, 0) + p(0, 1) + p(1, 1)) * 0.25;
                }
            }
        }
        Img { w, h, c: self.c, v }
    }

    fn gray(&self) -> Img {
        Img { w: self.w, h: self.h, c: 1, v: self.v.chunks_exact(3).map(|p| 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]).collect() }
    }

    fn to_u8(&self) -> Vec<u8> {
        self.v.iter().map(|&x| (x.clamp(0.0, 1.0) * 255.0 + 0.5) as u8).collect()
    }
}

/// Mean over a (2r+1)^2 box, clamped at the edges.
fn box_mean(src: &[f32], w: usize, h: usize, r: usize) -> Vec<f32> {
    let mut tmp = vec![0.0f32; w * h];
    for y in 0..h {
        let row = &src[y * w..(y + 1) * w];
        let mut acc = 0.0f64;
        let mut n = 0usize;
        for &v in &row[..=r.min(w - 1)] {
            acc += v as f64;
            n += 1;
        }
        for x in 0..w {
            tmp[y * w + x] = (acc / n as f64) as f32;
            if x + r + 1 < w {
                acc += row[x + r + 1] as f64;
                n += 1;
            }
            if x >= r {
                acc -= row[x - r] as f64;
                n -= 1;
            }
        }
    }
    let mut out = vec![0.0f32; w * h];
    for x in 0..w {
        let mut acc = 0.0f64;
        let mut n = 0usize;
        for y in 0..=r.min(h - 1) {
            acc += tmp[y * w + x] as f64;
            n += 1;
        }
        for y in 0..h {
            out[y * w + x] = (acc / n as f64) as f32;
            if y + r + 1 < h {
                acc += tmp[(y + r + 1) * w + x] as f64;
                n += 1;
            }
            if y >= r {
                acc -= tmp[(y - r) * w + x] as f64;
                n -= 1;
            }
        }
    }
    out
}

/// He's guided filter: the mask p takes on the edges of the picture I.
fn guided(i: &Img, p: &Img, r: usize, eps: f32) -> Img {
    let (w, h) = (i.w, i.h);
    let mi = box_mean(&i.v, w, h, r);
    let mp = box_mean(&p.v, w, h, r);
    let ip: Vec<f32> = i.v.iter().zip(&p.v).map(|(a, b)| a * b).collect();
    let ii: Vec<f32> = i.v.iter().map(|a| a * a).collect();
    let mip = box_mean(&ip, w, h, r);
    let mii = box_mean(&ii, w, h, r);
    let mut a = vec![0.0; w * h];
    let mut b = vec![0.0; w * h];
    for k in 0..w * h {
        let var = mii[k] - mi[k] * mi[k];
        let cov = mip[k] - mi[k] * mp[k];
        a[k] = cov / (var + eps);
        b[k] = mp[k] - a[k] * mi[k];
    }
    let ma = box_mean(&a, w, h, r);
    let mb = box_mean(&b, w, h, r);
    Img { w, h, c: 1, v: (0..w * h).map(|k| (ma[k] * i.v[k] + mb[k]).clamp(0.0, 1.0)).collect() }
}

/// A rough mask made to follow the picture's edges, at the picture's size.
fn refine(guide: &Img, rough: &Img) -> Img {
    let up = rough.resize(guide.w, guide.h);
    let r = (guide.w.max(guide.h) / 256).max(2);
    clean(guided(guide, &up, r, 1e-3))
}

/// Sky edges: the scene model only knows sky roughly (a 129 x 129 grid), so
/// where it isn't sure, each pixel goes by whether its colour is nearer the sky
/// or the rest nearby (or in the whole photo, where nothing sure is nearby).
/// That cuts out branches and leaves against the sky.
fn sky_edges(rgb: &Img, guide: &Img, rough: &Img) -> Img {
    let (w, h) = (guide.w, guide.h);
    let up = rough.resize(w, h);
    let r = (w.max(h) / 40).max(4);
    let sure = |f: &dyn Fn(f32) -> bool| up.v.iter().map(|&p| if f(p) { 1.0 } else { 0.0 }).collect::<Vec<f32>>();
    let (ss, sn) = (sure(&|p| p > 0.85), sure(&|p| p < 0.15));
    let (ns, nn) = (box_mean(&ss, w, h, r), box_mean(&sn, w, h, r));
    // Mean colour of the sure sky and sure non-sky, near each pixel and overall.
    let means = |m: &[f32], n: &[f32]| -> (Vec<[f32; 3]>, [f32; 3]) {
        let mut ch = Vec::new();
        let mut all = [0f32; 3];
        let total: f32 = m.iter().sum::<f32>().max(1.0);
        for c in 0..3 {
            let v: Vec<f32> = (0..w * h).map(|i| rgb.v[i * 3 + c] * m[i]).collect();
            all[c] = v.iter().sum::<f32>() / total;
            ch.push(box_mean(&v, w, h, r));
        }
        ((0..w * h).map(|i| [0, 1, 2].map(|c| ch[c][i] / n[i].max(1e-4))).collect(), all)
    };
    let ((cs, gs), (cn, gn)) = (means(&ss, &ns), means(&sn, &nn));
    let unsure = sure(&|p| p > 0.03 && p < 0.97);
    let band = box_mean(&unsure, w, h, 2);
    let mut v = up.v.clone();
    for i in 0..w * h {
        if band[i] <= 0.0 {
            continue;
        }
        let (ks, kn) = ((ns[i] / 0.05).min(1.0), (nn[i] / 0.05).min(1.0));
        let (mut ds, mut dn) = (0f32, 0f32);
        for c in 0..3 {
            let x = rgb.v[i * 3 + c];
            let s = cs[i][c] * ks + gs[c] * (1.0 - ks);
            let n = cn[i][c] * kn + gn[c] * (1.0 - kn);
            ds += (x - s) * (x - s);
            dn += (x - n) * (x - n);
        }
        let p = up.v[i].clamp(1e-3, 1.0 - 1e-3);
        let z = ((dn - ds) / 0.003 + 0.6 * (p / (1.0 - p)).ln()).clamp(-30.0, 30.0);
        v[i] = 1.0 / (1.0 + (-z).exp());
    }
    clean(guided(guide, &Img { w, h, c: 1, v }, (w.max(h) / 640).max(2), 1e-4))
}

/// The guided filter leaves a faint haze away from edges; snap near-0 and near-1 flat.
fn clean(mut m: Img) -> Img {
    for v in &mut m.v {
        *v = ((*v - 0.06) / 0.88).clamp(0.0, 1.0);
    }
    m
}

/// A firmer edge: one clear outline instead of a wide soft band, whose faint
/// values would spread onto things nearby.
fn crisp(mut m: Img) -> Img {
    for v in &mut m.v {
        let t = ((*v - 0.3) / 0.4).clamp(0.0, 1.0);
        *v = t * t * (3.0 - 2.0 * t);
    }
    m
}

// --- the models -----------------------------------------------------------------

/// BiRefNet (general use) on a picture, at 1024 x 1024: how sure it is each spot is the subject.
fn salient(ai: &Ai, rgb: &Img) -> Result<Img, String> {
    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];
    let small = rgb.resize(1024, 1024);
    let mut x = vec![0.0f32; 3 * 1024 * 1024];
    for (k, px) in small.v.chunks_exact(3).enumerate() {
        for ch in 0..3 {
            x[ch * 1024 * 1024 + k] = (px[ch] - MEAN[ch]) / STD[ch];
        }
    }
    let (_, y) = ai.infer("birefnet.onnx", vec![1, 3, 1024, 1024], x)?;
    Ok(Img { w: 1024, h: 1024, c: 1, v: y.iter().map(|v| v.clamp(0.0, 1.0)).collect() })
}

/// Subject, at the picture's size. One BiRefNet pass over the whole picture,
/// then closer passes over the subject, because thin parts (the far bars of a
/// kart's roll cage) are a pixel or two wide at 1024 and get missed: its
/// square, and with a graphics card its four overlapping quarters as well.
/// What the close passes add is kept only where it joins the subject the first
/// pass found, so clutter that looks like an object up close stays out.
fn subject(ai: &Ai, rgb: &Img) -> Result<Img, String> {
    let first = salient(ai, rgb)?.resize(rgb.w, rgb.h);
    let core = main_subject(Img { w: first.w, h: first.h, c: 1, v: first.v.clone() });
    let Some((x0, y0, x1, y1)) = bounds_of(&core, 0.5) else { return Ok(core) };
    let (w, h) = (rgb.w, rgb.h);
    let side = (((x1 - x0).max(y1 - y0) as f32 * 1.15) as usize).min(w.min(h));
    // A subject that fills most of the frame gains nothing from a closer look.
    if side < 64 || side as f32 > 0.75 * w.max(h) as f32 {
        return Ok(core);
    }
    let (cx, cy) = ((x0 + x1) / 2, (y0 + y1) / 2);
    let sx = cx.saturating_sub(side / 2).min(w - side);
    let sy = cy.saturating_sub(side / 2).min(h - side);
    let mut m = first.v;
    let mut look = |x: usize, y: usize, s: usize, feather: bool| -> Result<(), String> {
        let close = salient(ai, &rgb.crop_resize(x as f32, y as f32, s as f32, s as f32, 1024, 1024))?.resize(s, s);
        let ramp = (s as f32 * 0.1).max(1.0);
        for j in 0..s {
            for i in 0..s {
                // Quarters fade out at their cut edges, where things are cut in half.
                let f = if feather { ((i.min(s - 1 - i).min(j).min(s - 1 - j)) as f32 / ramp).min(1.0) } else { 1.0 };
                let k = (y + j) * w + x + i;
                m[k] = m[k].max(close.v[j * s + i] * f);
            }
        }
        Ok(())
    };
    look(sx, sy, side, false)?;
    if ai.gpu_for("birefnet.onnx") {
        let q = side * 3 / 5;
        for (qx, qy) in [(sx, sy), (sx + side - q, sy), (sx, sy + side - q), (sx + side - q, sy + side - q)] {
            look(qx, qy, q, true)?;
        }
    }
    // Keep what touches the first pass's subject.
    let on: Vec<bool> = m.iter().map(|&v| v >= 0.5).collect();
    let (label, parts) = regions(&on, w, h);
    let mut keep = vec![false; parts.len()];
    for (k, &l) in label.iter().enumerate() {
        if l > 0 && core.v[k] >= 0.5 {
            keep[l as usize - 1] = true;
        }
    }
    let kept: Vec<bool> = label.iter().map(|&l| l > 0 && keep[l as usize - 1]).collect();
    let near = dilate(&kept, w, h, (w.max(h) / 340).max(3));
    for (k, v) in m.iter_mut().enumerate() {
        if !near[k] {
            *v = core.v[k];
        } else if on[k] && !kept[k] {
            *v = v.min(0.49);
        }
    }
    Ok(main_subject(Img { w, h, c: 1, v: m }))
}

/// The box (x0, y0, x1, y1) of the cells at or above `t`.
fn bounds_of(m: &Img, t: f32) -> Option<(usize, usize, usize, usize)> {
    let mut b: Option<(usize, usize, usize, usize)> = None;
    for (k, &v) in m.v.iter().enumerate() {
        if v >= t {
            let (x, y) = (k % m.w, k / m.w);
            b = Some(b.map_or((x, y, x, y), |(a, c, d, e)| (a.min(x), c.min(y), d.max(x), e.max(y))));
        }
    }
    b
}

/// Connected regions of `on` cells (8-neighbours): a label per cell (0 = off) and each region's cells.
fn regions(on: &[bool], w: usize, h: usize) -> (Vec<u32>, Vec<Vec<usize>>) {
    let mut label = vec![0u32; w * h];
    let mut out = Vec::new();
    for start in 0..w * h {
        if !on[start] || label[start] != 0 {
            continue;
        }
        let id = out.len() as u32 + 1;
        let mut cells = vec![start];
        label[start] = id;
        let mut i = 0;
        while i < cells.len() {
            let k = cells[i];
            i += 1;
            let (x, y) = ((k % w) as isize, (k / w) as isize);
            for dy in -1..=1 {
                for dx in -1..=1 {
                    let (nx, ny) = (x + dx, y + dy);
                    if nx < 0 || ny < 0 || nx >= w as isize || ny >= h as isize {
                        continue;
                    }
                    let nk = ny as usize * w + nx as usize;
                    if on[nk] && label[nk] == 0 {
                        label[nk] = id;
                        cells.push(nk);
                    }
                }
            }
        }
        out.push(cells);
    }
    (label, out)
}

/// One subject: the salient object people mean, not every salient thing. The
/// region that is biggest, surest and nearest the middle wins, along with any
/// pieces of it inside its outline (a kart's frame comes out in parts). Other
/// regions are dropped. Only pinholes in it are filled: bigger gaps (between an
/// arm and a face, or the bars of a cage) are background seen through it.
fn main_subject(mut m: Img) -> Img {
    let (w, h) = (m.w, m.h);
    let on: Vec<bool> = m.v.iter().map(|&v| v >= 0.5).collect();
    let (label, parts) = regions(&on, w, h);
    if parts.is_empty() {
        return m;
    }
    let bounds = |cells: &[usize]| {
        cells.iter().fold((w, h, 0, 0), |(x0, y0, x1, y1), &k| (x0.min(k % w), y0.min(k / w), x1.max(k % w), y1.max(k / w)))
    };
    let score = |cells: &[usize]| {
        let n = cells.len() as f32;
        let (sx, sy, sp) = cells.iter().fold((0.0, 0.0, 0.0), |(a, b, c), &k| (a + (k % w) as f32, b + (k / w) as f32, c + m.v[k]));
        let (dx, dy) = (sx / n / w as f32 - 0.5, sy / n / h as f32 - 0.5);
        n * (sp / n) * (-(dx * dx + dy * dy) / (2.0 * 0.3 * 0.3)).exp()
    };
    let best = (0..parts.len()).max_by(|&a, &b| score(&parts[a]).total_cmp(&score(&parts[b]))).unwrap();
    let (x0, y0, x1, y1) = bounds(&parts[best]);
    let (mx, my) = ((x1 - x0) / 20 + 2, (y1 - y0) / 20 + 2);
    let inside = |(a, b, c, d): (usize, usize, usize, usize)| a + mx >= x0 && b + my >= y0 && c <= x1 + mx && d <= y1 + my;
    // Next to it, a sure piece of a good size that juts out of its box counts
    // too (a kart's front wheel); specks are dropped.
    let mut on_best = vec![false; w * h];
    for &k in &parts[best] {
        on_best[k] = true;
    }
    let by_best = dilate(&on_best, w, h, mx.max(my));
    let n = parts[best].len();
    let keep: Vec<bool> = parts
        .iter()
        .enumerate()
        .map(|(i, r)| {
            let sure = r.iter().map(|&k| m.v[k]).sum::<f32>() >= 0.8 * r.len() as f32;
            let (a, _, c, _) = bounds(r);
            i == best
                || (r.len() * 500 >= n && inside(bounds(r)))
                || (r.len() * 50 >= n && sure && (c - a) * 2 <= x1 - x0 && r.iter().any(|&k| by_best[k]))
        })
        .collect();
    let kept: Vec<bool> = label.iter().map(|&l| l > 0 && keep[l as usize - 1]).collect();
    // Soft edge values stay only right next to what's kept (faint spill onto
    // things nearby, like a barrier beside a kart, goes).
    let near = dilate(&kept, w, h, (w.max(h) / 340).max(3));
    for (k, v) in m.v.iter_mut().enumerate() {
        if !near[k] {
            *v = 0.0;
        } else if on[k] && !kept[k] {
            *v = v.min(0.49);
        }
    }
    // Pinholes: specks the model missed, tiny next to the subject.
    let size: usize = parts.iter().zip(&keep).filter(|(_, &k)| k).map(|(r, _)| r.len()).sum();
    let off: Vec<bool> = kept.iter().map(|&k| !k).collect();
    let (_, holes) = regions(&off, w, h);
    for hole in holes {
        let edge = hole.iter().any(|&k| k % w == 0 || k / w == 0 || k % w == w - 1 || k / w == h - 1);
        if !edge && hole.len() * 2000 < size {
            for k in hole {
                m.v[k] = 1.0;
            }
        }
    }
    m
}

/// `on` grown by r cells (a square).
fn dilate(on: &[bool], w: usize, h: usize, r: usize) -> Vec<bool> {
    let mut rows = vec![false; w * h];
    for y in 0..h {
        let mut last = None;
        for x in 0..w {
            if on[y * w + x] {
                last = Some(x);
            }
            rows[y * w + x] = last.is_some_and(|l| x - l <= r);
        }
        let mut next = None;
        for x in (0..w).rev() {
            if on[y * w + x] {
                next = Some(x);
            }
            rows[y * w + x] |= next.is_some_and(|n| n - x <= r);
        }
    }
    let mut out = vec![false; w * h];
    for x in 0..w {
        let mut last = None;
        for y in 0..h {
            if rows[y * w + x] {
                last = Some(y);
            }
            out[y * w + x] = last.is_some_and(|l| y - l <= r);
        }
        let mut next = None;
        for y in (0..h).rev() {
            if rows[y * w + x] {
                next = Some(y);
            }
            out[y * w + x] |= next.is_some_and(|n| n - y <= r);
        }
    }
    out
}

const ADE: usize = 513;
/// Scene parsing: DeepLab v3+ trained on ADE20K (150 kinds of things). Returns
/// per-class probabilities (129 x 129 grid) and the part of the grid the photo fills.
fn scene(ai: &Ai, rgb: &Img) -> Result<(Img, usize, usize), String> {
    let k = ADE as f32 / rgb.w.max(rgb.h) as f32;
    let (w, h) = (((rgb.w as f32 * k).round() as usize).clamp(1, ADE), ((rgb.h as f32 * k).round() as usize).clamp(1, ADE));
    let small = rgb.resize(w, h);
    let mut x = vec![-1.0f32; ADE * ADE * 3]; // padding is mid-grey after normalising, as DeepLab pads
    for y in 0..h {
        for xx in 0..w {
            for ch in 0..3 {
                x[(y * ADE + xx) * 3 + ch] = small.v[(y * w + xx) * 3 + ch] * 2.0 - 1.0;
            }
        }
    }
    let (shape, logits) = ai.infer("ade20k.onnx", vec![1, ADE as i64, ADE as i64, 3], x)?;
    let (gh, gw, c) = (shape[1] as usize, shape[2] as usize, shape[3] as usize);
    // Softmax per cell.
    let mut p = logits;
    for cell in p.chunks_exact_mut(c) {
        let m = cell.iter().copied().fold(f32::MIN, f32::max);
        let mut sum = 0.0;
        for v in cell.iter_mut() {
            *v = (*v - m).exp();
            sum += *v;
        }
        for v in cell.iter_mut() {
            *v /= sum;
        }
    }
    let used_w = ((w - 1) * (gw - 1)) / (ADE - 1) + 1;
    let used_h = ((h - 1) * (gh - 1)) / (ADE - 1) + 1;
    Ok((Img { w: gw, h: gh, c, v: p }, used_w, used_h))
}

// ADE20K classes (1-based, 0 = other) for each kind of mask, as in Lightroom's Landscape masks.
const SKY: &[usize] = &[3];
const PERSON: &[usize] = &[13];
const WATER: &[usize] = &[22, 27, 61, 105, 110, 114, 129];
const VEGETATION: &[usize] = &[5, 10, 18, 67, 73];
const MOUNTAINS: &[usize] = &[17, 35, 69];
const ARCHITECTURE: &[usize] = &[1, 2, 26, 43, 49, 52, 62, 80, 85, 87, 107, 141];
const NATURAL_GROUND: &[usize] = &[14, 30, 47, 92, 95];
const ARTIFICIAL_GROUND: &[usize] = &[4, 7, 12, 53, 54, 55, 60, 122];

fn class_map(probs: &Img, used_w: usize, used_h: usize, classes: &[usize]) -> Img {
    let mut v = Vec::with_capacity(used_w * used_h);
    for y in 0..used_h {
        for x in 0..used_w {
            let cell = &probs.v[(y * probs.w + x) * probs.c..][..probs.c];
            v.push(classes.iter().map(|&k| cell[k]).sum::<f32>().min(1.0));
        }
    }
    Img { w: used_w, h: used_h, c: 1, v }
}

/// Parts of a person: MediaPipe's multiclass selfie segmenter, 256 x 256.
/// Returns background, hair, body skin, face skin, clothes, accessories.
fn person_parts(ai: &Ai, crop: &Img) -> Result<Img, String> {
    let small = crop.resize(256, 256);
    let x = small.v.iter().map(|v| v * 2.0 - 1.0).collect();
    let (_, y) = ai.infer("selfie_multiclass.onnx", vec![1, 256, 256, 3], x)?;
    // Scores to probabilities.
    let mut p = y;
    for cell in p.chunks_exact_mut(6) {
        let m = cell.iter().copied().fold(f32::MIN, f32::max);
        let mut sum = 0.0;
        for v in cell.iter_mut() {
            *v = (*v - m).exp();
            sum += *v;
        }
        for v in cell.iter_mut() {
            *v /= sum;
        }
    }
    Ok(Img { w: 256, h: 256, c: 6, v: p })
}

/// Side of the grid a person's parts are worked out on (their square, in pixels).
const PARTS_GRID: usize = 768;

/// A person's parts in detail, over their square (bx, by, side in picture
/// pixels), on a PARTS_GRID grid: the whole square once, then nine half-size
/// squares (each at twice the detail), then the face close up, blended with
/// feathered edges. The selfie model is made for close-ups, so on a whole
/// person at 256 x 256 skin spilt into hair and suits; this costs eleven runs
/// of a small model instead of one, for edges that follow the person.
fn person_parts_fine(ai: &Ai, rgb: &Img, bx: f32, by: f32, side: f32) -> Result<Img, String> {
    let r = PARTS_GRID;
    let mut acc = vec![0f32; r * r * 6];
    let mut wsum = vec![0f32; r * r];
    let whole = person_parts(ai, &rgb.crop_resize(bx, by, side, side, 256, 256))?.resize(r, r);
    for (k, v) in whole.v.iter().enumerate() {
        acc[k] = v * 0.5;
    }
    for w in &mut wsum {
        *w = 0.5;
    }
    // One run on a square of the grid (x, y, s in grid cells), weighted by wt.
    let add = |x: f32, y: f32, s: f32, wt: f32, acc: &mut Vec<f32>, wsum: &mut Vec<f32>| -> Result<(), String> {
        let k = side / r as f32;
        let parts = person_parts(ai, &rgb.crop_resize(bx + x * k, by + y * k, s * k, s * k, 256, 256))?;
        let (gx0, gy0) = (x.floor().max(0.0) as usize, y.floor().max(0.0) as usize);
        let (gx1, gy1) = (((x + s).ceil() as usize).min(r), ((y + s).ceil() as usize).min(r));
        for gy in gy0..gy1 {
            let ty = (gy as f32 + 0.5 - y) / s;
            if !(0.0..=1.0).contains(&ty) {
                continue;
            }
            for gx in gx0..gx1 {
                let tx = (gx as f32 + 0.5 - x) / s;
                if !(0.0..=1.0).contains(&tx) {
                    continue;
                }
                // Feathered edges, so the squares blend without seams.
                let win = (tx.min(1.0 - tx) * 6.0).min(1.0) * (ty.min(1.0 - ty) * 6.0).min(1.0) * wt;
                if win <= 0.0 {
                    continue;
                }
                let (u, v) = (tx * 256.0 - 0.5, ty * 256.0 - 0.5);
                let at = gy * r + gx;
                for ch in 0..6 {
                    acc[at * 6 + ch] += parts.at(u, v, ch) * win;
                }
                wsum[at] += win;
            }
        }
        Ok(())
    };
    let s = r as f32 / 2.0;
    for y in [0.0, (r as f32 - s) / 2.0, r as f32 - s] {
        for x in [0.0, (r as f32 - s) / 2.0, r as f32 - s] {
            add(x, y, s, 1.0, &mut acc, &mut wsum)?;
        }
    }
    // The face close up, where its edges (hairline, ears, eyes) matter most.
    let (mut x0, mut y0, mut x1, mut y1, mut n) = (r, r, 0, 0, 0);
    for gy in 0..r {
        for gx in 0..r {
            let at = gy * r + gx;
            if acc[at * 6 + 3] / wsum[at] > 0.5 {
                x0 = x0.min(gx);
                y0 = y0.min(gy);
                x1 = x1.max(gx);
                y1 = y1.max(gy);
                n += 1;
            }
        }
    }
    if n > 50 {
        let fs = ((x1 - x0).max(y1 - y0) as f32 * 2.2).max(64.0);
        let (cx, cy) = ((x0 + x1) as f32 / 2.0, (y0 + y1) as f32 / 2.0);
        add(cx - fs / 2.0, cy - fs / 2.0, fs, 3.0, &mut acc, &mut wsum)?;
    }
    for (k, w) in wsum.iter().enumerate() {
        for ch in 0..6 {
            acc[k * 6 + ch] /= w;
        }
    }
    Ok(Img { w: r, h: r, c: 6, v: acc })
}

/// Separate people: connected areas of the person map (grid cells), biggest first.
fn people_boxes(person: &Img, min_cells: usize) -> Vec<(usize, usize, usize, usize)> {
    let (w, h) = (person.w, person.h);
    let mut seen = vec![false; w * h];
    let mut boxes = vec![];
    for start in 0..w * h {
        if seen[start] || person.v[start] < 0.4 {
            continue;
        }
        let mut stack = vec![start];
        seen[start] = true;
        let (mut x0, mut y0, mut x1, mut y1, mut n) = (w, h, 0, 0, 0);
        while let Some(k) = stack.pop() {
            let (x, y) = (k % w, k / w);
            n += 1;
            x0 = x0.min(x);
            y0 = y0.min(y);
            x1 = x1.max(x);
            y1 = y1.max(y);
            for (dx, dy) in [(-1i32, 0i32), (1, 0), (0, -1), (0, 1)] {
                let (nx, ny) = (x as i32 + dx, y as i32 + dy);
                if nx < 0 || ny < 0 || nx >= w as i32 || ny >= h as i32 {
                    continue;
                }
                let nk = ny as usize * w + nx as usize;
                if !seen[nk] && person.v[nk] >= 0.4 {
                    seen[nk] = true;
                    stack.push(nk);
                }
            }
        }
        if n >= min_cells {
            boxes.push((n, x0, y0, x1 + 1, y1 + 1));
        }
    }
    boxes.sort_by_key(|b| std::cmp::Reverse(b.0));
    // Specks next to a real person are misreadings, not more people.
    let big = boxes.first().map(|b| b.0).unwrap_or(0);
    boxes.into_iter().take_while(|b| b.0 * 16 >= big).take(10).map(|(_, a, b, c, d)| (a, b, c, d)).collect()
}

/// Masks for a picture (RGB 0-1, the photo upright and uncropped).
fn masks(ai: &Ai, task: &str, rgb: &Img) -> Result<Vec<(String, Img)>, String> {
    let guide = rgb.gray();
    let mut out = vec![];
    match task {
        "subject" => {
            // A tight guided filter, so the edge follows the picture closely.
            let m = crisp(clean(guided(&guide, &subject(ai, rgb)?, (guide.w.max(guide.h) / 512).max(2), 1e-3)));
            out.push(("subject".to_string(), m));
        }
        "landscape" => {
            let (probs, uw, uh) = scene(ai, rgb)?;
            for (name, classes) in [
                ("sky", SKY),
                ("water", WATER),
                ("vegetation", VEGETATION),
                ("mountains", MOUNTAINS),
                ("architecture", ARCHITECTURE),
                ("natural-ground", NATURAL_GROUND),
                ("artificial-ground", ARTIFICIAL_GROUND),
            ] {
                let m = class_map(&probs, uw, uh, classes);
                // Kinds of things that aren't in the photo are left out.
                if m.v.iter().filter(|&&v| v > 0.5).count() * 400 < m.v.len() {
                    continue;
                }
                let m = if name == "sky" { sky_edges(rgb, &guide, &m) } else { refine(&guide, &m) };
                out.push((name.to_string(), m));
            }
        }
        "people" => {
            let (probs, uw, uh) = scene(ai, rgb)?;
            let person = class_map(&probs, uw, uh, PERSON);
            let (sx, sy) = (rgb.w as f32 / uw as f32, rgb.h as f32 / uh as f32);
            for (n, (x0, y0, x1, y1)) in people_boxes(&person, (uw * uh / 400).max(3)).into_iter().enumerate() {
                // A square around the person, with room to spare.
                let (cx, cy) = ((x0 + x1) as f32 * 0.5 * sx, (y0 + y1) as f32 * 0.5 * sy);
                let side = ((x1 - x0) as f32 * sx).max((y1 - y0) as f32 * sy) * 1.3;
                let (bx, by) = (cx - side / 2.0, cy - side / 2.0);
                let parts = person_parts_fine(ai, rgb, bx, by, side)?;
                let grid = PARTS_GRID as f32;
                // Back into the picture: each part, inside the person's square.
                let place = |f: &dyn Fn(&[f32]) -> f32| -> Img {
                    let mut v = vec![0.0f32; rgb.w * rgb.h];
                    let (px0, py0) = (bx.max(0.0) as usize, by.max(0.0) as usize);
                    let (px1, py1) = (((bx + side) as usize).min(rgb.w), ((by + side) as usize).min(rgb.h));
                    for y in py0..py1 {
                        for x in px0..px1 {
                            let (u, w) = ((x as f32 + 0.5 - bx) / side * grid - 0.5, (y as f32 + 0.5 - by) / side * grid - 0.5);
                            let mut cell = [0.0f32; 6];
                            for (ch, c) in cell.iter_mut().enumerate() {
                                *c = parts.at(u, w, ch);
                            }
                            v[y * rgb.w + x] = f(&cell);
                        }
                    }
                    Img { w: rgb.w, h: rgb.h, c: 1, v }
                };
                let id = format!("person-{}", n + 1);
                let whole = refine(&guide, &place(&|c| 1.0 - c[0]));
                out.push((id.clone(), whole));
                for (part, ch) in [("face", 3), ("skin", 2), ("hair", 1), ("clothes", 4)] {
                    let m = place(&|c| c[ch]);
                    if m.v.iter().any(|&v| v > 0.5) {
                        out.push((format!("{id}:{part}"), clean(guided(&guide, &m, 2, 1e-3))));
                    }
                }
            }
        }
        _ => return Err(format!("unknown AI task {task}")),
    }
    Ok(out)
}

// --- AI Denoise ---------------------------------------------------------------

// 256 x 256 tiles are the quickest per pixel: bigger ones run slower, not faster.
const DN_MODEL: &str = "scunet.onnx";
const DN_TILE: usize = 256;
const DN_MARGIN: usize = 24;

/// Tile starts covering 0..len with tiles of `DN_TILE` that overlap by twice the margin.
fn tile_starts(len: usize) -> Vec<usize> {
    if len <= DN_TILE {
        return vec![0];
    }
    let mut v: Vec<usize> = (0..).map(|k| k * (DN_TILE - 2 * DN_MARGIN)).take_while(|&p| p + DN_TILE < len).collect();
    v.push(len - DN_TILE);
    v
}

/// The part of a tile at `p` (size `n`) that it writes: the inside, except at the photo's edges.
fn tile_span(p: usize, n: usize, len: usize) -> (usize, usize) {
    (if p == 0 { 0 } else { p + DN_MARGIN }, if p + n >= len { len } else { p + n - DN_MARGIN })
}

/// The model's input for a tw x th tile of linear camera RGB: planar, white
/// balanced with a display gamma, edge pixels repeated out to the tile size.
fn dn_input(src: &[f32], tw: usize, th: usize, gain: [f32; 3]) -> Vec<f32> {
    let n = DN_TILE * DN_TILE;
    let mut x = vec![0f32; 3 * n];
    let (r, gb) = x.split_at_mut(n);
    let (g, b) = gb.split_at_mut(n);
    r.par_chunks_mut(DN_TILE).zip(g.par_chunks_mut(DN_TILE)).zip(b.par_chunks_mut(DN_TILE)).enumerate().for_each(|(ty, ((r, g), b))| {
        for tx in 0..DN_TILE {
            let k = (ty.min(th - 1) * tw + tx.min(tw - 1)) * 3;
            for (c, plane) in [&mut *r, &mut *g, &mut *b].into_iter().enumerate() {
                plane[tx] = (src[k + c] * gain[c]).clamp(0.0, 1.0).powf(1.0 / 2.2);
            }
        }
    });
    x
}

/// Writes the model's answer `y` for the tile at (x0, y0) into `out` (w wide):
/// columns wx0..wx1 of rows wy0..wy1, back to linear camera RGB as half floats.
fn dn_output(out: &mut [u16], w: usize, (x0, y0, tw): (usize, usize, usize), (wx0, wx1, wy0, wy1): (usize, usize, usize, usize), src: &[f32], y: &[f32], gain: [f32; 3]) {
    let n = DN_TILE * DN_TILE;
    out[wy0 * w * 3..wy1 * w * 3].par_chunks_mut(w * 3).enumerate().for_each(|(i, row)| {
        let ty = wy0 + i - y0;
        for px in wx0..wx1 {
            let tx = px - x0;
            let k = (ty * tw + tx) * 3;
            // Clipped highlights carry no noise worth removing; keep them exact.
            let bright = (0..3).any(|c| src[k + c] * gain[c] > 0.98);
            for c in 0..3 {
                let v = if bright { src[k + c] } else { y[c * n + ty * DN_TILE + tx].clamp(0.0, 1.0).powf(2.2) / gain[c] };
                row[px * 3 + c] = half::f16::from_f32(v).to_bits();
            }
        }
    });
}

/// AI Denoise (SCUNet) over a whole photo. `tile(x, y, w, h)` gives linear camera
/// RGB; the model sees it white balanced with a display gamma, as it was trained.
/// Answers half floats (w x h x 3, linear camera RGB like the input).
pub fn denoise(
    ai: &Ai,
    (w, h): (usize, usize),
    wb: [f32; 3],
    tile: impl Fn(usize, usize, usize, usize) -> Vec<f32>,
    cancel: &std::sync::atomic::AtomicBool,
    mut progress: impl FnMut(usize, usize),
) -> Result<Vec<u16>, String> {
    ai.session(DN_MODEL)?; // loads it up front, so a failure shows before any work
    let gain = [wb[0] / wb[1], 1.0, wb[2] / wb[1]];
    let (xs, ys) = (tile_starts(w), tile_starts(h));
    let total = xs.len() * ys.len();
    let mut out = vec![0u16; w * h * 3];
    for (j, &y0) in ys.iter().enumerate() {
        for (i, &x0) in xs.iter().enumerate() {
            if cancel.load(std::sync::atomic::Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let (tw, th) = (DN_TILE.min(w), DN_TILE.min(h));
            let src = tile(x0, y0, tw, th);
            let (_, y) = ai.infer(DN_MODEL, vec![1, 3, DN_TILE as i64, DN_TILE as i64], dn_input(&src, tw, th, gain))?;
            let ((wx0, wx1), (wy0, wy1)) = (tile_span(x0, tw, w), tile_span(y0, th, h));
            dn_output(&mut out, w, (x0, y0, tw), (wx0, wx1, wy0, wy1), &src, &y, gain);
            progress(j * xs.len() + i + 1, total);
        }
    }
    Ok(out)
}

// --- commands ---------------------------------------------------------------------

#[derive(Serialize)]
pub struct Status {
    /// Feature -> downloaded.
    features: HashMap<String, bool>,
    /// Feature -> bytes still to download.
    sizes: HashMap<String, u64>,
    /// Where AI masks run: "graphics card" or "processor".
    device: Option<String>,
    /// Settings: "auto", "gpu" or "cpu".
    prefer: String,
    /// Features with a model the graphics card rejected, so they run on the processor.
    on_cpu: Vec<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn ai_status(app: AppHandle) -> Status {
    tauri::async_runtime::spawn_blocking(move || {
        let ai = app.state::<Ai>();
        let mut st = Status { features: HashMap::new(), sizes: HashMap::new(), device: Some(ai.mask_device().to_string()), prefer: ai.preference(), on_cpu: Vec::new(), error: None };
        let cpu = ai.on_cpu.lock().unwrap().clone();
        match ai.manifest() {
            Ok(m) => {
                for f in m.features.keys() {
                    if let Ok(files) = Ai::needs(&m, f) {
                        let missing: u64 = files.iter().filter(|x| !ai.have(x)).map(|x| x.size).sum();
                        st.features.insert(f.clone(), missing == 0);
                        st.sizes.insert(f.clone(), missing);
                        if files.iter().any(|x| cpu.contains(&x.name)) {
                            st.on_cpu.push(f.clone());
                        }
                    }
                }
            }
            Err(e) => st.error = Some(e),
        }
        st
    })
    .await
    .unwrap_or(Status { features: HashMap::new(), sizes: HashMap::new(), device: None, prefer: "auto".into(), on_cpu: Vec::new(), error: Some("AI status failed".into()) })
}

/// Settings: where AI masks run ("auto", "gpu" or "cpu"). Models load again on their next use.
#[tauri::command]
pub async fn ai_prefer(app: AppHandle, device: String) -> Result<(), String> {
    let device = match device.as_str() {
        "gpu" | "cpu" => device,
        _ => "auto".to_string(),
    };
    let ai = app.state::<Ai>();
    let _ = std::fs::create_dir_all(&ai.dir);
    std::fs::write(ai.dir.join("device.txt"), &device).map_err(|e| e.to_string())?;
    *ai.prefer.lock().unwrap() = Some(device);
    ai.on_cpu.lock().unwrap().clear();
    ai.release();
    Ok(())
}

#[derive(Serialize, Clone)]
struct Progress {
    feature: String,
    done: u64,
    total: u64,
}

/// Downloads what a feature needs, reporting progress as "ai:progress" events.
#[tauri::command]
pub async fn ai_install(app: AppHandle, feature: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ai = app.state::<Ai>();
        let _one = ai.installing.lock().unwrap();
        let m = ai.manifest()?;
        let files: Vec<FileInfo> = Ai::needs(&m, &feature)?.into_iter().filter(|f| !ai.have(f)).collect();
        let total: u64 = files.iter().map(|f| f.size).sum();
        let mut done = 0u64;
        let mut last = 0u64;
        for f in &files {
            ai.download(f, |n| {
                done += n;
                if done - last > total / 200 + 1 {
                    last = done;
                    let _ = app.emit("ai:progress", Progress { feature: feature.clone(), done, total });
                }
            })?;
        }
        let _ = app.emit("ai:progress", Progress { feature: feature.clone(), done: total, total });
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Mask pictures are MASK_EDGE (2048 px) on the long edge; this leaves room and caps memory.
const MAX_MASK_EDGE: usize = 8192;
const MAX_MASK_PIXELS: usize = 4096 * 4096;

/// RGBA bytes a w x h mask picture needs, or why it can't be used.
fn mask_picture_bytes(w: usize, h: usize, have: usize) -> Result<usize, String> {
    if w == 0 || h == 0 || w > MAX_MASK_EDGE || h > MAX_MASK_EDGE {
        return Err(format!("bad picture size {w} x {h}"));
    }
    let need = w.checked_mul(h).filter(|&px| px <= MAX_MASK_PIXELS).ok_or(format!("picture {w} x {h} is too large"))? * 4;
    if have < need {
        return Err("bad picture".into());
    }
    Ok(need)
}

/// Works out masks. Body: RGBA bytes (bottom row first, as WebGL reads them);
/// headers x-task, x-w, x-h. Answer: u32 width, height, count, then per mask a
/// name (u8 length + UTF-8) and width x height bytes.
#[tauri::command]
pub async fn ai_masks(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<tauri::ipc::Response, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("expected bytes".into()) };
    let h = request.headers();
    let get = |k: &str| h.get(k).and_then(|v| v.to_str().ok()).map(str::to_string).ok_or(format!("missing {k}"));
    let task = get("x-task")?;
    let w: usize = get("x-w")?.parse().map_err(|_| "bad width")?;
    let hh: usize = get("x-h")?.parse().map_err(|_| "bad height")?;
    mask_picture_bytes(w, hh, bytes.len())?;
    let mut v = Vec::with_capacity(w * hh * 3);
    for y in 0..hh {
        for px in bytes[(hh - 1 - y) * w * 4..(hh - y) * w * 4].chunks_exact(4) {
            v.extend(px[..3].iter().map(|&b| b as f32 / 255.0));
        }
    }
    let rgb = Img { w, h: hh, c: 3, v };
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || masks(&app.state::<Ai>(), &task, &rgb)).await.map_err(|e| e.to_string())??;
    Ai::touch(&app2);
    let mut out = Vec::new();
    for n in [w as u32, hh as u32, result.len() as u32] {
        out.extend(n.to_le_bytes());
    }
    for (name, m) in result {
        out.push(name.len() as u8);
        out.extend(name.as_bytes());
        out.extend(m.to_u8());
    }
    Ok(tauri::ipc::Response::new(out))
}

/// What graphics the computer has.
pub mod gpu {
    /// A graphics adapter: its name and how much memory of its own it has (MB).
    #[derive(serde::Serialize, Clone)]
    pub struct Adapter {
        pub name: String,
        pub own_mb: u64,
    }

    /// The computer's graphics adapters (not Windows' software one), read once.
    #[cfg(windows)]
    pub fn adapters() -> &'static [Adapter] {
        static LIST: std::sync::OnceLock<Vec<Adapter>> = std::sync::OnceLock::new();
        LIST.get_or_init(|| {
            use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE};
            let mut out = Vec::new();
            let Ok(f) = (unsafe { CreateDXGIFactory1::<IDXGIFactory1>() }) else { return out };
            let mut i = 0;
            while let Ok(a) = unsafe { f.EnumAdapters1(i) } {
                i += 1;
                let Ok(d) = (unsafe { a.GetDesc1() }) else { continue };
                if d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0 {
                    continue;
                }
                let name = String::from_utf16_lossy(&d.Description).trim_end_matches('\0').to_string();
                out.push(Adapter { name, own_mb: (d.DedicatedVideoMemory >> 20) as u64 });
            }
            out
        })
    }

    #[cfg(not(windows))]
    pub fn adapters() -> &'static [Adapter] {
        &[]
    }

    /// Whether there's a graphics card with its own memory (not only graphics
    /// built into the processor, which share the computer's RAM). Built-in
    /// graphics report about 128 MB of their own; cards have gigabytes. When
    /// the adapters can't be read, a card is assumed (the old behaviour).
    pub fn dedicated() -> bool {
        if !cfg!(windows) {
            return false;
        }
        let list = adapters();
        list.is_empty() || list.iter().any(|a| a.own_mb >= 1024)
    }

    /// Only Intel's older built-in graphics (Iris Xe, UHD; not Arc), the kind
    /// whose screen went black during slider drags (lib.rs browser_args).
    pub fn weak_intel() -> bool {
        cfg!(windows)
            && !dedicated()
            && adapters().iter().any(|a| {
                let n = a.name.to_lowercase();
                n.contains("intel") && !n.split(|c: char| !c.is_alphanumeric()).any(|w| w == "arc")
            })
    }
}

#[derive(Serialize)]
pub struct GpuInfo {
    adapters: Vec<gpu::Adapter>,
    /// Only graphics built into the processor: Develop then draws more gently.
    integrated: bool,
}

/// The computer's graphics, for Develop (which draws more gently on built-in
/// graphics) and the graphics report in Settings.
#[tauri::command]
pub async fn gpu_info() -> GpuInfo {
    tauri::async_runtime::spawn_blocking(|| GpuInfo { adapters: gpu::adapters().to_vec(), integrated: cfg!(windows) && !gpu::dedicated() })
        .await
        .unwrap_or(GpuInfo { adapters: vec![], integrated: false })
}

/// A downloaded file of the AI grade's vision model by its path ("smolvlm/onnx/x.onnx"):
/// its place on disk and type. The path's folders are joined with "--" into the
/// file's name, as it is in the release; only files the manifest lists are given.
fn vision_file(ai: &Ai, path: &str) -> Option<(PathBuf, &'static str)> {
    let name = path.replace('/', "--");
    let listed = ai.manifest().map(|m| m.files.iter().any(|f| f.name == name)).unwrap_or(false);
    if !listed || name.contains("..") || name.contains('\\') {
        return None;
    }
    let ctype = match name.rsplit('.').next() {
        Some("json") => "application/json",
        Some("wasm") => "application/wasm",
        Some("txt") => "text/plain",
        _ => "application/octet-stream",
    };
    Some((ai.dir.join(&name), ctype))
}

/// gcimg://localhost/ai/<path>: a vision model file, for the window. (Slow for
/// the big model files on Windows, which is why vision_url serves them too.)
pub fn serve(app: &AppHandle, path: &str) -> crate::photos::HttpResponse {
    let ai = app.state::<Ai>();
    match vision_file(&ai, path).and_then(|(p, ctype)| std::fs::read(p).ok().map(|b| (b, ctype))) {
        Some((b, ctype)) => crate::photos::respond(200, ctype, b),
        None => crate::photos::not_found(),
    }
}

/// Where the window loads the vision model from: a small file server on this
/// computer only (127.0.0.1), under a random path, serving only the model's
/// files. WebView2 reads big answers from gcimg:// a few KB at a time, so the
/// 350 MB model took minutes to load that way.
#[tauri::command]
pub fn vision_url(app: AppHandle) -> Result<String, String> {
    static URL: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    if let Some(u) = URL.get() {
        return Ok(u.clone());
    }
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let token = {
        use std::hash::{BuildHasher, Hasher};
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        h.write_u32(std::process::id());
        let a = h.finish();
        h.write_u64(a);
        format!("{a:016x}{:016x}", h.finish())
    };
    let prefix = format!("/{token}/");
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            let prefix = prefix.clone();
            std::thread::spawn(move || {
                let _ = answer(&app, &prefix, stream);
            });
        }
    });
    Ok(URL.get_or_init(|| format!("http://127.0.0.1:{port}/{token}/")).clone())
}

fn answer(app: &AppHandle, prefix: &str, mut stream: std::net::TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(std::time::Duration::from_secs(10)))?;
    let mut head = Vec::new();
    let mut buf = [0u8; 1024];
    while !head.windows(4).any(|w| w == b"\r\n\r\n") {
        let n = stream.read(&mut buf)?;
        if n == 0 || head.len() > 16384 {
            return Ok(());
        }
        head.extend_from_slice(&buf[..n]);
    }
    let line = String::from_utf8_lossy(&head);
    let mut parts = line.split_whitespace();
    let (method, target) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    let cors = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n";
    if method == "OPTIONS" {
        return stream.write_all(format!("HTTP/1.1 204 No Content\r\n{cors}\r\n").as_bytes());
    }
    let path = target.split('?').next().unwrap_or("");
    let path = percent_encoding::percent_decode_str(path).decode_utf8_lossy();
    let file = path.strip_prefix(prefix).filter(|_| method == "GET").and_then(|p| vision_file(&app.state::<Ai>(), p));
    let Some((file, ctype)) = file else {
        return stream.write_all(format!("HTTP/1.1 404 Not Found\r\n{cors}Content-Length: 0\r\n\r\n").as_bytes());
    };
    let Ok(mut f) = std::fs::File::open(&file) else {
        return stream.write_all(format!("HTTP/1.1 404 Not Found\r\n{cors}Content-Length: 0\r\n\r\n").as_bytes());
    };
    let len = f.metadata()?.len();
    stream.write_all(format!("HTTP/1.1 200 OK\r\n{cors}Content-Type: {ctype}\r\nContent-Length: {len}\r\nCache-Control: no-store\r\n\r\n").as_bytes())?;
    std::io::copy(&mut f, &mut std::io::BufWriter::with_capacity(1 << 20, stream)).map(|_| ())
}

pub fn models_dir(app: &AppHandle) -> PathBuf {
    app.path().app_local_data_dir().map(|d| d.join("ai")).unwrap_or_else(|_| Path::new("ai").to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_pictures_are_checked() {
        assert_eq!(mask_picture_bytes(2048, 1365, 2048 * 1365 * 4), Ok(2048 * 1365 * 4));
        assert!(mask_picture_bytes(2048, 1365, 2048 * 1365 * 4 - 1).is_err());
        assert!(mask_picture_bytes(0, 10, 1000).is_err());
        assert!(mask_picture_bytes(8193, 1, usize::MAX).is_err());
        assert!(mask_picture_bytes(8192, 8192, usize::MAX).unwrap_err().contains("too large"));
        // Sizes whose product overflows are refused, not wrapped around.
        assert!(mask_picture_bytes(usize::MAX, usize::MAX, 16).is_err());
        assert!(mask_picture_bytes(1 << 33, 1 << 31, 0).is_err());
    }

    #[test]
    fn denoise_tiles_go_in_and_out_as_before() {
        let n = DN_TILE * DN_TILE;
        let gain = [2.1, 1.0, 1.6];
        for (w, h, x0, y0, tw, th) in [(700, 500, 208, 0, 256, 256), (120, 90, 0, 0, 120, 90), (300, 256, 44, 0, 256, 256)] {
            let src: Vec<f32> = (0..tw * th * 3).map(|i| ((i * 7919) % 1000) as f32 / 900.0).collect();
            // As written before: one pixel at a time.
            let mut want = vec![0f32; 3 * n];
            for ty in 0..DN_TILE {
                for tx in 0..DN_TILE {
                    let k = (ty.min(th - 1) * tw + tx.min(tw - 1)) * 3;
                    for c in 0..3 {
                        want[c * n + ty * DN_TILE + tx] = (src[k + c] * gain[c]).clamp(0.0, 1.0).powf(1.0 / 2.2);
                    }
                }
            }
            assert!(dn_input(&src, tw, th, gain).iter().zip(&want).all(|(a, b)| a.to_bits() == b.to_bits()));
            let y: Vec<f32> = (0..3 * n).map(|i| ((i * 104_729) % 1000) as f32 / 999.0).collect();
            let ((wx0, wx1), (wy0, wy1)) = (tile_span(x0, tw, w), tile_span(y0, th, h));
            let mut expect = vec![7u16; w * h * 3];
            for py in wy0..wy1 {
                for px in wx0..wx1 {
                    let (tx, ty) = (px - x0, py - y0);
                    let k = (ty * tw + tx) * 3;
                    let bright = (0..3).any(|c| src[k + c] * gain[c] > 0.98);
                    for c in 0..3 {
                        let v = if bright { src[k + c] } else { y[c * n + ty * DN_TILE + tx].clamp(0.0, 1.0).powf(2.2) / gain[c] };
                        expect[(py * w + px) * 3 + c] = half::f16::from_f32(v).to_bits();
                    }
                }
            }
            let mut got = vec![7u16; w * h * 3];
            dn_output(&mut got, w, (x0, y0, tw), (wx0, wx1, wy0, wy1), &src, &y, gain);
            assert_eq!(got, expect, "{w}x{h} tile at {x0},{y0}");
        }
    }

    #[test]
    fn denoise_tiles_cover_every_pixel_once() {
        for len in [100, 256, 257, 700, 8256] {
            let starts = tile_starts(len);
            let mut seen = vec![0; len];
            for (k, &p) in starts.iter().enumerate() {
                let n = DN_TILE.min(len);
                let (a, b) = tile_span(p, n, len);
                // A later tile may redo pixels; it never leaves gaps.
                let a = if k > 0 { a.max(tile_span(starts[k - 1], n, len).1) } else { a };
                for s in &mut seen[a..b] {
                    *s += 1;
                }
            }
            assert!(seen.iter().all(|&s| s == 1), "len {len}");
        }
    }

    /// FLIGHTROOM_AI_DIST=<built folder> cargo test installs -- --ignored --nocapture
    /// Downloads every feature from the folder (as from the release) into an empty one, then uses them.
    #[test]
    #[ignore]
    fn installs_from_a_release_folder() {
        let dist = std::env::var("FLIGHTROOM_AI_DIST").unwrap();
        std::env::set_var("FLIGHTROOM_AI_BASE", format!("file://{dist}/"));
        let dir = std::env::temp_dir().join(format!("fr-ai-{}", std::process::id()));
        let ai = Ai::new(dir.clone());
        let m = ai.manifest().unwrap();
        for feature in ["subject", "landscape", "people", "denoise"] {
            for f in Ai::needs(&m, feature).unwrap() {
                if !ai.have(&f) {
                    ai.download(&f, |_| {}).unwrap();
                }
            }
        }
        let rgb = Img { w: 320, h: 240, c: 3, v: (0..320 * 240 * 3).map(|k| ((k / 3) % 320) as f32 / 320.0).collect() };
        for task in ["subject", "landscape", "people"] {
            println!("{task}: {} masks", masks(&ai, task, &rgb).unwrap().len());
        }
        let out = denoise(&ai, (300, 200), [2.0, 1.0, 1.5], |_, _, w, h| vec![0.2; w * h * 3], &std::sync::atomic::AtomicBool::new(false), |_, _| {}).unwrap();
        assert_eq!(out.len(), 300 * 200 * 3);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn guided_filter_keeps_a_flat_mask_flat() {
        let i = Img { w: 16, h: 16, c: 1, v: (0..256).map(|k| (k % 16) as f32 / 15.0).collect() };
        let p = Img { w: 16, h: 16, c: 1, v: vec![0.7; 256] };
        assert!(guided(&i, &p, 2, 1e-3).v.iter().all(|v| (v - 0.7).abs() < 1e-3));
    }

    #[test]
    fn finds_separate_people() {
        let mut v = vec![0.0; 100];
        for k in [11, 12, 21, 22, 77, 78, 87] {
            v[k] = 0.9;
        }
        let b = people_boxes(&Img { w: 10, h: 10, c: 1, v }, 2);
        assert_eq!(b, vec![(1, 1, 3, 3), (7, 7, 9, 9)]);
    }

    /// Runs the real models when FLIGHTROOM_AI_TEST points at a folder with them and a test picture.
    #[test]
    fn real_models() {
        let Ok(dir) = std::env::var("FLIGHTROOM_AI_TEST") else { return };
        let dir = PathBuf::from(dir);
        let ai = Ai::new(dir.clone());
        let pic = std::fs::read(dir.join("test.rgb")).unwrap();
        let w = u32::from_le_bytes(pic[0..4].try_into().unwrap()) as usize;
        let h = u32::from_le_bytes(pic[4..8].try_into().unwrap()) as usize;
        let rgb = Img { w, h, c: 3, v: pic[8..].iter().map(|&b| b as f32 / 255.0).collect() };
        // FLIGHTROOM_AI_TASKS=people,landscape runs only those tasks (no BiRefNet needed).
        if let Ok(only) = std::env::var("FLIGHTROOM_AI_TASKS") {
            for task in only.split(',') {
                let t = std::time::Instant::now();
                let m = masks(&ai, task, &rgb).unwrap();
                eprintln!("{task}: {:?} in {:?}", m.iter().map(|x| x.0.clone()).collect::<Vec<_>>(), t.elapsed());
                for (name, img) in m {
                    std::fs::write(dir.join(format!("out-{name}.gray")), img.to_u8()).unwrap();
                }
            }
            return;
        }
        let t = std::time::Instant::now();
        let _ = ai.session("birefnet.onnx");
        eprintln!("load {:?}", t.elapsed());
        let t = std::time::Instant::now();
        let sal = salient(&ai, &rgb).unwrap();
        eprintln!("salient {:?}", t.elapsed());
        let t = std::time::Instant::now();
        let m = main_subject(sal).resize(rgb.w, rgb.h);
        eprintln!("main_subject {:?}", t.elapsed());
        let t = std::time::Instant::now();
        let guide = rgb.gray();
        let _ = crisp(clean(guided(&guide, &m, (guide.w.max(guide.h) / 512).max(2), 1e-3)));
        eprintln!("post {:?}", t.elapsed());
        for task in ["subject", "landscape", "people"] {
            let t = std::time::Instant::now();
            let m = masks(&ai, task, &rgb).unwrap();
            eprintln!("{task}: {:?} in {:?}", m.iter().map(|x| x.0.clone()).collect::<Vec<_>>(), t.elapsed());
            for (name, img) in m {
                std::fs::write(dir.join(format!("out-{name}.gray")), img.to_u8()).unwrap();
            }
        }
    }
}
