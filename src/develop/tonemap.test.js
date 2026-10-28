import { describe, expect, it } from 'vitest';
import { defaults } from './params.js';
import {
  AGX_INSET,
  AGX_OUTSET,
  MIDDLE_GRAY,
  TONE_MAPPERS,
  activeToneMap,
  agx,
  agxCurve,
  filmic,
  filmicCurve,
  filmicSpline,
  sigmoid,
  sigmoidCurve,
  tonemap,
  tonemapUniforms,
  sigmoidParams,
} from './tonemap.js';
import { apply3 } from './color.js';

function hsvHue([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d <= 1e-6) return 0;
  let h = 0;
  if (mx === r) h = ((g - b) / d + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function chroma([r, g, b]) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

describe('scene-referred tone mapping (tonemap.js)', () => {
  describe('Sigmoid', () => {
    it('pins middle gray (0.18) across contrast and skew settings', () => {
      for (const contrast of [0.7, 1.0, 1.5, 2.2, 3.2]) {
        for (const skew of [-0.8, -0.4, 0, 0.4, 0.8]) {
          expect(sigmoidCurve(MIDDLE_GRAY, contrast, skew)).toBeCloseTo(MIDDLE_GRAY, 6);
          const rgb = sigmoid([MIDDLE_GRAY, MIDDLE_GRAY, MIDDLE_GRAY], { contrast, skew });
          expect(rgb[0]).toBeCloseTo(MIDDLE_GRAY, 6);
          expect(rgb[1]).toBeCloseTo(MIDDLE_GRAY, 6);
          expect(rgb[2]).toBeCloseTo(MIDDLE_GRAY, 6);
        }
      }
    });

    it('is strictly monotonic on [0, inf) and preserves middle-gray log-slope across skew', () => {
      expect(sigmoidCurve(0, 1.5, 0)).toBe(0);
      const xs = [0.001, 0.01, 0.05, 0.18, 0.5, 1.0, 4.0, 16.0, 64.0];
      for (let i = 1; i < xs.length; i++) {
        expect(sigmoidCurve(xs[i], 1.5, 0)).toBeGreaterThan(sigmoidCurve(xs[i - 1], 1.5, 0));
      }
      expect(sigmoidCurve(1000, 1.5, 0)).toBeGreaterThan(0.99);

      // Finite-difference derivative wrt ln(x) at x = 0.18 should be invariant to skew.
      const eps = 1e-4;
      const xLo = MIDDLE_GRAY * Math.exp(-eps), xHi = MIDDLE_GRAY * Math.exp(eps);
      const slope0 = (sigmoidCurve(xHi, 1.8, 0) - sigmoidCurve(xLo, 1.8, 0)) / (2 * eps);
      const slopeNeg = (sigmoidCurve(xHi, 1.8, -0.6) - sigmoidCurve(xLo, 1.8, -0.6)) / (2 * eps);
      const slopePos = (sigmoidCurve(xHi, 1.8, 0.6) - sigmoidCurve(xLo, 1.8, 0.6)) / (2 * eps);
      expect(slopeNeg).toBeCloseTo(slope0, 4);
      expect(slopePos).toBeCloseTo(slope0, 4);
    });

    it('rolls off bright saturated highlights toward white and supports hue preservation', () => {
      const mid = sigmoid([0.4, 0.15, 0.05], { contrast: 1.6, skew: 0 });
      const bright = sigmoid([16.0, 6.0, 2.0], { contrast: 1.6, skew: 0 });
      expect(Math.min(...bright)).toBeGreaterThan(0.8);
      expect(chroma(bright)).toBeLessThan(chroma(mid));

      const src = [1.2, 0.45, 0.1];
      const preserved = sigmoid(src, { contrast: 2.0, skew: 0.2, preserveHue: 1 });
      expect(hsvHue(preserved)).toBeCloseTo(hsvHue(src), 3);
    });
  });

  describe('AgX', () => {
    it('keeps neutral grays achromatic through inset, S-curve, and outset', () => {
      const inGray = apply3(AGX_INSET, [0.5, 0.5, 0.5]);
      expect(inGray[0]).toBeCloseTo(0.5, 3);
      expect(inGray[1]).toBeCloseTo(0.5, 3);
      expect(inGray[2]).toBeCloseTo(0.5, 3);

      const outGray = apply3(AGX_OUTSET, inGray);
      expect(outGray[0]).toBeCloseTo(0.5, 3);
      expect(outGray[1]).toBeCloseTo(0.5, 3);
      expect(outGray[2]).toBeCloseTo(0.5, 3);

      const mapped = agx([MIDDLE_GRAY, MIDDLE_GRAY, MIDDLE_GRAY]);
      expect(mapped[0]).toBeCloseTo(mapped[1], 3);
      expect(mapped[1]).toBeCloseTo(mapped[2], 3);
    });

    it('pivots contrast around middle gray and desaturates intense highlights smoothly', () => {
      expect(agxCurve(0)).toBeLessThan(0.01);
      expect(agxCurve(1)).toBeCloseTo(1, 2);

      const gLowC = agx([MIDDLE_GRAY, MIDDLE_GRAY, MIDDLE_GRAY], { contrast: 0.7 });
      const gHighC = agx([MIDDLE_GRAY, MIDDLE_GRAY, MIDDLE_GRAY], { contrast: 1.6 });
      expect(gLowC[0]).toBeCloseTo(gHighC[0], 3);

      const midRed = agx([0.6, 0.08, 0.05], { contrast: 1.0, saturation: 1.0, desaturation: 0.5 });
      const hiRed = agx([12.0, 1.6, 1.0], { contrast: 1.0, saturation: 1.0, desaturation: 0.5 });
      expect(chroma(hiRed)).toBeLessThan(chroma(midRed));
      expect(Math.max(...hiRed)).toBeLessThanOrEqual(1);
    });
  });

  describe('Filmic RGB', () => {
    it('fits black/white EV bounds relative to middle gray (0.18) with a monotonic spline', () => {
      const sp = filmicSpline({ whiteEv: 4.5, blackEv: -8.5, contrast: 1.4 });
      const blackLin = MIDDLE_GRAY * 2 ** -8.5;
      const whiteLin = MIDDLE_GRAY * 2 ** 4.5;

      expect(filmicCurve(blackLin, sp)).toBeCloseTo(0, 5);
      expect(filmicCurve(MIDDLE_GRAY, sp)).toBeCloseTo(MIDDLE_GRAY, 5);
      expect(filmicCurve(whiteLin, sp)).toBeCloseTo(1, 5);

      let prev = -1;
      for (let ev = -8.5; ev <= 4.5; ev += 0.25) {
        const y = filmicCurve(MIDDLE_GRAY * 2 ** ev, sp);
        expect(y).toBeGreaterThanOrEqual(prev);
        prev = y;
      }
    });

    it('preserves hue across dynamic range while compressing highlights into gamut', () => {
      const colors = [
        [0.8, 0.25, 0.1],
        [0.1, 0.7, 0.3],
        [0.15, 0.3, 1.4],
        [4.0, 1.2, 0.3],
      ];
      for (const c of colors) {
        const out = filmic(c, { whiteEv: 4, blackEv: -8, contrast: 1.3, preserveHue: 1 });
        expect(out.every((v) => v >= 0 && v <= 1)).toBe(true);
        expect(hsvHue(out)).toBeCloseTo(hsvHue(c), 2);
      }
    });
  });

  describe('Dispatcher and WebGL uniforms', () => {
    it('selects the active tone mapper and produces shader uniforms', () => {
      expect(TONE_MAPPERS.map(([k]) => k)).toEqual(['none', 'sigmoid', 'agx', 'filmic']);
      expect(activeToneMap({})).toBe('none');
      expect(activeToneMap({ profile: 'agx' })).toBe('agx');
      expect(activeToneMap({ profile: 'agx', toneMap: 'sigmoid' })).toBe('sigmoid');

      expect(tonemapUniforms({ toneMap: 'none' }).uToneMap).toBe(0);
      expect(tonemapUniforms({ toneMap: 'sigmoid' }).uToneMap).toBe(1);
      expect(tonemapUniforms({ toneMap: 'agx' }).uToneMap).toBe(2);
      expect(tonemapUniforms({ toneMap: 'filmic' }).uToneMap).toBe(3);

      const rgb = [MIDDLE_GRAY, MIDDLE_GRAY, MIDDLE_GRAY];
      expect(tonemap(rgb, { toneMap: 'sigmoid' })[0]).toBeCloseTo(MIDDLE_GRAY, 5);
      expect(tonemap(rgb, { toneMap: 'filmic' })[0]).toBeCloseTo(MIDDLE_GRAY, 5);
    });
  });

  it('reads only its own sliders, not Basic Contrast and Saturation', () => {
    const s = { ...defaults({ temp: 5000, tint: 0 }), contrast: 0, saturation: 0 };
    expect(tonemapUniforms({ ...s, toneMap: 'agx' }).uTmA.slice(0, 2)).toEqual([1, 1]);
    expect(tonemapUniforms({ ...s, toneMap: 'sigmoid' }).uTmA[0]).toBeCloseTo(sigmoidParams({ contrast: 1.5 }).pf, 6);
    expect(tonemapUniforms({ ...s, toneMap: 'filmic' }).uTmA[3]).toBeCloseTo(filmicSpline({ contrast: 1.3 }).slope, 6);
  });
});
