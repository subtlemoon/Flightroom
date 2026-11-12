import { describe, it, expect } from 'vitest';
import { scopeGrid, TARGETS, chroma, SKIN_ANGLE } from './scope.js';

describe('vectorscope', () => {
  it('puts the colour dots at Lightroom\'s angles', () => {
    const deg = TARGETS.map((t) => Math.round((((t.angle * 180) / Math.PI) + 360) % 360));
    expect(deg).toEqual([103, 50, 355, 283, 230, 175]);
    expect(TARGETS[0].tick).toBeCloseTo(0.8, 1);
    expect(TARGETS[4].tick).toBeCloseTo(0.92, 1);
    expect(SKIN_ANGLE).toBeGreaterThan(2);
  });
  it('greys sit in the centre and wider spaces pull colours in', () => {
    expect(chroma(0.5, 0.5, 0.5).map((v) => Math.abs(v) < 1e-9)).toEqual([true, true]);
    const px = new Uint8Array([160, 110, 100, 255]); // a mild red in Melissa RGB
    const dist = (sp) => { const g = scopeGrid(px, sp, 200); const k = g.count.indexOf(Math.max(...g.count)); return Math.hypot((k % 200) - 99.5, Math.floor(k / 200) - 99.5); };
    expect(dist('srgb')).toBeGreaterThan(dist('adobe'));
    expect(dist('adobe')).toBeGreaterThan(dist('prophoto'));
    const grey = scopeGrid(new Uint8Array([128, 128, 128, 255]), 'srgb', 100);
    let sx = 0, sy = 0, sw = 0;
    grey.count.forEach((c, k) => { sx += c * (k % 100); sy += c * Math.floor(k / 100); sw += c; });
    expect([sx / sw, sy / sw]).toEqual([49.5, 49.5]); // the centre, between the middle four cells
  });
});

describe('vectorscope reading', () => {
  it('clips colours outside the space to its edge, as Lightroom does', async () => {
    const { scopeAt } = await import('./scope.js');
    // Two oranges past sRGB (Melissa RGB) that differ only outside sRGB land together.
    const a = scopeAt(new Uint8Array([230, 120, 20, 255]), 1, 1, 0, 0, 'srgb');
    const b = scopeAt(new Uint8Array([230, 120, 10, 255]), 1, 1, 0, 0, 'srgb');
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.01);
  });
  it('reads a spot against the skin line', async () => {
    const { skinReading, SKIN_ANGLE } = await import('./scope.js');
    const on = skinReading([Math.cos(SKIN_ANGLE) * 0.3, Math.sin(SKIN_ANGLE) * 0.3]);
    expect(Math.abs(on.off)).toBeLessThan(1e-6);
    expect(on.sat).toBeCloseTo(30, 5);
    const a = SKIN_ANGLE + 0.1;
    expect(skinReading([Math.cos(a), Math.sin(a)]).off).toBeGreaterThan(5); // toward yellow
  });
  it('finds the pixel under the pointer (bottom row first)', async () => {
    const { scopeAt } = await import('./scope.js');
    // 3x3: top row red, rest grey. Pointer at the top (fy = -1 is the top in frame units).
    const px = new Uint8Array(9 * 4).fill(128);
    for (let x = 0; x < 3; x++) { const i = (2 * 3 + x) * 4; px[i] = 200; px[i + 1] = 60; px[i + 2] = 60; }
    const top = scopeAt(px, 3, 3, 0, -0.9), bottom = scopeAt(px, 3, 3, 0, 0.9);
    expect(Math.hypot(...top)).toBeGreaterThan(Math.hypot(...bottom));
  });
});
