import { useState } from 'react';
import { useStore } from './store.js';
import { Icon } from './components/ui.jsx';
import { GearDetail, GearForm } from './components/gear.jsx';
import { GroupForm, GroupView, PresetView } from './components/groups.jsx';
import { CatalogView, MyGearView, SettingsView } from './components/library.jsx';

export default function App() {
  const store = useStore();
  const { state, gear, gearById, actions } = store;
  const [view, setView] = useState({ name: 'group', groupId: state.groups[0]?.id });
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null); // { initial } while the gear form is open
  const [newGroup, setNewGroup] = useState(false);

  const group = state.groups.find((g) => g.id === view.groupId);
  const preset = group?.presets.find((p) => p.id === view.presetId);
  const detail = detailId && gearById[detailId];
  const openGear = (g) => setDetailId(g.id);

  const usedIn = (id) => state.groups.flatMap((g) => g.presets
    .filter((p) => [...p.bodyIds, ...p.lensIds, ...p.accessoryIds].includes(id))
    .map((p) => `${g.icon} ${g.name} › ${p.name}`));

  let main;
  if (view.name === 'mygear') main = <MyGearView store={store} onOpenGear={openGear} onBrowse={() => setView({ name: 'catalog' })} onCustom={() => setForm({})} />;
  else if (view.name === 'catalog') main = <CatalogView store={store} onOpenGear={openGear} onCustom={() => setForm({})} />;
  else if (view.name === 'settings') main = <SettingsView store={store} />;
  else if (group && preset) main = <PresetView key={preset.id} group={group} preset={preset} store={store} onOpenGear={openGear} onBack={() => setView({ name: 'group', groupId: group.id })} />;
  else if (group) main = <GroupView group={group} store={store} onOpenPreset={(presetId) => setView({ name: 'group', groupId: group.id, presetId })} />;
  else main = <div className="view"><div className="hero-empty"><h2>No groups yet</h2><button className="btn btn-primary" onClick={() => setNewGroup(true)}>Create a group</button></div></div>;

  const navBtn = (key, label, icon, extra) => (
    <button className={`nav-item${view.name === key ? ' active' : ''}`} onClick={() => setView({ name: key })}>
      <Icon name={icon} />{label}{extra}
    </button>
  );

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-mark"><Icon name="lens" size={20} /></div>
          <div><div className="logo-name">GearCheck</div><div className="logo-sub">Camera kit planner</div></div>
        </div>
        <div className="nav-label">Library</div>
        {navBtn('mygear', 'My Gear', 'bag', <span className="nav-count">{state.owned.length}</span>)}
        {navBtn('catalog', 'Catalog', 'grid')}
        <div className="nav-label">Groups<button className="icon-btn tiny" onClick={() => setNewGroup(true)} aria-label="New group"><Icon name="plus" size={14} /></button></div>
        <div className="group-list">
          {state.groups.map((g) => (
            <button key={g.id} className={`nav-item group${view.name === 'group' && view.groupId === g.id ? ' active' : ''}`} style={{ '--accent': g.color }}
              onClick={() => setView({ name: 'group', groupId: g.id })}>
              <span className="group-emoji">{g.icon}</span><span className="grow">{g.name}</span><span className="nav-count">{g.presets.length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-foot">{navBtn('settings', 'Settings', 'settings')}</div>
      </nav>

      <main className="content">{main}</main>

      {detail && (
        <GearDetail key={detail.id} item={detail} owned={state.owned.includes(detail.id)} usedIn={usedIn(detail.id)}
          hasOverride={!!state.overrides[detail.id]}
          onClose={() => setDetailId(null)} onToggleOwned={actions.toggleOwned}
          onEdit={(g) => setForm({ initial: g })} onReset={actions.resetGear} onFirmware={actions.setFirmware}
          onDelete={(id) => { actions.deleteGear(id); setDetailId(null); }} />
      )}
      {form && (
        <GearForm initial={form.initial} onClose={() => setForm(null)}
          onSave={(g) => { actions.saveGear(g); if (!form.initial) actions.toggleOwned(g.id); setForm(null); }} />
      )}
      {newGroup && (
        <GroupForm onClose={() => setNewGroup(false)} onSave={(g) => { actions.addGroup(g); setNewGroup(false); }} />
      )}
      {group && view.name === 'group' && !preset && (
        <DeleteGroupButton onDelete={() => { actions.deleteGroup(group.id); setView({ name: 'group', groupId: state.groups.find((g) => g.id !== group.id)?.id }); }} name={group.name} />
      )}
    </div>
  );
}

function DeleteGroupButton({ name, onDelete }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button className="floating-delete" onClick={() => setAsk(true)}><Icon name="trash" size={14} />Delete group</button>;
  return (
    <div className="floating-delete confirm">
      Delete “{name}” and its presets?
      <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
      <button className="btn btn-sm btn-ghost" onClick={() => setAsk(false)}>Cancel</button>
    </div>
  );
}
