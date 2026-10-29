// Retouch selections, as in Photoshop: shapes added to, taken from or
// intersected with each other (Shift / Alt), optionally inverted, feathered
// and transformed. Shapes are vectors (rectangles, ellipses, lasso outlines,
// Quick Mask brush strokes) or images (the magic wand, quick selection,
// Select Subject / Sky, Color Range, Modify...), kept small and deflated.
//
// { shapes: [{ mode: 'add'|'sub'|'and', kind, ... }], invert, feather, tf }
//   rect / ellipse: x0, y0, x1, y1      poly: pts      stroke: pts, size (radius / long edge)
//   bitmap: x0, y0, x1, y1 (where it sits), w, h, data (deflated 8-bit, base64)
// Positions are fractions of the photo (upright, after Transform, before
// cropping); tf is an affine transform [a, b, c, d, e, f] in units of the
// photo's long edge (see tfPx), applied after the shapes.
import { deflateSync, inflateSync } from 'fflate';

export const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
export const fromB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

export const canvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// --- affine transforms (x' = a x + b y + c, y' = d x + e y + f) -------------------

export const IDENT = [1, 0, 0, 0, 1, 0];
/** A transform kept in long-edge units, in oriented pixels. */
export const tfPx = (tf, ow, oh) => {
  const L = Math.max(ow, oh);
  return [tf[0], tf[1], tf[2] * L, tf[3], tf[4], tf[5] * L];
};
export const tfUnits = (m, ow, oh) => {
  const L = Math.max(ow, oh);
  return [m[0], m[1], m[2] / L, m[3], m[4], m[5] / L];
};
/** a after b. */
export const tfMul = (a, b) => [
  a[0] * b[0] + a[1] * b[3], a[0] * b[1] + a[1] * b[4], a[0] * b[2] + a[1] * b[5] + a[2],
  a[3] * b[0] + a[4] * b[3], a[3] * b[1] + a[4] * b[4], a[3] * b[2] + a[4] * b[5] + a[5],
];
export const tfInv = (m) => {
  const det = m[0] * m[4] - m[1] * m[3] || 1e-12;
  const a = m[4] / det, b = -m[1] / det, d = -m[3] / det, e = m[0] / det;
  return [a, b, -(a * m[2] + b * m[5]), d, e, -(d * m[2] + e * m[5])];
};
export const tfApply = (m, x, y) => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
export const tfScale = (m) => Math.sqrt(Math.abs(m[0] * m[4] - m[1] * m[3]));
export const isIdent = (m) => !m || m.every((v, i) => Math.abs(v - IDENT[i]) < 1e-9);
/** Turning by `deg` and scaling by sx, sy about (cx, cy) (oriented px), then moving by tx, ty. */
export const tfAbout = (cx, cy, sx, sy, deg, tx = 0, ty = 0) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const lin = [c * sx, -s * sy, 0, s * sx, c * sy, 0];
  const [px, py] = tfApply(lin, cx, cy);
  return [lin[0], lin[1], cx - px + tx, lin[3], lin[4], cy - py + ty];
};

// --- bitmaps -------------------------------------------------------------------------

