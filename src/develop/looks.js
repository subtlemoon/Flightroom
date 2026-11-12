// Looks: 3D LUTs applied to the finished colours in Develop (Basic › Look, with
// an Amount). Built-in film looks are made here; your own .cube files are
// copied into Flightroom's looks folder and named "user:<file>" in the sidecar
// (fr:Look), so a photo keeps its look as long as that file is in the folder.
import { bridge } from '../bridge.js';
import { readCube } from './adjust.js';

export const HUE_ROWS = 764; // row 0: the colour mixer; rows 1+: the look (up to 65³ colours, 360 a row)
export const LOOK_W = 360;
const BUILT_N = 33;

const clamp = (v) => Math.min(1, Math.max(0, v));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sat = ([r, g, b], k) => { const y = luma(r, g, b); return [y + (r - y) * k, y + (g - y) * k, y + (b - y) * k]; };
// A soft S around the middle: k > 0 adds contrast.
const scurve = (x, k) => { const t = clamp(x); const s = t * t * (3 - 2 * t); return t + (s - t) * k; };
const range = (x, lo, hi) => lo + x * (hi - lo);
// Adds a tint to the shadows and another to the highlights.
const split = ([r, g, b], sh, hi) => {
  const y = clamp(luma(r, g, b));
  const ws = (1 - y) ** 2, wh = y * y;
  return [r + sh[0] * ws + hi[0] * wh, g + sh[1] * ws + hi[1] * wh, b + sh[2] * ws + hi[2] * wh];
};
const mono = ([r, g, b], [wr, wg, wb] = [0.3, 0.6, 0.1]) => { const y = r * wr + g * wg + b * wb; return [y, y, y]; };
const each = (c, f) => c.map(f);

/** The built-in looks: [id, name, group, colour -> colour] on display (sRGB) values 0-1. */
export const BUILTIN_LOOKS = [
  ['fr:soft-fade', 'Soft Fade', 'Color', (c) => each(sat(c, 0.85), (v) => range(scurve(v, 0.1), 0.06, 0.95))],
  ['fr:warm-film', 'Warm Film', 'Color', (c) => {
    let d = each(c, (v) => range(scurve(v, 0.25), 0.03, 0.98));
    d = split(d, [0.0, 0.005, 0.02], [0.035, 0.01, -0.03]);
    return sat(d, 0.9);
  }],
  ['fr:cool-film', 'Cool Film', 'Color', (c) => {
    let d = each(c, (v) => range(scurve(v, 0.2), 0.025, 0.98));
    d = split(d, [-0.02, 0.005, 0.035], [0.005, 0.005, -0.005]);
    return sat(d, 0.88);
  }],
  ['fr:teal-orange', 'Teal & Orange', 'Color', (c) => {
    let d = each(c, (v) => scurve(v, 0.2));
    d = split(d, [-0.035, 0.015, 0.04], [0.04, 0.012, -0.04]);
    return sat(d, 1.1);
  }],
  ['fr:golden', 'Golden Hour', 'Color', (c) => {
    let d = c.map((v) => v ** 0.94);
    d = [d[0] * 1.04 + 0.01, d[1] * 1.01, d[2] * 0.9];
    return sat(each(d, (v) => scurve(v, 0.12)), 1.05);
  }],
  ['fr:punch', 'Punchy', 'Color', (c) => sat(each(c, (v) => scurve(v, 0.35)), 1.2)],
  ['fr:bleach', 'Bleach Bypass', 'Color', (c) => {
    const y = luma(...c);
    const d = c.map((v) => { const m = mix(v, y, 0.55); return m < 0.5 ? 2 * m * y : 1 - 2 * (1 - m) * (1 - y); });
    return each(d, (v) => scurve(v, 0.15));
  }],
  ['fr:mono-classic', 'Classic Mono', 'B&W', (c) => {
    const [y] = mono(c);
    const v = scurve(y, 0.35);
    return [v * 1.015 + 0.004, v, v * 0.97];
  }],
  ['fr:mono-matte', 'Matte Mono', 'B&W', (c) => { const [y] = mono(c, [0.25, 0.65, 0.1]); const v = range(scurve(y, 0.15), 0.08, 0.94); return [v, v, v]; }],
];
function mix(a, b, t) { return a + (b - a) * t; }

const cache = new Map(); // id -> { name, n, values } | null (missing)
const loading = new Map();

function makeBuiltin(fn, n = BUILT_N) {
  const values = new Float32Array(n * n * n * 3);
  let i = 0;
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const out = fn([r / (n - 1), g / (n - 1), b / (n - 1)]);
    values[i++] = clamp(out[0]); values[i++] = clamp(out[1]); values[i++] = clamp(out[2]);
  }
  return values;
}

