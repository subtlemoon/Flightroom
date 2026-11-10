// Draws Retouch layers (retouch.js) on top of the developed photo, on the
// graphics card, every time the photo is drawn. The developed photo goes into
// a buffer first; then each layer is made in a layer buffer (its strokes, a
// live copy of the photo, an adjustment of what's below, a fill, text...),
// run through its filters, given its mask and layer styles, and blended onto
// what's below (Photoshop's blend modes), the last one straight to the
// screen or export tile. Clones and heals draw the developed photo again,
// shifted by their source offset, just inside their own small box, so they
// follow every Develop change. Heals then even out the colour difference at
// their edge with a smooth fill (push-pull pyramid), like a healing brush.
import { BLEND_INDEX, REGION, SNAPSHOT, SOURCED, STROKED, isIdent, kindOf, layerBounds, opBounds, selectionCanvas, strokeDabs, stretchLine, stretchMap, tfPx, tfScale } from './retouch.js';
import { adjustmentLut, adjustmentUniforms } from './adjust.js';
import { filterPlan } from './filters.js';
import { rasterize } from './raster.js';
import { inv3 } from './color.js';
import { ap, glMat, mm } from './renderer.js';

const MEM_CAP = 1024; // the heal fill is worked out at up to this size

const KIND = { paint: 0, erase: 1, clone: 2, heal: 3, patch: 3, fill: 4, clear: 5, gradient: 6, dodge: 8, burn: 9, sponge: 10, blur: 11, sharpen: 12, smudge: 13, redeye: 14 };
const GRAD = { linear: 0, radial: 1, angle: 2, reflected: 3, diamond: 4 };
// Full-size buffers per output size, each made the first time it's needed.
const BUFFERS = ['acc0', 'acc1', 'src', 'layer', 'tmp', 'snap', 'mask', 'clipA', 'fxA', 'fxB', 'cov'];
const on = (x) => !!x && x.on !== false;
const STYLE_KEYS = ['shadow', 'glow', 'innerShadow', 'innerGlow', 'gradient', 'overlay', 'stroke'];

export class Composer {
  constructor(r) {
    this.r = r;
    this.dev = r.dev;
    // Program names (gpu/programs.js).
    this.progs = {
      dab: 'dab', op: 'op', covsel: 'covsel', inside: 'inside', healL0: 'healL0', pull: 'pull', push: 'push', comp: 'comp',
      adj: 'adj', blur: 'fxBlur', fx: 'fx', shade: 'shade', style: 'style', inner: 'inner', clipa: 'clipa', stretch: 'stretch',
    };
    this.sets = new Map(); // "WxH" -> buffers for that output size
    this.bufs = new Map(); // op -> { buf, n } (its dabs on the graphics card)
    this.sels = new Map(); // selection -> texture
    this.luts = new Map(); // adjustment -> lookup texture
    this.rasters = new Map(); // text / shape / placed picture key -> { tex, rect }
    this.fillOps = new WeakMap(); // a gradient fill layer's settings -> its op
    this.bounds = new WeakMap(); // op -> its box (oriented px)
  }

  /** Working buffers for one output size; the screen, refinement, histogram, preview and thumbnails each keep theirs. */
  set(W, H) {
    const key = `${W}x${H}`;
    let t = this.sets.get(key);
    if (!t) {
      const r = this.r;
      t = { W, H, small: new Map(), made: {} };
      for (const name of BUFFERS) {
        Object.defineProperty(t, name, {
          configurable: true, enumerable: true,
          get() { const v = (t.made[name] = r.target(W, H, 'rgba8')); Object.defineProperty(t, name, { value: v, writable: true, enumerable: true }); return v; },
        });
      }
      t.acc = [null, null];
      Object.defineProperty(t.acc, 0, { get: () => t.acc0 });
      Object.defineProperty(t.acc, 1, { get: () => t.acc1 });
      if (this.sets.size >= 5) { // screen, refinement, histogram, preview, filmstrip thumbnail
        const [old, o] = this.sets.entries().next().value;
        this.sets.delete(old);
        this.freeSet(o);
      }
    } else this.sets.delete(key);
    this.sets.set(key, t);
    return t;
  }

