import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_PHOTOS, keepSettings, session } from './session.js';

describe('Develop session memory', () => {
  beforeEach(() => { session.settings.clear(); session.edited.clear(); session.unsaved.clear(); });

  it("doesn't count a photo that was only opened as edited", () => {
    keepSettings('a.nef', { exposure: 0 }, false);
    expect(session.settings.has('a.nef')).toBe(true);
    expect(session.edited.has('a.nef')).toBe(false);
  });

  it('counts a photo once it is changed, and keeps counting it', () => {
    keepSettings('a.nef', { exposure: 0 }, false);
    keepSettings('a.nef', { exposure: 1 }, true);
    expect(session.edited.has('a.nef')).toBe(true);
    // Coming back to it later (only viewing) leaves it edited.
    keepSettings('a.nef', { exposure: 1 }, false);
    expect([...session.edited]).toEqual(['a.nef']);
  });

  it('keeps settings for a bounded number of photos, never dropping unsaved ones', () => {
    session.unsaved.add('p0');
    for (let i = 0; i < SETTINGS_PHOTOS + 10; i++) keepSettings(`p${i}`, { layers: [] }, false);
    expect(session.settings.size).toBe(SETTINGS_PHOTOS);
    expect(session.settings.has('p0')).toBe(true); // unsaved: kept although oldest
    expect(session.settings.has('p1')).toBe(false);
    expect(session.settings.has(`p${SETTINGS_PHOTOS + 9}`)).toBe(true);
    // Using a photo again makes it the most recent.
    keepSettings('p20', { layers: [] }, false);
    keepSettings('new', { layers: [] }, false);
    expect(session.settings.has('p20')).toBe(true);
  });
});
