// Auto-rating's per-photo work, off the main window so it stays responsive and
// several photos are measured at once (one worker per few CPU cores).
import { MIDDLE, blurOf, focusArea, measure, stored, upright } from './analyze.js';
import { ROTATION } from './rotation.js';
import { findSubject, loadDetector } from './subject.js';

// How blurred the subject is at full size: the part of the big embedded preview
// it's judged on, in grey, from the desktop side (photo/gray), so the whole
// picture (180 MB decoded at 45 MP) is never held here.
async function fullSizeBlur(full, orientation, subject) {
  const rot = ROTATION[orientation] || 0;
  const [W, H] = rot % 180 ? [full.height, full.width] : [full.width, full.height];
  const b = stored(focusArea(subject?.box || MIDDLE, W, H, subject?.label === 'person'), rot);
  const [x, y, w, h] = [b.x * full.width, b.y * full.height, b.w * full.width, b.h * full.height].map(Math.round);
  if (w < 48 || h < 48) return null;
  const res = await fetch(`${full.url}&${new URLSearchParams({ x, y, w, h })}`);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const v = new DataView(buf), gw = v.getUint32(0, true), gh = v.getUint32(4, true);
  return gw >= 48 && gh >= 48 && 8 + gw * gh <= buf.byteLength ? blurOf(new Uint8Array(buf, 8, gw * gh), gw, gh) : null;
}

let detector = null; // Promise<boolean>: false when the model can't start
self.onmessage = async ({ data: { id, bmp, orientation, full } }) => {
  detector ||= loadDetector().then(() => true, (err) => { console.warn('[auto-rate] subject detection unavailable', err); return false; });
  try {
    const img = upright(bmp, orientation);
    const subject = (await detector) ? await findSubject(img).catch(() => null) : null;
    const blur = full?.width ? await fullSizeBlur(full, orientation, subject).catch(() => null) : null;
    const m = measure(img, subject, blur == null ? null : Math.round(blur * 1000) / 1000);
    if (img !== bmp) img.close();
    bmp.close();
    self.postMessage({ id, m });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
