import { describe, expect, it } from 'vitest';
import { gradeTints } from './luts.js';

describe('gradeTints', () => {
  it('gives each region an RGB tint scaled by its amount', () => {
    const t = gradeTints({ gShadowHue: 217, gShadowSat: 45, gMidHue: 11, gMidSat: 20 });
    expect(t).toHaveLength(4);
    expect(t[2]).toEqual([0, 0, 0]);
    expect(t[3]).toEqual([0, 0, 0]);
    expect(Math.hypot(...gradeTints({ gMidHue: 11, gMidSat: 40 })[1])).toBeCloseTo(2 * Math.hypot(...t[1]), 4);
  });
  it('tints a blue shadow grade blue and a warm one warm', () => {
    const [blue] = gradeTints({ gShadowHue: 220, gShadowSat: 100 });
    expect(blue[2]).toBeGreaterThan(blue[0]);
    const [warm] = gradeTints({ gShadowHue: 30, gShadowSat: 100 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });
});
