// Keyboard shortcuts for rating. Keys are stored as KeyboardEvent.key values, so
// the number row and the number pad (with Num Lock on) both work for "1".."5".
export const DEFAULT_RATING_KEYS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 0: '0' };

export const DEFAULT_ZOOM_KEY = ' ';
export const ZOOM_LEVELS = [50, 100, 200, 300, 400]; // percent: 100 = one photo pixel per screen pixel
export const DEFAULT_ZOOM = 100;

// Keys the culling view already uses for moving around.
export const RESERVED_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape', 'Tab', 'Enter'];

export const normKey = (key) => (key.length === 1 ? key.toLowerCase() : key);

export const keyLabel = (key) => (key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key);

export const ratingKeys = (settings) => ({ ...DEFAULT_RATING_KEYS, ...settings?.cullKeys });
export const zoomKey = (settings) => settings?.cullZoomKey ?? DEFAULT_ZOOM_KEY;
export const zoomLevel = (settings) => settings?.cullZoom ?? DEFAULT_ZOOM;

// Which rating a key press means, or undefined.
export function ratingForKey(keys, key) {
  const k = normKey(key);
  const hit = Object.entries(keys).find(([, v]) => v === k);
  return hit ? Number(hit[0]) : undefined;
}

// Assigns `key` to `rating`; if another rating had that key, the two swap.
export function assignKey(keys, rating, key) {
  const k = normKey(key);
  const next = { ...keys };
  const other = Object.keys(next).find((r) => next[r] === k && Number(r) !== rating);
  if (other !== undefined) next[other] = keys[rating];
  next[rating] = k;
  return next;
}
