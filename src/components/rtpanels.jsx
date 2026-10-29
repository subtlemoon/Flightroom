// Retouch's tool bar, options bar and panels (Color, Swatches, Properties,
// Adjustments, Layers, History), laid out like Photoshop's.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown, Icon } from './ui.jsx';
import { Slider } from './slider.jsx';
import { CurveEditor } from './curve.jsx';
import { BLEND_BREAKS, BLEND_MODES, PAINTABLE, inGroup, isIdent, kindOf, newLayer, nextName, tfPx } from '../develop/retouch.js';
import { ADJUSTMENTS, ADJ_LABEL, CURVE_CHANNELS, PHOTO_FILTERS, SELECTIVE_COLORS } from '../develop/adjust.js';
import { FILTER_DEF, filterName } from '../develop/filters.js';
import { FONTS } from '../develop/raster.js';
import { BRUSHES, RETOUCH_DEFAULT, SELECTORS, SHAPE_TOOLS, TOOL, TOOL_GROUPS, hex, layerTree, unhex } from './retouch.jsx';

/** A slider's settings; values with a fractional step show decimals. */
export const sl = (key, label, min, max, step = 1, extra) => ({ key, label, min, max, step, ...(step < 1 ? { decimals: Math.min(4, Math.ceil(-Math.log10(step))) } : {}), ...extra });
const blendOptions = (group) => [...(group ? [{ value: 'pass', label: 'Pass Through' }] : []), ...BLEND_MODES.map(([value, label]) => ({ value, label: BLEND_BREAKS.has(value) ? `${label}  ─` : label }))];

export function ColorInput({ value, onChange, title, className = '' }) {
  return (
    <label className={`rt-color ${className}`} title={title} style={{ background: hex(value) }}>
      <input type="color" value={hex(value)} onChange={(e) => onChange(unhex(e.target.value))} />
    </label>
  );
}

