// Draws Retouch layers (retouch.js) on top of the developed photo, on the
// graphics card, every time the photo is drawn. The developed photo goes into
// a buffer first; then each layer is made in a layer buffer (its strokes, a
// live copy of the photo, an adjustment of what's below, a fill, text...),
// run through its filters, given its mask and layer styles, and blended onto
// what's below (Photoshop's blend modes), the last one straight to the
// screen or export tile. Clones and heals draw the developed photo again,
// shifted by their source offset, just inside their own small box, so they
// follow every Develop change. Heals then even out the colour difference at
// their edge with a smooth fill (push-pull pyramid), like a healing brush.
import { VERT } from './shaders.js';
import { BLEND_INDEX, REGION, SNAPSHOT, SOURCED, STROKED, isIdent, kindOf, opBounds, selectionCanvas, strokeDabs, stretchLine, stretchMap, tfPx, tfScale } from './retouch.js';
import { ADJ_GLSL, adjustmentLut, adjustmentUniforms } from './adjust.js';
import { BLUR_FRAG, FX_FRAG, filterPlan } from './filters.js';
import { rasterize } from './raster.js';
import { inv3 } from './color.js';
import { ap, glMat, mm } from './renderer.js';

const DAB_VERT = `#version 300 es
layout(location = 1) in vec4 aDab; // x, y, radius (oriented px), direction
uniform mat3 uOri2Out;
uniform vec2 uOutSize;
uniform float uScale; // output px per oriented px
out vec2 vUv;
out float vR;
out vec2 vDir;
const vec2 Q[6] = vec2[6](vec2(-1, -1), vec2(1, -1), vec2(-1, 1), vec2(-1, 1), vec2(1, -1), vec2(1, 1));
void main() {
  vec2 c = Q[gl_VertexID];
  float r = aDab.z * uScale;
  vec2 p = (uOri2Out * vec3(aDab.xy, 1.0)).xy + c * (r + 1.0);
  vUv = c * (r + 1.0);
  vR = r;
  vec2 d = (uOri2Out * vec3(cos(aDab.w), sin(aDab.w), 0.0)).xy;
  vDir = d / max(length(d), 1e-6);
  gl_Position = vec4(p / uOutSize * 2.0 - 1.0, 0.0, 1.0);
}`;

