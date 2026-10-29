// Export JPEG, from Develop, Retouch or Culling (Ctrl+Shift+E, as in Lightroom).
import { useRef, useState } from 'react';
import { bridge as app } from '../bridge.js';
import { Dropdown, Modal } from './ui.jsx';
import { photoRating } from './cull.jsx';
import { fromXmp } from '../develop/params.js';
import { asShotTempTint } from '../develop/color.js';
import { Geometry, Renderer } from '../develop/renderer.js';
import { exportPhoto, exportSize } from '../develop/export.js';
import { session } from '../develop/session.js';

const SIZES = [['Full size', 0], ['Long edge 4096 px', 4096], ['Long edge 2048 px', 2048]];

/**
 * photo: the current one; photos: the whole folder; shown: what the star filter
 * shows; picked: ids selected in the filmstrip (or null); info and s: the
 * current photo's RAW and settings when it's open in Develop (else null).
 */
export function ExportModal({ photo, photos, shown = photos, picked = null, meta = {}, folder, info = null, s = null, onClose, onDone }) {
  const edits = session.settings;
  const raws = (list) => list.filter((p) => p.raw);
  const selected = picked?.size > 1 ? raws(photos.filter((p) => picked.has(p.id))) : [];
  const filtered = shown.length < photos.length ? raws(shown) : [];
  const rated = raws(photos.filter((p) => photoRating(p, meta[p.id]) > 0));
  const edited = raws(photos.filter((p) => edits.has(p.id)));
  const [which, setWhich] = useState(selected.length ? 'selected' : 'this');
  const [longEdge, setLongEdge] = useState(() => Number(localStorage.getItem('flightroom-export-edge') || 0));
  const [quality, setQuality] = useState(() => Number(localStorage.getItem('flightroom-export-quality') || 92));
  const [dest, setDest] = useState(() => localStorage.getItem('flightroom-export-dest') || '');
  const [run, setRun] = useState(null); // { done, total, current, part }
  const cancel = useRef(false);
  const sep = folder.includes('\\') ? '\\' : '/';
  const target = dest || `${folder}${sep}Exported`;
  const list = { this: photo?.raw ? [photo] : [], selected, shown: filtered, rated, edited }[which] || [];
  const size = info && s && exportSize(new Geometry(info.width, info.height, info.orientation).frame(s.crop), longEdge);

  const start = async () => {
    try {
      localStorage.setItem('flightroom-export-edge', String(longEdge));
      localStorage.setItem('flightroom-export-quality', String(quality));
      localStorage.setItem('flightroom-export-dest', dest);
    } catch {}
    cancel.current = false;
    const saved = [];
    const failed = [];
    // One renderer for the whole batch: its shaders are built once.
    let renderer = null;
    try { renderer = new Renderer(new OffscreenCanvas(16, 16)); } catch {}
    for (let i = 0; i < list.length && !cancel.current; i++) {
      const p = list[i];
      setRun({ done: i, total: list.length, current: p.name, part: 0 });
      try {
        let pInfo = info, pS = s;
        if (p.id !== photo?.id || !info) {
          pInfo = await app.develop.open(p);
          if (pInfo.error) throw new Error(pInfo.error);
          pS = edits.get(p.id) || fromXmp(pInfo.settings, pInfo.curves, asShotTempTint(pInfo), pInfo.own);
        }
        saved.push(await exportPhoto(p, pInfo, pS, { folder: target, longEdge, quality, renderer, cancelled: () => cancel.current, onProgress: (part) => setRun((r) => r && { ...r, part }) }));
      } catch (err) {
        if (String(err.message) !== 'cancelled') failed.push(`${p.name}: ${err.message || err}`);
      }
    }
    renderer?.dispose();
    // Develop: the photo on screen goes back to the front of memory, for zooming.
    // Culling: nothing needs the RAW data any more.
    if (!info) app.develop.close();
    else if (list.some((p) => p.id !== photo.id)) app.develop.open(photo);
    setRun(null);
    if (failed.length) { onDone(`Exported ${saved.length}, ${failed.length} failed (${failed[0]})`); return; }
    onDone(cancel.current ? `Stopped after ${saved.length} photos` : saved.length === 1 ? `Saved ${saved[0].split(/[\\/]/).pop()} to ${target.split(/[\\/]/).pop()}` : `Saved ${saved.length} JPEGs to ${target.split(/[\\/]/).pop()}`);
  };

  const options = [
    { value: 'this', label: photo ? `This photo (${photo.name})` : 'This photo', disabled: !photo?.raw },
    ...(selected.length ? [{ value: 'selected', label: 'Selected photos', hint: selected.length }] : []),
    ...(filtered.length ? [{ value: 'shown', label: 'Photos the star filter shows', hint: filtered.length }] : []),
    { value: 'rated', label: 'Rated photos in this folder', hint: rated.length, disabled: !rated.length },
    { value: 'edited', label: 'Photos edited this session', hint: edited.length, disabled: !edited.length },
  ];

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
            <Dropdown value={which} onChange={setWhich} options={options} />
          </div>
          <div className="export-row"><span>Size</span>
            <Dropdown value={longEdge} onChange={setLongEdge} options={SIZES.map(([label, value]) => ({ value, label }))} />
            {which === 'this' && size && <span className="muted small">{size.w} × {size.h}</span>}
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
          <p className="muted small">JPEGs in sRGB, with the camera and lens details. Existing files are never overwritten.{!photo?.raw && which === 'this' ? ' Only RAW files can be exported.' : ''}</p>
        </div>
      )}
    </Modal>
  );
}
