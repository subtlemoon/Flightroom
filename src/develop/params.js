// Develop settings: what each slider is, its range and default, and how it is
// stored in the .xmp sidecar using Lightroom's own names (the crs: namespace),
// so Lightroom picks the edits up when it imports or re-reads the photo.

export const COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
export const COLOR_HUES = [0, 30, 60, 120, 180, 240, 270, 300]; // band centres, degrees

// key, label, crs name, min, max, step, default
const S = (key, label, crs, min, max, step = 1, def = 0, extra = {}) => ({ key, label, crs, min, max, step, def, ...extra });

export const SECTIONS = [
  { id: 'basic', title: 'Basic', groups: [
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
    { title: 'Presence', sliders: [
      S('texture', 'Texture', 'Texture', -100, 100),
      S('clarity', 'Clarity', 'Clarity2012', -100, 100),
      S('dehaze', 'Dehaze', 'Dehaze', -100, 100),
      S('vibrance', 'Vibrance', 'Vibrance', -100, 100),
      S('saturation', 'Saturation', 'Saturation', -100, 100),
    ] },
  ] },
  { id: 'curve', title: 'Tone curve', groups: [
    { title: 'Regions', sliders: [
      S('pHighlights', 'Highlights', 'ParametricHighlights', -100, 100),
      S('pLights', 'Lights', 'ParametricLights', -100, 100),
      S('pDarks', 'Darks', 'ParametricDarks', -100, 100),
      S('pShadows', 'Shadows', 'ParametricShadows', -100, 100),
    ] },
  ] },
  { id: 'color', title: 'Color mixer', groups: [] },
  { id: 'detail', title: 'Detail', groups: [
    { title: 'Sharpening', sliders: [
      S('sharpen', 'Amount', 'Sharpness', 0, 150, 1, 40),
      S('sharpenRadius', 'Radius', 'SharpenRadius', 0.5, 3, 0.1, 1, { decimals: 1 }),
      S('sharpenDetail', 'Detail', 'SharpenDetail', 0, 100, 1, 25),
      S('sharpenMasking', 'Masking', 'SharpenEdgeMasking', 0, 100, 1, 0),
    ] },
    { title: 'Noise reduction', sliders: [
      S('nrLuminance', 'Luminance', 'LuminanceSmoothing', 0, 100, 1, 0),
      S('nrColor', 'Color', 'ColorNoiseReduction', 0, 100, 1, 25),
    ] },
  ] },
  { id: 'effects', title: 'Effects', groups: [
    { title: 'Vignette', sliders: [
      S('vignette', 'Amount', 'PostCropVignetteAmount', -100, 100),
      S('vignetteMidpoint', 'Midpoint', 'PostCropVignetteMidpoint', 0, 100, 1, 50),
      S('vignetteRoundness', 'Roundness', 'PostCropVignetteRoundness', -100, 100),
      S('vignetteFeather', 'Feather', 'PostCropVignetteFeather', 0, 100, 1, 50),
    ] },
  ] },
];

export const HSL_SLIDERS = ['hue', 'sat', 'lum'].flatMap((kind) => COLORS.map((c, i) => ({
  key: `${kind}${i}`,
  label: c,
  crs: `${{ hue: 'Hue', sat: 'Saturation', lum: 'Luminance' }[kind]}Adjustment${c}`,
  min: -100, max: 100, step: 1, def: 0, kind, index: i,
})));

export const SLIDERS = [...SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.sliders)), ...HSL_SLIDERS];
export const SLIDER = Object.fromEntries(SLIDERS.map((s) => [s.key, s]));

export const LINEAR_CURVE = [[0, 0], [255, 255]];

export function defaults(asShot) {
  const s = { wb: 'As Shot', curve: LINEAR_CURVE, crop: null };
  for (const sl of SLIDERS) s[sl.key] = sl.def;
  s.temp = asShot.temp;
  s.tint = asShot.tint;
  return s;
}

