// Draws Retouch layers (retouch.js) on top of the developed photo, on the
// graphics card, every time the photo is drawn. The developed photo goes into
// a buffer first; then each layer's strokes are drawn into a layer buffer and
// blended onto it (Photoshop's blend modes), the last one straight to the
// screen or export tile. Clones and heals draw the developed photo again,
// shifted by their source offset, just inside their own small box, so they
// follow every Develop change. Heals then even out the colour difference at
// their edge with a smooth fill (push-pull pyramid), like a healing brush.
import { VERT } from './shaders.js';
import { BLEND_INDEX, SOURCED, STROKED, opBounds, selectionCanvas, strokeDabs } from './retouch.js';
import { inv3 } from './color.js';
import { ap, glMat } from './renderer.js';

const DAB_VERT = `#version 300 es
layout(location = 1) in vec4 aDab; // x, y, radius (oriented px)
uniform mat3 uOri2Out;
uniform vec2 uOutSize;
uniform float uScale; // output px per oriented px
out vec2 vUv;
out float vR;
const vec2 Q[6] = vec2[6](vec2(-1, -1), vec2(1, -1), vec2(-1, 1), vec2(-1, 1), vec2(1, -1), vec2(1, 1));
void main() {
  vec2 c = Q[gl_VertexID];
  float r = aDab.z * uScale;
  vec2 p = (uOri2Out * vec3(aDab.xy, 1.0)).xy + c * (r + 1.0);
  vUv = c * (r + 1.0);
  vR = r;
  gl_Position = vec4(p / uOutSize * 2.0 - 1.0, 0.0, 1.0);
}`;

