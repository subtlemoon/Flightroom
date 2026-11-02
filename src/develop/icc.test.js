import { describe, expect, it } from 'vitest';
import { displayTransform, parseIcc } from './icc.js';

// A minimal matrix/TRC display profile: colourants (XYZ D50) and one gamma for all channels.
function profile(cols, gamma) {
  const tags = [['rXYZ', cols[0]], ['gXYZ', cols[1]], ['bXYZ', cols[2]], ['rTRC'], ['gTRC'], ['bTRC']];
  const buf = new ArrayBuffer(132 + tags.length * 12 + 3 * 20 + 14);
  const v = new DataView(buf);
  v.setUint32(16, 0x52474220); v.setUint32(36, 0x61637370); v.setUint32(128, tags.length);
  const xyzAt = 132 + tags.length * 12, curvAt = xyzAt + 60;
  tags.forEach(([sig, xyz], i) => {
    const o = 132 + i * 12;
    for (let k = 0; k < 4; k++) v.setUint8(o + k, sig.charCodeAt(k));
    v.setUint32(o + 4, xyz ? xyzAt + i * 20 : curvAt); v.setUint32(o + 8, xyz ? 20 : 14);
    if (xyz) { v.setUint32(xyzAt + i * 20, 0x58595a20); xyz.forEach((c, k) => v.setInt32(xyzAt + i * 20 + 8 + k * 4, Math.round(c * 65536))); }
  });
  v.setUint32(curvAt, 0x63757276); v.setUint32(curvAt + 8, 1); v.setUint16(curvAt + 12, Math.round(gamma * 256));
  return buf;
}
const SRGB = [[0.4361, 0.2225, 0.0139], [0.3851, 0.7169, 0.0971], [0.1431, 0.0606, 0.7142]];
const P3 = [[0.5151, 0.2412, -0.0011], [0.2920, 0.6922, 0.0419], [0.1571, 0.0666, 0.7841]];

describe('screen profiles', () => {
  it('reads colourants and tone curves', () => {
    const p = parseIcc(profile(SRGB, 2.2));
    expect(p.cols[1][1]).toBeCloseTo(0.7169, 3);
    expect(p.trc[0](0.5)).toBeCloseTo(0.5 ** 2.2, 2);
  });
  it('corrects a gamma 2.2 screen with sRGB colours by tone only', () => {
    const t = displayTransform(parseIcc(profile(SRGB, 2.2)));
    expect(t.m[0]).toBeCloseTo(1, 2);
    expect(t.m[1]).toBeCloseTo(0, 2);
    expect(t.lut[512 * 4]).toBeCloseTo((512 / 1023) ** (2 / 2.2), 2);
  });
  it('pulls sRGB colours in on a wide-gamut screen', () => {
    const t = displayTransform(parseIcc(profile(P3, 2.2)));
    // Pure sRGB red is less than full red on a P3 panel (about 0.82).
    expect(t.m[0]).toBeGreaterThan(0.78);
    expect(t.m[0]).toBeLessThan(0.86);
  });
  it('rejects files that are not RGB display profiles', () => {
    expect(parseIcc(new ArrayBuffer(64))).toBe(null);
    expect(displayTransform(null)).toBe(null);
  });
});
