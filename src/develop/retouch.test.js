import { describe, expect, it } from 'vitest';
import { findSpotSource, inSelection, layersFromText, layersToText, opBounds, selectionBounds, strokeDabs } from './retouch.js';
import { defaults, fromXmp, isEdited, toXmp } from './params.js';

const asShot = { temp: 5500, tint: 0 };
const sel = { shapes: [{ mode: 'add', kind: 'rect', x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 }], invert: false, feather: 0 };
const layers = [{
  id: 'a', name: 'Layer 1', hidden: false, opacity: 80, blend: 'multiply',
  ops: [
    { id: 'o1', t: 'paint', color: [1, 0, 0], size: 0.01, hard: 80, opacity: 100, flow: 100, pts: [[0.123456, 0.2], [0.3, 0.4]], clip: sel },
    { id: 'o2', t: 'heal', size: 0.005, hard: 50, opacity: 100, flow: 100, pts: [[0.5, 0.5]], dx: 0.02, dy: -0.01, clip: sel },
    { id: 'o3', t: 'fill', color: [0, 0, 1], opacity: 100 },
  ],
}];

describe('retouch layers in the sidecar', () => {
  it('round-trip, sharing a selection used by several ops', () => {
    const back = layersFromText(layersToText(layers));
    expect(back).toHaveLength(1);
    expect(back[0].blend).toBe('multiply');
    expect(back[0].ops[0].pts[0][0]).toBeCloseTo(0.12346, 5);
    expect(back[0].ops[1].dx).toBe(0.02);
    expect(back[0].ops[0].clip).toEqual(sel);
    expect(back[0].ops[0].clip).toBe(back[0].ops[1].clip);
    expect(back[0].ops[2].clip).toBeUndefined();
  });

  it('travel with the develop settings', () => {
    const s = { ...defaults(asShot), layers };
    expect(isEdited(s, asShot)).toBe(true);
    const out = toXmp(s);
    expect(out.own.Layers.startsWith('z:')).toBe(true);
    expect(fromXmp({}, {}, asShot, { Layers: out.own.Layers }).layers[0].ops).toHaveLength(3);
    expect(toXmp(defaults(asShot)).own.Layers).toBe('');
  });

  it('bad text gives no layers', () => {
    expect(layersFromText('z:nonsense')).toEqual([]);
    expect(layersFromText('')).toEqual([]);
  });
});

describe('strokes', () => {
  it('dabs a quarter of the brush width apart', () => {
    const d = strokeDabs({ size: 0.01, pts: [[0, 0], [0.1, 0]] }, 1000, 500);
    // radius 10 px, step 5 px, 100 px long: 1 + 20 dabs
    expect(d.length / 4).toBe(21);
    expect(d[2]).toBe(10);
  });

  it('a box around the stroke, or the selection for a fill', () => {
    expect(opBounds({ t: 'paint', size: 0.01, pts: [[0.5, 0.5]] }, 1000, 1000)).toEqual([489, 489, 511, 511]);
    expect(opBounds({ t: 'fill', clip: sel }, 100, 100)).toEqual([10, 10, 50, 50]);
    expect(opBounds({ t: 'fill' }, 100, 100)).toBeNull();
  });
});

describe('selections', () => {
  it('add, subtract, intersect and invert', () => {
    const s = { shapes: [
      { mode: 'add', kind: 'rect', x0: 0, y0: 0, x1: 0.6, y1: 1 },
      { mode: 'sub', kind: 'ellipse', x0: 0.1, y0: 0.4, x1: 0.3, y1: 0.6 },
      { mode: 'add', kind: 'poly', pts: [[0.8, 0.1], [0.9, 0.1], [0.9, 0.2], [0.8, 0.2]] },
    ], invert: false, feather: 0 };
    expect(inSelection(s, 0.5, 0.5)).toBe(true);
    expect(inSelection(s, 0.2, 0.5)).toBe(false);
    expect(inSelection(s, 0.85, 0.15)).toBe(true);
    expect(inSelection(s, 0.7, 0.5)).toBe(false);
    expect(inSelection({ ...s, invert: true }, 0.7, 0.5)).toBe(true);
    expect(selectionBounds({ ...s, invert: true })).toBeNull();
    const and = { shapes: [s.shapes[0], { mode: 'and', kind: 'rect', x0: 0.5, y0: 0, x1: 1, y1: 1 }], invert: false };
    expect(inSelection(and, 0.55, 0.5)).toBe(true);
    expect(inSelection(and, 0.4, 0.5)).toBe(false);
    expect(selectionBounds(and)).toEqual([0.5, 0, 0.6, 1]);
  });
});

describe('spot healing', () => {
  it('copies from where the surroundings match', () => {
    // Left half dark, right half light, a light spot sitting in the dark half near the edge.
    const w = 200, h = 100;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = x < 100 ? 40 : 220;
      data.set([v, v, v, 255], ((h - 1 - y) * w + x) * 4);
    }
    const op = { t: 'spot', size: 4 / 200, pts: [[70 / 200, 50 / 100]] };
    const { dx } = findSpotSource(op, { data }, w, h);
    expect(70 + dx * w).toBeLessThan(96); // stays in the dark half
  });
});
