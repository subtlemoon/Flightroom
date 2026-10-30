// The Retouch tab: Photoshop's tools, menus and panels over the live Develop
// photo (develop/retouch.js holds the data, develop/compose.js draws it).
// It is the Develop tab in another mode, so switching (Ctrl+E) keeps the
// same RAW, renderer, settings and undo history: nothing is exported.
//
// This file: the tools, Retouch's settings and every command (layers,
// selections, adjustments, filters...) with its shortcut. rtstage.jsx is what
// happens on the photo, rtpanels.jsx the panels, rtmenus.jsx the menu bar.
import { useRef, useState } from 'react';
import { newId } from '../develop/masks.js';
import {
  BLEND_MODES, IDENT, PAINTABLE, bitmapSelection, colorSelect, flipRgba, inGroup, isIdent, kindOf, layerBounds, modifyValues, moveSelection,
  newLayer, nextName, selectionBounds, selectionValues, stretchBounds, thinSelection, tfAbout, tfMul, tfPx, tfUnits, findSpotSource, selectionOutline,
} from '../develop/retouch.js';
import { ADJ_LABEL, newAdjustment } from '../develop/adjust.js';
import { FILTER_DEF, newFilter } from '../develop/filters.js';

// [id, label, icon, key]; a group shares one place on the tool bar (Shift+key goes round it).
export const TOOL_GROUPS = [
  [['move', 'Move Tool', 'move', 'V']],
  [['marquee', 'Rectangular Marquee Tool', 'marquee', 'M'], ['ellipse', 'Elliptical Marquee Tool', 'ellipseSel', 'M'],
    ['row', 'Single Row Marquee Tool', 'rowSel', 'M'], ['column', 'Single Column Marquee Tool', 'colSel', 'M']],
  [['lasso', 'Lasso Tool', 'lasso', 'L'], ['polygon', 'Polygonal Lasso Tool', 'polyLasso', 'L']],
  [['quick', 'Quick Selection Tool', 'quickSel', 'W'], ['wand', 'Magic Wand Tool', 'wand', 'W']],
  [['crop', 'Crop Tool', 'crop', 'C']],
  [['dropper', 'Eyedropper Tool', 'dropper', 'I']],
  [['spot', 'Spot Healing Brush Tool', 'spot', 'J'], ['heal', 'Healing Brush Tool', 'heal', 'J'], ['patch', 'Patch Tool', 'patch', 'J'], ['redeye', 'Red Eye Tool', 'redeye', 'J']],
  [['brush', 'Brush Tool', 'brush', 'B'], ['pencil', 'Pencil Tool', 'pencil', 'B']],
  [['clone', 'Clone Stamp Tool', 'stamp', 'S']],
  [['eraser', 'Eraser Tool', 'eraser', 'E']],
  [['gradient', 'Gradient Tool', 'gradient', 'G'], ['bucket', 'Paint Bucket Tool', 'bucket', 'G']],
  [['blur', 'Blur Tool', 'blurTool', 'R'], ['sharpen', 'Sharpen Tool', 'sharpenTool', 'R'], ['smudge', 'Smudge Tool', 'smudge', 'R']],
  [['dodge', 'Dodge Tool', 'dodge', 'O'], ['burn', 'Burn Tool', 'burn', 'O'], ['sponge', 'Sponge Tool', 'sponge', 'O']],
  [['type', 'Horizontal Type Tool', 'type', 'T']],
  [['rect', 'Rectangle Tool', 'shapeRect', 'U'], ['ellipseShape', 'Ellipse Tool', 'shapeEllipse', 'U'], ['triangle', 'Triangle Tool', 'triangle', 'U'],
    ['polygonShape', 'Polygon Tool', 'polygon', 'U'], ['line', 'Line Tool', 'line', 'U']],
  [['hand', 'Hand Tool', 'hand', 'H']],
  [['zoom', 'Zoom Tool', 'zoom', 'Z']],
];
export const TOOLS = TOOL_GROUPS.flat();
export const TOOL = Object.fromEntries(TOOL_GROUPS.flatMap((g, gi) => g.map(([id, label, icon, key]) => [id, { id, label, icon, key, group: gi }])));
export const BRUSHES = new Set(['brush', 'pencil', 'eraser', 'clone', 'spot', 'heal', 'blur', 'sharpen', 'smudge', 'dodge', 'burn', 'sponge', 'quick']);
export const SELECTORS = new Set(['marquee', 'ellipse', 'row', 'column', 'lasso', 'polygon', 'quick', 'wand']);
export const SHAPE_TOOLS = { rect: 'rect', ellipseShape: 'ellipse', triangle: 'triangle', polygonShape: 'polygon', line: 'line' };
// Tools that work on the photo's pixels, so they go on a layer of their own over a type, fill or adjustment layer.
const PIXEL_TOOLS = new Set(['clone', 'heal', 'spot', 'patch', 'redeye', 'blur', 'sharpen', 'smudge', 'dodge', 'burn', 'sponge']);

export const SWATCHES = [
  '#ffffff', '#e6e6e6', '#bfbfbf', '#999999', '#737373', '#4d4d4d', '#262626', '#000000',
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080',
  '#f7977a', '#fdc68a', '#fff79a', '#a2d39c', '#7bcdc8', '#6ecff6', '#8393ca', '#a187be', '#f49ac2',
  '#9e0b0f', '#a0410d', '#aba000', '#197b30', '#007236', '#00746b', '#0054a6', '#1b1464', '#440e62', '#9e005d',
  '#c69c6d', '#a67c52', '#8c6239', '#754c24', '#603913', '#42210b',
];

// Per tool: size is the brush radius as a fraction of the photo's long edge.
export const RETOUCH_DEFAULT = {
  tool: 'brush', fg: [0, 0, 0], bg: [1, 1, 1], feather: 0, selMode: 'new', aligned: true, groupTool: {},
  brush: { size: 0.006, hard: 80, opacity: 100, flow: 100 },
  pencil: { size: 0.0015, hard: 100, opacity: 100, flow: 100 },
  eraser: { size: 0.01, hard: 60, opacity: 100, flow: 100 },
  clone: { size: 0.01, hard: 50, opacity: 100, flow: 100 },
  spot: { size: 0.008, hard: 50 },
  heal: { size: 0.008, hard: 50 },
  blur: { size: 0.01, hard: 40, strength: 50 },
  sharpen: { size: 0.01, hard: 40, strength: 50 },
  smudge: { size: 0.01, hard: 40, strength: 50 },
  dodge: { size: 0.015, hard: 30, strength: 50, range: 1, protect: true },
  burn: { size: 0.015, hard: 30, strength: 50, range: 1, protect: true },
  sponge: { size: 0.015, hard: 30, strength: 50, range: 1 },
  quick: { size: 0.01 },
  wand: { tol: 32, contiguous: true },
  bucket: { tol: 32, contiguous: true, opacity: 100 },
  gradient: { style: 'linear', colors: 'fgbg', reverse: false, opacity: 100 },
  redeye: { size: 0.012, darken: 50 },
  type: { font: 'Arial', size: 0.05, bold: false, italic: false, align: 'left' },
  shape: { noFill: false, strokeOn: false, strokeColor: [0, 0, 0], strokeW: 0.002, radius: 0, sides: 5, star: false, weight: 0.003 },
  swatches: SWATCHES,
  panels: { color: true, swatches: false, properties: true, adjustments: true, layers: true, history: false },
  collapsed: {},
  view: { rulers: false, grid: false, guides: true, extras: true },
};

