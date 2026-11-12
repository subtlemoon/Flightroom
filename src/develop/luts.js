// Look-up tables the shader samples: the tone curve (region sliders plus the
// point curve) and the colour mixer (per-hue shifts).
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

// Where each Color Mixer band sits on the hue circle of linear ProPhoto RGB
// (red, orange, yellow, green, aqua, blue, purple, magenta), fitted on
// Lightroom exports of test charts (tools/lr-tone.md).
export const MIXER_HUES = [356, 33.3, 52.1, 86, 162.3, 229.3, 277.9, 336.3];

// For every hue: hue, saturation and luminance slider (-1..1) and the black &
// white mix, blended between the two nearest bands.
export function hueTable(s) {
  const out = new Float32Array(HUE_SIZE * 4);
  const order = MIXER_HUES.map((h, i) => [h, i]).sort((a, b) => a[0] - b[0]);
  const n = order.length;
  for (let h = 0; h < HUE_SIZE; h++) {
    let k = n - 1;
    for (let t = 0; t < n; t++) if (order[t][0] <= h) k = t;
    const [a, i] = order[k], [b0, j] = order[(k + 1) % n];
    const x = (h - a + 360) % 360, span = (b0 - a + 360) % 360;
    const w = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, x / span));
    const mix = (kind) => ((s[`${kind}${i}`] || 0) * (1 - w) + (s[`${kind}${j}`] || 0) * w) / 100;
    out[h * 4] = mix('hue');
    out[h * 4 + 1] = mix('sat');
    out[h * 4 + 2] = mix('lum');
    out[h * 4 + 3] = mix('gray');
  }
  return out;
}

// Colour grading, fitted on Lightroom exports of test charts and of JWL_7345/7530
// with and without their grade (tools/lr-tone.md). Lightroom grades after the
// tone curve, pointwise, and the grade barely changes brightness:
// each region adds the wheel's hue (turned 12.5 degrees) as a display-RGB tint
// around zero, leaning so warm tints brighten and blue ones darken as
// Lightroom's do, scaled by the region's strength and the wheel's amount.
const GRADE_HUE = -13.55, GRADE_LUMA = -0.394;
const GRADE_K = [0.3108, 0.7623, 0.4859, 0.3055]; // shadows, midtones, highlights, global
/** Colour grading per region (shadows, midtones, highlights, global): the RGB tint the shader adds. */
export function gradeTints(s) {
  return ['gShadow', 'gMid', 'gHigh', 'gGlobal'].map((k, r) => {
    const h = (((((s[`${k}Hue`] || 0) + GRADE_HUE) % 360) + 360) % 360) / 60, x = 1 - Math.abs((h % 2) - 1);
    const t = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]][Math.min(5, Math.floor(h))];
    const mean = (t[0] + t[1] + t[2]) / 3, luma = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
    const off = (1 - GRADE_LUMA) * mean + GRADE_LUMA * luma;
    const amt = Math.min(1, (s[`${k}Sat`] || 0) / 100) * GRADE_K[r];
    return t.map((v) => +((v - off) * amt).toFixed(5));
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
