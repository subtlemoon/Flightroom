import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from './data/gear.js';
import { SEED_GROUPS } from './data/presets.js';
import { MY_GEAR, MY_GROUPS } from './data/mygear.js';
import { cachedCatalog, cachedNews, fetchCatalog, fetchNews, watchCatalog } from './remote.js';
import BUNDLED_NEWS from '../news.json';

const KEY = 'gearcheck-v1';

const initial = () => ({
  custom: {},
  overrides: {},
  owned: [],
  groups: structuredClone(SEED_GROUPS),
  settings: { apps: ['lightroom', 'premiere', 'resolve'] },
});

// Latest known catalog: from GitHub if it was ever fetched, else the built-in one.
const startCatalog = () => cachedCatalog() || { gear: CATALOG, myGear: MY_GEAR, myGroups: MY_GROUPS };

function load(catalog) {
  let s = initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch {}
  return seedOwned(s, catalog);
}

function seedOwned(s, { myGear, myGroups }) {
  const seeded = s.seededOwned || [];
  const fresh = myGear.filter((id) => !seeded.includes(id));
  const seededGroups = s.seededGroups || [];
  const newGroups = myGroups.filter((g) => !seededGroups.includes(g.id) && !s.groups.some((x) => x.id === g.id));
  // Newly listed gear also joins existing copies of the seeded presets.
  const presetDefs = Object.fromEntries(myGroups.flatMap((g) => g.presets).map((p) => [p.id, p]));
  const groups = s.groups.map((g) => ({
    ...g,
    presets: g.presets.map((p) => {
      const def = presetDefs[p.id];
      if (!def || !fresh.length) return p;
      const merge = (k) => [...p[k], ...def[k].filter((id) => fresh.includes(id) && !p[k].includes(id))];
      return { ...p, bodyIds: merge('bodyIds'), lensIds: merge('lensIds'), accessoryIds: merge('accessoryIds') };
    }),
  }));
  return {
    ...s,
    owned: [...new Set([...s.owned, ...fresh])],
    seededOwned: [...seeded, ...fresh],
    groups: [...structuredClone(newGroups), ...groups],
    seededGroups: [...new Set([...seededGroups, ...myGroups.map((g) => g.id)])],
  };
}

export const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useStore() {
  const [catalog, setCatalog] = useState(startCatalog);
  const [news, setNews] = useState(() => cachedNews() || BUNDLED_NEWS);
  const [state, setState] = useState(() => load(catalog));

  // status: 'loading' | 'ok' | 'error'; at: time of the last successful fetch.
  const [catalogStatus, setCatalogStatus] = useState({ status: 'loading', at: null });
  const applyCatalog = (c) => {
    setCatalog(c);
    setState((s) => seedOwned(s, c));
    setCatalogStatus({ status: 'ok', at: Date.now() });
  };
  useEffect(() => watchCatalog((c) => {
    applyCatalog(c);
    fetchNews().then(setNews).catch(() => {});
  }, () => setCatalogStatus((st) => ({ ...st, status: 'error' }))), []);
  const refreshCatalog = async () => {
    setCatalogStatus((st) => ({ ...st, status: 'loading' }));
    try {
      const [c, n] = await Promise.all([fetchCatalog(), fetchNews().catch(() => null)]);
      applyCatalog(c);
      if (n) setNews(n);
    } catch {
      setCatalogStatus((st) => ({ ...st, status: 'error' }));
    }
  };

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const gear = useMemo(() => {
    const builtIn = catalog.gear.map((g) => ({ ...g, ...state.overrides[g.id], builtIn: true }));
    const custom = Object.values(state.custom).map((g) => ({ ...g, builtIn: false }));
    return [...builtIn, ...custom];
  }, [catalog, state.custom, state.overrides]);
  const gearById = useMemo(() => Object.fromEntries(gear.map((g) => [g.id, g])), [gear]);

  const update = (fn) => setState((s) => fn(structuredClone(s)) );

  const mapGroup = (s, groupId, fn) => { s.groups = s.groups.map((g) => (g.id === groupId ? fn(g) || g : g)); return s; };

  const actions = {
    toggleOwned: (id) => update((s) => {
      s.owned = s.owned.includes(id) ? s.owned.filter((x) => x !== id) : [...s.owned, id];
      return s;
    }),
    saveGear: (item) => update((s) => {
      if (catalog.gear.some((g) => g.id === item.id)) {
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
    // Opens a folder (or goes back to the folder list with null). Opened folders
    // are remembered, most recent first, for the list on the Culling home page.
    setCullFolder: (folder) => update((s) => {
      if (!folder) { s.cull = { ...s.cull, folder: null }; return s; }
      const recent = (s.cull?.recent || []).filter((f) => f !== folder);
      s.cull = { ...s.cull, folder, recent: [folder, ...recent].slice(0, 50) };
      return s;
    }),
    forgetCullFolder: (folder) => update((s) => {
      const { [folder]: _, ...stats } = s.cull?.stats || {};
      s.cull = { ...s.cull, recent: (s.cull?.recent || []).filter((f) => f !== folder), stats };
      return s;
    }),
    // Photo and rated counts shown in the folder list: { photos, rated, at }.
    setCullStats: (folder, stats) => update((s) => {
      s.cull = { ...s.cull, stats: { ...s.cull?.stats, [folder]: { ...stats, at: Date.now() } } };
      return s;
    }),
    setCullPosition: (folder, index) => update((s) => {
      s.cull = { ...s.cull, positions: { ...s.cull?.positions, [folder]: index } };
      return s;
    }),
    setSettings: (patch) => update((s) => { s.settings = { ...s.settings, ...patch }; return s; }),
    setCullSettings: (patch) => update((s) => { s.settings = { ...s.settings, ...patch }; return s; }),
    setApps: (apps) => update((s) => { s.settings.apps = apps; return s; }),
    markNewsSeen: (monthId) => update((s) => { s.newsSeen = monthId; return s; }),
    importData: (data) => setState({ ...initial(), ...data }),
    resetAll: () => setState(seedOwned(initial(), catalog)),
  };

  return { state, gear, gearById, actions, catalogStatus, refreshCatalog, news };
}

export const listKey = (item) => (item.type === 'body' ? 'bodyIds' : item.type === 'lens' ? 'lensIds' : 'accessoryIds');
