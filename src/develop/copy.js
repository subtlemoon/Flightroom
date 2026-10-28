// Copy Settings, Paste and presets: which parts of a photo's settings travel,
// grouped as in Lightroom's Copy Settings dialog.
import { SECTION_KEYS, SLIDER } from './params.js';
import { newId } from './masks.js';

const keysOf = (...names) => names.flatMap((n) => SECTION_KEYS[n] || [n]);
const sliders = (prefix) => Object.keys(SLIDER).filter((k) => k.startsWith(prefix));

// [id, label, keys, checked to begin with]
export const COPY_GROUPS = [
  ['wb', 'White Balance', ['wb', 'temp', 'tint'], true],
  ['tone', 'Basic Tone', ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'], true],
  ['presence', 'Presence', ['texture', 'clarity', 'dehaze', 'vibrance', 'saturation'], true],
  ['profile', 'Profile and Treatment', ['profile', 'bw'], true],
  ['curve', 'Tone Curve', keysOf('curve'), true],
  ['color', 'Color Mixer', keysOf('color'), true],
  ['grading', 'Color Grading', keysOf('grading'), true],
  ['sharpen', 'Sharpening', sliders('sharpen'), true],
  ['nr', 'Noise Reduction', sliders('nr'), true],
  ['aiDenoise', 'AI Denoise', ['aiDenoise'], false],
  ['lens', 'Lens Corrections', keysOf('lens'), true],
  ['transform', 'Transform', keysOf('transform').filter((k) => k !== 'constrainCrop'), true],
  ['vignette', 'Vignetting', ['vignetteStyle', ...sliders('vignette')], true],
  ['grain', 'Grain', sliders('grain'), true],
  ['calibration', 'Calibration', keysOf('calibration'), true],
  ['masks', 'Masking', ['masks', 'masksOwned'], false],
  ['crop', 'Crop', ['crop', 'constrainCrop'], false],
];

export const DEFAULT_GROUPS = COPY_GROUPS.filter((g) => g[3]).map((g) => g[0]);

/** The chosen parts of a photo's settings. */
export function pick(s, groups) {
  const out = {};
  for (const [id, , keys] of COPY_GROUPS) {
    if (!groups.includes(id)) continue;
    for (const k of keys) if (k in s) out[k] = s[k];
  }
  return out;
}

/**
 * Settings with `part` (from pick) put on top. White balance "As Shot" means
 * this photo's own as-shot colour, not the copied one's. Masks get new ids so
 * the same mask on two photos stays two masks.
 */
export function applyTo(old, part, asShot) {
  const s = { ...old, ...part };
  if (part.wb === 'As Shot' && asShot) { s.temp = asShot.temp; s.tint = asShot.tint; }
  if (part.masks) {
    s.masks = part.masks.map((m) => ({ ...m, id: newId(), parts: m.parts.map((p) => ({ ...p, id: newId() })) }));
    if (part.masks.length) s.masksOwned = true;
  }
  return s;
}

/** A short list of what a copy or preset holds, for its tooltip. */
export const describe = (groups) => COPY_GROUPS.filter(([id]) => groups.includes(id)).map(([, label]) => label).join(', ');
