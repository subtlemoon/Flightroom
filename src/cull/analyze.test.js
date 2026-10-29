import { describe, expect, it } from 'vitest';
import { blurOf, detail, distance, exposure, fingerprint, focusArea, palette, paletteDistance, sharpness, stored, suggest } from './analyze.js';

// A 160x120 test image: a checkerboard of `size`-pixel squares, optionally box-blurred.
function image(size, blur = 0, base = 0) {
  const w = 160, h = 120;
  let g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = base + ((Math.floor(x / size) + Math.floor(y / size)) % 2 ? 200 : 40);
  for (let pass = 0; pass < blur; pass++) {
    const n = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[(y + dy) * w + x + dx];
      n[y * w + x] = s / 9;
    }
    g = n;
  }
  return { gray: Uint8ClampedArray.from(g), w, h };
}

describe('auto-rate measurements', () => {
  it('scores a sharp image above a blurred copy', () => {
    const sharp = image(8);
    const soft = image(8, 4);
    expect(sharpness(sharp.gray, sharp.w, sharp.h)).toBeGreaterThan(sharpness(soft.gray, soft.w, soft.h) * 3);
  });

  it('reads crispness the same in a dark copy, and lower when blurred', () => {
    const sharp = image(8), dark = { ...sharp, gray: Uint8ClampedArray.from(sharp.gray, (v) => v * 0.3) }, soft = image(8, 3);
    const c = detail(sharp.gray, sharp.w, sharp.h).crisp;
    expect(detail(dark.gray, dark.w, dark.h).crisp).toBeCloseTo(c, 0);
    expect(detail(soft.gray, soft.w, soft.h).crisp).toBeLessThan(c * 0.5);
    // Sharpness (edge strength) falls in the dark copy too, which is why crispness is used.
    expect(sharpness(dark.gray, dark.w, dark.h)).toBeLessThan(sharpness(sharp.gray, sharp.w, sharp.h) * 0.2);
    // A flat picture has no crispness to speak of.
    expect(detail(new Uint8ClampedArray(160 * 120).fill(90), 160, 120).crisp).toBe(null);
  });

  it('measures clipped highlights', () => {
    const e = exposure(Uint8ClampedArray.from([255, 255, 128, 0]));
    expect(e.clipHi).toBe(0.5);
    expect(e.clipLo).toBe(0.25);
  });

  it('gives near-identical images near-identical fingerprints', () => {
    const a = image(20), b = image(20, 1), c = image(7);
    expect(distance(fingerprint(a.gray, a.w, a.h), fingerprint(b.gray, b.w, b.h))).toBeLessThan(8);
    expect(distance(fingerprint(a.gray, a.w, a.h), fingerprint(c.gray, c.w, c.h))).toBeGreaterThan(8);
  });
});

// The blur measure as first written (a 9-pixel running mean per line), to check the faster one against.
function blurReference(gray, w, h, n = 4) {
  const scores = [];
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const x0 = Math.floor((tx * w) / n), x1 = Math.floor(((tx + 1) * w) / n);
      const y0 = Math.floor((ty * h) / n), y1 = Math.floor(((ty + 1) * h) / n);
      if (x1 - x0 < 12 || y1 - y0 < 12) continue;
      let worst = 0, detail = 0;
      for (const [dx] of [[1, 0], [0, 1]]) {
        let sF = 0, sV = 0;
        const lines = dx ? y1 - y0 : x1 - x0, len = dx ? x1 - x0 : y1 - y0;
        for (let l = 0; l < lines; l++) {
          const at = (i) => (dx ? gray[(y0 + l) * w + x0 + i] : gray[(y0 + i) * w + x0 + l]);
          const mean = [];
          for (let i = 0; i < len; i++) {
            let sum = 0;
            for (let k = -4; k <= 4; k++) sum += at(Math.min(len - 1, Math.max(0, i + k)));
            mean.push(sum / 9);
          }
          for (let i = 1; i < len; i++) {
            const dF = Math.abs(at(i) - at(i - 1)), dB = Math.abs(mean[i] - mean[i - 1]);
            sF += dF; sV += Math.max(0, dF - dB);
          }
        }
        worst = Math.max(worst, sF ? (sF - sV) / sF : 1);
        detail += sF / (lines * len);
      }
      scores.push([detail, worst]);
    }
  }
  if (!scores.length) return null;
  const top = scores.sort((a, b) => b[0] - a[0]).slice(0, Math.max(3, Math.ceil(scores.length * 0.4))).map((t) => t[1]).sort((a, b) => a - b).slice(0, 3);
  return top.reduce((a, b) => a + b, 0) / top.length;
}

