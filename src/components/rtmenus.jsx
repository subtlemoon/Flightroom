// Retouch's menu bar (File, Edit, Image, Layer, Type, Select, Filter, View,
// Window, Help: built in retouch.jsx) and the dialogs its commands open.
// Dialogs float over the photo without dimming it, so every change shows live.
import { useEffect, useRef, useState } from 'react';
import { Dropdown, Icon } from './ui.jsx';
import { Slider } from './slider.jsx';
import { BLEND_MODES, COLOR_RANGES, bitmapSelection, colorRange } from '../develop/retouch.js';
import { FILTER_DEF } from '../develop/filters.js';
import { TOOLS } from './retouch.jsx';
import { ColorInput, FilterParams, sl } from './rtpanels.jsx';

export function MenuBar({ menus }) {
  const [open, setOpen] = useState(null); // index
  const bar = useRef();
  useEffect(() => {
    if (open === null) return;
    const away = (e) => { if (!bar.current?.contains(e.target)) setOpen(null); };
    const key = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(null); } };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', key, true); };
  }, [open]);
  return (
    <nav className="rt-menubar" ref={bar}>
      {menus.map((m, i) => (
        <div key={m.label} className="rt-menubar-item">
          <button className={open === i ? 'on' : ''} onClick={() => setOpen(open === i ? null : i)} onPointerEnter={() => open !== null && setOpen(i)}>{m.label}</button>
          {open === i && <MenuList items={m.items} done={() => setOpen(null)} />}
        </div>
      ))}
    </nav>
  );
}

function MenuList({ items, done, sub }) {
  const [hover, setHover] = useState(null);
  return (
    <div className={`rt-menu${sub ? ' sub' : ''}`}>
      {items.map((it, i) => {
        if (!it) return <div key={i} className="rt-menu-line" />;
        const has = !!it.items;
        return (
          <div key={i} className="rt-menu-wrap" onPointerEnter={() => setHover(i)}>
            <button className={`rt-menu-item${hover === i && has ? ' on' : ''}`} disabled={it.disabled}
              onClick={() => { if (has) { setHover(i); return; } done(); it.run?.(); }}>
              <span className="rt-check-mark">{it.check ? '✓' : ''}</span>
              <span className="grow">{it.label}</span>
              {it.key && <span className="rt-key">{it.key}</span>}
              {has && <Icon name="chevR" size={11} />}
            </button>
            {has && hover === i && !it.disabled && <MenuList items={it.items} done={done} sub />}
          </div>
        );
      })}
    </div>
  );
}

