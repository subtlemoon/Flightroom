import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bridge as app } from '../bridge.js';
import { Icon, Modal } from './ui.jsx';
import { Filmstrip, photoRating } from './cull.jsx';
import { imgUrl, ROTATION } from '../cull/previews.js';
import { RESERVED_KEYS, keyLabel, normKey, ratingForKey, ratingKeys, zoomKey } from '../cull/keys.js';
import { COLORS, COLOR_HUES, LINEAR_CURVE, SECTIONS, SLIDER, defaults, formatValue, fromXmp, isEdited, toXmp } from '../develop/params.js';
import { asShotTempTint } from '../develop/color.js';
import { Geometry, Renderer, fitScale, outToFrame, parseFrame } from '../develop/renderer.js';
import { exportPhoto, exportSize } from '../develop/export.js';
import { monotoneCurve, parametric } from '../develop/luts.js';

// The Develop tab: the full RAW file with Lightroom-style controls. Edits are
// never written into the photo: they're saved, as Lightroom's own settings,
// in the .xmp file next to it (with the star rating), and Lightroom applies
// them when it imports the photo or reads its metadata again.

const isRaw = (p) => !!p.raw;
const META_WINDOW = 20;

export function DevelopView({ store, onCull }) {
  const bridge = app?.cull;
  const { state, actions } = store;
  const folder = state.cull?.folder;
  const keys = ratingKeys(state.settings);
  const zKey = zoomKey(state.settings);

  const [list, setList] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [meta, setMeta] = useState({});
  const [opened, setOpened] = useState(null); // { id, info, asShot } | { id, error }
  const [s, setS] = useState(null);
  const [crop, setCrop] = useState(false);
  const [before, setBefore] = useState(false);
  const [clip, setClip] = useState(false);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(null); // modal state
  const [clipboard, setClipboard] = useState(null);
  const pendingMeta = useRef(new Set());
  const settingsCache = useRef(new Map()); // id -> settings (this session)
  const history = useRef(new Map()); // id -> { past, future, lastPush }
  const dirty = useRef(false);
  const positions = useRef();
  positions.current = state.cull?.positions || {};

  const photos = list?.photos || [];
  let index = photos.findIndex((p) => p.id === currentId);
  if (index < 0) index = 0;
  const photo = photos[index];

  // Same folder and position as the Culling tab.
  const open = useCallback(async (dir) => {
    if (!bridge || !dir) return;
    setList({ loading: true, folder: dir });
    const res = await bridge.scan(dir);
    if (res.error) { setList({ error: res.error, folder: dir }); return; }
    setMeta({});
    pendingMeta.current = new Set();
    const pos = Math.min(positions.current[res.folder] || 0, Math.max(0, res.photos.length - 1));
    setCurrentId(res.photos[pos]?.id ?? null);
    setList(res);
  }, [bridge]);
  useEffect(() => { if (folder) open(folder); }, [folder, open]);

  const lastPos = useRef(null);
  useEffect(() => {
    if (list?.folder && index >= 0 && photo) {
      lastPos.current = [list.folder, index];
      const t = setTimeout(() => actions.setCullPosition(list.folder, index), 400);
      return () => clearTimeout(t);
    }
  }, [photo?.id, list?.folder]);
  // Leaving for Culling right after moving: hand over the position at once.
  useEffect(() => () => { if (lastPos.current) actions.setCullPosition(...lastPos.current); }, []);

  const requestMeta = useCallback((ids) => {
    const want = ids.filter((id) => id && !pendingMeta.current.has(id));
    if (!want.length || !bridge) return;
    want.forEach((id) => pendingMeta.current.add(id));
    bridge.meta(want).then((m) => { if (!m.error) setMeta((old) => ({ ...old, ...m })); });
  }, [bridge]);
  useEffect(() => {
    if (!photo) return;
    requestMeta([photo.id, ...photos.slice(Math.max(0, index - 3), index + META_WINDOW).map((p) => p.id)]);
  }, [photo?.id, photos, requestMeta]);

  // Free the RAW data and graphics memory when leaving the tab.
  useEffect(() => () => { app?.develop.close(); }, []);

  // Open the current photo: decode its RAW and read its saved settings.
  useEffect(() => {
    if (!photo) return;
    setCrop(false);
    if (!isRaw(photo)) { setOpened({ id: photo.id, error: 'notRaw' }); setS(null); return; }
    let live = true;
    setOpened((o) => (o?.id === photo.id ? o : { id: photo.id, loading: true }));
    app.develop.open(photo).then((info) => {
      if (!live) return;
      if (info.error) { setOpened({ id: photo.id, error: info.error }); setS(null); return; }
      const asShot = asShotTempTint(info);
      setOpened({ id: photo.id, info, asShot });
      dirty.current = false;
      setS(settingsCache.current.get(photo.id) || fromXmp(info.settings, info.toneCurve, asShot));
    });
    return () => { live = false; };
  }, [photo?.id]);

  // Save edits to the sidecar shortly after the last change.
  useEffect(() => {
    if (!s || !opened?.info || !photo || opened.id !== photo.id) return;
    settingsCache.current.set(photo.id, s);
    if (!dirty.current) return;
    const target = photo;
    const t = setTimeout(async () => {
      const res = await app.develop.save(target.sidecar, toXmp(s));
      if (res?.error) setToast(`Couldn't save the edit: ${res.error}`);
    }, 500);
    return () => clearTimeout(t);
  }, [s]);

  // Changes settings. Rapid changes (dragging a slider) share one undo step.
  const update = useCallback((patch) => {
    if (!photo) return;
    setS((old) => {
      if (!old) return old;
      const h = history.current.get(photo.id) || { past: [], future: [], last: 0 };
      if (Date.now() - h.last > 600) { h.past.push(old); if (h.past.length > 100) h.past.shift(); }
      h.last = Date.now();
      h.future = [];
      history.current.set(photo.id, h);
      dirty.current = true;
      return typeof patch === 'function' ? patch(old) : { ...old, ...patch };
    });
  }, [photo?.id]);

  const undo = (redo = false) => {
    const h = history.current.get(photo?.id);
    if (!h) return;
    const from = redo ? h.future : h.past, to = redo ? h.past : h.future;
    if (!from.length) return;
    setS((cur) => { to.push(cur); dirty.current = true; h.last = 0; return from.pop(); });
  };

  const reset = () => opened?.asShot && update(defaults(opened.asShot));
  const copy = () => { if (s) { setClipboard(s); setToast('Settings copied'); } };
  const paste = () => {
    if (!clipboard || !opened?.asShot) return;
    // White balance pastes as-is only if it was set by hand; crops aren't pasted.
    const { crop: _, ...rest } = clipboard;
    update((old) => ({ ...old, ...rest, crop: old.crop, ...(rest.wb === 'As Shot' ? { temp: opened.asShot.temp, tint: opened.asShot.tint } : {}) }));
    setToast('Settings pasted');
  };

  const rate = useCallback(async (p, rating) => {
    if (!p) return;
    const before = p.rating;
    const set = (r) => setList((l) => ({ ...l, photos: l.photos.map((x) => (x.id === p.id ? { ...x, rating: r } : x)) }));
    set(rating);
    const res = await bridge.rate(p, rating);
    if (res?.error) { set(before); setToast(`Couldn't save the rating: ${res.error}`); }
    else setToast(rating ? `${'★'.repeat(rating)} saved` : 'Rating cleared');
  }, [bridge]);

  const go = (i) => {
    if (!photos.length) return;
    setCurrentId(photos[Math.max(0, Math.min(photos.length - 1, i))].id);
  };

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Keyboard, as in Lightroom where it makes sense.
  const stageApi = useRef({});
  useEffect(() => {
    const onKey = (e) => {
      if (exporting) return;
      const typing = e.target.closest?.('input[type=text], input[type=number], textarea, select, [contenteditable]');
      if (typing) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
      if (ctrl && k === 'y') { e.preventDefault(); undo(true); return; }
      if (ctrl && e.shiftKey && k === 'c') { e.preventDefault(); copy(); return; }
      if (ctrl && e.shiftKey && k === 'v') { e.preventDefault(); paste(); return; }
      if (ctrl || e.altKey) return;
      if (e.target.type === 'range') e.target.blur();
      if (e.key === '\\') { e.preventDefault(); if (!e.repeat) setBefore((b) => !b); return; }
      if (k === 'j') { setClip((c) => !c); return; }
      if (k === 'g' && onCull && ratingForKey(keys, e.key) === undefined) { onCull(); return; }
      if (k === 'r') { if (s) setCrop((c) => !c); return; }
      if (e.key === 'Escape') { setCrop(false); stageApi.current.unzoom?.(); return; }
      if (e.key === 'Enter' && crop) { setCrop(false); return; }
      if (normKey(e.key) === zKey) { e.preventDefault(); if (!e.repeat) stageApi.current.toggleZoom?.(); return; }
      const r = ratingForKey(keys, e.key);
      if (r !== undefined && !RESERVED_KEYS.includes(e.key)) { e.preventDefault(); if (!e.repeat) rate(photo, r); return; }
      const moves = { ArrowRight: 1, ArrowLeft: -1 };
      if (moves[e.key]) { e.preventDefault(); go(index + moves[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(photos.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!app) {
    return <div className="view"><div className="hero-empty"><div className="hero-icon"><Icon name="develop" size={40} /></div><h2>Develop runs in the desktop app</h2><p className="muted">Open Flightroom on your PC to edit RAW photos.</p></div></div>;
  }

  if (!folder || list?.error) {
    return (
      <div className="view"><div className="hero-empty">
        <div className="hero-icon"><Icon name="develop" size={40} /></div>
        <h2>{list?.error ? 'That folder could not be opened' : 'Pick a shoot to develop'}</h2>
        <p className="muted">Develop works on the folder open in Culling, so you can rate first and then edit your keepers.</p>
        <button className="btn btn-primary" onClick={async () => { const d = await bridge.pickFolder(); if (d) actions.setCullFolder(d); }}><Icon name="folder" size={16} />Open a folder</button>
      </div></div>
    );
  }

  const info = photo && opened?.id === photo.id ? opened.info : null;
  const shown = s && before && opened?.asShot ? { ...defaults(opened.asShot), crop: s.crop } : s;
  const curMeta = photo && meta[photo.id];
  const rating = photo ? photoRating(photo, curMeta) : 0;

  return (
    <div className="develop">
      <header className="cull-bar">
        <div className="grow cull-title">
          <div className="eyebrow">Develop</div>
          <div className="cull-folder" title={list?.folder || folder}>{photo ? photo.name : (list?.folder || folder).split(/[\\/]/).pop()}</div>
        </div>
        <div className="cull-stats muted">{list?.loading ? 'Reading folder…' : `${photos.length ? index + 1 : 0} of ${photos.length}`}</div>
        <div className="dev-tools">
          {onCull && <button className="btn btn-sm btn-ghost" onClick={onCull} title="Back to Culling (G)"><Icon name="photo" size={14} />Culling</button>}
          <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={() => undo()} disabled={!s}><Icon name="undo" size={16} /></button>
          <button className="icon-btn" title="Redo (Ctrl+Y)" onClick={() => undo(true)} disabled={!s}><Icon name="redo" size={16} /></button>
          <button className={`btn btn-sm${before ? ' on' : ''}`} title="Before / after (\)" onClick={() => setBefore((b) => !b)} disabled={!s}><Icon name="compare" size={14} />{before ? 'Before' : 'After'}</button>
          <button className={`btn btn-sm${crop ? ' btn-primary' : ''}`} title="Crop and straighten (R)" onClick={() => setCrop((c) => !c)} disabled={!s}><Icon name="crop" size={14} />{crop ? 'Done' : 'Crop'}</button>
          <button className="btn btn-sm btn-primary" onClick={() => setExporting({})} disabled={!s}><Icon name="export" size={14} />Export</button>
        </div>
      </header>
      <div className="dev-main">
        <div className="dev-stage-col">
          {photo && opened?.id === photo.id && opened.error ? (
            <div className="hero-empty dev-msg">
              <h2>{opened.error === 'notRaw' ? 'Develop edits RAW files' : "This photo can't be developed"}</h2>
              <p className="muted">{opened.error === 'notRaw' ? `${photo.name} is a JPEG. Pick a RAW file (NEF and most other cameras' RAW) to edit it here.` : opened.error}</p>
            </div>
          ) : photo ? (
            <DevelopStage key={photo.id} photo={photo} meta={curMeta} info={info} s={shown} cropMode={crop} clip={clip}
              onCrop={(c) => update({ crop: c })} apiRef={stageApi} nextPhoto={photos[index + 1]} before={before} />
          ) : (
            <div className="hero-empty dev-msg"><h2>{list?.loading ? 'Reading folder…' : 'No photos in this folder'}</h2></div>
          )}
          <Filmstrip photos={photos} index={index} meta={meta} suggestions={{}} onSelect={go} requestMeta={requestMeta} />
        </div>
        <aside className="dev-panel">
          {s && info ? (
            <Panel s={s} info={info} asShot={opened.asShot} update={update} crop={crop} meta={curMeta} rating={rating} keys={keys}
              onRate={(r) => rate(photo, r)} onReset={reset} onCopy={copy} onPaste={clipboard ? paste : null}
              edited={isEdited(s, opened.asShot)} />
          ) : (
            <div className="dev-panel-empty muted small">{opened?.loading ? 'Reading RAW data…' : ''}</div>
          )}
        </aside>
      </div>
      {toast && <div className="cull-toast">{toast}</div>}
      {exporting && <ExportModal photo={photo} photos={photos} folder={list?.folder} info={info} s={s} settingsCache={settingsCache.current}
        onClose={() => setExporting(null)} onDone={(msg) => { setExporting(null); setToast(msg); }} />}
    </div>
  );
}

// --- the photo ---------------------------------------------------------------

const fitEdge = () => Math.min(4096, Math.round(Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1)));

async function fetchFrame(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return parseFrame(await res.arrayBuffer());
}

function DevelopStage({ photo, meta, info, s, cropMode, clip, onCrop, apiRef, nextPhoto, before }) {
  const wrapRef = useRef();
  const canvasRef = useRef();
  const rendererRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false); // RAW on the graphics card
  const [error, setError] = useState('');
  const [view, setView] = useState(null); // null = fit; { scale (oriented px -> css px), u, v }
  const [hist, setHist] = useState(null);
  const drag = useRef(null);
  const hiReq = useRef(0);
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try { rendererRef.current = new Renderer(canvasRef.current); } catch (err) { setError(String(err.message || err)); }
    const lost = (e) => { e.preventDefault(); setError('The graphics card stopped the photo renderer'); setReady(false); };
    canvasRef.current.addEventListener('webglcontextlost', lost);
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, []);

  // The whole photo, decoded from the RAW; then the next photo, ahead of time.
  useEffect(() => {
    if (!info) return;
    let live = true;
    fetchFrame(app.develop.imageUrl(photo, fitEdge())).then((frame) => {
      if (!live || !rendererRef.current) return;
      rendererRef.current.setSource(frame);
      setReady(true);
      if (nextPhoto?.raw) fetch(app.develop.imageUrl(nextPhoto, fitEdge(), true)).catch(() => {});
    }, (err) => live && setError(String(err.message || err)));
    return () => { live = false; };
  }, [info]);

  const geo = useMemo(() => info && new Geometry(info.width, info.height, info.orientation), [info]);
  // In crop mode the whole photo shows (turned by the straighten angle) with the crop on top.
  const frame = useMemo(() => {
    if (!geo || !s) return null;
    if (cropMode) {
      const a = ((s.crop?.angle || 0) * Math.PI) / 180;
      const c = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a));
      const hw = (geo.ow / 2) * c + (geo.oh / 2) * si, hh = (geo.ow / 2) * si + (geo.oh / 2) * c;
      return { cx: geo.ow / 2, cy: geo.oh / 2, hw, hh, angle: s.crop?.angle || 0 };
    }
    return geo.frame(s.crop);
  }, [geo, s?.crop, cropMode]);
  const fit = frame && W ? fitScale(W, H, frame, cropMode ? 28 * dpr : 0) : 1;
  const v = !cropMode && view ? { scale: view.scale * dpr, u: view.u, v: view.v } : { scale: fit, u: 0, v: 0 };

  // Sharper pixels for the visible part when zoomed in.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !ready || !geo || !frame) return;
    if (!view || cropMode) { r.clearHi(); return; }
    const id = ++hiReq.current;
    const t = setTimeout(async () => {
      const toPhoto = (x, y) => {
        const o2f = outToFrame(W, H, frame, v);
        const fx = o2f[0] * x + o2f[1] * y + o2f[2], fy = o2f[3] * x + o2f[4] * y + o2f[5];
        const a = (frame.angle * Math.PI) / 180;
        const ox = frame.cx + Math.cos(a) * fx * frame.hw - Math.sin(a) * fy * frame.hh;
        const oy = frame.cy + Math.sin(a) * fx * frame.hw + Math.cos(a) * fy * frame.hh;
        const m = geo.o2s;
        return [m[0] * ox + m[1] * oy + m[2], m[3] * ox + m[4] * oy + m[5]];
      };
      const pts = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => toPhoto(x, y));
      const pad = 0.25;
      let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
      let y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
      const ex = (x1 - x0) * pad, ey = (y1 - y0) * pad;
      x0 = Math.max(0, Math.floor(x0 - ex)); y0 = Math.max(0, Math.floor(y0 - ey));
      x1 = Math.min(geo.sw, Math.ceil(x1 + ex)); y1 = Math.min(geo.sh, Math.ceil(y1 + ey));
      if (x1 - x0 < 2 || y1 - y0 < 2) return;
      const k = Math.min(1, v.scale * 1.05);
      const max = r.maxTex;
      const ow = Math.min(max, Math.round((x1 - x0) * k)), oh = Math.min(max, Math.round((y1 - y0) * k));
      try {
        const f = await fetchFrame(app.develop.regionUrl(photo, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, ow, oh }));
        if (id !== hiReq.current || !rendererRef.current) return;
        const rect = [x0 / geo.sw, y0 / geo.sh, (x1 - x0) / geo.sw, (y1 - y0) / geo.sh];
        const inset = [3 / geo.sw, 3 / geo.sh];
        rendererRef.current.setHi(f, rect, [rect[0] + inset[0], rect[1] + inset[1], rect[2] - 2 * inset[0], rect[3] - 2 * inset[1]]);
        draw();
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [ready, view, W, H, cropMode, frame]);

  const draw = () => {
    const r = rendererRef.current;
    const c = canvasRef.current;
    if (!r || !ready || !s || !info || !frame || !W || !H) return;
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    r.render(info, s, geo, frame, outToFrame(W, H, frame, v), { showClip: clip });
  };

  // Redraw on any change, at most once per frame.
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  });

  // Histogram, a little behind the sliders.
  useEffect(() => {
    if (!ready || !s || !info || !geo) return;
    const t = setTimeout(() => {
      const r = rendererRef.current;
      if (r) setHist(r.histogram(info, s, geo, geo.frame(s.crop)));
    }, 80);
    return () => clearTimeout(t);
  }, [ready, s, info]);
  useEffect(() => { apiRef.current.hist = hist; window.dispatchEvent(new CustomEvent('develop:hist', { detail: hist })); }, [hist]);

  // Zoom: the spot you click stays under the pointer, at 100%.
  const zoomTo = (cssX, cssY, scale) => {
    if (!frame) return;
    const curK = v.scale;
    const px = cssX * dpr - W / 2, py = cssY * dpr - H / 2;
    const fu = v.u + px / (curK * frame.hw), fv = v.v + py / (curK * frame.hh);
    const k = scale * dpr;
    setView({ scale, u: fu - px / (k * frame.hw), v: fv - py / (k * frame.hh) });
  };
  apiRef.current.toggleZoom = () => (view ? setView(null) : zoomTo(size.w / 2, size.h / 2, 1 / dpr));
  apiRef.current.unzoom = () => setView(null);

  const onPointerDown = (e) => {
    if (e.button !== 0 || cropMode || !ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, start: view };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved && d.start) {
      const k = d.start.scale * dpr;
      setView({ ...d.start, u: d.start.u - (dx * dpr) / (k * frame.hw), v: d.start.v - (dy * dpr) / (k * frame.hh) });
    }
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    if (view) setView(null);
    else {
      const rect = canvasRef.current.getBoundingClientRect();
      zoomTo(e.clientX - rect.left, e.clientY - rect.top, 1 / dpr);
    }
  };
  const onWheel = (e) => {
    if (cropMode || !ready || !frame) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cur = view ? view.scale : fit / dpr;
    const next = Math.min(4, Math.max(fit / dpr, cur * Math.exp(-e.deltaY * 0.0015)));
    if (next <= fit / dpr * 1.001) { setView(null); return; }
    zoomTo(e.clientX - rect.left, e.clientY - rect.top, next);
  };

  const rot = ROTATION[meta?.orientation] || 0;
  const pct = Math.round(((view ? view.scale : fit / dpr) * dpr) * 100);
  return (
    <div className={`stage dev-stage${view ? ' zoomed' : ''}${cropMode ? ' cropping' : ''}`} ref={wrapRef}>
      {!ready && (
        <img className="dev-placeholder" src={imgUrl('preview', photo.id)} alt="" draggable={false}
          style={rot ? { transform: `rotate(${rot}deg)`, maxWidth: rot % 180 ? size.h : undefined, maxHeight: rot % 180 ? size.w : undefined } : undefined} />
      )}
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h, opacity: ready ? 1 : 0 }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel} />
      <div className="stage-top">
        {!ready && !error && <span className="pill-mini">Loading RAW…</span>}
        {ready && <span className="pill-mini">{before ? 'Before' : 'RAW'} · {pct}%</span>}
        {clip && <span className="pill-mini clip">Clipping shown (J)</span>}
      </div>
      {error && <div className="stage-error"><b>Can't show the RAW here.</b> {error}. You're seeing the camera's preview instead.</div>}
      {cropMode && ready && frame && geo && s && (
        <CropOverlay geo={geo} view={frame} k={v.scale / dpr} size={size} crop={s.crop} onChange={onCrop} />
      )}
    </div>
  );
}

