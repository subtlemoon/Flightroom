import { describe, it, expect } from 'vitest';
import { classifyGpu, lightFor } from './graphics.js';

describe('classifyGpu', () => {
  const cases = [
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'weak'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'weak'],
    ['ANGLE (Intel, Intel(R) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'weak'],
    ['ANGLE (Intel, Intel(R) Arc(TM) 140T GPU (16GB) (0x00007D51) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (AMD, AMD Radeon 780M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (AMD, AMD Radeon(TM) 890M Graphics (0x0000150E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'weak'],
    ['ANGLE (AMD, AMD Radeon 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'weak'],
    ['ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'capable'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'weak'],
    ['', 'unknown'],
  ];
  for (const [name, kind] of cases) it(`${kind}: ${name.slice(0, 50)}`, () => expect(classifyGpu(name)).toBe(kind));
});

describe('lightFor', () => {
  it('follows the chip in auto', () => {
    expect(lightFor('auto', 'weak', false)).toBe(true);
    expect(lightFor('auto', 'capable', true)).toBe(false);
    expect(lightFor('auto', 'unknown', true)).toBe(true);
    expect(lightFor('auto', 'unknown', false)).toBe(false);
  });
  it('obeys the setting', () => {
    expect(lightFor('full', 'weak', true)).toBe(false);
    expect(lightFor('light', 'capable', false)).toBe(true);
  });
});
