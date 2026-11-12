// Lightroom's Vectorscope, under the histogram: hue round the ring, saturation
// out from the centre, with the skin tone line and the six colour targets.
// Collapsible; the colour space it measures in is remembered (sRGB first).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, Icon } from './ui.jsx';
import { SCOPE_SPACES, SKIN_ANGLE, TARGETS, chroma, scopeGrid } from '../develop/scope.js';

const KEY = 'flightroom-scope';
const load = () => { try { return { open: true, space: 'srgb', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { open: true, space: 'srgb' }; } };

let lastPx = null;
if (typeof window !== 'undefined') window.addEventListener('develop:hist', (e) => { lastPx = e.detail?.px || null; });

// The ring's colours: each angle's hue at mid grey, a little muted, as Lightroom's ring is.
let RING = null;
function ring() {
  if (RING) return RING;
  RING = [];
  for (let d = 0; d < 360; d += 3) {
    const a = (d * Math.PI) / 180, cb = Math.cos(a) * 0.3, cr = Math.sin(a) * 0.3;
    let r = 0.5 + 1.5748 * cr, g = 0.5 - 0.1873 * cb - 0.4681 * cr, b = 0.5 + 1.8556 * cb;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    [r, g, b] = [r, g, b].map((v) => (v - lo) / (hi - lo || 1));
    RING.push([a, `rgb(${[r, g, b].map((v) => Math.round(62 + (0.12 + 0.88 * v) * 104)).join(',')})`]);
  }
  return RING;
}

export function Vectorscope() {
  const [cfg, setCfg] = useState(load);
  const [px, setPx] = useState(lastPx);
  const ref = useRef();
  const save = (c) => { setCfg(c); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  useEffect(() => {
    const on = (e) => setPx(e.detail?.px || null);
    window.addEventListener('develop:hist', on);
    return () => window.removeEventListener('develop:hist', on);
  }, []);
  const grid = useMemo(() => (cfg.open && px ? scopeGrid(px, cfg.space) : null), [px, cfg.space, cfg.open]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w * 0.4, h * 0.42), cx = w / 2, cy = h * 0.53;
    const at = (a, r) => [cx + Math.cos(a) * r * R, cy - Math.sin(a) * r * R];
    ctx.lineCap = 'round';

    // Skin tone line: a soft wedge and the line, with a person at its end.
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -SKIN_ANGLE - 0.17, -SKIN_ANGLE + 0.17);
    ctx.closePath();
    ctx.fill();

    // Dashed lines out to each colour, with the 75% target as a tick across it.
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([5 * dpr, 5 * dpr]);
    ctx.beginPath();
    for (const t of TARGETS) { ctx.moveTo(cx, cy); ctx.lineTo(...at(t.angle, 1)); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath();
    for (const t of TARGETS) {
      const [x, y] = at(t.angle, t.tick), nx = -Math.sin(t.angle) * 6 * dpr, ny = -Math.cos(t.angle) * 6 * dpr;
      ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny);
    }
    ctx.stroke();

    // The pixels: each cell drawn in its own colour, lighter where many pixels fall.
    if (grid) {
      const { n, count, col, max } = grid;
      const img = new ImageData(n, n), lmax = Math.log1p(max);
      for (let k = 0; k < n * n; k++) {
        const m = count[k];
        if (m < 0.05) continue;
        const t = Math.max(0, Math.log1p(m) / lmax), lift = 0.3 + 0.45 * t;
        for (let j = 0; j < 3; j++) img.data[k * 4 + j] = Math.round(((col[k * 3 + j] / m) * (1 - lift) + lift) * 255);
        img.data[k * 4 + 3] = Math.round(Math.min(1, 0.25 + 0.75 * t + m * 0.5) * 255);
      }
      const off = new OffscreenCanvas(n, n);
      off.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, cx - R, cy - R, 2 * R, 2 * R);
    }

    ctx.strokeStyle = 'rgba(235,235,235,0.85)';
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...at(SKIN_ANGLE, 1));
    ctx.stroke();
    const [px0, py0] = at(SKIN_ANGLE, 1.17);
    ctx.fillStyle = 'rgba(200,200,200,0.75)';
    ctx.beginPath();
    ctx.arc(px0, py0 - 3 * dpr, 3.4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px0, py0 + 5 * dpr, 6 * dpr, 3.6 * dpr, 0, Math.PI, 0);
    ctx.fill();

    // The hue ring, then the colour dots on it.
    ctx.lineWidth = 2.6 * dpr;
    const segs = ring();
    segs.forEach(([a, style], i) => {
      const b = i + 1 < segs.length ? segs[i + 1][0] : Math.PI * 2;
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -b - 0.01, -a);
      ctx.stroke();
    });
    for (const t of TARGETS) {
      ctx.fillStyle = t.dot;
      ctx.beginPath();
      ctx.arc(...at(t.angle, 1), 5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <div className={`dev-scope${cfg.open ? ' open' : ''}`}>
      <div className="dev-scope-head">
        <button className="dev-scope-toggle" onClick={() => save({ ...cfg, open: !cfg.open })} title={cfg.open ? 'Hide the Vectorscope' : 'Show the Vectorscope'}>
          <Icon name={cfg.open ? 'chevD' : 'chevR'} size={11} />Vectorscope
        </button>
        {cfg.open && <Dropdown className="dev-scope-space" value={cfg.space} title="Colour space the Vectorscope measures in"
          options={SCOPE_SPACES.map((x) => ({ value: x.id, label: x.label }))} onChange={(space) => save({ ...cfg, space })} />}
      </div>
      {cfg.open && <canvas className="dev-scope-canvas" ref={ref}
        title="Vectorscope: hue round the ring, saturation out from the centre. The line is the skin tone line; ticks mark 75% saturation." />}
    </div>
  );
}

// For tests: where a colour lands (x, y from the centre, ring = 1).
export const scopePoint = (r, g, b) => chroma(r, g, b);
