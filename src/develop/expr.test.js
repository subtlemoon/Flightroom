import { describe, expect, it } from 'vitest';
import { evalNumber } from './expr.js';

describe('typed maths in number fields', () => {
  it('works out plain numbers and expressions', () => {
    expect(evalNumber('42')).toBe(42);
    expect(evalNumber('+0.50')).toBe(0.5);
    expect(evalNumber('-12')).toBe(-12);
    expect(evalNumber('1920/2')).toBe(960);
    expect(evalNumber('(30+15)*2')).toBe(90);
    expect(evalNumber('2^3^2')).toBe(512);
    expect(evalNumber('2**3')).toBe(8);
    expect(evalNumber('10 % 4')).toBe(2);
    expect(evalNumber('1e3')).toBe(1000);
    expect(evalNumber('pi')).toBeCloseTo(Math.PI);
    expect(evalNumber('5,500K')).toBe(5500);
    expect(evalNumber('0,5')).toBe(0.5);
    expect(evalNumber('25 px')).toBe(25);
    expect(evalNumber('50%')).toBe(50);
  });
  it('rejects anything else', () => {
    for (const t of ['', 'abc', '1/0', '2+', '(1', 'alert(1)', '1 2']) expect(evalNumber(t)).toBeNaN();
  });
});