/** A dialog over the photo: Enter keeps, Escape cancels. */
function Dialog({ title, onOk, onCancel, children, okLabel = 'OK', wide, className = '' }) {
  const ok = useRef(onOk), cancel = useRef(onCancel);
  ok.current = onOk; cancel.current = onCancel;
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cancel.current(); }
      else if (e.key === 'Enter' && !e.target.closest?.('textarea')) { e.stopImmediatePropagation(); e.preventDefault(); ok.current?.(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  return (
    <div className={`rt-dialog${wide ? ' wide' : ''} ${className}`} role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
      <div className="rt-dialog-head"><span className="grow">{title}</span><button className="icon-btn tiny" onClick={onCancel}><Icon name="x" size={12} /></button></div>
      <div className="rt-dialog-body">{children}</div>
      <div className="rt-dialog-foot">
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
        {onOk && <button className="btn btn-sm btn-primary" onClick={onOk}>{okLabel}</button>}
      </div>
    </div>
  );
}

const row = (label, el) => <div className="rt-prop-row"><span className="muted small grow">{label}</span>{el}</div>;

export function RetouchDialogs({ rx }) {
  const d = rx.dialog;
  if (!d) return null;
  const close = () => rx.setDialog(null);
  const props = { rx, d, close };
  switch (d.type) {
    case 'fill': return <FillDialog {...props} />;
    case 'stroke': return <StrokeDialog {...props} />;
    case 'modify': return <ModifyDialog {...props} />;
    case 'colorRange': return <ColorRangeDialog {...props} />;
    case 'filter': return <FilterDialog {...props} />;
    case 'style': return <StyleDialog {...props} />;
    case 'solid': return <SolidDialog {...props} />;
    case 'rename': return <NameDialog {...props} title="Rename Layer" label="Name" onOk={(n) => rx.acts.rename(d.id, n)} value={d.name} />;
    case 'saveSel': return <NameDialog {...props} title="Save Selection" label="Name" onOk={(n) => rx.sel.save(n)} value={d.name} />;
    case 'loadSel': return <LoadSelDialog {...props} />;
    case 'guide': return <GuideDialog {...props} />;
    case 'keys': return <KeysDialog {...props} />;
    default: return null;
  }
}

function FillDialog({ rx, close }) {
  const [what, setWhat] = useState('fg');
  const [color, setColor] = useState(rx.rt.fg);
  const [opacity, setOpacity] = useState(100);
  const colors = { fg: rx.rt.fg, bg: rx.rt.bg, color, black: [0, 0, 0], gray: [0.5, 0.5, 0.5], white: [1, 1, 1] };
  const ok = () => { close(); if (what === 'aware') rx.contentAware(); else rx.fillWith(colors[what], opacity, 'Fill'); };
  return (
    <Dialog title="Fill" onOk={ok} onCancel={close}>
      {row('Contents', <Dropdown value={what} onChange={setWhat} options={[{ value: 'fg', label: 'Foreground Color' }, { value: 'bg', label: 'Background Color' }, { value: 'color', label: 'Color…' },
        { value: 'aware', label: 'Content-Aware', disabled: !rx.selection }, { value: 'black', label: 'Black' }, { value: 'gray', label: '50% Gray' }, { value: 'white', label: 'White' }]} />)}
      {what === 'color' && row('Colour', <ColorInput value={color} onChange={setColor} />)}
      {what !== 'aware' && <Slider sl={sl('opacity', 'Opacity', 1, 100)} value={opacity} def={100} onSet={(k, v) => setOpacity(v)} />}
      <p className="muted small">{rx.selection ? 'Fills the selection' : 'Fills the whole layer'} on {rx.cur ? rx.cur.name : 'a new layer'}.</p>
    </Dialog>
  );
}

function StrokeDialog({ rx, close }) {
  const [w, setW] = useState(4);
  const [color, setColor] = useState(rx.rt.fg);
  return (
    <Dialog title="Stroke" onOk={() => { close(); rx.strokeSel(w, color); }} onCancel={close}>
      <Slider sl={sl('w', 'Width (px)', 1, 250)} value={w} def={4} onSet={(k, v) => setW(v)} />
      {row('Colour', <ColorInput value={color} onChange={setColor} />)}
    </Dialog>
  );
}

const MODIFY = { border: ['Border Selection', 'Width', 10], smooth: ['Smooth Selection', 'Sample Radius', 4], expand: ['Expand Selection', 'Expand By', 8], contract: ['Contract Selection', 'Contract By', 8], feather: ['Feather Selection', 'Feather Radius', 10] };
function ModifyDialog({ rx, d, close }) {
  const [title, label, def] = MODIFY[d.how];
  const [px, setPx] = useState(def);
  return (
    <Dialog title={title} onOk={() => { close(); rx.sel.modify(d.how, px); }} onCancel={close}>
      <Slider sl={sl('px', `${label} (px)`, d.how === 'feather' ? 0.1 : 1, 500, d.how === 'feather' ? 0.1 : 1)} value={px} def={def} onSet={(k, v) => setPx(v)} />
    </Dialog>
  );
}

// Color Range: picks as you go (clicks on the photo add samples); Cancel puts the old selection back.
function ColorRangeDialog({ rx, d, close }) {
  const orig = useRef(rx.selection);
  const img = useRef(null);
  const [invert, setInvert] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (d.range === 'sampled' && !d.colors.length) return;
      img.current ||= rx.picture(1024);
      const pic = img.current;
      if (!pic) return;
      const v = colorRange(pic, d);
      if (invert) for (let i = 0; i < v.length; i++) v[i] = 255 - v[i];
      rx.setSelection(bitmapSelection(v, pic.w, pic.h));
    }, 90);
    return () => clearTimeout(t);
  }, [d.range, d.colors, d.fuzz, invert]);
  const set = (patch) => rx.setDialog({ ...d, ...patch });
  return (
    <Dialog title="Color Range" className="side" onOk={close} onCancel={() => { rx.setSelection(orig.current); close(); }}>
      {row('Select', <Dropdown value={d.range} onChange={(range) => set({ range })} options={COLOR_RANGES.map(([value, label]) => ({ value, label }))} />)}
      {(d.range === 'sampled' || d.range === 'skin') && <Slider sl={sl('fuzz', 'Fuzziness', 0, 200)} value={d.fuzz} def={40} onSet={(k, v) => set({ fuzz: v })} />}
      {d.range === 'sampled' && (
        <div className="rt-prop-row">
          <span className="muted small grow">{d.colors.length ? `${d.colors.length} colour${d.colors.length > 1 ? 's' : ''} sampled` : 'Click the photo to sample a colour'} (Shift+click adds)</span>
          {d.colors.slice(-6).map((c, i) => <span key={i} className="rt-sample" style={{ background: `rgb(${c.join(',')})` }} />)}
          {d.colors.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => set({ colors: [] })}>Clear</button>}
        </div>
      )}
      <label className="dev-check"><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />Invert</label>
    </Dialog>
  );
}

