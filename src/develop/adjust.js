// Photoshop's adjustments (Image > Adjustments, the Adjustments panel), as
// adjustment layers over the developed photo: what they do to the colours
// under them is worked out on the graphics card (compose.js, ADJ shader),
// so they stay live like everything else in Retouch.
//
// Each has its settings, a uniform block for the shader (type + up to 12
// vec4s) and, for Levels and Curves, a 256-entry lookup per channel.

const S = (key, label, min, max, def = 0, step = 1) => ({ key, label, min, max, def, step });

// [type, label, icon, settings (sliders; other settings are drawn by hand)]
export const ADJUSTMENTS = [
  ['brightness', 'Brightness/Contrast', 'luminance', [S('brightness', 'Brightness', -150, 150), S('contrast', 'Contrast', -50, 100)]],
  ['levels', 'Levels', 'histogram', []],
  ['curves', 'Curves', 'curve', []],
  ['exposure', 'Exposure', 'exposure', [S('exposure', 'Exposure', -20, 20, 0, 0.01), S('offset', 'Offset', -0.5, 0.5, 0, 0.0001), S('gamma', 'Gamma Correction', 0.01, 9.99, 1, 0.01)]],
  ['vibrance', 'Vibrance', 'vibrance', [S('vibrance', 'Vibrance', -100, 100), S('saturation', 'Saturation', -100, 100)]],
  ['hsl', 'Hue/Saturation', 'hue', [S('hue', 'Hue', -180, 180), S('sat', 'Saturation', -100, 100), S('light', 'Lightness', -100, 100)]],
  ['balance', 'Color Balance', 'balance', [S('cr', 'Cyan / Red', -100, 100), S('mg', 'Magenta / Green', -100, 100), S('yb', 'Yellow / Blue', -100, 100)]],
  ['bw', 'Black & White', 'bw', [S('reds', 'Reds', -200, 300, 40), S('yellows', 'Yellows', -200, 300, 60), S('greens', 'Greens', -200, 300, 40),
    S('cyans', 'Cyans', -200, 300, 60), S('blues', 'Blues', -200, 300, 20), S('magentas', 'Magentas', -200, 300, 80)]],
  ['photo', 'Photo Filter', 'photoFilter', [S('density', 'Density', 1, 100, 25)]],
  ['mixer', 'Channel Mixer', 'mixer', [S('r', 'Red', -200, 200), S('g', 'Green', -200, 200), S('b', 'Blue', -200, 200), S('k', 'Constant', -200, 200)]],
  ['selective', 'Selective Color', 'selective', [S('c', 'Cyan', -100, 100), S('m', 'Magenta', -100, 100), S('y', 'Yellow', -100, 100), S('k', 'Black', -100, 100)]],
  ['invert', 'Invert', 'invert', []],
  ['posterize', 'Posterize', 'posterize', [S('levels', 'Levels', 2, 255, 4)]],
  ['threshold', 'Threshold', 'threshold', [S('level', 'Threshold Level', 1, 255, 128)]],
  ['gradmap', 'Gradient Map', 'gradient', []],
];
export const ADJ_INDEX = Object.fromEntries(ADJUSTMENTS.map(([k], i) => [k, i]));
export const ADJ_LABEL = Object.fromEntries(ADJUSTMENTS.map(([k, l]) => [k, l]));

export const PHOTO_FILTERS = [
  ['Warming Filter (85)', [0.925, 0.541, 0]], ['Warming Filter (LBA)', [0.98, 0.6, 0.02]], ['Warming Filter (81)', [0.92, 0.69, 0.11]],
  ['Cooling Filter (80)', [0, 0.427, 1]], ['Cooling Filter (LBB)', [0, 0.36, 1]], ['Cooling Filter (82)', [0, 0.71, 1]],
  ['Red', [0.918, 0.102, 0.102]], ['Orange', [0.953, 0.518, 0.09]], ['Yellow', [0.976, 0.89, 0.11]], ['Green', [0.098, 0.788, 0.098]],
  ['Cyan', [0.114, 0.796, 0.918]], ['Blue', [0.114, 0.208, 0.918]], ['Violet', [0.608, 0.114, 0.918]], ['Magenta', [0.89, 0.094, 0.89]],
  ['Sepia', [0.675, 0.478, 0.2]], ['Deep Red', [1, 0.082, 0.082]], ['Deep Blue', [0.004, 0.196, 0.643]], ['Deep Emerald', [0, 0.369, 0]],
  ['Deep Yellow', [1, 0.835, 0]], ['Underwater', [0, 0.761, 0.694]],
];
export const SELECTIVE_COLORS = [['reds', 'Reds'], ['yellows', 'Yellows'], ['greens', 'Greens'], ['cyans', 'Cyans'], ['blues', 'Blues'], ['magentas', 'Magentas'], ['whites', 'Whites'], ['neutrals', 'Neutrals'], ['blacks', 'Blacks']];
export const CURVE_CHANNELS = [['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']];
const LEVEL = { in0: 0, in1: 255, gamma: 1, out0: 0, out1: 255 };

