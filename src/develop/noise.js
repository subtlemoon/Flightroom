// How noisy the photo's colour is at each brightness, for colour noise
// reduction (renderer.js updateChroma, shaders.js CNR_BLUR and FINAL): from
// neighbouring pixels of the overview, as linear sRGB offsets from grey (red
// and blue parts). Neighbours differ by noise plus whatever detail is there,
// so the median difference is used: in a high-ISO night shot most pairs at a
// brightness are flat sky or road, and real colour edges are the few.

export const NOISE_BINS = 8;
/** Bin i is centred on log2 brightness NOISE_LO + i * NOISE_STEP. */
export const NOISE_LO = -10, NOISE_STEP = 1.25;

const f16 = new Float32Array(65536);
for (let h = 0; h < 65536; h++) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
  f16[h] = e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15);
}

/**
 * frame: { w, h, data } (half floats, camera RGB); wb: [r, g, b] multipliers;
 * cam: 3x3 camera -> linear sRGB, column-major (as the shaders get it).
 * Returns NOISE_BINS variances (per offset part) in an array of 12 (3 vec4s for the shaders).
 */
export function noiseModel(frame, wb, cam) {
  const { w, h, data } = frame;
  // About 60k pairs, spread over the whole photo: a few milliseconds, as this
  // runs again while Temp or Tint is dragged.
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 60000)));
  const most = Math.ceil(h / step) * Math.ceil(w / step);
  const bins = Array.from({ length: NOISE_BINS }, () => new Float32Array(most));
  const n = new Int32Array(NOISE_BINS);
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = cam;
  const [w0, w1, w2] = wb;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x + 1 < w; x += step) {
      const i = (y * w + x) * 3;
      // Both pixels to linear sRGB, as the shaders' toLinear (without the highlight easing).
      let r = Math.min(f16[data[i]] * w0, 1), g = Math.min(f16[data[i + 1]] * w1, 1), b = Math.min(f16[data[i + 2]] * w2, 1);
      const ar = m0 * r + m3 * g + m6 * b, ag = m1 * r + m4 * g + m7 * b, ab = m2 * r + m5 * g + m8 * b;
      r = Math.min(f16[data[i + 3]] * w0, 1); g = Math.min(f16[data[i + 4]] * w1, 1); b = Math.min(f16[data[i + 5]] * w2, 1);
      const cr = m0 * r + m3 * g + m6 * b, cg = m1 * r + m4 * g + m7 * b, cb = m2 * r + m5 * g + m8 * b;
      const ya = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab;
      const yc = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
      const k = Math.round((Math.log2(Math.max((ya + yc) / 2, 1e-4)) - NOISE_LO) / NOISE_STEP);
      if (k < 0 || k >= NOISE_BINS) continue;
      const dr = ar - ya - (cr - yc), db = ab - ya - (cb - yc);
      const d = dr * dr + db * db;
      if (d === d && d !== Infinity) bins[k][n[k]++] = d;
    }
  }
  // |d|^2 of two independent pixels' offsets is 2 variances times a chi-square
  // of 2 degrees, whose median is 2 ln 2.
  const out = new Float32Array(12);
  for (let k = 0; k < NOISE_BINS; k++) {
    if (n[k] < 200) continue;
    const a = bins[k].subarray(0, n[k]).sort();
    out[k] = a[a.length >> 1] / (4 * Math.LN2);
  }
  // Too few pixels at a brightness: take the nearest measured one (or, with
  // nothing measured, a clean photo's).
  const known = [...out.keys()].filter((k) => k < NOISE_BINS && out[k] > 0);
  for (let k = 0; k < NOISE_BINS; k++) {
    if (out[k] > 0) continue;
    out[k] = known.length ? out[known.reduce((m, j) => (Math.abs(j - k) < Math.abs(m - k) ? j : m))] : 1e-8;
  }
  return out;
}
