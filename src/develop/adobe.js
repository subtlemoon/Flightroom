// Lightroom's colour for RAW files, ported from Adobe's DNG SDK
// (dng_color_spec, dng_render, dng_reference, dng_spline; portions
// Copyright Adobe, used under the DNG SDK license): a camera profile turns
// camera colours into ProPhoto RGB, then its hue/saturation map, the
// exposure, its look table (and Adobe Color's), and the tone curve.
//
// Built in, with nothing else installed: the camera's own colour matrices
// (Adobe's, as rawler has them) with Adobe's default tone curve. When
// Lightroom Classic or the free Adobe DNG Converter is on the computer, its
// profile for the camera (src-tauri/src/adobe.rs) adds Adobe's per-camera
// colour tables on top. Adobe's profile files themselves can't be shipped.
import { apply3, inv3, mul3, tempTintToXy, xyToTempTint } from './color.js';

// dng_tone_curve_acr3_default: Adobe's default tone curve, used by profiles
// without their own (Adobe Standard among them). 1025 values over 0-1, x 100000.
const ACR3 = new Float32Array([
0,78,160,242,314,385,460,539,623,712,806,906,1012,1122,1238,1359,1485,1616,1751,1890,2033,2180,2331,2485,2643,
2804,2967,3134,3303,3475,3648,3824,4002,4181,4362,4545,4730,4916,5103,5292,5483,5675,5868,6063,6259,6457,6655,
6856,7057,7259,7463,7668,7874,8081,8290,8499,8710,8921,9134,9348,9563,9779,9996,10214,10433,10652,10873,11095,
11318,11541,11766,11991,12218,12445,12673,12902,13132,13363,13595,13827,14061,14295,14530,14765,15002,15239,
15477,15716,15956,16197,16438,16680,16923,17166,17410,17655,17901,18148,18395,18643,18891,19141,19391,19641,
19893,20145,20398,20651,20905,21160,21416,21672,21929,22185,22440,22696,22950,23204,23458,23711,23963,24215,
24466,24717,24967,25216,25465,25713,25961,26208,26454,26700,26945,27189,27433,27676,27918,28160,28401,28641,
28881,29120,29358,29596,29833,30069,30305,30540,30774,31008,31241,31473,31704,31935,32165,32395,32623,32851,
33079,33305,33531,33756,33981,34205,34428,34650,34872,35093,35313,35532,35751,35969,36187,36404,36620,36835,
37050,37264,37477,37689,37901,38112,38323,38533,38742,38950,39158,39365,39571,39777,39982,40186,40389,40592,
40794,40996,41197,41397,41596,41795,41993,42191,42388,42584,42779,42974,43168,43362,43554,43747,43938,44129,
44319,44509,44698,44886,45073,45260,45447,45632,45817,46002,46186,46369,46551,46733,46914,47095,47275,47454,
47633,47811,47989,48166,48342,48518,48693,48867,49041,49214,49387,49559,49730,49901,50072,50241,50410,50579,
50747,50914,51081,51247,51413,51578,51742,51906,52069,52232,52394,52556,52717,52878,53038,53197,53356,53514,
53672,53829,53986,54142,54297,54452,54607,54761,54914,55067,55220,55371,55523,55673,55824,55973,56123,56271,
56420,56567,56715,56861,57007,57153,57298,57443,57587,57731,57874,58017,58159,58301,58443,58583,58724,58864,
59003,59142,59281,59419,59556,59694,59830,59966,60102,60238,60373,60507,60641,60775,60908,61040,61173,61305,
61436,61567,61698,61828,61957,62087,62216,62344,62472,62600,62727,62854,62980,63106,63232,63357,63482,63606,
63730,63854,63977,64100,64222,64344,64466,64587,64708,64829,64949,65069,65188,65307,65426,65544,65662,65779,
65897,66013,66130,66246,66362,66477,66592,66707,66821,66935,67048,67162,67275,67387,67499,67611,67723,67834,
67945,68055,68165,68275,68385,68494,68603,68711,68819,68927,69035,69142,69249,69355,69461,69567,69673,69778,
69883,69988,70092,70196,70300,70403,70506,70609,70711,70813,70915,71017,71118,71219,71319,71420,71520,71620,
71719,71818,71917,72016,72114,72212,72309,72407,72504,72601,72697,72794,72890,72985,73081,73176,73271,73365,
73460,73554,73647,73741,73834,73927,74020,74112,74204,74296,74388,74479,74570,74661,74751,74842,74932,75021,
75111,75200,75289,75378,75466,75555,75643,75730,75818,75905,75992,76079,76165,76251,76337,76423,76508,76594,
76679,76763,76848,76932,77016,77100,77183,77267,77350,77432,77515,77597,77680,77761,77843,77924,78006,78087,
78167,78248,78328,78408,78488,78568,78647,78726,78805,78884,78962,79040,79118,79196,79274,79351,79428,79505,
79582,79658,79735,79811,79887,79962,80038,80113,80188,80263,80337,80412,80486,80560,80634,80707,80780,80854,
80926,80999,81072,81144,81216,81288,81360,81431,81503,81574,81645,81715,81786,81856,81926,81996,82066,82135,
82205,82274,82343,82412,82480,82549,82617,82685,82753,82820,82888,82955,83022,83089,83155,83222,83288,83354,
83420,83486,83552,83617,83682,83747,83812,83877,83941,84005,84069,84133,84197,84261,84324,84387,84450,84513,
84576,84639,84701,84763,84825,84887,84949,85010,85071,85132,85193,85254,85315,85375,85436,85496,85556,85615,
85675,85735,85794,85853,85912,85971,86029,86088,86146,86204,86262,86320,86378,86435,86493,86550,86607,86664,
86720,86777,86833,86889,86945,87001,87057,87113,87168,87223,87278,87333,87388,87443,87497,87552,87606,87660,
87714,87768,87821,87875,87928,87981,88034,88087,88140,88192,88244,88297,88349,88401,88453,88504,88556,88607,
88658,88709,88760,88811,88862,88912,88963,89013,89063,89113,89163,89212,89262,89311,89360,89409,89458,89507,
89556,89604,89653,89701,89749,89797,89845,89892,89940,89987,90035,90082,90129,90176,90222,90269,90316,90362,
90408,90454,90500,90546,90592,90637,90683,90728,90773,90818,90863,90908,90952,90997,91041,91085,91130,91173,
91217,91261,91305,91348,91392,91435,91478,91521,91564,91606,91649,91691,91734,91776,91818,91860,91902,91944,
91985,92027,92068,92109,92150,92191,92232,92273,92314,92354,92395,92435,92475,92515,92555,92595,92634,92674,
92713,92753,92792,92831,92870,92909,92947,92986,93025,93063,93101,93139,93177,93215,93253,93291,93328,93366,
93403,93440,93478,93515,93551,93588,93625,93661,93698,93734,93770,93807,93843,93878,93914,93950,93986,94021,
94056,94092,94127,94162,94197,94231,94266,94301,94335,94369,94404,94438,94472,94506,94540,94573,94607,94641,
94674,94707,94740,94774,94807,94839,94872,94905,94937,94970,95002,95035,95067,95099,95131,95163,95194,95226,
95257,95289,95320,95351,95383,95414,95445,95475,95506,95537,95567,95598,95628,95658,95688,95718,95748,95778,
95808,95838,95867,95897,95926,95955,95984,96013,96042,96071,96100,96129,96157,96186,96214,96242,96271,96299,
96327,96355,96382,96410,96438,96465,96493,96520,96547,96574,96602,96629,96655,96682,96709,96735,96762,96788,
96815,96841,96867,96893,96919,96945,96971,96996,97022,97047,97073,97098,97123,97149,97174,97199,97223,97248,
97273,97297,97322,97346,97371,97395,97419,97443,97467,97491,97515,97539,97562,97586,97609,97633,97656,97679,
97702,97725,97748,97771,97794,97817,97839,97862,97884,97907,97929,97951,97973,97995,98017,98039,98061,98082,
98104,98125,98147,98168,98189,98211,98232,98253,98274,98295,98315,98336,98357,98377,98398,98418,98438,98458,
98478,98498,98518,98538,98558,98578,98597,98617,98636,98656,98675,98694,98714,98733,98752,98771,98789,98808,
98827,98845,98864,98882,98901,98919,98937,98955,98973,98991,99009,99027,99045,99063,99080,99098,99115,99133,
99150,99167,99184,99201,99218,99235,99252,99269,99285,99302,99319,99335,99351,99368,99384,99400,99416,99432,
99448,99464,99480,99495,99511,99527,99542,99558,99573,99588,99603,99619,99634,99649,99664,99678,99693,99708,
99722,99737,99751,99766,99780,99794,99809,99823,99837,99851,99865,99879,99892,99906,99920,99933,99947,99960,
99974,99987,100000,
]).map((v) => v / 1e5);

