// The Retouch tab: Photoshop-style tools and layers over the live Develop
// photo (develop/retouch.js holds the data, develop/compose.js draws it).
// It is the Develop tab in another mode, so switching (Ctrl+E) keeps the
// same RAW, renderer, settings and undo history: nothing is exported.
import { useEffect, useRef, useState } from 'react';
import { Dropdown, Icon } from './ui.jsx';
import { Slider } from './slider.jsx';
import { newId } from '../develop/masks.js';
import { BLEND_MODES, newLayer } from '../develop/retouch.js';

// [id, label, icon, key]
export const TOOLS = [
  ['brush', 'Brush', 'brush', 'B'],
  ['eraser', 'Eraser', 'eraser', 'E'],
  ['clone', 'Clone Stamp', 'stamp', 'S'],
  ['spot', 'Spot Healing Brush', 'spot', 'J'],
  ['heal', 'Healing Brush', 'heal', 'Shift+J'],
  ['marquee', 'Rectangular Marquee', 'marquee', 'M'],
  ['ellipse', 'Elliptical Marquee', 'ellipseSel', 'Shift+M'],
  ['lasso', 'Lasso', 'lasso', 'L'],
  ['dropper', 'Eyedropper', 'dropper', 'I'],
  ['hand', 'Hand', 'hand', 'H'],
];
const BRUSHES = new Set(['brush', 'eraser', 'clone', 'spot', 'heal']);
const SELECTORS = new Set(['marquee', 'ellipse', 'lasso']);

// Per tool: size is the brush radius as a fraction of the photo's long edge.
export const RETOUCH_DEFAULT = {
  tool: 'brush', fg: [0, 0, 0], bg: [1, 1, 1], feather: 0, aligned: true,
  brush: { size: 0.006, hard: 80, opacity: 100, flow: 100 },
  eraser: { size: 0.01, hard: 60, opacity: 100, flow: 100 },
  clone: { size: 0.01, hard: 50, opacity: 100, flow: 100 },
  spot: { size: 0.008, hard: 50 },
  heal: { size: 0.008, hard: 50 },
};

const hex = (c) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const unhex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** Edits to the layers of `s`; `active` is the layer id strokes go to. */
export function retouchActions(s, update, active, setActive) {
  const layers = s?.layers || [];
  const mapLayer = (id, fn) => update((old) => ({ ...old, layers: (old.layers || []).map((l) => (l.id === id ? fn(l) : l)) }));
  return {
    layers,
    /** The layer to paint on, made if there is none (a hidden one is shown again). */
    target() {
      const cur = layers.find((l) => l.id === active);
      if (cur?.hidden) mapLayer(cur.id, (l) => ({ ...l, hidden: false }));
      if (cur) return cur.id;
      const l = newLayer(layers);
      update((old) => ({ ...old, layers: [...(old.layers || []), l] }));
      setActive(l.id);
      return l.id;
    },
    add() {
      const l = newLayer(layers);
      const at = layers.findIndex((x) => x.id === active);
      update((old) => { const ls = [...(old.layers || [])]; ls.splice(at < 0 ? ls.length : at + 1, 0, l); return { ...old, layers: ls }; });
      setActive(l.id);
    },
    addOp: (id, op) => mapLayer(id, (l) => ({ ...l, ops: [...l.ops, op] })),
    change: (id, patch) => mapLayer(id, (l) => ({ ...l, ...patch })),
    remove(id) {
      const i = layers.findIndex((l) => l.id === id);
      update((old) => ({ ...old, layers: (old.layers || []).filter((l) => l.id !== id) }));
      if (id === active) setActive(layers[i - 1]?.id || layers[i + 1]?.id || null);
    },
    duplicate(id) {
      const l = layers.find((x) => x.id === id);
      if (!l) return;
      const copy = { ...l, id: newId(), name: `${l.name} copy`, ops: l.ops.map((op) => ({ ...op, id: newId() })) };
      update((old) => { const ls = [...(old.layers || [])]; ls.splice(ls.findIndex((x) => x.id === id) + 1, 0, copy); return { ...old, layers: ls }; });
      setActive(copy.id);
    },
    move(id, dir) {
      update((old) => {
        const ls = [...(old.layers || [])];
        const i = ls.findIndex((l) => l.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= ls.length) return old;
        [ls[i], ls[j]] = [ls[j], ls[i]];
        return { ...old, layers: ls };
      });
    },
    /** Merges a layer into the one below it (its ops drawn there; blend mode and opacity are folded in where they can be). */
    mergeDown(id) {
      const i = layers.findIndex((l) => l.id === id);
      if (i < 1) return;
      const top = layers[i], below = layers[i - 1];
      const k = top.opacity / 100;
      const ops = top.ops.map((op) => ('opacity' in op || op.t === 'fill' ? { ...op, opacity: (op.opacity ?? 100) * k } : op));
      update((old) => ({ ...old, layers: (old.layers || []).filter((l) => l.id !== id).map((l) => (l.id === below.id ? { ...l, ops: [...l.ops, ...ops] } : l)) }));
      setActive(below.id);
    },
  };
}

