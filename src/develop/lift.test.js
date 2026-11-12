import { describe, expect, it } from 'vitest';
import { contrastPivot, highlightTop, liftScale } from './renderer.js';

describe('adaptive tone sliders (Lightroom-style)', () => {
  it('leave the photo the sliders were fitted on alone', () => {
    expect(liftScale(1.96)).toBeCloseTo(0.9, 1);
    expect(contrastPivot(1.96)).toBe(0.6);
    expect(contrastPivot(null)).toBe(0.6);
    expect(liftScale(null)).toBe(1);
    expect(highlightTop(-3.97)).toBeCloseTo(0.55, 5);
    expect(highlightTop(null)).toBe(0.55);
  });
  it('match Lightroom on a brighter photo (JWL_7345)', () => {
    expect(liftScale(2.97)).toBeCloseTo(0.7, 1);
    expect(contrastPivot(2.97)).toBeCloseTo(0.56, 2);
    expect(highlightTop(-3.11)).toBeCloseTo(0, 5);
  });
  it('lift a night photo with bright lights less, and pivot Contrast lower (JWL_7530)', () => {
    expect(liftScale(4.04)).toBeCloseTo(0.37, 2);
    expect(contrastPivot(4.04)).toBeCloseTo(0.4, 5);
  });
  it('stay within bounds', () => {
    expect(liftScale(0)).toBeLessThanOrEqual(1);
    expect(liftScale(12)).toBeGreaterThanOrEqual(0);
    expect(contrastPivot(12)).toBeCloseTo(0.4, 5);
    expect(highlightTop(0)).toBe(0);
    expect(highlightTop(-12)).toBe(0.55);
  });
});
