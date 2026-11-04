import { describe, expect, it } from 'vitest';
import { liftScale } from './renderer.js';

describe('liftScale (Lightroom-adaptive Shadows and Blacks)', () => {
  it('leaves the photo the sliders were fitted on alone', () => {
    expect(liftScale(-3.97)).toBeCloseTo(1, 5);
    expect(liftScale(null)).toBe(1);
  });
  it('lifts a brighter photo less, as Lightroom did on JWL_7345', () => {
    expect(liftScale(-3.11)).toBeCloseTo(0.65, 2);
  });
  it('stays within bounds', () => {
    expect(liftScale(0)).toBe(0.6);
    expect(liftScale(-12)).toBe(1.3);
  });
});