export function acr3(x) {
  const y = Math.min(1, Math.max(0, x)) * (ACR3.length - 1);
  const i = Math.min(Math.floor(y), ACR3.length - 2), f = y - i;
  return ACR3[i] * (1 - f) + ACR3[i + 1] * f;
}

/** dng_spline_solver: the C2 cubic spline through points, flat beyond the ends. */
export function splineCurve(points) {
  const X = points.map((p) => p[0]), Y = points.map((p) => p[1]);
  const n = X.length;
  if (n < 2) return (x) => x;
  const S = new Array(n).fill(0);
  let A = X[1] - X[0], B = (Y[1] - Y[0]) / A;
  S[0] = B;
  for (let j = 2; j < n; j++) {
    const C = X[j] - X[j - 1], D = (Y[j] - Y[j - 1]) / C;
    S[j - 1] = (B * C + D * A) / (A + C);
    A = C; B = D;
  }
  S[n - 1] = 2 * B - S[n - 2];
  S[0] = 2 * S[0] - S[1];
  if (n > 2) {
    const E = new Array(n).fill(0), F = new Array(n).fill(0), G = new Array(n).fill(0);
    F[0] = 0.5; E[n - 1] = 0.5;
    G[0] = 0.75 * (S[0] + S[1]);
    G[n - 1] = 0.75 * (S[n - 2] + S[n - 1]);
    for (let j = 1; j < n - 1; j++) {
      A = (X[j + 1] - X[j - 1]) * 2;
      E[j] = (X[j + 1] - X[j]) / A;
      F[j] = (X[j] - X[j - 1]) / A;
      G[j] = 1.5 * S[j];
    }
    for (let j = 1; j < n; j++) {
      A = 1 - F[j - 1] * E[j];
      if (j !== n - 1) F[j] /= A;
      G[j] = (G[j] - G[j - 1] * E[j]) / A;
    }
    for (let j = n - 2; j >= 0; j--) G[j] -= F[j] * G[j + 1];
    for (let j = 0; j < n; j++) S[j] = G[j];
  }
  return (x) => {
    if (x <= X[0]) return Y[0];
    if (x >= X[n - 1]) return Y[n - 1];
    let j = 1;
    while (x > X[j]) j++;
    const a = X[j] - X[j - 1], b = (x - X[j - 1]) / a, c = (X[j] - x) / a;
    return (Y[j - 1] * (2 - c + b) + S[j - 1] * a * b) * c * c + (Y[j] * (2 - b + c) - S[j] * a * c) * b * b;
  };
}

