// Brings data over from GearCheck, the Electron app Flightroom used to be.
//
// GearCheck kept everything (gear, groups, settings, culling folders, auto-rate
// results) in the window's localStorage, which Chromium stores as a LevelDB
// database in %APPDATA%\GearCheck\Local Storage\leveldb. Flightroom's window has
// its own, empty storage, so on first start the window asks for GearCheck's
// values and saves them as its own. The old database is copied before reading
// and never changed.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// localStorage values of GearCheck's window (the file:// origin) whose names start with "gearcheck-".
pub fn read_local_storage(leveldb_dir: &Path) -> Result<HashMap<String, String>, String> {
    let tmp = std::env::temp_dir().join(format!("flightroom-migrate-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    for e in fs::read_dir(leveldb_dir).map_err(|e| e.to_string())?.flatten() {
        let name = e.file_name();
        if name == "LOCK" {
            continue;
        }
        let _ = fs::copy(e.path(), tmp.join(&name));
    }
    let out = read_copy(&tmp);
    let _ = fs::remove_dir_all(&tmp);
    out
}

fn read_copy(dir: &Path) -> Result<HashMap<String, String>, String> {
    use rusty_leveldb::{LdbIterator, Options, DB};
    let opt = Options { create_if_missing: false, ..Options::default() };
    let mut db = DB::open(dir, opt).map_err(|e| e.to_string())?;
    let mut it = db.new_iter().map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    it.seek_to_first();
    while let Some((k, v)) = it.next() {
        if let Some((origin, key)) = split_key(&k) {
            if origin.starts_with("file://") && key.starts_with("gearcheck-") {
                if let Some(value) = decode(&v) {
                    out.insert(key, value);
                }
            }
        }
    }
    Ok(out)
}

/// Chromium's key layout: "_" + origin + "\0" + encoded key.
fn split_key(k: &[u8]) -> Option<(String, String)> {
    let rest = k.strip_prefix(b"_")?;
    let nul = rest.iter().position(|&c| c == 0)?;
    let origin = String::from_utf8_lossy(&rest[..nul]).to_string();
    Some((origin, decode(&rest[nul + 1..])?))
}

/// Strings are stored with a one-byte tag: 1 = Latin-1, 0 = UTF-16LE.
fn decode(b: &[u8]) -> Option<String> {
    match b.first()? {
        1 => Some(b[1..].iter().map(|&c| c as char).collect()),
        0 => {
            let units: Vec<u16> = b[1..].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            String::from_utf16(&units).ok()
        }
        _ => None,
    }
}

/// Where GearCheck kept its data on this PC, if it was ever installed.
pub fn gearcheck_dir() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        PathBuf::from(std::env::var_os("HOME")?).join(".config")
    };
    let dir = base.join("GearCheck");
    dir.join("Local Storage").join("leveldb").is_dir().then_some(dir)
}

/// GearCheck's saved data, for the window to adopt on its first start.
#[tauri::command]
pub async fn migration_data() -> Result<HashMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(dir) = gearcheck_dir() else { return Ok(HashMap::new()) };
        read_local_storage(&dir.join("Local Storage").join("leveldb"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_both_string_forms() {
        assert_eq!(decode(b"\x01abc").as_deref(), Some("abc"));
        assert_eq!(decode(b"\x00a\x00\xb7\x00").as_deref(), Some("a·"));
        let k = b"_file://\x00\x01gearcheck-v1";
        assert_eq!(split_key(k), Some(("file://".to_string(), "gearcheck-v1".to_string())));
    }

    /// FLIGHTROOM_LEVELDB=<Local Storage/leveldb folder of a Chromium profile> cargo test -- --ignored
    #[test]
    #[ignore]
    fn reads_a_real_chromium_database() {
        let dir = std::env::var("FLIGHTROOM_LEVELDB").expect("set FLIGHTROOM_LEVELDB");
        let data = read_local_storage(Path::new(&dir)).unwrap();
        println!("{:?}", data.iter().map(|(k, v)| (k, v.len())).collect::<Vec<_>>());
        assert!(data.contains_key("gearcheck-v1"));
    }
}
