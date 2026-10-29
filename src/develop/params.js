// Develop settings: what each slider is, its range and default, and how it is
// stored in the .xmp sidecar using Lightroom's own names (the crs: namespace),
// so Lightroom picks the edits up when it imports or re-reads the photo.
import { masksFromJson, masksToCrs, masksToJson } from './masks.js';
import { layersFromText, layersToText } from './retouch.js';
import { TONE_MAPPERS } from './tonemap.js';

export { TONE_MAPPERS };
export const COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
export const COLOR_HUES = [0, 30, 60, 120, 180, 240, 270, 300]; // band centres, degrees

// key, label, crs name, min, max, step, default
const S = (key, label, crs, min, max, step = 1, def = 0, extra = {}) => ({ key, label, crs, min, max, step, def, ...extra });

// Sections, in Lightroom's order. `groups` are plain sliders; `more` are
// values drawn by their own controls (colour wheels, mixer); `keys` are the
// other settings a section owns (for its reset button).
export const SECTIONS = [
  { id: 'basic', title: 'Basic', keys: ['wb', 'temp', 'tint', 'profile', 'bw', 'toneMap'], groups: [
    { title: 'White balance', sliders: [
      S('temp', 'Temp', 'Temperature', 2000, 50000, 50, null, { log: true, gradient: 'temp' }),
      S('tint', 'Tint', 'Tint', -150, 150, 1, null, { gradient: 'tint' }),
    ] },
    { title: 'Tone', sliders: [
      S('exposure', 'Exposure', 'Exposure2012', -5, 5, 0.05, 0, { decimals: 2 }),
      S('contrast', 'Contrast', 'Contrast2012', -100, 100),
      S('highlights', 'Highlights', 'Highlights2012', -100, 100),
      S('shadows', 'Shadows', 'Shadows2012', -100, 100),
      S('whites', 'Whites', 'Whites2012', -100, 100),
      S('blacks', 'Blacks', 'Blacks2012', -100, 100),
    ] },
    { title: 'Tone mapping', sliders: [
      S('sigmoidContrast', 'Contrast', 'SigmoidContrast', 0.5, 3.5, 0.05, 1.5, { decimals: 2, tm: 'sigmoid' }),
      S('sigmoidSkew', 'Skew', 'SigmoidSkew', -1, 1, 0.02, 0, { decimals: 2, tm: 'sigmoid' }),
      S('sigmoidHue', 'Preserve Hue', 'SigmoidHuePreservation', 0, 100, 1, 0, { tm: 'sigmoid' }),
      S('agxContrast', 'Contrast', 'AgxContrast', 0.5, 2, 0.05, 1, { decimals: 2, tm: 'agx' }),
      S('agxSat', 'Saturation', 'AgxSaturation', 0.5, 2, 0.05, 1, { decimals: 2, tm: 'agx' }),
      S('agxDesat', 'Highlight Roll-off', 'AgxHighlightRolloff', 0, 100, 1, 35, { tm: 'agx' }),
      S('filmicWhiteEv', 'White EV', 'FilmicWhiteEV', 1, 10, 0.1, 4, { decimals: 1, tm: 'filmic' }),
      S('filmicBlackEv', 'Black EV', 'FilmicBlackEV', -14, -2, 0.1, -8, { decimals: 1, tm: 'filmic' }),
      S('filmicContrast', 'Contrast', 'FilmicContrast', 0.5, 2.5, 0.05, 1.3, { decimals: 2, tm: 'filmic' }),
      S('filmicHue', 'Preserve Hue', 'FilmicHuePreservation', 0, 100, 1, 100, { tm: 'filmic' }),
    ] },
    { title: 'Presence', sliders: [
      S('texture', 'Texture', 'Texture', -100, 100),
      S('clarity', 'Clarity', 'Clarity2012', -100, 100),
      S('dehaze', 'Dehaze', 'Dehaze', -100, 100),
      S('vibrance', 'Vibrance', 'Vibrance', -100, 100),
      S('saturation', 'Saturation', 'Saturation', -100, 100),
    ] },
  ] },
  { id: 'curve', title: 'Tone curve', keys: ['curve', 'curveR', 'curveG', 'curveB'], groups: [
    { title: 'Regions', parametric: true, sliders: [
      S('pHighlights', 'Highlights', 'ParametricHighlights', -100, 100),
      S('pLights', 'Lights', 'ParametricLights', -100, 100),
      S('pDarks', 'Darks', 'ParametricDarks', -100, 100),
      S('pShadows', 'Shadows', 'ParametricShadows', -100, 100),
    ] },
    { title: 'Splits', parametric: true, sliders: [
      S('pSplitS', 'Shadows', 'ParametricShadowSplit', 10, 70, 1, 25),
      S('pSplitM', 'Midtones', 'ParametricMidtoneSplit', 20, 80, 1, 50),
      S('pSplitH', 'Highlights', 'ParametricHighlightSplit', 30, 90, 1, 75),
    ] },
    { title: 'Refine', sliders: [
      S('refineSat', 'Saturation', 'CurveRefineSaturation', 0, 100, 1, 100),
    ] },
  ] },
  { id: 'color', title: 'Color mixer', groups: [] },
  { id: 'grading', title: 'Color grading', groups: [
    { title: 'Balance', sliders: [
      S('gBlending', 'Blending', 'ColorGradeBlending', 0, 100, 1, 50),
      S('gBalance', 'Balance', 'SplitToningBalance', -100, 100),
    ] },
  ], more: [
    S('gShadowHue', 'Hue', 'SplitToningShadowHue', 0, 359), S('gShadowSat', 'Saturation', 'SplitToningShadowSaturation', 0, 100), S('gShadowLum', 'Luminance', 'ColorGradeShadowLum', -100, 100),
    S('gMidHue', 'Hue', 'ColorGradeMidtoneHue', 0, 359), S('gMidSat', 'Saturation', 'ColorGradeMidtoneSat', 0, 100), S('gMidLum', 'Luminance', 'ColorGradeMidtoneLum', -100, 100),
    S('gHighHue', 'Hue', 'SplitToningHighlightHue', 0, 359), S('gHighSat', 'Saturation', 'SplitToningHighlightSaturation', 0, 100), S('gHighLum', 'Luminance', 'ColorGradeHighlightLum', -100, 100),
    S('gGlobalHue', 'Hue', 'ColorGradeGlobalHue', 0, 359), S('gGlobalSat', 'Saturation', 'ColorGradeGlobalSat', 0, 100), S('gGlobalLum', 'Luminance', 'ColorGradeGlobalLum', -100, 100),
  ] },
  { id: 'detail', title: 'Detail', keys: ['aiDenoise'], groups: [
    { title: 'Sharpening', sliders: [
      S('sharpen', 'Amount', 'Sharpness', 0, 150, 1, 40),
      S('sharpenRadius', 'Radius', 'SharpenRadius', 0.5, 3, 0.1, 1, { decimals: 1 }),
      S('sharpenDetail', 'Detail', 'SharpenDetail', 0, 100, 1, 25),
      S('sharpenMasking', 'Masking', 'SharpenEdgeMasking', 0, 100, 1, 0),
    ] },
    { title: 'Noise reduction', sliders: [
      S('nrLuminance', 'Luminance', 'LuminanceSmoothing', 0, 100, 1, 0),
      S('nrLumDetail', 'Detail', 'LuminanceNoiseReductionDetail', 0, 100, 1, 50),
      S('nrLumContrast', 'Contrast', 'LuminanceNoiseReductionContrast', 0, 100, 1, 0),
      S('nrColor', 'Color', 'ColorNoiseReduction', 0, 100, 1, 25),
      S('nrColorDetail', 'Detail', 'ColorNoiseReductionDetail', 0, 100, 1, 50),
      S('nrColorSmooth', 'Smoothness', 'ColorNoiseReductionSmoothness', 0, 100, 1, 50),
    ] },
  ] },
  { id: 'lens', title: 'Lens corrections', keys: ['removeCA', 'lensProfile'], groups: [
    { title: 'Distortion', sliders: [
      S('distortion', 'Amount', 'LensManualDistortionAmount', -100, 100),
    ] },
    { title: 'Defringe', sliders: [
      S('defringePurple', 'Purple', 'DefringePurpleAmount', 0, 20),
      S('defringeGreen', 'Green', 'DefringeGreenAmount', 0, 20),
    ] },
    { title: 'Vignetting', sliders: [
      S('lensVignette', 'Amount', 'VignetteAmount', -100, 100),
      S('lensVignetteMid', 'Midpoint', 'VignetteMidpoint', 0, 100, 1, 50),
    ] },
  ] },
  { id: 'transform', title: 'Transform', keys: ['constrainCrop'], groups: [
    { title: 'Transform', sliders: [
      S('perspVertical', 'Vertical', 'PerspectiveVertical', -100, 100),
      S('perspHorizontal', 'Horizontal', 'PerspectiveHorizontal', -100, 100),
      S('perspRotate', 'Rotate', 'PerspectiveRotate', -10, 10, 0.1, 0, { decimals: 1 }),
      S('perspAspect', 'Aspect', 'PerspectiveAspect', -100, 100),
      S('perspScale', 'Scale', 'PerspectiveScale', 50, 150, 1, 100),
      S('perspX', 'X Offset', 'PerspectiveX', -100, 100, 0.1, 0, { decimals: 1 }),
      S('perspY', 'Y Offset', 'PerspectiveY', -100, 100, 0.1, 0, { decimals: 1 }),
    ] },
  ] },
  { id: 'effects', title: 'Effects', keys: ['vignetteStyle'], groups: [
    { title: 'Post-crop vignetting', sliders: [
      S('vignette', 'Amount', 'PostCropVignetteAmount', -100, 100),
      S('vignetteMidpoint', 'Midpoint', 'PostCropVignetteMidpoint', 0, 100, 1, 50),
      S('vignetteRoundness', 'Roundness', 'PostCropVignetteRoundness', -100, 100),
      S('vignetteFeather', 'Feather', 'PostCropVignetteFeather', 0, 100, 1, 50),
      S('vignetteHighlights', 'Highlights', 'PostCropVignetteHighlightContrast', 0, 100),
    ] },
    { title: 'Grain', sliders: [
      S('grain', 'Amount', 'GrainAmount', 0, 100),
      S('grainSize', 'Size', 'GrainSize', 0, 100, 1, 25),
      S('grainRough', 'Roughness', 'GrainFrequency', 0, 100, 1, 50),
    ] },
  ] },
  { id: 'calibration', title: 'Calibration', groups: [
    { title: 'Shadows', sliders: [S('shadowTint', 'Tint', 'ShadowTint', -100, 100, 1, 0, { gradient: 'tint' })] },
    { title: 'Red primary', sliders: [S('redHue', 'Hue', 'RedHue', -100, 100, 1, 0, { gradient: 'hue-red' }), S('redSat', 'Saturation', 'RedSaturation', -100, 100, 1, 0, { gradient: 'sat-red' })] },
    { title: 'Green primary', sliders: [S('greenHue', 'Hue', 'GreenHue', -100, 100, 1, 0, { gradient: 'hue-green' }), S('greenSat', 'Saturation', 'GreenSaturation', -100, 100, 1, 0, { gradient: 'sat-green' })] },
    { title: 'Blue primary', sliders: [S('blueHue', 'Hue', 'BlueHue', -100, 100, 1, 0, { gradient: 'hue-blue' }), S('blueSat', 'Saturation', 'BlueSaturation', -100, 100, 1, 0, { gradient: 'sat-blue' })] },
  ] },
];

