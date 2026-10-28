// The window's way to the desktop side (src-tauri): photo folders, ratings,
// RAW decoding, updates. Calls that fail resolve to { error } instead of
// throwing, so screens can show what went wrong. Absent in a plain browser.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';

const inApp = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

const safe = (p) => p.catch((err) => ({ error: String(err?.message || err) }));
const call = (cmd, args) => safe(invoke(cmd, args));

// Files are served by the desktop side under this address (gcimg:// on Windows
// is spelled http://gcimg.localhost by WebView2).
export const FILES = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent) ? 'http://gcimg.localhost/' : 'gcimg://localhost/';
export const fileUrl = (path, params) => `${FILES}${path}?${new URLSearchParams(params)}`;

const onEvent = (name, fn) => {
  let off = null, dead = false;
  listen(name, (e) => fn(e.payload)).then((u) => { if (dead) u(); else off = u; });
  return () => { dead = true; off?.(); };
};

export const bridge = inApp ? {
  getVersion: () => invoke('app_version'),
  getUpdateStatus: () => invoke('update_status'),
  checkForUpdates: () => call('update_check'),
  installUpdate: () => call('update_install'),
  onUpdateStatus: (fn) => onEvent('update:status', fn),
  openUrl: (url) => openUrl(url).catch((err) => console.error('Could not open link', err)),
  saveTextFile: async (defaultName, text) => {
    const path = await save({ defaultPath: defaultName, filters: [{ name: 'Backup', extensions: ['json'] }] });
    if (!path) return null;
    return call('save_text_file', { path, text });
  },
  // GearCheck's saved data (gear, groups, settings), for the first start.
  migrationData: () => invoke('migration_data'),
  // Culling: folders, previews, and star ratings written to the photos.
  cull: {
    pickFolder: () => open({ directory: true, title: 'Choose a folder of photos' }).catch(() => null),
    scan: (folder) => call('cull_scan', { folder }),
    meta: (ids) => call('cull_meta', { ids }),
    listDirs: (dir) => call('cull_list_dirs', { dir }),
    rate: (photo, rating) => call('cull_rate', { args: { id: photo.id, ratingIn: photo.ratingIn, sidecar: photo.sidecar, rating } }),
    saveThumb: (id, bytes) => call('cull_save_thumb', new Uint8Array(bytes), { headers: { 'x-id': encodeURIComponent(id) } }),
    cacheSize: () => call('cull_cache_size'),
    clearCache: () => call('cull_clear_cache'),
  },
  // Develop: full RAW decoding and develop settings in the .xmp sidecar.
  develop: {
    open: (photo) => call('develop_open', { id: photo.id, sidecar: photo.sidecar }),
    close: () => call('develop_close'),
    save: (sidecar, { set, remove, seqs }) => call('develop_save', { args: { sidecar, set, remove, seqs } }),
    imageUrl: (photo, edge, ahead) => fileUrl('develop/image', { p: photo.id, edge, ...(ahead ? { ahead: 1 } : {}) }),
    regionUrl: (photo, r) => fileUrl('develop/region', { p: photo.id, ...r }),
    pickFolder: (title) => open({ directory: true, title }).catch(() => null),
    exportBegin: (args) => call('export_begin', { args }),
    exportTile: (job, x, y, w, h, rgba) => call('export_tile', rgba, { headers: { 'x-job': job, 'x-x': String(x), 'x-y': String(y), 'x-w': String(w), 'x-h': String(h) } }),
    exportFinish: (job, cancel = false) => call('export_finish', { job, cancel }),
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
