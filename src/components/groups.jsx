import { useMemo, useState } from 'react';
import { Counts, Icon, Modal, Status, LEVEL_META } from './ui.jsx';
import { GearCard, GearPicker } from './gear.jsx';
import { applyResolved, checkKey, checkPreset, LEVELS } from '../engine/compat.js';
import { listKey } from '../store.js';

export function usePresetResult(preset, gearById, settings, gear) {
  return useMemo(() => applyResolved(checkPreset(preset, gearById, settings, gear), preset.resolved), [preset, gearById, settings, gear]);
}

function PresetCard({ preset, gearById, settings, gear, onOpen }) {
  const r = usePresetResult(preset, gearById, settings, gear);
  const items = [...preset.bodyIds, ...preset.lensIds].map((id) => gearById[id]).filter(Boolean);
  return (
    <button className={`preset-card lvl-${r.overall}`} onClick={onOpen}>
      <div className="preset-top">
        <h3>{preset.name}</h3>
        <Status level={r.overall} small text={LEVEL_META[r.overall].short} />
      </div>
      {preset.notes && <p className="muted">{preset.notes}</p>}
      <div className="preset-items">
        {items.slice(0, 5).map((g) => <span key={g.id} className={`item-pill ${g.type}`}>{g.model}</span>)}
        {items.length > 5 && <span className="item-pill more">+{items.length - 5}</span>}
        {preset.accessoryIds.length > 0 && <span className="item-pill accessory">{preset.accessoryIds.length} accessories</span>}
      </div>
      <Counts counts={r.counts} />
    </button>
  );
}

const GROUP_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#9775fa', '#f783ac', '#20c997', '#ff922b'];
const GROUP_ICONS = ['🎬', '🏟️', '🌿', '📸', '✈️', '💍', '🌃', '🎤', '🏔️', '🐦', '🚗', '🎨'];

