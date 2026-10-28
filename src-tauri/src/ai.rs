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

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

const BASE: &str = "https://github.com/subtlemoon/gearcheck/releases/download/ai-models-1/";

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
    installing: Mutex<()>,
}

impl Ai {
    pub fn new(dir: PathBuf) -> Self {
        Ai { dir, manifest: Mutex::new(None), sessions: Mutex::new(HashMap::new()), on_cpu: Mutex::default(), device: Mutex::new(None), installing: Mutex::new(()) }
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
    fn needs(m: &Manifest, feature: &str) -> Result<Vec<FileInfo>, String> {
        let names = m.runtime.get(std::env::consts::OS).ok_or("AI isn't available on this system")?;
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

    fn session(&self, model: &str) -> Result<Arc<Mutex<ort::session::Session>>, String> {
        self.engine()?;
        if let Some(s) = self.sessions.lock().unwrap().get(model) {
            return Ok(s.clone());
        }
        let path = self.dir.join(model);
        if !path.exists() {
            return Err(format!("{model} isn't downloaded"));
        }
        let gpu = cfg!(windows) && !self.on_cpu.lock().unwrap().contains(model);
        let s = match open(&path, gpu) {
            Ok(s) => Ok(s),
            // Some graphics drivers reject a model DirectML would otherwise run.
            Err(e) if gpu => {
                eprintln!("[ai] {model} on the graphics card: {e}; using the processor");
                self.on_cpu.lock().unwrap().insert(model.to_string());
                open(&path, false)
            }
            Err(e) => Err(e),
        }
        .map_err(|e| format!("Couldn't load {model}: {e}"))?;
        let s = Arc::new(Mutex::new(s));
        self.sessions.lock().unwrap().insert(model.to_string(), s.clone());
        Ok(s)
    }

    /// Runs a model on one input. When the graphics card fails at it, the model
    /// moves to the processor for good (this run included).
    fn infer(&self, model: &str, shape: Vec<i64>, data: Vec<f32>) -> Result<(Vec<i64>, Vec<f32>), String> {
        let s = self.session(model)?;
        if !cfg!(windows) || self.on_cpu.lock().unwrap().contains(model) {
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
    if gpu {
        // DirectML wants these.
        b = b.with_memory_pattern(false)?.with_parallel_execution(false)?;
        b = b.with_execution_providers([ort::ep::DirectML::default().build()])?;
    }
    b = b.with_intra_threads(std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4))?;
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

/// IS-Net (general use) on a picture, at 1024 x 1024: how sure it is each spot is the subject.
fn isnet(ai: &Ai, rgb: &Img) -> Result<Img, String> {
    let small = rgb.resize(1024, 1024);
    let mut x = vec![0.0f32; 3 * 1024 * 1024];
    for (k, px) in small.v.chunks_exact(3).enumerate() {
        for ch in 0..3 {
            x[ch * 1024 * 1024 + k] = px[ch] - 0.5;
        }
    }
    let (_, y) = ai.infer("isnet.onnx", vec![1, 3, 1024, 1024], x)?;
    let (lo, hi) = y.iter().fold((f32::MAX, f32::MIN), |(a, b), &v| (a.min(v), b.max(v)));
    let v = y.iter().map(|&v| (v - lo) / (hi - lo).max(1e-6)).collect();
    Ok(Img { w: 1024, h: 1024, c: 1, v })
}

/// Subject, at the picture's size. A subject that fills only part of the
/// frame gets a second, closer look at just its square, so thin parts (a
/// kart's cage) come out as themselves with the background between them.
fn subject(ai: &Ai, rgb: &Img) -> Result<Img, String> {
    let (w, h) = (rgb.w, rgb.h);
    let m = main_subject(isnet(ai, rgb)?).resize(w, h);
    let on: Vec<usize> = (0..w * h).filter(|&k| m.v[k] >= 0.5).collect();
    let Some(&first) = on.first() else { return Ok(m) };
    let (x0, y0, x1, y1) = on.iter().fold((first % w, first / w, first % w, first / w), |(a, b, c, d), &k| {
        (a.min(k % w), b.min(k / w), c.max(k % w), d.max(k / w))
    });
    let side = (x1 - x0).max(y1 - y0) as f32 * 1.2;
    let (cx, cy) = ((x0 + x1) as f32 / 2.0, (y0 + y1) as f32 / 2.0);
    let (bx0, by0) = ((cx - side / 2.0).max(0.0) as usize, (cy - side / 2.0).max(0.0) as usize);
    let (bx1, by1) = (((cx + side / 2.0) as usize + 1).min(w), ((cy + side / 2.0) as usize + 1).min(h));
    let (cw, ch) = (bx1 - bx0, by1 - by0);
    if cw * ch * 10 >= w * h * 6 || cw < 16 || ch < 16 {
        return Ok(m);
    }
    let crop = rgb.crop_resize(bx0 as f32, by0 as f32, cw as f32, ch as f32, cw, ch);
    let near = isnet(ai, &crop)?.resize(cw, ch);
    let mut v = vec![0.0f32; w * h];
    for y in 0..ch {
        v[(by0 + y) * w + bx0..(by0 + y) * w + bx1].copy_from_slice(&near.v[y * cw..(y + 1) * cw]);
    }
    Ok(main_subject(Img { w, h, c: 1, v }))
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
    let keep: Vec<bool> = parts.iter().enumerate().map(|(i, r)| i == best || inside(bounds(r))).collect();
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
                let crop = rgb.crop_resize(bx, by, side, side, 256, 256);
                let parts = person_parts(ai, &crop)?;
                // Back into the picture: each part, inside the person's square.
                let place = |f: &dyn Fn(&[f32]) -> f32| -> Img {
                    let mut v = vec![0.0f32; rgb.w * rgb.h];
                    let (px0, py0) = (bx.max(0.0) as usize, by.max(0.0) as usize);
                    let (px1, py1) = (((bx + side) as usize).min(rgb.w), ((by + side) as usize).min(rgb.h));
                    for y in py0..py1 {
                        for x in px0..px1 {
                            let (u, w) = ((x as f32 + 0.5 - bx) / side * 256.0 - 0.5, (y as f32 + 0.5 - by) / side * 256.0 - 0.5);
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
    let n = DN_TILE * DN_TILE;
    for (j, &y0) in ys.iter().enumerate() {
        for (i, &x0) in xs.iter().enumerate() {
            if cancel.load(std::sync::atomic::Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let (tw, th) = (DN_TILE.min(w), DN_TILE.min(h));
            let src = tile(x0, y0, tw, th);
            // Planar input, edge pixels repeated out to the tile size.
            let mut x = vec![0f32; 3 * n];
            for ty in 0..DN_TILE {
                for tx in 0..DN_TILE {
                    let k = (ty.min(th - 1) * tw + tx.min(tw - 1)) * 3;
                    for c in 0..3 {
                        x[c * n + ty * DN_TILE + tx] = (src[k + c] * gain[c]).clamp(0.0, 1.0).powf(1.0 / 2.2);
                    }
                }
            }
            let (_, y) = ai.infer(DN_MODEL, vec![1, 3, DN_TILE as i64, DN_TILE as i64], x)?;
            let (wx0, wx1) = tile_span(x0, tw, w);
            let (wy0, wy1) = tile_span(y0, th, h);
            for py in wy0..wy1 {
                for px in wx0..wx1 {
                    let (tx, ty) = (px - x0, py - y0);
                    let k = (ty * tw + tx) * 3;
                    // Clipped highlights carry no noise worth removing; keep them exact.
                    let bright = (0..3).any(|c| src[k + c] * gain[c] > 0.98);
                    for c in 0..3 {
                        let v = if bright { src[k + c] } else { y[c * n + ty * DN_TILE + tx].clamp(0.0, 1.0).powf(2.2) / gain[c] };
                        out[(py * w + px) * 3 + c] = half::f16::from_f32(v).to_bits();
                    }
                }
            }
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
    device: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn ai_status(app: AppHandle) -> Status {
    tauri::async_runtime::spawn_blocking(move || {
        let ai = app.state::<Ai>();
        let mut st = Status { features: HashMap::new(), sizes: HashMap::new(), device: ai.device.lock().unwrap().clone(), error: None };
        match ai.manifest() {
            Ok(m) => {
                for f in m.features.keys() {
                    if let Ok(files) = Ai::needs(&m, f) {
                        let missing: u64 = files.iter().filter(|x| !ai.have(x)).map(|x| x.size).sum();
                        st.features.insert(f.clone(), missing == 0);
                        st.sizes.insert(f.clone(), missing);
                    }
                }
            }
            Err(e) => st.error = Some(e),
        }
        st
    })
    .await
    .unwrap_or(Status { features: HashMap::new(), sizes: HashMap::new(), device: None, error: Some("AI status failed".into()) })
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
    if w == 0 || hh == 0 || bytes.len() < w * hh * 4 {
        return Err("bad picture".into());
    }
    let mut v = Vec::with_capacity(w * hh * 3);
    for y in 0..hh {
        for px in bytes[(hh - 1 - y) * w * 4..(hh - y) * w * 4].chunks_exact(4) {
            v.extend(px[..3].iter().map(|&b| b as f32 / 255.0));
        }
    }
    let rgb = Img { w, h: hh, c: 3, v };
    let result = tauri::async_runtime::spawn_blocking(move || masks(&app.state::<Ai>(), &task, &rgb)).await.map_err(|e| e.to_string())??;
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

pub fn models_dir(app: &AppHandle) -> PathBuf {
    app.path().app_local_data_dir().map(|d| d.join("ai")).unwrap_or_else(|_| Path::new("ai").to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

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
