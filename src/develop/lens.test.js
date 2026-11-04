import { describe, expect, it } from 'vitest';
import { Geometry, lensWarp, sourceMap } from './renderer.js';

// JWL_7345.NEF: Z 7II, NIKKOR Z 24-70mm f/4 S at 56 mm (src-tauri lens.rs).
const lens = { k: [0.0511856, -0.0128775, 0.0194006], q: 0.0794115, dx: 9.29, dy: -27.69, required: true };

describe('camera lens correction', () => {
  it('applies to Z lenses always, to others with profile corrections on', () => {
    expect(new Geometry(8256, 5504, 1, lens).lensFor({})).not.toBeNull();
    expect(new Geometry(8256, 5504, 1, { ...lens, required: false }).lensFor({})).toBeNull();
    expect(new Geometry(8256, 5504, 1, { ...lens, required: false }).lensFor({ lensProfile: true })).not.toBeNull();
    expect(new Geometry(8256, 5504, 1, null).lensFor({ lensProfile: true })).toBeNull();
  });
  it('zooms in to fill the frame and keeps the corners inside the photo', () => {
    const g = new Geometry(8256, 5504, 1, lens), L = g.lensFor({});
    const [cx, cy] = L.c;
    const [x, y] = lensWarp(L, [cx + 0.1, cy]);
    expect(x - cx).toBeCloseTo(0.1 / 1.0794, 3); // about the centre: just the zoom
    expect(y).toBeCloseTo(cy, 6);
    const map = sourceMap(g, {});
    for (const [ox, oy] of [[0, 0], [8256, 0], [0, 5504], [8256, 5504]]) {
      const [px, py] = map(ox, oy);
      expect(px).toBeGreaterThan(0); expect(px).toBeLessThan(1);
      expect(py).toBeGreaterThan(0); expect(py).toBeLessThan(1);
    }
  });
  it('is the identity without one', () => {
    const map = sourceMap(new Geometry(8256, 5504, 1), {});
    const [px, py] = map(1000, 2000);
    expect(px).toBeCloseTo(1000 / 8256, 9); expect(py).toBeCloseTo(2000 / 5504, 9);
  });
});
