// Virtual copies, as in Lightroom: another version of a photo with its own
// develop settings and stars (its own sidecar, "<name> [Copy N].xmp"; see
// src-tauri photos.rs). A copy's id is its photo's path + "|copy-N".

import { confirmAction, photoLabel } from '../components/menu.jsx';

const TAG = /\|copy-\d+$/;

/** The photo file an id stands for (a copy's photo). */
export const fileOf = (id) => id.replace(TAG, '');

/** Puts a new copy into a folder list, after its photo and that photo's other copies. */
export function withCopy(list, copy) {
  const file = fileOf(copy.id);
  let at = -1;
  list.forEach((p, i) => { if (fileOf(p.id) === file) at = i; });
  return at < 0 ? [...list, copy] : [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
}

/**
 * Makes a virtual copy of `photo` (with its settings as now saved: `saved` is
 * the photo's pending save) and adds it to the list. Answers the copy or { error }.
 */
export async function makeCopy(cull, photo, setList, saved) {
  await saved;
  const res = await cull.virtualCopy(photo);
  if (res?.error) return res;
  const copy = { ...photo, id: res.id, sidecar: res.sidecar, copy: res.copy, rating: res.rating, ratingIn: 'sidecar', developed: res.developed };
  setList((l) => (l?.photos ? { ...l, photos: withCopy(l.photos, copy) } : l));
  return copy;
}

/** Removes a virtual copy (its sidecar) and takes it off the list. */
export async function removeCopy(cull, photo, setList) {
  if (!photo.copy) return { error: 'Not a virtual copy' };
  const res = await cull.removeCopy(photo);
  if (res?.error) return res;
  setList((l) => (l?.photos ? { ...l, photos: l.photos.filter((p) => p.id !== photo.id) } : l));
  return res;
}

/**
 * The virtual-copy commands of a photo view. toast(text); show(copy) opens a
 * new copy; saved(p) waits for p's pending settings save; forget(p) drops
 * what the view kept about a removed copy.
 */
export function copyActions({ cull, setList, toast, show, saved = () => null, forget = () => {} }) {
  return {
    async make(p) {
      if (!p?.raw) { toast('Virtual copies are for RAW photos'); return; }
      const res = await makeCopy(cull, p, setList, saved(p));
      if (res?.error) { toast(`Couldn't make a virtual copy: ${res.error}`); return; }
      show(res);
      toast(`Made ${photoLabel(res)}`);
    },
    askRemove(p) {
      confirmAction({
        title: 'Remove this virtual copy?', ok: 'Remove',
        text: `${photoLabel(p)} and its own edits and stars go (its sidecar, ${p.sidecar.split(/[\\/]/).pop()}, is deleted). The photo and its other versions stay.`,
        onOk: async () => {
          await saved(p);
          const res = await removeCopy(cull, p, setList);
          if (res?.error) toast(`Couldn't remove it: ${res.error}`);
          else forget(p);
        },
      });
    },
  };
}
