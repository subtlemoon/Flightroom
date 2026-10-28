import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bridge as app } from '../bridge.js';
import { Dropdown, Icon, Modal, PanelHandle } from './ui.jsx';
import { Slider } from './slider.jsx';
import { CurveEditor } from './curve.jsx';
import { BRUSH_DEFAULT, MASK_OPTIONS_DEFAULT, MaskAdjust, MaskOverlay, MaskPanel, OVERLAY_DEFAULT, maskActions, maskView, useStored } from './masks.jsx';
import { AiDenoise, useAiInstall, useAiMasks } from './ai.jsx';
import { MASK_EDGE, POINT_DEFAULT } from '../develop/masks.js';
import { toggle, useLayout } from '../layout.js';
import { Filmstrip, photoRating } from './cull.jsx';
import { imgUrl, ROTATION } from '../cull/previews.js';
import { inFilter, STAR_FILTERS } from '../cull/filter.js';
import { RESERVED_KEYS, keyLabel, normKey, ratingForKey, ratingKeys, zoomKey } from '../cull/keys.js';
import {
  COLORS, COLOR_HUES, CURVE_PRESETS, PROFILES, SECTIONS, SLIDER, VIGNETTE_STYLES, WB_PRESETS,
  curveName, defaults, fromXmp, isEdited, resetSection, sectionEdited, toXmp,
} from '../develop/params.js';
import { asShotTempTint, colorTransform, inv3, neutralToXy, xyToTempTint } from '../develop/color.js';
import { Geometry, LOOKS, Renderer, ap, constrainedCrop, fitScale, mat, mm, outToFrame, parseFrame, sourceMap } from '../develop/renderer.js';
import { exportPhoto, exportSize } from '../develop/export.js';

// The Develop tab: the full RAW file with Lightroom-style controls. Edits are
// never written into the photo: they're saved, as Lightroom's own settings,
// in the .xmp file next to it (with the star rating), and Lightroom applies
// them when it imports the photo or reads its metadata again.

