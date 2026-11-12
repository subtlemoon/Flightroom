// The window's way to the desktop side (src-tauri): photo folders, ratings,
// RAW decoding, updates. Calls that fail resolve to { error } instead of
// throwing, so screens can show what went wrong. Absent in a plain browser.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { withAdobe } from './develop/adobe.js';

const inApp = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

const safe = (p) => p.catch((err) => ({ error: String(err?.message || err) }));
const call = (cmd, args, opts) => safe(invoke(cmd, args, opts));

// Files are served by the desktop side under this address (gcimg:// on Windows
// is spelled http://gcimg.localhost by WebView2).
export const FILES = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent) ? 'http://gcimg.localhost/' : 'gcimg://localhost/';
export const fileUrl = (path, params) => `${FILES}${path}?${new URLSearchParams(params)}`;

const onEvent = (name, fn) => {
  let off = null, dead = false;
  listen(name, (e) => fn(e.payload)).then((u) => { if (dead) u(); else off = u; });
  return () => { dead = true; off?.(); };
};

const onWin = (p) => {
  let off = null, dead = false;
  p.then((u) => { if (dead) u(); else off = u; });
  return () => { dead = true; off?.(); };
};

export const bridge = inApp ? {
  // The window itself, for Flightroom's own title bar (titlebar.jsx).
  win: {
    // Windows notification + taskbar flash, only if Flightroom isn't the window in front.
    notifyDone: (title, body) => call('notify_done', { title, body }),
    minimize: () => safe(getCurrentWindow().minimize()),
    toggleMaximize: () => safe(getCurrentWindow().toggleMaximize()),
    close: () => safe(getCurrentWindow().close()),
    isMaximized: () => getCurrentWindow().isMaximized(),
    onResized: (fn) => onWin(getCurrentWindow().onResized(fn)),
  },
  getVersion: () => invoke('app_version'),
  getUpdateStatus: () => invoke('update_status'),
  checkForUpdates: () => call('update_check'),
  installUpdate: () => call('update_install'),
  // A new major version waits until asked for: downloads it, then it installs like any update.
  downloadUpdate: () => call('update_download'),
  displayProfile: () => call('display_profile'),
  onUpdateStatus: (fn) => onEvent('update:status', fn),
  openUrl: (url) => openUrl(url).catch((err) => console.error('Could not open link', err)),
  // Opens the file's folder in Explorer with the file selected.
  reveal: (path) => revealItemInDir(path).catch((err) => console.error('Could not show the file', err)),
  saveTextFile: async (defaultName, text, options = {}) => {
    const path = await save({
      ...(options.title ? { title: options.title } : {}),
      defaultPath: defaultName,
      filters: [{ name: options.filterName || 'Backup', extensions: ['json'] }],
    });
    if (!path) return null;
    return call('save_text_file', { path, text });
  },
  // GearCheck's saved data (gear, groups, settings), for the first start.
  migrationData: () => invoke('migration_data'),
  // Culling: folders, previews, and star ratings written to the photos.
  cull: {
    pickFolder: () => open({ directory: true, title: 'Choose a folder of photos' }).catch(() => null),
    scan: (folder, subfolders = false) => call('cull_scan', { folder, subfolders }),
    meta: (ids) => call('cull_meta', { ids }),
    listDirs: (dir) => call('cull_list_dirs', { dir }),
    rate: (photo, rating) => call('cull_rate', { args: { id: photo.id, ratingIn: photo.ratingIn, sidecar: photo.sidecar, rating } }),
    saveThumb: (id, bytes) => call('cull_save_thumb', new Uint8Array(bytes), { headers: { 'x-id': encodeURIComponent(id) } }),
    // Virtual copies (src-tauri photos.rs): a new copy of a photo, answered as a photo; removing one deletes only its own sidecar.
    virtualCopy: (photo) => call('cull_virtual_copy', { args: { id: photo.id, sidecar: photo.sidecar } }),
    removeCopy: (photo) => call('cull_remove_copy', { sidecar: photo.sidecar }),
    // Photos' files (RAW, JPEG, sidecars) to the Recycle Bin; answers how many went.
    trash: (files) => call('cull_trash', { files }),
    // Thumbnails of photos as developed, kept on disk for each photo's sidecar as it is.
    developedUrl: (photo) => fileUrl('photo/developed', { p: photo.id, s: photo.sidecar }),
    saveDeveloped: (photo, bytes) => call('cull_save_developed', new Uint8Array(bytes), { headers: { 'x-id': encodeURIComponent(photo.id), 'x-sidecar': encodeURIComponent(photo.sidecar) } }),
    developedMissing: (list) => call('cull_developed_missing', { items: list.map((p) => [p.id, p.sidecar]) }),
    cacheSize: () => call('cull_cache_size'),
    clearCache: () => call('cull_clear_cache'),
  },
  // Develop: full RAW decoding and develop settings in the .xmp sidecar.
  develop: {
    open: (photo) => call('develop_open', { id: photo.id, sidecar: photo.sidecar }).then(withAdobe),
    read: (photo) => call('develop_read', { sidecar: photo.sidecar }),
    close: () => call('develop_close'),
    // A photo not on screen, for its filmstrip thumbnail: { info, frame } (its RAW data isn't kept).
    peek: async (photo, edge) => {
      const r = await call('develop_peek', { id: photo.id, sidecar: photo.sidecar, edge });
      if (r?.error) return r;
      const buf = r instanceof ArrayBuffer ? r : new Uint8Array(r).buffer;
      const n = new DataView(buf).getUint32(0, true);
      return { info: withAdobe(JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)))), frame: buf.slice(4 + n) };
    },
    save: (sidecar, { set, remove, seqs, xml = {}, own = {} }) => call('develop_save', { args: { sidecar, set, remove, seqs, xml, own } }),
    // dn: how much AI Denoise to blend in (0-100), once worked out with denoise().
    imageUrl: (photo, edge, ahead, dn = 0) => fileUrl('develop/image', { p: photo.id, edge, ...(ahead ? { ahead: 1 } : {}), ...(dn ? { dn } : {}) }),
    regionUrl: (photo, r, dn = 0) => fileUrl('develop/region', { p: photo.id, ...r, ...(dn ? { dn } : {}) }),
    denoise: (photo) => call('develop_denoise', { id: photo.id }),
    cancelDenoise: () => call('develop_denoise_cancel'),
    onDenoise: (fn) => onEvent('ai:denoise', fn),
    pickFolder: (title) => open({ directory: true, title }).catch(() => null),
    exportBegin: (args) => call('export_begin', { args }),
    exportTile: (job, x, y, w, h, rgba) => call('export_tile', rgba, { headers: { 'x-job': job, 'x-x': String(x), 'x-y': String(y), 'x-w': String(w), 'x-h': String(h) } }),
    exportFinish: (job, cancel = false) => call('export_finish', { job, cancel }),
  },
  // On-device AI: models download on first use; photos never leave the computer.
  ai: {
    status: () => invoke('ai_status'),
    prefer: (device) => call('ai_prefer', { device }),
    // The computer's graphics adapters, and whether there's only graphics built into the processor.
    gpu: () => call('gpu_info'),
    install: (feature) => call('ai_install', { feature }),
    // Where the AI grade's vision model files are served on this computer (a local address, fast for big files).
    visionUrl: () => call('vision_url'),
    onProgress: (fn) => onEvent('ai:progress', fn),
    // rgba: bottom-up RGBA of the upright, uncropped photo. Answers [{ name, data }] of w x h bytes.
    masks: async (task, w, h, rgba) => {
      const r = await call('ai_masks', rgba, { headers: { 'x-task': task, 'x-w': String(w), 'x-h': String(h) } });
      if (r?.error) return r;
      const buf = r instanceof ArrayBuffer ? r : new Uint8Array(r).buffer;
      const dv = new DataView(buf);
      const [mw, mh, n] = [dv.getUint32(0, true), dv.getUint32(4, true), dv.getUint32(8, true)];
      const out = [];
      let o = 12;
      for (let i = 0; i < n; i++) {
        const len = dv.getUint8(o);
        const name = new TextDecoder().decode(new Uint8Array(buf, o + 1, len));
        o += 1 + len;
        out.push({ name, w: mw, h: mh, data: new Uint8Array(buf.slice(o, o + mw * mh)) });
        o += mw * mh;
      }
      return out;
    },
  },
} : null;

// Links open in the normal browser, never inside the app.
if (bridge) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && /^https?:/.test(a.href)) {
      e.preventDefault();
      bridge.openUrl(a.href);
    }
  });
}

const MIGRATED = 'flightroom-migrated';

// Flightroom was GearCheck. The first time it starts, it takes over GearCheck's
// saved data so your gear, groups, settings and culling folders are all there.
export async function adoptGearCheckData() {
  if (!bridge) return;
  try {
    if (localStorage.getItem(MIGRATED)) return;
    const data = await bridge.migrationData();
    for (const [k, v] of Object.entries(data || {})) localStorage.setItem(k, v);
    localStorage.setItem(MIGRATED, JSON.stringify({ at: Date.now(), keys: Object.keys(data || {}) }));
  } catch (err) {
    console.warn('[migrate] could not read GearCheck data', err);
  }
}