const decoded = new Map(); // data -> canvas (white, alpha = the image)
function bitmapCanvas(sh) {
  let c = decoded.get(sh.data);
  if (c) return c;
  const px = inflateSync(fromB64(sh.data));
  c = canvas(sh.w, sh.h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(sh.w, sh.h);
  for (let i = 0; i < px.length; i++) { const o = i * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = px[i]; }
  ctx.putImageData(img, 0, 0);
  decoded.set(sh.data, c);
  if (decoded.size > 12) decoded.delete(decoded.keys().next().value);
  return c;
}
const bitmapPx = new Map();
function bitmapValues(sh) {
  let v = bitmapPx.get(sh.data);
  if (!v) { v = inflateSync(fromB64(sh.data)); bitmapPx.set(sh.data, v); if (bitmapPx.size > 6) bitmapPx.delete(bitmapPx.keys().next().value); }
  return v;
}

/**
 * A greyscale image (w x h, top row first) as a selection shape over `rect`
 * (fractions), cut to what's in it. Null when it's empty.
 */
export function bitmapShape(px, w, h, rect = [0, 0, 1, 1], mode = 'add') {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) if (px[row + x] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(w - 1, x1 + 1); y1 = Math.min(h - 1, y1 + 1);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) out.set(px.subarray((y + y0) * w + x0, (y + y0) * w + x0 + cw), y * cw);
  const fx = (rect[2] - rect[0]) / w, fy = (rect[3] - rect[1]) / h;
  return {
    mode, kind: 'bitmap', w: cw, h: ch, data: toB64(deflateSync(out, { level: 6 })),
    x0: rect[0] + x0 * fx, y0: rect[1] + y0 * fy, x1: rect[0] + (x1 + 1) * fx, y1: rect[1] + (y1 + 1) * fy,
  };
}

/** A selection made of one image. */
export const bitmapSelection = (px, w, h, rect) => {
  const sh = bitmapShape(px, w, h, rect);
  return sh && { shapes: [sh], invert: false, feather: 0 };
};

// --- shapes ----------------------------------------------------------------------

const VECTOR = new Set(['rect', 'ellipse', 'poly']);
export const isVector = (sel) => sel.shapes.every((sh) => VECTOR.has(sh.kind));

/** The shape's box in fractions (before the selection's transform). */
function shapeBox(sh, ow, oh) {
  if (sh.kind === 'poly' || sh.kind === 'stroke') {
    const xs = sh.pts.map((p) => p[0]), ys = sh.pts.map((p) => p[1]);
    const L = Math.max(ow, oh);
    const rx = sh.kind === 'stroke' ? (sh.size * L) / ow : 0, ry = sh.kind === 'stroke' ? (sh.size * L) / oh : 0;
    return [Math.min(...xs) - rx, Math.min(...ys) - ry, Math.max(...xs) + rx, Math.max(...ys) + ry];
  }
  return [Math.min(sh.x0, sh.x1), Math.min(sh.y0, sh.y1), Math.max(sh.x0, sh.x1), Math.max(sh.y0, sh.y1)];
}

/** Where a selection can be, in fractions: [x0, y0, x1, y1]; null when inverted (anywhere). */
export function selectionBounds(sel, ow = 1, oh = 1) {
  if (sel.invert) return null;
  let b = null;
  for (const sh of sel.shapes) {
    const s = shapeBox(sh, ow, oh);
    if (sh.mode === 'add' || !b) b = b ? [Math.min(b[0], s[0]), Math.min(b[1], s[1]), Math.max(b[2], s[2]), Math.max(b[3], s[3])] : s;
    else if (sh.mode === 'and') b = [Math.max(b[0], s[0]), Math.max(b[1], s[1]), Math.min(b[2], s[2]), Math.min(b[3], s[3])];
  }
  if (!b) return null;
  if (sel.tf && !isIdent(sel.tf)) {
    const m = tfPx(sel.tf, ow, oh);
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => tfApply(m, x * ow, y * oh));
    b = [Math.min(...pts.map((p) => p[0])) / ow, Math.min(...pts.map((p) => p[1])) / oh, Math.max(...pts.map((p) => p[0])) / ow, Math.max(...pts.map((p) => p[1])) / oh];
  }
  const f = (sel.feather || 0) * 2;
  return [b[0] - (f * Math.max(ow, oh)) / ow, b[1] - (f * Math.max(ow, oh)) / oh, b[2] + (f * Math.max(ow, oh)) / ow, b[3] + (f * Math.max(ow, oh)) / oh];
}

