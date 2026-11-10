import { bridge as app, FILES } from '../bridge.js';
import { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, Icon, Modal, PanelHandle } from './ui.jsx';
import { toggle, useLayout } from '../layout.js';
import { clearPreviews, decodeThumb, drawPhoto, fallbackShown, fitEdge, fitKept, fitKey, fullKey, geometry, imgUrl, loadFit, loadFull, loadThumb, prune, releaseFull, ROTATION, thumbFallbackUrl, thumbKey } from '../cull/previews.js';
import { loadAnalysis, measure, saveAnalysis, suggest, upright } from '../cull/analyze.js';
import { Cancelled, measurePool } from '../cull/measure-pool.js';
import { inFilter, STAR_FILTERS } from '../cull/filter.js';
import { SUBJECT_GROUPS, bySubject, subjectCounts, subjectGroup, subjectName } from '../cull/subjects.js';
import { cachedFolder, setWithSubfolders, startAt, useFolder, usePosition, useStripPick, withSubfolders } from '../cull/folder.js';
import { useDevelopedThumb } from '../develop/thumbs.js';
import { useExported } from '../develop/exported.js';
import { confirmAction, fileItems, openMenu, photoLabel, ratingMenu } from './menu.jsx';
import { ORDERS, filesOf, inOrder, saveOrder, savedOrder } from '../cull/order.js';
import { copyActions } from '../cull/copies.js';
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

