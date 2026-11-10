// AI grade: a mood in words ("dreamy", "warm", "moody teal", "cold and
// faded") becomes ordinary Develop settings for this photo. The words pick
// and mix looks (below); the photo decides how far each slider goes: the
// grade is rendered, measured and corrected a few times until it lands on the
// mood's brightness, contrast, colourfulness and warmth for *this* photo.
// Then the subject gets its own mask and grade so it stands out in the mood.
// Everything it sets is a normal slider, curve or mask the user can change.
import { cleanCurve, LINEAR_CURVE, SLIDER } from './params.js';

// --- the moods -------------------------------------------------------------------

// Each look, in what it does to the photo:
//   dKey   brightness change (OKLab L of the middle grey, about 0.05 = a third of a stop)
//   key    a brightness it pulls toward, with keyW how hard (0-1)
//   spread contrast as a multiple of the photo's own (1 = keep)
//   chroma colourfulness as a multiple of the photo's own
//   warm   yellow-blue shift (OKLab b; 0.02 is clearly warmer), green: magenta-green shift (a)
//   fade   lifted blacks (0-1), roll: softened whites (0-1)
//   grade  colour wheels [hue, saturation]: sh shadows, mid midtones, hi highlights; bal = balance
//   set    sliders set as they are; mix: Color Mixer (hue0..7, sat0..7, lum0..7)
//   sub    the subject: pop (how much brighter than the rest, L), sat, clarity, texture, temp
const LOOKS = {
  warm: { words: ['warm', 'warmer', 'warmth', 'hot', 'toasty'], warm: 0.02, grade: { hi: [40, 12], sh: [30, 5] } },
  cold: { words: ['cold', 'cool', 'cooler', 'chilly', 'icy', 'frozen', 'frosty'], warm: -0.02, grade: { sh: [215, 12], hi: [200, 6] }, sub: { temp: 10 } },
  dreamy: {
    words: ['dreamy', 'dream', 'ethereal', 'hazy', 'haze', 'heavenly', 'magical', 'whimsical', 'fairytale', 'glow', 'glowy', 'angelic'],
    style: true, dKey: 0.035, spread: 0.84, chroma: 0.9, fade: 0.35, roll: 0.35, warm: 0.006,
    set: { highlights: -25, shadows: 20, clarity: -25, dehaze: -12, texture: -10 }, grade: { hi: [45, 12], sh: [280, 10] },
    sub: { pop: 0.05, clarity: 12, texture: 10 },
  },
  moody: {
    words: ['moody', 'mood', 'brooding', 'stormy', 'intense', 'deep'],
    style: true, dKey: -0.06, key: 0.44, keyW: 0.25, spread: 1.1, chroma: 0.78,
    set: { highlights: -35, blacks: -10, clarity: 15, dehaze: 8, vignette: -18 }, grade: { sh: [210, 14], hi: [35, 8] },
    mix: { sat3: -25, sat5: -15, lum3: -10 }, sub: { pop: 0.08, clarity: 15, sat: 10 },
  },
  dark: { words: ['dark', 'darker', 'shadowy', 'lowkey', 'dim'], dKey: -0.08, set: { vignette: -10 }, sub: { pop: 0.07 } },
  bright: { words: ['bright', 'brighter', 'light', 'lighter', 'sunny', 'highkey', 'luminous'], dKey: 0.07, set: { shadows: 15 } },
  airy: {
    words: ['airy', 'clean', 'minimal', 'fresh', 'crisp', 'white'],
    style: true, dKey: 0.08, key: 0.72, keyW: 0.3, spread: 0.86, chroma: 0.9, fade: 0.15, warm: 0.004,
    set: { highlights: -15, shadows: 30, blacks: 10, clarity: -8, dehaze: -10 }, sub: { pop: 0.03 },
  },
  cinematic: {
    words: ['cinematic', 'cinema', 'movie', 'film-like', 'hollywood', 'blockbuster', 'tealorange', 'orangeteal'],
    style: true, spread: 1.1, chroma: 0.95, fade: 0.12,
    set: { highlights: -20, clarity: 8, vignette: -15 }, grade: { sh: [200, 22], hi: [38, 16], bal: -10 },
    mix: { hue3: 30, sat3: -20, sat1: 10, hue5: -10 }, sub: { pop: 0.05, clarity: 10, temp: 6 },
  },
  vintage: {
    words: ['vintage', 'retro', 'nostalgic', 'nostalgia', 'old', 'oldschool', '70s', '80s', '90s', 'polaroid', 'kodak', 'portra'],
    style: true, spread: 0.92, chroma: 0.8, fade: 0.4, roll: 0.25, warm: 0.01,
    set: { grain: 25, grainSize: 30, vignette: -12 }, grade: { sh: [190, 10], hi: [50, 14] },
    mix: { hue3: -20, sat5: -25 }, sub: { pop: 0.04 },
  },
  film: {
    words: ['film', 'analog', 'analogue', '35mm', 'grainy', 'grain'],
    style: true, chroma: 0.9, fade: 0.25, roll: 0.2,
    set: { grain: 22, grainSize: 25 }, grade: { sh: [180, 8], hi: [45, 8] }, sub: { pop: 0.04 },
  },
  matte: { words: ['matte', 'faded', 'fade', 'washed', 'flat'], fade: 0.5, spread: 0.9, chroma: 0.88 },
  vivid: {
    words: ['vivid', 'vibrant', 'colorful', 'colourful', 'saturated', 'poppy', 'bold', 'rich', 'lively'],
    chroma: 1.25, spread: 1.1, set: { vibrance: 20, clarity: 10, dehaze: 6 }, sub: { pop: 0.03, sat: 8 },
  },
  muted: { words: ['muted', 'desaturated', 'subdued', 'calm', 'quiet', 'understated', 'dull'], chroma: 0.68, set: { vibrance: -10 } },
  soft: { words: ['soft', 'gentle', 'delicate', 'smooth', 'tender'], spread: 0.85, set: { clarity: -15, highlights: -15, shadows: 15 } },
  dramatic: {
    words: ['dramatic', 'drama', 'contrasty', 'contrast', 'punchy', 'epic', 'powerful', 'striking', 'harsh'],
    spread: 1.25, set: { highlights: -25, blacks: -15, clarity: 20, dehaze: 10, vignette: -20 }, sub: { pop: 0.09, clarity: 15 },
  },
  golden: {
    words: ['golden', 'gold', 'goldenhour', 'honey', 'amber', 'glowing'],
    style: true, warm: 0.028, chroma: 1.1, dKey: 0.02, grade: { hi: [42, 22], mid: [35, 8], sh: [20, 8] }, sub: { pop: 0.04 },
  },
  sunset: {
    words: ['sunset', 'sunrise', 'dusk', 'dawn', 'evening'],
    style: true, warm: 0.024, green: 0.006, chroma: 1.08, grade: { hi: [30, 22], sh: [280, 10] }, sub: { pop: 0.05 },
  },
  neon: {
    words: ['neon', 'cyberpunk', 'synthwave', 'vaporwave', 'futuristic', 'electric', 'night', 'nightlife'],
    style: true, dKey: -0.03, spread: 1.15, chroma: 1.2, warm: -0.012, green: 0.01,
    set: { clarity: 10, dehaze: 8 }, grade: { sh: [240, 25], hi: [300, 15] }, mix: { hue1: -15, sat4: 15, sat6: 20 }, sub: { pop: 0.06 },
  },
  noir: {
    words: ['noir', 'bw', 'b&w', 'monochrome', 'mono', 'grayscale', 'greyscale', 'blackandwhite', 'black-and-white'],
    style: true, bw: true, dKey: -0.03, spread: 1.3, set: { clarity: 20, vignette: -20, grain: 15 }, sub: { pop: 0.08, clarity: 15 },
  },
  pastel: {
    words: ['pastel', 'candy', 'cotton', 'sweet', 'cute'],
    style: true, dKey: 0.06, spread: 0.85, chroma: 0.75, fade: 0.25, grade: { hi: [330, 8], sh: [190, 8] }, set: { clarity: -10 },
  },
  autumn: {
    words: ['autumn', 'fall', 'autumnal', 'harvest', 'halloween', 'pumpkin'],
    style: true, warm: 0.015, chroma: 1.05, grade: { hi: [35, 12] }, mix: { hue3: -40, sat3: -10, sat1: 15, hue2: -10 },
  },
  summer: { words: ['summer', 'summery', 'beach', 'tropical', 'holiday', 'vacation'], style: true, warm: 0.01, chroma: 1.12, dKey: 0.03, grade: { hi: [50, 10] }, mix: { sat4: 15, sat5: 10 } },
  winter: { words: ['winter', 'wintry', 'snow', 'snowy', 'arctic'], style: true, warm: -0.022, chroma: 0.8, dKey: 0.04, grade: { hi: [200, 10], sh: [220, 12] }, sub: { temp: 10 } },
  spring: { words: ['spring', 'blossom', 'bloom', 'floral'], style: true, chroma: 1.08, dKey: 0.04, mix: { hue3: 10, sat3: 10, sat7: 10 }, grade: { hi: [80, 6] } },
  earthy: { words: ['earthy', 'earth', 'forest', 'woods', 'woodland', 'nature', 'organic', 'rustic'], style: true, warm: 0.008, chroma: 0.9, grade: { sh: [100, 8], hi: [45, 8] }, mix: { sat3: -20, lum3: -10, hue3: -15 } },
  ocean: { words: ['ocean', 'sea', 'aqua', 'marine', 'underwater', 'lagoon'], style: true, chroma: 1.05, grade: { sh: [190, 14] }, mix: { sat4: 15, sat5: 10, hue5: -8 } },
  natural: { words: ['natural', 'true', 'realistic', 'neutral', 'accurate', 'normal'], style: true, set: { clarity: 5, vibrance: 8 }, sub: { pop: 0.03 } },
  gritty: { words: ['gritty', 'grungy', 'grunge', 'urban', 'street', 'raw', 'rough', 'industrial'], style: true, chroma: 0.75, spread: 1.2, warm: -0.005, set: { clarity: 35, texture: 20, dehaze: 10, grain: 20 }, sub: { clarity: 20, pop: 0.05 } },
  romantic: { words: ['romantic', 'love', 'lovely', 'wedding', 'blush'], style: true, warm: 0.01, green: 0.006, dKey: 0.03, fade: 0.15, set: { clarity: -15 }, grade: { hi: [20, 12], sh: [330, 8] }, sub: { pop: 0.04 } },
  eerie: { words: ['eerie', 'spooky', 'creepy', 'horror', 'scary', 'mysterious', 'mystery', 'haunted', 'sinister', 'ominous'], style: true, dKey: -0.1, warm: -0.01, green: -0.008, chroma: 0.7, set: { vignette: -30, clarity: 10 }, grade: { sh: [160, 15] }, sub: { pop: 0.07 } },
  happy: { words: ['happy', 'cheerful', 'joyful', 'joy', 'fun', 'playful', 'uplifting'], style: true, dKey: 0.05, chroma: 1.15, warm: 0.008, sub: { pop: 0.04 } },
  sad: { words: ['sad', 'melancholy', 'melancholic', 'lonely', 'gloomy', 'somber', 'sombre', 'blue-mood', 'depressing', 'rainy'], style: true, dKey: -0.05, chroma: 0.65, warm: -0.012, spread: 0.9, fade: 0.15, grade: { sh: [215, 12] }, sub: { pop: 0.04 } },
  cozy: { words: ['cozy', 'cosy', 'hygge', 'homey', 'candlelight', 'fireplace', 'intimate'], style: true, warm: 0.02, dKey: -0.02, fade: 0.1, set: { clarity: -5, vignette: -15 }, grade: { hi: [35, 14], sh: [25, 10] }, sub: { pop: 0.05 } },
  sporty: { words: ['sporty', 'sport', 'sports', 'action', 'racing', 'speed', 'energetic', 'aggressive'], style: true, spread: 1.15, chroma: 1.1, set: { clarity: 15, dehaze: 8, vignette: -12 }, sub: { pop: 0.07, clarity: 15, texture: 10 } },
};

