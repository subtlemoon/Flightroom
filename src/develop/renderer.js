// Draws a RAW photo with develop settings using WebGL2. The decoded photo lives
// on the graphics card as half-float camera RGB; every redraw runs the whole
// develop pipeline (shaders.js) for just the pixels on screen.
import { VERT, GUIDE_DOWN, BLUR, FINAL } from './shaders.js';
import { colorTransform, inv3, mul3 } from './color.js';
import { CURVE_SIZE, HUE_SIZE, calibrationMatrix, curveTable, gradeTints, hueTable } from './luts.js';
import { MAX_MASKS, POINT_DEFAULT, adjOf, lumRange, maskRaster } from './masks.js';
import { tonemapUniforms } from './tonemap.js';

const GUIDE_EDGE = 320;
// The base rendering under the sliders, per profile (params.js PROFILES).
// Fitted to Lightroom's Adobe Color and to the Z7 II's own JPEGs.
export const LOOKS = {
  adobe: { exposure: 1.05, contrast: 0.4, saturation: 0.9 },
  camera: { exposure: 0.95, contrast: 0.4, saturation: 1.25 },
  // darktable's AgX: its film-like curve, with a little contrast and colour on top as darktable sets it.
  agx: { exposure: 1.0, contrast: 0.3, saturation: 1.3, agx: true },
};

export function parseFrame(buf) {
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== 0x4d495246) throw new Error('bad image data'); // "FRIM"
  const w = v.getUint32(4, true), h = v.getUint32(8, true);
  return { w, h, data: new Uint16Array(buf, 16, w * h * 3) };
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
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

