import { describe, expect, it } from 'vitest';
import { bySubject, subjectCounts, subjectGroup } from './subjects.js';

const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
const measured = {
  a: { subject: { label: 'truck' } },
  b: { subject: null },
  c: { subject: { label: 'person' } },
  d: { subject: { label: 'bird' } },
  // e not analyzed
  f: { subject: { label: 'boat' } },
};

describe('subjects', () => {
  it('groups detection labels', () => {
    expect(subjectGroup(measured.a)).toBe('vehicles');
    expect(subjectGroup(measured.b)).toBe('none');
    expect(subjectGroup(measured.d)).toBe('animals');
    expect(subjectGroup({ subject: { label: 'kite' } })).toBe('sports');
    expect(subjectGroup(undefined)).toBe('unknown');
  });
  it('sorts by group, keeping shot order inside one, not analyzed last', () => {
    expect(bySubject(photos, 'sort', measured).map((p) => p.id)).toEqual(['c', 'a', 'f', 'd', 'b', 'e']);
  });
  it('filters to one group and leaves "all" alone', () => {
    expect(bySubject(photos, 'vehicles', measured).map((p) => p.id)).toEqual(['a', 'f']);
    expect(bySubject(photos, 'all', measured)).toBe(photos);
  });
  it('counts', () => {
    expect(subjectCounts(photos, measured)).toEqual({ people: 1, vehicles: 2, animals: 1, sports: 0, none: 1, unknown: 1 });
  });
});
