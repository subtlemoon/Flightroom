import { bridge as app, FILES } from '../bridge.js';
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, Icon, Modal, PanelHandle } from './ui.jsx';
import { toggle, useLayout } from '../layout.js';
import { clearPreviews, decodeThumb, drawPhoto, geometry, imgUrl, loadFit, loadFull, loadThumb, prune, ROTATION, thumbFallbackUrl } from '../cull/previews.js';
import { loadAnalysis, measure, saveAnalysis, suggest, upright } from '../cull/analyze.js';
import { measurePool } from '../cull/measure-pool.js';
import { inFilter, STAR_FILTERS } from '../cull/filter.js';
import { cachedFolder, keepFolder, latestOnly, sameList } from '../cull/folder.js';
import { RESERVED_KEYS, keyLabel, normKey, ratingForKey, ratingKeys, zoomKey, zoomLevel } from '../cull/keys.js';

// A photo in the culling view, as listed by the desktop side:
//   { id, name, raw, jpeg, sidecar, ratingIn: 'sidecar' | 'file', rating }
// `rating` is what the .xmp sidecar says (null if there is none); the rating stored
// inside the file arrives later with the photo's meta. Later features (exported,
// sent to client) add fields to this record rather than a new list.
export const photoRating = (p, meta) => p.rating ?? meta?.fileRating ?? 0;
// Export brings the RAW renderer, so it loads when first opened.
const ExportModal = lazy(() => import('./export.jsx').then((m) => ({ default: m.ExportModal })));

const filterName = (f) => ({ all: '', rated: 'rated', unrated: 'unrated', rejects: 'likely reject' })[f] ?? STAR_FILTERS.find(([k]) => k === f)?.[1].replace('Only ', '');

const AHEAD = [1, 2, -1, 3, -2]; // neighbours decoded in advance, in this order
const META_WINDOW = 20; // only files near the current one are opened, so a OneDrive
                        // folder isn't downloaded all at once just by opening it

