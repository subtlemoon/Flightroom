// Retouch's own documents (Photoshop files in Pictures\Flightroom Retouch, apart
// from the folder open in Culling and Develop): making a blank one, opening a
// picture or a Photoshop file as a copy there, and saving the work into the
// document as you go (psdsave.js).
import { useEffect, useRef, useState } from 'react';
import { bridge as app } from '../bridge.js';
import { Icon, Modal } from './ui.jsx';
import { exportPhoto } from '../develop/export.js';
import { saveDocument } from '../develop/psdsave.js';

let folderAsk = null;
/** The Retouch documents folder (asked once). */
export function retouchFolder() {
  folderAsk ||= app.retouch.folder().then((d) => {
    if (d?.error) { folderAsk = null; throw new Error(d.error); }
    return d;
  });
  return folderAsk;
}

// A document just made or opened: shown once the folder's list has it.
let pending = null;
export const takePending = (photos) => {
  if (!pending || !photos?.some((p) => p.id === pending)) return null;
  const id = pending;
  pending = null;
  return id;
};
export const isDocument = (photo) => /\.psd$/i.test(photo?.id || '');

/** A copy of `photo` as a Retouch document; resolves to its path. */
export async function copyToRetouch(photo, info, s, edited) {
  const dir = await retouchFolder();
  let src = photo.id, remove = false;
  // A RAW, or a picture with Develop edits: developed first (full size), then copied.
  if (!/\.(psd|psb)$/i.test(photo.id) && (!info.rendered || edited || photo.copy)) {
    src = await exportPhoto(photo, info, s, { folder: `${dir}/.import`, quality: 100, replace: true, tag: false });
    remove = true;
  }
  const path = await app.retouch.importDoc(src, remove);
  if (path?.error) throw new Error(path.error);
  pending = path;
  return path;
}

/** Asks for a picture or Photoshop file and copies it in; null when none was picked. */
export async function openIntoRetouch() {
  const file = await app.retouch.pickFile();
  if (!file) return null;
  const path = await app.retouch.importDoc(file);
  if (path?.error) throw new Error(path.error);
  pending = path;
  return path;
}

const SIZES = [
  ['Photo (3:2)', 6000, 4000],
  ['4K screen', 3840, 2160],
  ['Full HD', 1920, 1080],
  ['Portrait post (4:5)', 1080, 1350],
  ['Square', 2048, 2048],
  ['A4 at 300 ppi', 2480, 3508],
];
const BACKGROUNDS = [['White', '#ffffff'], ['Black', '#000000'], ['Grey', '#808080']];

/** Retouch's File > New: name, size and background colour. */
export function NewDocDialog({ onClose, onDone }) {
  const [name, setName] = useState('Untitled');
  const [w, setW] = useState(3840);
  const [h, setH] = useState(2160);
  const [bg, setBg] = useState('#ffffff');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = w >= 1 && h >= 1 && w <= 30000 && h <= 30000 && !busy;
  const make = async () => {
    if (!ok) return;
    setBusy(true);
    const c = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16) / 255);
    try {
      await retouchFolder();
      const path = await app.retouch.newDoc(name.trim() || 'Untitled', w, h, c);
      if (path?.error) throw new Error(path.error);
      pending = path;
      onDone(path);
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };
  const num = (set) => (e) => set(Math.max(0, Math.min(30000, Math.round(Number(e.target.value) || 0))));
  return (
    <Modal title="New document" onClose={onClose} footer={(
      <>
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok} onClick={make}>{busy ? 'Making…' : 'Create'}</button>
      </>
    )}>
      <div className="rt-newdoc" onKeyDown={(e) => e.key === 'Enter' && make()}>
        <label>Name<input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} /></label>
        <div className="rt-newdoc-sizes">
          {SIZES.map(([label, sw, sh]) => (
            <button key={label} className={`chip${w === sw && h === sh ? ' on' : ''}`} onClick={() => { setW(sw); setH(sh); }}>{label}<span className="muted small">{sw} × {sh}</span></button>
          ))}
        </div>
        <div className="rt-newdoc-row">
          <label>Width<input className="input" type="number" min={1} max={30000} value={w} onChange={num(setW)} /></label>
          <button className="icon-btn" title="Swap width and height" onClick={() => { setW(h); setH(w); }}><Icon name="swap" size={14} /></button>
          <label>Height<input className="input" type="number" min={1} max={30000} value={h} onChange={num(setH)} /></label>
          <span className="muted small">pixels</span>
        </div>
        <div className="rt-newdoc-row">
          <span>Background</span>
          {BACKGROUNDS.map(([label, c]) => (
            <button key={c} className={`chip${bg === c ? ' on' : ''}`} onClick={() => setBg(c)}><span className="rt-docswatch" style={{ background: c }} />{label}</button>
          ))}
          <label className="chip" title="Pick a colour"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />Other…</label>
        </div>
        {err && <p className="error small">{err}</p>}
        <p className="muted small">Documents are Photoshop files in Pictures\Flightroom Retouch. Your work is saved into them as you go.</p>
      </div>
    </Modal>
  );
}

/** Retouch with no documents yet. */
export function RetouchEmpty({ onNew, onOpen, loading }) {
  return (
    <div className="hero-empty dev-msg">
      <div className="hero-icon"><Icon name="heal" size={40} /></div>
      <h2>{loading ? 'Reading your Retouch documents…' : 'Start something in Retouch'}</h2>
      {!loading && <>
        <p className="muted">Start from a blank document, or open a picture or a Photoshop file. Retouch works on a copy and saves it as a Photoshop file as you go; the original is never changed.</p>
        <div className="row gap">
          <button className="btn btn-primary" onClick={onNew}><Icon name="plus" size={16} />New document…</button>
          <button className="btn" onClick={onOpen}><Icon name="folder" size={16} />Open a picture or Photoshop file…</button>
        </div>
      </>}
    </div>
  );
}

// What was last written to each document (its settings as text), across visits.
const written = new Map();
const AFTER = 2500; // ms after the last change
/** A document whose layers were rebuilt from Photoshop's: saved once they're in, though nothing was changed. */
export const saveOnOpen = (id) => written.set(id, '');

/**
 * Saves the open Retouch document shortly after each change, one save at a
 * time; moving to another document or leaving Retouch saves at once.
 * `ready`: `info` and `s` are this photo's.
 */
export function useAutosave(on, photo, info, s, ready, toast) {
  const st = useRef({ busy: false, timer: 0, want: null });
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const run = async () => {
    const x = st.current;
    clearTimeout(x.timer);
    if (x.busy || !x.want) return;
    const { photo: p, info: i, s: v, text } = x.want;
    x.want = null;
    if (written.get(p.id) === text) return;
    x.busy = true;
    try {
      await saveDocument(p, i, v);
      written.set(p.id, text);
    } catch (e) {
      toastRef.current?.(`Couldn't save ${p.name}: ${e?.message || e}`);
    } finally {
      x.busy = false;
      if (x.want) run();
    }
  };
  useEffect(() => {
    if (!on || !ready || !photo || !s || !isDocument(photo)) return;
    const text = JSON.stringify(s);
    // As it opened: nothing to write yet.
    if (!written.has(photo.id)) { written.set(photo.id, text); return; }
    if (written.get(photo.id) === text) return;
    const x = st.current;
    x.want = { photo, info, s, text };
    clearTimeout(x.timer);
    x.timer = setTimeout(run, AFTER);
  }, [s, ready]);
  useEffect(() => () => run(), [photo?.id]);
  useEffect(() => {
    const flush = () => run();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
}
