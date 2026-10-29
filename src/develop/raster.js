// Type and shape layers are drawn with the browser's 2D canvas (fonts,
// curves), at the size they're shown, then handed to the graphics card
// (compose.js). Positions and sizes are fractions like everything in Retouch:
// a text's size is its height as a fraction of the photo's long edge.

import { canvas } from './selection.js';

export const FONTS = [
  'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Garamond', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console',
  'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

export const TEXT_DEFAULT = {
  text: 'Text', font: 'Arial', size: 0.05, color: [1, 1, 1], bold: false, italic: false, underline: false,
  align: 'left', tracking: 0, leading: 1.2, x: 0.1, y: 0.1,
};

const measureCtx = (() => { let c; return () => (c ||= canvas(8, 8).getContext('2d')); })();
const fontOf = (t, px) => `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${px}px "${t.font}", sans-serif`;

/**
 * Where a text's lines go, in oriented px: { lines: [{ s, x, w }], lh, box }.
 * x, y is the top of the text: its left, centre or right edge by `align`.
 */
export function textLayout(t, ow, oh) {
  const L = Math.max(ow, oh);
  const px = Math.max(1, t.size * L);
  const ctx = measureCtx();
  ctx.font = fontOf(t, 100);
  const k = px / 100;
  const track = (t.tracking || 0) / 1000; // em
  const lh = px * (t.leading || 1.2);
  const lines = String(t.text ?? '').split('\n').map((s) => {
    const w = (ctx.measureText(s).width + track * 100 * Math.max(0, [...s].length - 1)) * k;
    return { s, w };
  });
  const W = Math.max(1, ...lines.map((l) => l.w));
  const ax = t.x * ow, ay = t.y * oh;
  const left = t.align === 'center' ? ax - W / 2 : t.align === 'right' ? ax - W : ax;
  lines.forEach((l) => { l.x = t.align === 'center' ? ax - l.w / 2 : t.align === 'right' ? ax - l.w : ax; });
  return { lines, lh, px, box: [left, ay, left + W, ay + lh * lines.length] };
}

/** The canvas that holds a text or shape layer at `scale` output px per oriented px. */
export function rasterize(l, ow, oh, scale, maxSide) {
  const L = Math.max(ow, oh);
  let box, draw;
  if (l.kind === 'text') {
    const t = l.text;
    const lay = textLayout(t, ow, oh);
    const pad = lay.px * 0.35;
    box = [lay.box[0] - pad, lay.box[1] - pad, lay.box[2] + pad, lay.box[3] + pad];
    draw = (ctx) => {
      ctx.font = fontOf(t, lay.px);
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgbCss(t.color);
      if (t.tracking) ctx.letterSpacing = `${(t.tracking / 1000) * lay.px}px`;
      lay.lines.forEach((ln, i) => {
        const y = lay.box[1] + i * lay.lh + (lay.lh - lay.px) / 2;
        ctx.fillText(ln.s, ln.x, y);
        if (t.underline) ctx.fillRect(ln.x, y + lay.px * 1.02, ln.w, Math.max(1, lay.px * 0.06));
      });
    };
  } else {
    const sh = l.shape;
    const sw = sh.stroke ? sh.stroke.width * L : 0;
    box = [Math.min(sh.x0, sh.x1) * ow - sw - 2, Math.min(sh.y0, sh.y1) * oh - sw - 2, Math.max(sh.x0, sh.x1) * ow + sw + 2, Math.max(sh.y0, sh.y1) * oh + sw + 2];
    draw = (ctx) => {
      shapePath(ctx, sh, ow, oh);
      if (sh.fill && sh.kind !== 'line') { ctx.fillStyle = rgbCss(sh.fill); ctx.fill(); }
      if (sh.stroke || sh.kind === 'line') {
        ctx.strokeStyle = rgbCss(sh.stroke?.color || sh.fill || [1, 1, 1]);
        ctx.lineWidth = Math.max(0.5, sh.stroke ? sw : (sh.weight || 0.004) * L);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    };
  }
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const k = Math.min(scale, maxSide / Math.max(bw, bh, 1));
  const w = Math.max(1, Math.ceil(bw * k)), h = Math.max(1, Math.ceil(bh * k));
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, -box[0] * k, -box[1] * k);
  draw(ctx);
  return { canvas: c, rect: [box[0], box[1], w / k, h / k] };
}

export const SHAPES = [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['polygon', 'Polygon'], ['line', 'Line']];

export function shapePath(ctx, sh, ow, oh) {
  const x0 = Math.min(sh.x0, sh.x1) * ow, y0 = Math.min(sh.y0, sh.y1) * oh, x1 = Math.max(sh.x0, sh.x1) * ow, y1 = Math.max(sh.y0, sh.y1) * oh;
  ctx.beginPath();
  if (sh.kind === 'rect') {
    const r = Math.min((sh.radius || 0) * Math.max(ow, oh), (x1 - x0) / 2, (y1 - y0) / 2);
    if (r > 0 && ctx.roundRect) ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r);
    else ctx.rect(x0, y0, x1 - x0, y1 - y0);
  } else if (sh.kind === 'ellipse') ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2);
  else if (sh.kind === 'line') { ctx.moveTo(sh.x0 * ow, sh.y0 * oh); ctx.lineTo(sh.x1 * ow, sh.y1 * oh); return; }
  else {
    const n = sh.kind === 'triangle' ? 3 : Math.max(3, sh.sides || 5);
    const star = sh.kind === 'polygon' && sh.star;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    const m = star ? n * 2 : n;
    for (let i = 0; i < m; i++) {
      const a = -Math.PI / 2 + (i / m) * Math.PI * 2;
      const f = star && i % 2 ? 0.5 : 1;
      const x = cx + Math.cos(a) * rx * f, y = cy + Math.sin(a) * ry * f;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }
  ctx.closePath();
}

export const rgbCss = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
