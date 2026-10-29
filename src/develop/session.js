// Develop's memory while the app runs, so leaving the tab and coming back keeps
// each photo's edits and undo history: photo id -> settings, and photo id ->
// { past, future, pastL, futureL, last }. `edited` holds the photos actually
// changed this session (Export's "Photos edited this session"): opening a photo
// only puts its settings in `settings`. `unsaved` holds photos whose latest
// settings aren't in their sidecar yet; they are never dropped from `settings`.
export const session = { settings: new Map(), history: new Map(), edited: new Set(), unsaved: new Set() };

// Settings are kept for this many photos (most recently used); the others are read
// from their sidecars again. A Retouch layer stack can be large.
export const SETTINGS_PHOTOS = 60;

/** Remembers a photo's current settings; `changed` when they came from an edit, not just opening it. */
export function keepSettings(id, s, changed) {
  session.settings.delete(id);
  session.settings.set(id, s);
  if (changed) session.edited.add(id);
  for (const old of session.settings.keys()) {
    if (session.settings.size <= SETTINGS_PHOTOS) break;
    if (old !== id && !session.unsaved.has(old)) session.settings.delete(old);
  }
}
