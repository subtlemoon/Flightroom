// Scene-referred tone mapping for the RAW develop pipeline (darktable style):
//   - Sigmoid: modified log-logistic curve around middle gray (0.18) with
//     contrast and skew parameters, plus per-channel processing (with optional
//     hue preservation) to mimic analog film highlights.
//   - AgX: wide-gamut inset matrix, open-domain log2 transform, 6th-order
//     polynomial contrast S-curve, outset matrix, and highlight desaturation roll-off.
//   - Filmic RGB: C1 monotonic parametric spline fitting black/white EV bounds
//     relative to middle gray (0.18) with norm-based hue preservation.

import { apply3 } from './color.js';

export const MIDDLE_GRAY = 0.18;
export const W709 = [0.2126, 0.7152, 0.0722];

export const TONE_MAPPERS = [
  ['none', 'Standard'],
  ['sigmoid', 'Sigmoid'],
  ['agx', 'AgX'],
  ['filmic', 'Filmic RGB'],
];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / Math.max(e1 - e0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Returns the active tone mapper id ('none' | 'sigmoid' | 'agx' | 'filmic'). */
export function activeToneMap(s = {}) {
  const m = s.toneMap || s.mode;
  if (m && m !== 'none' && m !== 'standard') return m;
  if (m === 'none' || m === 'standard') return s.profile === 'agx' && !s.toneMap ? 'agx' : 'none';
  return s.profile === 'agx' ? 'agx' : 'none';
}

// --- Standard display-referred shoulder & sRGB encoding ---------------------

export function shoulder1(x) {
  const v = Math.max(0, x);
  const k = 0.72;
  return v < k ? v : k + (1 - k) * (1 - Math.exp(-(v - k) / (1 - k)));
}

export function shoulder(rgb) {
  return [shoulder1(rgb[0]), shoulder1(rgb[1]), shoulder1(rgb[2])];
}

export function srgbEncode1(x) {
  const v = Math.max(0, x);
  return v < 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

export function srgbEncode(rgb) {
  return [srgbEncode1(rgb[0]), srgbEncode1(rgb[1]), srgbEncode1(rgb[2])];
}

// --- 1. Sigmoid (modified log-logistic around middle gray 0.18) -------------

/**
 * Computes film power (pf), paper power (pp), and fulcrum constant (k) for the
 * modified log-logistic curve:
 *   f(x) = (x^pf / (x^pf + g^pf * k))^pp
 * Pinned so f(0.18) = 0.18 and the log-slope at middle gray is proportional to
 * `contrast` and invariant to `skew`.
 */
export function sigmoidParams(opts = {}) {
  const contrast = clamp(Number(opts.contrast ?? opts.sigmoidContrast ?? 1.5), 0.2, 10);
  const skew = clamp(Number(opts.skew ?? opts.sigmoidSkew ?? 0), -1, 1);
  const preserveHue = clamp(
    Number(opts.preserveHue ?? (opts.sigmoidHue != null ? opts.sigmoidHue / 100 : 0)),
    0,
    1,
  );
  const pp = 3 ** -skew;
  const k = MIDDLE_GRAY ** (-1 / pp) - 1;
  const pf = (contrast * (1 - MIDDLE_GRAY)) / (pp * (1 - MIDDLE_GRAY ** (1 / pp)));
  return { contrast, skew, preserveHue, pf, pp, k };
}

export function sigmoidEval(x, pf, pp, k) {
  if (!(x > 0)) return 0;
  if (x <= MIDDLE_GRAY) {
    const u = (x / MIDDLE_GRAY) ** pf;
    return (u / (u + k)) ** pp;
  }
  const w = (MIDDLE_GRAY / x) ** pf;
  return (1 / (1 + k * w)) ** pp;
}

export function sigmoidCurve(x, contrast = 1.5, skew = 0) {
  const { pf, pp, k } = sigmoidParams({ contrast, skew });
  return sigmoidEval(x, pf, pp, k);
}

/**
 * Per-channel modified log-logistic tone mapping (mimicking analog film
 * highlight roll-off to white), with optional order-preserving hue restoration.
 */
export function sigmoid(rgb, opts = {}) {
  const { pf, pp, k, preserveHue } = sigmoidParams(opts);
  const r0 = Math.max(0, rgb[0]), g0 = Math.max(0, rgb[1]), b0 = Math.max(0, rgb[2]);
  let r = sigmoidEval(r0, pf, pp, k);
  let g = sigmoidEval(g0, pf, pp, k);
  let b = sigmoidEval(b0, pf, pp, k);
  if (preserveHue > 0) {
    const mx0 = Math.max(r0, g0, b0), mn0 = Math.min(r0, g0, b0);
    const mx1 = Math.max(r, g, b), mn1 = Math.min(r, g, b);
    if (mx0 - mn0 > 1e-6 && mx1 - mn1 > 1e-6) {
      const span0 = mx0 - mn0, span1 = mx1 - mn1;
      const hr = mn1 + clamp((r0 - mn0) / span0, 0, 1) * span1;
      const hg = mn1 + clamp((g0 - mn0) / span0, 0, 1) * span1;
      const hb = mn1 + clamp((b0 - mn0) / span0, 0, 1) * span1;
      r += (hr - r) * preserveHue;
      g += (hg - g) * preserveHue;
      b += (hb - b) * preserveHue;
    }
  }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// --- 2. AgX (inset matrix, open-domain log, S-curve, highlight roll-off) ----

// Row-major 3x3 wide-gamut inset & outset matrices (Troy Sobotka / darktable).
export const AGX_INSET = [
  0.842479062253094, 0.0784335999999992, 0.0792237451477643,
  0.0423282422610123, 0.878468636469772, 0.0791661274605434,
  0.0423756549057051, 0.0784336, 0.879142973793104,
];

export const AGX_OUTSET = [
  1.19687900512017, -0.0980208811401368, -0.0990297440797205,
  -0.0528968517574562, 1.15190312990417, -0.0989611768448433,
  -0.0529716355144438, -0.0980434501171241, 1.15107367264116,
];

export const AGX_MIN_EV = -12.47393; // log2(0.18) - 10 EV
export const AGX_MAX_EV = 4.026069;  // log2(0.18) + 6.5 EV
export const AGX_MID = (Math.log2(MIDDLE_GRAY) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV); // ~0.6060606

export function agxParams(opts = {}) {
  const contrast = clamp(Number(opts.contrast ?? opts.agxContrast ?? 1), 0.2, 4);
  const saturation = clamp(Number(opts.saturation ?? opts.agxSat ?? 1), 0, 3);
  const desaturation = clamp(
    Number(opts.desaturation ?? (opts.agxDesat != null ? opts.agxDesat / 100 : 0.35)),
    0,
    1,
  );
  return { contrast, saturation, desaturation };
}

/** 6th-order polynomial contrast S-curve on normalized log2 coordinate v in [0, 1]. */
export function agxCurve(v) {
  const x = clamp(v, 0, 1);
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

export function agx(rgb, opts = {}) {
  const { contrast, saturation, desaturation } = agxParams(opts);
  const pos = [Math.max(0, rgb[0]), Math.max(0, rgb[1]), Math.max(0, rgb[2])];
  const insetRgb = apply3(AGX_INSET, pos);
  const span = AGX_MAX_EV - AGX_MIN_EV;
  const curved = insetRgb.map((c) => {
    const t = clamp((Math.log2(Math.max(c, 1e-10)) - AGX_MIN_EV) / span, 0, 1);
    const tc = clamp(AGX_MID + (t - AGX_MID) * contrast, 0, 1);
    const p = Math.max(0, agxCurve(tc));
    return p ** 2.2;
  });
  const lin = apply3(AGX_OUTSET, curved).map((c) => Math.max(0, c));
  const y = dot3(lin, W709);
  const roll = smoothstep(0.5, 1.0, y) * desaturation;
  const sat = saturation * (1 - roll);
  return [
    clamp(y + (lin[0] - y) * sat, 0, 1),
    clamp(y + (lin[1] - y) * sat, 0, 1),
    clamp(y + (lin[2] - y) * sat, 0, 1),
  ];
}

// --- 3. Filmic RGB (parametric spline on EV bounds with hue preservation) ---

/**
 * Solves a C1 monotonic parametric spline over normalized log2 exposure t in [0, 1]:
 *   - Toe [0, t1]: cubic Hermite from (0, 0, slope=0) to (t1, y1, slope=S)
 *   - Latitude [t1, t2]: linear segment passing through middle gray (t0, 0.18) with slope S
 *   - Shoulder [t2, 1]: cubic Hermite from (t2, y2, slope=S) to (1, 1, slope=0)
 */
export function filmicSpline(opts = {}) {
  const whiteEv = clamp(Number(opts.whiteEv ?? opts.filmicWhiteEv ?? 4.0), 0.5, 16);
  const blackEv = clamp(Number(opts.blackEv ?? opts.filmicBlackEv ?? -8.0), -20, -0.5);
  const contrast = clamp(Number(opts.contrast ?? opts.filmicContrast ?? 1.3), 0.2, 5);
  const preserveHue = clamp(
    Number(opts.preserveHue ?? (opts.filmicHue != null ? opts.filmicHue / 100 : 1)),
    0,
    1,
  );
  const spanEv = whiteEv - blackEv;
  const t0 = -blackEv / spanEv;
  const t1 = t0 * 0.65;
  const t2 = t0 + (1 - t0) * 0.35;
  const rawSlope = contrast * (spanEv / 12.0) * 0.85;
  // Fritsch-Carlson monotonicity bound so cubic Hermite toe/shoulder never overshoot.
  const maxToeSlope = (3 * MIDDLE_GRAY) / (3 * t0 - 2 * t1);
  const maxShSlope = (3 * (1 - MIDDLE_GRAY)) / (3 * (1 - t0) - 2 * (1 - t2));
  const slope = Math.min(rawSlope, 0.95 * Math.min(maxToeSlope, maxShSlope));
  const y1 = MIDDLE_GRAY - slope * (t0 - t1);
  const y2 = MIDDLE_GRAY + slope * (t2 - t0);
  return { whiteEv, blackEv, spanEv, invSpanEv: 1 / spanEv, contrast, preserveHue, t0, t1, y1, t2, y2, slope };
}

export function filmicEval(x, sp) {
  if (!(x > 0)) return 0;
  const ev = Math.log2(Math.max(x, 1e-10) / MIDDLE_GRAY);
  const t = clamp((ev - sp.blackEv) * sp.invSpanEv, 0, 1);
  const { t1, y1, t2, y2, slope: s } = sp;
  if (t < t1) {
    const u = t / Math.max(t1, 1e-6);
    const m1 = s * t1;
    return u * u * ((3 * y1 - m1) + (m1 - 2 * y1) * u);
  }
  if (t <= t2) return y1 + s * (t - t1);
  const v = (1 - t) / Math.max(1 - t2, 1e-6);
  const d2 = 1 - y2;
  const m2 = s * (1 - t2);
  return 1 - v * v * ((3 * d2 - m2) + (m2 - 2 * d2) * v);
}

export function filmicCurve(x, optsOrSpline = {}) {
  const sp = optsOrSpline.invSpanEv != null ? optsOrSpline : filmicSpline(optsOrSpline);
  return filmicEval(x, sp);
}

export function filmic(rgb, opts = {}) {
  const sp = opts.invSpanEv != null ? opts : filmicSpline(opts);
  const r0 = Math.max(0, rgb[0]), g0 = Math.max(0, rgb[1]), b0 = Math.max(0, rgb[2]);
  const yIn = r0 * W709[0] + g0 * W709[1] + b0 * W709[2];
  if (yIn <= 1e-10) return [0, 0, 0];
  const yOut = filmicEval(yIn, sp);
  const ev = Math.log2(yIn / MIDDLE_GRAY);
  const t = clamp((ev - sp.blackEv) * sp.invSpanEv, 0, 1);
  const sh = smoothstep(sp.t2, 1.0, t);
  const lat = 1 - sh * sh * 0.65;
  const scale = (yOut / yIn) * lat;
  let dr = (r0 - yIn) * scale;
  let dg = (g0 - yIn) * scale;
  let db = (b0 - yIn) * scale;
  const mx = Math.max(yOut + dr, yOut + dg, yOut + db);
  if (mx > 1) {
    const k = (1 - yOut) / Math.max(mx - yOut, 1e-6);
    dr *= k; dg *= k; db *= k;
  }
  const mn = Math.min(yOut + dr, yOut + dg, yOut + db);
  if (mn < 0) {
    const k = yOut / Math.max(yOut - mn, 1e-6);
    dr *= k; dg *= k; db *= k;
  }
  const nr = clamp(yOut + dr, 0, 1);
  const ng = clamp(yOut + dg, 0, 1);
  const nb = clamp(yOut + db, 0, 1);
  if (sp.preserveHue >= 0.999) return [nr, ng, nb];
  const pr = filmicEval(r0, sp), pg = filmicEval(g0, sp), pb = filmicEval(b0, sp);
  const ph = sp.preserveHue;
  return [
    clamp(pr + (nr - pr) * ph, 0, 1),
    clamp(pg + (ng - pg) * ph, 0, 1),
    clamp(pb + (nb - pb) * ph, 0, 1),
  ];
}

// --- Unified dispatcher and WebGL shader uniforms ---------------------------

export function tonemap(rgb, s = {}) {
  const mode = activeToneMap(s);
  if (mode === 'sigmoid') return sigmoid(rgb, s);
  if (mode === 'agx') return agx(rgb, s);
  if (mode === 'filmic') return filmic(rgb, s);
  return shoulder(rgb);
}

export function tonemapUniforms(s = {}) {
  const mode = activeToneMap(s);
  if (mode === 'sigmoid') {
    const { pf, pp, k, preserveHue } = sigmoidParams(s);
    return { uToneMap: 1, uTmA: [pf, pp, k, preserveHue], uTmB: [0, 0, 0, 0], uTmHue: preserveHue };
  }
  if (mode === 'agx') {
    const { contrast, saturation, desaturation } = agxParams(s);
    return { uToneMap: 2, uTmA: [contrast, saturation, desaturation, 0], uTmB: [0, 0, 0, 0], uTmHue: 0 };
  }
  if (mode === 'filmic') {
    const sp = filmicSpline(s);
    return {
      uToneMap: 3,
      uTmA: [sp.blackEv, sp.invSpanEv, sp.t0, sp.slope],
      uTmB: [sp.t1, sp.y1, sp.t2, sp.y2],
      uTmHue: sp.preserveHue,
    };
  }
  return { uToneMap: 0, uTmA: [0, 0, 0, 0], uTmB: [0, 0, 0, 0], uTmHue: 0 };
}