// --- crop --------------------------------------------------------------------

const ASPECTS = [['Original', null], ['Free', 0], ['1:1', 1], ['4:5', 4 / 5], ['5:7', 5 / 7], ['2:3', 2 / 3], ['16:9', 16 / 9]];

// Is a crop frame (oriented px) inside the photo?
function inside(geo, f) {
  const a = (f.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([u, v]) => {
    const x = f.cx + c * u * f.hw - s * v * f.hh, y = f.cy + s * u * f.hw + c * v * f.hh;
    return x >= -0.5 && y >= -0.5 && x <= geo.ow + 0.5 && y <= geo.oh + 0.5;
  });
}

// Shrinks a frame around its centre until it fits.
function fitInside(geo, f) {
  let g = { ...f };
  for (let i = 0; i < 40 && !inside(geo, g); i++) g = { ...g, hw: g.hw * 0.97, hh: g.hh * 0.97 };
  if (!inside(geo, g)) g = { ...g, cx: geo.ow / 2, cy: geo.oh / 2 };
  for (let i = 0; i < 60 && !inside(geo, g); i++) g = { ...g, hw: g.hw * 0.97, hh: g.hh * 0.97 };
  return g;
}

function CropOverlay({ geo, view, k, size, crop, onChange }) {
  const f = geo.frame(crop);
  // Screen (css px, from the centre of the stage) <-> oriented px, for a view turned by its angle.
  const a = (view.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const toScreen = (x, y) => { const dx = x - view.cx, dy = y - view.cy; return [(c * dx + s * dy) * k + size.w / 2, (-s * dx + c * dy) * k + size.h / 2]; };
  const fromScreen = (X, Y) => { const dx = (X - size.w / 2) / k, dy = (Y - size.h / 2) / k; return [view.cx + c * dx - s * dy, view.cy + s * dx + c * dy]; };
  const [cx, cy] = toScreen(f.cx, f.cy);
  const box = { left: cx - f.hw * k, top: cy - f.hh * k, width: 2 * f.hw * k, height: 2 * f.hh * k };
  const drag = useRef(null);
  const aspect = crop?.aspect;

  const begin = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, box: { ...box } };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    let { left, top, width, height } = d.box;
    if (d.mode === 'move') { left += dx; top += dy; }
    else {
      if (d.mode.includes('l')) { left += dx; width -= dx; }
      if (d.mode.includes('r')) width += dx;
      if (d.mode.includes('t')) { top += dy; height -= dy; }
      if (d.mode.includes('b')) height += dy;
      if (width < 24 || height < 24) return;
      const ratio = aspect || (aspect === 0 ? 0 : geo.ow / geo.oh);
      if (ratio) {
        // Keep the ratio, anchored on the opposite side.
        const h2 = width / ratio;
        if (d.mode.includes('t')) top += height - h2;
        height = h2;
      }
    }
    const [ncx, ncy] = fromScreen(left + width / 2, top + height / 2);
    const next = { cx: ncx, cy: ncy, hw: width / 2 / k, hh: height / 2 / k, angle: f.angle };
    if (inside(geo, next)) onChange({ ...geo.toCrop(next), aspect });
  };
  const end = () => { drag.current = null; };

  const setAngle = (angle) => onChange({ ...geo.toCrop(fitInside(geo, { ...f, angle })), aspect });
  const setAspect = (ratio) => {
    if (ratio === null) { onChange({ ...geo.toCrop(fitInside(geo, { ...f, hh: f.hw / (geo.ow / geo.oh) })), aspect: undefined }); return; }
    if (!ratio) { onChange({ ...geo.toCrop(f), aspect: 0 }); return; }
    const r = f.hw >= f.hh ? Math.max(ratio, 1 / ratio) : Math.min(ratio, 1 / ratio);
    onChange({ ...geo.toCrop(fitInside(geo, { ...f, hh: f.hw / r })), aspect: r });
  };

  const handles = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
  return (
    <>
      <div className="crop-shade" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.left}px ${box.top}px, ${box.left}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top}px, ${box.left}px ${box.top}px)` }} />
      <div className="crop-box" style={box} onPointerDown={(e) => begin(e, 'move')} onPointerMove={move} onPointerUp={end}>
        <div className="crop-grid" />
        {handles.map((h) => <div key={h} className={`crop-handle ${h}`} onPointerDown={(e) => begin(e, h)} onPointerMove={move} onPointerUp={end} />)}
      </div>
      <div className="crop-bar">
        <div className="seg small">
          {ASPECTS.map(([label, r]) => (
            <button key={label} className={(r === null ? aspect === undefined : r === 0 ? aspect === 0 : aspect && Math.abs(Math.max(aspect, 1 / aspect) - Math.max(r, 1 / r)) < 1e-3) ? 'on' : ''}
              onClick={() => setAspect(r)}>{label}</button>
          ))}
        </div>
        <label className="crop-angle">Straighten
          <input type="range" min={-45} max={45} step={0.1} value={f.angle} onChange={(e) => setAngle(Number(e.target.value))} onDoubleClick={() => setAngle(0)} />
          <span>{f.angle.toFixed(1)}°</span>
        </label>
        <button className="btn btn-sm" onClick={() => onChange(null)}>Reset crop</button>
      </div>
    </>
  );
}

// --- the panel ---------------------------------------------------------------

function Panel({ s, info, asShot, update, meta, rating, keys, onRate, onReset, onCopy, onPaste, edited }) {
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flightroom-develop-panels')) || { basic: true, curve: false, color: false, detail: false, effects: false }; } catch { return { basic: true }; }
  });
  const toggle = (id) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem('flightroom-develop-panels', JSON.stringify(n)); } catch {} return n; });
  return (
    <div className="dev-panel-inner">
      <Histogram />
      <div className="dev-shot">
        <span>{meta?.model || info.camera}</span>
        <ShotLine meta={meta} />
      </div>
      <div className="dev-row">
        <div className="stars small-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`star${n <= rating ? ' on' : ''}`} onClick={() => onRate(n === rating ? 0 : n)} title={`${n} star${n > 1 ? 's' : ''} (key ${keyLabel(keys[n])})`}>★</button>
          ))}
        </div>
        <div className="grow" />
        <button className="icon-btn" title="Copy settings (Ctrl+Shift+C)" onClick={onCopy}><Icon name="copy" size={15} /></button>
        <button className="icon-btn" title="Paste settings (Ctrl+Shift+V)" onClick={onPaste || undefined} disabled={!onPaste}><Icon name="paste" size={15} /></button>
        <button className="btn btn-sm" onClick={onReset} disabled={!edited} title="Back to how the camera shot it">Reset</button>
      </div>
      {SECTIONS.map((sec) => (
        <section key={sec.id} className={`dev-section${open[sec.id] ? ' open' : ''}`}>
          <button className="dev-section-head" onClick={() => toggle(sec.id)}>
            <span className="grow">{sec.title}</span><span className="dev-caret">{open[sec.id] ? '▾' : '▸'}</span>
          </button>
          {open[sec.id] && (
            <div className="dev-section-body">
              {sec.id === 'basic' && (
                <div className="dev-wb">
                  <span className="muted small">WB</span>
                  <select value={s.wb} onChange={(e) => update(e.target.value === 'As Shot' ? { wb: 'As Shot', temp: asShot.temp, tint: asShot.tint } : { wb: e.target.value })}>
                    <option value="As Shot">As Shot</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              )}
              {sec.id === 'curve' && <CurveEditor s={s} update={update} />}
              {sec.id === 'color' && <ColorMixer s={s} update={update} />}
              {sec.groups.map((g) => (
                <div key={g.title} className="dev-group">
                  {sec.groups.length > 1 || sec.id !== 'basic' ? <div className="dev-group-title">{g.title}</div> : null}
                  {g.sliders.map((sl) => (
                    <Slider key={sl.key} sl={sl} value={s[sl.key]} def={sl.key === 'temp' ? asShot.temp : sl.key === 'tint' ? asShot.tint : sl.def}
                      onChange={(v) => update({ [sl.key]: v, ...(sl.key === 'temp' || sl.key === 'tint' ? { wb: 'Custom' } : {}) })} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
      <p className="muted small dev-note">Edits are saved next to each photo (.xmp), where Lightroom reads them. Your RAW files are never changed.</p>
    </div>
  );
}

const fmtShutter = (t) => (!t ? null : t >= 1 ? `${+t.toFixed(1)}s` : `1/${Math.round(1 / t)}`);
function ShotLine({ meta }) {
  if (!meta || meta.error) return null;
  return <span className="muted">{[meta.iso && `ISO ${meta.iso}`, meta.focalLength && `${Math.round(meta.focalLength)}mm`, meta.fNumber && `f/${+meta.fNumber.toFixed(1)}`, fmtShutter(meta.exposure)].filter(Boolean).join('  ')}</span>;
}

// Slider track position for a value (temperature uses a log scale, like Lightroom).
const toPos = (sl, v) => (sl.log ? (Math.log(v) - Math.log(sl.min)) / (Math.log(sl.max) - Math.log(sl.min)) : (v - sl.min) / (sl.max - sl.min));
const fromPos = (sl, p) => {
  const v = sl.log ? Math.exp(Math.log(sl.min) + p * (Math.log(sl.max) - Math.log(sl.min))) : sl.min + p * (sl.max - sl.min);
  return Math.min(sl.max, Math.max(sl.min, Math.round(v / sl.step) * sl.step));
};

function Slider({ sl, value, def, onChange, color }) {
  const [text, setText] = useState(null);
  const pos = toPos(sl, value ?? def ?? 0);
  const zero = sl.log || sl.min >= 0 ? 0 : toPos(sl, 0);
  const commitText = () => {
    const n = Number(String(text).replace(/[^\d.+-]/g, ''));
    if (text !== null && Number.isFinite(n)) onChange(Math.min(sl.max, Math.max(sl.min, n)));
    setText(null);
  };
  return (
    <div className="dev-slider" onDoubleClick={(e) => { if (!e.target.closest('input[type=text]')) onChange(def ?? 0); }} title="Double-click to reset">
      <span className="dev-slider-label">{sl.label}</span>
      <input type="text" className="dev-slider-value" value={text ?? formatValue(sl, value)} onChange={(e) => setText(e.target.value)}
        onBlur={commitText} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(null); e.currentTarget.blur(); } }} />
      <div className={`dev-track${sl.gradient ? ` grad-${sl.gradient}` : ''}`} style={color ? { '--track': color } : undefined}>
        {!sl.gradient && !color && <div className="dev-fill" style={{ left: `${Math.min(zero, pos) * 100}%`, width: `${Math.abs(pos - zero) * 100}%` }} />}
        <input type="range" min={0} max={1000} step={1} value={Math.round(pos * 1000)}
          onChange={(e) => onChange(fromPos(sl, Number(e.target.value) / 1000))}
          onPointerUp={(e) => e.currentTarget.blur()} />
      </div>
    </div>
  );
}

function Histogram() {
  const ref = useRef();
  const [bins, setBins] = useState(null);
  useEffect(() => {
    const on = (e) => setBins(e.detail);
    window.addEventListener('develop:hist', on);
    return () => window.removeEventListener('develop:hist', on);
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth * dpr, h = c.clientHeight * dpr;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!bins) return;
    let max = 1;
    for (const b of bins) for (let i = 2; i < 254; i++) max = Math.max(max, b[i]);
    ctx.globalCompositeOperation = 'lighter';
    ['rgba(255,70,70,0.75)', 'rgba(70,220,90,0.75)', 'rgba(80,130,255,0.8)'].forEach((col, ch) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * w, h - Math.min(1, Math.sqrt(bins[ch][i] / max)) * h * 0.95);
      ctx.lineTo(w, h);
      ctx.fill();
    });
    const total = bins[0].reduce((a, b) => a + b, 0);
    const lo = (bins[0][0] + bins[1][0] + bins[2][0]) / total / 3, hi = (bins[0][255] + bins[1][255] + bins[2][255]) / total / 3;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = lo > 0.002 ? '#5aa0ff' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(3 * dpr, 3 * dpr, 7 * dpr, 7 * dpr);
    ctx.fillStyle = hi > 0.002 ? '#ff5c6c' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(w - 10 * dpr, 3 * dpr, 7 * dpr, 7 * dpr);
  }, [bins]);
  return <canvas className="dev-hist" ref={ref} title="Histogram. Corner boxes light up when shadows (left) or highlights (right) clip; press J to see where." />;
}

// Point curve: drag points, click to add, double-click a point to remove it.
function CurveEditor({ s, update }) {
  const ref = useRef();
  const drag = useRef(null);
  const SIZE = 236;
  const pts = s.curve;
  const toXY = ([x, y]) => [(x / 255) * SIZE, SIZE - (y / 255) * SIZE];
  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.round(Math.min(255, Math.max(0, ((e.clientX - r.left) / r.width) * 255))), Math.round(Math.min(255, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 255)))];
  };
  const curve = useMemo(() => monotoneCurve(pts.map(([x, y]) => [x / 255, y / 255])), [pts]);
  const path = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const x = i / 64;
      const y = Math.min(1, Math.max(0, curve(parametric(s, x))));
      d += `${i ? 'L' : 'M'}${(x * SIZE).toFixed(1)},${(SIZE - y * SIZE).toFixed(1)}`;
    }
    return d;
  }, [curve, s.pShadows, s.pDarks, s.pLights, s.pHighlights]);

  const down = (e) => {
    const [x, y] = fromEvent(e);
    let i = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10);
    let next = pts;
    if (i < 0) {
      next = [...pts, [x, y]].sort((a, b) => a[0] - b[0]);
      i = next.findIndex((p) => p[0] === x && p[1] === y);
      update({ curve: next });
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, pts: next };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    let [x, y] = fromEvent(e);
    const p = d.pts;
    const lo = d.i > 0 ? p[d.i - 1][0] + 1 : 0, hi = d.i < p.length - 1 ? p[d.i + 1][0] - 1 : 255;
    if (d.i === 0) x = Math.min(x, hi);
    else if (d.i === p.length - 1) x = Math.max(x, lo);
    else x = Math.min(hi, Math.max(lo, x));
    const next = p.map((q, j) => (j === d.i ? [x, y] : q));
    d.pts = next;
    update({ curve: next });
  };
  const remove = (e) => {
    const [x, y] = fromEvent(e);
    const i = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10);
    if (i > 0 && i < pts.length - 1) update({ curve: pts.filter((_, j) => j !== i) });
  };
  return (
    <div className="dev-curve">
      <svg ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onDoubleClick={remove}>
        {[1, 2, 3].map((i) => <g key={i}><line x1={(i * SIZE) / 4} y1={0} x2={(i * SIZE) / 4} y2={SIZE} /><line y1={(i * SIZE) / 4} x1={0} y2={(i * SIZE) / 4} x2={SIZE} /></g>)}
        <line className="diag" x1={0} y1={SIZE} x2={SIZE} y2={0} />
        <path d={path} />
        {pts.map((p, i) => { const [x, y] = toXY(p); return <circle key={i} cx={x} cy={y} r={5} />; })}
      </svg>
      <div className="dev-curve-foot">
        <span className="muted small">Click to add a point, double-click one to remove it</span>
        <button className="btn btn-sm btn-ghost" onClick={() => update({ curve: LINEAR_CURVE, pShadows: 0, pDarks: 0, pLights: 0, pHighlights: 0 })}>Reset</button>
      </div>
    </div>
  );
}

const SWATCH = COLOR_HUES.map((h) => `hsl(${h} 80% 55%)`);

function ColorMixer({ s, update }) {
  const [kind, setKind] = useState('hue');
  return (
    <div className="dev-mixer">
      <div className="seg small">
        {[['hue', 'Hue'], ['sat', 'Saturation'], ['lum', 'Luminance']].map(([k, label]) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>
      {COLORS.map((c, i) => {
        const sl = SLIDER[`${kind}${i}`];
        return <Slider key={sl.key} sl={sl} value={s[sl.key]} def={0} color={SWATCH[i]} onChange={(v) => update({ [sl.key]: v })} />;
      })}
    </div>
  );
}

// --- export ------------------------------------------------------------------

const SIZES = [['Full size', 0], ['Long edge 4096 px', 4096], ['Long edge 2048 px', 2048]];

function ExportModal({ photo, photos, folder, info, s, settingsCache, onClose, onDone }) {
  const [which, setWhich] = useState('this');
  const [longEdge, setLongEdge] = useState(() => Number(localStorage.getItem('flightroom-export-edge') || 0));
  const [quality, setQuality] = useState(() => Number(localStorage.getItem('flightroom-export-quality') || 92));
  const [dest, setDest] = useState(() => localStorage.getItem('flightroom-export-dest') || '');
  const [run, setRun] = useState(null); // { done, total, current }
  const cancel = useRef(false);
  const sep = folder.includes('\\') ? '\\' : '/';
  const target = dest || `${folder}${sep}Exported`;
  const rated = photos.filter((p) => p.raw && (p.rating || 0) > 0);
  const edited = photos.filter((p) => p.raw && settingsCache.has(p.id));
  const list = which === 'this' ? [photo] : which === 'rated' ? rated : edited;
  const geo = new Geometry(info.width, info.height, info.orientation);
  const size = exportSize(geo.frame(s.crop), longEdge);

  const start = async () => {
    try {
      localStorage.setItem('flightroom-export-edge', String(longEdge));
      localStorage.setItem('flightroom-export-quality', String(quality));
      localStorage.setItem('flightroom-export-dest', dest);
    } catch {}
    cancel.current = false;
    const saved = [];
    const failed = [];
    for (let i = 0; i < list.length && !cancel.current; i++) {
      const p = list[i];
      setRun({ done: i, total: list.length, current: p.name, part: 0 });
      try {
        let pInfo = info, pS = s;
        if (p.id !== photo.id) {
          pInfo = await app.develop.open(p);
          if (pInfo.error) throw new Error(pInfo.error);
          pS = settingsCache.get(p.id) || fromXmp(pInfo.settings, pInfo.toneCurve, asShotTempTint(pInfo));
        }
        saved.push(await exportPhoto(p, pInfo, pS, { folder: target, longEdge, quality, cancelled: () => cancel.current, onProgress: (part) => setRun((r) => r && { ...r, part }) }));
      } catch (err) {
        if (String(err.message) !== 'cancelled') failed.push(`${p.name}: ${err.message || err}`);
      }
    }
    // Put the photo on screen back in memory for zooming.
    if (list.some((p) => p.id !== photo.id)) app.develop.open(photo);
    setRun(null);
    if (failed.length) { onDone(`Exported ${saved.length}, ${failed.length} failed (${failed[0]})`); return; }
    onDone(cancel.current ? `Stopped after ${saved.length} photos` : saved.length === 1 ? `Saved ${saved[0].split(/[\\/]/).pop()} to ${target.split(/[\\/]/).pop()}` : `Saved ${saved.length} JPEGs to ${target.split(/[\\/]/).pop()}`);
  };

  return (
    <Modal title="Export JPEG" onClose={run ? () => {} : onClose} footer={run
      ? <button className="btn" onClick={() => { cancel.current = true; }}>Stop</button>
      : <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!list.length} onClick={start}>Export {list.length === 1 ? '1 photo' : `${list.length} photos`}</button></>}>
      {run ? (
        <div className="auto-progress">
          <div className="small">Exporting {run.current} ({run.done + 1} of {run.total})…</div>
          <div className="tree-progress wide"><span style={{ width: `${((run.done + (run.part || 0)) / run.total) * 100}%` }} /></div>
        </div>
      ) : (
        <div className="export-form">
          <label className="export-row"><span>Photos</span>
            <select value={which} onChange={(e) => setWhich(e.target.value)}>
              <option value="this">This photo ({photo.name})</option>
              <option value="rated" disabled={!rated.length}>Rated photos in this folder ({rated.length})</option>
              <option value="edited" disabled={!edited.length}>Photos edited this session ({edited.length})</option>
            </select>
          </label>
          <label className="export-row"><span>Size</span>
            <select value={longEdge} onChange={(e) => setLongEdge(Number(e.target.value))}>
              {SIZES.map(([label, v]) => <option key={v} value={v}>{label}</option>)}
            </select>
            {which === 'this' && <span className="muted small">{size.w} × {size.h}</span>}
          </label>
          <label className="export-row"><span>Quality</span>
            <input type="range" min={60} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            <span className="muted small">{quality}</span>
          </label>
          <div className="export-row"><span>Save to</span>
            <span className="export-dest" title={target}>{target}</span>
            <button className="btn btn-sm" onClick={async () => { const d = await app.develop.pickFolder('Export to'); if (d) setDest(d); }}>Change</button>
            {dest && <button className="btn btn-sm btn-ghost" onClick={() => setDest('')}>Use "Exported"</button>}
          </div>
          <p className="muted small">JPEGs in sRGB, with the camera and lens details. Existing files are never overwritten.</p>
        </div>
      )}
    </Modal>
  );
}
