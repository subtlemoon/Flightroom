// Masks: local adjustments painted or dragged onto parts of the photo, as in
// Lightroom's Masking panel. A mask is made of parts (brush strokes, linear
// and radial gradients, AI selections) added to or subtracted from each other,
// optionally narrowed to a luminance range; its sliders are added to the
// global ones wherever it covers the photo.
//
// Positions are fractions of the photo as you see it (rotated upright, after
// Transform, before cropping): x of its width, y of its height. AI selections
// are worked out on the photo without Transform, so they stay put if
// Transform changes afterwards (as in Lightroom until the mask is updated).
import { deflateSync, inflateSync } from 'fflate';

export const MAX_MASKS = 8;
export const MASK_EDGE = 1280; // long edge of the mask images the renderer uses

const L = (key, label, crs, min, max, step = 1, extra = {}) => ({ key, label, crs, min, max, step, def: 0, ...extra });
// Lightroom's mask sliders, in its sections. `crs` values are the slider / 100
// (exposure: stops), like Lightroom's own local corrections; sliders without
// one have no Lightroom equivalent in the sidecar.
export const LOCAL_SECTIONS = [
  { id: 'tone', title: 'Tone', sliders: [
    L('exposure', 'Exposure', 'LocalExposure2012', -4, 4, 0.01, { decimals: 2 }),
    L('contrast', 'Contrast', 'LocalContrast2012', -100, 100),
    L('highlights', 'Highlights', 'LocalHighlights2012', -100, 100),
    L('shadows', 'Shadows', 'LocalShadows2012', -100, 100),
    L('whites', 'Whites', 'LocalWhites2012', -100, 100),
    L('blacks', 'Blacks', 'LocalBlacks2012', -100, 100),
  ] },
  { id: 'color', title: 'Color', sliders: [
    L('temp', 'Temp', 'LocalTemperature', -100, 100, 1, { gradient: 'temp' }),
    L('tint', 'Tint', 'LocalTint', -100, 100, 1, { gradient: 'tint' }),
    L('hue', 'Hue', 'LocalHue', -100, 100, 1, { gradient: 'hue' }),
    L('saturation', 'Saturation', 'LocalSaturation', -100, 100),
  ] },
  { id: 'point', title: 'Point Color', sliders: [] },
  { id: 'curve', title: 'Curve', sliders: [] },
  { id: 'effects', title: 'Effects', sliders: [
    L('texture', 'Texture', 'LocalTexture', -100, 100),
    L('clarity', 'Clarity', 'LocalClarity2012', -100, 100),
    L('dehaze', 'Dehaze', 'LocalDehaze', -100, 100),
  ], grain: [
    L('grain', 'Amount', null, 0, 100),
    L('grainSize', 'Size', null, 0, 100, 1, { def: 25 }),
    L('grainRough', 'Roughness', null, 0, 100, 1, { def: 50 }),
  ] },
  { id: 'detail', title: 'Detail', sliders: [
    L('sharpness', 'Sharpness', 'LocalSharpness', -100, 100),
    L('noise', 'Noise Reduction', 'LocalLuminanceNoise', -100, 100),
    L('moire', 'Moire Reduction', 'LocalMoire', -100, 100),
    L('defringe', 'Defringe', 'LocalDefringe', -100, 100),
  ] },
];
export const LOCAL_SLIDERS = LOCAL_SECTIONS.flatMap((g) => [...g.sliders, ...(g.grain || [])]);
const SECTION_OF = Object.fromEntries(LOCAL_SECTIONS.flatMap((g) => [...g.sliders, ...(g.grain || [])].map((sl) => [sl.key, g.id])));
const LOCAL_DEF = Object.fromEntries(LOCAL_SLIDERS.map((sl) => [sl.key, sl.def]));

/** A mask's slider value, 0 when its section's eye is off. */
export const adjOf = (m, k) => (m.off?.[SECTION_OF[k]] ? LOCAL_DEF[k] : m.adj?.[k] ?? LOCAL_DEF[k]);

