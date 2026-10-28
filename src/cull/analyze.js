// Auto-cull: scores every photo in a folder from its small embedded preview and
// suggests star ratings. Everything runs on this PC; nothing is uploaded.
//
// What it looks at, per photo:
//   subject     what the photo is of (a person, car, animal...), found by a small
//               detection model (subject.js), so focus is judged where it matters
//   sharpness   how crisp the subject is; without a subject, the sharpest part of
//               the frame, so a soft background never counts against a photo
//   exposure    share of blown-out highlights and crushed shadows, overall brightness
//   look        a tiny fingerprint of the picture, to find bursts and near-duplicates
// and then, across the folder: groups of similar shots taken within seconds of
// each other, where only the best one keeps a good rating.
import { ROTATION } from './rotation.js';

export const VERSION = 3; // bump when measurements change, so old ones are redone
const MAX_W = 640; // the embedded preview's size: enough for focus, and fast

// The bitmap turned the right way up (the previews are stored as the sensor saw them).
export function upright(bmp, orientation) {
  const rot = ROTATION[orientation] || 0;
  if (!rot) return bmp;
  const w = rot % 180 ? bmp.height : bmp.width, h = rot % 180 ? bmp.width : bmp.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return canvas.transferToImageBitmap();
}

// Grayscale (0-255) pixels of a bitmap, at most MAX_W wide.
export function grayscale(bmp) {
  const w = Math.min(MAX_W, bmp.width);
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return { gray, w, h };
}

// Sharpness: variance of the Laplacian (edge strength) in a grid of tiles over
// `area` (fractions of the frame; the whole frame by default), averaged over the
// 3 sharpest tiles.
export function sharpness(gray, w, h, cols = 8, rows = 6, area = { x: 0, y: 0, w: 1, h: 1 }) {
  const x0 = Math.max(1, Math.floor(area.x * w)), x1 = Math.min(w - 1, Math.ceil((area.x + area.w) * w));
  const y0 = Math.max(1, Math.floor(area.y * h)), y1 = Math.min(h - 1, Math.ceil((area.y + area.h) * h));
  const n = cols * rows;
  const sum = new Float64Array(n), sq = new Float64Array(n), cnt = new Float64Array(n);
  for (let y = y0; y < y1; y++) {
    const ty = Math.min(rows - 1, Math.floor(((y - y0) * rows) / (y1 - y0)));
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      const t = ty * cols + Math.min(cols - 1, Math.floor(((x - x0) * cols) / (x1 - x0)));
      sum[t] += lap; sq[t] += lap * lap; cnt[t]++;
    }
  }
  const vars = [];
  for (let t = 0; t < n; t++) if (cnt[t]) vars.push(sq[t] / cnt[t] - (sum[t] / cnt[t]) ** 2);
  vars.sort((a, b) => b - a);
  const top = vars.slice(0, 3);
  return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
}

export function exposure(gray) {
  let hi = 0, lo = 0, total = 0;
  for (const v of gray) { if (v >= 250) hi++; else if (v <= 5) lo++; total += v; }
  return { clipHi: hi / gray.length, clipLo: lo / gray.length, mean: total / gray.length };
}

// 64-bit difference hash (9x8 grid), as a string of 0/1.
export function fingerprint(gray, w, h) {
  const cell = (cx, cy) => {
    const x0 = Math.floor((cx * w) / 9), x1 = Math.floor(((cx + 1) * w) / 9);
    const y0 = Math.floor((cy * h) / 8), y1 = Math.floor(((cy + 1) * h) / 8);
    let s = 0, c = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += gray[y * w + x]; c++; }
    return s / Math.max(1, c);
  };
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += cell(x, y) < cell(x + 1, y) ? '1' : '0';
  return bits;
}

export const distance = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };

// Measurements for one photo from its upright preview bitmap and the subject
// found in it (or null). `sharp` is the subject's sharpness when there is one.
export function measure(bmp, subject = null) {
  const { gray, w, h } = grayscale(bmp);
  const frameSharp = Math.round(sharpness(gray, w, h));
  // Up to 4x4 tiles on the subject, each at least 16 pixels across.
  const tiles = (frac, size) => Math.max(1, Math.min(4, Math.floor((frac * size) / 16)));
  const subjectSharp = subject ? Math.round(sharpness(gray, w, h, tiles(subject.box.w, w), tiles(subject.box.h, h), subject.box)) : null;
  return {
    v: VERSION, sharp: subjectSharp ?? frameSharp, frameSharp, subject, ...exposure(gray), hash: fingerprint(gray, w, h),
  };
}

// "2026:10:17 13:05:45" -> seconds
const seconds = (t) => {
  const m = t && t.match(/^(\d+):(\d+):(\d+) (\d+):(\d+):(\d+)/);
  return m ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) / 1000 : null;
};

