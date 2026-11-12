// The Library's search, filters and sorting over the catalog (catalog.rs), as
// plain functions so they're easy to test. A photo here is a catalog entry:
// the Culling photo plus folder, camera, lens, date and settings.
import { inFilter } from './filter.js';

export const entryRating = (p) => p.rating ?? p.fileRating ?? 0;
export const cameraOf = (p) => (p.model ? (p.make && !p.model.toLowerCase().startsWith(p.make.split(' ')[0].toLowerCase()) ? `${p.make} ${p.model}` : p.model) : '');

/** The date a photo was taken ("YYYY-MM-DD"), else the file's date. */
export function dayOf(p) {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(p.takenAt || '');
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (!p.modified) return '';
  const d = new Date(p.modified);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const timeOf = (p) => {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(p.takenAt || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : p.modified || 0;
};

const lower = (s) => (s || '').toLowerCase();
const haystack = (p) => [p.name, p.folder, cameraOf(p), p.lens, dayOf(p), ...(p.keywords || [])].map(lower).join('\n');

export const SORTS = [
  ['new', 'Newest first'],
  ['old', 'Oldest first'],
  ['name', 'File name'],
  ['stars', 'Most stars'],
];

/**
 * The photos a view shows. `f`: { source: { kind: 'all' | 'folder' | 'collection' | 'keyword', path, ids, keyword },
 * q (words, all must match), camera, lens, date ('YYYY' or 'YYYY-MM'), stars (Culling's filter names), edited ('yes' | 'no'), sort }.
 */
export function filterPhotos(photos, f) {
  const src = f.source || { kind: 'all' };
  const inCollection = src.kind === 'collection' ? new Set(src.ids || []) : null;
  const sep = /[\\/]/;
  const folderOf = (p) => p.id.replace(/\|copy-\d+$/, '').split(sep).slice(0, -1).join('/').toLowerCase();
  const wantFolder = src.kind === 'folder' ? src.path.split(sep).join('/').toLowerCase() : null;
  const words = lower(f.q).split(/\s+/).filter(Boolean);
  const kw = lower(src.keyword);
  const out = photos.filter((p) => {
    if (inCollection && !inCollection.has(p.id)) return false;
    if (wantFolder != null) { const d = folderOf(p); if (d !== wantFolder && !d.startsWith(`${wantFolder}/`)) return false; }
    if (src.kind === 'keyword' && !(p.keywords || []).some((k) => lower(k) === kw)) return false;
    if (f.camera && cameraOf(p) !== f.camera) return false;
    if (f.lens && (p.lens || '') !== f.lens) return false;
    if (f.date && !dayOf(p).startsWith(f.date)) return false;
    if (f.stars && f.stars !== 'all' && !inFilter(f.stars, entryRating(p))) return false;
    if (f.edited === 'yes' && !p.developed) return false;
    if (f.edited === 'no' && p.developed) return false;
    if (words.length) { const h = haystack(p); if (!words.every((w) => h.includes(w))) return false; }
    return true;
  });
  const by = f.sort || 'new';
  const name = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || (a.copy || 0) - (b.copy || 0);
  if (by === 'new') out.sort((a, b) => timeOf(b) - timeOf(a) || name(a, b));
  else if (by === 'old') out.sort((a, b) => timeOf(a) - timeOf(b) || name(a, b));
  else if (by === 'name') out.sort(name);
  else if (by === 'stars') out.sort((a, b) => entryRating(b) - entryRating(a) || timeOf(b) - timeOf(a));
  return out;
}

/** What the filter menus offer, from the photos: cameras, lenses, years and months, keywords, each with a count. */
export function facets(photos) {
  const count = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  const cams = new Map(), lenses = new Map(), dates = new Map(), kws = new Map();
  const kwName = new Map();
  for (const p of photos) {
    count(cams, cameraOf(p));
    count(lenses, p.lens);
    const d = dayOf(p);
    if (d) { count(dates, d.slice(0, 4)); count(dates, d.slice(0, 7)); }
    for (const k of p.keywords || []) { const l = lower(k); if (!kwName.has(l)) kwName.set(l, k); count(kws, l); }
  }
  const list = (m) => [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(b[0]));
  return {
    cameras: list(cams),
    lenses: list(lenses),
    dates: [...dates].sort((a, b) => (a[0].slice(0, 4) === b[0].slice(0, 4) ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))),
    keywords: [...kws].map(([l, n]) => [kwName.get(l), n]).sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })),
  };
}

/** Keywords on every one of these photos, and on only some. */
export function sharedKeywords(photos) {
  if (!photos.length) return { all: [], some: [] };
  const n = new Map(), name = new Map();
  for (const p of photos) for (const k of new Set((p.keywords || []).map(lower))) { n.set(k, (n.get(k) || 0) + 1); if (!name.has(k)) name.set(k, p.keywords.find((x) => lower(x) === k)); }
  const all = [], some = [];
  for (const [k, c] of n) (c === photos.length ? all : some).push(name.get(k));
  const sort = (a) => a.sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
  return { all: sort(all), some: sort(some) };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateLabel = (d) => (d.length === 4 ? d : `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`);