describe('full-size blur', () => {
  it('matches the straightforward running-mean version', () => {
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const noisy = { w: 173, h: 97, gray: Uint8ClampedArray.from({ length: 173 * 97 }, () => rand() * 256) };
    for (const img of [image(8), image(8, 3), image(20, 1, 15), noisy]) {
      expect(blurOf(img.gray, img.w, img.h)).toBeCloseTo(blurReference(img.gray, img.w, img.h), 9);
    }
    expect(blurOf(new Uint8ClampedArray(30 * 30), 30, 30)).toBe(null); // tiles too small
  });

  it('rises with blur', () => {
    const b = [0, 1, 3, 6].map((n) => { const img = image(8, n); return blurOf(img.gray, img.w, img.h); });
    expect(b[0]).toBeLessThan(b[1]);
    expect(b[1]).toBeLessThan(b[2]);
    expect(b[2]).toBeLessThan(b[3]);
  });
});

describe('where focus is judged', () => {
  it("looks at a person's head and at the middle of anything else", () => {
    // A person filling an 8256 x 5504 frame from top to bottom.
    const box = { x: 0.3, y: 0.05, w: 0.3, h: 0.9 };
    const person = focusArea(box, 8256, 5504, true), car = focusArea(box, 8256, 5504, false);
    expect(person.y).toBeCloseTo(0.05); // from the top of the box
    expect(person.h * 5504).toBeCloseTo(1600);
    expect(car.y + car.h / 2).toBeCloseTo(0.5); // around the middle
    expect(person.x).toBeCloseTo(car.x);
    // A box smaller than the area is looked at whole.
    const small = focusArea({ x: 0.1, y: 0.2, w: 0.1, h: 0.1 }, 8256, 5504, true);
    for (const [k, v] of Object.entries({ x: 0.1, y: 0.2, w: 0.1, h: 0.1 })) expect(small[k]).toBeCloseTo(v);
  });

  it('turns boxes back to the way the preview is stored', () => {
    const b = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(stored(b, 0)).toEqual(b);
    // Turning half way twice, or a quarter one way and then the other, gives the box back.
    for (const back of [stored(stored(b, 180), 180), stored(stored(b, 90), 270)]) {
      for (const k of ['x', 'y', 'w', 'h']) expect(back[k]).toBeCloseTo(b[k]);
    }
  });
});

