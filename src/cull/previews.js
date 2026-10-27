// Loads photo previews for the culling view as ready-to-draw bitmaps.
//
// Speed comes from never touching RAW data: the desktop side hands over the JPEG
// previews the camera embedded in each file. Chromium decodes them off the main
// thread (createImageBitmap), already shrunk to screen size, and the neighbours of
// the current photo are decoded ahead of time so the next arrow press is instant.

export const imgUrl = (kind, id) => `gcimg://photo/${kind}?p=${encodeURIComponent(id)}`;

// Long edge for "fit to screen" bitmaps: the screen size, so resizing the window
// doesn't need new ones. Capped to keep memory around 40 MB per photo.
export const fitEdge = () => Math.min(4096, Math.round(Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1)));

const cache = new Map(); // key -> Promise<ImageBitmap>; Map order = least recently used first
const LIMITS = { thumb: 80, fit: 10, full: 2 };

function cached(key, load) {
  if (cache.has(key)) {
    const p = cache.get(key);
    cache.delete(key);
    cache.set(key, p);
    return p;
  }
  const p = load();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

// Frees the oldest bitmaps of each kind beyond its limit, never touching `keep`.
export function prune(keep) {
  for (const [kind, max] of Object.entries(LIMITS)) {
    const keys = [...cache.keys()].filter((k) => k.startsWith(`${kind}:`));
    for (const k of keys.slice(0, Math.max(0, keys.length - max))) {
      if (keep.has(k)) continue;
      cache.get(k).then((b) => b.close(), () => {});
      cache.delete(k);
    }
  }
}

async function fetchBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.blob();
}

const resizeTo = (edge, meta) => {
  const w = meta?.width, h = meta?.height;
  if (!w || !h || Math.max(w, h) <= edge) return {};
  return w >= h ? { resizeWidth: edge, resizeQuality: 'high' } : { resizeHeight: edge, resizeQuality: 'high' };
};

export const loadFit = (photo, meta) => cached(`fit:${photo.id}`, async () =>
  createImageBitmap(await fetchBlob(imgUrl('preview', photo.id)), resizeTo(fitEdge(), meta)));

export const loadFull = (photo) => cached(`full:${photo.id}`, async () =>
  createImageBitmap(await fetchBlob(imgUrl('preview', photo.id))));

// Files without a small embedded preview (most JPEGs) get one made here once,
// two at a time, and saved to the desktop side's thumbnail cache.
let making = 0;
const makeQueue = [];
function makeThumb(photo) {
  return new Promise((resolve, reject) => {
    makeQueue.push(async () => {
      try {
        const bmp = await createImageBitmap(await fetchBlob(imgUrl('preview', photo.id)), { resizeWidth: 640, resizeQuality: 'high' });
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
        window.gearcheck?.cull.saveThumb(photo.id, await blob.arrayBuffer());
        resolve({ bmp, blob });
      } catch (err) { reject(err); }
    });
    pump();
  });
}
function pump() {
  while (making < 2 && makeQueue.length) {
    making++;
    makeQueue.shift()().finally(() => { making--; pump(); });
  }
}

export const loadThumb = (photo) => cached(`thumb:${photo.id}`, async () => {
  try {
    return await createImageBitmap(await fetchBlob(imgUrl('thumb', photo.id)));
  } catch (err) {
    if (err.status !== 404) throw err;
    return (await makeThumb(photo)).bmp;
  }
});

// For <img> tags in the filmstrip: the cached thumbnail URL, or a freshly made one.
const madeUrls = new Map();
export async function thumbFallbackUrl(photo) {
  if (!madeUrls.has(photo.id)) madeUrls.set(photo.id, makeThumb(photo).then(({ bmp, blob }) => { bmp.close(); return URL.createObjectURL(blob); }));
  return madeUrls.get(photo.id);
}

// EXIF orientation -> clockwise rotation in degrees (mirrored values are rare in
// camera files and are shown unmirrored).
export const ROTATION = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

// Draws `bmp` into a canvas of W x H device pixels. When zoomed, view.scale is
// photo pixels per screen pixel (1 = 100%), centred on (view.cx, view.cy) in
// rotated-photo pixels.
export function drawPhoto(ctx, W, H, bmp, meta, view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!bmp) return;
  const g = geometry(W, H, bmp, meta, view);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(W / 2, H / 2);
  ctx.scale(g.s, g.s);
  ctx.translate(-g.cx, -g.cy);
  ctx.translate(g.ow / 2, g.oh / 2);
  ctx.rotate((g.rot * Math.PI) / 180);
  ctx.drawImage(bmp, -g.iw / 2, -g.ih / 2, g.iw, g.ih);
}

export function geometry(W, H, bmp, meta, view) {
  const iw = meta?.width || bmp?.width || 1;
  const ih = meta?.height || bmp?.height || 1;
  const rot = ROTATION[meta?.orientation] || 0;
  const ow = rot % 180 ? ih : iw;
  const oh = rot % 180 ? iw : ih;
  const fit = Math.min(W / ow, H / oh, 1);
  const s = view?.zoom ? view.scale || 1 : fit;
  const clamp = (c, size, screen) => (size * s <= screen ? size / 2 : Math.min(size - screen / (2 * s), Math.max(screen / (2 * s), c)));
  const cx = view?.zoom ? clamp(view.cx, ow, W) : ow / 2;
  const cy = view?.zoom ? clamp(view.cy, oh, H) : oh / 2;
  return { iw, ih, rot, ow, oh, fit, s, cx, cy };
}