const MIX = { hue: 'Hue', sat: 'Saturation', lum: 'Luminance' };
export const HSL_SLIDERS = ['hue', 'sat', 'lum'].flatMap((kind) => COLORS.map((c, i) => ({
  key: `${kind}${i}`,
  label: c,
  crs: `${MIX[kind]}Adjustment${c}`,
  min: -100, max: 100, step: 1, def: 0, kind, index: i,
})));
// The black & white mix: how bright each colour turns out in grey.
export const GRAY_SLIDERS = COLORS.map((c, i) => ({ key: `gray${i}`, label: c, crs: `GrayMixer${c}`, min: -100, max: 100, step: 1, def: 0, kind: 'gray', index: i }));

const sectionSliders = (sec) => [...sec.groups.flatMap((g) => g.sliders), ...(sec.more || []), ...(sec.id === 'color' ? [...HSL_SLIDERS, ...GRAY_SLIDERS] : [])];
export const SLIDERS = SECTIONS.flatMap(sectionSliders);
export const SLIDER = Object.fromEntries(SLIDERS.map((s) => [s.key, s]));
/** Every setting each section owns, for its reset button. */
export const SECTION_KEYS = Object.fromEntries(SECTIONS.map((sec) => [sec.id, [...sectionSliders(sec).map((s) => s.key), ...(sec.keys || [])]]));