// Colour words tint the wheels: cool colours the shadows, warm ones the highlights.
const COLOR_WORDS = {
  red: 0, crimson: 355, orange: 30, gold: 45, amber: 40, yellow: 58, lime: 85, green: 120, emerald: 140, mint: 155, teal: 195,
  turquoise: 180, cyan: 185, blue: 220, navy: 230, indigo: 250, purple: 275, violet: 270, lavender: 265, lilac: 280,
  pink: 330, rose: 340, magenta: 305, peach: 25, coral: 15, sepia: 35, bronze: 32, copper: 25,
};

// Words that make the next word stronger or weaker.
const MORE = new Set(['very', 'super', 'really', 'extremely', 'ultra', 'heavily', 'strongly', 'so', 'mega', 'hyper', 'extra', 'more']);
const LESS = new Set(['slightly', 'bit', 'little', 'subtle', 'subtly', 'touch', 'hint', 'somewhat', 'mildly', 'lightly', 'less', 'faint', 'barely']);
const SKIP = new Set(['a', 'an', 'the', 'and', 'with', 'of', 'in', 'look', 'looking', 'feel', 'feeling', 'vibe', 'vibes', 'style', 'tone', 'tones', 'toned', 'colors', 'colours', 'color', 'colour', 'grade', 'grading', 'please', 'make', 'it', 'like', 'but', 'kind', 'sort', 'ish', 'mood', 'atmosphere', 'aesthetic', 'some', 'add', 'give', 'me', 'photo', 'picture', 'image', 'shot', 'to', 'for', 'more']);

