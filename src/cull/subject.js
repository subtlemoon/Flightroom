// Finds the subject of a photo (a person, car, bike, animal...) with a small
// object-detection model that runs on this PC (EfficientDet-Lite, via MediaPipe).
// Auto-rating then judges sharpness on the subject instead of the whole frame.
import { ObjectDetector } from '@mediapipe/tasks-vision';

// The model and its runtime ship with the app, in dist/vision.
const BASE = `${self.location.origin}/vision/`;

// Things a photographer points the camera at. Furniture, cups, phones and so on
// are ignored even when the model sees them.
const SUBJECTS = new Set([
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
  'sports ball', 'kite', 'skateboard', 'surfboard', 'skis', 'snowboard', 'frisbee',
]);

// In a frame with a car, bike or boat, that's nearly always the subject (with its
// driver inside), not the marshals and crowd around it.
const VEHICLES = new Set(['bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']);

let detector = null;
export function loadDetector() {
  detector ||= ObjectDetector.createFromOptions(
    { wasmLoaderPath: `${BASE}vision_wasm_internal.js`, wasmBinaryPath: `${BASE}vision_wasm_internal.wasm` },
    { baseOptions: { modelAssetPath: `${BASE}detector.tflite`, delegate: 'CPU' }, runningMode: 'IMAGE', scoreThreshold: 0.15, maxResults: 10 },
  ).catch((err) => { detector = null; throw err; });
  return detector;
}

// Detections in the whole frame, then in its middle seen larger (where the
// subject usually is, so a small one there is still found); when neither finds
// anything convincing, also in two overlapping halves. Boxes are in fractions
// of the frame.
function detectAll(det, bmp) {
  const W = bmp.width, H = bmp.height;
  const out = [];
  // Looks at the part of the frame from (ox, oy) covering sw x sh of it.
  const look = (ox, oy, sw, sh) => {
    let img = bmp;
    if (sw < 1 || sh < 1) {
      const canvas = new OffscreenCanvas(Math.round(sw * W), Math.round(sh * H));
      canvas.getContext('2d').drawImage(bmp, ox * W, oy * H, sw * W, sh * H, 0, 0, canvas.width, canvas.height);
      img = canvas.transferToImageBitmap();
    }
    for (const d of det.detect(img).detections) {
      const c = d.categories[0], b = d.boundingBox;
      if (!c || !SUBJECTS.has(c.categoryName)) continue;
      const x0 = Math.max(0, b.originX), x1 = Math.min(img.width, b.originX + b.width);
      const y0 = Math.max(0, b.originY), y1 = Math.min(img.height, b.originY + b.height);
      // Touching an edge of a look that isn't the frame's edge: cut off there.
      const e = 0.03;
      const cut = (ox > 0 && x0 / img.width < e) || (ox + sw < 1 && x1 / img.width > 1 - e)
        || (oy > 0 && y0 / img.height < e) || (oy + sh < 1 && y1 / img.height > 1 - e);
      out.push({
        label: c.categoryName, score: c.score, cut,
        box: { x: ox + (x0 / img.width) * sw, y: oy + (y0 / img.height) * sh, w: ((x1 - x0) / img.width) * sw, h: ((y1 - y0) / img.height) * sh },
      });
    }
    if (img !== bmp) img.close();
  };
  const convincing = () => out.some((d) => d.score >= 0.4 && (VEHICLES.has(d.label) || d.box.w * d.box.h >= 0.04));
  look(0, 0, 1, 1);
  look(0.2, 0.2, 0.6, 0.6);
  if (!convincing()) for (const ox of [0, 0.4]) look(ox, 0, 0.6, 1);
  return merge(out);
}

const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

// The same thing seen in more than one look is one detection, the most certain
// one, unless that look cut it off at its edge. A kart can be
// "truck" in one look and "boat" in another, so vehicles count as one kind.
const kind = (label) => (VEHICLES.has(label) ? 'vehicle' : label);
function merge(all) {
  const out = [];
  for (const d of all.sort((a, b) => b.score - a.score)) {
    const same = out.find((o) => {
      if (kind(o.label) !== kind(d.label)) return false;
      const i = overlap(o.box, d.box);
      return i > 0.5 * Math.min(o.box.w * o.box.h, d.box.w * d.box.h);
    });
    if (!same) out.push({ ...d });
    else if (same.cut && !d.cut) { same.box = d.box; same.cut = false; }
  }
  return out;
}

// How much nearer the middle counts: 1 at the centre, about 0.7 on a third
// line, 0.3 near an edge.
const SPREAD = 0.28;
const central = (box) => {
  const dx = box.x + box.w / 2 - 0.5, dy = box.y + box.h / 2 - 0.5;
  return Math.exp(-(dx * dx + dy * dy) / (2 * SPREAD * SPREAD));
};

// The main subject in an upright bitmap, or null: { label, score, box: { x, y, w, h } }
// with the box as fractions of the frame. Bigger, more certain and above all
// more central detections win. Tiny detections are background (a car far
// behind), and a small person or animal is more likely a bystander (a marshal,
// the crowd), so neither counts; the photo is then judged on the whole frame,
// as without detection. A person in or on the chosen vehicle (the driver,
// the rider) is part of the subject.
export async function findSubject(bmp) {
  const det = await loadDetector();
  const all = detectAll(det, bmp);
  let best = null, bestRank = 0;
  for (const d of all) {
    const { box } = d;
    const area = box.w * box.h;
    if (area < (VEHICLES.has(d.label) ? 0.006 : 0.03)) continue;
    // Past a third of the frame, bigger doesn't mean more likely the subject.
    const rank = d.score * Math.sqrt(Math.min(area, 0.33)) * central(box) * (VEHICLES.has(d.label) ? 2 : 1);
    if (rank > bestRank) { bestRank = rank; best = d; }
  }
  if (!best) return null;
  let { box } = best;
  if (VEHICLES.has(best.label)) {
    for (const p of all) {
      if (p.label === 'person' && overlap(p.box, best.box) > 0.5 * p.box.w * p.box.h) box = union(box, p.box);
    }
  }
  return { label: best.label, score: Math.round(best.score * 100) / 100, box };
}
