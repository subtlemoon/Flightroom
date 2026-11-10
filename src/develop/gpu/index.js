// Drawing devices for the renderer: WebGPU's when the engine has a device (engine.js), else WebGL2's.
import { GLDevice } from './gl.js';
import { GPUDev } from './webgpu.js';
import { BAND_PX, GENTLE_BAND_PX, engineRestoring, gentleGraphics, gpuDevice } from './engine.js';

export * from './engine.js';

/**
 * A drawing device for a canvas. onScreen: shown on the page (its picture is
 * kept between frames). WebGPU unless there is none, or forceGl.
 */
export function createDevice(canvas, { onScreen = false, forceGl = false } = {}) {
  const device = gpuDevice();
  if (device && !forceGl) return new GPUDev(device, canvas, { onScreen, bands: () => (gentleGraphics() ? GENTLE_BAND_PX : BAND_PX), gentle: gentleGraphics });
  if (engineRestoring() && !forceGl) throw new Error('The graphics card was reset and isn\'t drawing photos right now');
  return new GLDevice(canvas, { onScreen, bands: () => (gentleGraphics() ? GENTLE_BAND_PX : BAND_PX), gentle: gentleGraphics });
}

