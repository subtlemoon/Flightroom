// Masking, as in Lightroom, but without a panel floating over the photo: the
// mask list and a mask preview sit on the left (where Lightroom has the
// Navigator), the shapes are drawn on the photo, and the selected mask's
// sliders take over the right panel.
import { useEffect, useRef, useState } from 'react';
import { Dropdown, Icon } from './ui.jsx';
import { Slider } from './slider.jsx';
import { CurveEditor } from './curve.jsx';
import {
  AI_TYPES, LOCAL_SECTIONS, MASK_PRESETS, MAX_MASKS, PART_LABEL, PART_TYPES, POINT_DEFAULT, aiName, maskRaster, newId, newMask, newPart, presetName,
} from '../develop/masks.js';
import { CURVE_CHANNELS, LINEAR_CURVE } from '../develop/params.js';

export const OVERLAY_STYLES = [['color', 'Color overlay'], ['both', 'Color and outline'], ['outline', 'Outline only'], ['matte', 'White on black'], ['image', 'Image on black']];
const OVERLAY_COLORS = ['#ff3b5c', '#ff9f1a', '#ffe14d', '#3ddc84', '#3db8ff', '#8b7bff', '#ffffff'];
// The colour stays off the main photo unless turned on; the preview always shows it.
export const OVERLAY_DEFAULT = { show: false, color: '#ff3b5c', opacity: 50, style: 'both', line: 2 };
export const BRUSH_DEFAULT = { size: 20, feather: 50, flow: 100, erase: false };
// Panel options kept between launches: new masks start from zero (Lightroom's
// "Reset Sliders Automatically"), and which sections are open.
export const MASK_OPTIONS_DEFAULT = { resetAuto: true, open: { tone: true, color: true } };

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** What the renderer needs to show a mask on top of the photo. */
export const maskView = (m, o) => (m ? { id: m.id, color: hexRgb(o.color), opacity: o.opacity / 100, style: o.style, line: o.line, ai: m.parts.some((p) => p.type === 'ai') } : null);
/** Brush radius, as a fraction of the photo's long edge. */
export const brushRadius = (b) => Math.max(0.001, b.size * 0.0015);

/** A small settings object kept between launches. */
export function useStored(key, def) {
  const [v, setV] = useState(() => { try { return { ...def, ...JSON.parse(localStorage.getItem(key)) }; } catch { return def; } });
  const set = (patch) => setV((old) => {
    const n = { ...old, ...patch };
    try { localStorage.setItem(key, JSON.stringify(n)); } catch {}
    return n;
  });
  return [v, set];
}

