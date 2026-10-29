// Photoshop's Filter menu, as live filters on a layer (like Smart Filters):
// a layer keeps a list of { id, type, on, ...settings, clip?, center?, rad? }
// and compose.js runs them on the layer's pixels every time it's drawn.
// Sizes are photo pixels, so a filter looks the same zoomed in, zoomed out and
// in a full-size export.

const P = (key, label, min, max, def, step = 1, unit = '') => ({ key, label, min, max, def, step, unit });
const C = (key, label, options, def) => ({ key, label, options, def });
const B = (key, label, def = false) => ({ key, label, bool: true, def });

// [menu, type, label, settings]; a label ending in "…" opens a dialog first.
export const FILTERS = [
  ['Blur', 'blur', 'Blur', []],
  ['Blur', 'blurMore', 'Blur More', []],
  ['Blur', 'box', 'Box Blur…', [P('radius', 'Radius', 1, 2000, 5, 1, 'px')]],
  ['Blur', 'gaussian', 'Gaussian Blur…', [P('radius', 'Radius', 0.1, 1000, 4, 0.1, 'px')]],
  ['Blur', 'motion', 'Motion Blur…', [P('angle', 'Angle', -90, 90, 0, 1, '°'), P('distance', 'Distance', 1, 2000, 20, 1, 'px')]],
  ['Blur', 'radial', 'Radial Blur…', [P('amount', 'Amount', 1, 100, 10), C('method', 'Blur Method', [['spin', 'Spin'], ['zoom', 'Zoom']], 'spin')]],
  ['Blur', 'surface', 'Surface Blur…', [P('radius', 'Radius', 1, 100, 5, 1, 'px'), P('threshold', 'Threshold', 2, 255, 15, 1, 'levels')]],
  ['Blur Gallery', 'tiltshift', 'Tilt-Shift…', [P('blur', 'Blur', 0, 500, 15, 1, 'px'), P('pos', 'Position', 0, 100, 50, 1, '%'), P('focus', 'Focus Width', 0, 100, 15, 1, '%'),
    P('trans', 'Transition', 1, 100, 20, 1, '%'), P('angle', 'Angle', -90, 90, 0, 1, '°')]],
  ['Blur Gallery', 'iris', 'Iris Blur…', [P('blur', 'Blur', 0, 500, 15, 1, 'px'), P('x', 'Centre X', 0, 100, 50, 1, '%'), P('y', 'Centre Y', 0, 100, 50, 1, '%'),
    P('size', 'Size', 1, 100, 25, 1, '%'), P('trans', 'Transition', 1, 100, 25, 1, '%')]],
  ['Blur Gallery', 'field', 'Field Blur…', [P('blur', 'Blur', 0, 500, 15, 1, 'px')]],
  ['Distort', 'pinch', 'Pinch…', [P('amount', 'Amount', -100, 100, 50, 1, '%')]],
  ['Distort', 'ripple', 'Ripple…', [P('amount', 'Amount', -999, 999, 100, 1, '%'), C('size', 'Size', [['1', 'Small'], ['2', 'Medium'], ['3', 'Large']], '2')]],
  ['Distort', 'spherize', 'Spherize…', [P('amount', 'Amount', -100, 100, 100, 1, '%')]],
  ['Distort', 'twirl', 'Twirl…', [P('angle', 'Angle', -999, 999, 50, 1, '°')]],
  ['Distort', 'wave', 'Wave…', [P('length', 'Wavelength', 1, 999, 120, 1, 'px'), P('amp', 'Amplitude', 1, 999, 10, 1, 'px'), P('angle', 'Angle', -90, 90, 0, 1, '°')]],
  ['Noise', 'noise', 'Add Noise…', [P('amount', 'Amount', 0.1, 400, 12.5, 0.1, '%'), C('dist', 'Distribution', [['uniform', 'Uniform'], ['gaussian', 'Gaussian']], 'gaussian'), B('mono', 'Monochromatic')]],
  ['Noise', 'despeckle', 'Despeckle', []],
  ['Noise', 'dust', 'Dust & Scratches…', [P('radius', 'Radius', 1, 50, 1, 1, 'px'), P('threshold', 'Threshold', 0, 255, 0, 1, 'levels')]],
  ['Noise', 'median', 'Median…', [P('radius', 'Radius', 1, 50, 1, 1, 'px')]],
  ['Noise', 'reduce', 'Reduce Noise…', [P('strength', 'Strength', 0, 10, 6), P('detail', 'Preserve Details', 0, 100, 60, 1, '%')]],
  ['Pixelate', 'halftone', 'Color Halftone…', [P('radius', 'Max. Radius', 4, 127, 8, 1, 'px')]],
  ['Pixelate', 'crystallize', 'Crystallize…', [P('cell', 'Cell Size', 3, 300, 10, 1, 'px')]],
  ['Pixelate', 'mosaic', 'Mosaic…', [P('cell', 'Cell Size', 2, 200, 8, 1, 'px')]],
  ['Render', 'clouds', 'Clouds', [P('scale', 'Scale', 10, 2000, 300, 1, 'px')]],
  ['Render', 'flare', 'Lens Flare…', [P('bright', 'Brightness', 10, 300, 100, 1, '%'), P('x', 'Centre X', 0, 100, 30, 1, '%'), P('y', 'Centre Y', 0, 100, 30, 1, '%')]],
  ['Sharpen', 'sharpen', 'Sharpen', []],
  ['Sharpen', 'sharpenMore', 'Sharpen More', []],
  ['Sharpen', 'smart', 'Smart Sharpen…', [P('amount', 'Amount', 1, 500, 200, 1, '%'), P('radius', 'Radius', 0.1, 64, 1, 0.1, 'px'), P('noise', 'Reduce Noise', 0, 100, 10, 1, '%')]],
  ['Sharpen', 'unsharp', 'Unsharp Mask…', [P('amount', 'Amount', 1, 500, 100, 1, '%'), P('radius', 'Radius', 0.1, 1000, 1, 0.1, 'px'), P('threshold', 'Threshold', 0, 255, 0, 1, 'levels')]],
  ['Stylize', 'diffuse', 'Diffuse', []],
  ['Stylize', 'emboss', 'Emboss…', [P('angle', 'Angle', -180, 180, 135, 1, '°'), P('height', 'Height', 1, 100, 3, 1, 'px'), P('amount', 'Amount', 1, 500, 100, 1, '%')]],
  ['Stylize', 'edges', 'Find Edges', []],
  ['Stylize', 'oil', 'Oil Paint…', [P('radius', 'Stylization', 1, 10, 4, 0.1)]],
  ['Stylize', 'solarize', 'Solarize', []],
  ['Other', 'highpass', 'High Pass…', [P('radius', 'Radius', 0.1, 1000, 10, 0.1, 'px')]],
  ['Other', 'maximum', 'Maximum…', [P('radius', 'Radius', 1, 500, 1, 1, 'px')]],
  ['Other', 'minimum', 'Minimum…', [P('radius', 'Radius', 1, 500, 1, 1, 'px')]],
];
export const FILTER_DEF = Object.fromEntries(FILTERS.map(([menu, type, label, params]) => [type, { menu, type, label, params }]));
export const FILTER_MENUS = [...new Set(FILTERS.map((f) => f[0]))];
export const filterName = (f) => FILTER_DEF[f.type]?.label.replace('…', '') || f.type;

