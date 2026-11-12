// The Library tab: every photo in the folders you add, in one place. Search,
// filter by camera, lens, date, stars and keywords, gather photos into
// collections, and open any of them in Culling or Develop. The folders are
// read by catalog.rs; stars and keywords live in the photos' sidecars.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bridge as app } from '../bridge.js';
import { Dropdown, Icon, Modal } from './ui.jsx';
import { confirmAction, openMenu } from './menu.jsx';
import { imgUrl, ROTATION } from '../cull/previews.js';
import { openAt } from '../cull/folder.js';
import { STAR_FILTERS } from '../cull/filter.js';
import { ratingForKey, ratingKeys } from '../cull/keys.js';
import { SORTS, cameraOf, dateLabel, dayOf, entryRating, facets, filterPhotos, sharedKeywords } from '../cull/library.js';

const CELL = 172; // grid cell, px (photo + caption)
const VIEW_KEY = 'flightroom-library-view';
const loadView = () => { try { return JSON.parse(localStorage.getItem(VIEW_KEY)) || {}; } catch { return {}; } };

const fmtShutter = (t) => (!t ? null : t >= 1 ? `${+t.toFixed(1)}s` : `1/${Math.round(1 / t)}`);
const dirOf = (id) => id.replace(/\|copy-\d+$/, '').replace(/[\\/][^\\/]*$/, '');
const baseName = (p) => p.split(/[\\/]/).pop();

