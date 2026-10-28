// On-device AI in Develop: the one-time model download, AI masks (subject,
// sky, background, people and their parts, the parts of a landscape) and AI
// Denoise. The models run on this computer; photos are never uploaded.
import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge.js';
import { Icon, Modal } from './ui.jsx';
import { Slider } from './slider.jsx';
import { AI_TYPES, aiName, newAiPart } from '../develop/masks.js';

// Which download each AI tool needs (names from the models' manifest).
const FEATURE = { subject: 'subject', background: 'subject', sky: 'landscape', landscape: 'landscape', people: 'people', denoise: 'denoise' };
const FEATURE_LABEL = { subject: 'Subject and Background', landscape: 'Sky and Landscape', people: 'People', denoise: 'AI Denoise' };
const TASK = Object.fromEntries(AI_TYPES.map(([k, , task]) => [k, task]));
const mb = (n) => `${Math.max(1, Math.round(n / 1e6))} MB`;

/** ensure(feature) resolves true once its models are on this computer (asking before downloading). */
export function useAiInstall() {
  const [ask, setAsk] = useState(null); // { feature, size, resolve }
  const ensure = async (feature) => {
    const st = await bridge.ai.status();
    if (st.features?.[feature]) return true;
    if (st.sizes?.[feature] == null) throw new Error(st.error || 'AI isn\'t available right now');
    return new Promise((resolve) => setAsk({ feature, size: st.sizes[feature], resolve }));
  };
  const done = (ok) => { ask?.resolve(ok); setAsk(null); };
  return [ensure, ask && <AiDownload key={ask.feature} {...ask} onDone={done} />];
}

function AiDownload({ feature, size, onDone }) {
  const [run, setRun] = useState(null); // { done, total } | { error }
  useEffect(() => bridge.ai.onProgress((p) => p.feature === feature && setRun({ done: p.done, total: p.total })), [feature]);
  const start = async () => {
    setRun({ done: 0, total: size });
    const r = await bridge.ai.install(feature);
    if (r?.error) setRun({ error: r.error });
    else onDone(true);
  };
  const busy = run && !run.error;
  return (
    <Modal title={`Download ${FEATURE_LABEL[feature]}`} onClose={() => !busy && onDone(false)} footer={busy ? null : (
      <>
        <button className="btn" onClick={() => onDone(false)}>Not now</button>
        <button className="btn btn-primary" onClick={start}>{run?.error ? 'Try again' : `Download (${mb(size)})`}</button>
      </>
    )}>
      <p>{FEATURE_LABEL[feature]} uses AI that runs on this computer, on the graphics card when it can. Flightroom downloads it once ({mb(size)}); after that it works offline.</p>
      <p className="muted small">Your photos never leave this computer.</p>
      {busy && (
        <div className="ai-progress"><span style={{ width: `${(100 * run.done) / Math.max(1, run.total)}%` }} /><em>{mb(run.done)} of {mb(run.total)}</em></div>
      )}
      {run?.error && <p className="ai-error small">{run.error}</p>}
    </Modal>
  );
}

// --- AI masks -----------------------------------------------------------------------

const cache = new Map(); // `${photo}|${task}` -> results, for the last few
const PERSON_PARTS = [['', 'Entire person'], ['face', 'Face skin'], ['skin', 'Body skin'], ['hair', 'Hair'], ['clothes', 'Clothes']];

/**
 * AI selections for masks. run(type, target) makes a new mask, or with
 * target { mask, mode } adds to / subtracts from one. People and Landscape
 * show a list to pick from first (`picker`).
 */