const AHEAD = [1, 2, -1, 3, -2]; // neighbours decoded in advance, in this order (as many as fitKept allows)
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
  const [currentId, setCurrentId] = useState(() => seen?.list.photos[state.cull?.positions?.[seen.list.folder] || 0]?.id ?? null);
  const [filter, setFilter] = useState(seen?.filter || 'all'); // see inFilter
  const [subjectView, setSubjectView] = useState('all'); // see bySubject
  const [order, setOrder] = useState(savedOrder); // see ORDERS
  const [zoom, setZoom] = useState(null); // null | { cx, cy }
  const [toast, setToast] = useState('');
  const [subs, setSubs] = useState(withSubfolders);
  // Auto-rating: saved measurements and which stars it wrote, the run in progress,
  // and whether its panel is open.
  const [auto, setAuto] = useState(() => (seen ? loadAnalysis(seen.list.folder) : { measured: {}, applied: {} }));
  const [autoRun, setAutoRun] = useState(null); // { kind: 'analyze' | 'apply', done, total }
  const [autoOpen, setAutoOpen] = useState(false);
  const [showSubject, setShowSubject] = useState(false); // while the pointer is on the suggestion
  const [exporting, setExporting] = useState(false);
  const autoCancel = useRef(false);
  const autoPool = useRef(null);
  const lastIndex = useRef(0);
  // A folder read anew starts where you left it, showing every photo.
  const { list, setList, meta, setMeta, open, requestMeta } = useFolder(bridge, folder, seen, filter, (res) => {
    const pos = startAt(res, state.cull?.positions);
    lastIndex.current = pos;
    setCurrentId(res.photos[pos]?.id ?? null);
    setFilter('all');
    setSubjectView('all');
    setAuto(loadAnalysis(res.folder));
  });

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
    const shown = filter === 'all' ? allPhotos
      : filter === 'rejects' ? allPhotos.filter((p) => suggestions[p.id]?.stars === 1)
        : allPhotos.filter((p) => inFilter(filter, photoRating(p, meta[p.id])));
    return bySubject(inOrder(shown, order, meta), subjectView, auto.measured);
  }, [allPhotos, meta, filter, suggestions, subjectView, auto.measured, order]);
  // By date: the camera's own time is read for every photo (a few hundred at a time), so the order settles.
  const byDate = order === 'oldest' || order === 'newest';
  useEffect(() => {
    if (!byDate) return;
    for (let i = 0; i < allPhotos.length; i += 200) requestMeta(allPhotos.slice(i, i + 200).map((p) => p.id));
  }, [byDate, allPhotos]);
  // Sorted by subject: where each group starts in the filmstrip.
  const groupStarts = useMemo(() => {
    if (subjectView !== 'sort') return null;
    const starts = new Map();
    let prev = null;
    for (const p of photos) {
      const g = subjectGroup(auto.measured[p.id]);
      if (g !== prev) starts.set(p.id, subjectName(g));
      prev = g;
    }
    return starts;
  }, [photos, subjectView]);
  const starOptions = useMemo(() => STAR_FILTERS.map(([k, label]) => ({ value: k, label, hint: allPhotos.filter((p) => inFilter(k, photoRating(p, meta[p.id]))).length })), [allPhotos, meta]);
  // The current photo is tracked by id so it stays put when the filter changes.
  // If it drops out of the filter (say, rated while showing Unrated), the photo
  // that slid into its place becomes current.
  let index = photos.findIndex((p) => p.id === currentId);
  if (index < 0) index = Math.min(lastIndex.current, photos.length - 1);
  if (index >= 0) lastIndex.current = index;
  const photo = photos[index];
  useEffect(() => { if (photo && photo.id !== currentId) setCurrentId(photo.id); }, [photo?.id]);

  const pick = async () => {
    const dir = await bridge.pickFolder();
    if (dir) {
      if (dir === folder) open(dir);
      else actions.setCullFolder(dir);
    }
  };

  usePosition(actions, list?.folder, allPhotos.findIndex((p) => p.id === photo?.id));
  useEffect(() => clearPreviews, []);

  // Auto-rate keeps going with its panel closed, but not after leaving Culling:
  // the run stops at once, and what it finished is saved for its folder.
  const shownFolder = useRef(null);
  shownFolder.current = list?.folder ?? null;
  useEffect(() => () => {
    shownFolder.current = null;
    autoCancel.current = true;
    autoPool.current?.close();
  }, []);
  const stopAuto = () => { autoCancel.current = true; autoPool.current?.close(); };
  // A change to a folder's analysis: saved, and shown if that folder is still the one open here.
  const storeAnalysis = (dir, change) => {
    if (shownFolder.current === dir) setAuto((a) => { const next = change(a); saveAnalysis(dir, next); return next; });
    else saveAnalysis(dir, change(loadAnalysis(dir)));
  };

  // Photo and rated counts for the folder list.
  const ratedCount = allPhotos.filter(isRated).length;
  useEffect(() => {
    if (!list?.folder || list.loading) return;
    const t = setTimeout(() => actions.setCullStats(list.folder, { photos: allPhotos.length, rated: ratedCount }), 600);
    return () => clearTimeout(t);
  }, [list, ratedCount]);

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

  // Photos selected along with the current one (Ctrl/Shift+click in the
  // filmstrip, Ctrl+A): ratings and Export apply to all of them.
  const { picked, setPicked, selectInStrip } = useStripPick(photos, index, go, list?.folder);

  const rememberApplied = (id, stars) => setAuto((a) => {
    // Rating a photo auto-rate never rated changes nothing here: nothing to save or redraw.
    if (stars == null && !(id in a.applied)) return a;
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
    return !res?.error;
  }, [bridge, list?.folder]);
  // Rates the current photo, or every selected photo when there's a selection.
  const ratePicked = useCallback(async (rating) => {
    const many = picked.size > 1 ? allPhotos.filter((p) => picked.has(p.id)) : null;
    if (!many) return rate(photo, rating);
    const ok = await Promise.all(many.map((p) => rate(p, rating)));
    const n = ok.filter(Boolean).length;
    setToast(`${rating ? '★'.repeat(rating) + ' saved to' : 'Rating cleared on'} ${n} photos${n < many.length ? `, ${many.length - n} could not be saved` : ''}`);
    return true;
  }, [picked, allPhotos, photo, rate]);

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
    autoPool.current = pool;
    try {
      // Photos stream through the workers a few at a time; metadata is read in batches.
      const BATCH = pool.size * 6;
      for (let i = 0; i < todo.length && !autoCancel.current; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const m = await bridge.meta(batch.map((p) => p.id));
        if (!m.error) setMeta((old) => ({ ...old, ...m }));
        await Promise.all(batch.map(async (p) => {
          const orientation = m[p.id]?.orientation;
          if (autoCancel.current) return;
          try {
            const full = m[p.id]?.width && { url: new URL(imgUrl('gray', p.id), location.href).href, width: m[p.id].width, height: m[p.id].height };
            measured[p.id] = { ...(await pool.measure(await decodeThumb(p), orientation, full)), takenAt: m[p.id]?.takenAt };
          } catch (err) {
            if (err instanceof Cancelled || autoCancel.current) return; // stopped: measured next time
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
        // Shown as they come in (sorting by subject fills up), saved when the run ends.
        if (shownFolder.current === dir) setAuto((a) => ({ ...a, measured: { ...a.measured, ...measured } }));
      }
    } finally {
      pool.close(); // each worker holds its own detector, so they never outlive a run
      if (autoPool.current === pool) autoPool.current = null;
    }
    console.log(`[auto-rate] measured ${todo.length} photos in ${Math.round(performance.now() - started)} ms`);
    storeAnalysis(dir, (a) => ({ ...a, measured: { ...a.measured, ...measured } }));
    setAutoRun(null);
  };

  // Writes every suggestion to photos you haven't rated yourself.
  const applyAll = async () => {
    const dir = list.folder;
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
    storeAnalysis(dir, (a) => ({ ...a, applied: { ...a.applied, ...written } }));
    setAutoRun(null);
    setToast(`Rated ${Object.keys(written).length} photos${failed ? `, ${failed} could not be saved` : ''}`);
  };

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Delete: the photos' files go to the Recycle Bin, after asking. A virtual copy only loses its own sidecar.
  const askDelete = (targets) => {
    targets = targets.filter(Boolean);
    if (!targets.length || autoRun) return;
    const n = targets.length, files = filesOf(targets, allPhotos);
    const onlyCopies = targets.every((p) => p.copy);
    confirmAction({
      title: n === 1 ? `Delete ${photoLabel(targets[0])}?` : `Delete ${n} photos?`, ok: 'Move to Recycle Bin',
      text: onlyCopies ? 'The virtual copy and its own edits and stars go to the Recycle Bin. The photo itself stays.'
        : `${n === 1 ? 'Its' : 'Their'} files (RAW, JPEG, and the edits and stars saved next to them) go to the Recycle Bin, where you can restore them.`,
      onOk: async () => {
        const res = await bridge.trash(files);
        if (res?.error) { setToast(`Couldn't delete: ${res.error}`); return; }
        // A photo's virtual copies go with it.
        const raws = new Set(targets.filter((p) => !p.copy && p.raw).map((p) => p.raw));
        const gone = new Set(allPhotos.filter((p) => targets.includes(p) || (p.copy && raws.has(p.raw))).map((p) => p.id));
        setList((l) => (l?.photos ? { ...l, photos: l.photos.filter((p) => !gone.has(p.id)) } : l));
        setPicked(new Set());
        storeAnalysis(list.folder, (a) => {
          const measured = { ...a.measured }, applied = { ...a.applied };
          for (const id of gone) { delete measured[id]; delete applied[id]; }
          return { ...a, measured, applied };
        });
        setToast(`${gone.size === 1 ? photoLabel(targets[0]) : `${gone.size} photos`} moved to the Recycle Bin`);
      },
    });
  };
  const pickedPhotos = () => (picked.size > 1 ? allPhotos.filter((p) => picked.has(p.id)) : null);

  // Clear ratings: every star on the selected photos, or on all the photos shown.
  const askClearRatings = () => {
    const targets = (pickedPhotos() || photos).filter((p) => photoRating(p, meta[p.id]) > 0);
    if (!targets.length) { setToast('No ratings to clear here'); return; }
    confirmAction({
      title: `Clear the ratings of ${targets.length} ${targets.length === 1 ? 'photo' : 'photos'}?`, ok: 'Clear ratings',
      text: `${picked.size > 1 ? 'The selected photos' : filter === 'all' && subjectView === 'all' ? 'Every photo in this folder' : 'The photos shown'} go back to no stars. Edits are kept.`,
      onOk: async () => {
        const cleared = new Set();
        for (let i = 0; i < targets.length; i += 8) {
          await Promise.all(targets.slice(i, i + 8).map(async (p) => { if (!(await bridge.rate(p, 0))?.error) cleared.add(p.id); }));
        }
        setList((l) => (l?.photos ? { ...l, photos: l.photos.map((x) => (cleared.has(x.id) ? { ...x, rating: 0 } : x)) } : l));
        storeAnalysis(list.folder, (a) => {
          const applied = { ...a.applied };
          for (const id of cleared) delete applied[id];
          return { ...a, applied };
        });
        setToast(`Ratings cleared on ${cleared.size} photos${cleared.size < targets.length ? `, ${targets.length - cleared.size} could not be saved` : ''}`);
      },
    });
  };

  // Virtual copies (Ctrl+' as in Lightroom).
  const copies = copyActions({ cull: bridge, setList, toast: setToast, show: (c) => setCurrentId(c.id) });

  // Right-click on a photo (the big one or the filmstrip), as in Lightroom. A
  // photo outside the selection becomes the current one first.
  const photoMenu = (e, p, i) => {
    if (!p) return;
    const inPick = picked.size > 1 && picked.has(p.id);
    if (!inPick && p.id !== photo?.id) selectInStrip(i);
    const many = inPick ? picked.size : 0;
    const sug = suggestions[p.id];
    openMenu(e, [
      { heading: many ? `${many} photos selected` : photoLabel(p) },
      onDevelop && { label: 'Open in Develop', icon: 'develop', hint: 'D', onClick: () => { setCurrentId(p.id); setTimeout(onDevelop); } },
      '-',
      ratingMenu(many ? undefined : photoRating(p, meta[p.id]), (r) => (many ? ratePicked(r) : rate(p, r)), keys),
      sug && autoMayRate(p) && !many && { label: `Accept suggestion (${'★'.repeat(sug.stars)})`, icon: 'spark', hint: 'Enter', onClick: () => rate(p, sug.stars, { byAuto: true }) },
      '-',
      !many && { label: 'Create virtual copy', icon: 'copy', hint: "Ctrl+'", disabled: !p.raw, onClick: () => copies.make(p) },
      !many && p.copy && { label: 'Remove virtual copy…', icon: 'trash', danger: true, onClick: () => copies.askRemove(p) },
      !(p.copy && !many) && { label: many ? `Delete ${many} photos…` : 'Delete photo…', icon: 'trash', danger: true, hint: 'Del', disabled: !!autoRun, onClick: () => askDelete(many ? pickedPhotos() : [p]) },
      '-',
      { label: many ? `Export ${many} photos…` : 'Export…', icon: 'export', hint: 'Ctrl+Shift+E', onClick: () => setExporting(true) },
      { label: 'Select all', hint: 'Ctrl+A', onClick: () => setPicked(new Set(photos.map((x) => x.id))) },
      picked.size > 0 && { label: 'Clear selection', hint: 'Esc', onClick: () => setPicked(new Set()) },
      '-',
      !many && fileItems(p, app.reveal)[0],
      !many && fileItems(p, app.reveal)[1],
    ]);
  };

  // Keyboard: arrows move, Home/End jump; rating and zoom keys come from Settings.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable], .overlay') || exporting) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "'" && photo && !autoOpen) { e.preventDefault(); copies.make(photo); return; }
      // Ctrl+Shift+E: Export, as in Lightroom.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e' && allPhotos.length && !autoOpen) { e.preventDefault(); setExporting(true); return; }
      // Ctrl+A selects every photo shown, as in Lightroom; Esc ends the selection.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'a' && photos.length && !autoOpen) {
        e.preventDefault();
        setPicked(new Set(photos.map((p) => p.id)));
        setToast(`${photos.length} photos selected: ratings and Export apply to all of them (Esc to clear)`);
        return;
      }
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
          if (picked.size > 1) { ratePicked(r); return; }
          rate(photo, r);
          // A photo that leaves the current filter is replaced by the next one anyway.
          const stays = inFilter(filter, r);
          if (advance && stays) go(index + 1);
        }
        return;
      }
      if (e.key === 'Delete' && photo && !e.repeat) { e.preventDefault(); askDelete(pickedPhotos() || [photo]); return; }
      if (e.key.toLowerCase() === 'd' && onDevelop && photo) { e.preventDefault(); onDevelop(); return; }
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (moves[e.key]) { e.preventDefault(); go(index + moves[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(photos.length - 1); }
      else if (e.key === 'Escape') { if (picked.size) setPicked(new Set()); else setZoom(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos, photo, index, keys, zKey, advance, filter, go, rate, ratePicked, picked, autoOpen, suggestions, auto, exporting]);

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
  const subjectN = subjectCounts(allPhotos, auto.measured);
  const subjectOptions = [
    { value: 'all', label: 'All subjects', hint: allPhotos.length },
    { value: 'sort', label: 'Sort by subject' },
    ...SUBJECT_GROUPS.map(([k, label]) => ({ value: k, label: `Only ${label.toLowerCase()}`, hint: subjectN[k], disabled: !subjectN[k] && !subjectN.unknown })),
  ];
  // Grouping needs every photo's subject: picking a view finds the missing ones.
  const pickSubjectView = (v) => {
    setSubjectView(v);
    if (v !== 'all' && subjectN.unknown && !autoRun) analyze();
  };
  const finding = autoRun?.kind === 'analyze';
  // The less-used switches: the ⋯ button and a right-click on the bar.
  const barMenu = (e) => openMenu(e, [
    { label: 'Auto-advance after rating', checked: advance, onClick: () => actions.setCullSettings({ cullAdvance: !advance }) },
    { label: 'Include subfolders', checked: subs, onClick: () => { setWithSubfolders(!subs); setSubs(!subs); open(folder, true); } },
    '-',
    { heading: 'Sort by' },
    ...ORDERS.map(([k, label]) => ({ label, checked: order === k, onClick: () => { setOrder(k); saveOrder(k); } })),
    '-',
    { label: picked.size > 1 ? `Clear ratings of ${picked.size} selected…` : 'Clear ratings…', icon: 'x', disabled: !!autoRun, onClick: askClearRatings },
    { label: picked.size > 1 ? `Delete ${picked.size} selected…` : 'Delete this photo…', icon: 'trash', danger: true, disabled: !photo || !!autoRun, onClick: () => askDelete(pickedPhotos() || [photo]) },
    '-',
    { label: 'Reload folder', icon: 'refresh', onClick: () => open(folder, true) },
    { label: 'Back to folders', icon: 'back', onClick: () => actions.setCullFolder(null) },
  ]);

  return (
    <div className="cull">
      <header className="cull-bar" onContextMenu={(e) => !e.target.closest('button, .dd') && barMenu(e)}>
        <button className="icon-btn" onClick={() => actions.setCullFolder(null)} title="Back to your folders"><Icon name="back" size={16} /></button>
        <div className="grow cull-title">
          <div className="cull-folder" title={list?.folder || folder}>{(list?.folder || folder).split(/[\\/]/).pop()}</div>
          <div className="cull-sub">{list?.loading ? 'Reading folder…' : `${photos.length ? index + 1 : 0} of ${photos.length}`}</div>
        </div>
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
        <Dropdown className={`cull-subject ai-glow${subjectView !== 'all' ? ' on' : ''}${finding ? ' busy' : ''}`} value={subjectView}
          label={finding && subjectView !== 'all' ? `Finding subjects ${autoRun.done}/${autoRun.total}` : subjectView === 'all' ? 'Subject…' : undefined}
          onChange={pickSubjectView} title="Sort or show photos by what they're of (people, vehicles, animals…), found by AI on this computer"
          options={subjectOptions} />
        <span className="bar-gap" />
        {onDevelop && <button className="btn btn-sm" onClick={onDevelop} disabled={!photo} title="Edit this photo (D)"><Icon name="develop" size={14} />Develop</button>}
        <button className="btn btn-sm" onClick={() => setExporting(true)} disabled={!allPhotos.length} title="Export JPEGs of this photo, the rated ones or the ones shown (Ctrl+Shift+E)"><Icon name="export" size={14} />Export</button>
        <button className={`btn btn-sm ai-glow${measuredCount ? '' : ' btn-primary'}${autoRun ? ' busy' : ''}`} onClick={() => setAutoOpen(true)} disabled={!allPhotos.length}>
          <Icon name="spark" size={14} />
          {autoRun ? `${autoRun.kind === 'apply' ? 'Rating' : 'Analyzing'} ${autoRun.done}/${autoRun.total}` : 'Auto-rate'}
        </button>
        <button className="icon-btn" title="More options" onClick={barMenu}><Icon name="more" size={16} /></button>
      </header>

      {photo ? (
        <>
          <Stage photo={photo} meta={curMeta} photos={photos} index={index} metaById={meta} zoom={zoom} setZoom={setZoom} scale={zoomPct / 100} onMenu={(e) => photoMenu(e, photo, index)}
            subject={showSubject ? auto.measured[photo.id]?.subject?.box : null}>
            <div className="stage-top">
              <span className="stage-name">{photoLabel(photo)}{photo.raw && photo.jpeg && <span className="pill-mini">RAW+JPEG</span>}<ExportedTag id={photo.id} /></span>
              <ShotInfo meta={curMeta} />
              {subjectView !== 'all' && <span className="pill-mini">{subjectName(subjectGroup(auto.measured[photo.id]))}</span>}
              {zoom && <span className="pill-mini zoom">{zoomPct}%</span>}
            </div>
            <div className="stage-bottom">
              {curSug && <Suggestion sug={curSug} rating={curRating} applied={auto.applied[photo.id]} mayRate={autoMayRate(photo)} onAccept={() => rate(photo, curSug.stars, { byAuto: true })}
                subject={!!auto.measured[photo.id]?.subject} onShowSubject={setShowSubject} />}
              <Stars value={curRating} onRate={(r) => ratePicked(r)} keys={keys} />
            </div>
          </Stage>
          <Filmstrip photos={photos} index={index} meta={meta} suggestions={suggestions} groupStarts={groupStarts} onSelect={selectInStrip} requestMeta={requestMeta} picked={picked.size ? picked : null} onMenu={(e, i) => photoMenu(e, photos[i], i)} />
        </>
      ) : (
        <div className="hero-empty">
          <h2>{list?.loading ? 'Reading folder…' : allPhotos.length ? `No ${[filterName(filter), SUBJECT_GROUPS.find(([k]) => k === subjectView)?.[1].toLowerCase()].filter(Boolean).join(' ')} photos`.replace('No no clear subject', 'No photos without a clear subject') : 'No photos in this folder'}</h2>
          {!list?.loading && (allPhotos.length
            ? <button className="btn" onClick={() => { setFilter('all'); setSubjectView('all'); }}>Show all {allPhotos.length} photos</button>
            : <p className="muted">Flightroom shows NEF, other RAW files and JPEGs. Pick another folder to start culling.</p>)}
        </div>
      )}
      {toast && <div className="cull-toast">{toast}</div>}
      {exporting && <Suspense fallback={null}><ExportModal photo={photo} photos={allPhotos} shown={filter === 'rejects' ? allPhotos : photos} picked={picked.size ? picked : null} meta={meta} folder={list.folder}
        onClose={() => setExporting(false)} onDone={(msg) => { setExporting(false); setToast(msg); }} /></Suspense>}
      {autoOpen && (
        <AutoRatePanel photos={allPhotos} measuredCount={measuredCount} suggestions={suggestions} run={autoRun}
          applicable={allPhotos.filter((p) => suggestions[p.id] && autoMayRate(p) && photoRating(p, meta[p.id]) !== suggestions[p.id].stars).length}
          handRated={allPhotos.filter((p) => !autoMayRate(p)).length}
          onAnalyze={analyze} onApply={applyAll} onCancel={stopAuto}
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
            <div key={name} className={`tree-item opened${missing ? ' missing' : ''}`}
              onContextMenu={(e) => { const f = opened.find((x) => splitPath(x).name === name); openMenu(e, [
                { heading: name },
                !missing && { label: 'Open', icon: 'photo', onClick: () => onOpen(f) },
                !missing && { label: 'Show in Explorer', icon: 'folder', onClick: () => app.reveal(f) },
                { label: 'Copy folder path', icon: 'copy', onClick: () => navigator.clipboard?.writeText(f).catch(() => {}) },
                '-',
                { label: 'Remove from this list', icon: 'x', onClick: () => onForget(f) },
              ]); }}>
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
            <div key={name} className="tree-item other"
              onContextMenu={(e) => openMenu(e, [
                { heading: name },
                { label: 'Open', icon: 'photo', onClick: () => onOpen(full) },
                { label: 'Show in Explorer', icon: 'folder', onClick: () => app.reveal(full) },
                { label: 'Copy folder path', icon: 'copy', onClick: () => navigator.clipboard?.writeText(full).catch(() => {}) },
              ])}>
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
            <li><b>Sort by subject:</b> once analyzed, the Subject menu groups photos into people, vehicles, animals and the rest.</li>
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

// The size screen-sized previews are made at (screen size x display scale). It
// changes when the window moves to another screen or the scale is changed.
function useFitEdge() {
  const [edge, setEdge] = useState(fitEdge);
  useEffect(() => {
    let mq = null;
    const check = () => setEdge(fitEdge());
    const watch = () => {
      mq?.removeEventListener('change', onScale);
      mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq?.addEventListener('change', onScale);
    };
    const onScale = () => { watch(); check(); };
    watch();
    window.addEventListener('resize', check);
    return () => { mq?.removeEventListener('change', onScale); window.removeEventListener('resize', check); };
  }, []);
  return edge;
}

// After zooming out, the full-size picture (180 MB at 45 MP) is kept this long,
// so zooming back in soon after is instant, and then let go.
const FULL_LINGER_MS = 8000;

// The big photo. Shows the small preview instantly, swaps in the sharp one as soon
// as it's decoded, and loads the full-resolution preview only when zoomed in.
function Stage({ photo, meta, photos, index, metaById, zoom, setZoom, scale, subject, children, onMenu }) {
  const wrapRef = useRef();
  const canvasRef = useRef();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [layers, setLayers] = useState({ id: null });
  const drag = useRef(null);
  const edge = useFitEdge();

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
    // The full-size one is let go by the effect below, not here.
    const keep = new Set([thumbKey(photo.id), fitKey(photo.id, edge), fullKey(photo.id)]);
    loadThumb(photo).then(put('thumb'), () => {});
    const fit = meta ? loadFit(photo, meta) : null;
    fit?.then(put('fit'), () => {});
    if (zoom) loadFull(photo).then(put('full'), () => {});
    if (fit) {
      fit.catch(() => {}).finally(() => {
        if (!live) return;
        for (const d of AHEAD.slice(0, fitKept() - 1)) {
          const p = photos[index + d];
          if (!p) continue;
          keep.add(fitKey(p.id, edge)).add(thumbKey(p.id));
          loadThumb(p).catch(() => {});
          if (metaById[p.id]) loadFit(p, metaById[p.id]).catch(() => {});
        }
        prune(keep);
      });
    }
    return () => { live = false; };
  }, [photo.id, !!meta, !!zoom, edge]);

  useEffect(() => {
    if (zoom) return;
    const t = setTimeout(() => {
      // Out of the layers first, so a closed bitmap is never drawn; zooming in again loads a new one.
      setLayers((l) => (l.full ? { ...l, full: null } : l));
      releaseFull(photo.id);
    }, FULL_LINGER_MS);
    return () => clearTimeout(t);
  }, [photo.id, !!zoom]);

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
    <div className={`stage${zoom ? ' zoomed' : ''}`} ref={wrapRef} onContextMenu={onMenu}>
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
  // The row is drawn again only when what it shows changes (photos, the current
  // one, stars, the selection), not on every slider move or zoom drag of the
  // view around it: its clicks go through these, which always call the latest handlers.
  const latest = useRef(props);
  latest.current = props;
  const onSelect = useCallback((i, e) => latest.current.onSelect(i, e), []);
  const onMenu = useCallback((e, i) => latest.current.onMenu?.(e, i), []);
  const requestMeta = useCallback((ids) => latest.current.requestMeta(ids), []);
  const { photos, index, meta, suggestions, groupStarts, picked } = props;
  return (
    <div className={`strip-wrap${strip ? '' : ' closed'}`}>
      <PanelHandle side="bottom" open={strip} onClick={() => toggle('strip')} title={`${strip ? 'Hide' : 'Show'} filmstrip (F6)`} />
      {strip && <FilmstripRow photos={photos} index={index} meta={meta} suggestions={suggestions} groupStarts={groupStarts} picked={picked}
        onSelect={onSelect} requestMeta={requestMeta} onMenu={props.onMenu ? onMenu : undefined} />}
    </div>
  );
}

// `picked`: ids selected along with the current photo (Develop's Ctrl/Shift+click); onSelect gets the click,
// onMenu(event, index) a right-click.
const FilmstripRow = memo(function FilmstripRow({ photos, index, meta, suggestions, groupStarts, onSelect, requestMeta, picked, onMenu }) {
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
          <Thumb key={p.id} photo={p} meta={meta[p.id]} suggested={suggestions[p.id]?.stars} group={groupStarts?.get(p.id)} active={first + i === index} picked={picked?.has(p.id)} left={(first + i) * CELL} onClick={(e) => onSelect(first + i, e)} onMenu={onMenu && ((e) => onMenu(e, first + i))} />
        ))}
      </div>
    </div>
  );
});