/** The quick picks shown as buttons. */
export const MOOD_CHIPS = ['Warm', 'Cold', 'Dreamy', 'Moody', 'Cinematic', 'Vintage', 'Airy', 'Vivid', 'Golden', 'Noir'];

// Edit distance, for typos ("dreamey", "cinamatic").
function near(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const ALL_WORDS = Object.entries(LOOKS).flatMap(([id, l]) => l.words.map((w) => [w, id]));
function lookFor(word) {
  for (const [w, id] of ALL_WORDS) if (w === word) return id;
  // "dreaminess", "warmly", "moodier": a look's word at the start.
  for (const [w, id] of ALL_WORDS) if (w.length >= 4 && word.length > w.length && word.startsWith(w.slice(0, Math.max(4, w.length - 1)))) return id;
  const tol = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
  if (!tol) return null;
  let best = null, bd = tol + 1;
  for (const [w, id] of ALL_WORDS) { const d = near(word, w); if (d < bd) { bd = d; best = id; } }
  return best;
}

/**
 * What a mood in words asks for: { looks: [[id, weight]], colors: [[hue, weight]], name, unknown: [words] },
 * or null when nothing in it is a mood Flightroom knows.
 */
export function parseMood(text) {
  const words = String(text || '').toLowerCase()
    .replace(/black\s*(and|&|n)\s*white/g, 'blackandwhite').replace(/golden\s+hour/g, 'goldenhour').replace(/teal\s*(and|&|\/|-)?\s*orange/g, 'tealorange')
    .replace(/orange\s*(and|&|\/|-)?\s*teal/g, 'orangeteal').replace(/high\s*-?\s*key/g, 'highkey').replace(/low\s*-?\s*key/g, 'lowkey')
    .split(/[^a-z0-9&]+/).filter(Boolean);
  const looks = new Map(), colors = [], unknown = [];
  let k = 1, not = false;
  for (const w of words) {
    if (MORE.has(w)) { k = 1.5; continue; }
    if (LESS.has(w)) { k = 0.5; continue; }
    if (w === 'not' || w === 'no' || w === 'without') { not = true; continue; }
    if (SKIP.has(w)) continue;
    const id = lookFor(w);
    const hue = COLOR_WORDS[w] ?? (w.length >= 5 && Object.entries(COLOR_WORDS).find(([c]) => near(w, c) <= 1)?.[1]);
    if (!not) {
      if (id) looks.set(id, Math.max(looks.get(id) || 0, k));
      else if (hue != null && hue !== false) colors.push([hue, k]);
      else unknown.push(w);
    }
    k = 1; not = false;
  }
  if (!looks.size && !colors.length) return null;
  const name = [...looks.keys()].concat(colors.map(([h]) => Object.keys(COLOR_WORDS).find((c) => COLOR_WORDS[c] === h))).join(' ');
  return { looks: [...looks], colors, name, unknown };
}

// --- one recipe from the mixed looks -------------------------------------------------

const wheel = (h, s) => [s * Math.cos((h * Math.PI) / 180), s * Math.sin((h * Math.PI) / 180)];
const unwheel = ([x, y]) => [Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360), Math.hypot(x, y)];

