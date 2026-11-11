import { bridge as app } from '../bridge.js';
import { useEffect, useRef, useState } from 'react';
import { GearCard, useGearFilter } from './gear.jsx';
import { Dropdown, Icon, Modal } from './ui.jsx';
import { EDITING_APPS } from '../data/software.js';
import { START_PAGES } from './home.jsx';
import { screenColorOn, screenProfile, setScreenColor } from '../develop/icc.js';
import { graphicsMode, graphicsState, setGraphicsMode } from '../develop/graphics.js';
import { enginePref, setEnginePref } from '../develop/gpu/engine.js';
import { aiNotifyOn, setAiNotify } from '../notify.js';
import { DEFAULT_RATING_KEYS, DEFAULT_ZOOM_KEY, RESERVED_KEYS, ZOOM_LEVELS, assignKey, keyLabel, normKey, ratingForKey, ratingKeys, zoomKey, zoomLevel } from '../cull/keys.js';

export function MyGearView({ store, onOpenGear, onBrowse, onCustom }) {
  const { gear, state, actions } = store;
  const mine = gear.filter((g) => state.owned.includes(g.id));
  const { filtered, bar } = useGearFilter(mine);
  const counts = { body: 0, lens: 0, accessory: 0 };
  mine.forEach((g) => counts[g.type]++);
  return (
    <div className="view">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Library</div>
          <h1>My Gear</h1>
          <p className="muted">{counts.body} {counts.body === 1 ? 'body' : 'bodies'} · {counts.lens} {counts.lens === 1 ? 'lens' : 'lenses'} · {counts.accessory} {counts.accessory === 1 ? 'accessory' : 'accessories'}</p>
        </div>
        <button className="btn" onClick={onCustom}><Icon name="edit" size={16} />Add custom gear</button>
        <button className="btn btn-primary" onClick={onBrowse}><Icon name="plus" size={16} />Add from catalog</button>
      </header>
      {mine.length === 0 ? (
        <div className="hero-empty">
          <div className="hero-icon"><Icon name="bag" size={40} /></div>
          <h2>Your bag is empty</h2>
          <p className="muted">Add the cameras, lenses and accessories you own. Each one shows its full specs, and presets check how they work together.</p>
          <div className="row"><button className="btn btn-primary" onClick={onBrowse}>Browse the catalog</button><button className="btn" onClick={onCustom}>Add something not listed</button></div>
        </div>
      ) : (
        <>
          {bar}
          <div className="gear-grid">{filtered.map((g) => <GearCard key={g.id} item={g} owned onOpen={onOpenGear} onToggleOwned={actions.toggleOwned} />)}</div>
        </>
      )}
    </div>
  );
}

export function CatalogView({ store, onOpenGear, onCustom }) {
  const { gear, state, actions } = store;
  const { filtered, bar } = useGearFilter(gear);
  return (
    <div className="view">
      <header className="view-head">
        <div className="grow">
          <div className="eyebrow">Library</div>
          <h1>Gear catalog</h1>
          <p className="muted">{gear.length} items. Click one for full specs, or add it to My Gear.</p>
        </div>
        <button className="btn btn-primary" onClick={onCustom}><Icon name="plus" size={16} />Add custom gear</button>
      </header>
      {bar}
      <div className="gear-grid">
        {filtered.map((g) => {
          const owned = state.owned.includes(g.id);
          return (
            <GearCard key={g.id} item={g} owned={owned} onOpen={onOpenGear} onToggleOwned={actions.toggleOwned}
              action={<button className={`icon-btn gear-own${owned ? ' on' : ''}`} onClick={() => actions.toggleOwned(g.id)} title={owned ? 'In My Gear (click to remove)' : 'Add to My Gear'}>
                <Icon name={owned ? 'check' : 'plus'} size={16} /></button>} />
          );
        })}
      </div>
    </div>
  );
}

// Version and background update status, from the desktop app (absent in a browser).
function UpdatesCard() {
  const bridge = app;
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!bridge) return;
    bridge.getVersion().then(setVersion);
    bridge.getUpdateStatus().then(setStatus);
    return bridge.onUpdateStatus(setStatus);
  }, [bridge]);
  if (!bridge) return null;
  const busy = status?.state === 'checking' || status?.state === 'downloading';
  return (
    <section className="card">
      <h3 className="section-title">App updates</h3>
      <div className="update-row">
        <div className="grow">
          <div className="update-version">Flightroom {version}</div>
          <div className={`muted small update-${status?.state || 'idle'}`}>{status?.message || 'Not checked yet'}</div>
        </div>
        {status?.state === 'ready'
          ? <button className="btn btn-primary" onClick={() => bridge.installUpdate()}><Icon name="refresh" size={16} />Restart now</button>
          : status?.state === 'available'
          ? <button className="btn btn-primary" onClick={() => bridge.downloadUpdate()}><Icon name="refresh" size={16} />Update</button>
          : <button className="btn" disabled={busy} onClick={() => bridge.checkForUpdates()}><Icon name="refresh" size={16} />Check now</button>}
      </div>
      <p className="muted small">Fixes download in the background and install when you close the app. A new major version (like 3.0) waits until you choose Update.</p>
    </section>
  );
}

