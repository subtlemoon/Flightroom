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

// Monthly news (news.json in the repo), loaded the same way as the catalog.
export const NEWS_URL = 'https://raw.githubusercontent.com/subtlemoon/gearcheck/main/news.json';
const NEWS_CACHE_KEY = 'gearcheck-news';

export function isValidNews(n) {
  return !!n && Array.isArray(n.months)
    && n.months.every((m) => m && typeof m.id === 'string' && typeof m.title === 'string' && Array.isArray(m.items));
}

export function cachedNews() {
  try {
    const n = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY));
    return isValidNews(n) ? n : null;
  } catch {
    return null;
  }
}

export async function fetchNews() {
  const res = await fetch(`${NEWS_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`news fetch failed: ${res.status}`);
  const n = await res.json();
  if (!isValidNews(n)) throw new Error('news is malformed');
  try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(n)); } catch {}
  return n;
}