/**
 * The looks in `mood` mixed into one recipe, scaled by `strength` (0.6 subtle,
 * 1 normal, 1.4 strong). Styles (dreamy, cinematic…) are averaged with each
 * other; modifiers (warm, dark, vivid…) add on top.
 */
export function recipeFor(mood, strength = 1) {
  const styles = mood.looks.filter(([id]) => LOOKS[id].style);
  const r = { dKey: 0, key: null, keyW: 0, spread: 0, chroma: 0, warm: 0, green: 0, fade: 0, roll: 0, bw: false, set: {}, mix: {}, grade: { sh: [0, 0], mid: [0, 0], hi: [0, 0] }, bal: 0, sub: { pop: 0, sat: 0, clarity: 0, texture: 0, temp: 0 } };
  let popW = 0;
  for (const [id, k0] of mood.looks) {
    const l = LOOKS[id];
    const k = k0 * strength * (l.style ? 1 / styles.length : 1);
    r.dKey += (l.dKey || 0) * k;
    r.spread += ((l.spread ?? 1) - 1) * k;
    r.chroma += ((l.chroma ?? 1) - 1) * k;
    r.warm += (l.warm || 0) * k;
    r.green += (l.green || 0) * k;
    r.fade += (l.fade || 0) * k;
    r.roll += (l.roll || 0) * k;
    r.bal += (l.grade?.bal || 0) * k;
    if (l.key != null) { r.key = r.key == null ? l.key : (r.key + l.key) / 2; r.keyW = Math.max(r.keyW, l.keyW * Math.min(1, k)); }
    if (l.bw) r.bw = true;
    for (const [s, v] of Object.entries(l.set || {})) r.set[s] = (r.set[s] || 0) + v * k;
    for (const [s, v] of Object.entries(l.mix || {})) r.mix[s] = (r.mix[s] || 0) + v * k;
    for (const z of ['sh', 'mid', 'hi']) if (l.grade?.[z]) { const v = wheel(...l.grade[z]); r.grade[z] = [r.grade[z][0] + v[0] * k, r.grade[z][1] + v[1] * k]; }
    for (const [s, v] of Object.entries(l.sub || {})) {
      if (s === 'pop') { r.sub.pop += v * k; popW += k; } else r.sub[s] += v * k;
    }
  }
  for (const [hue, k0] of mood.colors) {
    // Cool colours in the shadows, warm ones in the highlights, a little in the midtones.
    const k = k0 * strength, warmHue = hue < 75 || hue > 320;
    const z = warmHue ? 'hi' : 'sh', v = wheel(hue, 18 * k), m = wheel(hue, 6 * k);
    r.grade[z] = [r.grade[z][0] + v[0], r.grade[z][1] + v[1]];
    r.grade.mid = [r.grade.mid[0] + m[0], r.grade.mid[1] + m[1]];
  }
  // A subject always stands out a little, unless a look says how much.
  r.sub.pop = popW ? r.sub.pop / Math.max(1, popW) * Math.min(1.5, popW) : 0.035 * strength;
  return r;
}

