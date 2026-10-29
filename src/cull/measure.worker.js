// Auto-rating's per-photo work, off the main window so it stays responsive and
// several photos are measured at once (one worker per few CPU cores).
import { MIDDLE, blurOf, focusArea, measure, stored, toGray, upright } from './analyze.js';
import { ROTATION } from './rotation.js';
import { findSubject, loadDetector } from './subject.js';

// How blurred the subject is at full size, from the big embedded preview.
async function fullSizeBlur(url, orientation, subject) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const big = await createImageBitmap(await res.blob());
  try {
    const rot = ROTATION[orientation] || 0;
    const [W, H] = rot % 180 ? [big.height, big.width] : [big.width, big.height];
    const b = stored(focusArea(subject?.box || MIDDLE, W, H, subject?.label === 'person'), rot);
    const [x, y, w, h] = [b.x * big.width, b.y * big.height, b.w * big.width, b.h * big.height].map(Math.round);
    if (w < 48 || h < 48) return null;
    const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(big, x, y, w, h, 0, 0, w, h);
    return blurOf(toGray(ctx.getImageData(0, 0, w, h).data), w, h);
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
    const blur = full ? await fullSizeBlur(full, orientation, subject).catch(() => null) : null;
    const m = measure(img, subject, blur == null ? null : Math.round(blur * 1000) / 1000);
    if (img !== bmp) img.close();
    bmp.close();
    self.postMessage({ id, m });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
