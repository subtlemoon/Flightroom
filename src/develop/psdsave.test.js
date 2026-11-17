import { describe, expect, it } from 'vitest';
import { saveDrawList, saveSpecs } from './psdsave.js';
import { newLayer } from './retouch.js';

describe('saving a Retouch document', () => {
  const a = { ...newLayer([]), id: 'a' };
  const g = { ...newLayer([]), id: 'g', kind: 'group', mask: { base: 1, ops: [] } };
  const b = { ...newLayer([]), id: 'b', parent: 'g', hidden: true };
  it('writes groups as Photoshop does: end marker, layers, then the group', () => {
    const specs = saveSpecs([a, b, g], 'doc|10x10');
    expect(specs.map((s) => s.t)).toEqual(['layer', 'end', 'layer', 'group']);
    expect(specs[3].maskKey).toBeTruthy();
    expect(specs[2].hidden).toBe(true);
  });
  it('keys pixels by what they depend on', () => {
    const one = saveSpecs([a], 'doc|10x10')[0].key;
    expect(saveSpecs([{ ...a, opacity: 50, name: 'x' }], 'doc|10x10')[0].key).toBe(one);
    expect(saveSpecs([a], 'other|10x10')[0].key).not.toBe(one);
    expect(saveSpecs([{ ...a, ops: [{ t: 'fill', color: [1, 0, 0] }] }], 'doc|10x10')[0].key).not.toBe(one);
  });
  it('draws hidden layers too, marked', () => {
    const list = saveDrawList([{ ...a, ops: [{ t: 'fill', color: [1, 0, 0] }] }, { ...b, parent: null, ops: [{ t: 'fill', color: [0, 1, 0] }] }]);
    expect(list.map((l) => !!l._ghost)).toEqual([false, true]);
  });
});