/** The profile's tone curve over 0-1 (TONE_SIZE samples, linear light in and out). */
export const TONE_SIZE = 4096;
export function toneTable(dcp) {
  const t = dcp?.tone;
  let fn = acr3;
  if (t?.length >= 4) {
    const pts = [];
    for (let i = 0; i + 1 < t.length; i += 2) pts.push([t[i], t[i + 1]]);
    fn = splineCurve(pts);
  }
  const out = new Float32Array(TONE_SIZE);
  for (let i = 0; i < TONE_SIZE; i++) out[i] = Math.min(1, Math.max(0, fn(i / (TONE_SIZE - 1))));
  return out;
}

// Colour spaces as the DNG SDK defines them (to XYZ D50, the "PCS").
const xyToXYZ = ([x, y]) => [x / y, 1, (1 - x - y) / y];
const D50_XY = [0.3457, 0.3585];
const PCS = xyToXYZ(D50_XY);
const SRGB_TO_PCS = [0.4361, 0.3851, 0.1431, 0.2225, 0.7169, 0.0606, 0.0139, 0.0971, 0.7141];
export const PCS_TO_SRGB = inv3(SRGB_TO_PCS);
const PROPHOTO_TO_PCS = [0.7977, 0.1352, 0.0313, 0.2880, 0.7119, 0.0001, 0, 0, 0.8249];
/** Linear sRGB <-> linear ProPhoto RGB. */
export const SRGB_TO_PP = mul3(inv3(PROPHOTO_TO_PCS), SRGB_TO_PCS);
export const PP_TO_SRGB = inv3(SRGB_TO_PP);
const BRADFORD = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const diag = (v) => [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]];

