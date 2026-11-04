import { describe, expect, it } from 'vitest';
import { gradeTints } from './luts.js';

describe('gradeTints', () => {
  it('gives each region a unit OKLab direction and its amount', () => {
    const t = gradeTints({ gShadowHue: 217, gShadowSat: 45, gMidHue: 11, gMidSat: 20 });
    expect(t).toHaveLength(4);
    for (const [a, b] of t) expect(Math.hypot(a, b)).toBeCloseTo(1, 4);
    expect(t.map((v) => v[2])).toEqual([0.45, 0.2, 0, 0]);
  });
  it('points a blue shadow grade toward blue (OKLab b < 0)', () => {
    expect(gradeTints({ gShadowHue: 217, gShadowSat: 45 })[0][1]).toBeLessThan(0);
  });
});