export function CullView({ store, onDevelop }) {
  const bridge = app?.cull;
  const { state, actions } = store;
  const keys = ratingKeys(state.settings);
  const advance = !!state.settings.cullAdvance;
  const zKey = zoomKey(state.settings);
  const zoomPct = zoomLevel(state.settings);
  const folder = state.cull?.folder;

  // Back from Develop: the folder as it was left, at once (open() reads it again quietly).
  const [seen] = useState(() => cachedFolder(folder));
  const [list, setList] = useState(seen?.list || null); // { folder, photos } | { error }
  const [currentId, setCurrentId] = useState(() => seen?.list.photos[state.cull?.positions?.[seen.list.folder] || 0]?.id ?? null);
  const [filter, setFilter] = useState(seen?.filter || 'all'); // see inFilter
  const [meta, setMeta] = useState(seen?.meta || {});
  const [zoom, setZoom] = useState(null); // null | { cx, cy }
  const [toast, setToast] = useState('');
  // Auto-rating: saved measurements and which stars it wrote, the run in progress,
  // and whether its panel is open.
  const [auto, setAuto] = useState(() => (seen ? loadAnalysis(seen.list.folder) : { measured: {}, applied: {} }));
  const [autoRun, setAutoRun] = useState(null); // { kind: 'analyze' | 'apply', done, total }
  const [autoOpen, setAutoOpen] = useState(false);
  const [showSubject, setShowSubject] = useState(false); // while the pointer is on the suggestion
  const [exporting, setExporting] = useState(false);
  const autoCancel = useRef(false);
  const pendingMeta = useRef();
  pendingMeta.current ||= new Set(Object.keys(meta));
  const [scans] = useState(latestOnly);
  const [loads] = useState(latestOnly);
  const positions = useRef();
  positions.current = state.cull?.positions || {};

  const allPhotos = list?.photos || [];
  const isRated = (p) => photoRating(p, meta[p.id]) > 0;
  const suggestions = useMemo(
    () => suggest(allPhotos.map((p) => ({ id: p.id, name: p.name, m: auto.measured[p.id], takenAt: auto.measured[p.id]?.takenAt }))),
    [allPhotos.length, list?.folder, auto.measured],
  );
  // Stars you gave yourself are never changed by auto-rating; stars it wrote can be.
  const autoMayRate = (p) => {
    const r = photoRating(p, meta[p.id]);
    return r <= 0 || auto.applied[p.id] === r;
  };
  const photos = useMemo(() => {
    if (filter === 'all') return allPhotos;
    if (filter === 'rejects') return allPhotos.filter((p) => suggestions[p.id]?.stars === 1);
    return allPhotos.filter((p) => inFilter(filter, photoRating(p, meta[p.id])));
  }, [allPhotos, meta, filter, suggestions]);
  const starOptions = useMemo(() => STAR_FILTERS.map(([k, label]) => ({ value: k, label, hint: allPhotos.filter((p) => inFilter(k, photoRating(p, meta[p.id]))).length })), [allPhotos, meta]);
  // The current photo is tracked by id so it stays put when the filter changes.
  // If it drops out of the filter (say, rated while showing Unrated), the photo
  // that slid into its place becomes current.
  const lastIndex = useRef(0);
  let index = photos.findIndex((p) => p.id === currentId);
  if (index < 0) index = Math.min(lastIndex.current, photos.length - 1);
  if (index >= 0) lastIndex.current = index;
  const photo = photos[index];
  useEffect(() => { if (photo && photo.id !== currentId) setCurrentId(photo.id); }, [photo?.id]);

  const open = useCallback(async (dir, reload) => {
    if (!bridge || !dir) return;
    // Only the newest scan counts: an older folder's answer arriving late is dropped.
    const latest = scans.next();
    if (!reload && cachedFolder(dir)) {
      const res = await bridge.scan(dir);
      if (latest() && !res.error) setList((l) => (l?.photos && sameList(l.photos, res.photos) ? l : res));
      return;
    }
    setList({ loading: true, folder: dir });
    loads.next(); // metadata still coming for the folder before is dropped
    const res = await bridge.scan(dir);
    if (!latest()) return;
    if (res.error) { setList({ error: res.error, folder: dir }); return; }
    setMeta({});
    pendingMeta.current = new Set();
    const pos = Math.min(positions.current[res.folder] || 0, Math.max(0, res.photos.length - 1));
    lastIndex.current = pos;
    setCurrentId(res.photos[pos]?.id ?? null);
    setFilter('all');
    setAuto(loadAnalysis(res.folder));
    setList(res);
  }, [bridge]);

  useEffect(() => { if (folder) open(folder); }, [folder, open]);
  useEffect(() => { if (list?.photos && list.folder) keepFolder(folder, { list, meta, filter }); }, [list, meta, filter]);

  const pick = async () => {
    const dir = await bridge.pickFolder();
    if (dir) {
      if (dir === folder) open(dir);
      else actions.setCullFolder(dir);
    }
  };

  // Remember where you were in each folder (Develop opens the same photo).
  const lastPos = useRef(null);
  useEffect(() => {
    const pos = allPhotos.findIndex((p) => p.id === photo?.id);
    if (list?.folder && pos >= 0) {
      lastPos.current = [list.folder, pos];
      const t = setTimeout(() => actions.setCullPosition(list.folder, pos), 400);
      return () => clearTimeout(t);
    }
  }, [photo?.id, list?.folder]);
  useEffect(() => () => { if (lastPos.current) actions.setCullPosition(...lastPos.current); clearPreviews(); }, []);

  // Photo and rated counts for the folder list.
  const ratedCount = allPhotos.filter(isRated).length;
  useEffect(() => {
    if (!list?.folder || list.loading) return;
    const t = setTimeout(() => actions.setCullStats(list.folder, { photos: allPhotos.length, rated: ratedCount }), 600);
    return () => clearTimeout(t);
  }, [list, ratedCount]);

  const requestMeta = useCallback((ids) => {
    const want = ids.filter((id) => id && !pendingMeta.current.has(id));
    if (!want.length || !bridge) return;
    want.forEach((id) => pendingMeta.current.add(id));
    const latest = loads.current();
    bridge.meta(want).then((m) => { if (latest() && !m.error) setMeta((old) => ({ ...old, ...m })); });
  }, [bridge]);

  useEffect(() => {
    if (!photo) return;
    const lo = Math.max(0, index - 3), hi = Math.min(photos.length, index + META_WINDOW);
    requestMeta([photo.id, ...photos.slice(lo, hi).map((p) => p.id)]);
  }, [photo?.id, photos, requestMeta]);

  const go = useCallback((i) => {
    if (!photos.length) return;
    const n = Math.max(0, Math.min(photos.length - 1, i));
    lastIndex.current = n;
    setCurrentId(photos[n].id);
  }, [photos]);

  const rememberApplied = (id, stars) => setAuto((a) => {
    const applied = { ...a.applied };
    if (stars == null) delete applied[id]; else applied[id] = stars;
    const next = { ...a, applied };
    saveAnalysis(list?.folder, next);
    return next;
  });

  const rate = useCallback(async (p, rating, { byAuto = false } = {}) => {
    if (!p) return;
    rememberApplied(p.id, byAuto ? rating : null);
    const before = p.rating;
    const set = (r) => setList((l) => ({ ...l, photos: l.photos.map((x) => (x.id === p.id ? { ...x, rating: r } : x)) }));
    set(rating);
    const res = await bridge.rate(p, rating);
    if (res?.error) {
      set(before);
      setToast(`Couldn't save the rating for ${p.name}: ${res.error}`);
    } else {
      setToast(rating ? `${'★'.repeat(rating)} saved to ${p.ratingIn === 'file' ? p.name : p.sidecar.split(/[\\/]/).pop()}` : `Rating cleared on ${p.name}`);
    }
  }, [bridge, list?.folder]);

  // Measures every photo not measured yet: the small embedded preview, and the
  // big one around the subject for its sharpness.
  const analyze = async () => {
    const dir = list.folder;
    const todo = allPhotos.filter((p) => !auto.measured[p.id]);
    const measured = { ...auto.measured };
    autoCancel.current = false;
    setAutoRun({ kind: 'analyze', done: 0, total: todo.length });
    const started = performance.now();
    const pool = measurePool();
    try {
      // Photos stream through the workers a few at a time; metadata is read in batches.
      const BATCH = pool.size * 6;
      for (let i = 0; i < todo.length && !autoCancel.current; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const m = await bridge.meta(batch.map((p) => p.id));
        if (!m.error) setMeta((old) => ({ ...old, ...m }));
        await Promise.all(batch.map(async (p) => {
          const orientation = m[p.id]?.orientation;
          try {
            measured[p.id] = { ...(await pool.measure(await decodeThumb(p), orientation, new URL(imgUrl('preview', p.id), location.href).href)), takenAt: m[p.id]?.takenAt };
          } catch {
            // The worker couldn't do it: measure here, on the whole frame.
            try {
              const raw = await decodeThumb(p);
              const bmp = upright(raw, orientation);
              measured[p.id] = { ...measure(bmp), takenAt: m[p.id]?.takenAt };
              if (bmp !== raw) bmp.close();
              raw.close();
            } catch {}
          }
        }));
        setAutoRun((r) => r && { ...r, done: Math.min(todo.length, i + batch.length) });
      }
    } finally {
      pool.close(); // each worker holds its own detector, so they never outlive a run
    }
    console.log(`[auto-rate] measured ${todo.length} photos in ${Math.round(performance.now() - started)} ms`);
    setAuto((a) => { const next = { ...a, measured }; saveAnalysis(dir, next); return next; });
    setAutoRun(null);
  };

  // Writes every suggestion to photos you haven't rated yourself.
  const applyAll = async () => {
    const targets = allPhotos.filter((p) => suggestions[p.id] && autoMayRate(p) && photoRating(p, meta[p.id]) !== suggestions[p.id].stars);
    autoCancel.current = false;
    setAutoRun({ kind: 'apply', done: 0, total: targets.length });
    const written = {};
    let failed = 0;
    for (let i = 0; i < targets.length && !autoCancel.current; i += 8) {
      await Promise.all(targets.slice(i, i + 8).map(async (p) => {
        const stars = suggestions[p.id].stars;
        const res = await bridge.rate(p, stars);
        if (res?.error) failed++; else written[p.id] = stars;
      }));
      setAutoRun((r) => r && { ...r, done: Math.min(targets.length, i + 8) });
    }
    setList((l) => ({ ...l, photos: l.photos.map((x) => (x.id in written ? { ...x, rating: written[x.id] } : x)) }));
    setAuto((a) => { const next = { ...a, applied: { ...a.applied, ...written } }; saveAnalysis(list.folder, next); return next; });
    setAutoRun(null);
    setToast(`Rated ${Object.keys(written).length} photos${failed ? `, ${failed} could not be saved` : ''}`);
  };

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Keyboard: arrows move, Home/End jump; rating and zoom keys come from Settings.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || exporting) return;
      // Ctrl+Shift+E: Export, as in Lightroom.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e' && allPhotos.length && !autoOpen) { e.preventDefault(); setExporting(true); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!photos.length || autoOpen) return;
      if (e.key === 'Enter') {
        // Accept the auto-rating suggestion for this photo.
        const sug = photo && suggestions[photo.id];
        if (sug && autoMayRate(photo) && !e.repeat) {
          e.preventDefault();
          rate(photo, sug.stars, { byAuto: true });
          const stays = inFilter(filter, sug.stars);
          if (advance && stays) go(index + 1);
        }
        return;
      }
      if (normKey(e.key) === zKey) {
        e.preventDefault(); // also stops Space from pressing a focused button
        if (!e.repeat) setZoom((z) => (z ? null : { center: true }));
        return;
      }
      const r = ratingForKey(keys, e.key);
      if (r !== undefined && !RESERVED_KEYS.includes(e.key)) {
        e.preventDefault();
        if (!e.repeat && photo) {
          rate(photo, r);
          // A photo that leaves the current filter is replaced by the next one anyway.
          const stays = inFilter(filter, r);
          if (advance && stays) go(index + 1);
        }
        return;
      }
      if (e.key.toLowerCase() === 'd' && onDevelop && photo) { e.preventDefault(); onDevelop(); return; }
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (moves[e.key]) { e.preventDefault(); go(index + moves[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(photos.length - 1); }
      else if (e.key === 'Escape') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos, photo, index, keys, zKey, advance, filter, go, rate, autoOpen, suggestions, auto, exporting]);

  if (!bridge) {
    return <div className="view"><div className="hero-empty"><div className="hero-icon"><Icon name="photo" size={40} /></div><h2>Culling runs in the desktop app</h2><p className="muted">Open Flightroom on your PC to link a photo folder.</p></div></div>;
  }

  if (!folder || list?.error) {
    // The Culling tab doesn't scroll as a whole (the photo view fills it), so the folder list scrolls itself.
    return <div className="home-scroll"><FolderHome state={state} actions={actions} bridge={bridge} onPick={pick} error={list?.error && folder} /></div>;
  }

  const curMeta = photo && meta[photo.id];
  const curRating = photo ? photoRating(photo, curMeta) : 0;
  const curSug = photo && suggestions[photo.id];
  const measuredCount = allPhotos.filter((p) => auto.measured[p.id]).length;
  const rejectCount = allPhotos.filter((p) => suggestions[p.id]?.stars === 1).length;
  const filters = [['all', 'All', allPhotos.length], ['rated', '★ Rated', ratedCount], ['unrated', 'Unrated', allPhotos.length - ratedCount]];
  if (measuredCount) filters.push(['rejects', 'Likely rejects', rejectCount]);

  return (
    <div className="cull">
      <header className="cull-bar">
        <div className="grow cull-title">
          <div className="eyebrow">Culling</div>
          <div className="cull-folder" title={list?.folder || folder}>{(list?.folder || folder).split(/[\\/]/).pop()}</div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => actions.setCullFolder(null)} title="Back to your folders"><Icon name="back" size={14} />Folders</button>
        <div className="seg small cull-filter">
          {filters.map(([k, label, n]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} onMouseDown={(e) => e.preventDefault()}>
              {label} <span className="seg-count">{n}</span>
            </button>
          ))}
        </div>
        <Dropdown className={`cull-stars${filter.startsWith('stars:') ? ' on' : ''}`} value={filter} label={filter.startsWith('stars:') ? undefined : 'Stars…'}
          onChange={setFilter} title="Show photos by star rating"
          options={starOptions} />
        <div className="cull-stats muted">
          {list?.loading ? 'Reading folder…' : `${photos.length ? index + 1 : 0} of ${photos.length}`}
        </div>
        <label className="toggle-row cull-advance" title="Go to the next photo after rating">
          <input type="checkbox" checked={advance} onChange={() => actions.setCullSettings({ cullAdvance: !advance })} />Auto-advance
        </label>
        <button className="btn btn-sm" onClick={() => open(folder, true)} title="Look for new files"><Icon name="refresh" size={14} />Reload</button>
        {onDevelop && <button className="btn btn-sm" onClick={onDevelop} disabled={!photo} title="Edit this photo (D)"><Icon name="develop" size={14} />Develop</button>}
        <button className="btn btn-sm" onClick={() => setExporting(true)} disabled={!allPhotos.length} title="Export JPEGs of this photo, the rated ones or the ones shown (Ctrl+Shift+E)"><Icon name="export" size={14} />Export</button>
        <button className={`btn btn-sm${measuredCount ? '' : ' btn-primary'}`} onClick={() => setAutoOpen(true)} disabled={!allPhotos.length}>
          <Icon name="spark" size={14} />
          {autoRun ? `${autoRun.kind === 'apply' ? 'Rating' : 'Analyzing'} ${autoRun.done}/${autoRun.total}` : 'Auto-rate'}
        </button>
      </header>

      {photo ? (
        <>
          <Stage photo={photo} meta={curMeta} photos={photos} index={index} metaById={meta} zoom={zoom} setZoom={setZoom} scale={zoomPct / 100}
            subject={showSubject ? auto.measured[photo.id]?.subject?.box : null}>
            <div className="stage-top">
              <span className="stage-name">{photo.name}{photo.raw && photo.jpeg && <span className="pill-mini">RAW+JPEG</span>}</span>
              <ShotInfo meta={curMeta} />
              {zoom && <span className="pill-mini zoom">{zoomPct}%</span>}
            </div>
            <div className="stage-bottom">
              {curSug && <Suggestion sug={curSug} rating={curRating} applied={auto.applied[photo.id]} mayRate={autoMayRate(photo)} onAccept={() => rate(photo, curSug.stars, { byAuto: true })}
                subject={!!auto.measured[photo.id]?.subject} onShowSubject={setShowSubject} />}
              <Stars value={curRating} onRate={(r) => rate(photo, r)} keys={keys} />
            </div>
          </Stage>
          <Filmstrip photos={photos} index={index} meta={meta} suggestions={suggestions} onSelect={go} requestMeta={requestMeta} />
        </>
      ) : (
        <div className="hero-empty">
          <h2>{list?.loading ? 'Reading folder…' : allPhotos.length ? `No ${filterName(filter)} photos` : 'No photos in this folder'}</h2>
          {!list?.loading && (allPhotos.length
            ? <button className="btn" onClick={() => setFilter('all')}>Show all {allPhotos.length} photos</button>
            : <p className="muted">Flightroom shows NEF, other RAW files and JPEGs. Pick another folder to start culling.</p>)}
        </div>
      )}
      {toast && <div className="cull-toast">{toast}</div>}
      {exporting && <Suspense fallback={null}><ExportModal photo={photo} photos={allPhotos} shown={filter === 'rejects' ? allPhotos : photos} meta={meta} folder={list.folder}
        onClose={() => setExporting(false)} onDone={(msg) => { setExporting(false); setToast(msg); }} /></Suspense>}
      {autoOpen && (
        <AutoRatePanel photos={allPhotos} measuredCount={measuredCount} suggestions={suggestions} run={autoRun}
          applicable={allPhotos.filter((p) => suggestions[p.id] && autoMayRate(p) && photoRating(p, meta[p.id]) !== suggestions[p.id].stars).length}
          handRated={allPhotos.filter((p) => !autoMayRate(p)).length}
          onAnalyze={analyze} onApply={applyAll} onCancel={() => { autoCancel.current = true; }}
          onReview={() => { setFilter('rejects'); setAutoOpen(false); }}
          onReset={() => { const next = { measured: {}, applied: auto.applied }; setAuto(next); saveAnalysis(list.folder, next); }}
          onClose={() => setAutoOpen(false)} />
      )}
    </div>
  );
}