const isRaw = (p) => !!p.raw;
const TRANSFORM_KEYS = ['perspVertical', 'perspHorizontal', 'perspRotate', 'perspAspect', 'perspScale', 'perspX', 'perspY', 'distortion'];
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
  const [cropOverlay, setCropOverlayState] = useState(() => { try { return localStorage.getItem('flightroom-crop-overlay') || 'always'; } catch { return 'always'; } });
  const setCropOverlay = (v) => { setCropOverlayState(v); try { localStorage.setItem('flightroom-crop-overlay', v); } catch {} };
  const [before, setBefore] = useState(false);
  const [clip, setClip] = useState(false);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(null); // modal state
  const [clipboard, setClipboard] = useState(null);
  const [picking, setPicking] = useState(false); // 'wb' (white balance selector) | 'point' (a mask's Point Color)
  const [sel, setSelState] = useState(null); // selected mask and part: { mask, part }
  const [overlay, setOverlay] = useStored('flightroom-mask-overlay-2', OVERLAY_DEFAULT);
  const [brush, setBrush] = useStored('flightroom-brush', BRUSH_DEFAULT);
  const pendingMeta = useRef(new Set());
  const settingsCache = useRef(new Map()); // id -> settings (this session)
  const history = useRef(new Map()); // id -> { past, future, lastPush }
  const dirty = useRef(false);
  const positions = useRef();
  positions.current = state.cull?.positions || {};

  const [filter, setFilter] = useState('all'); // see inFilter
  const layout = useLayout();
  // The crop tool lives in the right panel, so cropping shows the panel.
  useEffect(() => { if (crop && !layout.panel) toggle('panel'); }, [crop]);
  // Masking and cropping take turns.
  const setSel = (v) => { setSelState(v); if (v) setCrop(false); };
  useEffect(() => { if (crop) setSelState(null); }, [crop]);
  const allPhotos = list?.photos || [];
  const photos = useMemo(() => (filter === 'all' ? allPhotos : allPhotos.filter((p) => inFilter(filter, photoRating(p, meta[p.id])))),
    [allPhotos, meta, filter]);
  // The current photo is tracked by id. If it drops out of the star filter
  // (rated lower), the one now in its place is shown.
  // Counted once per rating change, not on every slider move.
  const starOptions = useMemo(() => [{ value: 'all', label: 'All photos', hint: allPhotos.length },
    ...STAR_FILTERS.map(([k, label]) => ({ value: k, label, hint: allPhotos.filter((p) => inFilter(k, photoRating(p, meta[p.id]))).length }))], [allPhotos, meta]);
  const lastIndex = useRef(0);
  let index = photos.findIndex((p) => p.id === currentId);
  if (index < 0) index = Math.min(lastIndex.current, Math.max(0, photos.length - 1));
  lastIndex.current = index;
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
    const pos = photo ? allPhotos.findIndex((p) => p.id === photo.id) : -1;
    if (list?.folder && pos >= 0) {
      lastPos.current = [list.folder, pos];
      const t = setTimeout(() => actions.setCullPosition(list.folder, pos), 400);
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
    setSelState(null);
    if (!isRaw(photo)) { setOpened({ id: photo.id, error: 'notRaw' }); setS(null); return; }
    let live = true;
    setOpened((o) => (o?.id === photo.id ? o : { id: photo.id, loading: true }));
    app.develop.open(photo).then((info) => {
      if (!live) return;
      if (info.error) { setOpened({ id: photo.id, error: info.error }); setS(null); return; }
      const asShot = asShotTempTint(info);
      setOpened({ id: photo.id, info, asShot });
      dirty.current = false;
      setS(settingsCache.current.get(photo.id) || fromXmp(info.settings, info.curves, asShot, info.own));
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

  const reset = () => opened?.asShot && update((old) => ({ ...defaults(opened.asShot), masksOwned: old.masksOwned }));

  // White balance from a camera colour that should look neutral (the selector, Auto).
  const wbFrom = (camRgb, name) => {
    const info = opened?.info;
    if (!info || !camRgb || camRgb.some((v) => !(v > 0))) { setToast('Pick a spot that isn\'t pure black or clipped'); return; }
    const t = xyToTempTint(neutralToXy(info.matrices, camRgb));
    const temp = Math.min(50000, Math.max(2000, Math.round(t.temp / 50) * 50)), tint = Math.min(150, Math.max(-150, Math.round(t.tint)));
    update({ wb: name, temp, tint });
  };
  const autoWb = () => wbFrom(stageApi.current.average?.(), 'Auto');
  const pick = (camRgb) => { setPicking(false); wbFrom(camRgb, 'Custom'); };
  // Point Color: the colour clicked, as shown (hue in degrees, saturation and brightness 0-1).
  const pickPoint = (rgb) => {
    setPicking(false);
    if (!selMask || !rgb) return;
    const mx = Math.max(...rgb), mn = Math.min(...rgb), d = mx - mn;
    let h = 0;
    if (d > 1e-5) h = mx === rgb[0] ? ((rgb[1] - rgb[2]) / d + 6) % 6 : mx === rgb[1] ? (rgb[2] - rgb[0]) / d + 2 : (rgb[0] - rgb[1]) / d + 4;
    acts.change(selMask.id, { point: { ...POINT_DEFAULT, ...selMask.point, h: h * 60, s: mx > 0 ? d / mx : 0, v: mx } });
  };
  // Auto tone: exposure for a good middle, then pull in clipping highlights and lift crushed shadows.
  const autoTone = () => {
    const st = stageApi.current.stats?.(s);
    if (!st) return;
    const look = LOOKS[s.profile] || LOOKS.adobe;
    const exposure = Math.round(Math.min(4, Math.max(-4, Math.log2(0.17 / st.median) - look.exposure)) * 20) / 20;
    const k = 2 ** (exposure + look.exposure);
    const hiStops = Math.log2(Math.max(st.p99 * k, 1e-4));
    const loStops = Math.log2(Math.max(st.p02 * k, 1e-5));
    const r = (v) => Math.round(Math.min(100, Math.max(-100, v)));
    update({
      exposure,
      contrast: r(st.spread < 6 ? 10 : st.spread > 9 ? -10 : 0),
      highlights: r(hiStops > -0.3 ? -(hiStops + 0.3) * 35 : 0),
      shadows: r(loStops < -6 ? (-6 - loStops) * 12 : 0),
      whites: r(hiStops < -0.8 ? (-0.8 - hiStops) * 20 : 0),
      blacks: r(loStops > -5 ? -(loStops + 5) * 10 : -5),
    });
  };
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

  const selMask = sel && s?.masks?.find((m) => m.id === sel.mask);
  const selPart = selMask && (selMask.parts.find((p) => p.id === sel.part) || selMask.parts[0]);
  const [maskOptions, setMaskOptions] = useStored('flightroom-mask-options', MASK_OPTIONS_DEFAULT);
  const acts = maskActions(s, update, sel, setSel, maskOptions);
  const [ensureAi, aiDialog] = useAiInstall();
  const aiMasks = useAiMasks({ photo, picture: () => stageApi.current.aiPicture?.(), acts, ensure: ensureAi, toast: setToast });
  const editing = selMask && !before && !crop;
  const picker = picking === 'wb' ? { tip: 'Click something white or grey to set the white balance (Esc to cancel)', fn: pick }
    : picking === 'point' && selMask ? { tip: 'Click a colour in the photo to change it with Point Color (Esc to cancel)', shown: true, fn: pickPoint } : null;

  // Keyboard, as in Lightroom where it makes sense.
  const stageApi = useRef({});
  const geoCache = useRef(null);
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
      if (k === 'w' && ratingForKey(keys, e.key) === undefined) { if (s) setPicking((p) => (p === 'wb' ? false : 'wb')); return; }
      if (k === 'g' && onCull && ratingForKey(keys, e.key) === undefined) { onCull(); return; }
      if (k === 'r') { if (s) setCrop((c) => !c); return; }
      // Masks: K brush, M linear, Shift+M radial, O overlay, [ ] brush size.
      const free = ratingForKey(keys, e.key) === undefined;
      if (s && free && !before) {
        if (k === 'k') { acts.create('brush'); return; }
        if (k === 'm') { acts.create(e.shiftKey ? 'radial' : 'linear'); return; }
        if (k === 'o') { setOverlay({ show: !overlay.show }); return; }
        if ((e.key === '[' || e.key === ']') && selPart?.type === 'brush') {
          setBrush({ size: Math.min(100, Math.max(1, brush.size + (e.key === ']' ? 5 : -5))) });
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selMask) { e.preventDefault(); acts.removePart(selMask.id, selPart.id); return; }
      }
      if (e.key === 'Escape') { if (picking) { setPicking(false); return; } if (selMask) { setSel(null); return; } setCrop(false); stageApi.current.unzoom?.(); return; }
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
  const geo = info && (geoCache.current?.info === info ? geoCache.current.geo : (geoCache.current = { info, geo: new Geometry(info.width, info.height, info.orientation) }).geo);
  const shown = s && before && opened?.asShot ? { ...defaults(opened.asShot), crop: s.crop } : s;
  // On the main photo: the mask overlay (when on) and Point Color's Visualize Range.
  const pointView = !!(maskOptions.visualize && selMask?.point);
  const mainMaskView = selMask && (overlay.show || pointView) ? { ...maskView(selMask, overlay), noOverlay: !overlay.show, point: pointView } : null;
  const onDenoised = (amount) => {
    setOpened((o) => (o?.info ? { ...o, info: { ...o.info, denoised: true } } : o));
    update({ aiDenoise: amount });
  };
  const curMeta = photo && meta[photo.id];
  const rating = photo ? photoRating(photo, curMeta) : 0;

  return (
    <div className="develop">
      <header className="cull-bar">
        <div className="grow cull-title">
          <div className="eyebrow">Develop</div>
          <div className="cull-folder" title={list?.folder || folder}>{photo ? photo.name : (list?.folder || folder).split(/[\\/]/).pop()}</div>
        </div>
        <Dropdown className={`cull-stars${filter !== 'all' ? ' on' : ''}`} value={filter} label={filter === 'all' ? 'Stars…' : undefined} onChange={setFilter} title="Show photos by star rating"
          options={starOptions} />
        <div className="cull-stats muted">{list?.loading ? 'Reading folder…' : `${photos.length ? index + 1 : 0} of ${photos.length}`}</div>
        <div className="dev-tools">
          {onCull && <button className="btn btn-sm btn-ghost" onClick={onCull} title="Back to Culling (G)"><Icon name="photo" size={14} />Culling</button>}
          <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={() => undo()} disabled={!s}><Icon name="undo" size={16} /></button>
          <button className="icon-btn" title="Redo (Ctrl+Y)" onClick={() => undo(true)} disabled={!s}><Icon name="redo" size={16} /></button>
          <button className={`btn btn-sm${before ? ' on' : ''}`} title="Before / after (\)" onClick={() => setBefore((b) => !b)} disabled={!s}><Icon name="compare" size={14} />{before ? 'Before' : 'After'}</button>
          <button className={`btn btn-sm${overlay.show ? ' on' : ''}`} title="Show the selected mask on the main photo (O)" onClick={() => setOverlay({ show: !overlay.show })} disabled={!s}><Icon name="mask" size={14} />Overlay</button>
          <button className={`btn btn-sm${crop ? ' btn-primary' : ''}`} title="Crop and straighten (R)" onClick={() => setCrop((c) => !c)} disabled={!s}><Icon name="crop" size={14} />{crop ? 'Done' : 'Crop'}</button>
          <button className="btn btn-sm btn-primary" onClick={() => setExporting({})} disabled={!s}><Icon name="export" size={14} />Export</button>
        </div>
      </header>
      <div className="dev-main">
        {layout.nav && <aside className="dev-left">
          <MaskPanel s={s && info ? s : null} size={geo} sel={selMask ? sel : null} setSel={setSel} acts={acts} overlay={overlay} setOverlay={setOverlay} ai={aiMasks} />
        </aside>}
        <PanelHandle side="left" open={layout.nav} onClick={() => toggle('nav')} title={`${layout.nav ? 'Hide' : 'Show'} masks (F7)`} />
        <div className="dev-stage-col">
          {photo && opened?.id === photo.id && opened.error ? (
            <div className="hero-empty dev-msg">
              <h2>{opened.error === 'notRaw' ? 'Develop edits RAW files' : "This photo can't be developed"}</h2>
              <p className="muted">{opened.error === 'notRaw' ? `${photo.name} is a JPEG. Pick a RAW file (NEF and most other cameras' RAW) to edit it here.` : opened.error}</p>
            </div>
          ) : photo ? (
            <DevelopStage key={photo.id} photo={photo} meta={curMeta} info={info} s={shown} cropMode={crop} cropOverlay={cropOverlay} clip={clip}
              onCrop={(c) => update({ crop: c })} apiRef={stageApi} nextPhoto={photos[index + 1]} before={before} picker={picker}
              maskView={editing ? mainMaskView : null} previewView={layout.nav ? maskView(selMask, overlay) || 'none' : null}
              maskTool={editing && selPart && !picker ? { part: selPart, brush, onPart: (patch) => acts.changePart(selMask.id, selPart.id, patch) } : null} />
          ) : (
            <div className="hero-empty dev-msg"><h2>{list?.loading ? 'Reading folder…' : filter !== 'all' && allPhotos.length ? 'No photos with those stars' : 'No photos in this folder'}</h2></div>
          )}
          <Filmstrip photos={photos} index={index} meta={meta} suggestions={{}} onSelect={go} requestMeta={requestMeta} />
        </div>
        <PanelHandle side="right" open={layout.panel} onClick={() => toggle('panel')} title={`${layout.panel ? 'Hide' : 'Show'} adjustments (F8)`} />
        {layout.panel && <aside className="dev-panel">
          {s && info ? (
            <Panel s={s} info={info} geo={geo} asShot={opened.asShot} update={update} meta={curMeta} rating={rating} keys={keys}
              onRate={(r) => rate(photo, r)} onReset={reset} onCopy={copy} onPaste={clipboard ? paste : null}
              cropMode={crop} cropOverlay={cropOverlay} setCropOverlay={setCropOverlay} onCropClose={() => setCrop(false)}
              override={selMask && <MaskAdjust m={selMask} part={selPart} acts={acts} brush={brush} setBrush={setBrush} options={maskOptions} setOptions={setMaskOptions}
                ai={aiMasks} sampling={picking === 'point'} onSample={() => setPicking((p) => (p === 'point' ? false : 'point'))} onDone={() => setSel(null)} />}
              photo={photo} ensureAi={ensureAi} onDenoised={onDenoised}
              edited={isEdited(s, opened.asShot)} picking={picking === 'wb'} onPick={() => setPicking((p) => (p === 'wb' ? false : 'wb'))} onAutoWb={autoWb} onAutoTone={autoTone} />
          ) : (
            <div className="dev-panel-empty muted small">{opened?.loading ? 'Reading RAW data…' : ''}</div>
          )}
        </aside>}
      </div>
      {toast && <div className="cull-toast">{toast}</div>}
      {aiDialog}
      {exporting && <ExportModal photo={photo} photos={allPhotos} folder={list?.folder} info={info} s={s} settingsCache={settingsCache.current}
        onClose={() => setExporting(null)} onDone={(msg) => { setExporting(null); setToast(msg); }} />}
    </div>
  );
}

// --- the photo ---------------------------------------------------------------

const PREVIEW_W = 224, PREVIEW_H = 168; // css px
const fitEdge = () => Math.min(4096, Math.round(Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1)));

async function fetchFrame(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return parseFrame(await res.arrayBuffer());
}

// Half floats (the RAW data's format) to numbers.
function halfTable() {
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const e = (h >> 10) & 31, m = h & 1023, sign = h & 0x8000 ? -1 : 1;
    t[h] = sign * (e === 0 ? m * 2 ** -24 : e === 31 ? (m ? NaN : Infinity) : (1 + m / 1024) * 2 ** (e - 15));
  }
  return t;
}
let h2f = null;

