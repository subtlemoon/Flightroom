// Sorting and filtering Culling by what each photo is of, from the subject that
// auto-rate's detection model found (analyze.js measure().subject). Nothing new
// is measured: a photo analyzed once can be grouped at once.

const KINDS = {
  person: 'people',
  bicycle: 'vehicles', car: 'vehicles', motorcycle: 'vehicles', airplane: 'vehicles', bus: 'vehicles', train: 'vehicles', truck: 'vehicles', boat: 'vehicles',
  bird: 'animals', cat: 'animals', dog: 'animals', horse: 'animals', sheep: 'animals', cow: 'animals', elephant: 'animals', bear: 'animals', zebra: 'animals', giraffe: 'animals',
  'sports ball': 'sports', kite: 'sports', skateboard: 'sports', surfboard: 'sports', skis: 'sports', snowboard: 'sports', frisbee: 'sports',
};

// In the order groups are shown when sorted.
export const SUBJECT_GROUPS = [
  ['people', 'People'],
  ['vehicles', 'Vehicles'],
  ['animals', 'Animals'],
  ['sports', 'Sports gear'],
  ['none', 'No clear subject'],
];
const ORDER = Object.fromEntries([...SUBJECT_GROUPS.map(([k], i) => [k, i]), ['unknown', SUBJECT_GROUPS.length]]);
export const subjectName = (g) => SUBJECT_GROUPS.find(([k]) => k === g)?.[1] || 'Not analyzed yet';

/** A photo's group from its measurements: 'unknown' until analyzed. */
export function subjectGroup(m) {
  if (!m) return 'unknown';
  return m.subject ? KINDS[m.subject.label] || 'none' : 'none';
}

/**
 * The photos for a subject view: 'all' (as they are), 'sort' (grouped in
 * SUBJECT_GROUPS order, shot order kept within a group, not analyzed last), or a
 * group's key (only that group).
 */
export function bySubject(photos, view, measured) {
  if (view === 'all') return photos;
  if (view === 'sort') {
    return photos.map((p, i) => [ORDER[subjectGroup(measured[p.id])], i, p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
  }
  return photos.filter((p) => subjectGroup(measured[p.id]) === view);
}

/** How many photos are in each group: { people: 3, ..., unknown: 0 }. */
export function subjectCounts(photos, measured) {
  const out = { unknown: 0 };
  for (const [k] of SUBJECT_GROUPS) out[k] = 0;
  for (const p of photos) out[subjectGroup(measured[p.id])]++;
  return out;
}
