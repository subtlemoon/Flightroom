// The gear catalog (and Jaewon's own gear) is also published as catalog.json on
// GitHub, so spec fixes and new gear reach the app without an app update.
export const CATALOG_URL = 'https://raw.githubusercontent.com/subtlemoon/gearcheck/main/catalog.json';
const CACHE_KEY = 'gearcheck-catalog';
const REFRESH_MS = 30 * 60 * 1000;

export function isValidCatalog(c) {
  return !!c && Array.isArray(c.gear) && c.gear.length > 0
    && c.gear.every((g) => g && typeof g.id === 'string' && ['body', 'lens', 'accessory'].includes(g.type))
    && Array.isArray(c.myGear) && Array.isArray(c.myGroups);
}

export function cachedCatalog() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    return isValidCatalog(c) ? c : null;
  } catch {
    return null;
  }
}

export async function fetchCatalog() {
  const res = await fetch(`${CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const c = await res.json();
  if (!isValidCatalog(c)) throw new Error('catalog is malformed');
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
  return c;
}

// Calls onCatalog with the latest catalog now and every 30 minutes. Failures
// (offline, GitHub down) are ignored and the cached or built-in list stays.
export function watchCatalog(onCatalog, onError = () => {}) {
  const run = () => fetchCatalog().then(onCatalog).catch(onError);
  run();
  const timer = setInterval(run, REFRESH_MS);
  return () => clearInterval(timer);
}
