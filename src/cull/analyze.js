// Auto-cull: scores every photo in a folder from its small embedded preview and
// suggests star ratings. Everything runs on this PC; nothing is uploaded.
//
// What it looks at, per photo:
//   subject     what the photo is of (a person, car, animal...), found by a small
//               detection model (subject.js), so focus is judged where it matters
//   sharpness   how crisp the subject is; without a subject, the sharpest part of
//               the frame, so a soft background never counts against a photo.
//               Also as a share of its own contrast ("crispness"), which reads
//               the same in a dark or hazy photo and shows heavy misfocus
//   blur        how blurred the subject is at full size (on the big embedded
//               preview), where missed focus and motion blur show; small
//               previews make everything look sharp. A person's at the head.
//   exposure    share of blown-out highlights and crushed shadows, overall brightness
//   look        a tiny fingerprint of the picture, to find bursts and near-duplicates
//   colours     what colours the subject is, so two karts (or people) shot one
//               after the other at the same spot aren't taken for one burst
// and then, across the folder: groups of similar shots taken within seconds of
// each other, where only the best one keeps a good rating.
import { ROTATION } from './rotation.js';

export const VERSION = 5; // bump when measurements change, so old ones are redone
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

const MAX_CROP = 1600; // at most this many px of the full-size preview are looked at, each way

// A box in the upright photo, as fractions of the preview as stored (sensor orientation).
export function stored(b, rot) {
  if (rot === 90) return { x: b.y, y: 1 - b.x - b.w, w: b.h, h: b.w };
  if (rot === 180) return { x: 1 - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h };
  if (rot === 270) return { x: 1 - b.y - b.h, y: b.x, w: b.h, h: b.w };
  return b;
}

// The part of a W x H upright photo (px) whose focus is judged: the box, at most
// MAX_CROP across. Around its middle, but a person's from the top of the box:
// focus belongs on the face, and the middle of someone filling the frame is their chest.
export function focusArea(box, W, H, person) {
  let [x, y, w, h] = [box.x * W, box.y * H, box.w * W, box.h * H];
  if (w > MAX_CROP) { x += (w - MAX_CROP) / 2; w = MAX_CROP; }
  if (h > MAX_CROP) { if (!person) y += (h - MAX_CROP) / 2; h = MAX_CROP; }
  return { x: x / W, y: y / H, w: w / W, h: h / H };
}

// Grayscale (0-255) of RGBA pixels.
export function toGray(rgba) {
  const gray = new Uint8ClampedArray(rgba.length >> 2);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return gray;
}

// RGBA pixels of a bitmap, at most MAX_W wide.
function pixels(bmp) {
  const w = Math.min(MAX_W, bmp.width);
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

// Detail in a grid of tiles over `area` (fractions of the frame; the whole frame
// by default). Sharpness: the variance of the Laplacian (edge strength), averaged
// over the 3 sharpest tiles. Crispness: that as a share of each tile's own
// variance (its contrast), averaged over the 3 crispest tiles that have some
// contrast; null when none has. Crispness is the same for a dark or hazy copy of
// a photo, and the small preview keeps it free of noise, so it falls with
// misfocus alone.
export function detail(gray, w, h, cols = 8, rows = 6, area = { x: 0, y: 0, w: 1, h: 1 }) {
  const x0 = Math.max(1, Math.floor(area.x * w)), x1 = Math.min(w - 1, Math.ceil((area.x + area.w) * w));
  const y0 = Math.max(1, Math.floor(area.y * h)), y1 = Math.min(h - 1, Math.ceil((area.y + area.h) * h));
  const n = cols * rows;
  const sum = new Float64Array(n), sq = new Float64Array(n), cnt = new Float64Array(n), gs = new Float64Array(n), gq = new Float64Array(n);
  for (let y = y0; y < y1; y++) {
    const ty = Math.min(rows - 1, Math.floor(((y - y0) * rows) / (y1 - y0)));
    for (let x = x0; x < x1; x++) {
      const i = y * w + x, g = gray[i];
      const lap = 4 * g - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      const t = ty * cols + Math.min(cols - 1, Math.floor(((x - x0) * cols) / (x1 - x0)));
      sum[t] += lap; sq[t] += lap * lap; cnt[t]++; gs[t] += g; gq[t] += g * g;
    }
  }
  const sharp = [], crisp = [];
  for (let t = 0; t < n; t++) {
    if (!cnt[t]) continue;
    const lv = sq[t] / cnt[t] - (sum[t] / cnt[t]) ** 2, gv = gq[t] / cnt[t] - (gs[t] / cnt[t]) ** 2;
    sharp.push(lv);
    if (gv > 16) crisp.push(lv / gv);
  }
  const top3 = (v) => { const top = v.sort((a, b) => b - a).slice(0, 3); return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length); };
  return { sharp: top3(sharp), crisp: crisp.length ? top3(crisp) : null };
}

