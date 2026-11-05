// GLSL for the Develop tab. Every slider is a uniform, so moving one only
// redraws: the RAW data is already on the graphics card.

export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const COMMON = `#version 300 es
precision highp float;
precision highp sampler2D;
const vec3 W709 = vec3(0.2126, 0.7152, 0.0722);
uniform vec3 uWB;
uniform mat3 uCam;
// Camera RGB (sensor white = 1) -> linear sRGB. Where the sensor clips, one
// channel (usually green) stops while the others keep rising, which tints
// bright skies and white clothes pink; as any channel nears clipping the
// colour eases to neutral white, as raw converters' highlight handling does.
vec3 toLinear(vec3 cam) {
  vec3 c = max(cam, vec3(0.0));
  vec3 bal = min(c * uWB, vec3(1.0));
  float clip = smoothstep(0.88, 0.97, max(c.r, max(c.g, c.b)));
  bal = mix(bal, vec3(max(bal.r, max(bal.g, bal.b))), clip);
  return uCam * bal;
}
`;

// Small, blurred copy of the photo's brightness (log2) and haze (darkest
// channel), used by highlights, shadows, clarity and dehaze. Each output pixel
// averages a 4x4 grid of bilinear taps covering its whole footprint.
export const GUIDE_DOWN = `${COMMON}
uniform sampler2D uSrc;
uniform vec2 uOutSize;
out vec4 o;
void main() {
  vec2 cell = 1.0 / uOutSize;
  vec2 base = (gl_FragCoord.xy - 0.5) * cell;
  float lsum = 0.0, hsum = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 uv = base + (vec2(float(i), float(j)) + 0.5) * cell / 4.0;
    vec3 lin = toLinear(texture(uSrc, uv).rgb);
    lsum += log2(max(dot(lin, W709), 1e-5));
    hsum += max(min(min(lin.r, lin.g), lin.b), 0.0);
  }
  o = vec4(lsum / 16.0, hsum / 16.0, 0.0, 1.0);
}`;

export const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uStep;   // one texel along the blur direction
uniform float uSigma; // in texels
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * 0.0;
  ivec2 size = textureSize(uTex, 0);
  uv = gl_FragCoord.xy / vec2(size);
  vec4 sum = vec4(0.0); float wsum = 0.0;
  int r = int(ceil(uSigma * 2.5));
  for (int i = -40; i <= 40; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-float(i * i) / (2.0 * uSigma * uSigma));
    sum += texture(uTex, uv + uStep * float(i)) * w;
    wsum += w;
  }
  o = sum / wsum;
}`;

// Glow (Effects), as in Lightroom 16: light spilling out of the bright parts
// of the photo. Built small, in photo coordinates, once per change of its
// settings or the exposure (renderer.js updateGlow): the light above the
// Range threshold is taken from the photo (GLOW_SRC), halved again and again
// (GLOW_DOWN), each size blurred (BLUR, along Direction for Motion and
// Streak), and the sizes mixed by Spread and coloured by Warmth (GLOW_MIX).
// FINAL adds the result where the photo is still scene light.
export const GLOW_SRC = `${COMMON}
uniform sampler2D uSrc;
uniform vec2 uOutSize;
uniform float uGlowGain;  // the exposure, as a factor
uniform vec2 uGlowKnee;   // threshold (stops over middle grey) and its softness
uniform float uGlowSat;   // the glow's colour: 0 grey, 1 the photo's, more for richer
out vec4 o;
void main() {
  vec2 cell = 1.0 / uOutSize;
  vec2 base = (gl_FragCoord.xy - 0.5) * cell;
  vec3 sum = vec3(0.0);
  for (int j = 0; j < 6; j++) for (int i = 0; i < 6; i++) {
    vec2 uv = base + (vec2(float(i), float(j)) + 0.5) * cell / 6.0;
    vec3 lin = min(max(toLinear(texture(uSrc, uv).rgb), vec3(0.0)) * uGlowGain, vec3(16.0));
    float y = max(dot(lin, W709), 1e-6);
    sum += lin * smoothstep(uGlowKnee.x - uGlowKnee.y, uGlowKnee.x + uGlowKnee.y, log2(y / 0.18));
  }
  vec3 c = sum / 36.0;
  float y = dot(c, W709);
  o = vec4(max(vec3(y) + (c - y) * uGlowSat, vec3(0.0)), 1.0);
}`;

export const GLOW_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uOutSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec2 px = 0.5 / vec2(textureSize(uTex, 0));
  o = 0.25 * (texture(uTex, uv + vec2(-px.x, -px.y)) + texture(uTex, uv + vec2(px.x, -px.y))
    + texture(uTex, uv + vec2(-px.x, px.y)) + texture(uTex, uv + vec2(px.x, px.y)));
}`;

export const GLOW_MIX = `#version 300 es
precision highp float;
uniform sampler2D uG0, uG1, uG2, uG3, uG4;
uniform vec4 uGlowW;    // how much of each size (finest first; the fifth is uGlowW4)
uniform float uGlowW4;
uniform float uGlowHalo; // Halation: the finest size taken back out, so the glow rings the light
uniform vec3 uGlowTint;
uniform vec2 uOutSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec3 f = texture(uG0, uv).rgb;
  vec3 g = uGlowW.x * f + uGlowW.y * texture(uG1, uv).rgb + uGlowW.z * texture(uG2, uv).rgb
    + uGlowW.w * texture(uG3, uv).rgb + uGlowW4 * texture(uG4, uv).rgb;
  g = max(g - uGlowHalo * f, vec3(0.0));
  o = vec4(g * uGlowTint, 1.0);
}`;