  freeSet(t) {
    for (const v of Object.values(t.made)) this.r.free(v);
    for (const v of t.small.values()) for (const x of v) this.r.free(x);
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
    const data = strokeDabs(op, geo.ow, geo.oh);
    const buf = this.dev.buffer(data, live ? this.liveBuf : null);
    if (live) this.liveBuf = buf;
    b = { buf, n: data.length / 4, used: this.frame, live };
    if (!live) this.bufs.set(op, b);
    return b;
  }

  texOf(source, premultiply = false) { return this.dev.textureFrom(source, premultiply); }

  /** Keeps at most n entries in a cache of textures (oldest out first). */
  trim(map, n, tex = (v) => v) {
    while (map.size > n) {
      const [old, v] = map.entries().next().value;
      map.delete(old);
      this.dev.free(tex(v));
    }
  }

  selTex(sel, geo) {
    let t = this.sels.get(sel);
    if (t) return t;
    const k = Math.min(1, Math.min(4096, this.r.maxTex) / Math.max(geo.ow, geo.oh));
    t = this.texOf(selectionCanvas(sel, Math.max(8, Math.round(geo.ow * k)), Math.max(8, Math.round(geo.oh * k)), geo.ow, geo.oh));
    this.sels.set(sel, t);
    this.trim(this.sels, 12);
    return t;
  }

  lutTex(adj) {
    let t = this.luts.get(adj);
    if (t) return t;
    const lut = adjustmentLut(adj);
    if (!lut) return null;
    t = this.dev.texture('rgba8', lut.w, lut.h, lut.data);
    this.luts.set(adj, t);
    this.trim(this.luts, 16);
    return t;
  }

  /** A text, shape or placed-picture layer drawn at about `scale` output px per oriented px (in steps, so zooming doesn't redraw it every frame). */
  rasterOf(l, geo, scale) {
    const step = 1.25 ** Math.ceil(Math.log(Math.max(scale, 1e-3)) / Math.log(1.25));
    const what = l.kind === 'image' ? { ...l.image, src: l.image.src.length + l.image.src.slice(-48) } : l.kind === 'text' ? l.text : l.shape;
    const key = `${l.kind}|${JSON.stringify(what)}|${step.toFixed(4)}`;
    let hit = this.rasters.get(key);
    if (hit) { this.rasters.delete(key); this.rasters.set(key, hit); return hit; }
    const ras = rasterize(l, geo.ow, geo.oh, step, Math.min(4096, this.r.maxTex));
    if (!ras) return null;
    hit = { tex: this.texOf(ras.canvas, true), rect: ras.rect };
    this.rasters.set(key, hit);
    this.trim(this.rasters, 24, (h) => h.tex);
    return hit;
  }

  /** Forgets graphics memory for ops that are gone (undone, deleted). */
  sweep() {
    if (this.bufs.size < 512) return;
    for (const [op, b] of this.bufs) if (this.frame - b.used > 120) { this.dev.freeBuffer(b.buf); this.bufs.delete(op); }
  }

  dispose() {
    const dev = this.dev, r = this.r;
    for (const t of this.sets.values()) this.freeSet(t);
    for (const b of this.bufs.values()) dev.freeBuffer(b.buf);
    if (this.liveBuf) dev.freeBuffer(this.liveBuf);
    for (const t of [...this.sels.values(), ...this.luts.values()]) dev.free(t);
    for (const h of this.rasters.values()) dev.free(h.tex);
    for (const t of [...(this.pyr?.L || []), ...(this.pyr?.F || [])]) r.free(t);
    this.dropHeld();
  }

  /** ctx for drawing a layer moved / turned / scaled by its transform. */
  layerCtx(ctx, tf) {
    if (!tf || isIdent(tf)) return ctx;
    const m = tfPx(tf, ctx.geo.ow, ctx.geo.oh);
    const ori2out = mm(ctx.ori2out, [m[0], m[1], m[2], m[3], m[4], m[5], 0, 0, 1]);
    const out2ori = inv3(ori2out);
    return { ...ctx, ori2out, out2ori, k: ctx.k * tfScale(m), uOri2Out: glMat(ori2out), uOut2Ori: glMat(out2ori), moved: true };
  }

