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
            info: Mutex::new(InfoCache::new(INFO_CACHE_MAX)),
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
        self.info.lock().unwrap().insert(p.to_path_buf(), Cached { key: key.clone(), info: info.clone() });
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
    let buf = lib::Source::get(&f, part.offset, len as usize);
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
    let name = sidecar.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    match fs::read(sidecar) {
        Ok(bytes) => lib::xmp_text(bytes).map_err(|e| format!("{name}: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Couldn't read {name}: {e}")),
    }
}

fn rewrite_sidecar(sidecar: &Path, f: impl FnOnce(Option<String>) -> String) -> Result<(), String> {
    let old = read_sidecar(sidecar)?;
    atomic_write(sidecar, f(old).as_bytes()).map_err(|e| e.to_string())
}

/// Reads, changes and writes a sidecar while holding its lock (ratings and
/// develop settings share the file).
pub fn edit_sidecar(app: &AppHandle, sidecar: &Path, f: impl FnOnce(Option<String>) -> String) -> Result<(), String> {
    let photos = app.state::<Photos>();
    let lock = photos.write_lock(sidecar);
    let _g = lock.lock().unwrap();
    rewrite_sidecar(sidecar, f)
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
        // Not UTF-8 (UTF-16 here), not XMP Flightroom can edit, or not a file: unchanged, with an error.
        let utf16: Vec<u8> = [0xff, 0xfe].into_iter().chain("<x:xmpmeta><rdf:Description crs:Exposure2012=\"+1\"/></x:xmpmeta>".encode_utf16().flat_map(u16::to_le_bytes)).collect();
        let odd: &[u8] = b"<x:xmpmeta>Lightroom data in a form Flightroom doesn't know</x:xmpmeta>";
        for (name, bytes) in [("utf16.xmp", utf16.as_slice()), ("odd.xmp", odd)] {
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
