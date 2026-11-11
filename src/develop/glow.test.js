import { describe, expect, it } from 'vitest';
import { GLOW_PRESETS, glowPlan, glowTint, glowUsed, levelWeights } from './glow.js';
import { defaults, fromXmp, toXmp } from './params.js';

const asShot = { temp: 5500, tint: 10 };
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('glow', () => {
  it('is off until the slider or a mask uses it', () => {
    const s = defaults(asShot);
    expect(glowUsed(s)).toBe(false);
    expect(glowUsed({ ...s, glow: 10 })).toBe(true);
    expect(glowUsed({ ...s, masks: [{ adj: { glow: 40 } }] })).toBe(true);
    expect(glowUsed({ ...s, masks: [{ adj: { glow: 40 }, hidden: true }] })).toBe(false);
  });

  it('Spread moves the weight from the finest size to the widest', () => {
    const fine = levelWeights(0), wide = levelWeights(100);
    expect(fine.reduce((a, b) => a + b)).toBeCloseTo(1);
    expect(fine[0]).toBeGreaterThan(fine[4]);
    expect(wide[4]).toBeGreaterThan(wide[0]);
  });

  it('Range lowers the threshold, Warmth warms, Halation stays yellow to red', () => {
    const s = { ...defaults(asShot), glow: 50 };
    expect(glowPlan({ ...s, glowRange: 100 }, 0, I).knee[0]).toBeLessThan(glowPlan({ ...s, glowRange: 0 }, 0, I).knee[0]);
    const warm = glowTint(1, 100), cool = glowTint(1, -100);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
    for (const w of [-100, 0, 100]) { const h = glowTint(3, w); expect(h[0]).toBeGreaterThan(h[1]); expect(h[1]).toBeGreaterThan(h[2]); }
  });

  it('Direction follows the photo as shown, and only Motion and Streak have one', () => {
    const s = { ...defaults(asShot), glow: 50, glowDirection: 90 };
    expect(glowPlan({ ...s, glowStyle: 2 }, 0, I).dir).toBeNull();
    const d = glowPlan({ ...s, glowStyle: 5 }, 0, I).dir;
    expect(Math.abs(d[0])).toBeLessThan(1e-9);
    expect(Math.abs(d[1])).toBeCloseTo(1);
  });

  it('is kept in the sidecar and read back, and left out when off', () => {
    const s = { ...defaults(asShot), glow: 45, glowStyle: 3, glowRange: 30, glowSpread: 70, glowWarmth: -20, glowDirection: 15, glowSoftness: 80 };
    const x = toXmp(s);
    expect(x.set.GlowAmount).toBeUndefined();
    const back = fromXmp(x.set, {}, asShot, x.own);
    for (const k of ['glow', 'glowStyle', 'glowRange', 'glowSpread', 'glowWarmth', 'glowDirection', 'glowSoftness']) expect(back[k]).toBe(s[k]);
    const off = toXmp(defaults(asShot)).own;
    expect(off.GlowAmount).toBe('');
    expect(off.GlowStyle).toBe('');
  });

  it('presets only hold Glow settings', () => {
    for (const [, p] of GLOW_PRESETS) expect(Object.keys(p).every((k) => k.startsWith('glow'))).toBe(true);
  });
});