// Point Color: a sampled colour (hue 0-360, saturation and brightness 0-1) and
// how to shift colours near it.
export const POINT_DEFAULT = { hue: 0, sat: 0, lum: 0, range: 50, variance: 50 };
// Lightroom's effect presets for masks (Effect menu).
export const MASK_PRESETS = [
  ['Burn (Darken)', { exposure: -0.3 }],
  ['Dodge (Lighten)', { exposure: 0.25 }],
  ['Iris Enhance', { exposure: 0.35, clarity: 40, saturation: 40 }],
  ['Soften Skin', { clarity: -100, sharpness: 25 }],
  ['Soften Skin (Lite)', { clarity: -50, sharpness: 25 }],
  ['Teeth Whitening', { exposure: 0.4, saturation: -60 }],
  ['Clarity', { clarity: 50 }],
  ['Sharpness', { sharpness: 50 }],
  ['Saturation', { saturation: 50 }],
];
export const presetName = (m) => MASK_PRESETS.find(([, a]) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(m.adj || {}).filter((k) => (m.adj[k] ?? LOCAL_DEF[k]) !== LOCAL_DEF[k])]);
  return [...keys].every((k) => (a[k] ?? LOCAL_DEF[k]) === (m.adj?.[k] ?? LOCAL_DEF[k]));
})?.[0] || 'Custom';

export const PART_TYPES = [['brush', 'Brush', 'K'], ['linear', 'Linear gradient', 'M'], ['radial', 'Radial gradient', 'Shift+M'], ['luminance', 'Luminance range', '']];
export const PART_LABEL = { ...Object.fromEntries(PART_TYPES.map(([k, l]) => [k, l])), ai: 'AI' };
// What on-device AI can select. `task` is what the desktop side works out; a
// task can give several masks (people, landscape), picked from a list.
export const AI_TYPES = [
  ['subject', 'Subject', 'subject'],
  ['sky', 'Sky', 'landscape'],
  ['background', 'Background', 'subject'],
  ['people', 'People', 'people'],
  ['landscape', 'Landscape', 'landscape'],
];
export const AI_LABEL = {
  subject: 'Subject', background: 'Background', sky: 'Sky', water: 'Water', vegetation: 'Vegetation', mountains: 'Mountains',
  architecture: 'Architecture', 'natural-ground': 'Natural ground', 'artificial-ground': 'Artificial ground',
  face: 'Face skin', skin: 'Body skin', hair: 'Hair', clothes: 'Clothes',
};
/** "person-2:face" -> "Person 2 · Face skin". */
export const aiName = (kind) => kind.split(':').map((k) => AI_LABEL[k] || k.replace(/^person-(\d+)$/, 'Person $1')).join(' · ');

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newPart(type, mode = 'add') {
  const base = { id: newId(), type, mode };
  if (type === 'linear') return { ...base, x0: 0.5, y0: 0.3, x1: 0.5, y1: 0.7, placed: false };
  if (type === 'radial') return { ...base, cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.2, angle: 0, feather: 50, invert: false, placed: false };
  if (type === 'brush') return { ...base, strokes: [] };
  return { ...base, mode: 'intersect', lo: 0, hi: 50, smooth: 20 };
}

// An AI selection, kept as the image the model made (deflated, base64) at
// MASK_EDGE size of the upright, uncropped photo.
export function newAiPart(kind, { w, h, data }, mode = 'add') {
  return { id: newId(), type: 'ai', mode, kind, w, h, data: toB64(deflateSync(data, { level: 6 })) };
}

export function newMask(part, masks, adj = {}) {
  const n = 1 + Math.max(0, ...masks.map((m) => Number(/^Mask (\d+)$/.exec(m.name)?.[1]) || 0));
  const p = typeof part === 'string' ? newPart(part) : part;
  return { id: newId(), name: `Mask ${n}`, amount: 100, invert: false, hidden: false, adj, parts: [p] };
}

