// Develop's background maker of filmstrip thumbnails (thumbs.js keeps and
// shows them). Separate so Culling's bundle doesn't take in the renderer.
import { bridge } from '../bridge.js';
import { Geometry, Renderer, parseFrame } from './renderer.js';
import { fromXmp } from './params.js';
import { asShotTempTint } from './color.js';
import { session } from './session.js';
import { hasDevelopedThumb, keepThumb, pixelsToBlob, thumbSize } from './thumbs.js';

/**
 * Makes developed thumbnails for photos not on screen, one at a time, only
 * while nothing else is going on: Develop calls want(photos) with the ones
 * the filmstrip should show as developed (nearest first), and busy() says when
 * to hold off. Each photo's RAW is read just for this (see develop_peek).
 */
export function thumbBuilder({ busy }) {
  let queue = [];
  let running = false, dead = false, r = null, timer = 0;
  const done = new Set(); // made (or failed) this session
  const drop = () => { r?.dispose(); r = null; };
  const later = (ms) => { clearTimeout(timer); if (!dead) timer = setTimeout(tick, ms); };
  async function tick() {
    if (running || dead || !queue.length) { if (!queue.length) drop(); return; }
    if (busy()) { later(800); return; }
    const p = queue.shift();
    running = true;
    try {
      const got = await bridge.develop.peek(p, 640);
      if (dead) return;
      if (got.error) throw new Error(got.error);
      const { info } = got;
      const s = session.settings.get(p.id) || fromXmp(info.settings, info.curves, asShotTempTint(info), info.own, info.look);
      r ||= new Renderer(new OffscreenCanvas(16, 16));
      r.setSource(parseFrame(got.frame));
      const geo = new Geometry(info.width, info.height, info.orientation, info.lens);
      const f = geo.frame(s.crop);
      const { w, h } = thumbSize(f);
      const px = await r.previewReady(info, s, geo, f, w, h, null);
      await keepThumb(p, await pixelsToBlob(px, w, h));
    } catch (err) {
      console.warn(`[thumbs] ${p.name}: ${err.message || err}`);
    } finally {
      done.add(p.id);
      running = false;
      later(150);
    }
  }
  return {
    /** The photos to make thumbnails for, nearest first (replaces the last list). */
    want(list) {
      queue = list.filter((p) => p.raw && !done.has(p.id) && !hasDevelopedThumb(p.id));
      later(1500);
    },
    /** Their settings changed without being on screen (pasted, preset): made again. */
    redo(list) {
      for (const p of list) { done.delete(p.id); }
      queue = [...list.filter((p) => p.raw), ...queue.filter((q) => !list.some((p) => p.id === q.id))];
      later(1500);
    },
    stop() { dead = true; clearTimeout(timer); queue = []; if (!running) drop(); else setTimeout(drop, 3000); },
  };
}