export const FINAL = `${COMMON}
uniform sampler2D uSrc;   // whole photo (overview)
uniform sampler2D uHi;    // a sharper part of it, when zoomed or exporting
uniform vec4 uHiRect;     // where uHi sits, in photo coordinates (0-1); w = 0 when unused
uniform vec4 uHiSafe;     // the part of uHiRect that is safe to use
uniform sampler2D uGuide;
uniform sampler2D uGlow;   // the glow (GLOW_MIX), in photo coordinates
uniform vec4 uGlowMix;    // amount, how much it stands in for the photo, how much it adds, on
uniform sampler2D uCurve;
uniform sampler2D uHue;
uniform mat3 uOut2Ori;    // output pixel -> oriented pixel of the transformed photo
uniform mat3 uOri2Photo;  // oriented pixel -> photo coordinates (sensor orientation, 0-1)
uniform mat3 uOut2Crop;   // output pixel -> crop frame (-1..1)
uniform vec2 uOriCenter;  // centre and half the long edge of the oriented photo, px
uniform float uOriHalf;
uniform float uCornerR2;  // squared distance to a corner, in those units
uniform mat3 uPersp;      // Transform panel: output -> source, centred units
uniform float uDistort;
uniform vec4 uLensK;     // the camera's lens correction (renderer.js lensFor): rho^2, ^4, ^6 terms and 1 / (1 + q)
uniform vec2 uLensC, uLensN; // its optical centre (photo 0-1) and photo size / half diagonal
uniform float uLensVig, uLensVigMid;
uniform float uDefringeP, uDefringeG;
uniform float uShadowTint;
uniform vec2 uPhotoPx;    // 1 / photo size in full-resolution pixels
uniform mat3 uOut2Vig;    // output pixel -> the crop (-1..1), for the vignette: in crop mode the stage shows the whole photo
uniform float uCropAspect;
uniform vec3 uBg;
uniform float uExposure;
uniform float uContrast;
uniform float uContrastSat; // the Contrast slider (-1..1), for the colour it changes
// Contrast changes colour too, as in Lightroom, weak colours most (fitted on
// Lightroom's exports of JWL_7451, tools/lr-tone.md).
const float CS_K = 0.25, CS_V = 0.1;
const float CON_K = 1.0, CON_PIVOT = 0.6, CON_LUM = 0.6;
// An S-curve of strength k around CON_PIVOT (screen values 0-1).
float conCurve(float x, float k) {
  float p = CON_PIVOT;
  float t = clamp(x < p ? 0.5 * x / p : 0.5 + 0.5 * (x - p) / (1.0 - p), 0.0, 1.0);
  t += k * (t * t * (3.0 - 2.0 * t) - t);
  return t < 0.5 ? 2.0 * p * t : p + (t - 0.5) * 2.0 * (1.0 - p);
}
uniform float uToneMap;   // 0: standard shoulder, 1: sigmoid, 2: AgX, 3: filmic RGB
uniform vec4 uTmA;        // tone mapper parameters A (precomputed in tonemap.js)
uniform vec4 uTmB;        // tone mapper parameters B (filmic spline nodes)
uniform float uTmHue;     // hue preservation factor (0..1)
uniform float uHighlights, uShadows, uWhites, uBlacks;
uniform float uHlTop; // how much Highlights eases off on the brightest tones (renderer.js adaptive)
// Basic tone slider shapes (fitted to Lightroom; tools/lr-tone.md).
const float HL_K = 1.3, HL_LO = 0.35, HL_T0 = 0.65, HL_T1 = 0.85, SH_K = 1.3, SH_HI = 0.65, SH_DEEP = 0.8, SH_C = 0.3, HL_X = 0.5, SH_X = 0.2, LIFT_EDGE = 1.0, LIFT_R = 4.0;
const float CON_LOCAL = 0.45, WB_LOCAL = 0.45, WH_NEG = 0.24, WH_POS = 0.3, BL_NEG = 1.4, BL_POS = 0.55, BL_N = 2.36, BL_LIFT = 0.035, LIFT_GREY = 0.9;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform float uAirY;
uniform float uSharpen, uSharpenRadius, uSharpenDetail, uSharpenMasking;
uniform float uNrLum, uNrColor, uNrLumDetail, uNrLumContrast, uNrColorDetail, uNrColorSmooth;
uniform float uVignette, uVigMid, uVigRound, uVigFeather, uVigStyle, uVigHighlights;
uniform float uRefineSat;
uniform float uBW;
uniform vec3 uGradeS, uGradeM, uGradeH, uGradeG; // each region's tint, scaled by its amount (luts.js gradeTints)
uniform vec4 uGradeLum;   // shadows, midtones, highlights, global
uniform vec2 uGradeShape; // blending, balance
uniform float uGradeOn;
uniform vec3 uGrain;      // amount, cell size (oriented px), roughness
uniform float uShowClip;
uniform float uMelissa; // 1: the histogram's render, counted in Lightroom's Melissa RGB
// Masks (masks.js): up to 16 greyscale images, one per channel of four
// textures, and each mask's local sliders.
uniform vec2 uOriSize;
uniform sampler2D uMask0, uMask1, uMask2, uMask3;
uniform float uMaskN;
uniform vec4 uMA[16]; // exposure, contrast, highlights, shadows
uniform vec4 uMB[16]; // whites, blacks, texture, clarity
uniform vec4 uMC[16]; // dehaze, saturation, temp, tint
uniform vec4 uMD[16]; // hue, sharpness, noise, amount
uniform vec4 uMR[16]; // luminance range: low, high, smoothness, flags (1 = range on, 2 = inverted)
uniform vec4 uME[16]; // grain amount, size x amount, roughness x amount, moire
uniform vec4 uMF[16]; // defringe, colour tint (rgb, no brightness)
uniform vec4 uMP[16]; // point colour: hue (degrees), saturation, brightness, on
uniform vec4 uMQ[16]; // point colour shifts: hue (degrees), saturation, luminance; range
uniform vec4 uMS[16]; // point colour softness, own curve on, its refine saturation, glow
uniform sampler2D uMaskCurve; // each mask's curve, a row each (as uCurve)
// Lightroom's camera profile (adobe.js), when it renders: its hue/sat map, its
// look table and a look's (Adobe Color), and its tone curve. Dims: hue, sat
// and value divisions, and 1 if sRGB-encoded; no hue divisions means none.
uniform float uDcp;
uniform float uBaseSat; // the base rendering's saturation, on scene light (1: none)
uniform sampler2D uHsm, uLookA, uLookB, uTone;
uniform vec4 uHsmDims, uLookADims, uLookBDims;
uniform mat3 uS2P, uP2S; // linear sRGB <-> linear ProPhoto, as Adobe's DNG SDK has them
uniform float uPointView; // the mask whose point colour range is shown (-1: none)
uniform float uMaskView;   // the mask shown on top (-1: none)
uniform vec3 uMaskColor;
uniform float uMaskOpacity, uMaskStyle, uMaskLine, uMaskFeather;
out vec4 o;

vec3 cam(vec2 p) {
  if (uHiRect.z > 0.0 && p.x >= uHiSafe.x && p.y >= uHiSafe.y && p.x <= uHiSafe.x + uHiSafe.z && p.y <= uHiSafe.y + uHiSafe.w)
    return texture(uHi, (p - uHiRect.xy) / uHiRect.zw).rgb;
  return texture(uSrc, p).rgb;
}
float logLum(vec2 p) { return log2(max(dot(toLinear(cam(p)), W709), 1e-5)); }

// Average log brightness on a ring of 8 points, r full-size pixels away.
float ring(vec2 p, float r) {
  vec2 d = uPhotoPx * r;
  float s = 0.0;
  s += logLum(p + vec2(d.x, 0.0)) + logLum(p - vec2(d.x, 0.0));
  s += logLum(p + vec2(0.0, d.y)) + logLum(p - vec2(0.0, d.y));
  vec2 e = d * 0.7071;
  s += logLum(p + e) + logLum(p - e) + logLum(p + vec2(e.x, -e.y)) + logLum(p + vec2(-e.x, e.y));
  return s / 8.0;
}

// Scene light -> screen: a soft shoulder so highlights roll off instead of clipping.
vec3 shoulder(vec3 x) {
  const float k = 0.72;
  vec3 over = k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k)));
  return mix(x, over, step(k, x));
}
float shoulder1(float x) { return shoulder(vec3(x)).r; }
const float CHROMA_FLOOR = 0.004;
vec3 chroma(vec3 c) { float y = dot(c, W709); return (c - y) / max(y, CHROMA_FLOOR); }
vec3 encode(vec3 x) {
  return mix(x * 12.92, 1.055 * pow(max(x, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, x));
}

// 1. Sigmoid: modified log-logistic curve around middle gray (0.18), per-channel
// with optional order-preserving hue restoration.
float sigmoid1(float x, float pf, float pp, float k) {
  if (x <= 0.0) return 0.0;
  const float g = 0.18;
  if (x <= g) {
    float u = pow(x / g, pf);
    return pow(u / (u + k), pp);
  }
  float w = pow(g / x, pf);
  return pow(1.0 / (1.0 + k * w), pp);
}
vec3 sigmoidMap(vec3 x) {
  float pf = uTmA.x, pp = uTmA.y, k = uTmA.z, ph = uTmA.w;
  vec3 c0 = max(x, vec3(0.0));
  vec3 c = vec3(sigmoid1(c0.r, pf, pp, k), sigmoid1(c0.g, pf, pp, k), sigmoid1(c0.b, pf, pp, k));
  if (ph > 0.0) {
    float mx0 = max(c0.r, max(c0.g, c0.b)), mn0 = min(c0.r, min(c0.g, c0.b));
    float mx1 = max(c.r, max(c.g, c.b)), mn1 = min(c.r, min(c.g, c.b));
    if (mx0 - mn0 > 1e-6 && mx1 - mn1 > 1e-6) {
      vec3 h = mn1 + clamp((c0 - mn0) / (mx0 - mn0), 0.0, 1.0) * (mx1 - mn1);
      c = mix(c, h, ph);
    }
  }
  return clamp(c, 0.0, 1.0);
}

// 2. AgX (Troy Sobotka's, as in darktable and Blender): wide-gamut inset matrix,
// open-domain log2 transform, polynomial S-curve, outset, and highlight roll-off.
vec3 agxMap(vec3 x) {
  const mat3 inset = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                          0.0784335999999992, 0.878468636469772, 0.0784336,
                          0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outset = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                           -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                           -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float lo = -12.47393, hi = 4.026069, mid = 0.6060606;
  vec3 v = clamp((log2(max(inset * max(x, vec3(0.0)), vec3(1e-10))) - lo) / (hi - lo), 0.0, 1.0);
  v = clamp(mid + (v - mid) * uTmA.x, 0.0, 1.0);
  vec3 v2 = v * v, v4 = v2 * v2;
  v = 15.5 * v4 * v2 - 40.14 * v4 * v + 31.96 * v4 - 6.868 * v2 * v + 0.4298 * v2 + 0.1191 * v - 0.00232;
  vec3 lin = max(outset * pow(max(v, vec3(0.0)), vec3(2.2)), vec3(0.0));
  float y = dot(lin, W709);
  float roll = smoothstep(0.5, 1.0, y) * uTmA.z;
  float sat = uTmA.y * (1.0 - roll);
  return clamp(y + (lin - y) * sat, 0.0, 1.0);
}

// 3. Filmic RGB: parametric C1 spline over [blackEv, whiteEv] relative to
// middle gray (0.18) with norm-based hue preservation.
float filmic1(float x) {
  if (x <= 0.0) return 0.0;
  float ev = log2(max(x, 1e-10) / 0.18);
  float t = clamp((ev - uTmA.x) * uTmA.y, 0.0, 1.0);
  float s = uTmA.w;
  float t1 = uTmB.x, y1 = uTmB.y, t2 = uTmB.z, y2 = uTmB.w;
  if (t < t1) {
    float u = t / max(t1, 1e-6), m1 = s * t1;
    return u * u * ((3.0 * y1 - m1) + (m1 - 2.0 * y1) * u);
  }
  if (t <= t2) return y1 + s * (t - t1);
  float v = (1.0 - t) / max(1.0 - t2, 1e-6), d2 = 1.0 - y2, m2 = s * (1.0 - t2);
  return 1.0 - v * v * ((3.0 * d2 - m2) + (m2 - 2.0 * d2) * v);
}
vec3 filmicMap(vec3 x) {
  vec3 c = max(x, vec3(0.0));
  float yIn = dot(c, W709);
  if (yIn <= 1e-10) return vec3(0.0);
  float yOut = filmic1(yIn);
  float ev = log2(yIn / 0.18);
  float t = clamp((ev - uTmA.x) * uTmA.y, 0.0, 1.0);
  float sh = smoothstep(uTmB.z, 1.0, t);
  float lat = 1.0 - sh * sh * 0.65;
  vec3 d = (c - yIn) * (yOut / yIn) * lat;
  vec3 h = yOut + d;
  float mx = max(h.r, max(h.g, h.b));
  if (mx > 1.0) d *= (1.0 - yOut) / max(mx - yOut, 1e-6);
  float mn = min(yOut + d.r, min(yOut + d.g, yOut + d.b));
  if (mn < 0.0) d *= yOut / max(yOut - mn, 1e-6);
  vec3 normRgb = clamp(yOut + d, 0.0, 1.0);
  if (uTmHue >= 0.999) return normRgb;
  vec3 perCh = vec3(filmic1(c.r), filmic1(c.g), filmic1(c.b));
  return clamp(mix(perCh, normRgb, uTmHue), 0.0, 1.0);
}

vec3 decodeS(vec3 v) { return mix(v / 12.92, pow((max(v, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, v)); }
// Linear sRGB <-> linear ProPhoto (D50, Bradford), columns.
const mat3 SRGB_TO_PP = mat3(0.529346, 0.098374, 0.016883, 0.330073, 0.873461, 0.117672, 0.140581, 0.028165, 0.865444);
const mat3 PP_TO_SRGB = mat3(2.034076, -0.228813, -0.00857, -0.727334, 1.23173, -0.153287, -0.306742, -0.002917, 1.161856);

// Colours outside sRGB (a channel below 0) pulled in smoothly, keeping hue,
// as ACES's gamut compression does: each channel's distance from the
// brightest one is eased from 0.8 on, so 1.3 lands on the edge.
vec3 gamutIn(vec3 d) {
  vec3 lin = decodeS(d);
  float ach = max(lin.r, max(lin.g, lin.b));
  if (ach > 0.0) {
    const float thr = 0.95, lim = 1.3, pw = 1.2;
    float sc = (lim - thr) / pow(pow((1.0 - thr) / (lim - thr), -pw) - 1.0, 1.0 / pw);
    vec3 dist = (ach - lin) / ach;
    vec3 over = max(dist - thr, 0.0) / sc;
    vec3 cd = mix(dist, thr + sc * over / pow(1.0 + pow(over, vec3(pw)), vec3(1.0 / pw)), step(thr, dist));
    lin = ach - cd * ach;
  }
  return clamp(encode(clamp(lin, 0.0, 1.0)), 0.0, 1.0);
}
// Display colour <-> OKLab (sRGB curve, signed so colours past the gamut edge
// keep going), for colour grading.
const float MIX_HUE = 37.97, MIX_SAT_UP = 0.211, MIX_SAT_DOWN = 0.692, MIX_LUM_UP = 0.929, MIX_LUM_DOWN = 0.834, MIX_LUM_SAT = 0.127, MIX_S = 0.0615;
const float GRADE_C = 0.6302, GRADE_OFF = 0.1036, GRADE_W = 0.1369, GRADE_P = 0.4672;
vec3 srgbToLin(vec3 c) {
  vec3 a = abs(c);
  return sign(c) * mix(pow((a + 0.055) / 1.055, vec3(2.4)), a / 12.92, step(a, vec3(0.04045)));
}
vec3 linToSrgb(vec3 c) {
  vec3 a = abs(c);
  return sign(c) * mix(1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, a * 12.92, step(a, vec3(0.0031308)));
}
vec3 toOklab(vec3 c) {
  vec3 l = srgbToLin(c) * mat3(0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005);
  l = sign(l) * pow(abs(l), vec3(1.0 / 3.0));
  return l * mat3(0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099, 0.0259040371, 0.7827717662, -0.808675766);
}
vec3 fromOklab(vec3 o) {
  vec3 l = o * mat3(1.0, 0.3963377774, 0.2158037573, 1.0, -0.1055613458, -0.0638541728, 1.0, -0.0894841775, -1.291485548);
  l = l * l * l;
  return linToSrgb(l * mat3(4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011, -0.3413193965, -0.0041960863, -0.7034186147, 1.707614701));
}

vec3 hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn;
  float h = 0.0;
  if (d > 1e-5) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
  }
  return vec3(h * 60.0, mx > 0.0 ? d / mx : 0.0, mx);
}
vec3 rotateHue(vec3 c, float deg) {
  float a = radians(deg), s = sin(a), co = cos(a);
  vec3 k = vec3(0.57735);
  float m = (c.r + c.g + c.b) / 3.0;
  vec3 v = c - m;
  return m + v * co + cross(k, v) * s;
}

// Adobe's DNG SDK steps (dng_reference.cpp), on linear ProPhoto RGB.
vec3 rgbToHsv6(vec3 c) {
  float v = max(c.r, max(c.g, c.b)), gap = v - min(c.r, min(c.g, c.b));
  if (gap <= 0.0) return vec3(0.0, 0.0, v);
  float h = c.r == v ? (c.g - c.b) / gap : c.g == v ? 2.0 + (c.b - c.r) / gap : 4.0 + (c.r - c.g) / gap;
  if (h < 0.0) h += 6.0;
  return vec3(h, gap / v, v);
}
vec3 hsv6ToRgb(vec3 c) {
  float h = mod(c.x, 6.0), s = c.y, v = c.z;
  if (s <= 0.0) return vec3(v);
  float i = floor(h), f = h - i;
  float p = v * (1.0 - s), q = v * (1.0 - s * f), t = v * (1.0 - s * (1.0 - f));
  if (i < 1.0) return vec3(v, t, p);
  if (i < 2.0) return vec3(q, v, p);
  if (i < 3.0) return vec3(p, v, t);
  if (i < 4.0) return vec3(p, q, v);
  if (i < 5.0) return vec3(t, p, v);
  return vec3(v, p, q);
}
float encS1(float x) { return x <= 0.0031308 ? x * 12.92 : 1.055 * pow(x, 1.0 / 2.4) - 0.055; }
float decS1(float x) { return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4); }
vec3 hsmAt(sampler2D t, int hues, int v, int h, int s) { return texelFetch(t, ivec2(s, v * hues + h), 0).rgb; }
// RefBaselineHueSatMap: hue shift (degrees), saturation and value scale, by hue, saturation and value.
vec3 hueSatMap(sampler2D t, vec4 dims, vec3 rgb) {
  int hues = int(dims.x), sats = int(dims.y), vals = int(dims.z);
  vec3 c = rgbToHsv6(rgb);
  bool enc = dims.w > 0.5 && c.z <= 1.0;
  float ve = enc ? encS1(c.z) : c.z;
  float hS = hues < 2 ? 0.0 : c.x * float(hues) / 6.0, sS = c.y * float(sats - 1);
  int h0 = int(hS), h1 = h0 + 1, s0 = min(int(sS), sats - 2);
  if (h0 >= hues - 1) { h0 = hues - 1; h1 = 0; }
  float hf = hS - float(h0), sf = sS - float(s0);
  vec3 d;
  if (vals < 2) {
    d = mix(mix(hsmAt(t, hues, 0, h0, s0), hsmAt(t, hues, 0, h1, s0), hf), mix(hsmAt(t, hues, 0, h0, s0 + 1), hsmAt(t, hues, 0, h1, s0 + 1), hf), sf);
  } else {
    float vS = clamp(ve, 0.0, 1.0) * float(vals - 1);
    int v0 = min(int(vS), vals - 2);
    float vf = vS - float(v0);
    vec3 a = mix(mix(hsmAt(t, hues, v0, h0, s0), hsmAt(t, hues, v0, h1, s0), hf), mix(hsmAt(t, hues, v0, h0, s0 + 1), hsmAt(t, hues, v0, h1, s0 + 1), hf), sf);
    vec3 b = mix(mix(hsmAt(t, hues, v0 + 1, h0, s0), hsmAt(t, hues, v0 + 1, h1, s0), hf), mix(hsmAt(t, hues, v0 + 1, h0, s0 + 1), hsmAt(t, hues, v0 + 1, h1, s0 + 1), hf), sf);
    d = mix(a, b, vf);
  }
  c.x += d.x * (6.0 / 360.0);
  c.y = min(c.y * d.y, 1.0);
  ve *= d.z;
  if (c.z <= 1.0) ve = clamp(ve, 0.0, 1.0);
  c.z = enc ? decS1(ve) : ve;
  return hsv6ToRgb(c);
}
float toneAt(float x) {
  int n = textureSize(uTone, 0).x;
  float p = clamp(x, 0.0, 1.0) * float(n - 1);
  int i = min(int(p), n - 2);
  return mix(texelFetch(uTone, ivec2(i, 0), 0).r, texelFetch(uTone, ivec2(i + 1, 0), 0).r, p - float(i));
}
// RefBaselineRGBTone: the curve on the brightest and darkest channels; the
// middle one keeps its place between them, so hues stay.
vec3 rgbTone(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float tmx = toneAt(mx), tmn = toneAt(mn);
  if (mx - mn <= 0.0) return vec3(tmx);
  return tmn + (tmx - tmn) * (c - mn) / (mx - mn);
}
// Light past white (which the SDK clips) eased in over the last 5%.
vec3 easeWhite(vec3 x) {
  const float k = 0.95;
  return mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
}
// Where light y sits from shadow to highlight, for weighting Highlights,
// Shadows, Clarity and masks' luminance ranges: how bright it comes out with
// the profile's tone curve (measured against Lightroom's export of JWL_7451,
// tools/lr-tone.md), else the standard shoulder.
float disp(float y) {
  y = max(y, 0.0);
  return uDcp > 0.5 && uToneMap < 0.5 ? encS1(toneAt(y)) : encode(vec3(shoulder1(y))).r;
}

// Colours outside the screen's range brought in by desaturating them, keeping
// brightness; noise below black (brightness at or under 0) is black, not its
// leftover positive channels, which showed as purple speckle in high-ISO shadows.
vec3 intoRange(vec3 lin) {
  float y = dot(lin, W709);
  float mn = min(lin.r, min(lin.g, lin.b));
  if (mn < 0.0) lin = y > 0.0 ? y + (lin - y) * (y / (y - mn + 1e-6)) : vec3(0.0);
  return max(lin, vec3(0.0));
}

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}

void main() {
  // Outside the crop (zoomed in and panned past its edge): background.
  vec2 cq = (uOut2Crop * vec3(gl_FragCoord.xy, 1.0)).xy;
  if (abs(cq.x) > 1.001 || abs(cq.y) > 1.001) { o = vec4(uBg, 1.0); return; }
  vec2 ori = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  // Transform (perspective), then the lens: from the finished photo back to the sensor.
  vec2 n = (ori - uOriCenter) / uOriHalf;
  vec3 hn = uPersp * vec3(n, 1.0);
  n = hn.xy / hn.z;
  float r2 = dot(n, n) / uCornerR2;
  n *= 1.0 - uDistort * r2;
  vec2 p = (uOri2Photo * vec3(n * uOriHalf + uOriCenter, 1.0)).xy;
  vec2 lv = (p - uLensC) * uLensN;
  float lr2 = dot(lv, lv);
  p = uLensC + (p - uLensC) * (1.0 + lr2 * (uLensK.x + lr2 * (uLensK.y + lr2 * uLensK.z))) * uLensK.w;
  if (hn.z <= 0.0 || p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { o = vec4(uBg, 1.0); return; }

  vec3 lin = toLinear(cam(p));
  vec3 lin0 = lin;

  // How much each mask covers this pixel, and their sliders added up.
  vec4 LA = vec4(0.0), LB = vec4(0.0), LC = vec4(0.0), LD = vec4(0.0), LE = vec4(0.0), LF = vec4(0.0);
  float LG = 0.0; // the masks' Glow
  float mw[16];
  for (int i = 0; i < 16; i++) mw[i] = 0.0;
  float shownW = 0.0;
  if (uMaskN > 0.0) {
    vec2 muv = ori / uOriSize;
    vec4 m0 = texture(uMask0, muv);
    vec4 m1 = uMaskN > 4.0 ? texture(uMask1, muv) : vec4(0.0);
    vec4 m2 = uMaskN > 8.0 ? texture(uMask2, muv) : vec4(0.0);
    vec4 m3 = uMaskN > 12.0 ? texture(uMask3, muv) : vec4(0.0);
    float yl = disp(dot(lin0, W709) * exp2(uExposure));
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uMaskN) break;
      float w = i < 4 ? m0[i] : i < 8 ? m1[i - 4] : i < 12 ? m2[i - 8] : m3[i - 12];
      vec4 r = uMR[i];
      if (mod(r.w, 2.0) >= 1.0) {
        float sm = max(r.z * 0.5, 0.004);
        w *= smoothstep(r.x - sm, r.x, yl) * (1.0 - smoothstep(r.y, r.y + sm, yl));
      }
      if (r.w >= 2.0) w = 1.0 - w;
      if (float(i) == uMaskView) shownW = w;
      w *= uMD[i].w;
      mw[i] = w;
      LG += uMS[i].w * w;
      LA += uMA[i] * w; LB += uMB[i] * w; LC += uMC[i] * w; LD += uMD[i] * w; LE += uME[i] * w; LF += uMF[i] * w;
    }
  }
  float nrLum = clamp(uNrLum + LD.z, 0.0, 1.0);
  float nrColor = clamp(uNrColor + LE.w, 0.0, 1.0); // a mask's Moire Reduction smooths colour too
  float exposure = uExposure + LA.x;
  float highlights = uHighlights + LA.z, shadows = uShadows + LA.w;
  float whites = uWhites + LB.x, blacks = uBlacks + LB.y;
  float texAmt = uTexture + LB.z, clarity = uClarity + LB.w;
  float dehaze = clamp(uDehaze + LC.x, -1.0, 1.0);
  float sharpen = uSharpen + LD.y * 1.1;

  // Noise reduction: average with neighbours that are alike (luminance), and
  // smooth colour over a wider area (colour).
  if (nrLum > 0.0 || nrColor > 0.0) {
    float y0 = max(dot(lin, W709), 1e-5);
    vec3 lsum = lin; float lw = 1.0;
    // Colour as an offset from grey relative to brightness, but never divided by
    // less than CHROMA_FLOOR: in near-black noise brightness is about 0 (or below),
    // and dividing by it turned the noise into bright purple and blue speckles.
    vec3 csum = chroma(lin); float cw = 1.0;
    float sigma = (0.02 + nrLum * 0.25) * (1.5 - uNrLumDetail);
    float cr = 4.0 * (1.5 - uNrColorDetail);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 dir = vec2(cos(a), sin(a));
      vec3 n1 = toLinear(cam(p + dir * uPhotoPx * 1.5));
      float y1 = max(dot(n1, W709), 1e-5);
      float d = log2(y1) - log2(y0);
      float w = exp(-d * d / (2.0 * sigma * sigma)) * nrLum;
      lsum += n1 * w; lw += w;
      if (nrColor > 0.0) {
        vec3 n2 = toLinear(cam(p + dir * uPhotoPx * cr));
        csum += chroma(n2) * nrColor; cw += nrColor;
        if (uNrColorSmooth > 0.0) {
          vec3 n3 = toLinear(cam(p + dir * uPhotoPx * cr * 2.5));
          csum += chroma(n3) * nrColor * uNrColorSmooth; cw += nrColor * uNrColorSmooth;
        }
      }
    }
    lin = lsum / lw;
    // Contrast brings back some of the local contrast the smoothing took.
    if (uNrLumContrast > 0.0) lin *= exp2((log2(y0) - log2(max(dot(lin, W709), 1e-5))) * uNrLumContrast * 0.6);
    if (nrColor > 0.0) { float yl = dot(lin, W709); lin = yl + (csum / cw) * max(yl, CHROMA_FLOOR); }
  }

  // Lightroom's profile: its hue/saturation map, before exposure.
  if (uDcp > 0.5 && uHsmDims.x > 0.0) lin = uP2S * hueSatMap(uHsm, uHsmDims, max(uS2P * lin, vec3(0.0)));
  // Lightroom's base saturation belongs to the rendering, before the sliders
  // and curves (a steep curve then strengthens it as it does in Lightroom).
  if (uBaseSat != 1.0) { float yb = dot(lin, W709); lin = yb + (lin - yb) * uBaseSat; }

  // Lens vignetting (positive brightens the corners) and calibration's shadow tint.
  if (uLensVig != 0.0) {
    float w = smoothstep(uLensVigMid * 0.6, 1.0, sqrt(r2));
    lin *= exp2(uLensVig * 1.6 * w * w);
  }
  if (uShadowTint != 0.0) {
    float w = 1.0 - smoothstep(0.0, 0.2, dot(lin, W709));
    lin.g *= 1.0 - uShadowTint * 0.18 * w;
  }
  // A mask's Temp and Tint: warmer / cooler and magenta / green, same brightness.
  if (LC.z != 0.0 || LC.w != 0.0) {
    float yb = dot(lin, W709);
    lin *= exp2(vec3(LC.z * 0.45, -LC.w * 0.35, -LC.z * 0.45));
    // Brightness is put back, but never by dividing by less than CHROMA_FLOOR:
    // in near-black noise it is about 0 (or below) before or after, and the
    // ratio of the two blew single pixels up into teal speckles and rings.
    lin *= max(yb, CHROMA_FLOOR) / max(dot(lin, W709), CHROMA_FLOOR);
  }

  float y0 = max(dot(lin, W709), 1e-5);
  float l0 = log2(y0);
  vec2 g = texture(uGuide, p).rg;
  // The blurred base, pulled toward this pixel across edges: from about a
  // third of a stop of difference on, so small bright things (white suits)
  // get Highlights as fully as Lightroom gives them (fitted on JWL_7451; was
  // half a stop, and 1.5 before that left a glow around heads against the sky).
  float dEdge = l0 - g.r;
  float base = g.r + dEdge * (1.0 - exp(-dEdge * dEdge / 0.1));
  float detail = l0 - base;
  base += exposure;

  float bd = disp(exp2(base));
  // How much Highlights and Shadows act comes from a wider neighbourhood that
  // only follows big edges (a head against the sky), so fine detail such as
  // hair strands and the gaps between them is lifted alike and keeps its
  // contrast, as in Lightroom (measured on JWL_7451).
  // Skip the extra neighbourhood samples (16 texture reads per pixel) when
  // neither Highlights nor Shadows is in use, the common case while editing
  // curves and colour; both terms are exactly 0 then anyway.
  float shLift = 0.0;
  if (highlights != 0.0 || shadows != 0.0) {
    float lw = 0.5 * (ring(p, LIFT_R) + ring(p, 2.0 * LIFT_R));
    float dl = l0 - lw;
    lw += dl * (1.0 - exp(-dl * dl / LIFT_EDGE));
    float bw = disp(exp2(lw + exposure));
    // Highlights and Shadows: weights and strengths fitted to Lightroom's measured
    // change per L* band at -100 / +100 (see tools/lr-tone.md).
    // Sliders overlap as in Lightroom: with Contrast already pulling the brights
    // down Highlights does less, and with Blacks lifting the darks Shadows does less.
    // Highlights eases off again on the brightest areas themselves (a bright
    // sky), leaving those to Whites: Lightroom's -93 takes L* 70-75 down 14 but
    // L* 80-85 only 10, so the sky keeps its gradient rather than piling up.
    base += highlights * HL_K * smoothstep(HL_LO, 1.0, bw) * (1.0 - uHlTop * smoothstep(HL_T0, HL_T1, bd)) * (1.0 - HL_X * max(-(uContrastSat + LA.y), 0.0));
    shLift = shadows * (SH_K * (1.0 - smoothstep(0.0, SH_HI, bw)) + SH_DEEP * (1.0 - smoothstep(0.0, 0.2, bw))) * (1.0 - SH_X * max(blacks, 0.0));
    base += shLift;
  }
  float mid = smoothstep(0.03, 0.35, bd) * (1.0 - smoothstep(0.8, 1.0, bd));
  detail *= max(0.0, 1.0 + clarity * 0.9 * mid);

  float l1 = base + detail;
  // Negative Texture smooths fine, low-contrast texture (skin) but spares
  // strong detail such as hair strands, as Lightroom's does (measured on JWL_7451).
  if (texAmt != 0.0) {
    float th = l0 - ring(p, 3.0);
    l1 += texAmt * 0.9 * th * (0.4 + 0.6 * mid) * (texAmt < 0.0 ? 1.0 - smoothstep(0.08, 0.25, abs(th)) : 1.0);
  }
  if (sharpen > 0.0) {
    float hp = l0 - ring(p, uSharpenRadius);
    float limit = 0.06 + uSharpenDetail * 0.6;
    float edge = abs(l0 - ring(p, uSharpenRadius * 2.0));
    float mask = uSharpenMasking > 0.0 ? smoothstep(uSharpenMasking * 0.25, uSharpenMasking * 0.25 + 0.08, edge) : 1.0;
    l1 += sharpen * clamp(hp, -limit, limit) * mask;
  } else if (sharpen < 0.0) l1 += max(sharpen, -1.0) * (l0 - ring(p, 1.5)); // a mask's negative Sharpness softens
  float fine = l1 - base; // the detail around the local base (log2), for Whites and Blacks
  lin *= exp2(l1 - l0);
  // Lightroom's Shadows lifts brightness but not colour with it.
  if (shLift > 0.0) { float ys = dot(lin, W709); lin = ys + (lin - ys) * exp2(-SH_C * shLift); }

  if (dehaze != 0.0) {
    float air = uAirY * exp2(exposure);
    float haze = clamp(g.g * exp2(exposure) / max(air, 1e-4), 0.0, 1.0);
    if (dehaze > 0.0) {
      float t = max(1.0 - 0.95 * dehaze * haze, 0.2);
      lin = (lin - air * (1.0 - t)) / t;
    } else {
      lin = mix(lin, vec3(air * 0.85), -dehaze * 0.45 * (0.4 + 0.6 * haze));
    }
  }

  // Glow: the light spilling from bright parts, on scene light (before the tone curve), so it rolls off as light does.
  float glowAmt = clamp(uGlowMix.x + LG, 0.0, 1.0);
  if (uGlowMix.w > 0.5 && glowAmt > 0.0) {
    vec3 gl = texture(uGlow, p).rgb;
    lin = mix(lin, gl, glowAmt * uGlowMix.y) + gl * (glowAmt * uGlowMix.z);
  }

  vec3 mapped;
  if (uDcp > 0.5 && uToneMap < 0.5) {
    // Lightroom's profile: look tables, then the tone curve, in ProPhoto RGB.
    vec3 pp = max(uS2P * lin, vec3(0.0));
    if (uLookADims.x > 0.0) pp = hueSatMap(uLookA, uLookADims, pp);
    if (uLookBDims.x > 0.0) pp = hueSatMap(uLookB, uLookBDims, pp);
    mapped = intoRange(uP2S * rgbTone(easeWhite(pp)));
  } else {
    lin = intoRange(lin);
    mapped = uToneMap < 0.5 ? shoulder(lin) : uToneMap < 1.5 ? sigmoidMap(lin) : uToneMap < 2.5 ? agxMap(lin) : filmicMap(lin);
  }
  vec3 d = encode(mapped);
  // Whites and Blacks act on the screen values, as in Lightroom, fitted to its
  // measured change per L* band at -100 (see tools/lr-tone.md). Brightness
  // only (colours scale with it), so saturation stays.
  if (whites != 0.0 || blacks != 0.0) {
    float yp = clamp(dot(d, W709), 0.0, 1.0);
    // They act on the local brightness and carry the detail around it along, so
    // a glowing cloud edge keeps its contrast (Lightroom's are edge-aware too).
    float y = clamp(yp * exp2(-fine * WB_LOCAL), 0.0, 1.0), y2 = y;
    // Negative Whites grows with the cube of brightness, then levels off near
    // white as Lightroom's does (-100: -7 L* at L* 75, -10 at L* 95), so a
    // bright sky keeps its gradient.
    if (whites < 0.0) { float q = y2 / 0.9; q *= q * q; y2 += whites * WH_NEG * y2 * y2 * y2 / (1.0 + q * q); }
    else if (whites > 0.0) y2 *= 1.0 + whites * WH_POS * y2;
    float dk = y2 * pow(1.0 - min(y2, 1.0), BL_N);
    // Positive Blacks also lifts the black point (fitted to a Lightroom export
    // with Blacks +85: its darkest tones came out well above black).
    y2 += blacks < 0.0 ? blacks * BL_NEG * dk : blacks * (BL_POS * dk + BL_LIFT * (1.0 - y2));
    y2 = max(y2, 0.0);
    // Brightening mostly adds grey (as Lightroom's lifted blacks look milky),
    // rather than scaling the colour up with it; measured on JWL_7451.
    d = y > 1e-4 ? (y2 > y ? mix(d * (y2 / y), d + (y2 - y) * yp / y, LIFT_GREY) : d * (y2 / y)) : vec3(y2);
  }
  d = clamp(d, 0.0, 1.0);
  // Contrast keeps hue (on the brightest and darkest channel, the middle one
  // keeping its place, as Adobe's tone curves do): per channel it turned
  // strong reds pink (measured on JWL_7451: 5 degrees of hue).
  {
    float ck = uContrast;
    float hi = max(d.r, max(d.g, d.b)), lo = min(d.r, min(d.g, d.b));
    float hi2 = hi + ck * (hi * hi * (3.0 - 2.0 * hi) - hi), lo2 = lo + ck * (lo * lo * (3.0 - 2.0 * lo) - lo);
    d = hi - lo > 1e-5 ? lo2 + (d - lo) * ((hi2 - lo2) / (hi - lo)) : vec3(hi2);
  }
  // The Contrast slider (and masks'): an S-curve around CON_PIVOT, on
  // brightness (CON_LUM) or on the brightest and darkest channel.
  {
    float ck = CON_K * (uContrastSat + LA.y);
    if (ck != 0.0) {
      float kl = exp2(-fine * CON_LOCAL);
      float y = clamp(dot(d, W709) * kl, 0.0, 1.0), y2 = conCurve(y, ck);
      vec3 dl = y > 1e-4 ? d * (y2 / y) : vec3(y2);
      float hi = max(d.r, max(d.g, d.b)), lo = min(d.r, min(d.g, d.b));
      float hi2 = conCurve(clamp(hi * kl, 0.0, 1.0), ck) / kl, lo2 = conCurve(clamp(lo * kl, 0.0, 1.0), ck) / kl;
      vec3 dh = hi - lo > 1e-5 ? lo2 + (d - lo) * ((hi2 - lo2) / (hi - lo)) : vec3(hi2);
      d = mix(dh, dl, CON_LUM);
    }
  }
  float cs = uContrastSat + LA.y;
  if (cs != 0.0) {
    float yc = dot(d, W709), mx = max(d.r, max(d.g, d.b)), sv = mx > 0.0 ? (mx - min(d.r, min(d.g, d.b))) / mx : 0.0;
    d = yc + (d - yc) * max(1.0 + cs * (CS_K + CS_V * (1.0 - sv) * (1.0 - sv)), 0.0);
  }
  // Tone curve: on the brightest and darkest channel, the middle one keeping its
  // place (Adobe's RGBTone: adds saturation but keeps hue; per channel it pulled
  // reds and oranges toward each other on JWL_7345/7530), eased toward a
  // brightness-only curve by Refine Saturation; then red, green, blue.
  // Like Lightroom it works in ProPhoto primaries with the sRGB tone response
  // ("Melissa RGB"), where per-channel curves change saturation as Lightroom's do.
  d = encode(clamp(SRGB_TO_PP * decodeS(d), 0.0, 1.0));
  vec3 dc;
  {
    float hi = max(d.r, max(d.g, d.b)), lo = min(d.r, min(d.g, d.b));
    float hi2 = texture(uCurve, vec2(hi, 0.5)).r, lo2 = texture(uCurve, vec2(lo, 0.5)).r;
    dc = hi - lo > 1e-5 ? lo2 + (d - lo) * ((hi2 - lo2) / (hi - lo)) : vec3(hi2);
  }
  if (uRefineSat < 1.0) {
    float yc0 = dot(d, W709);
    float yc = texture(uCurve, vec2(yc0, 0.5)).r;
    d = mix(yc + (d - yc0) * (yc / max(yc0, 1e-3)), dc, uRefineSat);
  } else d = dc;
  d = clamp(d, 0.0, 1.0);
  d = vec3(texture(uCurve, vec2(d.r, 0.5)).g, texture(uCurve, vec2(d.g, 0.5)).b, texture(uCurve, vec2(d.b, 0.5)).a);
  // Back to sRGB unclipped: ProPhoto colours past sRGB are eased in at the end
  // (gamutIn), so strong reds don't all land on one value.
  d = encode(PP_TO_SRGB * decodeS(d));
  // Masks' own curves, the same way, where each mask covers.
  if (uMaskN > 0.0) {
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uMaskN) break;
      if (uMS[i].y < 0.5 || mw[i] <= 0.0) continue;
      float row = (float(i) + 0.5) / 16.0;
      vec3 c = vec3(texture(uMaskCurve, vec2(d.r, row)).r, texture(uMaskCurve, vec2(d.g, row)).r, texture(uMaskCurve, vec2(d.b, row)).r);
      float yc0 = dot(d, W709), yc = texture(uMaskCurve, vec2(yc0, row)).r;
      c = mix(yc + (d - yc0) * (yc / max(yc0, 1e-3)), c, uMS[i].z);
      c = clamp(c, 0.0, 1.0);
      c = vec3(texture(uMaskCurve, vec2(c.r, row)).g, texture(uMaskCurve, vec2(c.g, row)).b, texture(uMaskCurve, vec2(c.b, row)).a);
      d = mix(d, c, min(mw[i], 1.0));
    }
  }

  // Colour: mixer (per hue), then vibrance and saturation.
  vec3 h = hsv(d);
  float chroma = smoothstep(0.02, 0.25, h.y);
  // The Color Mixer, fitted on Lightroom exports of test charts (tools/lr-tone.md):
  // hue, saturation and value of linear ProPhoto RGB (Adobe's hue/sat map
  // space), with the bands' weights picked by that hue.
  vec3 pp = SRGB_TO_PP * srgbToLin(d);
  vec3 q = rgbToHsv6(max(pp, vec3(0.0)));
  vec4 adj = texture(uHue, vec2((q.x * 60.0 + 0.5) / 360.0, 0.5)) * smoothstep(0.0, MIX_S, q.y);
  if (adj.x != 0.0 || adj.y != 0.0 || adj.z != 0.0) {
    q.x += adj.x * MIX_HUE / 60.0;
    q.y *= max(1.0 + adj.y * (adj.y > 0.0 ? MIX_SAT_UP : MIX_SAT_DOWN) - adj.z * MIX_LUM_SAT, 0.0);
    q.y = min(q.y, 1.0);
    q.z *= max(1.0 + adj.z * (adj.z > 0.0 ? MIX_LUM_UP : MIX_LUM_DOWN), 0.0);
    d = linToSrgb(PP_TO_SRGB * hsv6ToRgb(q));
  }
  if (LD.x != 0.0) d = rotateHue(d, LD.x * 60.0 * chroma);
  // Saturation and Vibrance scale OKLab colour, keeping brightness and hue.
  // Fitted on the charts: Saturation +100 adds 80% and -100 takes 92%;
  // Vibrance lifts muted colours most (by ProPhoto saturation) and lowers all alike.
  float sv = uSaturation + LC.y;
  if (sv != 0.0 || uVibrance != 0.0) {
    float ps = rgbToHsv6(max(SRGB_TO_PP * srgbToLin(d), vec3(0.0))).y;
    float f = (1.0 + sv * (sv > 0.0 ? 0.80 : 0.92)) * (1.0 + uVibrance * (uVibrance > 0.0 ? 1.29 * pow(clamp(1.0 - ps / 0.96, 0.0, 1.0), 0.77) : 0.77));
    vec3 o = toOklab(d); o.yz *= max(f, 0.0); d = fromOklab(o);
  }
  // A mask's colour swatch: tints its area, keeping the brightness.
  if (LF.y != 0.0 || LF.z != 0.0 || LF.w != 0.0) {
    float yt = dot(d, W709);
    d *= 1.0 + LF.yzw * 2.4;
    d *= max(yt, CHROMA_FLOOR) / max(dot(d, W709), CHROMA_FLOOR);
  }
  // Point Color: colours near each mask's sampled colour shift in hue,
  // saturation and luminance (range and softness set how near).
  float pointShow = -1.0;
  if (uMaskN > 0.0) {
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uMaskN) break;
      if (uMP[i].w < 0.5) continue;
      vec3 hp = hsv(d);
      float dh = abs(hp.x - uMP[i].x);
      dh = min(dh, 360.0 - dh) / 180.0;
      float dist = length(vec3(dh * 2.2 * min(hp.y, uMP[i].y) / max(uMP[i].y, 0.05) + dh * 0.4, (hp.y - uMP[i].y) * 0.9, (hp.z - uMP[i].z) * 0.6));
      float width = uMQ[i].w;
      float near = 1.0 - smoothstep(width * (1.0 - 0.85 * uMS[i].x), width, dist);
      if (float(i) == uPointView) pointShow = near;
      float k = near * mw[i];
      if (k <= 0.0) continue;
      if (uMQ[i].x != 0.0) d = rotateHue(d, uMQ[i].x * k);
      float yp = dot(d, W709);
      d = yp + (d - yp) * max(1.0 + uMQ[i].y * k, 0.0);
      d *= 1.0 + uMQ[i].z * 0.8 * k;
    }
  }

  // Fringes: purple and green edges along high-contrast detail lose their colour.
  if (uDefringeP > 0.0 || uDefringeG > 0.0 || LF.x > 0.0) {
    float edge = smoothstep(0.15, 0.6, abs(l0 - ring(p, 2.0)));
    vec3 hd = hsv(d);
    float purple = smoothstep(240.0, 265.0, hd.x) * (1.0 - smoothstep(320.0, 345.0, hd.x));
    float green = smoothstep(75.0, 95.0, hd.x) * (1.0 - smoothstep(150.0, 170.0, hd.x));
    float k = clamp(edge * (purple * (uDefringeP + max(LF.x, 0.0)) + green * (uDefringeG + max(LF.x, 0.0))), 0.0, 1.0);
    float yk = dot(d, W709);
    d = mix(d, vec3(yk), k);
  }

  // Black & white: each colour's grey comes from the mix sliders.
  if (uBW > 0.0) {
    float yb = dot(d, W709) * (1.0 + adj.w * chroma * 1.2);
    d = vec3(max(yb, 0.0));
  }

  // Colour grading, fitted on Lightroom exports of test charts and
  // of JWL_7345/7530 with and without their grade (tools/lr-tone.md):
  // soft regions on OKLab lightness around the balance point; each adds its
  // tint (luts.js gradeTints) to the display colour, most in the middle of each
  // channel's range and fading toward black and white, as a soft-light blend does.
  if (uGradeOn > 0.0) {
    float lk = toOklab(d).x;
    // Blending past 50 widens the regions and strengthens them (chart at 100).
    float bl = uGradeShape.x, up = max(bl - 0.5, 0.0);
    float c = GRADE_C - uGradeShape.y * 0.3, w = GRADE_W * (bl >= 0.5 ? 1.0 + up * 4.0 : (0.1 + bl * 0.4) / 0.3);
    float sh = 1.0 / (1.0 + exp((lk - c + GRADE_OFF) / w));
    float hi = 1.0 / (1.0 + exp((c + GRADE_OFF - lk) / w));
    float mi = clamp(1.0 - sh - hi, 0.0, 1.0);
    vec3 dd = clamp(d, 0.0, 1.0);
    d += ((sh * uGradeS + mi * uGradeM + hi * uGradeH) * (1.0 + up * 2.0) + uGradeG) * pow(4.0 * dd * (1.0 - dd), vec3(GRADE_P));
    float lum = uGradeLum.x * sh + uGradeLum.y * mi + uGradeLum.z * hi + uGradeLum.w;
    d = lum >= 0.0 ? 1.0 - (1.0 - d) * (1.0 - lum * 0.5) : d * (1.0 + lum * 0.5);
  }

  // Vignette, measured from the centre of the crop (also while the crop is being
  // set, when the whole photo shows), as Lightroom's Post-Crop Vignetting is.
  if (uVignette != 0.0) {
    vec2 q = (uOut2Vig * vec3(gl_FragCoord.xy, 1.0)).xy;
    float r = uVigRound;
    vec2 qs = q * (r > 0.0 ? vec2(mix(1.0, uCropAspect, r), 1.0) / mix(1.0, max(uCropAspect, 1.0), r) : vec2(1.0));
    float pw = 2.0 + max(-r, 0.0) * 6.0;
    float dist = pow(pow(abs(qs.x), pw) + pow(abs(qs.y), pw), 1.0 / pw);
    float m0 = 1.45 - uVigMid * 0.9;
    float f = 0.08 + uVigFeather * 0.9;
    float mask = smoothstep(m0 - f * 0.5, m0 + f * 0.5, dist);
    float amt = abs(uVignette) * mask * 0.9;
    if (uVigStyle > 2.5) d = mix(d, uVignette > 0.0 ? vec3(1.0) : vec3(0.0), amt);
    else {
      vec3 d0 = d;
      // Highlight and Color Priority scale the light (keeping colours); Highlights lets bright parts through.
      d = uVignette > 0.0 ? 1.0 - (1.0 - d) * (1.0 - amt) : d * (1.0 - amt);
      if (uVigStyle < 1.5) d = mix(d, d0, uVigHighlights * smoothstep(0.55, 1.0, max(d0.r, max(d0.g, d0.b))));
      else d = mix(d, d0, uVigHighlights * 0.5 * smoothstep(0.7, 1.0, max(d0.r, max(d0.g, d0.b))));
    }
  }

  // Grain, tied to the photo so it moves with it (masks' grain blends into the photo's).
  float grainAmt = uGrain.x + LE.x;
  if (grainAmt > 0.0) {
    float t = LE.x / grainAmt;
    float size = mix(uGrain.y, LE.y / max(LE.x, 1e-4), t), rough = mix(uGrain.z, LE.z / max(LE.x, 1e-4), t);
    vec2 g = ori / size;
    float nz = vnoise(g) - 0.5;
    nz = mix(nz, (vnoise(g * 2.3 + 17.0) - 0.5), rough * 0.6);
    float yg = dot(d, W709);
    d += nz * min(grainAmt, 1.5) * 0.35 * (0.3 + 0.7 * (1.0 - abs(yg * 2.0 - 1.0)));
  }

  d = uMelissa > 0.5 ? encode(clamp(SRGB_TO_PP * decodeS(d), 0.0, 1.0)) : gamutIn(d);
  // The selected mask on top: a colour, its outline, or the mask itself.
  if (uMaskView >= 0.0) {
    // The outline is the mask's halfway line; the fainter lines either side
    // show where its feathering starts and ends (not for AI masks, whose soft
    // edge would draw them as stray rings).
    float fw = max(fwidth(shownW), 1e-4) * uMaskLine;
    float edge = 1.0 - smoothstep(0.0, fw, abs(shownW - 0.5));
    float soft = max(1.0 - smoothstep(0.0, fw * 0.7, abs(shownW - 0.08)), 1.0 - smoothstep(0.0, fw * 0.7, abs(shownW - 0.92))) * 0.55;
    soft *= step(0.002, fwidth(shownW)) * uMaskFeather; // only where the mask actually fades
    float lines = max(edge, soft);
    if (uMaskStyle < 0.5) d = mix(d, uMaskColor, shownW * uMaskOpacity);
    else if (uMaskStyle < 1.5) d = mix(mix(d, uMaskColor, shownW * uMaskOpacity * 0.6), uMaskColor, lines);
    else if (uMaskStyle < 2.5) d = mix(d, uMaskColor, lines * max(uMaskOpacity, 0.35));
    else if (uMaskStyle < 3.5) d = vec3(shownW);
    else d *= shownW;
  }
  // Visualize Range: the point colour's reach in colour, the rest in grey.
  if (pointShow >= 0.0) d = mix(vec3(dot(d, W709) * 0.6), d, pointShow);
  if (uShowClip > 0.0) {
    if (max(d.r, max(d.g, d.b)) >= 0.998) d = vec3(1.0, 0.15, 0.2);
    else if (max(d.r, max(d.g, d.b)) <= 0.004) d = vec3(0.2, 0.45, 1.0);
  }
  o = vec4(d, 1.0);
}`;