export function newFilter(type, extra = {}) {
  const def = FILTER_DEF[type];
  return { type, on: true, ...Object.fromEntries((def?.params || []).map((p) => [p.key, p.def])), ...extra };
}

/** How far (photo px) a filter reaches for its pixels: export tiles leave that much room. */
export function filterReach(f) {
  switch (f.type) {
    case 'blur': return 3;
    case 'blurMore': return 6;
    case 'gaussian': case 'highpass': case 'unsharp': case 'smart': return f.radius * 3;
    case 'box': case 'surface': case 'median': case 'dust': case 'maximum': case 'minimum': case 'oil': return f.radius * 2;
    case 'motion': return f.distance;
    case 'tiltshift': case 'iris': case 'field': return f.blur * 3;
    case 'mosaic': case 'crystallize': return f.cell * 2;
    case 'halftone': return f.radius * 2;
    case 'wave': return f.amp;
    case 'ripple': return Math.abs(f.amount) * 0.1 + 10;
    case 'reduce': return 12;
    default: return 4;
  }
}

/**
 * How a filter runs: its Gaussian blur first (sigma, photo px) when it needs
 * one, a separable max/min, or none; then the FX pass with its number and
 * settings.
 */
export function filterPlan(f) {
  const n = (v) => Number(v) || 0;
  switch (f.type) {
    case 'blur': return { blur: 0.8, fx: 1 };
    case 'blurMore': return { blur: 1.8, fx: 1 };
    case 'gaussian': return { blur: f.radius, fx: 1 };
    case 'box': return { box: f.radius, fx: 1 };
    case 'motion': return { motion: [f.distance, f.angle], fx: 1 };
    case 'field': return { blur: f.blur, fx: 1 };
    case 'tiltshift': return { blur: f.blur, fx: 2, p: [f.pos / 100, f.focus / 100, f.trans / 100, f.angle] };
    case 'iris': return { blur: f.blur, fx: 3, p: [f.x / 100, f.y / 100, f.size / 100, f.trans / 100] };
    case 'unsharp': return { blur: f.radius, fx: 4, p: [f.amount / 100, f.threshold / 255] };
    case 'smart': return { blur: f.radius, fx: 4, p: [f.amount / 100, f.noise / 2550] };
    case 'sharpen': return { blur: 0.7, fx: 4, p: [0.6, 0] };
    case 'sharpenMore': return { blur: 0.9, fx: 4, p: [1.4, 0] };
    case 'highpass': return { blur: f.radius, fx: 5 };
    case 'maximum': return { max: f.radius, fx: 1 };
    case 'minimum': return { min: f.radius, fx: 1 };
    case 'surface': return { fx: 6, p: [f.radius, f.threshold / 255] };
    case 'despeckle': return { fx: 6, p: [2, 0.08] };
    case 'reduce': return { fx: 6, p: [2 + f.strength, 0.03 + (f.strength / 10) * 0.12 * (1 - f.detail / 200)] };
    case 'median': return { fx: 7, p: [f.radius, 0] };
    case 'dust': return { fx: 7, p: [f.radius, f.threshold / 255 + 1e-4] };
    case 'mosaic': return { fx: 8, p: [f.cell] };
    case 'crystallize': return { fx: 9, p: [f.cell] };
    case 'halftone': return { fx: 10, p: [f.radius] };
    case 'pinch': return { fx: 11, p: [f.amount / 100] };
    case 'spherize': return { fx: 12, p: [f.amount / 100] };
    case 'twirl': return { fx: 13, p: [f.angle] };
    case 'ripple': return { fx: 14, p: [f.amount / 100, n(f.size)] };
    case 'wave': return { fx: 15, p: [f.length, f.amp, f.angle] };
    case 'radial': return { fx: 16, p: [f.amount, f.method === 'zoom' ? 1 : 0] };
    case 'noise': return { fx: 17, p: [f.amount / 100, f.dist === 'gaussian' ? 1 : 0, f.mono ? 1 : 0] };
    case 'clouds': return { fx: 18, p: [f.scale] };
    case 'flare': return { fx: 19, p: [f.bright / 100, f.x / 100, f.y / 100] };
    case 'emboss': return { fx: 20, p: [f.angle, f.height, f.amount / 100] };
    case 'edges': return { fx: 21 };
    case 'solarize': return { fx: 22 };
    case 'oil': return { fx: 23, p: [f.radius * 1.5] };
    case 'diffuse': return { fx: 24, p: [2] };
    default: return { fx: 0 };
  }
}

