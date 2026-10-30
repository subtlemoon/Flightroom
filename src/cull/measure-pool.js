// A few measuring workers (measure.worker.js), each with its own copy of the
// subject detector (about 150 MB). Each works on one photo at a time: a worker
// handed several would start them all at once, holding all their pictures.
export function measurePool(size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 2))) {
  let next = 0;
  const queue = []; // { id, msg, transfer } waiting for a free worker
  const pending = new Map(); // id -> { resolve, reject }
  const settle = (id, err, m) => { const p = pending.get(id); pending.delete(id); if (err) p?.reject(err); else p?.resolve(m); };
  const pump = () => {
    for (const w of workers) {
      if (w.dead || w.job != null || !queue.length) continue;
      const j = queue.shift();
      w.job = j.id;
      w.postMessage(j.msg, j.transfer);
    }
    if (workers.every((w) => w.dead)) for (const j of queue.splice(0)) { j.msg.bmp.close(); settle(j.id, new Error('no measuring workers')); }
  };
  const workers = Array.from({ length: size }, () => {
    const w = new Worker(new URL('./measure.worker.js', import.meta.url)); // a classic worker: MediaPipe loads its runtime with importScripts
    w.job = null;
    w.onmessage = ({ data }) => {
      w.job = null;
      settle(data.id, data.error && new Error(data.error), data.m);
      pump();
    };
    // A worker that fails (or never starts) fails the photo it holds and takes no more.
    w.onerror = (e) => {
      w.dead = true;
      if (w.job != null) settle(w.job, new Error(e.message || 'worker failed'));
      w.job = null;
      pump();
    };
    return w;
  });
  return {
    size,
    // Measures an ImageBitmap (handed over to the worker; don't use it afterwards).
    // `full`: { url, width, height } of the full-size preview's grey parts (photo/gray), where the subject's sharpness is judged.
    measure(bmp, orientation, full) {
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        queue.push({ id, msg: { id, bmp, orientation, full }, transfer: [bmp] });
        pump();
      });
    },
    close() { workers.forEach((w) => w.terminate()); },
  };
}
