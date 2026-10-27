// Culling: lists photos in a folder, serves their embedded previews to the window
// through the gcimg:// protocol, caches thumbnails on disk, and writes star ratings.

use crate::photolib::{self as lib, PhotoInfo};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

/// Runs at most `n` file reads at once, so a 2,000-photo folder doesn't open 2,000 files together.
pub struct Limiter {
    n: usize,
    active: Mutex<usize>,
    cv: Condvar,
}

impl Limiter {
    pub fn new(n: usize) -> Self {
        Limiter { n, active: Mutex::new(0), cv: Condvar::new() }
    }
    pub fn run<T>(&self, f: impl FnOnce() -> T) -> T {
        let mut a = self.active.lock().unwrap();
        while *a >= self.n {
            a = self.cv.wait(a).unwrap();
        }
        *a += 1;
        drop(a);
        let out = f();
        *self.active.lock().unwrap() -= 1;
        self.cv.notify_one();
        out
    }
}

#[derive(Clone)]
struct Cached {
    key: String,
    info: PhotoInfo,
}

pub struct Photos {
    /// Folders opened this session; only their files are served.
    folders: Mutex<HashSet<PathBuf>>,
    info: Mutex<HashMap<PathBuf, Cached>>,
    io: Limiter,
    /// One lock per file being written, so writes to one file run in order.
    writes: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
    thumbs: PathBuf,
}

const INFO_CACHE_MAX: usize = 4000;

/// An absolute path the way Explorer shows it (no trailing separator, no \\?\ prefix).
pub fn clean(p: &str) -> PathBuf {
    let abs = std::path::absolute(p).unwrap_or_else(|_| PathBuf::from(p));
    let s = abs.to_string_lossy().to_string();
    let trimmed = s.trim_end_matches(['\\', '/']);
    if trimmed.is_empty() || trimmed.ends_with(':') {
        abs
    } else {
        PathBuf::from(trimmed)
    }
}

fn file_key(p: &Path) -> std::io::Result<String> {
    let st = fs::metadata(p)?;
    let mtime = st.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis()).unwrap_or(0);
    Ok(format!("{}:{}", st.len(), mtime))
}

impl Photos {
    pub fn new(thumbs: PathBuf) -> Self {
        Photos {
            folders: Mutex::new(HashSet::new()),
            info: Mutex::new(HashMap::new()),
            io: Limiter::new(6),
            writes: Mutex::new(HashMap::new()),
            thumbs,
        }
    }

    pub fn allowed(&self, p: &str) -> Option<PathBuf> {
        let path = clean(p);
        let dir = path.parent()?.to_path_buf();
        self.folders.lock().unwrap().contains(&dir).then_some(path)
    }

    pub fn info(&self, p: &Path) -> std::io::Result<(String, PhotoInfo)> {
        let key = file_key(p)?;
        if let Some(c) = self.info.lock().unwrap().get(p) {
            if c.key == key {
                return Ok((key, c.info.clone()));
            }
        }
        let ext = lib::ext_of(&p.to_string_lossy());
        let info = self.io.run(|| fs::File::open(p).map(|f| lib::read_photo_info(&f, &ext)))?;
        let mut cache = self.info.lock().unwrap();
        if cache.len() >= INFO_CACHE_MAX {
            cache.clear();
        }
        cache.insert(p.to_path_buf(), Cached { key: key.clone(), info: info.clone() });
        Ok((key, info))
    }

    fn forget(&self, p: &Path) {
        self.info.lock().unwrap().remove(p);
    }

    fn write_lock(&self, p: &Path) -> Arc<Mutex<()>> {
        self.writes.lock().unwrap().entry(p.to_path_buf()).or_default().clone()
    }

    fn thumb_path(&self, p: &Path, key: &str) -> PathBuf {
        let mut h = Sha1::new();
        h.update(format!("{}|{}", p.to_string_lossy(), key).as_bytes());
        self.thumbs.join(format!("{}.jpg", hex::encode(h.finalize())))
    }
}

pub fn read_part(p: &Path, part: &lib::JpegPart) -> std::io::Result<Vec<u8>> {
    match part.length {
        None => fs::read(p),
        Some(len) => {
            let f = fs::File::open(p)?;
            Ok(lib::Source::get(&f, part.offset, len as usize))
        }
    }
}

