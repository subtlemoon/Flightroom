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

// Detections in the whole frame; when that finds nothing convincing, also in two
// overlapping halves, where small subjects (a kart across the track) are seen
// larger. Boxes are in fractions of the frame.
function detectAll(det, bmp) {
  const W = bmp.width, H = bmp.height;
  const out = [];
  // `img` covers the frame from `ox` across a `sw` share of its width.
  const add = (img, ox, sw) => {
    for (const d of det.detect(img).detections) {
      const c = d.categories[0], b = d.boundingBox;
      if (!c || !SUBJECTS.has(c.categoryName)) continue;
      const x0 = Math.max(0, b.originX), x1 = Math.min(img.width, b.originX + b.width);
      const y0 = Math.max(0, b.originY), y1 = Math.min(H, b.originY + b.height);
      out.push({ label: c.categoryName, score: c.score, box: { x: ox + (x0 / img.width) * sw, y: y0 / H, w: ((x1 - x0) / img.width) * sw, h: (y1 - y0) / H } });
    }
  };
  add(bmp, 0, 1);
  const convincing = out.some((d) => d.score >= 0.4 && (VEHICLES.has(d.label) || d.box.w * d.box.h >= 0.04));
  if (convincing) return out;
  const HALF = 0.6;
  for (const ox of [0, 1 - HALF]) {
    const canvas = new OffscreenCanvas(Math.round(HALF * W), H);
    canvas.getContext('2d').drawImage(bmp, ox * W, 0, HALF * W, H, 0, 0, canvas.width, H);
    const crop = canvas.transferToImageBitmap();
    add(crop, ox, HALF);
    crop.close();
  }
  return out;
}

// The main subject in an upright bitmap, or null: { label, score, box: { x, y, w, h } }
// with the box as fractions of the frame. Bigger, more certain and more central
// detections win. Tiny detections are background (a car far behind), and a small
// person or animal is more likely a bystander (a marshal, the crowd), so neither
// counts; the photo is then judged on the whole frame, as without detection.
export async function findSubject(bmp) {
  const det = await loadDetector();
  const all = detectAll(det, bmp);
  let best = null, bestScore = 0;
  for (const d of all) {
    const { box } = d;
    if (box.w * box.h < (VEHICLES.has(d.label) ? 0.006 : 0.03)) continue;
    const off = Math.hypot(box.x + box.w / 2 - 0.5, box.y + box.h / 2 - 0.5);
    const rank = d.score * Math.sqrt(box.w * box.h) * (1 - off) * (VEHICLES.has(d.label) ? 2 : 1);
    if (rank > bestScore) { bestScore = rank; best = { label: d.label, score: Math.round(d.score * 100) / 100, box }; }
  }
  return best;
}
