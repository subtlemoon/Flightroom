// Auto-cull: scores every photo in a folder from its small embedded preview and
// suggests star ratings. Everything runs on this PC; nothing is uploaded.
//
// What it looks at, per photo:
//   sharpness   how crisp the sharpest part of the frame is (the subject, usually),
//               so a soft background behind a sharp subject doesn't count against it
//   exposure    share of blown-out highlights and crushed shadows, overall brightness
//   look        a tiny fingerprint of the picture, to find bursts and near-duplicates
// and then, across the folder: groups of similar shots taken within seconds of
// each other, where only the best one keeps a good rating.

const W = 320; // analysis width: plenty for blur and exposure, and fast

// Grayscale (0-255) pixels of a bitmap, scaled to W wide.
export function grayscale(bmp) {
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * W));
  const canvas = new OffscreenCanvas(W, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, W, h);
  const rgba = ctx.getImageData(0, 0, W, h).data;
  const gray = new Uint8ClampedArray(W * h);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return { gray, w: W, h };
}

// Sharpness: variance of the Laplacian (edge strength) in an 8x6 grid of tiles,
// averaged over the 3 sharpest tiles.
export function sharpness(gray, w, h, cols = 8, rows = 6) {
  const n = cols * rows;
  const sum = new Float64Array(n), sq = new Float64Array(n), cnt = new Float64Array(n);
  for (let y = 1; y < h - 1; y++) {
    const ty = Math.min(rows - 1, Math.floor((y * rows) / h));
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      const t = ty * cols + Math.min(cols - 1, Math.floor((x * cols) / w));
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

// Measurements for one photo from its preview bitmap.
export function measure(bmp) {
  const { gray, w, h } = grayscale(bmp);
  return { sharp: Math.round(sharpness(gray, w, h)), ...exposure(gray), hash: fingerprint(gray, w, h) };
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
// for you to give.
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
    const soft = m.sharp < median * 0.35;
    if (soft) reasons.push('Soft or blurry');
    if (m.clipHi > 0.08) { quality -= 0.25; reasons.push(`Blown highlights (${Math.round(m.clipHi * 100)}%)`); }
    if (m.clipLo > 0.25) { quality -= 0.2; reasons.push('Very dark shadows'); }
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

  // Stars: rejects first, then the keepers ranked against each other.
  const keepers = done.filter((it) => !out[it.id].soft && !out[it.id].duplicate)
    .sort((a, b) => out[b.id].quality - out[a.id].quality);
  keepers.forEach((it, i) => {
    const rank = i / Math.max(1, keepers.length);
    out[it.id].stars = rank < 0.2 ? 4 : rank < 0.6 ? 3 : 2;
  });
  for (const it of done) {
    const s = out[it.id];
    if (s.stars == null) s.stars = 1;
    if (!s.reasons.length) s.reasons.push(s.stars >= 3 ? 'Sharp and well exposed' : 'Fine, nothing stands out');
    delete s.quality;
  }
  return out;
}

// Saved results per folder, so suggestions survive closing the app.
// { measured: { [id]: m }, applied: { [id]: stars } }. `applied` remembers the
// stars auto-rating wrote, so a later run can tell them apart from your own.
const KEY = 'gearcheck-autocull';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const loadAnalysis = (folder) => readAll()[folder] || { measured: {}, applied: {} };
export function saveAnalysis(folder, data) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [folder]: data })); } catch {}
}
