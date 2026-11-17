// Pattern Overlay's own patterns: small tiles drawn once, kept as PNG data
// URLs in the layer style (a Photoshop document's patterns come the same way).

const SIZE = 64;
// A page canvas: it can be read back as a PNG data URL.
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

const DRAW = {
  Checker: (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2); },
  Dots: (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#222'; for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) { c.beginPath(); c.arc(x * s, y * s, s * 0.11, 0, Math.PI * 2); c.fill(); } },
  Stripes: (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.strokeStyle = '#333'; c.lineWidth = s / 6; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(k * s, s); c.lineTo(k * s + s, 0); c.stroke(); } },
  Grid: (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, s, 2); c.fillRect(0, 0, 2, s); },
  Noise: (c, s) => {
    const im = c.createImageData(s, s);
    let seed = 7;
    for (let i = 0; i < s * s; i++) { seed = (seed * 16807) % 2147483647; const v = 96 + (seed % 128); im.data.set([v, v, v, 255], i * 4); }
    c.putImageData(im, 0, 0);
  },
  Canvas: (c, s) => {
    c.fillStyle = '#e9e2d2'; c.fillRect(0, 0, s, s);
    c.fillStyle = 'rgba(120,100,70,0.18)';
    for (let i = 0; i < s; i += 4) { c.fillRect(0, i, s, 1); c.fillRect(i + 2, 0, 1, s); }
  },
};

export const PATTERN_NAMES = Object.keys(DRAW);
const made = new Map();

/** A built-in pattern as { name, src, w, h }. */
export function builtInPattern(name) {
  if (!made.has(name)) {
    const c = canvas(SIZE, SIZE);
    DRAW[name](c.getContext('2d'), SIZE);
    const src = c.toDataURL('image/png');
    made.set(name, { name, src, w: SIZE, h: SIZE });
  }
  return made.get(name);
}

/** A picture file as a pattern (at most 512 px a side). */
export async function patternFromFile(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = canvas(w, h);
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return { name: file.name.replace(/\.[^.]*$/, ''), src: c.toDataURL('image/png'), w, h };
}
