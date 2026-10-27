// Colour science for RAW files: white balance as temperature/tint (the way
// Lightroom shows it) and the matrix from camera colours to screen colours.
// Follows the DNG specification: the camera's XYZ->camera matrices are measured
// at two illuminants and blended by inverse colour temperature.

export const mul3 = (a, b) => {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return o;
};
export const apply3 = (m, v) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
}
const diag = (v) => [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]];

// Robertson's isotemperature lines (as in the DNG SDK): mired, u, v, slope.
const TABLE = [
  [0, 0.18006, 0.26352, -0.24341], [10, 0.18066, 0.26589, -0.25479], [20, 0.18133, 0.26846, -0.26876],
  [30, 0.18208, 0.27119, -0.28539], [40, 0.18293, 0.27407, -0.30470], [50, 0.18388, 0.27709, -0.32675],
  [60, 0.18494, 0.28021, -0.35156], [70, 0.18611, 0.28342, -0.37915], [80, 0.18740, 0.28668, -0.40955],
  [90, 0.18880, 0.28997, -0.44278], [100, 0.19032, 0.29326, -0.47888], [125, 0.19462, 0.30141, -0.58204],
  [150, 0.19962, 0.30921, -0.70471], [175, 0.20525, 0.31647, -0.84901], [200, 0.21142, 0.32312, -1.0182],
  [225, 0.21807, 0.32909, -1.2168], [250, 0.22511, 0.33439, -1.4512], [275, 0.23247, 0.33904, -1.7298],
  [300, 0.24010, 0.34308, -2.0637], [325, 0.24792, 0.34655, -2.4681], [350, 0.25591, 0.34951, -2.9641],
  [375, 0.26400, 0.35200, -3.5814], [400, 0.27218, 0.35407, -4.3633], [425, 0.28039, 0.35577, -5.3762],
  [450, 0.28863, 0.35714, -6.7262], [475, 0.29685, 0.35823, -8.5955], [500, 0.30505, 0.35907, -11.324],
  [525, 0.31320, 0.35968, -15.628], [550, 0.32129, 0.36011, -23.325], [575, 0.32931, 0.36038, -40.770],
  [600, 0.33724, 0.36051, -116.45],
];
const TINT_SCALE = -3000;

export function xyToTempTint([x, y]) {
  const u = (2 * x) / (1.5 - x + 6 * y);
  const v = (3 * y) / (1.5 - x + 6 * y);
  let lastDt = 0, lastDu = 0, lastDv = 0;
  for (let i = 1; i <= 30; i++) {
    let du = 1, dv = TABLE[i][3];
    const len = Math.hypot(du, dv);
    du /= len; dv /= len;
    let uu = u - TABLE[i][1], vv = v - TABLE[i][2];
    let dt = -uu * dv + vv * du;
    if (dt <= 0 || i === 30) {
      if (dt > 0) dt = 0;
      dt = -dt;
      const f = i === 1 ? 0 : dt / (lastDt + dt);
      const temp = 1e6 / (TABLE[i - 1][0] * f + TABLE[i][0] * (1 - f));
      uu = u - (TABLE[i - 1][1] * f + TABLE[i][1] * (1 - f));
      vv = v - (TABLE[i - 1][2] * f + TABLE[i][2] * (1 - f));
      du = du * (1 - f) + lastDu * f;
      dv = dv * (1 - f) + lastDv * f;
      const l2 = Math.hypot(du, dv);
      du /= l2; dv /= l2;
      return { temp, tint: (uu * du + vv * dv) * TINT_SCALE };
    }
    lastDt = dt; lastDu = du; lastDv = dv;
  }
  return { temp: 5000, tint: 0 };
}

