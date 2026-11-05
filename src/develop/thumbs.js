// Thumbnails of photos as developed (crop, colour, layers), made in Develop
// and shown by the filmstrips instead of the camera's own preview: photo id ->
// object URL of a small JPEG for this app session. Each is also kept on disk
// (for its sidecar as it is then), so the filmstrip shows edits after a
// restart too; photos edited elsewhere get theirs made in the background.
import { useEffect, useState } from 'react';
import { bridge } from '../bridge.js';
import { session } from './session.js';

export const THUMB_EDGE = 320; // device px, the filmstrip's developed thumbnails

const thumbs = new Map();
const MAX = 300;

export function setDevelopedThumb(id, url) {
  const old = thumbs.get(id);
  if (old) URL.revokeObjectURL(old);
  thumbs.delete(id);
  thumbs.set(id, url);
  for (const [k, u] of thumbs) {
    if (thumbs.size <= MAX) break;
    if (k === id) continue;
    URL.revokeObjectURL(u);
    thumbs.delete(k);
  }
  window.dispatchEvent(new CustomEvent('develop:thumb', { detail: id }));
}

export const hasDevelopedThumb = (id) => thumbs.has(id);

/** The developed thumbnail's URL for a photo, or null; updates when Develop makes a new one. */
export function useDevelopedThumb(id) {
  const [url, setUrl] = useState(() => thumbs.get(id) || null);
  useEffect(() => {
    setUrl(thumbs.get(id) || null);
    const on = (e) => { if (e.detail === id) setUrl(thumbs.get(id) || null); };
    window.addEventListener('develop:thumb', on);
    return () => window.removeEventListener('develop:thumb', on);
  }, [id]);
  return url;
}

/** RGBA pixels, bottom row first (as WebGL reads them), to a JPEG blob. */
export async function pixelsToBlob(px, w, h) {
  const flipped = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) flipped.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').putImageData(new ImageData(flipped, w, h), 0, 0);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

/**
 * Shows a new developed thumbnail at once and keeps it on disk once `saved`
 * (the photo's pending settings save) is done, so it's filed under the sidecar
 * it shows. Not kept while the photo has settings that couldn't be saved.
 */
export async function keepThumb(photo, blob, saved = Promise.resolve()) {
  setDevelopedThumb(photo.id, URL.createObjectURL(blob));
  if (!saved) return; // shown, not kept
  await saved;
  if (!session.unsaved.has(photo.id)) bridge?.cull.saveDeveloped(photo, await blob.arrayBuffer());
}

/** Size of a developed thumbnail for a crop frame. */
export function thumbSize(f, edge = THUMB_EDGE) {
  const k = edge / (2 * Math.max(f.hw, f.hh));
  return { w: Math.max(8, Math.round(2 * f.hw * k)), h: Math.max(8, Math.round(2 * f.hh * k)) };
}
