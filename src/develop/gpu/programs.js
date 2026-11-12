// Every shader program the Develop and Retouch renderers draw with, by name:
// [vertex, fragment] GLSL. WebGL2 compiles these as they are; WebGPU runs the
// WGSL made from them (tools/wgsl.mjs writes wgsl.gen.js).
import { VERT, GUIDE_DOWN, BLUR, CNR_DOWN, CNR_BLUR, FINAL, DISPLAY, COPY, RESAMPLE, GLOW_SRC, GLOW_DOWN, GLOW_LINE, GLOW_MIX } from '../shaders.js';
import { DAB_VERT, DAB_FRAG, OP, COVSEL, INSIDE, STRETCH, HEAL_L0, PULL, PUSH, ADJ, SHADE, INNER, STYLE, CLIPA, COMP } from '../compose-shaders.js';
import { BLUR_FRAG, FX_FRAG } from '../filters.js';

export const PROGRAMS = {
  down: [VERT, GUIDE_DOWN], blur: [VERT, BLUR], cnrDown: [VERT, CNR_DOWN], cnrBlur: [VERT, CNR_BLUR], final: [VERT, FINAL], copy: [VERT, COPY], resample: [VERT, RESAMPLE], display: [VERT, DISPLAY],
  glowSrc: [VERT, GLOW_SRC], glowDown: [VERT, GLOW_DOWN], glowLine: [VERT, GLOW_LINE], glowMix: [VERT, GLOW_MIX],
  dab: [DAB_VERT, DAB_FRAG], op: [VERT, OP], covsel: [VERT, COVSEL], inside: [VERT, INSIDE], healL0: [VERT, HEAL_L0], pull: [VERT, PULL],
  push: [VERT, PUSH], comp: [VERT, COMP], adj: [VERT, ADJ], fxBlur: [VERT, BLUR_FRAG], fx: [VERT, FX_FRAG], shade: [VERT, SHADE],
  style: [VERT, STYLE], inner: [VERT, INNER], clipa: [VERT, CLIPA], stretch: [VERT, STRETCH],
};

/** A short fingerprint of a program's source, so a stale wgsl.gen.js is caught (gpu.test.js). */
export function sourceHash(name) {
  const s = PROGRAMS[name].join('\n');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