function Thumb({ photo, meta, suggested, group, active, picked, left, onClick, onMenu }) {
  const [src, setSrc] = useState(() => imgUrl('thumb', photo.id));
  // Edited in Develop this session: the photo as developed (already upright and cropped).
  const session = useDevelopedThumb(photo.id);
  // Edited before: its developed thumbnail kept on disk, if there's one for its sidecar as it is.
  const [noStored, setNoStored] = useState(false);
  const stored = !session && photo.developed && !noStored ? app.cull.developedUrl(photo) : null;
  const developed = session || stored;
  const rating = photoRating(photo, meta);
  const exported = useExported(photo.id);
  const rot = developed ? 0 : ROTATION[meta?.orientation] || 0;
  const onError = () => {
    if (stored) setNoStored(true);
    else if (src.startsWith(FILES)) thumbFallbackUrl(photo).then(setSrc, () => {});
  };
  const onLoad = () => { if (!developed && !src.startsWith(FILES)) fallbackShown(photo); };
  return (
    <button className={`thumb${active ? ' active' : ''}${picked ? ' picked' : ''}`} style={{ left }} onClick={onClick} onContextMenu={onMenu} onMouseDown={(e) => e.preventDefault()}
      title={`${photo.copy ? `${photo.name}, virtual copy ${photo.copy}` : photo.name}${exported ? ' (exported)' : ''}`}>
      <img src={developed || src} alt="" decoding="async" draggable={false} onError={session ? undefined : onError} onLoad={onLoad} style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />
      {group && <span className="thumb-group">{group}</span>}
      {photo.copy && <span className="thumb-copy" title="Virtual copy">Copy {photo.copy}</span>}
      {exported && <span className="thumb-exported"><Icon name="check" size={10} /></span>}
      {rating > 0 ? <span className="thumb-stars">{'★'.repeat(rating)}</span>
        : suggested > 0 && <span className="thumb-stars ghost" title="Suggested by auto-rate">{'☆'.repeat(suggested)}</span>}
    </button>
  );
}

/** "Exported" while a photo is as it was exported (no edits since). */
export function ExportedTag({ id }) {
  return useExported(id) ? <span className="pill-mini exported" title="Exported, not edited since">Exported</span> : null;
}
