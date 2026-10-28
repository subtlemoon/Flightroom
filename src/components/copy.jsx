// Copy Settings (Ctrl+C), its checklist of what to copy, and Develop presets.
import { useState } from 'react';
import { Icon, Modal } from './ui.jsx';
import { COPY_GROUPS, DEFAULT_GROUPS, describe } from '../develop/copy.js';

/**
 * The checklist of what to copy, as in Lightroom. With `naming`, it makes a
 * preset instead and asks for its name.
 */
export function CopyDialog({ groups: initial, naming, onClose, onDone }) {
  const [groups, setGroups] = useState(() => initial || DEFAULT_GROUPS);
  const [name, setName] = useState('');
  const flip = (id) => setGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  const ok = groups.length && (!naming || name.trim());
  const done = () => ok && onDone(groups, name.trim());
  return (
    <Modal title={naming ? 'New preset' : 'Copy settings'} onClose={onClose} footer={(
      <>
        <button className="btn btn-sm btn-ghost" onClick={() => setGroups(COPY_GROUPS.map(([id]) => id))}>Check all</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setGroups([])}>Check none</button>
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok} onClick={done}>{naming ? 'Create' : 'Copy'}</button>
      </>
    )}>
      {naming && (
        <input className="input copy-name" autoFocus placeholder="Preset name" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && done()} />
      )}
      <div className="copy-grid" onKeyDown={(e) => e.key === 'Enter' && !naming && done()}>
        {COPY_GROUPS.map(([id, label]) => (
          <label key={id} className="dev-check"><input type="checkbox" checked={groups.includes(id)} onChange={() => flip(id)} autoFocus={!naming && id === 'wb'} />{label}</label>
        ))}
      </div>
      <p className="muted small">{naming ? 'The preset keeps these settings of this photo.' : 'Paste with Ctrl+V. Select several photos in the filmstrip first (Ctrl+click, Shift+click, Ctrl+A) to paste onto all of them.'}</p>
    </Modal>
  );
}

// Looks that come with Flightroom. Each sets only what it lists.
const FADE = [[0, 28], [64, 72], [192, 194], [255, 242]];
export const BUILT_IN = [
  ['Vivid', { contrast: 15, clarity: 10, vibrance: 25, saturation: 5 }],
  ['Punchy', { contrast: 30, clarity: 15, dehaze: 5, whites: 10, blacks: -10, vibrance: 10 }],
  ['Soft', { contrast: -15, highlights: -20, blacks: 15, clarity: -10, saturation: -10 }],
  ['Matte', { contrast: -10, curve: FADE, saturation: -8 }],
  ['Warm', { gGlobalHue: 40, gGlobalSat: 14 }],
  ['Cool', { gGlobalHue: 215, gGlobalSat: 12 }],
  ['Black & white', { bw: true, contrast: 15, clarity: 10 }],
  ['Black & white contrast', { bw: true, contrast: 40, whites: 20, blacks: -25, clarity: 20 }],
].map(([name, part]) => ({ id: `fr-${name}`, name, part, groups: COPY_GROUPS.filter(([, , keys]) => keys.some((k) => k in part)).map(([id]) => id) }));

/** Presets in the left panel: hover to preview, click to apply. */
export function PresetPanel({ presets, open, setOpen, disabled, onApply, onHover, onNew, onDelete }) {
  const row = (p, mine) => (
    <div key={p.id} className="preset-row" title={describe(p.groups)}>
      <button className="preset-name grow" disabled={disabled} onClick={() => onApply(p)}
        onMouseEnter={() => onHover(p)} onMouseLeave={() => onHover(null)}>{p.name}</button>
      {mine && <button className="icon-btn tiny" title="Delete preset" onClick={() => onDelete(p)}><Icon name="x" size={11} /></button>}
    </div>
  );
  return (
    <div className="preset-panel">
      <div className="mask-head">
        <button className="preset-toggle grow" onClick={() => setOpen(!open)}><Icon name={open ? 'chevD' : 'chevR'} size={12} />Presets</button>
        <button className="icon-btn tiny" title="New preset from this photo" disabled={disabled} onClick={onNew}><Icon name="plus" size={13} /></button>
      </div>
      {open && (
        <div className="preset-list">
          {presets.length > 0 && <div className="preset-group">Yours</div>}
          {presets.map((p) => row(p, true))}
          <div className="preset-group">Flightroom</div>
          {BUILT_IN.map((p) => row(p, false))}
        </div>
      )}
    </div>
  );
}