// One dab's coverage: solid out to the hardness, then fading to the edge
// (a pencil's is all or nothing). Green and blue carry the stroke's direction.
const DAB_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in float vR;
in vec2 vDir;
uniform float uHard, uFlow, uAlias;
out vec4 o;
void main() {
  float d = length(vUv);
  float r = max(vR, 0.5);
  float inner = min(uHard * r, r - 0.75);
  float a = uAlias > 0.5 ? step(d, r) : 1.0 - smoothstep(inner, r + 0.5, d);
  a *= uFlow;
  o = vec4(a, a * (0.5 + 0.5 * vDir.x), a * (0.5 + 0.5 * vDir.y), a);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;
`;

// One op onto a layer (or a layer mask): paint colour, erase, a clone or
// heal's pixels, a fill or gradient, a picture (text, shapes), or a brush
// that works on what's there (dodge, burn, sponge, blur, sharpen, smudge, red eye).
const OP = `${HEAD}
uniform sampler2D uCov, uSrcTex, uMem, uSel, uSnap, uBack, uImg;
uniform float uKind;   // see KIND
uniform vec3 uColor;
uniform float uOpacity, uUseCov, uUseSel, uK;
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
uniform vec3 uMemRect;  // x0, y0 (output px), scale
uniform vec2 uMemSize, uMemCap;
uniform vec4 uG, uC0, uC1, uImgRect, uP; // gradient ends (oriented px), its colours, a picture's place, brush settings
uniform float uGStyle;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 there(ivec2 ip) { vec4 s = texelFetch(uSnap, ip, 0); return s.rgb + texelFetch(uBack, ip, 0).rgb * (1.0 - s.a); }
vec3 thereAt(vec2 p) { return there(clamp(ivec2(p), ivec2(0), textureSize(uSnap, 0) - 1)); }
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  int kind = int(uKind + 0.5);
  vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  float a = uOpacity;
  vec4 cov = texelFetch(uCov, ip, 0);
  if (uUseCov > 0.5) a *= min(cov.r, 1.0);
  if (uUseSel > 0.5) a *= texture(uSel, q / uOriSize).a;
  vec3 c = uColor;
  if (kind == 2 || kind == 3) c = texelFetch(uSrcTex, ip, 0).rgb;
  if (kind == 3) {
    vec2 m = clamp((gl_FragCoord.xy - uMemRect.xy) * uMemRect.z, vec2(0.5), uMemSize - 0.5);
    c = clamp(c + texture(uMem, m / uMemCap).rgb, 0.0, 1.0);
  }
  if (kind == 6) { // gradient: linear, radial, angle, reflected, diamond
    vec2 A = uG.xy, d = uG.zw - A, v = q - A;
    float L2 = max(dot(d, d), 1e-6), t;
    int st = int(uGStyle + 0.5);
    if (st == 1) t = length(v) / sqrt(L2);
    else if (st == 2) t = fract(atan(v.x * d.y - v.y * d.x, dot(v, d)) / 6.28318 + 1.0);
    else if (st == 3) t = abs(dot(v, d)) / L2;
    else if (st == 4) t = (abs(dot(v, d)) + abs(v.x * d.y - v.y * d.x)) / L2;
    else t = dot(v, d) / L2;
    vec4 g = mix(uC0, uC1, clamp(t, 0.0, 1.0));
    a *= g.a;
    c = g.rgb;
  }
  if (kind == 7) { // a picture: premultiplied already
    vec2 uv = (q - uImgRect.xy) / uImgRect.zw;
    vec4 im = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(uImg, uv);
    o = im * a;
    return;
  }
  if (kind >= 8) {
    vec3 s = there(ip);
    float l = lum(s);
    if (kind == 8 || kind == 9) { // dodge, burn: shadows, midtones or highlights
      float w = uP.x < 0.5 ? (1.0 - l) * (1.0 - l) : uP.x < 1.5 ? 4.0 * l * (1.0 - l) : l * l;
      float e = uP.y * w;
      c = kind == 8 ? s + (1.0 - s) * e * 0.9 : s * (1.0 - e * 0.85);
      if (uP.z > 0.5) c = mix(c, s * (lum(c) / max(l, 1e-4)), 0.5); // protect tones
    } else if (kind == 10) c = mix(vec3(l), s, uP.x < 0.5 ? 1.0 + uP.y : 1.0 - uP.y); // sponge
    else if (kind == 11 || kind == 12) { // blur, sharpen
      float r = max(1.5, 2.5 * uK);
      vec3 sum = s;
      for (int i = 0; i < 12; i++) {
        float an = float(i) * 0.5236;
        sum += thereAt(gl_FragCoord.xy + vec2(cos(an), sin(an)) * r * (i % 2 == 0 ? 1.0 : 0.55));
      }
      vec3 b = sum / 13.0;
      c = kind == 11 ? b : clamp(s + (s - b) * (0.6 + uP.y), 0.0, 1.0);
    } else if (kind == 13) { // smudge: pulled along the stroke
      vec2 dir = cov.a > 0.0 ? (cov.gb / cov.a - 0.5) * 2.0 : vec2(0.0);
      c = thereAt(gl_FragCoord.xy - dir * uP.w);
    } else if (kind == 14) { // red eye: red becomes a dark grey
      float red = s.r - max(s.g, s.b);
      c = mix(s, vec3((s.g + s.b) * 0.5) * (1.0 - uP.y * 0.7), smoothstep(0.05, 0.25, red));
    }
    c = clamp(c, 0.0, 1.0);
  }
  o = kind == 1 || kind == 5 ? vec4(a) : vec4(c * a, a);
}`;

// A selection as coverage (patch tool, red eye).
const COVSEL = `${HEAD}
uniform sampler2D uSel;
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
void main() { float a = texture(uSel, (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy / uOriSize).a; o = vec4(a, 0.5 * a, 0.5 * a, a); }`;

// Inside the photo (a moved copy of it is clear beyond its edges).
const INSIDE = `${HEAD}
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
void main() { vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy; o = vec4(q.x >= 0.0 && q.y >= 0.0 && q.x <= uOriSize.x && q.y <= uOriSize.y ? 1.0 : 0.0); }`;

// Pixel stretch: just its one-pixel line (in the layer's own coordinates, so
// a transform stretches it).
const STRETCH = `${HEAD}
uniform mat3 uOut2Ori;
uniform vec4 uS; // column (1) or row (0), the line's middle, where it starts and ends along itself (oriented px)
void main() {
  vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  vec2 v = uS.x > 0.5 ? q : q.yx;
  o = vec4(abs(v.x - uS.y) <= 0.5 && v.y >= uS.z && v.y <= uS.w ? 1.0 : 0.0);
}`;

// Heal, first level: the difference between what's there and the source, known
// only outside the stroke (weight 1), averaged over each texel's footprint.
const HEAL_L0 = `${HEAD}
uniform sampler2D uBack, uSrcTex, uCov;
uniform vec3 uMemRect;
void main() {
  vec4 sum = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 q = uMemRect.xy + (gl_FragCoord.xy - 0.5 + (vec2(i, j) + 0.5) * 0.5) / uMemRect.z;
    ivec2 ip = min(ivec2(q), textureSize(uCov, 0) - 1);
    float w = texelFetch(uCov, ip, 0).r < 0.02 ? 1.0 : 0.0;
    sum += vec4((texelFetch(uBack, ip, 0).rgb - texelFetch(uSrcTex, ip, 0).rgb) * w, w);
  }
  o = sum * 0.25;
}`;

const PULL = `${HEAD}
uniform sampler2D uTex;
uniform vec2 uMax; // last valid texel of the finer level
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 2;
  ivec2 m = ivec2(uMax);
  o = (texelFetch(uTex, min(b, m), 0) + texelFetch(uTex, min(b + ivec2(1, 0), m), 0)
     + texelFetch(uTex, min(b + ivec2(0, 1), m), 0) + texelFetch(uTex, min(b + ivec2(1, 1), m), 0)) * 0.25;
}`;

// Coarse to fine: known values where there are some, the coarser fill elsewhere.
const PUSH = `${HEAD}
uniform sampler2D uL, uUp;
uniform vec2 uUpSize, uUpCap;
uniform float uTop;
void main() {
  vec4 l = texelFetch(uL, ivec2(gl_FragCoord.xy), 0);
  if (uTop > 0.5) { o = vec4(l.rgb / max(l.a, 1e-6), 1.0); return; }
  vec2 q = clamp(gl_FragCoord.xy * 0.5, vec2(0.5), uUpSize - 0.5);
  vec3 up = texture(uUp, q / uUpCap).rgb;
  o = vec4(l.rgb + (1.0 - l.a) * up, 1.0);
}`;

// An adjustment layer: what's below, adjusted.
const ADJ = `${HEAD}
uniform sampler2D uBack;
${ADJ_GLSL}
void main() { o = vec4(adjust(texelFetch(uBack, ivec2(gl_FragCoord.xy), 0).rgb), 1.0); }`;

// Layer styles: shadows and glows (a blurred, shifted copy of the layer's shape
// in one colour), and the layer with its stroke and colour overlay.
const SHADE = `${HEAD}
uniform sampler2D uTex;
uniform vec2 uOff, uOutSize, uScale;
uniform vec3 uColor;
uniform float uGain;
void main() {
  float a = clamp(texture(uTex, (gl_FragCoord.xy - uOff) / uOutSize * uScale).a * uGain, 0.0, 1.0);
  o = vec4(uColor * a, a);
}`;
const STYLE = `${HEAD}
uniform sampler2D uTex, uDil;
uniform vec2 uOutSize, uScale;
uniform float uFill, uUseStroke, uUseOverlay, uOverlayA, uStrokeA;
uniform vec3 uStrokeC, uOverlayC;
void main() {
  vec4 c0 = texelFetch(uTex, ivec2(gl_FragCoord.xy), 0), c = c0;
  if (uUseOverlay > 0.5) c.rgb = mix(c.rgb, uOverlayC * c.a, uOverlayA);
  c *= uFill;
  if (uUseStroke > 0.5) {
    float d = clamp(texture(uDil, gl_FragCoord.xy / uOutSize * uScale).a, 0.0, 1.0);
    float s = max(0.0, d - c0.a) * uStrokeA;
    c = c + vec4(uStrokeC * s, s) * (1.0 - c.a);
  }
  o = c;
}`;

// The clipping base's shape, for layers clipped to it.
const CLIPA = `${HEAD}
uniform sampler2D uTex, uMask;
uniform float uUseMask, uDensity, uOpacity;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  float m = uUseMask > 0.5 ? 1.0 - uDensity * (1.0 - texelFetch(uMask, ip, 0).r) : 1.0;
  o = vec4(texelFetch(uTex, ip, 0).a * m * uOpacity);
}`;

// A layer onto what's below it, with its blend mode, opacity, mask and clipping
// (W3C / Photoshop formulas). Modes in retouch.js BLEND_MODES order.
const COMP = `${HEAD}
uniform sampler2D uBack, uLayer, uMask, uClip;
uniform float uMode, uOpacity, uUseMask, uDensity, uUseClip;
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c), n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 setSat(vec3 c, float s) {
  float n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}