export const hex = (c) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
export const unhex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const grey = (c) => { const v = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return [v, v, v]; };

// --- the layer tree (groups) ---------------------------------------------------

/** Layers as a tree, top first: [{ l, kids }] (a group's layers sit just below it in the list). */
export function layerTree(layers, parent = undefined) {
  const out = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if ((l.parent || undefined) !== parent) continue;
    out.push({ l, kids: l.kind === 'group' ? layerTree(layers, l.id) : [] });
  }
  return out;
}
/** Back to the list, bottom first. */
export function flattenTree(nodes) {
  const out = [];
  for (let i = nodes.length - 1; i >= 0; i--) { out.push(...flattenTree(nodes[i].kids), nodes[i].l); }
  return out;
}

const copyOps = (ops) => ops.map((op) => ({ ...op, id: newId() }));
const copyLayer = (l, extra = {}) => ({
  ...l, id: newId(), ops: copyOps(l.ops), ...(l.mask ? { mask: { ...l.mask, ops: copyOps(l.mask.ops) } } : {}),
  ...(l.filters ? { filters: l.filters.map((f) => ({ ...f, id: newId() })) } : {}), ...extra,
});
// A mask's ops, turned negative.
const invertOps = (ops) => ops.map((op) => {
  if (op.t === 'clear') return { ...op, id: newId(), t: 'fill', color: [1, 1, 1] };
  if (op.t === 'gradient') return { ...op, c0: [...op.c0.slice(0, 3).map((v) => 1 - v), op.c0[3]], c1: [...op.c1.slice(0, 3).map((v) => 1 - v), op.c1[3]] };
  return op.color ? { ...op, color: op.color.map((v) => 1 - v) } : op;
});
/** A layer mask showing just the selection (or hiding it). */
const maskFrom = (sel, hide) => (sel
  ? { base: hide ? 1 : 0, ops: [{ id: newId(), t: 'fill', color: hide ? [0, 0, 0] : [1, 1, 1], opacity: 100, clip: sel }] }
  : { base: hide ? 0 : 1, ops: [] });

/**
 * Edits to the layers of `s`. update(fn, label) changes the settings (one
 * undo step, named in History); active is the selected layer's id.
 */
export function retouchActions(s, update, active, setActive, toast) {
  const layers = s?.layers || [];
  const byId = (id) => layers.find((l) => l.id === id);
  const set = (fn, label) => update((old) => ({ ...old, layers: fn(old.layers || []) }), label);
  const map = (id, fn, label) => set((ls) => ls.map((l) => (l.id === id ? fn(l) : l)), label);
  /** Puts a new layer just above the active one (in its group). */
  const insert = (l, label) => {
    const cur = byId(active);
    const nl = { ...l, ...(cur?.parent ? { parent: cur.parent } : {}) };
    set((ls) => { const out = [...ls]; const i = cur ? out.findIndex((x) => x.id === cur.id) : out.length - 1; out.splice(i + 1, 0, nl); return out; }, label || `New ${l.name}`);
    setActive(nl.id);
    return nl.id;
  };
  const acts = {
    layers, byId,
    add: (kind = 'pixel', extra = {}, name) => insert(newLayer(layers, name, kind, extra), kind === 'pixel' ? 'New Layer' : undefined),
    insert,
    change: (id, patch, label = 'Layer Properties') => map(id, (l) => ({ ...l, ...patch }), label),
    changeFn: (id, fn, label) => map(id, fn, label),
    rename: (id, name) => map(id, (l) => ({ ...l, name }), 'Rename Layer'),
    addAdjustment(type, sel) {
      return insert(newLayer(layers, nextName(layers, ADJ_LABEL[type]), 'adjust', { adj: newAdjustment(type), mask: maskFrom(sel) }), `New ${ADJ_LABEL[type]} Layer`);
    },
    addFill(fillDef, sel) {
      const base = fillDef.type === 'gradient' ? 'Gradient Fill' : 'Color Fill';
      return insert(newLayer(layers, nextName(layers, base), 'fill', { fillDef, mask: maskFrom(sel) }), `New ${base} Layer`);
    },
    /** The layer strokes go on, made if there is none (a hidden one is shown again). */
    target() {
      const cur = byId(active);
      if (cur?.hidden) map(cur.id, (l) => ({ ...l, hidden: false }));
      if (cur && PAINTABLE.has(kindOf(cur))) return cur.id;
      return acts.add();
    },
    addOp: (id, op, mask, label = 'Brush Tool') => map(id, (l) => (mask
      ? { ...l, mask: { base: 1, ...l.mask, ops: [...(l.mask?.ops || []), op] } }
      : { ...l, ops: [...l.ops, op] }), label),
    remove(id) {
      const l = byId(id);
      if (!l) return;
      const gone = new Set([id, ...(l.kind === 'group' ? inGroup(layers, id).map((x) => x.id) : [])]);
      const i = layers.indexOf(l);
      set((ls) => ls.filter((x) => !gone.has(x.id)), 'Delete Layer');
      if (gone.has(active)) setActive(layers.slice(0, i).reverse().find((x) => !gone.has(x.id))?.id || layers.find((x) => !gone.has(x.id))?.id || null);
    },
    duplicate(id, name) {
      const l = byId(id);
      if (!l) return null;
      const kids = l.kind === 'group' ? inGroup(layers, id) : [];
      const copy = copyLayer(l, { name: name || `${l.name} copy` });
      const ids = new Map([[l.id, copy.id]]);
      const kidCopies = kids.map((k) => { const c = copyLayer(k); ids.set(k.id, c.id); return c; }).map((c) => ({ ...c, parent: ids.get(c.parent) || c.parent }));
      set((ls) => { const out = [...ls]; out.splice(out.findIndex((x) => x.id === id) + 1, 0, ...kidCopies, copy); return out; }, 'Duplicate Layer');
      setActive(copy.id);
      return copy.id;
    },
    /** Moves a layer (with what's in it, for a group) among its neighbours: 'up', 'down', 'top', 'bottom'. */
    arrange(id, where) {
      set((ls) => {
        const walk = (nodes) => {
          const i = nodes.findIndex((n) => n.l.id === id);
          if (i < 0) { nodes.forEach((n) => walk(n.kids)); return; }
          const [n] = nodes.splice(i, 1);
          const j = where === 'top' ? 0 : where === 'bottom' ? nodes.length : where === 'up' ? Math.max(0, i - 1) : Math.min(nodes.length, i + 1);
          nodes.splice(j, 0, n);
        };
        const tree = layerTree(ls);
        walk(tree);
        return flattenTree(tree);
      }, 'Arrange');
    },
    /** Drag and drop in the Layers panel: just above `over` (into its group), or into the top of a group. */
    moveTo(id, overId, into) {
      if (id === overId || inGroup(layers, id).some((l) => l.id === overId)) return;
      set((ls) => {
        const tree = layerTree(ls);
        let node = null;
        const take = (nodes) => { const i = nodes.findIndex((n) => n.l.id === id); if (i >= 0) { [node] = nodes.splice(i, 1); return; } nodes.forEach((n) => take(n.kids)); };
        take(tree);
        if (!node) return ls;
        const put = (nodes, parent) => {
          const i = nodes.findIndex((n) => n.l.id === overId);
          if (i >= 0) {
            if (into) nodes[i].kids.unshift({ ...node, l: { ...node.l, parent: overId } });
            else nodes.splice(i, 0, { ...node, l: { ...node.l, parent } });
            return true;
          }
          return nodes.some((n) => put(n.kids, n.l.id));
        };
        if (!put(tree, undefined)) tree.push({ ...node, l: { ...node.l, parent: undefined } });
        const clean = (nodes) => nodes.forEach((n) => { if (!n.l.parent) delete n.l.parent; clean(n.kids); });
        clean(tree);
        return flattenTree(tree);
      }, 'Arrange');
    },
    /** Puts layers in a new group. */
    group(ids) {
      const ls0 = layers.filter((l) => ids.includes(l.id));
      if (!ls0.length) return;
      const g = newLayer(layers, nextName(layers, 'Group'), 'group');
      const parent = ls0[0].parent;
      set((ls) => {
        const tree = layerTree(ls);
        const take = [];
        const walk = (nodes) => { for (let i = nodes.length - 1; i >= 0; i--) { if (ids.includes(nodes[i].l.id)) take.unshift(...nodes.splice(i, 1)); else walk(nodes[i].kids); } };
        const find = (nodes) => { const i = nodes.findIndex((n) => ids.includes(n.l.id)); if (i >= 0) return [nodes, i]; for (const n of nodes) { const r = find(n.kids); if (r) return r; } return null; };
        const [where, at] = find(tree) || [tree, 0];
        walk(tree);
        where.splice(Math.min(at, where.length), 0, { l: { ...g, ...(parent ? { parent } : {}) }, kids: take.map((n) => ({ ...n, l: { ...n.l, parent: g.id } })) });
        return flattenTree(tree);
      }, 'Group Layers');
      setActive(g.id);
    },
    ungroup(id) {
      const g = byId(id);
      if (g?.kind !== 'group') return;
      set((ls) => ls.filter((l) => l.id !== id).map((l) => (l.parent === id ? { ...l, parent: g.parent } : l)), 'Ungroup Layers');
      setActive(layers.find((l) => l.parent === id)?.id || null);
    },
    /** Merges a layer into the one below it, when that can be done without losing anything. */
    mergeDown(id) {
      const i = layers.findIndex((l) => l.id === id);
      const top = layers[i], below = layers[i - 1];
      if (!top || !below) return;
      const plain = (l) => kindOf(l) === 'pixel' && !l.mask && !l.filters?.length && !l.style && isIdent(l.tf) && !l.clip;
      if (!plain(top) || !PAINTABLE.has(kindOf(below)) || top.blend !== 'normal' || (top.fill ?? 100) < 100 || below.filters?.length || !isIdent(below.tf)) {
        toast?.('Only plain layers can be merged: masks, filters, styles, blend modes and other kinds of layer stay live');
        return;
      }
      const k = top.opacity / 100;
      const ops = top.ops.map((op) => ('opacity' in op || op.t === 'fill' ? { ...op, opacity: (op.opacity ?? 100) * k } : op));
      set((ls) => ls.filter((l) => l.id !== id).map((l) => (l.id === below.id ? { ...l, ops: [...l.ops, ...ops] } : l)), 'Merge Down');
      setActive(below.id);
    },
    // Masks
    addMask: (id, sel, hide) => map(id, (l) => ({ ...l, mask: maskFrom(sel, hide) }), 'Add Layer Mask'),
    deleteMask: (id) => map(id, (l) => { const { mask, ...rest } = l; void mask; return rest; }, 'Delete Layer Mask'),
    invertMask: (id) => map(id, (l) => (l.mask ? { ...l, mask: { ...l.mask, base: 1 - (l.mask.base ?? 1), ops: invertOps(l.mask.ops) } } : l), 'Invert'),
    // Filters
    addFilter(id, f) { const nf = { id: newId(), seed: Math.random() * 100, ...f }; map(id, (l) => ({ ...l, filters: [...(l.filters || []), nf] }), FILTER_DEF[f.type]?.label.replace('…', '') || 'Filter'); return nf.id; },
    changeFilter: (id, fid, patch) => map(id, (l) => ({ ...l, filters: (l.filters || []).map((f) => (f.id === fid ? { ...f, ...patch } : f)) }), 'Filter Options'),
    removeFilter: (id, fid) => map(id, (l) => ({ ...l, filters: (l.filters || []).filter((f) => f.id !== fid) }), 'Delete Filter'),
  };
  return acts;
}

