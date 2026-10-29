// Retouch: Photoshop-style layers painted on top of the developed photo.
// Nothing here is pixels: every brush stroke, clone, heal and fill is kept as
// what you did (points, size, colour, source offset), and drawn again on the
// graphics card whenever the photo underneath changes. That is what keeps the
// Develop tab and the Retouch tab live: a slider moved in Develop shows
// through every layer at once, clones and heals included, with no export.
//
// Positions are fractions of the photo as you see it (rotated upright, after
// Transform, before cropping), like masks. Sizes are a brush's radius as a
// fraction of the photo's long edge.
//
// A layer: { id, name, kind, hidden, opacity, fill, blend, ops, ... }
//   kind  pixel   strokes and fills on a clear layer
//         photo   a live copy of the developed photo (Duplicate Background), strokes on top
//         stamp   everything below, merged (Stamp Visible), strokes on top
//         adjust  an adjustment layer (adj: see adjust.js)
//         fill    a Solid Color / Gradient fill layer (fillDef)
//         text    a type layer (text)
//         shape   a shape layer (shape)
//         group   a group; layers in it have `parent`
//   mask     { base: 1 reveal | 0 hide, ops, off, density, feather }
//   filters  [{ id, type, on, ... }] (filters.js), style (layer styles),
//   tf       an affine transform in long-edge units (selection.js),
//   clip     clipped to the layer below, lock { all, pixels, position, alpha }.
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { newId } from './masks.js';
import { textLayout } from './raster.js';
import { fromB64, isIdent, selectionBounds, tfApply, tfInv, tfPx, toB64 } from './selection.js';

export * from './selection.js';

export const BLEND_MODES = [
  ['normal', 'Normal'], ['dissolve', 'Dissolve'],
  ['darken', 'Darken'], ['multiply', 'Multiply'], ['colorBurn', 'Color Burn'], ['linearBurn', 'Linear Burn'], ['darkerColor', 'Darker Color'],
  ['lighten', 'Lighten'], ['screen', 'Screen'], ['colorDodge', 'Color Dodge'], ['linearDodge', 'Linear Dodge (Add)'], ['lighterColor', 'Lighter Color'],
  ['overlay', 'Overlay'], ['soft', 'Soft Light'], ['hardLight', 'Hard Light'], ['vividLight', 'Vivid Light'], ['linearLight', 'Linear Light'], ['pinLight', 'Pin Light'], ['hardMix', 'Hard Mix'],
  ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['subtract', 'Subtract'], ['divide', 'Divide'],
  ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
];
// Where Photoshop draws a line between them in its menu.
export const BLEND_BREAKS = new Set(['dissolve', 'darkerColor', 'lighterColor', 'hardMix', 'divide']);
export const BLEND_INDEX = Object.fromEntries(BLEND_MODES.map(([k], i) => [k, i]));

// Ops that take their pixels from the photo itself (at an offset).
export const SOURCED = new Set(['clone', 'heal', 'patch']);
// Ops drawn with a brush.
export const STROKED = new Set(['paint', 'erase', 'clone', 'heal', 'dodge', 'burn', 'sponge', 'blur', 'sharpen', 'smudge']);
// Ops that work on what's already there (the layer over everything below).
export const SNAPSHOT = new Set(['dodge', 'burn', 'sponge', 'blur', 'sharpen', 'smudge', 'redeye']);
// Ops whose area is their selection rather than a brush.
export const REGION = new Set(['patch', 'redeye']);

export const kindOf = (l) => l.kind || 'pixel';
// Layers you can paint on directly (others are painted through their mask).
export const PAINTABLE = new Set(['pixel', 'photo', 'stamp']);