export const sharpness = (gray, w, h, cols, rows, area) => detail(gray, w, h, cols, rows, area).sharp;

// Blur at pixel level (Crété-Roffet et al., "The blur effect", 2007): how
// much of the image's fine detail survives blurring it again. About 0.6 for
// a sharp 45 MP photo, 0.7 slightly soft, 0.8 and up blurry. Taken over the
// tiles with the most detail, so plain sky or tarmac in the box don't count.
// Along each line, the 9-pixel mean changes from one pixel to the next by
// (the pixel coming in - the one going out) / 9, edges repeated.
export function blurOf(gray, w, h, n = 4) {
  const scores = [];
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const x0 = Math.floor((tx * w) / n), x1 = Math.floor(((tx + 1) * w) / n);
      const y0 = Math.floor((ty * h) / n), y1 = Math.floor(((ty + 1) * h) / n);
      const tw = x1 - x0, th = y1 - y0;
      if (tw < 12 || th < 12) continue;
      // Along rows.
      let sF = 0, sV = 0;
      for (let y = y0; y < y1; y++) {
        const row = y * w + x0;
        for (let i = 1; i < tw; i++) {
          const dF = Math.abs(gray[row + i] - gray[row + i - 1]);
          const dB = Math.abs(gray[row + Math.min(tw - 1, i + 4)] - gray[row + Math.max(0, i - 5)]) / 9;
          sF += dF; if (dF > dB) sV += dF - dB;
        }
      }
      let worst = sF ? (sF - sV) / sF : 1, detail = sF / (th * tw);
      // Along columns, a row at a time.
      sF = 0; sV = 0;
      for (let j = 1; j < th; j++) {
        const at = (y0 + j) * w, up = at - w;
        const enter = (y0 + Math.min(th - 1, j + 4)) * w, leave = (y0 + Math.max(0, j - 5)) * w;
        for (let x = x0; x < x1; x++) {
          const dF = Math.abs(gray[at + x] - gray[up + x]);
          const dB = Math.abs(gray[enter + x] - gray[leave + x]) / 9;
          sF += dF; if (dF > dB) sV += dF - dB;
        }
      }
      worst = Math.max(worst, sF ? (sF - sV) / sF : 1);
      detail += sF / (tw * th);
      scores.push([detail, worst]);
    }
  }
  if (!scores.length) return null;
  const top = scores.sort((a, b) => b[0] - a[0]).slice(0, Math.max(3, Math.ceil(scores.length * 0.4))).map((t) => t[1]).sort((a, b) => a - b).slice(0, 3);
  return top.reduce((a, b) => a + b, 0) / top.length;
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