const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
// Unpacked AI images, by their packed text (the same selection is often in several masks).
const aiCache = new Map();
function aiLayer(p) {
  let c = aiCache.get(p.data);
  if (!c) {
    const px = inflateSync(fromB64(p.data));
    c = canvas(p.w, p.h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(p.w, p.h);
    for (let i = 0; i < px.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = px[i]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    aiCache.set(p.data, c);
    if (aiCache.size > 16) aiCache.delete(aiCache.keys().next().value);
  }
  return c;
}

// --- rasterising ---------------------------------------------------------------

const canvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

function drawLinear(ctx, p, W, H) {
  const g = ctx.createLinearGradient(p.x0 * W, p.y0 * H, p.x1 * W, p.y1 * H);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawRadial(ctx, p, W, H) {
  ctx.save();
  ctx.translate(p.cx * W, p.cy * H);
  ctx.rotate((p.angle * Math.PI) / 180);
  ctx.scale(Math.max(1e-3, p.rx * W), Math.max(1e-3, p.ry * H));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const inner = Math.min(0.999, 1 - p.feather / 100);
  const [a, b] = p.invert ? ['#000', '#fff'] : ['#fff', '#000'];
  g.addColorStop(0, a);
  g.addColorStop(inner, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  ctx.restore();
}

// Brush dabs along a stroke, spaced by a quarter of the brush size.
function drawStroke(ctx, st, W, H, from = 0) {
  const r = Math.max(0.5, st.size * Math.max(W, H));
  const hard = Math.min(0.99, 1 - st.feather / 100);
  const a = st.flow / 100;
  const color = st.erase ? '0,0,0' : '255,255,255';
  const dab = (x, y) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(hard, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  const pts = st.pts;
  const step = Math.max(1, r * 0.25);
  for (let i = Math.max(from, 0); i < pts.length; i++) {
    const [x, y] = [pts[i][0] * W, pts[i][1] * H];
    if (i === 0) { dab(x, y); continue; }
    const [px, py] = [pts[i - 1][0] * W, pts[i - 1][1] * H];
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / step));
    for (let k = 1; k <= n; k++) dab(px + ((x - px) * k) / n, py + ((y - py) * k) / n);
  }
}

// Brush layers are kept per part, so a stroke being painted only adds its new dabs.
const brushCache = new Map(); // part id -> { W, H, c, strokes, done }
function brushLayer(p, W, H) {
  let b = brushCache.get(p.id);
  const fresh = !b || b.W !== W || b.H !== H || b.strokes.length > p.strokes.length
    || b.strokes.some((st, i) => i < b.strokes.length - 1 && st !== p.strokes[i])
    || (b.strokes.length && p.strokes[b.strokes.length - 1].pts.length < b.done);
  if (fresh) {
    b = { W, H, c: canvas(W, H), strokes: [], done: 0 };
    const ctx = b.c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }
  // Most recently used last; a handful are kept (each is a full mask image).
  brushCache.delete(p.id);
  brushCache.set(p.id, b);
  if (brushCache.size > 12) brushCache.delete(brushCache.keys().next().value);
  const ctx = b.c.getContext('2d');
  const last = b.strokes.length - 1;
  for (let i = Math.max(0, last); i < p.strokes.length; i++) drawStroke(ctx, p.strokes[i], W, H, i === last ? b.done : 0);
  b.strokes = p.strokes.slice();
  b.done = p.strokes.length ? p.strokes[p.strokes.length - 1].pts.length : 0;
  return b.c;
}

const rasterCache = new WeakMap(); // parts array -> { W, H, data }

/** A mask's shape as a W x H greyscale image (luminance ranges and invert are applied when drawing). */
export function maskRaster(mask, ow, oh) {
  const s = MASK_EDGE / Math.max(ow, oh);
  const W = Math.max(8, Math.round(ow * s)), H = Math.max(8, Math.round(oh * s));
  const hit = rasterCache.get(mask.parts);
  if (hit && hit.W === W && hit.H === H) return hit;
  const main = canvas(W, H);
  const ctx = main.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const layer = canvas(W, H);
  const lctx = layer.getContext('2d');
  let any = false;
  for (const p of mask.parts) {
    if (p.type === 'luminance' || p.placed === false) continue;
    let src = layer;
    if (p.type === 'brush') src = brushLayer(p, W, H);
    else if (p.type === 'ai') {
      lctx.globalCompositeOperation = 'copy';
      lctx.drawImage(aiLayer(p), 0, 0, W, H);
    } else {
      lctx.globalCompositeOperation = 'source-over';
      lctx.fillStyle = '#000';
      lctx.fillRect(0, 0, W, H);
      if (p.type === 'linear') drawLinear(lctx, p, W, H);
      else drawRadial(lctx, p, W, H);
    }
    if (p.mode === 'subtract') { ctx.globalCompositeOperation = 'multiply'; ctx.filter = 'invert(1)'; }
    else if (p.mode === 'intersect' && any) { ctx.globalCompositeOperation = 'multiply'; ctx.filter = 'none'; }
    else { ctx.globalCompositeOperation = 'lighten'; ctx.filter = 'none'; }
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    any = true;
  }
  // Only a luminance range: the whole photo, narrowed by the range.
  if (!any && mask.parts.some((p) => p.type === 'luminance')) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  const px = ctx.getImageData(0, 0, W, H).data;
  const data = new Uint8Array(W * H);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4];
  const out = { W, H, data };
  rasterCache.set(mask.parts, out);
  return out;
}

export const lumRange = (mask) => mask.parts.find((p) => p.type === 'luminance');

// --- the sidecar -----------------------------------------------------------------

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** Masks as compact JSON for Flightroom's own fr:Masks value. */
export function masksToJson(masks) {
  if (!masks?.length) return '';
  return JSON.stringify(masks.map((m) => ({ ...m, parts: m.parts.map((p) => (p.type === 'brush'
    ? { ...p, strokes: p.strokes.map((st) => ({ ...st, pts: st.pts.map(([x, y]) => [r4(x), r4(y)]) })) }
    : p)) })));
}

export function masksFromJson(text) {
  if (!text) return [];
  try {
    const m = JSON.parse(text);
    return Array.isArray(m) ? m.filter((x) => x && Array.isArray(x.parts)).slice(0, MAX_MASKS) : [];
  } catch { return []; }
}

const f6 = (v) => Number(v).toFixed(6);
const attrs = (o) => Object.entries(o).map(([k, v]) => ` crs:${k}="${v}"`).join('');

// Lightroom's own (version 6 to 10) mask records, which current Lightroom
// still reads: one correction per mask, filed under its first shape's kind.
export function masksToCrs(masks) {
  const groups = { GradientBasedCorrections: [], CircularGradientBasedCorrections: [], PaintBasedCorrections: [] };
  for (const m of masks || []) {
    const shapes = m.parts.filter((p) => p.type !== 'luminance' && p.type !== 'ai' && p.placed !== false);
    if (!shapes.length) continue;
    const local = {};
    for (const sl of LOCAL_SLIDERS) {
      if (!sl.crs) continue;
      const v = adjOf(m, sl.key);
      local[sl.crs] = f6(sl.key === 'exposure' ? v : v / 100);
    }
    if (m.tint && !m.off?.color) Object.assign(local, { LocalToningHue: f6(m.tint.hue), LocalToningSaturation: f6(m.tint.sat / 100) });
    const entries = [];
    for (const p of shapes) {
      const value = p.mode === 'subtract' ? 0 : 1;
      if (p.type === 'linear') entries.push(`<rdf:li${attrs({ What: 'Mask/Gradient', MaskValue: f6(value), ZeroX: f6(p.x1), ZeroY: f6(p.y1), FullX: f6(p.x0), FullY: f6(p.y0) })}/>`);
      else if (p.type === 'radial') {
        entries.push(`<rdf:li${attrs({ What: 'Mask/CircularGradient', MaskValue: f6(value), Top: f6(p.cy - p.ry), Left: f6(p.cx - p.rx), Bottom: f6(p.cy + p.ry), Right: f6(p.cx + p.rx), Angle: f6(p.angle), Midpoint: '50', Roundness: '0', Feather: String(Math.round(p.feather)), Flipped: m.invert !== p.invert ? 'true' : 'false' })}/>`);
      } else {
        for (const st of p.strokes) {
          const dabs = st.pts.map(([x, y]) => `<rdf:li>d ${f6(x)} ${f6(y)}</rdf:li>`).join('');
          entries.push(`<rdf:li${attrs({ What: 'Mask/Paint', MaskValue: f6(st.erase || p.mode === 'subtract' ? 0 : 1), Radius: f6(st.size), Flow: f6(st.flow / 100), CenterWeight: f6(1 - st.feather / 100) })}><crs:Dabs><rdf:Seq>${dabs}</rdf:Seq></crs:Dabs></rdf:li>`);
        }
      }
    }
    const kind = shapes[0].type === 'linear' ? 'GradientBasedCorrections' : shapes[0].type === 'radial' ? 'CircularGradientBasedCorrections' : 'PaintBasedCorrections';
    groups[kind].push(`<rdf:li><rdf:Description${attrs({ What: 'Correction', CorrectionAmount: f6((m.amount ?? 100) / 100), CorrectionActive: m.hidden ? 'false' : 'true', CorrectionName: m.name.replace(/[<>&"]/g, '') })}${attrs(local)}><crs:CorrectionMasks><rdf:Seq>${entries.join('')}</rdf:Seq></crs:CorrectionMasks></rdf:Description></rdf:li>`);
  }
  return Object.fromEntries(Object.entries(groups).map(([k, list]) => [k, list.length ? `<rdf:Seq>${list.join('')}</rdf:Seq>` : '']));
}