/** Edits to the masks; `sel` is { mask, part } (ids). */
export function maskActions(s, update, sel, setSel, options = MASK_OPTIONS_DEFAULT) {
  const masks = s?.masks || [];
  const setMasks = (fn) => update((old) => ({ ...old, masks: fn(old.masks || []), masksOwned: true }));
  const mapMask = (id, fn) => setMasks((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  const remove = (id) => { setMasks((ms) => ms.filter((m) => m.id !== id)); if (sel?.mask === id) setSel(null); };
  const createWith = (part, name) => {
    if (masks.length >= MAX_MASKS) return;
    // Without "Reset Sliders Automatically", a new mask starts with the last one's sliders.
    const last = masks.find((m) => m.id === sel?.mask) || masks[masks.length - 1];
    const m = newMask(part, masks, options.resetAuto || !last ? {} : { ...last.adj });
    if (name) m.name = name;
    setMasks((ms) => [...ms, m]);
    setSel({ mask: m.id, part: m.parts[0].id });
  };
  const addPartObj = (id, p) => {
    mapMask(id, (m) => ({ ...m, parts: [...m.parts, p] }));
    setSel({ mask: id, part: p.id });
  };
  return {
    create: (type) => createWith(newPart(type)),
    createWith,
    addPart: (id, type, mode) => addPartObj(id, newPart(type, mode)),
    addPartObj,
    removeAll() { setMasks(() => []); setSel(null); },
    removePart(id, pid) {
      const m = masks.find((x) => x.id === id);
      if (!m) return;
      if (m.parts.length <= 1) { remove(id); return; }
      mapMask(id, (x) => ({ ...x, parts: x.parts.filter((p) => p.id !== pid) }));
      if (sel?.part === pid) setSel({ mask: id, part: m.parts.find((p) => p.id !== pid).id });
    },
    remove,
    duplicate(id) {
      const m = masks.find((x) => x.id === id);
      if (!m || masks.length >= MAX_MASKS) return;
      const copy = { ...m, id: newId(), name: `${m.name} copy`, parts: m.parts.map((p) => ({ ...p, id: newId() })) };
      setMasks((ms) => { const i = ms.findIndex((x) => x.id === id); return [...ms.slice(0, i + 1), copy, ...ms.slice(i + 1)]; });
      setSel({ mask: copy.id, part: copy.parts[0].id });
    },
    change: (id, patch) => mapMask(id, (m) => ({ ...m, ...patch })),
    setAdj: (id, key, v) => mapMask(id, (m) => ({ ...m, adj: { ...m.adj, [key]: v } })),
    changePart: (id, pid, patch) => mapMask(id, (m) => ({
      ...m, parts: m.parts.map((p) => (p.id === pid ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)),
    })),
  };
}

// --- the left panel ---------------------------------------------------------------

export function MaskPanel({ s, size, sel, setSel, acts, overlay, setOverlay, ai, presets }) {
  const masks = s?.masks || [];
  const [menu, setMenu] = useState(null); // 'new' | { mask, mode }
  const pickAi = (type, target) => { setMenu(null); ai.run(type, target); };
  return (
    <div className="mask-panel">
      <MaskPreview has={!!s} selected={masks.find((m) => m.id === sel?.mask)} />
      {presets}
      <div className="mask-head">
        <span className="grow">Masks</span>
        <span className="muted small">{masks.length} of {MAX_MASKS}</span>
      </div>
      <div className="mask-create">
        <button className="btn btn-sm btn-primary mask-new" disabled={!s || masks.length >= MAX_MASKS} onClick={() => { if (menu !== 'new') ai.warm(); setMenu(menu === 'new' ? null : 'new'); }}>
          <Icon name="plus" size={14} />Create new mask
        </button>
        {menu === 'new' && <PartMenu onPick={(t) => { setMenu(null); acts.create(t); }} onAi={(t) => pickAi(t)} onClose={() => setMenu(null)} />}
      </div>
      {ai.busy && <div className="ai-busy small"><span className="ai-spin" />Finding {ai.busy.toLowerCase()}…</div>}
      {ai.picker}
      <div className="mask-list">
        {masks.map((m) => (
          <MaskRow key={m.id} m={m} size={size} active={sel?.mask === m.id} selPart={sel?.part} setSel={setSel} acts={acts}
            menu={menu?.mask === m.id ? menu : null} setMenu={setMenu} full={masks.length >= MAX_MASKS} onAi={pickAi} />
        ))}
        {s && !masks.length && <p className="muted small mask-empty">Masks change part of the photo: let AI select the subject, sky, people or background, paint with a brush (K), or drag a linear (M) or radial (Shift+M) gradient.</p>}
      </div>
      <OverlaySettings overlay={overlay} setOverlay={setOverlay} />
    </div>
  );
}

function PartMenu({ onPick, onAi, onClose, mode }) {
  const ref = useRef();
  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [onClose]);
  return (
    <div className="mask-menu" ref={ref}>
      <div className="mask-menu-title">AI</div>
      {AI_TYPES.map(([t, label]) => (
        <button key={t} className="mask-menu-item" onClick={() => onAi(t)}><Icon name={t} size={15} /><span className="grow">{t === 'people' || t === 'landscape' ? `${label}…` : label}</span></button>
      ))}
      <div className="mask-menu-title">Tools</div>
      {PART_TYPES.filter(([t]) => !(mode === 'subtract' && t === 'luminance')).map(([t, label, key]) => (
        <button key={t} className="mask-menu-item" onClick={() => onPick(t)}>
          <Icon name={t} size={15} /><span className="grow">{t === 'luminance' && mode ? 'Intersect with luminance range' : label}</span>{!mode && key && <kbd>{key}</kbd>}
        </button>
      ))}
    </div>
  );
}

const MODE_LABEL = { add: 'Add', subtract: 'Subtract', intersect: 'Intersect' };

function MaskRow({ m, size, active, selPart, setSel, acts, menu, setMenu, full, onAi }) {
  const [renaming, setRenaming] = useState(false);
  const btn = (icon, title, fn, on) => (
    <button className={`icon-btn tiny${on ? ' on' : ''}`} title={title} onClick={(e) => { e.stopPropagation(); fn(); }}><Icon name={icon} size={13} /></button>
  );
  return (
    <div className={`mask-item${active ? ' on' : ''}${m.hidden ? ' off' : ''}`}>
      <div className="mask-row" onClick={() => setSel(active ? null : { mask: m.id, part: m.parts[0]?.id })}>
        <MaskThumb m={m} size={size} />
        {renaming ? (
          <input className="mask-rename" autoFocus defaultValue={m.name} onClick={(e) => e.stopPropagation()}
            onBlur={(e) => { acts.change(m.id, { name: e.target.value.trim() || m.name }); setRenaming(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(false); }} />
        ) : (
          <span className="grow mask-name" title={`${m.name} (double-click to rename)`} onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); }}>{m.name}</span>
        )}
        <span className="mask-btns">
          {btn(m.hidden ? 'eyeOff' : 'eye', m.hidden ? 'Turn this mask back on' : 'Turn this mask off', () => acts.change(m.id, { hidden: !m.hidden }), m.hidden)}
          {btn('invert', 'Invert', () => acts.change(m.id, { invert: !m.invert }), m.invert)}
          {!full && btn('copy', 'Duplicate', () => acts.duplicate(m.id))}
          {btn('trash', 'Delete mask', () => acts.remove(m.id))}
        </span>
      </div>
      {active && (
        <div className="mask-parts">
          {m.parts.map((p) => (
            <div key={p.id} className={`mask-part${selPart === p.id ? ' on' : ''}`} onClick={() => setSel({ mask: m.id, part: p.id })}>
              <Icon name={p.type === 'ai' ? 'ai' : p.type} size={14} />
              <span className="grow">{p.type === 'ai' ? aiName(p.kind.split('+')[0]) + (p.kind.includes('+') ? ' +' : '') : PART_LABEL[p.type]}{p.placed === false && <span className="muted"> · drag on the photo</span>}</span>
              {m.parts.length > 1 && <span className={`mask-mode ${p.mode}`}>{MODE_LABEL[p.mode]}</span>}
              <button className="icon-btn tiny" title="Remove" onClick={(e) => { e.stopPropagation(); acts.removePart(m.id, p.id); }}><Icon name="x" size={12} /></button>
            </div>
          ))}
          <div className="mask-add">
            <button className="btn btn-sm btn-ghost" onClick={() => setMenu({ mask: m.id, mode: 'add' })}><Icon name="plus" size={13} />Add</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setMenu({ mask: m.id, mode: 'subtract' })}><Icon name="minus" size={13} />Subtract</button>
          </div>
          {menu && <PartMenu mode={menu.mode} onClose={() => setMenu(null)} onAi={(t) => onAi(t, { mask: m.id, mode: menu.mode })}
            onPick={(t) => { setMenu(null); acts.addPart(m.id, t, t === 'luminance' ? 'intersect' : menu.mode); }} />}
        </div>
      )}
    </div>
  );
}

