// Draws a RAW photo with develop settings on the graphics card (WebGPU, or
// WebGL2 where there's none: gpu/). The decoded photo lives there as
// half-float camera RGB; every redraw runs the whole develop pipeline
// (shaders.js) for just the pixels on screen.
import { LUT_SIZE } from './icc.js';
import { createDevice } from './gpu/index.js';
import { colorTransform, inv3, mul3, neutralToXy, tempTintToXy, xyToTempTint } from './color.js';
import { BASELINE_EXPOSURE, PP_TO_SRGB, SRGB_TO_PP, TONE_SIZE, adobeRendering, dcpTransform, hueSatFor, hueSatPixels, toneTable } from './adobe.js';
import { CURVE_SIZE, HUE_SIZE, calibrationMatrix, curveTable, gradeTints, hueTable } from './luts.js';
import { MAX_MASKS, POINT_DEFAULT, adjOf, lumRange, maskRaster, rasterChange } from './masks.js';
import { tonemapUniforms } from './tonemap.js';
import { Composer } from './compose.js';
import { renderLayers } from './retouch.js';
import { GLOW_EDGE, LEVELS, glowPlan, glowUsed } from './glow.js';
import { ROTATION } from '../cull/rotation.js';

const GUIDE_EDGE = 320;
export { setGentleGraphics, gentleGraphics } from './gpu/engine.js';
// Mask textures left undrawn this long (ms) are freed (see updateMasks).
const MASK_TEX_IDLE = 20000;
// The base rendering under the sliders, per profile (params.js PROFILES).
// Fitted to Lightroom's Adobe Color and to the Z7 II's own JPEGs.
const LINEAR = [[0, 0], [255, 255]];
const FLAT_CURVE = { curve: LINEAR, curveR: LINEAR, curveG: LINEAR, curveB: LINEAR, pShadows: 0, pDarks: 0, pLights: 0, pHighlights: 0 };

// Lightroom's tone sliders are image-adaptive. Fitted on Lightroom exports of
// three photos (tools/lr-tone.md): JWL_7451 (middle brightness 2^-3.97 of
// white, where the sliders were fitted), JWL_7345 (0.86 stop brighter, where
// Highlights doesn't ease off on the brightest tones, so a bright sky comes
// down with the rest) and the night shot JWL_7530. Positive Shadows and Blacks
// follow the photo's range above its middle (stops from the median to the
// brightest 0.1%): full on JWL_7451 (2.0 stops), 0.79 on JWL_7345 (3.0) and
// next to nothing on JWL_7530 (4.0, with bright lights), where Lightroom's
// +90 / +90 leaves the night dark.
const KEY_REF = -3.97, KEY_SPAN = 0.86, HL_TOP = 0.55, SPAN_MID = 3.24, SPAN_W = 0.205;
export const liftScale = (span) => (span == null ? 1 : 1 / (1 + Math.exp((span - SPAN_MID) / SPAN_W)));
/** How much Highlights eases off on the brightest tones (shaders.js uHlTop). */
export const highlightTop = (keyL) => (keyL == null ? HL_TOP : HL_TOP * Math.min(1, Math.max(0, 1 - (keyL - KEY_REF) / KEY_SPAN)));

export const LOOKS = {
  adobe: { exposure: 1.05, contrast: 0.4, saturation: 0.9 },
  // Without Lightroom's own profile for the camera, Adobe Standard looks like Adobe Color.
  standard: { exposure: 1.05, contrast: 0.4, saturation: 0.9 },
  camera: { exposure: 0.95, contrast: 0.4, saturation: 1.25 },
  // darktable's AgX: its film-like curve, with a little contrast and colour on top as darktable sets it.
  agx: { exposure: 1.0, contrast: 0.3, saturation: 1.3, agx: true },
};

export const BASE = { exposure: 0.08, contrast: 0.19, sat: 1.12, builtInSat: 1.05 };
// (sat: on scene light, before the sliders and curves.)

/** The base rendering: Lightroom's own profile when it's here, else the fitted look. */
export function lookFor(info, s) {
  const r = adobeRendering(info, s.profile);
  // Lightroom's rendering with every slider at 0 has a little more exposure,
  // contrast and saturation than Adobe's DNG SDK steps alone: fitted to
  // Lightroom's own export of JWL_7451 at defaults (tools/lr-tone.md).
  // auto: the exposure Auto tone aims with (the fitted look's, which the profile's brightness is matched to).
  if (!r) return LOOKS[s.profile] || LOOKS.adobe;
  return { exposure: r.exposure + BASE.exposure, contrast: BASE.contrast, saturation: 1, baseSat: r.dcp.builtIn ? BASE.builtInSat : BASE.sat, auto: LOOKS.adobe.exposure + r.exposure - BASELINE_EXPOSURE };
}

/** The white point of the settings: the camera's own for As Shot (unrounded, as Lightroom uses it). */
function whiteXy(info, s) {
  if (s.wb === 'As Shot' && info.asShot?.every((m) => m > 0)) return neutralToXy(info.matrices, info.asShot.map((m) => 1 / m));
  return tempTintToXy(s.temp, s.tint);
}

// Without Lightroom's profile for the camera (no Lightroom or Adobe DNG
// Converter on the computer: the built-in Adobe Standard, or Camera Standard
// and AgX), only the camera's colour matrices are here, and they make a white
// balance away from the photo's light exactly as strong as colour science says.
// Lightroom's profiles carry forward matrices that make it about 0.6 as strong:
// fitted on eleven cameras' Adobe Standard profiles (Canon 80D, R, R6, Nikon
// Z 7, Z 8, D3100, Sony A7S II, Leica M10, Fujifilm X-A7, XF10, Olympus E-PM2).
// Unsoftened, Tint +100 on a Canon 80D turned the whole photo solid blue where
// Lightroom shows lavender. So the white is moved from the photo's As Shot
// light only 0.6 of the way (in mireds and tint) to the one asked for. As Shot
// itself, and the Temp and Tint numbers, stay as they are.
export const BUILT_IN_WB = 0.6;
const softWb = (r) => !r || !r.dcp.illuminants.some((i) => i.forward);
function asShotTT(info) {
  if (!info.asShot?.every((m) => m > 0) || !info.matrices?.length) return null;
  return xyToTempTint(neutralToXy(info.matrices, info.asShot.map((m) => 1 / m)));
}
/** Moves `t` (temp, tint) `k` of the way from `from`, in mireds and tint (kept within 2000-50000 K and Tint ±150). */
function between(from, t, k) {
  const mired = Math.min(500, Math.max(20, 1e6 / from.temp + k * (1e6 / t.temp - 1e6 / from.temp)));
  return { temp: 1e6 / mired, tint: Math.min(150, Math.max(-150, from.tint + k * (t.tint - from.tint))) };
}

/** The white the photo is rendered with: softened as above where only colour matrices are here. */
export function renderWhite(info, s, r = adobeRendering(info, s.profile)) {
  const xy = whiteXy(info, s);
  const shot = softWb(r) && asShotTT(info);
  if (!shot) return xy;
  const { temp, tint } = between(shot, xyToTempTint(xy), BUILT_IN_WB);
  return tempTintToXy(temp, tint);
}

/**
 * Temp and Tint that render camera colour `neutral` as grey (the white balance
 * selector, Auto): undoes the softening, so the spot picked really comes out neutral.
 */
export function tempTintFor(info, profile, neutral) {
  const t = xyToTempTint(neutralToXy(info.matrices, neutral));
  const shot = softWb(adobeRendering(info, profile)) && asShotTT(info);
  return shot ? between(shot, t, 1 / BUILT_IN_WB) : t;
}

