import { describe, expect, it } from 'vitest';
import { BUILTIN_LOOKS, HUE_ROWS, LOOK_W, applyLook, lookName, lookTable, packLook } from './looks.js';
import { readCube } from './adjust.js';
import { defaults, fromXmp, toXmp } from './params.js';

const cube = (n, f) => {
  const lines = [`LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lines.push(f(r / (n - 1), g / (n - 1), b / (n - 1)).join(' '));
  return lines.join('\n');
};

describe('looks', () => {
  it('an identity LUT leaves colours alone, between its points too', () => {
    const t = readCube(cube(5, (r, g, b) => [r, g, b]));
    for (const c of [[0.1, 0.5, 0.9], [0.33, 0.33, 0.8], [1, 0, 0.5], [0.71, 0.2, 0.2]]) {
      applyLook(t, c).forEach((v, i) => expect(v).toBeCloseTo(c[i], 5));
    }
  });

  it('follows the table: a swap of red and blue', () => {
    const t = readCube(cube(9, (r, g, b) => [b, g, r]));
    const out = applyLook(t, [0.8, 0.4, 0.1]);
    expect(out[0]).toBeCloseTo(0.1, 5);
    expect(out[2]).toBeCloseTo(0.8, 5);
  });

  it('builds every built-in look in range, and the mono ones grey', () => {
    for (const [id, name, group] of BUILTIN_LOOKS) {
      const t = lookTable(id);
      expect(t.values.every((v) => v >= 0 && v <= 1)).toBe(true);
      expect(lookName(id)).toBe(name);
      if (group === 'B&W') {
        const [r, g, b] = applyLook(t, [0.9, 0.2, 0.1]);
        expect(Math.abs(r - b)).toBeLessThan(0.05);
        expect(Math.abs(r - g)).toBeLessThan(0.05);
      }
    }
  });

  it('fits a 65³ table in the mixer texture', () => {
    const n = 65;
    const { rows, data } = packLook({ n, values: new Float32Array(n * n * n * 3) });
    expect(rows + 1).toBeLessThanOrEqual(HUE_ROWS);
    expect(data.length).toBe(LOOK_W * rows * 4);
  });

  it('round-trips the look and its amount through the sidecar, and leaves them out without one', () => {
    const asShot = { temp: 5500, tint: 0 };
    const s = { ...defaults(asShot), look: 'user:Kodak-ish.cube', lookAmount: 140 };
    const x = toXmp(s);
    expect(x.own.Look).toBe('user:Kodak-ish.cube');
    expect(x.own.LookAmount).toBe('140');
    const back = fromXmp(x.set, null, asShot, x.own);
    expect(back.look).toBe('user:Kodak-ish.cube');
    expect(back.lookAmount).toBe(140);
    const none = toXmp(defaults(asShot));
    expect(none.own.Look).toBe('');
    expect(none.own.LookAmount).toBe('');
  });
});
