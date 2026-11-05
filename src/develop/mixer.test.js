import { describe, expect, it } from 'vitest';
import { HUE_SIZE, MIXER_HUES, hueTable } from './luts.js';

describe('hueTable', () => {
  it('puts each band at full strength on its own hue and blends between bands', () => {
    for (let b = 0; b < MIXER_HUES.length; b++) {
      const t = hueTable({ [`sat${b}`]: 100 });
      expect(t[Math.round(MIXER_HUES[b]) % HUE_SIZE * 4 + 1]).toBeGreaterThan(0.95);
    }
    const t = hueTable({ hue1: 100, hue2: -100 }); // orange and yellow
    const mid = Math.round((MIXER_HUES[1] + MIXER_HUES[2]) / 2);
    expect(Math.abs(t[mid * 4])).toBeLessThan(0.2);
  });
  it('wraps red across 0 degrees', () => {
    const t = hueTable({ lum0: 100 });
    expect(t[0 * 4 + 2]).toBeGreaterThan(0.9);
    expect(t[358 * 4 + 2]).toBeGreaterThan(0.9);
    expect(t[180 * 4 + 2]).toBe(0);
  });
});
