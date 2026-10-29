import { describe, expect, it } from 'vitest';
import { MAX_PADDED, tileGrid } from './export.js';
import { filterReach } from './filters.js';

// A box blur along a row (edges clamped), as one tile of the export draws it:
// only the pixels from x0 to x1 are there to read.
function boxBlur(row, x0, x1, r) {
  const out = [];
  for (let x = x0; x < x1; x++) {
    let sum = 0;
    for (let d = -r; d <= r; d++) sum += row[Math.min(x1 - 1, Math.max(x0, x + d))];
    out.push(sum / (2 * r + 1));
  }
  return out;
}

describe('export tiles', () => {
  it('a large-radius filter comes out the same across tile edges as in one piece', () => {
    const f = { type: 'box', radius: 1200 }; // needs 1,200 px around a tile: more than the old 1,024 px
    const EW = 9000;
    const row = Array.from({ length: EW }, (_, x) => (x * 7919) % 255); // detail everywhere
    const whole = boxBlur(row, 0, EW, f.radius);
    const { pad, tiles } = tileGrid(EW, 1, filterReach(f));
    expect(pad).toBeGreaterThanOrEqual(f.radius);
    expect(tiles.length).toBeGreaterThan(1);
    const joined = [];
    for (const [tx, , tw] of tiles) {
      const x0 = Math.max(0, tx - pad), x1 = Math.min(EW, tx + tw + pad);
      joined.push(...boxBlur(row, x0, x1, f.radius).slice(tx - x0, tx - x0 + tw));
    }
    expect(joined.length).toBe(EW);
    expect(Math.max(...joined.map((v, i) => Math.abs(v - whole[i])))).toBeLessThan(1e-9);
  });

  it('tiles cover the export once and stay within the graphics card limit', () => {
    for (const reach of [0, 300, 1024, 1500, 2800]) {
      const { pad, tiles } = tileGrid(9000, 6000, reach);
      expect(pad).toBe(Math.ceil(reach));
      const area = tiles.reduce((a, [, , w, h]) => a + w * h, 0);
      expect(area).toBe(9000 * 6000);
      for (const [, , w, h] of tiles) expect(Math.max(w, h) + 2 * pad).toBeLessThanOrEqual(MAX_PADDED);
    }
    // Up to 1,024 px of room, tiles stay 2048 px as before.
    expect(tileGrid(9000, 6000, 1024).tiles[0]).toEqual([0, 0, 2048, 2048]);
  });

  it('still exports effects reaching further than fits, with as much room as fits', () => {
    for (const [reach, max] of [[4000, MAX_PADDED], [1e9, MAX_PADDED], [1500, 2048]]) {
      const { pad, tiles } = tileGrid(9000, 6000, reach, max);
      expect(pad).toBe((max - 512) / 2);
      expect(tiles.reduce((a, [, , w, h]) => a + w * h, 0)).toBe(9000 * 6000);
      for (const [, , w, h] of tiles) expect(Math.max(w, h) + 2 * pad).toBeLessThanOrEqual(max);
    }
  });
});