const splitPath = (p) => {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i < 0 ? { parent: '', name: p } : { parent: p.slice(0, i) || p.slice(0, 1), name: p.slice(i + 1) };
};

const ago = (at) => {
  if (!at) return '';
  const d = Math.round((Date.now() - at) / 86400000);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

// Culling home: every folder you've opened, grouped under its parent folder like
// a tree. The parent's other subfolders are listed too, dimmed, one click to open.
function FolderHome({ state, actions, bridge, onPick, error }) {
  const opened = state.cull?.recent || [];
  const stats = state.cull?.stats || {};
  const parents = [];
  for (const f of opened) {
    const { parent } = splitPath(f);
    if (!parents.includes(parent)) parents.push(parent);
  }
  return (
    <div className="view narrow folder-home">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Culling</div>
          <h1>Your folders</h1>
          <p className="muted">Arrow keys move between photos and number keys set stars. Stars are saved next to each photo where Lightroom can read them.</p>
        </div>
        <button className="btn btn-primary" onClick={onPick}><Icon name="folder" size={16} />Open a folder</button>
      </header>
      {error && <div className="note-box warn-box">{error} could not be opened. It may have been moved, renamed, or be on a drive that is not plugged in.</div>}
      {parents.length === 0 ? (
        <div className="hero-empty">
          <div className="hero-icon"><Icon name="photo" size={40} /></div>
          <h2>Cull a shoot</h2>
          <p className="muted">Open a folder of NEF or JPEG files. It will be listed here next time, together with the folders next to it.</p>
        </div>
      ) : parents.map((parent) => (
        <FolderTree key={parent} parent={parent} opened={opened.filter((f) => splitPath(f).parent === parent)}
          stats={stats} bridge={bridge} onOpen={actions.setCullFolder} onForget={actions.forgetCullFolder} />
      ))}
      <p className="muted small">Tip: for a OneDrive folder, right-click it and choose "Always keep on this device" first. Otherwise each photo downloads the first time you view it.</p>
    </div>
  );
}

function FolderTree({ parent, opened, stats, bridge, onOpen, onForget }) {
  const [siblings, setSiblings] = useState(null);
  useEffect(() => { bridge.listDirs(parent).then((r) => setSiblings(r.error ? [] : r.names)); }, [parent]);
  const openedNames = opened.map((f) => splitPath(f).name);
  const sep = parent.includes('\\') ? '\\' : '/';
  const join = (name) => (parent.endsWith(sep) ? parent + name : parent + sep + name);
  // Opened folders that no longer exist on disk still show, so they can be forgotten.
  const names = [...new Set([...(siblings || []), ...openedNames])]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return (
    <section className="tree">
      <div className="tree-parent" title={parent}>
        <Icon name="folder" size={16} /><span className="tree-parent-name">{splitPath(parent).name || parent}</span>
        <span className="tree-parent-path grow">{splitPath(parent).parent}</span>
        <button className="btn btn-sm btn-ghost tree-forget-all" title="Take this group off the list (nothing on disk is changed)"
          onClick={() => opened.forEach(onForget)}><Icon name="x" size={12} />Remove</button>
      </div>
      <div className="tree-children">
        {names.map((name) => {
          const full = join(name);
          const isOpened = openedNames.includes(name);
          const missing = siblings && !siblings.includes(name);
          const st = stats[opened.find((f) => splitPath(f).name === name)];
          return isOpened ? (
            <div key={name} className={`tree-item opened${missing ? ' missing' : ''}`}>
              <button className="tree-open" onClick={() => onOpen(opened.find((f) => splitPath(f).name === name))} disabled={missing}>
                <Icon name="photo" size={16} />
                <span className="grow">
                  <span className="tree-name">{name}</span>
                  <span className="tree-sub">{missing ? 'Folder not found' : st ? `${st.photos} photos · ${st.rated} rated · ${ago(st.at)}` : 'Opened before'}</span>
                </span>
                {st?.photos > 0 && <span className="tree-progress" title={`${Math.round((st.rated / st.photos) * 100)}% rated`}><span style={{ width: `${(st.rated / st.photos) * 100}%` }} /></span>}
              </button>
              <button className="icon-btn tiny tree-forget" title="Remove from this list (nothing on disk is changed)" onClick={() => onForget(opened.find((f) => splitPath(f).name === name))}><Icon name="x" size={12} /></button>
            </div>
          ) : (
            <div key={name} className="tree-item other">
              <button className="tree-open" onClick={() => onOpen(full)}><span className="tree-name">{name}</span></button>
            </div>
          );
        })}
        {!siblings && <div className="tree-item other"><span className="tree-sub">Loading…</span></div>}
      </div>
    </section>
  );
}

// The auto-rate suggestion for the photo on screen, above the stars.
function Suggestion({ sug, rating, applied, mayRate, onAccept, subject, onShowSubject }) {
  const stars = '★'.repeat(sug.stars);
  const reason = sug.reasons[0];
  let label, action = null;
  if (applied != null && applied === rating) label = <>Auto-rated <b>{stars}</b></>;
  else if (rating === sug.stars) label = <>Matches the suggestion <b>{stars}</b></>;
  else if (!mayRate) label = <>Suggested <b>{stars}</b> · you rated it yourself</>;
  else {
    label = <>Suggested <b>{stars}</b>{sug.stars === 1 ? ' · likely reject' : ''}</>;
    action = <button className="btn btn-sm" onClick={onAccept} onMouseDown={(e) => e.preventDefault()}>Accept <kbd>Enter</kbd></button>;
  }
  return (
    <div className={`suggestion${sug.stars === 1 ? ' reject' : ''}`} onMouseEnter={() => onShowSubject(true)} onMouseLeave={() => onShowSubject(false)}>
      <span className="suggestion-text"><span>{label}</span><span className="suggestion-why">{reason}{sug.reasons.length > 1 ? ` · ${sug.reasons.slice(1).join(' · ')}` : ''}</span></span>
      {subject && <span className="suggestion-subject" title="Focus was checked on this part of the photo">Subject</span>}
      {action}
    </div>
  );
}

function AutoRatePanel({ photos, measuredCount, suggestions, run, applicable, handRated, onAnalyze, onApply, onCancel, onReview, onReset, onClose }) {
  const total = photos.length;
  const left = total - measuredCount;
  const counts = [4, 3, 2, 1].map((n) => [n, Object.values(suggestions).filter((s) => s.stars === n).length]);
  const soft = Object.values(suggestions).filter((s) => s.soft).length;
  const dups = Object.values(suggestions).filter((s) => s.duplicate).length;
  const bursts = new Set(Object.values(suggestions).filter((s) => s.groupSize > 1).map((s) => s.group)).size;
  const max = Math.max(1, ...counts.map(([, c]) => c));
  return (
    <Modal title="Auto-rate" onClose={onClose} footer={run
      ? <button className="btn" onClick={onCancel}>Stop</button>
      : <>
          {measuredCount > 0 && <button className="btn btn-ghost" onClick={onReset}>Start over</button>}
          {left > 0 && <button className={`btn${measuredCount ? '' : ' btn-primary'}`} onClick={onAnalyze}>Analyze {left === total ? `${total} photos` : `${left} new photos`}</button>}
          {measuredCount > 0 && <button className="btn" onClick={onReview}>Review likely rejects</button>}
          {measuredCount > 0 && <button className="btn btn-primary" disabled={!applicable} onClick={onApply}>Rate {applicable} photos</button>}
        </>}>
      {run ? (
        <div className="auto-progress">
          <div className="small">{run.kind === 'apply' ? 'Saving ratings' : 'Looking at photos'}… {run.done} of {run.total}</div>
          <div className="tree-progress wide"><span style={{ width: `${(run.done / Math.max(1, run.total)) * 100}%` }} /></div>
          <p className="muted small">You can close this window; it keeps going.</p>
        </div>
      ) : measuredCount === 0 ? (
        <>
          <p>Flightroom looks at each photo's built-in preview and suggests stars:</p>
          <ul className="auto-list">
            <li><b>Subject:</b> a small AI model finds what the photo is of (a kart, car, bike, person, animal) and focus is judged on that. Hover a suggestion to see what it picked.</li>
            <li><b>Sharpness:</b> missed focus and motion blur on the subject, checked on the full-size preview, as you'd see it zoomed in. A blurred background is fine. Without a clear subject, the middle of the frame counts.</li>
            <li><b>Exposure:</b> blown highlights, crushed shadows, very dark or bright frames.</li>
            <li><b>Bursts:</b> similar shots taken seconds apart. The best one keeps its stars, and the rest get one star less.</li>
          </ul>
          <p className="muted small">Nothing is changed until you accept. Photos you've rated yourself are never changed. Everything runs on this PC. In a OneDrive folder, photos stored only online download as they're analyzed.</p>
        </>
      ) : (
        <>
          <p className="small">{measuredCount} of {total} photos analyzed{left ? ` (${left} not yet)` : ''}. Found {soft} soft or blurry and {dups} extra shots in {bursts} bursts.</p>
          <div className="auto-bars">
            {counts.map(([n, c]) => (
              <div key={n} className="auto-bar-row">
                <span className={`auto-bar-label${n === 1 ? ' reject' : ''}`}>{'★'.repeat(n)}{n === 1 ? ' reject?' : ''}</span>
                <span className="auto-bar"><span style={{ width: `${(c / max) * 100}%` }} className={n === 1 ? 'reject' : ''} /></span>
                <span className="auto-bar-count">{c}</span>
              </div>
            ))}
          </div>
          <p className="muted small">★★★★ goes to the best third of the sharp keepers, ★★★ to most of the rest and ★★ to the weakest. Photos a little soft at full size get at most ★★★, soft ones ★★. Five stars are left for you to give. {handRated ? `${handRated} photos you rated yourself won't be touched.` : ''} Press Enter on a photo to accept just that suggestion.</p>
        </>
      )}
    </Modal>
  );
}

const fmtShutter = (t) => (!t ? null : t >= 1 ? `${+t.toFixed(1)}s` : `1/${Math.round(1 / t)}`);

function ShotInfo({ meta }) {
  if (!meta || meta.error) return null;
  const parts = [
    meta.focalLength && `${Math.round(meta.focalLength)}mm`,
    fmtShutter(meta.exposure),
    meta.fNumber && `f/${+meta.fNumber.toFixed(1)}`,
    meta.iso && `ISO ${meta.iso}`,
    meta.lens,
    meta.takenAt && meta.takenAt.replace(/^(\d+):(\d+):(\d+) (\d+:\d+):\d+$/, '$1-$2-$3 $4'),
  ].filter(Boolean);
  return <span className="stage-info">{parts.join('  ·  ')}</span>;
}

function Stars({ value, onRate, keys }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={`star${n <= shown ? ' on' : ''}`} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n === value ? 0 : n)} title={`${n} star${n > 1 ? 's' : ''} (key ${keyLabel(keys[n])})`}>★</button>
      ))}
      <span className="stars-hint">{value ? `${value} of 5` : `Press ${keyLabel(keys[1])}–${keyLabel(keys[5])} to rate`}</span>
    </div>
  );
}

