import { describe, expect, it } from 'vitest';
import {
  IDENT, colorSelect, inSelection, isIdent, layersFromText, layersToText, modifyValues, moveSelection, newLayer, renderLayers,
  selectionBounds, tfAbout, tfInv, tfMul, tfPx, tfUnits,
} from './retouch.js';
import { adjustmentLut, adjustmentUniforms, curveTable, newAdjustment, ADJUSTMENTS } from './adjust.js';
import { FILTERS, filterPlan, filterReach, newFilter } from './filters.js';
import { flattenTree, layerTree } from '../components/retouch.jsx';

describe('transforms', () => {
  it('turn about a point and back', () => {
    const m = tfAbout(100, 50, 2, 2, 90);
    const back = tfMul(tfInv(m), m);
    back.forEach((v, i) => expect(v).toBeCloseTo(IDENT[i], 9));
    expect(isIdent(tfUnits(tfPx(IDENT, 300, 200), 300, 200))).toBe(true);
  });
  it('a moved selection moves its hit test', () => {
    const sel = { shapes: [{ kind: 'rect', mode: 'add', x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 }], invert: false, feather: 0 };
    const moved = moveSelection(sel, 0.5, 0.5, 400, 200);
    expect(inSelection(moved, 0.15, 0.15, 400, 200)).toBe(false);
    expect(inSelection(moved, 0.65, 0.65, 400, 200)).toBe(true);
    const b = selectionBounds(moved, 400, 200);
    expect(b[0]).toBeCloseTo(0.6, 6);
    expect(b[3]).toBeCloseTo(0.7, 6);
  });
});

describe('selections from pixels', () => {
  const w = 10, h = 10;
  const rgb = new Uint8Array(w * h * 3);
  // A red square in the middle of grey, and a lone red pixel in a corner.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const red = (x >= 3 && x <= 6 && y >= 3 && y <= 6) || (x === 0 && y === 0);
    rgb.set(red ? [220, 20, 20] : [120, 120, 120], (y * w + x) * 3);
  }
  const img = { w, h, rgb };
  it('magic wand: contiguous or everywhere', () => {
    const near = colorSelect(img, [[4, 4]], 20, true);
    expect(near.filter((v) => v).length).toBe(16);
    expect(near[0]).toBe(0);
    const all = colorSelect(img, [[4, 4]], 20, false);
    expect(all.filter((v) => v).length).toBe(17);
  });
  it('expand and contract', () => {
    const v = colorSelect(img, [[4, 4]], 20, true);
    const big = modifyValues(v, w, h, 'expand', 1), small = modifyValues(v, w, h, 'contract', 1);
    expect(big.filter((x) => x >= 128).length).toBeGreaterThan(16);
    expect(small.filter((x) => x >= 128).length).toBeLessThan(16);
  });
});

describe('adjustment layers', () => {
  it('every kind has defaults and shader settings', () => {
    for (const [type] of ADJUSTMENTS) {
      const a = newAdjustment(type);
      expect(a.type).toBe(type);
      expect(adjustmentUniforms(a).p).toHaveLength(48);
    }
  });
  it('curves through the corners leave colours alone', () => {
    const t = curveTable([[0, 0], [255, 255]]);
    expect(t[0]).toBe(0);
    expect(t[128]).toBeCloseTo(128 / 255, 5);
    const lut = adjustmentLut(newAdjustment('curves'));
    expect(lut[128 * 4]).toBe(128);
  });
  it('levels: a raised black point', () => {
    const a = newAdjustment('levels');
    a.rgb.in0 = 50;
    const lut = adjustmentLut(a);
    expect(lut[40 * 4]).toBe(0);
    expect(lut[255 * 4]).toBe(255);
  });
});

describe('filters', () => {
  it('every filter has a plan and a reach', () => {
    for (const [, type] of FILTERS) {
      const f = newFilter(type, { center: [0.5, 0.5], rad: 0.3, seed: 1 });
      expect(f.on).toBe(true);
      expect(filterPlan(f)).toBeTruthy();
      expect(Number.isFinite(filterReach(f))).toBe(true);
    }
  });
});

describe('layers', () => {
  const g = newLayer([], 'Group 1', 'group');
  const a = newLayer([], 'A', 'pixel', { parent: g.id, ops: [{ id: 'o', t: 'fill', color: [1, 0, 0], opacity: 100 }] });
  const b = newLayer([], 'B', 'adjust', { adj: newAdjustment('invert'), clip: true, parent: g.id });
  const c = newLayer([], 'C', 'text', { text: { text: 'hi', size: 0.05, x: 0.1, y: 0.1, color: [1, 1, 1], font: 'Arial' } });
  const layers = [a, b, g, c];
  it('a tree and back', () => {
    const tree = layerTree(layers);
    expect(tree.map((n) => n.l.name)).toEqual(['C', 'Group 1']);
    expect(tree[1].kids.map((n) => n.l.name)).toEqual(['B', 'A']);
    expect(flattenTree(tree).map((l) => l.name)).toEqual(['A', 'B', 'Group 1', 'C']);
  });
  it('a hidden group hides its layers; a group fades them', () => {
    expect(renderLayers(layers).map((l) => l.name)).toEqual(['A', 'B', 'C']);
    expect(renderLayers([a, b, { ...g, hidden: true }, c]).map((l) => l.name)).toEqual(['C']);
    expect(renderLayers([a, b, { ...g, opacity: 50 }, c])[0].opacity).toBe(50);
    // Clipped to a hidden layer: not drawn.
    expect(renderLayers([{ ...a, hidden: true }, b, g, c]).map((l) => l.name)).toEqual(['C']);
  });
  it('keep everything in the sidecar', () => {
    const rich = [{ ...a, mask: { base: 1, ops: [], density: 80, feather: 0.01 }, filters: [newFilter('gaussian', { id: 'f' })], style: { shadow: { on: true, distance: 0.01 } }, tf: [1, 0, 0.1, 0, 1, 0] }, b, g, c];
    const back = layersFromText(layersToText(rich));
    expect(back).toHaveLength(4);
    expect(back[0].mask.density).toBe(80);
    expect(back[0].filters[0].type).toBe('gaussian');
    expect(back[0].style.shadow.on).toBe(true);
    expect(back[0].tf[2]).toBeCloseTo(0.1, 5);
    expect(back[1].clip).toBe(true);
    expect(back[2].kind).toBe('group');
    expect(back[3].text.text).toBe('hi');
  });
});
