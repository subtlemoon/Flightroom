// Thumbnails of photos as developed (crop, colour, layers), made in Develop
// and shown by the filmstrips instead of the camera's own preview: photo id ->
// object URL of a small JPEG. Kept for the app session.
import { useEffect, useState } from 'react';

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

/** RGBA pixels, bottom row first (as WebGL reads them), to a JPEG object URL. */
export async function pixelsToUrl(px, w, h) {
  const flipped = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) flipped.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').putImageData(new ImageData(flipped, w, h), 0, 0);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return URL.createObjectURL(blob);
}
