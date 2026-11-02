// The screen's colour profile, for correcting the Develop picture the way
// Lightroom does (src/develop/icc.js reads it). WebView2 shows canvases
// without colour management, so the app does it itself.

use base64::Engine;
use serde::Serialize;

#[derive(Serialize)]
pub struct DisplayProfile {
    name: String,
    data: String,
}

/// The ICC profile Windows uses for the main screen, or None.
#[tauri::command]
pub fn display_profile() -> Option<DisplayProfile> {
    let path = profile_path()?;
    let data = std::fs::read(&path).ok()?;
    if data.len() > 4 << 20 {
        return None;
    }
    let name = std::path::Path::new(&path).file_stem()?.to_string_lossy().into_owned();
    Some(DisplayProfile { name, data: base64::engine::general_purpose::STANDARD.encode(data) })
}

#[cfg(windows)]
fn profile_path() -> Option<String> {
    use std::ffi::c_void;
    type GetDc = unsafe extern "system" fn(*mut c_void) -> *mut c_void;
    type ReleaseDc = unsafe extern "system" fn(*mut c_void, *mut c_void) -> i32;
    type GetIcm = unsafe extern "system" fn(*mut c_void, *mut u32, *mut u16) -> i32;
    unsafe {
        let user32 = libloading::Library::new("user32.dll").ok()?;
        let gdi32 = libloading::Library::new("gdi32.dll").ok()?;
        let get_dc: libloading::Symbol<GetDc> = user32.get(b"GetDC\0").ok()?;
        let release_dc: libloading::Symbol<ReleaseDc> = user32.get(b"ReleaseDC\0").ok()?;
        let get_icm: libloading::Symbol<GetIcm> = gdi32.get(b"GetICMProfileW\0").ok()?;
        let dc = get_dc(std::ptr::null_mut());
        if dc.is_null() {
            return None;
        }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = get_icm(dc, &mut len, buf.as_mut_ptr());
        release_dc(std::ptr::null_mut(), dc);
        if ok == 0 {
            return None;
        }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..end]))
    }
}

#[cfg(not(windows))]
fn profile_path() -> Option<String> {
    None
}
