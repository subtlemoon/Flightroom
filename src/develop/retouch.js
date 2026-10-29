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
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { newId } from './masks.js';

export const BLEND_MODES = [
  ['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'],
  ['soft', 'Soft Light'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['difference', 'Difference'],
  ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
];
export const BLEND_INDEX = Object.fromEntries(BLEND_MODES.map(([k], i) => [k, i]));

// Ops that take their pixels from the photo itself (at an offset).
export const SOURCED = new Set(['clone', 'heal']);
// Ops drawn with a brush.
export const STROKED = new Set(['paint', 'erase', 'clone', 'heal']);

export function newLayer(layers, name) {
  const n = 1 + Math.max(0, ...layers.map((l) => Number(/^Layer (\d+)$/.exec(l.name)?.[1]) || 0));
  return { id: newId(), name: name || `Layer ${n}`, hidden: false, opacity: 100, blend: 'normal', ops: [] };
}

export const visibleLayers = (s) => (s?.layers || []).filter((l) => !l.hidden && l.opacity > 0 && l.ops.length);

// --- brushes ---------------------------------------------------------------------

/**
 * A stroke's dabs in oriented pixels: x, y, radius, then a spare slot, per dab.
 * Spaced a quarter of the brush's width apart, like Photoshop's default.
 */
export function strokeDabs(op, ow, oh) {
  const r = Math.max(0.5, op.size * Math.max(ow, oh));
  const step = Math.max(0.75, r * 0.5);
  const out = [];
  const pts = op.pts;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] * ow, y = pts[i][1] * oh;
    if (i === 0) { out.push(x, y, r, 0); continue; }
    const px = pts[i - 1][0] * ow, py = pts[i - 1][1] * oh;
    const n = Math.max(1, Math.round(Math.hypot(x - px, y - py) / step));
    for (let k = 1; k <= n; k++) out.push(px + ((x - px) * k) / n, py + ((y - py) * k) / n, r, 0);
  }
  return new Float32Array(out);
}

/** Where an op draws, in oriented pixels: [x0, y0, x1, y1]; null for the whole photo. */
export function opBounds(op, ow, oh) {
  if (!STROKED.has(op.t)) {
    const b = op.clip && selectionBounds(op.clip);
    return b ? [b[0] * ow, b[1] * oh, b[2] * ow, b[3] * oh] : null;
  }
  const r = Math.max(0.5, op.size * Math.max(ow, oh)) + 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of op.pts) {
    x0 = Math.min(x0, x * ow); x1 = Math.max(x1, x * ow);
    y0 = Math.min(y0, y * oh); y1 = Math.max(y1, y * oh);
  }
  return [x0 - r, y0 - r, x1 + r, y1 + r];
}

// --- selections ------------------------------------------------------------------
// A selection is shapes added to, taken from or intersected with each other
// (Shift / Alt as in Photoshop), optionally inverted and feathered.
// { shapes: [{ mode: 'add'|'sub'|'and', kind: 'rect'|'ellipse'|'poly', x0, y0, x1, y1 | pts }], invert, feather }

export function selectionBounds(sel) {
  if (sel.invert) return null;
  let b = null;
  for (const sh of sel.shapes) {
    const xs = sh.kind === 'poly' ? sh.pts.map((p) => p[0]) : [sh.x0, sh.x1];
    const ys = sh.kind === 'poly' ? sh.pts.map((p) => p[1]) : [sh.y0, sh.y1];
    const s = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (sh.mode === 'add' || !b) b = b ? [Math.min(b[0], s[0]), Math.min(b[1], s[1]), Math.max(b[2], s[2]), Math.max(b[3], s[3])] : s;
    else if (sh.mode === 'and') b = [Math.max(b[0], s[0]), Math.max(b[1], s[1]), Math.min(b[2], s[2]), Math.min(b[3], s[3])];
  }
  if (!b) return null;
  const f = (sel.feather || 0) * 2;
  return [b[0] - f, b[1] - f, b[2] + f, b[3] + f];
}

export function traceShape(ctx, sh, W, H) {
  ctx.beginPath();
  if (sh.kind === 'rect') ctx.rect(Math.min(sh.x0, sh.x1) * W, Math.min(sh.y0, sh.y1) * H, Math.abs(sh.x1 - sh.x0) * W, Math.abs(sh.y1 - sh.y0) * H);
  else if (sh.kind === 'ellipse') {
    ctx.ellipse(((sh.x0 + sh.x1) / 2) * W, ((sh.y0 + sh.y1) / 2) * H, (Math.abs(sh.x1 - sh.x0) / 2) * W, (Math.abs(sh.y1 - sh.y0) / 2) * H, 0, 0, Math.PI * 2);
  } else sh.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
  ctx.closePath();
}

const canvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

/** A selection drawn as a W x H canvas: covered parts opaque. */
export function selectionCanvas(sel, W, H) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  sel.shapes.forEach((sh, i) => {
    ctx.globalCompositeOperation = i === 0 || sh.mode === 'add' ? 'source-over' : sh.mode === 'sub' ? 'destination-out' : 'destination-in';
    ctx.fillStyle = '#fff';
    traceShape(ctx, sh, W, H);
    ctx.fill();
  });
  if (sel.invert) {
    ctx.globalCompositeOperation = 'xor';
    ctx.fillRect(0, 0, W, H);
  }
  const blur = (sel.feather || 0) * Math.max(W, H);
  if (blur < 0.3) return c;
  const out = canvas(W, H);
  const o = out.getContext('2d');
  o.filter = `blur(${blur / 2}px)`;
  o.drawImage(c, 0, 0);
  return out;
}

/** Whether a point (fractions) is inside the selection (ignoring feather). */
export function inSelection(sel, x, y) {
  let inside = false;
  sel.shapes.forEach((sh, i) => {
    let hit;
    if (sh.kind === 'rect') hit = x >= Math.min(sh.x0, sh.x1) && x <= Math.max(sh.x0, sh.x1) && y >= Math.min(sh.y0, sh.y1) && y <= Math.max(sh.y0, sh.y1);
    else if (sh.kind === 'ellipse') {
      const rx = Math.abs(sh.x1 - sh.x0) / 2, ry = Math.abs(sh.y1 - sh.y0) / 2;
      hit = rx > 0 && ry > 0 && ((x - (sh.x0 + sh.x1) / 2) / rx) ** 2 + ((y - (sh.y0 + sh.y1) / 2) / ry) ** 2 <= 1;
    } else {
      hit = false;
      for (let a = 0, b = sh.pts.length - 1; a < sh.pts.length; b = a++) {
        const [xa, ya] = sh.pts[a], [xb, yb] = sh.pts[b];
        if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) hit = !hit;
      }
    }
    inside = i === 0 || sh.mode === 'add' ? inside || hit : sh.mode === 'sub' ? inside && !hit : inside && hit;
  });
  return sel.invert ? !inside : inside;
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
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

/**
 * Layers as Flightroom's own fr:Layers value: JSON, deflated and base64'd
 * ("z:" first). A selection several strokes were clipped to is kept once.
 */
export function layersToText(layers) {
  if (!layers?.length) return '';
  const clips = [];
  const clipId = (c) => { let i = clips.indexOf(c); if (i < 0) { clips.push(c); i = clips.length - 1; } return i; };
  const out = layers.map((l) => ({
    ...l,
    ops: l.ops.map((op) => ({
      ...op,
      ...(op.pts ? { pts: op.pts.flatMap(([x, y]) => [r5(x), r5(y)]) } : {}),
      ...(op.clip ? { clip: clipId(op.clip) } : {}),
    })),
  }));
  return `z:${toB64(deflateSync(strToU8(JSON.stringify({ v: 1, layers: out, clips })), { level: 6 }))}`;
}

export function layersFromText(text) {
  if (!text) return [];
  try {
    const json = text.startsWith('z:') ? strFromU8(inflateSync(fromB64(text.slice(2)))) : text;
    const { layers, clips = [] } = JSON.parse(json);
    if (!Array.isArray(layers)) return [];
    return layers.filter((l) => l && Array.isArray(l.ops)).map((l) => ({
      ...l,
      ops: l.ops.map((op) => {
        const o = { ...op };
        if (Array.isArray(op.pts)) { o.pts = []; for (let i = 0; i + 1 < op.pts.length; i += 2) o.pts.push([op.pts[i], op.pts[i + 1]]); }
        if (op.clip != null) o.clip = clips[op.clip] || undefined;
        return o;
      }),
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
    for (const op of l.ops) {
      if (!SOURCED.has(op.t) || !op.pts?.length || out.length >= max) continue;
      const b = opBounds(op, geo.ow, geo.oh);
      const pad = op.size * Math.max(geo.ow, geo.oh) * 0.6 + 4;
      const x0 = Math.max(b[0] - pad, box[0]), y0 = Math.max(b[1] - pad, box[1]);
      const x1 = Math.min(b[2] + pad, box[2]), y1 = Math.min(b[3] + pad, box[3]);
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
