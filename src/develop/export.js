// Exports developed photos as JPEGs. The full-resolution photo is far too big
// for one pass on the graphics card, so it is rendered in tiles: for each tile
// the desktop side demosaics just the part of the RAW it needs, the tile goes
// through the same shaders as the screen, and the pixels go back to be joined
// and encoded.
import { bridge } from '../bridge.js';
import { Geometry, Renderer, ap, mat, mm, parseFrame, sourceMap } from './renderer.js';
import { SNAPSHOT, opBounds, sourceRegions, visibleLayers } from './retouch.js';
import { filterReach } from './filters.js';

const DISTORT = new Set(['radial', 'pinch', 'spherize', 'twirl']);

const TILE = 2048;
// A tile is drawn with room around it for effects that reach past its edge. The
// padded tile is one picture on the graphics card, so its edge is capped (with
// room up to 1,024 px it is 2048 + 2 x 1024, as always); wider room shrinks the
// tile instead, down to MIN_TILE. Effects reaching further than that still
// export, with as much room as fits.
export const MAX_PADDED = 6144;
const MIN_TILE = 512;

/**
 * Tiles ([x, y, w, h], output px) for an EW x EH export whose effects reach
 * `reach` output px past a tile's edge, and the room (pad) drawn around each.
 */
export function tileGrid(EW, EH, reach, maxPadded = MAX_PADDED) {
  const pad = Math.min(Math.ceil(Math.max(0, reach)), Math.floor((maxPadded - MIN_TILE) / 2));
  const tile = Math.min(TILE, maxPadded - 2 * pad);
  const tiles = [];
  for (let ty = 0; ty < EH; ty += tile) for (let tx = 0; tx < EW; tx += tile) tiles.push([tx, ty, Math.min(tile, EW - tx), Math.min(tile, EH - ty)]);
  return { pad, tiles };
}

const healRing = (long, k) => Math.max(16, long * k * 0.004);
/** The w x h middle of a padded tile's pixels (rows bottom first, as read back). */
function inner(px, pw, pad, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(px.subarray(((y + pad) * pw + pad) * 4, ((y + pad) * pw + pad + w) * 4), y * w * 4);
  return out;
}

async function fetchFrame(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return parseFrame(await res.arrayBuffer());
}

/** Output size for a crop frame and a long-edge limit (0 = full size). */
export function exportSize(frame, longEdge) {
  const full = 2 * Math.max(frame.hw, frame.hh);
  const scale = longEdge ? Math.min(1, longEdge / full) : 1;
  return { scale, w: Math.max(1, Math.round(2 * frame.hw * scale)), h: Math.max(1, Math.round(2 * frame.hh * scale)) };
}

/**
 * Renders and saves one photo. opts: { folder, longEdge, quality, onProgress(0-1), cancelled(),
 * renderer (one to reuse for a batch; else one is made for this photo) }.
 * Returns the saved file's path.
 */