// Separable blur along uDir (output px per step): Gaussian (sigma uSigma), box, max or min.
export const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir, uSize; // step direction (texels), texture size
uniform float uSigma, uMode; // 0 gaussian, 1 box (radius uSigma), 2 max, 3 min
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float r = uMode < 0.5 ? uSigma * 3.0 : uSigma;
  float n = min(r, 48.0);
  float stepPx = max(1.0, r / 48.0);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  vec4 m = texture(uTex, uv);
  for (float i = -n; i <= n; i += 1.0) {
    vec4 c = texture(uTex, uv + uDir * i * stepPx / uSize);
    if (uMode > 2.5) m = min(m, c);
    else if (uMode > 1.5) m = max(m, c);
    else {
      float w = uMode < 0.5 ? exp(-0.5 * (i * stepPx) * (i * stepPx) / max(uSigma * uSigma, 1e-4)) : 1.0;
      acc += c * w;
      wsum += w;
    }
  }
  o = uMode > 1.5 ? m : acc / max(wsum, 1e-6);
}`;

// Everything after the blur: uTex is the layer, uBlur the blurred one (any
// size; sampled by position), uSel the selection the filter was applied in.
export const FX_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex, uBlur, uSel;
uniform vec2 uOutSize, uOriSize, uScale;
uniform mat3 uOut2Ori, uOri2Out;
uniform float uFx, uK, uUseSel, uSeed;
uniform vec4 uP;
uniform vec3 uFg, uBg;
uniform vec3 uCenter; // x, y (oriented px), radius
out vec4 o;

vec2 toOri(vec2 p) { return (uOut2Ori * vec3(p, 1.0)).xy; }
vec4 at(vec2 p) { return texture(uTex, p / uOutSize); }
vec4 atOri(vec2 q) { return at((uOri2Out * vec3(q, 1.0)).xy); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32 + uSeed); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.7)); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec4 un(vec4 c) { return vec4(c.rgb / max(c.a, 1e-5), c.a); }
vec4 pre(vec4 c) { return vec4(c.rgb * c.a, c.a); }

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 q = toOri(p);
  vec4 c = at(p);
  vec4 b = texture(uBlur, p / uOutSize * uScale);
  int fx = int(uFx + 0.5);
  vec4 r = c;
  vec2 cen = uCenter.xy;
  float rad = max(uCenter.z, 1.0);
  if (fx == 1) r = b;
  else if (fx == 2 || fx == 3) {
    float d;
    if (fx == 2) {
      float a = radians(uP.w);
      vec2 n = vec2(-sin(a), cos(a));
      vec2 c0 = vec2(uOriSize.x * 0.5, uOriSize.y * uP.x);
      d = abs(dot(q - c0, n)) / uOriSize.y;
    } else {
      vec2 c0 = uP.xy * uOriSize;
      d = length((q - c0) / max(uOriSize.x, uOriSize.y));
    }
    float w = smoothstep(uP.y * 0.5, uP.y * 0.5 + uP.z * 0.5 + 1e-4, d);
    r = mix(c, b, w);
  }
  else if (fx == 4) {
    vec4 d = c - b;
    float t = uP.y;
    r = abs(lum(d.rgb)) > t ? clamp(c + d * uP.x, 0.0, 1.0) : c;
    r.rgb = min(r.rgb, vec3(r.a));
  }
  else if (fx == 5) { r = vec4(clamp(c.rgb - b.rgb + 0.5 * c.a, 0.0, 1.0), c.a); r.rgb = min(r.rgb, vec3(r.a)); }
  else if (fx == 6) { // surface blur: neighbours of similar colour only
    float rr = uP.x * uK, t = uP.y;
    float st = max(1.0, rr / 6.0);
    vec4 acc = vec4(0.0); float ws = 0.0;
    for (float j = -6.0; j <= 6.0; j += 1.0) for (float i = -6.0; i <= 6.0; i += 1.0) {
      vec2 d = vec2(i, j) * st;
      if (length(d) > rr + 0.5) continue;
      vec4 s = at(p + d);
      float w = max(0.0, 1.0 - length(s.rgb - c.rgb) / (2.5 * t));
      acc += s * w; ws += w;
    }
    r = acc / max(ws, 1e-5);
  }
  else if (fx == 7) { // median (3x3 at the radius), and dust & scratches (only where it differs enough)
    float st = max(1.0, uP.x * uK);
    vec4 v[9];
    int k = 0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) v[k++] = at(p + vec2(i, j) * st);
    for (int a = 0; a < 9; a++) for (int bb = a + 1; bb < 9; bb++) { vec4 lo = min(v[a], v[bb]); v[bb] = max(v[a], v[bb]); v[a] = lo; }
    r = v[4];
    if (uP.y > 0.0 && length(r.rgb - c.rgb) < uP.y) r = c;
  }
  else if (fx == 8) { // mosaic, on a grid of the photo
    vec2 cell = (floor(q / uP.x) + 0.5) * uP.x;
    r = atOri(cell);
  }
  else if (fx == 9) { // crystallize: the colour at the nearest of jittered points
    vec2 g = floor(q / uP.x);
    float best = 1e9; vec2 bp = q;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 cc = g + vec2(i, j);
      vec2 pt = (cc + hash2(cc)) * uP.x;
      float d = distance(pt, q);
      if (d < best) { best = d; bp = pt; }
    }
    r = atOri(bp);
  }
  else if (fx == 10) { // colour halftone: a dot screen per channel
    vec4 u = un(c);
    vec3 res;
    float ang[3] = float[3](108.0, 162.0, 90.0);
    for (int ch = 0; ch < 3; ch++) {
      float a = radians(ang[ch]);
      mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
      vec2 rq = R * q;
      vec2 cell = (floor(rq / (uP.x * 2.0)) + 0.5) * uP.x * 2.0;
      vec4 s = un(atOri(transpose(R) * cell));
      float ink = 1.0 - s[ch];
      float d = distance(rq, cell) / uP.x;
      res[ch] = d < sqrt(ink) * 1.2 ? 0.0 : 1.0;
    }
    r = pre(vec4(res, u.a));
  }
  else if (fx >= 11 && fx <= 15) { // distortions: where each pixel comes from
    vec2 d = (q - cen) / rad;
    float l = length(d);
    vec2 src = q;
    if ((fx == 11 || fx == 12) && l < 1.0 && l > 0.0) { // pinch squeezes towards the middle, spherize bulges
      float e = fx == 11 ? 1.0 - uP.x * 0.5 : 1.0 + uP.x * 0.6;
      src = mix(cen + d * rad * pow(l, e) / l, q, smoothstep(0.85, 1.0, l));
    } else if (fx == 13 && l < 1.0) { // twirl
      float a = radians(uP.x) * (1.0 - l) * (1.0 - l);
      src = cen + mat2(cos(a), sin(a), -sin(a), cos(a)) * (q - cen);
    } else if (fx == 14) { // ripple
      float s = 6.0 * (4.0 - uP.y);
      src = q + uP.x * 6.0 * vec2(sin(q.y / s), sin(q.x / s));
    } else if (fx == 15) { // wave
      float a = radians(uP.z);
      vec2 n = vec2(cos(a), sin(a));
      float ph = dot(q, vec2(-n.y, n.x)) * 6.28318 / max(uP.x, 1.0);
      src = q + n * sin(ph) * uP.y;
    }
    r = atOri(src);
  }
  else if (fx == 16) { // radial blur: spin or zoom about the centre
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 32; i++) {
      float t = (float(i) / 31.0 - 0.5) * uP.x / 100.0;
      vec2 src = uP.y > 0.5 ? cen + (q - cen) * (1.0 + t * 0.6) : cen + mat2(cos(t), sin(t), -sin(t), cos(t)) * (q - cen);
      acc += atOri(src);
    }
    r = acc / 32.0;
  }
  else if (fx == 17) { // add noise
    vec2 g = floor(q);
    vec4 h4 = vec4(hash(g), hash(g + 1.3), hash(g + 2.9), hash(g + 5.3));
    vec3 n = uP.y > 0.5
      ? (vec3(dot(h4, vec4(0.25)), hash(g + 11.0) * 0.5 + hash(g + 12.3) * 0.5, hash(g + 21.0) * 0.5 + hash(g + 23.9) * 0.5) - 0.5) * 1.6
      : vec3(h4.x, hash(g + 3.1), hash(g + 7.7)) - 0.5;
    if (uP.z > 0.5) n = vec3(n.r);
    vec4 u = un(c);
    r = pre(vec4(clamp(u.rgb + n * uP.x, 0.0, 1.0), u.a));
  }
  else if (fx == 18) { // clouds, between the two colours
    vec2 s = q / uP.x;
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 6; i++) { v += vnoise(s + float(i) * 13.1) * amp; s *= 2.0; amp *= 0.5; }
    r = vec4(mix(uFg, uBg, clamp(v, 0.0, 1.0)), 1.0);
  }
  else if (fx == 19) { // lens flare: a glow, a ring and spots towards the centre
    vec2 fp = uP.yz * uOriSize, mid = uOriSize * 0.5;
    float L = max(uOriSize.x, uOriSize.y);
    float d = distance(q, fp) / L;
    float glow = exp(-d * 18.0) * 1.2 + exp(-d * 4.0) * 0.25;
    float ring = exp(-pow((d - 0.12) * 60.0, 2.0)) * 0.15;
    float spots = 0.0;
    for (int i = 1; i <= 4; i++) {
      vec2 sp = mix(fp, mid + (mid - fp), float(i) * 0.25);
      spots += exp(-pow(distance(q, sp) / (L * (0.01 + 0.012 * float(i))), 2.0)) * 0.18;
    }
    vec3 add = (vec3(1.0, 0.9, 0.75) * glow + vec3(0.7, 0.85, 1.0) * (ring + spots)) * uP.x;
    r = vec4(min(c.rgb + add * c.a, vec3(c.a)), c.a);
  }
  else if (fx == 20) { // emboss
    float a = radians(uP.x);
    vec2 d = vec2(cos(a), -sin(a)) * max(1.0, uP.y * uK * 0.5);
    float g = lum(at(p + d).rgb - at(p - d).rgb);
    r = vec4(vec3(clamp(0.5 + g * uP.z, 0.0, 1.0)) * c.a, c.a);
  }
  else if (fx == 21) { // find edges
    vec3 gx = (at(p + vec2(1, 1)).rgb + 2.0 * at(p + vec2(1, 0)).rgb + at(p + vec2(1, -1)).rgb) - (at(p + vec2(-1, 1)).rgb + 2.0 * at(p + vec2(-1, 0)).rgb + at(p + vec2(-1, -1)).rgb);
    vec3 gy = (at(p + vec2(-1, 1)).rgb + 2.0 * at(p + vec2(0, 1)).rgb + at(p + vec2(1, 1)).rgb) - (at(p + vec2(-1, -1)).rgb + 2.0 * at(p + vec2(0, -1)).rgb + at(p + vec2(1, -1)).rgb);
    r = vec4(clamp(1.0 - sqrt(gx * gx + gy * gy) * 0.7, 0.0, 1.0) * c.a, c.a);
  }
  else if (fx == 22) { vec4 u = un(c); r = pre(vec4(mix(u.rgb, 1.0 - u.rgb, step(0.5, u.rgb)), u.a)); }
  else if (fx == 23) { // oil paint (Kuwahara): the calmest of four quadrants
    float rr = max(1.0, uP.x * uK);
    float st = max(1.0, rr / 4.0);
    vec3 bestM = c.rgb; float bestV = 1e9;
    for (int k = 0; k < 4; k++) {
      vec2 sg = vec2(k == 0 || k == 2 ? -1.0 : 1.0, k < 2 ? -1.0 : 1.0);
      vec3 m = vec3(0.0), m2 = vec3(0.0);
      for (float j = 0.0; j <= 4.0; j += 1.0) for (float i = 0.0; i <= 4.0; i += 1.0) {
        vec3 s = at(p + sg * vec2(i, j) * st).rgb;
        m += s; m2 += s * s;
      }
      m /= 25.0; m2 /= 25.0;
      float v = dot(m2 - m * m, vec3(1.0));
      if (v < bestV) { bestV = v; bestM = m; }
    }
    r = vec4(bestM, c.a);
  }
  else if (fx == 24) { r = at(p + (hash2(floor(q)) - 0.5) * 2.0 * uP.x * max(1.0, uK)); }
  if (uUseSel > 0.5) r = mix(c, r, texture(uSel, q / uOriSize).a);
  o = r;
}`;
