// Retouch's own documents: Photoshop files in their own folder (Pictures\Flightroom
// Retouch), apart from the Library. A new one starts blank; opening a picture or
// a Photoshop file makes a copy there (the original is never changed). Retouch
// saves its work into the copy as it goes (psdwrite.rs): the window renders each
// layer's pixels, its mask and the flattened picture in tiles, and the layers
// whose settings haven't changed since the last save are written from memory.
use crate::psd::Doc;
use crate::psdwrite::{self, Pixels, Spec};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct Docs {
    saves: Mutex<HashMap<String, Save>>,
    /// Layer pixels and masks last written, by the key the window gives them.
    cache: Mutex<HashMap<String, Cached>>,
}

#[derive(Clone)]
enum Cached {
    Px(Pixels),
    Mask(Pixels, u8),
}

struct Save {
    path: PathBuf,
    w: usize,
    h: usize,
    specs: Vec<SaveSpec>,
    state: Value,
    srcs: Vec<String>,
    /// Rendered layers (RGBA) and masks (grey) over the whole canvas, by spec index.
    px: HashMap<usize, Vec<u8>>,
    masks: HashMap<usize, Vec<u8>>,
    merged: Vec<u8>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveSpec {
    #[serde(flatten)]
    spec: Spec,
    /// What its pixels depend on (none: it has none to write).
    key: Option<String>,
    mask_key: Option<String>,
}

fn folder(app: &AppHandle) -> Result<PathBuf, String> {
    let p = app.path();
    let base = p.picture_dir().or_else(|_| p.document_dir()).or_else(|_| p.app_local_data_dir()).map_err(|e| e.to_string())?;
    let d = base.join("Flightroom Retouch");
    std::fs::create_dir_all(&d).map_err(|e| format!("Couldn't make the Retouch folder: {e}"))?;
    Ok(d)
}

/// "<name>.psd" in the folder, numbered when taken.
fn free_name(dir: &Path, name: &str) -> PathBuf {
    let safe: String = name.chars().map(|c| if r#"<>:"/\|?*"#.contains(c) || c.is_control() { '_' } else { c }).collect();
    let safe = safe.trim().trim_end_matches('.');
    let safe = if safe.is_empty() { "Untitled" } else { safe };
    let mut p = dir.join(format!("{safe}.psd"));
    let mut n = 2;
    while p.exists() {
        p = dir.join(format!("{safe} {n}.psd"));
        n += 1;
    }
    p
}

fn opened(app: &AppHandle, dir: &Path) {
    app.state::<crate::photos::Photos>().open_folder(dir);
}

#[tauri::command]
pub fn retouch_folder(app: AppHandle) -> Result<String, String> {
    let d = folder(&app)?;
    opened(&app, &d);
    Ok(d.to_string_lossy().to_string())
}

/// A blank document: `colour` (0-1 RGB) all over.
#[tauri::command]
pub async fn retouch_new(app: AppHandle, name: String, width: usize, height: usize, colour: [f64; 3]) -> Result<String, String> {
    if width == 0 || height == 0 || width > 30000 || height > 30000 || width * height > 300_000_000 {
        return Err("The size must be between 1 and 30,000 pixels a side".into());
    }
    let dir = folder(&app)?;
    opened(&app, &dir);
    tauri::async_runtime::spawn_blocking(move || {
        let px = colour.map(|c| (c.clamp(0.0, 1.0) * 255.0).round() as u16 * 257);
        let rgb: Vec<u16> = std::iter::repeat_n(px, width * height).flatten().collect();
        let path = free_name(&dir, &name);
        crate::photos::atomic_write(&path, &psdwrite::plain(width, height, 8, &rgb, None)).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A picture or a Photoshop file copied into the folder as a document to work on.
#[tauri::command]
pub async fn retouch_import(app: AppHandle, path: String, remove: Option<bool>) -> Result<String, String> {
    let dir = folder(&app)?;
    opened(&app, &dir);
    tauri::async_runtime::spawn_blocking(move || {
        let src = PathBuf::from(&path);
        let ext = src.extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();
        let stem = src.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "Untitled".into());
        let bytes = std::fs::read(&src).map_err(|e| format!("Couldn't read {}: {e}", src.display()))?;
        let out = free_name(&dir, &stem);
        if crate::psd::is_psd(&ext) {
            Doc::parse(&bytes)?;
            std::fs::write(&out, &bytes).map_err(|e| e.to_string())?;
        } else {
            let deep = crate::formats::decode_deep(&bytes, &ext)?;
            let rgb = to_srgb(&deep.rgb, deep.icc.as_deref());
            let depth = if matches!(ext.as_str(), ".jpg" | ".jpeg" | ".jpe" | ".webp" | ".gif" | ".bmp") { 8 } else { 16 };
            crate::photos::atomic_write(&out, &psdwrite::plain(deep.w, deep.h, depth, &rgb, None)).map_err(|e| e.to_string())?;
        }
        // A picture made only to be opened here (a developed RAW, in the folder's own corner) goes once copied.
        if remove == Some(true) && src.parent().and_then(Path::parent) == Some(dir.as_path()) {
            let _ = std::fs::remove_file(&src);
        }
        Ok(out.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Pictures in another colour space as sRGB (documents are sRGB, like Retouch's layers).
fn to_srgb(rgb: &[u16], icc: Option<&[u8]>) -> Vec<u16> {
    let p = crate::icc::read(icc);
    if icc.is_none() {
        return rgb.to_vec();
    }
    let s = crate::icc::srgb();
    let m = mul3(crate::icc::from_xyz(&s), p.to_xyz);
    let same = p.curves[0][32768] == s.curves[0][32768] && m.iter().zip([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]).all(|(a, b)| (a - b).abs() < 1e-3);
    if same {
        return rgb.to_vec();
    }
    let enc = |v: f32| -> u16 {
        let v = v.clamp(0.0, 1.0);
        let e = if v <= 0.0031308 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 };
        (e * 65535.0 + 0.5) as u16
    };
    rgb.chunks_exact(3)
        .flat_map(|c| {
            let l = [p.curves[0][c[0] as usize], p.curves[1][c[1] as usize], p.curves[2][c[2] as usize]];
            [0, 1, 2].map(|r| enc(m[r * 3] * l[0] + m[r * 3 + 1] * l[1] + m[r * 3 + 2] * l[2]))
        })
        .collect()
}

fn mul3(a: [f32; 9], b: [f32; 9]) -> [f32; 9] {
    let mut o = [0.0; 9];
    for r in 0..3 {
        for c in 0..3 {
            o[r * 3 + c] = (0..3).map(|k| a[r * 3 + k] * b[k * 3 + c]).sum();
        }
    }
    o
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginArgs {
    job: String,
    path: String,
    specs: Vec<SaveSpec>,
    state: Value,
    #[serde(default)]
    srcs: Vec<String>,
}

/// Starts saving a document: answers which layers' pixels and masks (by spec index) the window must render.
#[tauri::command]
pub fn retouch_save_begin(app: AppHandle, args: BeginArgs) -> Result<Value, String> {
    let path = app.state::<crate::photos::Photos>().allowed(&args.path).ok_or("This document isn't in an open folder")?;
    let head = std::fs::read(&path).map_err(|e| e.to_string())?;
    let doc = Doc::parse(&head)?;
    let (w, h) = (doc.w, doc.h);
    let docs = app.state::<Docs>();
    let cache = docs.cache.lock().unwrap();
    let need_px: Vec<usize> = args.specs.iter().enumerate().filter(|(_, s)| s.key.as_ref().is_some_and(|k| !cache.contains_key(k))).map(|(i, _)| i).collect();
    let need_mask: Vec<usize> = args.specs.iter().enumerate().filter(|(_, s)| s.mask_key.as_ref().is_some_and(|k| !cache.contains_key(k))).map(|(i, _)| i).collect();
    drop(cache);
    let mut saves = docs.saves.lock().unwrap();
    // Only one save of a document at a time: an older one still going is dropped.
    saves.retain(|_, s| s.path != path);
    saves.insert(args.job, Save { path, w, h, specs: args.specs, state: args.state, srcs: args.srcs, px: HashMap::new(), masks: HashMap::new(), merged: vec![255; w * h * 3] });
    Ok(serde_json::json!({ "w": w, "h": h, "px": need_px, "mask": need_mask }))
}

/// A rendered tile (RGBA, bottom row first): `slot` a spec's pixels or mask, or the flattened picture.
#[tauri::command]
pub fn retouch_save_tile(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("expected bytes".into()) };
    let hd = request.headers();
    let get = |k: &str| hd.get(k).and_then(|v| v.to_str().ok()).map(str::to_string).ok_or(format!("missing {k}"));
    let n = |k: &str| -> Result<usize, String> { get(k)?.parse().map_err(|_| format!("bad {k}")) };
    let (job, kind) = (get("x-job")?, get("x-kind")?);
    let (x, y, tw, th) = (n("x-x")?, n("x-y")?, n("x-w")?, n("x-h")?);
    let docs = app.state::<Docs>();
    let mut saves = docs.saves.lock().unwrap();
    let s = saves.get_mut(&job).ok_or("save was cancelled")?;
    if x + tw > s.w || y + th > s.h || bytes.len() != tw * th * 4 {
        return Err("tile out of range".into());
    }
    let (w, h) = (s.w, s.h);
    for row in 0..th {
        let src = &bytes[(th - 1 - row) * tw * 4..(th - row) * tw * 4];
        let at = (y + row) * w + x;
        match kind.as_str() {
            "merged" => {
                for (d, p) in s.merged[at * 3..(at + tw) * 3].chunks_exact_mut(3).zip(src.chunks_exact(4)) {
                    d.copy_from_slice(&p[..3]);
                }
            }
            "mask" => {
                let m = s.masks.entry(n("x-slot")?).or_insert_with(|| vec![0; w * h]);
                for (d, p) in m[at..at + tw].iter_mut().zip(src.chunks_exact(4)) {
                    *d = p[0];
                }
            }
            _ => {
                let p = s.px.entry(n("x-slot")?).or_insert_with(|| vec![0; w * h * 4]);
                p[at * 4..(at + tw) * 4].copy_from_slice(src);
            }
        }
    }
    Ok(true)
}

/// Writes the document (cancel: drops the save).
#[tauri::command]
pub async fn retouch_save_finish(app: AppHandle, job: String, cancel: Option<bool>) -> Result<bool, String> {
    let Some(mut s) = app.state::<Docs>().saves.lock().unwrap().remove(&job) else { return Ok(false) };
    if cancel == Some(true) {
        return Ok(false);
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let old = std::fs::read(&s.path).map_err(|e| e.to_string())?;
        let doc = Doc::parse(&old)?;
        if (doc.w, doc.h) != (s.w, s.h) {
            return Err("The document changed size while it was saved".into());
        }
        let depth = if doc.depth == 8 { 8 } else { 16 };
        let base = doc.base()?;
        // The pictures image layers draw from: kept in the document if they'd be lost.
        let mut assets: Vec<(String, Vec<u8>)> = Vec::new();
        for src in &s.srcs {
            if let Some(a) = psdwrite::asset(&doc, src) {
                assets.push((src.clone(), a.to_vec()));
            } else if let Some(l) = src.strip_prefix("psd:").and_then(|i| i.parse::<usize>().ok()).and_then(|i| doc.layers.get(i)) {
                let (lw, lh, rgba) = doc.layer_rgba(l)?;
                if lw > 0 && lh > 0 {
                    assets.push((src.clone(), crate::develop::png(lw, lh, &rgba, image::ExtendedColorType::Rgba8)?));
                }
            }
        }
        let docs = app2.state::<Docs>();
        let mut cache = docs.cache.lock().unwrap().clone();
        let mut keep: HashMap<String, Cached> = HashMap::new();
        let (w, h) = (s.w, s.h);
        let mut specs: Vec<Spec> = Vec::with_capacity(s.specs.len());
        for (i, ss) in s.specs.iter().enumerate() {
            let mut sp = ss.spec.clone();
            if let Some(k) = &ss.key {
                let px = match (s.px.remove(&i), cache.remove(k)) {
                    (Some(rgba), _) => psdwrite::layer_pixels(&rgba, w, h, depth),
                    (None, Some(Cached::Px(p))) => p,
                    _ => psdwrite::layer_pixels(&[], 0, 0, depth),
                };
                keep.insert(k.clone(), Cached::Px(px.clone()));
                sp.pixels = Some(px);
            }
            if let Some(k) = &ss.mask_key {
                let m = match (s.masks.remove(&i), cache.remove(k)) {
                    (Some(grey), _) => psdwrite::mask_pixels(&grey, w, h, depth),
                    (None, Some(Cached::Mask(p, d))) => (p, d),
                    _ => (Pixels::default(), 255),
                };
                keep.insert(k.clone(), Cached::Mask(m.0.clone(), m.1));
                sp.mask = Some(m);
            }
            specs.push(sp);
        }
        *docs.cache.lock().unwrap() = keep;
        let merged: Vec<u16> = s.merged.iter().map(|&v| v as u16 * 257).collect();
        let bytes = psdwrite::write(&psdwrite::Out { w, h, depth, base: Some(&base), specs: &specs, merged: &merged, state: Some(s.state.clone()), assets: &assets, icc: None });
        crate::photos::atomic_write(&s.path, &bytes).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
