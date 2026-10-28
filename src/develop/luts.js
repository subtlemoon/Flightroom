// Look-up tables the shader samples: the tone curve (region sliders plus the
// point curve) and the colour mixer (per-hue shifts).
import { COLOR_HUES } from './params.js';

export const CURVE_SIZE = 1024;

// Monotone cubic through points (Fritsch-Carlson), so the curve never overshoots.
export function monotoneCurve(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n < 2) return (x) => x;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = Math.hypot(a, b);
    if (h > 3) { m[i] = (3 * a * d[i]) / h; m[i + 1] = (3 * b * d[i]) / h; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// The four region sliders lift or lower soft bumps over their part of the
// range; the three splits move where those parts meet.
const REGIONS = [['pShadows', 0, 0.5], ['pDarks', 0, 0.75], ['pLights', 0.25, 1], ['pHighlights', 0.5, 1]];

export function parametric(s, x) {
  const a = (s.pSplitS ?? 25) / 100, b = Math.max(a + 0.01, (s.pSplitM ?? 50) / 100), c = Math.max(b + 0.01, (s.pSplitH ?? 75) / 100);
  // Where x sits with the splits at their defaults (25 / 50 / 75).
  const t0 = x < a ? (x / a) * 0.25 : x < b ? 0.25 + ((x - a) / (b - a)) * 0.25 : x < c ? 0.5 + ((x - b) / (c - b)) * 0.25 : 0.75 + ((x - c) / (1 - c)) * 0.25;
  let y = x;
  for (const [k, lo, hi] of REGIONS) {
    const v = s[k] || 0;
    if (!v || t0 <= lo || t0 >= hi) continue;
    const t = (t0 - lo) / (hi - lo);
    y += (v / 100) * 0.11 * Math.sin(Math.PI * t) ** 1.5;
  }
  return y;
}

// Four curves side by side (RGBA): the RGB curve with the region sliders, then
// red, green and blue.
export function curveTable(s) {
  const fns = [s.curve, s.curveR, s.curveG, s.curveB].map((c) => monotoneCurve((c || [[0, 0], [255, 255]]).map(([x, y]) => [x / 255, y / 255])));
  const out = new Float32Array(CURVE_SIZE * 4);
  // Any shape goes, falling ones included (a falling curve inverts the photo).
  for (let i = 0; i < CURVE_SIZE; i++) {
    const x = i / (CURVE_SIZE - 1);
    out[i * 4] = Math.min(1, Math.max(0, fns[0](parametric(s, x))));
    for (let c = 1; c < 4; c++) out[i * 4 + c] = Math.min(1, Math.max(0, fns[c](x)));
  }
  return out;
}

export const HUE_SIZE = 360;

// For every hue: shift (degrees), saturation change, luminance change and the
// black & white mix, blended between the two nearest colour bands.
export function hueTable(s) {
  const out = new Float32Array(HUE_SIZE * 4);
  const n = COLOR_HUES.length;
  for (let h = 0; h < HUE_SIZE; h++) {
    let i = n - 1;
    for (let k = 0; k < n; k++) if (COLOR_HUES[k] <= h) i = k;
    const j = (i + 1) % n;
    const a = COLOR_HUES[i], b = j === 0 ? 360 : COLOR_HUES[j];
    const t = (h - a) / (b - a);
    const w = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const mix = (kind) => ((s[`${kind}${i}`] || 0) * (1 - w) + (s[`${kind}${j}`] || 0) * w) / 100;
    out[h * 4] = mix('hue') * 30;
    out[h * 4 + 1] = mix('sat');
    out[h * 4 + 2] = mix('lum');
    out[h * 4 + 3] = mix('gray');
  }
  return out;
}

const hueVec = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.cos(a - (2 * Math.PI) / 3), Math.cos(a + (2 * Math.PI) / 3)];
};
/** Colour grading tints (RGB offsets around grey) for shadows, midtones, highlights and global. */
export function gradeTints(s) {
  return [['gShadow'], ['gMid'], ['gHigh'], ['gGlobal']].map(([k]) => {
    const v = hueVec(s[`${k}Hue`] || 0), amt = (s[`${k}Sat`] || 0) / 100;
    return [v[0] * amt, v[1] * amt, v[2] * amt];
  });
}

// Calibration: a matrix (linear RGB, row-major) that turns and strengthens
// each primary, keeping grey grey.
export function calibrationMatrix(s) {
  const Y = [0.2126, 0.7152, 0.0722];
  const cols = [['red', 0], ['green', 1], ['blue', 2]].map(([k, i]) => {
    const e = [0, 0, 0]; e[i] = 1;
    const y = Y[i];
    let v = e.map((x) => x - y);
    // Turn around the grey axis.
    const a = (((s[`${k}Hue`] || 0) / 100) * 30 * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), k3 = 1 / Math.sqrt(3);
    const cr = [k3 * (v[2] - v[1]), k3 * (v[0] - v[2]), k3 * (v[1] - v[0])];
    v = v.map((x, j) => x * c + cr[j] * sn);
    const sat = 1 + ((s[`${k}Sat`] || 0) / 100) * 0.6;
    return v.map((x) => y + x * sat);
  });
  // Columns -> rows, then rescale so white stays white.
  const m = [0, 1, 2].flatMap((r) => cols.map((col) => col[r]));
  for (let r = 0; r < 3; r++) { const sum = m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2]; for (let c = 0; c < 3; c++) m[r * 3 + c] /= sum; }
  return m;
}
