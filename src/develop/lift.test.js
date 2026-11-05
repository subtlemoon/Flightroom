import { describe, expect, it } from 'vitest';
import { highlightTop, liftScale } from './renderer.js';

describe('adaptive tone sliders (Lightroom-style)', () => {
  it('leave the photo the sliders were fitted on alone', () => {
    expect(liftScale(1.96)).toBeCloseTo(1, 1);
    expect(liftScale(null)).toBe(1);
    expect(highlightTop(-3.97)).toBeCloseTo(0.55, 5);
    expect(highlightTop(null)).toBe(0.55);
  });
  it('match Lightroom on a brighter photo (JWL_7345)', () => {
    expect(liftScale(2.97)).toBeCloseTo(0.79, 2);
    expect(highlightTop(-3.11)).toBeCloseTo(0, 5);
  });
  it('barely lift a night photo with bright lights (JWL_7530)', () => {
    expect(liftScale(4.04)).toBeLessThan(0.03);
  });
  it('stay within bounds', () => {
    expect(liftScale(0)).toBeLessThanOrEqual(1);
    expect(liftScale(12)).toBeGreaterThanOrEqual(0);
    expect(highlightTop(0)).toBe(0);
    expect(highlightTop(-12)).toBe(0.55);
  });
});
