// The drawing interface on WebGPU (Flightroom 3.0's engine), the same calls
// as gl.js. Its shaders are made from the WebGL2 ones (tools/wgsl.mjs), with
// the pixel position given in WebGL's terms, and every target keeps its rows
// in the same order as WebGL's, so passes read each other exactly as before.
// Only the screen is flipped, as WebGL's canvas is.
import { WGSL } from './wgsl.gen.js';

const GU = typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : {};
const TU = typeof GPUTextureUsage !== 'undefined' ? GPUTextureUsage : {};
const SS = typeof GPUShaderStage !== 'undefined' ? GPUShaderStage : {};

const QUAD = `@vertex fn main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}`;

// The engine's own small programs: a clear inside the scissor, and a picture
// scaled into a target (blits, smaller copies for mipmaps).
const OWN = {
  frClear: {
    frag: `struct FrU { uColor: vec4f, frFlip: f32, frH: f32 }
@group(0) @binding(0) var<uniform> u: FrU;
@fragment fn main() -> @location(0) vec4f { return u.uColor; }`,
    size: 32, uniforms: { uColor: [0, 'vec4', 0], frFlip: [16, 'float', 0], frH: [20, 'float', 0] }, textures: [], nearest: 0,
  },
  frBlit: {
    frag: `struct FrU { uDst: vec4f, frFlip: f32, frH: f32 }
@group(0) @binding(0) var<uniform> u: FrU;
@group(0) @binding(1) var uTex: texture_2d<f32>;
@group(0) @binding(2) var uTex_s: sampler;
@fragment fn main(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let y = select(p.y, u.frH - p.y, u.frFlip > 0.5);
  return textureSampleLevel(uTex, uTex_s, (vec2f(p.x, y) - u.uDst.xy) / u.uDst.zw, 0.0);
}`,
    size: 32, uniforms: { uDst: [0, 'vec4', 0], frFlip: [16, 'float', 0], frH: [20, 'float', 0] }, textures: [['uTex', 1, 2, true]], nearest: 0,
  },
};
const progDef = (name) => OWN[name] || WGSL[name];

const FORMAT = { rgb16f: 'rgba16float', rgba16f: 'rgba16float', rgba32f: 'rgba32float', r32f: 'r32float', rgba8: 'rgba8unorm' };
const BPP = { rgba16float: 8, rgba32float: 16, r32float: 4, rgba8unorm: 4, bgra8unorm: 4 };