// The mask's shape in miniature, white on black.
function MaskThumb({ m, size }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c || !size) return;
    const r = maskRaster(m, size.ow, size.oh);
    const tmp = document.createElement('canvas');
    tmp.width = r.W; tmp.height = r.H;
    const img = tmp.getContext('2d').createImageData(r.W, r.H);
    for (let i = 0; i < r.data.length; i++) {
      const v = m.invert ? 255 - r.data[i] : r.data[i];
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    tmp.getContext('2d').putImageData(img, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / r.W, c.height / r.H);
    ctx.drawImage(tmp, (c.width - r.W * k) / 2, (c.height - r.H * k) / 2, r.W * k, r.H * k);
  }, [m.parts, m.invert, size?.ow, size?.oh]);
  return <canvas className="mask-thumb" ref={ref} />;
}

// In place of Lightroom's Navigator: the whole photo with the selected mask on it.
function MaskPreview({ has, selected }) {
  const ref = useRef();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = (e) => {
      const { w, h, px } = e.detail;
      const c = ref.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = w; c.height = h;
      c.style.width = `${w / dpr}px`; c.style.height = `${h / dpr}px`;
      const img = c.getContext('2d').createImageData(w, h);
      const row = w * 4;
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
      c.getContext('2d').putImageData(img, 0, 0);
      setShown(true);
    };
    window.addEventListener('develop:preview', on);
    return () => window.removeEventListener('develop:preview', on);
  }, []);
  return (
    <div className="mask-preview">
      <canvas ref={ref} style={{ display: has && shown ? 'block' : 'none' }} />
      {!(has && shown) && <span className="muted small">Mask preview</span>}
      {has && shown && <span className="mask-preview-tag">{selected ? selected.name : 'No mask selected'}</span>}
    </div>
  );
}

const OPACITY = { key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, def: 50 };
const LINE = { key: 'line', label: 'Outline', min: 1, max: 6, step: 0.5, def: 2, decimals: 1 };

