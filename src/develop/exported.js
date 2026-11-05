// Photos exported with the edits they have now: the filmstrip's and photo
// name's "Exported" label. Kept across restarts; any edit takes it off.
import { useEffect, useState } from 'react';

const KEY = 'flightroom-exported', MAX = 5000;
let ids;
try { ids = new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch { ids = new Set(); }

export const isExported = (id) => ids.has(id);

/** Labels photos exported (`on`) or takes the label off after an edit. */
export function setExported(list, on) {
  let changed = false;
  for (const id of list) {
    if (!on && !ids.has(id)) continue;
    ids.delete(id); // a new export goes to the back (the oldest are dropped first)
    if (on) ids.add(id);
    changed = true;
  }
  if (!changed) return;
  while (ids.size > MAX) ids.delete(ids.values().next().value);
  try { localStorage.setItem(KEY, JSON.stringify([...ids])); } catch {}
  globalThis.dispatchEvent?.(new Event('photo:exported'));
}

export function useExported(id) {
  const [on, setOn] = useState(() => ids.has(id));
  useEffect(() => {
    const sync = () => setOn(ids.has(id));
    sync();
    window.addEventListener('photo:exported', sync);
    return () => window.removeEventListener('photo:exported', sync);
  }, [id]);
  return on;
}
