import { describe, expect, it } from 'vitest';
import { GLOW_PRESETS, glowPlan, glowTint, glowUsed, halationColor } from './glow.js';
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

  it('Spread widens Bloom, Range reaches darker tones, Warmth warms', () => {
    const s = { ...defaults(asShot), glow: 50 };
    expect(glowPlan(s, 0, I).blur[0]).toBeCloseTo(0.01606, 5);
    expect(glowPlan({ ...s, glowSpread: 100 }, 0, I).blur[0]).toBeCloseTo(0.1118, 4);
    expect(glowPlan({ ...s, glowSpread: 0 }, 0, I).blur[0]).toBeCloseTo(0.006235, 5);
    // Weight on a mid grey (Y = .2) grows with Range.
    const wt = (r) => { const [e, n, k] = glowPlan({ ...s, glowRange: r }, 0, I).w; return k * ((e * 0.2) / (1 + e - 0.2)) ** n; };
    expect(wt(100)).toBeGreaterThan(wt(50));
    expect(wt(50)).toBeGreaterThan(wt(0));
    const warm = glowTint(100), cool = glowTint(-100);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
    expect(glowTint(0)).toEqual([1, 1, 1]);
  });

  it('Halation is a red glow that turns orange where strong', () => {
    for (const w of [-100, 0, 100]) { const [g, b] = halationColor(w); expect(g).toBeLessThan(0.3); expect(b).toBeLessThan(0.05); }
    const p = glowPlan({ ...defaults(asShot), glow: 100, glowStyle: 3 }, 0, I);
    expect(p.mode).toBe(1);
    expect(p.mix[0] + p.mix[1]).toBeCloseTo(1);
  });

  it('Direction turns clockwise as shown, and only Motion and Streak have one', () => {
    const s = { ...defaults(asShot), glow: 50, glowDirection: 90 };
    expect(glowPlan({ ...s, glowStyle: 2 }, 0, I).dir).toBeUndefined();
    const d = glowPlan({ ...s, glowStyle: 5 }, 0, I).dir;
    expect(Math.abs(d[0])).toBeLessThan(1e-9);
    expect(d[1]).toBeCloseTo(1); // down
    expect(glowPlan({ ...s, glowStyle: 4 }, 0, I).one).toBe(1);
    expect(glowPlan({ ...s, glowStyle: 5 }, 0, I).one).toBe(0);
  });

  it('defaults to Bloom', () => {
    expect(defaults(asShot).glowStyle).toBe(2);
    expect(glowPlan({ glow: 10 }, 0, I).mode).toBe(0);
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
