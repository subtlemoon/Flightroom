import { describe, expect, it } from 'vitest';
import { WGSL } from './wgsl.gen.js';
import { PROGRAMS, sourceHash } from './programs.js';

// WGSL's uniform layout rules for the types the shaders use: [align, size].
const TYPES = { 'f32': [4, 4], 'i32': [4, 4], 'vec2<f32>': [8, 8], 'vec3<f32>': [16, 12], 'vec4<f32>': [16, 16], 'mat3x3<f32>': [16, 48] };

describe('WebGPU shaders (made by tools/wgsl.mjs)', () => {
  it('are made from the WebGL shaders as they are now', () => {
    for (const name of Object.keys(PROGRAMS)) expect(WGSL[name]?.hash, `${name}: run node tools/wgsl.mjs`).toBe(sourceHash(name));
  });

  it('put every uniform where the shader reads it', () => {
    for (const [name, e] of Object.entries(WGSL)) {
      const body = e.frag.match(/struct FrU \{([\s\S]*?)\n\}/)[1];
      let off = 0;
      for (const line of body.split('\n')) {
        const m = line.trim().match(/^(\w+): (.+),$/);
        if (!m) continue;
        const arr = m[2].match(/^array<.+, (\d+)u?>$/);
        const [align, size] = arr ? [16, 16 * +arr[1]] : TYPES[m[2]];
        off = Math.ceil(off / align) * align;
        // naga adds _ to names that clash with its own.
        const u = e.uniforms[m[1]] || e.uniforms[m[1].replace(/_$/, '')];
        expect(u?.[0], `${name}.${m[1]}`).toBe(off);
        off += size;
      }
      expect(e.size).toBeGreaterThanOrEqual(off);
    }
  });
});