  /**
   * The developed photo with `layers` on top into `target` (null = the
   * canvas). base(target, extra) draws the developed photo; extra may shift
   * it (oriented px), map it differently (a moved layer) and swap in a
   * sharper source for that op. `key` lists what the picture depends on
   * besides the layers: while a stroke is painted (`live.op`) and nothing in
   * it changes, everything under the stroke is kept from the stroke's first
   * frame, so painting costs only the stroke itself (and what's on top).
   * live.tf moves a layer while it's dragged.
   */
  render(base, layers, geo, out2ori, target, live, key) {
    const dev = this.dev;
    this.frame = (this.frame || 0) + 1;
    const W = target ? target.w : dev.width(), H = target ? target.h : dev.height();
    const T = this.set(W, H);
    const ori2out = inv3(out2ori);
    const ctx = {
      W, H, geo, base, live, ori2out, out2ori,
      k: Math.hypot(ori2out[0], ori2out[3]), // output px per oriented px
      uOut2Ori: glMat(out2ori), uOri2Out: glMat(ori2out),
    };
    dev.setScissor(null);
    const liveAt = live ? layers.findIndex((l) => l.id === live.layerId) : -1;
    const fullKey = [...key, ...out2ori, W, H, target, live?.layerId, live?.target];
    const C = this.held;
    // A stroke being painted or a layer being moved: what's under it is kept from the first frame.
    const held = !!(live?.op || live?.tf);
    const reuse = liveAt >= 0 && held && C && C.key.length === fullKey.length && C.key.every((v, i) => v === fullKey[i]);
    if (!held) this.dropHeld();
    this.cur = 0;
    if (reuse) this.blit(C.below, T.acc[0]);
    else base(T.acc[0], null);

    for (let li = reuse ? liveAt : 0; li < layers.length; li++) {
      let layer = layers[li];
      const isLive = li === liveAt;
      if (isLive && live.tf) layer = { ...layer, tf: live.tf };
      const lc = this.layerCtx(ctx, layer.tf);
      const masked = !!layer.mask && !layer.mask.off;
      if (isLive && reuse && !live.tf) {
        this.blit(C.layer, T.layer);
        if (masked) this.blit(C.mask, T.mask);
        if (layer.clip) this.blit(C.clipA, T.clipA);
      } else if (isLive && reuse) { // moved: drawn again where it is now
        this.content(layer, T, lc);
        if (masked) this.drawMask(layer, T, lc);
        if (layer.clip) this.blit(C.clipA, T.clipA);
      } else {
        this.content(layer, T, lc);
        if (masked) this.drawMask(layer, T, lc);
        // The first frame: keep what's under it for the frames to come.
        if (isLive && held) {
          const held = this.hold(W, H, masked, layer.clip);
          held.key = fullKey;
          this.blit(T.layer, held.layer);
          this.blit(T.acc[this.cur], held.below);
          if (masked) this.blit(T.mask, held.mask);
          if (layer.clip) this.blit(T.clipA, held.clipA);
        }
      }
      if (isLive && live.op) this.drawOp(live.op, T, lc, live.target === 'mask' && masked ? T.mask : T.layer);
      const last = li === layers.length - 1;
      this.finish(layer, T, ctx, lc, last ? target : null, last, layers[li + 1]);
    }
    dev.setScissor(null);
    this.sweep();
  }