// The big photo. Shows the small preview instantly, swaps in the sharp one as soon
// as it's decoded, and loads the full-resolution preview only when zoomed in.
function Stage({ photo, meta, photos, index, metaById, zoom, setZoom, scale, subject, children }) {
  const wrapRef = useRef();
  const canvasRef = useRef();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [layers, setLayers] = useState({ id: null });
  const drag = useRef(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Current photo first, then its neighbours in the background.
  useEffect(() => {
    let live = true;
    const put = (kind) => (bmp) => { if (live) setLayers((l) => (l.id === photo.id ? { ...l, [kind]: bmp } : { id: photo.id, [kind]: bmp })); };
    setLayers((l) => (l.id === photo.id ? l : { id: photo.id }));
    const keep = new Set([`thumb:${photo.id}`, `fit:${photo.id}`, `full:${photo.id}`]);
    loadThumb(photo).then(put('thumb'), () => {});
    const fit = meta ? loadFit(photo, meta) : null;
    fit?.then(put('fit'), () => {});
    if (zoom) loadFull(photo).then(put('full'), () => {});
    if (fit) {
      fit.catch(() => {}).finally(() => {
        if (!live) return;
        for (const d of AHEAD) {
          const p = photos[index + d];
          if (!p) continue;
          keep.add(`fit:${p.id}`).add(`thumb:${p.id}`);
          loadThumb(p).catch(() => {});
          if (metaById[p.id]) loadFit(p, metaById[p.id]).catch(() => {});
        }
        prune(keep);
      });
    }
    return () => { live = false; };
  }, [photo.id, !!meta, !!zoom]);

  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(size.w * dpr);
  const H = Math.round(size.h * dpr);
  const bmp = layers.id === photo.id ? (zoom && layers.full) || layers.fit || layers.thumb : null;

  // Turn a "zoom to centre" request into real coordinates once the size is known.
  const view = useMemo(() => {
    if (!zoom) return null;
    if (zoom.center) {
      const g = geometry(W, H, bmp, meta, null);
      return { zoom: true, scale, cx: g.ow / 2, cy: g.oh / 2 };
    }
    return { zoom: true, scale, cx: zoom.cx, cy: zoom.cy };
  }, [zoom, scale, W, H, meta, !!bmp]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !W || !H) return;
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    drawPhoto(c.getContext('2d'), W, H, bmp, meta, view);
  }, [bmp, W, H, meta, view]);

  // Zoom so the spot under the pointer stays under the pointer.
  const zoomAt = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * dpr - W / 2;
    const py = (e.clientY - r.top) * dpr - H / 2;
    const g = geometry(W, H, bmp, meta, null);
    const x = px / g.s + g.cx;
    const y = py / g.s + g.cy;
    return { cx: x - px / scale, cy: y - py / scale };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || !bmp) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, start: view };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved && d.start) {
      const g = geometry(W, H, bmp, meta, d.start);
      setZoom({ cx: g.cx - (dx * dpr) / g.s, cy: g.cy - (dy * dpr) / g.s });
    }
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    if (zoom) setZoom(null);
    else setZoom(zoomAt(e));
  };

  return (
    <div className={`stage${zoom ? ' zoomed' : ''}`} ref={wrapRef}>
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      {!bmp && <div className="stage-loading">Loading preview…</div>}
      {subject && bmp && <SubjectBox box={subject} g={geometry(W, H, bmp, meta, view)} W={W} H={H} dpr={dpr} />}
      {children}
    </div>
  );
}

