import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaver } from './saver.js';

const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('saving Develop edits', () => {
  let writes, saver, unsaved, errors;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    writes = [];
    unsaved = new Set();
    errors = [];
    saver = createSaver(async (sidecar, s) => { writes.push([sidecar, s.v]); return { ok: true }; }, { unsaved, onError: (p, e) => errors.push([p.id, e.message]) });
  });
  afterEach(() => vi.useRealTimers());

  it('writes the last of rapid changes once, after the delay', async () => {
    saver.schedule('a', 'a.xmp', { v: 1 });
    saver.schedule('a', 'a.xmp', { v: 2 });
    expect(unsaved.has('a')).toBe(true);
    await vi.advanceTimersByTimeAsync(499);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toEqual([['a.xmp', 2]]);
    expect(unsaved.has('a')).toBe(false);
  });

  it("moving to another photo writes the last one's edit at once", async () => {
    saver.schedule('a', 'a.xmp', { v: 1 });
    saver.schedule('b', 'b.xmp', { v: 7 });
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toEqual([['a.xmp', 1]]);
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual([['a.xmp', 1], ['b.xmp', 7]]);
  });

  it('an edit left pending when moving on (or leaving) is still written', async () => {
    saver.schedule('a', 'a.xmp', { v: 1 });
    await saver.flush(); // what leaving Develop does
    expect(writes).toEqual([['a.xmp', 1]]);
    // Nothing pending: flushing again writes nothing.
    await saver.flush();
    expect(writes.length).toBe(1);
  });

  it('writes to one sidecar in order, so an older save never lands last', async () => {
    const order = [];
    let release;
    const slow = new Promise((r) => { release = r; });
    const s = createSaver(async (sidecar, x) => {
      if (x.v === 1) await slow;
      order.push(x.v);
      return {};
    }, { unsaved });
    s.schedule('a', 'a.xmp', { v: 1 });
    s.flush();
    s.schedule('a', 'a.xmp', { v: 2 });
    s.flush();
    await tick();
    expect(order).toEqual([]); // the second waits for the first
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2]);
    expect(unsaved.has('a')).toBe(false);
  });

  it('a failed save keeps the photo unsaved and is reported', async () => {
    const s = createSaver(async () => ({ error: 'disk full' }), { unsaved, onError: (p, e) => errors.push([p.id, e.message]) });
    s.schedule('a', 'a.xmp', { v: 1 });
    await s.flush();
    expect(errors).toEqual([['a', 'disk full']]);
    expect(unsaved.has('a')).toBe(true);
  });

  it('queued jobs wait for a pending save of the same sidecar', async () => {
    saver.schedule('a', 'a.xmp', { v: 1 });
    await saver.idle('a.xmp');
    const res = await saver.queue('a.xmp', async () => { writes.push(['a.xmp', 'paste']); return 'done'; });
    expect(res).toBe('done');
    expect(writes).toEqual([['a.xmp', 1], ['a.xmp', 'paste']]);
  });
});