/** Multipliers and the matrix from camera RGB to linear sRGB for these settings (and how the profile's illuminants mix). */
export function cameraTransform(info, s) {
  const r = adobeRendering(info, s.profile);
  const xy = renderWhite(info, s, r);
  if (r) return dcpTransform(r.dcp, xy);
  const { temp, tint } = xyToTempTint(xy);
  return colorTransform(info, temp, tint);
}

export function parseFrame(buf) {
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== 0x4d495246) throw new Error('bad image data'); // "FRIM"
  const w = v.getUint32(4, true), h = v.getUint32(8, true);
  return { w, h, data: new Uint16Array(buf, 16, w * h * 3) };
}

// 3x3 affine matrices, row-major [a b c; d e f; 0 0 1] as arrays of 9.
const mat = (a, b, c, d, e, f) => [a, b, c, d, e, f, 0, 0, 1];
const mm = (A, B) => {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
  return o;
};
const ap = (M, x, y) => [M[0] * x + M[1] * y + M[2], M[3] * x + M[4] * y + M[5]];
// GLSL wants column-major.
const glMat = (M) => new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]);

/**
 * The photo's geometry: sensor size, orientation and crop, in the "oriented"
 * space you see (rotated upright). Crops are stored like Lightroom's: edges as
 * fractions of the unrotated sensor image, plus a straighten angle.
 */
export class Geometry {
  /** lens: the camera's own distortion correction from the RAW file (src-tauri lens.rs), or none. */
  constructor(sw, sh, orientation, lens = null) {
    this.sw = sw; this.sh = sh;
    this.lens = lens && Array.isArray(lens.k) ? lens : null;
    this.rot = ROTATION[orientation] || 0;
    this.ow = this.rot % 180 ? sh : sw;
    this.oh = this.rot % 180 ? sw : sh;
    // oriented pixel -> sensor pixel
    this.o2s = {
      0: mat(1, 0, 0, 0, 1, 0),
      90: mat(0, 1, 0, -1, 0, sh),
      180: mat(-1, 0, sw, 0, -1, sh),
      270: mat(0, -1, sw, 1, 0, 0),
    }[this.rot];
    this.s2o = {
      0: mat(1, 0, 0, 0, 1, 0),
      90: mat(0, -1, sh, 1, 0, 0),
      180: mat(-1, 0, sw, 0, -1, sh),
      270: mat(0, 1, 0, -1, 0, sw),
    }[this.rot];
  }

  /** The crop as centre, half size (oriented pixels) and angle; the whole photo when there is none. */
  frame(crop) {
    if (!crop) return { cx: this.ow / 2, cy: this.oh / 2, hw: this.ow / 2, hh: this.oh / 2, angle: 0 };
    const [x0, y0] = ap(this.s2o, crop.left * this.sw, crop.top * this.sh);
    const [x1, y1] = ap(this.s2o, crop.right * this.sw, crop.bottom * this.sh);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.abs(x1 - x0) / 2, hh: Math.abs(y1 - y0) / 2, angle: crop.angle || 0 };
  }

  /** A frame (oriented pixels) back to a stored crop. */
  toCrop(f) {
    const [a0, b0] = ap(this.o2s, f.cx - f.hw, f.cy - f.hh);
    const [a1, b1] = ap(this.o2s, f.cx + f.hw, f.cy + f.hh);
    return {
      left: Math.min(a0, a1) / this.sw, right: Math.max(a0, a1) / this.sw,
      top: Math.min(b0, b1) / this.sh, bottom: Math.max(b0, b1) / this.sh,
      angle: f.angle,
    };
  }

  /** Crop-frame coordinates (-1..1) -> oriented pixels. */
  frameToOriented(f) {
    const a = (f.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return mat(c * f.hw, -s * f.hh, f.cx, s * f.hw, c * f.hh, f.cy);
  }

  /**
   * The camera's lens correction, when it applies: Z lenses always (Lightroom
   * applies their built-in correction whatever the checkbox says), others with
   * Enable profile corrections. From the corrected picture to the sensor, around
   * the optical centre: r * (1 + k0 rho^2 + k1 rho^4 + k2 rho^6) / (1 + q),
   * rho = r / half diagonal. As { k: [k0, k1, k2, 1 / (1 + q)], c: centre (0-1), n: (w, h) / half diagonal }.
   */
  lensFor(s) {
    const l = this.lens;
    if (!l || !(l.required || s?.lensProfile)) return null;
    const hd = Math.hypot(this.sw, this.sh) / 2;
    return { k: [l.k[0], l.k[1], l.k[2], 1 / (1 + l.q)], c: [0.5 + (l.dx || 0) / this.sw, 0.5 + (l.dy || 0) / this.sh], n: [this.sw / hd, this.sh / hd] };
  }

  /** Oriented pixels -> photo coordinates (0-1, sensor orientation). */
  orientedToPhoto() {
    return mm(mat(1 / this.sw, 0, 0, 0, 1 / this.sh, 0), this.o2s);
  }
}

/**
 * Output pixels (gl_FragCoord, y up) -> crop frame (-1..1) for a W x H target.
 * view: { scale: output px per oriented px, u, v: frame point at the centre }.
 */
export function outToFrame(W, H, f, view) {
  const k = view.scale;
  // x: (px - W/2) / (k*hw) + u ; y is flipped (gl y up, image y down)
  return mat(1 / (k * f.hw), 0, -W / 2 / (k * f.hw) + view.u, 0, -1 / (k * f.hh), H / 2 / (k * f.hh) + view.v);
}

// --- Transform and lens distortion -------------------------------------------
// Both work in "centred units": oriented pixels from the photo's centre,
// divided by half its long edge.

const centred = (geo) => ({ cx: geo.ow / 2, cy: geo.oh / 2, half: Math.max(geo.ow, geo.oh) / 2 });

