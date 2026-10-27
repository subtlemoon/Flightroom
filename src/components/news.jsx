import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { brandColor } from './gear.jsx';

const KIND_ORDER = ['Camera', 'Lens', 'Accessory', 'In development', 'Cinema'];
const KIND_LABEL = { Camera: 'Cameras', Lens: 'Lenses', Accessory: 'Accessories', 'In development': 'In development', Cinema: 'Cinema' };

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function NewsView({ store, onOpenGear }) {
  const { news, gearById, state, actions } = store;
  const months = [...news.months].sort((a, b) => b.id.localeCompare(a.id));
  const [monthId, setMonthId] = useState(months[0]?.id);
  const month = months.find((m) => m.id === monthId) || months[0];

  useEffect(() => {
    if (months[0] && state.newsSeen !== months[0].id) actions.markNewsSeen(months[0].id);
  }, [months[0]?.id]);

  if (!month) {
    return <div className="view"><div className="hero-empty"><h2>No news yet</h2><p className="muted">The first monthly summary will appear here.</p></div></div>;
  }

  const groups = KIND_ORDER.map((k) => [k, month.items.filter((i) => i.kind === k)])
    .concat([['Other', month.items.filter((i) => !KIND_ORDER.includes(i.kind))]])
    .filter(([, list]) => list.length);

  return (
    <div className="view">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Monthly news</div>
          <h1>{month.title}</h1>
          <p className="muted">{month.items.length} announcements</p>
        </div>
        {months.length > 1 && (
          <div className="seg">
            {months.slice(0, 6).map((m) => <button key={m.id} className={m.id === month.id ? 'on' : ''} onClick={() => setMonthId(m.id)}>{m.title.split(' ')[0].slice(0, 3)} {m.id.slice(2, 4)}</button>)}
          </div>
        )}
      </header>

      <section className="news-summary card">
        <h3 className="section-title">Month in review</h3>
        <p>{month.summary}</p>
        {month.forYou && <div className="for-you"><span className="for-you-tag">For your kit</span>{month.forYou}</div>}
      </section>

      {groups.map(([kind, list]) => (
        <section key={kind} className="news-group">
          <h3 className="section-title">{KIND_LABEL[kind] || kind}</h3>
          <div className="news-grid">
            {list.sort((a, b) => b.date.localeCompare(a.date)).map((item) => {
              const gear = item.catalogId && gearById[item.catalogId];
              const owned = gear && state.owned.includes(gear.id);
              return (
                <article key={item.name} className="news-card" style={{ '--brand': brandColor(item.brand) }}>
                  <div className="news-top">
                    <span className="news-brand">{item.brand}</span>
                    <span className="news-date">{fmtDate(item.date)}</span>
                  </div>
                  <h4>{item.name}</h4>
                  <ul className="news-points">{item.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                  <dl className="news-meta">
                    {item.price && <><dt>Price</dt><dd>{item.price}</dd></>}
                    {item.availability && <><dt>Available</dt><dd>{item.availability}</dd></>}
                  </dl>
                  {item.note && <p className="muted small">{item.note}</p>}
                  <div className="news-actions">
                    {gear && <button className="btn btn-sm" onClick={() => onOpenGear(gear)}>View specs</button>}
                    {gear && (
                      <button className={owned ? 'btn btn-sm' : 'btn btn-sm btn-primary'} onClick={() => actions.toggleOwned(gear.id)}>
                        <Icon name={owned ? 'check' : 'plus'} size={14} />{owned ? 'Owned' : 'Add to My Gear'}
                      </button>
                    )}
                    {item.source && <a className="btn btn-sm btn-ghost" href={item.source} target="_blank" rel="noreferrer">Source ↗</a>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <p className="muted small">Summaries are written from manufacturer announcements and photo news sites. Check the source before buying.</p>
    </div>
  );
}
