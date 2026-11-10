// Makes the WebGPU shaders from the WebGL2 ones: every program in
// src/develop/gpu/programs.js is turned into Vulkan-style GLSL 4.50 (its
// uniforms in one block, textures and samplers apart, the pixel position in
// WebGL's terms), then into WGSL by naga, and written with its uniform layout
// to src/develop/gpu/wgsl.gen.js.
//
//   cargo install naga-cli   (once)
//   node tools/wgsl.mjs      (after changing any shader)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROGRAMS, sourceHash } from '../src/develop/gpu/programs.js';

const SIZES = { float: [4, 4], int: [4, 4], vec2: [8, 8], vec3: [16, 12], vec4: [16, 16], mat3: [16, 48] };
const TEXCALL = /\b(texture|texelFetch|textureLod|textureSize)\(\s*(\w+)\s*,/g;

/** WebGL2 GLSL ES 3.00 -> GLSL 4.50 for naga; also the uniform layout and texture list. */
function convert(src, stage, uniforms, textures) {
  let s = src.replace(/^#version 300 es\s*\n/, '').replace(/^\s*precision \w+ \w+;\s*$/gm, '');
  // Uniform declarations (all at the top level, one type per line).
  s = s.replace(/^[ \t]*uniform\s+(\w+)\s+([^;]+);/gm, (_, type, list) => {
    for (const part of list.split(',')) {
      const m = part.trim().match(/^(\w+)(?:\s*\[\s*(\d+)\s*\])?$/);
      if (!m) throw new Error(`can't read uniform ${part}`);
      const [, name, n] = m;
      if (type === 'sampler2D') { if (!textures.some((t) => t.name === name)) textures.push({ name }); continue; }
      if (!SIZES[type]) throw new Error(`uniform type ${type}`);
      if (!uniforms.some((u) => u.name === name)) uniforms.push({ name, type, count: n ? +n : 0 });
    }
    return '';
  });
  // Textures passed to functions: a texture parameter, read with a plain sampler.
  const params = new Set();
  s = s.replace(/\bsampler2D\s+(\w+)/g, (_, name) => { params.add(name); return `texture2D ${name}`; });
  s = s.replace(TEXCALL, (all, fn, name) => {
    const t = textures.find((x) => x.name === name);
    if (t) { if (fn === 'texture' || fn === 'textureLod') t.sampled = true; return `${fn}(sampler2D(${name}, ${name}_s),`; }
    if (params.has(name)) return `${fn}(sampler2D(${name}, frNearest),`;
    return all;
  });
  let loc = 0;
  if (stage === 'frag') {
    s = s.replace(/^\s*out\s+vec4\s+(\w+)\s*;/m, 'layout(location = 0) out vec4 $1;');
    s = s.replace(/^\s*in\s+(\w+)\s+(\w+)\s*;/gm, (_, t, n) => `layout(location = ${loc++}) in ${t} ${n};`);
    // WebGL's pixel position, y up from the bottom row of memory: a target's
    // rows are stored the same way in both, only the screen is flipped.
    s = s.replace(/\bgl_FragCoord\b/g, 'frFC');
    s = s.replace(/void\s+main\s*\(\s*\)\s*\{/, (m) => `${m}\n  frFC = vec4(gl_FragCoord.x, frFlip > 0.5 ? frH - gl_FragCoord.y : gl_FragCoord.y, gl_FragCoord.zw);`);
    s = `vec4 frFC;\n${s}`;
  } else {
    s = s.replace(/^\s*out\s+(\w+)\s+(\w+)\s*;/gm, (_, t, n) => `layout(location = ${loc++}) out ${t} ${n};`);
    s = s.replace(/\bgl_VertexID\b/g, 'gl_VertexIndex');
    // Into a target, WebGPU's clip space has y the other way round from WebGL's rows.
    s = s.replace(/(void\s+main\s*\(\s*\)\s*\{[\s\S]*)\}\s*$/, '$1  if (frFlip < 0.5) gl_Position.y = -gl_Position.y;\n}\n');
  }
  return s;
}

function header(uniforms, textures, params) {
  const members = uniforms.map((u) => `  ${u.type} ${u.name}${u.count ? `[${u.count}]` : ''};`).join('\n');
  let b = 1;
  const tex = textures.map((t) => {
    t.binding = b++; t.sampler = b++;
    return `layout(set = 0, binding = ${t.binding}) uniform texture2D ${t.name};\nlayout(set = 0, binding = ${t.sampler}) uniform sampler ${t.name}_s;`;
  }).join('\n');
  const near = params ? `layout(set = 0, binding = ${b++}) uniform sampler frNearest;\n` : '';
  return `#version 450\nlayout(set = 0, binding = 0, std140) uniform FrU {\n${members}\n  float frFlip;\n  float frH;\n};\n${tex}\n${near}`;
}

/** std140 offsets (bytes); the same as WGSL's for these types. */
function layout(uniforms) {
  let off = 0;
  for (const u of uniforms) {
    const [align, size] = SIZES[u.type];
    const a = u.count ? 16 : align;
    off = Math.ceil(off / a) * a;
    u.offset = off;
    off += u.count ? 16 * u.count : size;
  }
  return Math.ceil(off / 16) * 16;
}

const dir = mkdtempSync(join(tmpdir(), 'wgsl-'));
function naga(name, code, ext) {
  const i = join(dir, `${name}.${ext}.glsl`), o = join(dir, `${name}.${ext}.wgsl`);
  writeFileSync(i, code);
  try {
    execFileSync('naga', ['--input-kind', 'glsl', '--shader-stage', ext, i, o], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`${name} (${ext}):\n${e.stderr}\n----\n${code.split('\n').map((l, n) => `${n + 1}: ${l}`).join('\n')}`);
  }
  // Derivatives (fwidth, texture()) are used past branches on uniforms only.
  return `diagnostic(off, derivative_uniformity);\n${readFileSync(o, 'utf8')}`;
}

const out = {};
for (const [name, [vert, frag]] of Object.entries(PROGRAMS)) {
  const uniforms = [], textures = [];
  const custom = !/^\s*#version 300 es\s*in vec2 aPos;/.test(vert);
  const fragBody = convert(frag, 'frag', uniforms, textures);
  const vertBody = custom ? convert(vert, 'vert', uniforms, textures) : null;
  const usesNearest = /frNearest/.test(fragBody);
  // Uniforms in a stable order: the block is shared by both stages.
  const size = layout(uniforms);
  const flip = size, h = size + 4;
  const head = header(uniforms, textures, usesNearest);
  const entry = {
    hash: sourceHash(name),
    frag: naga(name, head + fragBody, 'frag'),
    size: Math.ceil((size + 8) / 16) * 16,
    uniforms: Object.fromEntries([...uniforms.map((u) => [u.name, [u.offset, u.type, u.count]]), ['frFlip', [flip, 'float', 0]], ['frH', [h, 'float', 0]]]),
    textures: textures.map((t) => [t.name, t.binding, t.sampler, !!t.sampled]),
    nearest: usesNearest ? 2 * textures.length + 1 : 0,
  };
  if (custom) entry.vert = naga(name, head + vertBody, 'vert');
  out[name] = entry;
}

writeFileSync(new URL('../src/develop/gpu/wgsl.gen.js', import.meta.url),
  `// Made by tools/wgsl.mjs from programs.js; don't edit.\n/* eslint-disable */\nexport const WGSL = ${JSON.stringify(out, null, 1)};\n`);
console.log(`${Object.keys(out).length} programs`);
