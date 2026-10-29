import { describe, expect, it } from 'vitest';
import { latestOnly } from './folder.js';

// Answers that resolve when told to, in any order.
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe('folder scans answered out of order', () => {
  it("keeps the newest folder's list when an older scan answers last", async () => {
    const scans = latestOnly();
    let list = null;
    const open = async (answer) => {
      const latest = scans.next();
      const res = await answer.promise;
      if (latest()) list = res;
    };
    const a = deferred(), b = deferred();
    const first = open(a); // folder A, slow
    const second = open(b); // then folder B
    b.resolve({ folder: 'B' });
    await second;
    a.resolve({ folder: 'A' });
    await first;
    expect(list).toEqual({ folder: 'B' });
  });

  it('drops metadata asked for before another folder started loading', async () => {
    const loads = latestOnly();
    let meta = {};
    const ask = (answer) => { const latest = loads.current(); return answer.promise.then((m) => { if (latest()) meta = { ...meta, ...m }; }); };
    const old = deferred();
    const pending = ask(old); // for folder A
    loads.next(); // folder B starts loading
    const fresh = deferred();
    const now = ask(fresh);
    fresh.resolve({ 'B/1.nef': 1 });
    old.resolve({ 'A/1.nef': 1 });
    await Promise.all([pending, now]);
    expect(meta).toEqual({ 'B/1.nef': 1 });
  });

  it('a scan stays current until another starts', () => {
    const scans = latestOnly();
    const a = scans.next();
    expect(a()).toBe(true);
    expect(scans.current()()).toBe(true);
    scans.next();
    expect(a()).toBe(false);
  });
});
