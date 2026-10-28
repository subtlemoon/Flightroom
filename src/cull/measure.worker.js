// Auto-rating's per-photo work, off the main window so it stays responsive and
// several photos are measured at once (one worker per few CPU cores).
import { blurOf, measure, upright } from './analyze.js';
import { ROTATION } from './rotation.js';
import { findSubject, loadDetector } from './subject.js';

// The middle of the frame stands in for the subject when none is found.
const MIDDLE = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
const MAX_CROP = 1600; // px of the full-size preview looked at, around the box's middle

// A box in the upright photo, as fractions of the preview as stored (sensor orientation).
function stored(b, rot) {
  if (rot === 90) return { x: b.y, y: 1 - b.x - b.w, w: b.h, h: b.w };
  if (rot === 180) return { x: 1 - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h };
  if (rot === 270) return { x: 1 - b.y - b.h, y: b.x, w: b.h, h: b.w };
  return b;
}

// How blurred the box is at full size, from the big embedded preview.
async function fullSizeBlur(url, orientation, box) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const big = await createImageBitmap(await res.blob());
  try {
    const b = stored(box, ROTATION[orientation] || 0);
    let [x, y, w, h] = [b.x * big.width, b.y * big.height, b.w * big.width, b.h * big.height];
    if (w > MAX_CROP) { x += (w - MAX_CROP) / 2; w = MAX_CROP; }
    if (h > MAX_CROP) { y += (h - MAX_CROP) / 2; h = MAX_CROP; }
    [x, y, w, h] = [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
    if (w < 48 || h < 48) return null;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(big, x, y, w, h, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    return blurOf(gray, w, h);
  } finally {
    big.close();
  }
}

let detector = null; // Promise<boolean>: false when the model can't start
self.onmessage = async ({ data: { id, bmp, orientation, full } }) => {
  detector ||= loadDetector().then(() => true, (err) => { console.warn('[auto-rate] subject detection unavailable', err); return false; });
  try {
    const img = upright(bmp, orientation);
    const subject = (await detector) ? await findSubject(img).catch(() => null) : null;
    const blur = full ? await fullSizeBlur(full, orientation, subject?.box || MIDDLE).catch(() => null) : null;
    const m = measure(img, subject, blur == null ? null : Math.round(blur * 1000) / 1000);
    if (img !== bmp) img.close();
    bmp.close();
    self.postMessage({ id, m });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
