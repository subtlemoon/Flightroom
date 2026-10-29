// App updates. Each release on GitHub carries the Windows installer and a small
// latest.json naming it and its SHA-256. A newer version downloads silently in
// the background and installs silently when the app closes (or right away with
// "Restart now"). Status is shown in Settings and written to update.log.
//
// The same release also carries latest.yml, which is what GearCheck 1.x's
// updater reads: that is how existing GearCheck installs become Flightroom.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

const LATEST_URL: &str = "https://github.com/subtlemoon/Flightroom/releases/latest/download/latest.json";
const RELEASE_URL: &str = "https://github.com/subtlemoon/Flightroom/releases/download";
pub const INSTALLER_PREFIX: &str = "Flightroom-Setup";

#[derive(Clone, Serialize)]
pub struct Status {
    state: String,
    message: String,
    at: u64,
}

#[derive(Deserialize)]
struct Latest {
    version: String,
    file: String,
    sha256: String,
}

#[derive(Default)]
pub struct Updater {
    status: Mutex<Option<Status>>,
    ready: Mutex<Option<(String, PathBuf)>>,
    busy: Mutex<bool>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir())
}

fn set_status(app: &AppHandle, state: &str, message: String) {
    let s = Status { state: state.into(), message: message.clone(), at: now() };
    *app.state::<Updater>().status.lock().unwrap() = Some(s.clone());
    let _ = app.emit("update:status", s);
    let dir = data_dir(app);
    let _ = fs::create_dir_all(&dir);
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(dir.join("update.log")) {
        let _ = writeln!(f, "{} {state}: {message}", now());
    }
}

fn parse_version(v: &str) -> (u64, u64, u64) {
    let mut it = v.trim_start_matches('v').split(['.', '-']).map(|p| p.parse::<u64>().unwrap_or(0));
    (it.next().unwrap_or(0), it.next().unwrap_or(0), it.next().unwrap_or(0))
}

pub fn newer(candidate: &str, current: &str) -> bool {
    parse_version(candidate) > parse_version(current)
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(600)))
        .build()
        .into()
}

fn check_inner(app: &AppHandle) -> Result<(), String> {
    let current = app.package_info().version.to_string();
    set_status(app, "checking", "Checking for updates…".into());
    let latest: Latest = agent()
        .get(&format!("{LATEST_URL}?t={}", now()))
        .call()
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_json()
        .map_err(|e| e.to_string())?;
    if !newer(&latest.version, &current) {
        set_status(app, "current", "Up to date".into());
        return Ok(());
    }
    if let Some((v, _)) = &*app.state::<Updater>().ready.lock().unwrap() {
        if *v == latest.version {
            set_status(app, "ready", format!("Version {v} will install when you close Flightroom"));
            return Ok(());
        }
    }
    if !latest.file.starts_with(INSTALLER_PREFIX) || latest.file.contains(['/', '\\']) {
        return Err("the release lists an unexpected file".into());
    }
    set_status(app, "downloading", format!("Downloading version {}…", latest.version));
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("updates");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&latest.file);
    let mut res = agent()
        .get(&format!("{RELEASE_URL}/v{}/{}", latest.version, latest.file))
        .call()
        .map_err(|e| e.to_string())?;
    let total: u64 = res.headers().get("content-length").and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok()).unwrap_or(0);
    let mut reader = res.body_mut().with_config().limit(1 << 30).reader();
    let mut out = fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buf = vec![0u8; 256 * 1024];
    let (mut got, mut last_pct) = (0u64, 0u64);
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
        out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        got += n as u64;
        if total > 0 {
            let pct = got * 100 / total;
            if pct >= last_pct + 5 {
                last_pct = pct;
                set_status(app, "downloading", format!("Downloading update… {pct}%"));
            }
        }
    }
    drop(out);
    if hex::encode(hash.finalize()) != latest.sha256.to_lowercase() {
        let _ = fs::remove_file(&path);
        return Err("the download was damaged (checksum mismatch)".into());
    }
    *app.state::<Updater>().ready.lock().unwrap() = Some((latest.version.clone(), path));
    set_status(app, "ready", format!("Version {} will install when you close Flightroom", latest.version));
    Ok(())
}