// --- left: the tools ---------------------------------------------------------

export function RetouchTools({ tool, setTool, fg, bg, setColors }) {
  const pickFg = useRef(), pickBg = useRef();
  return (
    <div className="rt-tools">
      {TOOLS.map(([id, label, icon, key]) => (
        <button key={id} className={`icon-btn rt-tool${tool === id ? ' on' : ''}`} title={`${label} (${key})`} onClick={() => setTool(id)}>
          <Icon name={icon} size={17} />
        </button>
      ))}
      <div className="rt-colors" title="Foreground and background colours (X swaps, D resets)">
        <button className="rt-swatch bg" style={{ background: hex(bg) }} onClick={() => pickBg.current.click()} aria-label="Background colour" />
        <button className="rt-swatch fg" style={{ background: hex(fg) }} onClick={() => pickFg.current.click()} aria-label="Foreground colour" />
        <input ref={pickFg} type="color" value={hex(fg)} onChange={(e) => setColors({ fg: unhex(e.target.value) })} />
        <input ref={pickBg} type="color" value={hex(bg)} onChange={(e) => setColors({ bg: unhex(e.target.value) })} />
      </div>
      <button className="icon-btn tiny" title="Swap colours (X)" onClick={() => setColors({ fg: bg, bg: fg })}><Icon name="swap" size={13} /></button>
    </div>
  );
}

// --- the options bar over the photo -------------------------------------------

export function RetouchOptions({ tool, opts, setOpts, longEdge, selection, sel }) {
  const t = opts[tool] || {};
  const set = (patch) => setOpts({ [tool]: { ...t, ...patch } });
  const px = (f) => Math.max(1, Math.round(f * longEdge));
  const sizeSl = { key: 'size', label: 'Size', min: 1, max: 2500, step: 1, log: true };
  const pct = (key, label) => ({ key, label, min: 1, max: 100, step: 1 });
  const onSet = (key, v) => set({ [key]: key === 'size' ? v / longEdge : v });
  const label = TOOLS.find((x) => x[0] === tool)?.[1];
  return (
    <div className="rt-options">
      <span className="rt-opt-name">{label}</span>
      {BRUSHES.has(tool) && (
        <>
          <div className="rt-opt"><Slider sl={sizeSl} value={px(t.size)} def={px(RETOUCH_DEFAULT[tool].size)} onSet={onSet} /></div>
          <div className="rt-opt"><Slider sl={pct('hard', 'Hardness')} value={t.hard} def={RETOUCH_DEFAULT[tool].hard} onSet={onSet} /></div>
          {'opacity' in t && <div className="rt-opt"><Slider sl={pct('opacity', 'Opacity')} value={t.opacity} def={100} onSet={onSet} /></div>}
          {'flow' in t && <div className="rt-opt"><Slider sl={pct('flow', 'Flow')} value={t.flow} def={100} onSet={onSet} /></div>}
          {(tool === 'clone' || tool === 'heal') && (
            <>
              <label className="dev-check inline rt-check"><input type="checkbox" checked={opts.aligned} onChange={(e) => setOpts({ aligned: e.target.checked })} />Aligned</label>
              <span className="muted small rt-hint">Alt+click sets the source</span>
            </>
          )}
          {tool === 'spot' && <span className="muted small rt-hint">Paint over a spot: the source is picked for you</span>}
        </>
      )}
      {SELECTORS.has(tool) && (
        <>
          <div className="rt-opt"><Slider sl={{ key: 'feather', label: 'Feather', min: 0, max: 250, step: 1 }} value={Math.round(opts.feather * longEdge)} def={0}
            onSet={(k, v) => setOpts({ feather: v / longEdge })} /></div>
          <span className="muted small rt-hint">Shift adds, Alt subtracts</span>
        </>
      )}
      {tool === 'dropper' && <span className="muted small rt-hint">Click the photo to pick the brush colour</span>}
      {tool === 'hand' && <span className="muted small rt-hint">Drag to move around a zoomed photo, click to zoom (Space works with any tool)</span>}
      {selection && (
        <div className="rt-sel-btns">
          <button className="btn btn-sm" onClick={sel.fill} title="Fill with the foreground colour (Alt+Backspace)">Fill</button>
          <button className="btn btn-sm" onClick={sel.clear} title="Clear the active layer inside the selection (Delete)">Clear</button>
          <button className="btn btn-sm" onClick={sel.invert} title="Invert (Ctrl+Shift+I)">Invert</button>
          <button className="btn btn-sm btn-ghost" onClick={sel.deselect} title="Deselect (Ctrl+D)">Deselect</button>
        </div>
      )}
    </div>
  );
}