describe('subject colours', () => {
  // A w x h RGBA picture: background colour, and a box of another colour in the middle.
  const picture = (bg, fg, w = 64, h = 48) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7 ? fg : bg;
      px.set([...c, 255], (y * w + x) * 4);
    }
    return px;
  };
  const box = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const grey = [90, 90, 90];

  it('tells a red kart from a blue one on the same tarmac', () => {
    const red = palette(picture(grey, [200, 30, 30]), 64, 48, box);
    const red2 = palette(picture([100, 100, 100], [190, 40, 35]), 64, 48, box);
    const blue = palette(picture(grey, [30, 60, 210]), 64, 48, box);
    expect(red.reduce((a, b) => a + b)).toBeCloseTo(1, 1);
    expect(paletteDistance(red, red2)).toBeLessThan(0.15);
    expect(paletteDistance(red, blue)).toBeGreaterThan(0.6);
  });

  it('counts greys, white and black together, and tells them from colour', () => {
    const white = palette(picture(grey, [245, 245, 245]), 64, 48, box);
    const black = palette(picture(grey, [10, 10, 10]), 64, 48, box);
    const yellow = palette(picture(grey, [230, 200, 20]), 64, 48, box);
    expect(white[12]).toBeCloseTo(1);
    expect(paletteDistance(white, black)).toBe(0);
    expect(paletteDistance(white, yellow)).toBe(1);
  });

  it('sees the same red either side of where hues wrap around', () => {
    const a = palette(picture(grey, [220, 30, 38]), 64, 48, box); // just past red, towards purple
    const b = palette(picture(grey, [220, 38, 30]), 64, 48, box); // just past red, towards orange
    expect(paletteDistance(a, b)).toBeLessThan(0.1);
  });

  it("doesn't let the grey around a subject make two colours alike", () => {
    // Mostly tarmac around a small red or blue kart.
    const red = palette(picture(grey, [200, 30, 30], 64, 48), 64, 48, { x: 0, y: 0, w: 1, h: 1 });
    const blue = palette(picture(grey, [30, 60, 210], 64, 48), 64, 48, { x: 0, y: 0, w: 1, h: 1 });
    expect(red[12]).toBeGreaterThan(0.4);
    expect(paletteDistance(red, blue)).toBeGreaterThan(0.9);
  });
});

