// The point curve editor, used by the Tone curve section and by each mask's Curve.
import { useMemo, useRef, useState } from 'react';
import { monotoneCurve, parametric } from '../develop/luts.js';
import { LINEAR_CURVE } from '../develop/params.js';

const CH_CLASS = { curve: '', curveR: ' ch-r', curveG: ' ch-g', curveB: ' ch-b' };

// Point curve: drag points, click to add, double-click a point (or drag it off) to remove it.
export function CurveEditor({ s, channel, readOnly, set }) {
  const ref = useRef();
  const drag = useRef(null);
  const [read, setRead] = useState(null);
  const SIZE = 236;
  const pts = s[channel];
  const toXY = ([x, y]) => [(x / 255) * SIZE, SIZE - (y / 255) * SIZE];
  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.round(Math.min(255, Math.max(0, ((e.clientX - r.left) / r.width) * 255))), Math.round(Math.min(255, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 255)))];
  };
  const curve = useMemo(() => monotoneCurve(pts.map(([x, y]) => [x / 255, y / 255])), [pts]);
  const isMaster = channel === 'curve';
  const path = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 96; i++) {
      const x = i / 96;
      const y = Math.min(1, Math.max(0, curve(isMaster ? parametric(s, x) : x)));
      d += `${i ? 'L' : 'M'}${(x * SIZE).toFixed(1)},${(SIZE - y * SIZE).toFixed(1)}`;
    }
    return d;
  }, [curve, isMaster, s.pShadows, s.pDarks, s.pLights, s.pHighlights, s.pSplitS, s.pSplitM, s.pSplitH]);

  const near = (x, y) => pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10);
  const down = (e) => {
    if (readOnly) return;
    const [x, y] = fromEvent(e);
    let i = near(x, y);
    let next = pts;
    if (i < 0) {
      next = [...pts, [x, y]].sort((a, b) => a[0] - b[0]);
      i = next.findIndex((p) => p[0] === x && p[1] === y);
      set(channel, next);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, pts: next };
    setRead([x, y]);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) {
      if (!readOnly && ref.current) { const [x] = fromEvent(e); setRead([x, Math.round(Math.min(1, Math.max(0, curve(isMaster ? parametric(s, x / 255) : x / 255))) * 255)]); }
      return;
    }
    let [x, y] = fromEvent(e);
    const p = d.pts;
    const lo = d.i > 0 ? p[d.i - 1][0] + 1 : 0, hi = d.i < p.length - 1 ? p[d.i + 1][0] - 1 : 255;
    if (d.i === 0) x = Math.min(x, hi);
    else if (d.i === p.length - 1) x = Math.max(x, lo);
    else x = Math.min(hi, Math.max(lo, x));
    const next = p.map((q, j) => (j === d.i ? [x, y] : q));
    d.pts = next;
    set(channel, next);
    setRead([x, y]);
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
      <div className="dev-curve-pad" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => !drag.current && setRead(null)} onDoubleClick={remove}>
      <svg ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[1, 2, 3].map((i) => <g key={i}><line x1={(i * SIZE) / 4} y1={0} x2={(i * SIZE) / 4} y2={SIZE} /><line y1={(i * SIZE) / 4} x1={0} y2={(i * SIZE) / 4} x2={SIZE} /></g>)}
        <line className="diag" x1={0} y1={SIZE} x2={SIZE} y2={0} />
        <path d={path} />
        {!readOnly && pts.map((p, i) => { const [x, y] = toXY(p); return <circle key={i} cx={x} cy={y} r={5} />; })}
      </svg>
      </div>
      <div className="dev-curve-foot">
        <span className="dev-curve-read">{read ? `Input ${read[0]}  ·  Output ${read[1]}` : readOnly ? 'Shape the curve with the sliders below' : 'Click to add a point, double-click to remove'}</span>
        {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => set(channel, LINEAR_CURVE)}>Linear</button>}
      </div>
    </div>
  );
}
