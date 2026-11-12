import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The browser parts previews.js uses: a screen, image decoding and fetch.
let made;
beforeEach(() => {
  made = [];
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.screen = { width: 1920, height: 1080 };
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  globalThis.createImageBitmap = async (_blob, opts = {}) => {
    const b = { opts, closed: false, close() { this.closed = true; } };
    made.push(b);
    return b;
  };
});
afterEach(() => { delete globalThis.window; delete globalThis.screen; });

const { clearPreviews, fitKey, loadFit, loadFull, prune, releaseFull } = await import('./previews.js');
const photo = { id: 'C:\\shoot\\a.nef' };
const meta = { width: 8256, height: 5504 };

describe('culling previews', () => {
  afterEach(() => clearPreviews());

  it('makes screen-sized previews for the current screen size', async () => {
    const a = await loadFit(photo, meta);
    expect(a.opts.resizeWidth).toBe(1920);
    expect(await loadFit(photo, meta)).toBe(a);
    // Moved to a 4K screen at 150%: a new, bigger one, and the old size is let go.
    globalThis.screen = { width: 3840, height: 2160 };
    window.devicePixelRatio = 1.5;
    const b = await loadFit(photo, meta);
    expect(b).not.toBe(a);
    expect(b.opts.resizeWidth).toBe(4096);
    prune(new Set([fitKey(photo.id)]));
    await Promise.resolve();
    expect(a.closed).toBe(true);
    expect(b.closed).toBe(false);
  });

  it('lets go of the full-size one, and loads a new one when zoomed in again', async () => {
    const full = await loadFull(photo);
    expect(await loadFull(photo)).toBe(full);
    releaseFull(photo.id);
    await Promise.resolve();
    expect(full.closed).toBe(true);
    const again = await loadFull(photo);
    expect(again).not.toBe(full);
    expect(again.closed).toBe(false);
  });
});

import { uprightBox } from './rotation.js';
describe('focus boxes', () => {
  it('turn with the photo', () => {
    const b = { x: 0.5, y: 0.55, w: 0.16, h: 0.24 }; // IMG_9251's face, camera turned (orientation 8)
    const u = uprightBox(b, 8);
    expect(u.x + u.w / 2).toBeCloseTo(0.67, 5);
    expect(u.y + u.h / 2).toBeCloseTo(0.42, 5);
    const r = uprightBox(b, 6);
    expect(r.x + r.w / 2).toBeCloseTo(0.33, 5);
    expect(r.y + r.h / 2).toBeCloseTo(0.58, 5);
    expect(uprightBox(b, 1)).toEqual(b);
  });
});
