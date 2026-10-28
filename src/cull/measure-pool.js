// A few measuring workers (measure.worker.js), each with its own copy of the
// subject detector. Photos go to whichever worker has the least to do.
export function measurePool(size = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 2))) {
  let next = 0;
  const pending = new Map(); // id -> { resolve, reject }
  const workers = Array.from({ length: size }, () => {
    const w = new Worker(new URL('./measure.worker.js', import.meta.url)) // a classic worker: MediaPipe loads its runtime with importScripts;
    w.busy = 0;
    w.onmessage = ({ data }) => {
      w.busy--;
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p?.reject(new Error(data.error)); else p?.resolve(data.m);
    };
    // A worker that fails (or never starts) fails what it holds and takes no more.
    w.onerror = (e) => { w.dead = true; for (const [, p] of pending) p.reject(new Error(e.message || 'worker failed')); pending.clear(); w.busy = 0; };
    return w;
  });
  return {
    size,
    // Measures an ImageBitmap (handed over to the worker; don't use it afterwards).
    // `full`: the URL of the full-size preview, where the subject's sharpness is judged.
    measure(bmp, orientation, full) {
      const live = workers.filter((x) => !x.dead);
      if (!live.length) { bmp.close(); return Promise.reject(new Error('no measuring workers')); }
      const w = live.reduce((a, b) => (b.busy < a.busy ? b : a));
      const id = next++;
      w.busy++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ id, bmp, orientation, full }, [bmp]);
      });
    },
    close() { workers.forEach((w) => w.terminate()); },
  };
}
