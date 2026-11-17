import { describe, expect, it } from 'vitest';
import { cameraTransform, lookFor } from './renderer.js';
import { adobeRendering } from './adobe.js';
import { inv3 } from './color.js';
import { defaults } from './params.js';
import { maskFrom, psdLayers, vectorMask } from './psdlayers.js';

// sRGB's primaries as ICC profiles state them (D50), as the desktop side sends them (icc.rs).
const SRGB_XYZ = [0.43607, 0.38515, 0.14307, 0.22249, 0.71687, 0.06061, 0.01392, 0.09708, 0.71410];
const info = { rendered: true, asShot: [1, 1, 1], matrices: [[5003, inv3(SRGB_XYZ)]], width: 100, height: 100, orientation: 1 };

describe('pictures that are not RAW files', () => {
  it('come out as they are at the defaults', () => {
    const s = { ...defaults({ temp: 5003, tint: 0 }), wb: 'As Shot' };
    expect(adobeRendering(info, s.profile)).toBeNull();
    expect(lookFor(info, s)).toMatchObject({ exposure: 0, contrast: 0, saturation: 1, baseSat: 1 });
    const { wb, matrix } = cameraTransform(info, s);
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => matrix[r * 3 + c] * wb[c]));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) expect(m[r][c]).toBeCloseTo(r === c ? 1 : 0, 2);
  });
});

describe('Photoshop layers', () => {
  const psd = {
    layers: [
      { index: 1, name: 'Photo', kind: 'image', rect: [0, 0, 0.5, 0.5], size: [50, 50], blend: 'multiply', opacity: 80, fill: 100, hidden: false, clip: false, parent: 'g0' },
      { index: 2, name: 'Levels 1', kind: 'adjust', adj: { type: 'levels', ch: 'rgb', rgb: { in0: 10, in1: 240, out0: 0, out1: 255, gamma: 1.2 } }, blend: 'normal', opacity: 100, fill: 100, clip: true, parent: 'g0',
        mask: { rect: [0, 0, 1, 1], size: [4, 1], default: 0, off: false } },
      { index: 3, name: 'Group 1', kind: 'group', id: 'g0', blend: 'pass', opacity: 100, fill: 100, hidden: true, parent: null },
      { index: 4, name: 'Color Fill 1', kind: 'fill', color: [1, 0, 0], blend: 'normal', opacity: 100, fill: 50 },
      { index: 5, name: 'Colorize', kind: 'adjust', adj: { type: 'hsl', hue: 200, sat: 25, light: 0, colorize: true }, blend: 'normal', opacity: 100, fill: 100 },
    ],
  };
  it('become Retouch layers in the same order and groups', async () => {
    const layers = await psdLayers(psd, async () => ({ w: 4, h: 1, px: new Uint8Array([0, 255, 255, 0]) }));
    expect(layers.map((l) => l.kind)).toEqual(['image', 'adjust', 'group', 'fill', 'adjust']);
    const [img, lev, grp, fill, hue] = layers;
    expect(img.parent).toBe(grp.id);
    expect(lev.parent).toBe(grp.id);
    expect(img.image).toMatchObject({ src: 'psd:1', w: 50, h: 50, x1: 0.5 });
    expect(img.blend).toBe('multiply');
    expect(lev.clip).toBe(true);
    expect(lev.adj.r).toBeTruthy(); // Retouch's defaults fill in what the file didn't say
    expect(lev.adj.rgb.gamma).toBe(1.2);
    expect(lev.mask.base).toBe(0);
    expect(lev.mask.ops[0].clip.shapes[0].kind).toBe('bitmap');
    expect(grp.hidden).toBe(true);
    expect(fill.fillDef).toEqual({ type: 'solid', color: [1, 0, 0] });
    expect(fill.fill).toBe(50);
    expect(hue.adj.hue).toBe(-160);
  });
  it('masks that show outside their rectangle hide what is black inside it', () => {
    const m = maskFrom({ rect: [0.25, 0, 0.75, 1], default: 255 }, { w: 2, h: 1, px: new Uint8Array([0, 255]) });
    expect(m.base).toBe(1);
    expect(m.ops[0].color).toEqual([0, 0, 0]);
    expect(maskFrom({ rect: [0, 0, 1, 1], default: 0, off: true }, null)).toEqual({ base: 0, ops: [], off: true });
    const v = vectorMask({ invert: false, paths: [[[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]]] });
    expect(v.base).toBe(0);
    expect(v.ops[0].clip.shapes[0]).toMatchObject({ kind: 'poly', mode: 'add' });
  });
});
