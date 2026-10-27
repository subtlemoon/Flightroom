import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { drawPhoto, geometry, imgUrl, loadFit, loadFull, loadThumb, prune, ROTATION, thumbFallbackUrl } from '../cull/previews.js';
import { RESERVED_KEYS, keyLabel, normKey, ratingForKey, ratingKeys, zoomKey, zoomLevel } from '../cull/keys.js';

// A photo in the culling view, as listed by the desktop side:
//   { id, name, raw, jpeg, sidecar, ratingIn: 'sidecar' | 'file', rating }
// `rating` is what the .xmp sidecar says (null if there is none); the rating stored
// inside the file arrives later with the photo's meta. Later features (exported,
// sent to client) add fields to this record rather than a new list.
export const photoRating = (p, meta) => p.rating ?? meta?.fileRating ?? 0;

const AHEAD = [1, 2, -1, 3, -2]; // neighbours decoded in advance, in this order
const META_WINDOW = 20; // only files near the current one are opened, so a OneDrive
                        // folder isn't downloaded all at once just by opening it

export function CullView({ store }) {
  const bridge = window.gearcheck?.cull;
  const { state, actions } = store;
  const keys = ratingKeys(state.settings);
  const advance = !!state.settings.cullAdvance;
  const zKey = zoomKey(state.settings);
  const zoomPct = zoomLevel(state.settings);
  const folder = state.cull?.folder;

  const [list, setList] = useState(null); // { folder, photos } | { error }
  const [currentId, setCurrentId] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'rated' | 'unrated'
  const [meta, setMeta] = useState({});
  const [zoom, setZoom] = useState(null); // null | { cx, cy }
  const [toast, setToast] = useState('');
  const pendingMeta = useRef(new Set());
  const positions = useRef();
  positions.current = state.cull?.positions || {};

  const allPhotos = list?.photos || [];
  const isRated = (p) => photoRating(p, meta[p.id]) > 0;
  const photos = useMemo(
    () => (filter === 'all' ? allPhotos : allPhotos.filter((p) => isRated(p) === (filter === 'rated'))),
    [allPhotos, meta, filter],
  );
  // The current photo is tracked by id so it stays put when the filter changes.
  // If it drops out of the filter (say, rated while showing Unrated), the photo
  // that slid into its place becomes current.
  const lastIndex = useRef(0);
  let index = photos.findIndex((p) => p.id === currentId);
  if (index < 0) index = Math.min(lastIndex.current, photos.length - 1);
  if (index >= 0) lastIndex.current = index;
  const photo = photos[index];
  useEffect(() => { if (photo && photo.id !== currentId) setCurrentId(photo.id); }, [photo?.id]);

  const open = useCallback(async (dir) => {
    if (!bridge || !dir) return;
    setList({ loading: true, folder: dir });
    const res = await bridge.scan(dir);
    if (res.error) { setList({ error: res.error, folder: dir }); return; }
    setMeta({});
    pendingMeta.current = new Set();
    const pos = Math.min(positions.current[res.folder] || 0, Math.max(0, res.photos.length - 1));
    lastIndex.current = pos;
    setCurrentId(res.photos[pos]?.id ?? null);
    setFilter('all');
    setList(res);
  }, [bridge]);

  useEffect(() => { if (folder) open(folder); }, [folder, open]);

  const pick = async () => {
    const dir = await bridge.pickFolder();
    if (dir) {
      if (dir === folder) open(dir);
      else actions.setCullFolder(dir);
    }
  };

  // Remember where you were in each folder.
  useEffect(() => {
    const pos = allPhotos.findIndex((p) => p.id === photo?.id);
    if (list?.folder && pos >= 0) {
      const t = setTimeout(() => actions.setCullPosition(list.folder, pos), 400);
      return () => clearTimeout(t);
    }
  }, [photo?.id, list?.folder]);

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
    bridge.meta(want).then((m) => { if (!m.error) setMeta((old) => ({ ...old, ...m })); });
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

  const rate = useCallback(async (p, rating) => {
    if (!p) return;
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
  }, [bridge]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Keyboard: arrows move, Home/End jump; rating and zoom keys come from Settings.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!photos.length) return;
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
          const stays = filter === 'all' || (r > 0) === (filter === 'rated');
          if (advance && stays) go(index + 1);
        }
        return;
      }
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (moves[e.key]) { e.preventDefault(); go(index + moves[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(photos.length - 1); }
      else if (e.key === 'Escape') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos, photo, index, keys, zKey, advance, filter, go, rate]);

  if (!bridge) {
    return <div className="view"><div className="hero-empty"><div className="hero-icon"><Icon name="photo" size={40} /></div><h2>Culling runs in the desktop app</h2><p className="muted">Open GearCheck on your PC to link a photo folder.</p></div></div>;
  }

  if (!folder || list?.error) {
    return <FolderHome state={state} actions={actions} bridge={bridge} onPick={pick} error={list?.error && folder} />;
  }

  const curMeta = photo && meta[photo.id];
  const curRating = photo ? photoRating(photo, curMeta) : 0;

  return (
    <div className="cull">
      <header className="cull-bar">
        <div className="grow cull-title">
          <div className="eyebrow">Culling</div>
          <div className="cull-folder" title={list?.folder || folder}>{(list?.folder || folder).split(/[\\/]/).pop()}</div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => actions.setCullFolder(null)} title="Back to your folders"><Icon name="back" size={14} />Folders</button>
        <div className="seg small cull-filter">
          {[['all', 'All', allPhotos.length], ['rated', '★ Rated', ratedCount], ['unrated', 'Unrated', allPhotos.length - ratedCount]].map(([k, label, n]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} onMouseDown={(e) => e.preventDefault()}>
              {label} <span className="seg-count">{n}</span>
            </button>
          ))}
        </div>
        <div className="cull-stats muted">
          {list?.loading ? 'Reading folder…' : `${photos.length ? index + 1 : 0} of ${photos.length}`}
        </div>
        <label className="toggle-row cull-advance" title="Go to the next photo after rating">
          <input type="checkbox" checked={advance} onChange={() => actions.setCullSettings({ cullAdvance: !advance })} />Auto-advance
        </label>
        <button className="btn btn-sm" onClick={() => open(folder)} title="Look for new files"><Icon name="refresh" size={14} />Reload</button>
      </header>

      {photo ? (
        <>
          <Stage photo={photo} meta={curMeta} photos={photos} index={index} metaById={meta} zoom={zoom} setZoom={setZoom} scale={zoomPct / 100}>
            <div className="stage-top">
              <span className="stage-name">{photo.name}{photo.raw && photo.jpeg && <span className="pill-mini">RAW+JPEG</span>}</span>
              <ShotInfo meta={curMeta} />
              {zoom && <span className="pill-mini zoom">{zoomPct}%</span>}
            </div>
            <div className="stage-bottom">
              <Stars value={curRating} onRate={(r) => rate(photo, r)} keys={keys} />
            </div>
          </Stage>
          <Filmstrip photos={photos} index={index} meta={meta} onSelect={go} requestMeta={requestMeta} />
        </>
      ) : (
        <div className="hero-empty">
          <h2>{list?.loading ? 'Reading folder…' : allPhotos.length ? `No ${filter} photos` : 'No photos in this folder'}</h2>
          {!list?.loading && (allPhotos.length
            ? <button className="btn" onClick={() => setFilter('all')}>Show all {allPhotos.length} photos</button>
            : <p className="muted">GearCheck shows NEF, other RAW files and JPEGs. Pick another folder to start culling.</p>)}
        </div>
      )}
      {toast && <div className="cull-toast">{toast}</div>}
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
        <span className="tree-parent-path">{splitPath(parent).parent}</span>
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
              <button className="icon-btn tiny tree-forget" title="Remove from this list" onClick={() => onForget(opened.find((f) => splitPath(f).name === name))}><Icon name="x" size={12} /></button>
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
function Stage({ photo, meta, photos, index, metaById, zoom, setZoom, scale, children }) {
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
      {children}
    </div>
  );
}

// Strip of thumbnails along the bottom. Only the cells on screen exist, so a
// folder of thousands of photos scrolls as smoothly as a folder of ten.
const CELL = 96;

function Filmstrip({ photos, index, meta, onSelect, requestMeta }) {
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
          <Thumb key={p.id} photo={p} meta={meta[p.id]} active={first + i === index} left={(first + i) * CELL} onClick={() => onSelect(first + i)} />
        ))}
      </div>
    </div>
  );
}

function Thumb({ photo, meta, active, left, onClick }) {
  const [src, setSrc] = useState(() => imgUrl('thumb', photo.id));
  const rating = photoRating(photo, meta);
  const rot = ROTATION[meta?.orientation] || 0;
  const onError = () => { if (src.startsWith('gcimg:')) thumbFallbackUrl(photo).then(setSrc, () => {}); };
  return (
    <button className={`thumb${active ? ' active' : ''}`} style={{ left }} onClick={onClick} onMouseDown={(e) => e.preventDefault()} title={photo.name}>
      <img src={src} alt="" decoding="async" draggable={false} onError={onError} style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />
      {rating > 0 && <span className="thumb-stars">{'★'.repeat(rating)}</span>}
    </button>
  );
}
