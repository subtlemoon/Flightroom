import packageInfo from '../../package.json';

const MAX_EVENTS = 500;
const MAX_FRAMES = 240;
const MAX_CAPTURE_MS = 10 * 60 * 1000;
const SLOW_FRAME_MS = 25;
// The page missing its screen updates this long: the window (or whole screen) stalled.
const STALL_MS = 120;
export const FLICKER_KEY = 'F8';

const rounded = (value) => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
const safeParam = (gl, key, source = gl) => { try { return gl.getParameter(source[key]); } catch { return null; } };

function environmentInfo() {
  const nav = navigator;
  return {
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform || nav.platform || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    deviceMemoryGb: nav.deviceMemory || null,
    screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio: devicePixelRatio || 1 },
  };
}

function graphicsInfo(renderer, canvas) {
  const gl = renderer?.gl;
  if (!gl) return { available: false, reason: 'No active WebGL renderer' };
  let debug = null;
  try { debug = gl.getExtension('WEBGL_debug_renderer_info'); } catch {}
  const hasExtension = (name) => { try { return !!gl.getExtension(name); } catch { return false; } };
  const maxViewport = safeParam(gl, 'MAX_VIEWPORT_DIMS');
  return {
    available: true,
    contextLost: !!gl.isContextLost(),
    version: safeParam(gl, 'VERSION'),
    shadingLanguageVersion: safeParam(gl, 'SHADING_LANGUAGE_VERSION'),
    vendor: debug ? safeParam(gl, 'UNMASKED_VENDOR_WEBGL', debug) : safeParam(gl, 'VENDOR'),
    renderer: debug ? safeParam(gl, 'UNMASKED_RENDERER_WEBGL', debug) : safeParam(gl, 'RENDERER'),
    maxTextureSize: safeParam(gl, 'MAX_TEXTURE_SIZE'),
    maxRenderbufferSize: safeParam(gl, 'MAX_RENDERBUFFER_SIZE'),
    maxViewport: maxViewport ? Array.from(maxViewport) : null,
    contextAttributes: (() => { try { return gl.getContextAttributes(); } catch { return null; } })(),
    extensions: {
      floatColorBuffer: hasExtension('EXT_color_buffer_float'),
      floatTextureLinear: hasExtension('OES_texture_float_linear'),
      timerQuery: hasExtension('EXT_disjoint_timer_query_webgl2'),
      debugRendererInfo: !!debug,
    },
    canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
  };
}

function safeDetails(details = {}) {
  const allowed = new Set(['control', 'width', 'height', 'durationMs', 'generation', 'prevented', 'completed', 'kind', 'errorName', 'reason']);
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (!allowed.has(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 80);
    else if (typeof value === 'number') out[key] = rounded(value);
    else if (typeof value === 'boolean' || value === null) out[key] = value;
  }
  return out;
}

class GraphicsDiagnostics {
  capture = null;
  perfStart = 0;
  lastControl = '';
  lastControlAt = 0;
  stopTimer = 0;
  observer = null;
  listeners = new Set();
  rafId = 0;
  onKey = (e) => { if (e.key === FLICKER_KEY && this.isActive()) { e.preventDefault(); this.markFlicker(); } };

