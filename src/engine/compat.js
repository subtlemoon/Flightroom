import { CROP_SENSORS } from '../data/gear.js';
import { EDITING_APPS, RAW_PHOTO_SUPPORT, VIDEO_SUPPORT, supportFor } from '../data/software.js';

export const LEVELS = { ok: 0, info: 1, warn: 2, bad: 3 };
export const worst = (levels) => levels.reduce((a, b) => (LEVELS[b] > LEVELS[a] ? b : a), 'ok');

// Compares dotted version strings: '2.20' vs '3.00'. Returns -1, 0 or 1.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const AF_LEVEL = { full: 'ok', good: 'ok', limited: 'warn', mf: 'warn', none: 'bad' };
const AF_TEXT = {
  full: 'Full autofocus',
  good: 'Autofocus works',
  limited: 'Autofocus may be slow or unreliable',
  mf: 'Manual focus only',
  none: 'Does not work',
};

export function adapterAf(adapter, lens) {
  if (adapter.afByFType && lens.fType) {
    const af = adapter.afByFType[lens.fType] || 'mf';
    // Third-party lenses usually work but aren't guaranteed by the adapter maker.
    return af === 'full' && adapter.thirdParty && lens.brand !== adapter.brand ? adapter.thirdParty : af;
  }
  return adapter.afByBrand?.[lens.brand] || adapter.af || 'limited';
}

function coverageCheck(body, lens) {
  const cropLens = CROP_SENSORS.includes(lens.coverage);
  if (body.sensor === 'Full Frame' && cropLens) {
    return { level: 'warn', note: `${lens.coverage} lens on a full-frame body: the camera shoots in crop mode (fewer megapixels).` };
  }
  if (CROP_SENSORS.includes(body.sensor) && lens.coverage === 'Full Frame') {
    return { level: 'ok', note: `Full-frame lens on a ${body.sensor} body: field of view is cropped (about 1.5×).` };
  }
  return { level: 'ok', note: '' };
}

// How one lens works on one body, given the adapters in the kit and in the catalog.
export function lensOnBody(body, lens, kitAdapters, catalogAdapters = []) {
  const cov = coverageCheck(body, lens);
  if (lens.mount === body.mount) {
    return { level: cov.level, label: cov.level === 'ok' ? 'Native fit' : 'Crop mode', notes: ['Same mount.', cov.note].filter(Boolean) };
  }
  const fits = (a) => a.fromMount === lens.mount && a.toMount === body.mount;
  const adapter = kitAdapters.find(fits);
  if (adapter) {
    const af = adapterAf(adapter, lens);
    const level = worst([AF_LEVEL[af], cov.level]);
    const notes = [`Via ${adapter.brand} ${adapter.model}: ${AF_TEXT[af].toLowerCase()}.`];
    if (lens.fType) notes.push(`${lens.fType} lens.`);
    if (adapter.thirdParty && lens.brand !== adapter.brand) notes.push(`${adapter.brand} doesn't officially guarantee ${lens.brand} lenses. Keep the lens firmware up to date.`);
    if (cov.note) notes.push(cov.note);
    return { level, label: AF_TEXT[af], adapterId: adapter.id, notes };
  }
  const options = catalogAdapters.filter(fits);
  if (options.length) {
    return {
      level: 'warn',
      label: 'Needs adapter',
      notes: [`${lens.mount} lens on ${body.mount} body. Add an adapter such as ${options.map((a) => `${a.brand} ${a.model}`).join(' or ')}.`],
    };
  }
  return { level: 'bad', label: 'Incompatible mount', notes: [`No known adapter from ${lens.mount} to ${body.mount}.`] };
}

const slotAccepts = (slot, cardType) => slot.split(' / ').includes(cardType);

// Card check for one body; firmware may unlock a card type.
export function cardOnBody(body, card) {
  if (body.cardSlots.some((s) => slotAccepts(s, card.cardType))) return { level: 'ok', note: '' };
  const feature = body.firmwareFeatures.find((f) => f.cards?.includes(card.cardType));
  if (feature) return firmwareGate(body, feature, 'bad');
  return { level: 'bad', note: `${body.model} has no ${card.cardType} slot.` };
}

function firmwareGate(body, feature, belowLevel = 'warn') {
  if (!body.firmware) {
    return { level: 'warn', note: `${feature.feature} needs firmware ${feature.minFirmware} or later. Set your ${body.model} firmware version to confirm.` };
  }
  if (compareVersions(body.firmware, feature.minFirmware) < 0) {
    return { level: belowLevel, note: `${feature.feature} needs firmware ${feature.minFirmware}+, your ${body.model} is on ${body.firmware}. Update the camera firmware.` };
  }
  return { level: 'ok', note: `${feature.feature}: firmware ${body.firmware} meets ${feature.minFirmware}+.` };
}

