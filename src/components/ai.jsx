// On-device AI in Develop: the one-time model download, AI masks (subject,
// sky, background, people and their parts, the parts of a landscape) and AI
// Denoise. The models run on this computer; photos are never uploaded.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bridge } from '../bridge.js';
import { aiDone } from '../notify.js';
import { Icon, Modal } from './ui.jsx';
import { Slider } from './slider.jsx';
import { AI_TYPES, aiName, newAiPart } from '../develop/masks.js';

// Which download each AI tool needs (names from the models' manifest).
const FEATURE = { subject: 'subject', background: 'subject', sky: 'landscape', landscape: 'landscape', people: 'people', skin: 'people', denoise: 'denoise' };
const FEATURE_LABEL = { subject: 'Subject and Background', landscape: 'Sky and Landscape', people: 'People', denoise: 'AI Denoise', grade: 'AI grade vision' };
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
    if (r?.error) { setRun({ error: r.error }); aiDone(`${FEATURE_LABEL[feature]} download failed`, r.error); }
    else { aiDone(`${FEATURE_LABEL[feature]} is downloaded`); onDone(true); }
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
        <div className="ai-progress ai-glow busy"><span style={{ width: `${(100 * run.done) / Math.max(1, run.total)}%` }} /><em>{mb(run.done)} of {mb(run.total)}</em></div>
      )}
      {run?.error && <p className="ai-error small">{run.error}</p>}
    </Modal>
  );
}

// --- AI masks -----------------------------------------------------------------------

// Everyone's face and body skin as one selection (Lightroom's People > all > skin).
function allSkin(results) {
  const parts = results.filter((x) => /:(face|skin)$/.test(x.name));
  if (!parts.length) return null;
  const data = new Uint8Array(parts[0].data);
  for (const p of parts.slice(1)) for (let i = 0; i < data.length; i++) data[i] = Math.max(data[i], p.data[i]);
  return { w: parts[0].w, h: parts[0].h, data };
}

const cache = new Map(); // `${photo}|${task}` -> results, for the last few
const PERSON_PARTS = [['', 'Entire person'], ['face', 'Face skin'], ['skin', 'Body skin'], ['hair', 'Hair'], ['clothes', 'Clothes']];

/**
 * AI selections for masks. run(type, target) makes a new mask, or with
 * target { mask, mode } adds to / subtracts from one. People and Landscape
 * show a list to pick from first (`picker`).
 */
