// Saves a Retouch document as the Photoshop file it is (psdwrite.rs on the
// desktop side): every layer as Photoshop has it, Flightroom's own layers
// beside them. The window renders, in tiles, what each layer draws (its own
// pixels, before its styles and blend), each mask and the flattened picture;
// layers that haven't changed since the last save aren't rendered again.
import { bridge } from '../bridge.js';
import { SNAPSHOT, kindOf, layersToText, renderLayers } from './retouch.js';
import { exportPhoto, inner } from './export.js';

// Adjustment layers Photoshop has as its own (written live); others are written as their result.
const NATIVE_ADJ = new Set(['brightness', 'levels', 'curves', 'exposure', 'vibrance', 'hsl', 'balance', 'bw', 'photo', 'mixer', 'selective', 'invert', 'posterize', 'threshold']);

function hash(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

const shownStyle = (l) => (l.style && !l.style.hidden ? l.style : null);
/** What a layer's own pixels depend on, apart from what's below it. */
const pixelsOf = ({ name, hidden, opacity, blend, clip, style, mask, lock, parent, ...rest }) => rest;
const dependsBelow = (l) => kindOf(l) === 'stamp' || kindOf(l) === 'adjust' || l.ops.some((op) => SNAPSHOT.has(op.t));

/**
 * The layer records to write, bottom first (a group: its end marker, its
 * layers, then itself), each with the keys of its pixels and mask. `size`
 * names the document (its path and size); `under` also what's under the
 * layers (the Develop settings), which layers drawing from below depend on.
 */
export function saveSpecs(layers, size, under = size) {
  const kids = new Map();
  for (const l of layers) {
    const p = l.parent && layers.some((g) => g.id === l.parent) ? l.parent : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(l);
  }
  const below = new Map();
  let acc = hash(under);
  for (const l of layers) { below.set(l.id, acc); acc = hash(acc + JSON.stringify(l)); }
  const specs = [];
  const base = (l) => ({ name: l.name, hidden: !!l.hidden, opacity: l.opacity ?? 100, blend: l.blend || 'normal', id: l.id });
  const maskKey = (l) => (l.mask && !l.mask.off ? hash(`${size}|m|${JSON.stringify({ ...l.mask, off: false })}`) : null);
  const walk = (p) => {
    for (const l of kids.get(p) || []) {
      if (l.kind === 'group') {
        specs.push({ t: 'end', name: '</Layer group>', hidden: false, opacity: 100, blend: 'normal' });
        walk(l.id);
        specs.push({ ...base(l), t: 'group', blend: l.blend || 'pass', maskKey: maskKey(l) });
        continue;
      }
      const sp = { ...base(l), t: 'layer', fill: l.fill ?? 100, clip: !!l.clip, style: shownStyle(l), maskKey: maskKey(l) };
      const kind = kindOf(l);
      if (kind === 'adjust' && NATIVE_ADJ.has(l.adj?.type)) sp.adj = l.adj;
      else if (kind === 'fill' && l.fillDef?.type !== 'gradient' && !l.ops.length && !(l.filters || []).length) sp.solid = l.fillDef?.color || [0, 0, 0];
      else sp.key = hash(`${size}|${dependsBelow(l) ? below.get(l.id) : ''}|${JSON.stringify(pixelsOf(l))}`);
      specs.push(sp);
    }
  };
  walk(null);
  return specs;
}

/** The layers drawn for a save: hidden ones too (marked, so they're drawn but not shown). */
export function saveDrawList(layers) {
  const shown = new Set(renderLayers(layers).map((l) => l.id));
  const all = renderLayers(layers.map((l) => ({ ...l, hidden: false, opacity: Math.max(l.opacity ?? 100, 0.01) })));
  return all.map((l) => (shown.has(l.id) ? l : { ...l, _ghost: true }));
}

/** Saves the document `photo` (a Retouch document) with settings `s`. Resolves when it's written. */
export async function saveDocument(photo, info, s, { cancelled } = {}) {
  const rt = bridge.retouch;
  const layers = s.layers || [];
  const size = `${photo.id}|${info.width}x${info.height}`;
  const { layers: _, ...develop } = s;
  const specs = saveSpecs(layers, size, `${size}|${JSON.stringify(develop)}`);
  const job = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const srcs = [...new Set(layers.filter((l) => l.kind === 'image' && l.image?.src?.startsWith('psd:')).map((l) => l.image.src))];
  const begun = await rt.saveBegin({ job, path: photo.id, specs: specs.map(({ id, ...sp }) => sp), state: { v: 1, layers: layersToText(layers) }, srcs });
  if (begun?.error) throw new Error(begun.error);
  const wantPx = new Map(begun.px.map((i) => [specs[i].id, i]));
  const wantMask = new Map(begun.mask.map((i) => [specs[i].id, i]));
  const groups = layers.filter((l) => l.kind === 'group' && wantMask.has(l.id));
  let reads = [];
  const sink = {
    begin: () => true,
    startTile: (r) => {
      reads = [];
      const read = (kind, slot, t) => reads.push({ kind, slot, px: r.readAll(t, false) });
      r.capture = (wantPx.size || wantMask.size) ? {
        layer: (l, t) => { if (wantPx.has(l.id)) read('px', wantPx.get(l.id), t); },
        mask: (l, t) => { if (wantMask.has(l.id)) read('mask', wantMask.get(l.id), t); },
        groups,
      } : null;
    },
    tile: async (x, y, w, h, merged, { tw, P }) => {
      for (const rd of reads) {
        let px = await rd.px;
        if (P) px = inner(px, tw, P, w, h);
        // Nothing drawn in this part: nothing to send.
        if (rd.kind === 'px') { let any = false; for (let i = 3; i < px.length; i += 4) if (px[i]) { any = true; break; } if (!any) continue; }
        const res = await rt.saveTile(job, rd.kind, rd.slot, x, y, w, h, px);
        if (res?.error) return res;
      }
      return rt.saveTile(job, 'merged', 0, x, y, w, h, merged);
    },
    finish: async () => {
      const res = await rt.saveFinish(job);
      if (res?.error) throw new Error(res.error);
      return photo.id;
    },
    cancel: () => rt.saveFinish(job, true),
  };
  const full = { ...s, crop: null };
  return exportPhoto(photo, info, full, { sink, drawList: saveDrawList(layers), cancelled, renderer: null }).finally(() => { reads = []; });
}