export const LINEAR_CURVE = [[0, 0], [255, 255]];
// Lightroom's point curve presets (process 2012 and later).
export const CURVE_PRESETS = [
  ['Linear', LINEAR_CURVE],
  ['Medium Contrast', [[0, 0], [32, 22], [64, 56], [128, 128], [192, 196], [255, 255]]],
  ['Strong Contrast', [[0, 0], [32, 16], [64, 50], [128, 128], [192, 202], [255, 255]]],
];
export const CURVE_CHANNELS = [['curve', '', 'RGB'], ['curveR', 'Red', 'Red'], ['curveG', 'Green', 'Green'], ['curveB', 'Blue', 'Blue']];

// The starting look, as Lightroom's profile list names them. Adobe Color is
// Lightroom's default; Camera Standard matches the camera's own JPEG.
export const PROFILES = [['adobe', 'Adobe Color'], ['camera', 'Camera Standard'], ['agx', 'AgX (darktable)']];

// White balance presets for RAW files, as in Lightroom: [name, temp, tint].
export const WB_PRESETS = [['As Shot'], ['Auto'], ['Daylight', 5500, 10], ['Cloudy', 6500, 10], ['Shade', 7500, 10], ['Tungsten', 2850, 0], ['Fluorescent', 3800, 21], ['Flash', 5500, 0], ['Custom']];