/** The Transform panel as a matrix from the finished photo back to the source (centred units). */
export function perspective(s) {
  const v = (s.perspVertical || 0) / 100, h = (s.perspHorizontal || 0) / 100;
  const a = ((s.perspRotate || 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const ax = 2 ** (((s.perspAspect || 0) / 100) * 0.5);
  const sc = (s.perspScale ?? 100) / 100;
  // Source -> finished photo: keystone, rotate, aspect and scale, then offset.
  let F = [1, 0, 0, 0, 1, 0, h * 0.35, -v * 0.35, 1];
  F = mm([c, -sn, 0, sn, c, 0, 0, 0, 1], F);
  F = mm([ax * sc, 0, 0, 0, sc / ax, 0, 0, 0, 1], F);
  F = mm([1, 0, (s.perspX || 0) / 100, 0, 1, -(s.perspY || 0) / 100, 0, 0, 1], F);
  return inv3(F);
}

/** The camera's lens correction (Geometry.lensFor) on a photo point (0-1), as the shader does it. */
const lensUniforms = (L) => ({ uLensK: L ? L.k : [0, 0, 0, 1], uLensC: L ? L.c : [0.5, 0.5], uLensN: L ? L.n : [1, 1] });

export function lensWarp(L, [px, py]) {
  const vx = (px - L.c[0]) * L.n[0], vy = (py - L.c[1]) * L.n[1], r2 = vx * vx + vy * vy;
  const f = (1 + r2 * (L.k[0] + r2 * (L.k[1] + r2 * L.k[2]))) * L.k[3];
  return [L.c[0] + (px - L.c[0]) * f, L.c[1] + (py - L.c[1]) * f];
}

/** Maps a point of the finished photo (oriented px) to photo coordinates (0-1); null when outside the source. */
export function sourceMap(geo, s) {
  const { cx, cy, half } = centred(geo);
  const P = perspective(s);
  const corner = (cx * cx + cy * cy) / (half * half);
  const k = ((s.distortion || 0) / 100) * 0.25;
  const o2p = geo.orientedToPhoto();
  const L = geo.lensFor(s);
  return (x, y) => {
    let nx = (x - cx) / half, ny = (y - cy) / half;
    const w = P[6] * nx + P[7] * ny + P[8];
    [nx, ny] = [(P[0] * nx + P[1] * ny + P[2]) / w, (P[3] * nx + P[4] * ny + P[5]) / w];
    const f = 1 - k * ((nx * nx + ny * ny) / corner);
    const p = ap(o2p, nx * f * half + cx, ny * f * half + cy);
    return L ? lensWarp(L, p) : p;
  };
}

/** The largest crop of the photo's shape (centred, at the crop's angle) with no empty corners after Transform. */
export function constrainedCrop(geo, s) {
  const map = sourceMap(geo, s);
  const angle = s.crop?.angle || 0;
  const fits = (k) => {
    const M = geo.frameToOriented({ cx: geo.ow / 2, cy: geo.oh / 2, hw: (k * geo.ow) / 2, hh: (k * geo.oh) / 2, angle });
    for (let i = 0; i <= 8; i++) {
      const t = -1 + i / 4;
      for (const [u, v] of [[t, -1], [t, 1], [-1, t], [1, t]]) {
        const [x, y] = map(...ap(M, u, v));
        if (x < -1e-4 || y < -1e-4 || x > 1.0001 || y > 1.0001) return false;
      }
    }
    return true;
  };
  let lo = 0.05, hi = 1;
  if (fits(1)) lo = 1;
  else for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  if (lo === 1 && !angle) return null;
  return { ...geo.toCrop({ cx: geo.ow / 2, cy: geo.oh / 2, hw: (lo * geo.ow) / 2, hh: (lo * geo.oh) / 2, angle }), aspect: s.crop?.aspect };
}

// How the selected mask is shown on screen (uMaskStyle is the index).
// A fully saturated colour of this hue (degrees), components summing to 1.
function hueRgb(h) {
  const f = (n) => { const k = (n + h / 60) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  const c = [f(5), f(3), f(1)];
  const sum = c[0] + c[1] + c[2];
  return c.map((v) => v / sum);
}

export const MASK_STYLES = ['color', 'both', 'outline', 'matte', 'image'];

export const fitScale = (W, H, f, margin = 0) => Math.min((W - margin * 2) / (2 * f.hw), (H - margin * 2) / (2 * f.hh));

// Where a group of mask images differs from the group on the graphics card:
// [x, y, w, h], or null when a mask changed some other way than by painting.
function changedRect(group, was) {
  let box = null;
  for (let i = 0; i < group.length; i++) {
    if (group[i] === was[i]) continue;
    const r = rasterChange(group[i], was[i]);
    if (!r) return null;
    if (!r[2] || !r[3]) continue;
    box = box ? [Math.min(box[0], r[0]), Math.min(box[1], r[1]), Math.max(box[0] + box[2], r[0] + r[2]), Math.max(box[1] + box[3], r[1] + r[3])] : [r[0], r[1], r[0] + r[2], r[1] + r[3]];
  }
  return box ? [box[0], box[1], box[2] - box[0], box[3] - box[1]] : [0, 0, 0, 0];
}

export class Renderer {
  /**
   * `onScreen`: the canvas is shown on the page. Its picture is then kept
   * between frames: with the default swap, some Windows graphics drivers flash
   * an empty or older frame while the photo redraws every frame (dragging a
   * slider or the curve). `forceGl`: WebGL2 even where there is WebGPU.
   *
   * Reading pixels back (histogram, previews, the colour under the pointer,
   * export tiles) gives a promise on WebGPU; on WebGL2 it's there at once
   * unless asked for later. `await` covers both.
   */
  constructor(canvas, { onScreen = false, forceGl = false } = {}) {
    this.canvas = canvas;
    const dev = (this.dev = createDevice(canvas, { onScreen, forceGl }));
    this.kind = dev.kind;
    this.maxTex = dev.maxTex;
    this.src = null; // { tex, w, h }
    this.hi = null;  // { tex, rect: [x, y, w, h] (photo 0-1), safe }
    this.guide = null;
    this.guideKey = '';
    this.guideGen = 0;
    this.curveTex = dev.texture('rgba16f', CURVE_SIZE, 1, new Float32Array(CURVE_SIZE * 4));
    this.hueTex = dev.texture('rgba16f', HUE_SIZE, 1, new Float32Array(HUE_SIZE * 4), { wrap: 'repeat' });
    this.blank = dev.texture('rgb16f', 1, 1, new Float32Array(3));
    /** Called when something only known after a read-back arrived and the picture should be drawn again (WebGPU). */
    this.onStale = null;
  }

  /** Whether the graphics card dropped this renderer (a driver reset). */
  lost() { return this.dev.lost(); }

  target(w, h, fmt = 'rgba16f', opts) { return this.dev.target(w, h, fmt, opts); }
  free(t) { this.dev.free(t); }
  draw(name, target, uniforms) { this.dev.draw(name, target, uniforms); }

  /** The whole photo (frame from the desktop side). */
  setSource(frame) {
    this.free(this.src);
    this.src = { tex: this.dev.texture('rgb16f', frame.w, frame.h, frame.data), w: frame.w, h: frame.h };
    this.guideKey = '';
    this.clearHi();
    this.setOpHi(null);
  }

  /** A full-resolution part of the photo; rect in photo coordinates (0-1). */
  setHi(frame, rect, safe) {
    this.clearHi();
    this.hi = { tex: this.dev.texture('rgb16f', frame.w, frame.h, frame.data), rect, safe: safe || rect };
  }

  clearHi() {
    if (this.hi) this.free(this.hi.tex);
    this.hi = null;
  }

  /** Sharper parts of the photo for clone and heal sources: Map op id -> { frame, rect }, or null. */
  setOpHi(map) {
    for (const h of this.opHi?.values() || []) this.free(h.tex);
    this.opHi = map && new Map([...map].map(([id, h]) => [id, { tex: this.dev.texture('rgb16f', h.frame.w, h.frame.h, h.frame.data), rect: h.rect, safe: h.rect }]));
  }

  /** Releases everything on the graphics card. */
  dispose() {
    this.disposed = true;
    this.free(this.src); this.clearHi(); this.free(this.histTarget); this.free(this.prevTarget); this.free(this.thumbTarget); this.free(this.lightTarget); this.setDisplay(null);
    for (const t of this.guide || []) this.free(t);
    this.freeGlow();
    this.free(this.curveTex); this.free(this.hueTex); this.free(this.blank);
    for (const t of [this.prof?.tone, this.prof?.hsm, this.prof?.laTex, this.prof?.lbTex]) if (t) this.free(t);
    this.free(this.acc);
    for (const t of this.maskTex || []) if (t) this.free(t.tex);
    this.composer?.dispose();
    this.setOpHi(null);
    if (this.maskCurveTex) this.free(this.maskCurveTex);
    this.dev.dispose();
  }

  /** Gives the canvas's graphics memory back now (Develop closing). */
  release() { this.dev.release(); }

  colorUniforms(info, s) {
    const key = `${s.profile}|${s.wb}|${s.temp}|${s.tint}|${s.redHue}|${s.redSat}|${s.greenHue}|${s.greenSat}|${s.blueHue}|${s.blueSat}`;
    if (this.colorKey !== key || this.colorInfo !== info) {
      const { wb, matrix, g } = cameraTransform(info, s);
      this.color = { uWB: wb, uCam: glMat(mul3(calibrationMatrix(s), matrix)), ...this.profileUniforms(adobeRendering(info, s.profile), g) };
      this.colorKey = key;
      this.colorInfo = info;
    }
    return this.color;
  }

  /** Lightroom's profile on the graphics card: its tables and tone curve (rebuilt when the profile or white changes). */
  profileUniforms(r, g) {
    const none = [0, 0, 0, 0];
    if (!r) return { uDcp: 0, uHsm: this.blank, uLookA: this.blank, uLookB: this.blank, uTone: this.blank, uHsmDims: none, uLookADims: none, uLookBDims: none };
    // Float tables, read exactly (texelFetch): no filtering.
    const table = (old, w, h, data, fmt = 'rgba32f') => {
      if (old) this.free(old);
      return this.dev.texture(fmt, w, h, data, { filter: 'nearest' });
    };
    const p = (this.prof ||= {});
    if (p.dcp !== r.dcp) {
      p.tone = table(p.tone, TONE_SIZE, 1, toneTable(r.dcp), 'r32f');
      p.hsmG = null;
    }
    const mapTex = (old, map) => { const px = hueSatPixels(map); return table(old, px.w, px.h, px.data); };
    const dims = (m) => [m.dims[0], m.dims[1], m.dims[2], m.srgb ? 1 : 0];
    const hsm = hueSatFor(r.dcp, g);
    if (hsm && (p.dcp !== r.dcp || p.hsmG !== g)) { p.hsm = mapTex(p.hsm, hsm); p.hsmG = g; }
    const [la, lb] = r.tables;
    if (p.la !== la) { p.laTex = la ? mapTex(p.laTex, la) : null; p.la = la; }
    if (p.lb !== lb) { p.lbTex = lb ? mapTex(p.lbTex, lb) : null; p.lb = lb; }
    p.dcp = r.dcp;
    return {
      uDcp: 1,
      uHsm: hsm ? p.hsm : this.blank, uHsmDims: hsm ? dims(hsm) : none,
      uLookA: la ? p.laTex : this.blank, uLookADims: la ? dims(la) : none,
      uLookB: lb ? p.lbTex : this.blank, uLookBDims: lb ? dims(lb) : none,
      uTone: p.tone,
      uS2P: glMat(SRGB_TO_PP), uP2S: glMat(PP_TO_SRGB),
    };
  }

  /** Rebuilds the blurred brightness guide when the photo or white balance changes. */
  updateGuide(info, s) {
    const key = `${s.profile}|${s.wb}|${s.temp}|${s.tint}|${s.redHue}|${s.redSat}|${s.greenHue}|${s.greenSat}|${s.blueHue}|${s.blueSat}`;
    if (this.guide && key === this.guideKey) return;
    const scale = GUIDE_EDGE / Math.max(this.src.w, this.src.h);
    const gw = Math.max(8, Math.round(this.src.w * scale)), gh = Math.max(8, Math.round(this.src.h * scale));
    if (!this.guide || this.guide[0].w !== gw || this.guide[0].h !== gh) {
      for (const t of this.guide || []) this.free(t);
      this.guide = [this.target(gw, gh), this.target(gw, gh), this.target(gw, gh)];
    }
    const [a, b, c] = this.guide;
    this.draw('down', a, { uSrc: this.src.tex, uOutSize: [gw, gh], ...this.colorUniforms(info, s) });
    const sigma = Math.max(gw, gh) / 45;
    this.draw('blur', b, { uTex: a.tex, uStep: [1 / gw, 0], uSigma: sigma });
    this.draw('blur', c, { uTex: b.tex, uStep: [0, 1 / gh], uSigma: sigma });
    this.airY = null; // measured when Dehaze needs it (reading back stalls the graphics card)
    this.lumSorted = null;
    this.lumWait = null;
    this.guideGen++;
    this.guideKey = key;
  }

  /**
   * Glow (glow.js): the light that glows (GLOW_SRC, at most GLOW_EDGE px),
   * halved down so each blur runs at a size where it is a few texels wide,
   * blurred (round styles) or smeared along Direction (Motion, Streak), then
   * mixed into one small picture in photo coordinates that the develop pass
   * adds. Redrawn only when what it depends on changes.
   */
  updateGlow(info, s, geo) {
    if (!glowUsed(s, this.masks)) { this.glowOn = false; return; }
    this.glowOn = true;
    const exposure = s.exposure + lookFor(info, s).exposure;
    const plan = this.glowPlan = glowPlan(s, exposure, geo.orientedToPhoto());
    const key = JSON.stringify([this.guideKey, geo.rot, { ...plan, amount: 0 }]);
    if (this.glow && this.glowSrc === this.src && key === this.glowKey) return;
    const scale = Math.min(1, GLOW_EDGE / Math.max(this.src.w, this.src.h));
    const w0 = Math.max(8, Math.round(this.src.w * scale)), h0 = Math.max(8, Math.round(this.src.h * scale));
    if (!this.glow || this.glow.w !== w0 || this.glow.h !== h0) {
      this.freeGlow();
      const levels = [];
      for (let i = 0, w = w0, h = h0; i < LEVELS; i++, w = Math.max(4, Math.ceil(w / 2)), h = Math.max(4, Math.ceil(h / 2))) {
        levels.push({ a: this.target(w, h), b: this.target(w, h), w, h });
      }
      this.glow = { w: w0, h: h0, levels, res: [], out: this.target(w0, h0) };
    }
    const { levels, out } = this.glow;
    const edge = Math.max(w0, h0);
    // A result target per blur, at the size of the level it ran at.
    const res = (k, L) => {
      const r = this.glow.res[k];
      if (r && r.w === L.w && r.h === L.h) return r.t;
      if (r) this.free(r.t);
      this.glow.res[k] = { t: this.target(L.w, L.h), w: L.w, h: L.h };
      return this.glow.res[k].t;
    };
    // The slight pre-blur widens what each glow pixel averages (a box that wide).
    const w = [plan.w[0], plan.w[1], plan.w[2], Math.max(1, plan.pre * edge * Math.sqrt(12))];
    this.draw('glowSrc', levels[0].a, { uSrc: this.src.tex, uOutSize: [w0, h0], uGlowGain: plan.gain, uGlowMode: plan.mode, uGlowW: w, uContrast: lookFor(info, s).contrast, ...this.colorUniforms(info, s) });
    // Down only as far as the widest blur needs.
    const levelFor = (px, per) => Math.max(0, Math.min(LEVELS - 1, Math.floor(Math.log2(px / per))));
    let need = 0;
    const jobs = [];
    if (plan.dir) {
      const i = Math.max(0, Math.min(LEVELS - 1, Math.ceil(Math.log2(plan.len * edge / 48))));
      jobs.push(i); need = i;
    } else {
      plan.blur.forEach((b, k) => { if (plan.mix[k] > 0) { const i = levelFor(b * edge, 3); jobs[k] = i; need = Math.max(need, i); } });
    }
    for (let i = 1; i <= need; i++) this.draw('glowDown', levels[i].a, { uTex: levels[i - 1].a.tex, uOutSize: [levels[i].w, levels[i].h] });
    const tex = [this.blank, this.blank];
    if (plan.dir) {
      const L = levels[jobs[0]], le = Math.max(L.w, L.h);
      const tx = plan.dir[0] * L.w, ty = plan.dir[1] * L.h, n = Math.hypot(tx, ty) || 1;
      const u = [tx / n, ty / n], v = [-u[1], u[0]];
      this.draw('blur', L.b, { uTex: L.a.tex, uStep: [v[0] / L.w, v[1] / L.h], uSigma: Math.max(0.05, plan.across * le) });
      const r = res(0, L);
      this.draw('glowLine', r, { uTex: L.b.tex, uStep: [u[0] / L.w, u[1] / L.h], uLen: plan.len * le, uOneSided: plan.one });
      tex[0] = r.tex;
    } else {
      jobs.forEach((i, k) => {
        if (i === undefined) return;
        const L = levels[i], sigma = Math.max(0.05, (plan.blur[k] * Math.max(L.w, L.h)));
        const r = res(k, L);
        this.draw('blur', L.b, { uTex: L.a.tex, uStep: [1 / L.w, 0], uSigma: sigma });
        this.draw('blur', r, { uTex: L.b.tex, uStep: [0, 1 / L.h], uSigma: sigma });
        tex[k] = r.tex;
      });
    }
    this.draw('glowMix', out, { uG0: tex[0], uG1: tex[1], uGlowW: plan.mix, uGlowTint: plan.tint, uOutSize: [w0, h0] });
    this.glowSrc = this.src;
    this.glowKey = key;
  }

  freeGlow() {
    for (const L of this.glow?.levels || []) { this.free(L.a); this.free(L.b); }
    for (const r of this.glow?.res || []) if (r) this.free(r.t);
    if (this.glow) this.free(this.glow.out);
    this.glow = null;
    this.glowKey = '';
  }

  /**
   * The guide's brightness (log2 scene light), sorted; read back once per
   * guide (it stalls the graphics card). On WebGPU the first ask starts the
   * read and gives null; onStale is called when it's there.
   */
  guideLum() {
    if (this.lumSorted) return this.lumSorted;
    const a = this.guide[0];
    const sort = (px) => {
      const lum = new Float32Array(a.w * a.h);
      for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4];
      return lum.sort();
    };
    const px = this.lumWait || this.dev.read(a, 0, 0, a.w, a.h, 'f32');
    if (!(px instanceof Promise)) return (this.lumSorted = sort(px));
    if (!this.lumWait) {
      const gen = this.guideGen;
      this.lumWait = px;
      px.then((got) => {
        if (gen !== this.guideGen || !got || this.disposed) return;
        this.lumSorted = sort(got);
        this.lumWait = null;
        this.onStale?.();
      });
    }
    return null;
  }

  /** Airlight for dehaze: the brightness the haziest parts tend toward. */
  measureAir() {
    const lum = this.guideLum();
    if (lum) this.airY = Math.min(1, 2 ** lum[Math.floor(lum.length * 0.995)]);
  }

  /** What the adaptive sliders need from the photo itself (Dehaze's airlight, the middle brightness). */
  measure(s) {
    if ((s.dehaze || this.masks.some((m) => m.adj?.dehaze)) && this.airY == null) this.measureAir();
    // The photo's middle brightness, for the adaptive sliders: read once per photo, when they're used.
    if ((s.shadows > 0 || s.blacks > 0 || s.highlights < 0) && this.keySrc !== this.src) {
      const lum = this.guideLum();
      if (!lum) return;
      this.keyL = lum[lum.length >> 1];
      this.spanL = lum[Math.min(lum.length - 1, Math.floor(lum.length * 0.999))] - this.keyL;
      this.keySrc = this.src;
    }
  }

  /** Waits until a render of these settings has everything it measures (WebGPU reads back; WebGL2 has it at once). */
  async prepare(info, s) {
    if (!this.src) return;
    this.updateGuide(info, s);
    this.masks = (s.masks || []).filter((m) => !m.hidden).slice(0, MAX_MASKS);
    this.measure(s);
    if (this.lumWait) { await this.lumWait; this.measure(s); }
  }

  updateLuts(s, info) {
    // Only rebuilt when their own settings change (cheap to compare: the
    // curves are kept as the same arrays until edited). A look's curve (Adobe
    // Color's) comes first.
    const look = adobeRendering(info, s.profile)?.curve || null;
    const c = [s.curve, s.curveR, s.curveG, s.curveB, s.pShadows, s.pDarks, s.pLights, s.pHighlights, s.pSplitS, s.pSplitM, s.pSplitH, look];
    if (!this.curveKey || c.some((x, i) => x !== this.curveKey[i])) {
      this.dev.upload(this.curveTex, 0, 0, CURVE_SIZE, 1, curveTable(s, look));
      this.curveKey = c;
    }
    const h = [];
    for (let i = 0; i < 8; i++) h.push(s[`hue${i}`], s[`sat${i}`], s[`lum${i}`], s[`gray${i}`]);
    if (!this.hueKey || h.some((x, i) => x !== this.hueKey[i])) {
      this.dev.upload(this.hueTex, 0, 0, HUE_SIZE, 1, hueTable(s));
      this.hueKey = h;
    }
  }

  /**
   * Puts the shown masks on the graphics card: four to a texture, one per
   * channel. Uploaded again only when a mask's shape changes.
   */
  updateMasks(s, geo) {
    const masks = (s.masks || []).filter((m) => !m.hidden).slice(0, MAX_MASKS);
    this.masks = masks;
    // Textures of masks not drawn for a while (another photo's, or removed
    // ones) are given back: each holds four full mask images on the graphics
    // card. Not at once, so Before / After and the small pictures made without
    // masks don't send them to the card again.
    const groups = Math.ceil(masks.length / 4), now = performance.now();
    (this.maskTex || []).forEach((t, i) => {
      if (!t) return;
      if (i < groups) t.used = now;
      else if (now - t.used > MASK_TEX_IDLE) { this.free(t.tex); this.maskTex[i] = null; }
    });
    if (!masks.length) return;
    const rasters = masks.map((m) => maskRaster(m, geo.ow, geo.oh));
    this.maskTex ||= [];
    for (let t = 0; t * 4 < rasters.length; t++) {
      const group = rasters.slice(t * 4, t * 4 + 4);
      const cur = this.maskTex[t];
      if (cur && cur.rasters.length === group.length && cur.rasters.every((r, i) => r === group[i])) continue;
      const { W, H } = group[0];
      // A brush stroke changes a small patch: only that goes to the graphics card.
      const rect = cur && cur.W === W && cur.H === H && cur.rasters.length === group.length && changedRect(group, cur.rasters);
      if (rect) {
        const [x, y, w, h] = rect;
        cur.rasters = group;
        if (!w || !h) continue;
        const px = new Uint8Array(w * h * 4);
        group.forEach((r, c) => {
          const d = r.data;
          for (let j = 0; j < h; j++) for (let i = 0, s = (y + j) * W + x, o = j * w * 4 + c; i < w; i++, o += 4) px[o] = d[s + i];
        });
        this.dev.upload(cur.tex, x, y, w, h, px);
        continue;
      }
      const px = new Uint8Array(W * H * 4);
      group.forEach((r, c) => { const d = r.data; for (let i = 0; i < d.length; i++) px[i * 4 + c] = d[i]; });
      if (cur && cur.W === W && cur.H === H) {
        this.dev.upload(cur.tex, 0, 0, W, H, px);
        cur.rasters = group;
      } else {
        if (cur) this.free(cur.tex);
        this.maskTex[t] = { tex: this.dev.texture('rgba8', W, H, px), W, H, rasters: group, used: now };
      }
    }
  }

  /** Each mask's own curve (Curve section), one row per mask. */
  updateMaskCurves() {
    const key = this.masks.map((m) => (m.curve && !m.off?.curve ? m.curve : null));
    if (this.maskCurveKey && key.length === this.maskCurveKey.length && key.every((c, i) => c === this.maskCurveKey[i])) return;
    this.maskCurveKey = key;
    this.maskCurveTex ||= this.dev.texture('rgba16f', CURVE_SIZE, MAX_MASKS, new Float32Array(CURVE_SIZE * MAX_MASKS * 4));
    key.forEach((c, i) => { if (c) this.dev.upload(this.maskCurveTex, 0, i, CURVE_SIZE, 1, curveTable(c)); });
  }

  maskUniforms(view, geo) {
    const masks = this.masks || [];
    const arr = () => new Float32Array(MAX_MASKS * 4);
    const [A, B, C, D, E, F, P, Q, R, S] = Array.from({ length: 10 }, arr);
    const grainPx = (size) => (0.5 + (size / 100) * 3.5) * Math.max(1, Math.max(geo.ow, geo.oh) / 4000);
    masks.forEach((m, i) => {
      const a = (k) => adjOf(m, k), g = (k) => a(k) / 100;
      A.set([a('exposure'), g('contrast'), g('highlights'), g('shadows')], i * 4);
      B.set([g('whites'), g('blacks'), g('texture'), g('clarity')], i * 4);
      C.set([g('dehaze'), g('saturation'), g('temp'), g('tint')], i * 4);
      D.set([g('hue'), g('sharpness'), g('noise'), (m.amount ?? 100) / 100], i * 4);
      // Grain size and roughness are weighted by the amount, so masks blend sensibly.
      E.set([g('grain'), g('grain') * grainPx(a('grainSize')), g('grain') * g('grainRough'), Math.max(0, g('moire'))], i * 4);
      // Colour swatch: a tint with no brightness of its own.
      const t = m.tint && !m.off?.color ? m.tint : null;
      const tint = t ? hueRgb(t.hue).map((c) => (c - 1 / 3) * (t.sat / 100)) : [0, 0, 0];
      F.set([g('defringe'), ...tint], i * 4);
      const pc = m.point && !m.off?.point ? { ...POINT_DEFAULT, ...m.point } : null;
      if (pc) {
        P.set([pc.h, pc.s, pc.v, 1], i * 4);
        Q.set([pc.hue * 0.6, pc.sat / 100, pc.lum / 100, 0.04 + (pc.range / 100) * 0.4], i * 4);
      }
      S.set([pc ? pc.variance / 100 : 0, m.curve && !m.off?.curve ? 1 : 0, (m.refineSat ?? 100) / 100, g('glow')], i * 4);
      const lr = lumRange(m);
      R.set(lr ? [lr.lo / 100, lr.hi / 100, lr.smooth / 100, 1 + (m.invert ? 2 : 0)] : [0, 1, 0, m.invert ? 2 : 0], i * 4);
    });
    const sel = view ? masks.findIndex((m) => m.id === view.id) : -1;
    const tex = this.maskTex || [];
    return {
      uME: E, uMF: F, uMP: P, uMQ: Q, uMS: S,
      uMaskCurve: this.maskCurveTex || this.blank,
      uPointView: view?.point ? sel : -1,
      uMaskN: masks.length,
      uMask0: masks.length ? tex[0].tex : this.blank,
      uMask1: masks.length > 4 ? tex[1].tex : this.blank,
      uMask2: masks.length > 8 ? tex[2].tex : this.blank,
      uMask3: masks.length > 12 ? tex[3].tex : this.blank,
      uMA: A, uMB: B, uMC: C, uMD: D, uMR: R,
      uMaskView: view?.noOverlay ? -1 : sel,
      uMaskColor: view?.color || [1, 0.2, 0.3],
      uMaskOpacity: view ? view.opacity : 0,
      uMaskStyle: view ? MASK_STYLES.indexOf(view.style) : 0,
      uMaskLine: view?.line || 1.5,
      uMaskFeather: view?.ai ? 0 : 1,
    };
  }

  /**
   * Renders into `target` (null = the canvas). `out2frame` maps output pixels
   * to the crop frame; geo/frame say where that frame sits in the photo.
   */
  render(info, s, geo, frame, out2frame, { target = null, showClip = false, maskView = null, live = null } = {}) {
    if (!this.src) return;
    if (!target && this.display) {
      this.renderScreen(info, s, geo, frame, out2frame, { showClip, maskView, live });
      return;
    }
    this.updateGuide(info, s);
    this.updateLuts(s, info);
    this.updateMasks(s, geo);
    this.updateGlow(info, s, geo);
    if (this.masks.length) this.updateMaskCurves();
    this.measure(s);
    const out2ori = mm(geo.frameToOriented(frame), out2frame);
    // Retouch layers on top (compose.js); `live` is a stroke still being painted.
    const layers = renderLayers(s.layers || [], live?.layerId);
    if (!layers.length) { this.drawPhoto(info, s, geo, frame, out2frame, out2ori, target, showClip, maskView, null); return; }
    this.composer ||= new Composer(this);
    this.composer.render((t, extra) => (extra
      ? this.drawPhoto(info, s, geo, frame, out2frame, mm(mat(1, 0, extra.shift[0], 0, 1, extra.shift[1]), extra.out2ori || out2ori), t, false, null, extra.op && this.opHi?.get(extra.op.id))
      : this.drawPhoto(info, s, geo, frame, out2frame, out2ori, t, showClip, maskView, null)), layers, geo, out2ori, target, live,
    [s, info, frame, this.src, this.hi, this.opHi, showClip, maskView && JSON.stringify(maskView), this.melissa, this.keySrc === this.src, this.airY]);
  }

  /**
   * The canvas at a fraction of its pixels, stretched up: about a quarter of
   * the graphics work, for frames drawn while a setting is being dragged on
   * weak built-in graphics (develop/graphics.js). A full frame follows.
   */
  renderLight(info, s, geo, frame, view, opts, f = 0.5) {
    const W = this.dev.width(), H = this.dev.height();
    const w = Math.max(1, Math.round(W * f)), h = Math.max(1, Math.round(H * f));
    // Screen colour correction reads a float target; without it, an 8-bit one is blitted.
    const fmt = this.display ? 'rgba16f' : 'rgba8';
    const t = this.lightTarget;
    if (!t || t.w !== w || t.h !== h || t.fmt !== fmt) {
      this.free(t);
      this.lightTarget = this.target(w, h, fmt);
    }
    this.render(info, s, geo, frame, outToFrame(w, h, frame, { ...view, scale: (view.scale * w) / W }), { ...opts, target: this.lightTarget });
    if (this.display) { this.present(this.lightTarget); return; }
    this.dev.blit(this.lightTarget, null, true);
  }

  /** Wait for the graphics card to finish the submitted full-quality frame. */
  waitFrame() {
    if (this.disposed) return Promise.resolve(false);
    return this.dev.waitFrame();
  }

  /**
   * Corrects what the canvas shows for this screen (icc.js displayTransform),
   * or stops correcting (null). Only the canvas: exports, the histogram and
   * previews stay sRGB.
   */
  setDisplay(tr) {
    if (this.display) this.free(this.display.lut);
    this.free(this.screenTarget);
    this.screenTarget = null;
    this.display = tr && !this.disposed ? { m: tr.m, lut: this.dev.texture('rgba16f', LUT_SIZE, 1, tr.lut) } : null;
  }

  /** A screen-sized render, then corrected onto the canvas. */
  renderScreen(info, s, geo, frame, out2frame, opts) {
    const W = this.dev.width(), H = this.dev.height();
    if (!this.screenTarget || this.screenTarget.w !== W || this.screenTarget.h !== H) {
      this.free(this.screenTarget);
      this.screenTarget = this.target(W, H);
    }
    this.render(info, s, geo, frame, out2frame, { ...opts, target: this.screenTarget });
    this.present(this.screenTarget);
  }

  present(t) {
    const d = this.display;
    this.draw('display', null, { uTex: t.tex, uLut: d.lut, uDispM: d.m, uSize: [this.dev.width(), this.dev.height()], uLutN: LUT_SIZE });
  }

  /** The developed photo; out2ori may be shifted (a clone's source), sharper may stand in for this.hi. */
  drawPhoto(info, s, geo, frame, out2frame, out2ori, target, showClip, maskView, sharper) {
    const hi = sharper || this.hi;
    const look = lookFor(info, s);
    const key = this.keySrc === this.src ? this.keyL : null;
    const lift = liftScale(key == null ? null : this.spanL);
    const { cx, cy, half } = centred(geo);
    const [tS, tM, tH, tG] = gradeTints(s);
    const gradeLum = [s.gShadowLum, s.gMidLum, s.gHighLum, s.gGlobalLum].map((v) => (v || 0) / 100);
    const gradeOn = [tS, tM, tH, tG].some((t) => t[2] !== 0) || gradeLum.some((v) => v !== 0);
    const defringe = s.removeCA ? 0.5 : 0;
    // The vignette follows the crop even when the frame shown is another (the whole photo, in crop mode).
    const crop = geo.frame(s.crop);
    const out2vig = mm(inv3(geo.frameToOriented(crop)), mm(geo.frameToOriented(frame), out2frame));
    this.draw('final', target, {
      uSrc: this.src.tex,
      uHi: hi ? hi.tex : this.blank,
      uHiRect: hi ? hi.rect : [0, 0, 0, 0],
      uHiSafe: hi ? hi.safe : [0, 0, 0, 0],
      uGuide: this.guide[2].tex,
      uGlow: this.glowOn ? this.glow.out.tex : this.blank,
      uGlowMix: this.glowOn ? [this.glowPlan.amount, this.glowPlan.mode, 0, 1] : [0, 0, 0, 0],
      uGlowF: this.glowOn ? this.glowPlan.final : [0, 0, 0, 0],
      uGlowF2: this.glowOn ? this.glowPlan.final2 : [0, 0, 0, 0],
      uCurve: this.curveTex,
      uHue: this.hueTex,
      uOut2Ori: glMat(out2ori),
      uOri2Photo: glMat(geo.orientedToPhoto()),
      uOriCenter: [cx, cy],
      uOriHalf: half,
      uCornerR2: (cx * cx + cy * cy) / (half * half),
      uPersp: glMat(perspective(s)),
      uDistort: ((s.distortion || 0) / 100) * 0.25,
      ...lensUniforms(geo.lensFor(s)),
      uLensVig: (s.lensVignette || 0) / 100,
      uLensVigMid: (s.lensVignetteMid ?? 50) / 100,
      uDefringeP: Math.max(defringe, (s.defringePurple || 0) / 20),
      uDefringeG: Math.max(defringe, (s.defringeGreen || 0) / 20),
      uShadowTint: (s.shadowTint || 0) / 100,
      uNrLumDetail: (s.nrLumDetail ?? 50) / 100,
      uNrLumContrast: (s.nrLumContrast || 0) / 100,
      uNrColorDetail: (s.nrColorDetail ?? 50) / 100,
      uNrColorSmooth: (s.nrColorSmooth ?? 50) / 100,
      uVigStyle: s.vignetteStyle || 1,
      uVigHighlights: (s.vignetteHighlights || 0) / 100,
      uRefineSat: (s.refineSat ?? 100) / 100,
      uBW: s.bw ? 1 : 0,
      uGradeOn: gradeOn ? 1 : 0,
      uGradeS: tS, uGradeM: tM, uGradeH: tH, uGradeG: tG,
      uGradeLum: gradeLum,
      uGradeShape: [(s.gBlending ?? 50) / 100, (s.gBalance || 0) / 100],
      uGrain: [(s.grain || 0) / 100, (0.5 + ((s.grainSize ?? 25) / 100) * 3.5) * Math.max(1, Math.max(geo.ow, geo.oh) / 4000), (s.grainRough ?? 50) / 100],
      uOut2Crop: glMat(out2frame),
      uPhotoPx: [1 / geo.sw, 1 / geo.sh],
      uOut2Vig: glMat(out2vig),
      uCropAspect: crop.hw / crop.hh,
      uBg: [0.2275, 0.2275, 0.2275],
      ...this.colorUniforms(info, s),
      uExposure: s.exposure + look.exposure,
      uContrast: look.contrast,
      uContrastSat: s.contrast / 100,
      ...tonemapUniforms(s),
      uHighlights: s.highlights / 100,
      uHlTop: highlightTop(key),
      uShadows: (s.shadows > 0 ? s.shadows * lift : s.shadows) / 100,
      uWhites: s.whites / 100,
      uBlacks: (s.blacks > 0 ? s.blacks * lift : s.blacks) / 100,
      uTexture: s.texture / 100,
      uClarity: s.clarity / 100,
      uDehaze: s.dehaze / 100,
      uVibrance: s.vibrance / 100,
      uSaturation: (1 + s.saturation / 100) * look.saturation - 1,
      uBaseSat: look.baseSat ?? 1,
      uAirY: this.airY || 1,
      uSharpen: (s.sharpen / 100) * 1.1,
      uSharpenRadius: s.sharpenRadius,
      uSharpenDetail: s.sharpenDetail / 100,
      uSharpenMasking: s.sharpenMasking / 100,
      uNrLum: s.nrLuminance / 100,
      uNrColor: s.nrColor / 100,
      uVignette: s.vignette / 100,
      uVigMid: s.vignetteMidpoint / 100,
      uVigRound: s.vignetteRoundness / 100,
      uVigFeather: s.vignetteFeather / 100,
      uShowClip: showClip ? 1 : 0,
      uMelissa: this.melissa ? 1 : 0,
      uOriSize: [geo.ow, geo.oh],
      ...this.maskUniforms(maskView, geo),
    });
  }

  /** A target's pixels (bottom row first), read without making the page wait for the graphics card: resolves once it has (null if it went away). */
  readLater(t) { return Promise.resolve(this.dev.read(t, 0, 0, t.w, t.h, 'u8', true)); }

  /** A whole target's pixels: at once on WebGL2 (unless later), a promise on WebGPU. */
  readAll(t, later) { return this.dev.read(t, 0, 0, t.w, t.h, 'u8', later); }

  /**
   * Renders a small copy and counts its pixels per level, for the histogram.
   * `later`: a promise, without waiting for the graphics card (always on WebGPU).
   */
  histogram(info, s, geo, frame, later = false) {
    const k = 256 / Math.max(frame.hw, frame.hh) / 2;
    const w = Math.max(8, Math.round(frame.hw * 2 * k)), h = Math.max(8, Math.round(frame.hh * 2 * k));
    if (!this.histTarget || this.histTarget.w !== w || this.histTarget.h !== h) {
      this.free(this.histTarget);
      this.histTarget = this.target(w, h, 'rgba8');
    }
    const saveHi = this.hi;
    this.hi = null;
    const o2f = outToFrame(w, h, frame, { scale: k, u: 0, v: 0 });
    const count = (px) => {
      if (!px) return null;
      const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      for (let i = 0; i < px.length; i += 4) { bins[0][px[i]]++; bins[1][px[i + 1]]++; bins[2][px[i + 2]]++; }
      bins.px = px; bins.w = w; bins.h = h; // the pixels themselves, for the Vectorscope
      return bins;
    };
    const read = () => {
      const px = this.readAll(this.histTarget, later);
      return px instanceof Promise ? px.then(count) : count(px);
    };
    // Counted in Melissa RGB (ProPhoto colours, sRGB tones), as Lightroom's histogram is.
    let out, pre;
    this.melissa = true;
    try {
      this.render(info, s, geo, frame, o2f, { target: this.histTarget });
      out = read();
      // What goes into the tone curve (the photo without it), which Lightroom
      // draws behind the curve. Reads are queued in order, so reusing the target is safe.
      this.render(info, { ...s, ...FLAT_CURVE }, geo, frame, o2f, { target: this.histTarget });
      pre = read();
    } finally {
      // Put back even if a draw fails, or the photo itself would be drawn this way from then on.
      this.melissa = false;
      this.hi = saveHi;
    }
    const join = (a, b) => { if (b) delete b.px; return a ? Object.assign(a, { pre: b }) : null; };
    return out instanceof Promise || pre instanceof Promise ? Promise.all([out, pre]).then(([a, b]) => join(a, b)) : join(out, pre);
  }

  /** A small copy of the whole (cropped) photo, for the mask preview; pixels bottom row first. `later` as for histogram(). */
  preview(info, s, geo, frame, w, h, maskView, later = false, slot = 'prevTarget') {
    if (!this[slot] || this[slot].w !== w || this[slot].h !== h) {
      this.free(this[slot]);
      this[slot] = this.target(w, h, 'rgba8');
    }
    const saveHi = this.hi;
    this.hi = null;
    try {
      this.render(info, s, geo, frame, outToFrame(w, h, frame, { scale: fitScale(w, h, frame), u: 0, v: 0 }), { target: this[slot], maskView });
    } finally {
      this.hi = saveHi;
    }
    return this.readAll(this[slot], later);
  }

  /** The same, once everything it measures is known (always a promise): for pictures worked on off the screen. */
  async previewReady(info, s, geo, frame, w, h, maskView, slot) {
    await this.prepare(info, s);
    return this.preview(info, s, geo, frame, w, h, maskView, false, slot);
  }

  /** The colour on the canvas around (x, y) (canvas px, y up) as last drawn, 0-1 (a promise on WebGPU). */
  readShown(x, y) {
    // With screen correction, the photo's own colours from before it.
    const t = this.display && this.screenTarget;
    const avg = (px, f) => {
      if (!px) return null;
      const c = [0, 0, 0];
      for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) c[k] += f(px[i * 4 + k]) / 9;
      return c;
    };
    const W = t ? t.w : this.dev.width(), H = t ? t.h : this.dev.height();
    if (W < 3 || H < 3) return null;
    const x0 = Math.min(W - 3, Math.max(0, x - 1)), y0 = Math.min(H - 3, Math.max(0, y - 1));
    const px = t ? this.dev.read(t, x0, y0, 3, 3, 'f32') : this.dev.read(null, x0, y0, 3, 3, 'u8');
    const done = (p) => avg(p, t ? (v) => Math.min(1, Math.max(0, v)) : (v) => v / 255);
    return px instanceof Promise ? px.then(done) : done(px);
  }

  /**
   * Full quality, as Lightroom shows a photo smaller than 100%: the view
   * processed from full-resolution raw data (sharpening, texture and noise
   * reduction at their real size), in tiles, each scaled down (Lanczos over its
   * mipmaps, shaders.js RESAMPLE) into a screen-sized picture, which is then shown.
   * regionFor(x, y, w, h) gives the sensor rectangle an output tile needs
   * (or null); fetchRegion(rect) its demosaiced pixels; current() turns false
   * once the view or settings change (the work stops, nothing is shown).
   * Returns whether it was shown.
   */
  async refine({ info, s, geo, frame, out2frame, regionFor, fetchRegion, current, opts = {} }) {
    const W = this.dev.width(), H = this.dev.height();
    const o2o = mm(geo.frameToOriented(frame), out2frame);
    const k = 1 / Math.hypot(o2o[0], o2o[3]); // output px per sensor px
    if (!(k < 0.98) || !this.src) return false;
    if (!this.acc || this.acc.w !== W || this.acc.h !== H) { this.free(this.acc); this.acc = this.target(W, H); }
    const T = Math.max(64, Math.floor(Math.min(2048, this.maxTex) * k));
    // Tiles draw at sensor size and are shrunk by k: the mask outline (a width
    // in drawn pixels) is widened to match, or it thinned to nothing once the
    // sharp tiles replaced the first frame.
    const mv = opts.maskView;
    if (mv) opts = { ...opts, maskView: { ...mv, line: (mv.line || 1.5) / k } };
    try {
      for (let ty = 0; ty < H; ty += T) {
        for (let tx = 0; tx < W; tx += T) {
          if (!current() || this.disposed) return false;
          const ow = Math.min(T, W - tx), oh = Math.min(T, H - ty);
          const tw = Math.max(1, Math.round(ow / k)), th = Math.max(1, Math.round(oh / k));
          const rect = regionFor(tx, ty, ow, oh);
          const f = rect ? await fetchRegion(rect) : null;
          if (!current() || this.disposed) return false;
          let hi = null;
          if (f) {
            const r = [rect.x / geo.sw, rect.y / geo.sh, rect.w / geo.sw, rect.h / geo.sh];
            hi = { tex: this.dev.texture('rgb16f', f.w, f.h, f.data), rect: r, safe: r };
          }
          // The tile's own full-resolution pixels stand in for the view's
          // just while it renders (nothing else runs in between).
          const keep = this.hi;
          const t = this.target(tw, th, 'rgba16f', { mips: true });
          let done;
          // The tile's buffer is given back however this ends (a failed draw used to leave it on the card).
          try {
            this.hi = hi;
            try {
              this.render(info, s, geo, frame, mm(out2frame, mat(ow / tw, 0, tx, 0, oh / th, ty)), { ...opts, target: t });
            } finally {
              this.hi = keep;
              if (hi) this.free(hi.tex);
            }
            this.dev.mipmaps(t);
            this.dev.draw('resample', this.acc, { uTex: t.tex, uRect: [tx, ty, ow, oh], uScale: tw / ow }, [tx, ty, ow, oh]);
            done = await this.waitFrame();
          } finally {
            this.free(t);
          }
          if (!done || !current()) return false;
          await new Promise((res) => setTimeout(res, 0)); // let the page breathe between tiles
        }
      }
    } catch (e) {
      return false;
    }
    if (!current() || this.disposed) return false;
    if (this.display) this.present(this.acc);
    else this.dev.draw('copy', null, { uTex: this.acc.tex, uRect: [0, 0, W, H] }, [0, 0, W, H]);
    if (!(await this.waitFrame())) return false;
    return true;
  }

  /** Renders a w x h tile and returns its 8-bit pixels (bottom row first): a promise on WebGPU. */
  renderTile(info, s, geo, frame, out2frame, w, h) {
    const t = this.target(w, h, 'rgba8');
    this.render(info, s, geo, frame, out2frame, { target: t });
    const px = this.readAll(t, false);
    if (px instanceof Promise) return px.finally(() => this.free(t));
    this.free(t);
    return px;
  }
}

export { mm, ap, mat, glMat };
