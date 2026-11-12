import { describe, expect, it } from 'vitest';
import { apply3, neutralToXy, tempTintToXy, xyToTempTint } from './color.js';
import { cameraTransform, renderWhite, tempTintFor } from './renderer.js';

// A Canon 80D (the matrices rawler has) with no Lightroom on the computer, and
// its As Shot multipliers for daylight-ish light.
const M1 = [0.832, -0.1998, -0.0078, -0.3476, 1.0481, 0.348, -0.0384, 0.1349, 0.5901];
const M2 = [0.7457, -0.0671, -0.0937, -0.4849, 1.2495, 0.2643, -0.1213, 0.2354, 0.5492];
const X = ([x, y]) => [x / y, 1, (1 - x - y) / y];
const scene = apply3(M1.map((v, i) => 0.5 * v + 0.5 * M2[i]), X(tempTintToXy(4300, 5)));
const info = { matrices: [[2856, M1], [6504, M2]], asShot: scene.map((v) => Math.max(...scene) / v) };
const shot = xyToTempTint(neutralToXy(info.matrices, info.asShot.map((m) => 1 / m)));
const grey = scene.map((v) => v * 0.15);
const render = (s) => { const { wb, matrix } = cameraTransform(info, s); const o = apply3(matrix, grey.map((v, i) => Math.min(1, v * wb[i]))); const m = Math.max(...o); return o.map((v) => v / m); };

describe('white balance without Lightroom\'s profile (built-in Adobe Standard)', () => {
  it('leaves As Shot alone', () => {
    const s = { profile: 'adobe', wb: 'As Shot', temp: Math.round(shot.temp), tint: Math.round(shot.tint) };
    const xy = renderWhite(info, s), want = neutralToXy(info.matrices, info.asShot.map((m) => 1 / m));
    expect(xy[0]).toBeCloseTo(want[0], 4);
    expect(xy[1]).toBeCloseTo(want[1], 4);
    render(s).forEach((v) => expect(v).toBeGreaterThan(0.97));
  });
  it('Tint toward magenta no longer turns an 80D photo solid blue (Lightroom shows lavender)', () => {
    // Lightroom's own 80D profile renders this grey about [0.54, 0.44, 1]; colour matrices alone gave [0.12, 0.12, 1].
    const [r, g, b] = render({ profile: 'adobe', wb: 'Custom', temp: 3500, tint: 100 });
    expect(b).toBe(1);
    expect(r).toBeGreaterThan(0.3);
    expect(g).toBeGreaterThan(0.3);
  });
  it('still gets steadily more coloured along Tint, both ways', () => {
    let last = -Infinity;
    for (let tint = -150; tint <= 150; tint += 5) {
      const [r, g, b] = render({ profile: 'adobe', wb: 'Custom', temp: 4300, tint });
      const magenta = Math.log((r + b) / 2 / g);
      expect(magenta).toBeGreaterThan(last - 1e-6);
      last = magenta;
    }
  });
  it('the white balance selector still makes the spot it picked grey', () => {
    const spot = apply3(M2, X(tempTintToXy(6200, -12)));
    for (const profile of ['adobe', 'camera']) {
      const t = tempTintFor(info, profile, spot);
      const { wb, matrix } = cameraTransform(info, { profile, wb: 'Custom', temp: t.temp, tint: t.tint });
      const o = apply3(matrix, spot.map((v, i) => Math.min(1, (v / Math.max(...spot)) * 0.2 * wb[i])));
      const m = Math.max(...o);
      o.forEach((v) => expect(v / m).toBeGreaterThan(0.98));
    }
  });
  it('is unchanged with Lightroom\'s profile (it has forward matrices)', () => {
    const F = [0.5369, 0.2694, 0.158, 0.3315, 0.6187, 0.0498, 0.1953, 0.0003, 0.6295];
    const dcp = { illuminants: [{ temp: 2856, color: M1, forward: F, hue_sat: null }, { temp: 6504, color: M2, forward: F, hue_sat: null }], look: null };
    const withLr = { ...info, adobe: { profiles: { 'Adobe Standard': dcp } } };
    const s = { profile: 'adobe', wb: 'Custom', temp: 3500, tint: 100 };
    const xy = renderWhite(withLr, s), want = tempTintToXy(3500, 100);
    expect(xy[0]).toBeCloseTo(want[0], 6);
    expect(xy[1]).toBeCloseTo(want[1], 6);
  });
});
