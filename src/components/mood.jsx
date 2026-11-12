// AI grade: type or pick a mood, and Flightroom grades the photo to it and
// then gives the subject its own mask and grade (develop/mood.js does the
// work). What it makes is ordinary sliders, curve and one mask, all editable,
// and one undo step.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { AiLock } from './ai.jsx';
import { MAX_MASKS, newAiPart, newMask } from '../develop/masks.js';
import { aiDone } from '../notify.js';
import { autoMood, lookSettings, maskWeights, measure, MOOD_CHIPS, MOOD_KEYS, parseMood, readScene, recipeFor, sceneRecipe, solveGrade, subjectAdjust } from '../develop/mood.js';
import { lookAt, VISION_EDGE, visionBlocked } from '../develop/vision.js';

const STRENGTHS = [['Subtle', 0.6], ['Normal', 1], ['Strong', 1.4]];
const RENDER_EDGE = 480; // px: big enough to measure, small enough to render a dozen times quickly
const OPTS_KEY = 'flightroom-mood';
const DEFAULTS = { strength: 1, subject: true, look: true };
const readOpts = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(OPTS_KEY)) }; } catch { return DEFAULTS; } };

// Exposure and white balance as they were before this session's first AI
// grade of a photo, so grading again starts from the photo, not from the last grade.
const startedFrom = new Map(); // photo id -> { from, set }
let warned = false; // said once that the vision model can't run on this computer

/**
 * The AI grade for the open photo. grade(text) runs it; `busy` is
 * { label, at (0-1) } while it works; `last` says what the last one did.
 */
export function useMoodGrade({ photo, s, update, stage, aiMasks, ensure, toast }) {
  const [busy, setBusy] = useState(null);
  const [last, setLast] = useState(null);
  const [opts, setOptsState] = useState(readOpts);
  const live = useRef(null);
  // Another photo: a grade still working stops (its renders and result would land on the new photo).
  useEffect(() => { live.current = null; setBusy(null); setLast(null); }, [photo?.id]);
  const setOpts = (patch) => setOptsState((o) => { const n = { ...o, ...patch }; try { localStorage.setItem(OPTS_KEY, JSON.stringify(n)); } catch {} return n; });

  // The vision model's look at the photo, or null when it's off, declined or can't run here (then words alone grade).
  const see = async (base, id) => {
    if (!opts.look) return null;
    const why = await visionBlocked();
    if (why) { if (!warned) toast(`AI grade can't look at photos on this computer (${why}), so it grades from your words.`); warned = true; return null; }
    // The download question shows without the lock over it.
    setBusy(null);
    const ok = await ensure('grade');
    if (live.current !== id) throw new Error('cancelled');
    setBusy({ label: 'Starting the vision model', at: 0.02 });
    if (!ok) return null;
    if (live.current !== id) throw new Error('cancelled');
    setBusy({ label: 'Looking at the photo', at: 0.03 });
    const pic = await stage.current.renderFlat?.(lookSettings(base, recipeFor({ looks: [], colors: [] }, 0)), VISION_EDGE);
    if (!pic) throw new Error('The photo isn\'t ready yet');
    const saw = await lookAt(pic, {
      onProgress: (label, f) => { if (live.current === id) setBusy({ label, at: 0.03 + 0.07 * f }); },
      onLook: () => { if (live.current === id) setBusy({ label: 'Looking at the photo', at: 0.1 }); },
    });
    return saw;
  };

  const grade = async (text) => {
    if (busy || !s || !photo) return;
    const typed = parseMood(text);
    if (text.trim() && !typed) { toast(`"${text.trim()}" isn't a mood Flightroom knows yet. Try words like dreamy, warm, moody, faded or teal.`); return; }
    const id = photo.id;
    live.current = id;
    // Start from the photo's own exposure and white balance if they're still what the last grade set.
    const prior = startedFrom.get(id);
    const same = prior && ['exposure', 'temp', 'tint'].every((k) => prior.set[k] === s[k]);
    const from = same ? prior.from : { exposure: s.exposure, temp: s.temp, tint: s.tint, wb: s.wb };
    const base = { ...s, ...from };
    // The subject is found while the grade is worked out (it's the slow part).
    const subjectP = opts.subject ? aiMasks.get('subject', { quiet: true }).catch(() => null) : Promise.resolve(null);
    try {
      setBusy({ label: 'Reading the photo', at: 0.02 });
      let saw = null;
      try { saw = await see(base, id); } catch (err) {
        if (err.message === 'cancelled') throw err;
        toast(`The vision model didn't run (${err.message || err}), so this grade is from your words only.`);
      }
      if (!typed && !saw) { toast('Type a mood, or turn on Look at the photo so AI can pick one.'); return; }
      const scene = readScene(saw);
      const mood = typed || autoMood(saw);
      const { r, notes } = sceneRecipe(recipeFor(mood, opts.strength), scene, opts.strength);
      const render = async (st) => {
        if (live.current !== id) throw new Error('cancelled');
        const pic = await stage.current.renderFlat?.(st, RENDER_EDGE);
        if (!pic) throw new Error('The photo isn\'t ready yet');
        render.size = pic;
        return pic.rgba;
      };
      const out = await solveGrade(base, r, render, {
        onStep: (i, n) => setBusy({ label: i <= 6 ? 'Trying the sliders on this photo' : 'Grading', at: 0.1 + 0.55 * (i / n) }),
      });
      const patch = { wb: out.settings.wb, exposure: out.settings.exposure, temp: out.settings.temp, tint: out.settings.tint, curve: out.settings.curve, bw: out.settings.bw };
      for (const k of MOOD_KEYS) patch[k] = out.settings[k];
      let subjectNote = opts.subject ? 'no clear subject' : null, mask = null;
      if (opts.subject) {
        setBusy({ label: 'Finding the subject', at: 0.7 });
        const sub = await subjectP;
        if (live.current !== id) return;
        if (sub) {
          setBusy({ label: 'Grading the subject', at: 0.92 });
          const { w, h } = render.size;
          const { inW, outW } = maskWeights(sub, w, h);
          const adj = subjectAdjust(measure(out.last, inW), measure(out.last, outW), r, out.before.C > 0 ? out.after.C / out.before.C : 1);
          if (adj) {
            mask = newMask(newAiPart('subject', sub), [], adj);
            mask.name = 'Mood subject';
            mask.mood = true;
            subjectNote = 'subject graded separately';
          }
        } else subjectNote = null;
      }
      if (live.current !== id) return;
      update((old) => {
        const masks = (old.masks || []).filter((m) => !m.mood);
        if (mask && masks.length < MAX_MASKS) masks.push(mask);
        return { ...old, ...patch, masks, ...(mask ? { masksOwned: true } : {}) };
      }, `AI grade: ${mood.name}`);
      startedFrom.set(id, { from, set: { exposure: patch.exposure, temp: patch.temp, tint: patch.tint } });
      setLast({ name: mood.name, unknown: mood.unknown, subject: subjectNote, saw: saw || null, notes, picked: !typed });
      aiDone('AI grade is done', `Graded “${mood.name}”`);
    } catch (err) {
      if (err.message !== 'cancelled' && live.current === id) { toast(`AI grade didn't work: ${err.message || err}`); aiDone('AI grade didn\'t work', String(err.message || err)); }
    } finally {
      if (live.current === id) { live.current = null; setBusy(null); }
    }
  };
  const cancel = () => { live.current = null; setBusy(null); };
  const lock = busy && <AiLock title="AI grade" text="Grading this photo on this computer." at={busy.at} label={`${busy.label}…`} onCancel={cancel} />;
  return { grade, busy, last, opts, setOpts, lock };
}

