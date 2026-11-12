// The Library's catalog: every photo in the folders you add, with its shooting
// details (camera, lens, date, settings), stars and keywords, so the Library
// can search and filter across all of them at once. Kept as one JSON file in
// Flightroom's data folder; the photos and their sidecars stay the source of
// truth (stars and keywords are read from them again on every refresh).

use crate::photolib as lib;
use crate::photos::{self, clean, Photo, Photos};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Shot {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub lens: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub taken_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub focal_length: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub f_number: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exposure: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub iso: Option<f64>,
    #[serde(default)]
    pub orientation: u32,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub file_rating: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    #[serde(flatten)]
    pub photo: Photo,
    pub folder: String,
    #[serde(flatten)]
    pub shot: Shot,
    /// Only in OneDrive (not downloaded): its details are read once it is.
    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
    pub cloud: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub path: String,
    #[serde(default)]
    pub subfolders: bool,
    /// When it was last read (ms since 1970).
    #[serde(default)]
    pub at: u64,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Data {
    #[serde(default)]
    pub folders: Vec<Folder>,
    #[serde(default)]
    pub photos: Vec<Entry>,
}

#[derive(Default)]
pub struct Catalog {
    lock: Mutex<()>,
}

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("catalog.json"))
}

fn read(app: &AppHandle) -> Result<Data, String> {
    match fs::read(file(app)?) {
        Ok(b) => serde_json::from_slice(&b).map_err(|e| format!("The library file can't be read: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Data::default()),
        Err(e) => Err(e.to_string()),
    }
}

fn write(app: &AppHandle, d: &Data) -> Result<(), String> {
    let b = serde_json::to_vec(d).map_err(|e| e.to_string())?;
    photos::atomic_write(&file(app)?, &b).map_err(|e| e.to_string())
}

fn now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// Files Windows keeps only in the cloud (OneDrive "online-only"): reading one downloads it.
#[cfg(windows)]
fn cloud_only(p: &Path) -> bool {
    use std::os::windows::fs::MetadataExt;
    const OFFLINE: u32 = 0x1000;
    const RECALL_ON_OPEN: u32 = 0x40000;
    const RECALL_ON_DATA_ACCESS: u32 = 0x400000;
    fs::metadata(p).is_ok_and(|m| m.file_attributes() & (OFFLINE | RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS) != 0)
}
#[cfg(not(windows))]
fn cloud_only(_: &Path) -> bool {
    false
}

fn shot_of(info: &lib::PhotoInfo) -> Shot {
    Shot {
        make: info.make.clone(),
        model: info.model.clone(),
        lens: info.lens.clone(),
        taken_at: info.taken_at.clone(),
        focal_length: info.focal_length,
        f_number: info.f_number,
        exposure: info.exposure,
        iso: info.iso,
        orientation: info.orientation,
        file_rating: info.file_rating,
    }
}

/// Reads one folder (and its subfolders, if asked) into entries. Shooting
/// details of files that haven't changed since last time are kept, so a
/// refresh only opens new and changed files.
fn index(photos: &Photos, folder: &Path, subfolders: bool, old: &HashMap<String, &Entry>) -> Result<Vec<Entry>, String> {
    use rayon::prelude::*;
    let found = photos::scan_photos(photos, folder, subfolders)?;
    let root = folder.to_string_lossy().to_string();
    Ok(found
        .into_par_iter()
        .map(|p| {
            let file = clean(photos::photo_file(&p.id));
            let same = old.get(&p.id).filter(|e| e.photo.size == p.size && e.photo.modified == p.modified && !e.cloud);
            let (shot, cloud) = match same {
                Some(e) => (e.shot.clone(), false),
                None if cloud_only(&file) => (Shot::default(), true),
                None => (photos.info(&file).map(|(_, i)| shot_of(&i)).unwrap_or_default(), false),
            };
            Entry { photo: p, folder: root.clone(), shot, cloud }
        })
        .collect())
}

#[derive(Serialize, Clone)]
struct Progress {
    folder: String,
    done: usize,
    total: usize,
}

/// The catalog, with its folders opened for the viewer.
#[tauri::command]
pub async fn catalog_load(app: AppHandle) -> Result<Data, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let d = read(&app)?;
        let photos = app.state::<Photos>();
        for e in &d.photos {
            if let Some(dir) = clean(photos::photo_file(&e.photo.id)).parent() {
                photos.open_folder(dir);
            }
        }
        Ok(d)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Adds folders (or reads them again): the whole catalog afterwards. With no
/// folders, every folder in the catalog is read again.
#[tauri::command]
pub async fn catalog_index(app: AppHandle, folders: Vec<String>, subfolders: Option<bool>) -> Result<Data, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cat = app.state::<Catalog>();
        let _g = cat.lock.lock().unwrap();
        let mut d = read(&app)?;
        let mut list: Vec<Folder> = if folders.is_empty() {
            d.folders.clone()
        } else {
            folders
                .iter()
                .map(|f| {
                    let path = clean(f).to_string_lossy().to_string();
                    let had = d.folders.iter().find(|x| x.path.eq_ignore_ascii_case(&path));
                    Folder { subfolders: subfolders.unwrap_or(had.is_some_and(|h| h.subfolders)), path, at: 0 }
                })
                .collect()
        };
        list.dedup_by(|a, b| a.path.eq_ignore_ascii_case(&b.path));
        let total = list.len();
        let photos = app.state::<Photos>();
        let mut errors = Vec::new();
        for (i, f) in list.iter_mut().enumerate() {
            let _ = app.emit("catalog:progress", Progress { folder: f.path.clone(), done: i, total });
            let old: HashMap<String, &Entry> = d.photos.iter().filter(|e| e.folder.eq_ignore_ascii_case(&f.path)).map(|e| (e.photo.id.clone(), e)).collect();
            match index(&photos, Path::new(&f.path), f.subfolders, &old) {
                Ok(fresh) => {
                    drop(old);
                    d.photos.retain(|e| !e.folder.eq_ignore_ascii_case(&f.path));
                    d.photos.extend(fresh);
                    f.at = now();
                }
                Err(e) => errors.push(format!("{}: {e}", f.path)),
            }
            match d.folders.iter_mut().find(|x| x.path.eq_ignore_ascii_case(&f.path)) {
                Some(x) => *x = f.clone(),
                None => d.folders.push(f.clone()),
            }
        }
        let _ = app.emit("catalog:progress", Progress { folder: String::new(), done: total, total });
        d.folders.sort_by(|a, b| lib::natural_cmp(&a.path, &b.path));
        write(&app, &d)?;
        if !errors.is_empty() && errors.len() == total {
            return Err(errors.join("; "));
        }
        Ok(d)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Takes a folder (and its photos) out of the catalog. The photos themselves stay where they are.
#[tauri::command]
pub async fn catalog_remove_folder(app: AppHandle, folder: String) -> Result<Data, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cat = app.state::<Catalog>();
        let _g = cat.lock.lock().unwrap();
        let mut d = read(&app)?;
        let path = clean(&folder).to_string_lossy().to_string();
        d.folders.retain(|f| !f.path.eq_ignore_ascii_case(&path));
        d.photos.retain(|e| !e.folder.eq_ignore_ascii_case(&path));
        write(&app, &d)?;
        Ok(d)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeywordArgs {
    /// Photo ids and their sidecars.
    items: Vec<(String, String)>,
    #[serde(default)]
    add: Vec<String>,
    #[serde(default)]
    remove: Vec<String>,
}

/// Adds and takes away keywords in the photos' sidecars (dc:subject, which
/// Lightroom reads with Metadata › Read Metadata from Files). Returns each
/// photo's keywords afterwards.
#[tauri::command]
pub async fn catalog_keywords(app: AppHandle, args: KeywordArgs) -> Result<HashMap<String, Vec<String>>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let photos = app.state::<Photos>();
        let mut out = HashMap::new();
        for (id, sidecar) in &args.items {
            let Some(sc) = photos.allowed(sidecar).filter(|s| lib::ext_of(&s.to_string_lossy()) == ".xmp") else {
                return Err(format!("{sidecar} isn't a sidecar in a library folder"));
            };
            photos::edit_sidecar(&app, &sc, |old| lib::set_keywords(old.as_deref(), &args.add, &args.remove))?;
            let now = photos::read_sidecar(&sc)?.map(|t| lib::read_keywords(&t)).unwrap_or_default();
            out.insert(id.clone(), now);
        }
        // The catalog file keeps up, so the Library shows them after a restart without a refresh.
        let cat = app.state::<Catalog>();
        let _g = cat.lock.lock().unwrap();
        if let Ok(mut d) = read(&app) {
            for e in d.photos.iter_mut() {
                if let Some(k) = out.get(&e.photo.id) {
                    e.photo.keywords = k.clone();
                }
            }
            let _ = write(&app, &d);
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