// --- the settings ----------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fit = (key, v) => { const sl = SLIDER[key]; return sl ? clamp(Math.round(v / sl.step) * sl.step, sl.min, sl.max) : v; };

// What an AI grade sets, put back to where it starts each time (so grading
// twice gives the same as grading once). Exposure and white balance start
// from the photo as it was before the first AI grade.
export const MOOD_KEYS = [
  'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'texture', 'clarity', 'dehaze', 'vibrance', 'saturation',
  'gShadowHue', 'gShadowSat', 'gShadowLum', 'gMidHue', 'gMidSat', 'gMidLum', 'gHighHue', 'gHighSat', 'gHighLum', 'gGlobalHue', 'gGlobalSat', 'gGlobalLum', 'gBalance', 'gBlending',
  'vignette', 'grain', 'grainSize', ...['hue', 'sat', 'lum'].flatMap((k) => Array.from({ length: 8 }, (_, i) => `${k}${i}`)),
];

/** The fixed part of a grade: wheels, mixer, curve and look sliders, on top of `base`. */
export function lookSettings(base, r) {
  const s = { ...base };
  for (const k of MOOD_KEYS) if (SLIDER[k]) s[k] = SLIDER[k].def;
  s.curve = LINEAR_CURVE;
  s.bw = r.bw;
  for (const [k, v] of Object.entries(r.set)) if (SLIDER[k]) s[k] = fit(k, v);
  for (const [k, v] of Object.entries(r.mix)) if (SLIDER[k]) s[k] = fit(k, v);
  const put = (z, hue, sat) => { const [h, m] = unwheel(r.grade[z]); s[hue] = h; s[sat] = fit(sat, m); };
  put('sh', 'gShadowHue', 'gShadowSat');
  put('mid', 'gMidHue', 'gMidSat');
  put('hi', 'gHighHue', 'gHighSat');
  s.gBalance = fit('gBalance', r.bal);
  // Faded blacks and soft whites on the point curve, as the classic looks do it.
  const fade = clamp(r.fade, 0, 1), roll = clamp(r.roll, 0, 1);
  if (fade > 0.01 || roll > 0.01) s.curve = cleanCurve([[0, 42 * fade], [64, 64 + 10 * fade], [192, 192 - 5 * roll], [255, 255 - 26 * roll]]);
  return s;
}