pub fn check(app: &AppHandle) {
    if cfg!(debug_assertions) {
        set_status(app, "idle", "Updates are only checked in the installed app".into());
        return;
    }
    let st = app.state::<Updater>();
    {
        let mut busy = st.busy.lock().unwrap();
        if *busy {
            return;
        }
        *busy = true;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = check_inner(&app) {
            // A failed later check (say, offline) doesn't undo an update that's already downloaded.
            let ready = app.state::<Updater>().ready.lock().unwrap().clone();
            match ready {
                Some((v, _)) => set_status(&app, "ready", format!("Version {v} will install when you close Flightroom")),
                None => set_status(&app, "error", format!("Update failed: {e}")),
            }
        }
        *app.state::<Updater>().busy.lock().unwrap() = false;
    });
}

pub fn start(app: &AppHandle) {
    check(app);
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60 * 60));
        check(&app);
    });
}

/// Starts the downloaded installer (silent). `reopen` opens the new version after.
fn run_installer(app: &AppHandle, reopen: bool) -> bool {
    let Some((version, path)) = app.state::<Updater>().ready.lock().unwrap().take() else { return false };
    guard::mark_installing(app, &version);
    let mut cmd = std::process::Command::new(&path);
    cmd.arg("/S");
    if reopen {
        cmd.arg("/R");
    }
    match cmd.spawn() {
        Ok(_) => true,
        Err(e) => {
            set_status(app, "error", format!("Couldn't start the installer: {e}"));
            false
        }
    }
}

/// Called as the app closes.
pub fn install_on_exit(app: &AppHandle) {
    run_installer(app, false);
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn update_status(app: AppHandle) -> Option<Status> {
    app.state::<Updater>().status.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_check(app: AppHandle) {
    check(&app);
}

/// "Restart now": closes, installs silently, and opens the new version.
#[tauri::command]
pub fn update_install(app: AppHandle) {
    if run_installer(&app, true) {
        app.exit(0);
    }
}

// Keeps Flightroom from opening while an update is installing.
//
// The installer replaces the app's files for 10-20 seconds after it closes. If
// Flightroom is opened during that time, the old version would start (or the
// half-replaced files would). So just before the installer starts, the app
// leaves a note in its data folder. When the app starts and finds the note
// while the installer is still running, it shows a short "updating" message
// instead of opening, and has Windows open the new version once it's done.
pub mod guard {
    use super::*;

    fn note_path(app: &AppHandle) -> PathBuf {
        data_dir(app).join("updating.json")
    }

    pub fn mark_installing(app: &AppHandle, version: &str) {
        let _ = fs::create_dir_all(data_dir(app));
        let _ = fs::write(note_path(app), serde_json::json!({ "version": version, "at": now() }).to_string());
    }

    #[cfg(windows)]
    fn installer_running() -> bool {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {INSTALLER_PREFIX}*"), "/NH", "/FO", "CSV"])
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains(&INSTALLER_PREFIX.to_lowercase()))
            .unwrap_or(false)
    }

    #[cfg(not(windows))]
    fn installer_running() -> bool {
        false
    }

    /// True when this launch should stop because an update is installing.
    pub fn update_in_progress(app: &AppHandle) -> bool {
        if !cfg!(windows) || cfg!(debug_assertions) {
            return false;
        }
        let Ok(text) = fs::read_to_string(note_path(app)) else { return false };
        let note: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        let at = note["at"].as_u64().unwrap_or(0);
        if note["version"].as_str() == Some(&app.package_info().version.to_string()) || now().saturating_sub(at) > 10 * 60 * 1000 {
            let _ = fs::remove_file(note_path(app)); // the update finished (this is the new version), or the note is stale
            return false;
        }
        // The installer starts a moment after the old app quits, so give it a few seconds to appear.
        for _ in 0..8 {
            if installer_running() {
                return true;
            }
            if now().saturating_sub(at) > 15000 {
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        false
    }

    /// Opens Flightroom again once the installer has finished (waits at most 5 minutes).
    #[cfg(windows)]
    pub fn reopen_when_installed() {
        use std::os::windows::process::CommandExt;
        let Ok(exe) = std::env::current_exe() else { return };
        let exe = exe.to_string_lossy().replace('\'', "''");
        let script = format!(
            "$t = 0; while ((Get-Process -Name '{INSTALLER_PREFIX}*' -ErrorAction SilentlyContinue) -and $t -lt 300) {{ Start-Sleep -Seconds 1; $t++ }}; Start-Sleep -Seconds 2; Start-Process -FilePath '{exe}'"
        );
        let _ = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(0x0800_0000 | 0x0000_0008) // CREATE_NO_WINDOW | DETACHED_PROCESS
            .spawn();
    }

    #[cfg(not(windows))]
    pub fn reopen_when_installed() {}
}
