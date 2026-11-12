// Basic › Look: a 3D LUT on the finished photo, with an Amount, like a creative
// profile in Lightroom. "Browse" shows each look on this photo as a tile;
// pointing at one previews it on the big photo.
import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge.js';
import { Dropdown, Icon } from './ui.jsx';
import { Slider } from './slider.jsx';
import { openMenu } from './menu.jsx';
import { SLIDER } from '../develop/params.js';
import { BUILTIN_LOOKS, applyLook, importLook, loadLook, lookName, lookTable, removeLook, userLooks } from '../develop/looks.js';

const BROWSE_KEY = 'flightroom-looks-open';

export function LookPicker({ s, set, update, onHover, base, toast }) {
  const [mine, setMine] = useState([]);
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem(BROWSE_KEY) === '1'; } catch { return false; } });
  const file = useRef();
  const setOpen = (v) => { setOpenState(v); try { localStorage.setItem(BROWSE_KEY, v ? '1' : '0'); } catch {} };
  const refresh = () => userLooks().then(setMine);
  useEffect(() => { refresh(); }, []);
  useEffect(() => () => onHover?.(null), []);

  const pick = (id) => update({ look: id, ...(id && id !== s.look ? { lookAmount: 100 } : {}) });
  const missing = s.look && s.look.startsWith('user:') && !mine.some((m) => m.id === s.look);
  const all = [
    ...BUILTIN_LOOKS.map(([id, name, group]) => ({ id, name, group })),
    ...mine.map((m) => ({ ...m, group: 'Yours' })),
  ];
  const options = [
    { value: '', label: 'None' },
    ...all.map((l) => ({ value: l.id, label: l.name, hint: l.group === 'Yours' ? 'yours' : l.group === 'B&W' ? 'B&W' : undefined })),
    ...(missing ? [{ value: s.look, label: `${lookName(s.look)} (file missing)`, disabled: true }] : []),
  ];

  const onFile = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    let last = null;
    for (const f of files) {
      try { last = await importLook(f); } catch (err) { toast?.(`Can't use ${f.name}: ${err.message || err}`); }
    }
    await refresh();
    if (last) { pick(last); toast?.(files.length > 1 ? `${files.length} looks added` : `${lookName(last)} added to your looks`); }
  };
  const tileMenu = (e, l) => openMenu(e, [
    { heading: l.name },
    { label: 'Use this look', icon: 'check', onClick: () => pick(l.id) },
    l.group === 'Yours' && '-',
    l.group === 'Yours' && { label: 'Remove from your looks', icon: 'trash', danger: true, onClick: async () => {
      await removeLook(l.id).catch((err) => toast?.(String(err.message || err)));
      if (s.look === l.id) pick('');
      refresh();
    } },
  ]);

  return (
    <div className="look">
      <div className="dev-line dev-wb"><span className="muted">Look</span>
        <span className="dev-line">
          <button className={`icon-btn sm${open ? ' on' : ''}`} onClick={() => setOpen(!open)} title="Browse looks on this photo"><Icon name="grid" size={15} /></button>
          <Dropdown value={s.look || ''} options={options} onChange={pick} title="A LUT on the finished colours, like a creative profile" />
        </span>
      </div>
      {s.look && <Slider sl={SLIDER.lookAmount} value={s.lookAmount ?? 100} def={100} onSet={set} />}
      {open && (
        <div className="look-browser" onMouseLeave={() => onHover?.(null)}>
          <LookTiles looks={[{ id: '', name: 'None' }, ...all]} current={s.look || ''} base={base} onPick={pick} onHover={onHover} onMenu={tileMenu} edits={s} />
          <div className="look-actions">
            <button className="btn btn-sm" onClick={() => file.current.click()}><Icon name="plus" size={14} />Import .cube…</button>
            {bridge?.looks && <button className="btn btn-sm btn-ghost" onClick={async () => bridge.reveal(await bridge.looks.folder())} title="The folder your looks are kept in">Folder</button>}
          </div>
          <input ref={file} type="file" accept=".cube" multiple hidden onChange={onFile} />
        </div>
      )}
    </div>
  );
}

// Each look on a small copy of this photo, worked out here from one render
// without a look (the tables are small; a tile is a few thousand pixels).
function LookTiles({ looks, current, base, onPick, onHover, onMenu, edits }) {
  const [pic, setPic] = useState(null);
  // A new small copy once the edits settle (not on every slider step).
  const key = edits;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { base?.()?.then((p) => { if (live && p) setPic(p); }).catch(() => {}); }, pic ? 600 : 50);
    return () => { live = false; clearTimeout(t); };
  }, [key && JSON.stringify({ ...key, look: '', lookAmount: 0, masks: key.masks?.length, layers: key.layers?.length })]);
  return (
    <div className="look-grid">
      {looks.map((l) => (
        <button key={l.id} className={`look-tile${l.id === current ? ' on' : ''}`} onClick={() => onPick(l.id)}
          onMouseEnter={() => onHover?.(l.id)} onContextMenu={(e) => l.id && onMenu(e, l)} title={l.name}>
          <LookThumb id={l.id} pic={pic} />
          <span className="look-name">{l.name}</span>
        </button>
      ))}
    </div>
  );
}

function LookThumb({ id, pic }) {
  const ref = useRef();
  const [table, setTable] = useState(() => lookTable(id));
  useEffect(() => { if (id && !table) loadLook(id).then(setTable); }, [id]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !pic) return;
    const { w, h, rgba } = pic;
    c.width = w; c.height = h;
    const img = new ImageData(w, h);
    // Rows come bottom first.
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      for (let x = 0; x < w * 4; x += 4) {
        let r = rgba[src + x], g = rgba[src + x + 1], b = rgba[src + x + 2];
        if (table) [r, g, b] = applyLook(table, [r / 255, g / 255, b / 255]).map((v) => v * 255);
        img.data[dst + x] = r; img.data[dst + x + 1] = g; img.data[dst + x + 2] = b; img.data[dst + x + 3] = 255;
      }
    }
    c.getContext('2d').putImageData(img, 0, 0);
  }, [pic, table]);
  return <canvas ref={ref} className="look-thumb" />;
}
