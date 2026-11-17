// A Photoshop document's layers, as the desktop side reads them (psd.rs),
// made into Retouch's own: type layers become text layers, pixel layers
// (shapes and smart objects as the pixels Photoshop drew) become picture layers whose pixels stay in the
// document ("psd:<layer>", raster.js), adjustment layers become Retouch's
// live ones with the same settings, Solid Color fills become fill layers,
// groups stay groups (with their masks), and layer masks become masks. Blend mode, opacity,
// fill, clipping, visibility and layer styles come along.
import { newId } from './masks.js';
import { ADJUSTMENTS, newAdjustment, parseCube } from './adjust.js';
import { bitmapShape } from './selection.js';
import { TEXT_DEFAULT } from './raster.js';

const KNOWN = new Set(ADJUSTMENTS.map(([k]) => k));

/** An adjustment's settings over Retouch's defaults for its kind. */
function adjustment(a) {
  if (!KNOWN.has(a.type)) return null;
  const out = { ...newAdjustment(a.type), ...a };
  if (a.type === 'lut') {
    delete out.cube;
    if (a.cube) { try { out.lut = parseCube(a.cube, a.name || 'Lookup'); } catch { out.lut = null; } }
  }
  // Colorize's hue is 0-360 in Photoshop; Retouch's slider runs -180 to 180 (the same colours).
  if (a.type === 'hsl' && out.hue > 180) out.hue -= 360;
  return out;
}

/**
 * A layer mask from its grey pixels: Photoshop's mask is a picture over a
 * rectangle, with everything outside it shown (default 255) or hidden (0).
 * Retouch's starts all shown or hidden and fills the rest through a
 * selection made of the picture.
 */
export function maskFrom(m, grey) {
  const off = !!m.off;
  if (!grey) return { base: m.default >= 128 ? 1 : 0, ops: [], off };
  const { w, h, px } = grey;
  const hideInside = m.default >= 128;
  const vals = hideInside ? px.map((v) => 255 - v) : px;
  const sh = bitmapShape(vals, w, h, m.rect);
  const ops = sh ? [{ id: newId(), t: 'fill', color: hideInside ? [0, 0, 0] : [1, 1, 1], opacity: 100, clip: { shapes: [sh], invert: false, feather: 0 } }] : [];
  return { base: hideInside ? 1 : 0, ops, off };
}

/** A vector mask (shape layers' outline): the shape shown, through a selection of its outlines. */
export function vectorMask(v) {
  const shapes = v.paths.filter((pts) => pts.length >= 3).map((pts) => ({ mode: 'add', kind: 'poly', pts }));
  const ops = shapes.length ? [{ id: newId(), t: 'fill', color: v.invert ? [0, 0, 0] : [1, 1, 1], opacity: 100, clip: { shapes, invert: false, feather: 0 } }] : [];
  return { base: v.invert ? 1 : 0, ops };
}

/**
 * Retouch layers (bottom first) for a described document. `loadMask(index)`
 * gives a layer's mask as { w, h, px: grey bytes } (or null).
 */
export async function psdLayers(psd, loadMask) {
  const ids = new Map();
  const idOf = (g) => (g == null ? undefined : ids.get(g) || ids.set(g, newId()).get(g));
  const masks = await Promise.all(psd.layers.map((e) => (e.mask ? loadMask(e.index).catch(() => null) : null)));
  const out = [];
  psd.layers.forEach((e, n) => {
    const l = {
      id: e.kind === 'group' ? idOf(e.id) : newId(), name: e.name || 'Layer', kind: e.kind, hidden: !!e.hidden,
      opacity: e.opacity ?? 100, fill: e.fill ?? 100, blend: e.kind === 'group' ? e.blend || 'pass' : e.blend || 'normal', ops: [],
    };
    const parent = idOf(e.parent);
    if (parent) l.parent = parent;
    if (e.clip) l.clip = true;
    if (e.kind === 'adjust') {
      const adj = adjustment(e.adj || {});
      if (!adj) return;
      l.adj = adj;
    } else if (e.kind === 'fill') l.fillDef = { type: 'solid', color: e.color };
    else if (e.text && typeof e.text === 'object') {
      // A type layer: editable text again (its font as the computer has it).
      const { tf, ...t } = e.text;
      l.kind = 'text';
      l.text = { ...TEXT_DEFAULT, ...t };
      if (tf) l.tf = tf;
    } else if (e.kind === 'image') {
      const [x0, y0, x1, y1] = e.rect;
      l.image = { src: `psd:${e.index}`, w: e.size[0], h: e.size[1], x0, y0, x1, y1 };
    }
    if (e.mask) l.mask = maskFrom(e.mask, masks[n]);
    else if (e.vector) l.mask = vectorMask(e.vector);
    if (e.style) l.style = e.style;
    out.push(l);
  });
  return out;
}

/** A grey PNG's pixels: { w, h, px }. */
export async function greyPixels(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const rgba = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const px = new Uint8Array(bmp.width * bmp.height);
  for (let i = 0; i < px.length; i++) px[i] = rgba[i * 4];
  const out = { w: bmp.width, h: bmp.height, px };
  bmp.close?.();
  return out;
}