export function useAiMasks({ photo, picture, acts, ensure, toast }) {
  const [busy, setBusy] = useState(null);
  const job = useRef(0); // the run that's showing; Cancel moves on, so a cancelled run's answer is dropped
  const [pick, setPick] = useState(null); // { type, results, target }
  useEffect(() => setPick(null), [photo?.id]);

  // One run per photo and task, shared by a click and the head start below.
  const results = (task) => {
    const key = `${photo.id}|${task}`;
    if (!cache.has(key)) {
      const t0 = performance.now();
      const p = Promise.resolve(picture()).then((pic) => {
        if (!pic) throw new Error('The photo isn\'t ready yet');
        return bridge.ai.masks(task, pic.w, pic.h, pic.rgba);
      }).then((r) => {
        if (r?.error) throw new Error(r.error);
        return { r, secs: (performance.now() - t0) / 1000 };
      });
      p.catch(() => cache.delete(key));
      cache.set(key, p);
      if (cache.size > 6) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  };

  // Opening a mask menu starts on the subject, which is the slow one, if it's downloaded.
  const warm = async () => {
    try {
      // Only on a graphics card: on the processor it would tie the computer up for a mask nobody asked for yet.
      const st = photo && await bridge.ai.status();
      if (st?.features?.subject && st.device === 'graphics card') results(TASK.subject).catch(() => {});
    } catch { /* it runs on click instead */ }
  };

  // A slow run says where it ran, so a processor fallback shows.
  const slow = async (type, secs) => {
    const st = await bridge.ai.status().catch(() => ({}));
    const gpu = st.device === 'graphics card', fell = gpu && st.on_cpu?.includes(FEATURE[type]);
    toast(`${aiName(type)} took ${Math.round(secs)} s on the ${gpu && !fell ? 'graphics card' : 'processor'}${fell ? ' (the graphics card couldn\'t run it)' : !gpu && st.prefer === 'auto' ? ' (this computer has built-in graphics only; Settings can change it)' : ''}`);
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
    const me = ++job.current;
    try {
      if (!(await ensure(FEATURE[type]))) return;
      setBusy(AI_TYPES.find(([k]) => k === type)[1]);
      const t0 = performance.now();
      const { r, secs } = await results(TASK[type]);
      if (job.current !== me) return;
      if (performance.now() - t0 > 6000) slow(type, secs);
      aiDone(`AI ${aiName(type)} mask is ready`);
      const named = (n) => r.find((x) => x.name === n);
      if (type === 'subject' || type === 'background') {
        const sub = named('subject');
        make([[type, type === 'background' ? { ...sub, data: sub.data.map((v) => 255 - v) } : sub]], target);
      } else if (type === 'sky') {
        if (named('sky')) make([['sky', named('sky')]], target);
        else toast('No sky found in this photo');
      } else if (type === 'skin') {
        const skin = allSkin(r);
        if (skin) make([['allSkin', skin]], target);
        else toast('No skin found in this photo');
      } else if (!r.length) toast(type === 'people' ? 'No people found in this photo' : 'Nothing found to select');
      else setPick({ type, results: r, target });
    } catch (err) {
      if (job.current !== me) return;
      toast(`AI masking didn't work: ${err.message || err}`);
      aiDone('AI masking didn\'t work', String(err.message || err));
    } finally {
      if (job.current === me) setBusy(null);
    }
  };

  /** The AI mask itself, { w, h, data } (0-255, top row first), or null (Retouch's Select menu;
   *  the AI grade with `quiet`, as it shows its own lock). */
  const get = async (type, { quiet = false } = {}) => {
    const me = quiet ? job.current : ++job.current;
    try {
      if (!(await ensure(FEATURE[type]))) return null;
      if (!quiet) setBusy(AI_TYPES.find(([k]) => k === type)[1]);
      const { r } = await results(TASK[type]);
      if (!quiet && job.current !== me) return null;
      const named = (n) => r.find((x) => x.name === n);
      if (type === 'sky') { if (!named('sky')) toast('No sky found in this photo'); return named('sky') || null; }
      if (type === 'skin') { const skin = allSkin(r); if (!skin) toast('No skin found in this photo'); return skin; }
      const sub = named('subject');
      return sub && (type === 'background' ? { ...sub, data: sub.data.map((v) => 255 - v) } : sub);
    } catch (err) {
      if (!quiet && job.current === me) toast(`AI selection didn't work: ${err.message || err}`);
      return null;
    } finally {
      if (!quiet && job.current === me) setBusy(null);
    }
  };

  const picker = pick && <AiPicker {...pick} onClose={() => setPick(null)} onCreate={(items, separate) => { setPick(null); make(items, pick.target, separate); }} />;
  const cancel = () => { job.current++; setBusy(null); };
  const lock = busy && <AiLock title={`AI ${busy}`} text="Finding it in the photo on this computer." at={null} onCancel={cancel} />;
  return { run, get, busy, picker, warm, lock };
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
    <div className="ai-picker ai-glow">
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

/** While an AI job runs (Denoise, AI masks, AI grade), a panel over the whole
 *  app (below the title bar, so the window can still be moved) keeps clicks and
 *  keys from reaching anything else, so the photo can't change under it.
 *  `at` is 0-1, or null when the job can't tell how far it is. Esc or Cancel stops it. */
export function AiLock({ title, text, at, label, cancelling, onCancel }) {
  const box = useRef(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const onKey = (e) => {
      if (box.current?.contains(e.target) && (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab')) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === 'Escape' && e.type === 'keydown') cancel.current();
    };
    const opts = { capture: true };
    window.addEventListener('keydown', onKey, opts);
    window.addEventListener('keyup', onKey, opts);
    box.current?.querySelector('button')?.focus();
    return () => { window.removeEventListener('keydown', onKey, opts); window.removeEventListener('keyup', onKey, opts); };
  }, []);
  return createPortal(
    <div className="overlay ai-lock" onContextMenu={(e) => e.preventDefault()} onWheel={(e) => e.stopPropagation()}>
      <div className="modal ai-lock-box" role="alertdialog" aria-modal="true" aria-label={title} ref={box}>
        <div className="modal-head"><h2>{title}</h2></div>
        <div className="modal-body">
          <p className="small">{cancelling ? 'Stopping…' : `${text} The rest of Flightroom waits until it is done.`}</p>
          <div className="ai-progress ai-glow busy"><span style={{ width: `${Math.round(100 * (at || 0))}%` }} /><em>{label ?? (at ? `${Math.round(100 * at)}%` : 'Working…')}</em></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm" onClick={() => cancel.current()} disabled={cancelling}>Cancel</button>
        </div>
      </div>
    </div>, document.body);
}

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
    if (r?.error) {
      if (r.error !== 'cancelled') aiDone('AI Denoise didn\'t finish', r.error);
      setRun(r.error === 'cancelled' ? null : { error: r.error });
      return;
    }
    aiDone('AI Denoise is done', photo.name || '');
    setRun(null);
    onDenoised(s.aiDenoise || DN_AMOUNT.def);
  };
  const busy = run && !run.error;
  const cancel = () => { setRun((r) => (r && !r.error ? { ...r, cancelling: true } : r)); bridge.develop.cancelDenoise(); };
  const lock = busy && <AiLock title="AI Denoise" text="Removing noise on this computer." at={run.total > 1 ? run.done / run.total : null}
    label={run.total > 1 ? null : 'Starting…'} cancelling={run.cancelling} onCancel={cancel} />;
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
          <div className="ai-progress grow ai-glow busy"><span style={{ width: `${(100 * run.done) / Math.max(1, run.total)}%` }} /><em>{run.total > 1 ? `${Math.round((100 * run.done) / run.total)}%` : 'Starting…'}</em></div>
          <button className="btn btn-sm btn-ghost" onClick={cancel}>Cancel</button>
          {lock}
        </div>
      ) : (
        <>
          <button className="btn btn-sm full ai-glow" onClick={start} title="Removes noise with AI on this computer, keeping detail. Quick with a graphics card, slow without one; the result is kept for this photo."><Icon name="ai" size={14} />Denoise…</button>
          {run?.error && <p className="ai-error small">{run.error}</p>}
        </>
      )}
    </div>
  );
}
