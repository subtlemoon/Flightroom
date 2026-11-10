// The graphics engine Develop draws with (this file stays small: the app
// starts it; the devices and shaders load with Develop): WebGPU where the computer has it
// (Flightroom 3.0), WebGL2 otherwise or when picked in Settings. Both run the
// same shaders (programs.js) through the same small drawing interface, so the
// photo comes out the same either way.

export const ENGINE_KEY = 'flightroom-engine';
export const ENGINES = ['auto', 'webgl2'];

export function enginePref() {
  try { return localStorage.getItem(ENGINE_KEY) === 'webgl2' ? 'webgl2' : 'auto'; } catch { return 'auto'; }
}
/** Takes effect the next time Flightroom starts (one device for the whole app). */
export function setEnginePref(v) {
  try { localStorage.setItem(ENGINE_KEY, v); } catch {}
}

// Big draws go to the graphics card in bands of about this many pixels. A
// whole-picture pass is one triangle, and cards that can only pause work
// between triangles (Intel's integrated graphics) can't stop one to put the
// desktop on screen, so a 100+ ms pass makes the whole screen stall or flash.
export const BAND_PX = 1 << 17;
// On weaker built-in graphics (setGentle): smaller bands, each sent to the
// card on its own, so Windows can put the desktop on screen between any two
// of them. Sent as one batch, a whole frame could still keep the chip busy
// long enough for Windows to reset the driver (the screen goes black for a few
// seconds). Bit-identical, only scheduled differently.
export const GENTLE_BAND_PX = 1 << 15;
let gentle = false;
/** Set once at start from the computer's graphics (every renderer, the photo's, exports' and thumbnails', draws this way). */
export const setGentleGraphics = (on) => { gentle = !!on; };
export const gentleGraphics = () => gentle;

// --- WebGPU: one device for the whole app -----------------------------------
let gpu = null; // { adapter, device, info }
/** The WebGPU device, or null (WebGL2). */
export const gpuDevice = () => gpu?.device || null;
export const engineRestoring = () => !!restoring;
let gpuWhy = '';
const lostListeners = new Set();
let restoring = null;

const timeout = (ms, v) => new Promise((ok, no) => setTimeout(() => (v === undefined ? no(new Error('WebGPU took too long to start')) : ok(v)), ms));

async function requestGpu() {
  if (typeof navigator === 'undefined' || !navigator.gpu) throw new Error('no WebGPU');
  const adapter = await Promise.race([navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }), timeout(4000)]);
  if (!adapter) throw new Error('no WebGPU adapter');
  const L = adapter.limits;
  const device = await Promise.race([adapter.requestDevice({
    requiredLimits: { maxTextureDimension2D: L.maxTextureDimension2D, maxBufferSize: L.maxBufferSize, maxStorageBufferBindingSize: L.maxStorageBufferBindingSize },
  }), timeout(4000)]);
  const info = adapter.info || {};
  const g = { adapter, device, info: { vendor: info.vendor || '', architecture: info.architecture || '', description: info.description || '' } };
  let dead = false;
  device.lost.then(() => {
    dead = true;
    // Flightroom never destroys its device, so any loss is the driver's (some report it as "destroyed").
    if (gpu !== g) return;
    gpu = null;
    for (const f of lostListeners) f('lost');
    resets = resets.filter((t) => Date.now() - t < 60000).concat(Date.now());
    // The browser gives a new device after a driver reset; everything is made again on it.
    // A second reset within a minute, or no new device: WebGL2 for the rest of this run.
    const again = resets.length > 1 ? Promise.reject(new Error('WebGPU kept resetting')) : requestGpu();
    restoring = again.then((n) => { gpu = n; }, (e) => { gpuWhy = `${String(e.message || e)}, so WebGL2 took over`; })
      .finally(() => { restoring = null; for (const f of lostListeners) f('restored'); });
  });
  // Some drivers hand out a device that dies as soon as it draws to a canvas:
  // tried once on a small one, so the photo never goes blank.
  if (!(await screenWorks(device, () => dead))) throw new Error('WebGPU can\'t draw to the screen here');
  return g;
}
let resets = [];

async function screenWorks(device, isDead) {
  try {
    const ctx = new OffscreenCanvas(4, 4).getContext('webgpu');
    if (!ctx) return false;
    ctx.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
    const enc = device.createCommandEncoder();
    enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] }).end();
    device.queue.submit([enc.finish()]);
    const ok = await Promise.race([device.queue.onSubmittedWorkDone().then(() => true, () => false), timeout(3000, false)]);
    ctx.unconfigure();
    return ok && !isDead();
  } catch {
    return false;
  }
}

/** Once at start (main.jsx): WebGPU's device, unless Settings picked WebGL2 or the computer has none. */
export async function initEngine() {
  if (enginePref() === 'webgl2') { gpuWhy = 'WebGL2 picked in Settings'; return null; }
  try {
    gpu = await requestGpu();
    // The photo's big programs start compiling now, so Develop opens without the wait.
    import('./webgpu.js').then((m) => gpu && m.GPUDev.warm(gpu.device), () => {});
  } catch (e) {
    gpu = null;
    gpuWhy = String(e.message || e);
  }
  return gpu;
}

/** 'webgpu' or 'webgl2': what new renderers draw with. */
export const engineKind = () => (gpu ? 'webgpu' : 'webgl2');
export const engineInfo = () => ({ kind: engineKind(), adapter: gpu?.info || null, why: gpu ? '' : gpuWhy });

/** Called with 'lost' / 'restored' when the WebGPU device is reset by the driver ('restored' may bring WebGL2 instead: engineKind()). */
export function onEngineReset(f) { lostListeners.add(f); return () => lostListeners.delete(f); }

/** Calls onLost / onRestored when the graphics driver resets under a canvas (WebGL2's events, or WebGPU's device). */
export function watchResets(canvas, onLost, onRestored) {
  // preventDefault: WebGL2 only hands the context back to a page that asks for it.
  const lost = (e) => { e.preventDefault(); onLost(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  const off = onEngineReset((what) => (what === 'lost' ? onLost() : onRestored()));
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    off();
  };
}
