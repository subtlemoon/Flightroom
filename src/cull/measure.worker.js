// Auto-rating's per-photo work, off the main window so it stays responsive and
// several photos are measured at once (one worker per few CPU cores).
import { measure, upright } from './analyze.js';
import { findSubject, loadDetector } from './subject.js';

let detector = null; // Promise<boolean>: false when the model can't start
self.onmessage = async ({ data: { id, bmp, orientation } }) => {
  detector ||= loadDetector().then(() => true, (err) => { console.warn('[auto-rate] subject detection unavailable', err); return false; });
  try {
    const img = upright(bmp, orientation);
    const subject = (await detector) ? await findSubject(img).catch(() => null) : null;
    const m = measure(img, subject);
    if (img !== bmp) img.close();
    bmp.close();
    self.postMessage({ id, m });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