// A small copy of the photo's camera colours, for Auto and the white balance selector.
function sampleGrid(frame, edge = 320) {
  h2f ||= halfTable();
  const step = Math.max(1, Math.ceil(Math.max(frame.w, frame.h) / edge));
  const gw = Math.floor(frame.w / step), gh = Math.floor(frame.h / step);
  const out = new Float32Array(gw * gh * 3);
  const d = frame.data, half = Math.max(1, step >> 1);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let r = 0, g = 0, b = 0;
    for (const [dx, dy] of [[0, 0], [half, 0], [0, half], [half, half]]) {
      const i = ((y * step + dy) * frame.w + x * step + dx) * 3;
      r += h2f[d[i]]; g += h2f[d[i + 1]]; b += h2f[d[i + 2]];
    }
    const o = (y * gw + x) * 3;
    out[o] = r / 4; out[o + 1] = g / 4; out[o + 2] = b / 4;
  }
  return { gw, gh, data: out };
}

function DevelopStage({ photo, meta, info, s, cropMode, cropOverlay, clip, onCrop, apiRef, nextPhoto, before, picker, maskView, previewView, maskTool }) {
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
  const grid = useRef(null);
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

  // How much AI Denoise to show; slider moves are let settle before the photo is fetched again.
  const dnWant = info?.denoised ? (s?.aiDenoise || 0) : 0;
  const [dn, setDn] = useState(null);
  useEffect(() => {
    if (!info) return;
    if (dn === null) { setDn(dnWant); return; }
    const t = setTimeout(() => setDn(dnWant), 250);
    return () => clearTimeout(t);
  }, [!!info, dnWant]);

  // The whole photo, decoded from the RAW; then the next photo, ahead of time.
  useEffect(() => {
    if (!info || dn === null) return;
    let live = true;
    fetchFrame(app.develop.imageUrl(photo, fitEdge(), false, dn)).then((frame) => {
      if (!live || !rendererRef.current) return;
      rendererRef.current.setSource(frame);
      grid.current = sampleGrid(frame);
      setReady(true);
      if (nextPhoto?.raw) fetch(app.develop.imageUrl(nextPhoto, fitEdge(), true)).catch(() => {});
    }, (err) => live && setError(String(err.message || err)));
    return () => { live = false; };
  }, [!!info, dn]);

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
  // Where each point of the finished photo comes from (Transform and lens distortion).
  const xform = s && TRANSFORM_KEYS.map((k) => s[k]).join('|');
  const toSource = useMemo(() => geo && s && sourceMap(geo, s), [geo, xform]);
  const fit = frame && W ? fitScale(W, H, frame, cropMode ? 28 * dpr : 0) : 1;
  const v = !cropMode && view ? { scale: view.scale * dpr, u: view.u, v: view.v } : { scale: fit, u: 0, v: 0 };

  // Sharper pixels for the visible part when zoomed in.
  useEffect(() => {
    const r = rendererRef.current;
    // A new id also cancels a fetch still on its way from before an unzoom.
    const id = ++hiReq.current;
    if (!r || !ready || !geo || !frame) return;
    if (!view || cropMode) { r.clearHi(); return; }
    const t = setTimeout(async () => {
      const toPhoto = (x, y) => {
        const o2f = outToFrame(W, H, frame, v);
        const fx = o2f[0] * x + o2f[1] * y + o2f[2], fy = o2f[3] * x + o2f[4] * y + o2f[5];
        const a = (frame.angle * Math.PI) / 180;
        const ox = frame.cx + Math.cos(a) * fx * frame.hw - Math.sin(a) * fy * frame.hh;
        const oy = frame.cy + Math.sin(a) * fx * frame.hw + Math.cos(a) * fy * frame.hh;
        const [px, py] = toSource(ox, oy);
        return [px * geo.sw, py * geo.sh];
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
        const f = await fetchFrame(app.develop.regionUrl(photo, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, ow, oh }, dn));
        if (id !== hiReq.current || !rendererRef.current) return;
        const rect = [x0 / geo.sw, y0 / geo.sh, (x1 - x0) / geo.sw, (y1 - y0) / geo.sh];
        const inset = [3 / geo.sw, 3 / geo.sh];
        rendererRef.current.setHi(f, rect, [rect[0] + inset[0], rect[1] + inset[1], rect[2] - 2 * inset[0], rect[3] - 2 * inset[1]]);
        drawRef.current(); // the current view, not the one this fetch started from
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [ready, view, W, H, cropMode, frame, toSource, dn]);

  const draw = () => {
    const r = rendererRef.current;
    const c = canvasRef.current;
    if (!r || !ready || !s || !info || !frame || !W || !H) return;
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    r.render(info, s, geo, frame, outToFrame(W, H, frame, v), { showClip: clip, maskView });
  };

  const drawRef = useRef(draw);
  drawRef.current = draw;

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
  // The mask preview on the left: the whole photo with the selected mask.
  const previewKey = previewView && JSON.stringify(previewView);
  useEffect(() => {
    if (!ready || !s || !info || !geo || !previewView) return;
    const t = setTimeout(() => {
      const r = rendererRef.current;
      if (!r) return;
      const f = geo.frame(s.crop);
      const k = Math.min(PREVIEW_W / (2 * f.hw), PREVIEW_H / (2 * f.hh)) * dpr;
      const w = Math.max(8, Math.round(2 * f.hw * k)), h = Math.max(8, Math.round(2 * f.hh * k));
      const px = r.preview(info, s, geo, f, w, h, previewView === 'none' ? null : previewView);
      window.dispatchEvent(new CustomEvent('develop:preview', { detail: { w, h, px } }));
    }, 60);
    return () => clearTimeout(t);
  }, [ready, s, info, previewKey]);
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
  // Brightness spread at this white balance (linear, before the sliders).
  apiRef.current.stats = (st) => {
    const g = grid.current;
    if (!g) return null;
    const { wb, matrix: m } = colorTransform(info, st.temp, st.tint);
    const ys = new Float32Array(g.gw * g.gh);
    for (let i = 0; i < ys.length; i++) {
      const r = Math.min(1, g.data[i * 3] * wb[0]), gg = Math.min(1, g.data[i * 3 + 1] * wb[1]), b = Math.min(1, g.data[i * 3 + 2] * wb[2]);
      const lr = m[0] * r + m[1] * gg + m[2] * b, lg = m[3] * r + m[4] * gg + m[5] * b, lb = m[6] * r + m[7] * gg + m[8] * b;
      ys[i] = Math.max(1e-5, 0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
    }
    ys.sort();
    const at = (q) => ys[Math.min(ys.length - 1, Math.floor(ys.length * q))];
    return { median: at(0.5), p99: at(0.99), p02: at(0.02), spread: Math.log2(at(0.99) / at(0.02)) };
  };
  // Average camera colour of the parts that are neither clipped nor near black (grey world).
  // The photo upright and uncropped, without Transform or masks, at mask size:
  // what AI masks are worked out from (RGBA, bottom row first).
  apiRef.current.aiPicture = () => {
    const r = rendererRef.current;
    if (!r || !ready || !s || !info) return null;
    const k = MASK_EDGE / Math.max(geo.ow, geo.oh);
    const w = Math.round(geo.ow * k), h = Math.round(geo.oh * k);
    const flat = { ...s, crop: null, masks: [], ...Object.fromEntries(TRANSFORM_KEYS.map((key) => [key, SLIDER[key].def])) };
    return { w, h, rgba: r.preview(info, flat, geo, geo.frame(null), w, h, null) };
  };
  apiRef.current.average = () => {
    const g = grid.current;
    if (!g) return null;
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < g.gw * g.gh; i++) {
      const r = g.data[i * 3], gg = g.data[i * 3 + 1], b = g.data[i * 3 + 2];
      const mx = Math.max(r, gg, b);
      if (mx > 0.97 || mx < 0.01) continue;
      sum[0] += r; sum[1] += gg; sum[2] += b; n++;
    }
    return n ? sum.map((v) => v / n) : null;
  };
  // The camera colour under a point of the canvas (css px).
  const colorAt = (cssX, cssY) => {
    const g = grid.current;
    if (!g || !frame || !toSource) return null;
    const f = ap(outToFrame(W, H, frame, v), cssX * dpr, H - cssY * dpr);
    const [u, w] = toSource(...ap(geo.frameToOriented(frame), f[0], f[1]));
    if (u < 0 || w < 0 || u > 1 || w > 1) return null;
    const cx = Math.round(u * (g.gw - 1)), cy = Math.round(w * (g.gh - 1));
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= g.gw || y >= g.gh) continue;
      const i = (y * g.gw + x) * 3;
      sum[0] += g.data[i]; sum[1] += g.data[i + 1]; sum[2] += g.data[i + 2]; n++;
    }
    return sum.map((c) => c / n);
  };

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
    if (picker) {
      const rect = canvasRef.current.getBoundingClientRect();
      const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];
      if (!picker.shown) { picker.fn(colorAt(x, y)); return; }
      // The colour as it looks: drawn now, then read back from the canvas.
      draw();
      picker.fn(rendererRef.current.readShown(Math.round(x * dpr), Math.round(H - y * dpr)));
      return;
    }
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

  // Stage css px <-> oriented photo px, for drawing masks.
  const css2ori = frame && W ? mm(geo.frameToOriented(frame), mm(outToFrame(W, H, frame, v), mat(dpr, 0, 0, 0, -dpr, H))) : null;
  const ori2css = css2ori && inv3(css2ori);

  const rot = ROTATION[meta?.orientation] || 0;
  const pct = Math.round(((view ? view.scale : fit / dpr) * dpr) * 100);
  return (
    <div className={`stage dev-stage${view ? ' zoomed' : ''}${cropMode ? ' cropping' : ''}${picker ? ' picking' : ''}`} ref={wrapRef} onWheel={onWheel}>
      {picker && <div className="dev-pick-tip">{picker.tip}</div>}
      {!ready && (
        <img className="dev-placeholder" src={imgUrl('preview', photo.id)} alt="" draggable={false}
          style={rot ? { transform: `rotate(${rot}deg)`, maxWidth: rot % 180 ? size.h : undefined, maxHeight: rot % 180 ? size.w : undefined } : undefined} />
      )}
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h, opacity: ready ? 1 : 0 }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      <div className="stage-top">
        {!ready && !error && <span className="pill-mini">Loading RAW…</span>}
        {ready && <span className="pill-mini">{before ? 'Before' : 'RAW'} · {pct}%</span>}
        {clip && <span className="pill-mini clip">Clipping shown (J)</span>}
      </div>
      {error && <div className="stage-error"><b>Can't show the RAW here.</b> {error}. You're seeing the camera's preview instead.</div>}
      {maskTool && !cropMode && ready && css2ori && maskTool.part.type !== 'luminance' && maskTool.part.type !== 'ai' && (
        <MaskOverlay geo={geo} part={maskTool.part} brush={maskTool.brush} onPart={maskTool.onPart}
          toOri={(x, y) => ap(css2ori, x, y)} toCss={(x, y) => ap(ori2css, x, y)} />
      )}
      {cropMode && ready && frame && geo && s && (
        <CropOverlay geo={geo} view={frame} k={v.scale / dpr} size={size} crop={s.crop} onChange={onCrop} overlay={cropOverlay} />
      )}
    </div>
  );
}