function OverlaySettings({ overlay, setOverlay }) {
  const outline = overlay.style === 'both' || overlay.style === 'outline';
  const colored = overlay.style !== 'matte' && overlay.style !== 'image';
  return (
    <div className="mask-overlay-set">
      <div className="dev-group-title">Overlay</div>
      <label className="dev-check"><input type="checkbox" checked={overlay.show} onChange={(e) => setOverlay({ show: e.target.checked })} />Also show on the main photo (O)</label>
      <div className="dev-line dev-wb"><span className="muted">Style</span>
        <Dropdown value={overlay.style} options={OVERLAY_STYLES.map(([value, label]) => ({ value, label }))} onChange={(v) => setOverlay({ style: v })} />
      </div>
      {colored && (
        <div className="mask-swatches">
          {OVERLAY_COLORS.map((c) => (
            <button key={c} className={`mask-swatch${overlay.color === c ? ' on' : ''}`} style={{ background: c }} title={c} onClick={() => setOverlay({ color: c })} />
          ))}
          <label className={`mask-swatch custom${OVERLAY_COLORS.includes(overlay.color) ? '' : ' on'}`} title="Any colour"
            style={OVERLAY_COLORS.includes(overlay.color) ? undefined : { background: overlay.color }}>
            <input type="color" value={overlay.color} onChange={(e) => setOverlay({ color: e.target.value })} />
          </label>
        </div>
      )}
      {colored && <Slider sl={OPACITY} value={overlay.opacity} def={50} onSet={(_, v) => setOverlay({ opacity: v })} />}
      {outline && <Slider sl={LINE} value={overlay.line} def={2} onSet={(_, v) => setOverlay({ line: v })} />}
    </div>
  );
}

// --- the right panel --------------------------------------------------------------

const AMOUNT = { key: 'amount', label: 'Amount', min: 0, max: 200, step: 1, def: 100 };
const SIZE = { key: 'size', label: 'Size', min: 1, max: 100, step: 1, def: 20 };
const FEATHER = { key: 'feather', label: 'Feather', min: 0, max: 100, step: 1, def: 50 };
const FLOW = { key: 'flow', label: 'Flow', min: 1, max: 100, step: 1, def: 100 };
const ROTATE = { key: 'angle', label: 'Angle', min: -180, max: 180, step: 1, def: 0 };
const LUM_LO = { key: 'lo', label: 'Range low', min: 0, max: 100, step: 1, def: 0 };
const LUM_HI = { key: 'hi', label: 'Range high', min: 0, max: 100, step: 1, def: 50 };
const SMOOTH = { key: 'smooth', label: 'Smoothness', min: 0, max: 100, step: 1, def: 20 };
const FINE_HUE = { key: 'hue', label: 'Hue', min: -10, max: 10, step: 0.1, def: 0, decimals: 1, gradient: 'hue' };
const TINT_HUE = { key: 'hue', label: 'Hue', min: 0, max: 359, step: 1, def: 0, gradient: 'spectrum' };
const TINT_SAT = { key: 'sat', label: 'Saturation', min: 0, max: 100, step: 1, def: 0 };
const POINT_SLIDERS = [
  { key: 'hue', label: 'Hue Shift', min: -100, max: 100, step: 1, def: 0, gradient: 'hue' },
  { key: 'sat', label: 'Sat Shift', min: -100, max: 100, step: 1, def: 0 },
  { key: 'lum', label: 'Lum Shift', min: -100, max: 100, step: 1, def: 0 },
  { key: 'variance', label: 'Variance', min: 0, max: 100, step: 1, def: 50 },
  { key: 'range', label: 'Range', min: 0, max: 100, step: 1, def: 50 },
];
const CURVE_TABS = [['curve', 'RGB'], ['curveR', 'Red'], ['curveG', 'Green'], ['curveB', 'Blue']];
const REFINE = { key: 'refineSat', label: 'Refine Saturation', min: 0, max: 100, step: 1, def: 100 };
const TOOLS = [...AI_TYPES.map(([t, label]) => [t, label, true]), ...PART_TYPES.map(([t, label]) => [t, label, false])];
const swatch = (t) => (t && t.sat > 0 ? `hsl(${t.hue} ${30 + t.sat * 0.6}% 55%)` : null);
const hsvCss = (p) => `hsl(${p.h} ${Math.round(p.s * 100)}% ${Math.round(Math.max(8, Math.min(92, p.v * (1 - p.s / 2) * 100)))}%)`;

/**
 * The selected mask's settings, laid out like Lightroom's mask panel: tools to
 * add to it, preset and amount, then Tone, Color, Point Color, Curve, Effects
 * and Detail, each with an eye to compare without it.
 */
