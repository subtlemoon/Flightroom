// AI grade: type or pick a mood, and Flightroom grades the photo to it and
// then gives the subject its own mask and grade (develop/mood.js does the
// work). What it makes is ordinary sliders, curve and one mask, all editable,
// and one undo step.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { MAX_MASKS, newAiPart, newMask } from '../develop/masks.js';
import { maskWeights, measure, MOOD_CHIPS, MOOD_KEYS, parseMood, recipeFor, solveGrade, subjectAdjust } from '../develop/mood.js';

const STRENGTHS = [['Subtle', 0.6], ['Normal', 1], ['Strong', 1.4]];
const RENDER_EDGE = 480; // px: big enough to measure, small enough to render a dozen times quickly
const OPTS_KEY = 'flightroom-mood';
const readOpts = () => { try { return { strength: 1, subject: true, ...JSON.parse(localStorage.getItem(OPTS_KEY)) }; } catch { return { strength: 1, subject: true }; } };

// Exposure and white balance as they were before this session's first AI
// grade of a photo, so grading again starts from the photo, not from the last grade.
const startedFrom = new Map(); // photo id -> { from, set }

/**
 * The AI grade for the open photo. grade(text) runs it; `busy` is
 * { label, at (0-1) } while it works; `last` says what the last one did.
 */
export function useMoodGrade({ photo, s, update, stage, aiMasks, toast }) {
  const [busy, setBusy] = useState(null);
  const [last, setLast] = useState(null);
  const [opts, setOptsState] = useState(readOpts);
  const live = useRef(null);
  useEffect(() => { setLast(null); }, [photo?.id]);
  const setOpts = (patch) => setOptsState((o) => { const n = { ...o, ...patch }; try { localStorage.setItem(OPTS_KEY, JSON.stringify(n)); } catch {} return n; });

  const grade = async (text) => {
    if (busy || !s || !photo) return;
    const mood = parseMood(text);
    if (!mood) { toast(`"${text.trim()}" isn't a mood Flightroom knows yet. Try words like dreamy, warm, moody, faded or teal.`); return; }
    const id = photo.id;
    live.current = id;
    const r = recipeFor(mood, opts.strength);
    // Start from the photo's own exposure and white balance if they're still what the last grade set.
    const prior = startedFrom.get(id);
    const same = prior && ['exposure', 'temp', 'tint'].every((k) => prior.set[k] === s[k]);
    const from = same ? prior.from : { exposure: s.exposure, temp: s.temp, tint: s.tint, wb: s.wb };
    const base = { ...s, ...from };
    // The subject is found while the grade is worked out (it's the slow part).
    const subjectP = opts.subject ? aiMasks.get('subject').catch(() => null) : Promise.resolve(null);
    try {
      setBusy({ label: 'Reading the photo', at: 0.02 });
      const render = async (st) => {
        if (live.current !== id) throw new Error('cancelled');
        const pic = await stage.current.renderFlat?.(st, RENDER_EDGE);
        if (!pic) throw new Error('The photo isn\'t ready yet');
        render.size = pic;
        return pic.rgba;
      };
      const out = await solveGrade(base, r, render, {
        onStep: (i, n) => setBusy({ label: i <= 6 ? 'Trying the sliders on this photo' : 'Grading', at: 0.05 + 0.6 * (i / n) }),
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
      setLast({ name: text.trim(), unknown: mood.unknown, subject: subjectNote });
    } catch (err) {
      if (err.message !== 'cancelled') toast(`AI grade didn't work: ${err.message || err}`);
    } finally {
      if (live.current === id) live.current = null;
      setBusy(null);
    }
  };
  return { grade, busy, last, opts, setOpts };
}

/** The AI grade box at the top of Develop's right panel. */
export function MoodPanel({ mood }) {
  const [text, setText] = useState('');
  const { busy, last, opts, setOpts } = mood;
  const go = (t) => { if (t.trim()) mood.grade(t); };
  return (
    <div className="mood">
      <div className="mood-row">
        <input type="text" className="input mood-input" placeholder="Describe a mood…" title="Any words: dreamy, warm, moody teal, faded film, golden hour…" value={text} disabled={!!busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(text); }} />
        <button className={`btn btn-sm ai-glow${busy ? ' busy' : ''}`} disabled={!!busy || !text.trim()} onClick={() => go(text)}
          title="Grades this photo to the mood with AI on this computer: the result is normal sliders you can change"><Icon name="ai" size={14} />Grade</button>
      </div>
      <div className="mood-chips">
        {MOOD_CHIPS.map((m) => <button key={m} className="chip" disabled={!!busy} onClick={() => { setText(m); go(m); }}>{m}</button>)}
      </div>
      {busy ? (
        <div className="ai-progress ai-glow busy"><span style={{ width: `${Math.round(busy.at * 100)}%` }} /><em>{busy.label}…</em></div>
      ) : (
        <div className="mood-row">
          <div className="seg small">
            {STRENGTHS.map(([label, k]) => <button key={label} className={opts.strength === k ? 'on' : ''} onClick={() => setOpts({ strength: k })}>{label}</button>)}
          </div>
          <label className="dev-check inline" title="Finds the subject with AI and gives it its own mask and grade, so it stands out in the mood"><input type="checkbox" checked={opts.subject} onChange={(e) => setOpts({ subject: e.target.checked })} />Subject</label>
        </div>
      )}
      {last && (
        <p className="muted small mood-note">Graded “{last.name}”{last.subject ? `, ${last.subject}` : ''}. Ctrl+Z undoes it.{last.unknown.length ? ` Skipped: ${last.unknown.join(', ')}.` : ''}</p>
      )}
    </div>
  );
}
