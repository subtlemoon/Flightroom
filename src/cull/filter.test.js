import { describe, expect, it } from 'vitest';
import { inFilter } from './filter.js';

describe('culling filters', () => {
  it('filters by rated and unrated', () => {
    expect(inFilter('rated', 3)).toBe(true);
    expect(inFilter('rated', 0)).toBe(false);
    expect(inFilter('unrated', 0)).toBe(true);
    expect(inFilter('all', 0)).toBe(true);
  });

  it('filters by stars, at least or exactly', () => {
    expect([1, 2, 3, 4, 5].filter((r) => inFilter('stars:3+', r))).toEqual([3, 4, 5]);
    expect([1, 2, 3, 4, 5].filter((r) => inFilter('stars:2', r))).toEqual([2]);
    expect(inFilter('stars:1+', 0)).toBe(false);
  });
});
