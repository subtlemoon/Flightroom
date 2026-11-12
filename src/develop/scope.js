// Lightroom's Vectorscope: every pixel placed by its hue (angle) and
// saturation (distance from the centre), measured in a chosen colour space.
// The histogram's small render (Melissa RGB: ProPhoto colours, sRGB tones)
// is converted here, so the scope costs no extra drawing on the graphics card.

// Linear ProPhoto -> each space's linear RGB (rows), D50 -> D65 by Bradford for the D65 spaces.
export const SCOPE_SPACES = [
  { id: 'srgb', label: 'sRGB', m: [2.034076, -0.727334, -0.306742, -0.228813, 1.23173, -0.002917, -0.00857, -0.153287, 1.161856], trc: 'srgb' },
  { id: 'adobe', label: 'Adobe RGB (1998)', m: [1.389437, -0.169247, -0.22019, -0.228813, 1.23173, -0.002917, -0.017636, -0.096277, 1.113912], trc: 2.19921875 },
  { id: 'p3', label: 'Display P3', m: [1.632327, -0.379526, -0.252802, -0.153698, 1.1667, -0.013002, 0.010379, -0.062822, 1.052442], trc: 'srgb' },
  { id: 'rec2020', label: 'Rec. 2020', m: [1.200472, -0.057384, -0.143088, -0.069951, 1.080627, -0.010676, 0.005528, -0.040797, 1.035268], trc: 'rec709' },
  { id: 'prophoto', label: 'ProPhoto', m: [1, 0, 0, 0, 1, 0, 0, 0, 1], trc: 1.8 },
];

// Rec. 709 chroma; scaled so the 75% colour targets sit where Lightroom puts
// its tick marks (about 0.8 of the ring, 0.9 for green and magenta).
const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;
export const SCOPE_GAIN = 2.07;
export function chroma(r, g, b) {
  const y = KR * r + KG * g + KB * b;
  return [((b - y) / (2 - 2 * KB)) * SCOPE_GAIN, ((r - y) / (2 - 2 * KR)) * SCOPE_GAIN];
}

// Lightroom's skin tone line (about 123 degrees, between red and yellow).
export const SKIN_ANGLE = (123 * Math.PI) / 180;

const decodeS = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const ENC = 4096;
const encoders = {};
function encoder(trc) {
  if (encoders[trc]) return encoders[trc];
  const f = trc === 'srgb' ? (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
    : trc === 'rec709' ? (v) => (v < 0.018 ? v * 4.5 : 1.099 * v ** 0.45 - 0.099)
      : (v) => v ** (1 / trc);
  const t = new Float32Array(ENC + 1);
  for (let i = 0; i <= ENC; i++) t[i] = f(i / ENC);
  t.f = f;
  return (encoders[trc] = t);
}
let LIN = null;
const lin = () => {
  if (!LIN) { LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = decodeS(i / 255); }
  return LIN;
};
// Encoded through the space's tone curve. Colours outside the space are not
// clipped (that piled them up on a hard edge): below 0 is mirrored, above 1
// follows the curve on, so they land where they really are, past the ring.
const curveAt = (t, v) => (v >= 0 && v <= 1 ? t[Math.round(v * ENC)] : v < 0 ? -curveAt(t, -v) : t.f(v));
const clip = (t, v) => t[Math.round((v <= 0 ? 0 : v >= 1 ? 1 : v) * ENC)];

/** Where one pixel (Melissa RGB bytes) lands on the scope: [x, y], ring = 1; plus its sRGB colour. */
function place(sp, r8, g8, b8) {
  const L = lin(), r = L[r8], g = L[g8], b = L[b8], m = sp.m, enc = encoder(sp.trc);
  return chroma(curveAt(enc, m[0] * r + m[1] * g + m[2] * b), curveAt(enc, m[3] * r + m[4] * g + m[5] * b), curveAt(enc, m[6] * r + m[7] * g + m[8] * b));
}
const spaceOf = (id) => SCOPE_SPACES.find((x) => x.id === id) || SCOPE_SPACES[0];

/**
 * Bins the pixels (RGBA bytes, Melissa RGB) on an n x n grid over the
 * scope's square (-1..1 both ways, +y up). Each cell keeps a (spread) count
 * and the sum of its pixels' sRGB colours (what the dots are drawn in).
 */
export function scopeGrid(px, spaceId = 'srgb', n = 220, zoom = 1) {
  const sp = spaceOf(spaceId), L = lin(), toS = SCOPE_SPACES[0].m, encS = encoder('srgb');
  const count = new Float32Array(n * n), col = new Float32Array(n * n * 3);
  for (let i = 0; i < px.length; i += 4) {
    const [x, y] = place(sp, px[i], px[i + 1], px[i + 2]);
    // Spread over the four nearest cells (bilinear), so the scope is smooth rather than blocky.
    const fx = (x * zoom * 0.5 + 0.5) * n - 0.5, fy = (0.5 - y * zoom * 0.5) * n - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= n || y0 + 1 >= n) continue;
    const r = L[px[i]], g = L[px[i + 1]], b = L[px[i + 2]];
    const sr = clip(encS, toS[0] * r + toS[1] * g + toS[2] * b), sg = clip(encS, toS[3] * r + toS[4] * g + toS[5] * b), sb = clip(encS, toS[6] * r + toS[7] * g + toS[8] * b);
    for (let q = 0; q < 4; q++) {
      const cx = x0 + (q & 1), cy = y0 + (q >> 1), wgt = (q & 1 ? tx : 1 - tx) * (q >> 1 ? ty : 1 - ty);
      const k = cy * n + cx;
      count[k] += wgt; col[k * 3] += sr * wgt; col[k * 3 + 1] += sg * wgt; col[k * 3 + 2] += sb * wgt;
    }
  }
  let max = 0;
  for (let k = 0; k < n * n; k++) if (count[k] > max) max = count[k];
  return { n, count, col, max };
}

/**
 * The scope position of the photo under the pointer: (fx, fy) in frame units
 * (-1..1, +y down, as outToFrame gives) on the histogram's render (w x h, bottom row first), 3x3 averaged.
 */
export function scopeAt(px, w, h, fx, fy, spaceId = 'srgb') {
  const cx = Math.floor((fx * 0.5 + 0.5) * w), cy = Math.floor((0.5 - fy * 0.5) * h);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * 4;
    for (let j = 0; j < 3; j++) sum[j] += px[i + j];
    n++;
  }
  return place(spaceOf(spaceId), ...sum.map((v) => Math.round(v / n)));
}

/** How a scope position reads against the skin tone line: degrees off it (+ = toward yellow) and saturation (ring = 100). */
export function skinReading([x, y]) {
  const sat = Math.hypot(x, y);
  let d = ((Math.atan2(y, x) - SKIN_ANGLE) * 180) / Math.PI;
  d = ((d + 540) % 360) - 180;
  return { off: d, sat: sat * 100 };
}

/** The six colour targets: name, dot colour, angle, and the 75% target's distance from the centre. */
export const TARGETS = [
  ['Red', '#e04848', [1, 0, 0]], ['Magenta', '#d84ad8', [1, 0, 1]], ['Blue', '#4040e0', [0, 0, 1]],
  ['Cyan', '#40d8d8', [0, 1, 1]], ['Green', '#40c840', [0, 1, 0]], ['Yellow', '#dede40', [1, 1, 0]],
].map(([name, dot, rgb]) => {
  const [x, y] = chroma(...rgb.map((v) => v * 0.75));
  return { name, dot, angle: Math.atan2(y, x), tick: Math.hypot(x, y) };
});