// float32 -> float16 bits, rounded to nearest even (as WebGL's upload converts).
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function half(v) {
  f32[0] = v;
  const x = u32[0], sign = (x >>> 16) & 0x8000;
  let e = (x >>> 23) & 0xff, m = x & 0x7fffff;
  if (e === 0xff) return sign | 0x7c00 | (m ? 0x200 : 0);
  e = e - 127 + 15;
  if (e >= 31) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    m |= 0x800000;
    const shift = 14 - e;
    let h = m >>> shift;
    const rem = m & ((1 << shift) - 1), mid = 1 << (shift - 1);
    if (rem > mid || (rem === mid && (h & 1))) h++;
    return sign | h;
  }
  let h = (e << 10) | (m >>> 13);
  const rem = m & 0x1fff;
  if (rem > 0x1000 || (rem === 0x1000 && (h & 1))) h++;
  return sign | h;
}
const HALF_ONE = 0x3c00;
function toFloat(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
let floatOfHalf = null; // table of all 65536 halves, made the first time a float target is read
const halfToFloat = () => (floatOfHalf ||= Float32Array.from({ length: 65536 }, (_, i) => toFloat(i)));

/** Pixels as WebGPU wants them for a format: RGB padded to RGBA, floats to halves. */
function pack(fmt, data, n) {
  if (fmt === 'rgb16f') {
    const out = new Uint16Array(n * 4);
    if (data instanceof Float32Array) for (let i = 0, j = 0; i < n; i++, j += 3) { out[i * 4] = half(data[j]); out[i * 4 + 1] = half(data[j + 1]); out[i * 4 + 2] = half(data[j + 2]); out[i * 4 + 3] = HALF_ONE; }
    else for (let i = 0, j = 0; i < n; i++, j += 3) { out[i * 4] = data[j]; out[i * 4 + 1] = data[j + 1]; out[i * 4 + 2] = data[j + 2]; out[i * 4 + 3] = HALF_ONE; }
    return out;
  }
  if (fmt === 'rgba16f' && data instanceof Float32Array) {
    const out = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = half(data[i]);
    return out;
  }
  return data;
}

export class GTex {
  constructor(tex, w, h, fmt, opts) { this.tex = tex; this.w = w; this.h = h; this.fmt = fmt; this.opts = opts; this.view = tex.createView(); this.id = GTex.n = (GTex.n || 0) + 1; }
}

// Pipelines, shader modules and layouts, per device (every renderer shares them).
const shared = new WeakMap();
function cacheFor(device) {
  let c = shared.get(device);
  if (!c) { c = { modules: new Map(), layouts: new Map(), pipes: new Map(), samplers: new Map() }; shared.set(device, c); }
  return c;
}

function moduleFor(device, code) {
  const c = cacheFor(device);
  let m = c.modules.get(code);
  if (!m) { m = device.createShaderModule({ code }); c.modules.set(code, m); }
  return m;
}

function layoutFor(device, name) {
  const c = cacheFor(device);
  let l = c.layouts.get(name);
  if (l) return l;
  const def = progDef(name);
  const entries = [{ binding: 0, visibility: SS.VERTEX | SS.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: def.size } }];
  for (const [, b, s, sampled] of def.textures) {
    entries.push({ binding: b, visibility: SS.FRAGMENT, texture: { sampleType: sampled ? 'float' : 'unfilterable-float' } });
    entries.push({ binding: s, visibility: SS.FRAGMENT, sampler: { type: sampled ? 'filtering' : 'non-filtering' } });
  }
  if (def.nearest) entries.push({ binding: def.nearest, visibility: SS.FRAGMENT, sampler: { type: 'non-filtering' } });
  const group = device.createBindGroupLayout({ entries });
  l = { group, pipe: device.createPipelineLayout({ bindGroupLayouts: [group] }) };
  c.layouts.set(name, l);
  return l;
}

const BLENDS = {
  over: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } },
  multiply: { color: { srcFactor: 'zero', dstFactor: 'src' }, alpha: { srcFactor: 'zero', dstFactor: 'src-alpha' } },
  erase: { color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha' } },
  keepAlpha: { color: { srcFactor: 'dst-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } },
};

function pipeDesc(device, name, format, blend) {
  const def = progDef(name);
  const dab = !!def.vert;
  return {
    layout: layoutFor(device, name).pipe,
    vertex: dab
      ? { module: moduleFor(device, def.vert), entryPoint: 'main', buffers: [{ arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] }] }
      : { module: moduleFor(device, QUAD), entryPoint: 'main' },
    fragment: { module: moduleFor(device, def.frag), entryPoint: 'main', targets: [{ format, ...(blend ? { blend: BLENDS[blend] } : {}) }] },
    primitive: { topology: 'triangle-list' },
  };
}

function pipeline(device, name, format, blend) {
  const c = cacheFor(device);
  const key = `${name}|${format}|${blend || ''}`;
  let p = c.pipes.get(key);
  if (p && !(p instanceof Promise)) return p;
  p = device.createRenderPipeline(pipeDesc(device, name, format, blend));
  c.pipes.set(key, p);
  return p;
}

function sampler(device, filter, wrap, mips) {
  const c = cacheFor(device);
  const key = `${filter}|${wrap}|${mips}`;
  let s = c.samplers.get(key);
  if (!s) {
    const f = filter === 'nearest' ? 'nearest' : 'linear';
    s = device.createSampler({ magFilter: f, minFilter: f, mipmapFilter: mips ? 'linear' : 'nearest', addressModeU: wrap === 'repeat' ? 'repeat' : 'clamp-to-edge', addressModeV: 'clamp-to-edge', ...(mips ? {} : { lodMaxClamp: 0 }) });
    c.samplers.set(key, s);
  }
  return s;
}

const meet = (a, b) => {
  const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[0] + a[2], b[0] + b[2]), y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
};