const words = (t) => t.toLowerCase().split(/[\s,]+/).filter(Boolean);
// A chip adds its word to the mood, or takes it out again, so several can be combined before grading.
const toggleWord = (t, w) => {
  const has = words(t).includes(w.toLowerCase());
  if (has) return t.split(/(\s+|,\s*)/).filter((x) => x.toLowerCase() !== w.toLowerCase()).join('').replace(/^[\s,]+|[\s,]+$/g, '').replace(/(\s*,\s*|\s+){2,}/g, ' ');
  return t.trim() ? `${t.trim()} ${w.toLowerCase()}` : w.toLowerCase();
};

/** The AI grade box at the top of Develop's right panel. */
export function MoodPanel({ mood }) {
  const [text, setText] = useState('');
  const { busy, last, opts, setOpts } = mood;
  const go = (t) => { if (t.trim() || opts.look) mood.grade(t); };
  return (
    <div className="mood">
      <div className="mood-row">
        <input type="text" className="input mood-input" placeholder={opts.look ? 'A mood, or empty for AI' : 'Describe a mood…'} title={`Any words: dreamy, warm, moody teal, faded film, golden hour, halation, vignette…${opts.look ? ' Leave it empty and AI picks a mood for the photo.' : ''}`} value={text} disabled={!!busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(text); }} />
        <button className={`btn btn-sm ai-glow${busy ? ' busy' : ''}`} disabled={!!busy || (!text.trim() && !opts.look)} onClick={() => go(text)}
          title="AI on this computer looks at the photo and grades it to the mood: the result is normal sliders, effects and a mask you can change"><Icon name="ai" size={14} />Grade</button>
      </div>
      <div className="mood-chips">
        {MOOD_CHIPS.map((m) => {
          const on = words(text).includes(m.toLowerCase());
          return <button key={m} className={`chip${on ? ' on' : ''}`} disabled={!!busy} onClick={() => setText(toggleWord(text, m))}
            title={on ? 'Take it out of the mood' : 'Add to the mood (pick several, then Grade)'}>{m}</button>;
        })}
      </div>
      {busy ? (
        <div className="ai-progress ai-glow busy"><span style={{ width: `${Math.round(busy.at * 100)}%` }} /><em>{busy.label}…</em></div>
      ) : (
        <div className="mood-row">
          <div className="seg small">
            {STRENGTHS.map(([label, k]) => <button key={label} className={opts.strength === k ? 'on' : ''} onClick={() => setOpts({ strength: k })}>{label}</button>)}
          </div>
          <span className="mood-checks">
          <label className="dev-check inline" title="Finds the subject with AI and gives it its own mask and grade, so it stands out in the mood"><input type="checkbox" checked={opts.subject} onChange={(e) => setOpts({ subject: e.target.checked })} />Subject</label>
          <label className="dev-check inline" title="A vision model on this computer looks at the photo first (the place, the light, the subject) and the grade, glow and vignette follow what it sees"><input type="checkbox" checked={opts.look} onChange={(e) => setOpts({ look: e.target.checked })} />Look</label>
          </span>
        </div>
      )}
      {last && (
        <div className="muted small mood-note">
          {last.saw && <p className="mood-saw" title="What the vision model saw in the photo">AI saw: {last.saw}</p>}
          <p>{last.picked ? 'AI picked' : 'Graded'} “{last.name}”{[...last.notes, last.subject].filter(Boolean).map((n) => `, ${n}`).join('')}. Ctrl+Z undoes it.{last.unknown.length ? ` Skipped: ${last.unknown.join(', ')}.` : ''}</p>
        </div>
      )}
    </div>
  );
}