// One dab's coverage: solid out to the hardness, then fading to the edge.
const DAB_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in float vR;
uniform float uHard, uFlow;
out vec4 o;
void main() {
  float d = length(vUv);
  float r = max(vR, 0.5);
  float inner = min(uHard * r, r - 0.75);
  float a = 1.0 - smoothstep(inner, r + 0.5, d);
  o = vec4(a * uFlow);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;
`;

// One op onto its layer: paint colour, erase, a clone or heal's pixels, a fill.
const OP = `${HEAD}
uniform sampler2D uCov, uSrcTex, uMem, uSel;
uniform float uKind;   // 0 paint, 1 erase, 2 clone, 3 heal, 4 fill, 5 clear
uniform vec3 uColor;
uniform float uOpacity, uUseCov, uUseSel;
uniform mat3 uOut2Ori;
uniform vec2 uOriSize;
uniform vec3 uMemRect;  // x0, y0 (output px), scale
uniform vec2 uMemSize, uMemCap;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  float a = uOpacity;
  if (uUseCov > 0.5) a *= min(texelFetch(uCov, ip, 0).r, 1.0);
  if (uUseSel > 0.5) a *= texture(uSel, (uOut2Ori * vec3(gl_FragCoord.xy, 1.0)).xy / uOriSize).a;
  vec3 c = uColor;
  if (uKind > 1.5 && uKind < 3.5) c = texelFetch(uSrcTex, ip, 0).rgb;
  if (uKind > 2.5 && uKind < 3.5) {
    vec2 m = clamp((gl_FragCoord.xy - uMemRect.xy) * uMemRect.z, vec2(0.5), uMemSize - 0.5);
    c = clamp(c + texture(uMem, m / uMemCap).rgb, 0.0, 1.0);
  }
  o = uKind > 0.5 && (uKind < 1.5 || uKind > 4.5) ? vec4(a) : vec4(c * a, a);
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

// A layer onto what's below it, with its blend mode and opacity (W3C / Photoshop formulas).
const COMP = `${HEAD}
uniform sampler2D uBack, uLayer;
uniform float uMode, uOpacity;
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
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 b = texelFetch(uBack, ip, 0).rgb;
  vec4 l = texelFetch(uLayer, ip, 0);
  float a = l.a * uOpacity;
  if (a <= 0.0) { o = vec4(b, 1.0); return; }
  vec3 s = clamp(l.rgb / l.a, 0.0, 1.0);
  int m = int(uMode + 0.5);
  vec3 f = s;
  if (m == 1) f = b * s;
  else if (m == 2) f = 1.0 - (1.0 - b) * (1.0 - s);
  else if (m == 3) f = mix(1.0 - 2.0 * (1.0 - b) * (1.0 - s), 2.0 * b * s, step(b, vec3(0.5)));
  else if (m == 4) f = soft(b, s);
  else if (m == 5) f = min(b, s);
  else if (m == 6) f = max(b, s);
  else if (m == 7) f = abs(b - s);
  else if (m == 8) f = setLum(setSat(s, sat(b)), lum(b));
  else if (m == 9) f = setLum(setSat(b, sat(s)), lum(b));
  else if (m == 10) f = setLum(s, lum(b));
  else if (m == 11) f = setLum(b, lum(s));
  o = vec4(mix(b, f, a), 1.0);
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

const KIND = { paint: 0, erase: 1, clone: 2, heal: 3, fill: 4, clear: 5 };

export class Composer {
  constructor(r) {
    this.r = r;
    const gl = (this.gl = r.gl);
    this.dab = program(gl, DAB_VERT, DAB_FRAG);
    this.op = program(gl, VERT, OP);
    this.healL0 = program(gl, VERT, HEAL_L0);
    this.pull = program(gl, VERT, PULL);
    this.push = program(gl, VERT, PUSH);
    this.comp = program(gl, VERT, COMP);
    this.vao = gl.createVertexArray();
    this.sets = new Map(); // "WxH" -> buffers for that output size
    this.bufs = new Map(); // op -> { buf, n } (its dabs on the graphics card)
    this.sels = new Map(); // selection -> texture
    this.bounds = new WeakMap(); // op -> its box (oriented px)
  }

  r8(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  /** Working buffers for one output size; the screen, histogram and preview each keep theirs. */
  set(W, H) {
    const key = `${W}x${H}`;
    let t = this.sets.get(key);
    if (!t) {
      const r = this.r, gl = this.gl;
      t = { acc: [r.target(W, H, gl.RGBA8), r.target(W, H, gl.RGBA8)], src: r.target(W, H, gl.RGBA8), layer: r.target(W, H, gl.RGBA8), cov: this.r8(W, H) };
      if (this.sets.size >= 3) {
        const [old, o] = this.sets.entries().next().value;
        this.sets.delete(old);
        for (const x of [...o.acc, o.src, o.layer, o.cov]) r.free(x);
      }
    } else this.sets.delete(key);
    this.sets.set(key, t);
    return t;
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

  selTex(sel, geo) {
    let t = this.sels.get(sel);
    if (t) return t;
    const gl = this.gl;
    const k = Math.min(1, Math.min(4096, this.r.maxTex) / Math.max(geo.ow, geo.oh));
    const c = selectionCanvas(sel, Math.max(8, Math.round(geo.ow * k)), Math.max(8, Math.round(geo.oh * k)));
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sels.set(sel, t);
    if (this.sels.size > 8) {
      const [old, tex] = this.sels.entries().next().value;
      this.sels.delete(old);
      gl.deleteTexture(tex);
    }
    return t;
  }

  /** Forgets graphics memory for ops that are gone (undone, deleted). */
  sweep() {
    if (this.bufs.size < 512) return;
    for (const [op, b] of this.bufs) if (this.frame - b.used > 120) { this.gl.deleteBuffer(b.buf); this.bufs.delete(op); }
  }

  dispose() {
    const gl = this.gl, r = this.r;
    for (const t of this.sets.values()) for (const x of [...t.acc, t.src, t.layer, t.cov]) r.free(x);
    for (const b of this.bufs.values()) gl.deleteBuffer(b.buf);
    if (this.liveBuf) gl.deleteBuffer(this.liveBuf);
    for (const t of this.sels.values()) gl.deleteTexture(t);
    for (const t of [...(this.pyr?.L || []), ...(this.pyr?.F || [])]) r.free(t);
    this.dropHeld();
    gl.deleteVertexArray(this.vao);
    for (const p of [this.dab, this.op, this.healL0, this.pull, this.push, this.comp]) gl.deleteProgram(p.p);
  }

  /**
   * The developed photo with `layers` on top into `target` (null = the
   * canvas). base(target, extra) draws the developed photo; extra may shift
   * it (oriented px) and swap in a sharper source for that op. `key` lists
   * what the picture depends on besides the layers: while a stroke is painted
   * (`live`) and nothing in it changes, everything under the stroke is kept
   * from the stroke's first frame, so painting costs only the stroke itself.
   */
  render(base, layers, geo, out2ori, target, live, key) {
    const gl = this.gl;
    this.frame = (this.frame || 0) + 1;
    const W = target ? target.w : gl.drawingBufferWidth, H = target ? target.h : gl.drawingBufferHeight;
    const T = this.set(W, H);
    const ori2out = inv3(out2ori);
    const ctx = {
      W, H, geo, base, live,
      k: Math.hypot(ori2out[0], ori2out[3]), // output px per oriented px
      ori2out, uOut2Ori: glMat(out2ori), uOri2Out: glMat(ori2out),
    };
    gl.disable(gl.SCISSOR_TEST);
    const liveAt = live ? layers.findIndex((l) => l.id === live.layerId) : -1;
    const fullKey = [...key, ...out2ori, W, H, target, live?.layerId];
    const C = this.held;
    const reuse = liveAt >= 0 && C && C.key.length === fullKey.length && C.key.every((v, i) => v === fullKey[i]);
    if (!live) this.dropHeld();
    let cur = 0;
    if (reuse) this.blit(C.below, T.acc[0]);
    else base(T.acc[0], null);

    for (let li = reuse ? liveAt : 0; li < layers.length; li++) {
      const layer = layers[li];
      if (li === liveAt && reuse) this.blit(C.layer, T.layer);
      else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.layer.fb);
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const op of layer.ops) this.drawOp(op, T, ctx, cur);
        // The stroke's first frame: keep what's under it for the frames to come.
        if (li === liveAt) {
          const held = this.hold(W, H);
          held.key = fullKey;
          this.blit(T.layer, held.layer);
          this.blit(T.acc[cur], held.below);
        }
      }
      if (li === liveAt) this.drawOp(live.op, T, ctx, cur);
      // Blend the layer onto what's below; the last one goes straight to the output.
      gl.disable(gl.SCISSOR_TEST);
      const last = li === layers.length - 1;
      this.r.draw(this.comp, last ? target : T.acc[1 - cur], {
        uBack: T.acc[cur].tex, uLayer: T.layer.tex, uMode: BLEND_INDEX[layer.blend] || 0, uOpacity: layer.opacity / 100,
      });
      cur = 1 - cur;
    }
    gl.disable(gl.SCISSOR_TEST);
    this.sweep();
  }

  hold(W, H) {
    if (this.held?.below.w !== W || this.held?.below.h !== H) {
      this.dropHeld();
      this.held = { below: this.r.target(W, H, this.gl.RGBA8), layer: this.r.target(W, H, this.gl.RGBA8) };
    }
    return this.held;
  }

  dropHeld() {
    if (!this.held) return;
    this.r.free(this.held.below);
    this.r.free(this.held.layer);
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
    let b = op === ctx.live?.op ? null : this.bounds.get(op);
    if (b === undefined || op === ctx.live?.op) {
      b = opBounds(op, geo.ow, geo.oh);
      if (op !== ctx.live?.op) this.bounds.set(op, b);
    }
    if (!b) return [0, 0, W, H];
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => ap(ori2out, x, y));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - pad)), x1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0])) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - pad)), y1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1])) + pad));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }

  /** One op onto T.layer; acc[cur] is what's under the layer. */
  drawOp(op, T, ctx, cur) {
    const gl = this.gl;
    const { W, H, geo, k } = ctx;
    const stroked = STROKED.has(op.t);
    if (stroked && !op.pts?.length) return;
    const heal = op.t === 'heal';
    const r = stroked ? op.size * Math.max(geo.ow, geo.oh) * k : 0;
    const rc = this.outRect(op, ctx, heal ? Math.max(6, r * 0.5) : 0);
    if (!rc) return;
    const scissor = () => { gl.enable(gl.SCISSOR_TEST); gl.scissor(rc[0], rc[1], rc[2], rc[3]); };
    // Its coverage: dabs added up (flow builds up within a stroke; opacity caps it).
    if (stroked) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.cov.fb);
      gl.viewport(0, 0, W, H);
      scissor();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const b = this.dabsOf(op, geo, op === ctx.live?.op);
      gl.useProgram(this.dab.p);
      gl.uniformMatrix3fv(this.dab.loc.uOri2Out, false, ctx.uOri2Out);
      gl.uniform2f(this.dab.loc.uOutSize, W, H);
      gl.uniform1f(this.dab.loc.uScale, k);
      gl.uniform1f(this.dab.loc.uHard, Math.min(0.999, (op.hard ?? 100) / 100));
      gl.uniform1f(this.dab.loc.uFlow, (op.flow ?? 100) / 100);
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
    }
    // Clones and heals: the developed photo, shifted by the source offset, just in this box.
    if (SOURCED.has(op.t)) {
      scissor();
      ctx.base(T.src, { shift: [op.dx * geo.ow, op.dy * geo.oh], op });
    }
    const mem = heal ? this.heal(T, rc, cur) : null;
    const sel = op.clip ? this.selTex(op.clip, geo) : null;
    scissor();
    gl.enable(gl.BLEND);
    if (op.t === 'erase' || op.t === 'clear') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.r.draw(this.op, T.layer, {
      uCov: T.cov.tex, uSrcTex: T.src.tex, uMem: mem ? mem.tex : T.src.tex, uSel: sel || T.src.tex,
      uKind: KIND[op.t] ?? 0, uColor: op.color || [0, 0, 0], uOpacity: (op.opacity ?? 100) / 100,
      uUseCov: stroked ? 1 : 0, uUseSel: sel ? 1 : 0, uOut2Ori: ctx.uOut2Ori, uOriSize: [geo.ow, geo.oh],
      uMemRect: mem ? [rc[0], rc[1], mem.scale] : [0, 0, 1], uMemSize: mem ? [mem.w, mem.h] : [1, 1], uMemCap: [MEM_CAP, MEM_CAP],
    });
    gl.disable(gl.BLEND);
  }

  /** The heal's colour correction for box rc: a smooth fill of the difference at its edge. */
  heal(T, rc, cur) {
    const gl = this.gl;
    const { L, F } = this.pyramid();
    const scale = Math.min(1, MEM_CAP / Math.max(rc[2], rc[3]));
    const sizes = [];
    let w = Math.max(1, Math.ceil(rc[2] * scale)), h = Math.max(1, Math.ceil(rc[3] * scale));
    for (let i = 0; i < L.length; i++) { sizes.push([w, h]); if (w === 1 && h === 1) break; w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2)); }
    const n = sizes.length;
    const at = (i) => { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, sizes[i][0], sizes[i][1]); };
    at(0);
    this.r.draw(this.healL0, L[0], { uBack: T.acc[cur].tex, uSrcTex: T.src.tex, uCov: T.cov.tex, uMemRect: [rc[0], rc[1], scale] });
    for (let i = 1; i < n; i++) { at(i); this.r.draw(this.pull, L[i], { uTex: L[i - 1].tex, uMax: [sizes[i - 1][0] - 1, sizes[i - 1][1] - 1] }); }
    for (let i = n - 1; i >= 0; i--) {
      at(i);
      const top = i === n - 1;
      // (the top level reads nothing coarser; L[i] just fills the slot)
      this.r.draw(this.push, F[i], top ? { uL: L[i].tex, uUp: L[i].tex, uUpSize: [1, 1], uUpCap: [1, 1], uTop: 1 }
        : { uL: L[i].tex, uUp: F[i + 1].tex, uUpSize: sizes[i + 1], uUpCap: [F[i + 1].w, F[i + 1].h], uTop: 0 });
    }
    return { tex: F[0].tex, scale, w: sizes[0][0], h: sizes[0][1] };
  }
}

