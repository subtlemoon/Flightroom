// Your own looks: .cube files kept in Flightroom's looks folder
// (%LOCALAPPDATA%\com.jaewon.flightroom\looks). A photo names its look by file
// name in the sidecar (fr:Look="user:<file>").

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const MAX_CUBE: u64 = 32 * 1024 * 1024; // a 65³ .cube is about 7 MB

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("looks");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

/// A plain file name ending in .cube, nothing that could reach outside the folder.
pub fn safe_name(name: &str) -> Option<String> {
    let n = name.trim();
    let ok = !n.is_empty()
        && n.len() <= 120
        && n.to_ascii_lowercase().ends_with(".cube")
        && !n.starts_with('.')
        && !n.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control());
    ok.then(|| n.to_string())
}

#[tauri::command]
pub fn looks_list(app: AppHandle) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = fs::read_dir(dir(&app)?)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|e| safe_name(&e.file_name().to_string_lossy()))
        .collect();
    names.sort_by(|a, b| crate::photolib::natural_cmp(a, b));
    Ok(names)
}

#[tauri::command]
pub fn looks_read(app: AppHandle, name: String) -> Result<String, String> {
    let n = safe_name(&name).ok_or("Not a look's file name")?;
    let p = dir(&app)?.join(n);
    if fs::metadata(&p).map_err(|_| format!("{name} isn't in the looks folder"))?.len() > MAX_CUBE {
        return Err("The file is too big for a look".into());
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

/// Keeps a .cube file; a different file with the same name gets " 2", " 3"... Returns the name it was kept as.
#[tauri::command]
pub fn looks_save(app: AppHandle, name: String, text: String) -> Result<String, String> {
    let n = safe_name(&name).ok_or("Not a .cube file name")?;
    if text.len() as u64 > MAX_CUBE {
        return Err("The file is too big for a look".into());
    }
    let d = dir(&app)?;
    let stem = &n[..n.len() - 5];
    for k in 1..1000 {
        let candidate = if k == 1 { n.clone() } else { format!("{stem} {k}.cube") };
        let p = d.join(&candidate);
        match fs::read_to_string(&p) {
            Ok(old) if old == text => return Ok(candidate),
            Ok(_) => continue,
            Err(_) => {
                crate::photos::atomic_write(&p, text.as_bytes()).map_err(|e| e.to_string())?;
                return Ok(candidate);
            }
        }
    }
    Err("Too many looks with that name".into())
}

#[tauri::command]
pub fn looks_remove(app: AppHandle, name: String) -> Result<bool, String> {
    let n = safe_name(&name).ok_or("Not a look's file name")?;
    let p = dir(&app)?.join(n);
    if p.is_file() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub fn looks_folder(app: AppHandle) -> Result<String, String> {
    Ok(dir(&app)?.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_plain_cube_names() {
        assert_eq!(super::safe_name("Film 01.cube").as_deref(), Some("Film 01.cube"));
        assert_eq!(super::safe_name("..\\x.cube"), None);
        assert_eq!(super::safe_name("a/b.cube"), None);
        assert_eq!(super::safe_name("x.txt"), None);
        assert_eq!(super::safe_name(".cube"), None);
    }
}
