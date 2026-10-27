import { useRef, useState } from 'react';
import { GearCard, useGearFilter } from './gear.jsx';
import { Icon, Modal } from './ui.jsx';
import { EDITING_APPS } from '../data/software.js';

export function MyGearView({ store, onOpenGear, onBrowse, onCustom }) {
  const { gear, state } = store;
  const mine = gear.filter((g) => state.owned.includes(g.id));
  const { filtered, bar } = useGearFilter(mine);
  const counts = { body: 0, lens: 0, accessory: 0 };
  mine.forEach((g) => counts[g.type]++);
  return (
    <div className="view">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Library</div>
          <h1>My Gear</h1>
          <p className="muted">{counts.body} bodies · {counts.lens} lenses · {counts.accessory} accessories</p>
        </div>
        <button className="btn" onClick={onCustom}><Icon name="edit" size={16} />Add custom gear</button>
        <button className="btn btn-primary" onClick={onBrowse}><Icon name="plus" size={16} />Add from catalog</button>
      </header>
      {mine.length === 0 ? (
        <div className="hero-empty">
          <div className="hero-icon"><Icon name="bag" size={40} /></div>
          <h2>Your bag is empty</h2>
          <p className="muted">Add the cameras, lenses and accessories you own. Each one shows its full specs, and presets check how they work together.</p>
          <div className="row"><button className="btn btn-primary" onClick={onBrowse}>Browse the catalog</button><button className="btn" onClick={onCustom}>Add something not listed</button></div>
        </div>
      ) : (
        <>
          {bar}
          <div className="gear-grid">{filtered.map((g) => <GearCard key={g.id} item={g} owned onOpen={onOpenGear} />)}</div>
        </>
      )}
    </div>
  );
}

export function CatalogView({ store, onOpenGear, onCustom }) {
  const { gear, state, actions } = store;
  const { filtered, bar } = useGearFilter(gear);
  return (
    <div className="view">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Library</div>
          <h1>Gear catalog</h1>
          <p className="muted">{gear.length} items. Click one for full specs, or add it to My Gear.</p>
        </div>
        <button className="btn btn-primary" onClick={onCustom}><Icon name="plus" size={16} />Add custom gear</button>
      </header>
      {bar}
      <div className="gear-grid">
        {filtered.map((g) => {
          const owned = state.owned.includes(g.id);
          return (
            <GearCard key={g.id} item={g} owned={owned} onOpen={onOpenGear}
              action={<button className={owned ? 'btn btn-sm' : 'btn btn-sm btn-primary'} onClick={() => actions.toggleOwned(g.id)}>
                <Icon name={owned ? 'check' : 'plus'} size={14} />{owned ? 'Owned' : 'Add'}</button>} />
          );
        })}
      </div>
    </div>
  );
}

export function SettingsView({ store }) {
  const { state, actions } = store;
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const toggle = (id) => actions.setApps(state.settings.apps.includes(id) ? state.settings.apps.filter((a) => a !== id) : [...state.settings.apps, id]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gearcheck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.groups)) throw new Error('not a backup');
      actions.importData(data);
      setMsg('Backup restored.');
    } catch {
      setMsg('That file is not a GearCheck backup.');
    }
    e.target.value = '';
  };

  return (
    <div className="view narrow">
      <header className="view-head"><div className="grow"><div className="eyebrow">App</div><h1>Settings</h1></div></header>
      <section className="card">
        <h3 className="section-title">Editing apps you use</h3>
        <p className="muted">Presets check whether these apps can open each camera's photos and video.</p>
        <div className="app-list">
          {EDITING_APPS.map((a) => (
            <label key={a.id} className="toggle-row big">
              <input type="checkbox" checked={state.settings.apps.includes(a.id)} onChange={() => toggle(a.id)} />
              <span>{a.name}<span className="muted small"> · {a.kind === 'photo' ? 'RAW photos' : 'video'}</span></span>
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h3 className="section-title">Backup</h3>
        <p className="muted">Everything is saved on this computer automatically. Export a backup to move it to another PC.</p>
        <div className="row">
          <button className="btn" onClick={exportData}>Export backup</button>
          <button className="btn" onClick={() => fileRef.current.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importData} />
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>
      <section className="card">
        <h3 className="section-title">Reset</h3>
        <p className="muted">Restore the starter groups and catalog. Your gear, custom items and presets will be erased.</p>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset everything</button>
      </section>
      <p className="muted small">Specs and compatibility data are a starting point. Check the maker's website before buying.</p>
      {confirmReset && (
        <Modal title="Reset everything?" onClose={() => setConfirmReset(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { actions.resetAll(); setConfirmReset(false); }}>Erase and reset</button></>}>
          <p>This erases My Gear, custom gear, firmware versions and every preset. Export a backup first if you might want them back.</p>
        </Modal>
      )}
    </div>
  );
}