// The colours in the middle of `box` (fractions of the frame; less of the
// background there): 12 hue bins and one for greys, white and black, as shares
// that add up to 1. Pale or dark pixels count partly or wholly as grey, and a
// hue is shared between the two nearest bins, so a slight shift moves it smoothly.
const HUES = 12;
export function palette(rgba, w, h, box) {
  const x0 = Math.floor((box.x + box.w * 0.2) * w), x1 = Math.ceil((box.x + box.w * 0.8) * w);
  const y0 = Math.floor((box.y + box.h * 0.2) * h), y1 = Math.ceil((box.y + box.h * 0.8) * h);
  const bins = new Float64Array(HUES + 1);
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = (y * w + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const max = Math.max(r, g, b), c = max - Math.min(r, g, b);
      const colour = max < 40 ? 0 : Math.min(1, c / 80);
      n++;
      bins[HUES] += 1 - colour;
      if (!colour) continue;
      const hue = max === r ? (g - b) / c + 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4; // 0-6 around the circle, from red
      const at = (hue % 6) * (HUES / 6), k = Math.floor(at), f = at - k;
      bins[k % HUES] += colour * (1 - f);
      bins[(k + 1) % HUES] += colour * f;
    }
  }
  return Array.from(bins, (v) => Math.round((v / Math.max(1, n)) * 100) / 100);
}

// How different two subjects' colours are, from 0 (the same) to 1 (none in
// common). Only the colours count, not how much grey is around them; two
// subjects with hardly any colour can't be told apart this way (0).
export function paletteDistance(a, b) {
  const ca = a.slice(0, HUES).reduce((s, v) => s + v, 0), cb = b.slice(0, HUES).reduce((s, v) => s + v, 0);
  if (Math.max(ca, cb) < 0.15) return 0;
  if (Math.min(ca, cb) < 0.05) return 1; // one colourful, the other not
  let common = 0;
  for (let i = 0; i < HUES; i++) common += Math.min(a[i] / ca, b[i] / cb);
  return Math.max(0, 1 - common);
}

// The middle of the frame stands in for the subject when none is found.
export const MIDDLE = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };

// Measurements for one photo from its upright preview bitmap and the subject
// found in it (or null). `sharp` is the subject's sharpness when there is one.
export function measure(bmp, subject = null, blur = null) {
  const { rgba, w, h } = pixels(bmp);
  const gray = toGray(rgba);
  const frame = detail(gray, w, h);
  // Up to 4x4 tiles on the subject, each at least 16 pixels across.
  const tiles = (frac, size) => Math.max(1, Math.min(4, Math.floor((frac * size) / 16)));
  const main = subject ? detail(gray, w, h, tiles(subject.box.w, w), tiles(subject.box.h, h), subject.box) : frame;
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    v: VERSION, sharp: Math.round(main.sharp), frameSharp: Math.round(frame.sharp), crisp: r2(main.crisp), frameCrisp: r2(frame.crisp),
    subject, blur, ...exposure(gray), hash: fingerprint(gray, w, h),
    colours: palette(rgba, w, h, subject?.box || MIDDLE),
  };
}

// "2026:10:17 13:05:45" -> seconds
const seconds = (t) => {
  const m = t && t.match(/^(\d+):(\d+):(\d+) (\d+):(\d+):(\d+)/);
  return m ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) / 1000 : null;
};