// --- crop --------------------------------------------------------------------

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

// Aspect and angle changes, shared by the crop panel and the crop frame on the photo.
// aspect: undefined = the photo's own shape, 0 = free, else width / height.
function cropTools(geo, crop, onChange) {
  const f = geo.frame(crop);
  const aspect = crop?.aspect;
  return {
    f, aspect,
    setAngle: (angle) => onChange({ ...geo.toCrop(fitInside(geo, { ...f, angle })), aspect }),
    setAspect: (ratio) => {
      if (ratio === null) { onChange({ ...geo.toCrop(fitInside(geo, { ...f, hh: f.hw / (geo.ow / geo.oh) })), aspect: undefined }); return; }
      if (!ratio) { onChange({ ...geo.toCrop(f), aspect: 0 }); return; }
      const r = f.hw >= f.hh ? Math.max(ratio, 1 / ratio) : Math.min(ratio, 1 / ratio);
      onChange({ ...geo.toCrop(fitInside(geo, { ...f, hh: f.hw / r })), aspect: r });
    },
  };
}

function CropOverlay({ geo, view, k, size, crop, onChange, overlay }) {
  const f = geo.frame(crop);
  // Screen (css px, from the centre of the stage) <-> oriented px, for a view turned by its angle.
  const a = (view.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const toScreen = (x, y) => { const dx = x - view.cx, dy = y - view.cy; return [(c * dx + s * dy) * k + size.w / 2, (-s * dx + c * dy) * k + size.h / 2]; };
  const fromScreen = (X, Y) => { const dx = (X - size.w / 2) / k, dy = (Y - size.h / 2) / k; return [view.cx + c * dx - s * dy, view.cy + s * dx + c * dy]; };
  const [cx, cy] = toScreen(f.cx, f.cy);
  const box = { left: cx - f.hw * k, top: cy - f.hh * k, width: 2 * f.hw * k, height: 2 * f.hh * k };
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const aspect = crop?.aspect;

  const begin = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, box: { ...box } };
    setDragging(true);
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
  const end = () => { drag.current = null; setDragging(false); };

  const handles = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
  const grid = overlay === 'always' || (overlay === 'auto' && dragging);
  return (
    <>
      <div className="crop-shade" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.left}px ${box.top}px, ${box.left}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top}px, ${box.left}px ${box.top}px)` }} />
      <div className="crop-box" style={box} onPointerDown={(e) => begin(e, 'move')} onPointerMove={move} onPointerUp={end}>
        {grid && <div className="crop-grid" />}
        {handles.map((h) => <div key={h} className={`crop-handle ${h}`} onPointerDown={(e) => begin(e, h)} onPointerMove={move} onPointerUp={end} />)}
      </div>
    </>
  );
}

// Lightroom's Crop & Straighten tool, at the top of the panel while cropping.
const CROP_ASPECTS = [['orig', 'Original', null], ['free', 'Custom', 0], ['1:1', '1 x 1', 1], ['4:5', '4 x 5 / 8 x 10', 4 / 5], ['8.5:11', '8.5 x 11', 8.5 / 11], ['5:7', '5 x 7', 5 / 7], ['2:3', '2 x 3 / 4 x 6', 2 / 3], ['4:3', '4 x 3', 3 / 4], ['16:9', '16 x 9', 9 / 16], ['16:10', '16 x 10', 10 / 16]];
const OVERLAYS = [['always', 'Always'], ['auto', 'Auto'], ['never', 'Never']];
const ANGLE = { key: 'angle', label: 'Angle', min: -45, max: 45, step: 0.01, def: 0, decimals: 2 };

function CropPanel({ s, geo, update, overlay, setOverlay, onClose }) {
  const onChange = (c) => update({ crop: c });
  const { f, aspect, setAngle, setAspect } = cropTools(geo, s.crop, onChange);
  const ratio = (r) => Math.max(r, 1 / r);
  const current = aspect === undefined ? 'orig' : aspect === 0 ? 'free'
    : (CROP_ASPECTS.find(([, , r]) => r && Math.abs(ratio(r) - ratio(aspect)) < 1e-3)?.[0] || 'free');
  const locked = aspect !== 0;
  const toggleLock = () => {
    if (locked) onChange({ ...geo.toCrop(f), aspect: 0 });
    else onChange({ ...geo.toCrop(f), aspect: f.hw / f.hh });
  };
  return (
    <section className="dev-section open dev-tool">
      <div className="dev-section-head"><span className="grow">Crop &amp; straighten</span></div>
      <div className="dev-section-body">
        <div className="dev-line dev-wb"><span className="muted">Aspect</span>
          <span className="dev-line">
            <Dropdown value={current} options={CROP_ASPECTS.map(([value, label]) => ({ value, label }))}
              onChange={(v) => setAspect(CROP_ASPECTS.find(([k]) => k === v)[2])} />
            <button className={`icon-btn sm${locked ? ' on' : ''}`} onClick={toggleLock} title={locked ? 'Aspect locked: click to crop freely' : 'Lock the aspect'}><Icon name={locked ? 'lock' : 'unlock'} size={14} /></button>
          </span>
        </div>
        <Slider sl={ANGLE} value={f.angle} def={0} onSet={(_, v) => setAngle(v)} />
        <label className="dev-check"><input type="checkbox" checked={!!s.constrainCrop}
          onChange={(e) => update((old) => ({ ...old, constrainCrop: e.target.checked, crop: e.target.checked ? constrainedCrop(geo, old) : old.crop }))} />Constrain to image</label>
        <div className="dev-line dev-wb"><span className="muted">Tool overlay</span>
          <Dropdown value={overlay} options={OVERLAYS.map(([value, label]) => ({ value, label }))} onChange={setOverlay} />
        </div>
        <div className="dev-line dev-tool-foot">
          <button className="btn btn-sm btn-ghost" onClick={() => onChange(null)} disabled={!s.crop}>Reset</button>
          <button className="btn btn-sm" onClick={onClose} title="Enter">Close</button>
        </div>
      </div>
    </section>
  );
}

// --- the panel ---------------------------------------------------------------

const PANELS_KEY = 'flightroom-develop-panels';

function Panel({ s, info, geo, asShot, update, meta, rating, keys, onRate, onReset, onCopy, onPaste, edited, picking, onPick, onAutoWb, onAutoTone, cropMode, cropOverlay, setCropOverlay, onCropClose, override, photo, ensureAi, onDenoised }) {
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PANELS_KEY)) || { basic: true }; } catch { return { basic: true }; }
  });
  const toggleSection = (id) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem(PANELS_KEY, JSON.stringify(n)); } catch {} return n; });

  // One stable setter for every slider, so moving one redraws only that one.
  const set = useCallback((k, v) => update((old) => {
    const n = { ...old, [k]: v };
    if (k === 'temp' || k === 'tint') n.wb = 'Custom';
    if (n.constrainCrop && TRANSFORM_KEYS.includes(k)) n.crop = constrainedCrop(geo, n);
    return n;
  }), [update, geo]);

  const pickWb = (name) => {
    if (name === 'Auto') { onAutoWb(); return; }
    const p = WB_PRESETS.find(([n]) => n === name);
    if (name === 'As Shot') update({ wb: name, temp: asShot.temp, tint: asShot.tint });
    else if (p?.[1]) update({ wb: name, temp: p[1], tint: p[2] });
    else update({ wb: name });
  };

  const bodies = {
    basic: () => (
      <>
        <div className="dev-line"><span className="muted">Treatment</span>
          <div className="seg small">
            <button className={!s.bw ? 'on' : ''} onClick={() => update({ bw: false })}>Color</button>
            <button className={s.bw ? 'on' : ''} onClick={() => update({ bw: true })}>B&amp;W</button>
          </div>
        </div>
        <div className="dev-line dev-wb"><span className="muted">Profile</span>
          <Dropdown value={s.profile || 'adobe'} options={PROFILES.map(([value, label]) => ({ value, label }))} onChange={(v) => update({ profile: v })} title="The starting look, as in Lightroom" />
        </div>
        <div className="dev-line dev-wb"><span className="muted">WB</span>
          <span className="dev-line">
            <button className={`icon-btn sm${picking ? ' on' : ''}`} onClick={onPick} title="White balance selector (W): click something white or grey"><Icon name="picker" size={15} /></button>
            <Dropdown value={s.wb} options={WB_PRESETS.map(([value]) => ({ value, label: value }))} onChange={pickWb} />
          </span>
        </div>
        <Groups sec={SECTION.basic} s={s} asShot={asShot} set={set} extra={{ Tone: <button className="btn btn-sm btn-ghost" onClick={onAutoTone} title="Set the tone sliders for this photo">Auto</button> }} />
      </>
    ),
    curve: () => <ToneCurve s={s} set={set} update={update} />,
    color: () => <ColorMixer s={s} set={set} />,
    grading: () => <><ColorGrading s={s} set={set} /><Groups sec={SECTION.grading} s={s} asShot={asShot} set={set} /></>,
    detail: () => <><AiDenoise photo={photo} info={info} s={s} set={set} ensure={ensureAi} onDenoised={onDenoised} /><Groups sec={SECTION.detail} s={s} asShot={asShot} set={set} /></>,
    lens: () => (
      <>
        <label className="dev-check"><input type="checkbox" checked={!!s.removeCA} onChange={(e) => update({ removeCA: e.target.checked })} />Remove chromatic aberration</label>
        <label className="dev-check"><input type="checkbox" checked={!!s.lensProfile} onChange={(e) => update({ lensProfile: e.target.checked })} />Enable profile corrections</label>
        {s.lensProfile && <p className="muted small">Lightroom applies your lens's profile when it reads this photo. Flightroom doesn't preview it yet; use the sliders below to see it here.</p>}
        <Groups sec={SECTION.lens} s={s} asShot={asShot} set={set} />
      </>
    ),
    transform: () => (
      <>
        <Groups sec={SECTION.transform} s={s} asShot={asShot} set={set} />
        <label className="dev-check"><input type="checkbox" checked={!!s.constrainCrop}
          onChange={(e) => update((old) => ({ ...old, constrainCrop: e.target.checked, crop: e.target.checked ? constrainedCrop(geo, old) : old.crop }))} />Constrain crop</label>
      </>
    ),
    effects: () => (
      <>
        <div className="dev-line dev-wb"><span className="muted">Style</span>
          <Dropdown value={s.vignetteStyle || 1} options={VIGNETTE_STYLES.map(([value, label]) => ({ value, label }))} onChange={(v) => update({ vignetteStyle: v })} />
        </div>
        <Groups sec={SECTION.effects} s={s} asShot={asShot} set={set} hide={s.vignetteStyle === 3 ? ['vignetteHighlights'] : []} />
      </>
    ),
    calibration: () => <Groups sec={SECTION.calibration} s={s} asShot={asShot} set={set} />,
  };

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
        <button className="btn btn-sm" onClick={onReset} disabled={!edited} title="Back to how the camera shot it">Reset all</button>
      </div>
      {cropMode && <CropPanel s={s} geo={geo} update={update} overlay={cropOverlay} setOverlay={setCropOverlay} onClose={onCropClose} />}
      {override || SECTIONS.map((sec) => {
        const changed = sectionEdited(s, sec.id, asShot);
        return (
          <section key={sec.id} className={`dev-section${open[sec.id] ? ' open' : ''}`}>
            <div className="dev-section-head" role="button" tabIndex={0} onClick={() => toggleSection(sec.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') toggleSection(sec.id); }}>
              {changed && !open[sec.id] && <span className="dev-dot" title="Edited" />}
              <span className="grow">{sec.title}</span>
              <span className={`dev-reset${changed ? ' on' : ''}`} role="button" title={`Reset ${sec.title}`}
                onClick={(e) => { e.stopPropagation(); update((old) => resetSection(old, sec.id, asShot)); }}><Icon name="reset" size={13} /></span>
              <span className="dev-caret">{open[sec.id] ? '▾' : '▸'}</span>
            </div>
            {open[sec.id] && <div className="dev-section-body">{bodies[sec.id]()}</div>}
          </section>
        );
      })}
      <p className="muted small dev-note">Edits are saved next to each photo (.xmp), where Lightroom reads them. Your RAW files are never changed.</p>
    </div>
  );
}

const SECTION = Object.fromEntries(SECTIONS.map((sec) => [sec.id, sec]));

// A section's plain sliders, in their groups. `extra` puts something beside a group's title.
function Groups({ sec, s, asShot, set, only, hide = [], extra = {} }) {
  const groups = only ? sec.groups.filter(only) : sec.groups;
  return groups.map((g) => (
    <div key={g.title} className="dev-group">
      {sec.groups.length > 1 || g.title !== sec.title ? (
        <div className="dev-group-title dev-line">{g.title}{extra[g.title]}</div>
      ) : null}
      {g.sliders.filter((sl) => !hide.includes(sl.key)).map((sl) => (
        <Slider key={sl.key} sl={sl} value={s[sl.key]} def={sl.key === 'temp' ? asShot.temp : sl.key === 'tint' ? asShot.tint : sl.def} onSet={set} />
      ))}
    </div>
  ));
}

const fmtShutter = (t) => (!t ? null : t >= 1 ? `${+t.toFixed(1)}s` : `1/${Math.round(1 / t)}`);
function ShotLine({ meta }) {
  if (!meta || meta.error) return null;
  return <span className="muted">{[meta.iso && `ISO ${meta.iso}`, meta.focalLength && `${Math.round(meta.focalLength)}mm`, meta.fNumber && `f/${+meta.fNumber.toFixed(1)}`, fmtShutter(meta.exposure)].filter(Boolean).join('  ')}</span>;
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

// --- tone curve ----------------------------------------------------------------

const CURVE_MODES = [['parametric', 'Parametric'], ['curve', 'Point'], ['curveR', 'Red'], ['curveG', 'Green'], ['curveB', 'Blue']];

function ToneCurve({ s, set, update }) {
  const [mode, setMode] = useState(() => localStorage.getItem('flightroom-curve-mode') || 'parametric');
  const pick = (m) => { setMode(m); try { localStorage.setItem('flightroom-curve-mode', m); } catch {} };
  const parametricMode = mode === 'parametric';
  return (
    <>
      <div className="seg small full">
        {CURVE_MODES.map(([k, label]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => pick(k)}>{label}</button>)}
      </div>
      <CurveEditor s={s} channel={parametricMode ? 'curve' : mode} readOnly={parametricMode} set={set} />
      {mode === 'curve' && (
        <div className="dev-line dev-wb"><span className="muted">Point curve</span>
          <Dropdown value={curveName(s.curve)} options={[...CURVE_PRESETS.map(([value]) => ({ value, label: value })), ...(curveName(s.curve) === 'Custom' ? [{ value: 'Custom', label: 'Custom', disabled: true }] : [])]}
            onChange={(v) => update({ curve: CURVE_PRESETS.find(([n]) => n === v)[1] })} />
        </div>
      )}
      <Groups sec={SECTION.curve} s={s} asShot={null} set={set} only={(g) => parametricMode || !g.parametric} />
    </>
  );
}

// --- color mixer -----------------------------------------------------------------

const SWATCH = COLOR_HUES.map((h) => `hsl(${h} 80% 55%)`);
const MIXER_MODES = [['color', 'Color'], ['hue', 'Hue'], ['sat', 'Saturation'], ['lum', 'Luminance'], ['all', 'All']];
const KIND_LABEL = { hue: 'Hue', sat: 'Saturation', lum: 'Luminance' };

function ColorMixer({ s, set }) {
  const [mode, setMode] = useState(() => localStorage.getItem('flightroom-mixer-mode') || 'color');
  const [color, setColor] = useState(0);
  const pick = (m) => { setMode(m); try { localStorage.setItem('flightroom-mixer-mode', m); } catch {} };
  if (s.bw) {
    return (
      <div className="dev-mixer">
        <div className="dev-group-title">Black &amp; white mix</div>
        {COLORS.map((c, i) => <Slider key={i} sl={SLIDER[`gray${i}`]} value={s[`gray${i}`]} def={0} color={SWATCH[i]} onSet={set} />)}
      </div>
    );
  }
  const row = (kind, i, label) => {
    const sl = SLIDER[`${kind}${i}`];
    return <Slider key={sl.key} sl={label ? { ...sl, label } : sl} value={s[sl.key]} def={0} color={SWATCH[i]} onSet={set} />;
  };
  return (
    <div className="dev-mixer">
      <div className="dev-line dev-wb"><span className="muted">Adjust</span>
        <Dropdown value={mode} options={MIXER_MODES.map(([value, label]) => ({ value, label }))} onChange={pick} />
      </div>
      {mode === 'color' ? (
        <>
          <div className="dev-dots">
            {COLORS.map((c, i) => (
              <button key={c} title={c} style={{ background: SWATCH[i] }} onClick={() => setColor(i)}
                className={`${color === i ? 'on' : ''}${s[`hue${i}`] || s[`sat${i}`] || s[`lum${i}`] ? ' edited' : ''}`} />
            ))}
          </div>
          {['hue', 'sat', 'lum'].map((k) => row(k, color, KIND_LABEL[k]))}
        </>
      ) : mode === 'all' ? (
        ['hue', 'sat', 'lum'].map((k) => (
          <div key={k} className="dev-group"><div className="dev-group-title">{KIND_LABEL[k]}</div>{COLORS.map((c, i) => row(k, i))}</div>
        ))
      ) : COLORS.map((c, i) => row(mode, i))}
    </div>
  );
}

// --- color grading ---------------------------------------------------------------

const WHEELS = [['gMid', 'Midtones'], ['gShadow', 'Shadows'], ['gHigh', 'Highlights'], ['gGlobal', 'Global']];
const GRADE_VIEWS = [['3way', '3-Way'], ['gShadow', 'Shadows'], ['gMid', 'Midtones'], ['gHigh', 'Highlights'], ['gGlobal', 'Global']];

function ColorGrading({ s, set }) {
  const [view, setView] = useState('3way');
  const wheels = view === '3way' ? WHEELS.slice(0, 3) : WHEELS.filter(([k]) => k === view);
  return (
    <>
      <div className="seg small full">
        {GRADE_VIEWS.map(([k, label]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{label}</button>)}
      </div>
      <div className={`dev-wheels${view === '3way' ? '' : ' one'}`}>
        {wheels.map(([k, title]) => <Wheel key={k} k={k} title={title} s={s} set={set} big={view !== '3way'} />)}
      </div>
    </>
  );
}

// Hue is the angle, saturation the distance from the centre. Shift-drag changes only saturation.
function Wheel({ k, title, s, set, big }) {
  const ref = useRef();
  const hue = s[`${k}Hue`] || 0, sat = s[`${k}Sat`] || 0;
  const drag = useRef(null);
  const at = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
    let h = Math.round((Math.atan2(-y, x) * 180) / Math.PI);
    if (h < 0) h += 360;
    return [h % 360, Math.min(100, Math.round(Math.hypot(x, y) * 100))];
  };
  const apply = (e) => {
    const [h, sa] = at(e);
    if (!e.shiftKey) set(`${k}Hue`, h);
    set(`${k}Sat`, sa);
  };
  const a = (hue * Math.PI) / 180, r = sat / 100;
  return (
    <div className={`dev-wheel${k === 'gMid' ? ' wheel-mid' : ''}`}>
      <div className="dev-wheel-title">{title}</div>
      <div className="dev-wheel-disc" ref={ref} title="Drag to tint; double-click to reset"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = true; apply(e); }}
        onPointerMove={(e) => drag.current && apply(e)} onPointerUp={() => { drag.current = null; }}
        onDoubleClick={() => { set(`${k}Hue`, 0); set(`${k}Sat`, 0); }}>
        <span className="dev-wheel-knob" style={{ left: `${50 + Math.cos(a) * r * 50}%`, top: `${50 - Math.sin(a) * r * 50}%` }} />
      </div>
      <div className="dev-wheel-read">H {hue}  ·  S {sat}</div>
      {big && <><Slider sl={SLIDER[`${k}Hue`]} value={hue} def={0} onSet={set} /><Slider sl={SLIDER[`${k}Sat`]} value={sat} def={0} onSet={set} /></>}
      <Slider sl={{ ...SLIDER[`${k}Lum`], gradient: 'lum' }} value={s[`${k}Lum`]} def={0} onSet={set} />
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
          pS = settingsCache.get(p.id) || fromXmp(pInfo.settings, pInfo.curves, asShotTempTint(pInfo), pInfo.own);
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
          <div className="export-row"><span>Photos</span>
            <Dropdown value={which} onChange={setWhich} options={[
              { value: 'this', label: `This photo (${photo.name})` },
              { value: 'rated', label: 'Rated photos in this folder', hint: rated.length, disabled: !rated.length },
              { value: 'edited', label: 'Photos edited this session', hint: edited.length, disabled: !edited.length },
            ]} />
          </div>
          <div className="export-row"><span>Size</span>
            <Dropdown value={longEdge} onChange={setLongEdge} options={SIZES.map(([label, value]) => ({ value, label }))} />
            {which === 'this' && <span className="muted small">{size.w} × {size.h}</span>}
          </div>
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
