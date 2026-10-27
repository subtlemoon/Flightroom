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
uniform mat3 uOut2Photo;  // output pixel -> photo coordinates (sensor orientation, 0-1)
uniform mat3 uOut2Crop;   // output pixel -> crop frame (-1..1)
uniform vec2 uPhotoPx;    // 1 / photo size in full-resolution pixels
uniform float uCropAspect;
uniform vec3 uBg;
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights, uShadows, uWhites, uBlacks;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform float uAirY;
uniform float uSharpen, uSharpenRadius, uSharpenDetail, uSharpenMasking;
uniform float uNrLum, uNrColor;
uniform float uVignette, uVigMid, uVigRound, uVigFeather;
uniform float uShowClip;
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

void main() {
  vec2 p = (uOut2Photo * vec3(gl_FragCoord.xy, 1.0)).xy;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { o = vec4(uBg, 1.0); return; }

  vec3 lin = toLinear(cam(p));

  // Noise reduction: average with neighbours that are alike (luminance), and
  // smooth colour over a wider area (colour).
  if (uNrLum > 0.0 || uNrColor > 0.0) {
    float y0 = max(dot(lin, W709), 1e-5);
    vec3 lsum = lin; float lw = 1.0;
    vec3 csum = lin / y0; float cw = 1.0;
    float sigma = 0.02 + uNrLum * 0.25;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 dir = vec2(cos(a), sin(a));
      vec3 n1 = toLinear(cam(p + dir * uPhotoPx * 1.5));
      float y1 = max(dot(n1, W709), 1e-5);
      float d = log2(y1) - log2(y0);
      float w = exp(-d * d / (2.0 * sigma * sigma)) * uNrLum;
      lsum += n1 * w; lw += w;
      if (uNrColor > 0.0) {
        vec3 n2 = toLinear(cam(p + dir * uPhotoPx * 4.0));
        csum += n2 / max(dot(n2, W709), 1e-5) * uNrColor; cw += uNrColor;
      }
    }
    lin = lsum / lw;
    if (uNrColor > 0.0) lin = (csum / cw) * max(dot(lin, W709), 1e-5);
  }

  float y0 = max(dot(lin, W709), 1e-5);
  float l0 = log2(y0);
  vec2 g = texture(uGuide, p).rg;
  // The blurred base, pulled toward this pixel across strong edges (fewer halos).
  float dEdge = l0 - g.r;
  float base = g.r + dEdge * (1.0 - exp(-dEdge * dEdge / 1.3));
  float detail = l0 - base;
  base += uExposure;

  float bd = disp(exp2(base));
  base += uHighlights * 1.3 * smoothstep(0.4, 1.0, bd);
  base += uShadows * 1.6 * (1.0 - smoothstep(0.0, 0.55, bd));
  float mid = smoothstep(0.03, 0.35, bd) * (1.0 - smoothstep(0.8, 1.0, bd));
  detail *= max(0.0, 1.0 + uClarity * 0.9 * mid);

  float l1 = base + detail;
  if (uTexture != 0.0) l1 += uTexture * 0.9 * (l0 - ring(p, 3.0)) * (0.4 + 0.6 * mid);
  if (uSharpen > 0.0) {
    float hp = l0 - ring(p, uSharpenRadius);
    float limit = 0.06 + uSharpenDetail * 0.6;
    float edge = abs(l0 - ring(p, uSharpenRadius * 2.0));
    float mask = uSharpenMasking > 0.0 ? smoothstep(uSharpenMasking * 0.25, uSharpenMasking * 0.25 + 0.08, edge) : 1.0;
    l1 += uSharpen * clamp(hp, -limit, limit) * mask;
  }
  lin *= exp2(l1 - l0);

  if (uDehaze != 0.0) {
    float air = uAirY * exp2(uExposure);
    float haze = clamp(g.g * exp2(uExposure) / max(air, 1e-4), 0.0, 1.0);
    if (uDehaze > 0.0) {
      float t = max(1.0 - 0.95 * uDehaze * haze, 0.2);
      lin = (lin - air * (1.0 - t)) / t;
    } else {
      lin = mix(lin, vec3(air * 0.85), -uDehaze * 0.45 * (0.4 + 0.6 * haze));
    }
  }

  // Bring colours outside the screen's range back in by desaturating them.
  float y1 = dot(lin, W709);
  float mn = min(lin.r, min(lin.g, lin.b));
  if (mn < 0.0 && y1 > 0.0) lin = y1 + (lin - y1) * (y1 / (y1 - mn + 1e-6));
  lin = max(lin, vec3(0.0));

  if (uWhites != 0.0) lin *= exp2(uWhites * 0.8 * smoothstep(0.55, 1.0, disp(dot(lin, W709))));

  vec3 d = encode(shoulder(lin));
  float bp = -uBlacks * 0.06;
  d = (d - bp) / (1.0 - bp);
  d = clamp(d, 0.0, 1.0);
  vec3 s = d * d * (3.0 - 2.0 * d);
  d = d + uContrast * (s - d);
  d = vec3(texture(uCurve, vec2(d.r, 0.5)).r, texture(uCurve, vec2(d.g, 0.5)).r, texture(uCurve, vec2(d.b, 0.5)).r);

  // Colour: mixer (per hue), then vibrance and saturation.
  vec3 h = hsv(d);
  vec3 adj = texture(uHue, vec2((h.x + 0.5) / 360.0, 0.5)).rgb;
  float chroma = smoothstep(0.02, 0.25, h.y);
  if (adj.x != 0.0) d = rotateHue(d, adj.x * chroma);
  float yd = dot(d, W709);
  float skin = 1.0 - 0.5 * exp(-pow((h.x > 180.0 ? h.x - 360.0 : h.x) - 25.0, 2.0) / 450.0);
  float sat = (1.0 + adj.y * chroma) * (1.0 + uSaturation) * (1.0 + uVibrance * pow(1.0 - h.y, 2.0) * skin);
  d = yd + (d - yd) * max(sat, 0.0);
  d *= 1.0 + adj.z * 0.6 * chroma;

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
    d = mix(d, uVignette > 0.0 ? vec3(1.0) : vec3(0.0), abs(uVignette) * mask * 0.9);
  }

  d = clamp(d, 0.0, 1.0);
  if (uShowClip > 0.0) {
    if (max(d.r, max(d.g, d.b)) >= 0.998) d = vec3(1.0, 0.15, 0.2);
    else if (max(d.r, max(d.g, d.b)) <= 0.004) d = vec3(0.2, 0.45, 1.0);
  }
  o = vec4(d, 1.0);
}`;
