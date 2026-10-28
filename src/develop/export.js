// Exports developed photos as JPEGs. The full-resolution photo is far too big
// for one pass on the graphics card, so it is rendered in tiles: for each tile
// the desktop side demosaics just the part of the RAW it needs, the tile goes
// through the same shaders as the screen, and the pixels go back to be joined
// and encoded.
import { bridge } from '../bridge.js';
import { Geometry, Renderer, ap, mat, mm, parseFrame, sourceMap } from './renderer.js';

const TILE = 2048;

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
 * Renders and saves one photo. opts: { folder, longEdge, quality, onProgress(0-1), cancelled() }.
 * Returns the saved file's path.
 */
export async function exportPhoto(photo, info, s, opts) {
  const dev = bridge.develop;
  const canvas = new OffscreenCanvas(16, 16);
  const r = new Renderer(canvas);
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
    const tiles = [];
    for (let ty = 0; ty < EH; ty += TILE) for (let tx = 0; tx < EW; tx += TILE) tiles.push([tx, ty, Math.min(TILE, EW - tx), Math.min(TILE, EH - ty)]);
    const toOriented = geo.frameToOriented(f);
    const toSource = sourceMap(geo, s);
    const margin = 16 + 4 * s.sharpenRadius + (s.removeCA || s.defringePurple || s.defringeGreen ? 8 : 0);
    for (let i = 0; i < tiles.length; i++) {
      if (opts.cancelled?.()) throw new Error('cancelled');
      const [tx, ty, tw, th] = tiles[i];
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
      const px = r.renderTile(info, s, geo, f, out2frame, tw, th);
      const res = await dev.exportTile(job, tx, ty, tw, th, px);
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
    r.dispose();
  }
}
