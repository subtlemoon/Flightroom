import { describe, expect, it } from 'vitest';
import { distance, exposure, fingerprint, sharpness, suggest } from './analyze.js';

// A 160x120 test image: a checkerboard of `size`-pixel squares, optionally box-blurred.
function image(size, blur = 0, base = 0) {
  const w = 160, h = 120;
  let g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = base + ((Math.floor(x / size) + Math.floor(y / size)) % 2 ? 200 : 40);
  for (let pass = 0; pass < blur; pass++) {
    const n = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[(y + dy) * w + x + dx];
      n[y * w + x] = s / 9;
    }
    g = n;
  }
  return { gray: Uint8ClampedArray.from(g), w, h };
}

describe('auto-rate measurements', () => {
  it('scores a sharp image above a blurred copy', () => {
    const sharp = image(8);
    const soft = image(8, 4);
    expect(sharpness(sharp.gray, sharp.w, sharp.h)).toBeGreaterThan(sharpness(soft.gray, soft.w, soft.h) * 3);
  });

  it('measures clipped highlights', () => {
    const e = exposure(Uint8ClampedArray.from([255, 255, 128, 0]));
    expect(e.clipHi).toBe(0.5);
    expect(e.clipLo).toBe(0.25);
  });

  it('gives near-identical images near-identical fingerprints', () => {
    const a = image(20), b = image(20, 1), c = image(7);
    expect(distance(fingerprint(a.gray, a.w, a.h), fingerprint(b.gray, b.w, b.h))).toBeLessThan(8);
    expect(distance(fingerprint(a.gray, a.w, a.h), fingerprint(c.gray, c.w, c.h))).toBeGreaterThan(8);
  });
});

describe('auto-rate suggestions', () => {
  const m = (sharp, hash, extra = {}) => ({ sharp, hash, clipHi: 0, clipLo: 0, mean: 120, ...extra });
  const h1 = '0'.repeat(64), h2 = '1'.repeat(64);

  it('keeps the sharpest of a burst and marks the rest as likely rejects', () => {
    const items = [
      { id: 'a', name: 'A', m: m(500, h1), takenAt: '2026:10:17 13:05:45' },
      { id: 'b', name: 'B', m: m(900, h1), takenAt: '2026:10:17 13:05:45' },
      { id: 'c', name: 'C', m: m(400, h1), takenAt: '2026:10:17 13:05:46' },
      { id: 'd', name: 'D', m: m(700, h2), takenAt: '2026:10:17 13:09:00' },
    ];
    const s = suggest(items);
    expect(s.b.stars).toBeGreaterThan(1);
    expect(s.a.stars).toBe(1);
    expect(s.c.stars).toBe(1);
    expect(s.a.reasons[0]).toMatch(/Similar to B/);
    expect(s.d.stars).toBeGreaterThan(1);
  });

  it('marks blurry shots as likely rejects and never suggests 5 stars', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, m: m(i === 0 ? 50 : 600 + i * 50, i % 2 ? h1 : h2), takenAt: `2026:10:17 13:${10 + i}:00` }));
    const s = suggest(items);
    expect(s.p0.stars).toBe(1);
    expect(s.p0.reasons).toContain('Soft or blurry');
    expect(Math.max(...Object.values(s).map((x) => x.stars))).toBe(4);
  });
});