// Rotation (clockwise degrees) for an EXIF orientation.
const ROT = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

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
  constructor(sw, sh, orientation) {
    this.sw = sw; this.sh = sh;
    this.rot = ROT[orientation] || 0;
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

/** Maps a point of the finished photo (oriented px) to photo coordinates (0-1); null when outside the source. */
export function sourceMap(geo, s) {
  const { cx, cy, half } = centred(geo);
  const P = perspective(s);
  const corner = (cx * cx + cy * cy) / (half * half);
  const k = ((s.distortion || 0) / 100) * 0.25;
  const o2p = geo.orientedToPhoto();
  return (x, y) => {
    let nx = (x - cx) / half, ny = (y - cy) / half;
    const w = P[6] * nx + P[7] * ny + P[8];
    [nx, ny] = [(P[0] * nx + P[1] * ny + P[2]) / w, (P[3] * nx + P[4] * ny + P[5]) / w];
    const f = 1 - k * ((nx * nx + ny * ny) / corner);
    return ap(o2p, nx * f * half + cx, ny * f * half + cy);
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

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl || gl.isContextLost()) throw new Error('WebGL2 is not available on this graphics card');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('This graphics card has no float rendering');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.down = program(gl, GUIDE_DOWN);
    this.blur = program(gl, BLUR);
    this.final = program(gl, FINAL);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.src = null; // { tex, w, h }
    this.hi = null;  // { tex, rect: [x, y, w, h] (photo 0-1), safe }
    this.guide = null;
    this.guideKey = '';
    this.curveTex = this.texture(gl.RGBA16F, CURVE_SIZE, 1, gl.RGBA, gl.FLOAT, new Float32Array(CURVE_SIZE * 4));
    this.hueTex = this.texture(gl.RGBA16F, HUE_SIZE, 1, gl.RGBA, gl.FLOAT, new Float32Array(HUE_SIZE * 4), gl.REPEAT);
    this.blank = this.texture(gl.RGB16F, 1, 1, gl.RGB, gl.FLOAT, new Float32Array(3));
  }

  texture(internal, w, h, format, type, data, wrap) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  target(w, h, internal = this.gl.RGBA16F) {
    const gl = this.gl;
    const tex = this.texture(internal, w, h, gl.RGBA, internal === gl.RGBA8 ? gl.UNSIGNED_BYTE : gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  free(t) {
    if (!t) return;
    const gl = this.gl;
    if (t.fb) gl.deleteFramebuffer(t.fb);
    if (t.tex) gl.deleteTexture(t.tex);
  }

  /** The whole photo (frame from the desktop side). */
  setSource(frame) {
    this.free(this.src);
    const gl = this.gl;
    this.src = { tex: this.texture(gl.RGB16F, frame.w, frame.h, gl.RGB, gl.HALF_FLOAT, frame.data), w: frame.w, h: frame.h };
    this.guideKey = '';
    this.clearHi();
  }

  /** A full-resolution part of the photo; rect in photo coordinates (0-1). */
  setHi(frame, rect, safe) {
    this.clearHi();
    const gl = this.gl;
    this.hi = { tex: this.texture(gl.RGB16F, frame.w, frame.h, gl.RGB, gl.HALF_FLOAT, frame.data), rect, safe: safe || rect };
  }

  clearHi() {
    if (this.hi) this.gl.deleteTexture(this.hi.tex);
    this.hi = null;
  }

  /** Releases everything on the graphics card. */
  dispose() {
    const gl = this.gl;
    this.free(this.src); this.clearHi(); this.free(this.histTarget); this.free(this.prevTarget);
    for (const t of this.guide || []) this.free(t);
    gl.deleteTexture(this.curveTex); gl.deleteTexture(this.hueTex); gl.deleteTexture(this.blank);
    for (const t of this.maskTex || []) gl.deleteTexture(t.tex);
    if (this.maskCurveTex) gl.deleteTexture(this.maskCurveTex);
    // An offscreen (export) context is done for good; a page canvas may be
    // given a new renderer (React remounts), so its context must stay usable.
    if (typeof OffscreenCanvas !== 'undefined' && this.canvas instanceof OffscreenCanvas) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  draw(prog, target, uniforms) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    let unit = 0;
    for (const [k, v] of Object.entries(uniforms)) {
      const l = prog.loc[k];
      if (l == null) continue;
      if (v instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(l, unit++);
      } else if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length > 9) gl.uniform4fv(l, v); // vec4 arrays
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else if (v.length === 4) gl.uniform4fv(l, v);
      else if (v.length === 9) gl.uniformMatrix3fv(l, false, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  colorUniforms(info, s) {
    const key = `${s.temp}|${s.tint}|${s.redHue}|${s.redSat}|${s.greenHue}|${s.greenSat}|${s.blueHue}|${s.blueSat}`;
    if (this.colorKey !== key || this.colorInfo !== info) {
      const { wb, matrix } = colorTransform(info, s.temp, s.tint);
      this.color = { uWB: wb, uCam: glMat(mul3(calibrationMatrix(s), matrix)) };
      this.colorKey = key;
      this.colorInfo = info;
    }
    return this.color;
  }

  /** Rebuilds the blurred brightness guide when the photo or white balance changes. */
  updateGuide(info, s) {
    const key = `${s.temp}|${s.tint}|${s.redHue}|${s.redSat}|${s.greenHue}|${s.greenSat}|${s.blueHue}|${s.blueSat}`;
    if (this.guide && key === this.guideKey) return;
    const gl = this.gl;
    const scale = GUIDE_EDGE / Math.max(this.src.w, this.src.h);
    const gw = Math.max(8, Math.round(this.src.w * scale)), gh = Math.max(8, Math.round(this.src.h * scale));
    if (!this.guide || this.guide[0].w !== gw || this.guide[0].h !== gh) {
      for (const t of this.guide || []) this.free(t);
      this.guide = [this.target(gw, gh), this.target(gw, gh), this.target(gw, gh)];
    }
    const [a, b, c] = this.guide;
    this.draw(this.down, a, { uSrc: this.src.tex, uOutSize: [gw, gh], ...this.colorUniforms(info, s) });
    const sigma = Math.max(gw, gh) / 45;
    this.draw(this.blur, b, { uTex: a.tex, uStep: [1 / gw, 0], uSigma: sigma });
    this.draw(this.blur, c, { uTex: b.tex, uStep: [0, 1 / gh], uSigma: sigma });
    this.airY = null; // measured when Dehaze needs it (reading back stalls the graphics card)
    this.guideKey = key;
  }

  /** Airlight for dehaze: the brightness the haziest parts tend toward. */
  measureAir() {
    const gl = this.gl;
    const a = this.guide[0];
    const px = new Float32Array(a.w * a.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    gl.readPixels(0, 0, a.w, a.h, gl.RGBA, gl.FLOAT, px);
    const lum = new Float32Array(a.w * a.h);
    for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4];
    lum.sort();
    this.airY = Math.min(1, 2 ** lum[Math.floor(lum.length * 0.995)]);
  }

  updateLuts(s) {
    const gl = this.gl;
    // Only rebuilt when their own settings change (cheap to compare: the
    // curves are kept as the same arrays until edited).
    const c = [s.curve, s.curveR, s.curveG, s.curveB, s.pShadows, s.pDarks, s.pLights, s.pHighlights, s.pSplitS, s.pSplitM, s.pSplitH];
    if (!this.curveKey || c.some((x, i) => x !== this.curveKey[i])) {
      gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CURVE_SIZE, 1, gl.RGBA, gl.FLOAT, curveTable(s));
      this.curveKey = c;
    }
    const h = [];
    for (let i = 0; i < 8; i++) h.push(s[`hue${i}`], s[`sat${i}`], s[`lum${i}`], s[`gray${i}`]);
    if (!this.hueKey || h.some((x, i) => x !== this.hueKey[i])) {
      gl.bindTexture(gl.TEXTURE_2D, this.hueTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HUE_SIZE, 1, gl.RGBA, gl.FLOAT, hueTable(s));
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
    if (!masks.length) return;
    const rasters = masks.map((m) => maskRaster(m, geo.ow, geo.oh));
    const gl = this.gl;
    this.maskTex ||= [];
    for (let t = 0; t * 4 < rasters.length; t++) {
      const group = rasters.slice(t * 4, t * 4 + 4);
      const cur = this.maskTex[t];
      if (cur && cur.rasters.length === group.length && cur.rasters.every((r, i) => r === group[i])) continue;
      const { W, H } = group[0];
      const px = new Uint8Array(W * H * 4);
      group.forEach((r, c) => { const d = r.data; for (let i = 0; i < d.length; i++) px[i * 4 + c] = d[i]; });
      if (cur && cur.W === W && cur.H === H) {
        gl.bindTexture(gl.TEXTURE_2D, cur.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        cur.rasters = group;
      } else {
        if (cur) gl.deleteTexture(cur.tex);
        this.maskTex[t] = { tex: this.texture(gl.RGBA8, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px), W, H, rasters: group };
      }
    }
  }

  /** Each mask's own curve (Curve section), one row per mask. */
  updateMaskCurves() {
    const gl = this.gl;
    const key = this.masks.map((m) => (m.curve && !m.off?.curve ? m.curve : null));
    if (this.maskCurveKey && key.length === this.maskCurveKey.length && key.every((c, i) => c === this.maskCurveKey[i])) return;
    this.maskCurveKey = key;
    this.maskCurveTex ||= this.texture(gl.RGBA16F, CURVE_SIZE, MAX_MASKS, gl.RGBA, gl.FLOAT, new Float32Array(CURVE_SIZE * MAX_MASKS * 4));
    gl.bindTexture(gl.TEXTURE_2D, this.maskCurveTex);
    key.forEach((c, i) => { if (c) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, i, CURVE_SIZE, 1, gl.RGBA, gl.FLOAT, curveTable(c)); });
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
      S.set([pc ? pc.variance / 100 : 0, m.curve && !m.off?.curve ? 1 : 0, (m.refineSat ?? 100) / 100, 0], i * 4);
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
      uMA: A, uMB: B, uMC: C, uMD: D, uMR: R,
      uMaskView: view?.noOverlay ? -1 : sel,
      uMaskColor: view?.color || [1, 0.2, 0.3],
      uMaskOpacity: view ? view.opacity : 0,
      uMaskStyle: view ? MASK_STYLES.indexOf(view.style) : 0,
      uMaskLine: view?.line || 1.5,
    };
  }

  /**
   * Renders into `target` (null = the canvas). `out2frame` maps output pixels
   * to the crop frame; geo/frame say where that frame sits in the photo.
   */
  render(info, s, geo, frame, out2frame, { target = null, showClip = false, maskView = null } = {}) {
    if (!this.src) return;
    this.updateGuide(info, s);
    this.updateLuts(s);
    this.updateMasks(s, geo);
    if (this.masks.length) this.updateMaskCurves();
    if ((s.dehaze || this.masks.some((m) => m.adj?.dehaze)) && this.airY == null) this.measureAir();
    const out2ori = mm(geo.frameToOriented(frame), out2frame);
    const hi = this.hi;
    const look = LOOKS[s.profile] || LOOKS.adobe;
    const { cx, cy, half } = centred(geo);
    const [tS, tM, tH, tG] = gradeTints(s);
    const gradeLum = [s.gShadowLum, s.gMidLum, s.gHighLum, s.gGlobalLum].map((v) => (v || 0) / 100);
    const gradeOn = [...tS, ...tM, ...tH, ...tG, ...gradeLum].some((v) => v !== 0);
    const defringe = s.removeCA ? 0.5 : 0;
    this.draw(this.final, target, {
      uSrc: this.src.tex,
      uHi: hi ? hi.tex : this.blank,
      uHiRect: hi ? hi.rect : [0, 0, 0, 0],
      uHiSafe: hi ? hi.safe : [0, 0, 0, 0],
      uGuide: this.guide[2].tex,
      uCurve: this.curveTex,
      uHue: this.hueTex,
      uOut2Ori: glMat(out2ori),
      uOri2Photo: glMat(geo.orientedToPhoto()),
      uOriCenter: [cx, cy],
      uOriHalf: half,
      uCornerR2: (cx * cx + cy * cy) / (half * half),
      uPersp: glMat(perspective(s)),
      uDistort: ((s.distortion || 0) / 100) * 0.25,
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
      uCropAspect: frame.hw / frame.hh,
      uBg: [0.043, 0.051, 0.071],
      ...this.colorUniforms(info, s),
      uExposure: s.exposure + look.exposure,
      uContrast: look.contrast + (s.contrast / 100) * 0.75,
      ...tonemapUniforms(s),
      uHighlights: s.highlights / 100,
      uShadows: s.shadows / 100,
      uWhites: s.whites / 100,
      uBlacks: s.blacks / 100,
      uTexture: s.texture / 100,
      uClarity: s.clarity / 100,
      uDehaze: s.dehaze / 100,
      uVibrance: s.vibrance / 100,
      uSaturation: (1 + s.saturation / 100) * look.saturation - 1,
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
      uOriSize: [geo.ow, geo.oh],
      ...this.maskUniforms(maskView, geo),
    });
  }

  /** Renders a small copy and counts its pixels per level, for the histogram. */
  histogram(info, s, geo, frame) {
    const gl = this.gl;
    const k = 256 / Math.max(frame.hw, frame.hh) / 2;
    const w = Math.max(8, Math.round(frame.hw * 2 * k)), h = Math.max(8, Math.round(frame.hh * 2 * k));
    if (!this.histTarget || this.histTarget.w !== w || this.histTarget.h !== h) {
      this.free(this.histTarget);
      this.histTarget = this.target(w, h, gl.RGBA8);
    }
    const saveHi = this.hi;
    this.hi = null;
    this.render(info, s, geo, frame, outToFrame(w, h, frame, { scale: k, u: 0, v: 0 }), { target: this.histTarget });
    this.hi = saveHi;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    for (let i = 0; i < px.length; i += 4) { bins[0][px[i]]++; bins[1][px[i + 1]]++; bins[2][px[i + 2]]++; }
    return bins;
  }

  /** A small copy of the whole (cropped) photo, for the mask preview; pixels bottom row first. */
  preview(info, s, geo, frame, w, h, maskView) {
    const gl = this.gl;
    if (!this.prevTarget || this.prevTarget.w !== w || this.prevTarget.h !== h) {
      this.free(this.prevTarget);
      this.prevTarget = this.target(w, h, gl.RGBA8);
    }
    const saveHi = this.hi;
    this.hi = null;
    this.render(info, s, geo, frame, outToFrame(w, h, frame, { scale: fitScale(w, h, frame), u: 0, v: 0 }), { target: this.prevTarget, maskView });
    this.hi = saveHi;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }

  /** The colour on the canvas around (x, y) (canvas px, y up) as last drawn, 0-1. */
  readShown(x, y) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const px = new Uint8Array(9 * 4);
    gl.readPixels(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = [0, 0, 0];
    for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) c[k] += px[i * 4 + k] / 255 / 9;
    return c;
  }

  /** Renders a w x h tile into an 8-bit buffer and returns its pixels (bottom row first). */
  renderTile(info, s, geo, frame, out2frame, w, h) {
    const gl = this.gl;
    const t = this.target(w, h, gl.RGBA8);
    this.render(info, s, geo, frame, out2frame, { target: t });
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.free(t);
    return px;
  }
}

export { mm, ap, mat, glMat };