describe('auto-rate suggestions', () => {
  const m = (sharp, hash, extra = {}) => ({ sharp, hash, clipHi: 0, clipLo: 0, mean: 120, ...extra });
  const h1 = '0'.repeat(64), h2 = '1'.repeat(64);

  it('rates the sharpest of a burst highest and the rest one star lower, as keepers', () => {
    const items = [
      { id: 'a', name: 'A', m: m(500, h1), takenAt: '2026:10:17 13:05:45' },
      { id: 'b', name: 'B', m: m(900, h1), takenAt: '2026:10:17 13:05:45' },
      { id: 'c', name: 'C', m: m(400, h1), takenAt: '2026:10:17 13:05:46' },
      { id: 'd', name: 'D', m: m(700, h2), takenAt: '2026:10:17 13:09:00' },
    ];
    const s = suggest(items);
    expect(s.b.stars).toBe(4);
    expect(s.a.stars).toBe(3);
    expect(s.c.stars).toBe(3);
    expect(s.a.reasons[0]).toMatch(/Similar to B/);
    expect(s.d.stars).toBeGreaterThan(1);
  });

  it('caps the stars of photos that are soft at full size and rejects blurry ones', () => {
    const items = [0.58, 0.6, 0.66, 0.7, 0.78].map((blur, i) => ({ id: `p${i}`, name: `P${i}`, m: m(900, i % 2 ? h1 : h2, { blur, subject: { box: {} } }), takenAt: `2026:10:17 13:${10 + i}:00` }));
    const s = suggest(items);
    expect(s.p0.stars).toBe(4);
    expect(s.p2.stars).toBeLessThanOrEqual(3);
    expect(s.p3.stars).toBe(2);
    expect(s.p3.reasons.join()).toMatch(/soft at full size/);
    expect(s.p4.stars).toBe(1);
    expect(s.p4.reasons.join()).toMatch(/soft or blurry/);
  });

  it('gives most sharp, well-exposed photos 3 or 4 stars', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, m: m(500 + i * 20, i % 2 ? h1 : h2), takenAt: `2026:10:17 13:${10 + i}:00` }));
    const s = suggest(items);
    const good = Object.values(s).filter((x) => x.stars >= 3).length;
    expect(good).toBe(16);
    expect(Object.values(s).every((x) => x.stars >= 2)).toBe(true);
  });

  it('never makes a soft frame the best of a burst with a sharp one', () => {
    // b is sharp but bright, which costs it more than a's softness would rank it down.
    const items = [
      { id: 'a', name: 'A', m: m(900, h1, { blur: 0.73, subject: { box: {} } }), takenAt: '2026:10:17 13:05:45' },
      { id: 'b', name: 'B', m: m(400, h1, { blur: 0.62, subject: { box: {} }, clipHi: 0.3, mean: 230 }), takenAt: '2026:10:17 13:05:45' },
    ];
    const s = suggest(items);
    expect(s.b.reasons[0]).toMatch(/Best of 2/);
    expect(s.b.stars).toBeGreaterThanOrEqual(2);
    expect(s.a.duplicate).toBe(true);
    expect(s.a.stars).toBe(1);
  });

  it("keeps two subjects shot a second apart at the same spot apart, but not one subject's burst", () => {
    const red = [0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5], blue = [0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5];
    const redAgain = [0.05, 0.45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5];
    const kart = (colours) => ({ subject: { label: 'car', box: {} }, colours });
    const items = [
      { id: 'a', name: 'A', m: m(900, h1, kart(red)), takenAt: '2026:10:17 13:05:45' },
      { id: 'b', name: 'B', m: m(800, h1, kart(redAgain)), takenAt: '2026:10:17 13:05:45' },
      { id: 'c', name: 'C', m: m(700, h1, kart(blue)), takenAt: '2026:10:17 13:05:46' },
      { id: 'd', name: 'D', m: m(600, h1, kart(blue)), takenAt: '2026:10:17 13:05:46' },
    ];
    const s = suggest(items);
    expect(s.a.group).toBe(s.b.group);
    expect(s.c.group).toBe(s.d.group);
    expect(s.c.group).not.toBe(s.a.group);
    expect(s.c.reasons[0]).toMatch(/Best of 2/); // the blue kart's best, not "similar to A"
    // Without colours (measured before) or with another kind of subject, as before: one burst.
    const plain = suggest(items.map((it) => ({ ...it, m: { ...it.m, colours: undefined } })));
    expect(new Set(Object.values(plain).map((x) => x.group)).size).toBe(1);
    const mixed = suggest(items.map((it, i) => ({ ...it, m: { ...it.m, subject: { label: i < 2 ? 'car' : 'person', box: {} } } })));
    expect(new Set(Object.values(mixed).map((x) => x.group)).size).toBe(1);
  });

  it('rejects a photo blurred so much the small preview shows it, whatever the full-size measure says', () => {
    // Noise in a badly blurred picture fools the full-size measure (p0's 0.3 reads
    // sharp); its crispness, 10 times below the others', doesn't.
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, takenAt: `2026:10:17 13:${10 + i}:00`,
      m: m(600, i % 2 ? h1 : h2, { blur: i ? 0.6 : 0.3, crisp: i ? 7 : 0.7, frameCrisp: i ? 7 : 0.7, subject: { box: {} } }) }));
    const s = suggest(items);
    expect(s.p0.stars).toBe(1);
    expect(s.p0.reasons[0]).toBe('Subject is soft or blurry');
    expect(s.p1.stars).toBeGreaterThan(1);
    // Something else in the frame is crisp: focus went past the subject.
    items[0].m.frameCrisp = 7;
    expect(suggest(items).p0.reasons[0]).toBe('Focus missed the subject');
  });

  it("doesn't reject a sharp photo for being dark", () => {
    // Its edges are weaker (sharpness), its crispness the same as the others'.
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, takenAt: `2026:10:17 13:${10 + i}:00`,
      m: m(i ? 900 : 90, i % 2 ? h1 : h2, { crisp: 7, frameCrisp: 7, mean: i ? 120 : 60 }) }));
    expect(suggest(items).p0.stars).toBeGreaterThan(1);
  });

  it('marks blurry shots as likely rejects and never suggests 5 stars', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, m: m(i === 0 ? 50 : 600 + i * 50, i % 2 ? h1 : h2), takenAt: `2026:10:17 13:${10 + i}:00` }));
    const s = suggest(items);
    expect(s.p0.stars).toBe(1);
    expect(s.p0.reasons).toContain('Soft or blurry');
    expect(Math.max(...Object.values(s).map((x) => x.stars))).toBe(4);
  });
});