const ARENA = 4 << 20; // uniforms for one batch of passes
const SLOT = 256;      // dynamic offsets come in these steps

export class GPUDev {
  /** Starts compiling the photo's main programs in the background (they're big). */
  static warm(device) {
    const c = cacheFor(device);
    const screen = navigator.gpu.getPreferredCanvasFormat();
    const jobs = [['final', 'rgba16float'], ['final', 'rgba8unorm'], ['final', screen], ['down', 'rgba16float'], ['blur', 'rgba16float'], ['resample', 'rgba16float'], ['display', screen], ['frBlit', screen], ['frBlit', 'rgba16float']];
    for (const [name, format] of jobs) {
      const key = `${name}|${format}|`;
      if (c.pipes.has(key)) continue;
      const p = device.createRenderPipelineAsync(pipeDesc(device, name, format, null)).then((pipe) => { if (c.pipes.get(key) === p) c.pipes.set(key, pipe); return pipe; }, () => { if (c.pipes.get(key) === p) c.pipes.delete(key); });
      c.pipes.set(key, p);
    }
  }

  constructor(device, canvas, { onScreen = false, bands, gentle } = {}) {
    this.kind = 'webgpu';
    this.device = device;
    this.canvas = canvas;
    this.onScreen = onScreen;
    this.bands = bands;
    this.gentle = gentle;
    this.maxTex = device.limits.maxTextureDimension2D;
    this.isLost = false;
    device.lost.then(() => { this.isLost = true; });
    this.arena = device.createBuffer({ size: ARENA, usage: GU.UNIFORM | GU.COPY_DST });
    this.cpu = new ArrayBuffer(ARENA);
    this.cpuF = new Float32Array(this.cpu);
    this.off = 0;
    this.enc = null;
    this.trash = [];
    this.shadow = {};   // program -> its uniforms as last set (WebGL keeps them per program)
    this.groups = {};   // program -> Map(texture ids -> bind group)
    this.blend = null;
    this.scissorRect = null;
    this.blank = this.texture('rgba16f', 1, 1, null);
    this.screenFormat = navigator.gpu.getPreferredCanvasFormat();
    this.ctx = null;
    this.screen = null;
  }

  width() { return this.canvas.width; }
  height() { return this.canvas.height; }
  lost() { return this.isLost; }

  // --- textures ---------------------------------------------------------------

  /** Holds commands so far before the queue writes data, so draws already made read the old data (as in WebGL). */
  beforeWrite() { if (this.enc) this.submit(); }

  texture(fmt, w, h, data = null, { filter = 'linear', wrap = 'clamp', mips = false } = {}) {
    const format = FORMAT[fmt];
    const levels = mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
    const renderable = format === 'rgba16float' || format === 'rgba8unorm';
    const tex = this.device.createTexture({
      size: [w, h], format, mipLevelCount: levels,
      usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.COPY_SRC | (renderable ? TU.RENDER_ATTACHMENT : 0),
    });
    const t = new GTex(tex, w, h, fmt, { filter, wrap, mips });
    if (data) this.upload(t, 0, 0, w, h, data);
    return t;
  }

  textureFrom(source, premultiply = false) {
    const w = source.width, h = source.height;
    const t = this.texture('rgba8', w, h, null);
    this.beforeWrite();
    this.device.queue.copyExternalImageToTexture({ source, flipY: false }, { texture: t.tex, premultipliedAlpha: premultiply }, [w, h]);
    return t;
  }

