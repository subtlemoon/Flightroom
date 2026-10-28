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
    device: Mutex<Option<String>>,
    installing: Mutex<()>,
}

impl Ai {
    pub fn new(dir: PathBuf) -> Self {
        Ai { dir, manifest: Mutex::new(None), sessions: Mutex::new(HashMap::new()), device: Mutex::new(None), installing: Mutex::new(()) }
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
        let err = |e: ort::Error| format!("Couldn't load {model}: {e}");
        let mut b = ort::session::Session::builder().map_err(err)?;
        #[cfg(windows)]
        {
            // DirectML wants these; if it can't start, ONNX Runtime falls back to the CPU.
            b = b.with_memory_pattern(false).map_err(|e| e.to_string())?;
            b = b.with_parallel_execution(false).map_err(|e| e.to_string())?;
            b = b.with_execution_providers([ort::ep::DirectML::default().build()]).map_err(|e| e.to_string())?;
        }
        b = b.with_intra_threads(std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4)).map_err(|e| e.to_string())?;
        let s = Arc::new(Mutex::new(b.commit_from_file(&path).map_err(err)?));
        self.sessions.lock().unwrap().insert(model.to_string(), s.clone());
        Ok(s)
    }

    /// Frees the models (they take a lot of memory); they load again when needed.
    pub fn release(&self) {
        self.sessions.lock().unwrap().clear();
    }
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
        for x in 0..=r.min(w - 1) {
            acc += row[x] as f64;
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

/// The guided filter leaves a faint haze away from edges; snap near-0 and near-1 flat.
fn clean(mut m: Img) -> Img {
    for v in &mut m.v {
        *v = ((*v - 0.06) / 0.88).clamp(0.0, 1.0);
    }
    m
}

// --- the models -----------------------------------------------------------------

/// Subject: IS-Net (general use), 1024 x 1024.
fn subject(ai: &Ai, rgb: &Img) -> Result<Img, String> {
    let s = ai.session("isnet.onnx")?;
    let small = rgb.resize(1024, 1024);
    let mut x = vec![0.0f32; 3 * 1024 * 1024];
    for (k, px) in small.v.chunks_exact(3).enumerate() {
        for ch in 0..3 {
            x[ch * 1024 * 1024 + k] = px[ch] - 0.5;
        }
    }
    let (_, y) = run(&s, vec![1, 3, 1024, 1024], x)?;
    let (lo, hi) = y.iter().fold((f32::MAX, f32::MIN), |(a, b), &v| (a.min(v), b.max(v)));
    let v = y.iter().map(|&v| (v - lo) / (hi - lo).max(1e-6)).collect();
    Ok(Img { w: 1024, h: 1024, c: 1, v })
}

const ADE: usize = 513;
/// Scene parsing: DeepLab v3+ trained on ADE20K (150 kinds of things). Returns
/// per-class probabilities (129 x 129 grid) and the part of the grid the photo fills.
fn scene(ai: &Ai, rgb: &Img) -> Result<(Img, usize, usize), String> {
    let s = ai.session("ade20k.onnx")?;
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
    let (shape, logits) = run(&s, vec![1, ADE as i64, ADE as i64, 3], x)?;
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
    let s = ai.session("selfie_multiclass.onnx")?;
    let small = crop.resize(256, 256);
    let x = small.v.iter().map(|v| v * 2.0 - 1.0).collect();
    let (_, y) = run(&s, vec![1, 256, 256, 3], x)?;
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
    boxes.sort_by(|a, b| b.0.cmp(&a.0));
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
            let m = refine(&guide, &subject(ai, rgb)?);
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
                out.push((name.to_string(), refine(&guide, &m)));
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
