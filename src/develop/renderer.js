// Draws a RAW photo with develop settings using WebGL2. The decoded photo lives
// on the graphics card as half-float camera RGB; every redraw runs the whole
// develop pipeline (shaders.js) for just the pixels on screen.
import { VERT, GUIDE_DOWN, BLUR, FINAL } from './shaders.js';
import { colorTransform } from './color.js';
import { CURVE_SIZE, HUE_SIZE, curveTable, hueTable } from './luts.js';

const GUIDE_EDGE = 320;
// Lightroom's default look is brighter and punchier than a straight conversion;
// these bring the starting point close to it (tuned on Z7 II files).
export const LOOK = { exposure: 0.95, contrast: 0.4, saturation: 1.25 };

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
    this.curveTex = this.texture(gl.R16F, CURVE_SIZE, 1, gl.RED, gl.FLOAT, new Float32Array(CURVE_SIZE));
    this.hueTex = this.texture(gl.RGB16F, HUE_SIZE, 1, gl.RGB, gl.FLOAT, new Float32Array(HUE_SIZE * 3), gl.REPEAT);
    this.lutKey = '';
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
    this.free(this.src); this.clearHi();
    for (const t of this.guide || []) this.free(t);
    gl.deleteTexture(this.curveTex); gl.deleteTexture(this.hueTex); gl.deleteTexture(this.blank);
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
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else if (v.length === 4) gl.uniform4fv(l, v);
      else if (v.length === 9) gl.uniformMatrix3fv(l, false, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  colorUniforms(info, s) {
    const { wb, matrix } = colorTransform(info, s.temp, s.tint);
    return { uWB: wb, uCam: glMat(matrix) };
  }

  /** Rebuilds the blurred brightness guide when the photo or white balance changes. */
  updateGuide(info, s) {
    const key = `${s.temp}|${s.tint}`;
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
    // Airlight for dehaze: the brightness the haziest parts tend toward.
    const px = new Float32Array(gw * gh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    gl.readPixels(0, 0, gw, gh, gl.RGBA, gl.FLOAT, px);
    const lum = [];
    for (let i = 0; i < gw * gh; i++) lum.push(px[i * 4]);
    lum.sort((x, y) => x - y);
    this.airY = Math.min(1, 2 ** lum[Math.floor(lum.length * 0.995)]);
    this.medianLog = lum[Math.floor(lum.length / 2)];
    this.guideKey = key;
  }

  updateLuts(s) {
    const key = JSON.stringify([s.curve, s.pShadows, s.pDarks, s.pLights, s.pHighlights, ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [s[`hue${i}`], s[`sat${i}`], s[`lum${i}`]])]);
    if (key === this.lutKey) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CURVE_SIZE, 1, gl.RED, gl.FLOAT, curveTable(s));
    gl.bindTexture(gl.TEXTURE_2D, this.hueTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HUE_SIZE, 1, gl.RGB, gl.FLOAT, hueTable(s));
    this.lutKey = key;
  }

  /**
   * Renders into `target` (null = the canvas). `out2frame` maps output pixels
   * to the crop frame; geo/frame say where that frame sits in the photo.
   */
  render(info, s, geo, frame, out2frame, { target = null, showClip = false } = {}) {
    if (!this.src) return;
    this.updateGuide(info, s);
    this.updateLuts(s);
    const out2photo = mm(geo.orientedToPhoto(), mm(geo.frameToOriented(frame), out2frame));
    const hi = this.hi;
    this.draw(this.final, target, {
      uSrc: this.src.tex,
      uHi: hi ? hi.tex : this.blank,
      uHiRect: hi ? hi.rect : [0, 0, 0, 0],
      uHiSafe: hi ? hi.safe : [0, 0, 0, 0],
      uGuide: this.guide[2].tex,
      uCurve: this.curveTex,
      uHue: this.hueTex,
      uOut2Photo: glMat(out2photo),
      uOut2Crop: glMat(out2frame),
      uPhotoPx: [1 / geo.sw, 1 / geo.sh],
      uCropAspect: frame.hw / frame.hh,
      uBg: [0.043, 0.051, 0.071],
      ...this.colorUniforms(info, s),
      uExposure: s.exposure + LOOK.exposure,
      uContrast: LOOK.contrast + (s.contrast / 100) * 0.75,
      uHighlights: s.highlights / 100,
      uShadows: s.shadows / 100,
      uWhites: s.whites / 100,
      uBlacks: s.blacks / 100,
      uTexture: s.texture / 100,
      uClarity: s.clarity / 100,
      uDehaze: s.dehaze / 100,
      uVibrance: s.vibrance / 100,
      uSaturation: (1 + s.saturation / 100) * LOOK.saturation - 1,
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
    });
    return out2photo;
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
