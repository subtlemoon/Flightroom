// Glow (Effects panel), as Lightroom 16 has it. One style for the whole
// photo; masks only change how much (as in Lightroom). The settings are
// turned here into what the graphics card draws (renderer.js updateGlow,
// shaders.js GLOW_*).
//
// Fitted to Lightroom Classic 16's own exports of a test chart (bright
// squares, dots, lights, a line and a white block on black), one setting
// changed per export (tools/glow-fit.md). Sizes are fractions of the photo's
// long edge, so a glow looks the same at any resolution:
// - Bloom: each pixel's light weighted by how close to white it is,
//   K (eY / (1 + e - Y))^n (Range moves e, n and K), blurred (Spread: the
//   size), and very faint glow faded out (small, dim lights don't glow).
// - Halation: only areas brighter than a threshold (after a slight blur, so
//   thin lines and tiny dots don't count) give a tight glow, red where weak,
//   orange to white where strong.
// - Motion / Streak: the Bloom weight, smeared along Direction (Lightroom's
//   +45 points down-right): Motion trails one way, Streak both; Softness
//   widens the streak across.
// - Diffusion: inside bright areas only, the photo is mixed toward a blurred
//   copy and lifted: soft, dreamy highlights with nothing spilling outside.
import { adjOf } from './masks.js';

// [value, name], in Lightroom's Style menu order (values are what's saved).
export const GLOW_STYLES = [[2, 'Bloom'], [1, 'Diffusion'], [3, 'Halation'], [4, 'Motion'], [5, 'Streak']];
export const DIRECTIONAL = [4, 5]; // the styles Direction and Softness act on
export const DEFAULT_STYLE = 2;

// Lightroom Classic's Glow presets. Their names are Lightroom's; the values
// are estimates (Lightroom's own aren't published).
export const GLOW_PRESETS = [
  ['Sheer', { glowStyle: 1, glow: 30, glowRange: 60, glowSpread: 40, glowWarmth: 0 }],
  ['Dream', { glowStyle: 1, glow: 70, glowRange: 70, glowSpread: 65, glowWarmth: 15 }],
  ['Soft Bloom', { glowStyle: 2, glow: 25, glowRange: 40, glowSpread: 50, glowWarmth: 0 }],
  ['Strong Bloom', { glowStyle: 2, glow: 60, glowRange: 55, glowSpread: 70, glowWarmth: 10 }],
  ['Gentle Aura', { glowStyle: 2, glow: 20, glowRange: 30, glowSpread: 85, glowWarmth: 25 }],
  ['Cinematic Glow', { glowStyle: 3, glow: 50, glowRange: 35, glowSpread: 55, glowWarmth: 30 }],
];

export const GLOW_EDGE = 1024; // long edge of the finest size the glow is worked out at
export const LEVELS = 7;       // halvings from there (1024 .. 16 px)

// Values at Range (or Spread) 0, 50 and 100 -> the value at t (0..1), on a log scale.
const logLerp3 = ([a, b, c], t) => {
  const [la, lb, lc] = [a, b, c].map(Math.log);
  const v = la * 2 * (t - 0.5) * (t - 1) - lb * 4 * t * (t - 1) + lc * 2 * t * (t - 0.5);
  return Math.exp(v);
};
// Bloom's weight per Range (0, 50, 100): e, n, and K (its strength on white).
const RANGE_E = [0.0742, 0.02305, 0.0005], RANGE_N = [4.24, 1.043, 0.3445], RANGE_K = [6.157, 11.48, 12.64];
// Bloom's blur per Spread (0, 50, 100), as a fraction of the long edge, and the strength that goes with it.
const SPREAD_SIGMA = [0.006235, 0.01606, 0.1118], SPREAD_GAIN = [0.791, 1, 1.032];
// Faint glow fades out below about this brightness (linear), with this steepness.
const GATE = [0.031, 1.105];
// Warmth +100 / -100 multiply Bloom's (and Motion's, Streak's) colour by these.
const WARM = [2.018, 1.037, 0.516], COOL = [0.421, 0.942, 1.408];