export const VIGNETTE_STYLES = [[1, 'Highlight Priority'], [2, 'Color Priority'], [3, 'Paint Overlay']];

// Defaults are asked for often (every redraw of the panel), so they're kept per photo.
const defaultsCache = new WeakMap();
export function defaults(asShot) {
  let d = defaultsCache.get(asShot);
  if (!d) { d = makeDefaults(asShot); defaultsCache.set(asShot, d); }
  return { ...d };
}
function makeDefaults(asShot) {
  const s = { wb: 'As Shot', profile: 'adobe', toneMap: 'none', bw: false, removeCA: false, lensProfile: false, vignetteStyle: 1, constrainCrop: false, crop: null, masks: [], layers: [], aiDenoise: 0 };
  for (const [k] of CURVE_CHANNELS) s[k] = LINEAR_CURVE;
  for (const sl of SLIDERS) s[sl.key] = sl.def;
  s.temp = asShot.temp;
  s.tint = asShot.tint;
  return s;
}

/** Settings with one section put back to how the camera shot it. */
export function resetSection(s, id, asShot) {
  const d = defaults(asShot);
  return { ...s, ...Object.fromEntries(SECTION_KEYS[id].map((k) => [k, d[k]])) };
}

const same = (a, b) => a === b || (Array.isArray(a) && JSON.stringify(a) === JSON.stringify(b));
/** Whether a section differs from how the camera shot it. */
export function sectionEdited(s, id, asShot) {
  const d = defaultsCache.get(asShot) || defaults(asShot);
  return SECTION_KEYS[id].some((k) => (k === 'temp' || k === 'tint' ? false : !same(s[k], d[k])));
}