/** A new adjustment's settings (Photoshop's defaults). */
export function newAdjustment(type) {
  const base = { type };
  for (const sl of ADJUSTMENTS.find(([k]) => k === type)?.[3] || []) base[sl.key] = sl.def;
  if (type === 'levels') return { ...base, ch: 'rgb', rgb: { ...LEVEL }, r: { ...LEVEL }, g: { ...LEVEL }, b: { ...LEVEL } };
  if (type === 'curves') return { ...base, ch: 'rgb', rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] };
  if (type === 'hsl') return { ...base, colorize: false };
  if (type === 'balance') return { tone: 'mid', shadows: [0, 0, 0], mid: [0, 0, 0], highlights: [0, 0, 0], preserve: true, type };
  if (type === 'bw') return { ...base, tint: false, tintColor: [0.88, 0.78, 0.6] };
  if (type === 'photo') return { ...base, color: PHOTO_FILTERS[0][1], preserve: true };
  if (type === 'mixer') return { type, out: 'r', mono: false, rows: { r: [100, 0, 0, 0], g: [0, 100, 0, 0], b: [0, 0, 100, 0] } };
  if (type === 'selective') return { type, color: 'reds', absolute: false, cmyk: Object.fromEntries(SELECTIVE_COLORS.map(([k]) => [k, [0, 0, 0, 0]])) };
  if (type === 'gradmap') return { type, c0: [0, 0, 0], c1: [1, 1, 1], reverse: false };
  return base;
}

// --- lookups ------------------------------------------------------------------------

/** Natural cubic spline through points (0-255 both ways), as Photoshop's Curves. */
export function curveTable(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(256);
  const n = p.length;
  if (n < 2) { for (let i = 0; i < 256; i++) out[i] = i / 255; return out; }
  const x = p.map((q) => q[0]), y = p.map((q) => q[1]);
  const m = new Float64Array(n); // second derivatives
  if (n > 2) {
    const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      a[i] = x[i] - x[i - 1]; b[i] = 2 * (x[i + 1] - x[i - 1]); c[i] = x[i + 1] - x[i];
      d[i] = 6 * ((y[i + 1] - y[i]) / (x[i + 1] - x[i] || 1) - (y[i] - y[i - 1]) / (x[i] - x[i - 1] || 1));
    }
    for (let i = 2; i < n - 1; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
    for (let i = n - 2; i >= 1; i--) m[i] = (d[i] - c[i] * m[i + 1]) / b[i];
  }
  for (let v = 0; v < 256; v++) {
    let r;
    if (v <= x[0]) r = y[0];
    else if (v >= x[n - 1]) r = y[n - 1];
    else {
      let i = 0;
      while (x[i + 1] < v) i++;
      const h = x[i + 1] - x[i] || 1, t = (v - x[i]) / h;
      r = (1 - t) * y[i] + t * y[i + 1] + ((((1 - t) ** 3 - (1 - t)) * m[i] + (t ** 3 - t) * m[i + 1]) * h * h) / 6;
    }
    out[v] = Math.min(255, Math.max(0, r)) / 255;
  }
  return out;
}

function levelsTable(l) {
  const out = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - l.in0) / Math.max(1, l.in1 - l.in0)));
    out[v] = (l.out0 + (l.out1 - l.out0) * t ** (1 / Math.max(0.01, l.gamma))) / 255;
  }
  return out;
}

/** 256 x 1 RGBA lookup (r, g, b per channel after the master), or null when the type has none. */
export function adjustmentLut(adj) {
  if (adj.type !== 'levels' && adj.type !== 'curves') return null;
  const t = adj.type === 'levels' ? levelsTable : curveTable;
  const m = t(adj.rgb), ch = [t(adj.r), t(adj.g), t(adj.b)];
  const out = new Uint8Array(256 * 4);
  const at = (tab, v) => { const f = v * 255, i = Math.min(254, Math.floor(f)); return tab[i] + (tab[i + 1] - tab[i]) * (f - i); };
  for (let v = 0; v < 256; v++) {
    for (let c = 0; c < 3; c++) out[v * 4 + c] = Math.round(at(ch[c], m[v]) * 255);
    out[v * 4 + 3] = 255;
  }
  return out;
}

