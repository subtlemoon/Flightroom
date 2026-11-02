// Screen colour correction, as Lightroom does it: the Develop picture is in
// sRGB, and the screen's own ICC profile (from Windows) says how to show sRGB
// on this particular panel. WebView2 draws canvases without it, so a
// calibrated or wide-gamut laptop screen showed the photo off (Jaewon's
// Zephyrus: too contrasty and saturated next to the same JPEG in a photo viewer).
// Only matrix/TRC display profiles are read (what laptops and calibrators make).

import { bridge } from '../bridge.js';

const s15 = (v, o) => v.getInt32(o) / 65536;

/** A matrix/TRC profile's colourants (XYZ, D50) and tone curves, or null. */
export function parseIcc(buf) {
  const v = new DataView(buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer);
  if (v.byteLength < 132 || v.getUint32(36) !== 0x61637370) return null; // 'acsp'
  if (v.getUint32(16) !== 0x52474220) return null; // 'RGB '
  const tags = {};
  const n = v.getUint32(128);
  for (let i = 0; i < n; i++) {
    const o = 132 + i * 12;
    if (o + 12 > v.byteLength) return null;
    const sig = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    tags[sig] = [v.getUint32(o + 4), v.getUint32(o + 8)];
  }
  const xyz = (sig) => {
    const t = tags[sig];
    if (!t || t[1] < 20) return null;
    return [s15(v, t[0] + 8), s15(v, t[0] + 12), s15(v, t[0] + 16)];
  };
  const curve = (sig) => {
    const t = tags[sig];
    if (!t) return null;
    const [o] = t;
    const type = v.getUint32(o);
    if (type === 0x63757276) { // 'curv'
      const count = v.getUint32(o + 8);
      if (count === 0) return (x) => x;
      if (count === 1) { const g = v.getUint16(o + 12) / 256; return (x) => x ** g; }
      const table = Array.from({ length: count }, (_, i) => v.getUint16(o + 12 + i * 2) / 65535);
      return (x) => { const p = Math.min(1, Math.max(0, x)) * (count - 1), i = Math.min(count - 2, Math.floor(p)); return table[i] + (table[i + 1] - table[i]) * (p - i); };
    }
    if (type === 0x70617261) { // 'para'
      const fn = v.getUint16(o + 8);
      const p = Array.from({ length: [1, 3, 4, 5, 7][fn] || 0 }, (_, i) => s15(v, o + 12 + i * 4));
      const [g, a, b, c, d, e, f] = p;
      if (fn === 0) return (x) => x ** g;
      if (fn === 1) return (x) => (x >= -b / a ? (a * x + b) ** g : 0);
      if (fn === 2) return (x) => (x >= -b / a ? (a * x + b) ** g + c : c);
      if (fn === 3) return (x) => (x >= d ? (a * x + b) ** g : c * x);
      if (fn === 4) return (x) => (x >= d ? (a * x + b) ** g + e : c * x + f);
    }
    return null;
  };
  const r = xyz('rXYZ'), g = xyz('gXYZ'), b = xyz('bXYZ');
  const trc = [curve('rTRC'), curve('gTRC'), curve('bTRC')];
  if (!r || !g || !b || trc.some((c) => !c)) return null;
  return { cols: [r, g, b], trc };
}

// Linear sRGB -> XYZ D50 (Bradford), as ICC profiles use.
const SRGB_D50 = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]];

function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const mul3 = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

export const LUT_SIZE = 1024;

/**
 * What the screen pass needs: `m` (linear sRGB -> the screen's linear RGB,
 * column-major for GLSL) and `lut` (RGBA, per channel: the screen value for a
 * linear light t², t = i / (LUT_SIZE - 1)). Null when the profile is about sRGB anyway.
 */
export function displayTransform(p) {
  if (!p) return null;
  const P = [0, 1, 2].map((row) => p.cols.map((c) => c[row])); // columns are the colourants
  const M = mul3(inv3(P), SRGB_D50);
  const lut = new Float32Array(LUT_SIZE * 4);
  let off = 0;
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1), y = t * t;
    for (let c = 0; c < 3; c++) {
      // The screen value whose light is y: invert the (rising) tone curve.
      let lo = 0, hi = 1;
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (p.trc[c](mid) < y) lo = mid; else hi = mid; }
      const out = (lo + hi) / 2;
      lut[i * 4 + c] = out;
      const srgb = y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055;
      off = Math.max(off, Math.abs(out - srgb));
    }
    lut[i * 4 + 3] = 1;
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) off = Math.max(off, Math.abs(M[r][c] - (r === c ? 1 : 0)));
  if (off < 0.004) return null;
  return { m: [M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]], lut };
}

// The setting (on unless turned off) and the screen's transform, read once.
export const screenColorOn = () => { try { return localStorage.getItem('flightroom-screen-color') !== '0'; } catch { return true; } };
export const setScreenColor = (on) => { try { localStorage.setItem('flightroom-screen-color', on ? '1' : '0'); } catch {} window.dispatchEvent(new Event('screen-color')); };

let pending = null;
/** { name, transform } for the screen Flightroom is on (transform null: nothing to correct). */
export function screenProfile() {
  pending ||= (async () => {
    const res = bridge?.displayProfile ? await bridge.displayProfile() : null;
    if (!res || res.error || !res.data) return { name: res?.name || null, transform: null };
    const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
    return { name: res.name, transform: displayTransform(parseIcc(bytes.buffer)) };
  })().catch(() => ({ name: null, transform: null }));
  return pending;
}