export function GroupForm({ initial, onSave, onClose }) {
  const [g, setG] = useState(initial || { name: '', icon: '📸', color: GROUP_COLORS[4] });
  return (
    <Modal title={initial ? 'Edit group' : 'New group'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!g.name.trim()} onClick={() => onSave(g)}>Save</button></>}>
      <label className="field"><span>Name</span><input autoFocus value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Weddings, Travel, Astro…" /></label>
      <div className="field"><span>Icon</span>
        <div className="chips">{GROUP_ICONS.map((i) => <button key={i} className={`chip emoji${g.icon === i ? ' on' : ''}`} onClick={() => setG({ ...g, icon: i })}>{i}</button>)}</div>
      </div>
      <div className="field"><span>Color</span>
        <div className="chips">{GROUP_COLORS.map((c) => <button key={c} aria-label={c} className={`swatch${g.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setG({ ...g, color: c })} />)}</div>
      </div>
    </Modal>
  );
}

export function GroupView({ group, store, onOpenPreset }) {
  const { gearById, gear, state, actions } = store;
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const create = () => {
    if (!newName.trim()) return;
    actions.addPreset(group.id, { name: newName.trim() });
    setNewName(''); setNaming(false);
  };
  return (
    <div className="view">
      <header className="view-head" style={{ '--accent': group.color }}>
        <div className="group-badge">{group.icon}</div>
        <div className="grow">
          <div className="eyebrow">Group</div>
          <h1>{group.name}</h1>
          <p className="muted">{group.presets.length} preset{group.presets.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} />Edit group</button>
        <button className="btn btn-primary" onClick={() => setNaming(true)}><Icon name="plus" size={16} />New preset</button>
      </header>
      <div className="preset-grid">
        {group.presets.map((p) => (
          <PresetCard key={p.id} preset={p} gearById={gearById} gear={gear} settings={state.settings} onOpen={() => onOpenPreset(p.id)} />
        ))}
        <button className="preset-card add" onClick={() => setNaming(true)}><Icon name="plus" size={28} /><span>New preset</span></button>
      </div>
      {editing && (
        <GroupForm initial={group} onClose={() => setEditing(false)}
          onSave={(g) => { actions.updateGroup(group.id, { name: g.name, icon: g.icon, color: g.color }); setEditing(false); }} />
      )}
      {naming && (
        <Modal title={`New preset in ${group.name}`} onClose={() => setNaming(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setNaming(false)}>Cancel</button><button className="btn btn-primary" disabled={!newName.trim()} onClick={create}>Create</button></>}>
          <label className="field"><span>Preset name</span>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Night match kit" /></label>
        </Modal>
      )}
    </div>
  );
}

const CATEGORY_ORDER = ['Lens mount', 'Firmware', 'Editing apps', 'Power', 'Storage', 'Filters', 'Hot shoe', 'Audio', 'Support'];

export function PresetView({ group, preset, store, onBack, onOpenGear }) {
  const { gear, gearById, state, actions } = store;
  const r = usePresetResult(preset, gearById, state.settings, gear);
  const [picker, setPicker] = useState(null);
  const [filter, setFilter] = useState('problems');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const upd = (patch) => actions.updatePreset(group.id, preset.id, patch);
  const all = [...preset.bodyIds, ...preset.lensIds, ...preset.accessoryIds];

  const add = (item) => {
    const k = listKey(item);
    if (!preset[k].includes(item.id)) upd({ [k]: [...preset[k], item.id] });
  };
  const remove = (item) => { const k = listKey(item); upd({ [k]: preset[k].filter((x) => x !== item.id) }); };

  const isIssue = (c) => LEVELS[c.level] >= LEVELS.warn;
  const shown = r.checks.filter((c) => (filter === 'all' ? true : filter === 'resolved' ? c.resolved : isIssue(c) && !c.resolved));
  const resolved = preset.resolved || [];
  const toggleResolved = (c) => {
    const k = checkKey(c);
    upd({ resolved: resolved.includes(k) ? resolved.filter((x) => x !== k) : [...resolved, k] });
  };
  const byCategory = CATEGORY_ORDER.map((cat) => [cat, shown.filter((c) => c.category === cat).sort((a, b) => LEVELS[b.level] - LEVELS[a.level])]).filter(([, l]) => l.length);
  const bodies = preset.bodyIds.map((id) => gearById[id]).filter(Boolean);
  const lenses = preset.lensIds.map((id) => gearById[id]).filter(Boolean);
  const kitWeight = all.reduce((s, id) => s + (gearById[id]?.weight || 0), 0);

  const section = (title, ids, type) => (
    <div className="kit-section">
      <div className="kit-section-head">
        <h3>{title}</h3>
        <button className="btn btn-sm" onClick={() => setPicker(type)}><Icon name="plus" size={14} />Add</button>
      </div>
      {ids.length === 0 && <p className="empty small">None yet.</p>}
      {ids.map((id) => gearById[id]).filter(Boolean).map((g) => (
        <GearCard key={g.id} item={g} compact owned={state.owned.includes(g.id)} onOpen={onOpenGear}
          action={<button className="icon-btn" aria-label={`Remove ${g.model}`} onClick={() => remove(g)}><Icon name="x" size={16} /></button>} />
      ))}
    </div>
  );

  return (
    <div className="view">
      <header className="view-head" style={{ '--accent': group.color }}>
        <button className="icon-btn back" onClick={onBack} aria-label="Back to group"><Icon name="back" /></button>
        <div className="grow">
          <div className="eyebrow">{group.icon} {group.name}</div>
          <input className="title-input" value={preset.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Preset name" />
          <input className="notes-input" value={preset.notes || ''} placeholder="Add a note about this kit…" onChange={(e) => upd({ notes: e.target.value })} />
        </div>
        <button className="btn" onClick={() => actions.duplicatePreset(group.id, preset.id)}><Icon name="copy" size={16} />Duplicate</button>
        <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} />Delete</button>
      </header>

      <div className={`verdict lvl-${r.overall}`}>
        <div className="verdict-icon">{LEVEL_META[r.overall].sym}</div>
        <div className="grow">
          <div className="verdict-title">{verdictText(r)}</div>
          <div className="muted">{bodies.length} bod{bodies.length === 1 ? 'y' : 'ies'} · {lenses.length} lens{lenses.length === 1 ? '' : 'es'} · {preset.accessoryIds.length} accessor{preset.accessoryIds.length === 1 ? 'y' : 'ies'}{kitWeight > 0 && ` · ${(kitWeight / 1000).toFixed(2)} kg total`}</div>
        </div>
        <Counts counts={r.counts} />
      </div>

      <div className="preset-layout">
        <div className="kit">
          {section('Camera bodies', preset.bodyIds, 'body')}
          {section('Lenses', preset.lensIds, 'lens')}
          {section('Accessories', preset.accessoryIds, 'accessory')}
        </div>
        <div className="report">
          {bodies.length > 0 && lenses.length > 0 && (
            <div className="card">
              <h3 className="section-title">Lens × body</h3>
              <div className="matrix-wrap">
                <table className="matrix">
                  <thead><tr><th />{bodies.map((b) => <th key={b.id}>{b.model}<div className="muted small">{b.mount}</div></th>)}</tr></thead>
                  <tbody>
                    {lenses.map((l) => (
                      <tr key={l.id}>
                        <th>{l.model}<div className="muted small">{l.mount}</div></th>
                        {bodies.map((b) => {
                          const c = r.matrix[b.id][l.id];
                          return <td key={b.id} title={c.notes.join(' ')}><Status level={c.level} small text={c.label} /></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="card">
            <div className="report-head">
              <h3 className="section-title">Compatibility report</h3>
              <div className="seg small">
                <button className={filter === 'problems' ? 'on' : ''} onClick={() => setFilter('problems')}>Issues ({r.counts.warn + r.counts.bad})</button>
                {r.resolvedCount > 0 && <button className={filter === 'resolved' ? 'on' : ''} onClick={() => setFilter('resolved')}>Resolved ({r.resolvedCount})</button>}
                <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All checks ({r.checks.length})</button>
              </div>
            </div>
            {byCategory.length === 0 && (
              <p className="empty">{!r.checks.length ? 'Add a camera body to start checking compatibility.'
                : filter === 'resolved' ? 'Nothing marked as resolved.'
                : r.resolvedCount ? `No open issues. ${r.resolvedCount} marked as resolved.` : 'No issues. Everything in this kit works together.'}</p>
            )}
            {byCategory.map(([cat, list]) => (
              <div key={cat} className="check-group">
                <div className="check-cat">{cat}</div>
                {list.map((c, i) => (
                  <div key={i} className={`check lvl-${c.resolved ? 'ok' : c.level}${c.resolved ? ' resolved' : ''}`}>
                    <span className="status-dot">{c.resolved ? '✓' : LEVEL_META[c.level].sym}</span>
                    <div className="grow"><div className="check-title">{c.title}</div>{c.detail && <div className="check-detail">{c.detail}</div>}</div>
                    {isIssue(c) && (
                      <button className={`btn btn-sm resolve-btn${c.resolved ? ' btn-ghost' : ''}`} onClick={() => toggleResolved(c)}
                        title={c.resolved ? 'Show this as an issue again' : 'Hide this issue, e.g. you already have the adapter'}>
                        {c.resolved ? 'Undo' : <><Icon name="check" size={14} />Resolved</>}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {picker && (
        <GearPicker gear={gear} owned={state.owned} already={all} startType={picker} onPick={add} onClose={() => setPicker(null)} />
      )}
      {confirmDelete && (
        <Modal title="Delete preset?" onClose={() => setConfirmDelete(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { actions.deletePreset(group.id, preset.id); onBack(); }}>Delete</button></>}>
          <p>“{preset.name}” will be removed from {group.name}. Your gear stays in your library.</p>
        </Modal>
      )}
    </div>
  );
}

function verdictText(r) {
  if (!r.checks.length) return 'Empty kit';
  const note = r.resolvedCount ? ` (${r.resolvedCount} resolved)` : '';
  if (r.overall === 'bad') return `${r.counts.bad} compatibility problem${r.counts.bad === 1 ? '' : 's'} found${note}`;
  if (r.overall === 'warn') return `Works, with ${r.counts.warn} thing${r.counts.warn === 1 ? '' : 's'} to watch${note}`;
  return `Everything works together${note}`;
}
