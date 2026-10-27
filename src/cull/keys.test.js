import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING_KEYS, assignKey, ratingForKey } from './keys.js';

describe('rating keys', () => {
  it('maps the default number keys', () => {
    expect(ratingForKey(DEFAULT_RATING_KEYS, '3')).toBe(3);
    expect(ratingForKey(DEFAULT_RATING_KEYS, '0')).toBe(0);
    expect(ratingForKey(DEFAULT_RATING_KEYS, 'x')).toBe(undefined);
  });

  it('swaps when a key is already used', () => {
    const keys = assignKey(DEFAULT_RATING_KEYS, 1, '5');
    expect(keys[1]).toBe('5');
    expect(keys[5]).toBe('1');
  });

  it('ignores letter case', () => {
    const keys = assignKey(DEFAULT_RATING_KEYS, 2, 'Q');
    expect(ratingForKey(keys, 'q')).toBe(2);
    expect(ratingForKey(keys, 'Q')).toBe(2);
  });
});
