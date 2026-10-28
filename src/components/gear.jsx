import { useMemo, useState } from 'react';
import { Dropdown, Icon, Modal, keySpecs, typeIcon, typeLabel } from './ui.jsx';
import { MOUNTS, SENSORS, ACCESSORY_CATEGORIES } from '../data/gear.js';
import { VIDEO_SUPPORT } from '../data/software.js';
import { uid } from '../store.js';

const BRAND_COLORS = { Sony: '#f59f00', Canon: '#e03131', Nikon: '#fcc419', Fujifilm: '#20c997', Panasonic: '#4dabf7', Blackmagic: '#adb5bd', Sigma: '#868e96' };
export const brandColor = (b) => BRAND_COLORS[b] || '#9775fa';

export function GearCard({ item, owned, onOpen, action, compact }) {
  return (
    <div className={`gear-card${compact ? ' compact' : ''}`} onClick={() => onOpen?.(item)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.(item)}>
      <div className="gear-icon" style={{ '--brand': brandColor(item.brand) }}><Icon name={typeIcon(item)} size={compact ? 18 : 22} /></div>
      <div className="gear-main">
        <div className="gear-brand">{item.brand} · {typeLabel(item)}{owned && <span className="owned-pill">Owned</span>}{!item.builtIn && <span className="custom-pill">Custom</span>}</div>
        <div className="gear-model">{item.model}</div>
        {!compact && <div className="gear-specs">{keySpecs(item).map((s) => <span key={s}>{s}</span>)}</div>}
      </div>
      {action && <div className="gear-action" onClick={(e) => e.stopPropagation()}>{action}</div>}
    </div>
  );
}

const FIELDS = {
  body: [
    ['mount', 'Lens mount'], ['sensor', 'Sensor'], ['megapixels', 'Resolution', (v) => `${v} MP`], ['ibis', 'In-body stabilization', (v) => (v ? 'Yes' : 'No')],
    ['maxVideo', 'Max video'], ['videoFormats', 'Video formats', (v) => v?.join(', ')], ['rawFormat', 'RAW photo format', (v) => (v ? `.${v}` : 'None')],
    ['cardSlots', 'Card slots', (v) => v?.join(' + ')], ['battery', 'Battery'], ['shoe', 'Hot shoe'], ['weight', 'Weight', (v) => `${v} g`], ['year', 'Released'],
  ],
  lens: [
    ['mount', 'Mount'], ['fType', 'Nikon F type'], ['coverage', 'Image circle'], ['focal', 'Focal length'], ['aperture', 'Max aperture'],
    ['stabilized', 'Stabilization', (v) => (v ? 'Yes' : 'No')], ['filterThread', 'Filter thread', (v) => `${v} mm`], ['weight', 'Weight', (v) => `${v} g`],
  ],
  accessory: [
    ['category', 'Type'], ['fromMount', 'Lens side'], ['toMount', 'Camera side'], ['batteryModel', 'Battery model'], ['cardType', 'Card type'],
    ['speedNote', 'Speed'], ['threadSize', 'Thread size', (v) => `${v} mm`], ['shoe', 'Shoe system'], ['connection', 'Connection'], ['maxPayload', 'Max payload', (v) => `${(v / 1000).toFixed(1)} kg`],
    ['weight', 'Weight', (v) => `${v} g`],
  ],
};

export function GearDetail({ item, owned, usedIn, onClose, onToggleOwned, onEdit, onDelete, onReset, onFirmware, hasOverride }) {
  const [fw, setFw] = useState(item.firmware || '');
  const rows = FIELDS[item.type].filter(([k]) => item[k] !== undefined && item[k] !== null && item[k] !== '');
  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="drawer-head">
          <div className="gear-icon big" style={{ '--brand': brandColor(item.brand) }}><Icon name={typeIcon(item)} size={28} /></div>
          <div>
            <div className="gear-brand">{item.brand} · {typeLabel(item)}</div>
            <h2>{item.model}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-actions">
          <button className={owned ? 'btn' : 'btn btn-primary'} onClick={() => onToggleOwned(item.id)}>
            <Icon name={owned ? 'check' : 'plus'} size={16} />{owned ? 'In My Gear' : 'Add to My Gear'}
          </button>
          <button className="btn" onClick={() => onEdit(item)}><Icon name="edit" size={16} />Edit</button>
          {hasOverride && <button className="btn btn-ghost" onClick={() => onReset(item.id)}>Reset specs</button>}
          {!item.builtIn && <button className="btn btn-danger" onClick={() => onDelete(item.id)}><Icon name="trash" size={16} />Delete</button>}
        </div>
        {item.type === 'body' && (
          <section className="fw-box">
            <label htmlFor="fw">Your firmware version</label>
            <div className="fw-row">
              <input id="fw" value={fw} placeholder="e.g. 3.10" onChange={(e) => setFw(e.target.value)} />
              <button className="btn" disabled={fw === (item.firmware || '')} onClick={() => onFirmware(item.id, fw.trim())}>Save</button>
            </div>
            {item.firmwareFeatures?.length > 0 && (
              <ul className="fw-list">
                {item.firmwareFeatures.map((f) => <li key={f.feature}><b>{f.feature}</b> needs firmware {f.minFirmware}+</li>)}
              </ul>
            )}
            <p className="muted small">Used to check firmware-dependent features. Find it in the camera's setup menu.</p>
          </section>
        )}
        <table className="spec-table">
          <tbody>
            {rows.map(([k, label, fmt]) => <tr key={k}><th>{label}</th><td>{fmt ? fmt(item[k]) : String(item[k])}</td></tr>)}
            {item.batteryAlso?.map((b) => <tr key={b.model}><th>Also takes</th><td>{b.model}: {b.note}</td></tr>)}
          </tbody>
        </table>
        {item.notes && <p className="note-box">{item.notes}</p>}
        {usedIn.length > 0 && (
          <section>
            <h3 className="section-title">Used in presets</h3>
            <ul className="used-in">{usedIn.map((u) => <li key={u}>{u}</li>)}</ul>
          </section>
        )}
        {item.builtIn && <p className="muted small">Specs are approximate starter data. Edit them if anything differs from your gear.</p>}
      </aside>
    </div>
  );
}