export function useAiMasks({ photo, picture, acts, ensure, toast }) {
  const [busy, setBusy] = useState(null);
  const [pick, setPick] = useState(null); // { type, results, target }
  useEffect(() => setPick(null), [photo?.id]);

  const results = async (task) => {
    const key = `${photo.id}|${task}`;
    if (!cache.has(key)) {
      const pic = picture();
      if (!pic) throw new Error('The photo isn\'t ready yet');
      const r = await bridge.ai.masks(task, pic.w, pic.h, pic.rgba);
      if (r?.error) throw new Error(r.error);
      cache.set(key, r);
      if (cache.size > 6) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  };

  const make = (items, target, separate) => {
    if (!items.length) return;
    if (separate && !target) { items.forEach(([kind, r]) => acts.createWith(newAiPart(kind, r), aiName(kind))); return; }
    // Several picks become one selection.
    const [kind0, r0] = items[0];
    const data = new Uint8Array(r0.data);
    for (const [, r] of items.slice(1)) for (let i = 0; i < data.length; i++) data[i] = Math.max(data[i], r.data[i]);
    const kind = items.map(([k]) => k).join('+');
    const part = newAiPart(kind, { w: r0.w, h: r0.h, data }, target?.mode);
    if (target) acts.addPartObj(target.mask, part);
    else acts.createWith(part, items.length === 1 ? aiName(kind0) : null);
  };

  const run = async (type, target = null) => {
    try {
      if (!(await ensure(FEATURE[type]))) return;
      setBusy(AI_TYPES.find(([k]) => k === type)[1]);
      const r = await results(TASK[type]);
      const named = (n) => r.find((x) => x.name === n);
      if (type === 'subject' || type === 'background') {
        const sub = named('subject');
        make([[type, type === 'background' ? { ...sub, data: sub.data.map((v) => 255 - v) } : sub]], target);
      } else if (type === 'sky') {
        if (named('sky')) make([['sky', named('sky')]], target);
        else toast('No sky found in this photo');
      } else if (!r.length) toast(type === 'people' ? 'No people found in this photo' : 'Nothing found to select');
      else setPick({ type, results: r, target });
    } catch (err) {
      toast(`AI masking didn't work: ${err.message || err}`);
    } finally {
      setBusy(null);
    }
  };

  const picker = pick && <AiPicker {...pick} onClose={() => setPick(null)} onCreate={(items, separate) => { setPick(null); make(items, pick.target, separate); }} />;
  return { run, busy, picker };
}

// People: each person and their parts. Landscape: what was found.
function AiPicker({ type, results, target, onClose, onCreate }) {
  const [on, setOn] = useState(() => new Set());
  const [separate, setSeparate] = useState(false);
  const flip = (name) => setOn((o) => { const n = new Set(o); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  const people = type === 'people' ? results.filter((r) => !r.name.includes(':')).map((r) => r.name) : [];
  const row = (name, label) => byName[name] && (
    <label key={name} className="dev-check"><input type="checkbox" checked={on.has(name)} onChange={() => flip(name)} />{label}</label>
  );
  const chosen = results.filter((r) => on.has(r.name)).map((r) => [r.name, r]);
  return (
    <div className="ai-picker">
      <div className="mask-head"><Icon name={type} size={14} /><span className="grow">{type === 'people' ? `${people.length} ${people.length === 1 ? 'person' : 'people'} found` : 'Found in this photo'}</span>
        <button className="icon-btn tiny" onClick={onClose} title="Cancel"><Icon name="x" size={12} /></button>
      </div>
      <div className="ai-picker-list">
        {type === 'people'
          ? people.map((p) => (
            <div key={p} className="ai-person">
              <div className="dev-group-title">{aiName(p)}</div>
              {PERSON_PARTS.map(([part, label]) => row(part ? `${p}:${part}` : p, label))}
            </div>
          ))
          : results.map((r) => row(r.name, aiName(r.name)))}
      </div>
      {!target && chosen.length > 1 && <label className="dev-check"><input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />Make a separate mask for each</label>}
      <button className="btn btn-sm btn-primary full" disabled={!chosen.length} onClick={() => onCreate(chosen, separate)}>
        {target ? (target.mode === 'subtract' ? 'Subtract' : 'Add') : separate ? `Create ${chosen.length} masks` : 'Create mask'}
      </button>
    </div>
  );
}

// --- AI Denoise -------------------------------------------------------------------

const DN_AMOUNT = { key: 'aiDenoise', label: 'Amount', min: 1, max: 100, step: 1, def: 50 };

/** AI Denoise, in the Detail section: work it out once per photo, then blend it in. */
export function AiDenoise({ photo, info, s, set, ensure, onDenoised }) {
  const [run, setRun] = useState(null); // { done, total } | { error }
  const live = useRef(photo.id);
  live.current = photo.id;
  useEffect(() => setRun(null), [photo.id]);
  useEffect(() => bridge.develop.onDenoise((p) => setRun((r) => (r && !r.error ? p : r))), []);
  const start = async () => {
    const id = photo.id;
    try { if (!(await ensure('denoise'))) return; } catch (err) { setRun({ error: err.message }); return; }
    setRun({ done: 0, total: 1 });
    const r = await bridge.develop.denoise(photo);
    if (live.current !== id) return;
    if (r?.error) { setRun(r.error === 'cancelled' ? null : { error: r.error }); return; }
    setRun(null);
    onDenoised(s.aiDenoise || DN_AMOUNT.def);
  };
  const busy = run && !run.error;
  if (info.denoised && !busy) {
    return (
      <div className="dev-group ai-denoise">
        <div className="dev-group-title dev-line">AI Denoise
          <label className="dev-check inline"><input type="checkbox" checked={!!s.aiDenoise} onChange={(e) => set('aiDenoise', e.target.checked ? DN_AMOUNT.def : 0)} />On</label>
        </div>
        {!!s.aiDenoise && <Slider sl={DN_AMOUNT} value={s.aiDenoise} def={DN_AMOUNT.def} onSet={set} />}
      </div>
    );
  }
  return (
    <div className="dev-group ai-denoise">
      <div className="dev-group-title">AI Denoise</div>
      {busy ? (
        <div className="dev-line">
          <div className="ai-progress grow"><span style={{ width: `${(100 * run.done) / Math.max(1, run.total)}%` }} /><em>{run.total > 1 ? `${Math.round((100 * run.done) / run.total)}%` : 'Starting…'}</em></div>
          <button className="btn btn-sm btn-ghost" onClick={() => bridge.develop.cancelDenoise()}>Cancel</button>
        </div>
      ) : (
        <>
          <button className="btn btn-sm full" onClick={start}><Icon name="ai" size={14} />Denoise…</button>
          <p className="muted small">Removes noise with AI on this computer, keeping detail. Takes a minute or two for a full-size photo; the result is kept.</p>
          {run?.error && <p className="ai-error small">{run.error}</p>}
        </>
      )}
    </div>
  );
}