/** Traces a vector shape on a 2D context whose units are oriented px (W x H). */
export function traceShape(ctx, sh, W, H) {
  ctx.beginPath();
  if (sh.kind === 'rect') ctx.rect(Math.min(sh.x0, sh.x1) * W, Math.min(sh.y0, sh.y1) * H, Math.abs(sh.x1 - sh.x0) * W, Math.abs(sh.y1 - sh.y0) * H);
  else if (sh.kind === 'ellipse') {
    ctx.ellipse(((sh.x0 + sh.x1) / 2) * W, ((sh.y0 + sh.y1) / 2) * H, (Math.abs(sh.x1 - sh.x0) / 2) * W, (Math.abs(sh.y1 - sh.y0) / 2) * H, 0, 0, Math.PI * 2);
  } else sh.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
  ctx.closePath();
}

/** Draws one shape white (alpha = coverage) on ctx, whose units are oriented px. */
function drawShape(ctx, sh, ow, oh) {
  if (sh.kind === 'bitmap') {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmapCanvas(sh), sh.x0 * ow, sh.y0 * oh, (sh.x1 - sh.x0) * ow, (sh.y1 - sh.y0) * oh);
    return;
  }
  ctx.fillStyle = '#fff';
  if (sh.kind === 'stroke') {
    const r = sh.size * Math.max(ow, oh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    sh.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * ow, y * oh) : ctx.moveTo(x * ow, y * oh)));
    if (sh.pts.length === 1) { ctx.arc(sh.pts[0][0] * ow, sh.pts[0][1] * oh, r, 0, Math.PI * 2); ctx.fill(); }
    else ctx.stroke();
    return;
  }
  traceShape(ctx, sh, ow, oh);
  ctx.fill();
}

/**
 * A selection drawn as a W x H canvas covering the photo (ow x oh oriented
 * px): selected parts opaque. Feather is in long-edge units.
 */