export function LibraryView({ store, onCull, onDevelop }) {
  const bridge = app?.catalog;
  const { state, actions } = store;
  const [data, setData] = useState(null); // { folders, photos } | { error }
  const [busy, setBusy] = useState(null); // { folder, done, total } while folders are read
  const [view, setViewState] = useState(() => ({ source: { kind: 'all' }, q: '', camera: '', lens: '', date: '', stars: 'all', edited: '', sort: 'new', ...loadView() }));
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [toast, setToast] = useState('');
  const [naming, setNaming] = useState(null); // { id?, name, ids } for the collection dialog
  const setView = (patch) => setViewState((v) => {
    const n = { ...v, ...patch };
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ ...n, q: '' })); } catch {}
    return n;
  });
  const collections = state.collections || [];

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  // The catalog as saved, then read again quietly (stars and keywords may have changed in Culling or Lightroom).
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    const off = bridge.onProgress((p) => { if (live) setBusy(p.done < p.total ? p : null); });
    bridge.load().then((d) => {
      if (!live) return;
      setData(d);
      if (!d.error && d.folders.length) bridge.index([]).then((n) => { if (live && !n.error) setData(n); });
    });
    return () => { live = false; off(); };
  }, [bridge]);

  const photos = data?.photos || [];
  const sourceView = useMemo(() => {
    const src = view.source;
    if (src.kind === 'collection') return { ...view, source: { ...src, ids: collections.find((c) => c.id === src.id)?.ids || [] } };
    return view;
  }, [view, collections]);
  const shown = useMemo(() => filterPhotos(photos, sourceView), [photos, sourceView]);
  // Menus offer what's in the photos the source holds (before the other filters).
  const inSource = useMemo(() => filterPhotos(photos, { source: sourceView.source, sort: 'name' }), [photos, sourceView.source]);
  const fac = useMemo(() => facets(inSource), [inSource]);
  const allKeywords = useMemo(() => facets(photos).keywords, [photos]);
  const picked = useMemo(() => shown.filter((p) => sel.has(p.id)), [shown, sel]);
  const one = picked.length === 1 ? picked[0] : null;

  const cullFolders = (state.cull?.recent || []).filter((f) => !(data?.folders || []).some((x) => x.path.toLowerCase() === f.toLowerCase()));

  const addFolders = async (folders, subfolders) => {
    if (!folders.length) return;
    const n = await bridge.index(folders, subfolders);
    setBusy(null);
    if (n.error) setToast(`Couldn't read ${folders.length > 1 ? 'the folders' : baseName(folders[0])}: ${n.error}`);
    else { setData(n); setToast(`${folders.length > 1 ? `${folders.length} folders` : baseName(folders[0])} in your library`); }
  };
  const pickFolder = async () => {
    const d = await app.cull.pickFolder();
    if (d) addFolders([d], true);
  };
  const removeFolder = (f) => confirmAction({
    title: `Remove ${baseName(f.path)} from the library?`,
    text: 'Its photos leave the Library and its collections stay as they are. Nothing is deleted from your disk.',
    ok: 'Remove',
    onOk: async () => {
      const n = await bridge.removeFolder(f.path);
      if (!n.error) { setData(n); if (view.source.kind === 'folder' && view.source.path === f.path) setView({ source: { kind: 'all' } }); }
    },
  });
  const refresh = async (folders = []) => {
    const n = await bridge.index(folders);
    setBusy(null);
    if (n.error) setToast(n.error); else setData(n);
  };

  // Changes to some photos, without reading every folder again.
  const patch = (byId) => setData((d) => ({ ...d, photos: d.photos.map((p) => (byId[p.id] ? { ...p, ...byId[p.id] } : p)) }));
  const rate = async (list, r) => {
    const out = {};
    for (const p of list) {
      const res = await app.cull.rate(p, r);
      if (res?.error) { setToast(`Couldn't rate ${p.name}: ${res.error}`); break; }
      out[p.id] = p.ratingIn === 'file' ? { fileRating: r, rating: undefined } : { rating: r };
    }
    patch(out);
  };
  const keywords = async (list, add, remove = []) => {
    const res = await bridge.keywords(list, add, remove);
    if (res?.error) { setToast(`Couldn't save keywords: ${res.error}`); return; }
    patch(Object.fromEntries(Object.entries(res).map(([id, k]) => [id, { keywords: k }])));
  };

  const open = (p, where) => {
    openAt(p.id);
    actions.setCullFolder(dirOf(p.id));
    (where === 'develop' ? onDevelop : onCull)();
  };

  // Clicks: plain picks one, Ctrl adds or removes, Shift picks a run.
  const click = (e, i) => {
    const p = shown[i];
    if (e.shiftKey && anchor != null) {
      const a = shown.findIndex((x) => x.id === anchor);
      const [lo, hi] = [Math.min(a, i), Math.max(a, i)];
      setSel(new Set(shown.slice(lo, hi + 1).map((x) => x.id)));
      return;
    }
    if (e.ctrlKey || e.metaKey) setSel((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
    else setSel(new Set([p.id]));
    setAnchor(p.id);
  };

  const keys = ratingKeys(state.settings);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable], .overlay')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(new Set(shown.map((p) => p.id))); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape') { setSel(new Set()); return; }
      if (!picked.length) return;
      if (e.key === 'Enter') { e.preventDefault(); open(picked[0], 'cull'); return; }
      if (e.key.toLowerCase() === 'd') { e.preventDefault(); open(picked[0], 'develop'); return; }
      const r = ratingForKey(keys, e.key);
      if (r !== undefined && !e.repeat) { e.preventDefault(); rate(picked, r); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, picked, keys]);

  const cellMenu = (e, p) => {
    if (!sel.has(p.id)) { setSel(new Set([p.id])); setAnchor(p.id); }
    const list = sel.has(p.id) ? picked : [p];
    const many = list.length > 1;
    openMenu(e, [
      { heading: many ? `${list.length} photos` : p.name },
      !many && { label: 'Open in Culling', hint: 'Enter', icon: 'photo', onClick: () => open(p, 'cull') },
      !many && { label: 'Open in Develop', hint: 'D', icon: 'develop', onClick: () => open(p, 'develop') },
      '-',
      { label: 'Add to collection', icon: 'plus', items: [
        ...collections.map((c) => ({ label: c.name, onClick: () => { actions.collect(c.id, list.map((x) => x.id)); setToast(`Added to ${c.name}`); } })),
        collections.length && '-',
        { label: 'New collection…', onClick: () => setNaming({ name: '', ids: list.map((x) => x.id) }) },
      ] },
      view.source.kind === 'collection' && { label: 'Remove from this collection', icon: 'minus', onClick: () => actions.collect(view.source.id, list.map((x) => x.id), false) },
      '-',
      !many && { label: 'Show in Explorer', icon: 'folder', onClick: () => app.reveal(p.raw || p.jpeg || p.id) },
    ]);
  };

  if (!bridge) {
    return <div className="view"><div className="hero-empty"><div className="hero-icon"><Icon name="library" size={40} /></div><h2>The Library runs in the desktop app</h2><p className="muted">Open Flightroom on your PC to add your photo folders.</p></div></div>;
  }

  const sourceTitle = view.source.kind === 'folder' ? baseName(view.source.path)
    : view.source.kind === 'collection' ? collections.find((c) => c.id === view.source.id)?.name || 'Collection'
    : view.source.kind === 'keyword' ? view.source.keyword : 'All photos';
  const filtered = view.q || view.camera || view.lens || view.date || view.stars !== 'all' || view.edited;

  return (
    <div className="lib">
      <aside className="lib-side">
        <button className={`lib-src${view.source.kind === 'all' ? ' on' : ''}`} onClick={() => setView({ source: { kind: 'all' } })}>
          <Icon name="library" size={15} /><span className="grow">All photos</span><span className="nav-count">{photos.length}</span>
        </button>

        <div className="lib-head">Folders<button className="icon-btn tiny" onClick={pickFolder} title="Add a folder"><Icon name="plus" size={14} /></button></div>
        {(data?.folders || []).map((f) => {
          const n = photos.filter((p) => p.folder === f.path).length;
          return (
            <button key={f.path} className={`lib-src${view.source.kind === 'folder' && view.source.path === f.path ? ' on' : ''}`} title={f.path}
              onClick={() => setView({ source: { kind: 'folder', path: f.path } })}
              onContextMenu={(e) => openMenu(e, [
                { heading: baseName(f.path) },
                { label: 'Read again', icon: 'refresh', onClick: () => refresh([f.path]) },
                { label: 'Include subfolders', checked: f.subfolders, onClick: () => addFolders([f.path], !f.subfolders) },
                { label: 'Open in Culling', icon: 'photo', onClick: () => { actions.setCullFolder(f.path); onCull(); } },
                { label: 'Show in Explorer', icon: 'folder', onClick: () => app.reveal(f.path) },
                '-',
                { label: 'Remove from library…', icon: 'trash', danger: true, onClick: () => removeFolder(f) },
              ])}>
              <Icon name="folder" size={15} /><span className="grow ellip">{baseName(f.path)}</span><span className="nav-count">{n}</span>
            </button>
          );
        })}
        {data && !data.folders?.length && <p className="muted small lib-note">Add the folders your photos are in. They stay where they are; the Library only reads them.</p>}
        {cullFolders.length > 0 && (
          <button className="btn btn-sm lib-add" onClick={() => addFolders(cullFolders)} title={cullFolders.join('\n')}>
            <Icon name="plus" size={14} />Add {cullFolders.length} folder{cullFolders.length === 1 ? '' : 's'} from Culling
          </button>
        )}

        <div className="lib-head">Collections<button className="icon-btn tiny" onClick={() => setNaming({ name: '', ids: picked.map((p) => p.id) })} title="New collection (with the selected photos)"><Icon name="plus" size={14} /></button></div>
        {collections.map((c) => (
          <button key={c.id} className={`lib-src${view.source.kind === 'collection' && view.source.id === c.id ? ' on' : ''}`}
            onClick={() => setView({ source: { kind: 'collection', id: c.id } })}
            onContextMenu={(e) => openMenu(e, [
              { heading: c.name },
              picked.length > 0 && { label: `Add ${picked.length} selected`, icon: 'plus', onClick: () => actions.collect(c.id, picked.map((p) => p.id)) },
              { label: 'Rename…', icon: 'edit', onClick: () => setNaming({ id: c.id, name: c.name }) },
              '-',
              { label: 'Delete collection…', icon: 'trash', danger: true, onClick: () => confirmAction({
                title: `Delete ${c.name}?`, text: 'Only the collection goes; its photos stay in the Library and on your disk.', ok: 'Delete',
                onOk: () => { actions.deleteCollection(c.id); if (view.source.id === c.id) setView({ source: { kind: 'all' } }); },
              }) },
            ])}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const ids = e.dataTransfer.getData('text/flightroom-ids'); if (ids) { actions.collect(c.id, JSON.parse(ids)); setToast(`Added to ${c.name}`); } }}>
            <Icon name="layers" size={15} /><span className="grow ellip">{c.name}</span><span className="nav-count">{c.ids.length}</span>
          </button>
        ))}
        {!collections.length && <p className="muted small lib-note">Gather photos from any folder, such as a client's picks. Drag photos onto one to add them.</p>}

        {fac.keywords.length > 0 && <div className="lib-head">Keywords</div>}
        <div className="lib-kws">
          {fac.keywords.map(([k, n]) => (
            <button key={k} className={`lib-src sm${view.source.kind === 'keyword' && view.source.keyword.toLowerCase() === k.toLowerCase() ? ' on' : ''}`}
              onClick={() => setView({ source: { kind: 'keyword', keyword: k } })}>
              <span className="grow ellip">{k}</span><span className="nav-count">{n}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="lib-main">
        <header className="cull-bar lib-bar">
          <div className="grow cull-title">
            <div className="cull-folder">{sourceTitle}</div>
            <div className="cull-sub">{busy ? `Reading ${baseName(busy.folder) || 'folders'}… ${busy.done + 1} of ${busy.total}` : `${shown.length}${filtered ? ` of ${inSource.length}` : ''} photo${shown.length === 1 ? '' : 's'}${picked.length ? ` · ${picked.length} selected` : ''}`}</div>
          </div>
          <label className="search lib-search">
            <Icon name="search" size={14} />
            <input value={view.q} placeholder="Search names, keywords, camera…" onChange={(e) => setView({ q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Escape') { setView({ q: '' }); e.currentTarget.blur(); } }} />
          </label>
          <Dropdown className={view.camera ? 'on' : ''} value={view.camera} label={view.camera ? undefined : 'Camera'} onChange={(v) => setView({ camera: v })}
            options={[{ value: '', label: 'Any camera' }, ...fac.cameras.map(([k, n]) => ({ value: k, label: k, hint: n }))]} />
          <Dropdown className={view.lens ? 'on' : ''} value={view.lens} label={view.lens ? undefined : 'Lens'} onChange={(v) => setView({ lens: v })}
            options={[{ value: '', label: 'Any lens' }, ...fac.lenses.map(([k, n]) => ({ value: k, label: k, hint: n }))]} />
          <Dropdown className={view.date ? 'on' : ''} value={view.date} label={view.date ? undefined : 'Date'} onChange={(v) => setView({ date: v })}
            options={[{ value: '', label: 'Any date' }, ...fac.dates.map(([k, n]) => ({ value: k, label: k.length === 4 ? k : `  ${dateLabel(k)}`, hint: n }))]} />
          <Dropdown className={view.stars !== 'all' ? 'on' : ''} value={view.stars} label={view.stars !== 'all' ? undefined : 'Stars'} onChange={(v) => setView({ stars: v })}
            options={[{ value: 'all', label: 'Any stars' }, { value: 'rated', label: 'Rated' }, { value: 'unrated', label: 'Unrated' }, ...STAR_FILTERS.map(([value, label]) => ({ value, label }))]} />
          <Dropdown className={view.edited ? 'on' : ''} value={view.edited} label={view.edited ? undefined : 'Edited'} onChange={(v) => setView({ edited: v })}
            options={[{ value: '', label: 'Edited or not' }, { value: 'yes', label: 'Edited' }, { value: 'no', label: 'Not edited' }]} />
          <Dropdown value={view.sort} onChange={(v) => setView({ sort: v })} options={SORTS.map(([value, label]) => ({ value, label }))} title="Sort" />
          {filtered && <button className="btn btn-sm btn-ghost" onClick={() => setView({ q: '', camera: '', lens: '', date: '', stars: 'all', edited: '' })}>Clear</button>}
          <button className="icon-btn" title="Read every folder again" onClick={() => refresh()} disabled={!!busy || !data?.folders?.length}><Icon name="refresh" size={16} /></button>
        </header>
        {data?.error ? (
          <div className="hero-empty"><h2>The Library couldn't be read</h2><p className="muted small">{data.error}</p></div>
        ) : !data ? (
          <div className="hero-empty"><p className="muted">Reading the Library…</p></div>
        ) : !photos.length ? (
          <div className="hero-empty">
            <div className="hero-icon"><Icon name="library" size={40} /></div>
            <h2>All your photos, in one place</h2>
            <p className="muted">Add your photo folders to search them all at once by camera, lens, date, stars or keywords, and to gather picks into collections.</p>
            <div className="row">
              <button className="btn btn-primary" onClick={pickFolder}><Icon name="folder" size={16} />Add a folder</button>
              {cullFolders.length > 0 && <button className="btn" onClick={() => addFolders(cullFolders)}>Add {cullFolders.length} from Culling</button>}
            </div>
          </div>
        ) : !shown.length ? (
          <div className="hero-empty"><h2>No photos match</h2>{filtered && <button className="btn btn-sm" onClick={() => setView({ q: '', camera: '', lens: '', date: '', stars: 'all', edited: '' })}>Clear the filters</button>}</div>
        ) : (
          <Grid photos={shown} sel={sel} onClick={click} onOpen={(p) => open(p, 'cull')} onMenu={cellMenu} picked={picked} />
        )}
      </section>

      <aside className="lib-info">
        {picked.length ? (
          <Info photos={picked} one={one} allKeywords={allKeywords} keys={keys} onRate={(r) => rate(picked, r)} onKeywords={(add, remove) => keywords(picked, add, remove)}
            collections={collections} onCollect={(id, add) => actions.collect(id, picked.map((p) => p.id), add)} onNewCollection={() => setNaming({ name: '', ids: picked.map((p) => p.id) })}
            onOpen={(where) => open(picked[0], where)} />
        ) : (
          <p className="muted small lib-note">Pick a photo to see its details, rate it and add keywords. Ctrl+click or Shift+click picks several.</p>
        )}
      </aside>

      {naming && (
        <CollectionDialog initial={naming.name} renaming={!!naming.id} count={naming.ids?.length || 0} onClose={() => setNaming(null)}
          onSave={(name) => {
            if (naming.id) actions.renameCollection(naming.id, name);
            else { const id = actions.addCollection(name, naming.ids); setView({ source: { kind: 'collection', id } }); }
            setNaming(null);
          }} />
      )}
      {toast && <div className="cull-toast">{toast}</div>}
    </div>
  );
}

// The photos as a grid. Only the rows on screen exist, so tens of thousands scroll smoothly.
function Grid({ photos, sel, onClick, onOpen, onMenu, picked }) {
  const ref = useRef();
  const [box, setBox] = useState({ w: 0, h: 0, top: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setBox((b) => ({ ...b, w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = Math.max(1, Math.floor(box.w / CELL));
  const rows = Math.ceil(photos.length / cols);
  const first = Math.max(0, Math.floor(box.top / CELL) - 2);
  const last = Math.min(rows, Math.ceil((box.top + box.h) / CELL) + 2);
  const cellW = box.w / cols;
  const cells = [];
  for (let r = first; r < last; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const p = photos[i];
      if (!p) break;
      cells.push(<Cell key={p.id} p={p} on={sel.has(p.id)} style={{ left: c * cellW, top: r * CELL, width: cellW, height: CELL }}
        onClick={(e) => onClick(e, i)} onDoubleClick={() => onOpen(p)} onMenu={(e) => onMenu(e, p)}
        onDrag={(e) => e.dataTransfer.setData('text/flightroom-ids', JSON.stringify((sel.has(p.id) ? picked : [p]).map((x) => x.id)))} />);
    }
  }
  return (
    <div className="lib-grid" ref={ref} onScroll={(e) => setBox((b) => ({ ...b, top: e.currentTarget.scrollTop }))}>
      <div style={{ height: rows * CELL, position: 'relative' }}>{cells}</div>
    </div>
  );
}

function Cell({ p, on, style, onClick, onDoubleClick, onMenu, onDrag }) {
  const [failed, setFailed] = useState(false);
  const developed = p.developed && !failed ? app.cull.developedUrl(p) : null;
  const rot = developed ? 0 : ROTATION[p.orientation] || 0;
  const stars = entryRating(p);
  return (
    <div className={`lib-cell${on ? ' on' : ''}`} style={style} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onMenu}
      draggable onDragStart={onDrag} title={`${p.name}${p.copy ? ` (copy ${p.copy})` : ''}\n${dirOf(p.id)}`}>
      <div className="lib-pic">
        {p.cloud && !developed ? <span className="muted small" title="Only in OneDrive: it downloads when opened">In OneDrive</span>
          : <img src={developed || imgUrl('thumb', p.id)} alt="" loading="lazy" decoding="async" draggable={false} onError={() => developed && setFailed(true)}
            style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />}
        {p.copy && <span className="thumb-copy">Copy {p.copy}</span>}
      </div>
      <div className="lib-cap">
        <span className="ellip grow">{p.name}</span>
        {stars > 0 && <span className="lib-stars">{'★'.repeat(stars)}</span>}
      </div>
    </div>
  );
}

function Info({ photos, one, allKeywords, keys, onRate, onKeywords, collections, onCollect, onNewCollection, onOpen }) {
  const [text, setText] = useState('');
  const { all, some } = sharedKeywords(photos);
  const rating = photos.every((p) => entryRating(p) === entryRating(photos[0])) ? entryRating(photos[0]) : null;
  const add = () => {
    const words = text.split(',').map((w) => w.trim()).filter(Boolean);
    if (words.length) onKeywords(words);
    setText('');
  };
  const suggestions = text.trim() ? allKeywords.map(([k]) => k).filter((k) => k.toLowerCase().startsWith(text.trim().toLowerCase()) && !all.includes(k)).slice(0, 6) : [];
  const rows = one ? [
    ['Camera', cameraOf(one)],
    ['Lens', one.lens],
    ['Taken', one.takenAt ? one.takenAt.replace(/^(\d+):(\d+):(\d+) (\d+:\d+):\d+$/, '$1-$2-$3 $4') : dayOf(one)],
    ['Settings', [one.focalLength && `${Math.round(one.focalLength)}mm`, fmtShutter(one.exposure), one.fNumber && `f/${+one.fNumber.toFixed(1)}`, one.iso && `ISO ${one.iso}`].filter(Boolean).join('  ·  ')],
    ['Folder', dirOf(one.id)],
  ].filter(([, v]) => v) : [];
  const inColl = collections.filter((c) => photos.every((p) => c.ids.includes(p.id)));
  return (
    <div className="lib-info-body">
      <div className="lib-info-title">{one ? one.name : `${photos.length} photos`}</div>
      {one?.cloud && <p className="muted small">Only in OneDrive: camera details are read once it has downloaded.</p>}
      {rows.length > 0 && <dl className="lib-meta">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd title={v}>{v}</dd></div>)}</dl>}

      <div className="lib-sec">Stars</div>
      <div className="stars lib-rate">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`star${rating != null && n <= rating ? ' on' : ''}`} onClick={() => onRate(n === rating ? 0 : n)} title={`${n} star${n > 1 ? 's' : ''} (key ${keys[n]})`}>★</button>
        ))}
        {rating == null && <span className="muted small">mixed</span>}
      </div>

      <div className="lib-sec">Keywords</div>
      <div className="lib-chips">
        {all.map((k) => <span key={k} className="lib-chip">{k}<button onClick={() => onKeywords([], [k])} title={`Remove ${k}`}><Icon name="x" size={11} /></button></span>)}
        {some.map((k) => <span key={k} className="lib-chip some" title="On some of the selected photos: click to add it to all">
          <button className="lib-chip-add" onClick={() => onKeywords([k])}>{k}</button><button onClick={() => onKeywords([], [k])} title={`Remove ${k}`}><Icon name="x" size={11} /></button></span>)}
        {!all.length && !some.length && <span className="muted small">None yet</span>}
      </div>
      <div className="lib-kw-add">
        <input value={text} placeholder="Add keywords, comma between" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setText(''); }} />
        <button className="btn btn-sm" onClick={add} disabled={!text.trim()}>Add</button>
      </div>
      {suggestions.length > 0 && <div className="lib-chips">{suggestions.map((k) => <button key={k} className="lib-chip some lib-chip-add" onClick={() => { onKeywords([k]); setText(''); }}>{k}</button>)}</div>}
      <p className="muted small">Saved in the photos' sidecars, where Lightroom reads them (Metadata › Read Metadata from Files).</p>

      <div className="lib-sec">Collections</div>
      <div className="lib-chips">
        {inColl.map((c) => <span key={c.id} className="lib-chip">{c.name}<button onClick={() => onCollect(c.id, false)} title={`Take out of ${c.name}`}><Icon name="x" size={11} /></button></span>)}
        <Dropdown value="" label="Add to…" onChange={(v) => (v === '+' ? onNewCollection() : onCollect(v, true))}
          options={[...collections.filter((c) => !inColl.includes(c)).map((c) => ({ value: c.id, label: c.name })), { value: '+', label: 'New collection…' }]} />
      </div>

      {one && (
        <div className="lib-open">
          <button className="btn btn-sm" onClick={() => onOpen('cull')}><Icon name="photo" size={14} />Culling</button>
          <button className="btn btn-sm btn-primary" onClick={() => onOpen('develop')}><Icon name="develop" size={14} />Develop</button>
        </div>
      )}
    </div>
  );
}

function CollectionDialog({ initial, renaming, count, onClose, onSave }) {
  const [name, setName] = useState(initial || '');
  const ok = name.trim();
  return (
    <Modal title={renaming ? 'Rename collection' : 'New collection'} onClose={onClose} footer={(
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => onSave(ok)}>{renaming ? 'Rename' : 'Create'}</button>
      </>
    )}>
      <label className="field"><span>Name</span>
        <input autoFocus value={name} placeholder="Client picks, Portfolio…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) onSave(ok); }} />
      </label>
      {!renaming && count > 0 && <p className="muted small">With the {count} selected photo{count === 1 ? '' : 's'}.</p>}
    </Modal>
  );
}
