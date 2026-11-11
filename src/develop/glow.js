// Glow (Effects panel), as Lightroom 16 has it: the soft light a diffusion
// filter or film adds around bright parts of the photo. One style for the
// whole photo; masks only change how much (as in Lightroom). The settings are
// turned here into what the graphics card draws (renderer.js updateGlow,
// shaders.js GLOW_*).
import { adjOf } from './masks.js';

// [value, name], as Lightroom's Style menu has them.
export const GLOW_STYLES = [[1, 'Diffusion'], [2, 'Bloom'], [3, 'Halation'], [4, 'Motion'], [5, 'Streak']];
export const DIRECTIONAL = [4, 5]; // the styles with Direction and Softness

// Lightroom Classic's Glow presets (settings it adds on top of the photo's).
export const GLOW_PRESETS = [
  ['Sheer', { glowStyle: 1, glow: 20, glowRange: 60, glowSpread: 40, glowWarmth: 0 }],
  ['Dream', { glowStyle: 1, glow: 45, glowRange: 70, glowSpread: 65, glowWarmth: 15 }],
  ['Soft Bloom', { glowStyle: 2, glow: 30, glowRange: 40, glowSpread: 50, glowWarmth: 0 }],
  ['Strong Bloom', { glowStyle: 2, glow: 70, glowRange: 55, glowSpread: 70, glowWarmth: 10 }],
  ['Gentle Aura', { glowStyle: 2, glow: 25, glowRange: 30, glowSpread: 85, glowWarmth: 25 }],
  ['Cinematic Glow', { glowStyle: 3, glow: 50, glowRange: 35, glowSpread: 55, glowWarmth: 30 }],
];

// Per style: where the threshold sits against Range (stops), how coloured the
// glow is, how much it stands in for the photo (a soft, hazy look) and how
// much it adds on top, the finest size taken back out (a ring), and extra weight
// on the widest sizes (a long, soft tail).
const STYLE = {
  1: { thr: -1.5, knee: 1.5, sat: 1.2, replace: 0.4, add: 0.35, halo: 0, tail: 0 },   // Diffusion
  2: { thr: 0, knee: 1.0, sat: 0.6, replace: 0, add: 0.9, halo: 0, tail: 0.35 },      // Bloom
  3: { thr: 0.75, knee: 0.8, sat: 0, replace: 0, add: 1.3, halo: 0.6, tail: 0.15 },    // Halation
  4: { thr: -0.5, knee: 1.2, sat: 1, replace: 0.45, add: 0.6, halo: 0, tail: 0 },     // Motion
  5: { thr: 1.5, knee: 0.8, sat: 0.9, replace: 0, add: 1.6, halo: 0, tail: 0 },       // Streak
};
export const LEVELS = 5;
export const GLOW_EDGE = 640; // long edge of the finest size

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const toLum = (c, y = 1) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map((v) => (v * y) / l); };
/** The glow's colour for Warmth (-100..100): cool to warm; on Halation yellow to red. */
export function glowTint(style, warmth) {
  const w = Math.max(-1, Math.min(1, (warmth || 0) / 100));
  if (style === 3) return toLum(w < 0 ? lerp3([1, 0.45, 0.2], [1, 0.78, 0.3], -w) : lerp3([1, 0.45, 0.2], [1, 0.22, 0.12], w), 0.8);
  return toLum(w < 0 ? lerp3([1, 1, 1], [0.78, 0.93, 1.25], -w) : lerp3([1, 1, 1], [1.2, 0.97, 0.75], w));
}

/** How much of each size: Spread (0..100) moves the weight from fine to wide. */
export function levelWeights(spread, tail = 0) {
  const c = 0.5 + ((spread ?? 50) / 100) * 3;
  const w = Array.from({ length: LEVELS }, (_, i) => Math.exp(-((i - c) ** 2) / 2) + tail * (i / (LEVELS - 1)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}

const style = (s) => (STYLE[s.glowStyle] ? s.glowStyle : 1);
/** Whether any glow is drawn: the slider, or a mask with Glow. */
export const glowUsed = (s, masks = s.masks || []) => (s.glow || 0) > 0 || masks.some((m) => !m.hidden && adjOf(m, 'glow') > 0);

/**
 * What the graphics card needs for these settings. `exposure` in stops (the
 * slider plus the look's), `o2p` the oriented -> photo matrix (row-major), so
 * Direction follows the photo as you see it.
 */
export function glowPlan(s, exposure, o2p) {
  const st = style(s), p = STYLE[st];
  const range = (s.glowRange ?? 50) / 100;
  const directional = DIRECTIONAL.includes(st);
  let dir = null;
  if (directional) {
    // Degrees counter-clockwise from level, on the photo as shown (oriented y runs down).
    const a = ((s.glowDirection || 0) * Math.PI) / 180;
    const dx = Math.cos(a), dy = -Math.sin(a);
    dir = [o2p[0] * dx + o2p[1] * dy, o2p[3] * dx + o2p[4] * dy]; // photo units (0-1) per oriented px
  }
  const soft = (s.glowSoftness ?? 50) / 100;
  return {
    style: st,
    gain: 2 ** exposure,
    knee: [3 - 3.5 * range + p.thr, p.knee],
    sat: p.sat,
    weights: levelWeights(s.glowSpread, p.tail),
    halo: p.halo,
    tint: glowTint(st, s.glowWarmth),
    mix: [Math.max(0, (s.glow || 0) / 100), p.replace, p.add, 1],
    dir,
    // Blur per size, in its texels: along the direction and across it (round styles: both the same).
    along: directional ? (st === 5 ? 16 : 10) : 2.5,
    across: directional ? (st === 5 ? 0.5 + 2.5 * soft : 1 + 3 * soft) : 2.5,
  };
}