/** The shader's view of an adjustment: { type, p: Float32Array(48) }. */
export function adjustmentUniforms(adj) {
  const p = new Float32Array(48);
  const set = (i, ...v) => v.forEach((x, k) => { p[i * 4 + k] = x; });
  switch (adj.type) {
    case 'brightness': set(0, adj.brightness / 100, adj.contrast / 100); break;
    case 'exposure': set(0, adj.exposure, adj.offset, adj.gamma); break;
    case 'vibrance': set(0, adj.vibrance / 100, adj.saturation / 100); break;
    case 'hsl': set(0, adj.hue / 360, adj.sat / 100, adj.light / 100, adj.colorize ? 1 : 0); break;
    case 'balance': set(0, ...adj.shadows.map((v) => v / 100), adj.preserve ? 1 : 0); set(1, ...adj.mid.map((v) => v / 100)); set(2, ...adj.highlights.map((v) => v / 100)); break;
    case 'bw':
      set(0, adj.reds / 100, adj.yellows / 100, adj.greens / 100, adj.cyans / 100);
      set(1, adj.blues / 100, adj.magentas / 100, adj.tint ? 1 : 0);
      set(2, ...adj.tintColor);
      break;
    case 'photo': set(0, ...adj.color, adj.density / 100); set(1, adj.preserve ? 1 : 0); break;
    case 'mixer':
      set(0, ...adj.rows.r.map((v) => v / 100)); set(1, ...adj.rows.g.map((v) => v / 100)); set(2, ...adj.rows.b.map((v) => v / 100));
      set(3, adj.mono ? 1 : 0);
      break;
    case 'selective':
      SELECTIVE_COLORS.forEach(([k], i) => set(i, ...adj.cmyk[k].map((v) => v / 100)));
      set(9, adj.absolute ? 1 : 0);
      break;
    case 'posterize': set(0, adj.levels); break;
    case 'threshold': set(0, adj.level / 255); break;
    case 'gradmap': set(0, ...(adj.reverse ? adj.c1 : adj.c0)); set(1, ...(adj.reverse ? adj.c0 : adj.c1)); break;
    default:
  }
  return { type: ADJ_INDEX[adj.type] ?? -1, p };
}

