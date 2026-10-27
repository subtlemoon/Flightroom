import { Icon } from './ui.jsx';

// Pages the app can open on (Settings > Start page). Groups are added by id.
export const START_PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'cull', label: 'Culling' },
  { id: 'develop', label: 'Develop' },
  { id: 'mygear', label: 'My Gear' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'news', label: 'News' },
];

// The view the app opens on, from the setting. A deleted group falls back to Home.
export function startView(state) {
  const page = state.settings.startPage || 'home';
  if (page.startsWith('group:')) {
    const groupId = page.slice(6);
    return state.groups.some((g) => g.id === groupId) ? { name: 'group', groupId } : { name: 'home' };
  }
  return { name: page };
}

const folderName = (f) => f.split(/[\\/]/).pop();

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function HomeView({ store, go, onOpenFolder }) {
  const { state, gear, news } = store;
  const recent = state.cull?.recent || [];
  const stats = state.cull?.stats || {};
  const last = recent[0];
  const lastStats = last && stats[last];
  const mine = gear.filter((g) => state.owned.includes(g.id));
  const bodies = mine.filter((g) => g.type === 'body');
  const lenses = mine.filter((g) => g.type === 'lens');
  const month = [...news.months].sort((a, b) => b.id.localeCompare(a.id))[0];

  return (
    <div className="view home">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting()}</h1>
        </div>
      </header>

      <div className="home-grid">
        <section className="home-card home-cull">
          <div className="home-card-head"><Icon name="photo" size={18} /><h3>Culling</h3></div>
          {last ? (
            <>
              <div className="home-big">{folderName(last)}</div>
              <p className="muted small">{lastStats ? `${lastStats.photos} photos · ${lastStats.rated} rated` : 'Opened last'}</p>
              {lastStats?.photos > 0 && <div className="tree-progress wide"><span style={{ width: `${(lastStats.rated / lastStats.photos) * 100}%` }} /></div>}
              <div className="row home-actions">
                <button className="btn btn-primary" onClick={() => onOpenFolder(last)}>Continue culling</button>
                <button className="btn" onClick={() => go({ name: 'cull' }, true)}>All folders</button>
              </div>
              {recent.length > 1 && (
                <div className="home-list">
                  {recent.slice(1, 4).map((f) => (
                    <button key={f} className="home-list-item" onClick={() => onOpenFolder(f)} title={f}>
                      <span className="grow">{folderName(f)}</span>
                      {stats[f] && <span className="muted small">{stats[f].rated}/{stats[f].photos}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="muted">Open a folder from a shoot to rate photos with the number keys.</p>
              <div className="row home-actions"><button className="btn btn-primary" onClick={() => go({ name: 'cull' }, true)}>Start culling</button></div>
            </>
          )}
        </section>

        <section className="home-card">
          <div className="home-card-head"><Icon name="bag" size={18} /><h3>My kit</h3></div>
          <div className="home-big">{bodies.map((b) => `${b.brand} ${b.model}`).join(', ') || 'No camera yet'}</div>
          <p className="muted small">{lenses.length} lenses · {mine.length - bodies.length - lenses.length} accessories</p>
          <div className="home-list">
            {lenses.slice(0, 4).map((l) => <div key={l.id} className="home-list-item static"><span className="grow">{l.brand} {l.model}</span></div>)}
          </div>
          <div className="row home-actions"><button className="btn" onClick={() => go({ name: 'mygear' })}>Open My Gear</button></div>
        </section>

        {month && (
          <section className="home-card">
            <div className="home-card-head"><Icon name="news" size={18} /><h3>News · {month.title}</h3></div>
            {month.forYou && <p className="home-text">{month.forYou}</p>}
            <p className="muted small">{month.items.length} announcements</p>
            <div className="row home-actions"><button className="btn" onClick={() => go({ name: 'news' })}>Read the news</button></div>
          </section>
        )}

        <section className="home-card">
          <div className="home-card-head"><Icon name="grid" size={18} /><h3>Groups</h3></div>
          <div className="home-list">
            {state.groups.map((g) => (
              <button key={g.id} className="home-list-item" onClick={() => go({ name: 'group', groupId: g.id })}>
                <span>{g.icon}</span><span className="grow">{g.name}</span><span className="muted small">{g.presets.length} presets</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <p className="muted small home-foot">You can choose which page Flightroom opens on in Settings.</p>
    </div>
  );
}
