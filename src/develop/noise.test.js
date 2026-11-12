import { describe, expect, it } from 'vitest';
import { noiseModel, NOISE_LO, NOISE_STEP } from './noise.js';

// Half float bits of a number (enough precision for the test).
const toHalf = (v) => {
  const f = new Float32Array([v]), i = new Uint32Array(f.buffer)[0];
  const s = (i >> 16) & 0x8000, e = ((i >> 23) & 0xff) - 127 + 15, m = (i >> 13) & 0x3ff;
  if (e <= 0) return s; // tiny values -> 0 (not needed here)
  return s | (e << 10) | m;
};

describe('noiseModel', () => {
  it('finds the colour noise of a flat grey patch, not its brightness', () => {
    const w = 400, h = 300, data = new Uint16Array(w * h * 3);
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const sd = 0.004, level = 2 ** (NOISE_LO + 4 * NOISE_STEP); // bin 4
    for (let i = 0; i < w * h * 3; i++) data[i] = toHalf(level + sd * gauss());
    const n = noiseModel({ w, h, data }, [1, 1, 1], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // Offset from grey of an identity camera: r - y with y = 0.2126 r + 0.7152 g + 0.0722 b.
    const vr = sd * sd * ((1 - 0.2126) ** 2 + 0.7152 ** 2 + 0.0722 ** 2);
    const vb = sd * sd * (0.2126 ** 2 + 0.7152 ** 2 + (1 - 0.0722) ** 2);
    expect(n[4]).toBeGreaterThan(((vr + vb) / 2) * 0.8);
    expect(n[4]).toBeLessThan(((vr + vb) / 2) * 1.25);
    // Bins with no pixels take the nearest measured one.
    expect(n[0]).toBe(n[4]);
    expect(n[7]).toBe(n[4]);
  });
});