const STYLE = {
  2: { e: 0.02305, n: 1.043, k: 11.48, pre: 0.000836 },                       // Bloom (Range 50)
  4: { e: 0.00437, n: 0.5526, k: 11.53, pre: 0.00029, len: 0.0685, one: 1 },  // Motion: trail length (exponential) to one side
  5: { e: 0.03201, n: 0.8234, k: 19.87, pre: 0.00029, len: 0.08125, one: 0 }, // Streak: both sides
};
// Each style's weight or threshold is taken on a slightly blurred photo
// (pre, as a fraction of the long edge), so fine lines and specks glow less.
// Halation at Range 50 / Spread 50: threshold, steepness, pre-blur, the two
// blur sizes and how much of the wider one, strength.
const HAL = { t: 0.5204, p: 10, pre: 0.000758, s1: 0.0005, s2: 0.00662, w2: 0.7619, a: 27.28 };
// Halation colour per Warmth (-100, 0, +100): green and blue shares, and what
// spills into them once the glow passes h (strong glow goes orange to white).
const HAL_COL = { cool: [0.2187, 0, 0, 0.084, 0.8608], mid: [0.1268, 0.0078, 0.0004, 0.0844, 0.7081], warm: [0, 0.0356, 0.0965, 0.06, 1.0083] };
// Diffusion at Range 50 / Spread 50: blur size, how far toward it, the lift, and the brightness it starts and is full at.
const DIF = { s: 0.004266, a: 0.5342, b: 0.46, t0: 0.3303, t1: 0.6109 };
// Streak / Motion width across (Softness 0, 50, 100), fraction of the long edge.
const SOFT_SIGMA = [0.000691, 0.00177, 0.003381];

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const styleOf = (s) => ([1, 2, 3, 4, 5].includes(s.glowStyle) ? s.glowStyle : DEFAULT_STYLE);

/** The glow's colour multipliers for Warmth (-100..100), for Bloom, Motion and Streak. */
export function glowTint(warmth) {
  const w = Math.max(-1, Math.min(1, (warmth || 0) / 100));
  return w >= 0 ? lerp([1, 1, 1], WARM, w) : lerp([1, 1, 1], COOL, -w);
}
/** Halation's colour ramp for Warmth: [green, blue, green spill, blue spill, spill start]. */
export function halationColor(warmth) {
  const w = Math.max(-1, Math.min(1, (warmth || 0) / 100));
  return w >= 0 ? lerp(HAL_COL.mid, HAL_COL.warm, w) : lerp(HAL_COL.mid, HAL_COL.cool, -w);
}

/** Whether any glow is drawn: the slider, or a mask with Glow. */
export const glowUsed = (s, masks = s.masks || []) => (s.glow || 0) > 0 || masks.some((m) => !m.hidden && adjOf(m, 'glow') > 0);

/**
 * What the graphics card needs for these settings. `exposure` in stops (the
 * slider plus the look's), `o2p` the oriented -> photo matrix (row-major), so
 * Direction follows the photo as you see it.
 */
export function glowPlan(s, exposure, o2p) {
  const st = styleOf(s);
  const range = clamp01((s.glowRange ?? 50) / 100), spread = clamp01((s.glowSpread ?? 50) / 100);
  // Range and Spread act on every style as they do on Bloom (only Bloom's were measured on their own).
  const rE = logLerp3(RANGE_E, range) / RANGE_E[1], rN = logLerp3(RANGE_N, range) / RANGE_N[1], rK = logLerp3(RANGE_K, range) / RANGE_K[1];
  const size = logLerp3(SPREAD_SIGMA, spread) / SPREAD_SIGMA[1], gain = logLerp3(SPREAD_GAIN, spread);
  // Where a threshold style starts, moved as Range moves Bloom's: about where Bloom's weight reaches the same share.
  const shift = (range - 0.5) * 0.5;
  const plan = { style: st, gain: 2 ** exposure, amount: Math.max(0, (s.glow || 0) / 100) };
  if (st === 3) {
    const [g, b, cg, cb, h] = halationColor(s.glowWarmth);
    return { ...plan, mode: 1, w: [Math.max(0.02, Math.min(0.97, HAL.t - shift)), HAL.p, 0, 0], pre: HAL.pre,
      blur: [HAL.s1 * size, HAL.s2 * size], mix: [1 - HAL.w2, HAL.w2], tint: [1, 1, 1],
      final: [HAL.a * gain, g, b, 0], final2: [cg, cb, h, 0] };
  }
  if (st === 1) {
    return { ...plan, mode: 2, w: [0, 0, 0, 0], pre: 0, blur: [DIF.s * size, 0], mix: [1, 0], tint: glowTint(s.glowWarmth),
      final: [DIF.a, DIF.b, Math.max(0, DIF.t0 - shift), Math.max(0.05, DIF.t1 - shift)], final2: [0, 0, 0, 0] };
  }
  const p = STYLE[st];
  const out = { ...plan, mode: 0, w: [p.e * rE, p.n * rN, p.k * rK * gain, 0], pre: p.pre, tint: glowTint(s.glowWarmth), final: [GATE[0], GATE[1], 0, 0], final2: [0, 0, 0, 0] };
  if (!DIRECTIONAL.includes(st)) return { ...out, blur: [SPREAD_SIGMA[1] * size, 0], mix: [1, 0] };
  // Degrees clockwise from level on the photo as shown (oriented y runs down), as Lightroom's Direction.
  const a = ((s.glowDirection || 0) * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const dir = [o2p[0] * dx + o2p[1] * dy, o2p[3] * dx + o2p[4] * dy]; // photo units (0-1) per oriented px
  const soft = clamp01((s.glowSoftness ?? 50) / 100);
  return { ...out, dir, len: p.len * size, one: p.one, across: logLerp3(SOFT_SIGMA, soft), blur: [0, 0], mix: [1, 0] };
}
