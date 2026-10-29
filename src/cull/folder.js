// The open folder as last seen by Culling or Develop: its photo list, what has
// been read about each photo and the star filter. Switching tabs shows the
// photos at once from here, while the folder is read again quietly for new
// files and outside changes.

import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Where to start in a folder just read: where you left it. */
export const startAt = (res, positions) => Math.min(positions?.[res.folder] || 0, Math.max(0, res.photos.length - 1));

/**
 * The open folder as Culling and Develop keep it: its photo list and what has
 * been read about each photo. The folder seen last (`seen`, from cachedFolder)
 * shows at once and is read again quietly; another is read anew, and `fresh(res)`
 * then sets the view up for it. Answers arriving after another folder was asked
 * for are dropped.
 */
export function useFolder(bridge, folder, seen, filter, fresh) {
  const [list, setList] = useState(seen?.list || null); // { folder, photos } | { loading } | { error }
  const [meta, setMeta] = useState(seen?.meta || {});
  const asked = useRef();
  asked.current ||= new Set(Object.keys(meta));
  const [scans] = useState(latestOnly);
  const [loads] = useState(latestOnly);
  const onFresh = useRef();
  onFresh.current = fresh;

  const open = useCallback(async (dir, reload) => {
    if (!bridge || !dir) return;
    const latest = scans.next();
    if (!reload && cachedFolder(dir)) {
      const res = await bridge.scan(dir);
      if (latest() && !res.error) setList((l) => (l?.photos && sameList(l.photos, res.photos) ? l : res));
      return;
    }
    setList({ loading: true, folder: dir });
    loads.next(); // metadata still coming for the folder before is dropped
    const res = await bridge.scan(dir);
    if (!latest()) return;
    if (res.error) { setList({ error: res.error, folder: dir }); return; }
    setMeta({});
    asked.current = new Set();
    onFresh.current?.(res);
    setList(res);
  }, [bridge]);
  useEffect(() => { if (folder) open(folder); }, [folder, open]);
  useEffect(() => { if (list?.photos && list.folder) keepFolder(folder, { list, meta, filter }); }, [list, meta, filter]);

  // Reads what isn't known yet about these photos, once each.
  const requestMeta = useCallback((ids) => {
    const want = ids.filter((id) => id && !asked.current.has(id));
    if (!want.length || !bridge) return;
    want.forEach((id) => asked.current.add(id));
    const latest = loads.current();
    bridge.meta(want).then((m) => { if (latest() && !m.error) setMeta((old) => ({ ...old, ...m })); });
  }, [bridge]);

  return { list, setList, meta, setMeta, open, requestMeta };
}

/** Remembers where you are in the folder (the other tab opens the same photo); at once when the view closes. */
export function usePosition(actions, folder, pos) {
  const last = useRef(null);
  useEffect(() => {
    if (!folder || pos < 0) return;
    last.current = [folder, pos];
    const t = setTimeout(() => actions.setCullPosition(folder, pos), 400);
    return () => clearTimeout(t);
  }, [folder, pos]);
  useEffect(() => () => { if (last.current) actions.setCullPosition(...last.current); }, []);
}
