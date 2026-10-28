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
vec3 toLinear(vec3 cam) { return uCam * min(max(cam, vec3(0.0)) * uWB, vec3(1.0)); }
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

export const FINAL = `${COMMON}
uniform sampler2D uSrc;   // whole photo (overview)
uniform sampler2D uHi;    // a sharper part of it, when zoomed or exporting
uniform vec4 uHiRect;     // where uHi sits, in photo coordinates (0-1); w = 0 when unused
uniform vec4 uHiSafe;     // the part of uHiRect that is safe to use
uniform sampler2D uGuide;
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
uniform float uLensVig, uLensVigMid;
uniform float uDefringeP, uDefringeG;
uniform float uShadowTint;
uniform vec2 uPhotoPx;    // 1 / photo size in full-resolution pixels
uniform float uCropAspect;
uniform vec3 uBg;
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights, uShadows, uWhites, uBlacks;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform float uAirY;
uniform float uSharpen, uSharpenRadius, uSharpenDetail, uSharpenMasking;
uniform float uNrLum, uNrColor, uNrLumDetail, uNrLumContrast, uNrColorDetail, uNrColorSmooth;
uniform float uVignette, uVigMid, uVigRound, uVigFeather, uVigStyle, uVigHighlights;
uniform float uRefineSat;
uniform float uBW;
uniform vec3 uGradeS, uGradeM, uGradeH, uGradeG; // tints around grey
uniform vec4 uGradeLum;   // shadows, midtones, highlights, global
uniform vec2 uGradeShape; // blending, balance
uniform float uGradeOn;
uniform vec3 uGrain;      // amount, cell size (oriented px), roughness
uniform float uShowClip;
// Masks (masks.js): up to 8 greyscale images, one per channel of two
// textures, and each mask's local sliders.
uniform vec2 uOriSize;
uniform sampler2D uMask0, uMask1;
uniform float uMaskN;
uniform vec4 uMA[8]; // exposure, contrast, highlights, shadows
uniform vec4 uMB[8]; // whites, blacks, texture, clarity
uniform vec4 uMC[8]; // dehaze, saturation, temp, tint
uniform vec4 uMD[8]; // hue, sharpness, noise, amount
uniform vec4 uMR[8]; // luminance range: low, high, smoothness, flags (1 = range on, 2 = inverted)
uniform float uMaskView;   // the mask shown on top (-1: none)
uniform vec3 uMaskColor;
uniform float uMaskOpacity, uMaskStyle, uMaskLine;
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
vec3 encode(vec3 x) {
  return mix(x * 12.92, 1.055 * pow(max(x, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, x));
}
float disp(float y) { return encode(vec3(shoulder1(max(y, 0.0)))).r; }

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

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}

void main() {
  vec2 ori = (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy;
  // Transform (perspective), then the lens: from the finished photo back to the sensor.
  vec2 n = (ori - uOriCenter) / uOriHalf;
  vec3 hn = uPersp * vec3(n, 1.0);
  n = hn.xy / hn.z;
  float r2 = dot(n, n) / uCornerR2;
  n *= 1.0 - uDistort * r2;
  vec2 p = (uOri2Photo * vec3(n * uOriHalf + uOriCenter, 1.0)).xy;
  if (hn.z <= 0.0 || p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { o = vec4(uBg, 1.0); return; }

  vec3 lin = toLinear(cam(p));
  vec3 lin0 = lin;

  // How much each mask covers this pixel, and their sliders added up.
  vec4 LA = vec4(0.0), LB = vec4(0.0), LC = vec4(0.0), LD = vec4(0.0);
  float shownW = 0.0;
  if (uMaskN > 0.0) {
    vec2 muv = ori / uOriSize;
    vec4 m0 = texture(uMask0, muv);
    vec4 m1 = uMaskN > 4.0 ? texture(uMask1, muv) : vec4(0.0);
    float yl = disp(dot(lin0, W709) * exp2(uExposure));
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uMaskN) break;
      float w = i < 4 ? m0[i] : m1[i - 4];
      vec4 r = uMR[i];
      if (mod(r.w, 2.0) >= 1.0) {
        float sm = max(r.z * 0.5, 0.004);
        w *= smoothstep(r.x - sm, r.x, yl) * (1.0 - smoothstep(r.y, r.y + sm, yl));
      }
      if (r.w >= 2.0) w = 1.0 - w;
      if (float(i) == uMaskView) shownW = w;
      w *= uMD[i].w;
      LA += uMA[i] * w; LB += uMB[i] * w; LC += uMC[i] * w; LD += uMD[i] * w;
    }
  }
  float nrLum = clamp(uNrLum + LD.z, 0.0, 1.0);
  float exposure = uExposure + LA.x;
  float highlights = uHighlights + LA.z, shadows = uShadows + LA.w;
  float whites = uWhites + LB.x, blacks = uBlacks + LB.y;
  float texAmt = uTexture + LB.z, clarity = uClarity + LB.w;
  float dehaze = clamp(uDehaze + LC.x, -1.0, 1.0);
  float sharpen = uSharpen + LD.y * 1.1;

  // Noise reduction: average with neighbours that are alike (luminance), and
  // smooth colour over a wider area (colour).
  if (nrLum > 0.0 || uNrColor > 0.0) {
    float y0 = max(dot(lin, W709), 1e-5);
    vec3 lsum = lin; float lw = 1.0;
    vec3 csum = lin / y0; float cw = 1.0;
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
      if (uNrColor > 0.0) {
        vec3 n2 = toLinear(cam(p + dir * uPhotoPx * cr));
        csum += n2 / max(dot(n2, W709), 1e-5) * uNrColor; cw += uNrColor;
        if (uNrColorSmooth > 0.0) {
          vec3 n3 = toLinear(cam(p + dir * uPhotoPx * cr * 2.5));
          csum += n3 / max(dot(n3, W709), 1e-5) * uNrColor * uNrColorSmooth; cw += uNrColor * uNrColorSmooth;
        }
      }
    }
    lin = lsum / lw;
    // Contrast brings back some of the local contrast the smoothing took.
    if (uNrLumContrast > 0.0) lin *= exp2((log2(y0) - log2(max(dot(lin, W709), 1e-5))) * uNrLumContrast * 0.6);
    if (uNrColor > 0.0) lin = (csum / cw) * max(dot(lin, W709), 1e-5);
  }

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
    lin *= yb / max(dot(lin, W709), 1e-6);
  }

  float y0 = max(dot(lin, W709), 1e-5);
  float l0 = log2(y0);
  vec2 g = texture(uGuide, p).rg;
  // The blurred base, pulled toward this pixel across strong edges (fewer halos).
  float dEdge = l0 - g.r;
  float base = g.r + dEdge * (1.0 - exp(-dEdge * dEdge / 1.3));
  float detail = l0 - base;
  base += exposure;

  float bd = disp(exp2(base));
  base += highlights * 1.3 * smoothstep(0.4, 1.0, bd);
  base += shadows * 1.6 * (1.0 - smoothstep(0.0, 0.55, bd));
  float mid = smoothstep(0.03, 0.35, bd) * (1.0 - smoothstep(0.8, 1.0, bd));
  detail *= max(0.0, 1.0 + clarity * 0.9 * mid);

  float l1 = base + detail;
  if (texAmt != 0.0) l1 += texAmt * 0.9 * (l0 - ring(p, 3.0)) * (0.4 + 0.6 * mid);
  if (sharpen > 0.0) {
    float hp = l0 - ring(p, uSharpenRadius);
    float limit = 0.06 + uSharpenDetail * 0.6;
    float edge = abs(l0 - ring(p, uSharpenRadius * 2.0));
    float mask = uSharpenMasking > 0.0 ? smoothstep(uSharpenMasking * 0.25, uSharpenMasking * 0.25 + 0.08, edge) : 1.0;
    l1 += sharpen * clamp(hp, -limit, limit) * mask;
  } else if (sharpen < 0.0) l1 += max(sharpen, -1.0) * (l0 - ring(p, 1.5)); // a mask's negative Sharpness softens
  lin *= exp2(l1 - l0);

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

  // Bring colours outside the screen's range back in by desaturating them.
  float y1 = dot(lin, W709);
  float mn = min(lin.r, min(lin.g, lin.b));
  if (mn < 0.0 && y1 > 0.0) lin = y1 + (lin - y1) * (y1 / (y1 - mn + 1e-6));
  lin = max(lin, vec3(0.0));

  if (whites != 0.0) lin *= exp2(whites * 0.8 * smoothstep(0.55, 1.0, disp(dot(lin, W709))));

  vec3 d = encode(shoulder(lin));
  float bp = -blacks * 0.06;
  d = (d - bp) / (1.0 - bp);
  d = clamp(d, 0.0, 1.0);
  vec3 s = d * d * (3.0 - 2.0 * d);
  d = d + (uContrast + LA.y * 0.75) * (s - d);
  // Tone curve: per channel (Lightroom's way, which adds saturation), eased
  // toward a brightness-only curve by Refine Saturation; then red, green, blue.
  vec3 dc = vec3(texture(uCurve, vec2(d.r, 0.5)).r, texture(uCurve, vec2(d.g, 0.5)).r, texture(uCurve, vec2(d.b, 0.5)).r);
  if (uRefineSat < 1.0) {
    float yc0 = dot(d, W709);
    float yc = texture(uCurve, vec2(yc0, 0.5)).r;
    d = mix(yc + (d - yc0) * (yc / max(yc0, 1e-3)), dc, uRefineSat);
  } else d = dc;
  d = clamp(d, 0.0, 1.0);
  d = vec3(texture(uCurve, vec2(d.r, 0.5)).g, texture(uCurve, vec2(d.g, 0.5)).b, texture(uCurve, vec2(d.b, 0.5)).a);

  // Colour: mixer (per hue), then vibrance and saturation.
  vec3 h = hsv(d);
  vec4 adj = texture(uHue, vec2((h.x + 0.5) / 360.0, 0.5));
  float chroma = smoothstep(0.02, 0.25, h.y);
  if (adj.x != 0.0) d = rotateHue(d, adj.x * chroma);
  if (LD.x != 0.0) d = rotateHue(d, LD.x * 60.0 * chroma);
  float yd = dot(d, W709);
  float skin = 1.0 - 0.5 * exp(-pow((h.x > 180.0 ? h.x - 360.0 : h.x) - 25.0, 2.0) / 450.0);
  float sat = (1.0 + adj.y * chroma) * (1.0 + uSaturation + LC.y) * (1.0 + uVibrance * pow(1.0 - h.y, 2.0) * skin);
  d = yd + (d - yd) * max(sat, 0.0);
  d *= 1.0 + adj.z * 0.6 * chroma;

  // Fringes: purple and green edges along high-contrast detail lose their colour.
  if (uDefringeP > 0.0 || uDefringeG > 0.0) {
    float edge = smoothstep(0.15, 0.6, abs(l0 - ring(p, 2.0)));
    vec3 hd = hsv(d);
    float purple = smoothstep(240.0, 265.0, hd.x) * (1.0 - smoothstep(320.0, 345.0, hd.x));
    float green = smoothstep(75.0, 95.0, hd.x) * (1.0 - smoothstep(150.0, 170.0, hd.x));
    float k = clamp(edge * (purple * uDefringeP + green * uDefringeG), 0.0, 1.0);
    float yk = dot(d, W709);
    d = mix(d, vec3(yk), k);
  }

  // Black & white: each colour's grey comes from the mix sliders.
  if (uBW > 0.0) {
    float yb = dot(d, W709) * (1.0 + adj.w * chroma * 1.2);
    d = vec3(max(yb, 0.0));
  }

  // Colour grading: tints and brightness for shadows, midtones and highlights.
  if (uGradeOn > 0.0) {
    float yg = clamp(dot(d, W709), 0.0, 1.0);
    float c = 0.5 - uGradeShape.y * 0.3, w = 0.1 + uGradeShape.x * 0.4;
    float sh = 1.0 - smoothstep(c - w, c + w * 0.3, yg);
    float hi = smoothstep(c - w * 0.3, c + w, yg);
    float mi = max(clamp(1.0 - sh - hi, 0.0, 1.0), (1.0 - abs(yg - c) / (w + 0.25)) * 0.8);
    vec3 tint = (uGradeS * sh + uGradeM * mi + uGradeH * hi + uGradeG) * 0.2;
    d += tint - dot(tint, W709);
    float lum = uGradeLum.x * sh + uGradeLum.y * mi + uGradeLum.z * hi + uGradeLum.w;
    d = lum >= 0.0 ? 1.0 - (1.0 - d) * (1.0 - lum * 0.5) : d * (1.0 + lum * 0.5);
  }

  // Vignette, measured from the centre of the cropped frame.
  if (uVignette != 0.0) {
    vec2 q = (uOut2Crop * vec3(gl_FragCoord.xy, 1.0)).xy;
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

  // Grain, tied to the photo so it moves with it.
  if (uGrain.x > 0.0) {
    vec2 g = ori / uGrain.y;
    float nz = vnoise(g) - 0.5;
    nz = mix(nz, (vnoise(g * 2.3 + 17.0) - 0.5), uGrain.z * 0.6);
    float yg = dot(d, W709);
    d += nz * uGrain.x * 0.35 * (0.3 + 0.7 * (1.0 - abs(yg * 2.0 - 1.0)));
  }

  d = clamp(d, 0.0, 1.0);
  // The selected mask on top: a colour, its outline, or the mask itself.
  if (uMaskView >= 0.0) {
    float edge = 1.0 - smoothstep(0.0, max(fwidth(shownW), 1e-4) * uMaskLine, abs(shownW - 0.5));
    if (uMaskStyle < 0.5) d = mix(d, uMaskColor, shownW * uMaskOpacity);
    else if (uMaskStyle < 1.5) d = mix(mix(d, uMaskColor, shownW * uMaskOpacity * 0.6), uMaskColor, edge);
    else if (uMaskStyle < 2.5) d = mix(d, uMaskColor, edge * max(uMaskOpacity, 0.35));
    else if (uMaskStyle < 3.5) d = vec3(shownW);
    else d *= shownW;
  }
  if (uShowClip > 0.0) {
    if (max(d.r, max(d.g, d.b)) >= 0.998) d = vec3(1.0, 0.15, 0.2);
    else if (max(d.r, max(d.g, d.b)) <= 0.004) d = vec3(0.2, 0.45, 1.0);
  }
  o = vec4(d, 1.0);
}`;