vec3 soft(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b + (2.0 * s - 1.0) * (d - b), b - (1.0 - 2.0 * s) * b * (1.0 - b), step(s, vec3(0.5)));
}
vec3 burn(vec3 b, vec3 s) { return mix(1.0 - min(vec3(1.0), (1.0 - b) / max(s, vec3(1e-5))), vec3(1.0), step(1.0, b)); }
vec3 dodge(vec3 b, vec3 s) { return mix(min(vec3(1.0), b / max(1.0 - s, vec3(1e-5))), vec3(0.0), step(b, vec3(0.0))); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 b = texelFetch(uBack, ip, 0).rgb;
  vec4 l = texelFetch(uLayer, ip, 0);
  float a = l.a * uOpacity;
  if (uUseMask > 0.5) a *= 1.0 - uDensity * (1.0 - texelFetch(uMask, ip, 0).r);
  if (uUseClip > 0.5) a *= texelFetch(uClip, ip, 0).a;
  // Nothing lands outside the photo (as on a Photoshop canvas).
  vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  if (q.x < 0.0 || q.y < 0.0 || q.x > uOriSize.x || q.y > uOriSize.y) a = 0.0;
  if (a <= 0.0) { o = vec4(b, 1.0); return; }
  vec3 s = clamp(l.rgb / l.a, 0.0, 1.0);
  int m = int(uMode + 0.5);
  vec3 f = s;
  if (m == 1) a = hash(gl_FragCoord.xy) < a ? 1.0 : 0.0;
  else if (m == 2) f = min(b, s);
  else if (m == 3) f = b * s;
  else if (m == 4) f = burn(b, s);
  else if (m == 5) f = max(b + s - 1.0, 0.0);
  else if (m == 6) f = lum(s) < lum(b) ? s : b;
  else if (m == 7) f = max(b, s);
  else if (m == 8) f = 1.0 - (1.0 - b) * (1.0 - s);
  else if (m == 9) f = dodge(b, s);
  else if (m == 10) f = min(b + s, 1.0);
  else if (m == 11) f = lum(s) > lum(b) ? s : b;
  else if (m == 12) f = mix(1.0 - 2.0 * (1.0 - b) * (1.0 - s), 2.0 * b * s, step(b, vec3(0.5)));
  else if (m == 13) f = soft(b, s);
  else if (m == 14) f = mix(1.0 - 2.0 * (1.0 - b) * (1.0 - s), 2.0 * b * s, step(s, vec3(0.5)));
  else if (m == 15) f = mix(dodge(b, 2.0 * s - 1.0), burn(b, 2.0 * s), step(s, vec3(0.5)));
  else if (m == 16) f = clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
  else if (m == 17) f = mix(max(b, 2.0 * s - 1.0), min(b, 2.0 * s), step(s, vec3(0.5)));
  else if (m == 18) f = step(1.0, b + s);
  else if (m == 19) f = abs(b - s);
  else if (m == 20) f = b + s - 2.0 * b * s;
  else if (m == 21) f = max(b - s, 0.0);
  else if (m == 22) f = min(b / max(s, vec3(1e-5)), 1.0);
  else if (m == 23) f = setLum(setSat(s, sat(b)), lum(b));
  else if (m == 24) f = setLum(setSat(b, sat(s)), lum(b));
  else if (m == 25) f = setLum(s, lum(b));
  else if (m == 26) f = setLum(b, lum(s));
  o = vec4(mix(b, clamp(f, 0.0, 1.0), min(a, 1.0)), 1.0);
}`;

const MEM_CAP = 1024; // the heal fill is worked out at up to this size

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vert, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    loc[name] = gl.getUniformLocation(p, name);
  }
  return { p, loc };
}

const KIND = { paint: 0, erase: 1, clone: 2, heal: 3, patch: 3, fill: 4, clear: 5, gradient: 6, dodge: 8, burn: 9, sponge: 10, blur: 11, sharpen: 12, smudge: 13, redeye: 14 };
const GRAD = { linear: 0, radial: 1, angle: 2, reflected: 3, diamond: 4 };
// Full-size buffers per output size, each made the first time it's needed.
const BUFFERS = ['acc0', 'acc1', 'src', 'layer', 'tmp', 'snap', 'mask', 'clipA', 'fxA', 'fxB', 'cov'];
const on = (x) => !!x && x.on !== false;

export class Composer {
  constructor(r) {
    this.r = r;
    const gl = (this.gl = r.gl);
    this.progs = {
      dab: program(gl, DAB_VERT, DAB_FRAG), op: program(gl, VERT, OP), covsel: program(gl, VERT, COVSEL), inside: program(gl, VERT, INSIDE),
      healL0: program(gl, VERT, HEAL_L0), pull: program(gl, VERT, PULL), push: program(gl, VERT, PUSH), comp: program(gl, VERT, COMP),
      adj: program(gl, VERT, ADJ), blur: program(gl, VERT, BLUR_FRAG), fx: program(gl, VERT, FX_FRAG), shade: program(gl, VERT, SHADE),
      style: program(gl, VERT, STYLE), clipa: program(gl, VERT, CLIPA), stretch: program(gl, VERT, STRETCH),
    };
    this.vao = gl.createVertexArray();
    this.sets = new Map(); // "WxH" -> buffers for that output size
    this.bufs = new Map(); // op -> { buf, n } (its dabs on the graphics card)
    this.sels = new Map(); // selection -> texture
    this.luts = new Map(); // adjustment -> lookup texture
    this.rasters = new Map(); // text / shape key -> { tex, rect }
    this.fillOps = new WeakMap(); // a gradient fill layer's settings -> its op
    this.bounds = new WeakMap(); // op -> its box (oriented px)
  }

  /** Working buffers for one output size; the screen, histogram and preview each keep theirs. */
  set(W, H) {
    const key = `${W}x${H}`;
    let t = this.sets.get(key);
    if (!t) {
      const r = this.r, gl = this.gl;
      t = { W, H, small: new Map(), made: {} };
      for (const name of BUFFERS) {
        Object.defineProperty(t, name, {
          configurable: true, enumerable: true,
          get() { const v = (t.made[name] = r.target(W, H, gl.RGBA8)); Object.defineProperty(t, name, { value: v, writable: true, enumerable: true }); return v; },
        });
      }
      t.acc = [null, null];
      Object.defineProperty(t.acc, 0, { get: () => t.acc0 });
      Object.defineProperty(t.acc, 1, { get: () => t.acc1 });
      if (this.sets.size >= 3) {
        const [old, o] = this.sets.entries().next().value;
        this.sets.delete(old);
        this.freeSet(o);
      }
    } else this.sets.delete(key);
    this.sets.set(key, t);
    return t;
  }

  freeSet(t) {
    for (const v of Object.values(t.made)) this.r.free(v);
    for (const v of t.small.values()) for (const x of v) this.r.free(x);
  }

  pyramid() {
    if (this.pyr) return this.pyr;
    const r = this.r;
    const L = [], F = [];
    for (let s = MEM_CAP; s >= 1; s >>= 1) { L.push(r.target(s, s)); F.push(r.target(s, s)); }
    return (this.pyr = { L, F });
  }

  dabsOf(op, geo, live) {
    let b = this.bufs.get(op);
    if (b) { b.used = this.frame; return b; }
    const gl = this.gl;
    const data = strokeDabs(op, geo.ow, geo.oh);
    b = { buf: live ? this.liveBuf ||= gl.createBuffer() : gl.createBuffer(), n: data.length / 4, used: this.frame, live };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, live ? gl.STREAM_DRAW : gl.STATIC_DRAW);
    if (!live) this.bufs.set(op, b);
    return b;
  }

  texOf(source, premultiply = false) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }

  /** Keeps at most n entries in a cache of textures (oldest out first). */
  trim(map, n, tex = (v) => v) {
    while (map.size > n) {
      const [old, v] = map.entries().next().value;
      map.delete(old);
      this.gl.deleteTexture(tex(v));
    }
  }

  selTex(sel, geo) {
    let t = this.sels.get(sel);
    if (t) return t;
    const k = Math.min(1, Math.min(4096, this.r.maxTex) / Math.max(geo.ow, geo.oh));
    t = this.texOf(selectionCanvas(sel, Math.max(8, Math.round(geo.ow * k)), Math.max(8, Math.round(geo.oh * k)), geo.ow, geo.oh));
    this.sels.set(sel, t);
    this.trim(this.sels, 12);
    return t;
  }

  lutTex(adj) {
    let t = this.luts.get(adj);
    if (t) return t;
    const data = adjustmentLut(adj);
    if (!data) return null;
    const gl = this.gl;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.luts.set(adj, t);
    this.trim(this.luts, 16);
    return t;
  }

  /** A text or shape layer drawn at about `scale` output px per oriented px (in steps, so zooming doesn't redraw it every frame). */
  rasterOf(l, geo, scale) {
    const step = 1.25 ** Math.ceil(Math.log(Math.max(scale, 1e-3)) / Math.log(1.25));
    const key = `${l.kind}|${JSON.stringify(l.kind === 'text' ? l.text : l.shape)}|${step.toFixed(4)}`;
    let hit = this.rasters.get(key);
    if (hit) { this.rasters.delete(key); this.rasters.set(key, hit); return hit; }
    const { canvas, rect } = rasterize(l, geo.ow, geo.oh, step, Math.min(4096, this.r.maxTex));
    hit = { tex: this.texOf(canvas, true), rect };
    this.rasters.set(key, hit);
    this.trim(this.rasters, 24, (h) => h.tex);
    return hit;
  }

  /** Forgets graphics memory for ops that are gone (undone, deleted). */
  sweep() {
    if (this.bufs.size < 512) return;
    for (const [op, b] of this.bufs) if (this.frame - b.used > 120) { this.gl.deleteBuffer(b.buf); this.bufs.delete(op); }
  }

  dispose() {
    const gl = this.gl, r = this.r;
    for (const t of this.sets.values()) this.freeSet(t);
    for (const b of this.bufs.values()) gl.deleteBuffer(b.buf);
    if (this.liveBuf) gl.deleteBuffer(this.liveBuf);
    for (const t of [...this.sels.values(), ...this.luts.values()]) gl.deleteTexture(t);
    for (const h of this.rasters.values()) gl.deleteTexture(h.tex);
    for (const t of [...(this.pyr?.L || []), ...(this.pyr?.F || [])]) r.free(t);
    this.dropHeld();
    gl.deleteVertexArray(this.vao);
    for (const p of Object.values(this.progs)) gl.deleteProgram(p.p);
  }

  /** ctx for drawing a layer moved / turned / scaled by its transform. */
  layerCtx(ctx, tf) {
    if (!tf || isIdent(tf)) return ctx;
    const m = tfPx(tf, ctx.geo.ow, ctx.geo.oh);
    const ori2out = mm(ctx.ori2out, [m[0], m[1], m[2], m[3], m[4], m[5], 0, 0, 1]);
    const out2ori = inv3(ori2out);
    return { ...ctx, ori2out, out2ori, k: ctx.k * tfScale(m), uOri2Out: glMat(ori2out), uOut2Ori: glMat(out2ori), moved: true };
  }

  /**
   * The developed photo with `layers` on top into `target` (null = the
   * canvas). base(target, extra) draws the developed photo; extra may shift
   * it (oriented px), map it differently (a moved layer) and swap in a
   * sharper source for that op. `key` lists what the picture depends on
   * besides the layers: while a stroke is painted (`live.op`) and nothing in
   * it changes, everything under the stroke is kept from the stroke's first
   * frame, so painting costs only the stroke itself (and what's on top).
   * live.tf moves a layer while it's dragged.
   */
  render(base, layers, geo, out2ori, target, live, key) {
    const gl = this.gl;
    this.frame = (this.frame || 0) + 1;
    const W = target ? target.w : gl.drawingBufferWidth, H = target ? target.h : gl.drawingBufferHeight;
    const T = this.set(W, H);
    const ori2out = inv3(out2ori);
    const ctx = {
      W, H, geo, base, live, ori2out, out2ori,
      k: Math.hypot(ori2out[0], ori2out[3]), // output px per oriented px
      uOut2Ori: glMat(out2ori), uOri2Out: glMat(ori2out),
    };
    gl.disable(gl.SCISSOR_TEST);
    const liveAt = live ? layers.findIndex((l) => l.id === live.layerId) : -1;
    const fullKey = [...key, ...out2ori, W, H, target, live?.layerId, live?.target];
    const C = this.held;
    // A stroke being painted or a layer being moved: what's under it is kept from the first frame.
    const held = !!(live?.op || live?.tf);
    const reuse = liveAt >= 0 && held && C && C.key.length === fullKey.length && C.key.every((v, i) => v === fullKey[i]);
    if (!held) this.dropHeld();
    this.cur = 0;
    if (reuse) this.blit(C.below, T.acc[0]);
    else base(T.acc[0], null);

    for (let li = reuse ? liveAt : 0; li < layers.length; li++) {
      let layer = layers[li];
      const isLive = li === liveAt;
      if (isLive && live.tf) layer = { ...layer, tf: live.tf };
      const lc = this.layerCtx(ctx, layer.tf);
      const masked = !!layer.mask && !layer.mask.off;
      if (isLive && reuse && !live.tf) {
        this.blit(C.layer, T.layer);
        if (masked) this.blit(C.mask, T.mask);
        if (layer.clip) this.blit(C.clipA, T.clipA);
      } else if (isLive && reuse) { // moved: drawn again where it is now
        this.content(layer, T, lc);
        if (masked) this.drawMask(layer, T, lc);
        if (layer.clip) this.blit(C.clipA, T.clipA);
      } else {
        this.content(layer, T, lc);
        if (masked) this.drawMask(layer, T, lc);
        // The first frame: keep what's under it for the frames to come.
        if (isLive && held) {
          const held = this.hold(W, H, masked, layer.clip);
          held.key = fullKey;
          this.blit(T.layer, held.layer);
          this.blit(T.acc[this.cur], held.below);
          if (masked) this.blit(T.mask, held.mask);
          if (layer.clip) this.blit(T.clipA, held.clipA);
        }
      }
      if (isLive && live.op) this.drawOp(live.op, T, lc, live.target === 'mask' && masked ? T.mask : T.layer);
      const last = li === layers.length - 1;
      this.finish(layer, T, ctx, lc, last ? target : null, last, layers[li + 1]);
    }
    gl.disable(gl.SCISSOR_TEST);
    this.sweep();
  }

  /** A layer's own pixels into T.layer. */
  content(layer, T, lc) {
    const gl = this.gl;
    const kind = kindOf(layer);
    const solid = kind === 'fill' && layer.fillDef?.type !== 'gradient';
    const c = solid ? layer.fillDef?.color || [0, 0, 0] : null;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.layer.fb);
    gl.viewport(0, 0, lc.W, lc.H);
    gl.clearColor(c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (kind === 'photo') {
      lc.base(T.layer, { shift: [0, 0], out2ori: lc.out2ori });
      if (lc.moved) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        this.r.draw(this.progs.inside, T.layer, { uOut2Ori: lc.uOut2Ori, uOriSize: [lc.geo.ow, lc.geo.oh] });
        gl.disable(gl.BLEND);
      }
    } else if (kind === 'stretch' && layer.stretch) {
      // The photo with every pixel taken from the line, then kept only on the line.
      const { geo } = lc;
      const st = stretchLine(layer.stretch, geo.ow, geo.oh);
      lc.base(T.layer, { shift: [0, 0], out2ori: mm(stretchMap(layer.stretch, geo.ow, geo.oh), lc.out2ori), op: layer });
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      this.r.draw(this.progs.stretch, T.layer, { uOut2Ori: lc.uOut2Ori, uS: [st.col ? 1 : 0, st.line, st.a0, st.a1] });
      gl.disable(gl.BLEND);
    } else if (kind === 'stamp') this.blit(T.acc[this.cur], T.layer);
    else if (kind === 'adjust' && layer.adj) {
      const { type, p } = adjustmentUniforms(layer.adj);
      this.r.draw(this.progs.adj, T.layer, { uBack: T.acc[this.cur].tex, uAdj: type, uP: p, uLut: this.lutTex(layer.adj) || T.acc[this.cur].tex });
    } else if (kind === 'fill' && layer.fillDef?.type === 'gradient') {
      this.drawOp(this.fillOp(layer), T, lc, T.layer);
    } else if ((kind === 'text' && layer.text) || (kind === 'shape' && layer.shape)) {
      const ras = this.rasterOf(layer, lc.geo, lc.k);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const t = ras.tex;
      this.r.draw(this.progs.op, T.layer, {
        uKind: 7, uImg: t, uImgRect: ras.rect, uOpacity: 1, uUseCov: 0, uUseSel: 0, uOut2Ori: lc.uOut2Ori, uOriSize: [lc.geo.ow, lc.geo.oh],
        uCov: t, uSrcTex: t, uMem: t, uSel: t, uSnap: t, uBack: t,
      });
      gl.disable(gl.BLEND);
    }
    for (const op of layer.ops) this.drawOp(op, T, lc, T.layer);
  }

  fillOp(layer) {
    let op = this.fillOps.get(layer.fillDef);
    if (!op) { op = { t: 'gradient', opacity: 100, ...layer.fillDef.g }; this.fillOps.set(layer.fillDef, op); }
    return op;
  }

  /** A layer mask into T.mask: reveal or hide all, then its strokes, fills and gradients. */
  drawMask(layer, T, lc) {
    const gl = this.gl;
    const v = layer.mask.base ?? 1;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.mask.fb);
    gl.viewport(0, 0, lc.W, lc.H);
    gl.clearColor(v, v, v, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const op of layer.mask.ops) this.drawOp(op, T, lc, T.mask);
  }

  /** Filters, mask feather and layer styles, then the layer onto what's below. */
  finish(layer, T, ctx, lc, target, last, next) {
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    for (const f of layer.filters || []) if (on(f)) this.filter(f, T, ctx);
    const masked = !!layer.mask && !layer.mask.off;
    const L = Math.max(ctx.geo.ow, ctx.geo.oh);
    if (masked && layer.mask.feather > 0) {
      const b = this.blur(T, T.mask, layer.mask.feather * L * lc.k * 0.5, 0);
      this.r.draw(this.progs.fx, T.tmp, { uTex: T.mask.tex, uBlur: b.tex, uFx: 1, uOutSize: [ctx.W, ctx.H], ...this.blurScale(b, ctx), uUseSel: 0, uSel: T.mask.tex });
      [T.mask, T.tmp] = [T.tmp, T.mask];
    }
    const density = masked ? (layer.mask.density ?? 100) / 100 : 0;
    const clip = layer.clip ? T.clipA : null;
    const comp = (tex, mode, opacity, final) => {
      this.r.draw(this.progs.comp, final ? target : T.acc[1 - this.cur], {
        uBack: T.acc[this.cur].tex, uLayer: tex, uMode: BLEND_INDEX[mode] ?? 0, uOpacity: opacity,
        uMask: masked ? T.mask.tex : tex, uUseMask: masked ? 1 : 0, uDensity: density, uClip: clip ? clip.tex : tex, uUseClip: clip ? 1 : 0,
        uOut2Ori: ctx.uOut2Ori, uOriSize: [ctx.geo.ow, ctx.geo.oh],
      });
      if (!final) this.cur = 1 - this.cur;
    };
    const st = layer.style || {};
    const fill = (layer.fill ?? 100) / 100, opacity = layer.opacity / 100;
    // The base of a clipping group: its shape, for the layers clipped to it.
    if (next?.clip && !layer.clip) {
      this.r.draw(this.progs.clipa, T.clipA, { uTex: T.layer.tex, uMask: masked ? T.mask.tex : T.layer.tex, uUseMask: masked ? 1 : 0, uDensity: density, uOpacity: opacity });
    }
    if (!on(st.shadow) && !on(st.glow) && !on(st.stroke) && !on(st.overlay)) { comp(T.layer.tex, layer.blend, opacity * fill, last); return; }
    // Shadows and glows go under the layer, each with its own blend mode.
    const lin = (dx, dy) => { const a = ap(ctx.ori2out, dx, dy), o = ap(ctx.ori2out, 0, 0); return [a[0] - o[0], a[1] - o[1]]; };
    for (const [fx, sh] of [['shadow', st.shadow], ['glow', st.glow]]) {
      if (!on(sh)) continue;
      const b = this.blur(T, T.layer, Math.max(0.01, sh.size * L * ctx.k * 0.5), 0);
      const ang = ((sh.angle ?? 120) * Math.PI) / 180;
      const off = fx === 'shadow' ? lin(-Math.cos(ang) * sh.distance * L, Math.sin(ang) * sh.distance * L) : [0, 0];
      this.r.draw(this.progs.shade, T.fxA, {
        uTex: b.tex, uOff: off, uOutSize: [ctx.W, ctx.H], ...this.blurScale(b, ctx), uColor: sh.color, uGain: (fx === 'shadow' ? 1 : 2) + (sh.spread || 0) / 20,
      });
      comp(T.fxA.tex, sh.blend || (fx === 'shadow' ? 'multiply' : 'screen'), (opacity * sh.opacity) / 100, false);
    }
    const dil = on(st.stroke) ? this.dilate(T, T.layer, Math.max(0.5, st.stroke.size * L * ctx.k)) : null;
    this.r.draw(this.progs.style, T.fxB, {
      uTex: T.layer.tex, uDil: dil ? dil.tex : T.layer.tex, uOutSize: [ctx.W, ctx.H], uScale: [1, 1],
      uFill: fill, uUseStroke: dil ? 1 : 0, uStrokeC: st.stroke?.color || [0, 0, 0], uStrokeA: (st.stroke?.opacity ?? 100) / 100,
      uUseOverlay: on(st.overlay) ? 1 : 0, uOverlayC: st.overlay?.color || [1, 0, 0], uOverlayA: (st.overlay?.opacity ?? 100) / 100,
    });
    comp(T.fxB.tex, layer.blend, opacity, last);
  }

  blurScale(b, ctx) { return { uScale: [ctx.W / b.f / b.w, ctx.H / b.f / b.h] }; }

  /** Two buffers at 1/f of the output size, for big blurs. */
  small(T, f) {
    let s = T.small.get(f);
    if (!s) {
      const w = Math.max(1, Math.ceil(T.W / f)), h = Math.max(1, Math.ceil(T.H / f));
      s = [this.r.target(w, h, this.gl.RGBA8), this.r.target(w, h, this.gl.RGBA8)];
      T.small.set(f, s);
    }
    return s;
  }

  /**
   * src blurred (sigma in output px; mode 0 Gaussian, 1 box, 2 max, 3 min;
   * dir: along one direction only). Big blurs are worked out on a smaller
   * copy. Returns { tex, w, h, f }: sample it at position / output size * blurScale.
   */
  blur(T, src, sigma, mode, dir) {
    const gl = this.gl;
    let f = 1;
    if (mode < 2) while (sigma / f > 12 && f < 32) f *= 2;
    let from = src, pair;
    if (f > 1) {
      // Halving step by step keeps every pixel counted.
      for (let g = 2; g <= f; g *= 2) {
        const [a] = this.small(T, g);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, a.fb);
        gl.blitFramebuffer(0, 0, from.w, from.h, 0, 0, a.w, a.h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
        from = a;
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      pair = this.small(T, f);
    } else pair = [T.fxA, T.fxB];
    let cur = from;
    for (const d of dir ? [dir] : [[1, 0], [0, 1]]) {
      const out = cur === pair[0] ? pair[1] : pair[0];
      this.r.draw(this.progs.blur, out, { uTex: cur.tex, uDir: d, uSize: [out.w, out.h], uSigma: sigma / f, uMode: mode });
      cur = out;
    }
    return { tex: cur.tex, w: cur.w, h: cur.h, f };
  }

  /** src's shape grown by r output px (an octagon, near enough round). */
  dilate(T, src, r) {
    const a = r * (Math.SQRT2 - 1), b = r * (2 - Math.SQRT2) * 0.5;
    const pair = [T.tmp, T.snap];
    let cur = src;
    for (const [d, rr] of [[[1, 0], a], [[0, 1], a], [[1, 1], b], [[1, -1], b]]) {
      const out = cur === pair[0] ? pair[1] : pair[0];
      this.r.draw(this.progs.blur, out, { uTex: cur.tex, uDir: d, uSize: [out.w, out.h], uSigma: Math.max(0.5, rr), uMode: 2 });
      cur = out;
    }
    return { tex: cur.tex, w: cur.w, h: cur.h, f: 1 };
  }

  /** One filter on T.layer. */
  filter(f, T, ctx) {
    const plan = filterPlan(f);
    const L = Math.max(ctx.geo.ow, ctx.geo.oh);
    let b = null;
    if (plan.blur) b = this.blur(T, T.layer, Math.max(0.05, plan.blur * ctx.k), 0);
    else if (plan.box) b = this.blur(T, T.layer, Math.max(0.5, plan.box * ctx.k), 1);
    else if (plan.max || plan.min) b = this.blur(T, T.layer, Math.max(0.5, (plan.max || plan.min) * ctx.k), plan.max ? 2 : 3);
    else if (plan.motion) {
      const [dist, deg] = plan.motion;
      const a = (deg * Math.PI) / 180;
      const p = ap(ctx.ori2out, Math.cos(a), -Math.sin(a)), o = ap(ctx.ori2out, 0, 0);
      const v = [p[0] - o[0], p[1] - o[1]], n = Math.hypot(v[0], v[1]) || 1;
      b = this.blur(T, T.layer, Math.max(0.5, dist * ctx.k * 0.5), 1, [v[0] / n, v[1] / n]);
    }
    const c = f.center || [0.5, 0.5];
    this.r.draw(this.progs.fx, T.tmp, {
      uTex: T.layer.tex, uBlur: b ? b.tex : T.layer.tex, ...(b ? this.blurScale(b, ctx) : { uScale: [1, 1] }), uSel: f.clip ? this.selTex(f.clip, ctx.geo) : T.layer.tex,
      uOutSize: [ctx.W, ctx.H], uOriSize: [ctx.geo.ow, ctx.geo.oh], uOut2Ori: ctx.uOut2Ori, uOri2Out: ctx.uOri2Out,
      uFx: plan.fx, uK: ctx.k, uUseSel: f.clip ? 1 : 0, uSeed: f.seed || 0, uP: [...(plan.p || []), 0, 0, 0, 0].slice(0, 4),
      uFg: f.fg || [0, 0, 0], uBg: f.bg || [1, 1, 1], uCenter: [c[0] * ctx.geo.ow, c[1] * ctx.geo.oh, (f.rad || 0.5) * L],
    });
    [T.layer, T.tmp] = [T.tmp, T.layer];
  }

  hold(W, H, masked, clip) {
    if (this.held?.below.w !== W || this.held?.below.h !== H) {
      this.dropHeld();
      this.held = { below: this.r.target(W, H, this.gl.RGBA8), layer: this.r.target(W, H, this.gl.RGBA8) };
    }
    if (masked && !this.held.mask) this.held.mask = this.r.target(W, H, this.gl.RGBA8);
    if (clip && !this.held.clipA) this.held.clipA = this.r.target(W, H, this.gl.RGBA8);
    return this.held;
  }

  dropHeld() {
    if (!this.held) return;
    for (const t of Object.values(this.held)) if (t?.fb) this.r.free(t);
    this.held = null;
  }

  blit(from, to) {
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.fb);
    gl.blitFramebuffer(0, 0, from.w, from.h, 0, 0, to.w, to.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** Where an op draws on the output (px, y up): [x, y, w, h], or null when off it. */
  outRect(op, ctx, pad) {
    const { geo, W, H, ori2out } = ctx;
    const isLive = op === ctx.live?.op;
    let b = isLive ? undefined : this.bounds.get(op);
    if (b === undefined) {
      b = opBounds(op, geo.ow, geo.oh);
      if (!isLive) this.bounds.set(op, b);
    }
    if (!b) return [0, 0, W, H];
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => ap(ori2out, x, y));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - pad)), x1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0])) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - pad)), y1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1])) + pad));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }

  /** One op onto dst (a layer or mask buffer); acc[cur] is what's under the layer. */
  drawOp(op, T, ctx, dst) {
    const gl = this.gl;
    const { W, H, geo, k } = ctx;
    const stroked = STROKED.has(op.t), region = REGION.has(op.t);
    if (stroked && !op.pts?.length) return;
    const heal = op.t === 'heal' || op.t === 'patch';
    const r = stroked ? op.size * Math.max(geo.ow, geo.oh) * k : 0;
    const rc = this.outRect(op, ctx, heal ? Math.max(6, r * 0.5) : op.t === 'blur' || op.t === 'sharpen' || op.t === 'smudge' ? 4 + r : 0);
    if (!rc) return;
    const scissor = () => { gl.enable(gl.SCISSOR_TEST); gl.scissor(rc[0], rc[1], rc[2], rc[3]); };
    const sel = op.clip ? this.selTex(op.clip, geo) : null;
    // Its coverage: dabs added up (flow builds up within a stroke; opacity caps it), or its selection.
    if (stroked || region) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.cov.fb);
      gl.viewport(0, 0, W, H);
      scissor();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (stroked) {
        const b = this.dabsOf(op, geo, op === ctx.live?.op);
        const p = this.progs.dab;
        gl.useProgram(p.p);
        gl.uniformMatrix3fv(p.loc.uOri2Out, false, ctx.uOri2Out);
        gl.uniform2f(p.loc.uOutSize, W, H);
        gl.uniform1f(p.loc.uScale, k);
        gl.uniform1f(p.loc.uHard, Math.min(0.999, (op.hard ?? 100) / 100));
        gl.uniform1f(p.loc.uFlow, (op.flow ?? 100) / 100);
        gl.uniform1f(p.loc.uAlias, op.alias ? 1 : 0);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, b.n);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
      } else if (sel) {
        this.r.draw(this.progs.covsel, T.cov, { uSel: sel, uOut2Ori: ctx.uOut2Ori, uOriSize: [geo.ow, geo.oh] });
      }
    }
    // Clones and heals: the developed photo, shifted by the source offset, just in this box.
    if (SOURCED.has(op.t)) {
      scissor();
      ctx.base(T.src, { shift: [op.dx * geo.ow, op.dy * geo.oh], op, out2ori: ctx.out2ori });
    }
    const mem = heal ? this.heal(T, rc) : null;
    if (SNAPSHOT.has(op.t)) this.blit(dst, T.snap);
    scissor();
    gl.enable(gl.BLEND);
    if (op.t === 'erase' || op.t === 'clear') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (op.keepAlpha) gl.blendFuncSeparate(gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const strength = (op.strength ?? 50) / 100;
    this.r.draw(this.progs.op, dst, {
      uCov: T.cov.tex, uSrcTex: T.src.tex, uMem: mem ? mem.tex : T.src.tex, uSel: sel || T.src.tex, uSnap: T.snap.tex, uBack: T.acc[this.cur].tex, uImg: T.src.tex,
      uKind: KIND[op.t] ?? 0, uColor: op.color || [0, 0, 0], uOpacity: (op.opacity ?? 100) / 100, uK: k,
      uUseCov: stroked || region ? 1 : 0, uUseSel: sel && !region ? 1 : 0, uOut2Ori: ctx.uOut2Ori, uOriSize: [geo.ow, geo.oh],
      uMemRect: mem ? [rc[0], rc[1], mem.scale] : [0, 0, 1], uMemSize: mem ? [mem.w, mem.h] : [1, 1], uMemCap: [MEM_CAP, MEM_CAP],
      uG: op.t === 'gradient' ? [op.x0 * geo.ow, op.y0 * geo.oh, op.x1 * geo.ow, op.y1 * geo.oh] : [0, 0, 1, 0],
      uGStyle: GRAD[op.style] ?? 0, uC0: op.c0 || [0, 0, 0, 1], uC1: op.c1 || [1, 1, 1, 1],
      uP: [op.range ?? 1, strength, op.protect ? 1 : 0, op.t === 'smudge' ? r * strength * 1.2 : 0],
    });
    gl.disable(gl.BLEND);
  }

  /** The heal's colour correction for box rc: a smooth fill of the difference at its edge. */
  heal(T, rc) {
    const gl = this.gl;
    const { L, F } = this.pyramid();
    const scale = Math.min(1, MEM_CAP / Math.max(rc[2], rc[3]));
    const sizes = [];
    let w = Math.max(1, Math.ceil(rc[2] * scale)), h = Math.max(1, Math.ceil(rc[3] * scale));
    for (let i = 0; i < L.length; i++) { sizes.push([w, h]); if (w === 1 && h === 1) break; w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2)); }
    const n = sizes.length;
    const at = (i) => { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, sizes[i][0], sizes[i][1]); };
    at(0);
    this.r.draw(this.progs.healL0, L[0], { uBack: T.acc[this.cur].tex, uSrcTex: T.src.tex, uCov: T.cov.tex, uMemRect: [rc[0], rc[1], scale] });
    for (let i = 1; i < n; i++) { at(i); this.r.draw(this.progs.pull, L[i], { uTex: L[i - 1].tex, uMax: [sizes[i - 1][0] - 1, sizes[i - 1][1] - 1] }); }
    for (let i = n - 1; i >= 0; i--) {
      at(i);
      const top = i === n - 1;
      // (the top level reads nothing coarser; L[i] just fills the slot)
      this.r.draw(this.progs.push, F[i], top ? { uL: L[i].tex, uUp: L[i].tex, uUpSize: [1, 1], uUpCap: [1, 1], uTop: 1 }
        : { uL: L[i].tex, uUp: F[i + 1].tex, uUpSize: sizes[i + 1], uUpCap: [F[i + 1].w, F[i + 1].h], uTop: 0 });
    }
    return { tex: F[0].tex, scale, w: sizes[0][0], h: sizes[0][1] };
  }
}