/// Writes go through a temporary file and a rename, so a crash or full disk can
/// never leave a half-written sidecar or JPEG.
pub fn atomic_write(file: &Path, data: &[u8]) -> std::io::Result<()> {
    let mut tmp = file.as_os_str().to_owned();
    tmp.push(".flightroom-tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, data)?;
    if let Err(e) = fs::rename(&tmp, file) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

/// Reads, changes and writes a sidecar while holding its lock (ratings and
/// develop settings share the file).
pub fn edit_sidecar(app: &AppHandle, sidecar: &Path, f: impl FnOnce(Option<String>) -> String) -> Result<(), String> {
    let photos = app.state::<Photos>();
    let lock = photos.write_lock(sidecar);
    let _g = lock.lock().unwrap();
    let old = fs::read_to_string(sidecar).ok();
    atomic_write(sidecar, f(old).as_bytes()).map_err(|e| e.to_string())
}

// --- gcimg:// ---------------------------------------------------------------

pub type HttpResponse = tauri::http::Response<Vec<u8>>;

pub fn respond(status: u16, ctype: &str, body: Vec<u8>) -> HttpResponse {
    tauri::http::Response::builder()
        .status(status)
        .header("content-type", ctype)
        .header("access-control-allow-origin", "*")
        .header("cache-control", "no-store")
        .body(body)
        .unwrap()
}

pub fn not_found() -> HttpResponse {
    respond(404, "text/plain", Vec::new())
}

pub fn query(uri: &tauri::http::Uri) -> HashMap<String, String> {
    url::form_urlencoded::parse(uri.query().unwrap_or("").as_bytes()).into_owned().collect()
}

// /photo/preview?p=<file>  full-size embedded JPEG
// /photo/thumb?p=<file>    small JPEG (cached on disk); 404 when the file has
//                          none, and the window makes one and sends it back.
pub fn handle_photo(app: &AppHandle, kind: &str, q: &HashMap<String, String>) -> HttpResponse {
    let photos = app.state::<Photos>();
    let Some(p) = q.get("p").and_then(|p| photos.allowed(p)) else { return respond(403, "text/plain", Vec::new()) };
    let Ok((key, info)) = photos.info(&p) else { return not_found() };
    if kind == "preview" {
        return match info.preview.and_then(|part| read_part(&p, &part).ok()) {
            Some(buf) => respond(200, "image/jpeg", lib::strip_exif(buf)),
            None => not_found(),
        };
    }
    let cached = photos.thumb_path(&p, &key);
    if let Ok(hit) = fs::read(&cached) {
        return respond(200, "image/jpeg", hit);
    }
    let Some(part) = info.thumb else { return not_found() };
    match read_part(&p, &part) {
        Ok(buf) => {
            let buf = lib::strip_exif(buf);
            let _ = fs::create_dir_all(&photos.thumbs).and_then(|_| fs::write(&cached, &buf));
            respond(200, "image/jpeg", buf)
        }
        Err(_) => not_found(),
    }
}

// --- commands ---------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Photo {
    id: String,
    name: String,
    raw: Option<String>,
    jpeg: Option<String>,
    sidecar: String,
    rating_in: &'static str,
    rating: Option<i32>,
}

#[derive(Serialize)]
pub struct Scan {
    folder: String,
    photos: Vec<Photo>,
}

#[tauri::command]
pub async fn cull_scan(app: AppHandle, folder: String) -> Result<Scan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = clean(&folder);
        let mut names = Vec::new();
        for e in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let Ok(e) = e else { continue };
            if e.file_type().map(|t| t.is_file()).unwrap_or(false) {
                names.push(e.file_name().to_string_lossy().to_string());
            }
        }
        app.state::<Photos>().folders.lock().unwrap().insert(dir.clone());
        let join = |n: &str| dir.join(n).to_string_lossy().to_string();
        let groups = lib::group_photos(&names);
        let photos = groups
            .into_iter()
            .map(|g| {
                let rating = g.sidecar.as_ref().and_then(|s| fs::read_to_string(dir.join(s)).ok()).and_then(|x| lib::read_rating(&x));
                Photo {
                    id: join(&g.file),
                    name: g.file.clone(),
                    raw: g.raw.as_deref().map(join),
                    jpeg: g.jpeg.as_deref().map(join),
                    sidecar: join(g.sidecar.as_deref().unwrap_or(&format!("{}.xmp", g.base))),
                    rating_in: if g.rating_in_file { "file" } else { "sidecar" },
                    rating,
                }
            })
            .collect();
        Ok(Scan { folder: dir.to_string_lossy().to_string(), photos })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Shooting info, orientation and the rating stored inside the file itself.
