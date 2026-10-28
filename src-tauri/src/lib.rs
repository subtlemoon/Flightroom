// Flightroom's native side: photo folders, RAW decoding for the Develop tab,
// sidecar files, app updates, and moving data over from GearCheck. The window
// (React, in src/) talks to it through commands and the gcimg:// protocol.

pub mod ai;
pub mod develop;
pub mod migrate;
pub mod photolib;
pub mod photos;
pub mod updater;
pub mod xmp;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

// gcimg://localhost/photo/{preview,thumb}?p=<file>   embedded JPEG previews
// gcimg://localhost/develop/...                      decoded RAW data (see develop.rs)
fn handle(app: &tauri::AppHandle, req: &tauri::http::Request<Vec<u8>>) -> photos::HttpResponse {
    let q = photos::query(req.uri());
    let path = req.uri().path().trim_start_matches('/');
    match path.split_once('/') {
        Some(("photo", kind)) => photos::handle_photo(app, kind, &q),
        Some(("develop", kind)) => develop::handle(app, kind, &q),
        _ => photos::not_found(),
    }
}

fn main_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Flightroom")
        .inner_size(1400.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .background_color(tauri::window::Color(11, 13, 18, 255))
        .disable_drag_drop_handler()
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
        .background_color(tauri::window::Color(11, 13, 18, 255))
        .build()?;
    Ok(())
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
            photos::cull_scan,
            photos::cull_meta,
            photos::cull_rate,
            photos::cull_list_dirs,
            photos::cull_save_thumb,
            photos::cull_cache_size,
            photos::cull_clear_cache,
            updater::app_version,
            updater::update_status,
            updater::update_check,
            updater::update_install,
            migrate::migration_data,
            develop::develop_open,
            develop::develop_close,
            develop::develop_save,
            develop::export_begin,
            develop::export_tile,
            develop::export_finish,
            develop::save_text_file,
            develop::develop_denoise,
            develop::develop_denoise_cancel,
            ai::ai_status,
            ai::ai_install,
            ai::ai_masks,
        ])
        .build(tauri::generate_context!())
        .expect("Flightroom failed to start");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            updater::install_on_exit(app);
        }
    });
}