// Lightroom writes numbers with an explicit sign: "+0.35", "-20", "0".
const signed = (v, decimals = 0) => {
  const t = Number(v).toFixed(decimals);
  return Number(t) > 0 ? `+${t}` : Number(t) === 0 ? (0).toFixed(decimals) : t;
};

/** Settings from a sidecar's crs: values and point curves (anything missing keeps its default). */
export function fromXmp(crs, curves, asShot, own = {}) {
  const s = defaults(asShot);
  const num = (k) => (crs[k] != null && crs[k] !== '' && Number.isFinite(Number(crs[k])) ? Number(crs[k]) : null);
  for (const sl of SLIDERS) {
    // Tone mapper sliders are Flightroom's own, kept out of Lightroom's settings.
    const raw = sl.tm ? own[sl.crs] : crs[sl.crs];
    const v = raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
    if (v != null) s[sl.key] = Math.min(sl.max, Math.max(sl.min, v));
  }
  if (/^Camera /i.test(crs.CameraProfile || '')) s.profile = 'camera';
  // AgX is Flightroom's own; Lightroom sees Adobe Color.
  if (own.Profile === 'agx') s.profile = 'agx';
  const tm = own.ToneMap;
  if (TONE_MAPPERS.some(([k]) => k === tm)) s.toneMap = tm;
  else if (s.profile === 'agx') s.toneMap = 'agx';
  s.bw = crs.ConvertToGrayscale === 'True';
  s.removeCA = num('AutoLateralCA') === 1;
  s.lensProfile = num('LensProfileEnable') === 1;
  s.constrainCrop = num('CropConstrainToWarp') === 1;
  if ([1, 2, 3].includes(num('PostCropVignetteStyle'))) s.vignetteStyle = num('PostCropVignetteStyle');
  const wb = crs.WhiteBalance;
  if (wb && wb !== 'As Shot' && num('Temperature') != null) s.wb = WB_PRESETS.some(([n]) => n === wb) ? wb : 'Custom';
  else { s.temp = asShot.temp; s.tint = asShot.tint; }
  for (const [k, suffix] of CURVE_CHANNELS) {
    const seq = curves?.[`ToneCurvePV2012${suffix}`];
    if (!(seq?.length >= 2)) continue;
    const pts = seq.map((p) => p.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
    if (pts.length >= 2) s[k] = pts;
  }
  if (crs.HasCrop === 'True') {
    const c = { left: num('CropLeft') ?? 0, top: num('CropTop') ?? 0, right: num('CropRight') ?? 1, bottom: num('CropBottom') ?? 1, angle: num('CropAngle') ?? 0 };
    if (c.right > c.left && c.bottom > c.top) s.crop = c;
  }
  // Masks are read from Flightroom's own copy (Lightroom's newer mask format isn't read yet).
  if (own.Masks != null) { s.masks = masksFromJson(own.Masks); s.masksOwned = true; }
  // Retouch layers (Flightroom's own; Lightroom has nothing like them).
  if (own.Layers) s.layers = layersFromText(own.Layers);
  // AI Denoise: how much of it is blended in (Flightroom's own; Lightroom keeps it as a separate DNG).
  const dn = Number(own.Denoise);
  if (dn > 0 && dn <= 100) s.aiDenoise = Math.round(dn);
  return s;
}

export const curveName = (curve) => CURVE_PRESETS.find(([, c]) => same(c, curve))?.[0] || 'Custom';

/** What to write to the sidecar for these settings. */
export function toXmp(s) {
  const set = {
    Version: '15.0',
    ProcessVersion: '11.0',
    HasSettings: 'True',
    AlreadyApplied: 'False',
    WhiteBalance: s.wb,
    ToneCurveName2012: curveName(s.curve),
    ConvertToGrayscale: s.bw ? 'True' : 'False',
    AutoLateralCA: s.removeCA ? '1' : '0',
    LensProfileEnable: s.lensProfile ? '1' : '0',
    PostCropVignetteStyle: String(s.vignetteStyle || 1),
  };
  const ownTm = {};
  for (const sl of SLIDERS) {
    const v = s[sl.key];
    if (sl.tm) ownTm[sl.crs] = s.toneMap === sl.tm ? Number(v).toFixed(sl.decimals || 0) : '';
    else if (sl.key === 'temp') set[sl.crs] = String(Math.round(v));
    else if (sl.key === 'sharpenRadius') set[sl.crs] = signed(v, 1);
    else set[sl.crs] = sl.min >= 0 ? String(Math.round(v)) : signed(v, sl.decimals || 0);
  }
  const remove = [];
  // No CameraProfile means Lightroom's default, Adobe Color.
  if (s.profile === 'camera') set.CameraProfile = 'Camera Standard';
  else remove.push('CameraProfile');
  // Lightroom picks the lens profile itself from the photo's lens details.
  if (s.lensProfile) set.LensProfileSetup = 'LensDefaults';
  if (s.crop) {
    Object.assign(set, {
      HasCrop: 'True',
      CropLeft: s.crop.left.toFixed(6), CropTop: s.crop.top.toFixed(6),
      CropRight: s.crop.right.toFixed(6), CropBottom: s.crop.bottom.toFixed(6),
      CropAngle: s.crop.angle.toFixed(2),
      CropConstrainToWarp: s.constrainCrop ? '1' : '0',
    });
  } else {
    set.HasCrop = 'False';
    remove.push('CropLeft', 'CropTop', 'CropRight', 'CropBottom', 'CropAngle');
  }
  const pts = (c) => c.map(([x, y]) => `${Math.round(x)}, ${Math.round(y)}`);
  const seqs = Object.fromEntries(CURVE_CHANNELS.map(([k, suffix]) => [`ToneCurvePV2012${suffix}`, pts(s[k] || LINEAR_CURVE)]));
  // Masks: Flightroom's own copy, plus Lightroom's mask records. Only written
  // once Flightroom has made masks for the photo, so Lightroom's own masks
  // stay untouched otherwise.
  const out = {
    set,
    remove,
    seqs,
    own: {
      Masks: masksToJson(s.masks),
      Layers: layersToText(s.layers),
      Denoise: s.aiDenoise ? String(s.aiDenoise) : '',
      Profile: s.profile === 'agx' ? 'agx' : '',
      ToneMap: s.toneMap && s.toneMap !== 'none' ? s.toneMap : '',
      ...ownTm,
    },
  };
  if (s.masks?.length || s.masksOwned) out.xml = { ...masksToCrs(s.masks), ...(s.masks?.length ? { MaskGroupBasedCorrections: '' } : {}) };
  return out;
}

/** True when the settings differ from what the photo looked like straight from the camera. */
export function isEdited(s, asShot) {
  return !!s.crop || !!s.masks?.length || !!s.layers?.length || SECTIONS.some((sec) => sectionEdited(s, sec.id, asShot));
}

export function formatValue(sl, v) {
  if (v == null) return '';
  if (sl.key === 'temp') return String(Math.round(v));
  if (sl.decimals) return (v > 0 && sl.min < 0 ? '+' : '') + Number(v).toFixed(sl.decimals);
  return (v > 0 && sl.min < 0 ? '+' : '') + Math.round(v);
}