/** A small menu under a button. items: [{ label, icon?, run, disabled }] or null for a line. */
export function PopMenu({ icon, title, items, label, className = '' }) {
  const [pos, setPos] = useState(null);
  const btn = useRef();
  useEffect(() => {
    if (!pos) return;
    const away = (e) => { if (!e.target.closest?.('.rt-pop') && !btn.current?.contains(e.target)) setPos(null); };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [pos]);
  const open = () => {
    const r = btn.current.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 260;
    setPos(up ? { left: Math.min(r.left, window.innerWidth - 230), bottom: window.innerHeight - r.top + 4 } : { left: Math.min(r.left, window.innerWidth - 230), top: r.bottom + 4 });
  };
  return (
    <>
      <button ref={btn} className={`icon-btn ${className}`} title={title} onClick={() => (pos ? setPos(null) : open())}>{icon && <Icon name={icon} size={15} />}{label}</button>
      {pos && createPortal(
        <div className="rt-pop rt-menu" style={pos}>
          {items.map((it, i) => (it ? (
            <button key={i} className="rt-menu-item" disabled={it.disabled} onClick={() => { setPos(null); it.run(); }}>
              {it.icon && <Icon name={it.icon} size={14} />}<span className="grow">{it.label}</span>
            </button>
          ) : <div key={i} className="rt-menu-line" />))}
        </div>,
        document.body,
      )}
    </>
  );
}

// --- the tool bar ---------------------------------------------------------------------

export function ToolRail({ rx }) {
  const { rt, setRt, setTool } = rx;
  const [fly, setFly] = useState(null); // { gi, top }
  useEffect(() => {
    if (!fly) return;
    const away = (e) => { if (!e.target.closest?.('.rt-fly')) setFly(null); };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [fly]);
  const press = useRef(null);
  return (
    <div className="rt-tools">
      {TOOL_GROUPS.map((g, gi) => {
        const id = TOOL[rt.tool]?.group === gi ? rt.tool : rt.groupTool[gi] || g[0][0];
        const [, label, icon, key] = g.find((x) => x[0] === id) || g[0];
        const openFly = (e) => { const r = e.currentTarget.getBoundingClientRect(); setFly({ gi, top: r.top, left: r.right + 4 }); };
        return (
          <button key={gi} className={`icon-btn rt-tool${TOOL[rt.tool]?.group === gi ? ' on' : ''}${g.length > 1 ? ' more' : ''}`} title={`${label} (${key})${g.length > 1 ? ' · right-click or hold for the others' : ''}`}
            onClick={() => setTool(id)} onContextMenu={(e) => { e.preventDefault(); if (g.length > 1) openFly(e); }}
            onPointerDown={(e) => { if (g.length < 2) return; const tgt = e.currentTarget; const r = tgt.getBoundingClientRect(); press.current = setTimeout(() => setFly({ gi, top: r.top, left: r.right + 4 }), 380); }}
            onPointerUp={() => clearTimeout(press.current)} onPointerLeave={() => clearTimeout(press.current)}>
            <Icon name={icon} size={17} />
          </button>
        );
      })}
      {fly && createPortal(
        <div className="rt-fly rt-menu" style={{ top: fly.top, left: fly.left }}>
          {TOOL_GROUPS[fly.gi].map(([id, label, icon, key]) => (
            <button key={id} className={`rt-menu-item${rt.tool === id ? ' on' : ''}`} onClick={() => { setTool(id); setFly(null); }}>
              <Icon name={icon} size={15} /><span className="grow">{label}</span><span className="rt-key">{key}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
      <div className="rt-colors" title="Foreground and background colours (X swaps, D resets)">
        <ColorInput className="bg" value={rt.bg} onChange={(bg) => setRt({ bg })} title="Background colour" />
        <ColorInput className="fg" value={rt.fg} onChange={(fg) => setRt({ fg })} title="Foreground colour" />
      </div>
      <div className="rt-color-btns">
        <button className="icon-btn tiny" title="Default colours (D)" onClick={() => setRt({ fg: RETOUCH_DEFAULT.fg, bg: RETOUCH_DEFAULT.bg })}><span className="rt-mini-def" /></button>
        <button className="icon-btn tiny" title="Swap colours (X)" onClick={() => setRt({ fg: rt.bg, bg: rt.fg })}><Icon name="swap" size={12} /></button>
      </div>
      <button className={`icon-btn rt-tool${rx.quickMask ? ' on' : ''}`} title="Edit in Quick Mask Mode (Q)" onClick={() => rx.setQuickMask((q) => !q)}><Icon name="quickMask" size={17} /></button>
    </div>
  );
}

// --- the options bar ------------------------------------------------------------------

const SEL_MODES = [['new', 'New selection'], ['add', 'Add to selection (Shift)'], ['sub', 'Subtract from selection (Alt)'], ['and', 'Intersect with selection (Shift+Alt)']];

export function OptionsBar({ rx }) {
  const { rt, setRt, L, cur } = rx;
  const tool = rt.tool;
  const t = rt[tool] || {};
  const set = (patch) => setRt({ [tool]: { ...t, ...patch } });
  const px = (f) => Math.max(1, Math.round(f * L));
  const def = RETOUCH_DEFAULT[tool] || {};
  const S = (s, value, d, onSet) => <div className="rt-opt"><Slider sl={s} value={value} def={d} onSet={onSet} /></div>;
  const pct = (key, label, min = 0) => S(sl(key, label, min, 100), t[key], def[key], (k, v) => set({ [k]: v }));
  const size = (key = 'size', label = 'Size') => S(sl(key, label, 1, 2500, 1, { log: true }), px(t[key]), px(def[key]), (k, v) => set({ [k]: v / L }));
  const check = (label, on, fn, title) => <label className="dev-check inline rt-check" title={title}><input type="checkbox" checked={!!on} onChange={(e) => fn(e.target.checked)} />{label}</label>;
  const hint = (s) => <span className="muted small rt-hint">{s}</span>;
  const textCur = cur?.kind === 'text' ? cur : null;
  const setType = (patch) => { setRt({ type: { ...rt.type, ...patch } }); if (textCur) rx.acts.change(textCur.id, { text: { ...textCur.text, ...patch } }, 'Type'); };
  const shapeCur = cur?.kind === 'shape' ? cur : null;
  const setShape = (patch, layerPatch) => { setRt({ shape: { ...rt.shape, ...patch } }); if (shapeCur && layerPatch) rx.acts.change(shapeCur.id, { shape: { ...shapeCur.shape, ...layerPatch } }, 'Shape'); };

  if (rx.xform) {
    const m = tfPx(rx.xform.tf, rx.ow, rx.oh);
    const sx = Math.hypot(m[0], m[3]) * 100, sy = Math.hypot(m[1], m[4]) * 100, ang = (Math.atan2(m[3], m[0]) * 180) / Math.PI;
    return (
      <div className="rt-options">
        <span className="rt-opt-name"><Icon name="move" size={14} />Free Transform</span>
        <span className="rt-readout">W {sx.toFixed(1)}%</span><span className="rt-readout">H {sy.toFixed(1)}%</span><span className="rt-readout">∠ {ang.toFixed(1)}°</span>
        <span className="rt-readout">X {m[2].toFixed(0)} px</span><span className="rt-readout">Y {m[5].toFixed(0)} px</span>
        {hint('Drag inside to move, a handle to scale (Shift frees the shape, Alt from the middle), outside to rotate (Shift: 15° steps)')}
        <span className="grow" />
        <button className="btn btn-sm btn-ghost" onClick={() => rx.setXform(null)} title="Cancel (Esc)"><Icon name="x" size={13} />Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={() => rx.commitTransform()} title="Commit (Enter)"><Icon name="check" size={13} />Commit</button>
      </div>
    );
  }
  return (
    <div className="rt-options">
      <span className="rt-opt-name"><Icon name={TOOL[tool].icon} size={14} />{TOOL[tool].label.replace(' Tool', '')}</span>
      {SELECTORS.has(tool) && (
        <div className="seg small rt-selmodes">
          {SEL_MODES.map(([m, label]) => <button key={m} className={rt.selMode === m ? 'on' : ''} title={label} onClick={() => setRt({ selMode: m })}>{{ new: '▢', add: '⊕', sub: '⊖', and: '⊗' }[m]}</button>)}
        </div>
      )}
      {BRUSHES.has(tool) && size()}
      {BRUSHES.has(tool) && 'hard' in t && pct('hard', 'Hardness')}
      {'opacity' in t && pct('opacity', 'Opacity', 1)}
      {'flow' in t && pct('flow', 'Flow', 1)}
      {'strength' in t && pct('strength', tool === 'sponge' ? 'Flow' : tool === 'dodge' || tool === 'burn' ? 'Exposure' : 'Strength', 1)}
      {(tool === 'dodge' || tool === 'burn') && (
        <>
          <Dropdown value={t.range} onChange={(range) => set({ range })} title="Range" options={[{ value: 0, label: 'Shadows' }, { value: 1, label: 'Midtones' }, { value: 2, label: 'Highlights' }]} />
          {check('Protect Tones', t.protect, (protect) => set({ protect }))}
        </>
      )}
      {tool === 'sponge' && <Dropdown value={t.range} onChange={(range) => set({ range })} title="Mode" options={[{ value: 1, label: 'Desaturate' }, { value: 0, label: 'Saturate' }]} />}
      {(tool === 'clone' || tool === 'heal') && <>{check('Aligned', rt.aligned, (aligned) => setRt({ aligned }))}{hint('Alt+click sets the source')}</>}
      {tool === 'spot' && hint('Paint over a spot: the source is picked for you')}
      {['marquee', 'ellipse', 'lasso', 'polygon'].includes(tool) && S(sl('feather', 'Feather', 0, 250), Math.round(rt.feather * L), 0, (k, v) => setRt({ feather: v / L }))}
      {tool === 'wand' && <>{S(sl('tol', 'Tolerance', 0, 255), t.tol, 32, (k, v) => set({ tol: v }))}{check('Contiguous', t.contiguous, (contiguous) => set({ contiguous }))}</>}
      {tool === 'polygon' && hint('Click points; double-click, Enter or click the first point to close')}
      {SELECTORS.has(tool) && (
        <div className="rt-sel-btns">
          <button className="btn btn-sm" onClick={() => rx.sel.ai('subject')} title="Select > Subject (AI)"><Icon name="subject" size={13} />Select Subject</button>
          <button className="btn btn-sm" onClick={() => rx.sel.ai('sky')} title="Select > Sky (AI)"><Icon name="sky" size={13} />Sky</button>
        </div>
      )}
      {tool === 'move' && (
        <>
          <button className="btn btn-sm" onClick={() => rx.startTransform()} disabled={!cur && !rx.selection} title="Edit > Free Transform (Ctrl+T)">Show Transform Controls</button>
          <button className="icon-btn" title="Rotate 90° counter clockwise" onClick={() => rx.quickTransform(-90)}><Icon name="undo" size={14} /></button>
          <button className="icon-btn" title="Rotate 90° clockwise" onClick={() => rx.quickTransform(90)}><Icon name="redo" size={14} /></button>
          <button className="btn btn-sm btn-ghost" title="Flip horizontal" onClick={() => rx.quickTransform(0, -1, 1)}>⇋</button>
          <button className="btn btn-sm btn-ghost" title="Flip vertical" onClick={() => rx.quickTransform(0, 1, -1)}>⇵</button>
          {cur?.tf && !isIdent(cur.tf) && <button className="btn btn-sm btn-ghost" onClick={() => rx.acts.change(cur.id, { tf: undefined }, 'Reset Transform')}>Reset</button>}
          {hint('Drag to move the layer (Shift: straight), arrows nudge it')}
        </>
      )}
      {tool === 'gradient' && (
        <>
          <div className="seg small">
            {['linear', 'radial', 'angle', 'reflected', 'diamond'].map((st) => <button key={st} className={t.style === st ? 'on' : ''} onClick={() => set({ style: st })} title={`${st[0].toUpperCase()}${st.slice(1)} Gradient`}>{st[0].toUpperCase() + st.slice(1)}</button>)}
          </div>
          <Dropdown value={t.colors} onChange={(colors) => set({ colors })} title="Gradient colours"
            options={[{ value: 'fgbg', label: 'Foreground to Background' }, { value: 'fgtrans', label: 'Foreground to Transparent' }, { value: 'bw', label: 'Black, White' }]} />
          {check('Reverse', t.reverse, (reverse) => set({ reverse }))}
        </>
      )}
      {tool === 'bucket' && <>{S(sl('tol', 'Tolerance', 0, 255), t.tol, 32, (k, v) => set({ tol: v }))}{check('Contiguous', t.contiguous, (contiguous) => set({ contiguous }))}</>}
      {tool === 'redeye' && <>{size('size', 'Pupil Size')}{pct('darken', 'Darken Amount', 1)}{hint('Click a red pupil, or drag around it')}</>}
      {tool === 'type' && (
        <>
          <Dropdown className="rt-font" value={textCur?.text.font || rt.type.font} onChange={(font) => setType({ font })} title="Font" options={FONTS.map((f) => ({ value: f, label: f }))} />
          {S(sl('size', 'Size', 4, 2000, 1, { log: true }), px(textCur?.text.size || rt.type.size), px(RETOUCH_DEFAULT.type.size), (k, v) => setType({ size: v / L }))}
          <button className={`icon-btn rt-b${(textCur?.text || rt.type).bold ? ' on' : ''}`} title="Bold" onClick={() => setType({ bold: !(textCur?.text || rt.type).bold })}><b>B</b></button>
          <button className={`icon-btn rt-b${(textCur?.text || rt.type).italic ? ' on' : ''}`} title="Italic" onClick={() => setType({ italic: !(textCur?.text || rt.type).italic })}><i>I</i></button>
          <div className="seg small">{['left', 'center', 'right'].map((a) => <button key={a} className={(textCur?.text || rt.type).align === a ? 'on' : ''} onClick={() => setType({ align: a })}>{a[0].toUpperCase() + a.slice(1)}</button>)}</div>
          <ColorInput value={textCur?.text.color || rt.fg} onChange={(c) => { setRt({ fg: c }); if (textCur) rx.acts.change(textCur.id, { text: { ...textCur.text, color: c } }, 'Type'); }} title="Text colour" />
          {hint('Click the photo to type, or click a text to edit it')}
        </>
      )}
      {SHAPE_TOOLS[tool] && (
        <>
          {tool !== 'line' && check('Fill', !rt.shape.noFill, (on) => setShape({ noFill: !on }, { fill: on ? rt.fg : null }))}
          <ColorInput value={shapeCur?.shape.fill || rt.fg} onChange={(c) => { setRt({ fg: c }); if (shapeCur) rx.acts.change(shapeCur.id, { shape: { ...shapeCur.shape, fill: c } }, 'Shape'); }} title="Fill (the foreground colour)" />
          {tool !== 'line' && check('Stroke', rt.shape.strokeOn, (on) => setShape({ strokeOn: on }, { stroke: on ? { color: rt.shape.strokeColor, width: rt.shape.strokeW } : null }))}
          {tool !== 'line' && rt.shape.strokeOn && <ColorInput value={rt.shape.strokeColor} onChange={(c) => setShape({ strokeColor: c }, shapeCur?.shape.stroke && { stroke: { ...shapeCur.shape.stroke, color: c } })} title="Stroke colour" />}
          {tool !== 'line' && rt.shape.strokeOn && S(sl('strokeW', 'Stroke', 1, 500, 1, { log: true }), px(rt.shape.strokeW), px(0.002), (k, v) => setShape({ strokeW: v / L }, shapeCur?.shape.stroke && { stroke: { ...shapeCur.shape.stroke, width: v / L } }))}
          {tool === 'rect' && S(sl('radius', 'Radius', 0, 1000), Math.round(rt.shape.radius * L), 0, (k, v) => setShape({ radius: v / L }, { radius: v / L }))}
          {tool === 'polygonShape' && <>{S(sl('sides', 'Sides', 3, 100), rt.shape.sides, 5, (k, v) => setShape({ sides: v }, { sides: v }))}{check('Star', rt.shape.star, (star) => setShape({ star }, { star }))}</>}
          {tool === 'line' && S(sl('weight', 'Weight', 1, 500, 1, { log: true }), px(rt.shape.weight), px(0.003), (k, v) => setShape({ weight: v / L }, { weight: v / L }))}
        </>
      )}
      {tool === 'patch' && hint('Draw around what should go, then drag it to the part to copy from')}
      {tool === 'dropper' && hint('Click to pick the foreground colour, Alt+click the background')}
      {tool === 'hand' && hint('Drag to move around a zoomed photo, click to zoom (Space works with any tool)')}
      {tool === 'zoom' && hint('Click to zoom in, Alt+click to zoom out')}
      {rx.quickMask && hint('Quick Mask: paint white to select, black to take away (Q to leave)')}
    </div>
  );
}

// --- the panels -------------------------------------------------------------------------

function Panel({ rx, id, title, icon, children, extra }) {
  const shut = rx.rt.collapsed[id];
  return (
    <section className={`rt-panel${shut ? ' shut' : ''}`}>
      <div className="rt-panel-head" onClick={() => rx.setRt({ collapsed: { ...rx.rt.collapsed, [id]: !shut } })}>
        <Icon name={shut ? 'chevR' : 'chevD'} size={11} /><Icon name={icon} size={13} /><span className="grow">{title}</span>{extra}
        <button className="icon-btn tiny" title="Close (Window menu shows it again)" onClick={(e) => { e.stopPropagation(); rx.setRt({ panels: { ...rx.rt.panels, [id]: false } }); }}><Icon name="x" size={11} /></button>
      </div>
      {!shut && <div className="rt-panel-body">{children}</div>}
    </section>
  );
}

export function RetouchPanels({ rx, history, onDevelop }) {
  const p = rx.rt.panels;
  return (
    <div className="rt-panels">
      {p.color && <Panel rx={rx} id="color" title="Color" icon="palette"><ColorPanel rx={rx} /></Panel>}
      {p.swatches && <Panel rx={rx} id="swatches" title="Swatches" icon="swatches"><SwatchesPanel rx={rx} /></Panel>}
      {p.properties && <Panel rx={rx} id="properties" title="Properties" icon="sliders"><PropertiesPanel rx={rx} /></Panel>}
      {p.adjustments && <Panel rx={rx} id="adjustments" title="Adjustments" icon="adjust"><AdjustmentsPanel rx={rx} /></Panel>}
      {p.layers && <Panel rx={rx} id="layers" title="Layers" icon="layers"><LayersPanel rx={rx} onDevelop={onDevelop} /></Panel>}
      {p.history && history && <Panel rx={rx} id="history" title="History" icon="history"><HistoryPanel history={history} /></Panel>}
    </div>
  );
}

function ColorPanel({ rx }) {
  const { rt, setRt } = rx;
  const [which, setWhich] = useState('fg');
  const c = rt[which];
  const set = (i, v) => setRt({ [which]: c.map((x, j) => (j === i ? v / 255 : x)) });
  return (
    <div className="rt-colorpanel">
      <div className="rt-colorpanel-top">
        <div className="rt-colors big">
          <button className={`rt-swatch bg${which === 'bg' ? ' sel' : ''}`} style={{ background: hex(rt.bg) }} onClick={() => setWhich('bg')} title="Background colour" />
          <button className={`rt-swatch fg${which === 'fg' ? ' sel' : ''}`} style={{ background: hex(rt.fg) }} onClick={() => setWhich('fg')} title="Foreground colour" />
        </div>
        <input className="rt-hex" value={hex(c).slice(1)} onChange={(e) => /^[0-9a-f]{6}$/i.test(e.target.value) && setRt({ [which]: unhex(`#${e.target.value}`) })} title="Hex" />
        <ColorInput value={c} onChange={(v) => setRt({ [which]: v })} title="Pick a colour" />
      </div>
      {['R', 'G', 'B'].map((n, i) => (
        <Slider key={n} sl={sl(n, n, 0, 255)} value={Math.round(c[i] * 255)} def={0} onSet={(k, v) => set(i, v)}
          color={`linear-gradient(90deg, ${hex(c.map((x, j) => (j === i ? 0 : x)))}, ${hex(c.map((x, j) => (j === i ? 1 : x)))})`} />
      ))}
    </div>
  );
}

function SwatchesPanel({ rx }) {
  const { rt, setRt } = rx;
  return (
    <div className="rt-swatches">
      {rt.swatches.map((h, i) => (
        <button key={i} className="rt-sw" style={{ background: h }} title={`${h} · click: foreground, Alt+click: background, Ctrl+click: delete`}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) setRt({ swatches: rt.swatches.filter((_, j) => j !== i) });
            else setRt(e.altKey ? { bg: unhex(h) } : { fg: unhex(h) });
          }} />
      ))}
      <button className="rt-sw add" title="New swatch from the foreground colour" onClick={() => setRt({ swatches: [...rt.swatches, hex(rt.fg)] })}><Icon name="plus" size={12} /></button>
    </div>
  );
}

function AdjustmentsPanel({ rx }) {
  return (
    <div className="rt-adjs">
      {ADJUSTMENTS.map(([type, label, icon]) => (
        <button key={type} className="icon-btn rt-adj" title={`${label}${rx.selection ? ' (masked to the selection)' : ''}`} onClick={() => rx.acts.addAdjustment(type, rx.selection)}><Icon name={icon} size={16} /></button>
      ))}
    </div>
  );
}

function HistoryPanel({ history }) {
  const { states, at, jump } = history;
  const ref = useRef();
  useEffect(() => { ref.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [at, states.length]);
  return (
    <div className="rt-history" ref={ref}>
      {states.map((label, i) => (
        <button key={i} className={`rt-hist${i === at ? ' on' : ''}${i > at ? ' redo' : ''}`} onClick={() => jump(i)}>
          <Icon name={i ? 'history' : 'photo'} size={12} /><span className="grow">{label}</span>
        </button>
      ))}
    </div>
  );
}

// --- Layers -----------------------------------------------------------------------------

const KIND_ICON = { pixel: 'brush', photo: 'photo', stamp: 'layers', adjust: 'adjust', fill: 'palette', text: 'type', shape: 'shapeRect', group: 'folder2' };
const KIND_FILTER = [{ value: 'all', label: 'All kinds' }, { value: 'pixel', label: 'Pixel' }, { value: 'adjust', label: 'Adjustment' }, { value: 'type', label: 'Type' },
  { value: 'shape', label: 'Shape' }, { value: 'smart', label: 'With filters' }, { value: 'group', label: 'Group' }];
const matches = (l, f) => f === 'all' || (f === 'pixel' ? PAINTABLE.has(kindOf(l)) : f === 'type' ? l.kind === 'text' : f === 'smart' ? !!l.filters?.length : f === 'adjust' ? l.kind === 'adjust' || l.kind === 'fill' : l.kind === f);

function LayersPanel({ rx, onDevelop }) {
  const { acts, cur, active } = rx;
  const layers = acts.layers;
  const [renaming, setRenaming] = useState(null);
  const [shut, setShut] = useState(() => new Set()); // closed groups
  const [kind, setKind] = useState('all');
  const dragId = useRef(null);
  const [over, setOver] = useState(null); // { id, into }
  const lock = cur?.lock || {};
  const setLock = (key) => acts.change(cur.id, { lock: { ...lock, [key]: !lock[key] } }, 'Lock');
  const rows = [];
  const walk = (nodes, depth) => nodes.forEach(({ l, kids }) => {
    if (kind === 'all' || matches(l, kind)) rows.push({ l, depth: kind === 'all' ? depth : 0 });
    if (l.kind === 'group' && !shut.has(l.id)) walk(kids, depth + 1);
  });
  walk(layerTree(layers), 0);
  const fillSl = sl('fill', 'Fill', 0, 100), opSl = sl('opacity', 'Opacity', 0, 100);
  return (
    <div className="rt-layers-panel">
      <div className="rt-layer-props">
        <Dropdown className="rt-kind" value={kind} onChange={setKind} options={KIND_FILTER} title="Filter by kind" />
        <Dropdown className="grow" value={cur?.blend || 'normal'} disabled={!cur} title="Blend mode" options={blendOptions(cur?.kind === 'group')} onChange={(blend) => acts.change(cur.id, { blend }, 'Blending Change')} />
      </div>
      <Slider sl={opSl} value={cur ? cur.opacity : 100} def={100} onSet={(k, v) => cur && acts.change(cur.id, { opacity: v }, 'Opacity Change')} />
      <div className="rt-lock-row">
        <span className="muted small">Lock</span>
        {[['alpha', 'lockAlpha', 'Lock transparent pixels'], ['pixels', 'lockPixels', 'Lock image pixels'], ['position', 'lockPosition', 'Lock position'], ['all', 'lock', 'Lock all']].map(([key, icon, title]) => (
          <button key={key} className={`icon-btn tiny${lock[key] ? ' on' : ''}`} disabled={!cur} title={title} onClick={() => setLock(key)}><Icon name={icon} size={12} /></button>
        ))}
        <div className="grow"><Slider sl={fillSl} value={cur ? cur.fill ?? 100 : 100} def={100} onSet={(k, v) => cur && acts.change(cur.id, { fill: v }, 'Fill Opacity Change')} /></div>
      </div>
      <div className="rt-layers">
        {rows.map(({ l, depth }) => {
          const off = l.hidden || layers.some((g) => g.kind === 'group' && g.hidden && inGroup(layers, g.id).includes(l));
          return (
            <div key={l.id}>
              <div className={`rt-layer${l.id === active ? ' on' : ''}${off ? ' off' : ''}${over?.id === l.id ? (over.into ? ' drop-into' : ' drop-above') : ''}`}
                style={{ paddingLeft: 6 + depth * 14 }} draggable={renaming !== l.id}
                onDragStart={(e) => { dragId.current = l.id; e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (!dragId.current) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver({ id: l.id, into: l.kind === 'group' && e.clientY > r.top + r.height / 2 }); }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); if (dragId.current) acts.moveTo(dragId.current, l.id, over?.into); dragId.current = null; setOver(null); }}
                onDragEnd={() => { dragId.current = null; setOver(null); }}
                onClick={() => rx.setActive(l.id)} onDoubleClick={() => setRenaming(l.id)}>
                <button className="icon-btn tiny" title={l.hidden ? 'Show layer' : 'Hide layer'} onClick={(e) => { e.stopPropagation(); acts.change(l.id, { hidden: !l.hidden }, l.hidden ? 'Show Layer' : 'Hide Layer'); }}>
                  <Icon name={l.hidden ? 'eyeOff' : 'eye'} size={13} />
                </button>
                {l.clip && <span className="rt-clip" title="Clipped to the layer below"><Icon name="clipArrow" size={11} /></span>}
                {l.kind === 'group' && (
                  <button className="icon-btn tiny" onClick={(e) => { e.stopPropagation(); setShut((s) => { const n = new Set(s); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; }); }}>
                    <Icon name={shut.has(l.id) ? 'chevR' : 'chevD'} size={11} />
                  </button>
                )}
                <span className={`rt-thumb${l.id === active && !rx.editMask ? ' sel' : ''}`} title={l.kind === 'adjust' ? ADJ_LABEL[l.adj?.type] : undefined}
                  onClick={(e) => { e.stopPropagation(); rx.setActive(l.id); }}
                  style={l.kind === 'fill' && l.fillDef?.type !== 'gradient' ? { background: hex(l.fillDef?.color || [0, 0, 0]) } : undefined}>
                  <Icon name={l.kind === 'adjust' ? ADJUSTMENTS.find((a) => a[0] === l.adj?.type)?.[2] || 'adjust' : KIND_ICON[kindOf(l)]} size={13} />
                </span>
                {l.mask && (
                  <span className={`rt-thumb mask${rx.editMask && l.id === active ? ' sel' : ''}${l.mask.off ? ' disabled' : ''}`} title="Layer mask: click to paint on it, Shift+click to turn it off"
                    onClick={(e) => { e.stopPropagation(); if (e.shiftKey) { acts.change(l.id, { mask: { ...l.mask, off: !l.mask.off } }, 'Mask'); return; } rx.setActive(l.id); rx.setEditMask(true); }}>
                    <span className="rt-mask-chip" style={{ background: l.mask.base ? '#fff' : '#000' }} />
                  </span>
                )}
                {renaming === l.id ? (
                  <input className="mask-rename" autoFocus defaultValue={l.name} onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== l.name) acts.rename(l.id, n); setRenaming(null); }}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
                ) : (
                  <span className="rt-layer-name grow">{l.name}</span>
                )}
                {l.style && Object.values(l.style).some((x) => x && x.on !== false) && (
                  <button className="icon-btn tiny rt-fx" title="Layer style" onClick={(e) => { e.stopPropagation(); rx.setDialog({ type: 'style', id: l.id, tab: 'blend' }); }}><Icon name="fx" size={12} /></button>
                )}
                {(l.lock?.all || l.lock?.pixels || l.lock?.position || l.lock?.alpha) && <Icon name="lock" size={11} />}
                <span className="rt-layer-meta">{l.blend !== 'normal' && l.blend !== 'pass' ? BLEND_MODES.find((b) => b[0] === l.blend)?.[1] : ''}{l.opacity < 100 ? ` ${Math.round(l.opacity)}%` : ''}</span>
              </div>
              {l.filters?.length > 0 && (kind === 'all' || kind === 'smart') && (
                <div className="rt-filters" style={{ paddingLeft: 28 + depth * 14 }}>
                  <div className="rt-filters-title muted small">Smart Filters</div>
                  {l.filters.map((f) => (
                    <div key={f.id} className={`rt-filter${f.on === false ? ' off' : ''}`} onDoubleClick={() => FILTER_DEF[f.type]?.params.length && rx.setDialog({ type: 'filter', layer: l.id, fid: f.id, filter: f.type, orig: f })}>
                      <button className="icon-btn tiny" title={f.on === false ? 'Show filter' : 'Hide filter'} onClick={() => acts.changeFilter(l.id, f.id, { on: f.on === false })}><Icon name={f.on === false ? 'eyeOff' : 'eye'} size={11} /></button>
                      <span className="grow">{filterName(f)}{f.clip ? ' (selection)' : ''}</span>
                      <button className="icon-btn tiny" title="Delete filter" onClick={() => acts.removeFilter(l.id, f.id)}><Icon name="x" size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="rt-layer base" title="The photo as developed. Edits in Develop show here at once.">
          <span className="rt-thumb"><Icon name="develop" size={13} /></span>
          <span className="rt-layer-name grow">Background (developed photo)</span>
          <Icon name="lock" size={11} />
          <button className="btn btn-sm btn-ghost" onClick={onDevelop} title="Back to Develop (Ctrl+E)">Develop</button>
        </div>
      </div>
      <div className="rt-layer-btns">
        <button className="icon-btn" title="Add a layer style" disabled={!cur || cur.kind === 'group'} onClick={() => rx.setDialog({ type: 'style', id: cur.id, tab: 'blend' })}><Icon name="fx" size={15} /></button>
        <button className="icon-btn" title={rx.selection ? 'Add a layer mask from the selection' : 'Add a layer mask'} disabled={!cur || cur.kind === 'group' || !!cur.mask} onClick={() => { acts.addMask(cur.id, rx.selection, false); rx.setEditMask(true); }}><Icon name="mask" size={15} /></button>
        <PopMenu icon="adjust" title="New fill or adjustment layer" items={[
          { label: 'Solid Color…', icon: 'palette', run: () => { const id = acts.addFill({ type: 'solid', color: rx.rt.fg }, rx.selection); rx.setDialog({ type: 'solid', id }); } },
          { label: 'Gradient…', icon: 'gradient', run: () => acts.addFill({ type: 'gradient', g: { style: 'linear', x0: 0.5, y0: 1, x1: 0.5, y1: 0, c0: [...rx.rt.fg, 1], c1: [...rx.rt.fg, 0] } }, rx.selection) },
          null,
          ...ADJUSTMENTS.map(([type, label, icon]) => ({ label: `${label}…`, icon, run: () => acts.addAdjustment(type, rx.selection) })),
        ]} />
        <button className="icon-btn" title="New group (Ctrl+G groups the selected layer)" onClick={() => (cur ? acts.group([cur.id]) : acts.insert(newLayer(layers, nextName(layers, 'Group'), 'group'), 'New Group'))}><Icon name="folder2" size={15} /></button>
        <button className="icon-btn" title="New layer (Shift+Ctrl+N)" onClick={() => acts.add()}><Icon name="plus" size={15} /></button>
        <span className="grow" />
        <button className="icon-btn" title="Merge down" disabled={!cur || layers[0]?.id === cur.id} onClick={() => acts.mergeDown(cur.id)}><Icon name="down" size={15} /></button>
        <button className="icon-btn" title="Delete layer" disabled={!cur} onClick={() => acts.remove(cur.id)}><Icon name="trash" size={15} /></button>
      </div>
    </div>
  );
}

// --- Properties -------------------------------------------------------------------------

function PropertiesPanel({ rx }) {
  const { cur, acts, L } = rx;
  if (!cur) return <p className="muted small rt-note">Pick a layer to see its properties. Adjustments, fills, type and shapes stay editable here.</p>;
  const kind = kindOf(cur);
  return (
    <div className="rt-props">
      <div className="rt-props-title"><Icon name={KIND_ICON[kind]} size={13} />{cur.name}</div>
      {kind === 'adjust' && <AdjustProps rx={rx} l={cur} />}
      {kind === 'fill' && <FillProps rx={rx} l={cur} />}
      {kind === 'text' && <TextProps rx={rx} l={cur} />}
      {kind === 'shape' && <ShapeProps rx={rx} l={cur} />}
      {PAINTABLE.has(kind) && cur.tf && !isIdent(cur.tf) && (
        <div className="rt-prop-row"><span className="muted small grow">Moved / transformed</span><button className="btn btn-sm btn-ghost" onClick={() => acts.change(cur.id, { tf: undefined }, 'Reset Transform')}>Reset transform</button></div>
      )}
      {cur.mask && (
        <>
          <div className="dev-group-title">Mask{rx.editMask ? ' · painting on it' : ''}</div>
          <Slider sl={sl('density', 'Density', 0, 100)} value={cur.mask.density ?? 100} def={100} onSet={(k, v) => acts.change(cur.id, { mask: { ...cur.mask, density: v } }, 'Mask Density')} />
          <Slider sl={sl('feather', 'Feather', 0, 1000, 0.1)} value={Math.round((cur.mask.feather || 0) * L * 10) / 10} def={0} onSet={(k, v) => acts.change(cur.id, { mask: { ...cur.mask, feather: v / L } }, 'Mask Feather')} />
          <div className="rt-prop-row">
            <button className="btn btn-sm" onClick={() => acts.invertMask(cur.id)}>Invert</button>
            <button className="btn btn-sm" onClick={() => acts.change(cur.id, { mask: { ...cur.mask, off: !cur.mask.off } }, 'Mask')}>{cur.mask.off ? 'Enable' : 'Disable'}</button>
            <button className={`btn btn-sm${rx.editMask ? ' on' : ''}`} onClick={() => rx.setEditMask(!rx.editMask)}>{rx.editMask ? 'Paint the layer' : 'Paint the mask'}</button>
            <button className="icon-btn" title="Delete mask" onClick={() => { acts.deleteMask(cur.id); rx.setEditMask(false); }}><Icon name="trash" size={13} /></button>
          </div>
        </>
      )}
      {cur.filters?.length > 0 && (
        <>
          <div className="dev-group-title">Smart Filters</div>
          {cur.filters.map((f) => <FilterProps key={f.id} rx={rx} l={cur} f={f} />)}
        </>
      )}
    </div>
  );
}

export function FilterParams({ f, onSet }) {
  return (FILTER_DEF[f.type]?.params || []).map((p) => (p.options
    ? <div key={p.key} className="rt-prop-row"><span className="muted small grow">{p.label}</span><Dropdown value={f[p.key]} onChange={(v) => onSet(p.key, v)} options={p.options.map(([value, label]) => ({ value, label }))} /></div>
    : p.bool ? <label key={p.key} className="dev-check"><input type="checkbox" checked={!!f[p.key]} onChange={(e) => onSet(p.key, e.target.checked)} />{p.label}</label>
      : <Slider key={p.key} sl={sl(p.key, `${p.label}${p.unit ? ` (${p.unit})` : ''}`, p.min, p.max, p.step, p.max / Math.max(p.min, 0.1) > 200 && p.min > 0 ? { log: true } : undefined)} value={f[p.key]} def={p.def} onSet={onSet} />));
}

function FilterProps({ rx, l, f }) {
  const [open, setOpen] = useState(false);
  const has = FILTER_DEF[f.type]?.params.length > 0;
  return (
    <div className="rt-filter-props">
      <div className="rt-prop-row">
        <button className="icon-btn tiny" onClick={() => setOpen(!open)} disabled={!has}><Icon name={open ? 'chevD' : 'chevR'} size={11} /></button>
        <span className="grow small">{filterName(f)}</span>
        <button className="icon-btn tiny" title={f.on === false ? 'Show' : 'Hide'} onClick={() => rx.acts.changeFilter(l.id, f.id, { on: f.on === false })}><Icon name={f.on === false ? 'eyeOff' : 'eye'} size={11} /></button>
      </div>
      {open && <FilterParams f={f} onSet={(k, v) => rx.acts.changeFilter(l.id, f.id, { [k]: v })} />}
    </div>
  );
}

function AdjustProps({ rx, l }) {
  const a = l.adj;
  const set = (patch) => rx.acts.change(l.id, { adj: { ...a, ...patch } }, `${ADJ_LABEL[a.type]} Properties`);
  const sliders = ADJUSTMENTS.find(([k]) => k === a.type)?.[3] || [];
  const check = (key, label) => <label className="dev-check"><input type="checkbox" checked={!!a[key]} onChange={(e) => set({ [key]: e.target.checked })} />{label}</label>;
  const row = (label, el) => <div className="rt-prop-row"><span className="muted small grow">{label}</span>{el}</div>;
  const simple = !['balance', 'mixer', 'selective', 'levels', 'curves', 'gradmap'].includes(a.type);
  return (
    <>
      {simple && sliders.map((s) => <Slider key={s.key} sl={sl(s.key, s.label, s.min, s.max, s.step)} value={a[s.key]} def={s.def} onSet={(k, v) => set({ [k]: v })} />)}
      {a.type === 'hsl' && check('colorize', 'Colorize')}
      {a.type === 'bw' && <>{check('tint', 'Tint')}{a.tint && row('Tint colour', <ColorInput value={a.tintColor} onChange={(tintColor) => set({ tintColor })} />)}</>}
      {a.type === 'photo' && (
        <>
          {row('Filter', <Dropdown value={PHOTO_FILTERS.find(([, c]) => c.join() === a.color.join())?.[0] || 'Custom'} onChange={(n) => set({ color: PHOTO_FILTERS.find(([k]) => k === n)[1] })}
            options={[...PHOTO_FILTERS.map(([n]) => ({ value: n, label: n })), { value: 'Custom', label: 'Custom', disabled: true }]} />)}
          {row('Colour', <ColorInput value={a.color} onChange={(color) => set({ color })} />)}
          {check('preserve', 'Preserve Luminosity')}
        </>
      )}
      {a.type === 'balance' && (
        <>
          <div className="seg small">{[['shadows', 'Shadows'], ['mid', 'Midtones'], ['highlights', 'Highlights']].map(([k, n]) => <button key={k} className={a.tone === k ? 'on' : ''} onClick={() => set({ tone: k })}>{n}</button>)}</div>
          {sliders.map((s, i) => <Slider key={s.key} sl={sl(s.key, s.label, -100, 100)} value={a[a.tone][i]} def={0} onSet={(k, v) => set({ [a.tone]: a[a.tone].map((x, j) => (j === i ? v : x)) })} />)}
          {check('preserve', 'Preserve Luminosity')}
        </>
      )}
      {a.type === 'mixer' && (
        <>
          {row('Output', <Dropdown value={a.out} onChange={(out) => set({ out })} disabled={a.mono} options={[{ value: 'r', label: 'Red' }, { value: 'g', label: 'Green' }, { value: 'b', label: 'Blue' }]} />)}
          {check('mono', 'Monochrome')}
          {sliders.map((s, i) => <Slider key={s.key} sl={sl(s.key, s.label, -200, 200)} value={a.rows[a.mono ? 'r' : a.out][i]} def={a.mono ? [40, 40, 20, 0][i] : (['r', 'g', 'b'].indexOf(a.out) === i ? 100 : 0)}
            onSet={(k, v) => { const o = a.mono ? 'r' : a.out; set({ rows: { ...a.rows, [o]: a.rows[o].map((x, j) => (j === i ? v : x)) } }); }} />)}
        </>
      )}
      {a.type === 'selective' && (
        <>
          {row('Colors', <Dropdown value={a.color} onChange={(color) => set({ color })} options={SELECTIVE_COLORS.map(([value, label]) => ({ value, label }))} />)}
          {sliders.map((s, i) => <Slider key={s.key} sl={sl(s.key, `${s.label} %`, -100, 100)} value={a.cmyk[a.color][i]} def={0} onSet={(k, v) => set({ cmyk: { ...a.cmyk, [a.color]: a.cmyk[a.color].map((x, j) => (j === i ? v : x)) } })} />)}
          <div className="seg small">{[[false, 'Relative'], [true, 'Absolute']].map(([v, n]) => <button key={n} className={!!a.absolute === v ? 'on' : ''} onClick={() => set({ absolute: v })}>{n}</button>)}</div>
        </>
      )}
      {a.type === 'levels' && (
        <>
          {row('Channel', <Dropdown value={a.ch} onChange={(ch) => set({ ch })} options={CURVE_CHANNELS.map(([value, label]) => ({ value, label }))} />)}
          {[['in0', 'Input Black', 0, 253, 1], ['gamma', 'Input Midtone', 0.1, 9.99, 0.01], ['in1', 'Input White', 2, 255, 1], ['out0', 'Output Black', 0, 255, 1], ['out1', 'Output White', 0, 255, 1]].map(([key, label, mn, mx, st]) => (
            <Slider key={key} sl={sl(key, label, mn, mx, st)} value={a[a.ch][key]} def={{ in0: 0, gamma: 1, in1: 255, out0: 0, out1: 255 }[key]} onSet={(k, v) => set({ [a.ch]: { ...a[a.ch], [k]: v } })} />
          ))}
        </>
      )}
      {a.type === 'curves' && (
        <>
          <div className="seg small">{CURVE_CHANNELS.map(([k, n]) => <button key={k} className={a.ch === k ? 'on' : ''} onClick={() => set({ ch: k })}>{n}</button>)}</div>
          <CurveEditor s={{ pts: a[a.ch] }} channel="pts" set={(k, pts) => set({ [a.ch]: pts })} />
        </>
      )}
      {a.type === 'gradmap' && (
        <>
          {row('From', <ColorInput value={a.c0} onChange={(c0) => set({ c0 })} />)}
          {row('To', <ColorInput value={a.c1} onChange={(c1) => set({ c1 })} />)}
          <div className="rt-gradbar" style={{ background: `linear-gradient(90deg, ${hex(a.reverse ? a.c1 : a.c0)}, ${hex(a.reverse ? a.c0 : a.c1)})` }} />
          {check('reverse', 'Reverse')}
        </>
      )}
    </>
  );
}

function FillProps({ rx, l }) {
  const f = l.fillDef;
  const set = (patch) => rx.acts.change(l.id, { fillDef: { ...f, ...patch } }, 'Fill Properties');
  if (f.type !== 'gradient') return <div className="rt-prop-row"><span className="muted small grow">Colour</span><ColorInput value={f.color} onChange={(color) => set({ color })} /></div>;
  const g = f.g;
  const setG = (patch) => set({ g: { ...g, ...patch } });
  const ang = Math.round((Math.atan2(g.y0 - g.y1, g.x1 - g.x0) * 180) / Math.PI);
  return (
    <>
      <div className="rt-prop-row"><span className="muted small grow">Colours</span><ColorInput value={g.c0.slice(0, 3)} onChange={(c) => setG({ c0: [...c, g.c0[3]] })} /><ColorInput value={g.c1.slice(0, 3)} onChange={(c) => setG({ c1: [...c, g.c1[3]] })} /></div>
      <Slider sl={sl('a0', 'Start opacity', 0, 100)} value={Math.round(g.c0[3] * 100)} def={100} onSet={(k, v) => setG({ c0: [...g.c0.slice(0, 3), v / 100] })} />
      <Slider sl={sl('a1', 'End opacity', 0, 100)} value={Math.round(g.c1[3] * 100)} def={0} onSet={(k, v) => setG({ c1: [...g.c1.slice(0, 3), v / 100] })} />
      <div className="rt-prop-row"><span className="muted small grow">Style</span>
        <Dropdown value={g.style} onChange={(style) => setG({ style })} options={['linear', 'radial', 'angle', 'reflected', 'diamond'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} /></div>
      <Slider sl={sl('angle', 'Angle', -180, 180)} value={ang} def={90} onSet={(k, v) => {
        const a = (v * Math.PI) / 180, cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2, r = Math.hypot(g.x1 - g.x0, g.y1 - g.y0) / 2 || 0.5;
        setG({ x0: cx - Math.cos(a) * r, y0: cy + Math.sin(a) * r, x1: cx + Math.cos(a) * r, y1: cy - Math.sin(a) * r });
      }} />
    </>
  );
}

function TextProps({ rx, l }) {
  const t = l.text;
  const set = (patch) => rx.acts.change(l.id, { text: { ...t, ...patch } }, 'Character');
  const L = rx.L;
  return (
    <>
      <textarea className="rt-textedit" value={t.text} rows={Math.min(6, Math.max(2, t.text.split('\n').length))} onChange={(e) => set({ text: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
      <Dropdown value={t.font} onChange={(font) => set({ font })} options={FONTS.map((f) => ({ value: f, label: f }))} />
      <Slider sl={sl('size', 'Size (px)', 4, 2000, 1, { log: true })} value={Math.round(t.size * L)} def={Math.round(0.05 * L)} onSet={(k, v) => set({ size: v / L })} />
      <Slider sl={sl('tracking', 'Tracking', -200, 1000)} value={t.tracking || 0} def={0} onSet={(k, v) => set({ tracking: v })} />
      <Slider sl={sl('leading', 'Leading', 0.5, 3, 0.01)} value={t.leading || 1.2} def={1.2} onSet={(k, v) => set({ leading: v })} />
      <div className="rt-prop-row">
        <ColorInput value={t.color} onChange={(color) => set({ color })} title="Colour" />
        {[['bold', <b key="b">B</b>], ['italic', <i key="i">I</i>], ['underline', <u key="u">U</u>]].map(([k, el]) => <button key={k} className={`icon-btn rt-b${t[k] ? ' on' : ''}`} onClick={() => set({ [k]: !t[k] })} title={k}>{el}</button>)}
        <span className="grow" />
        <div className="seg small">{['left', 'center', 'right'].map((a) => <button key={a} className={t.align === a ? 'on' : ''} onClick={() => set({ align: a })}>{a[0].toUpperCase()}</button>)}</div>
      </div>
    </>
  );
}

function ShapeProps({ rx, l }) {
  const sh = l.shape;
  const L = rx.L;
  const set = (patch) => rx.acts.change(l.id, { shape: { ...sh, ...patch } }, 'Shape Properties');
  const ow = rx.ow, oh = rx.oh;
  return (
    <>
      <div className="rt-prop-row">
        <span className="muted small">W</span><input className="rt-num" type="number" value={Math.round(Math.abs(sh.x1 - sh.x0) * ow)} onChange={(e) => set({ x1: sh.x0 + (Math.sign(sh.x1 - sh.x0) || 1) * Number(e.target.value) / ow })} />
        <span className="muted small">H</span><input className="rt-num" type="number" value={Math.round(Math.abs(sh.y1 - sh.y0) * oh)} onChange={(e) => set({ y1: sh.y0 + (Math.sign(sh.y1 - sh.y0) || 1) * Number(e.target.value) / oh })} />
      </div>
      {sh.kind !== 'line' && <label className="dev-check"><input type="checkbox" checked={!!sh.fill} onChange={(e) => set({ fill: e.target.checked ? rx.rt.fg : null })} />Fill</label>}
      {(sh.fill || sh.kind === 'line') && <div className="rt-prop-row"><span className="muted small grow">{sh.kind === 'line' ? 'Colour' : 'Fill'}</span><ColorInput value={sh.fill || [1, 1, 1]} onChange={(fill) => set({ fill })} /></div>}
      {sh.kind !== 'line' && <label className="dev-check"><input type="checkbox" checked={!!sh.stroke} onChange={(e) => set({ stroke: e.target.checked ? { color: rx.rt.shape.strokeColor, width: rx.rt.shape.strokeW } : null })} />Stroke</label>}
      {sh.stroke && (
        <>
          <div className="rt-prop-row"><span className="muted small grow">Stroke colour</span><ColorInput value={sh.stroke.color} onChange={(color) => set({ stroke: { ...sh.stroke, color } })} /></div>
          <Slider sl={sl('w', 'Stroke (px)', 1, 500, 1, { log: true })} value={Math.max(1, Math.round(sh.stroke.width * L))} def={Math.round(0.002 * L)} onSet={(k, v) => set({ stroke: { ...sh.stroke, width: v / L } })} />
        </>
      )}
      {sh.kind === 'rect' && <Slider sl={sl('radius', 'Corner radius (px)', 0, 1000)} value={Math.round((sh.radius || 0) * L)} def={0} onSet={(k, v) => set({ radius: v / L })} />}
      {sh.kind === 'polygon' && <><Slider sl={sl('sides', 'Sides', 3, 100)} value={sh.sides || 5} def={5} onSet={(k, v) => set({ sides: v })} /><label className="dev-check"><input type="checkbox" checked={!!sh.star} onChange={(e) => set({ star: e.target.checked })} />Star</label></>}
      {sh.kind === 'line' && <Slider sl={sl('weight', 'Weight (px)', 1, 500, 1, { log: true })} value={Math.max(1, Math.round((sh.weight || 0.003) * L))} def={Math.round(0.003 * L)} onSet={(k, v) => set({ weight: v / L })} />}
    </>
  );
}