// dng_color_spec::MapWhiteMatrix: Bradford adaptation from one white to another.
function mapWhite(w1, w2) {
  const a = apply3(BRADFORD, xyToXYZ(w1)).map((v) => Math.max(v, 0));
  const b = apply3(BRADFORD, xyToXYZ(w2)).map((v) => Math.max(v, 0));
  const s = a.map((v, i) => Math.max(0.1, Math.min(v > 0 ? b[i] / v : 10, 10)));
  return mul3(mul3(inv3(BRADFORD), diag(s)), BRADFORD);
}

/** How much the first (warmer) illuminant counts at a white point. */
export function illuminantWeight(dcp, xy) {
  const ill = dcp.illuminants;
  if (ill.length < 2) return 1;
  const t = xyToTempTint(xy).temp, t1 = ill[0].temp, t2 = ill[1].temp;
  if (t <= t1) return 1;
  if (t >= t2) return 0;
  return (1 / t - 1 / t2) / (1 / t1 - 1 / t2);
}

const blend = (a, b, g) => (b ? a.map((v, i) => g * v + (1 - g) * b[i]) : a);
// dng_camera_profile::NormalizeForwardMatrix: camera (1,1,1) goes to D50 white exactly.
function normForward(m) {
  const xyz = apply3(m, [1, 1, 1]);
  return mul3(diag(PCS.map((p, i) => p / xyz[i])), m);
}

/** The XYZ -> camera matrices with their temperatures, as color.js uses them. */
export const dcpMatrices = (dcp) => dcp.illuminants.map((i) => [i.temp, i.color]);

/**
 * dng_color_spec::SetWhiteXY for a white point: the per-channel multipliers
 * (1 / camera white: 1 for the strongest channel, more for the others) and the matrix from
 * balanced camera RGB to linear sRGB.
 */
export function dcpTransform(dcp, xy) {
  const g = illuminantWeight(dcp, xy);
  const [i1, i2] = dcp.illuminants;
  const cm = blend(i1.color, i2?.color, g);
  let white = apply3(cm, xyToXYZ(xy));
  const mx = Math.max(...white);
  white = white.map((v) => Math.min(1, Math.max(0.001, v / mx)));
  const f1 = i1.forward && normForward(i1.forward), f2 = i2?.forward && normForward(i2.forward);
  const fm = f1 && f2 ? blend(f1, f2, g) : f1 || f2;
  let camToPcs;
  if (fm) camToPcs = mul3(fm, diag(white.map((w) => 1 / w)));
  else {
    let pcsToCam = mul3(cm, mapWhite(D50_XY, xy));
    const scale = Math.max(...apply3(pcsToCam, PCS));
    pcsToCam = pcsToCam.map((v) => v / scale);
    camToPcs = inv3(pcsToCam);
  }
  // The shader multiplies by 1 / white first (and clips there, as the SDK does).
  return { wb: white.map((w) => 1 / w), matrix: mul3(PCS_TO_SRGB, mul3(camToPcs, diag(white))), g };
}