// Outline of the subject auto-rating found (box in fractions of the upright photo).
function SubjectBox({ box, g, W, H, dpr }) {
  const x = (W / 2 + (box.x * g.ow - g.cx) * g.s) / dpr;
  const y = (H / 2 + (box.y * g.oh - g.cy) * g.s) / dpr;
  return <div className="subject-box" style={{ left: x, top: y, width: (box.w * g.ow * g.s) / dpr, height: (box.h * g.oh * g.s) / dpr }} />;
}

// Strip of thumbnails along the bottom. Only the cells on screen exist, so a
// folder of thousands of photos scrolls as smoothly as a folder of ten.
const CELL = 96;

// The filmstrip with its hide/show handle (F6).
export function Filmstrip(props) {
  const { strip } = useLayout();
  return (
    <div className={`strip-wrap${strip ? '' : ' closed'}`}>
      <PanelHandle side="bottom" open={strip} onClick={() => toggle('strip')} title={`${strip ? 'Hide' : 'Show'} filmstrip (F6)`} />
      {strip && <FilmstripRow {...props} />}
    </div>
  );
}

// `picked`: ids selected along with the current photo (Develop's Ctrl/Shift+click); onSelect gets the click.
function FilmstripRow({ photos, index, meta, suggestions, onSelect, requestMeta, picked }) {
  const ref = useRef();
  const [scroll, setScroll] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => setScroll({ left: el.scrollLeft, width: el.clientWidth });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the current photo in view.
  useLayoutEffect(() => {
    const el = ref.current;
    const x = index * CELL;
    if (x < el.scrollLeft + CELL || x > el.scrollLeft + el.clientWidth - 2 * CELL) {
      el.scrollLeft = Math.max(0, x - el.clientWidth / 2 + CELL / 2);
    }
  }, [index]);

  const first = Math.max(0, Math.floor(scroll.left / CELL) - 4);
  const last = Math.min(photos.length, Math.ceil((scroll.left + scroll.width) / CELL) + 4);
  const visible = photos.slice(first, last);

  useEffect(() => { requestMeta(visible.map((p) => p.id)); }, [first, last, photos]);

  const onWheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) ref.current.scrollLeft += e.deltaY; };

  return (
    <div className="filmstrip" ref={ref} onScroll={(e) => setScroll({ left: e.currentTarget.scrollLeft, width: e.currentTarget.clientWidth })} onWheel={onWheel}>
      <div className="filmstrip-track" style={{ width: photos.length * CELL }}>
        {visible.map((p, i) => (
          <Thumb key={p.id} photo={p} meta={meta[p.id]} suggested={suggestions[p.id]?.stars} active={first + i === index} picked={picked?.has(p.id)} left={(first + i) * CELL} onClick={(e) => onSelect(first + i, e)} />
        ))}
      </div>
    </div>
  );
}

function Thumb({ photo, meta, suggested, active, picked, left, onClick }) {
  const [src, setSrc] = useState(() => imgUrl('thumb', photo.id));
  const rating = photoRating(photo, meta);
  const rot = ROTATION[meta?.orientation] || 0;
  const onError = () => { if (src.startsWith(FILES)) thumbFallbackUrl(photo).then(setSrc, () => {}); };
  return (
    <button className={`thumb${active ? ' active' : ''}${picked ? ' picked' : ''}`} style={{ left }} onClick={onClick} onMouseDown={(e) => e.preventDefault()} title={photo.name}>
      <img src={src} alt="" decoding="async" draggable={false} onError={onError} style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />
      {rating > 0 ? <span className="thumb-stars">{'★'.repeat(rating)}</span>
        : suggested > 0 && <span className="thumb-stars ghost" title="Suggested by auto-rate">{'☆'.repeat(suggested)}</span>}
    </button>
  );
}