  /** A layer's own pixels into T.layer. */
  content(layer, T, lc) {
    const dev = this.dev;
    const kind = kindOf(layer);
    const solid = kind === 'fill' && layer.fillDef?.type !== 'gradient';
    const c = solid ? layer.fillDef?.color || [0, 0, 0] : null;
    dev.setScissor(null);
    dev.clear(T.layer, [c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? 1 : 0]);
    if (kind === 'photo') {
      lc.base(T.layer, { shift: [0, 0], out2ori: lc.out2ori });
      if (lc.moved) {
        dev.setBlend('multiply');
        this.r.draw(this.progs.inside, T.layer, { uOut2Ori: lc.uOut2Ori, uOriSize: [lc.geo.ow, lc.geo.oh] });
        dev.setBlend(null);
      }
    } else if (kind === 'stretch' && layer.stretch) {
      // The photo with every pixel taken from the line, then kept only on the line.
      const { geo } = lc;
      const st = stretchLine(layer.stretch, geo.ow, geo.oh);
      lc.base(T.layer, { shift: [0, 0], out2ori: mm(stretchMap(layer.stretch, geo.ow, geo.oh), lc.out2ori), op: layer });
      dev.setBlend('multiply');
      this.r.draw(this.progs.stretch, T.layer, { uOut2Ori: lc.uOut2Ori, uS: [st.col ? 1 : 0, st.line, st.a0, st.a1] });
      dev.setBlend(null);
    } else if (kind === 'stamp') this.blit(T.acc[this.cur], T.layer);
    else if (kind === 'adjust' && layer.adj) {
      const { type, p } = adjustmentUniforms(layer.adj);
      this.r.draw(this.progs.adj, T.layer, { uBack: T.acc[this.cur].tex, uAdj: type, uP: p, uLut: this.lutTex(layer.adj) || T.acc[this.cur].tex });
    } else if (kind === 'fill' && layer.fillDef?.type === 'gradient') {
      this.drawOp(this.fillOp(layer), T, lc, T.layer);
    } else if ((kind === 'text' && layer.text) || (kind === 'shape' && layer.shape) || (kind === 'image' && layer.image)) {
      const ras = this.rasterOf(layer, lc.geo, lc.k);
      if (!ras) { for (const op of layer.ops) this.drawOp(op, T, lc, T.layer); return; }
      dev.setBlend('over');
      const t = ras.tex;
      this.r.draw(this.progs.op, T.layer, {
        uKind: 7, uImg: t, uImgRect: ras.rect, uOpacity: 1, uUseCov: 0, uUseSel: 0, uOut2Ori: lc.uOut2Ori, uOriSize: [lc.geo.ow, lc.geo.oh],
        uCov: t, uSrcTex: t, uMem: t, uSel: t, uSnap: t, uBack: t,
      });
      dev.setBlend(null);
    }
    for (const op of layer.ops) this.drawOp(op, T, lc, T.layer);
  }

  fillOp(layer) {
    let op = this.fillOps.get(layer.fillDef);
    if (!op) { op = { t: 'gradient', opacity: 100, ...layer.fillDef.g }; this.fillOps.set(layer.fillDef, op); }
    return op;
  }

  /** A layer mask into T.mask: reveal or hide all, then its strokes, fills and gradients. */
  drawMask(layer, T, lc) {
    const v = layer.mask.base ?? 1;
    this.dev.setScissor(null);
    this.dev.clear(T.mask, [v, v, v, 1]);
    for (const op of layer.mask.ops) this.drawOp(op, T, lc, T.mask);
  }