export function selectionCanvas(sel, W, H, ow = W, oh = H) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const m = sel.tf && !isIdent(sel.tf) ? tfPx(sel.tf, ow, oh) : IDENT;
  const kx = W / ow, ky = H / oh;
  ctx.setTransform(kx * m[0], ky * m[3], kx * m[1], ky * m[4], kx * m[2], ky * m[5]);
  sel.shapes.forEach((sh, i) => {
    ctx.globalCompositeOperation = i === 0 || sh.mode === 'add' ? 'source-over' : sh.mode === 'sub' ? 'destination-out' : 'destination-in';
    drawShape(ctx, sh, ow, oh);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (sel.invert) {
    ctx.globalCompositeOperation = 'xor';
    ctx.fillStyle = '#fff';
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

/** The selection as W x H coverage values (0-255, top row first). */
export function selectionValues(sel, W, H, ow, oh) {
  const c = selectionCanvas(sel, W, H, ow, oh);
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const out = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3];
  return out;
}

const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** Whether a point (fractions) is inside the selection (ignoring feather). */
export function inSelection(sel, x, y, ow = 1, oh = 1) {
  if (sel.tf && !isIdent(sel.tf)) {
    const [lx, ly] = tfApply(tfInv(tfPx(sel.tf, ow, oh)), x * ow, y * oh);
    x = lx / ow; y = ly / oh;
  }
  let inside = false;
  sel.shapes.forEach((sh, i) => {
    let hit;
    if (sh.kind === 'rect') hit = x >= Math.min(sh.x0, sh.x1) && x <= Math.max(sh.x0, sh.x1) && y >= Math.min(sh.y0, sh.y1) && y <= Math.max(sh.y0, sh.y1);
    else if (sh.kind === 'ellipse') {
      const rx = Math.abs(sh.x1 - sh.x0) / 2, ry = Math.abs(sh.y1 - sh.y0) / 2;
      hit = rx > 0 && ry > 0 && ((x - (sh.x0 + sh.x1) / 2) / rx) ** 2 + ((y - (sh.y0 + sh.y1) / 2) / ry) ** 2 <= 1;
    } else if (sh.kind === 'bitmap') {
      const u = (x - sh.x0) / (sh.x1 - sh.x0), v = (y - sh.y0) / (sh.y1 - sh.y0);
      hit = u >= 0 && v >= 0 && u < 1 && v < 1 && bitmapValues(sh)[Math.floor(v * sh.h) * sh.w + Math.floor(u * sh.w)] >= 128;
    } else if (sh.kind === 'stroke') {
      const r = sh.size * Math.max(ow, oh);
      hit = sh.pts.some((p, j) => distToSeg(x * ow, y * oh, p[0] * ow, p[1] * oh, ...(sh.pts[j + 1] || p).map((v, k) => v * (k ? oh : ow))) <= r);
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

/** Moves a selection by dx, dy (fractions). */
export function moveSelection(sel, dx, dy, ow, oh) {
  const L = Math.max(ow, oh);
  return { ...sel, tf: tfMul([1, 0, (dx * ow) / L, 0, 1, (dy * oh) / L], sel.tf || IDENT) };
}

// --- outlines (marching ants) -------------------------------------------------------

/**
 * The selection's outline as polylines of fractions: exact for rectangles,
 * ellipses and lassos; traced from a picture of it otherwise.
 */
export function selectionOutline(sel, ow, oh, edge = 1024) {
  const m = sel.tf && !isIdent(sel.tf) ? tfPx(sel.tf, ow, oh) : null;
  const tf = (pts) => (m ? pts.map(([x, y]) => { const p = tfApply(m, x * ow, y * oh); return [p[0] / ow, p[1] / oh]; }) : pts);
  if (isVector(sel) && !sel.invert && sel.shapes.every((sh) => sh.mode === 'add')) {
    return sel.shapes.map((sh) => tf(sh.kind === 'poly' ? [...sh.pts, sh.pts[0]]
      : sh.kind === 'rect' ? [[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1], [sh.x0, sh.y1], [sh.x0, sh.y0]]
        : Array.from({ length: 65 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return [(sh.x0 + sh.x1) / 2 + (Math.cos(a) * Math.abs(sh.x1 - sh.x0)) / 2, (sh.y0 + sh.y1) / 2 + (Math.sin(a) * Math.abs(sh.y1 - sh.y0)) / 2];
        })));
  }
  const k = edge / Math.max(ow, oh);
  const W = Math.max(8, Math.round(ow * k)), H = Math.max(8, Math.round(oh * k));
  return contours(selectionValues({ ...sel, feather: 0 }, W, H, ow, oh), W, H).map((line) => line.map(([x, y]) => [x / W, y / H]));
}

/**
 * Lines around the parts of a W x H image at or above 128 (marching squares),
 * joined up and thinned: [[x, y], ...] in pixels, with pixel centres at +0.5.
 */
export function contours(v, W, H, level = 128) {
  // Padded by one so outlines close at the edge.
  const PW = W + 2, PH = H + 2;
  const at = (x, y) => (x < 1 || y < 1 || x > W || y > H ? 0 : v[(y - 1) * W + x - 1]);
  // Edge ids: horizontal (x,y)-(x+1,y) = 2*(y*PW+x), vertical (x,y)-(x,y+1) = +1.
  const pt = new Map();
  const point = (id) => {
    let p = pt.get(id);
    if (p) return p;
    const cell = id >> 1, x = cell % PW, y = (cell - x) / PW;
    const a = at(x, y), b = id & 1 ? at(x, y + 1) : at(x + 1, y);
    const t = b === a ? 0.5 : Math.min(1, Math.max(0, (level - a) / (b - a)));
    p = id & 1 ? [x - 0.5, y + t - 0.5] : [x + t - 0.5, y - 0.5];
    pt.set(id, p);
    return p;
  };
  const link = new Map(); // edge id -> [other ends]
  const join = (a, b) => {
    (link.get(a) || link.set(a, []).get(a)).push(b);
    (link.get(b) || link.set(b, []).get(b)).push(a);
  };
  for (let y = 0; y < PH - 1; y++) {
    for (let x = 0; x < PW - 1; x++) {
      const c = (at(x, y) >= level ? 8 : 0) | (at(x + 1, y) >= level ? 4 : 0) | (at(x + 1, y + 1) >= level ? 2 : 0) | (at(x, y + 1) >= level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const top = 2 * (y * PW + x), bottom = 2 * ((y + 1) * PW + x), left = 2 * (y * PW + x) + 1, right = 2 * (y * PW + x + 1) + 1;
      switch (c) {
        case 1: case 14: join(left, bottom); break;
        case 2: case 13: join(bottom, right); break;
        case 3: case 12: join(left, right); break;
        case 4: case 11: join(top, right); break;
        case 6: case 9: join(top, bottom); break;
        case 7: case 8: join(left, top); break;
        case 5: join(left, top); join(bottom, right); break;
        case 10: join(top, right); join(left, bottom); break;
        default:
      }
    }
  }
  const lines = [];
  const seen = new Set();
  for (const start of link.keys()) {
    if (seen.has(start)) continue;
    const ids = [start];
    seen.add(start);
    let prev = -1, cur = start;
    for (;;) {
      const next = (link.get(cur) || []).find((n) => n !== prev && !seen.has(n));
      if (next === undefined) break;
      seen.add(next);
      ids.push(next);
      prev = cur;
      cur = next;
    }
    if ((link.get(cur) || []).includes(start)) ids.push(start);
    if (ids.length > 2) lines.push(simplify(ids.map(point), 0.6));
  }
  return lines;
}

/** Ramer-Douglas-Peucker. */
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// --- picking by colour (magic wand, quick selection, Color Range) ----------------------

/** RGBA (bottom row first, as read from the graphics card) to RGB top row first. */
export function flipRgba(px, w, h) {
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4, dst = y * w * 3;
    for (let x = 0; x < w; x++) { out[dst + x * 3] = px[src + x * 4]; out[dst + x * 3 + 1] = px[src + x * 4 + 1]; out[dst + x * 3 + 2] = px[src + x * 4 + 2]; }
  }
  return out;
}

/**
 * Pixels like the seeds' colours (each channel within `tol`, 0-255) as a
 * 0/255 image: joined to a seed when `contiguous`, anywhere otherwise.
 * img: { w, h, rgb } top row first; seeds: [[x, y]] in its pixels.
 */
export function colorSelect(img, seeds, tol, contiguous = true) {
  const { w, h, rgb } = img;
  const out = new Uint8Array(w * h);
  const inside = seeds.filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h);
  if (!inside.length) return out;
  // A few colours stand for many seeds (a quick selection stroke).
  const step = Math.max(1, Math.floor(inside.length / 24));
  const refs = [];
  for (let i = 0; i < inside.length; i += step) { const o = (inside[i][1] * w + inside[i][0]) * 3; refs.push(rgb[o], rgb[o + 1], rgb[o + 2]); }
  const n = refs.length / 3;
  const like = (i) => {
    const o = i * 3, r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
    for (let k = 0; k < n; k++) {
      if (Math.abs(r - refs[k * 3]) <= tol && Math.abs(g - refs[k * 3 + 1]) <= tol && Math.abs(b - refs[k * 3 + 2]) <= tol) return true;
    }
    return false;
  };
  if (!contiguous) {
    for (let i = 0; i < w * h; i++) if (like(i)) out[i] = 255;
    return out;
  }
  const stack = new Int32Array(w * h);
  let sp = 0;
  for (const [x, y] of inside) { const i = y * w + x; if (!out[i]) { out[i] = 255; stack[sp++] = i; } }
  while (sp) {
    const i = stack[--sp];
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of nb) {
      if (j < 0 || j >= w * h || out[j]) continue;
      if (like(j)) { out[j] = 255; stack[sp++] = j; }
    }
  }
  return out;
}

const HUES = { reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300 };
export const COLOR_RANGES = [
  ['sampled', 'Sampled Colors'], ['reds', 'Reds'], ['yellows', 'Yellows'], ['greens', 'Greens'], ['cyans', 'Cyans'], ['blues', 'Blues'], ['magentas', 'Magentas'],
  ['highlights', 'Highlights'], ['midtones', 'Midtones'], ['shadows', 'Shadows'], ['skin', 'Skin Tones'],
];

/** Color Range: how much each pixel is like what's asked for, 0-255. */
export function colorRange(img, { range = 'sampled', colors = [], fuzz = 40 }) {
  const { w, h, rgb } = img;
  const out = new Uint8Array(w * h);
  const f = Math.max(1, fuzz);
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    let a;
    if (range === 'sampled' || range === 'skin') {
      const refs = range === 'skin' ? [[224, 172, 140], [198, 134, 103], [141, 85, 60], [241, 194, 167]] : colors;
      let d = Infinity;
      for (const c of refs) d = Math.min(d, Math.hypot(r - c[0], g - c[1], b - c[2]));
      a = 1 - (d - f * 0.5) / (f * 0.75);
    } else if (range === 'highlights' || range === 'midtones' || range === 'shadows') {
      const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      a = range === 'highlights' ? (l - 0.6) / 0.15 : range === 'shadows' ? (0.4 - l) / 0.15 : 1 - Math.abs(l - 0.5) / 0.2;
    } else {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d < 8) { out[i] = 0; continue; }
      let hue = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hue *= 60;
      const dh = Math.min(Math.abs(hue - HUES[range]), 360 - Math.abs(hue - HUES[range]));
      a = Math.min(1, (30 - dh) / 15 + 0.5) * Math.min(1, d / 60);
    }
    out[i] = Math.round(Math.min(1, Math.max(0, a)) * 255);
  }
  return out;
}

// --- Select > Modify ------------------------------------------------------------------

/** Distance (px, chamfer) from each pixel to the nearest one that is `want`. */
function distance(v, w, h, want) {
  const D = new Float32Array(w * h);
  const big = 1e9;
  for (let i = 0; i < w * h; i++) D[i] = (v[i] >= 128) === want ? 0 : big;
  const s2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let d = D[i];
    if (!d) continue;
    if (x > 0) d = Math.min(d, D[i - 1] + 1);
    if (y > 0) {
      d = Math.min(d, D[i - w] + 1);
      if (x > 0) d = Math.min(d, D[i - w - 1] + s2);
      if (x < w - 1) d = Math.min(d, D[i - w + 1] + s2);
    }
    D[i] = d;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let d = D[i];
    if (!d) continue;
    if (x < w - 1) d = Math.min(d, D[i + 1] + 1);
    if (y < h - 1) {
      d = Math.min(d, D[i + w] + 1);
      if (x < w - 1) d = Math.min(d, D[i + w + 1] + s2);
      if (x > 0) d = Math.min(d, D[i + w - 1] + s2);
    }
    D[i] = d;
  }
  return D;
}

function boxBlur(v, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Uint8Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += v[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += v[y * w + Math.min(w - 1, x + r + 1)] - v[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(s / n);
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Select > Modify on a W x H picture of a selection: 'expand' / 'contract'
 * by r px, 'border' r px wide, 'smooth' with radius r.
 */
export function modifyValues(v, w, h, how, r) {
  const out = new Uint8Array(w * h);
  if (how === 'smooth') {
    const b = boxBlur(v, w, h, Math.max(1, Math.round(r)));
    for (let i = 0; i < out.length; i++) out[i] = b[i] >= 128 ? 255 : 0;
    return boxBlur(out, w, h, 1);
  }
  if (how === 'expand') { const D = distance(v, w, h, true); for (let i = 0; i < out.length; i++) out[i] = D[i] <= r ? 255 : 0; }
  else if (how === 'contract') { const D = distance(v, w, h, false); for (let i = 0; i < out.length; i++) out[i] = D[i] > r ? 255 : 0; }
  else {
    const a = distance(v, w, h, true), b = distance(v, w, h, false);
    for (let i = 0; i < out.length; i++) out[i] = (v[i] >= 128 ? b[i] <= r / 2 : a[i] <= r / 2) ? 255 : 0;
  }
  return boxBlur(out, w, h, 1);
}
