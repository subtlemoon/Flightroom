import { describe, expect, it } from 'vitest';
import { fileOf, withCopy } from './copies.js';
import { fromMenuBar, tidy } from '../components/menu.jsx';

describe('virtual copies', () => {
  it('finds the photo file behind a copy id', () => {
    expect(fileOf('C:\\a\\JWL_1.NEF|copy-2')).toBe('C:\\a\\JWL_1.NEF');
    expect(fileOf('C:\\a\\JWL_1.NEF')).toBe('C:\\a\\JWL_1.NEF');
  });
  it('puts a new copy after its photo and its other copies', () => {
    const list = [{ id: 'a.NEF' }, { id: 'a.NEF|copy-1' }, { id: 'b.NEF' }];
    expect(withCopy(list, { id: 'a.NEF|copy-2' }).map((p) => p.id)).toEqual(['a.NEF', 'a.NEF|copy-1', 'a.NEF|copy-2', 'b.NEF']);
    expect(withCopy(list, { id: 'b.NEF|copy-1' }).map((p) => p.id)).toEqual(['a.NEF', 'a.NEF|copy-1', 'b.NEF', 'b.NEF|copy-1']);
  });
});

describe('right-click menus', () => {
  it('drops empty entries and extra dividers', () => {
    expect(tidy(['-', false, { label: 'A' }, '-', '-', null, { label: 'B', items: ['-', { label: 'C' }, '-'] }, '-'])).toEqual([
      { label: 'A' }, '-', { label: 'B', items: [{ label: 'C' }] },
    ]);
  });
  it('reads commands from a menu bar by path', () => {
    const run = () => {};
    const bar = [{ label: 'Layer', items: [{ label: 'Delete', items: [{ label: 'Layer', key: 'Del', run }] }, null, { label: 'Lock', check: true, run }] }];
    const [del, sep, lock, missing] = fromMenuBar(bar, [['Layer/Delete/Layer', 'Delete Layer'], '-', 'Layer/Lock', 'Layer/Nope']);
    expect(del).toMatchObject({ label: 'Delete Layer', hint: 'Del', onClick: run });
    expect(sep).toBe('-');
    expect(lock.checked).toBe(true);
    expect(missing).toBeUndefined();
  });
});