  /** Filters, mask feather and layer styles, then the layer onto what's below. */
  finish(layer, T, ctx, lc, target, last, next) {
    const dev = this.dev;
    dev.setScissor(null);
    for (const f of layer.filters || []) if (on(f)) this.filter(f, T, ctx);
    const masked = !!layer.mask && !layer.mask.off;
    const L = Math.max(ctx.geo.ow, ctx.geo.oh);
    if (masked && layer.mask.feather > 0) {
      const b = this.blur(T, T.mask, layer.mask.feather * L * lc.k * 0.5, 0);
      this.r.draw(this.progs.fx, T.tmp, { uTex: T.mask.tex, uBlur: b.tex, uFx: 1, uOutSize: [ctx.W, ctx.H], ...this.blurScale(b, ctx), uUseSel: 0, uSel: T.mask.tex });
      [T.mask, T.tmp] = [T.tmp, T.mask];
    }
    const density = masked ? (layer.mask.density ?? 100) / 100 : 0;
    const clip = layer.clip ? T.clipA : null;
    const comp = (tex, mode, opacity, final) => {
      this.r.draw(this.progs.comp, final ? target : T.acc[1 - this.cur], {
        uBack: T.acc[this.cur].tex, uLayer: tex, uMode: BLEND_INDEX[mode] ?? 0, uOpacity: opacity,
        uMask: masked ? T.mask.tex : tex, uUseMask: masked ? 1 : 0, uDensity: density, uClip: clip ? clip.tex : tex, uUseClip: clip ? 1 : 0,
        uOut2Ori: ctx.uOut2Ori, uOriSize: [ctx.geo.ow, ctx.geo.oh],
      });
      if (!final) this.cur = 1 - this.cur;
    };
    const st = layer.style && !layer.style.hidden ? layer.style : {};
    const fill = (layer.fill ?? 100) / 100, opacity = layer.opacity / 100;
    // The base of a clipping group: its shape, for the layers clipped to it.
    if (next?.clip && !layer.clip) {
      this.r.draw(this.progs.clipa, T.clipA, { uTex: T.layer.tex, uMask: masked ? T.mask.tex : T.layer.tex, uUseMask: masked ? 1 : 0, uDensity: density, uOpacity: opacity });
    }
    if (!STYLE_KEYS.some((k) => on(st[k]))) { comp(T.layer.tex, layer.blend, opacity * fill, last); return; }
    // Shadows and glows go under the layer, each with its own blend mode.
    const lin = (dx, dy) => { const a = ap(ctx.ori2out, dx, dy), o = ap(ctx.ori2out, 0, 0); return [a[0] - o[0], a[1] - o[1]]; };
    const shift = (sh) => { const ang = ((sh.angle ?? 120) * Math.PI) / 180; return lin(-Math.cos(ang) * sh.distance * L, Math.sin(ang) * sh.distance * L); };
    for (const [fx, sh] of [['shadow', st.shadow], ['glow', st.glow]]) {
      if (!on(sh)) continue;
      const b = this.blur(T, T.layer, Math.max(0.01, sh.size * L * ctx.k * 0.5), 0);
      this.r.draw(this.progs.shade, T.fxA, {
        uTex: b.tex, uOff: fx === 'shadow' ? shift(sh) : [0, 0], uOutSize: [ctx.W, ctx.H], ...this.blurScale(b, ctx), uColor: sh.color, uGain: (fx === 'shadow' ? 1 : 2) + (sh.spread || 0) / 20,
      });
      comp(T.fxA.tex, sh.blend || (fx === 'shadow' ? 'multiply' : 'screen'), (opacity * sh.opacity) / 100, false);
    }
    // The stroke's shape (ends in T.snap), then inner glow and inner shadow over
    // it in T.tmp, which the style pass lays on the layer.
    const dil = on(st.stroke) ? this.dilate(T, T.layer, Math.max(0.5, st.stroke.size * L * ctx.k)) : null;
    let inner = false;
    for (const [fx, sh] of [['innerGlow', st.innerGlow], ['innerShadow', st.innerShadow]]) {
      if (!on(sh)) continue;
      const b = this.blur(T, T.layer, Math.max(0.01, sh.size * L * ctx.k * 0.5), 0);
      if (inner) dev.setBlend('over');
      this.r.draw(this.progs.inner, T.tmp, {
        uTex: T.layer.tex, uBlur: b.tex, uOff: fx === 'innerShadow' ? shift(sh) : [0, 0], uOutSize: [ctx.W, ctx.H], ...this.blurScale(b, ctx),
        uColor: sh.color, uGain: 1 + (sh.choke || 0) / 20, uOpacity: sh.opacity / 100,
      });
      dev.setBlend(null);
      inner = true;
    }
    // Gradient Overlay: across the layer's box (the whole photo for a photo layer), at its angle.
    let g0 = [0, 0], g1 = [0, 0];
    if (on(st.gradient)) {
      const bx = layerBounds({ ...layer, tf: null }, ctx.geo.ow, ctx.geo.oh) || [0, 0, ctx.geo.ow, ctx.geo.oh];
      const cx = (bx[0] + bx[2]) / 2, cy = (bx[1] + bx[3]) / 2, ang = ((st.gradient.angle ?? 90) * Math.PI) / 180;
      const dx = Math.cos(ang), dy = -Math.sin(ang);
      const ext = st.gradient.style === 'radial' ? Math.hypot(bx[2] - bx[0], bx[3] - bx[1]) / 2 : Math.abs(dx) * (bx[2] - bx[0]) / 2 + Math.abs(dy) * (bx[3] - bx[1]) / 2;
      const radial = st.gradient.style === 'radial';
      g0 = ap(lc.ori2out, radial ? cx : cx - dx * ext, radial ? cy : cy - dy * ext);
      g1 = ap(lc.ori2out, cx + dx * ext, cy + dy * ext);
    }
    const gr = st.gradient || {};
    this.r.draw(this.progs.style, T.fxB, {
      uTex: T.layer.tex, uDil: dil ? dil.tex : T.layer.tex, uInner: inner ? T.tmp.tex : T.layer.tex, uUseInner: inner ? 1 : 0, uOutSize: [ctx.W, ctx.H], uScale: [1, 1],
      uFill: fill, uUseStroke: dil ? 1 : 0, uStrokeC: st.stroke?.color || [0, 0, 0], uStrokeA: (st.stroke?.opacity ?? 100) / 100,
      uUseOverlay: on(st.overlay) ? 1 : 0, uOverlayC: st.overlay?.color || [1, 0, 0], uOverlayA: (st.overlay?.opacity ?? 100) / 100,
      uUseGrad: on(st.gradient) ? 1 : 0, uG0: g0, uG1: g1, uGC0: gr.reverse ? gr.c1 || [1, 1, 1] : gr.c0 || [0, 0, 0], uGC1: gr.reverse ? gr.c0 || [0, 0, 0] : gr.c1 || [1, 1, 1],
      uGradA: (gr.opacity ?? 100) / 100, uGradRadial: gr.style === 'radial' ? 1 : 0,
    });
    comp(T.fxB.tex, layer.blend, opacity, last);
  }