const fmtBytes = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

// Rating shortcuts, auto-advance and the thumbnail cache for the Culling tab.
function CullingCard({ store }) {
  const { state, actions } = store;
  const bridge = app?.cull;
  const keys = ratingKeys(state.settings);
  const zKey = zoomKey(state.settings);
  const [listening, setListening] = useState(null); // rating (or 'zoom') waiting for a key press
  const [note, setNote] = useState('');
  const [cache, setCache] = useState(null);

  useEffect(() => { bridge?.cacheSize().then(setCache); }, [bridge]);

  useEffect(() => {
    if (listening === null) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setListening(null); return; }
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(e.key)) return;
      if (RESERVED_KEYS.includes(normKey(e.key)) || RESERVED_KEYS.includes(e.key)) {
        setNote(`${keyLabel(e.key)} is used for moving around or zooming. Pick another key.`);
        return;
      }
      if (listening === 'zoom') {
        const used = ratingForKey(keys, e.key);
        if (used !== undefined) { setNote(`${keyLabel(e.key)} already sets ${used ? `${used} star${used > 1 ? 's' : ''}` : 'no rating'}. Pick another key.`); return; }
        actions.setCullSettings({ cullZoomKey: normKey(e.key) });
      } else {
        if (normKey(e.key) === zKey) { setNote(`${keyLabel(e.key)} is the zoom key. Pick another key.`); return; }
        actions.setCullSettings({ cullKeys: assignKey(keys, listening, e.key) });
      }
      setNote('');
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, keys, zKey]);

  const rows = [1, 2, 3, 4, 5, 0];
  const isDefault = rows.every((r) => keys[r] === DEFAULT_RATING_KEYS[r]) && zKey === DEFAULT_ZOOM_KEY;
  return (
    <section className="card">
      <h3 className="section-title">Culling</h3>
      <p className="muted">Keys that set star ratings. Click a key, then press the one you want. The number row and the number pad both work for the default keys.</p>
      <div className="key-grid">
        {rows.map((r) => (
          <div key={r} className="key-row">
            <span className="key-name">{r ? <span className="key-stars">{'★'.repeat(r)}<span className="dim">{'★'.repeat(5 - r)}</span></span> : 'Clear rating'}</span>
            <button className={`keycap${listening === r ? ' listening' : ''}`} onClick={() => { setListening(listening === r ? null : r); setNote(''); }}>
              {listening === r ? 'Press a key…' : keyLabel(keys[r])}
            </button>
          </div>
        ))}
        <div className="key-row">
          <span className="key-name">Zoom in / out</span>
          <button className={`keycap${listening === 'zoom' ? ' listening' : ''}`} onClick={() => { setListening(listening === 'zoom' ? null : 'zoom'); setNote(''); }}>
            {listening === 'zoom' ? 'Press a key…' : keyLabel(zKey)}
          </button>
        </div>
      </div>
      {note && <p className="small warn-text">{note}</p>}
      <div className="row cull-settings-row">
        <button className="btn btn-sm" disabled={isDefault} onClick={() => actions.setCullSettings({ cullKeys: { ...DEFAULT_RATING_KEYS }, cullZoomKey: DEFAULT_ZOOM_KEY })}>Reset keys</button>
      </div>
      <div className="zoom-setting">
        <span>Zoom amount</span>
        <div className="seg small">
          {ZOOM_LEVELS.map((z) => (
            <button key={z} className={zoomLevel(state.settings) === z ? 'on' : ''} onClick={() => actions.setCullSettings({ cullZoom: z })}>{z}%</button>
          ))}
        </div>
      </div>
      <p className="muted small">100% shows every pixel of the photo, which is best for checking focus. 200% and up magnify further.</p>
      <label className="toggle-row big">
        <input type="checkbox" checked={!!state.settings.cullAdvance} onChange={() => actions.setCullSettings({ cullAdvance: !state.settings.cullAdvance })} />
        <span>Go to the next photo after rating</span>
      </label>
      <p className="muted small">Other keys: ← → move between photos, Home / End jump to the first or last, Esc zooms back out. Clicking the photo zooms in on the spot you clicked, and dragging moves around.</p>
      <p className="muted small">Stars are written to an .xmp file next to each RAW photo (for example JWL_5769.xmp), the standard Lightroom, Bridge and Capture One read. The RAW file itself is never changed. JPEGs without a RAW keep their stars inside the file.</p>
      {bridge && (
        <div className="update-row cull-cache">
          <div className="grow">
            <div>Thumbnail cache</div>
            <div className="muted small">{cache ? `${cache.files} thumbnails · ${fmtBytes(cache.bytes || 0)}` : '…'}</div>
          </div>
          <button className="btn btn-sm" disabled={!cache?.files} onClick={async () => { await bridge.clearCache(); setCache(await bridge.cacheSize()); }}>Clear</button>
        </div>
      )}
    </section>
  );
}