// Full-size blur (blurOf) for 4 stars, 3 stars, and past which a photo is soft.
const BLUR_SHARP = 0.63, BLUR_OK = 0.68, BLUR_SOFT = 0.72;
const BURST_GAP = 2; // seconds between shots in one burst
const SIMILAR = 22; // max fingerprint difference (of 64) for "the same shot"
const OTHER_SUBJECT = 0.5; // palette distance past which a subject is another kart or person

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
  const crisps = done.map((it) => it.m.crisp).filter((v) => v != null).sort((a, b) => a - b);
  const crispMedian = crisps[Math.floor(crisps.length / 2)];
  // Far less crisp than the folder's typical photo, even in the small preview.
  // (Without crispness, measured before: by sharpness, which a dark photo also lacks.)
  const blurred = (crisp, sharp) => (crisp != null && crispMedian ? crisp < crispMedian * 0.3 : sharp < median * 0.3);
  const crispEnough = (crisp, sharp) => (crisp != null && crispMedian ? crisp >= crispMedian * 0.7 : sharp >= median * 0.7);

  const out = {};
  for (const it of done) {
    const { m } = it;
    const reasons = [];
    let quality = pct(m.sharp);
    // Blurred that much, the full-size measure can't be trusted: noise in a very
    // blurred picture reads to it as fine detail.
    const gross = blurred(m.crisp, m.sharp);
    let soft = gross;
    let cap = 4; // the most stars its sharpness allows
    if (m.blur != null && !gross) {
      // Full-size blur decides: sharp photos rank on it, soft ones are capped or rejected.
      quality = 0.65 * Math.min(1, Math.max(0, (BLUR_SOFT + 0.04 - m.blur) / 0.2)) + 0.35 * quality;
      soft = m.blur > BLUR_SOFT;
      cap = m.blur <= BLUR_SHARP ? 4 : m.blur <= BLUR_OK ? 3 : 2;
    }
    if (gross && m.subject && crispEnough(m.frameCrisp, m.frameSharp)) reasons.push('Focus missed the subject');
    else if (soft) reasons.push(m.subject ? 'Subject is soft or blurry' : 'Soft or blurry');
    else if (cap < 4) reasons.push(`${m.subject ? 'Subject is' : 'Photo is'} ${cap === 3 ? 'a little soft' : 'soft'} at full size`);
    if (m.clipHi > 0.12) { quality -= 0.15; reasons.push(`Blown highlights (${Math.round(m.clipHi * 100)}%)`); }
    if (m.clipLo > 0.3) { quality -= 0.15; reasons.push('Very dark shadows'); }
    if (m.mean < 35) { quality -= 0.2; reasons.push('Very dark'); } else if (m.mean > 225) { quality -= 0.2; reasons.push('Very bright'); }
    out[it.id] = { quality, soft, cap, reasons };
  }

  // Bursts: neighbours taken within a couple of seconds that look alike, of the
  // same subject (karts in a race pass the same spot a second apart, framed alike).
  let group = 0;
  let prev = null;
  const groups = {};
  const kind = (s) => (s && (s.label === 'person' ? 'person' : 'other'));
  const otherSubject = (a, b) => !!a.colours && !!b.colours && !!a.subject && kind(a.subject) === kind(b.subject)
    && paletteDistance(a.colours, b.colours) > OTHER_SUBJECT;
  for (const it of done) {
    const t = seconds(it.takenAt);
    const same = prev && distance(prev.m.hash, it.m.hash) <= SIMILAR && !otherSubject(prev.m, it.m)
      && (t == null || prev.t == null || Math.abs(t - prev.t) <= BURST_GAP);
    if (!same) group++;
    out[it.id].group = group;
    (groups[group] ||= []).push(it.id);
    prev = { ...it, t };
  }
  for (const ids of Object.values(groups)) {
    if (ids.length < 2) continue;
    // A soft frame is never the best of a burst that has a sharp one.
    const sharp = ids.filter((id) => !out[id].soft);
    const best = (sharp.length ? sharp : ids).reduce((a, b) => (out[b].quality > out[a].quality ? b : a));
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
    out[it.id].stars = Math.min(out[it.id].cap, rank < 0.35 ? 4 : rank < 0.8 ? 3 : 2);
  });
  for (const it of done) {
    const s = out[it.id];
    if (s.duplicate && !s.soft) {
      const best = groups[s.group].find((id) => !out[id].duplicate);
      s.stars = Math.min(s.cap, Math.max(2, (out[best].stars || 2) - 1));
    }
  }
  for (const it of done) {
    const s = out[it.id];
    if (s.stars == null) s.stars = 1;
    if (!s.reasons.length) s.reasons.push(s.stars >= 3 ? (it.m.subject ? 'Sharp subject, well exposed' : 'Sharp and well exposed') : 'Fine, nothing stands out');
    delete s.quality;
    delete s.cap;
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
