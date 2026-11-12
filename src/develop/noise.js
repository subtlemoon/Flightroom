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
  const bins = Array.from({ length: NOISE_BINS }, () => []);
  const lin = (i, o) => {
    let r = f16[data[i]] * wb[0], g = f16[data[i + 1]] * wb[1], b = f16[data[i + 2]] * wb[2];
    r = Math.min(r, 1); g = Math.min(g, 1); b = Math.min(b, 1);
    o[0] = cam[0] * r + cam[3] * g + cam[6] * b;
    o[1] = cam[1] * r + cam[4] * g + cam[7] * b;
    o[2] = cam[2] * r + cam[5] * g + cam[8] * b;
  };
  const a = [0, 0, 0], c = [0, 0, 0];
  // About 250k pairs, spread over the whole photo.
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 250000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x + 1 < w; x += step) {
      const i = (y * w + x) * 3;
      lin(i, a); lin(i + 3, c);
      const ya = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      const yc = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const ym = (ya + yc) / 2;
      const k = Math.round((Math.log2(Math.max(ym, 1e-4)) - NOISE_LO) / NOISE_STEP);
      if (k < 0 || k >= NOISE_BINS) continue;
      const dr = a[0] - ya - (c[0] - yc), db = a[2] - ya - (c[2] - yc);
      const d = dr * dr + db * db;
      if (Number.isFinite(d)) bins[k].push(d);
    }
  }
  // |d|^2 of two independent pixels' offsets is 2 variances times a chi-square
  // of 2 degrees, whose median is 2 ln 2.
  const out = new Float32Array(12);
  for (let k = 0; k < NOISE_BINS; k++) {
    const v = bins[k];
    if (v.length < 200) continue;
    v.sort((p, q) => p - q);
    out[k] = v[v.length >> 1] / (4 * Math.LN2);
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