const csv = (v) => (Array.isArray(v) ? v.join(', ') : v || '');
const fromCsv = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
const num = (v) => (v === '' || v === undefined ? undefined : Number(v));

export function GearForm({ initial, onSave, onClose }) {
  const [g, setG] = useState(() => initial || { type: 'body', brand: '', model: '', mount: 'Sony E', sensor: 'Full Frame', videoFormats: [], cardSlots: [], firmwareFeatures: [] });
  const set = (k) => (e) => setG({ ...g, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const choose = (k) => (v) => setG({ ...g, [k]: v });
  const mounts = Object.keys(MOUNTS);
  const editing = !!initial;

  const save = () => {
    const out = { ...g, id: g.id || uid('custom') };
    for (const k of ['megapixels', 'weight', 'year', 'filterThread', 'threadSize', 'maxPayload']) if (k in out) out[k] = num(out[k]);
    if (typeof out.cardSlots === 'string') out.cardSlots = fromCsv(out.cardSlots);
    if (out.type === 'body') out.firmwareFeatures ||= [];
    onSave(out);
  };

  const field = (k, label, props = {}) => (
    <label className="field"><span>{label}</span><input value={g[k] ?? ''} onChange={set(k)} {...props} /></label>
  );
  const select = (k, label, options) => (
    <div className="field"><span>{label}</span>
      <Dropdown value={g[k] ?? ''} onChange={choose(k)} options={options.map((o) => ({ value: o, label: o }))} />
    </div>
  );

  return (
    <Modal title={editing ? `Edit ${g.model || 'gear'}` : 'Add custom gear'} onClose={onClose} wide
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!g.brand || !g.model} onClick={save}>Save</button></>}>
      <div className="form-grid">
        {!editing && (
          <div className="field"><span>Type</span>
            <Dropdown value={g.type} onChange={(v) => setG({ ...g, type: v, category: v === 'accessory' ? 'Adapter' : undefined })}
              options={[{ value: 'body', label: 'Camera body' }, { value: 'lens', label: 'Lens' }, { value: 'accessory', label: 'Accessory' }]} />
          </div>
        )}
        {field('brand', 'Brand', { placeholder: 'Sony' })}
        {field('model', 'Model', { placeholder: 'α7 IV' })}
        {g.type === 'body' && <>
          {select('mount', 'Lens mount', mounts)}
          {select('sensor', 'Sensor', SENSORS)}
          {field('megapixels', 'Megapixels', { type: 'number' })}
          {field('maxVideo', 'Max video', { placeholder: '4K 60p' })}
          {field('rawFormat', 'RAW format', { placeholder: 'ARW' })}
          {field('battery', 'Battery model', { placeholder: 'NP-FZ100' })}
          <label className="field"><span>Card slots (comma separated)</span>
            <input value={csv(g.cardSlots)} onChange={(e) => setG({ ...g, cardSlots: e.target.value })} placeholder="CFexpress B, SD" /></label>
          {field('shoe', 'Hot shoe', { placeholder: 'Sony MI' })}
          {field('weight', 'Weight (g)', { type: 'number' })}
          {field('firmware', 'Your firmware', { placeholder: '1.00' })}
          <label className="field checkbox"><input type="checkbox" checked={!!g.ibis} onChange={set('ibis')} /><span>In-body stabilization</span></label>
          <fieldset className="field span-2"><span>Video formats</span>
            <div className="chips">{Object.keys(VIDEO_SUPPORT).map((f) => (
              <button type="button" key={f} className={`chip${g.videoFormats?.includes(f) ? ' on' : ''}`}
                onClick={() => setG({ ...g, videoFormats: g.videoFormats?.includes(f) ? g.videoFormats.filter((x) => x !== f) : [...(g.videoFormats || []), f] })}>{f}</button>
            ))}</div>
          </fieldset>
        </>}
        {g.type === 'lens' && <>
          {select('mount', 'Mount', mounts)}
          {select('coverage', 'Image circle', SENSORS)}
          {g.mount === 'Nikon F' && select('fType', 'Nikon F type', ['AF-S', 'AF-P', 'AF-I', 'AF-D', 'AF', 'AI-S', 'AI'])}
          {field('focal', 'Focal length', { placeholder: '24-70mm' })}
          {field('aperture', 'Max aperture', { placeholder: 'f/2.8' })}
          {field('filterThread', 'Filter thread (mm)', { type: 'number' })}
          {field('weight', 'Weight (g)', { type: 'number' })}
          <label className="field checkbox"><input type="checkbox" checked={!!g.stabilized} onChange={set('stabilized')} /><span>Optical stabilization</span></label>
        </>}
        {g.type === 'accessory' && <>
          {select('category', 'Category', ACCESSORY_CATEGORIES)}
          {g.category === 'Adapter' && <>
            {select('fromMount', 'Lens side (from)', mounts)}
            {select('toMount', 'Camera side (to)', mounts)}
            <div className="field"><span>Autofocus</span>
              <Dropdown value={g.af || 'good'} onChange={choose('af')} options={[
                { value: 'full', label: 'Full autofocus' }, { value: 'good', label: 'Autofocus works' },
                { value: 'limited', label: 'Limited / unreliable' }, { value: 'mf', label: 'Manual focus only' },
              ]} />
            </div>
          </>}
          {g.category === 'Battery' && field('batteryModel', 'Battery model', { placeholder: 'NP-FZ100' })}
          {g.category === 'Memory card' && select('cardType', 'Card type', ['SD', 'CFexpress A', 'CFexpress B', 'XQD', 'CFast 2.0', 'microSD'])}
          {g.category === 'Filter' && field('threadSize', 'Thread size (mm)', { type: 'number' })}
          {g.category === 'Flash' && field('shoe', 'Shoe system', { placeholder: 'Sony MI' })}
          {g.category === 'Microphone' && select('connection', 'Connection', ['3.5mm', 'Sony MI'])}
          {(g.category === 'Gimbal' || g.category === 'Tripod') && field('maxPayload', 'Max payload (g)', { type: 'number' })}
          {field('weight', 'Weight (g)', { type: 'number' })}
        </>}
        <label className="field span-2"><span>Notes</span><textarea rows={2} value={g.notes || ''} onChange={set('notes')} /></label>
      </div>
    </Modal>
  );
}

