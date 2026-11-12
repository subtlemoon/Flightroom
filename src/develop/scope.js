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
  return (encoders[trc] = t);
}
let LIN = null;

/**
 * Bins the pixels (RGBA bytes, Melissa RGB) on an n x n grid over the
 * scope's square (-1..1 both ways, +y up). Each cell keeps a count and the sum
 * of its pixels' sRGB colours (what the dots are drawn in).
 */
export function scopeGrid(px, spaceId = 'srgb', n = 112) {
  const sp = SCOPE_SPACES.find((x) => x.id === spaceId) || SCOPE_SPACES[0];
  if (!LIN) { LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = decodeS(i / 255); }
  const enc = encoder(sp.trc), toS = SCOPE_SPACES[0].m, encS = encoder('srgb'), m = sp.m;
  const count = new Uint32Array(n * n), col = new Float32Array(n * n * 3);
  const e = (t, v) => t[Math.round((v <= 0 ? 0 : v >= 1 ? 1 : v) * ENC)];
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = LIN[px[i]], g = LIN[px[i + 1]], b = LIN[px[i + 2]];
    const R = e(enc, m[0] * r + m[1] * g + m[2] * b), G = e(enc, m[3] * r + m[4] * g + m[5] * b), B = e(enc, m[6] * r + m[7] * g + m[8] * b);
    const [x, y] = chroma(R, G, B);
    const cx = Math.floor((x * 0.5 + 0.5) * n), cy = Math.floor((0.5 - y * 0.5) * n);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
    const k = cy * n + cx;
    const c = ++count[k];
    if (c > max) max = c;
    col[k * 3] += e(encS, toS[0] * r + toS[1] * g + toS[2] * b);
    col[k * 3 + 1] += e(encS, toS[3] * r + toS[4] * g + toS[5] * b);
    col[k * 3 + 2] += e(encS, toS[6] * r + toS[7] * g + toS[8] * b);
  }
  return { n, count, col, max };
}

/** The six colour targets: name, dot colour, angle, and the 75% target's distance from the centre. */
export const TARGETS = [
  ['Red', '#e04848', [1, 0, 0]], ['Magenta', '#d84ad8', [1, 0, 1]], ['Blue', '#4040e0', [0, 0, 1]],
  ['Cyan', '#40d8d8', [0, 1, 1]], ['Green', '#40c840', [0, 1, 0]], ['Yellow', '#dede40', [1, 1, 0]],
].map(([name, dot, rgb]) => {
  const [x, y] = chroma(...rgb.map((v) => v * 0.75));
  return { name, dot, angle: Math.atan2(y, x), tick: Math.hypot(x, y) };
});