  blurScale(b, ctx) { return { uScale: [ctx.W / b.f / b.w, ctx.H / b.f / b.h] }; }

  /** Two buffers at 1/f of the output size, for big blurs. */
  small(T, f) {
    let s = T.small.get(f);
    if (!s) {
      const w = Math.max(1, Math.ceil(T.W / f)), h = Math.max(1, Math.ceil(T.H / f));
      s = [this.r.target(w, h, 'rgba8'), this.r.target(w, h, 'rgba8')];
      T.small.set(f, s);
    }
    return s;
  }

  /**
   * src blurred (sigma in output px; mode 0 Gaussian, 1 box, 2 max, 3 min;
   * dir: along one direction only). Big blurs are worked out on a smaller
   * copy. Returns { tex, w, h, f }: sample it at position / output size * blurScale.
   */
  blur(T, src, sigma, mode, dir) {
    let f = 1;
    if (mode < 2) while (sigma / f > 12 && f < 32) f *= 2;
    let from = src, pair;
    if (f > 1) {
      // Halving step by step keeps every pixel counted.
      for (let g = 2; g <= f; g *= 2) {
        const [a] = this.small(T, g);
        this.dev.blit(from, a, true);
        from = a;
      }
      pair = this.small(T, f);
    } else pair = [T.fxA, T.fxB];
    let cur = from;
    for (const d of dir ? [dir] : [[1, 0], [0, 1]]) {
      const out = cur === pair[0] ? pair[1] : pair[0];
      this.r.draw(this.progs.blur, out, { uTex: cur.tex, uDir: d, uSize: [out.w, out.h], uSigma: sigma / f, uMode: mode });
      cur = out;
    }
    return { tex: cur.tex, w: cur.w, h: cur.h, f };
  }

  /** src's shape grown by r output px (an octagon, near enough round). */
  dilate(T, src, r) {
    const a = r * (Math.SQRT2 - 1), b = r * (2 - Math.SQRT2) * 0.5;
    const pair = [T.tmp, T.snap];
    let cur = src;
    for (const [d, rr] of [[[1, 0], a], [[0, 1], a], [[1, 1], b], [[1, -1], b]]) {
      const out = cur === pair[0] ? pair[1] : pair[0];
      this.r.draw(this.progs.blur, out, { uTex: cur.tex, uDir: d, uSize: [out.w, out.h], uSigma: Math.max(0.5, rr), uMode: 2 });
      cur = out;
    }
    return { tex: cur.tex, w: cur.w, h: cur.h, f: 1 };
  }