// --- measuring a render ------------------------------------------------------------

const LIN = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/**
 * OKLab measures of a render (RGBA 8-bit). `weight` (0-1 per pixel, same
 * order) measures only part of it. L50 middle brightness, spread = L95 - L05,
 * a/b the overall tint of the parts that aren't clipped, C colourfulness
 * apart from that tint (so warming a photo isn't read as making it more colourful).
 */
export function measure(rgba, weight = null) {
  const n = rgba.length / 4, step = n > 400000 ? 2 : 1, hist = new Float64Array(256);
  const As = new Float32Array(Math.ceil(n / step)), Bs = new Float32Array(As.length), Ws = new Float32Array(As.length);
  let k = 0, wsum = 0, asum = 0, bsum = 0, tsum = 0;
  for (let i = 0; i < n; i += step) {
    const w = weight ? weight[i] : 1;
    if (!(w > 0.004)) continue;
    const r = LIN[rgba[i * 4]], g = LIN[rgba[i * 4 + 1]], b = LIN[rgba[i * 4 + 2]];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    hist[Math.min(255, Math.max(0, Math.round(L * 255)))] += w;
    wsum += w;
    As[k] = A; Bs[k] = B; Ws[k++] = w;
    if (L > 0.08 && L < 0.97) { asum += A * w; bsum += B * w; tsum += w; }
  }
  if (!wsum) return null;
  const a = tsum ? asum / tsum : 0, bb = tsum ? bsum / tsum : 0;
  let csum = 0;
  for (let i = 0; i < k; i++) csum += Math.hypot(As[i] - a, Bs[i] - bb) * Ws[i];
  const at = (q) => { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= q * wsum) return i / 255; } return 1; };
  const L05 = at(0.05), L95 = at(0.95);
  return { L50: at(0.5), L05, L95, spread: Math.max(0.02, L95 - L05), C: csum / wsum, a, b: bb, area: wsum / (n / step) };
}

// --- the targets and the solve ---------------------------------------------------------

const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** Where the mood should land for a photo measuring `m` (image-aware: what it already is counts). */
export function targets(m, r) {
  let L = m.L50 + r.dKey;
  if (r.key != null) L += (r.key - L) * r.keyW;
  // Already bright/dark photos move less further the same way.
  if (r.dKey > 0) L = m.L50 + (L - m.L50) * (1 - smooth(0.68, 0.85, m.L50));
  if (r.dKey < 0) L = m.L50 + (L - m.L50) * (1 - smooth(0.4, 0.22, m.L50));
  // Contrast: already punchy photos get less extra, already flat ones get less flatter.
  let spread = m.spread * (1 + r.spread);
  if (r.spread > 0) spread = m.spread + (spread - m.spread) * (1 - smooth(0.6, 0.85, m.spread));
  if (r.spread < 0) spread = m.spread + (spread - m.spread) * (1 - smooth(0.4, 0.2, m.spread));
  // Colour: grey photos can't be made very colourful without showing noise.
  let C = m.C * (1 + r.chroma);
  if (r.chroma > 0) C = Math.min(C, m.C * 1.6, m.C + (0.14 - Math.min(0.14, m.C)) * 0.6 + 0.004);
  // Warmth: a photo already warm (sunset) gets less more warmth, and the same for cold.
  const b = m.b + r.warm * (1 - 0.6 * clamp((Math.sign(r.warm) * m.b) / 0.03, 0, 1));
  const a = m.a + r.green;
  return { L: clamp(L, 0.12, 0.88), spread: clamp(spread, 0.15, 0.95), C: r.bw ? 0 : Math.max(0.004, C), a, b };
}