export const TYPE_TABS = [['all', 'All'], ['body', 'Bodies'], ['lens', 'Lenses'], ['accessory', 'Accessories']];

export function useGearFilter(items, initialType = 'all') {
  const [q, setQ] = useState('');
  const [type, setType] = useState(initialType);
  const [brand, setBrand] = useState('All brands');
  const brands = useMemo(() => ['All brands', ...new Set(items.map((g) => g.brand))].sort((a, b) => (a === 'All brands' ? -1 : a.localeCompare(b))), [items]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((g) => (type === 'all' || g.type === type)
      && (brand === 'All brands' || g.brand === brand)
      && (!needle || [g.brand, g.model, g.mount, g.category, g.focal].join(' ').toLowerCase().includes(needle)));
  }, [items, q, type, brand]);
  const bar = (
    <div className="filter-bar">
      <div className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search gear, mounts, focal lengths…" /></div>
      <div className="seg">{TYPE_TABS.map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
      <Dropdown className="brand-select" value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b, label: b }))} />
    </div>
  );
  return { filtered, bar };
}

export function GearPicker({ gear, owned, already, onPick, onClose, startType }) {
  const [mineOnly, setMineOnly] = useState(owned.length > 0);
  const pool = mineOnly ? gear.filter((g) => owned.includes(g.id)) : gear;
  const { filtered, bar } = useGearFilter(pool, startType);
  return (
    <Modal title="Add gear to preset" onClose={onClose} wide>
      {bar}
      <label className="toggle-row"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />Only show My Gear</label>
      <div className="picker-list">
        {filtered.length === 0 && <p className="empty">Nothing matches. {mineOnly && 'Try turning off “Only show My Gear”.'}</p>}
        {filtered.map((g) => {
          const added = already.includes(g.id);
          return (
            <GearCard key={g.id} item={g} owned={owned.includes(g.id)} compact
              action={<button className={added ? 'btn btn-sm' : 'btn btn-sm btn-primary'} disabled={added} onClick={() => onPick(g)}>{added ? 'Added' : 'Add'}</button>} />
          );
        })}
      </div>
    </Modal>
  );
}
