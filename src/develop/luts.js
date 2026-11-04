// Look-up tables the shader samples: the tone curve (region sliders plus the
// point curve) and the colour mixer (per-hue shifts).
import { COLOR_HUES } from './params.js';
import { splineCurve } from './adobe.js';

export const CURVE_SIZE = 1024;

/**
 * A point curve as Lightroom draws it: Adobe's C2 cubic spline through the
 * points (dng_spline_solver), which can dip below black or rise past white
 * between steep points (clipped). Measured on JWL_7451: Lightroom's curve
 * matches this (rms 0.013) far better than a monotone one (0.033).
 */
export function pointCurve(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0]);
  return splineCurve(pts);
}

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
// red, green and blue. `look` is a look's own point curve (Adobe Color's),
// which comes before the photo's.
export function curveTable(s, look = null) {
  const fns = [s.curve, s.curveR, s.curveG, s.curveB].map((c) => pointCurve((c || [[0, 0], [255, 255]]).map(([x, y]) => [x / 255, y / 255])));
  const pre = look ? pointCurve(look.map(([x, y]) => [x / 255, y / 255])) : (x) => x;
  const out = new Float32Array(CURVE_SIZE * 4);
  // Any shape goes, falling ones included (a falling curve inverts the photo).
  for (let i = 0; i < CURVE_SIZE; i++) {
    const x = i / (CURVE_SIZE - 1);
    out[i * 4] = Math.min(1, Math.max(0, fns[0](parametric(s, Math.min(1, Math.max(0, pre(x)))))));
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

// Colour grading as Lightroom does it, fitted on Lightroom exports of JWL_7345
// with and without its grade (tools/lr-tone.md). The grade works in OKLab: each
// region adds its colour (the wheel hue's OKLab direction, turned 45 degrees),
// pulls existing colour in a little and darkens, less so for colours that
// already lean the tint's way.
const GRADE_TURN = (-45.5 * Math.PI) / 180;
const srgbLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const okHue = (deg) => {
  const h = ((((deg % 360) + 360) % 360) / 60), x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]][Math.min(5, Math.floor(h))].map(srgbLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Math.atan2(0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q) + GRADE_TURN;
};
/** Colour grading per region (shadows, midtones, highlights, global): the tint's OKLab direction and the amount. */
export function gradeTints(s) {
  return ['gShadow', 'gMid', 'gHigh', 'gGlobal'].map((k) => {
    const a = okHue(s[`${k}Hue`] || 0), amt = Math.min(1, (s[`${k}Sat`] || 0) / 100);
    return [+Math.cos(a).toFixed(5), +Math.sin(a).toFixed(5), amt];
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
