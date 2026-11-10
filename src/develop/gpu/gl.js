// The drawing interface (see webgpu.js for the other half) on WebGL2: what
// Flightroom drew with up to 2.18, kept for computers without WebGPU.
import { PROGRAMS } from './programs.js';

const FORMATS = {
  // [internal format, format, type for no data / Uint16 data, type for Float32 data]
  rgb16f: ['RGB16F', 'RGB', 'HALF_FLOAT', 'FLOAT'],
  rgba16f: ['RGBA16F', 'RGBA', 'HALF_FLOAT', 'FLOAT'],
  rgba32f: ['RGBA32F', 'RGBA', 'FLOAT', 'FLOAT'],
  r32f: ['R32F', 'RED', 'FLOAT', 'FLOAT'],
  rgba8: ['RGBA8', 'RGBA', 'UNSIGNED_BYTE', 'UNSIGNED_BYTE'],
};

export class Tex {
  constructor(t, w, h, fmt) { this.t = t; this.w = w; this.h = h; this.fmt = fmt; }
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class GLDevice {
  constructor(canvas, { onScreen = false, bands, gentle } = {}) {
    this.kind = 'webgl2';
    this.canvas = canvas;
    this.bands = bands;
    this.gentle = gentle;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: onScreen, powerPreference: 'high-performance' });
    // No context usually means the graphics driver was just reset (it was overloaded), not that the card can't do it.
    if (!gl || gl.isContextLost()) throw new Error('The graphics card was reset and isn\'t drawing photos right now');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('This graphics card has no float rendering');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.progs = {};
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.scissorRect = null;
  }

  width() { return this.gl.drawingBufferWidth; }
  height() { return this.gl.drawingBufferHeight; }
  lost() { return this.gl.isContextLost(); }
  program(name) {
    if (this.progs[name]) return this.progs[name];
    const gl = this.gl, [vert, frag] = PROGRAMS[name];
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    for (const sh of gl.getAttachedShaders(p)) gl.deleteShader(sh); // freed with the program
    const loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const u = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      loc[u] = gl.getUniformLocation(p, u);
    }
    return (this.progs[name] = { p, loc });
  }

  /** A texture: fmt (FORMATS), data (null, Uint16 halves, Float32 or Uint8), linear or nearest, clamped or repeating across. */
  texture(fmt, w, h, data = null, { filter = 'linear', wrap = 'clamp' } = {}) {
    const gl = this.gl, [internal, format, type16, type32] = FORMATS[fmt];
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[internal], w, h, 0, gl[format], gl[data instanceof Float32Array ? type32 : type16], data);
    const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return new Tex(t, w, h, fmt);
  }

  /** A picture (canvas, bitmap) as an 8-bit texture, top row first. */
  textureFrom(source, premultiply = false) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return new Tex(t, source.width, source.height, 'rgba8');
  }

  /** New pixels for part of a texture. */
  upload(tex, x, y, w, h, data) {
    const gl = this.gl, [, format, type16, type32] = FORMATS[tex.fmt];
    gl.bindTexture(gl.TEXTURE_2D, tex.t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl[format], gl[data instanceof Float32Array ? type32 : type16], data);
  }

  /** Something to draw into, readable as a texture (target.tex). */
  target(w, h, fmt = 'rgba16f') {
    const gl = this.gl;
    const tex = this.texture(fmt, w, h, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.t, 0);
    return { tex, fb, w, h, fmt };
  }

  free(t) {
    if (!t) return;
    const gl = this.gl;
    if (t instanceof Tex) { gl.deleteTexture(t.t); return; }
    if (t.fb) gl.deleteFramebuffer(t.fb);
    if (t.tex) gl.deleteTexture(t.tex.t);
  }

  setBlend(mode) {
    const gl = this.gl;
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 'over') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'multiply') gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
    else if (mode === 'erase') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'keepAlpha') gl.blendFuncSeparate(gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  }

  /** Draws only inside [x, y, w, h] (pixels, y up) until set to null. */
  setScissor(rect) {
    const gl = this.gl;
    this.scissorRect = rect;
    if (!rect) { gl.disable(gl.SCISSOR_TEST); return; }
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect[0], rect[1], rect[2], rect[3]);
  }

  clear(target, c) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  uniforms(prog, uniforms) {
    const gl = this.gl;
    let unit = 0;
    for (const k in uniforms) {
      const l = prog.loc[k];
      if (l == null) continue;
      const v = uniforms[k];
      if (v instanceof Tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v.t);
        gl.uniform1i(l, unit++);
      } else if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length > 9) gl.uniform4fv(l, v); // vec4 arrays
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else if (v.length === 4) gl.uniform4fv(l, v);
      else if (v.length === 9) gl.uniformMatrix3fv(l, false, v);
    }
  }

  /** A full-target pass of prog (or just `rect` of it: [x, y, w, h], y up). */
  draw(name, target, uniforms, rect = null) {
    const gl = this.gl, prog = this.program(name);
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    const r = rect || [0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight];
    gl.viewport(r[0], r[1], r[2], r[3]);
    this.uniforms(prog, uniforms);
    this.drawBands(r[0], r[1], r[2], r[3]);
  }

  /** The bound pass over x, y, w, h, in bands of rows; as is when it's small or already scissored. */
  drawBands(x, y, w, h) {
    const gl = this.gl;
    const band = this.bands(), gentle = this.gentle();
    if (w * h <= band * 1.5 || this.scissorRect) {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (gentle) gl.flush();
      return;
    }
    const rows = Math.max(1, Math.floor(band / w));
    gl.enable(gl.SCISSOR_TEST);
    for (let r = 0; r < h; r += rows) {
      gl.scissor(x, y + r, w, Math.min(rows, h - r));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (gentle) gl.flush();
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  /** Vertex data (Float32Array), into `old` when given. */
  buffer(data, old = null) {
    const gl = this.gl;
    const b = old || { buf: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, old ? gl.STREAM_DRAW : gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    return b;
  }

  freeBuffer(b) { if (b) this.gl.deleteBuffer(b.buf); }

  /** n brush dabs (x, y, radius, direction each) with the dab program. */
  drawDabs(name, target, uniforms, b, n) {
    const gl = this.gl, prog = this.program(name);
    this.vao ||= gl.createVertexArray();
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    this.uniforms(prog, uniforms);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
  }

  /** A target's picture into another (or the canvas), scaled to fit. */
  blit(from, to, linear = false) {
    const gl = this.gl;
    this.setScissor(null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to ? to.fb : null);
    const W = to ? to.w : gl.drawingBufferWidth, H = to ? to.h : gl.drawingBufferHeight;
    gl.blitFramebuffer(0, 0, from.w, from.h, 0, 0, W, H, gl.COLOR_BUFFER_BIT, linear ? gl.LINEAR : gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** Smaller copies of a target's picture, for sampling it scaled down. */
  mipmaps(target) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, target.tex.t);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }

  /**
   * Pixels of a target (null: the canvas), bottom row first: 'u8' RGBA bytes
   * or 'f32' floats. Right away, or with later as a promise that doesn't
   * keep the page waiting for the graphics card (8-bit only).
   */
  read(target, x, y, w, h, kind = 'u8', later = false) {
    const gl = this.gl;
    if (later && kind === 'u8') return this.readLater(target, x, y, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    const px = kind === 'f32' ? new Float32Array(w * h * 4) : new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, kind === 'f32' ? gl.FLOAT : gl.UNSIGNED_BYTE, px);
    return px;
  }

  readLater(target, x, y, w, h) {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    return new Promise((resolve) => {
      const poll = () => {
        if (gl.isContextLost()) { resolve(null); return; }
        if (!this.disposed && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) { setTimeout(poll, 4); return; }
        let px = null;
        if (!this.disposed) {
          px = new Uint8Array(w * h * 4);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        }
        gl.deleteSync(sync);
        gl.deleteBuffer(buf);
        resolve(px);
      };
      poll();
    });
  }

  flush() { this.gl.flush(); }

  /** Wait for the graphics card to finish what was sent. */
  waitFrame() {
    const gl = this.gl;
    if (this.disposed) return Promise.resolve(false);
    if (this.frameWait) return this.frameWait;
    let sync;
    try { sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); } catch { return Promise.resolve(false); }
    if (!sync) return new Promise((resolve) => setTimeout(() => resolve(false), 60));
    gl.flush();
    this.frameWait = new Promise((resolve) => {
      const finish = (done) => {
        try { gl.deleteSync(sync); } catch {}
        this.frameWait = null;
        resolve(done);
      };
      const t0 = performance.now();
      const poll = () => {
        if (this.disposed || gl.isContextLost()) { finish(false); return; }
        let status;
        try { status = gl.clientWaitSync(sync, 0, 0); } catch { finish(false); return; }
        // Give up after 2 s so a fence that never signals can't stop all redraws.
        if (status === gl.TIMEOUT_EXPIRED && performance.now() - t0 < 2000) { setTimeout(poll, 8); return; }
        if (status === gl.TIMEOUT_EXPIRED) { finish(false); return; }
        finish(status !== gl.WAIT_FAILED);
      };
      setTimeout(poll, 8);
    });
    return this.frameWait;
  }

  dispose() {
    const gl = this.gl;
    this.disposed = true;
    gl.deleteBuffer(this.quad);
    if (this.vao) gl.deleteVertexArray(this.vao);
    for (const p of Object.values(this.progs)) gl.deleteProgram(p.p);
    // An offscreen (export) context is done for good; a page canvas's owner
    // decides (Develop keeps one canvas for every photo and drops it on leaving).
    if (typeof OffscreenCanvas !== 'undefined' && this.canvas instanceof OffscreenCanvas) this.release();
  }

  /** Gives the canvas's graphics memory back now (the canvas is done with). */
  release() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}
