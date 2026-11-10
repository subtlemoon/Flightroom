// Flightroom's own title bar (the window has no Windows frame, lib.rs
// decorations(false)): an empty strip to drag the window by (double-click
// maximizes) and minimize / maximize / close at the right.
import { useEffect, useState } from 'react';
import { bridge as app } from '../bridge.js';

const glyph = { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1, shapeRendering: 'crispEdges', 'aria-hidden': true };

export function Titlebar() {
  const [max, setMax] = useState(false);
  useEffect(() => {
    if (!app) return undefined;
    const check = () => app.win.isMaximized().then(setMax, () => {});
    check();
    return app.win.onResized(check);
  }, []);
  if (!app) return null;
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="grow" data-tauri-drag-region />
      <button className="tb-btn" onClick={() => app.win.minimize()} aria-label="Minimize" title="Minimize">
        <svg {...glyph}><path d="M0 5.5h10" /></svg>
      </button>
      <button className="tb-btn" onClick={() => app.win.toggleMaximize()} aria-label={max ? 'Restore' : 'Maximize'} title={max ? 'Restore' : 'Maximize'}>
        {max
          ? <svg {...glyph}><path d="M2.5 2.5V.5h7v7h-2" /><rect x="0.5" y="2.5" width="7" height="7" /></svg>
          : <svg {...glyph}><rect x="0.5" y="0.5" width="9" height="9" /></svg>}
      </button>
      <button className="tb-btn tb-close" onClick={() => app.win.close()} aria-label="Close" title="Close">
        <svg {...glyph} shapeRendering="geometricPrecision"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
      </button>
    </div>
  );
}
