import { describe, expect, it } from 'vitest';
import { highlightAdapt, liftScale } from './renderer.js';

describe('adaptive tone sliders (Lightroom-style)', () => {
  it('leave the photo the sliders were fitted on alone', () => {
    expect(liftScale(-3.97)).toBeCloseTo(1, 5);
    expect(liftScale(null)).toBe(1);
    expect(highlightAdapt(-3.97)).toEqual({ top: 0.55, k: 1 });
    expect(highlightAdapt(null)).toEqual({ top: 0.55, k: 1 });
  });
  it('match Lightroom on a brighter photo (JWL_7345)', () => {
    expect(liftScale(-3.11)).toBeCloseTo(0.65, 2);
    const h = highlightAdapt(-3.11);
    expect(h.top).toBeCloseTo(0, 5);
    expect(h.k).toBeCloseTo(1.15, 5);
  });
  it('stay within bounds', () => {
    expect(liftScale(0)).toBe(0.6);
    expect(liftScale(-12)).toBe(1.3);
    expect(highlightAdapt(0)).toEqual({ top: 0, k: 1.15 });
    expect(highlightAdapt(-12)).toEqual({ top: 0.55, k: 1 });
  });
});
