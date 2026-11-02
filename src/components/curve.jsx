// The point curve editor, used by the Tone curve section and by each mask's Curve.
import { useEffect, useMemo, useRef, useState } from 'react';
import { monotoneCurve, parametric } from '../develop/luts.js';
import { LINEAR_CURVE } from '../develop/params.js';

const PARAMETRIC_KEYS = ['pShadows', 'pDarks', 'pLights', 'pHighlights', 'pSplitS', 'pSplitM', 'pSplitH'];
const PARAMETRIC_DEFAULT = { pSplitS: 25, pSplitM: 50, pSplitH: 75 };

const CH_CLASS = { curve: '', curveR: ' ch-r', curveG: ' ch-g', curveB: ' ch-b' };
const HIST_CH = { curveR: 0, curveG: 1, curveB: 2 };

// The photo's histogram behind the curve, as in Lightroom (the Develop stage
// sends it as 'develop:hist': red, green and blue counts per level).
let lastHist = null;
if (typeof window !== 'undefined') window.addEventListener('develop:hist', (e) => { lastHist = e.detail; });
function useHist() {
  const [bins, setBins] = useState(lastHist);
  useEffect(() => {
    const on = (e) => setBins(e.detail);
    window.addEventListener('develop:hist', on);
    return () => window.removeEventListener('develop:hist', on);
  }, []);
  return bins;
}

function histPath(all, channel, size) {
  const bins = all?.pre || all; // what goes into the curve, as Lightroom shows it
  if (!bins) return null;
  const ch = HIST_CH[channel];
  const v = (i) => (ch == null ? (bins[0][i] + bins[1][i] + bins[2][i]) / 3 : bins[ch][i]);
  let max = 1;
  for (let i = 2; i < 254; i++) max = Math.max(max, v(i));
  let d = `M0,${size}`;
  for (let i = 0; i < 256; i++) d += `L${((i / 255) * size).toFixed(1)},${(size - Math.min(1, Math.sqrt(v(i) / max)) * size * 0.9).toFixed(1)}`;
  return `${d}L${size},${size}Z`;
}

// Point curve: drag points, click to add, double-click a point (or drag it off) to remove it.
export function CurveEditor({ s, channel, readOnly, set }) {
  const ref = useRef();
  const drag = useRef(null);
  const [read, setRead] = useState(null);
  const SIZE = 236;
  const pts = s[channel];
  const bins = useHist();
  const hist = useMemo(() => histPath(bins, channel, SIZE), [bins, channel]);
  const toXY = ([x, y]) => [(x / 255) * SIZE, SIZE - (y / 255) * SIZE];
  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.round(Math.min(255, Math.max(0, ((e.clientX - r.left) / r.width) * 255))), Math.round(Math.min(255, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 255)))];
  };
  const curve = useMemo(() => monotoneCurve(pts.map(([x, y]) => [x / 255, y / 255])), [pts]);
  const isMaster = channel === 'curve';
  // Point mode draws the point curve itself, so the dots always sit on the line;
  // what the Parametric sliders add on top shows as a faint second line.
  // Parametric mode (read-only) draws the two combined.
  const pv = PARAMETRIC_KEYS.map((k) => s[k] ?? PARAMETRIC_DEFAULT[k] ?? 0);
  const regions = isMaster && pv.some((v, i) => v !== (PARAMETRIC_DEFAULT[PARAMETRIC_KEYS[i]] ?? 0));
  const line = (f) => {
    let d = '';
    for (let i = 0; i <= SIZE; i++) {
      const x = i / SIZE;
      const y = Math.min(1, Math.max(0, f(x)));
      d += `${i ? 'L' : 'M'}${i},${(SIZE - y * SIZE).toFixed(2)}`;
    }
    return d;
  };
  const path = useMemo(() => line(readOnly && regions ? (x) => curve(parametric(s, x)) : curve), [curve, readOnly, regions, ...pv]);
  const combined = useMemo(() => (!readOnly && regions ? line((x) => curve(parametric(s, x))) : null),
    [curve, readOnly, regions, ...pv]);
  const outAt = (x) => Math.round(Math.min(1, Math.max(0, readOnly && regions ? curve(parametric(s, x / 255)) : curve(x / 255))) * 255);

  const near = (x, y) => pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10);
  const down = (e) => {
    if (readOnly) return;
    const [x, y] = fromEvent(e);
    let i = near(x, y);
    let next = pts;
    if (i < 0) {
      // A click straight above or below a point moves that point: two points
      // at one input would leave one of them off the line.
      i = pts.findIndex((p) => p[0] === x);
      next = i >= 0 ? pts.map((q, j) => (j === i ? [x, y] : q)) : [...pts, [x, y]].sort((a, b) => a[0] - b[0]);
      if (i < 0) i = next.findIndex((p) => p[0] === x);
      set(channel, next);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, pts: next };
    setRead([x, y]);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) {
      if (!readOnly && ref.current) { const [x] = fromEvent(e); setRead([x, outAt(x)]); }
      return;
    }
    let [x, y] = fromEvent(e);
    const p = d.pts;
    const lo = d.i > 0 ? p[d.i - 1][0] + 1 : 0, hi = d.i < p.length - 1 ? p[d.i + 1][0] - 1 : 255;
    if (d.i === 0) x = Math.min(x, hi);
    else if (d.i === p.length - 1) x = Math.max(x, lo);
    else x = Math.min(hi, Math.max(lo, x));
    d.pts = p.map((q, j) => (j === d.i ? [x, y] : q));
    // One change per screen frame, however fast the mouse reports.
    if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; set(channel, d.pts); });
    setRead([x, y]);
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.raf) { cancelAnimationFrame(d.raf); set(channel, d.pts); }
  };
  const remove = (e) => {
    if (readOnly) return;
    const [x, y] = fromEvent(e);
    const i = near(x, y);
    if (i > 0 && i < pts.length - 1) set(channel, pts.filter((_, j) => j !== i));
  };
  return (
    <div className={`dev-curve${CH_CLASS[channel] || ''}${readOnly ? ' readonly' : ''}`}>
      {/* The handlers sit on a padded box so the corner points can be grabbed past the rounded edge. */}
      <div className="dev-curve-pad" onPointerDown={down} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
        onPointerLeave={() => !drag.current && setRead(null)} onDoubleClick={remove}>
      <svg ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[1, 2, 3].map((i) => <g key={i}><line x1={(i * SIZE) / 4} y1={0} x2={(i * SIZE) / 4} y2={SIZE} /><line y1={(i * SIZE) / 4} x1={0} y2={(i * SIZE) / 4} x2={SIZE} /></g>)}
        {hist && <path className="hist" d={hist} />}
        <line className="diag" x1={0} y1={SIZE} x2={SIZE} y2={0} />
        {combined && <path className="combined" d={combined} />}
        <path d={path} />
        {!readOnly && pts.map((p, i) => { const [x, y] = toXY(p); return <circle key={i} cx={x} cy={y} r={5} />; })}
      </svg>
      </div>
      <div className="dev-curve-foot">
        <span className="dev-curve-read">{read ? `Input ${read[0]}  ·  Output ${read[1]}` : readOnly ? 'Shape the curve with the sliders below' : 'Click to add, double-click to delete'}</span>
        {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => set(channel, LINEAR_CURVE)}>Linear</button>}
      </div>
    </div>
  );
}
