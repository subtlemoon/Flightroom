// Flightroom's native side: photo folders, RAW decoding for the Develop tab,
// sidecar files, app updates, and moving data over from GearCheck. The window
// (React, in src/) talks to it through commands and the gcimg:// protocol.

pub mod adobe;
pub mod ai;
pub mod develop;
pub mod display;
pub mod lens;
pub mod migrate;
pub mod photolib;
pub mod photos;
pub mod updater;
pub mod xmp;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

// gcimg://localhost/photo/{preview,thumb}?p=<file>   embedded JPEG previews
// gcimg://localhost/develop/...                      decoded RAW data (see develop.rs)
// gcimg://localhost/ai/...                           the AI grade's vision model files (ai.rs serve)
fn handle(app: &tauri::AppHandle, req: &tauri::http::Request<Vec<u8>>) -> photos::HttpResponse {
    let q = photos::query(req.uri());
    let path = req.uri().path().trim_start_matches('/');
    match path.split_once('/') {
        Some(("photo", kind)) => photos::handle_photo(app, kind, &q),
        Some(("develop", kind)) => develop::handle(app, kind, &q),
        Some(("ai", rest)) => ai::serve(app, rest),
        _ => photos::not_found(),
    }
}

/// WebView2 switches for every window (all windows share one browser, so the
/// same list each time). wry's defaults first, which setting any replaces;
/// then the fast graphics card on laptops with two: WebView2 otherwise draws
/// on the built-in Intel/AMD one even when a GeForce or Radeon is there.
/// (Chromium's covered-window check stays on: turning it off in 2.18.4 kept a
/// hidden Flightroom drawing at full speed behind other windows. The Iris Xe
/// black screen was the overlay plane, handled by browser_args.)
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --force_high_performance_gpu --disable-domain-blocking-for-3d-apis";

/// BROWSER_ARGS, plus --disable-direct-composition on Intel Iris Xe / UHD:
/// a friend's whole screen went black while dragging sliders and stayed black
/// until Alt+Tab, with no graphics reset. That is Windows putting the app's
/// DirectComposition layer on a hardware overlay plane, which these drivers
/// get wrong; a plain swap chain keeps the desktop compositor in charge.
/// Read once, so every window gets the same list.
fn browser_args() -> &'static str {
    static ARGS: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    ARGS.get_or_init(|| {
        if ai::gpu::weak_intel() { format!("{BROWSER_ARGS} --disable-direct-composition") } else { BROWSER_ARGS.to_string() }
    })
}

fn main_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    #[cfg_attr(not(windows), allow(unused_variables))]
    let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Flightroom")
        .inner_size(1400.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .background_color(tauri::window::Color(38, 38, 38, 255))
        // No Windows frame: Flightroom draws its own title bar and buttons
        // (src/components/titlebar.jsx). The shadow keeps Windows 11's rounded
        // corners and border; Tauri still lets the edges resize the window.
        .decorations(false)
        .shadow(true)
        .disable_drag_drop_handler()
        .additional_browser_args(browser_args())
        .build()?;
    #[cfg(windows)]
    {
        // Minimized, the window gives back most of its memory.
        let w = win.clone();
        let low = std::sync::atomic::AtomicBool::new(false);
        win.on_window_event(move |e| {
            if let tauri::WindowEvent::Resized(_) = e {
                let min = w.is_minimized().unwrap_or(false);
                if low.swap(min, std::sync::atomic::Ordering::Relaxed) != min {
                    memory_target(&w, min);
                }
            }
        });
    }
    Ok(())
}

#[cfg(windows)]
fn memory_target(win: &tauri::WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;
    let _ = win.with_webview(move |wv| unsafe {
        let Ok(core) = wv.controller().CoreWebView2() else { return };
        if let Ok(core) = core.cast::<ICoreWebView2_19>() {
            let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
            let _ = core.SetMemoryUsageTargetLevel(level);
        }
    });
}

fn updating_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "updating", WebviewUrl::App("updating.html".into()))
        .title("Flightroom is updating")
        .inner_size(380.0, 92.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .background_color(tauri::window::Color(38, 38, 38, 255))
        .additional_browser_args(browser_args())
        .build()?;
    Ok(())
}

/// An AI job finished: a Windows notification and a taskbar flash, but only
/// when Flightroom isn't the window in front (Settings can turn it off).
#[tauri::command]
fn notify_done(app: tauri::AppHandle, title: String, body: String) {
    let Some(w) = app.get_webview_window("main") else { return };
    if w.is_focused().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
        return;
    }
    use tauri_plugin_notification::NotificationExt;
    let mut n = app.notification().builder().title(title);
    if !body.is_empty() {
        n = n.body(body);
    }
    let _ = n.show();
    let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
}

pub fn run() {
    let app = tauri::Builder::default()
        // One Flightroom at a time: opening it again brings the open window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // The window comes back as it was left: size, place, maximized or full screen
        // (not DECORATIONS: older versions saved the Windows frame as on, which would bring it back).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() - tauri_plugin_window_state::StateFlags::VISIBLE - tauri_plugin_window_state::StateFlags::DECORATIONS)
                .with_denylist(&["updating"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("gcimg", |ctx, req, responder| {
            let app = ctx.app_handle().clone();
            tauri::async_runtime::spawn_blocking(move || responder.respond(handle(&app, &req)));
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let thumbs = app.path().app_local_data_dir()?.join("thumbs");
            app.manage(photos::Photos::new(thumbs));
            app.manage(updater::Updater::default());
            app.manage(develop::Develop::default());
            app.manage(ai::Ai::new(ai::models_dir(&handle)));
            if updater::guard::update_in_progress(&handle) {
                updater::guard::reopen_when_installed();
                updating_window(&handle)?;
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(2500));
                    handle.exit(0);
                });
                return Ok(());
            }
            main_window(&handle)?;
            updater::start(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notify_done,
            photos::cull_scan,
            photos::cull_meta,
            photos::cull_trash,
            photos::cull_rate,
            photos::cull_list_dirs,
            photos::cull_save_thumb,
            photos::cull_cache_size,
            photos::cull_clear_cache,
            photos::cull_save_developed,
            photos::cull_developed_missing,
            photos::cull_virtual_copy,
            photos::cull_remove_copy,
            updater::app_version,
            updater::update_status,
            updater::update_check,
            updater::update_install,
            updater::update_download,
            migrate::migration_data,
            develop::develop_open,
            develop::develop_read,
            develop::develop_close,
            develop::develop_peek,
            develop::develop_save,
            develop::export_begin,
            develop::export_tile,
            develop::export_finish,
            develop::save_text_file,
            develop::develop_denoise,
            develop::develop_denoise_cancel,
            ai::ai_status,
            ai::ai_install,
            ai::ai_prefer,
            ai::gpu_info,
            ai::ai_masks,
            display::display_profile,
        ])
        .build(tauri::generate_context!())
        .expect("Flightroom failed to start");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            updater::install_on_exit(app);
        }
    });
}
