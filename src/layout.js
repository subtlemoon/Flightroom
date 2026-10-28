// Which panels are showing: the left sidebar, Develop's right panel and the
// filmstrip. Remembered between launches; every component that uses it stays
// in sync. Keys as in Lightroom: Tab = both side panels, F6 = filmstrip,
// F7 = left, F8 = right.
import { useEffect, useState } from 'react';

const KEY = 'flightroom-layout';
const DEFAULT = { nav: true, panel: true, strip: true };
let layout = DEFAULT;
try { layout = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}
const listeners = new Set();

export function setLayout(change) {
  layout = { ...layout, ...(typeof change === 'function' ? change(layout) : change) };
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
  listeners.forEach((fn) => fn(layout));
}

export const toggle = (part) => setLayout((l) => ({ [part]: !l[part] }));

// Tab shows both side panels if either is hidden, else hides both.
export const toggleSides = () => setLayout((l) => {
  const show = !l.nav || !l.panel;
  return { nav: show, panel: show };
});

export function useLayout() {
  const [l, set] = useState(layout);
  useEffect(() => {
    listeners.add(set);
    set(layout);
    return () => listeners.delete(set);
  }, []);
  return l;
}