// Develop's picture corrected with the screen's Windows colour profile, as Lightroom does.
function ScreenColorCard() {
  const [on, setOn] = useState(screenColorOn);
  const [prof, setProf] = useState(null);
  useEffect(() => { let live = true; screenProfile().then((p) => live && setProf(p)); return () => { live = false; }; }, []);
  const status = !prof ? '' : !prof.name ? 'No colour profile found for this screen.'
    : prof.transform ? `Using ${prof.name}.` : `${prof.name} is plain sRGB, so nothing needs correcting.`;
  return (
    <section className="card">
      <h3 className="section-title">Screen colours</h3>
      <p className="muted">Shows photos in Develop with your screen's colour profile, like Lightroom. Exports aren't changed.</p>
      <label className="toggle-row big">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setScreenColor(e.target.checked); }} />
        <span>Correct colours for this screen</span>
      </label>
      {status && <p className="muted small">{status}</p>}
    </section>
  );
}

// A Windows notification when an AI job finishes while Flightroom is in the background.
function NotifyCard() {
  const [on, setOn] = useState(aiNotifyOn);
  return (
    <section className="card">
      <h3 className="section-title">Notifications</h3>
      <label className="toggle-row big">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setAiNotify(e.target.checked); }} />
        <span>Tell me when an AI job is done</span>
      </label>
      <p className="muted small">When AI Denoise, an AI mask, an AI grade or an AI download finishes while you're in another window, Windows shows a notification and Flightroom's taskbar button flashes. Nothing shows while Flightroom is in front.</p>
    </section>
  );
}

// Where AI masks run. Automatic keeps them off graphics built into the processor, which they overload.
function AiDeviceCard() {
  const [st, setSt] = useState(null);
  const load = () => app.ai.status().then(setSt, () => {});
  useEffect(() => { load(); }, []);
  if (!st?.prefer) return null;
  return (
    <section className="card">
      <h3 className="section-title">AI masks</h3>
      <div className="update-row">
        <p className="muted grow start-page-text">Run on</p>
        <Dropdown value={st.prefer} onChange={async (v) => { await app.ai.prefer(v); load(); }}
          options={[{ value: 'auto', label: 'Automatic' }, { value: 'gpu', label: 'Graphics card' }, { value: 'cpu', label: 'Processor' }]} />
      </div>
      <p className="muted small">Now on the {st.device}. Automatic uses a separate graphics card when the computer has one, and the processor otherwise: graphics built into the processor are faster at it, but can flicker or crash while a mask is worked out.</p>
    </section>
  );
}

