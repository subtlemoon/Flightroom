// Retouch on the photo: what each tool does with the pointer, and what's drawn
// over the photo (marching ants, Quick Mask, the transform box, rulers, grid
// and guides). Positions go to the layers as photo fractions (retouch.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../develop/masks.js';
import {
  IDENT, inSelection, layerBounds, newLayer, nextName, selectionOutline, selectionValues, canvas,
  tfApply, tfAbout, tfInv, tfMul, tfPx, tfUnits, toLayer,
} from '../develop/retouch.js';
import { TEXT_DEFAULT } from '../develop/raster.js';
import { BRUSHES, SHAPE_TOOLS, grey, hex } from './retouch.jsx';

const OP_OF = {
  brush: 'paint', pencil: 'paint', eraser: 'erase', clone: 'clone', heal: 'heal', spot: 'spot',
  blur: 'blur', sharpen: 'sharpen', smudge: 'smudge', dodge: 'dodge', burn: 'burn', sponge: 'sponge',
};
const LABEL = {
  brush: 'Brush Tool', pencil: 'Pencil Tool', eraser: 'Eraser', clone: 'Clone Stamp', heal: 'Healing Brush', spot: 'Spot Healing Brush',
  blur: 'Blur Tool', sharpen: 'Sharpen Tool', smudge: 'Smudge Tool', dodge: 'Dodge Tool', burn: 'Burn Tool', sponge: 'Sponge Tool',
};
const ellipse = (cx, cy, rx, ry) => ({ shapes: [{ kind: 'ellipse', mode: 'add', x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry }], invert: false, feather: 0 });
const pathOf = (lines, css) => lines.map((pts) => `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${css(x, y).map((v) => v.toFixed(1)).join(' ')}`).join('')}Z`).join('');

/**
 * rx: useRetouch's state and commands. toOri / toCss: stage css px <-> oriented
 * photo px. live(l) shows a stroke (or a moved layer) while it's made;
 * commit(layerId, op, mask, label) keeps a stroke.
 */
export function RetouchStage({ rx, geo, toOri, toCss, live, commit, pickColor, zoomAt, onSpaceTap, toast }) {
  const svg = useRef();
  const drag = useRef(null);
  const lastEnd = useRef(null);
  const [cursor, setCursor] = useState(null); // [X, Y]
  const [draft, setDraft] = useState(null); // something being drawn: { sel } | { line } | { shape } | { stroke }
  const [poly, setPoly] = useState(null); // Polygonal Lasso: { pts, mode }
  const [typing, setTyping] = useState(null); // { id, isNew }
  const [space, setSpace] = useState(false);
  const { rt, setRt, acts, selection } = rx;
  // While a transform handle is dragged its shape stays here (only this overlay redraws), and goes to rx on release.
  const [xfDrag, setXfDrag] = useState(null);
  const xform = rx.xform && (xfDrag ? { ...rx.xform, tf: xfDrag } : rx.xform);
  const tool = rt.tool;
  const { ow, oh } = geo;
  const L = Math.max(ow, oh);
  const [ax, ay] = toCss(0, 0), [bx, by] = toCss(1, 0);
  const k = Math.hypot(bx - ax, by - ay); // css px per photo px
  const local = (e) => { const r = svg.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const frac = (X, Y) => { const [x, y] = toOri(X, Y); return [x / ow, y / oh]; };
  const css = (fx, fy) => toCss(fx * ow, fy * oh);
  const t = rt[tool] || {};
  const quickMask = rx.quickMask && ['brush', 'pencil', 'eraser'].includes(tool);

  // Space held: the hand, whatever the tool; tapped, it zooms.
  const tap = useRef(onSpaceTap);
  tap.current = onSpaceTap;
  useEffect(() => {
    let held = null;
    const down = (e) => {
      if (e.code !== 'Space' || e.target.closest?.('input, textarea, select')) return;
      e.preventDefault();
      if (!held) { held = { dragged: false }; setSpace(true); }
    };
    const up = (e) => {
      if (e.code !== 'Space' || !held) return;
      if (!held.dragged) tap.current?.();
      held = null;
      setSpace(false);
    };
    const press = () => { if (held) held.dragged = true; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerdown', press, true);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('pointerdown', press, true); };
  }, []);
  useEffect(() => { lastEnd.current = null; setPoly(null); }, [tool]);
  // A cancelled transform: the layer goes back.
  useEffect(() => { if (!xform) live(null); }, [!!xform]);

  // The Polygonal Lasso takes Enter (close) and Escape (cancel) before Retouch's keys do.
  const closePoly = () => {
    if (poly?.pts.length >= 3) rx.combine({ shapes: [{ kind: 'poly', mode: 'add', pts: poly.pts }], invert: false, feather: rt.feather }, poly.mode);
    setPoly(null);
  };
  useEffect(() => {
    if (!poly) return;
    const key = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setPoly(null); }
      else if (e.key === 'Enter') { e.stopImmediatePropagation(); closePoly(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.stopImmediatePropagation(); setPoly((p) => (p.pts.length > 1 ? { ...p, pts: p.pts.slice(0, -1) } : null)); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const selMode = (e) => (e.shiftKey && e.altKey ? 'and' : e.shiftKey ? 'add' : e.altKey ? 'sub' : rt.selMode || 'new');
  const layerPt = (id, fx, fy) => toLayer(acts.byId(id), fx, fy, ow, oh);

  // --- the free transform box ---
  const xm = xform && tfPx(xform.tf, ow, oh);
  const xBox = xform?.box && (() => {
    const [x0, y0, x1, y1] = xform.box;
    const pts = { nw: [x0, y0], n: [(x0 + x1) / 2, y0], ne: [x1, y0], e: [x1, (y0 + y1) / 2], se: [x1, y1], s: [(x0 + x1) / 2, y1], sw: [x0, y1], w: [x0, (y0 + y1) / 2] };
    return Object.fromEntries(Object.entries(pts).map(([h, [x, y]]) => [h, { local: [x, y], css: toCss(...tfApply(xm, x, y)) }]));
  })();
  const OPP = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };
  const setXf = (tfm) => {
    const tf = tfUnits(tfm, ow, oh);
    setXfDrag(tf);
    if (xform.what === 'layer') live({ layerId: xform.id, tf });
  };
  const xformDown = (e, handle) => {
    e.stopPropagation();
    e.preventDefault();
    svg.current.setPointerCapture(e.pointerId);
    const [X, Y] = local(e);
    const p = toOri(X, Y);
    const [x0, y0, x1, y1] = xform.box;
    drag.current = { xf: handle, m0: xm, p0: p, c: tfApply(xm, (x0 + x1) / 2, (y0 + y1) / 2) };
  };
  const xformMove = (e, d) => {
    const p = toOri(...local(e));
    if (d.xf === 'move') { setXf(tfMul([1, 0, p[0] - d.p0[0], 0, 1, p[1] - d.p0[1]], d.m0)); return; }
    if (d.xf === 'rotate') {
      let deg = ((Math.atan2(p[1] - d.c[1], p[0] - d.c[0]) - Math.atan2(d.p0[1] - d.c[1], d.p0[0] - d.c[0])) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      setXf(tfMul(tfAbout(d.c[0], d.c[1], 1, 1, deg), d.m0));
      return;
    }
    // Scaling: about the opposite handle (or the middle, with Alt), in the box's own space.
    const inv = tfInv(d.m0);
    const [lx, ly] = tfApply(inv, ...p);
    const h = xBox[d.xf].local;
    const a = e.altKey ? [(xform.box[0] + xform.box[2]) / 2, (xform.box[1] + xform.box[3]) / 2] : xBox[OPP[d.xf]].local;
    let sx = d.xf.includes('e') || d.xf.includes('w') ? (lx - a[0]) / (h[0] - a[0] || 1) : 1;
    let sy = d.xf.includes('n') || d.xf.includes('s') ? (ly - a[1]) / (h[1] - a[1] || 1) : 1;
    // Corners keep the proportions (Shift frees them), as in Photoshop.
    if (d.xf.length === 2 && !e.shiftKey) { const s = Math.abs(sx) > Math.abs(sy) ? sx : sy; sx = s; sy = s; }
    setXf(tfMul(d.m0, tfAbout(a[0], a[1], sx || 0.001, sy || 0.001, 0)));
  };

  // --- pointer ---
  const down = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    svg.current.setPointerCapture(e.pointerId);
    const [X, Y] = local(e);
    const [fx, fy] = frac(X, Y);
    if (typing) { finishTyping(); return; }
    if (xform) { xformDown(e, insideBox(X, Y) ? 'move' : 'rotate'); return; }
    // Color Range's dialog samples colours from the photo, whatever the tool.
    if (rx.dialog?.type === 'colorRange') {
      const c = pickColor(X, Y);
      if (c) rx.setDialog((d) => ({ ...d, range: 'sampled', colors: e.shiftKey || e.altKey ? [...d.colors, c.map((v) => v * 255)] : [c.map((v) => v * 255)] }));
      return;
    }
    if (tool === 'dropper') { const c = pickColor(X, Y); if (c) setRt(e.altKey ? { bg: c } : { fg: c }); return; }
    if (tool === 'zoom') { zoomAt(X, Y, e.altKey ? 0.5 : 2); return; }
    if (tool === 'bucket') { rx.bucket(fx, fy); return; }
    if (tool === 'wand') { rx.sel.wand(fx, fy, selMode(e)); return; }
    if (tool === 'polygon') {
      if (!poly) { setPoly({ pts: [[fx, fy]], mode: selMode(e) }); return; }
      const [sx, sy] = css(...poly.pts[0]);
      if (poly.pts.length >= 3 && Math.hypot(X - sx, Y - sy) < 8) closePoly();
      else setPoly({ ...poly, pts: [...poly.pts, [fx, fy]] });
      return;
    }
    if (tool === 'move') {
      const l = rx.cur;
      if (!l) { toast('Pick a layer to move'); return; }
      if (l.kind === 'group') { toast('Pick a layer in the group to move it'); return; }
      if (l.lock?.position || l.lock?.all) { toast(`${l.name} is locked`); return; }
      drag.current = { move: l.id, p0: toOri(X, Y), m0: tfPx(l.tf || IDENT, ow, oh) };
      return;
    }
    if (tool === 'type') {
      const hit = [...acts.layers].reverse().find((l) => l.kind === 'text' && !l.hidden && (() => { const b = layerBounds(l, ow, oh); return b && fx * ow >= b[0] && fx * ow <= b[2] && fy * oh >= b[1] && fy * oh <= b[3]; })());
      if (hit) { rx.setActive(hit.id); setTyping({ id: hit.id }); return; }
      const [lx, ly] = [fx, fy - rt.type.size * L * 0.6 / oh];
      const text = { ...TEXT_DEFAULT, ...rt.type, color: rt.fg, text: '', x: lx, y: ly };
      const id = acts.insert(newLayer(acts.layers, 'Text', 'text', { text }), 'Type Tool');
      setTyping({ id, isNew: true });
      return;
    }
    if (SHAPE_TOOLS[tool] || tool === 'gradient' || tool === 'marquee' || tool === 'ellipse' || tool === 'redeye') {
      drag.current = { box: true, start: [fx, fy], startCss: [X, Y], mode: selMode(e), alt: e.altKey };
      // A new selection dragged from inside the current one moves it instead.
      if ((tool === 'marquee' || tool === 'ellipse') && selection && drag.current.mode === 'new' && inSelection(selection, fx, fy, ow, oh)) drag.current = { moveSel: [fx, fy] };
      return;
    }
    if (tool === 'lasso' || tool === 'patch') {
      if (selection && (tool === 'patch' || selMode(e) === 'new') && inSelection(selection, fx, fy, ow, oh)) {
        drag.current = tool === 'patch' ? { patch: [fx, fy] } : { moveSel: [fx, fy] };
        return;
      }
      drag.current = { lasso: true, mode: tool === 'patch' ? 'new' : selMode(e), pts: [[fx, fy]], startCss: [X, Y] };
      return;
    }
    if (tool === 'quick') {
      drag.current = { quick: true, pts: [[fx, fy]], mode: e.altKey ? 'sub' : selection ? 'add' : selMode(e) };
      setDraft({ stroke: { pts: [[fx, fy]], size: t.size, sub: e.altKey } });
      return;
    }
    if (!BRUSHES.has(tool)) return;
    // Quick Mask: painting changes the selection (white adds, black takes away).
    if (quickMask) {
      const sub = tool === 'eraser' ? grey(rt.bg)[0] < 0.5 : grey(rt.fg)[0] < 0.5;
      drag.current = { qm: true, pts: [[fx, fy]], sub };
      setDraft({ stroke: { pts: [[fx, fy]], size: t.size, sub } });
      return;
    }
    const sourced = tool === 'clone' || tool === 'heal';
    if (sourced && e.altKey) { rx.setCloneSrc({ x: fx, y: fy, offset: null }); toast('Source set: now paint where it should go'); return; }
    if (sourced && !rx.cloneSrc) { toast('Alt+click the spot to copy from first'); return; }
    const target = rx.paintTarget(tool);
    if (!target) return;
    const kind = OP_OF[tool];
    const pt = layerPt(target.id, fx, fy);
    const op = { id: newId(), t: kind, size: t.size, hard: t.hard ?? 50, opacity: t.opacity ?? 100, flow: t.flow ?? 100, pts: [pt] };
    if (e.shiftKey && lastEnd.current) op.pts.unshift(lastEnd.current);
    if (tool === 'pencil') op.alias = true;
    if (kind === 'paint') op.color = target.mask ? grey(rt.fg) : rt.fg;
    if (kind === 'erase' && target.mask) { op.t = 'paint'; op.color = grey(rt.bg); }
    if (target.keepAlpha) op.keepAlpha = true;
    if ('strength' in t) op.strength = t.strength;
    if ('range' in t) op.range = t.range;
    if (t.protect) op.protect = true;
    if (selection) op.clip = selection;
    if (sourced) {
      const off = rt.aligned && rx.cloneSrc.offset ? rx.cloneSrc.offset : { dx: rx.cloneSrc.x - fx, dy: rx.cloneSrc.y - fy };
      if (rt.aligned && !rx.cloneSrc.offset) rx.setCloneSrc({ ...rx.cloneSrc, offset: off });
      Object.assign(op, off);
    }
    drag.current = { op, target, last: [X, Y] };
    live({ layerId: target.id, op: shown(op), target: target.mask ? 'mask' : undefined });
  };
  // A spot heal shows as a see-through stroke until its source is found.
  const shown = (op) => (op.t === 'spot' ? { ...op, t: 'paint', color: [0.85, 0.25, 0.35], opacity: 45, flow: 100 } : op);

  const boxTo = (d, fx, fy, e, square) => {
    let [x1, y1] = [fx, fy];
    if (e.shiftKey && square) {
      const w = (x1 - d.start[0]) * ow, h = (y1 - d.start[1]) * oh, m = Math.max(Math.abs(w), Math.abs(h));
      x1 = d.start[0] + (Math.sign(w) * m) / ow; y1 = d.start[1] + (Math.sign(h) * m) / oh;
    }
    // Alt: drawn from the middle.
    const x0 = d.alt && square ? 2 * d.start[0] - x1 : d.start[0], y0 = d.alt && square ? 2 * d.start[1] - y1 : d.start[1];
    return { x0, y0, x1, y1 };
  };

  const move = (e) => {
    const [X, Y] = local(e);
    setCursor([X, Y]);
    const d = drag.current;
    if (!d) return;
    const [fx, fy] = frac(X, Y);
    if (d.xf) { xformMove(e, d); return; }
    if (d.move) {
      const p = toOri(X, Y);
      let dx = p[0] - d.p0[0], dy = p[1] - d.p0[1];
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      d.tf = tfUnits(tfMul([1, 0, dx, 0, 1, dy], d.m0), ow, oh);
      live({ layerId: d.move, tf: d.tf });
      return;
    }
    if (d.moveSel) { rx.sel.move(fx - d.moveSel[0], fy - d.moveSel[1]); d.moveSel = [fx, fy]; return; }
    if (d.patch) { d.to = [fx, fy]; setDraft({ patch: [fx - d.patch[0], fy - d.patch[1]] }); return; }
    if (d.box) {
      if (tool === 'gradient') {
        let [x1, y1] = [fx, fy];
        if (e.shiftKey) { // 45° steps
          const dx = (x1 - d.start[0]) * ow, dy = (y1 - d.start[1]) * oh, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), r = Math.hypot(dx, dy);
          x1 = d.start[0] + (Math.cos(a) * r) / ow; y1 = d.start[1] + (Math.sin(a) * r) / oh;
        }
        d.line = [d.start, [x1, y1]];
        if (!d.target) d.target = rx.paintTarget('gradient');
        if (!d.target) { drag.current = null; return; }
        d.op = gradientOp(d.target, d.line);
        live({ layerId: d.target.id, op: d.op, target: d.target.mask ? 'mask' : undefined });
        setDraft({ line: d.line });
        return;
      }
      d.shape = boxTo(d, fx, fy, e, true);
      setDraft(SHAPE_TOOLS[tool] ? { shape: { kind: SHAPE_TOOLS[tool], ...(tool === 'line' ? { x0: d.start[0], y0: d.start[1], x1: fx, y1: fy } : d.shape) } }
        : { sel: { kind: tool === 'ellipse' ? 'ellipse' : 'rect', ...d.shape } });
      return;
    }
    if (d.lasso) { d.pts.push([fx, fy]); setDraft({ sel: { kind: 'poly', pts: d.pts.slice() } }); return; }
    if (d.quick || d.qm) { d.pts.push([fx, fy]); setDraft({ stroke: { pts: d.pts.slice(), size: t.size, sub: d.sub || d.mode === 'sub' } }); return; }
    if (d.op) {
      if (Math.hypot(X - d.last[0], Y - d.last[1]) < 1.5) return;
      d.last = [X, Y];
      d.op.pts.push(layerPt(d.target.id, fx, fy));
      d.op = { ...d.op }; // a new object each time: the screen draws it again
      live({ layerId: d.target.id, op: shown(d.op), target: d.target.mask ? 'mask' : undefined });
    }
  };

  const gradientOp = (target, [[x0, y0], [x1, y1]]) => {
    const g = rt.gradient;
    const [p0, p1] = [layerPt(target.id, x0, y0), layerPt(target.id, x1, y1)];
    let c0 = [...rt.fg, 1], c1 = g.colors === 'fgtrans' ? [...rt.fg, 0] : g.colors === 'bw' ? [0, 0, 0, 1] : [...rt.bg, 1];
    if (g.colors === 'bw') { c0 = [0, 0, 0, 1]; c1 = [1, 1, 1, 1]; }
    if (target.mask) { c0 = [...grey(c0), c0[3]]; c1 = [...grey(c1), c1[3]]; }
    if (g.reverse) [c0, c1] = [c1, c0];
    return { id: newId(), t: 'gradient', style: g.style, x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], c0, c1, opacity: g.opacity, ...(selection ? { clip: selection } : {}), ...(target.keepAlpha ? { keepAlpha: true } : {}) };
  };

  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const [X, Y] = local(e);
    if (d.xf) { if (xfDrag) rx.setXform((x) => x && { ...x, tf: xfDrag }); setXfDrag(null); return; }
    if (d.move) { if (d.tf) acts.change(d.move, { tf: d.tf }, 'Move'); return; }
    if (d.moveSel) return;
    setDraft(null);
    if (d.patch) {
      if (!d.to) return;
      const target = rx.paintTarget('patch');
      if (target) acts.addOp(target.id, { id: newId(), t: 'patch', clip: selection, dx: d.to[0] - d.patch[0], dy: d.to[1] - d.patch[1] }, false, 'Patch Tool');
      return;
    }
    const tiny = d.startCss && Math.hypot(X - d.startCss[0], Y - d.startCss[1]) < 3;
    if (d.box) {
      if (tool === 'gradient') { if (d.op) commit(d.target.id, d.op, d.target.mask, 'Gradient'); return; }
      if (tool === 'redeye') {
        const [fx, fy] = d.start;
        const sel = tiny || !d.shape ? ellipse(fx, fy, (rt.redeye.size * L) / ow, (rt.redeye.size * L) / oh)
          : { shapes: [{ kind: 'ellipse', mode: 'add', ...d.shape }], invert: false, feather: 0 };
        const target = rx.paintTarget('redeye');
        if (target) acts.addOp(target.id, { id: newId(), t: 'redeye', clip: sel, strength: rt.redeye.darken }, false, 'Red Eye');
        return;
      }
      if (SHAPE_TOOLS[tool]) {
        if (tiny || !d.shape) return;
        const sh = rt.shape;
        const kind = SHAPE_TOOLS[tool];
        const box = tool === 'line' ? { x0: d.start[0], y0: d.start[1], x1: frac(X, Y)[0], y1: frac(X, Y)[1] } : d.shape;
        const label = { rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle', polygon: 'Polygon', line: 'Line' }[kind];
        acts.insert(newLayer(acts.layers, nextName(acts.layers, label), 'shape', {
          shape: { kind, ...box, fill: sh.noFill ? null : rt.fg, stroke: sh.strokeOn ? { color: sh.strokeColor || rt.bg, width: sh.strokeW } : null, radius: sh.radius, sides: sh.sides, star: sh.star, weight: sh.weight },
        }), `${label} Tool`);
        return;
      }
      if (tiny || !d.shape) { if (d.mode === 'new') rx.sel.deselect(); return; }
      rx.combine({ shapes: [{ kind: tool === 'ellipse' ? 'ellipse' : 'rect', mode: 'add', ...d.shape }], invert: false, feather: rt.feather }, d.mode);
      return;
    }
    if (d.lasso) {
      if (tiny || d.pts.length < 3) { if (d.mode === 'new') rx.sel.deselect(); return; }
      rx.combine({ shapes: [{ kind: 'poly', mode: 'add', pts: d.pts }], invert: false, feather: rt.feather }, d.mode);
      return;
    }
    if (d.quick) { rx.sel.quick(d.pts, t.size, d.mode); return; }
    if (d.qm) {
      const shape = { kind: 'stroke', mode: 'add', pts: d.pts, size: t.size };
      rx.combine({ shapes: [shape], invert: false, feather: 0 }, d.sub ? 'sub' : 'add');
      return;
    }
    if (d.op) {
      lastEnd.current = d.op.pts[d.op.pts.length - 1];
      commit(d.target.id, d.op, d.target.mask, LABEL[tool]);
    }
  };
  const dbl = (e) => {
    if (tool === 'polygon' && poly) { e.preventDefault(); closePoly(); }
    else if (xform) rx.commitTransform();
  };

  // --- typing on a type layer ---
  const typed = typing && acts.byId(typing.id);
  const finishTyping = () => {
    const l = typing && acts.byId(typing.id);
    setTyping(null);
    if (!l) return;
    if (!l.text.text.trim()) { acts.remove(l.id); return; }
    const name = l.text.text.trim().split('\n')[0].slice(0, 30);
    if (name !== l.name) acts.rename(l.id, name);
  };

  // --- what's drawn ---
  const outline = useMemo(() => (selection ? selectionOutline(xform?.what === 'selection' ? { ...selection, tf: null } : selection, ow, oh) : null), [selection, xform?.what === 'selection', ow, oh]);
  const ants = outline && (() => {
    if (xform?.what === 'selection') { const m = tfPx(xform.tf, ow, oh); return pathOf(outline, (x, y) => toCss(...tfApply(m, x * ow, y * oh))); }
    if (draft?.patch) return pathOf(outline, (x, y) => css(x + draft.patch[0], y + draft.patch[1]));
    return pathOf(outline, css);
  })();
  const draftPath = draft?.sel && (() => {
    const sh = draft.sel;
    if (sh.kind === 'poly') return pathOf([sh.pts], css);
    if (sh.kind === 'rect') return pathOf([[[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1], [sh.x0, sh.y1]]], css);
    return pathOf([Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return [(sh.x0 + sh.x1) / 2 + (Math.cos(a) * (sh.x1 - sh.x0)) / 2, (sh.y0 + sh.y1) / 2 + (Math.sin(a) * (sh.y1 - sh.y0)) / 2]; })], css);
  })();
  // Quick Mask: a red tint over what isn't selected.
  const tint = useMemo(() => {
    if (!rx.quickMask) return null;
    const e = 768 / L, w = Math.max(8, Math.round(ow * e)), h = Math.max(8, Math.round(oh * e));
    const v = selection ? selectionValues(selection, w, h, ow, oh) : new Uint8Array(w * h);
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { img.data[i * 4] = 255; img.data[i * 4 + 3] = (255 - v[i]) * 0.5; }
    ctx.putImageData(img, 0, 0);
    return { url: c.toDataURL ? c.toDataURL() : null, w, h };
  }, [rx.quickMask, selection, ow, oh]);
  const [o0, o1, o2] = [toCss(0, 0), toCss(ow, 0), toCss(0, oh)];
  const photoMatrix = `matrix(${(o1[0] - o0[0]) / ow} ${(o1[1] - o0[1]) / ow} ${(o2[0] - o0[0]) / oh} ${(o2[1] - o0[1]) / oh} ${o0[0]} ${o0[1]})`;

  const brushR = (BRUSHES.has(tool) || tool === 'redeye') && !rx.dialog ? Math.max(1, t.size * L * k) : 0;
  const sourced = tool === 'clone' || tool === 'heal';
  const srcCss = rx.cloneSrc && sourced && css(rx.cloneSrc.x, rx.cloneSrc.y);
  const off = rx.cloneSrc && (drag.current?.op?.dx != null ? drag.current.op : rt.aligned ? rx.cloneSrc.offset : null);
  const srcCursor = cursor && off && sourced && (() => { const [x, y] = frac(...cursor); return css(x + off.dx, y + off.dy); })();
  const insideBox = (X, Y) => {
    if (!xBox) return false;
    const q = ['nw', 'ne', 'se', 'sw'].map((h) => xBox[h].css);
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      if ((q[i][1] > Y) !== (q[j][1] > Y) && X < ((q[j][0] - q[i][0]) * (Y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) inside = !inside;
    }
    return inside;
  };
  const rotating = xform && cursor && !insideBox(...cursor);
  const view = rt.view;
  const cls = `mask-stage rt-stage tool-${tool}${space || (tool === 'hand' && !xform) ? ' panning' : ''}${brushR ? ' brush' : ''}${xform ? (rotating ? ' rotating' : ' xform') : ''}`;
  return (
    <>
      <svg ref={svg} className={cls} onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={dbl} onPointerLeave={() => setCursor(null)}>
        {tint?.url && <image href={tint.url} width={ow} height={oh} transform={photoMatrix} preserveAspectRatio="none" style={{ pointerEvents: 'none' }} />}
        {view.extras && view.grid && <Grid toCss={toCss} ow={ow} oh={oh} />}
        {ants && view.extras && !rx.quickMask && <><path className="rt-ants-bg" d={ants} /><path className="rt-ants" d={ants} /></>}
        {draftPath && <><path className="rt-ants-bg" d={draftPath} /><path className="rt-ants" d={draftPath} /></>}
        {poly && (() => {
          const pts = [...poly.pts, ...(cursor ? [frac(...cursor)] : [])];
          const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${css(x, y).join(' ')}`).join('');
          const [sx, sy] = css(...poly.pts[0]);
          return <><path className="rt-ants-bg" d={d} /><path className="rt-ants" d={d} /><circle className="rt-poly-start" cx={sx} cy={sy} r={4} /></>;
        })()}
        {draft?.stroke && <polyline className={`rt-qm-stroke${draft.stroke.sub ? ' sub' : ''}`} points={draft.stroke.pts.map(([x, y]) => css(x, y).join(',')).join(' ')}
          strokeWidth={Math.max(2, draft.stroke.size * L * k * 2)} />}
        {draft?.line && (() => { const [a, b] = draft.line.map(([x, y]) => css(x, y)); return <g className="rt-grad"><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /><circle cx={a[0]} cy={a[1]} r={3.5} /><circle cx={b[0]} cy={b[1]} r={3.5} /></g>; })()}
        {draft?.shape && <ShapeDraft sh={draft.shape} css={css} />}
        {typed && (() => { const b = layerBounds(typed, ow, oh) || [0, 0, 0, 0]; const [p, q] = [toCss(b[0], b[1]), toCss(b[2], b[3])]; return <rect className="rt-type-box" x={Math.min(p[0], q[0])} y={Math.min(p[1], q[1])} width={Math.abs(q[0] - p[0])} height={Math.abs(q[1] - p[1])} />; })()}
        {xBox && (
          <g className="rt-xform">
            <path className="rt-xform-box" d={`M${['nw', 'ne', 'se', 'sw'].map((h) => xBox[h].css.join(' ')).join('L')}Z`} />
            {Object.entries(xBox).map(([h, { css: [x, y] }]) => <rect key={h} className={`rt-handle h-${h}`} x={x - 4} y={y - 4} width={8} height={8} onPointerDown={(e) => xformDown(e, h)} />)}
            {(() => { const c = toCss(...tfApply(xm, (xform.box[0] + xform.box[2]) / 2, (xform.box[1] + xform.box[3]) / 2)); return <circle className="rt-pivot" cx={c[0]} cy={c[1]} r={4} />; })()}
          </g>
        )}
        {view.extras && view.guides && rx.guides.map((g, i) => <Guide key={i} g={g} i={i} rx={rx} toCss={toCss} toOri={toOri} ow={ow} oh={oh} svg={svg} />)}
        {srcCss && !off && <g className="rt-src"><circle cx={srcCss[0]} cy={srcCss[1]} r={Math.max(4, brushR)} /><path d={`M${srcCss[0] - 6} ${srcCss[1]}h12M${srcCss[0]} ${srcCss[1] - 6}v12`} /></g>}
        {srcCursor && <g className="rt-src"><circle cx={srcCursor[0]} cy={srcCursor[1]} r={Math.max(4, brushR)} /><path d={`M${srcCursor[0] - 6} ${srcCursor[1]}h12M${srcCursor[0]} ${srcCursor[1] - 6}v12`} /></g>}
        {cursor && brushR > 0 && !space && (
          <g className="mask-cursor"><circle cx={cursor[0]} cy={cursor[1]} r={brushR} />
            {t.hard < 95 && <circle className="inner" cx={cursor[0]} cy={cursor[1]} r={Math.max(1, brushR * (t.hard / 100))} />}</g>
        )}
      </svg>
      {view.rulers && <Rulers toCss={toCss} toOri={toOri} ow={ow} oh={oh} rx={rx} />}
      {typed && <TypeBox l={typed} acts={acts} toCss={toCss} ow={ow} oh={oh} onDone={finishTyping} />}
    </>
  );
}