const BURST_GAP = 2; // seconds between shots in one burst
const SIMILAR = 22; // max fingerprint difference (of 64) for "the same shot"

// Turns measurements into suggestions. `items` are in folder order:
// [{ id, name, m: measure(), takenAt }]. Returns { [id]: { stars, reasons, group } }.
// Stars: 4 = among the best, 3 = good, 2 = keeper, 1 = likely reject. 5 is left
// for you to give. Most sharp, well-exposed photos get 3 or 4.
export function suggest(items) {
  const done = items.filter((it) => it.m);
  if (!done.length) return {};
  const sharps = done.map((it) => it.m.sharp).sort((a, b) => a - b);
  const pct = (v) => { let i = 0; while (i < sharps.length && sharps[i] <= v) i++; return i / sharps.length; };
  const median = sharps[Math.floor(sharps.length / 2)];

  const out = {};
  for (const it of done) {
    const { m } = it;
    const reasons = [];
    let quality = pct(m.sharp);
    const soft = m.sharp < median * 0.3;
    if (soft && m.subject && m.frameSharp >= median * 0.7) reasons.push('Focus missed the subject');
    else if (soft) reasons.push(m.subject ? 'Subject is soft or blurry' : 'Soft or blurry');
    if (m.clipHi > 0.12) { quality -= 0.15; reasons.push(`Blown highlights (${Math.round(m.clipHi * 100)}%)`); }
    if (m.clipLo > 0.3) { quality -= 0.15; reasons.push('Very dark shadows'); }
    if (m.mean < 35) { quality -= 0.2; reasons.push('Very dark'); } else if (m.mean > 225) { quality -= 0.2; reasons.push('Very bright'); }
    out[it.id] = { quality, soft, reasons };
  }

  // Bursts: neighbours taken within a couple of seconds that look alike.
  let group = 0;
  let prev = null;
  const groups = {};
  for (const it of done) {
    const t = seconds(it.takenAt);
    const same = prev && distance(prev.m.hash, it.m.hash) <= SIMILAR
      && (t == null || prev.t == null || Math.abs(t - prev.t) <= BURST_GAP);
    if (!same) group++;
    out[it.id].group = group;
    (groups[group] ||= []).push(it.id);
    prev = { ...it, t };
  }
  for (const ids of Object.values(groups)) {
    if (ids.length < 2) continue;
    const best = ids.reduce((a, b) => (out[b].quality > out[a].quality ? b : a));
    const bestName = done.find((it) => it.id === best).name;
    for (const id of ids) {
      out[id].groupSize = ids.length;
      if (id === best) out[id].reasons.unshift(`Best of ${ids.length} similar shots`);
      else { out[id].duplicate = true; out[id].reasons.unshift(`Similar to ${bestName}, which scored better`); }
    }
  }

  // Stars: soft photos are rejects; the rest ranked against each other, where
  // only the bottom fifth drops to 2. A near-copy of a better shot in its burst
  // is still a keeper (2), one below that shot.
  const keepers = done.filter((it) => !out[it.id].soft && !out[it.id].duplicate)
    .sort((a, b) => out[b.id].quality - out[a.id].quality);
  keepers.forEach((it, i) => {
    const rank = i / Math.max(1, keepers.length);
    out[it.id].stars = rank < 0.35 ? 4 : rank < 0.8 ? 3 : 2;
  });
  for (const it of done) {
    const s = out[it.id];
    if (s.duplicate && !s.soft) {
      const best = groups[s.group].find((id) => !out[id].duplicate);
      s.stars = Math.max(2, (out[best].stars || 2) - 1);
    }
  }
  for (const it of done) {
    const s = out[it.id];
    if (s.stars == null) s.stars = 1;
    if (!s.reasons.length) s.reasons.push(s.stars >= 3 ? (it.m.subject ? 'Sharp subject, well exposed' : 'Sharp and well exposed') : 'Fine, nothing stands out');
    delete s.quality;
  }
  return out;
}

// Saved results per folder, so suggestions survive closing the app.
// { measured: { [id]: m }, applied: { [id]: stars } }. `applied` remembers the
// stars auto-rating wrote, so a later run can tell them apart from your own.
const KEY = 'gearcheck-autocull';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export function loadAnalysis(folder) {
  const saved = readAll()[folder] || {};
  // Measurements from an older version are dropped, so they're redone the new way.
  const measured = Object.fromEntries(Object.entries(saved.measured || {}).filter(([, m]) => m.v === VERSION));
  return { measured, applied: saved.applied || {} };
}
export function saveAnalysis(folder, data) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [folder]: data })); } catch {}
}