  upload(t, x, y, w, h, data) {
    if (!w || !h) return;
    this.beforeWrite();
    const px = pack(t.fmt, data, w * h);
    const bpp = BPP[FORMAT[t.fmt]];
    this.device.queue.writeTexture({ texture: t.tex, origin: [x, y] }, px, { bytesPerRow: w * bpp, rowsPerImage: h }, [w, h]);
  }

  target(w, h, fmt = 'rgba16f', { mips = false } = {}) {
    const tex = this.texture(fmt, w, h, null, { mips });
    tex.attach = mips ? tex.tex.createView({ baseMipLevel: 0, mipLevelCount: 1 }) : tex.view;
    return { tex, w, h, fmt, gpu: true };
  }

  free(t) {
    if (!t) return;
    const tex = t instanceof GTex ? t : t.tex;
    if (!tex) return;
    // Commands not yet sent may still read it: it goes once they have been.
    if (this.enc) this.trash.push(tex.tex);
    else tex.tex.destroy();
  }

  // --- state, as WebGL has it --------------------------------------------------

  setBlend(mode) { this.blend = mode || null; }
  setScissor(rect) { this.scissorRect = rect; }

  // --- the screen ----------------------------------------------------------------

  /** The canvas's picture lives in a texture of its own (kept between frames, readable) and is copied to the canvas after drawing. */
  screenTarget() {
    const w = this.canvas.width, h = this.canvas.height;
    if (!this.ctx) {
      this.ctx = this.canvas.getContext('webgpu');
      if (!this.ctx) throw new Error('This canvas can\'t draw with WebGPU');
      this.ctx.configure({ device: this.device, format: this.screenFormat, alphaMode: 'opaque', usage: TU.RENDER_ATTACHMENT | TU.COPY_DST });
    }
    if (!this.screen || this.screen.w !== w || this.screen.h !== h) {
      if (this.screen) this.free(this.screen);
      const tex = this.device.createTexture({ size: [w, h], format: this.screenFormat, usage: TU.RENDER_ATTACHMENT | TU.COPY_SRC | TU.TEXTURE_BINDING });
      const g = new GTex(tex, w, h, 'screen', { filter: 'linear', wrap: 'clamp' });
      g.attach = g.view;
      this.screen = { tex: g, w, h, fmt: 'screen', gpu: true, isScreen: true };
    }
    return this.screen;
  }

  present() {
    this.presentQueued = false;
    if (!this.screenDirty || this.isLost || !this.ctx) { this.submit(); return; }
    const s = this.screen;
    let cur;
    try { cur = this.ctx.getCurrentTexture(); } catch { this.submit(); return; }
    if (cur.width === s.w && cur.height === s.h) {
      this.encoder().copyTextureToTexture({ texture: s.tex.tex }, { texture: cur }, [s.w, s.h]);
      this.screenDirty = false;
    }
    this.submit();
  }

  // --- commands ----------------------------------------------------------------

  encoder() { return (this.enc ||= this.device.createCommandEncoder()); }

  submit() {
    if (!this.enc) return;
    if (this.off) this.device.queue.writeBuffer(this.arena, 0, this.cpu, 0, this.off);
    this.device.queue.submit([this.enc.finish()]);
    this.enc = null;
    this.off = 0;
    for (const t of this.trash) t.destroy();
    this.trash.length = 0;
  }

  flush() { this.submit(); }

