import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from './data/gear.js';
import { SEED_GROUPS } from './data/presets.js';
import { MY_GEAR, MY_GROUPS } from './data/mygear.js';

const KEY = 'gearcheck-v1';

const initial = () => ({
  custom: {},
  overrides: {},
  owned: [],
  groups: structuredClone(SEED_GROUPS),
  settings: { apps: ['lightroom', 'premiere', 'resolve'] },
});

function load() {
  let s = initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch {}
  return seedOwned(s);
}

function seedOwned(s) {
  const seeded = s.seededOwned || [];
  const fresh = MY_GEAR.filter((id) => !seeded.includes(id));
  const seededGroups = s.seededGroups || [];
  const newGroups = MY_GROUPS.filter((g) => !seededGroups.includes(g.id) && !s.groups.some((x) => x.id === g.id));
  return {
    ...s,
    owned: [...new Set([...s.owned, ...fresh])],
    seededOwned: [...seeded, ...fresh],
    groups: [...structuredClone(newGroups), ...s.groups],
    seededGroups: [...seededGroups, ...MY_GROUPS.map((g) => g.id)],
  };
}

export const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useStore() {
  const [state, setState] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const gear = useMemo(() => {
    const builtIn = CATALOG.map((g) => ({ ...g, ...state.overrides[g.id], builtIn: true }));
    const custom = Object.values(state.custom).map((g) => ({ ...g, builtIn: false }));
    return [...builtIn, ...custom];
  }, [state.custom, state.overrides]);
  const gearById = useMemo(() => Object.fromEntries(gear.map((g) => [g.id, g])), [gear]);

  const update = (fn) => setState((s) => fn(structuredClone(s)) );

  const mapGroup = (s, groupId, fn) => { s.groups = s.groups.map((g) => (g.id === groupId ? fn(g) || g : g)); return s; };

  const actions = {
    toggleOwned: (id) => update((s) => {
      s.owned = s.owned.includes(id) ? s.owned.filter((x) => x !== id) : [...s.owned, id];
      return s;
    }),
    saveGear: (item) => update((s) => {
      if (CATALOG.some((g) => g.id === item.id)) {
        const { builtIn, ...rest } = item;
        s.overrides[item.id] = rest;
      } else {
        const { builtIn, ...rest } = item;
        s.custom[item.id] = rest;
      }
      return s;
    }),
    resetGear: (id) => update((s) => { delete s.overrides[id]; return s; }),
    deleteGear: (id) => update((s) => {
      delete s.custom[id];
      s.owned = s.owned.filter((x) => x !== id);
      for (const g of s.groups) for (const p of g.presets) {
        p.bodyIds = p.bodyIds.filter((x) => x !== id);
        p.lensIds = p.lensIds.filter((x) => x !== id);
        p.accessoryIds = p.accessoryIds.filter((x) => x !== id);
      }
      return s;
    }),
    setFirmware: (id, firmware) => update((s) => {
      s.overrides[id] = { ...s.overrides[id], firmware };
      if (s.custom[id]) { s.custom[id].firmware = firmware; delete s.overrides[id]; }
      return s;
    }),
    addGroup: (group) => update((s) => { s.groups.push({ id: uid('g'), presets: [], ...group }); return s; }),
    updateGroup: (groupId, patch) => update((s) => mapGroup(s, groupId, (g) => ({ ...g, ...patch }))),
    deleteGroup: (groupId) => update((s) => { s.groups = s.groups.filter((g) => g.id !== groupId); return s; }),
    addPreset: (groupId, preset) => update((s) => mapGroup(s, groupId, (g) => {
      g.presets.push({ id: uid('p'), bodyIds: [], lensIds: [], accessoryIds: [], notes: '', ...preset });
    })),
    updatePreset: (groupId, presetId, patch) => update((s) => mapGroup(s, groupId, (g) => {
      g.presets = g.presets.map((p) => (p.id === presetId ? { ...p, ...patch } : p));
    })),
    deletePreset: (groupId, presetId) => update((s) => mapGroup(s, groupId, (g) => {
      g.presets = g.presets.filter((p) => p.id !== presetId);
    })),
    duplicatePreset: (groupId, presetId) => update((s) => mapGroup(s, groupId, (g) => {
      const p = g.presets.find((x) => x.id === presetId);
      if (p) g.presets.push({ ...structuredClone(p), id: uid('p'), name: `${p.name} (copy)` });
    })),
    setApps: (apps) => update((s) => { s.settings.apps = apps; return s; }),
    importData: (data) => setState({ ...initial(), ...data }),
    resetAll: () => setState(seedOwned(initial())),
  };

  return { state, gear, gearById, actions };
}

export const listKey = (item) => (item.type === 'body' ? 'bodyIds' : item.type === 'lens' ? 'lensIds' : 'accessoryIds');
