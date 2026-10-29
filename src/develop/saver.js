// Saves Develop settings to sidecars a moment after the last change. Moving to
// another photo or leaving Develop writes a pending save at once instead of
// dropping it, and writes to one sidecar run one after another, so an older
// save never lands after a newer one.

/**
 * write(sidecar, settings) -> promise of the bridge's answer ({ error } on failure).
 * unsaved: photo ids whose latest settings aren't in their sidecar yet (pending,
 * being written, or failed); onError(save, err) when a write fails.
 */
export function createSaver(write, { delay = 500, unsaved = new Set(), onError = () => {} } = {}) {
  let pending = null; // { id, sidecar, s, seq, timer }
  let n = 0;
  const latest = new Map(); // photo id -> seq of its newest save
  const chains = new Map(); // sidecar -> the last job queued for it

  /** Runs job() after every job already queued for this sidecar. */
  const queue = (sidecar, job) => {
    const run = (chains.get(sidecar) || Promise.resolve()).then(job);
    const tail = run.catch(() => {});
    chains.set(sidecar, tail);
    tail.then(() => { if (chains.get(sidecar) === tail) chains.delete(sidecar); });
    return run;
  };

  /** Starts the pending save now (resolves once it is written or has failed). */
  const flush = () => {
    const p = pending;
    if (!p) return Promise.resolve();
    pending = null;
    clearTimeout(p.timer);
    return queue(p.sidecar, () => write(p.sidecar, p.s))
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        if (latest.get(p.id) === p.seq) { latest.delete(p.id); unsaved.delete(p.id); }
      })
      .catch((err) => onError(p, err));
  };

  return {
    /** Saves `s` for this photo after the delay, replacing its own pending save; another photo's is written now. */
    schedule(id, sidecar, s) {
      if (pending && pending.id !== id) flush();
      else if (pending) clearTimeout(pending.timer);
      const seq = ++n;
      latest.set(id, seq);
      unsaved.add(id);
      pending = { id, sidecar, s, seq, timer: setTimeout(flush, delay) };
    },
    flush,
    queue,
    /** Resolves once everything queued for this sidecar (a pending save too) is done. */
    idle(sidecar) {
      if (pending?.sidecar === sidecar) flush();
      return chains.get(sidecar) || Promise.resolve();
    },
  };
}