  /** This program's uniforms with these values put in; returns its offset in the batch. */
  writeUniforms(name, def, uniforms, flip, H) {
    let sh = this.shadow[name];
    if (!sh) sh = this.shadow[name] = new Float32Array(def.size / 4);
    const U = def.uniforms;
    for (const k in uniforms) {
      const u = U[k];
      if (!u) continue;
      const v = uniforms[k];
      if (v instanceof GTex || (v && v.gpu)) continue;
      const o = u[0] >> 2;
      if (typeof v === 'number') sh[o] = v;
      else if (u[1] === 'mat3') { sh[o] = v[0]; sh[o + 1] = v[1]; sh[o + 2] = v[2]; sh[o + 4] = v[3]; sh[o + 5] = v[4]; sh[o + 6] = v[5]; sh[o + 8] = v[6]; sh[o + 9] = v[7]; sh[o + 10] = v[8]; }
      else if (u[2]) sh.set(v.length > u[2] * 4 ? v.subarray(0, u[2] * 4) : v, o);
      else for (let i = 0; i < v.length && i < 4; i++) sh[o + i] = v[i];
    }
    sh[U.frFlip[0] >> 2] = flip ? 1 : 0;
    sh[U.frH[0] >> 2] = H;
    if (this.off + def.size > ARENA) this.submit();
    const off = this.off;
    this.cpuF.set(sh, off >> 2);
    this.off = off + Math.ceil(def.size / SLOT) * SLOT;
    return off;
  }

  bindGroup(name, def, uniforms) {
    const texs = [];
    let key = '';
    for (const [tn] of def.textures) {
      let t = uniforms[tn];
      if (t && t.gpu) t = t.tex; // a target given for its picture
      if (!(t instanceof GTex)) t = this.blank;
      texs.push(t);
      key += `${t.id},`;
    }
    const cache = (this.groups[name] ||= new Map());
    let g = cache.get(key);
    if (g) { cache.delete(key); cache.set(key, g); return g; }
    const entries = [{ binding: 0, resource: { buffer: this.arena, size: def.size } }];
    def.textures.forEach(([, b, s, sampled], i) => {
      const t = texs[i];
      entries.push({ binding: b, resource: t.view });
      entries.push({ binding: s, resource: sampled ? sampler(this.device, t.opts.filter, t.opts.wrap, t.opts.mips) : sampler(this.device, 'nearest', 'clamp', false) });
    });
    if (def.nearest) entries.push({ binding: def.nearest, resource: sampler(this.device, 'nearest', 'clamp', false) });
    g = this.device.createBindGroup({ layout: layoutFor(this.device, name).group, entries });
    cache.set(key, g);
    if (cache.size > 48) cache.delete(cache.keys().next().value);
    return g;
  }

  /** Target (null: the screen) as [view, format, height, flipped]. */
  attachment(target) {
    const t = target || this.screenTarget();
    return [t.tex.attach, t.isScreen ? this.screenFormat : FORMAT[t.fmt], t.w, t.h, !!t.isScreen];
  }

