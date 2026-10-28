import { bridge as app } from './bridge.js';
import { Component, useEffect, useState } from 'react';
import { useStore } from './store.js';
import { Icon, PanelHandle } from './components/ui.jsx';
import { toggle, toggleSides, useLayout } from './layout.js';
import { GearDetail, GearForm } from './components/gear.jsx';
import { GroupForm, GroupView, PresetView } from './components/groups.jsx';
import { CatalogView, MyGearView, SettingsView } from './components/library.jsx';
import { NewsView } from './components/news.jsx';
import { CullView } from './components/cull.jsx';
import { DevelopView } from './components/develop.jsx';
import { HomeView, startView } from './components/home.jsx';

export default function App() {
  const store = useStore();
  const { state, gear, gearById, actions } = store;
  const [view, setView] = useState(() => startView(state));
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null); // { initial } while the gear form is open
  const [newGroup, setNewGroup] = useState(false);

  const group = state.groups.find((g) => g.id === view.groupId);
  const preset = group?.presets.find((p) => p.id === view.presetId);
  const detail = detailId && gearById[detailId];
  const openGear = (g) => setDetailId(g.id);

  const latestNews = store.news.months.map((m) => m.id).sort().at(-1);
  const hasNewNews = latestNews && state.newsSeen !== latestNews && view.name !== 'news';

  const usedIn = (id) => state.groups.flatMap((g) => g.presets
    .filter((p) => [...p.bodyIds, ...p.lensIds, ...p.accessoryIds].includes(id))
    .map((p) => `${g.icon} ${g.name} › ${p.name}`));

  let main;
  if (view.name === 'home') {
    main = <HomeView store={store}
      go={(v, folderList) => { if (folderList) actions.setCullFolder(null); setView(v); }}
      onOpenFolder={(f) => { actions.setCullFolder(f); setView({ name: 'cull' }); }} />;
  } else if (view.name === 'mygear') main = <MyGearView store={store} onOpenGear={openGear} onBrowse={() => setView({ name: 'catalog' })} onCustom={() => setForm({})} />;
  else if (view.name === 'catalog') main = <CatalogView store={store} onOpenGear={openGear} onCustom={() => setForm({})} />;
  else if (view.name === 'settings') main = <SettingsView store={store} />;
  else if (view.name === 'cull') main = <CullView store={store} onDevelop={() => setView({ name: 'develop' })} />;
  else if (view.name === 'develop') main = <DevelopView store={store} onCull={() => setView({ name: 'cull' })} />;
  else if (view.name === 'news') main = <NewsView store={store} onOpenGear={openGear} />;
  else if (group && preset) main = <PresetView key={preset.id} group={group} preset={preset} store={store} onOpenGear={openGear} onBack={() => setView({ name: 'group', groupId: group.id })} />;
  else if (group) main = <GroupView group={group} store={store} onOpenPreset={(presetId) => setView({ name: 'group', groupId: group.id, presetId })} />;
  else main = <div className="view"><div className="hero-empty"><h2>No groups yet</h2><button className="btn btn-primary" onClick={() => setNewGroup(true)}>Create a group</button></div></div>;

  const navBtn = (key, label, icon, extra) => (
    <button className={`nav-item${view.name === key ? ' active' : ''}`} onClick={() => setView({ name: key })}>
      <Icon name={icon} />{label}{extra}
    </button>
  );

  const layout = useLayout();
  const photoView = view.name === 'cull' || view.name === 'develop';
  // Lightroom's panel keys: Tab = side panels, F6 = filmstrip, F7 = left, F8 = right.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.overlay')) return;
      if (e.key === 'F7') { e.preventDefault(); toggle('nav'); }
      else if (e.key === 'F8') { e.preventDefault(); toggle('panel'); }
      else if (e.key === 'F6') { e.preventDefault(); toggle('strip'); }
      else if (e.key === 'Tab' && photoView && !e.shiftKey) { e.preventDefault(); toggleSides(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoView]);

  return (
    <div className={`app${layout.nav ? '' : ' nav-hidden'}`}>
      <nav className="sidebar" aria-hidden={!layout.nav}>
        <div className="logo">
          <div className="logo-mark"><Icon name="lens" size={20} /></div>
          <div><div className="logo-name">Flightroom</div><div className="logo-sub">Cull · develop · plan</div></div>
        </div>
        {navBtn('home', 'Home', 'home')}
        <div className="nav-label">Library</div>
        {navBtn('mygear', 'My Gear', 'bag', <span className="nav-count">{state.owned.length}</span>)}
        {navBtn('catalog', 'Catalog', 'grid')}
        {navBtn('news', 'News', 'news', hasNewNews && <span className="nav-new">New</span>)}
        <div className="nav-label">Photos</div>
        {navBtn('cull', 'Culling', 'photo')}
        {navBtn('develop', 'Develop', 'develop')}
        <div className="nav-label">Groups<button className="icon-btn tiny" onClick={() => setNewGroup(true)} aria-label="New group"><Icon name="plus" size={14} /></button></div>
        <div className="group-list">
          {state.groups.map((g) => (
            <button key={g.id} className={`nav-item group${view.name === 'group' && view.groupId === g.id ? ' active' : ''}`} style={{ '--accent': g.color }}
              onClick={() => setView({ name: 'group', groupId: g.id })}>
              <span className="group-emoji">{g.icon}</span><span className="grow">{g.name}</span><span className="nav-count">{g.presets.length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <UpdateReady />
          <RefreshButton status={store.catalogStatus} onRefresh={store.refreshCatalog} count={store.gear.length} />
          {navBtn('settings', 'Settings', 'settings')}
        </div>
      </nav>

      <main className={`content${photoView ? ' content-cull' : ''}`}>
        <PanelHandle side="left" open={layout.nav} onClick={() => toggle('nav')} title={`${layout.nav ? 'Hide' : 'Show'} sidebar (F7)`} />
        <Boundary key={view.name}>{main}</Boundary>
      </main>

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

function timeAgo(at) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

function RefreshButton({ status, onRefresh, count }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const sub = status.status === 'loading' ? 'Checking GitHub…'
    : status.status === 'error' ? 'Offline: using saved list'
    : `${count} items · updated ${timeAgo(status.at)}`;
  return (
    <button className={`nav-item refresh${status.status === 'loading' ? ' spinning' : ''}`} onClick={onRefresh} disabled={status.status === 'loading'}>
      <Icon name="refresh" />
      <span className="grow"><span className="block">Refresh gear list</span><span className={`nav-sub${status.status === 'error' ? ' err' : ''}`}>{sub}</span></span>
    </button>
  );
}

// Shown once a new version has downloaded, so it doesn't wait for the app to be closed.
function UpdateReady() {
  const bridge = app;
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!bridge) return;
    bridge.getUpdateStatus().then(setStatus);
    return bridge.onUpdateStatus(setStatus);
  }, [bridge]);
  if (status?.state !== 'ready') return null;
  return (
    <div className="update-ready">
      <div className="grow"><div className="update-ready-title">Update ready</div><div className="nav-sub">{status.message.replace(' will install when you close Flightroom', '')}</div></div>
      <button className="btn btn-sm btn-primary" onClick={() => bridge.installUpdate()}>Restart</button>
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

// Keeps one broken page from blanking the whole window.
class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('[view]', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="hero-empty">
        <h2>Something went wrong on this page</h2>
        <p className="muted small">{String(this.state.error?.message || this.state.error)}</p>
        <button className="btn btn-sm" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
