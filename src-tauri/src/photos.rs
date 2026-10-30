// Culling: lists photos in a folder, serves their embedded previews to the window
// through the gcimg:// protocol, caches thumbnails on disk, and writes star ratings.

use crate::photolib::{self as lib, PhotoInfo};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
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
    // A poisoned lock still holds a good count (it is never changed while `f` runs).
    fn active(&self) -> MutexGuard<'_, usize> {
        self.active.lock().unwrap_or_else(|e| e.into_inner())
    }
    pub fn run<T>(&self, f: impl FnOnce() -> T) -> T {
        let mut a = self.active();
        while *a >= self.n {
            a = self.cv.wait(a).unwrap_or_else(|e| e.into_inner());
        }
        *a += 1;
        drop(a);
        // Gives the slot back even if `f` panics, so later reads don't wait forever.
        struct Slot<'a>(&'a Limiter);
        impl Drop for Slot<'_> {
            fn drop(&mut self) {
                *self.0.active() -= 1;
                self.0.cv.notify_one();
            }
        }
        let _slot = Slot(self);
        f()
    }
}

#[derive(Clone)]
struct Cached {
    key: String,
    info: PhotoInfo,
}

/// Photo info by file, least recently used dropped first once full.
struct InfoCache {
    max: usize,
    tick: u64,
    map: HashMap<PathBuf, (Cached, u64)>,
    /// Last use -> file, oldest first.
    order: BTreeMap<u64, PathBuf>,
}

impl InfoCache {
    fn new(max: usize) -> Self {
        InfoCache { max, tick: 0, map: HashMap::new(), order: BTreeMap::new() }
    }
    fn get(&mut self, p: &Path) -> Option<&Cached> {
        self.tick += 1;
        let (c, used) = self.map.get_mut(p)?;
        self.order.remove(used);
        *used = self.tick;
        self.order.insert(self.tick, p.to_path_buf());
        Some(c)
    }
    fn insert(&mut self, p: PathBuf, c: Cached) {
        self.remove(&p);
        while self.map.len() >= self.max {
            let Some((_, old)) = self.order.pop_first() else { break };
            self.map.remove(&old);
        }
        self.tick += 1;
        self.order.insert(self.tick, p.clone());
        self.map.insert(p, (c, self.tick));
    }
    fn remove(&mut self, p: &Path) {
        if let Some((_, used)) = self.map.remove(p) {
            self.order.remove(&used);
        }
    }
}

pub struct Photos {
    /// Folders opened this session; only their files are served.
    folders: Mutex<HashSet<PathBuf>>,
    info: Mutex<InfoCache>,
    io: Limiter,
    /// Full-size previews decoded for auto-rating, two at a time (45 MB each at 45 MP).
    decode: Limiter,
    /// One lock per file being written, so writes to one file run in order
    /// (see locked; a lock goes once no one holds or waits for it).
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
            info: Mutex::new(InfoCache::new(INFO_CACHE_MAX)),
            io: Limiter::new(6),
            decode: Limiter::new(2),
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
        let info = self.io.run(|| lib::FileSource::open(p).map(|f| lib::read_photo_info(&f, &ext)))?;
        self.info.lock().unwrap().insert(p.to_path_buf(), Cached { key: key.clone(), info: info.clone() });
        Ok((key, info))
    }

    fn forget(&self, p: &Path) {
        self.info.lock().unwrap().remove(p);
    }

    /// Runs `f` holding file `p`'s write lock.
    fn locked<T>(&self, p: &Path, f: impl FnOnce() -> T) -> T {
        let lock = self.writes.lock().unwrap().entry(p.to_path_buf()).or_default().clone();
        let out = {
            let _g = lock.lock().unwrap_or_else(|e| e.into_inner());
            f()
        };
        // Copies are only made under the list's lock: one left alone is no one else's.
        let mut writes = self.writes.lock().unwrap();
        drop(lock);
        if writes.get(p).is_some_and(|l| Arc::strong_count(l) == 1) {
            writes.remove(p);
        }
        out
    }

    fn thumb_path(&self, p: &Path, key: &str) -> PathBuf {
        let mut h = Sha1::new();
        h.update(format!("{}|{}", p.to_string_lossy(), key).as_bytes());
        self.thumbs.join(format!("{}.jpg", hex::encode(h.finalize())))
    }
}