// GLSL: the adjustment applied to colour c (display values, 0-1).
export const ADJ_GLSL = `
uniform float uAdj;
uniform vec4 uP[12];
uniform sampler2D uLut;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), l = (mx + mn) * 0.5, d = mx - mn;
  if (d < 1e-5) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h = mx == c.r ? (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}
float hue2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 h) {
  if (h.y < 1e-5) return vec3(h.z);
  float q = h.z < 0.5 ? h.z * (1.0 + h.y) : h.z + h.y - h.z * h.y, p = 2.0 * h.z - q;
  return vec3(hue2rgb(p, q, h.x + 1.0 / 3.0), hue2rgb(p, q, h.x), hue2rgb(p, q, h.x - 1.0 / 3.0));
}
vec3 keepLum(vec3 c, float l) { return clamp(c + (l - lum(c)), 0.0, 1.0); }
vec3 adjust(vec3 c) {
  int A = int(uAdj + 0.5);
  if (A == 0) { // Brightness/Contrast
    float b = uP[0].x, k = uP[0].y;
    c = b >= 0.0 ? c + (1.0 - c) * b * 0.55 * (1.0 - c) + b * 0.2 * c * (1.0 - c) : c * (1.0 + b * 0.6);
    float f = k >= 0.0 ? 1.0 + k * 1.2 : 1.0 + k;
    return clamp((c - 0.5) * f + 0.5, 0.0, 1.0);
  }
  if (A == 1 || A == 2) { // Levels, Curves
    return vec3(texture(uLut, vec2(c.r * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).r, texture(uLut, vec2(c.g * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).g,
      texture(uLut, vec2(c.b * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).b);
  }
  if (A == 3) { // Exposure, in linear light
    vec3 l = pow(c, vec3(2.2)) * exp2(uP[0].x) + uP[0].y;
    return clamp(pow(max(l, 0.0), vec3(1.0 / (2.2 * uP[0].z))), 0.0, 1.0);
  }
  if (A == 4) { // Vibrance
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = mx - mn, l = lum(c);
    float v = uP[0].x * (1.0 - sat) * (uP[0].x > 0.0 ? 1.0 - smoothstep(0.05, 0.6, abs(c.r - c.g) * step(c.b, c.g) * step(c.g, c.r)) * 0.5 : 1.0);
    c = mix(vec3(l), c, 1.0 + v);
    c = mix(vec3(lum(c)), c, 1.0 + uP[0].y);
    return clamp(c, 0.0, 1.0);
  }
  if (A == 5) { // Hue/Saturation
    vec3 h = rgb2hsl(c);
    if (uP[0].w > 0.5) { h.x = fract(uP[0].x); h.y = clamp(0.25 + uP[0].y * 0.75 + 0.25, 0.0, 1.0); }
    else { h.x = fract(h.x + uP[0].x); h.y = clamp(h.y * (1.0 + uP[0].y), 0.0, 1.0); }
    c = hsl2rgb(h);
    float L = uP[0].z;
    return L >= 0.0 ? mix(c, vec3(1.0), L) : c * (1.0 + L);
  }
  if (A == 6) { // Color Balance
    float l = lum(c);
    float ws = clamp(1.0 - l * 3.0, 0.0, 1.0), wh = clamp(l * 3.0 - 2.0, 0.0, 1.0), wm = 1.0 - ws - wh;
    vec3 d = uP[0].xyz * ws + uP[1].xyz * wm + uP[2].xyz * wh;
    vec3 o = clamp(c + d * 0.3, 0.0, 1.0);
    return uP[0].w > 0.5 ? keepLum(o, l) : o;
  }
  if (A == 7) { // Black & White
    vec3 h = rgb2hsl(c);
    float hue = h.x * 6.0;
    float w0[6] = float[6](uP[0].x, uP[0].y, uP[0].z, uP[0].w, uP[1].x, uP[1].y);
    int i = int(floor(hue)) % 6;
    float t = fract(hue);
    float w = mix(w0[i], w0[(i + 1) % 6], t);
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float g = clamp(mn + (mx - mn) * w, 0.0, 1.0);
    return uP[1].z > 0.5 ? clamp(g * mix(vec3(1.0), uP[2].xyz * 2.0, 1.0 - abs(2.0 * g - 1.0)), 0.0, 1.0) : vec3(g);
  }
  if (A == 8) { // Photo Filter
    float l = lum(c);
    vec3 o = mix(c, c * uP[0].xyz * 1.6, uP[0].w);
    return uP[1].x > 0.5 ? keepLum(o, l) : clamp(o, 0.0, 1.0);
  }
  if (A == 9) { // Channel Mixer
    vec3 o = vec3(dot(c, uP[0].xyz) + uP[0].w, dot(c, uP[1].xyz) + uP[1].w, dot(c, uP[2].xyz) + uP[2].w);
    return clamp(uP[3].x > 0.5 ? vec3(o.r) : o, 0.0, 1.0);
  }
  if (A == 10) { // Selective Color: CMYK nudges by which colour each pixel is
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), md = c.r + c.g + c.b - mx - mn;
    vec3 o = c;
    for (int k = 0; k < 9; k++) {
      float w;
      if (k == 0) w = c.r == mx ? mx - md : 0.0;
      else if (k == 1) w = c.b == mn ? md - mn : 0.0;
      else if (k == 2) w = c.g == mx ? mx - md : 0.0;
      else if (k == 3) w = c.r == mn ? md - mn : 0.0;
      else if (k == 4) w = c.b == mx ? mx - md : 0.0;
      else if (k == 5) w = c.g == mn ? md - mn : 0.0;
      else if (k == 6) w = clamp((mn - 0.5) * 2.0, 0.0, 1.0);
      else if (k == 7) w = 1.0 - (abs(mx - 0.5) + abs(mn - 0.5));
      else w = clamp((0.5 - mx) * 2.0, 0.0, 1.0);
      vec4 a = uP[k];
      if (w <= 0.0 || dot(abs(a), vec4(1.0)) == 0.0) continue;
      vec3 cmy = 1.0 - o;
      vec3 v = a.xyz + a.w;
      vec3 amt = uP[9].x > 0.5 ? v : v * mix(cmy, 1.0 - cmy, step(0.0, v));
      o = clamp(1.0 - (cmy + amt * w), 0.0, 1.0);
    }
    return o;
  }
  if (A == 11) return 1.0 - c; // Invert
  if (A == 12) { float n = max(2.0, uP[0].x); return floor(c * n * 0.9999) / (n - 1.0); } // Posterize
  if (A == 13) return vec3(step(uP[0].x, lum(c))); // Threshold
  if (A == 14) return mix(uP[0].xyz, uP[1].xyz, lum(c)); // Gradient Map
  return c;
}`;