export function MaskAdjust({ m, part, acts, brush, setBrush, options, setOptions, ai, sampling, onSample, onDone }) {
  const setAdj = (k, v) => acts.setAdj(m.id, k, v);
  const setPart = (k, v) => acts.changePart(m.id, part.id, { [k]: v });
  const edited = Object.values(m.adj || {}).some((v) => v) || !!m.tint || !!m.point || !!m.curve;
  const open = options.open || {};
  const toggle = (id) => setOptions({ open: { ...open, [id]: !open[id] } });
  const [curveTab, setCurveTab] = useState('curve');
  const [tintOpen, setTintOpen] = useState(false);
  const preset = presetName(m);
  const point = m.point && { ...POINT_DEFAULT, ...m.point };
  const curve = { ...Object.fromEntries(CURVE_CHANNELS.map(([k]) => [k, LINEAR_CURVE])), ...m.curve };

  const section = (sec, body) => {
    const off = !!m.off?.[sec.id];
    return (
      <div key={sec.id} className={`mask-sec${open[sec.id] ? ' open' : ''}${off ? ' off' : ''}`}>
        <div className="mask-sec-head" role="button" tabIndex={0} onClick={() => toggle(sec.id)} onKeyDown={(e) => { if (e.key === 'Enter') toggle(sec.id); }}>
          <span className="dev-caret">{open[sec.id] ? '▾' : '▸'}</span>
          <span className="grow">{sec.title}</span>
          <button className={`icon-btn tiny${off ? ' on' : ''}`} title={off ? `Turn ${sec.title} back on` : `Hide ${sec.title} to compare`}
            onClick={(e) => { e.stopPropagation(); acts.change(m.id, { off: { ...m.off, [sec.id]: !off } }); }}><Icon name={off ? 'eyeOff' : 'eye'} size={13} /></button>
        </div>
        {open[sec.id] && <div className="mask-sec-body">{body}</div>}
      </div>
    );
  };
  const sliders = (list) => list.map((sl) => <Slider key={sl.key} sl={sl} value={m.adj?.[sl.key] ?? sl.def} def={sl.def} onSet={setAdj} />);
  const SEC = Object.fromEntries(LOCAL_SECTIONS.map((x) => [x.id, x]));

  return (
    <section className="dev-section open dev-tool mask-adjust">
      <div className="dev-section-head"><Icon name="mask" size={14} /><span className="grow">{m.name}</span>
        <span className={`dev-reset${edited ? ' on' : ''}`} role="button" title="Reset this mask's sliders"
          onClick={() => acts.change(m.id, { adj: {}, tint: null, point: null, curve: null, off: {} })}><Icon name="reset" size={13} /></span>
      </div>
      <div className="dev-section-body">
        <div className="mask-tools" title="Add to this mask">
          {TOOLS.map(([t, label, isAi], i) => (
            <button key={t} className={`icon-btn sm${!isAi && part?.type === t ? ' on' : ''}${i === AI_TYPES.length ? ' gap' : ''}`} title={`Add ${label.toLowerCase()}`}
              onClick={() => (isAi ? ai.run(t, { mask: m.id, mode: 'add' }) : acts.addPart(m.id, t, t === 'luminance' ? 'intersect' : 'add'))}><Icon name={t} size={15} /></button>
          ))}
        </div>
        {part && part.type !== 'ai' && (
          <div className="dev-group mask-tool">
            <div className="dev-group-title dev-line"><Icon name={part.type} size={13} />{PART_LABEL[part.type]}
              {m.parts.length > 1 && part.type !== 'luminance' && (
                <div className="seg small">
                  <button className={part.mode !== 'subtract' ? 'on' : ''} onClick={() => setPart('mode', 'add')}>Add</button>
                  <button className={part.mode === 'subtract' ? 'on' : ''} onClick={() => setPart('mode', 'subtract')}>Subtract</button>
                </div>
              )}
            </div>
            {part.type === 'brush' && (
              <>
                <div className="seg small full">
                  <button className={!brush.erase ? 'on' : ''} onClick={() => setBrush({ erase: false })}>Paint</button>
                  <button className={brush.erase ? 'on' : ''} onClick={() => setBrush({ erase: true })}>Erase</button>
                </div>
                <Slider sl={SIZE} value={brush.size} def={20} onSet={(_, v) => setBrush({ size: v })} />
                <Slider sl={FEATHER} value={brush.feather} def={50} onSet={(_, v) => setBrush({ feather: v })} />
                <Slider sl={FLOW} value={brush.flow} def={100} onSet={(_, v) => setBrush({ flow: v })} />
                <p className="muted small">Paint on the photo. Hold Alt to {brush.erase ? 'paint' : 'erase'}; [ and ] change the size.</p>
              </>
            )}
            {part.type === 'linear' && <p className="muted small">{part.placed === false ? 'Drag on the photo, from where the change is full to where it fades out.' : 'Drag the end dots to stretch it, the middle dot to move it and the middle line to turn it. Drag anywhere else to draw it again.'}</p>}
            {part.type === 'radial' && (
              <>
                {part.placed === false && <p className="muted small">Drag on the photo from the centre outward.</p>}
                <Slider sl={FEATHER} value={part.feather} def={50} onSet={setPart} />
                <Slider sl={ROTATE} value={part.angle} def={0} onSet={setPart} />
                <label className="dev-check"><input type="checkbox" checked={!!part.invert} onChange={(e) => setPart('invert', e.target.checked)} />Outside the shape</label>
              </>
            )}
            {part.type === 'luminance' && (
              <>
                <div className="mask-lum-bar"><span style={{ left: `${part.lo}%`, width: `${Math.max(0, part.hi - part.lo)}%` }} /></div>
                <Slider sl={LUM_LO} value={part.lo} def={0} onSet={(_, v) => acts.changePart(m.id, part.id, { lo: v, hi: Math.max(v, part.hi) })} />
                <Slider sl={LUM_HI} value={part.hi} def={50} onSet={(_, v) => acts.changePart(m.id, part.id, { hi: v, lo: Math.min(v, part.lo) })} />
                <Slider sl={SMOOTH} value={part.smooth} def={20} onSet={setPart} />
                <p className="muted small">Keeps the mask to parts of the photo this bright (0 is black, 100 white).</p>
              </>
            )}
          </div>
        )}
        <div className="dev-line dev-wb"><span className="muted">Preset</span>
          <Dropdown value={preset} options={[{ value: 'Custom', label: 'Custom', disabled: true }, ...MASK_PRESETS.map(([value]) => ({ value, label: value }))]}
            onChange={(v) => acts.change(m.id, { adj: { ...MASK_PRESETS.find(([n]) => n === v)[1] } })} />
        </div>
        <Slider sl={AMOUNT} value={m.amount ?? 100} def={100} onSet={(_, v) => acts.change(m.id, { amount: v })} />
        <label className="dev-check"><input type="checkbox" checked={!!m.invert} onChange={(e) => acts.change(m.id, { invert: e.target.checked })} />Invert</label>
        <label className="dev-check"><input type="checkbox" checked={options.resetAuto} onChange={(e) => setOptions({ resetAuto: e.target.checked })} />Reset Sliders Automatically</label>

        {section(SEC.tone, sliders(SEC.tone.sliders))}
        {section(SEC.color, (
          <>
            {sliders(SEC.color.sliders.filter((sl) => sl.key !== 'hue' && sl.key !== 'saturation'))}
            {m.fineHue ? <Slider sl={FINE_HUE} value={Math.max(-10, Math.min(10, m.adj?.hue ?? 0))} def={0} onSet={setAdj} /> : sliders(SEC.color.sliders.filter((sl) => sl.key === 'hue'))}
            <label className="dev-check"><input type="checkbox" checked={!!m.fineHue} onChange={(e) => acts.change(m.id, { fineHue: e.target.checked })} />Use Fine Adjustment</label>
            {sliders(SEC.color.sliders.filter((sl) => sl.key === 'saturation'))}
            <div className="dev-line mask-color"><span className="muted">Color</span>
              <button className={`mask-tint${m.tint?.sat ? '' : ' none'}`} style={swatch(m.tint) ? { background: swatch(m.tint) } : undefined}
                title="Tint the masked area with a colour" onClick={() => setTintOpen((o) => !o)} />
            </div>
            {tintOpen && (
              <div className="mask-tint-pop">
                <Slider sl={TINT_HUE} value={m.tint?.hue ?? 0} def={0} onSet={(_, v) => acts.change(m.id, { tint: { sat: 25, ...m.tint, hue: v } })} />
                <Slider sl={TINT_SAT} value={m.tint?.sat ?? 0} def={0} onSet={(_, v) => acts.change(m.id, { tint: { hue: 0, ...m.tint, sat: v } })} />
                <button className="btn btn-sm btn-ghost" onClick={() => { acts.change(m.id, { tint: null }); setTintOpen(false); }}>No colour</button>
              </div>
            )}
          </>
        ))}
        {section(SEC.point, (
          <>
            <div className="dev-line">
              <button className={`icon-btn sm${sampling ? ' on' : ''}`} title="Sample a colour from the photo" onClick={onSample}><Icon name="dropper" size={15} /></button>
              {point ? <span className="mask-point-chip" style={{ background: hsvCss(point) }} title="The sampled colour" /> : <span className="muted small grow">Pick a colour in the photo to change it</span>}
              {point && <span className="grow" />}
              {point && <button className="btn btn-sm btn-ghost" onClick={() => acts.change(m.id, { point: null })}>Clear</button>}
            </div>
            {point && POINT_SLIDERS.map((sl) => <Slider key={sl.key} sl={sl} value={point[sl.key]} def={sl.def} onSet={(k, v) => acts.change(m.id, { point: { ...point, [k]: v } })} />)}
            {point && <label className="dev-check"><input type="checkbox" checked={!!options.visualize} onChange={(e) => setOptions({ visualize: e.target.checked })} />Visualize Range</label>}
          </>
        ))}
        {section(SEC.curve, (
          <>
            <div className="seg small full">
              {CURVE_TABS.map(([k, label]) => <button key={k} className={curveTab === k ? 'on' : ''} onClick={() => setCurveTab(k)}>{label}</button>)}
            </div>
            <CurveEditor s={curve} channel={curveTab} set={(k, v) => acts.change(m.id, { curve: { ...curve, [k]: v } })} />
            <Slider sl={REFINE} value={m.refineSat ?? 100} def={100} onSet={(_, v) => acts.change(m.id, { refineSat: v })} />
          </>
        ))}
        {section(SEC.effects, (
          <>
            {sliders(SEC.effects.sliders)}
            <div className="dev-group-title">Grain</div>
            {sliders(SEC.effects.grain)}
          </>
        ))}
        {section(SEC.detail, sliders(SEC.detail.sliders))}
        <div className="dev-line dev-tool-foot">
          <button className="btn btn-sm btn-ghost" onClick={acts.removeAll}>Delete All Masks</button>
          <span className="grow" />
          <button className="btn btn-sm" onClick={onDone} title="Esc">Close</button>
        </div>
      </div>
    </section>
  );
}

