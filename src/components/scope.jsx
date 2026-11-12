// Lightroom's Vectorscope, under the histogram: hue round the ring, saturation
// out from the centre, with the skin tone line and the six colour targets.
// Collapsible; the colour space it measures in is remembered (sRGB first).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, Icon } from './ui.jsx';
import { SCOPE_SPACES, SKIN_ANGLE, TARGETS, chroma, scopeAt, scopeGrid, skinReading } from '../develop/scope.js';

const KEY = 'flightroom-scope';
const load = () => { try { return { open: true, space: 'srgb', zoom: 1, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { open: true, space: 'srgb' }; } };

let lastHist = null;
if (typeof window !== 'undefined') window.addEventListener('develop:hist', (e) => { lastHist = e.detail?.px ? e.detail : null; });

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

// The pixels are binned over a square a little past the ring, so colours
// outside the colour space still show (just beyond the ring).
const EXTENT = 1.2;
const ZOOMS = [1, 2, 4];

// The pixels as a small picture: each cell in its own colour, lighter where many pixels fall.
function pointsImage(grid) {
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
  return off;
}

const skinText = ({ off, sat }) => {
  const a = Math.abs(off);
  if (sat < 3) return 'Neutral (no colour to read)';
  if (a > 60) return `Sat ${Math.round(sat)}%`;
  return `${a < 1.5 ? 'On the skin line' : `${Math.round(a)}° toward ${off > 0 ? 'yellow' : 'red'}`} · Sat ${Math.round(sat)}%`;
};

export function Vectorscope() {
  const [cfg, setCfg] = useState(load);
  const [hist, setHistData] = useState(lastHist);
  const [hover, setHover] = useState(null);
  const ref = useRef();
  const save = (c) => { setCfg(c); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  const zoom = ZOOMS.includes(cfg.zoom) ? cfg.zoom : 1;
  useEffect(() => {
    const on = (e) => setHistData(e.detail?.px ? e.detail : null);
    // Pointer moves come in fast: one redraw per frame at most.
    let raf = 0, next = null;
    const onHover = (e) => {
      next = e.detail;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setHover(next); });
    };
    window.addEventListener('develop:hist', on);
    window.addEventListener('develop:scope-hover', onHover);
    return () => { window.removeEventListener('develop:hist', on); window.removeEventListener('develop:scope-hover', onHover); cancelAnimationFrame(raf); };
  }, []);
  const points = useMemo(() => (cfg.open && hist ? pointsImage(scopeGrid(hist.px, cfg.space, 240, zoom / EXTENT)) : null), [hist, cfg.space, cfg.open, zoom]);
  const mark = cfg.open && hist && hover ? scopeAt(hist.px, hist.w, hist.h, hover[0], hover[1], cfg.space) : null;

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

    // Skin tone line: a soft wedge (about where most skin falls), the line on top later.
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -SKIN_ANGLE - 0.17, -SKIN_ANGLE + 0.17);
    ctx.closePath();
    ctx.fill();

    // Dashed lines out to each colour, with its pure colour as a tick across it (moves out when zoomed).
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
      if (t.tick * zoom > 1.1) continue;
      const [x, y] = at(t.angle, t.tick * zoom), nx = -Math.sin(t.angle) * 6 * dpr, ny = -Math.cos(t.angle) * 6 * dpr;
      ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny);
    }
    ctx.stroke();

    if (points) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const E = EXTENT * R;
      // Round, a little past the ring, so nothing ends on a straight edge.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.14 * R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(points, cx - E, cy - E, 2 * E, 2 * E);
      ctx.restore();
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

    // The spot under the pointer on the photo: a cross, as Lightroom shows it.
    if (mark) {
      const [mx, my] = [cx + mark[0] * zoom * R, cy - mark[1] * zoom * R];
      const x = Math.max(4 * dpr, Math.min(w - 4 * dpr, mx)), y = Math.max(4 * dpr, Math.min(h - 4 * dpr, my));
      const arm = 9 * dpr;
      for (const [style, lw] of [['rgba(0,0,0,0.7)', 3.6], ['rgba(255,255,255,0.95)', 1.6]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = lw * dpr;
        ctx.beginPath();
        ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
        ctx.stroke();
      }
    }
  });

  return (
    <div className={`dev-scope${cfg.open ? ' open' : ''}`}>
      <div className="dev-scope-head">
        <button className="dev-scope-toggle" onClick={() => save({ ...cfg, open: !cfg.open })} title={cfg.open ? 'Hide the Vectorscope' : 'Show the Vectorscope'}>
          <Icon name={cfg.open ? 'chevD' : 'chevR'} size={11} />Vectorscope
        </button>
        {cfg.open && (
          <div className="dev-scope-tools">
            <div className="dev-scope-zoom" title="Zoom in on low saturation, to read skin tones more closely (as DaVinci Resolve's 2x)">
              {ZOOMS.map((z) => <button key={z} className={z === zoom ? 'on' : ''} onClick={() => save({ ...cfg, zoom: z })}>{z}×</button>)}
            </div>
            <Dropdown className="dev-scope-space" value={cfg.space} title="Colour space the Vectorscope measures in"
              options={SCOPE_SPACES.map((x) => ({ value: x.id, label: x.label }))} onChange={(space) => save({ ...cfg, space })} />
          </div>
        )}
      </div>
      {cfg.open && <canvas className="dev-scope-canvas" ref={ref}
        title="Vectorscope: hue round the ring, saturation out from the centre. The line is the skin tone line; ticks mark the colour space's pure colours (its edge). Hover the photo to see where a spot sits." />}
      {cfg.open && <div className="dev-scope-read">{mark ? skinText(skinReading(mark)) : 'Hover the photo to read a spot'}</div>}
    </div>
  );
}

// For tests: where a colour lands (x, y from the centre, ring = 1).
export const scopePoint = (r, g, b) => chroma(r, g, b);
