import { describe, expect, it } from 'vitest';
import { lookSettings, maskWeights, measure, MOOD_KEYS, parseMood, recipeFor, solveGrade, subjectAdjust, targets } from './mood.js';
import { defaults, SLIDER } from './params.js';

const base = { ...defaults({ temp: 5500, tint: 0 }) };

// A stand-in renderer: a grey-to-colour ramp whose brightness, contrast,
// colour and warmth follow the sliders roughly (not linearly), as a real one does.
function fakeRender(s) {
  const n = 64 * 64, px = new Uint8ClampedArray(n * 4);
  const k = 2 ** (s.exposure * 0.8), c = 1 + s.contrast / 140, sat = s.saturation <= -100 || s.bw ? 0 : 1 + s.saturation / 90;
  const warm = (1e6 / 5500 - 1e6 / s.temp) / 160, tint = s.tint / 300;
  for (let i = 0; i < n; i++) {
    const t = (i % 64) / 63, hue = Math.floor(i / 64) / 64 * 6.28;
    let y = 0.5 + (Math.pow(t, 1.4) * k - 0.5) * c;
    y = Math.min(1, Math.max(0, y));
    const ch = 0.18 * sat;
    px[i * 4] = 255 * Math.min(1, Math.max(0, y * (1 + ch * Math.cos(hue) + warm + tint * 0.5)));
    px[i * 4 + 1] = 255 * Math.min(1, Math.max(0, y * (1 + ch * Math.cos(hue + 2.1) - tint)));
    px[i * 4 + 2] = 255 * Math.min(1, Math.max(0, y * (1 + ch * Math.cos(hue + 4.2) - warm + tint * 0.5)));
    px[i * 4 + 3] = 255;
  }
  return Promise.resolve(px);
}

describe('parseMood', () => {
  it('reads plain moods, typos, colour words and strength words', () => {
    expect(parseMood('Dreamy').looks).toEqual([['dreamy', 1]]);
    expect(parseMood('cinamatic').looks[0][0]).toBe('cinematic');
    expect(parseMood('very warm and a bit faded').looks).toEqual([['warm', 1.5], ['matte', 0.5]]);
    expect(parseMood('moody teal').colors).toEqual([[195, 1]]);
    expect(parseMood('black and white').looks[0][0]).toBe('noir');
    expect(parseMood('golden hour').looks[0][0]).toBe('golden');
  });
  it('says when it knows none of the words', () => {
    expect(parseMood('qwzx florp')).toBeNull();
    expect(parseMood('')).toBeNull();
  });
});

describe('recipeFor', () => {
  it('averages styles and adds modifiers', () => {
    const one = recipeFor(parseMood('dreamy'));
    const two = recipeFor(parseMood('dreamy cinematic'));
    expect(two.fade).toBeCloseTo(one.fade / 2 + 0.06, 5);
    expect(recipeFor(parseMood('warm')).warm).toBeGreaterThan(0);
    expect(recipeFor(parseMood('cold')).warm).toBeLessThan(0);
    expect(recipeFor(parseMood('warm'), 1.4).warm).toBeGreaterThan(recipeFor(parseMood('warm'), 0.6).warm);
  });
});

describe('lookSettings', () => {
  it('resets what a grade owns and keeps everything in range', () => {
    const old = { ...base, clarity: 70, gShadowSat: 80, crop: { x: 1 }, sharpen: 99 };
    const s = lookSettings(old, recipeFor(parseMood('vintage teal'), 1.4));
    expect(s.crop).toEqual({ x: 1 });
    expect(s.sharpen).toBe(99);
    expect(s.clarity).toBe(0);
    for (const k of MOOD_KEYS) if (SLIDER[k]) { expect(s[k]).toBeGreaterThanOrEqual(SLIDER[k].min); expect(s[k]).toBeLessThanOrEqual(SLIDER[k].max); }
    expect(s.curve[0][1]).toBeGreaterThan(0); // faded blacks
  });
});

describe('solveGrade', () => {
  for (const words of ['warm', 'cold', 'dreamy', 'moody', 'vivid', 'muted', 'bright', 'dramatic']) {
    it(`lands close to "${words}" on the photo`, async () => {
      const r = recipeFor(parseMood(words));
      const { after, want } = await solveGrade(base, r, fakeRender);
      expect(Math.abs(after.L50 - want.L)).toBeLessThan(0.03);
      expect(Math.abs(after.b - want.b)).toBeLessThan(0.006);
      expect(Math.abs(after.C - want.C)).toBeLessThan(0.015);
    });
  }
  it('moves warmth the way the mood says', async () => {
    const before = measure(await fakeRender(base));
    const warm = await solveGrade(base, recipeFor(parseMood('warm')), fakeRender);
    const cold = await solveGrade(base, recipeFor(parseMood('cold')), fakeRender);
    expect(warm.after.b).toBeGreaterThan(before.b + 0.01);
    expect(cold.after.b).toBeLessThan(before.b - 0.01);
    expect(warm.settings.temp).toBeGreaterThan(5500);
    expect(cold.settings.temp).toBeLessThan(5500);
  });
  it('gives an already warm photo less extra warmth', () => {
    const r = recipeFor(parseMood('warm'));
    const m = { L50: 0.5, spread: 0.5, C: 0.05, a: 0, b: 0 };
    expect(targets({ ...m, b: 0.04 }, r).b - 0.04).toBeLessThan(targets(m, r).b - 0);
  });
});

describe('subject', () => {
  it('flips the mask to the render\'s bottom-up rows', () => {
    const mask = { w: 2, h: 2, data: Uint8Array.from([255, 255, 0, 0]) }; // top row is the subject
    const { inW } = maskWeights(mask, 2, 2);
    expect([...inW]).toEqual([0, 0, 1, 1]);
  });
  it('lifts a subject that doesn\'t stand out and gives colour back in muted moods', () => {
    const r = recipeFor(parseMood('moody'));
    const adj = subjectAdjust({ L50: 0.4, area: 0.2 }, { L50: 0.42, area: 0.8 }, r, 0.75);
    expect(adj.exposure).toBeGreaterThan(0);
    expect(adj.saturation).toBeGreaterThan(0);
    expect(subjectAdjust({ L50: 0.4, area: 0.001 }, { L50: 0.4 }, r)).toBeNull();
  });
});