const name = (g) => `${g.brand} ${g.model}`;

export function checkPreset(preset, gearById, settings = {}, catalog = []) {
  const get = (ids) => (ids || []).map((id) => gearById[id]).filter(Boolean);
  const bodies = get(preset.bodyIds);
  const lenses = get(preset.lensIds);
  const accs = get(preset.accessoryIds);
  const byCat = (c) => accs.filter((a) => a.category === c);
  const adapters = byCat('Adapter');
  const catalogAdapters = catalog.filter((g) => g.category === 'Adapter');
  const apps = settings.apps || EDITING_APPS.map((a) => a.id);
  const checks = [];
  const add = (level, category, title, detail = '') => checks.push({ level, category, title, detail });

  // Lens mount and adapter firmware
  const matrix = {};
  for (const b of bodies) {
    matrix[b.id] = {};
    for (const l of lenses) {
      const r = lensOnBody(b, l, adapters, catalogAdapters);
      matrix[b.id][l.id] = r;
      add(r.level, 'Lens mount', `${l.model} on ${b.model}: ${r.label}`, r.notes.join(' '));
    }
  }
  if (bodies.length && !lenses.length && !bodies.every((b) => b.fixedLens)) add('info', 'Lens mount', 'No lenses in this preset yet');
  for (const a of adapters) {
    const used = bodies.some((b) => b.mount === a.toMount) && lenses.some((l) => l.mount === a.fromMount);
    if (!used) add('info', 'Lens mount', `${a.model} is not needed by this kit`, `It adapts ${a.fromMount} lenses to ${a.toMount} bodies.`);
  }

  // Firmware-gated video formats
  for (const b of bodies) {
    for (const f of b.firmwareFeatures.filter((f) => f.formats)) {
      const r = firmwareGate(b, f);
      add(r.level, 'Firmware', `${b.model}: ${f.feature}`, r.note);
    }
  }

  // Batteries
  for (const bat of byCat('Battery')) {
    const fits = bodies.map((b) => {
      if (b.battery === bat.batteryModel) return { b, level: 'ok' };
      if (bat.alsoFits?.includes(b.battery)) return { b, level: 'ok', note: `${bat.batteryModel} also works in place of ${b.battery}.` };
      const alt = (b.batteryAlso || []).find((x) => x.model === bat.batteryModel);
      if (alt) return { b, level: 'warn', note: alt.note };
      return null;
    }).filter(Boolean);
    if (!fits.length) add(bodies.length ? 'bad' : 'info', 'Power', `${bat.model} fits no body in this kit`, bodies.map((b) => `${b.model} uses ${b.battery}.`).join(' '));
    for (const f of fits) add(f.level, 'Power', `${bat.model} fits ${f.b.model}`, f.note || '');
  }
  for (const b of bodies) {
    const has = byCat('Battery').some((bat) => bat.batteryModel === b.battery || bat.alsoFits?.includes(b.battery) || (b.batteryAlso || []).some((x) => x.model === bat.batteryModel));
    if (!has) add('info', 'Power', `No spare battery for ${b.model}`, `It takes ${b.battery}.`);
  }

  // Memory cards
  for (const card of byCat('Memory card')) {
    const results = bodies.map((b) => ({ b, ...cardOnBody(b, card) }));
    for (const r of results) add(r.level, 'Storage', `${card.model} in ${r.b.model}`, r.note);
  }
  for (const b of bodies) {
    const ok = byCat('Memory card').some((c) => cardOnBody(b, c).level !== 'bad');
    if (!ok) add('info', 'Storage', `No memory card for ${b.model}`, `Slots: ${b.cardSlots.join(', ')}.`);
  }

  // Filters
  for (const f of byCat('Filter')) {
    for (const l of lenses) {
      if (!l.filterThread) continue;
      if (f.threadSize === l.filterThread) add('ok', 'Filters', `${f.model} fits ${l.model}`);
      else if (f.threadSize > l.filterThread) add('warn', 'Filters', `${f.model} on ${l.model} needs a step-up ring`, `${l.filterThread}mm → ${f.threadSize}mm.`);
      else add('bad', 'Filters', `${f.model} is too small for ${l.model}`, `Lens thread is ${l.filterThread}mm; a smaller filter will vignette.`);
    }
  }

  // Flash and audio on the hot shoe
  for (const fl of byCat('Flash')) {
    for (const b of bodies) {
      if (fl.shoe === b.shoe) add('ok', 'Hot shoe', `${fl.model} on ${b.model}: full TTL`);
      else add('warn', 'Hot shoe', `${fl.model} on ${b.model}: manual flash only`, `Flash is built for ${fl.shoe}; the body uses ${b.shoe}.`);
    }
  }
  for (const m of byCat('Microphone')) {
    for (const b of bodies) {
      if (m.connection === '3.5mm') add('ok', 'Audio', `${m.model} on ${b.model}`, 'Connects through the 3.5mm mic input.');
      else if (m.connection === b.shoe && b.digitalAudio !== false) add('ok', 'Audio', `${m.model} on ${b.model}`, 'Digital audio through the shoe, no cable needed.');
      else add('bad', 'Audio', `${m.model} does not work with ${b.model}`, `Needs a ${m.connection} digital audio shoe.`);
    }
  }

  // Gimbal and tripod payload: heaviest body + lens (+ adapter) in the kit.
  const rigs = [];
  for (const b of bodies) {
    for (const l of lenses.length ? lenses : [null]) {
      const r = l ? matrix[b.id][l.id] : null;
      const ad = r?.adapterId ? gearById[r.adapterId] : null;
      rigs.push({ label: [b.model, l?.model, ad?.model].filter(Boolean).join(' + '), weight: (b.weight || 0) + (l?.weight || 0) + (ad?.weight || 0) });
    }
  }
  const heaviest = rigs.sort((a, b) => b.weight - a.weight)[0];
  for (const s of [...byCat('Gimbal'), ...byCat('Tripod')]) {
    if (!heaviest || !s.maxPayload) continue;
    const pct = heaviest.weight / s.maxPayload;
    const detail = `Heaviest setup: ${heaviest.label} ≈ ${(heaviest.weight / 1000).toFixed(2)} kg of ${(s.maxPayload / 1000).toFixed(1)} kg max.`;
    if (pct > 1) add('bad', 'Support', `${s.model} is overloaded`, detail);
    else if (pct > 0.85 && s.category === 'Gimbal') add('warn', 'Support', `${s.model} is near its limit`, detail);
    else add('ok', 'Support', `${s.model} handles this kit`, detail);
  }

  // Editing apps
  const appList = EDITING_APPS.filter((a) => apps.includes(a.id));
  for (const b of bodies) {
    for (const app of appList) {
      if (app.kind === 'photo') {
        if (!b.rawFormat) continue;
        const s = supportFor(RAW_PHOTO_SUPPORT, b.rawFormat, app.id);
        add(statusLevel(s.status), 'Editing apps', `${app.name}: ${b.model} RAW (.${b.rawFormat}) ${STATUS_TEXT[s.status]}`, s.note);
        continue;
      }
      const results = b.videoFormats.map((f) => ({ f, ...supportFor(VIDEO_SUPPORT, f, app.id) }));
      const native = results.filter((r) => r.status === 'native');
      const problems = results.filter((r) => r.status !== 'native');
      // If the camera can also record a format the app opens, the others are a caution, not a blocker.
      let level = worst(results.map((r) => statusLevel(r.status)));
      if (native.length && level === 'bad') level = 'warn';
      let detail = problems.length
        ? problems.map((r) => `${r.f}: ${STATUS_TEXT[r.status]}${r.note ? `. ${r.note}` : ''}`).join(' ')
        : `Opens ${b.videoFormats.join(', ')} natively.`;
      if (problems.length && native.length) detail += ` Opens natively: ${native.map((r) => r.f).join(', ')}.`;
      const title = problems.length ? `${app.name}: some ${b.model} video formats need attention` : `${app.name}: all ${b.model} video formats supported`;
      add(level, 'Editing apps', title, detail);
      if (app.id === 'resolve' && /^(8K|6)/.test(b.maxVideo)) {
        add('warn', 'Editing apps', `DaVinci Resolve (free): ${b.model} ${b.maxVideo.split(' ')[0]} footage`, 'The free version edits and exports up to UHD 4K. Use Resolve Studio for full-resolution timelines.');
      }
    }
  }

  const overall = checks.length ? worst(checks.map((c) => c.level)) : 'info';
  return { overall, checks, matrix, counts: countLevels(checks), heaviest };
}

const STATUS_TEXT = { native: 'supported', plugin: 'needs a plugin', limited: 'limited support', none: 'not supported', unknown: 'unknown' };
const statusLevel = (s) => ({ native: 'ok', plugin: 'warn', limited: 'warn', none: 'bad', unknown: 'info' })[s];

function countLevels(checks) {
  const c = { ok: 0, info: 0, warn: 0, bad: 0 };
  for (const x of checks) c[x.level]++;
  return c;
}
