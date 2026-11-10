import { describe, expect, it } from 'vitest';
import { filesOf, inOrder, shotAt } from './order.js';

const P = (id, size, modified, extra = {}) => ({ id, name: id, raw: `${id}.NEF`, sidecar: `${id}.xmp`, size, modified, ...extra });

describe('inOrder', () => {
  const photos = [P('a', 30, 3000), P('b', 10, 1000), P('c', 20, 2000)];
  it('keeps the folder order by name', () => expect(inOrder(photos, 'name')).toBe(photos));
  it('sorts by date both ways', () => {
    expect(inOrder(photos, 'oldest').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(inOrder(photos, 'newest').map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('sorts by size both ways', () => {
    expect(inOrder(photos, 'largest').map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(inOrder(photos, 'smallest').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('keeps equal photos in folder order, either way', () => {
    const burst = [P('a', 5, 1000), P('b', 5, 1400), P('c', 5, 1900)];
    expect(inOrder(burst, 'newest').map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(inOrder(burst, 'largest').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
  it('uses the camera time once it is known', () => {
    const meta = { a: { takenAt: '2026:10:17 14:03:22' }, b: { takenAt: '2026:10:17 14:03:25' } };
    expect(inOrder([P('b', 1, 0), P('a', 1, 9e15)], 'oldest', meta).map((p) => p.id)).toEqual(['a', 'b']);
    expect(shotAt(P('a', 1, 5500))).toBe(5);
  });
});

describe('filesOf', () => {
  it('lists a photo with its JPEG, sidecar and the sidecars of its copies', () => {
    const a = P('a', 1, 1, { jpeg: 'a.JPG' });
    const copy = { ...a, id: 'a|copy-1', sidecar: 'a (copy 1).xmp', copy: 1 };
    const b = P('b', 1, 1);
    expect(filesOf([a], [a, copy, b]).sort()).toEqual(['a (copy 1).xmp', 'a.JPG', 'a.NEF', 'a.xmp']);
  });
  it('lists only its own sidecar for a virtual copy', () => {
    const a = P('a', 1, 1);
    const copy = { ...a, id: 'a|copy-1', sidecar: 'a (copy 1).xmp', copy: 1 };
    expect(filesOf([copy], [a, copy])).toEqual(['a (copy 1).xmp']);
  });
});
