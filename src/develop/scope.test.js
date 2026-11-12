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
    const px = new Uint8Array([200, 60, 50, 255]); // a red in Melissa RGB
    const dist = (sp) => { const g = scopeGrid(px, sp, 200); const k = g.count.indexOf(Math.max(...g.count)); return Math.hypot((k % 200) - 99.5, Math.floor(k / 200) - 99.5); };
    expect(dist('srgb')).toBeGreaterThan(dist('adobe'));
    expect(dist('adobe')).toBeGreaterThan(dist('prophoto'));
    const grey = scopeGrid(new Uint8Array([128, 128, 128, 255]), 'srgb', 100);
    let sx = 0, sy = 0, sw = 0;
    grey.count.forEach((c, k) => { sx += c * (k % 100); sy += c * Math.floor(k / 100); sw += c; });
    expect([sx / sw, sy / sw]).toEqual([49.5, 49.5]); // the centre, between the middle four cells
  });
});