// What the computer's graphics are, and the graphics resets Develop has seen, to send when the screen goes black.
function GraphicsCard() {
  const [gpu, setGpu] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState(graphicsMode);
  const [engine, setEngine] = useState(enginePref);
  const [engineAtStart] = useState(enginePref);
  useEffect(() => { app.ai.gpu().then((g) => !g?.error && setGpu(g)); }, []);
  const resets = (() => { try { return JSON.parse(localStorage.getItem('flightroom-gpu-resets') || '[]'); } catch { return []; } })();
  if (!gpu) return null;
  const g = graphicsState();
  const chip = g.renderer.replace(/^ANGLE \([^,]*, /, '').replace(/ \(0x[0-9a-f]+\).*$/i, '').replace(/ Direct3D.*$/, '');
  const kind = { weak: 'weaker graphics', capable: 'fast enough for full quality', unknown: 'not recognized' }[g.kind];
  const copy = async () => {
    const report = { version: window.flightroomVersion, gpu, drawing: g, resets };
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 1)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <section className="card">
      <h3 className="section-title">Graphics</h3>
      <p className="muted">{gpu.adapters.map((a) => `${a.name} (${a.own_mb >= 1024 ? `${Math.round(a.own_mb / 1024)} GB` : `${a.own_mb} MB`} of its own)`).join(', ') || 'Not known'}</p>
      {chip && <p className="muted small">Develop draws with the {chip} ({kind}).</p>}
      <div className="update-row">
        <p className="muted grow start-page-text">Photo engine</p>
        <Dropdown value={engine} onChange={(v) => { setEnginePref(v); setEngine(v); }}
          options={[{ value: 'auto', label: 'WebGPU (automatic)' }, { value: 'webgl2', label: 'WebGL2 (older)' }]} />
      </div>
      <p className="muted small">{g.engine.kind === 'webgpu' ? 'Develop draws with WebGPU.' : `Develop draws with WebGL2${g.engine.why ? ` (${g.engine.why})` : ''}.`}{engine !== engineAtStart ? ' The change takes effect when Flightroom starts again.' : ''} WebGL2 is the engine from before 3.0, for a computer where WebGPU misbehaves.</p>
      <div className="update-row">
        <p className="muted grow start-page-text">While dragging a slider</p>
        <Dropdown value={mode} onChange={(m) => { setGraphicsMode(m); setMode(m); }}
          options={[{ value: 'auto', label: 'Automatic' }, { value: 'full', label: 'Full quality' }, { value: 'light', label: 'Lighter' }]} />
      </div>
      <p className="muted small">{g.light
        ? 'Lighter: the photo is drawn at half size while a slider moves and in full when you let go, in smaller steps, so weaker built-in graphics keep up and the screen stays on.'
        : 'Full quality: every frame is drawn in full while you drag.'} Automatic picks lighter only for weaker built-in graphics such as Intel Iris Xe or UHD.</p>
      <div className="update-row">
        <p className="muted grow start-page-text">{resets.length ? `${resets.length} graphics ${resets.length === 1 ? 'reset' : 'resets'} seen in Develop, last ${new Date(resets[resets.length - 1].at).toLocaleString()}` : 'No graphics resets seen in Develop'}</p>
        <button className="btn btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy report'}</button>
      </div>
    </section>
  );
}

export function SettingsView({ store }) {
  const { state, actions } = store;
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const toggle = (id) => actions.setApps(state.settings.apps.includes(id) ? state.settings.apps.filter((a) => a !== id) : [...state.settings.apps, id]);

  const exportData = async () => {
    const name = `flightroom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const text = JSON.stringify(state, null, 2);
    if (app) {
      const res = await app.saveTextFile(name, text);
      if (res) setMsg(res.error ? `Couldn't save the backup: ${res.error}` : 'Backup saved.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.groups)) throw new Error('not a backup');
      actions.importData(data);
      setMsg('Backup restored.');
    } catch {
      setMsg('That file is not a Flightroom or GearCheck backup.');
    }
    e.target.value = '';
  };

  return (
    <div className="view narrow">
      <header className="view-head"><div className="grow"><div className="eyebrow">App</div><h1>Settings</h1></div></header>
      <UpdatesCard />
      <section className="card">
        <h3 className="section-title">Start page</h3>
        <div className="update-row">
          <p className="muted grow start-page-text">The page Flightroom opens on.</p>
          <Dropdown value={state.settings.startPage || 'home'} onChange={(v) => actions.setSettings({ startPage: v })}
            options={[...START_PAGES.map((p) => ({ value: p.id, label: p.label })), ...state.groups.map((g) => ({ value: `group:${g.id}`, label: g.name, hint: 'Group' }))]} />
        </div>
      </section>
      <CullingCard store={store} />
      <ScreenColorCard />
      {app && <NotifyCard />}
      {app && <AiDeviceCard />}
      {app && <GraphicsCard />}
      <section className="card">
        <h3 className="section-title">Editing apps you use</h3>
        <p className="muted">Presets check whether these apps can open each camera's photos and video.</p>
        <div className="app-list">
          {EDITING_APPS.map((a) => (
            <label key={a.id} className="toggle-row big">
              <input type="checkbox" checked={state.settings.apps.includes(a.id)} onChange={() => toggle(a.id)} />
              <span>{a.name}<span className="muted small"> · {a.kind === 'photo' ? 'RAW photos' : 'video'}</span></span>
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h3 className="section-title">Backup</h3>
        <p className="muted">Everything is saved on this computer automatically. Export a backup to move it to another PC.</p>
        <div className="row">
          <button className="btn" onClick={exportData}>Export backup</button>
          <button className="btn" onClick={() => fileRef.current.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importData} />
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>
      <section className="card">
        <h3 className="section-title">Reset</h3>
        <p className="muted">Restore the starter groups and catalog. Your gear, custom items and presets will be erased.</p>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset everything</button>
      </section>
      <p className="muted small">Specs and compatibility data are a starting point. Check the maker's website before buying.</p>
      {confirmReset && (
        <Modal title="Reset everything?" onClose={() => setConfirmReset(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { actions.resetAll(); setConfirmReset(false); }}>Erase and reset</button></>}>
          <p>This erases My Gear, custom gear, firmware versions and every preset. Export a backup first if you might want them back.</p>
        </Modal>
      )}
    </div>
  );
}