// The sliders the solve moves, the measure each mainly aims at, a test step
// for seeing what it does, and how close is close enough.
const VARS = [
  { key: 'exposure', of: (m) => m.L50, want: 'L', step: 0.4, lo: -2, hi: 2, tol: 0.006 },
  { key: 'contrast', of: (m) => m.spread, want: 'spread', step: 25, lo: -40, hi: 40, tol: 0.01 },
  { key: 'saturation', of: (m) => m.C, want: 'C', step: 25, lo: -50, hi: 40, tol: 0.002, color: true },
  { key: 'mired', of: (m) => m.b, want: 'b', step: -20, lo: -60, hi: 60, tol: 0.0015, color: true },
  { key: 'tint', of: (m) => m.a, want: 'a', step: 12, lo: -25, hi: 25, tol: 0.0015, color: true },
];

const withVars = (look, base, x) => {
  const s = { ...look };
  s.exposure = fit('exposure', base.exposure + x.exposure);
  s.contrast = fit('contrast', look.contrast + x.contrast);
  s.saturation = fit('saturation', look.saturation + x.saturation);
  s.temp = fit('temp', 1e6 / (1e6 / base.temp + x.mired));
  s.tint = fit('tint', base.tint + x.tint);
  if (Math.abs(x.mired) > 0.5 || Math.abs(x.tint) > 0.5) s.wb = 'Custom';
  return s;
};

// Solves A x = b (small, square) by elimination with partial pivoting.
function solveLinear(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let v = M[r][n]; for (let k = r + 1; k < n; k++) v -= M[r][k] * x[k]; x[r] = v / M[r][r]; }
  return x;
}

/**
 * Grades `base` (settings) to recipe `r`. `render(settings)` resolves to RGBA
 * 8-bit pixels of the photo with those settings. First it tries each slider
 * on its own to see what it does to this photo (they all move each other's
 * measures a little), then a few rounds of: work out all sliders together,
 * render, measure, learn from the miss. Resolves to { settings, before,
 * after, want, last } where `last` is the render of `settings`.
 */
export async function solveGrade(base, r, render, { rounds = 3, onStep } = {}) {
  // The photo with nothing a grade owns: its own exposure, white balance and profile.
  base = lookSettings(base, recipeFor({ looks: [], colors: [] }, 0));
  const before = measure(await render(base));
  if (!before) throw new Error('The photo is empty');
  const want = targets(before, r);
  const look = lookSettings(base, r);
  const vars = VARS.filter((v) => !(r.bw && v.color));
  const n = vars.length, steps = 1 + n + rounds;
  let step = 0;
  const tick = () => onStep?.(++step, steps);
  const x = { exposure: 0, contrast: 0, saturation: 0, mired: 0, tint: 0 };
  const read = (m) => vars.map((v) => v.of(m) / v.tol); // measures in units of "close enough"
  const goal = [];
  tick();
  let m0 = measure(await render(look)) || before, y = read(m0);
  // Contrast is only pushed the way the mood asks: when the look itself is
  // already as soft (or punchy) as the mood wants, it stays as the look made it.
  // The same for colourfulness. The look's own colour wheels are part of the mood, so
  // warmth and tint move from where the look put them (not back to the photo's).
  // Neither goes further from the look than the mood's own share of it.
  const toward = (k, d) => clamp(d < 0 ? Math.min(want[k], m0[k]) : d > 0 ? Math.max(want[k], m0[k]) : m0[k], m0[k] * (1 - Math.abs(d)), m0[k] * (1 + Math.abs(d)));
  want.spread = toward('spread', r.spread);
  if (!r.bw) want.C = toward('C', r.chroma);
  want.b = m0.b + (want.b - before.b);
  want.a = m0.a + (want.a - before.a);
  vars.forEach((v, i) => { goal[i] = want[v.want] / v.tol; });
  // What each slider alone does here (Jacobian, by trying it).
  const J = vars.map(() => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    tick();
    const v = vars[j], m = measure(await render(withVars(look, base, { ...x, [v.key]: v.step }))) || m0, yj = read(m);
    for (let i = 0; i < n; i++) J[i][j] = (yj[i] - y[i]) / v.step;
  }
  let settings = look, last = null, after = m0;
  for (let round = 0; round < rounds; round++) {
    const err = goal.map((g, i) => g - y[i]);
    if (err.every((e) => Math.abs(e) <= 1)) break;
    // Newton step with a price on moving sliders (a test step costs as much as
    // missing by "close enough"), so a slider that hardly helps stays put rather
    // than being pushed to its end to win a little.
    const JT = J[0].map((_, j) => J.map((row) => row[j]));
    const A = JT.map((row) => JT.map((col) => row.reduce((acc, v, k) => acc + v * col[k], 0)));
    const rhs = JT.map((row) => row.reduce((acc, v, k) => acc + v * err[k], 0));
    vars.forEach((v, i) => { const p = 1 / (v.step * v.step); A[i][i] += p; rhs[i] -= p * x[v.key]; });
    const dx = solveLinear(A, rhs);
    if (!dx) break;
    const old = vars.map((v) => x[v.key]);
    vars.forEach((v, j) => { x[v.key] = clamp(x[v.key] + dx[j], v.lo, v.hi); });
    settings = withVars(look, base, x);
    tick();
    last = await render(settings);
    const m = measure(last);
    if (!m) break;
    const y2 = read(m), moved = vars.map((v, j) => x[v.key] - old[j]);
    // Broyden: correct what we thought the sliders do by how far off the guess was.
    const mm = moved.reduce((acc, d) => acc + d * d, 0);
    if (mm > 1e-12) {
      const miss = y2.map((v, i) => v - y[i] - J[i].reduce((acc, jv, k) => acc + jv * moved[k], 0));
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) J[i][k] += (miss[i] * moved[k]) / mm;
    }
    y = y2; after = m;
  }
  if (!last) last = await render(settings);
  return { settings, before, after, want, last };
}