function ShapeDraft({ sh, css }) {
  const [a, b] = [css(sh.x0, sh.y0), css(sh.x1, sh.y1)];
  if (sh.kind === 'line') return <line className="rt-shape-draft" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
  if (sh.kind === 'ellipse') return <ellipse className="rt-shape-draft" cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />;
  return <rect className="rt-shape-draft" x={x} y={y} width={w} height={h} />;
}

function Grid({ toCss, ow, oh }) {
  const L = Math.max(ow, oh), step = L / 10, sub = step / 4;
  const lines = [];
  for (let x = sub, i = 1; x < ow; x += sub, i++) lines.push([x, 0, x, oh, i % 4 === 0]);
  for (let y = sub, i = 1; y < oh; y += sub, i++) lines.push([0, y, ow, y, i % 4 === 0]);
  return (
    <g className="rt-grid">
      {lines.map(([x0, y0, x1, y1, major], i) => { const [a, b] = [toCss(x0, y0), toCss(x1, y1)]; return <line key={i} className={major ? 'major' : ''} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />; })}
    </g>
  );
}

// A guide: dragged along, or off the photo to remove it.
function Guide({ g, i, rx, toCss, toOri, ow, oh, svg }) {
  const [a, b] = g.v ? [toCss(g.at * ow, 0), toCss(g.at * ow, oh)] : [toCss(0, g.at * oh), toCss(ow, g.at * oh)];
  const down = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = svg.current.getBoundingClientRect();
    const at = (ev) => { const [x, y] = toOri(ev.clientX - r.left, ev.clientY - r.top); return g.v ? x / ow : y / oh; };
    const el = e.currentTarget;
    const mv = (ev) => rx.setGuides((gs) => gs.map((x, j) => (j === i ? { ...x, at: at(ev) } : x)));
    const done = (ev) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', done);
      const v = at(ev);
      if (v < 0 || v > 1) rx.setGuides((gs) => gs.filter((_, j) => j !== i));
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', done);
  };
  return (
    <g className={`rt-guide${g.v ? ' v' : ''}`}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <line className="hit" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} onPointerDown={down} />
    </g>
  );
}