function FilterDialog({ rx, d, close }) {
  const l = rx.acts.byId(d.layer);
  const f = l?.filters?.find((x) => x.id === d.fid);
  useEffect(() => { if (!f) close(); }, [!!f]);
  if (!f) return null;
  const cancel = () => {
    if (d.orig) rx.acts.changeFilter(d.layer, d.fid, d.orig);
    else rx.acts.removeFilter(d.layer, d.fid);
    close();
  };
  return (
    <Dialog title={FILTER_DEF[f.type].label.replace('…', '')} className="side" onOk={close} onCancel={cancel}>
      <FilterParams f={f} onSet={(k, v) => rx.acts.changeFilter(d.layer, d.fid, { [k]: v })} />
      <p className="muted small">The filter stays live on {l.name}: change it any time from the Layers or Properties panel.</p>
    </Dialog>
  );
}

const STYLE_DEFAULTS = {
  shadow: { on: true, color: [0, 0, 0], opacity: 75, angle: 120, distance: 0.004, size: 0.004, spread: 0, blend: 'multiply' },
  glow: { on: true, color: [1, 1, 0.75], opacity: 75, size: 0.006, spread: 0, blend: 'screen' },
  stroke: { on: true, color: [1, 0, 0], opacity: 100, size: 0.002 },
  overlay: { on: true, color: [1, 0, 0], opacity: 100 },
};
const STYLE_TABS = [['blend', 'Blending Options'], ['stroke', 'Stroke'], ['overlay', 'Color Overlay'], ['glow', 'Outer Glow'], ['shadow', 'Drop Shadow']];

