// Which graphics chip draws Develop, and how hard Develop leans on it.
// Weak built-in graphics (Intel Iris Xe / UHD, older AMD "Radeon Graphics")
// share the chip with the desktop and fell behind on full frames while a
// slider moved, so Windows reset the driver and the screen went black. They
// get lighter frames while dragging (half size, full when you let go) and
// gentle drawing (renderer.js GENTLE_BAND_PX). Capable built-in graphics
// (Intel Arc, Radeon 760M/780M/880M/890M, Snapdragon Adreno X) and graphics
// cards keep full quality all the time.

import { engineInfo, setGentleGraphics } from './gpu/engine.js';

export const GRAPHICS_KEY = 'flightroom-graphics';
export const GRAPHICS_MODES = ['auto', 'full', 'light'];

/** 'weak' | 'capable' | 'unknown' from the WebGL renderer string (ANGLE names the real chip). */
export function classifyGpu(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return 'unknown';
  // Software drawing: always light.
  if (/swiftshader|llvmpipe|basic render|software/.test(n)) return 'weak';
  if (/nvidia|geforce|quadro|rtx|gtx/.test(n)) return 'capable';
  if (/intel/.test(n)) {
    if (/\barc\b|arc\(tm\)/.test(n)) return 'capable';
    // Iris Xe, Iris Plus, UHD, HD Graphics, and the plain "Intel(R) Graphics" of
    // Meteor/Lunar Lake chips sold without the Arc name.
    return 'weak';
  }
  if (/amd|radeon|ati /.test(n)) {
    const m = n.match(/radeon[^0-9]*(\d{3,4})m\b/);
    if (m) return Number(m[1]) >= 760 && Number(m[1]) < 1000 ? 'capable' : 'weak';
    // "AMD Radeon(TM) Graphics" / Vega is the older built-in kind; a named card (RX ...) is separate.
    if (/radeon\(tm\) graphics|radeon graphics|vega/.test(n)) return 'weak';
    return 'capable';
  }
  if (/adreno/.test(n)) return /x\d|x1|adreno \(tm\) [7-9]\d\d/.test(n) ? 'capable' : 'weak';
  if (/apple/.test(n)) return 'capable';
  return 'unknown';
}

/** The chip WebView2 actually draws with (not just what's installed). */
export function webglRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(name || '');
  } catch { return ''; }
}

export function graphicsMode() {
  try { const m = localStorage.getItem(GRAPHICS_KEY); return GRAPHICS_MODES.includes(m) ? m : 'auto'; } catch { return 'auto'; }
}

let state = { renderer: '', kind: 'unknown', integrated: false };
let light = false;

/** Whether Develop is in the lighter mode (light frames while dragging, gentle drawing). */
export const lightGraphics = () => light;
export const graphicsState = () => ({ ...state, mode: graphicsMode(), light, engine: engineInfo() });

/** Lighter mode on weak graphics; unknown chips go by whether the computer has only built-in graphics. */
export function lightFor(mode, kind, integrated) {
  if (mode === 'full') return false;
  if (mode === 'light') return true;
  return kind === 'weak' || (kind === 'unknown' && !!integrated);
}

function apply() {
  light = lightFor(graphicsMode(), state.kind, state.integrated);
  setGentleGraphics(light);
}

/** Once at start: integrated = the computer has no graphics card with its own memory (ai.rs gpu_info). */
export function detectGraphics(integrated) {
  // WebGPU names the chip it draws with when it can; WebGL's name (ANGLE's) otherwise.
  const a = engineInfo().adapter;
  const renderer = a?.description || webglRenderer();
  state = { renderer, kind: classifyGpu(renderer), integrated: !!integrated };
  apply();
}

export function setGraphicsMode(mode) {
  try { localStorage.setItem(GRAPHICS_KEY, mode); } catch {}
  apply();
  window.dispatchEvent(new Event('graphics-mode'));
}