// --- right: the layers -----------------------------------------------------------

export function LayersPanel({ layers, active, setActive, acts, onDevelop }) {
  const [renaming, setRenaming] = useState(null);
  const cur = layers.find((l) => l.id === active);
  const opSl = { key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1 };
  return (
    <div className="rt-panel">
      <div className="mask-head"><Icon name="layers" size={15} /><span className="grow" style={{ marginLeft: 6 }}>Layers</span></div>
      <div className="rt-layer-props">
        <Dropdown className="grow" value={cur?.blend || 'normal'} disabled={!cur} title="Blend mode"
          options={BLEND_MODES.map(([value, label]) => ({ value, label }))} onChange={(blend) => acts.change(cur.id, { blend })} />
      </div>
      <Slider sl={opSl} value={cur ? cur.opacity : 100} def={100} onSet={(k, v) => cur && acts.change(cur.id, { opacity: v })} />
      <div className="rt-layers">
        {[...layers].reverse().map((l) => (
          <div key={l.id} className={`rt-layer${l.id === active ? ' on' : ''}${l.hidden ? ' off' : ''}`} onClick={() => setActive(l.id)}
            onDoubleClick={() => setRenaming(l.id)}>
            <button className="icon-btn tiny" title={l.hidden ? 'Show layer' : 'Hide layer'} onClick={(e) => { e.stopPropagation(); acts.change(l.id, { hidden: !l.hidden }); }}>
              <Icon name={l.hidden ? 'eyeOff' : 'eye'} size={14} />
            </button>
            {renaming === l.id ? (
              <input className="mask-rename" autoFocus defaultValue={l.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { acts.change(l.id, { name: e.target.value.trim() || l.name }); setRenaming(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
            ) : (
              <span className="rt-layer-name grow">{l.name}</span>
            )}
            <span className="rt-layer-meta">{l.blend !== 'normal' ? BLEND_MODES.find((b) => b[0] === l.blend)?.[1] : ''}{l.opacity < 100 ? ` ${l.opacity}%` : ''}</span>
          </div>
        ))}
        <div className="rt-layer base" title="The photo as developed. Edits in Develop show here at once.">
          <Icon name="develop" size={14} />
          <span className="rt-layer-name grow">Developed photo</span>
          <button className="btn btn-sm btn-ghost" onClick={onDevelop} title="Back to Develop (Ctrl+E)">Develop</button>
        </div>
      </div>
      <div className="rt-layer-btns">
        <button className="icon-btn" title="New layer (Ctrl+Shift+N)" onClick={acts.add}><Icon name="plus" size={15} /></button>
        <button className="icon-btn" title="Duplicate layer (Ctrl+J)" disabled={!cur} onClick={() => acts.duplicate(cur.id)}><Icon name="copy" size={15} /></button>
        <button className="icon-btn" title="Move up" disabled={!cur || layers.at(-1)?.id === cur.id} onClick={() => acts.move(cur.id, 1)}><Icon name="up" size={15} /></button>
        <button className="icon-btn" title="Move down" disabled={!cur || layers[0]?.id === cur.id} onClick={() => acts.move(cur.id, -1)}><Icon name="down" size={15} /></button>
        <button className="icon-btn" title="Merge down" disabled={!cur || layers[0]?.id === cur.id} onClick={() => acts.mergeDown(cur.id)}><Icon name="layers" size={15} /></button>
        <span className="grow" />
        <button className="icon-btn" title="Delete layer" disabled={!cur} onClick={() => acts.remove(cur.id)}><Icon name="trash" size={15} /></button>
      </div>
      <p className="muted small rt-note">
        Layers sit on top of the developed photo and stay live: change anything in Develop and every brush stroke, clone and heal here follows at once.
        They are saved with the photo's edits and included when you export.
      </p>
    </div>
  );
}

// --- on the photo ----------------------------------------------------------------

/** A selection's outline as SVG path data in css px. */
function selectionPath(sel, toCss, ow, oh) {
  return sel.shapes.map((sh) => {
    const pts = sh.kind === 'poly' ? sh.pts
      : sh.kind === 'rect' ? [[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1], [sh.x0, sh.y1]]
        : Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return [(sh.x0 + sh.x1) / 2 + (Math.cos(a) * Math.abs(sh.x1 - sh.x0)) / 2, (sh.y0 + sh.y1) / 2 + (Math.sin(a) * Math.abs(sh.y1 - sh.y0)) / 2];
        });
    return `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${toCss(x * ow, y * oh).map((v) => v.toFixed(1)).join(' ')}`).join(' ')} Z`;
  }).join(' ');
}

/**
 * Pointer handling for the tools. live(op | null) shows a stroke while it's
 * painted; commit(op) keeps it. Positions go in as photo fractions.
 */
export function RetouchOverlay({ geo, toOri, toCss, tool, opts, selection, setSelection, cloneSrc, setCloneSrc, target, live, commit, pickColor, toast, onSpaceTap }) {
  const svg = useRef();
  const drag = useRef(null);
  const lastEnd = useRef(null);
  const [cursor, setCursor] = useState(null); // [X, Y]
  const [draft, setDraft] = useState(null); // a selection shape being drawn
  const [space, setSpace] = useState(false);
  const { ow, oh } = geo;
  const long = Math.max(ow, oh);
  const [ax, ay] = toCss(0, 0), [bx, by] = toCss(1, 0);
  const k = Math.hypot(bx - ax, by - ay); // css px per photo px
  const local = (e) => { const r = svg.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const frac = (X, Y) => { const [x, y] = toOri(X, Y); return [x / ow, y / oh]; };

  // Space held: the hand, whatever the tool (as in Photoshop); tapped, it zooms.
  const tap = useRef(onSpaceTap);
  tap.current = onSpaceTap;
  useEffect(() => {
    let held = null;
    const down = (e) => {
      if (e.code !== 'Space' || e.target.closest?.('input, textarea')) return;
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
  useEffect(() => { lastEnd.current = null; }, [tool]);

  const t = opts[tool] || {};
  const down = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    svg.current.setPointerCapture(e.pointerId);
    const [X, Y] = local(e);
    const [fx, fy] = frac(X, Y);
    if (tool === 'dropper') { pickColor(X, Y); return; }
    if (SELECTORS.has(tool)) {
      const mode = e.shiftKey && e.altKey ? 'and' : e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new';
      drag.current = { sel: true, start: [fx, fy], startCss: [X, Y], mode, pts: [[fx, fy]] };
      return;
    }
    if (!BRUSHES.has(tool)) return;
    if ((tool === 'clone' || tool === 'heal') && e.altKey) { setCloneSrc({ x: fx, y: fy, offset: null }); toast('Source set: now paint where it should go'); return; }
    if ((tool === 'clone' || tool === 'heal') && !cloneSrc) { toast('Alt+click the spot to copy from first'); return; }
    const layerId = target();
    const kind = { brush: 'paint', eraser: 'erase', clone: 'clone', heal: 'heal', spot: 'spot' }[tool];
    const op = { id: newId(), t: kind, size: t.size, hard: t.hard, opacity: t.opacity ?? 100, flow: t.flow ?? 100, pts: [[fx, fy]] };
    // Shift+click: a straight line on from the last stroke.
    if (e.shiftKey && lastEnd.current) op.pts.unshift(lastEnd.current);
    if (kind === 'paint') op.color = opts.fg;
    if (selection) op.clip = selection;
    if (kind === 'clone' || kind === 'heal') {
      const off = opts.aligned && cloneSrc.offset ? cloneSrc.offset : { dx: cloneSrc.x - op.pts[0][0], dy: cloneSrc.y - op.pts[0][1] };
      if (opts.aligned && !cloneSrc.offset) setCloneSrc({ ...cloneSrc, offset: off });
      Object.assign(op, off);
    }
    drag.current = { op, layerId, last: [X, Y] };
    live({ layerId, op: shown(op) });
  };
  // A spot heal shows as a see-through paint stroke until its source is found.
  const shown = (op) => (op.t === 'spot' ? { ...op, t: 'paint', color: [0.85, 0.25, 0.35], opacity: 45, flow: 100 } : op);
  const move = (e) => {
    const [X, Y] = local(e);
    setCursor([X, Y]);
    const d = drag.current;
    if (!d) return;
    const [fx, fy] = frac(X, Y);
    if (d.sel) {
      if (tool === 'lasso') { d.pts.push([fx, fy]); setDraft((d.shape = { kind: 'poly', pts: d.pts.slice() })); }
      else {
        let [x1, y1] = [fx, fy];
        // Shift while dragging a new selection: a square or circle.
        if (e.shiftKey && d.mode === 'new') {
          const w = (x1 - d.start[0]) * ow, h = (y1 - d.start[1]) * oh, m = Math.max(Math.abs(w), Math.abs(h));
          x1 = d.start[0] + (Math.sign(w) * m) / ow; y1 = d.start[1] + (Math.sign(h) * m) / oh;
        }
        setDraft((d.shape = { kind: tool === 'ellipse' ? 'ellipse' : 'rect', x0: d.start[0], y0: d.start[1], x1, y1 }));
      }
      return;
    }
    if (Math.hypot(X - d.last[0], Y - d.last[1]) < 1.5) return;
    d.last = [X, Y];
    d.op.pts.push([fx, fy]);
    d.op = { ...d.op }; // a new object each time: the screen draws it again
    live({ layerId: d.layerId, op: shown(d.op) });
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.sel) {
      setDraft(null);
      const [X, Y] = local(e);
      const tiny = Math.hypot(X - d.startCss[0], Y - d.startCss[1]) < 3;
      if (tiny || !d.shape) { if (d.mode === 'new') setSelection(null); return; }
      const shape = tool === 'lasso' ? { kind: 'poly', pts: d.pts } : d.shape;
      if (tool === 'lasso' && d.pts.length < 3) return;
      if (d.mode === 'new' || !selection) setSelection({ shapes: [{ ...shape, mode: 'add' }], invert: false, feather: opts.feather });
      else setSelection({ ...selection, shapes: [...selection.shapes, { ...shape, mode: d.mode }] });
      return;
    }
    lastEnd.current = d.op.pts[d.op.pts.length - 1];
    commit(d.layerId, d.op);
  };

  const brushR = BRUSHES.has(tool) ? Math.max(1, t.size * long * k) : 0;
  const srcCss = cloneSrc && (tool === 'clone' || tool === 'heal') && toCss(cloneSrc.x * ow, cloneSrc.y * oh);
  // While painting (or hovering, once aligned), where the source is now.
  const off = cloneSrc && (drag.current?.op?.dx != null ? drag.current.op : opts.aligned ? cloneSrc.offset : null);
  const srcCursor = cursor && off && (tool === 'clone' || tool === 'heal') && (() => {
    const [x, y] = frac(...cursor);
    return toCss((x + off.dx) * ow, (y + off.dy) * oh);
  })();
  const ants = selection && selectionPath(selection, toCss, ow, oh);
  const draftPath = draft && selectionPath({ shapes: [draft] }, toCss, ow, oh);
  return (
    <svg ref={svg} className={`mask-stage rt-stage tool-${tool}${space || tool === 'hand' ? ' panning' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerLeave={() => setCursor(null)}>
      {ants && <><path className="rt-ants-bg" d={ants} /><path className="rt-ants" d={ants} /></>}
      {draftPath && <><path className="rt-ants-bg" d={draftPath} /><path className="rt-ants" d={draftPath} /></>}
      {srcCss && !off && <g className="rt-src"><circle cx={srcCss[0]} cy={srcCss[1]} r={Math.max(4, brushR)} /><path d={`M${srcCss[0] - 6} ${srcCss[1]}h12M${srcCss[0]} ${srcCss[1] - 6}v12`} /></g>}
      {srcCursor && <g className="rt-src"><circle cx={srcCursor[0]} cy={srcCursor[1]} r={Math.max(4, brushR)} /><path d={`M${srcCursor[0] - 6} ${srcCursor[1]}h12M${srcCursor[0]} ${srcCursor[1] - 6}v12`} /></g>}
      {cursor && brushR > 0 && !space && (
        <g className="mask-cursor"><circle cx={cursor[0]} cy={cursor[1]} r={brushR} />
          {t.hard < 95 && <circle className="inner" cx={cursor[0]} cy={cursor[1]} r={Math.max(1, brushR * (t.hard / 100))} />}</g>
      )}
    </svg>
  );
}