  /** One filter on T.layer. */
  filter(f, T, ctx) {
    const plan = filterPlan(f);
    const L = Math.max(ctx.geo.ow, ctx.geo.oh);
    let b = null;
    if (plan.blur) b = this.blur(T, T.layer, Math.max(0.05, plan.blur * ctx.k), 0);
    else if (plan.box) b = this.blur(T, T.layer, Math.max(0.5, plan.box * ctx.k), 1);
    else if (plan.max || plan.min) b = this.blur(T, T.layer, Math.max(0.5, (plan.max || plan.min) * ctx.k), plan.max ? 2 : 3);
    else if (plan.motion) {
      const [dist, deg] = plan.motion;
      const a = (deg * Math.PI) / 180;
      const p = ap(ctx.ori2out, Math.cos(a), -Math.sin(a)), o = ap(ctx.ori2out, 0, 0);
      const v = [p[0] - o[0], p[1] - o[1]], n = Math.hypot(v[0], v[1]) || 1;
      b = this.blur(T, T.layer, Math.max(0.5, dist * ctx.k * 0.5), 1, [v[0] / n, v[1] / n]);
    }
    const c = f.center || [0.5, 0.5];
    this.r.draw(this.progs.fx, T.tmp, {
      uTex: T.layer.tex, uBlur: b ? b.tex : T.layer.tex, ...(b ? this.blurScale(b, ctx) : { uScale: [1, 1] }), uSel: f.clip ? this.selTex(f.clip, ctx.geo) : T.layer.tex,
      uOutSize: [ctx.W, ctx.H], uOriSize: [ctx.geo.ow, ctx.geo.oh], uOut2Ori: ctx.uOut2Ori, uOri2Out: ctx.uOri2Out,
      uFx: plan.fx, uK: ctx.k, uUseSel: f.clip ? 1 : 0, uSeed: f.seed || 0, uP: [...(plan.p || []), 0, 0, 0, 0].slice(0, 4),
      uFg: f.fg || [0, 0, 0], uBg: f.bg || [1, 1, 1], uCenter: [c[0] * ctx.geo.ow, c[1] * ctx.geo.oh, (f.rad || 0.5) * L],
    });
    [T.layer, T.tmp] = [T.tmp, T.layer];
  }

  hold(W, H, masked, clip) {
    if (this.held?.below.w !== W || this.held?.below.h !== H) {
      this.dropHeld();
      this.held = { below: this.r.target(W, H, 'rgba8'), layer: this.r.target(W, H, 'rgba8') };
    }
    if (masked && !this.held.mask) this.held.mask = this.r.target(W, H, 'rgba8');
    if (clip && !this.held.clipA) this.held.clipA = this.r.target(W, H, 'rgba8');
    return this.held;
  }

  dropHeld() {
    if (!this.held) return;
    for (const t of Object.values(this.held)) if (t?.tex) this.r.free(t);
    this.held = null;
  }

  blit(from, to) { this.dev.blit(from, to, false); }