/** "Name n" with the next free n among the layers. */
export function nextName(layers, base) {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} (\\d+)$`);
  return `${base} ${1 + Math.max(0, ...layers.map((l) => Number(re.exec(l.name)?.[1]) || 0))}`;
}

export function newLayer(layers, name, kind = 'pixel', extra = {}) {
  return { id: newId(), name: name || nextName(layers, 'Layer'), kind, hidden: false, opacity: 100, fill: 100, blend: kind === 'group' ? 'pass' : 'normal', ops: [], ...extra };
}

const hasContent = (l) => kindOf(l) !== 'pixel' || l.ops.length > 0 || (l.filters || []).some((f) => f.on && f.type === 'clouds');

/**
 * The layers to draw, bottom first: hidden ones and those in hidden groups
 * left out, a group's opacity passed on to what's in it, clipped layers only
 * while the layer they're clipped to shows. `liveId`: a layer being painted
 * on, drawn even while it's empty.
 */
export function renderLayers(layers, liveId) {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const out = [];
  let base = false; // the layer below a clipped one is drawn
  for (const l of layers) {
    if (l.kind === 'group') continue;
    let hidden = l.hidden, k = 1;
    for (let p = byId.get(l.parent), n = 0; p && n < 32; p = byId.get(p.parent), n++) { if (p.hidden) hidden = true; k *= p.opacity / 100; }
    const shown = !hidden && l.opacity * k > 0 && (hasContent(l) || l.id === liveId);
    if (!l.clip) base = shown;
    else if (!base) continue;
    if (!shown) continue;
    out.push(k === 1 ? l : { ...l, opacity: l.opacity * k });
  }
  return out;
}

export const visibleLayers = (s, liveId) => renderLayers(s?.layers || [], liveId);

/** Layers in a group (any depth). */
export function inGroup(layers, groupId) {
  const ids = new Set([groupId]);
  let grew = true;
  while (grew) { grew = false; for (const l of layers) if (l.parent && ids.has(l.parent) && !ids.has(l.id)) { ids.add(l.id); grew = true; } }
  ids.delete(groupId);
  return layers.filter((l) => ids.has(l.id));
}

// --- brushes ---------------------------------------------------------------------

/**
 * A stroke's dabs in oriented pixels: x, y, radius, then the direction the
 * stroke moves there (radians, for the smudge tool), per dab. Spaced a
 * quarter of the brush's width apart, like Photoshop's default.
 */
export function strokeDabs(op, ow, oh) {
  const r = Math.max(0.5, op.size * Math.max(ow, oh));
  const step = Math.max(0.75, r * 0.5);
  const out = [];
  const pts = op.pts;
  const ang = (i) => (pts[i] && pts[i - 1] ? Math.atan2((pts[i][1] - pts[i - 1][1]) * oh, (pts[i][0] - pts[i - 1][0]) * ow) : 0);
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] * ow, y = pts[i][1] * oh;
    if (i === 0) { out.push(x, y, r, ang(1)); continue; }
    const px = pts[i - 1][0] * ow, py = pts[i - 1][1] * oh;
    const n = Math.max(1, Math.round(Math.hypot(x - px, y - py) / step));
    const a = ang(i);
    for (let k = 1; k <= n; k++) out.push(px + ((x - px) * k) / n, py + ((y - py) * k) / n, r, a);
  }
  return new Float32Array(out);
}

/** Where an op draws, in oriented pixels: [x0, y0, x1, y1]; null for the whole photo. */
export function opBounds(op, ow, oh) {
  if (!STROKED.has(op.t)) {
    const b = op.clip && selectionBounds(op.clip, ow, oh);
    if (!b) return null;
    const pad = op.t === 'patch' ? 0.02 * Math.max(ow, oh) : 1;
    return [b[0] * ow - pad, b[1] * oh - pad, b[2] * ow + pad, b[3] * oh + pad];
  }
  const r = Math.max(0.5, op.size * Math.max(ow, oh)) + 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of op.pts) {
    x0 = Math.min(x0, x * ow); x1 = Math.max(x1, x * ow);
    y0 = Math.min(y0, y * oh); y1 = Math.max(y1, y * oh);
  }
  return [x0 - r, y0 - r, x1 + r, y1 + r];
}

/** Text and shape layers: where they draw (oriented px, before the layer's transform). */
export function rasterBounds(l, ow, oh) {
  if (l.kind === 'shape' && l.shape) {
    const sh = l.shape;
    const pad = (sh.stroke ? sh.stroke.width * Math.max(ow, oh) : 0) + 2;
    return [Math.min(sh.x0, sh.x1) * ow - pad, Math.min(sh.y0, sh.y1) * oh - pad, Math.max(sh.x0, sh.x1) * ow + pad, Math.max(sh.y0, sh.y1) * oh + pad];
  }
  if (l.kind === 'text' && l.text) {
    const b = textLayout(l.text, ow, oh).box;
    return [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
  }
  return null;
}

/** A layer's content box in oriented px as shown (after its transform); null for the whole photo. */
export function layerBounds(l, ow, oh) {
  const kind = kindOf(l);
  if (['photo', 'stamp', 'adjust', 'fill'].includes(kind)) return null;
  let b = rasterBounds(l, ow, oh);
  for (const op of l.ops) {
    const ob = opBounds(op, ow, oh);
    if (!ob) return null;
    b = b ? [Math.min(b[0], ob[0]), Math.min(b[1], ob[1]), Math.max(b[2], ob[2]), Math.max(b[3], ob[3])] : ob;
  }
  if (!b) return null;
  if (l.tf && !isIdent(l.tf)) {
    const m = tfPx(l.tf, ow, oh);
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => tfApply(m, x, y));
    b = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  }
  return b;
}

/** A point on the photo (fractions) in a layer's own coordinates (before its transform). */
export function toLayer(l, x, y, ow, oh) {
  if (!l?.tf || isIdent(l.tf)) return [x, y];
  const [lx, ly] = tfApply(tfInv(tfPx(l.tf, ow, oh)), x * ow, y * oh);
  return [lx / ow, ly / oh];
}

// --- spot healing ----------------------------------------------------------------

/**
 * Picks where a spot heal copies from: the nearby patch whose surroundings
 * best match the spot's own surroundings. img: RGBA bytes of the upright,
 * uncropped photo (bottom row first), w x h. Returns the offset as fractions.
 */
export function findSpotSource(op, img, w, h) {
  const [bx0, by0, bx1, by1] = opBounds({ ...op, t: 'heal' }, w, h);
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const rad = Math.max(2, Math.max(bx1 - bx0, by1 - by0) / 2);
  const px = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return null;
    const i = ((h - 1 - yi) * w + xi) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  // Samples on a ring just outside the spot, and across it.
  const ring = [], inner = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    ring.push([Math.cos(a) * rad * 1.3, Math.sin(a) * rad * 1.3]);
    if (k % 2 === 0) inner.push([Math.cos(a) * rad * 0.6, Math.sin(a) * rad * 0.6]);
  }
  const ringAt = ring.map(([dx, dy]) => px(cx + dx, cy + dy));
  let best = null;
  for (const dist of [2.2, 3, 4.2]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ox = Math.cos(a) * rad * dist, oy = Math.sin(a) * rad * dist;
      let score = 0, n = 0, bad = false;
      ring.forEach(([dx, dy], i) => {
        const d = ringAt[i], s = px(cx + ox + dx, cy + oy + dy);
        if (!s) { bad = true; return; }
        if (!d) return;
        score += (d[0] - s[0]) ** 2 + (d[1] - s[1]) ** 2 + (d[2] - s[2]) ** 2;
        n++;
      });
      if (bad || !n) continue;
      // A source that is itself busy (another blemish, an edge) is less wanted.
      const vals = inner.map(([dx, dy]) => px(cx + ox + dx, cy + oy + dy)).filter(Boolean);
      const mean = vals.reduce((m, v) => m + v[0] + v[1] + v[2], 0) / (vals.length * 3 || 1);
      const busy = vals.reduce((m, v) => m + ((v[0] + v[1] + v[2]) / 3 - mean) ** 2, 0) / (vals.length || 1);
      score = score / n + busy * 0.5 + dist * 20;
      if (!best || score < best.score) best = { score, ox, oy };
    }
  }
  if (!best) return { dx: (rad * 2.5) / w, dy: 0 };
  return { dx: best.ox / w, dy: best.oy / h };
}

// --- the sidecar -----------------------------------------------------------------

const r5 = (v) => Math.round(v * 1e5) / 1e5;

/**
 * Layers as Flightroom's own fr:Layers value: JSON, deflated and base64'd
 * ("z:" first). A selection several strokes were clipped to is kept once.
 */
export function layersToText(layers) {
  if (!layers?.length) return '';
  const clips = [];
  const clipId = (c) => { let i = clips.indexOf(c); if (i < 0) { clips.push(c); i = clips.length - 1; } return i; };
  const ops = (list) => list.map((op) => ({
    ...op,
    ...(op.pts ? { pts: op.pts.flatMap(([x, y]) => [r5(x), r5(y)]) } : {}),
    ...(op.clip ? { clip: clipId(op.clip) } : {}),
  }));
  const out = layers.map((l) => ({
    ...l,
    ops: ops(l.ops),
    ...(l.mask ? { mask: { ...l.mask, ops: ops(l.mask.ops) } } : {}),
    ...(l.filters ? { filters: l.filters.map((f) => (f.clip ? { ...f, clip: clipId(f.clip) } : f)) } : {}),
  }));
  return `z:${toB64(deflateSync(strToU8(JSON.stringify({ v: 2, layers: out, clips })), { level: 6 }))}`;
}

export function layersFromText(text) {
  if (!text) return [];
  try {
    const json = text.startsWith('z:') ? strFromU8(inflateSync(fromB64(text.slice(2)))) : text;
    const { layers, clips = [] } = JSON.parse(json);
    if (!Array.isArray(layers)) return [];
    const ops = (list) => (Array.isArray(list) ? list : []).map((op) => {
      const o = { ...op };
      if (Array.isArray(op.pts)) { o.pts = []; for (let i = 0; i + 1 < op.pts.length; i += 2) o.pts.push([op.pts[i], op.pts[i + 1]]); }
      if (op.clip != null) o.clip = clips[op.clip] || undefined;
      return o;
    });
    return layers.filter((l) => l && Array.isArray(l.ops)).map((l) => ({
      ...l,
      ops: ops(l.ops),
      ...(l.mask ? { mask: { ...l.mask, ops: ops(l.mask.ops) } } : {}),
      ...(Array.isArray(l.filters) ? { filters: l.filters.map((f) => (f.clip != null ? { ...f, clip: clips[f.clip] || undefined } : f)) } : {}),
    }));
  } catch { return []; }
}

/**
 * The parts of the photo (sensor px) that clones and heals inside `box`
 * (oriented px) copy from, so they can be fetched sharp when zoomed in or
 * exporting. toSource maps oriented px to photo coordinates (0-1).
 */
export function sourceRegions(layers, geo, toSource, box, scale, max = 16) {
  const out = [];
  for (const l of layers) {
    // The visible box in the layer's own coordinates.
    let lbox = box;
    if (l.tf && !isIdent(l.tf)) {
      const inv = tfInv(tfPx(l.tf, geo.ow, geo.oh));
      const pts = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].map(([x, y]) => tfApply(inv, x, y));
      lbox = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    }
    for (const op of l.ops) {
      if (!SOURCED.has(op.t) || out.length >= max) continue;
      const b = opBounds(op, geo.ow, geo.oh);
      if (!b) continue;
      const pad = (op.size || 0.02) * Math.max(geo.ow, geo.oh) * 0.6 + 4;
      const x0 = Math.max(b[0] - pad, lbox[0]), y0 = Math.max(b[1] - pad, lbox[1]);
      const x1 = Math.min(b[2] + pad, lbox[2]), y1 = Math.min(b[3] + pad, lbox[3]);
      if (x1 <= x0 || y1 <= y0) continue;
      const dx = op.dx * geo.ow, dy = op.dy * geo.oh;
      const pts = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        for (const [x, y] of [[x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]]) pts.push(toSource(x + dx, y + dy));
      }
      const xs = pts.map((p) => p[0] * geo.sw), ys = pts.map((p) => p[1] * geo.sh);
      const sx0 = Math.max(0, Math.floor(Math.min(...xs) - 16)), sx1 = Math.min(geo.sw, Math.ceil(Math.max(...xs) + 16));
      const sy0 = Math.max(0, Math.floor(Math.min(...ys) - 16)), sy1 = Math.min(geo.sh, Math.ceil(Math.max(...ys) + 16));
      if (sx1 - sx0 < 2 || sy1 - sy0 < 2) continue;
      const k = Math.min(1, scale * 1.1);
      out.push({ id: op.id, x: sx0, y: sy0, w: sx1 - sx0, h: sy1 - sy0, ow: Math.max(1, Math.round((sx1 - sx0) * k)), oh: Math.max(1, Math.round((sy1 - sy0) * k)) });
    }
  }
  return out;
}
