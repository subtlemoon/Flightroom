import { describe, expect, it } from 'vitest';
import { Cancelled, measurePool, poolSize } from './measure-pool.js';

// A stand-in worker that answers only when told to.
function fakeWorker(log) {
  const w = {
    terminated: false,
    postMessage(msg) { log.push(msg.id); w.held = msg; },
    answer() { const { id } = w.held; w.held = null; w.onmessage({ data: { id, m: { id } } }); },
    terminate() { w.terminated = true; },
  };
  return w;
}
const bitmap = () => ({ closed: false, close() { this.closed = true; } });

describe('auto-rate measuring pool', () => {
  it('starts as many workers as cores and memory allow', () => {
    expect(poolSize(16, 8)).toBe(4); // a 16 GB+ PC (the browser reports at most 8)
    expect(poolSize(16, 4)).toBe(2);
    expect(poolSize(16, 2)).toBe(1);
    expect(poolSize(4, 8)).toBe(2);
    expect(poolSize(2, 8)).toBe(1);
    expect(poolSize(undefined, undefined)).toBe(1);
    expect(poolSize(8, undefined)).toBe(2); // memory unknown: counted as 4 GB
  });

  it('measures one photo per worker at a time', async () => {
    const log = [], workers = [];
    const pool = measurePool(2, () => { const w = fakeWorker(log); workers.push(w); return w; });
    const jobs = [0, 1, 2].map(() => pool.measure(bitmap(), 1, null));
    expect(log).toEqual([0, 1]);
    workers[0].answer();
    expect(await jobs[0]).toEqual({ id: 0 });
    expect(log).toEqual([0, 1, 2]);
    workers[1].answer(); workers[0].answer();
    expect(await Promise.all(jobs.slice(1))).toEqual([{ id: 1 }, { id: 2 }]);
    pool.close();
  });

  it('stops at once, mid-batch: running and waiting photos fail with Cancelled', async () => {
    const workers = [];
    const pool = measurePool(2, () => { const w = fakeWorker([]); workers.push(w); return w; });
    const bmps = [bitmap(), bitmap(), bitmap(), bitmap()];
    const jobs = bmps.map((b) => pool.measure(b, 1, null).then(() => 'done', (e) => e));
    pool.close();
    const results = await Promise.all(jobs);
    expect(results.every((r) => r instanceof Cancelled)).toBe(true);
    expect(workers.every((w) => w.terminated)).toBe(true);
    // Waiting photos' pictures are freed; any handed over afterwards too.
    expect(bmps.slice(2).every((b) => b.closed)).toBe(true);
    const late = bitmap();
    await expect(pool.measure(late, 1, null)).rejects.toBeInstanceOf(Cancelled);
    expect(late.closed).toBe(true);
  });
});