// Lightroom writes numbers with an explicit sign: "+0.35", "-20", "0".
const signed = (v, decimals = 0) => {
  const t = Number(v).toFixed(decimals);
  return Number(t) > 0 ? `+${t}` : Number(t) === 0 ? (0).toFixed(decimals) : t;
};

/** Settings from a sidecar's crs: values (anything missing keeps its default). */
export function fromXmp(crs, curve, asShot) {
  const s = defaults(asShot);
  const num = (k) => (crs[k] != null && crs[k] !== '' && Number.isFinite(Number(crs[k])) ? Number(crs[k]) : null);
  for (const sl of SLIDERS) {
    const v = num(sl.crs);
    if (v != null) s[sl.key] = Math.min(sl.max, Math.max(sl.min, v));
  }
  if (crs.WhiteBalance && crs.WhiteBalance !== 'As Shot' && num('Temperature') != null) s.wb = 'Custom';
  else { s.temp = asShot.temp; s.tint = asShot.tint; }
  if (curve?.length >= 2) {
    const pts = curve.map((p) => p.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
    if (pts.length >= 2) s.curve = pts;
  }
  if (crs.HasCrop === 'True') {
    const c = { left: num('CropLeft') ?? 0, top: num('CropTop') ?? 0, right: num('CropRight') ?? 1, bottom: num('CropBottom') ?? 1, angle: num('CropAngle') ?? 0 };
    if (c.right > c.left && c.bottom > c.top) s.crop = c;
  }
  return s;
}

const isLinear = (curve) => curve.length === 2 && curve[0][0] === 0 && curve[0][1] === 0 && curve[1][0] === 255 && curve[1][1] === 255;

/** What to write to the sidecar for these settings. */
export function toXmp(s) {
  const set = {
    Version: '15.0',
    ProcessVersion: '11.0',
    HasSettings: 'True',
    AlreadyApplied: 'False',
    WhiteBalance: s.wb === 'As Shot' ? 'As Shot' : 'Custom',
    ToneCurveName2012: isLinear(s.curve) ? 'Linear' : 'Custom',
    ParametricShadowSplit: '25',
    ParametricMidtoneSplit: '50',
    ParametricHighlightSplit: '75',
    PostCropVignetteStyle: '1',
  };
  for (const sl of SLIDERS) {
    const v = s[sl.key];
    if (sl.key === 'temp') set[sl.crs] = String(Math.round(v));
    else if (sl.key === 'sharpenRadius') set[sl.crs] = signed(v, 1);
    else set[sl.crs] = sl.min >= 0 ? String(Math.round(v)) : signed(v, sl.decimals || 0);
  }
  const remove = [];
  if (s.crop) {
    Object.assign(set, {
      HasCrop: 'True',
      CropLeft: s.crop.left.toFixed(6), CropTop: s.crop.top.toFixed(6),
      CropRight: s.crop.right.toFixed(6), CropBottom: s.crop.bottom.toFixed(6),
      CropAngle: s.crop.angle.toFixed(2),
      CropConstrainToWarp: '0',
    });
  } else {
    set.HasCrop = 'False';
    remove.push('CropLeft', 'CropTop', 'CropRight', 'CropBottom', 'CropAngle');
  }
  const seqs = { ToneCurvePV2012: s.curve.map(([x, y]) => `${Math.round(x)}, ${Math.round(y)}`) };
  return { set, remove, seqs };
}

/** True when the settings differ from what the photo looked like straight from the camera. */
export function isEdited(s, asShot) {
  const d = defaults(asShot);
  return SLIDERS.some((sl) => sl.key !== 'temp' && sl.key !== 'tint' && s[sl.key] !== d[sl.key])
    || s.wb !== 'As Shot' || !!s.crop || !isLinear(s.curve);
}

export function formatValue(sl, v) {
  if (v == null) return '';
  if (sl.key === 'temp') return String(Math.round(v));
  if (sl.decimals) return (v > 0 && sl.min < 0 ? '+' : '') + Number(v).toFixed(sl.decimals);
  return (v > 0 && sl.min < 0 ? '+' : '') + Math.round(v);
}
