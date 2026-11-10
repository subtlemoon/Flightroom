// The order photos show in: by name (as the folder lists them), by when they
// were shot, or by file size.

export const ORDERS = [
  ['name', 'Name'],
  ['oldest', 'Date and time, oldest first'],
  ['newest', 'Date and time, newest first'],
  ['largest', 'File size, largest first'],
  ['smallest', 'File size, smallest first'],
];

const KEY = 'flightroom-cull-order';
export const savedOrder = () => { try { const v = localStorage.getItem(KEY); return ORDERS.some(([k]) => k === v) ? v : 'name'; } catch { return 'name'; } };
export const saveOrder = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

// When a photo was taken, in whole seconds: the camera's own time once the
// photo's info has been read ("2026:10:17 14:03:22"), and until then when the
// file was written, which is the same moment for a file straight off a card.
// Whole seconds, so the shots of a burst keep their folder (name) order.
export function shotAt(p, m) {
  const t = m?.takenAt && /^(\d{4})\D(\d\d)\D(\d\d)\D(\d\d)\D(\d\d)\D(\d\d)/.exec(m.takenAt);
  if (t) return Math.floor(new Date(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]).getTime() / 1000);
  return Math.floor((p.modified || 0) / 1000);
}

/** The photos in `order` (see ORDERS); equal ones keep the folder's order, so a virtual copy stays by its photo. */
export function inOrder(photos, order, meta = {}) {
  if (order === 'name' || !ORDERS.some(([k]) => k === order)) return photos;
  const key = order === 'oldest' || order === 'newest' ? (p) => shotAt(p, meta[p.id]) : (p) => p.size || 0;
  const dir = order === 'oldest' || order === 'smallest' ? 1 : -1;
  return photos.map((p, i) => [key(p), i, p]).sort((a, b) => (a[0] - b[0]) * dir || a[1] - b[1]).map((x) => x[2]);
}

/** Every file that belongs to these photos (RAW, JPEG, sidecar, and the sidecars of their virtual copies in `all`). */
export function filesOf(photos, all) {
  const out = new Set();
  for (const p of photos) {
    if (p.copy) { out.add(p.sidecar); continue; }
    for (const f of [p.raw, p.jpeg, p.sidecar]) if (f) out.add(f);
    if (!p.raw && !p.jpeg) out.add(p.id);
    for (const c of all) if (c.copy && c.raw === p.raw && p.raw) out.add(c.sidecar);
  }
  return [...out];
}