// --- everything Retouch does, by name --------------------------------------------

/**
 * Retouch's state and commands. ctx: { s, update, undo, info, geo, photo,
 * stage (the stage's api), toast, onMode, setCrop, exportNow, aiMasks, autoTone }.
 */
export function useRetouch(ctx) {
  const { s, update, info, geo, stage, toast, onMode } = ctx;
  const [rt, setRt] = useStoredRetouch();
  const [active, setActive] = useState(null);
  const [selection, setSelectionState] = useState(null);
  const lastSel = useRef(null);
  const [editMask, setEditMask] = useState(false);
  const [cloneSrc, setCloneSrc] = useState(null);
  const [quickMask, setQuickMask] = useState(false);
  const [dialog, setDialog] = useState(null); // { type, ... }
  const [xform, setXform] = useState(null); // free transform: { what: 'layer'|'selection', id, tf0, tf }
  const [guides, setGuides] = useState([]); // [{ v: true|false, at (fraction) }]
  const [clip, setClip] = useState(null); // a copied layer
  const lastFilter = useRef(null);
  const setSelection = (sel) => { setSelectionState((old) => { if (old) lastSel.current = old; return sel; }); };
  const acts = retouchActions(s, update, active, setActive, toast);
  const cur = acts.byId(active);
  const ow = geo?.ow || 1, oh = geo?.oh || 1;
  const L = Math.max(ow, oh);

  const setTool = (tool) => {
    if (xform) commitTransform();
    if (tool === 'crop') { onMode?.('develop'); ctx.setCrop?.(true); toast('Crop is shared with Develop'); return; }
    setRt({ tool, groupTool: { ...rt.groupTool, [TOOL[tool].group]: tool } });
  };

  /** Where a stroke of `tool` goes: { id, mask, keepAlpha }, or null (locked). */
  const paintTarget = (tool) => {
    const l = cur;
    const kind = l && kindOf(l);
    if (l && (l.lock?.all || (l.lock?.pixels && !editMask))) { toast(`${l.name} is locked`); return null; }
    if (PIXEL_TOOLS.has(tool)) {
      if (l && PAINTABLE.has(kind) && !editMask) return { id: acts.target(), keepAlpha: !!l.lock?.alpha };
      return { id: acts.add() };
    }
    if (l && (editMask || kind === 'adjust' || kind === 'fill')) {
      if (l.hidden) acts.change(l.id, { hidden: false });
      return { id: l.id, mask: true };
    }
    if (l && PAINTABLE.has(kind)) return { id: acts.target(), keepAlpha: !!l.lock?.alpha };
    return { id: acts.add() };
  };

  // --- selections ---
  const picture = (edge = 2048) => {
    const p = stage.current.picture?.(edge);
    return p && { w: p.w, h: p.h, rgb: flipRgba(p.rgba, p.w, p.h) };
  };
  const selPx = (sel, edge = 2048) => {
    const k = edge / L;
    const w = Math.max(8, Math.round(ow * k)), h = Math.max(8, Math.round(oh * k));
    return { w, h, v: selectionValues(sel, w, h, ow, oh) };
  };
  /** Combines a new selection with the current one: 'new', 'add', 'sub', 'and'. */
  const combine = (next, mode) => {
    if (!next) { if (mode === 'new') setSelection(null); return; }
    if (mode === 'new' || !selection) { setSelection(mode === 'sub' ? null : next); return; }
    const shapes = next.shapes.map((sh, i) => ({ ...sh, mode: i === 0 ? mode : sh.mode }));
    if (selection.tf || selection.invert || next.tf || next.invert) {
      // Mixed transforms: worked out as a picture.
      const a = selPx(selection), b = selPx(next);
      const v = a.v.map((x, i) => (mode === 'add' ? Math.max(x, b.v[i]) : mode === 'sub' ? Math.min(x, 255 - b.v[i]) : Math.min(x, b.v[i])));
      setSelection(bitmapSelection(v, a.w, a.h));
      return;
    }
    setSelection({ ...selection, shapes: [...selection.shapes, ...shapes] });
  };
  const fromPicture = (fn, mode = 'new') => {
    const img = picture();
    if (!img) return;
    combine(bitmapSelection(fn(img), img.w, img.h), mode);
  };
  const sel = {
    all: () => setSelection({ shapes: [{ kind: 'rect', mode: 'add', x0: 0, y0: 0, x1: 1, y1: 1 }], invert: false, feather: 0 }),
    deselect: () => setSelection(null),
    reselect: () => lastSel.current && setSelectionState(lastSel.current),
    inverse: () => selection && setSelectionState({ ...selection, invert: !selection.invert }),
    wand: (fx, fy, mode, opts = rt.wand) => fromPicture((img) => colorSelect(img, [[Math.floor(fx * img.w), Math.floor(fy * img.h)]], opts.tol, opts.contiguous), mode),
    quick: (pts, size, mode) => fromPicture((img) => {
      const seeds = [];
      const r = Math.max(1, size * Math.max(img.w, img.h));
      for (const [x, y] of pts) for (let dy = -r; dy <= r; dy += Math.max(1, r / 3)) for (let dx = -r; dx <= r; dx += Math.max(1, r / 3)) if (dx * dx + dy * dy <= r * r) seeds.push([Math.floor(x * img.w + dx), Math.floor(y * img.h + dy)]);
      return colorSelect(img, seeds, 22, true);
    }, mode),
    /** Grow / Similar: pixels like the selected ones, joined to them or anywhere. */
    grow(contiguous) {
      if (!selection) return;
      const img = picture();
      if (!img) return;
      const { v } = selPx(selection, Math.max(img.w, img.h));
      const seeds = [];
      const step = Math.max(1, Math.round(Math.sqrt(v.filter((x) => x >= 128).length / 400)));
      for (let y = 0; y < img.h; y += step) for (let x = 0; x < img.w; x += step) if (v[y * img.w + x] >= 128) seeds.push([x, y]);
      const out = colorSelect(img, seeds, rt.wand.tol, contiguous);
      for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], v[i]);
      setSelection(bitmapSelection(out, img.w, img.h));
    },
    modify(how, px) {
      if (!selection) return;
      if (how === 'feather') { setSelection({ ...selection, feather: (selection.feather || 0) + px / L }); return; }
      const { w, h, v } = selPx(selection);
      setSelection(bitmapSelection(modifyValues(v, w, h, how, (px * w) / ow), w, h));
    },
    async ai(type) {
      const r = await ctx.aiMasks?.get(type);
      if (r) combine(bitmapSelection(r.data, r.w, r.h), 'new');
    },
    move: (dx, dy) => selection && setSelectionState(moveSelection(selection, dx, dy, ow, oh)),
    save(name) { update((old) => ({ ...old, channels: [...(old.channels || []).filter((c) => c.name !== name), { name, sel: selection }] }), 'Save Selection'); },
    load(name, mode = 'new') { const c = (s.channels || []).find((x) => x.name === name); if (c) combine(c.sel, mode); },
  };

  // --- ops ---
  const opBase = () => (selection ? { clip: selection } : {});
  const fillWith = (color, opacity = 100, label = 'Fill') => {
    const t = paintTarget('brush');
    if (!t) return;
    acts.addOp(t.id, { id: newId(), t: 'fill', color: t.mask ? grey(color) : color, opacity, keepAlpha: t.keepAlpha, ...opBase() }, t.mask, label);
  };
  const contentAware = () => {
    if (!selection) { toast('Make a selection around what should go first'); return; }
    const b = selectionBounds(selection, ow, oh);
    if (!b) return;
    const pic = stage.current.basePicture?.();
    const size = (Math.max((b[2] - b[0]) * ow, (b[3] - b[1]) * oh) / 2) / L;
    const off = pic ? findSpotSource({ t: 'heal', size, pts: [[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]] }, pic, pic.w, pic.h) : { dx: (b[2] - b[0]) * 1.3, dy: 0 };
    const id = paintTarget('patch')?.id;
    if (id) acts.addOp(id, { id: newId(), t: 'patch', clip: selection, ...off }, false, 'Content-Aware Fill');
  };
  const strokeSel = (widthPx, color) => {
    if (!selection) return;
    const t = paintTarget('brush');
    if (!t) return;
    const lines = selectionOutline(selection, ow, oh);
    update((old) => ({
      ...old,
      layers: old.layers.map((l) => {
        if (l.id !== t.id) return l;
        const ops = lines.map((pts) => ({ id: newId(), t: 'paint', size: widthPx / 2 / L, hard: 100, opacity: 100, flow: 100, color: t.mask ? grey(color) : color, pts }));
        return t.mask ? { ...l, mask: { base: 1, ...l.mask, ops: [...(l.mask?.ops || []), ...ops] } } : { ...l, ops: [...l.ops, ...ops] };
      }),
    }), 'Stroke');
  };

  // --- filters ---
  /** Adds a filter to the active layer (a copy of the photo when there's none), clipped to the selection. */
  const applyFilter = (type, params) => {
    let id = cur?.id;
    if (!cur || cur.kind === 'group') id = acts.insert(newLayer(acts.layers, 'Photo copy', 'photo'), 'Duplicate Photo');
    const b = selection && selectionBounds(selection, ow, oh);
    const extra = {
      ...(selection ? { clip: selection } : {}),
      center: b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : [0.5, 0.5],
      rad: b ? (Math.max((b[2] - b[0]) * ow, (b[3] - b[1]) * oh) / 2) / L : 0.5,
      ...(type === 'clouds' ? { fg: rt.fg, bg: rt.bg } : {}),
    };
    const f = { ...newFilter(type, extra), ...params };
    const fid = acts.addFilter(id, f);
    lastFilter.current = { type, params: Object.fromEntries((FILTER_DEF[type]?.params || []).map((p) => [p.key, f[p.key]])) };
    if (FILTER_DEF[type]?.label.endsWith('…') && !params) setDialog({ type: 'filter', layer: id, fid, filter: type });
  };

  // --- transform ---
  const boundsOf = (what) => {
    if (what === 'selection') { const b = selection && selectionBounds({ ...selection, tf: null }, ow, oh); return b && [b[0] * ow, b[1] * oh, b[2] * ow, b[3] * oh]; }
    const l = cur;
    if (!l) return null;
    return layerBounds({ ...l, tf: null }, ow, oh) || [0, 0, ow, oh];
  };
  const startTransform = (what = cur ? 'layer' : 'selection') => {
    // A one-pixel row or column selected (Single Row / Column Marquee): it goes on a
    // Pixel Stretch layer, ready to drag out into streaks.
    const thin = thinSelection(selection, ow, oh);
    if (thin) {
      const id = acts.insert(newLayer(acts.layers, nextName(acts.layers, 'Pixel Stretch'), 'stretch', { stretch: thin }), 'Pixel Stretch');
      setSelection(null);
      setXform({ what: 'layer', id, box: stretchBounds(thin, ow, oh), tf0: IDENT, tf: IDENT });
      toast('Drag a side handle out to stretch the line of pixels');
      return;
    }
    if (what === 'layer' && (!cur || cur.kind === 'group')) { if (selection) what = 'selection'; else { toast('Pick a layer to transform'); return; } }
    if (what === 'layer' && (cur.lock?.position || cur.lock?.all)) { toast(`${cur.name} is locked`); return; }
    const tf0 = (what === 'layer' ? cur.tf : selection?.tf) || IDENT;
    setXform({ what, id: cur?.id, box: boundsOf(what), tf0, tf: tf0 });
  };
  /** Turns or flips the layer (or selection) about its middle at once. */
  const quickTransform = (deg, sx = 1, sy = 1) => {
    const what = cur && cur.kind !== 'group' ? 'layer' : selection ? 'selection' : null;
    if (!what) return;
    const box = boundsOf(what);
    const tf0 = (what === 'layer' ? cur.tf : selection.tf) || IDENT;
    const m0 = tfPx(tf0, ow, oh);
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const [px, py] = [m0[0] * cx + m0[1] * cy + m0[2], m0[3] * cx + m0[4] * cy + m0[5]];
    const tf = tfUnits(tfMul(tfAbout(px, py, sx, sy, deg), m0), ow, oh);
    commitTransform({ what, id: cur?.id, tf });
  };
  const commitTransform = (x = xform) => {
    if (!x) return;
    if (x.what === 'layer') acts.change(x.id, { tf: isIdent(x.tf) ? undefined : x.tf }, 'Free Transform');
    else if (selection) setSelectionState({ ...selection, tf: isIdent(x.tf) ? undefined : x.tf });
    setXform(null);
  };

  // --- auto levels from the picture ---
  const autoLevels = (perChannel, neutral, name) => {
    const img = picture(512);
    if (!img) return;
    const hist = [0, 1, 2, 3].map(() => new Uint32Array(256));
    for (let i = 0; i < img.w * img.h; i++) {
      const r = img.rgb[i * 3], g = img.rgb[i * 3 + 1], b = img.rgb[i * 3 + 2];
      hist[0][r]++; hist[1][g]++; hist[2][b]++; hist[3][Math.round(0.3 * r + 0.59 * g + 0.11 * b)]++;
    }
    const n = img.w * img.h;
    const at = (hst, q) => { let c = 0; for (let v = 0; v < 256; v++) { c += hst[v]; if (c >= q * n) return v; } return 255; };
    const lv = (hst) => ({ in0: at(hst, 0.001), in1: Math.max(at(hst, 0.001) + 2, at(hst, 0.999)), gamma: 1, out0: 0, out1: 255 });
    const adj = newAdjustment('levels');
    if (perChannel) {
      ['r', 'g', 'b'].forEach((c, i) => { adj[c] = lv(hist[i]); });
      if (neutral) {
        // Midtones towards grey: each channel's middle to the same brightness.
        const mids = [0, 1, 2].map((i) => at(hist[i], 0.5) / 255), m = (mids[0] + mids[1] + mids[2]) / 3;
        ['r', 'g', 'b'].forEach((c, i) => { adj[c].gamma = Math.min(3, Math.max(0.33, Math.log(Math.max(1e-3, m)) / Math.log(Math.max(1e-3, mids[i])))); });
      }
    } else adj.rgb = lv(hist[3]);
    acts.insert(newLayer(acts.layers, name, 'adjust', { adj, mask: maskFrom(selection) }), name);
  };

  const layerViaCopy = (cut) => {
    if (!cur || !selection) { if (cur) acts.duplicate(cur.id); else acts.insert(newLayer(acts.layers, 'Photo copy', 'photo'), 'Duplicate Photo'); return; }
    const kind = kindOf(cur);
    const base = kind === 'group' ? null : copyLayer(cur, { name: `${cur.name} copy`, mask: maskFrom(selection) });
    if (!base) return;
    acts.insert(base, cut ? 'Layer Via Cut' : 'Layer Via Copy');
    if (cut && PAINTABLE.has(kind)) acts.addOp(cur.id, { id: newId(), t: 'clear', clip: selection }, false, 'Layer Via Cut');
  };
  const stampVisible = () => acts.insert(newLayer(acts.layers, nextName(acts.layers, 'Merged'), 'stamp'), 'Stamp Visible');

  /** Paint Bucket: fills pixels like the one clicked (within the selection, if any). */
  const bucket = (fx, fy) => {
    const img = picture();
    if (!img) return;
    const v = colorSelect(img, [[Math.floor(fx * img.w), Math.floor(fy * img.h)]], rt.bucket.tol, rt.bucket.contiguous);
    if (selection) { const s2 = selPx(selection, Math.max(img.w, img.h)); for (let i = 0; i < v.length; i++) v[i] = Math.min(v[i], s2.v[i]); }
    const clip = bitmapSelection(v, img.w, img.h);
    const t = clip && paintTarget('bucket');
    if (t) acts.addOp(t.id, { id: newId(), t: 'fill', color: t.mask ? grey(rt.fg) : rt.fg, opacity: rt.bucket.opacity, keepAlpha: t.keepAlpha, clip }, t.mask, 'Paint Bucket');
  };

  // --- the menus: every command, with its key (as Photoshop writes them on Windows) ---
  const noLayer = !cur || cur.kind === 'group';
  const has = { layer: !!cur, sel: !!selection, mask: !!cur?.mask };
  const ADJ_ITEMS = ['brightness', 'levels', 'curves', 'exposure', null, 'vibrance', 'hsl', 'balance', 'bw', 'photo', 'mixer', null, 'invert', 'posterize', 'threshold', 'gradmap', 'selective'];
  const filterItems = (menu) => Object.values(FILTER_DEF).filter((f) => f.menu === menu).map((f) => ({ label: f.label, run: () => applyFilter(f.type) }));
  const M = [
    { label: 'File', items: [
      { label: 'Export…', key: 'Alt+Shift+Ctrl+W', run: ctx.exportNow },
      { label: 'Revert', key: 'F12', run: ctx.revert },
      null,
      { label: 'Close (back to Develop)', key: 'Ctrl+W', run: () => onMode('develop') },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', key: 'Ctrl+Z', run: () => ctx.undo(false) },
      { label: 'Redo', key: 'Shift+Ctrl+Z', run: () => ctx.undo(true) },
      { label: 'Step Backward', key: 'Alt+Ctrl+Z', run: () => ctx.undo(false) },
      null,
      { label: 'Cut', key: 'Ctrl+X', disabled: !has.layer, run: () => { setClip(copyLayer(cur)); if (selection && PAINTABLE.has(kindOf(cur))) acts.addOp(cur.id, { id: newId(), t: 'clear', clip: selection }, false, 'Cut'); else acts.remove(cur.id); } },
      { label: 'Copy', key: 'Ctrl+C', disabled: !has.layer, run: () => { setClip(copyLayer(cur, selection ? { mask: maskFrom(selection) } : {})); toast(`${cur.name} copied`); } },
      { label: 'Paste', key: 'Ctrl+V', disabled: !clip, run: () => acts.insert(copyLayer(clip, { name: clip.name.replace(/( copy)?$/, ' copy') }), 'Paste') },
      null,
      { label: 'Fill…', key: 'Shift+F5', run: () => setDialog({ type: 'fill' }) },
      { label: 'Fill with Foreground', key: 'Alt+Backspace', run: () => fillWith(rt.fg) },
      { label: 'Fill with Background', key: 'Ctrl+Backspace', run: () => fillWith(rt.bg) },
      { label: 'Stroke…', disabled: !has.sel, run: () => setDialog({ type: 'stroke' }) },
      { label: 'Content-Aware Fill', disabled: !has.sel, run: contentAware },
      null,
      { label: 'Free Transform', key: 'Ctrl+T', disabled: noLayer && !has.sel, run: () => startTransform() },
      { label: 'Transform', items: [
        { label: 'Scale / Rotate', run: () => startTransform() },
        null,
        { label: 'Rotate 180°', run: () => quickTransform(180) },
        { label: 'Rotate 90° Clockwise', run: () => quickTransform(90) },
        { label: 'Rotate 90° Counter Clockwise', run: () => quickTransform(-90) },
        null,
        { label: 'Flip Horizontal', run: () => quickTransform(0, -1, 1) },
        { label: 'Flip Vertical', run: () => quickTransform(0, 1, -1) },
      ] },
      null,
      { label: 'Keyboard Shortcuts…', key: 'Alt+Shift+Ctrl+K', run: () => setDialog({ type: 'keys' }) },
    ] },
    { label: 'Image', items: [
      { label: 'Mode', items: [{ label: 'RGB Color', check: true, run: () => {} }, { label: 'Grayscale (Black & White layer)', run: () => acts.addAdjustment('bw', selection) }] },
      null,
      { label: 'Adjustments', items: [
        ...ADJ_ITEMS.map((t) => (t ? { label: `${ADJ_LABEL[t]}…`, run: () => acts.addAdjustment(t, selection) } : null)),
        null,
        { label: 'Desaturate', key: 'Shift+Ctrl+U', run: () => { const id = acts.addAdjustment('hsl', selection); acts.changeFn(id, (l) => ({ ...l, name: 'Desaturate', adj: { ...l.adj, sat: -100 } }), 'Desaturate'); } },
      ] },
      null,
      { label: 'Auto Tone', key: 'Shift+Ctrl+L', run: () => autoLevels(true, false, 'Auto Tone') },
      { label: 'Auto Contrast', key: 'Alt+Shift+Ctrl+L', run: () => autoLevels(false, false, 'Auto Contrast') },
      { label: 'Auto Color', key: 'Shift+Ctrl+B', run: () => autoLevels(true, true, 'Auto Color') },
      null,
      { label: 'Image Size… (Export)', key: 'Alt+Ctrl+I', run: ctx.exportNow },
      { label: 'Crop', disabled: !has.sel, run: () => ctx.cropTo?.(selectionBounds(selection, ow, oh)) },
    ] },
    { label: 'Layer', items: [
      { label: 'New', items: [
        { label: 'Layer…', key: 'Shift+Ctrl+N', run: () => acts.add() },
        { label: 'Group…', run: () => acts.insert(newLayer(acts.layers, nextName(acts.layers, 'Group'), 'group'), 'New Group') },
        { label: 'Group from Layers…', disabled: noLayer, run: () => acts.group([cur.id]) },
        null,
        { label: 'Layer Via Copy', key: 'Ctrl+J', run: () => layerViaCopy(false) },
        { label: 'Layer Via Cut', key: 'Shift+Ctrl+J', disabled: !has.layer, run: () => layerViaCopy(true) },
        { label: 'Copy of the Photo', run: () => acts.insert(newLayer(acts.layers, 'Photo copy', 'photo'), 'Duplicate Photo') },
      ] },
      { label: 'Duplicate Layer…', disabled: !has.layer, run: () => acts.duplicate(cur.id) },
      { label: 'Delete', items: [
        { label: 'Layer', disabled: !has.layer, run: () => acts.remove(cur.id) },
        { label: 'Hidden Layers', run: () => acts.layers.filter((l) => l.hidden).forEach((l) => acts.remove(l.id)) },
      ] },
      { label: 'Rename Layer…', disabled: !has.layer, run: () => setDialog({ type: 'rename', id: cur.id, name: cur.name }) },
      null,
      { label: 'Layer Style', items: [
        { label: 'Blending Options…', disabled: noLayer, run: () => setDialog({ type: 'style', id: cur.id, tab: 'blend' }) },
        null,
        ...[['stroke', 'Stroke…'], ['overlay', 'Color Overlay…'], ['glow', 'Outer Glow…'], ['shadow', 'Drop Shadow…']].map(([tab, label]) => ({ label, disabled: noLayer, run: () => setDialog({ type: 'style', id: cur.id, tab, enable: true }) })),
        null,
        { label: 'Clear Layer Style', disabled: !cur?.style, run: () => acts.change(cur.id, { style: undefined }, 'Clear Layer Style') },
      ] },
      { label: 'Smart Filter', items: [{ label: 'Clear Smart Filters', disabled: !cur?.filters?.length, run: () => acts.change(cur.id, { filters: [] }, 'Clear Smart Filters') }] },
      null,
      { label: 'New Fill Layer', items: [
        { label: 'Solid Color…', run: () => { const id = acts.addFill({ type: 'solid', color: rt.fg }, selection); setDialog({ type: 'solid', id }); } },
        { label: 'Gradient…', run: () => acts.addFill({ type: 'gradient', g: { style: 'linear', x0: 0.5, y0: 1, x1: 0.5, y1: 0, c0: [...rt.fg, 1], c1: [...rt.fg, 0] } }, selection) },
      ] },
      { label: 'New Adjustment Layer', items: ADJ_ITEMS.map((t) => (t ? { label: `${ADJ_LABEL[t]}…`, run: () => acts.addAdjustment(t, selection) } : null)) },
      null,
      { label: 'Layer Mask', items: [
        { label: 'Reveal All', disabled: noLayer, run: () => acts.addMask(cur.id, null, false) },
        { label: 'Hide All', disabled: noLayer, run: () => acts.addMask(cur.id, null, true) },
        { label: 'Reveal Selection', disabled: noLayer || !has.sel, run: () => acts.addMask(cur.id, selection, false) },
        { label: 'Hide Selection', disabled: noLayer || !has.sel, run: () => acts.addMask(cur.id, selection, true) },
        null,
        { label: 'Delete', disabled: !has.mask, run: () => { acts.deleteMask(cur.id); setEditMask(false); } },
        { label: cur?.mask?.off ? 'Enable' : 'Disable', disabled: !has.mask, run: () => acts.change(cur.id, { mask: { ...cur.mask, off: !cur.mask.off } }, 'Mask') },
        { label: 'Invert', key: 'Ctrl+I', disabled: !has.mask, run: () => acts.invertMask(cur.id) },
      ] },
      { label: cur?.clip ? 'Release Clipping Mask' : 'Create Clipping Mask', key: 'Alt+Ctrl+G', disabled: noLayer || acts.layers[0]?.id === cur?.id, run: () => acts.change(cur.id, { clip: !cur.clip }, cur.clip ? 'Release Clipping Mask' : 'Create Clipping Mask') },
      null,
      { label: 'Group Layers', key: 'Ctrl+G', disabled: !has.layer, run: () => acts.group([cur.id]) },
      { label: 'Ungroup Layers', key: 'Shift+Ctrl+G', disabled: cur?.kind !== 'group', run: () => acts.ungroup(cur.id) },
      { label: cur?.hidden ? 'Show Layers' : 'Hide Layers', key: 'Ctrl+,', disabled: !has.layer, run: () => acts.change(cur.id, { hidden: !cur.hidden }, cur.hidden ? 'Show Layer' : 'Hide Layer') },
      null,
      { label: 'Arrange', disabled: !has.layer, items: [
        { label: 'Bring to Front', key: 'Shift+Ctrl+]', run: () => acts.arrange(cur.id, 'top') },
        { label: 'Bring Forward', key: 'Ctrl+]', run: () => acts.arrange(cur.id, 'up') },
        { label: 'Send Backward', key: 'Ctrl+[', run: () => acts.arrange(cur.id, 'down') },
        { label: 'Send to Back', key: 'Shift+Ctrl+[', run: () => acts.arrange(cur.id, 'bottom') },
      ] },
      { label: cur?.lock?.all ? 'Unlock Layer' : 'Lock Layer', key: 'Ctrl+/', disabled: !has.layer, run: () => acts.change(cur.id, { lock: { ...cur.lock, all: !cur.lock?.all } }, 'Lock') },
      null,
      { label: 'Merge Down', disabled: !has.layer, run: () => acts.mergeDown(cur.id) },
      { label: 'Stamp Visible', key: 'Shift+Ctrl+Alt+E', run: stampVisible },
    ] },
    { label: 'Type', items: [
      { label: 'New Type Layer', key: 'T', run: () => setTool('type') },
      null,
      { label: 'Bold', disabled: cur?.kind !== 'text', check: !!cur?.text?.bold, run: () => acts.change(cur.id, { text: { ...cur.text, bold: !cur.text.bold } }, 'Type') },
      { label: 'Italic', disabled: cur?.kind !== 'text', check: !!cur?.text?.italic, run: () => acts.change(cur.id, { text: { ...cur.text, italic: !cur.text.italic } }, 'Type') },
      { label: 'Underline', disabled: cur?.kind !== 'text', check: !!cur?.text?.underline, run: () => acts.change(cur.id, { text: { ...cur.text, underline: !cur.text.underline } }, 'Type') },
      null,
      ...[['left', 'Align Left'], ['center', 'Align Center'], ['right', 'Align Right']].map(([a, label]) => ({ label, disabled: cur?.kind !== 'text', check: cur?.text?.align === a, run: () => acts.change(cur.id, { text: { ...cur.text, align: a } }, 'Type') })),
      null,
      { label: 'Larger', key: 'Shift+Ctrl+>', disabled: cur?.kind !== 'text', run: () => acts.change(cur.id, { text: { ...cur.text, size: cur.text.size * 1.1 } }, 'Type') },
      { label: 'Smaller', key: 'Shift+Ctrl+<', disabled: cur?.kind !== 'text', run: () => acts.change(cur.id, { text: { ...cur.text, size: cur.text.size / 1.1 } }, 'Type') },
    ] },
    { label: 'Select', items: [
      { label: 'All', key: 'Ctrl+A', run: sel.all },
      { label: 'Deselect', key: 'Ctrl+D', disabled: !has.sel, run: sel.deselect },
      { label: 'Reselect', key: 'Shift+Ctrl+D', run: sel.reselect },
      { label: 'Inverse', key: 'Shift+Ctrl+I', disabled: !has.sel, run: sel.inverse },
      null,
      { label: 'Color Range…', run: () => setDialog({ type: 'colorRange', range: 'sampled', colors: [], fuzz: 40 }) },
      { label: 'Subject', run: () => sel.ai('subject') },
      { label: 'Sky', run: () => sel.ai('sky') },
      { label: 'Background', run: () => sel.ai('background') },
      null,
      { label: 'Modify', disabled: !has.sel, items: [['border', 'Border…'], ['smooth', 'Smooth…'], ['expand', 'Expand…'], ['contract', 'Contract…'], ['feather', 'Feather…']].map(([how, label]) => ({ label, key: how === 'feather' ? 'Shift+F6' : undefined, run: () => setDialog({ type: 'modify', how }) })) },
      { label: 'Grow', disabled: !has.sel, run: () => sel.grow(true) },
      { label: 'Similar', disabled: !has.sel, run: () => sel.grow(false) },
      null,
      { label: 'Transform Selection', disabled: !has.sel, run: () => startTransform('selection') },
      { label: 'Edit in Quick Mask Mode', key: 'Q', check: quickMask, run: () => setQuickMask((q) => !q) },
      null,
      { label: 'Load Selection…', disabled: !s?.channels?.length, run: () => setDialog({ type: 'loadSel' }) },
      { label: 'Save Selection…', disabled: !has.sel, run: () => setDialog({ type: 'saveSel', name: nextName(s?.channels?.map((c) => ({ name: c.name })) || [], 'Alpha') }) },
    ] },
    { label: 'Filter', items: [
      { label: lastFilter.current ? `Last Filter (${FILTER_DEF[lastFilter.current.type].label.replace('…', '')})` : 'Last Filter', key: 'Alt+Ctrl+F', disabled: !lastFilter.current, run: () => applyFilter(lastFilter.current.type, lastFilter.current.params) },
      null,
      { label: 'Camera Raw Filter… (Develop)', key: 'Shift+Ctrl+A', run: () => onMode('develop') },
      { label: 'Lens Correction… (Develop)', key: 'Shift+Ctrl+R', run: () => onMode('develop') },
      null,
      ...['Blur', 'Blur Gallery', 'Distort', 'Noise', 'Pixelate', 'Render', 'Sharpen', 'Stylize', 'Other'].map((m) => ({ label: m, items: filterItems(m) })),
    ] },
    { label: 'View', items: [
      { label: 'Zoom In', key: 'Ctrl++', run: () => stage.current.zoomBy?.(2) },
      { label: 'Zoom Out', key: 'Ctrl+-', run: () => stage.current.zoomBy?.(0.5) },
      { label: 'Fit on Screen', key: 'Ctrl+0', run: () => stage.current.unzoom?.() },
      { label: '100%', key: 'Ctrl+1', run: () => stage.current.zoom100?.() },
      null,
      { label: 'Extras', key: 'Ctrl+H', check: rt.view.extras, run: () => setRt({ view: { ...rt.view, extras: !rt.view.extras } }) },
      { label: 'Rulers', key: 'Ctrl+R', check: rt.view.rulers, run: () => setRt({ view: { ...rt.view, rulers: !rt.view.rulers } }) },
      { label: 'Grid', key: "Ctrl+'", check: rt.view.grid, run: () => setRt({ view: { ...rt.view, grid: !rt.view.grid } }) },
      { label: 'Guides', key: 'Ctrl+;', check: rt.view.guides, run: () => setRt({ view: { ...rt.view, guides: !rt.view.guides } }) },
      null,
      { label: 'New Guide…', run: () => setDialog({ type: 'guide', v: true, at: 50 }) },
      { label: 'Clear Guides', disabled: !guides.length, run: () => setGuides([]) },
    ] },
    { label: 'Window', items: [
      ...[['adjustments', 'Adjustments'], ['color', 'Color'], ['history', 'History'], ['layers', 'Layers', 'F7'], ['properties', 'Properties'], ['swatches', 'Swatches']]
        .map(([p, label, key]) => ({ label, key, check: rt.panels[p], run: () => setRt({ panels: { ...rt.panels, [p]: !rt.panels[p] } }) })),
    ] },
    { label: 'Help', items: [{ label: 'Keyboard Shortcuts…', run: () => setDialog({ type: 'keys' }) }] },
  ];

  // Every item with a key, for the keyboard.
  const keyed = [];
  const collect = (items) => items?.forEach((it) => { if (!it) return; if (it.items) collect(it.items); else if (it.key && !it.disabled) keyed.push(it); });
  M.forEach((m) => collect(m.items));
  const keyName = (e) => {
    const parts = [];
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (e.code === 'Equal' || key === '+') key = '+';
    if (e.code === 'Minus') key = '-';
    if (e.code === 'BracketLeft') key = '[';
    if (e.code === 'BracketRight') key = ']';
    if (e.code === 'Comma' || key === '<') key = e.shiftKey && (e.ctrlKey || e.metaKey) ? '<' : ',';
    if (e.code === 'Period' || key === '>') key = '>';
    if (e.code === 'Quote') key = "'";
    if (e.code === 'Semicolon') key = ';';
    if (e.code === 'Slash') key = '/';
    if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
    return [...parts, key].join('+');
  };
  const norm = (key) => key.split('+').sort().join('+');

  /** Photoshop's keys. Returns true when the key was Retouch's. */
  const onKey = (e) => {
    if (!s) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    const name = keyName(e);
    if (xform) {
      if (e.key === 'Enter') { e.preventDefault(); commitTransform(); return true; }
      if (e.key === 'Escape') { setXform(null); return true; }
    }
    const hit = keyed.find((it) => norm(it.key) === norm(name) || (it.key === 'Ctrl++' && ctrl && (e.key === '=' || e.key === '+')));
    if (hit && (ctrl || e.altKey || /^F\d+/.test(e.key) || hit.key.includes('+'))) { e.preventDefault(); hit.run(); return true; }
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); ctx.undo(e.shiftKey); return true; }
    if (ctrl || e.altKey) return false;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      const t = paintTarget('eraser');
      if (t) acts.addOp(t.id, t.mask ? { id: newId(), t: 'fill', color: grey(rt.bg), opacity: 100, clip: selection } : { id: newId(), t: 'clear', clip: selection }, t.mask, 'Clear');
      return true;
    }
    if (e.key === 'Escape' && selection) { sel.deselect(); return true; }
    // Moving with the arrow keys: the selection with a selection tool, the layer with Move.
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && (rt.tool === 'move' || SELECTORS.has(rt.tool))) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key].map((v) => v * (e.shiftKey ? 10 : 1));
      if (rt.tool === 'move' && cur && !cur.lock?.position && !cur.lock?.all) acts.change(cur.id, { tf: tfMul([1, 0, dx / L, 0, 1, dy / L], cur.tf || IDENT) }, 'Nudge');
      else if (selection) sel.move(dx / ow, dy / oh);
      return true;
    }
    const t = rt[rt.tool];
    if (['[', ']', '{', '}'].includes(e.key)) {
      if (t?.size) {
        const up = e.key === ']' || e.key === '}';
        if (e.shiftKey || e.key === '{' || e.key === '}') setRt({ [rt.tool]: { ...t, hard: Math.min(100, Math.max(0, (t.hard ?? 50) + (up ? 25 : -25))) } });
        else setRt({ [rt.tool]: { ...t, size: Math.min(0.3, Math.max(0.0002, t.size * (up ? 1.2 : 1 / 1.2))) } });
      }
      return true;
    }
    const key = e.key.toLowerCase();
    if (key === 'x') { setRt({ fg: rt.bg, bg: rt.fg }); return true; }
    if (key === 'd') { setRt({ fg: RETOUCH_DEFAULT.fg, bg: RETOUCH_DEFAULT.bg }); return true; }
    if (key === 'q') { setQuickMask((q) => !q); return true; }
    // Number keys: the brush's opacity (1 = 10% ... 0 = 100%).
    if (/^\d$/.test(e.key) && t && 'opacity' in t) { setRt({ [rt.tool]: { ...t, opacity: e.key === '0' ? 100 : Number(e.key) * 10 } }); return true; }
    const group = TOOL_GROUPS.find((g) => g[0][3] === e.key.toUpperCase() && g[0][3].length === 1);
    if (group) {
      const gi = TOOL_GROUPS.indexOf(group);
      const curInGroup = TOOL[rt.tool]?.group === gi;
      const last = rt.groupTool[gi] || group[0][0];
      const next = e.shiftKey && curInGroup ? group[(group.findIndex((x) => x[0] === rt.tool) + 1) % group.length][0] : last;
      setTool(next);
      return true;
    }
    return false;
  };

  return {
    rt, setRt, setTool, channels: s?.channels, active, setActive: (id) => { if (xform && id !== xform.id) commitTransform(); setActive(id); setEditMask(false); }, cur, acts, selection, setSelection, combine, sel,
    editMask, setEditMask, cloneSrc, setCloneSrc, quickMask, setQuickMask, dialog, setDialog, xform, setXform, commitTransform, startTransform,
    guides, setGuides, menus: M, onKey, paintTarget, fillWith, strokeSel, applyFilter, contentAware, bucket, picture, quickTransform, info, ow, oh, L,
    reset: (layers) => { setActive(layers?.at(-1)?.id ?? null); setSelectionState(null); setCloneSrc(null); setXform(null); setEditMask(false); },
  };
}

function useStoredRetouch() {
  const [v, setV] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('flightroom-retouch'));
      const out = { ...RETOUCH_DEFAULT, ...saved };
      // New tools' settings, and new settings of known tools.
      for (const [key, d] of Object.entries(RETOUCH_DEFAULT)) if (d && typeof d === 'object' && !Array.isArray(d)) out[key] = { ...d, ...saved?.[key] };
      if (!TOOL[out.tool]) out.tool = 'brush';
      return out;
    } catch { return RETOUCH_DEFAULT; }
  });
  const set = (patch) => setV((old) => {
    const n = { ...old, ...patch };
    try { localStorage.setItem('flightroom-retouch', JSON.stringify(n)); } catch {}
    return n;
  });
  return [v, set];
}

export { BLEND_MODES, grey };