function StyleDialog({ rx, d, close }) {
  const l = rx.acts.byId(d.id);
  const orig = useRef(l && { style: l.style, blend: l.blend, opacity: l.opacity, fill: l.fill });
  const [tab, setTab] = useState(d.tab);
  const L = rx.L;
  const style = l?.style || {};
  const set = (fx, patch) => rx.acts.change(d.id, { style: { ...style, [fx]: { ...STYLE_DEFAULTS[fx], ...style[fx], ...patch } } }, 'Layer Style');
  useEffect(() => { if (d.enable && d.tab !== 'blend' && !(style[d.tab]?.on)) set(d.tab, { on: true }); }, []);
  if (!l) return null;
  const fx = style[tab] || { ...STYLE_DEFAULTS[tab], on: false };
  const pxSl = (key, label, max = 250) => <Slider sl={sl(key, `${label} (px)`, 0, max)} value={Math.round((fx[key] || 0) * L)} def={Math.round(STYLE_DEFAULTS[tab][key] * L)} onSet={(k, v) => set(tab, { [k]: v / L })} />;
  return (
    <Dialog title="Layer Style" wide onOk={close} onCancel={() => { rx.acts.change(d.id, orig.current, 'Layer Style'); close(); }}>
      <div className="rt-style">
        <div className="rt-style-tabs">
          {STYLE_TABS.map(([k, label]) => (
            <div key={k} className={`rt-style-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {k !== 'blend' && <input type="checkbox" checked={!!style[k]?.on} onChange={(e) => set(k, { on: e.target.checked })} onClick={(e) => e.stopPropagation()} />}
              {label}
            </div>
          ))}
        </div>
        <div className="rt-style-body">
          {tab === 'blend' ? (
            <>
              {row('Blend Mode', <Dropdown value={l.blend} onChange={(blend) => rx.acts.change(l.id, { blend }, 'Blending')} options={BLEND_MODES.map(([value, label]) => ({ value, label }))} />)}
              <Slider sl={sl('opacity', 'Opacity', 0, 100)} value={l.opacity} def={100} onSet={(k, v) => rx.acts.change(l.id, { opacity: v }, 'Blending')} />
              <Slider sl={sl('fill', 'Fill Opacity', 0, 100)} value={l.fill ?? 100} def={100} onSet={(k, v) => rx.acts.change(l.id, { fill: v }, 'Blending')} />
              <p className="muted small">Fill Opacity fades the layer's own pixels but not its effects.</p>
            </>
          ) : (
            <>
              <label className="dev-check"><input type="checkbox" checked={!!fx.on} onChange={(e) => set(tab, { on: e.target.checked })} />{STYLE_TABS.find(([k]) => k === tab)[1]}</label>
              {(tab === 'shadow' || tab === 'glow') && row('Blend Mode', <Dropdown value={fx.blend} onChange={(blend) => set(tab, { blend })} options={BLEND_MODES.map(([value, label]) => ({ value, label }))} />)}
              {row('Colour', <ColorInput value={fx.color} onChange={(color) => set(tab, { color })} />)}
              <Slider sl={sl('opacity', 'Opacity', 0, 100)} value={fx.opacity} def={STYLE_DEFAULTS[tab].opacity} onSet={(k, v) => set(tab, { opacity: v })} />
              {tab === 'shadow' && <Slider sl={sl('angle', 'Angle', -180, 180)} value={fx.angle} def={120} onSet={(k, v) => set(tab, { angle: v })} />}
              {tab === 'shadow' && pxSl('distance', 'Distance', 500)}
              {(tab === 'shadow' || tab === 'glow') && <Slider sl={sl('spread', 'Spread', 0, 100)} value={fx.spread} def={0} onSet={(k, v) => set(tab, { spread: v })} />}
              {tab !== 'overlay' && pxSl('size', 'Size')}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function SolidDialog({ rx, d, close }) {
  const l = rx.acts.byId(d.id);
  if (!l) return null;
  return (
    <Dialog title="Color Picker (Solid Color)" className="side" onOk={close} onCancel={() => { rx.acts.remove(d.id); close(); }}>
      {row('Colour', <ColorInput value={l.fillDef.color} onChange={(color) => rx.acts.change(l.id, { fillDef: { ...l.fillDef, color } }, 'Color Fill')} />)}
      <div className="rt-swatches">{rx.rt.swatches.slice(0, 20).map((h, i) => <button key={i} className="rt-sw" style={{ background: h }} onClick={() => rx.acts.change(l.id, { fillDef: { ...l.fillDef, color: [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16) / 255) } }, 'Color Fill')} />)}</div>
    </Dialog>
  );
}

function NameDialog({ title, label, value, onOk, close }) {
  const [v, setV] = useState(value || '');
  return (
    <Dialog title={title} onOk={() => { if (v.trim()) onOk(v.trim()); close(); }} onCancel={close}>
      {row(label, <input className="rt-text" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key !== 'Enter' && e.key !== 'Escape' && e.stopPropagation()} />)}
    </Dialog>
  );
}

function LoadSelDialog({ rx, close }) {
  const chans = rx.channels || [];
  const [name, setName] = useState(chans[0]?.name);
  const [mode, setMode] = useState('new');
  return (
    <Dialog title="Load Selection" onOk={() => { rx.sel.load(name, mode); close(); }} onCancel={close}>
      {row('Channel', <Dropdown value={name} onChange={setName} options={chans.map((c) => ({ value: c.name, label: c.name }))} />)}
      <div className="seg small">{[['new', 'New'], ['add', 'Add'], ['sub', 'Subtract'], ['and', 'Intersect']].map(([k, n]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{n}</button>)}</div>
    </Dialog>
  );
}

function GuideDialog({ rx, d, close }) {
  const [v, setV] = useState(d.v);
  const [at, setAt] = useState(d.at);
  return (
    <Dialog title="New Guide" onOk={() => { rx.setGuides((g) => [...g, { v, at: at / 100 }]); rx.setRt({ view: { ...rx.rt.view, guides: true, extras: true } }); close(); }} onCancel={close}>
      <div className="seg small">{[[false, 'Horizontal'], [true, 'Vertical']].map(([k, n]) => <button key={n} className={v === k ? 'on' : ''} onClick={() => setV(k)}>{n}</button>)}</div>
      <Slider sl={sl('at', 'Position (%)', 0, 100, 0.1)} value={at} def={50} onSet={(k, x) => setAt(x)} />
    </Dialog>
  );
}

function KeysDialog({ rx, close }) {
  const out = [];
  const walk = (items, path) => items?.forEach((it) => { if (!it) return; if (it.items) walk(it.items, `${path}${it.label} › `); else if (it.key) out.push([`${path}${it.label}`, it.key]); });
  rx.menus.forEach((m) => walk(m.items, `${m.label} › `));
  const tools = TOOLS.map(([, label, , key]) => [label, key]);
  return (
    <Dialog title="Keyboard Shortcuts" wide onCancel={close}>
      <div className="rt-keys">
        <div><div className="dev-group-title">Menus</div>{out.map(([n, k]) => <div key={n} className="rt-keyrow"><span className="grow">{n}</span><span className="rt-key">{k}</span></div>)}</div>
        <div>
          <div className="dev-group-title">Tools (Shift+key goes round a group)</div>
          {tools.map(([n, k]) => <div key={n} className="rt-keyrow"><span className="grow">{n}</span><span className="rt-key">{k}</span></div>)}
          <div className="dev-group-title">Painting</div>
          {[['Brush smaller / bigger', '[ ]'], ['Softer / harder', 'Shift+[ ]'], ['Opacity 10–100%', '1 … 0'], ['Swap / default colours', 'X / D'], ['Quick Mask', 'Q'],
            ['Hand (hold)', 'Space'], ['Straight line from the last stroke', 'Shift+click'], ['Clone / heal source', 'Alt+click'], ['Clear selection on the layer', 'Delete'],
            ['Nudge (×10)', 'Arrows (Shift)'], ['Develop ↔ Retouch', 'Ctrl+E']].map(([n, k]) => <div key={n} className="rt-keyrow"><span className="grow">{n}</span><span className="rt-key">{k}</span></div>)}
        </div>
      </div>
    </Dialog>
  );
}

