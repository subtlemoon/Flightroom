// Develop's memory while the app runs, so leaving the tab and coming back keeps
// each photo's edits and undo history: photo id -> settings, and photo id ->
// { past, future, pastL, futureL, last }.
export const session = { settings: new Map(), history: new Map() };
