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

// The four region sliders lift or lower soft bumps over their part of the range.
const REGIONS = [['pShadows', 0, 0.5], ['pDarks', 0, 0.75], ['pLights', 0.25, 1], ['pHighlights', 0.5, 1]];

export function parametric(s, x) {
  let y = x;
  for (const [k, lo, hi] of REGIONS) {
    const v = s[k] || 0;
    if (!v || x <= lo || x >= hi) continue;
    const t = (x - lo) / (hi - lo);
    y += (v / 100) * 0.11 * Math.sin(Math.PI * t) ** 1.5;
  }
  return y;
}

export function curveTable(s) {
  const point = monotoneCurve(s.curve.map(([x, y]) => [x / 255, y / 255]));
  const out = new Float32Array(CURVE_SIZE);
  let prev = 0;
  for (let i = 0; i < CURVE_SIZE; i++) {
    const x = i / (CURVE_SIZE - 1);
    const y = Math.min(1, Math.max(0, point(parametric(s, x))));
    out[i] = Math.max(prev, y); // keep it rising
    prev = out[i];
  }
  return out;
}

export const HUE_SIZE = 360;

// For every hue: shift (degrees), saturation change and luminance change,
// blended between the two nearest colour bands.
export function hueTable(s) {
  const out = new Float32Array(HUE_SIZE * 3);
  const n = COLOR_HUES.length;
  for (let h = 0; h < HUE_SIZE; h++) {
    let i = n - 1;
    for (let k = 0; k < n; k++) if (COLOR_HUES[k] <= h) i = k;
    const j = (i + 1) % n;
    const a = COLOR_HUES[i], b = j === 0 ? 360 : COLOR_HUES[j];
    const t = (h - a) / (b - a);
    const w = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const mix = (kind) => ((s[`${kind}${i}`] || 0) * (1 - w) + (s[`${kind}${j}`] || 0) * w) / 100;
    out[h * 3] = mix('hue') * 30;
    out[h * 3 + 1] = mix('sat');
    out[h * 3 + 2] = mix('lum');
  }
  return out;
}
