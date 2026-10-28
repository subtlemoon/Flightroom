// Lightroom-style slider: label, typed value and track. Double-click resets it.
import { memo, useState } from 'react';
import { formatValue } from '../develop/params.js';

// Slider track position for a value (temperature uses a log scale, like Lightroom).
const toPos = (sl, v) => (sl.log ? (Math.log(v) - Math.log(sl.min)) / (Math.log(sl.max) - Math.log(sl.min)) : (v - sl.min) / (sl.max - sl.min));
const fromPos = (sl, p) => {
  const v = sl.log ? Math.exp(Math.log(sl.min) + p * (Math.log(sl.max) - Math.log(sl.min))) : sl.min + p * (sl.max - sl.min);
  return Math.min(sl.max, Math.max(sl.min, Math.round(v / sl.step) * sl.step));
};

// Redraws only when its own value changes (onSet is the panel's stable setter).
export const Slider = memo(function Slider({ sl, value, def, onSet, color }) {
  const [text, setText] = useState(null);
  const pos = toPos(sl, value ?? def ?? 0);
  const zero = sl.log || sl.min >= 0 ? 0 : toPos(sl, 0);
  const onChange = (v) => onSet(sl.key, v);
  const commitText = () => {
    const n = Number(String(text).replace(/[^\d.+-]/g, ''));
    if (text !== null && Number.isFinite(n)) onChange(Math.min(sl.max, Math.max(sl.min, n)));
    setText(null);
  };
  return (
    <div className="dev-slider" onDoubleClick={(e) => { if (!e.target.closest('input[type=text]')) onChange(def ?? 0); }} title="Double-click to reset">
      <span className="dev-slider-label">{sl.label}</span>
      <input type="text" className="dev-slider-value" value={text ?? formatValue(sl, value)} onChange={(e) => setText(e.target.value)}
        onBlur={commitText} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(null); e.currentTarget.blur(); } }} />
      <div className={`dev-track${sl.gradient ? ` grad-${sl.gradient}` : ''}`} style={color ? { '--track': color } : undefined}>
        {!sl.gradient && !color && <div className="dev-fill" style={{ left: `${Math.min(zero, pos) * 100}%`, width: `${Math.abs(pos - zero) * 100}%` }} />}
        <input type="range" min={0} max={1000} step={1} value={Math.round(pos * 1000)}
          onChange={(e) => onChange(fromPos(sl, Number(e.target.value) / 1000))}
          onPointerUp={(e) => e.currentTarget.blur()} />
      </div>
    </div>
  );
});