/// Reads an embedded JPEG. Its offset and length come from the photo's own
/// metadata, so they are checked against the file before anything is allocated.
pub fn read_part(p: &Path, part: &lib::JpegPart) -> std::io::Result<Vec<u8>> {
    let f = fs::File::open(p)?;
    let size = f.metadata()?.len();
    let len = part.length.unwrap_or(size);
    let bad = |what: &str| std::io::Error::new(std::io::ErrorKind::InvalidData, format!("embedded preview {what}"));
    if part.offset.checked_add(len).map_or(true, |end| end > size) {
        return Err(bad("lies outside the file"));
    }
    if len > lib::MAX_PART {
        return Err(bad("is too large"));
    }
    let buf = lib::read_at(&f, part.offset, len as usize);
    if buf.len() as u64 != len {
        return Err(bad("couldn't be read in full"));
    }
    Ok(buf)
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

/// Writes a thumbnail cache file through its own temporary name and a rename, so
/// two writers of the same photo (or a reader meanwhile) never meet a torn file.
fn write_cache(file: &Path, data: &[u8]) -> std::io::Result<()> {
    static N: AtomicU64 = AtomicU64::new(0);
    let mut tmp = file.as_os_str().to_owned();
    tmp.push(format!(".{}-{}.tmp", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, data)?;
    if let Err(e) = fs::rename(&tmp, file) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

/// A sidecar's text. None only when there is no sidecar yet (or it is blank):
/// one that exists but can't be read is an error, never a fresh start, so
/// Lightroom's and other apps' data in it is never written over.
pub fn read_sidecar(sidecar: &Path) -> Result<Option<String>, String> {
    Ok(read_sidecar_as(sidecar)?.map(|(text, _)| text))
}

/// A sidecar's text and how it was stored (UTF-8 or UTF-16).
fn read_sidecar_as(sidecar: &Path) -> Result<Option<(String, lib::XmpEncoding)>, String> {
    let name = sidecar.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    match fs::read(sidecar) {
        Ok(bytes) => lib::xmp_file_text(bytes).map_err(|e| format!("{name}: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Couldn't read {name}: {e}")),
    }
}

/// Changes a sidecar, writing it back in the encoding it was in (UTF-8 for a new one).
fn rewrite_sidecar(sidecar: &Path, f: impl FnOnce(Option<String>) -> String) -> Result<(), String> {
    let (old, enc) = match read_sidecar_as(sidecar)? {
        Some((text, enc)) => (Some(text), enc),
        None => (None, lib::XmpEncoding::Utf8),
    };
    atomic_write(sidecar, &lib::xmp_file_bytes(&f(old), enc)).map_err(|e| e.to_string())
}

/// Reads, changes and writes a sidecar while holding its lock (ratings and
/// develop settings share the file).
pub fn edit_sidecar(app: &AppHandle, sidecar: &Path, f: impl FnOnce(Option<String>) -> String) -> Result<(), String> {
    app.state::<Photos>().locked(sidecar, || rewrite_sidecar(sidecar, f))
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

/// Largest embedded preview decoded for auto-rating (one byte a pixel): well above
/// any camera's (45 MP on a Z7 II), so a damaged or crafted file can't take gigabytes.
const MAX_GRAY_PIXELS: usize = 120_000_000;

/// Grey (luma) pixels of a JPEG inside x, y, w, h (cut to the picture): its
/// width and height (u32 each), then a byte a pixel, top row first. Only the
/// luma is decoded.
pub fn jpeg_gray(jpg: &[u8], x: usize, y: usize, w: usize, h: usize) -> Option<Vec<u8>> {
    use zune_jpeg::zune_core::{bytestream::ZCursor, colorspace::ColorSpace, options::DecoderOptions};
    let opts = DecoderOptions::default().jpeg_set_out_colorspace(ColorSpace::Luma).set_max_width(1 << 15).set_max_height(1 << 15);
    let mut d = zune_jpeg::JpegDecoder::new_with_options(ZCursor::new(jpg), opts);
    // The size comes from the file: checked before the picture is decoded.
    d.decode_headers().ok()?;
    let (pw, ph) = d.dimensions()?;
    if pw.checked_mul(ph).map_or(true, |n| n == 0 || n > MAX_GRAY_PIXELS) {
        return None;
    }
    let px = d.decode().ok()?;
    if px.len() < pw * ph {
        return None;
    }
    let (x, y) = (x.min(pw), y.min(ph));
    let (w, h) = (w.min(pw - x), h.min(ph - y));
    let mut out = Vec::with_capacity(8 + w * h);
    out.extend((w as u32).to_le_bytes());
    out.extend((h as u32).to_le_bytes());
    for row in px.chunks_exact(pw).skip(y).take(h) {
        out.extend_from_slice(&row[x..x + w]);
    }
    Some(out)
}

// /photo/preview?p=<file>  full-size embedded JPEG
// /photo/thumb?p=<file>    small JPEG (cached on disk); 404 when the file has
//                          none, and the window makes one and sends it back.
// /photo/gray?p=<file>&x&y&w&h  part of the full-size one in grey (jpeg_gray), for
//                          auto-rating: the window never has to hold the whole picture.
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
    if kind == "gray" {
        let n = |k: &str| q.get(k).and_then(|v| v.parse::<usize>().ok()).unwrap_or(0);
        let gray = info.preview.and_then(|part| photos.decode.run(|| read_part(&p, &part).ok().and_then(|jpg| jpeg_gray(&jpg, n("x"), n("y"), n("w"), n("h")))));
        return gray.map_or_else(not_found, |g| respond(200, "application/octet-stream", g));
    }
    let cached = photos.thumb_path(&p, &key);
    if let Ok(hit) = fs::read(&cached) {
        return respond(200, "image/jpeg", hit);
    }
    let Some(part) = info.thumb else { return not_found() };
    match read_part(&p, &part) {
        Ok(buf) => {
            let buf = lib::strip_exif(buf);
            let _ = fs::create_dir_all(&photos.thumbs).and_then(|_| write_cache(&cached, &buf));
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
                let rating = g.sidecar.as_ref().and_then(|s| read_sidecar(&dir.join(s)).ok().flatten()).and_then(|x| lib::read_rating(&x));
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
            photos.locked(&id, || {
                let buf = fs::read(&id).map_err(|e| e.to_string())?;
                atomic_write(&id, &lib::set_jpeg_rating(&buf, args.rating)?).map_err(|e| e.to_string())
            })?;
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
        write_cache(&photos.thumb_path(&p, &key), &bytes).map_err(|e| e.to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("flightroom-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn limiter_gives_the_slot_back_after_a_panic() {
        let l = Arc::new(Limiter::new(1));
        let l2 = l.clone();
        let r = std::thread::spawn(move || l2.run(|| panic!("bad file"))).join();
        assert!(r.is_err());
        assert_eq!(*l.active(), 0);
        // Would wait forever if the slot had leaked.
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || tx.send(l.run(|| 7)).unwrap());
        assert_eq!(rx.recv_timeout(std::time::Duration::from_secs(5)), Ok(7));
    }

    #[test]
    fn limiter_wakes_a_waiting_caller_after_a_panic() {
        let l = Arc::new(Limiter::new(1));
        let (started, wait_started) = std::sync::mpsc::channel();
        let (release, wait_release) = std::sync::mpsc::channel::<()>();
        let l1 = l.clone();
        let first = std::thread::spawn(move || {
            l1.run(|| {
                started.send(()).unwrap();
                wait_release.recv().unwrap();
                panic!("bad file");
            })
        });
        wait_started.recv().unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        let l2 = l.clone();
        std::thread::spawn(move || tx.send(l2.run(|| 1)).unwrap());
        release.send(()).unwrap();
        assert!(first.join().is_err());
        assert_eq!(rx.recv_timeout(std::time::Duration::from_secs(5)), Ok(1));
    }

    fn cached(k: &str) -> Cached {
        Cached { key: k.into(), info: PhotoInfo::default() }
    }

    #[test]
    fn info_cache_drops_the_least_recently_used() {
        let mut c = InfoCache::new(3);
        for n in ["a", "b", "c"] {
            c.insert(PathBuf::from(n), cached(n));
        }
        assert!(c.get(Path::new("a")).is_some()); // a is now the most recent
        c.insert(PathBuf::from("d"), cached("d"));
        assert_eq!(c.map.len(), 3);
        assert!(c.get(Path::new("b")).is_none());
        for n in ["a", "c", "d"] {
            assert!(c.get(Path::new(n)).is_some(), "{n}");
        }
        // Replacing an entry (the file changed) doesn't evict anything.
        c.insert(PathBuf::from("c"), cached("c2"));
        assert_eq!(c.map.len(), 3);
        assert_eq!(c.get(Path::new("c")).unwrap().key, "c2");
        c.remove(Path::new("a"));
        assert_eq!((c.map.len(), c.order.len()), (2, 2));
    }

    #[test]
    fn info_cache_stays_at_its_limit() {
        let mut c = InfoCache::new(INFO_CACHE_MAX);
        for i in 0..INFO_CACHE_MAX + 500 {
            c.insert(PathBuf::from(i.to_string()), cached(""));
        }
        assert_eq!((c.map.len(), c.order.len()), (INFO_CACHE_MAX, INFO_CACHE_MAX));
        assert!(c.get(Path::new("499")).is_none());
        assert!(c.get(Path::new("500")).is_some());
    }

    #[test]
    fn read_part_checks_offsets_and_lengths_from_the_file() {
        let d = tmp_dir("read-part");
        let f = d.join("a.nef");
        fs::write(&f, (0..100u8).collect::<Vec<_>>()).unwrap();
        let part = |offset, length| lib::JpegPart { offset, length, width: 1, height: 1 };
        assert_eq!(read_part(&f, &part(10, Some(5))).unwrap(), vec![10, 11, 12, 13, 14]);
        assert_eq!(read_part(&f, &part(0, None)).unwrap().len(), 100);
        assert_eq!(read_part(&f, &part(90, Some(10))).unwrap().len(), 10);
        for bad in [part(90, Some(11)), part(101, Some(0)), part(0, Some(u32::MAX as u64)), part(u64::MAX, Some(2)), part(2, Some(u64::MAX))] {
            let e = read_part(&f, &bad).unwrap_err();
            assert_eq!(e.kind(), std::io::ErrorKind::InvalidData);
        }
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn sidecars_that_cant_be_read_are_left_alone() {
        let d = tmp_dir("sidecars");
        let new = |old: Option<String>| lib::set_rating(old.as_deref(), 4);
        // None yet: a new one is made.
        let missing = d.join("new.xmp");
        rewrite_sidecar(&missing, new).unwrap();
        assert_eq!(lib::read_rating(&fs::read_to_string(&missing).unwrap()), Some(4));
        // Blank: also a fresh start.
        let blank = d.join("blank.xmp");
        fs::write(&blank, "  \n").unwrap();
        rewrite_sidecar(&blank, new).unwrap();
        assert_eq!(lib::read_rating(&fs::read_to_string(&blank).unwrap()), Some(4));
        // UTF-16: edited and written back as UTF-16.
        let utf16 = |t: &str| lib::xmp_file_bytes(t, lib::XmpEncoding::Utf16 { big_endian: false, bom: true });
        let wide = d.join("utf16.xmp");
        fs::write(&wide, utf16("<x:xmpmeta><rdf:Description crs:Exposure2012=\"+1\"/></x:xmpmeta>")).unwrap();
        rewrite_sidecar(&wide, new).unwrap();
        let (text, enc) = lib::xmp_file_text(fs::read(&wide).unwrap()).unwrap().unwrap();
        assert_eq!((lib::read_rating(&text), enc), (Some(4), lib::XmpEncoding::Utf16 { big_endian: false, bom: true }));
        assert!(text.contains("crs:Exposure2012=\"+1\""));
        // Not valid UTF-8 or UTF-16, not XMP Flightroom can edit, or not a file: unchanged, with an error.
        let mut broken = utf16("<x:xmpmeta><rdf:Description crs:Exposure2012=\"+1\"/></x:xmpmeta>");
        broken.extend(0xdc00u16.to_le_bytes());
        let latin1: &[u8] = b"<x:xmpmeta><rdf:Description dc:creator=\"Caf\xe9\"/></x:xmpmeta>";
        let odd: &[u8] = b"<x:xmpmeta>Lightroom data in a form Flightroom doesn't know</x:xmpmeta>";
        for (name, bytes) in [("broken16.xmp", broken.as_slice()), ("latin1.xmp", latin1), ("odd.xmp", odd)] {
            let f = d.join(name);
            fs::write(&f, bytes).unwrap();
            assert!(rewrite_sidecar(&f, new).is_err(), "{name}");
            assert_eq!(fs::read(&f).unwrap(), bytes, "{name}");
        }
        let dir = d.join("folder.xmp");
        fs::create_dir(&dir).unwrap();
        assert!(read_sidecar(&dir).is_err());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn crops_a_jpeg_in_grey() {
        // A 100 x 60 picture: grey levels in steps, colour that has the same luma, encoded and decoded back.
        let (w, h) = (100u16, 60u16);
        let mut rgb = Vec::new();
        for y in 0..h {
            for x in 0..w {
                let v = (x / 10 * 20 + y / 20 * 5) as u8;
                rgb.extend([v, v, v]);
            }
        }
        let mut jpg = Vec::new();
        let mut enc = jpeg_encoder::Encoder::new(&mut jpg, 98);
        enc.set_sampling_factor(jpeg_encoder::SamplingFactor::R_4_2_0);
        enc.encode(&rgb, w, h, jpeg_encoder::ColorType::Rgb).unwrap();
        let g = jpeg_gray(&jpg, 25, 10, 40, 30).unwrap();
        assert_eq!((u32::from_le_bytes(g[0..4].try_into().unwrap()), u32::from_le_bytes(g[4..8].try_into().unwrap())), (40, 30));
        assert_eq!(g.len(), 8 + 40 * 30);
        for (i, &v) in g[8..].iter().enumerate() {
            let (x, y) = (25 + i % 40, 10 + i / 40);
            let want = rgb[(y * w as usize + x) * 3] as i32;
            // Away from the steps (where JPEG rings a little), the grey comes back.
            if x % 10 > 1 && x % 10 < 8 && y % 20 > 1 && y % 20 < 18 {
                assert!((v as i32 - want).abs() <= 2, "{x},{y}: {v} vs {want}");
            }
        }
        // A rectangle past the edges is cut to the picture; something not a JPEG is refused.
        let g = jpeg_gray(&jpg, 90, 50, 40, 40).unwrap();
        assert_eq!(&g[0..8], [10, 0, 0, 0, 10, 0, 0, 0]);
        assert!(jpeg_gray(b"not a jpeg", 0, 0, 10, 10).is_none());
    }

    #[test]
    fn grey_refuses_a_preview_too_big_to_decode() {
        let mut jpg = Vec::new();
        jpeg_encoder::Encoder::new(&mut jpg, 90).encode(&[128; 64 * 48 * 3], 64, 48, jpeg_encoder::ColorType::Rgb).unwrap();
        assert!(jpeg_gray(&jpg, 0, 0, 64, 48).is_some());
        // The same file claiming 60000 x 60000 (3.6 GB of grey): refused from its header alone.
        let sof = jpg.windows(2).position(|m| m == [0xff, 0xc0]).unwrap();
        jpg[sof + 5..sof + 9].copy_from_slice(&[0xea, 0x60, 0xea, 0x60]);
        assert!(jpeg_gray(&jpg, 0, 0, 100, 100).is_none());
    }

    /// FLIGHTROOM_JPEG=<big jpeg> cargo test --release --lib gray_of_a_big -- --ignored --nocapture
    #[test]
    #[ignore]
    fn gray_of_a_big_preview() {
        let jpg = fs::read(std::env::var("FLIGHTROOM_JPEG").unwrap()).unwrap();
        let t = std::time::Instant::now();
        let g = jpeg_gray(&jpg, 3000, 2000, 1600, 1600).unwrap();
        println!("decoded and cut in {:?}: {} bytes", t.elapsed(), g.len());
        fs::write(std::env::var("FLIGHTROOM_JPEG").unwrap() + ".gray", &g).unwrap();
    }

    #[test]
    fn write_locks_keep_writes_in_order_and_go_after() {
        let photos = Photos::new(PathBuf::from("unused"));
        let (a, b) = (PathBuf::from("a.xmp"), PathBuf::from("b.xmp"));
        let inside = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|s| {
            for i in 0..16 {
                let (photos, inside, p) = (&photos, &inside, if i % 2 == 0 { &a } else { &b });
                s.spawn(move || {
                    for _ in 0..50 {
                        photos.locked(p, || {
                            // Only this thread writes this file now.
                            let n = inside.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            assert!(n < 2, "{n} writers at once");
                            std::thread::yield_now();
                            inside.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
                        });
                    }
                });
            }
        });
        // Nothing waits any more: the list is empty again (it used to keep every file ever written).
        assert!(photos.writes.lock().unwrap().is_empty());
        // A write that panics doesn't block the file after it.
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| photos.locked(&a, || panic!("disk gone"))));
        assert_eq!(photos.locked(&a, || 7), 7);
    }

    #[test]
    fn concurrent_thumb_writes_never_leave_a_torn_file() {
        let d = tmp_dir("thumbs");
        let f = d.join("t.jpg");
        let datas: Vec<Vec<u8>> = (0..8u8).map(|i| vec![i; 256 * 1024 + i as usize]).collect();
        std::thread::scope(|s| {
            for data in &datas {
                let f = &f;
                s.spawn(move || {
                    for _ in 0..10 {
                        write_cache(f, data).unwrap();
                    }
                });
            }
        });
        let got = fs::read(&f).unwrap();
        assert!(datas.contains(&got));
        assert_eq!(fs::read_dir(&d).unwrap().count(), 1, "no temporary files left");
        let _ = fs::remove_dir_all(&d);
    }
}