export function tempTintToXy(temp, tint) {
  const r = 1e6 / temp;
  const offset = tint * (1 / TINT_SCALE);
  for (let i = 0; i < 30; i++) {
    if (r < TABLE[i + 1][0] || i === 29) {
      const f = (TABLE[i + 1][0] - r) / (TABLE[i + 1][0] - TABLE[i][0]);
      let u = TABLE[i][1] * f + TABLE[i + 1][1] * (1 - f);
      let v = TABLE[i][2] * f + TABLE[i + 1][2] * (1 - f);
      let uu1 = 1, vv1 = TABLE[i][3];
      let l = Math.hypot(uu1, vv1); uu1 /= l; vv1 /= l;
      let uu2 = 1, vv2 = TABLE[i + 1][3];
      l = Math.hypot(uu2, vv2); uu2 /= l; vv2 /= l;
      let uu3 = uu1 * f + uu2 * (1 - f), vv3 = vv1 * f + vv2 * (1 - f);
      l = Math.hypot(uu3, vv3); uu3 /= l; vv3 /= l;
      u += uu3 * offset;
      v += vv3 * offset;
      return [(1.5 * u) / (u - 4 * v + 2), v / (u - 4 * v + 2)];
    }
  }
  return [0.3457, 0.3585];
}

const xyToXYZ = ([x, y]) => [x / y, 1, (1 - x - y) / y];
const XYZToxy = ([X, Y, Z]) => { const s = X + Y + Z; return s > 0 ? [X / s, Y / s] : [0.3457, 0.3585]; };

// XYZ->camera matrix for a white point, blended between the measured ones.
function cameraMatrix(matrices, xy) {
  if (!matrices.length) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (matrices.length === 1) return matrices[0][1];
  const { temp } = xyToTempTint(xy);
  const [lo, hi] = [matrices[0], matrices[matrices.length - 1]];
  const g = Math.min(1, Math.max(0, (1 / temp - 1 / hi[0]) / (1 / lo[0] - 1 / hi[0])));
  return lo[1].map((v, k) => g * v + (1 - g) * hi[1][k]);
}

// The white point a camera neutral (1/multipliers) corresponds to.
export function neutralToXy(matrices, neutral) {
  let xy = [0.3457, 0.3585];
  for (let i = 0; i < 30; i++) {
    const next = XYZToxy(apply3(inv3(cameraMatrix(matrices, xy)), neutral));
    if (Math.abs(next[0] - xy[0]) + Math.abs(next[1] - xy[1]) < 1e-7) return next;
    xy = next;
  }
  return xy;
}

export function asShotTempTint(info) {
  const neutral = info.asShot.map((m) => 1 / m);
  const t = xyToTempTint(neutralToXy(info.matrices, neutral));
  return { temp: Math.round(t.temp / 50) * 50, tint: Math.round(t.tint) };
}

const BRADFORD = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const D65 = [0.95047, 1, 1.08883];
const XYZ_TO_SRGB = [3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259, 1.0572252];

function adapt(fromXYZ, toXYZ) {
  const a = apply3(BRADFORD, fromXYZ), b = apply3(BRADFORD, toXYZ);
  return mul3(inv3(BRADFORD), mul3(diag([b[0] / a[0], b[1] / a[1], b[2] / a[2]]), BRADFORD));
}

// For a white balance: the per-channel multipliers (smallest = 1, so clipped
// highlights stay white) and the matrix from balanced camera RGB to linear sRGB.
export function colorTransform(info, temp, tint) {
  const xy = tempTintToXy(temp, tint);
  const M = cameraMatrix(info.matrices, xy);
  const whiteXYZ = xyToXYZ(xy);
  const neutral = apply3(M, whiteXYZ);
  const mul = neutral.map((n) => 1 / n);
  const lo = Math.min(...mul);
  const wb = mul.map((m) => m / lo);
  // Balanced camera RGB (1,1,1) is the white point; it maps to sRGB white.
  const camToXYZ = mul3(inv3(M), diag(neutral.map((n) => n * lo)));
  let toSrgb = mul3(XYZ_TO_SRGB, mul3(adapt(whiteXYZ, D65), camToXYZ));
  const w = apply3(toSrgb, [1, 1, 1]);
  toSrgb = toSrgb.map((v, k) => v / w[Math.floor(k / 3)]);
  return { wb, matrix: toSrgb };
}