#[tauri::command]
pub async fn cull_meta(app: AppHandle, ids: Vec<String>) -> Result<HashMap<String, serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use rayon::prelude::*;
        let photos = app.state::<Photos>();
        Ok(ids
            .par_iter()
            .filter_map(|id| {
                let p = photos.allowed(id)?;
                let v = match photos.info(&p) {
                    Ok((_, info)) => {
                        let mut v = serde_json::to_value(&info).unwrap();
                        v["width"] = info.preview.map(|x| x.width).into();
                        v["height"] = info.preview.map(|x| x.height).into();
                        v["hasThumb"] = info.thumb.is_some().into();
                        v
                    }
                    Err(_) => serde_json::json!({ "error": true }),
                };
                Some((id.clone(), v))
            })
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateArgs {
    id: String,
    rating: i32,
    rating_in: String,
    sidecar: String,
}

#[tauri::command]
pub async fn cull_rate(app: AppHandle, args: RateArgs) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let photos = app.state::<Photos>();
        let Some(id) = photos.allowed(&args.id).filter(|_| (-1..=5).contains(&args.rating)) else {
            return Err("Invalid rating".to_string());
        };
        if args.rating_in == "file" {
            // A JPEG on its own: the rating goes in the file's XMP block (Lightroom reads it there).
            let lock = photos.write_lock(&id);
            let _g = lock.lock().unwrap();
            let buf = fs::read(&id).map_err(|e| e.to_string())?;
            atomic_write(&id, &lib::set_jpeg_rating(&buf, args.rating)?).map_err(|e| e.to_string())?;
            photos.forget(&id);
        } else {
            let Some(sidecar) = photos.allowed(&args.sidecar).filter(|s| lib::ext_of(&s.to_string_lossy()) == ".xmp") else {
                return Err("Invalid sidecar".to_string());
            };
            edit_sidecar(&app, &sidecar, |old| lib::set_rating(old.as_deref(), args.rating))?;
        }
        Ok(serde_json::json!({ "ok": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct Dirs {
    dir: String,
    names: Vec<String>,
}

/// Subfolders of `dir`, for the folder list on the Culling home page.
#[tauri::command]
pub async fn cull_list_dirs(dir: String) -> Result<Dirs, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let d = clean(&dir);
        let mut names: Vec<String> = fs::read_dir(&d)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| !n.starts_with(['.', '$']) && n != "System Volume Information")
            .collect();
        names.sort_by(|a, b| lib::natural_cmp(a, b));
        Ok(Dirs { dir: d.to_string_lossy().to_string(), names })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A thumbnail the window made for a file without one (body = JPEG bytes).
#[tauri::command]
pub async fn cull_save_thumb(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("expected bytes".into()) };
    let id = request.headers().get("x-id").and_then(|v| v.to_str().ok()).map(|s| {
        percent_encoding::percent_decode_str(s).decode_utf8_lossy().to_string()
    });
    let bytes = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let photos = app.state::<Photos>();
        let Some(p) = id.and_then(|id| photos.allowed(&id)) else { return Ok(false) };
        let (key, _) = photos.info(&p).map_err(|e| e.to_string())?;
        fs::create_dir_all(&photos.thumbs).map_err(|e| e.to_string())?;
        fs::write(photos.thumb_path(&p, &key), bytes).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct CacheSize {
    bytes: u64,
    files: usize,
}

#[tauri::command]
pub fn cull_cache_size(app: AppHandle) -> CacheSize {
    let dir = &app.state::<Photos>().thumbs;
    let mut out = CacheSize { bytes: 0, files: 0 };
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            out.files += 1;
            out.bytes += e.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    out
}

#[tauri::command]
pub fn cull_clear_cache(app: AppHandle) -> Result<bool, String> {
    let dir = &app.state::<Photos>().thumbs;
    match fs::remove_dir_all(dir) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}