// --- the subject --------------------------------------------------------------------

/**
 * A subject mask (top row first, 0-255, any size) as weights for a render of
 * w x h stored bottom row first: inside and outside.
 */
export function maskWeights(mask, w, h) {
  const inW = new Float32Array(w * h), outW = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const my = Math.min(mask.h - 1, Math.floor(((h - 1 - y) + 0.5) * mask.h / h));
    for (let x = 0; x < w; x++) {
      const v = mask.data[my * mask.w + Math.min(mask.w - 1, Math.floor((x + 0.5) * mask.w / w))] / 255;
      inW[y * w + x] = v > 0.5 ? v : 0;
      outW[y * w + x] = v < 0.15 ? 1 - v : 0;
    }
  }
  return { inW, outW };
}

/**
 * The subject's own sliders: brighter than its surroundings by the mood's
 * pop, some colour back when the mood takes colour away, a little clarity,
 * and warmth kept on skin in cold moods. `sub`/`bg` are measures of the
 * graded render inside and outside the subject. Null when there's no clear subject.
 */
export function subjectAdjust(sub, bg, r, globalChroma = 1) {
  if (!sub || !bg || sub.area < 0.006 || sub.area > 0.8) return null;
  const adj = {};
  const gap = sub.L50 - bg.L50;
  // Lift a subject that doesn't stand out enough; calm one that is far too bright.
  if (gap < r.sub.pop) {
    const L = sub.L50 + Math.min(0.1, r.sub.pop - gap);
    adj.exposure = clamp(Math.round(3 * Math.log2(L / Math.max(0.05, sub.L50)) * 0.85 * 20) / 20, 0, 0.6);
  } else if (gap > r.sub.pop + 0.2) adj.exposure = -0.2;
  if (!r.bw) {
    const back = globalChroma < 0.95 ? (1 / globalChroma - 1) * 40 : 0;
    adj.saturation = Math.round(clamp(back + r.sub.sat, -30, 40));
    if (r.warm < -0.005) adj.temp = Math.round(clamp(r.sub.temp || 8, 0, 25));
    else if (r.sub.temp) adj.temp = Math.round(clamp(r.sub.temp, -25, 25));
  }
  adj.clarity = Math.round(clamp(r.sub.clarity || 8, -50, 50));
  adj.texture = Math.round(clamp(r.sub.texture || 6, -50, 50));
  for (const k of Object.keys(adj)) if (!adj[k]) delete adj[k];
  return adj;
}