  pass(view) {
    return this.encoder().beginRenderPass({ colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }] });
  }

  /** A full-target pass of a program (or just rect of it, y up), in bands like WebGL's. */
  draw(name, target, uniforms, rect = null) {
    if (this.isLost) return;
    const def = progDef(name);
    const [view, format, W, H, flip] = this.attachment(target);
    let r = rect || [0, 0, W, H];
    // (A WebGL viewport only limits where the pass lands: the shaders work from the pixel position.)
    if (this.scissorRect) r = meet(r, this.scissorRect);
    const pipe = pipeline(this.device, name, format, this.blend);
    const group = this.bindGroup(name, def, uniforms);
    const strips = [];
    const band = this.bands(), gentle = this.gentle();
    if (!r) return;
    if (this.scissorRect || r[2] * r[3] <= band * 1.5) strips.push(r);
    else {
      const rows = Math.max(1, Math.floor(band / r[2]));
      for (let y = 0; y < r[3]; y += rows) strips.push([r[0], r[1] + y, r[2], Math.min(rows, r[3] - y)]);
    }
    let pass = null, off = -1;
    for (const st of strips) {
      const sc = this.clip(st, W, H, flip);
      if (!sc) continue;
      if (!pass) {
        off = this.writeUniforms(name, def, uniforms, flip, H);
        pass = this.pass(view);
        pass.setPipeline(pipe);
        pass.setBindGroup(0, group, [off]);
      }
      pass.setScissorRect(sc[0], sc[1], sc[2], sc[3]);
      pass.draw(3);
      // Weaker built-in graphics: each band on its own, so Windows can show the desktop between them.
      if (gentle) { pass.end(); pass = null; this.submit(); }
    }
    if (pass) pass.end();
    if (flip) this.markScreen();
  }

  /** A scissor rect inside the target, in its pixels; null when nothing is left. */
  clip(r, W, H, flip) {
    const x0 = Math.max(0, r[0]), y0 = Math.max(0, r[1]);
    const x1 = Math.min(W, r[0] + r[2]), y1 = Math.min(H, r[1] + r[3]);
    if (x1 <= x0 || y1 <= y0) return null;
    return flip ? [x0, H - y1, x1 - x0, y1 - y0] : [x0, y0, x1 - x0, y1 - y0];
  }

  markScreen() {
    this.screenDirty = true;
    if (!this.presentQueued) { this.presentQueued = true; queueMicrotask(() => this.present()); }
  }

  clear(target, c) {
    if (this.isLost) return;
    const [view, , W, H, flip] = this.attachment(target);
    if (!this.scissorRect) {
      const p = this.encoder().beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', clearValue: { r: c[0], g: c[1], b: c[2], a: c[3] }, storeOp: 'store' }] });
      p.end();
      if (flip) this.markScreen();
      return;
    }
    const blend = this.blend;
    this.blend = null;
    this.draw('frClear', target, { uColor: c });
    this.blend = blend;
  }

  buffer(data, old = null) {
    this.beforeWrite();
    let b = old;
    if (!b || b.size < data.byteLength) {
      if (b) this.freeBuffer(b);
      b = { buf: this.device.createBuffer({ size: Math.max(16, data.byteLength), usage: GU.VERTEX | GU.COPY_DST }), size: Math.max(16, data.byteLength) };
    }
    this.device.queue.writeBuffer(b.buf, 0, data);
    return b;
  }

  freeBuffer(b) {
    if (!b) return;
    if (this.enc) this.trash.push(b.buf);
    else b.buf.destroy();
  }

  drawDabs(name, target, uniforms, b, n) {
    if (this.isLost || !n) return;
    const def = progDef(name);
    const [view, format, W, H, flip] = this.attachment(target);
    const pipe = pipeline(this.device, name, format, this.blend);
    const group = this.bindGroup(name, def, uniforms);
    const sc = this.scissorRect ? this.clip(this.scissorRect, W, H, flip) : [0, 0, W, H];
    if (!sc) return;
    const off = this.writeUniforms(name, def, uniforms, flip, H);
    const pass = this.pass(view);
    pass.setPipeline(pipe);
    pass.setBindGroup(0, group, [off]);
    pass.setVertexBuffer(0, b.buf);
    pass.setScissorRect(sc[0], sc[1], sc[2], sc[3]);
    pass.draw(6, n);
    pass.end();
    if (flip) this.markScreen();
  }

  /** A target's picture into another (or the screen), scaled to fit; exact when the sizes match. */
  blit(from, to, linear = false) {
    this.scissorRect = null;
    const W = to ? to.w : this.canvas.width, H = to ? to.h : this.canvas.height;
    if (to && from.w === W && from.h === H && FORMAT[from.fmt] === FORMAT[to.fmt]) {
      this.encoder().copyTextureToTexture({ texture: from.tex.tex }, { texture: to.tex.tex }, [W, H]);
      return;
    }
    const blend = this.blend;
    this.blend = null;
    const src = linear ? from.tex : this.nearestView(from.tex);
    this.draw('frBlit', to, { uTex: src, uDst: [0, 0, W, H] });
    this.blend = blend;
  }

  /** The same picture read without filtering. */
  nearestView(t) {
    if (!t.nearest) { t.nearest = new GTex(t.tex, t.w, t.h, t.fmt, { ...t.opts, filter: 'nearest', mips: false }); t.nearest.view = t.view; }
    return t.nearest;
  }

  mipmaps(target) {
    const t = target.tex, levels = t.tex.mipLevelCount;
    let w = t.w, h = t.h;
    const blend = this.blend, sc = this.scissorRect;
    this.blend = null; this.scissorRect = null;
    for (let l = 1; l < levels; l++) {
      const pw = w, ph = h;
      w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
      const src = new GTex(t.tex, pw, ph, t.fmt, { filter: 'linear', wrap: 'clamp', mips: false });
      src.view = t.tex.createView({ baseMipLevel: l - 1, mipLevelCount: 1 });
      const dst = { tex: { attach: t.tex.createView({ baseMipLevel: l, mipLevelCount: 1 }) }, w, h, fmt: t.fmt, gpu: true };
      this.draw('frBlit', dst, { uTex: src, uDst: [0, 0, w, h] });
    }
    this.blend = blend; this.scissorRect = sc;
  }

  /** Pixels of a target (null: the screen), bottom row first, as WebGL reads them: a promise. */
  read(target, x, y, w, h, kind = 'u8') {
    if (this.isLost) return Promise.resolve(null);
    const t = target || this.screenTarget();
    const flip = !!t.isScreen;
    const format = t.isScreen ? this.screenFormat : FORMAT[t.fmt];
    const bpp = BPP[format];
    const row = Math.ceil((w * bpp) / 256) * 256;
    const buf = this.device.createBuffer({ size: row * h, usage: GU.COPY_DST | GU.MAP_READ });
    this.encoder().copyTextureToBuffer({ texture: t.tex.tex, origin: [x, flip ? t.h - y - h : y] }, { buffer: buf, bytesPerRow: row, rowsPerImage: h }, [w, h]);
    this.submit();
    return buf.mapAsync(GPUMapMode.READ).then(() => {
      const src = new Uint8Array(buf.getMappedRange());
      const out = kind === 'f32' ? new Float32Array(w * h * 4) : new Uint8Array(w * h * 4);
      const tab = format === 'rgba16float' ? halfToFloat() : null;
      for (let j = 0; j < h; j++) {
        const sj = flip ? h - 1 - j : j;
        const s = src.subarray(sj * row, sj * row + w * bpp), o = j * w * 4;
        if (format === 'rgba16float') {
          const hv = new Uint16Array(s.buffer, s.byteOffset, w * 4);
          if (kind === 'f32') for (let i = 0; i < w * 4; i++) out[o + i] = tab[hv[i]];
          else for (let i = 0; i < w * 4; i++) out[o + i] = Math.round(Math.min(1, Math.max(0, tab[hv[i]])) * 255);
        } else if (format === 'bgra8unorm') {
          for (let i = 0; i < w * 4; i += 4) { const k = kind === 'f32' ? 1 / 255 : 1; out[o + i] = s[i + 2] * k; out[o + i + 1] = s[i + 1] * k; out[o + i + 2] = s[i] * k; out[o + i + 3] = s[i + 3] * k; }
        } else if (kind === 'f32') for (let i = 0; i < w * 4; i++) out[o + i] = s[i] / 255;
        else out.set(s, o);
      }
      buf.unmap();
      buf.destroy();
      return out;
    }, () => { buf.destroy(); return null; });
  }

  /** Wait for the graphics card to finish what was sent (false after 2 s or a reset). */
  waitFrame() {
    if (this.disposed || this.isLost) return Promise.resolve(false);
    if (this.presentQueued) this.present();
    else this.submit();
    if (this.frameWait) return this.frameWait;
    let timer;
    this.frameWait = Promise.race([
      this.device.queue.onSubmittedWorkDone().then(() => !this.isLost && !this.disposed),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), 2000); }),
    ]).finally(() => { clearTimeout(timer); this.frameWait = null; });
    return this.frameWait;
  }

  renderer() {
    return '';
  }

  dispose() {
    if (this.presentQueued) this.present();
    this.submit();
    this.disposed = true;
    this.free(this.blank);
    if (this.screen) this.free(this.screen);
    this.arena.destroy();
    this.groups = {};
  }

  release() { try { this.ctx?.unconfigure(); } catch {} }
}