  /** Where an op draws on the output (px, y up): [x, y, w, h], or null when off it. */
  outRect(op, ctx, pad) {
    const { geo, W, H, ori2out } = ctx;
    const isLive = op === ctx.live?.op;
    let b = isLive ? undefined : this.bounds.get(op);
    if (b === undefined) {
      b = opBounds(op, geo.ow, geo.oh);
      if (!isLive) this.bounds.set(op, b);
    }
    if (!b) return [0, 0, W, H];
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => ap(ori2out, x, y));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - pad)), x1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0])) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - pad)), y1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1])) + pad));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }

  /** One op onto dst (a layer or mask buffer); acc[cur] is what's under the layer. */
  drawOp(op, T, ctx, dst) {
    const dev = this.dev;
    const { W, H, geo, k } = ctx;
    const stroked = STROKED.has(op.t), region = REGION.has(op.t);
    if (stroked && !op.pts?.length) return;
    const heal = op.t === 'heal' || op.t === 'patch';
    const r = stroked ? op.size * Math.max(geo.ow, geo.oh) * k : 0;
    const rc = this.outRect(op, ctx, heal ? Math.max(6, r * 0.5) : op.t === 'blur' || op.t === 'sharpen' || op.t === 'smudge' ? 4 + r : 0);
    if (!rc) return;
    const scissor = () => dev.setScissor(rc);
    const sel = op.clip ? this.selTex(op.clip, geo) : null;
    // Its coverage: dabs added up (flow builds up within a stroke; opacity caps it), or its selection.
    if (stroked || region) {
      scissor();
      dev.clear(T.cov, [0, 0, 0, 0]);
      if (stroked) {
        const b = this.dabsOf(op, geo, op === ctx.live?.op);
        dev.setBlend('over');
        dev.drawDabs(this.progs.dab, T.cov, {
          uOri2Out: ctx.uOri2Out, uOutSize: [W, H], uScale: k,
          uHard: Math.min(0.999, (op.hard ?? 100) / 100), uFlow: (op.flow ?? 100) / 100, uAlias: op.alias ? 1 : 0,
        }, b.buf, b.n);
        dev.setBlend(null);
      } else if (sel) {
        this.r.draw(this.progs.covsel, T.cov, { uSel: sel, uOut2Ori: ctx.uOut2Ori, uOriSize: [geo.ow, geo.oh] });
      }
    }
    // Clones and heals: the developed photo, shifted by the source offset, just in this box.
    if (SOURCED.has(op.t)) {
      scissor();
      ctx.base(T.src, { shift: [op.dx * geo.ow, op.dy * geo.oh], op, out2ori: ctx.out2ori });
    }
    const mem = heal ? this.heal(T, rc) : null;
    if (SNAPSHOT.has(op.t)) this.blit(dst, T.snap);
    scissor();
    dev.setBlend(op.t === 'erase' || op.t === 'clear' ? 'erase' : op.keepAlpha ? 'keepAlpha' : 'over');
    const strength = (op.strength ?? 50) / 100;
    this.r.draw(this.progs.op, dst, {
      uCov: T.cov.tex, uSrcTex: T.src.tex, uMem: mem ? mem.tex : T.src.tex, uSel: sel || T.src.tex, uSnap: T.snap.tex, uBack: T.acc[this.cur].tex, uImg: T.src.tex,
      uKind: KIND[op.t] ?? 0, uColor: op.color || [0, 0, 0], uOpacity: (op.opacity ?? 100) / 100, uK: k,
      uUseCov: stroked || region ? 1 : 0, uUseSel: sel && !region ? 1 : 0, uOut2Ori: ctx.uOut2Ori, uOriSize: [geo.ow, geo.oh],
      uMemRect: mem ? [rc[0], rc[1], mem.scale] : [0, 0, 1], uMemSize: mem ? [mem.w, mem.h] : [1, 1], uMemCap: [MEM_CAP, MEM_CAP],
      uG: op.t === 'gradient' ? [op.x0 * geo.ow, op.y0 * geo.oh, op.x1 * geo.ow, op.y1 * geo.oh] : [0, 0, 1, 0],
      uGStyle: GRAD[op.style] ?? 0, uC0: op.c0 || [0, 0, 0, 1], uC1: op.c1 || [1, 1, 1, 1],
      uP: [op.range ?? 1, strength, op.protect ? 1 : 0, op.t === 'smudge' ? r * strength * 1.2 : 0],
    });
    dev.setBlend(null);
  }

  /** The heal's colour correction for box rc: a smooth fill of the difference at its edge. */
  heal(T, rc) {
    const { L, F } = this.pyramid();
    const scale = Math.min(1, MEM_CAP / Math.max(rc[2], rc[3]));
    const sizes = [];
    let w = Math.max(1, Math.ceil(rc[2] * scale)), h = Math.max(1, Math.ceil(rc[3] * scale));
    for (let i = 0; i < L.length; i++) { sizes.push([w, h]); if (w === 1 && h === 1) break; w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2)); }
    const n = sizes.length;
    const at = (i) => this.dev.setScissor([0, 0, sizes[i][0], sizes[i][1]]);
    at(0);
    this.r.draw(this.progs.healL0, L[0], { uBack: T.acc[this.cur].tex, uSrcTex: T.src.tex, uCov: T.cov.tex, uMemRect: [rc[0], rc[1], scale] });
    for (let i = 1; i < n; i++) { at(i); this.r.draw(this.progs.pull, L[i], { uTex: L[i - 1].tex, uMax: [sizes[i - 1][0] - 1, sizes[i - 1][1] - 1] }); }
    for (let i = n - 1; i >= 0; i--) {
      at(i);
      const top = i === n - 1;
      // (the top level reads nothing coarser; L[i] just fills the slot)
      this.r.draw(this.progs.push, F[i], top ? { uL: L[i].tex, uUp: L[i].tex, uUpSize: [1, 1], uUpCap: [1, 1], uTop: 1 }
        : { uL: L[i].tex, uUp: F[i + 1].tex, uUpSize: sizes[i + 1], uUpCap: [F[i + 1].w, F[i + 1].h], uTop: 0 });
    }
    return { tex: F[0].tex, scale, w: sizes[0][0], h: sizes[0][1] };
  }
}