// Screen colour correction (icc.js): the finished sRGB picture -> this
// screen's own colours. uLut holds, per channel, the screen value for linear
// light t² at t = 0..1.
// A finished picture (or a full-resolution tile of one) drawn into uRect of
// the target, scaled down through its mipmaps.
export const COPY = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec4 uRect; // x, y, w, h in target pixels
out vec4 o;
void main() { o = texture(uTex, (gl_FragCoord.xy - uRect.xy) / uRect.zw); }`;

// A full-resolution tile scaled down to the screen: Lanczos-2 over the mip
// level that leaves 1.5-3 texels per output pixel, so fine detail stays crisp
// (as Lightroom shows a photo below 100%) instead of trilinear's blur.
export const RESAMPLE = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec4 uRect;   // x, y, w, h in target pixels
uniform float uScale; // texels (level 0) per output pixel
out vec4 o;
float lz(float x) {
  x = abs(x);
  if (x < 1e-4) return 1.0;
  if (x >= 2.0) return 0.0;
  float px = 3.14159265 * x;
  return 2.0 * sin(px) * sin(px * 0.5) / (px * px);
}
void main() {
  float lev = max(0.0, floor(log2(uScale / 1.5)));
  float s = uScale / exp2(lev);
  vec2 size = vec2(textureSize(uTex, int(lev)));
  vec2 c = (gl_FragCoord.xy - uRect.xy) / uRect.zw * size - 0.5; // texel space of that level
  vec2 b = floor(c);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int j = -6; j <= 6; j++) {
    float wy = lz((b.y + float(j) - c.y) / s);
    if (wy == 0.0) continue;
    for (int i = -6; i <= 6; i++) {
      float wx = lz((b.x + float(i) - c.x) / s);
      if (wx == 0.0) continue;
      vec2 t = clamp(b + vec2(float(i), float(j)), vec2(0.0), size - 1.0);
      acc += wx * wy * texelFetch(uTex, ivec2(t), int(lev));
      wsum += wx * wy;
    }
  }
  o = clamp(acc / wsum, 0.0, 1.0);
}`;

export const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uLut;
uniform mat3 uDispM;
uniform vec2 uSize;
uniform float uLutN;
out vec4 o;
vec3 decodeS(vec3 v) { return mix(v / 12.92, pow((max(v, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, v)); }
float lut(float t, int c) { return texture(uLut, vec2((t * (uLutN - 1.0) + 0.5) / uLutN, 0.5))[c]; }
void main() {
  vec3 lin = clamp(uDispM * decodeS(texture(uTex, gl_FragCoord.xy / uSize).rgb), 0.0, 1.0);
  vec3 t = sqrt(lin);
  vec3 v = vec3(lut(t.r, 0), lut(t.g, 1), lut(t.b, 2));
  // A touch of noise keeps smooth skies from banding in 8 bits.
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  o = vec4(v + n / 255.0, 1.0);
}`;