/** The hue/saturation map for a white point (blended between the illuminants' maps). */
export function hueSatFor(dcp, g) {
  const [i1, i2] = dcp.illuminants;
  const a = i1.hue_sat, b = i2?.hue_sat;
  if (!a && !b) return null;
  if (!a || !b || g >= 1 || g <= 0 || a.data.length !== b.data.length) {
    const m = a && (g > 0 || !b) ? a : b;
    return { ...m, data: Float32Array.from(m.data) };
  }
  return { dims: a.dims, srgb: a.srgb, data: Float32Array.from(a.data, (v, k) => g * v + (1 - g) * b.data[k]) };
}

// Adobe Color's own point curve (its look's ToneCurvePV2012), used when
// Lightroom's copy of the look (with its table) isn't on this computer.
export const ADOBE_COLOR_CURVE = [[0, 0], [22, 16], [40, 35], [127, 127], [224, 230], [240, 246], [255, 255]];

// Lightroom's brightness for these profiles. The DNG SDK adds the camera's
// baseline exposure, which NEF files don't carry; this matches the
// Lightroom-fitted brightness Flightroom had (tools/lr-tone.md) at middle grey.
export const BASELINE_EXPOSURE = 0.072;

// The built-in profile for a photo: its colour matrices only (kept per photo,
// so the graphics card's tables are made once).
const builtIn = new WeakMap();
function builtInProfile(info) {
  if (!(info.matrices?.length > 0)) return null;
  let dcp = builtIn.get(info);
  if (!dcp) {
    const ill = info.matrices.map(([temp, color]) => ({ temp, color, forward: null, hue_sat: null }));
    dcp = { name: 'Adobe Standard', camera: info.camera || '', illuminants: ill.length > 1 ? [ill[0], ill[ill.length - 1]] : ill, look: null, tone: null, exposure_offset: 0, builtIn: true };
    builtIn.set(info, dcp);
  }
  return dcp;
}

// Lightroom's installed profiles render only once checked against Lightroom's
// own output. The built-in profile is: on JWL_7451 it is within 0.2 L* of
// Lightroom's export in every tone band (tools/lr-tone.md).
let useInstalled = false;
export function setUseInstalledProfiles(on) { useInstalled = !!on; }

/**
 * What renders a profile the way Lightroom does: Lightroom's own profile for
 * the camera when it's on this computer (and in use), else (Adobe Standard and
 * Adobe Color) the built-in one. Null for profiles with neither (the fitted
 * looks are used then).
 */
export function adobeRendering(info, profile) {
  if (!info) return null;
  const a = useInstalled ? info.adobe || {} : {};
  const name = profile === 'camera' ? 'Camera Standard' : profile === 'adobe' || profile === 'standard' ? 'Adobe Standard' : null;
  const dcp = name && (a.profiles?.[name] || (name === 'Adobe Standard' ? builtInProfile(info) : null));
  if (!dcp) return null;
  const tables = [dcp.look].filter(Boolean);
  let curve = null;
  if (profile === 'adobe') {
    const look = a.looks?.['Adobe Color'];
    if (look?.table) tables.push(look.table);
    curve = look?.curve?.length >= 2 ? look.curve : ADOBE_COLOR_CURVE;
  }
  return { name, dcp, tables, curve, exposure: BASELINE_EXPOSURE + (dcp.exposure_offset || 0) };
}

/**
 * A hue/sat map as an RGBA float texture's pixels: a column per saturation
 * division, a row per hue division within each value division.
 */