// Rulers in photo pixels; drag out of one for a guide.
function Rulers({ toCss, toOri, ow, oh, rx }) {
  const k = Math.hypot(...[0, 1].map((i) => toCss(1, 0)[i] - toCss(0, 0)[i]));
  const raw = 60 / k, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const ticks = (n) => { const out = []; for (let v = 0; v <= n; v += step) out.push(v); return out; };
  const start = (v) => (e) => {
    e.preventDefault();
    const stage = e.currentTarget.parentElement.getBoundingClientRect();
    const idx = rx.guides.length;
    const at = (ev) => { const [x, y] = toOri(ev.clientX - stage.left, ev.clientY - stage.top); return v ? x / ow : y / oh; };
    rx.setGuides((gs) => [...gs, { v, at: at(e) }]);
    const mv = (ev) => rx.setGuides((gs) => gs.map((g, j) => (j === idx ? { ...g, at: at(ev) } : g)));
    const up = (ev) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      const a = at(ev);
      if (a < 0 || a > 1) rx.setGuides((gs) => gs.filter((_, j) => j !== idx));
      else rx.setRt({ view: { ...rx.rt.view, guides: true, extras: true } });
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  return (
    <>
      <div className="rt-ruler top" onPointerDown={start(false)} title="Drag down for a guide">
        {ticks(ow).map((v) => <span key={v} style={{ left: toCss(v, 0)[0] }}>{Math.round(v)}</span>)}
      </div>
      <div className="rt-ruler left" onPointerDown={start(true)} title="Drag right for a guide">
        {ticks(oh).map((v) => <span key={v} style={{ top: toCss(0, v)[1] }}>{Math.round(v)}</span>)}
      </div>
    </>
  );
}

// The words of a type layer, typed under it; the photo shows them as they'll look.
function TypeBox({ l, acts, toCss, ow, oh, onDone }) {
  const b = layerBounds(l, ow, oh) || [l.text.x * ow, l.text.y * oh, l.text.x * ow, l.text.y * oh];
  const [p, q] = [toCss(b[0], b[1]), toCss(b[2], b[3])];
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, [l.id]);
  return (
    <div className="rt-typebox" style={{ left: Math.min(p[0], q[0]), top: Math.max(p[1], q[1]) + 8 }} onPointerDown={(e) => e.stopPropagation()}>
      <textarea ref={ref} value={l.text.text} placeholder="Type here" rows={Math.max(1, l.text.text.split('\n').length)}
        style={{ color: hex(l.text.color) }}
        onChange={(e) => acts.change(l.id, { text: { ...l.text, text: e.target.value } }, 'Edit Type')}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onDone(); } }} />
      <button className="btn btn-sm btn-primary" onClick={onDone} title="Commit (Ctrl+Enter)">✓</button>
    </div>
  );
}