  isActive() { return this.capture?.status === 'recording'; }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const active = this.isActive();
    for (const listener of this.listeners) listener(active);
  }

  start({ renderer, canvas } = {}) {
    if (this.isActive()) return this.snapshot();
    clearTimeout(this.stopTimer);
    this.perfStart = performance.now();
    this.lastControl = '';
    this.lastControlAt = 0;
    this.capture = {
      formatVersion: 1,
      app: { name: 'Flightroom', version: packageInfo.version },
      status: 'recording',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: null,
      stopReason: null,
      environment: environmentInfo(),
      graphics: graphicsInfo(renderer, canvas),
      summary: {
        settingChanges: 0,
        frames: 0,
        slowFrames: 0,
        failedFrameWaits: 0,
        maxFrameMs: 0,
        averageFrameMs: 0,
        contextLosses: 0,
        contextRestores: 0,
        longTasks: 0,
        flickerMarkers: 0,
        stalls: 0,
        maxStallMs: 0,
      },
      events: [],
      frames: [],
    };
    this.record('capture-started');
    this.observeLongTasks();
    this.watchStalls();
    window.addEventListener('keydown', this.onKey, true);
    this.stopTimer = setTimeout(() => this.stop('10-minute limit'), MAX_CAPTURE_MS);
    this.notify();
    return this.snapshot();
  }

  observeLongTasks() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!this.isActive()) continue;
          this.capture.summary.longTasks++;
          this.record('main-thread-long-task', { durationMs: entry.duration });
        }
      });
      this.observer.observe({ type: 'longtask', buffered: false });
    } catch { this.observer = null; }
  }

  /**
   * Screen updates the page didn't get: a gap between animation frames while
   * the window is shown. It catches a stalled screen even when Flightroom
   * drew nothing then.
   */
  watchStalls() {
    let last = performance.now();
    const tick = (now) => {
      if (!this.isActive()) return;
      const gap = now - last;
      last = now;
      if (gap > STALL_MS && document.visibilityState === 'visible') {
        const summary = this.capture.summary;
        summary.stalls++;
        summary.maxStallMs = Math.max(summary.maxStallMs, rounded(gap));
        this.record('screen-stall', { durationMs: gap });
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  record(type, details = {}) {
    if (!this.isActive()) return;
    const event = { ms: rounded(performance.now() - this.perfStart), type, ...safeDetails(details) };
    const events = this.capture.events;
    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    if (type === 'webgl-context-lost') this.capture.summary.contextLosses++;
    if (type === 'webgl-context-restored') this.capture.summary.contextRestores++;
    if (type === 'screen-flicker-marked') this.capture.summary.flickerMarkers++;
  }

  recordSettingChange(control) {
    if (!this.isActive()) return;
    const name = String(control || 'settings').slice(0, 80);
    const now = performance.now();
    this.capture.summary.settingChanges++;
    if (name !== this.lastControl || now - this.lastControlAt > 500) this.record('setting-changed', { control: name });
    this.lastControl = name;
    this.lastControlAt = now;
  }

  recordFrame({ durationMs, completed, width, height, kind = 'redraw' }) {
    if (!this.isActive()) return;
    const ms = Math.max(0, durationMs);
    const summary = this.capture.summary;
    summary.frames++;
    summary.maxFrameMs = Math.max(summary.maxFrameMs, ms);
    summary.averageFrameMs += (ms - summary.averageFrameMs) / summary.frames;
    if (ms > SLOW_FRAME_MS) summary.slowFrames++;
    if (!completed) summary.failedFrameWaits++;
    const frames = this.capture.frames;
    frames.push({ ms: rounded(performance.now() - this.perfStart), frameMs: rounded(ms), completed: !!completed, width, height, kind });
    if (frames.length > MAX_FRAMES) frames.splice(0, frames.length - MAX_FRAMES);
  }

  markFlicker() { this.record('screen-flicker-marked'); }

  stop(reason = 'user') {
    if (!this.isActive()) return this.snapshot();
    this.record('capture-stopped', { reason });
    this.capture.status = 'complete';
    this.capture.endedAt = new Date().toISOString();
    this.capture.durationMs = rounded(performance.now() - this.perfStart);
    this.capture.stopReason = reason;
    clearTimeout(this.stopTimer);
    this.stopTimer = 0;
    this.observer?.disconnect();
    this.observer = null;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKey, true);
    this.notify();
    return this.snapshot();
  }

  snapshot() {
    if (!this.capture) return null;
    const copy = JSON.parse(JSON.stringify(this.capture));
    if (this.isActive()) copy.durationMs = rounded(performance.now() - this.perfStart);
    return copy;
  }
}

export const graphicsDiagnostics = new GraphicsDiagnostics();

export async function exportGraphicsReport(report, saveTextFile) {
  if (!report) return { error: 'There is no diagnostic report to save.' };
  const name = `flightroom-graphics-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const text = JSON.stringify(report, null, 2);

  if (saveTextFile) {
    try {
      const result = await saveTextFile(name, text, { title: 'Save graphics diagnostic report', filterName: 'Graphics diagnostics' });
      if (!result) return { cancelled: true };
      if (result.error) return { error: result.error };
      return { saved: true, method: 'native-dialog' };
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Graphics diagnostic report', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { saved: true, method: 'file-picker' };
    } catch (error) {
      if (error?.name === 'AbortError') return { cancelled: true };
      return { error: String(error?.message || error) };
    }
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true, method: 'browser-download' };
}
