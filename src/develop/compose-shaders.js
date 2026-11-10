// The Retouch layers' GLSL (compose.js draws with them).
import { ADJ_GLSL } from './adjust.js';

export const DAB_VERT = `#version 300 es
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
export const DAB_FRAG = `#version 300 es
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

export const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;
`;

// One op onto a layer (or a layer mask): paint colour, erase, a clone or
// heal's pixels, a fill or gradient, a picture (text, shapes), or a brush
// that works on what's there (dodge, burn, sponge, blur, sharpen, smudge, red eye).
export const OP = `${HEAD}
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
export const COVSEL = `${HEAD}
uniform sampler2D uSel;
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
void main() { float a = texture(uSel, (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy / uOriSize).a; o = vec4(a, 0.5 * a, 0.5 * a, a); }`;

// Inside the photo (a moved copy of it is clear beyond its edges).
export const INSIDE = `${HEAD}
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
void main() { vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy; o = vec4(q.x >= 0.0 && q.y >= 0.0 && q.x <= uOriSize.x && q.y <= uOriSize.y ? 1.0 : 0.0); }`;

// Pixel stretch: just its one-pixel line (in the layer's own coordinates, so
// a transform stretches it).
export const STRETCH = `${HEAD}
uniform mat3 uOut2Ori;
uniform vec4 uS; // column (1) or row (0), the line's middle, where it starts and ends along itself (oriented px)
void main() {
  vec2 q = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  vec2 v = uS.x > 0.5 ? q : q.yx;
  o = vec4(abs(v.x - uS.y) <= 0.5 && v.y >= uS.z && v.y <= uS.w ? 1.0 : 0.0);
}`;

// Heal, first level: the difference between what's there and the source, known
// only outside the stroke (weight 1), averaged over each texel's footprint.
export const HEAL_L0 = `${HEAD}
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

export const PULL = `${HEAD}
uniform sampler2D uTex;
uniform vec2 uMax; // last valid texel of the finer level
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 2;
  ivec2 m = ivec2(uMax);
  o = (texelFetch(uTex, min(b, m), 0) + texelFetch(uTex, min(b + ivec2(1, 0), m), 0)
     + texelFetch(uTex, min(b + ivec2(0, 1), m), 0) + texelFetch(uTex, min(b + ivec2(1, 1), m), 0)) * 0.25;
}`;

// Coarse to fine: known values where there are some, the coarser fill elsewhere.
export const PUSH = `${HEAD}
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
export const ADJ = `${HEAD}
uniform sampler2D uBack;
${ADJ_GLSL}
void main() { o = vec4(adjust(texelFetch(uBack, ivec2(gl_FragCoord.xy), 0).rgb), 1.0); }`;

// Layer styles: shadows and glows (a blurred, shifted copy of the layer's shape
// in one colour), and the layer with its stroke and colour overlay.
export const SHADE = `${HEAD}
uniform sampler2D uTex;
uniform vec2 uOff, uOutSize, uScale;
uniform vec3 uColor;
uniform float uGain;
void main() {
  float a = clamp(texture(uTex, (gl_FragCoord.xy - uOff) / uOutSize * uScale).a * uGain, 0.0, 1.0);
  o = vec4(uColor * a, a);
}`;
// Inner shadows and glows: the layer's edge (where a blurred, shifted copy of
// its shape thins out), coloured, inside the shape only.
export const INNER = `${HEAD}
uniform sampler2D uTex, uBlur;
uniform vec2 uOff, uOutSize, uScale;
uniform vec3 uColor;
uniform float uGain, uOpacity;
void main() {
  float a0 = texelFetch(uTex, ivec2(gl_FragCoord.xy), 0).a;
  float b = texture(uBlur, (gl_FragCoord.xy - uOff) / uOutSize * uScale).a;
  float a = clamp((1.0 - b) * uGain, 0.0, 1.0) * a0 * uOpacity;
  o = vec4(uColor * a, a);
}`;
export const STYLE = `${HEAD}
uniform sampler2D uTex, uDil, uInner;
uniform vec2 uOutSize, uScale, uG0, uG1;
uniform float uFill, uUseStroke, uUseOverlay, uOverlayA, uStrokeA, uUseInner, uUseGrad, uGradA, uGradRadial;
uniform vec3 uStrokeC, uOverlayC, uGC0, uGC1;
void main() {
  vec4 c0 = texelFetch(uTex, ivec2(gl_FragCoord.xy), 0), c = c0;
  if (uUseInner > 0.5) { vec4 i = texelFetch(uInner, ivec2(gl_FragCoord.xy), 0); c.rgb = i.rgb + c.rgb * (1.0 - i.a / max(c.a, 1e-5)); }
  if (uUseGrad > 0.5) {
    vec2 d = uG1 - uG0, p = gl_FragCoord.xy - uG0;
    float g = clamp(uGradRadial > 0.5 ? length(p) / max(length(d), 1e-3) : dot(p, d) / max(dot(d, d), 1e-3), 0.0, 1.0);
    c.rgb = mix(c.rgb, mix(uGC0, uGC1, g) * c.a, uGradA);
  }
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
export const CLIPA = `${HEAD}
uniform sampler2D uTex, uMask;
uniform float uUseMask, uDensity, uOpacity;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  float m = uUseMask > 0.5 ? 1.0 - uDensity * (1.0 - texelFetch(uMask, ip, 0).r) : 1.0;
  o = vec4(texelFetch(uTex, ip, 0).a * m * uOpacity);
}`;

// A layer onto what's below it, with its blend mode, opacity, mask and clipping
// (W3C / Photoshop formulas). Modes in retouch.js BLEND_MODES order.
export const COMP = `${HEAD}
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