export function hueSatPixels(map) {
  const [h, s, v] = map.dims;
  const out = new Float32Array(s * h * v * 4);
  for (let k = 0; k < s * h * v; k++) {
    out[k * 4] = map.data[k * 3];
    out[k * 4 + 1] = map.data[k * 3 + 1];
    out[k * 4 + 2] = map.data[k * 3 + 2];
  }
  return { w: s, h: h * v, data: out };
}

// --- The same steps on the CPU (tests, and the shader's reference) ---------

/** DNG_RGBtoHSV: hue 0-6. */
export function rgbToHsv([r, g, b]) {
  const v = Math.max(r, g, b), gap = v - Math.min(r, g, b);
  if (gap <= 0) return [0, 0, v];
  let h;
  if (r === v) { h = (g - b) / gap; if (h < 0) h += 6; } else if (g === v) h = 2 + (b - r) / gap;
  else h = 4 + (r - g) / gap;
  return [h, gap / v, v];
}
export function hsvToRgb([h, s, v]) {
  if (s <= 0) return [v, v, v];
  h %= 6; if (h < 0) h += 6;
  const i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}
const encS = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
const decS = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

/** RefBaselineHueSatMap on one ProPhoto colour. */
export function applyHueSat(map, rgb) {
  const [hues, sats, vals] = map.dims;
  let [h, s, v] = rgbToHsv(rgb);
  const enc = map.srgb && v <= 1;
  let ve = enc ? encS(v) : v;
  const hS = hues < 2 ? 0 : h * (hues / 6), sS = s * (sats - 1);
  let h0 = Math.floor(hS), h1 = h0 + 1;
  const s0 = Math.min(Math.floor(sS), sats - 2);
  if (h0 >= hues - 1) { h0 = hues - 1; h1 = 0; }
  const hf = hS - h0, sf = sS - s0;
  let v0 = 0, vf = 0;
  if (vals > 1) {
    const vS = Math.min(1, Math.max(0, ve)) * (vals - 1);
    v0 = Math.min(Math.floor(vS), vals - 2);
    vf = vS - v0;
  }
  const at = (vi, hi, si, c) => map.data[((vi * hues + hi) * sats + si) * 3 + c];
  const lerp = (c) => {
    const plane = (vi) => (1 - sf) * ((1 - hf) * at(vi, h0, s0, c) + hf * at(vi, h1, s0, c)) + sf * ((1 - hf) * at(vi, h0, s0 + 1, c) + hf * at(vi, h1, s0 + 1, c));
    return vals > 1 ? (1 - vf) * plane(v0) + vf * plane(v0 + 1) : plane(0);
  };
  h += lerp(0) * (6 / 360);
  s = Math.min(s * lerp(1), 1);
  ve *= lerp(2);
  if (v <= 1) ve = Math.min(1, Math.max(0, ve));
  return hsvToRgb([h, s, enc ? decS(ve) : ve]);
}

/** RefBaselineRGBTone: the curve on the largest and smallest channel, the middle one keeping its place (so hue stays). */
export function rgbTone(curve, rgb) {
  const c = rgb.map((x) => Math.min(1, Math.max(0, x)));
  const mx = Math.max(...c), mn = Math.min(...c);
  const tmx = curve(mx), tmn = curve(mn);
  if (mx - mn <= 0) return [tmx, tmx, tmx];
  return c.map((x) => tmn + ((tmx - tmn) * (x - mn)) / (mx - mn));
}

/**
 * The desktop side's answer for a photo: with Lightroom's Adobe Standard for
 * its camera, white balance (As Shot, Temp, Tint) is worked out from Adobe's
 * matrices, so the numbers are Lightroom's.
 */
export function withAdobe(info) {
  const dcp = info?.adobe?.profiles?.['Adobe Standard'];
  if (dcp && !info.error) info.matrices = dcpMatrices(dcp);
  return info;
}
