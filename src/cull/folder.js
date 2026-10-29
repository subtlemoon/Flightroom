// The open folder as last seen by Culling or Develop: its photo list, what has
// been read about each photo and the star filter. Switching tabs shows the
// photos at once from here, while the folder is read again quietly for new
// files and outside changes.

let last = null; // { folder, list, meta, filter }

export const cachedFolder = (folder) => (folder && last?.folder === folder && last.list ? last : null);

export function keepFolder(folder, part) {
  if (!folder) return;
  if (last?.folder !== folder) last = { folder };
  Object.assign(last, part);
}

// Same photos with the same stars: nothing to update.
export const sameList = (a, b) => a.length === b.length && a.every((p, i) => p.id === b[i].id && p.rating === b[i].rating);

/**
 * For answers that can arrive out of order (folder scans): next() starts a new
 * request and current() joins the latest; each returns a check that stays true
 * only until another request starts.
 */
export function latestOnly() {
  let n = 0;
  const check = (id) => () => id === n;
  return { next: () => check(++n), current: () => check(n) };
}