export async function exportPhoto(photo, info, s, opts) {
  const dev = bridge.develop;
  const r = opts.renderer || new Renderer(new OffscreenCanvas(16, 16));
  const job = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let begun = false;
  try {
    const dn = info.denoised ? s.aiDenoise || 0 : 0;
    r.setSource(await fetchFrame(dev.imageUrl(photo, 2048, false, dn)));
    const geo = new Geometry(info.width, info.height, info.orientation);
    const f = geo.frame(s.crop);
    const { scale, w: EW, h: EH } = exportSize(f, opts.longEdge);
    const k = scale; // output px per oriented px
    const started = await dev.exportBegin({ job, folder: opts.folder, name: photo.name, width: EW, height: EH, quality: opts.quality, source: photo.id });
    if (started?.error) throw new Error(started.error);
    begun = true;
    const toOriented = geo.frameToOriented(f);
    const toSource = sourceMap(geo, s);
    const margin = 16 + 4 * s.sharpenRadius + (s.removeCA || s.defringePurple || s.defringeGreen ? 8 : 0);
    const layers = visibleLayers(s);
    // A heal works out its colour from all around its edge, and filters, layer
    // styles and feathered masks reach for pixels around them, so a tile is
    // drawn with room around it for what crosses into the next one.
    const long = Math.max(geo.ow, geo.oh);
    const heals = layers.flatMap((l) => l.ops.filter((op) => op.t === 'heal' || op.t === 'patch'));
    const healPad = heals.length ? Math.max(...heals.map((op) => {
      const b = opBounds(op, geo.ow, geo.oh);
      return b ? Math.max(b[2] - b[0], b[3] - b[1]) * k * 0.5 + healRing(long, k) : 0;
    })) : 0;
    const reach = (l) => {
      const st = l.style || {}, on = (x) => x && x.on !== false;
      const styles = Math.max(on(st.shadow) ? (st.shadow.distance + st.shadow.size) * long : 0, on(st.glow) ? st.glow.size * long : 0, on(st.stroke) ? st.stroke.size * long : 0);
      const filters = (l.filters || []).filter((x) => x.on !== false).reduce((m, x) => m + (DISTORT.has(x.type) ? (x.rad || 0) * long : filterReach(x)), 0);
      const smear = l.ops.some((op) => SNAPSHOT.has(op.t)) ? 8 : 0;
      return (styles * 1.5 + filters + (l.mask && !l.mask.off ? (l.mask.feather || 0) * long : 0)) * k + smear;
    };
    const { pad: P, tiles } = tileGrid(EW, EH, Math.max(healPad, ...layers.map(reach), 0), Math.min(MAX_PADDED, r.maxTex));
    for (let i = 0; i < tiles.length; i++) {
      if (opts.cancelled?.()) throw new Error('cancelled');
      const [itx, ity, itw, ith] = tiles[i];
      const [tx, ty, tw, th] = [itx - P, ity - P, itw + 2 * P, ith + 2 * P];
      // Tile pixels (y up) -> crop frame.
      const out2frame = mat(1 / (k * f.hw), 0, (tx - EW / 2) / (k * f.hw), 0, -1 / (k * f.hh), (ty + th - EH / 2) / (k * f.hh));
      // The part of the photo this tile shows, plus room for sharpening.
      // Edges as well as corners: the Transform panel and distortion bend straight lines.
      const o2o = mm(toOriented, out2frame);
      const corners = [];
      for (let i = 0; i <= 4; i++) for (const [x, y] of [[(tw * i) / 4, 0], [(tw * i) / 4, th], [0, (th * i) / 4], [tw, (th * i) / 4]]) corners.push(toSource(...ap(o2o, x, y)));
      const xs = corners.map((c) => c[0] * geo.sw), ys = corners.map((c) => c[1] * geo.sh);
      const x0 = Math.max(0, Math.floor(Math.min(...xs) - margin)), x1 = Math.min(geo.sw, Math.ceil(Math.max(...xs) + margin));
      const y0 = Math.max(0, Math.floor(Math.min(...ys) - margin)), y1 = Math.min(geo.sh, Math.ceil(Math.max(...ys) + margin));
      const rw = x1 - x0, rh = y1 - y0;
      // A tile wholly outside the photo (a strong Transform) shows only the background.
      if (rw < 2 || rh < 2) r.clearHi();
      else {
        const ow = Math.max(1, Math.round(rw * Math.min(1, scale * 1.15))), oh = Math.max(1, Math.round(rh * Math.min(1, scale * 1.15)));
        const region = await fetchFrame(dev.regionUrl(photo, { x: x0, y: y0, w: rw, h: rh, ow, oh }, dn));
        const rect = [x0 / geo.sw, y0 / geo.sh, rw / geo.sw, rh / geo.sh];
        r.setHi(region, rect, rect);
      }
      // Retouch clones and heals in this tile copy from elsewhere: those parts at full size too.
      if (layers.length) {
        const ob = [[0, 0], [tw, 0], [0, th], [tw, th]].map(([x, y]) => ap(o2o, x, y));
        const box = [Math.min(...ob.map((p) => p[0])), Math.min(...ob.map((p) => p[1])), Math.max(...ob.map((p) => p[0])), Math.max(...ob.map((p) => p[1]))];
        const regions = sourceRegions(layers, geo, toSource, box, scale, 64);
        const frames = [];
        for (const g of regions) frames.push(await fetchFrame(dev.regionUrl(photo, g, dn)));
        r.setOpHi(new Map(regions.map((g, i) => [g.id, { frame: frames[i], rect: [g.x / geo.sw, g.y / geo.sh, g.w / geo.sw, g.h / geo.sh] }])));
      }
      let px = r.renderTile(info, s, geo, f, out2frame, tw, th);
      if (P) px = inner(px, tw, P, itw, ith);
      const res = await dev.exportTile(job, itx, ity, itw, ith, px);
      if (res?.error) throw new Error(res.error);
      opts.onProgress?.((i + 1) / (tiles.length + 1));
    }
    const path = await dev.exportFinish(job);
    if (path?.error) throw new Error(path.error);
    opts.onProgress?.(1);
    return path;
  } catch (err) {
    if (begun) dev.exportFinish(job, true);
    throw err;
  } finally {
    if (r !== opts.renderer) r.dispose();
  }
}