export const lookName = (id) => (!id ? 'None' : BUILTIN_LOOKS.find(([k]) => k === id)?.[1] || id.replace(/^user:/, '').replace(/\.cube$/i, ''));

/** A loaded look's table, or null (not loaded yet, missing, or no look). */
export function lookTable(id) {
  if (!id) return null;
  if (!cache.has(id)) {
    const b = BUILTIN_LOOKS.find(([k]) => k === id);
    if (b) cache.set(id, { name: b[1], n: BUILT_N, values: makeBuiltin(b[3]) });
  }
  return cache.get(id) || null;
}

/** Loads a look (a promise of its table, or null when the file is gone). */
export function loadLook(id) {
  if (!id) return Promise.resolve(null);
  const have = lookTable(id);
  if (have || cache.has(id)) return Promise.resolve(have);
  if (!loading.has(id)) {
    const file = id.replace(/^user:/, '');
    const p = (bridge?.looks ? bridge.looks.read(file) : Promise.reject(new Error('no app')))
      .then((text) => { const t = readCube(text, file); cache.set(id, t); return t; })
      .catch((err) => { console.warn(`[looks] ${file}: ${err.message || err}`); cache.set(id, null); return null; })
      .finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return loading.get(id);
}

/** Whether a look is waiting to load (it shows once it has). */
export const lookPending = (id) => !!id && !cache.has(id) && !BUILTIN_LOOKS.some(([k]) => k === id);

/** Your own looks in the looks folder: [{ id, name }]. */
export async function userLooks() {
  if (!bridge?.looks) return [];
  try { return (await bridge.looks.list()).map((f) => ({ id: `user:${f}`, name: lookName(`user:${f}`) })); } catch { return []; }
}

/** Adds a .cube file (a File from a file input) to the looks folder: its id. Throws when it isn't a usable LUT. */
export async function importLook(file) {
  const text = await file.text();
  const t = readCube(text, file.name); // checked before it is kept
  const saved = await bridge.looks.save(file.name.replace(/[\\/:*?"<>|]/g, '_'), text);
  const id = `user:${saved}`;
  cache.set(id, t);
  return id;
}

export async function removeLook(id) {
  await bridge.looks.remove(id.replace(/^user:/, ''));
  cache.delete(id);
}

/** The look as rows of the mixer's texture (RGBA, from row 1): { rows, data }. */
export function packLook(t) {
  const count = t.n * t.n * t.n;
  const rows = Math.ceil(count / LOOK_W);
  const data = new Float32Array(LOOK_W * rows * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = t.values[i * 3]; data[i * 4 + 1] = t.values[i * 3 + 1]; data[i * 4 + 2] = t.values[i * 3 + 2]; data[i * 4 + 3] = 1;
  }
  return { rows, data };
}

/**
 * The colour a look gives `c` (display values 0-1), as the shader works it out
 * (tetrahedral interpolation between the table's colours). For tests.
 */
export function applyLook(t, c) {
  const n = t.n, n1 = n - 1;
  const p = c.map((v) => clamp(v) * n1);
  const b = p.map((v) => Math.min(Math.floor(v), n1 - 1));
  const f = p.map((v, i) => v - b[i]);
  const at = (dx, dy, dz) => { const i = (b[0] + dx) + (b[1] + dy) * n + (b[2] + dz) * n * n; return [t.values[i * 3], t.values[i * 3 + 1], t.values[i * 3 + 2]]; };
  const [x, y, z] = f;
  const c0 = at(0, 0, 0), c1 = at(1, 1, 1);
  let w; // [weight, corner] pairs
  if (x > y) {
    if (y > z) w = [[1 - x, c0], [x - y, at(1, 0, 0)], [y - z, at(1, 1, 0)], [z, c1]];
    else if (x > z) w = [[1 - x, c0], [x - z, at(1, 0, 0)], [z - y, at(1, 0, 1)], [y, c1]];
    else w = [[1 - z, c0], [z - x, at(0, 0, 1)], [x - y, at(1, 0, 1)], [y, c1]];
  } else if (z > y) w = [[1 - z, c0], [z - y, at(0, 0, 1)], [y - x, at(0, 1, 1)], [x, c1]];
  else if (z > x) w = [[1 - y, c0], [y - z, at(0, 1, 0)], [z - x, at(0, 1, 1)], [x, c1]];
  else w = [[1 - y, c0], [y - x, at(0, 1, 0)], [x - z, at(1, 1, 0)], [z, c1]];
  return [0, 1, 2].map((k) => w.reduce((s, [wt, cc]) => s + wt * cc[k], 0));
}