// --- on the photo -------------------------------------------------------------------

/**
 * Draws and edits the selected part on the photo. toOri / toCss convert
 * between stage css px and oriented photo px.
 */
export function MaskOverlay({ geo, toOri, toCss, part, onPart, brush }) {
  const svg = useRef();
  const drag = useRef(null);
  const [cursor, setCursor] = useState(null); // [x, y, alt]
  const { ow, oh } = geo;
  const frac = (X, Y) => { const [x, y] = toOri(X, Y); return [x / ow, y / oh]; };
  const css = (fx, fy) => toCss(fx * ow, fy * oh);
  const [ax, ay] = toCss(0, 0), [bx, by] = toCss(1, 0);
  const k = Math.hypot(bx - ax, by - ay); // css px per photo px
  const local = (e) => { const r = svg.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const capture = (e) => { e.preventDefault(); e.stopPropagation(); svg.current.setPointerCapture(e.pointerId); };
  const down = (e) => {
    if (e.button !== 0) return;
    capture(e);
    const [X, Y] = local(e);
    const [fx, fy] = frac(X, Y);
    if (part.type === 'brush') {
      const st = { erase: brush.erase !== e.altKey, size: brushRadius(brush), feather: brush.feather, flow: brush.flow, pts: [[fx, fy]] };
      drag.current = { mode: 'paint', last: [X, Y] };
      onPart((p) => ({ strokes: [...p.strokes, st] }));
    } else drag.current = { mode: 'draw', start: [fx, fy] };
  };
  // A handle: fn gets the pointer (photo fractions) and the part as it was when grabbed.
  const grab = (fn) => (e) => {
    if (e.button !== 0) return;
    capture(e);
    const [X, Y] = local(e);
    drag.current = { mode: 'handle', fn, start: frac(X, Y), part };
  };
  const move = (e) => {
    const [X, Y] = local(e);
    if (part.type === 'brush') setCursor([X, Y, e.altKey]);
    const d = drag.current;
    if (!d) return;
    const [fx, fy] = frac(X, Y);
    if (d.mode === 'paint') {
      if (Math.hypot(X - d.last[0], Y - d.last[1]) < 2) return;
      d.last = [X, Y];
      onPart((p) => {
        const strokes = p.strokes.slice();
        const st = strokes[strokes.length - 1];
        strokes[strokes.length - 1] = { ...st, pts: [...st.pts, [fx, fy]] };
        return { strokes };
      });
    } else if (d.mode === 'draw') {
      const [sx, sy] = d.start;
      if (Math.hypot((fx - sx) * ow, (fy - sy) * oh) * k < 4) return;
      if (part.type === 'linear') onPart({ x0: sx, y0: sy, x1: fx, y1: fy, placed: true });
      else onPart({ cx: sx, cy: sy, rx: Math.max(0.002, Math.abs(fx - sx)), ry: Math.max(0.002, Math.abs(fy - sy)), angle: 0, placed: true });
    } else d.fn(fx, fy, d.start, d.part);
  };
  const up = () => { drag.current = null; };

  let shapes = null;
  if (part.type === 'linear' && part.placed !== false) {
    const p0 = css(part.x0, part.y0), p1 = css(part.x1, part.y1);
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const n = [(-(p1[1] - p0[1]) / len) * 5000, ((p1[0] - p0[0]) / len) * 5000];
    const line = (p, cls, extra) => <line className={cls} x1={p[0] - n[0]} y1={p[1] - n[1]} x2={p[0] + n[0]} y2={p[1] + n[1]} {...extra} />;
    // Turning: around the middle, by the change in the pointer's direction (photo px).
    const turn = grab((fx, fy, st, sp) => {
      const cx = ((sp.x0 + sp.x1) / 2) * ow, cy = ((sp.y0 + sp.y1) / 2) * oh;
      const a = Math.atan2(fy * oh - cy, fx * ow - cx) - Math.atan2(st[1] * oh - cy, st[0] * ow - cx);
      const c = Math.cos(a), s = Math.sin(a);
      const rot = (x, y) => [(cx + c * (x * ow - cx) - s * (y * oh - cy)) / ow, (cy + s * (x * ow - cx) + c * (y * oh - cy)) / oh];
      const [x0, y0] = rot(sp.x0, sp.y0), [x1, y1] = rot(sp.x1, sp.y1);
      onPart({ x0, y0, x1, y1 });
    });
    shapes = (
      <>
        {line(p0, 'mask-line')}
        {line(mid, 'mask-line mid', { strokeDasharray: '6 5' })}
        {line(p1, 'mask-line')}
        {line(mid, 'mask-hit', { onPointerDown: turn })}
        <circle className="mask-dot" cx={p0[0]} cy={p0[1]} r={6} onPointerDown={grab((fx, fy) => onPart({ x0: fx, y0: fy }))} />
        <circle className="mask-dot" cx={p1[0]} cy={p1[1]} r={6} onPointerDown={grab((fx, fy) => onPart({ x1: fx, y1: fy }))} />
        <circle className="mask-pin" cx={mid[0]} cy={mid[1]} r={7}
          onPointerDown={grab((fx, fy, st, sp) => { const dx = fx - st[0], dy = fy - st[1]; onPart({ x0: sp.x0 + dx, y0: sp.y0 + dy, x1: sp.x1 + dx, y1: sp.y1 + dy }); })} />
      </>
    );
  } else if (part.type === 'radial' && part.placed !== false) {
    const a = (part.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const pt = (u, w) => css(part.cx + (c * u * part.rx * ow - s * w * part.ry * oh) / ow, part.cy + (s * u * part.rx * ow + c * w * part.ry * oh) / oh);
    const ring = (f) => Array.from({ length: 73 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return pt(Math.cos(t) * f, Math.sin(t) * f).join(','); }).join(' ');
    const center = css(part.cx, part.cy);
    const top = pt(0, -1);
    const tl = Math.hypot(top[0] - center[0], top[1] - center[1]) || 1;
    const rh = [top[0] + ((top[0] - center[0]) / tl) * 24, top[1] + ((top[1] - center[1]) / tl) * 24];
    // Pointer, in the shape's own axes (photo px).
    const axes = (fx, fy, sp) => {
      const vx = (fx - sp.cx) * ow, vy = (fy - sp.cy) * oh;
      const ca = Math.cos((sp.angle * Math.PI) / 180), sa = Math.sin((sp.angle * Math.PI) / 180);
      return [vx * ca + vy * sa, -vx * sa + vy * ca, vx, vy];
    };
    const sizeX = grab((fx, fy, st, sp) => onPart({ rx: Math.max(0.002, Math.abs(axes(fx, fy, sp)[0]) / ow) }));
    const sizeY = grab((fx, fy, st, sp) => onPart({ ry: Math.max(0.002, Math.abs(axes(fx, fy, sp)[1]) / oh) }));
    shapes = (
      <>
        <polyline className="mask-line" points={ring(1)} />
        {part.feather > 0 && <polyline className="mask-line soft" points={ring(Math.max(0.02, 1 - part.feather / 100))} strokeDasharray="5 5" />}
        <line className="mask-line soft" x1={top[0]} y1={top[1]} x2={rh[0]} y2={rh[1]} />
        <circle className="mask-dot" cx={rh[0]} cy={rh[1]} r={5} style={{ cursor: 'grab' }}
          onPointerDown={grab((fx, fy, st, sp) => { const [, , vx, vy] = axes(fx, fy, sp); onPart({ angle: Math.round((Math.atan2(vx, -vy) * 180) / Math.PI) }); })} />
        {[[1, 0, sizeX], [-1, 0, sizeX], [0, 1, sizeY], [0, -1, sizeY]].map(([u, w, fn]) => { const p = pt(u, w); return <circle key={`${u}${w}`} className="mask-dot" cx={p[0]} cy={p[1]} r={5.5} onPointerDown={fn} />; })}
        <circle className="mask-pin" cx={center[0]} cy={center[1]} r={7}
          onPointerDown={grab((fx, fy, st, sp) => onPart({ cx: sp.cx + fx - st[0], cy: sp.cy + fy - st[1] }))} />
      </>
    );
  }

  const r = brushRadius(brush) * Math.max(ow, oh) * k;
  const erase = cursor && brush.erase !== cursor[2];
  return (
    <svg ref={svg} className={`mask-stage${part.type === 'brush' ? ' brush' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerLeave={() => setCursor(null)}>
      {shapes}
      {part.type === 'brush' && cursor && (
        <g className={`mask-cursor${erase ? ' erase' : ''}`} transform={`translate(${cursor[0]} ${cursor[1]})`}>
          <circle r={r} />
          {brush.feather > 0 && <circle r={r * Math.max(0.05, 1 - brush.feather / 100)} className="inner" />}
          <path d={erase ? 'M-5 0H5' : 'M-5 0H5M0 -5V5'} />
        </g>
      )}
    </svg>
  );
}
