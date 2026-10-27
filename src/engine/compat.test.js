import { describe, it, expect } from 'vitest';
import { CATALOG } from '../data/gear.js';
import { SEED_GROUPS } from '../data/presets.js';
import { MY_GEAR, MY_GROUPS } from '../data/mygear.js';
import { buildCatalog } from '../data/catalog.js';
import { isValidCatalog, isValidNews } from '../remote.js';
import { readFileSync } from 'node:fs';
import { checkPreset, lensOnBody, cardOnBody, compareVersions, applyResolved, checkKey } from './compat.js';

const byId = Object.fromEntries(CATALOG.map((g) => [g.id, g]));
const adapters = CATALOG.filter((g) => g.category === 'Adapter');
const run = (bodyIds, lensIds, accessoryIds = [], settings) => checkPreset({ bodyIds, lensIds, accessoryIds }, byId, settings, CATALOG);
const find = (r, re) => r.checks.find((c) => re.test(c.title));

describe('catalog', () => {
  it('has unique ids', () => {
    expect(new Set(CATALOG.map((g) => g.id)).size).toBe(CATALOG.length);
  });
  it('catalog.json is up to date (run npm run catalog)', () => {
    const published = JSON.parse(readFileSync(new URL('../../catalog.json', import.meta.url), 'utf8'));
    expect(published).toEqual(JSON.parse(JSON.stringify(buildCatalog())));
    expect(isValidCatalog(published)).toBe(true);
  });
  it('rejects malformed catalogs', () => {
    expect(isValidCatalog({ gear: [] , myGear: [], myGroups: [] })).toBe(false);
    expect(isValidCatalog({ gear: [{ id: 'x', type: 'toaster' }], myGear: [], myGroups: [] })).toBe(false);
    expect(isValidCatalog(null)).toBe(false);
  });
  it('my gear references real gear', () => {
    for (const id of MY_GEAR) expect(byId[id], id).toBeTruthy();
    for (const g of MY_GROUPS) for (const p of g.presets) {
      for (const id of [...p.bodyIds, ...p.lensIds, ...p.accessoryIds]) expect(byId[id], id).toBeTruthy();
    }
  });
  it('seed presets reference real gear', () => {
    for (const g of SEED_GROUPS) for (const p of g.presets) {
      for (const id of [...p.bodyIds, ...p.lensIds, ...p.accessoryIds]) expect(byId[id], id).toBeTruthy();
    }
  });
});

describe('lens mount', () => {
  it('native lens fits', () => {
    expect(lensOnBody(byId['sony-a7iv'], byId['sony-2470gm2'], []).level).toBe('ok');
  });
  it('APS-C lens on full frame warns about crop', () => {
    const r = lensOnBody(byId['sony-a7iv'], byId['sony-18135'], []);
    expect(r.level).toBe('warn');
    expect(r.label).toBe('Crop mode');
  });
  it('suggests an adapter when one exists but is not in the kit', () => {
    const r = lensOnBody(byId['nikon-z8'], byId['nikon-f70200e'], [], adapters);
    expect(r.label).toBe('Needs adapter');
    expect(r.notes[0]).toMatch(/FTZ/);
  });
  it('rejects mounts with no adapter', () => {
    expect(lensOnBody(byId['canon-r5'], byId['nikon-z2470s'], [], adapters).level).toBe('bad');
  });
  it('FTZ gives full AF to AF-S and AF-P lenses', () => {
    expect(lensOnBody(byId['nikon-z8'], byId['nikon-f70200e'], [byId['nikon-ftz2']]).label).toBe('Full autofocus');
    expect(lensOnBody(byId['nikon-z8'], byId['nikon-f70300p'], [byId['nikon-ftz2']]).level).toBe('ok');
  });
  it('FTZ makes screw-drive AF-D lenses manual focus', () => {
    const r = lensOnBody(byId['nikon-z6'], byId['nikon-f50d'], [byId['nikon-ftz']]);
    expect(r.level).toBe('warn');
    expect(r.label).toBe('Manual focus only');
  });
  it('MC-11 is full AF for Sigma, limited for Canon lenses', () => {
    expect(lensOnBody(byId['sony-a7iv'], byId['sigma-1835-ef'], [byId['sigma-mc11']]).label).toBe('Full autofocus');
    expect(lensOnBody(byId['sony-a7iv'], byId['canon-ef70200iii'], [byId['sigma-mc11']]).level).toBe('warn');
  });
});

describe('third-party lenses on FTZ', () => {
  it('Tamron and Sigma F lenses autofocus with a firmware note', () => {
    for (const id of ['tamron-70210-f', 'sigma-70200sports-f']) {
      const r = lensOnBody(byId['nikon-z7ii'], byId[id], [byId['nikon-ftz2']]);
      expect(r.level).toBe('ok');
      expect(r.label).toBe('Autofocus works');
      expect(r.notes.join(' ')).toMatch(/firmware/);
    }
  });
  it('Nikon AF-S 28-70 gets full AF', () => {
    expect(lensOnBody(byId['nikon-z7ii'], byId['nikon-f2870d'], [byId['nikon-ftz2']]).label).toBe('Full autofocus');
  });
});

describe('firmware', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('2.20', '3.00')).toBe(-1);
    expect(compareVersions('3.10', '3.01')).toBe(1);
    expect(compareVersions('10.0', '9.9')).toBe(1);
  });
  it('Z6 needs 2.20 for CFexpress B', () => {
    const card = byId['card-cfb'];
    expect(cardOnBody(byId['nikon-z6'], card).level).toBe('warn');
    expect(cardOnBody({ ...byId['nikon-z6'], firmware: '2.10' }, card).level).toBe('bad');
    expect(cardOnBody({ ...byId['nikon-z6'], firmware: '3.40' }, card).level).toBe('ok');
  });
  it('Z9 RAW video depends on firmware 3.00', () => {
    const z9 = { ...byId['nikon-z9'], firmware: '2.11' };
    const r = checkPreset({ bodyIds: ['z9'], lensIds: [], accessoryIds: [] }, { ...byId, z9 }, {}, CATALOG);
    expect(find(r, /N-RAW/).level).toBe('warn');
  });
  it('SD card fits a combo CFexpress A / SD slot', () => {
    expect(cardOnBody(byId['sony-a7iv'], byId['card-sd2']).level).toBe('ok');
    expect(cardOnBody(byId['sony-a6400'], byId['card-cfa']).level).toBe('bad');
  });
});

describe('accessories', () => {
  it('microSD needs an adapter in an SD slot', () => {
    const r = cardOnBody(byId['nikon-z7ii'], byId['card-amzn-microsd512']);
    expect(r.level).toBe('warn');
    expect(r.note).toMatch(/adapter/);
  });
  it('flags wrong battery', () => {
    expect(find(run(['sony-a7iv'], [], ['bat-lpe6nh']), /fits no body/).level).toBe('bad');
  });
  it('older EN-EL15 works in the Z7II with a note', () => {
    const r = run(['nikon-z7ii'], [], ['bat-pholsy-enel15']);
    expect(find(r, /EN-EL15 replacement battery.*fits/).level).toBe('warn');
    expect(find(r, /No spare battery/)).toBeFalsy();
  });
  it('LP-E6NH in R5 Mark II works with limits', () => {
    expect(find(run(['canon-r5ii'], [], ['bat-lpe6nh']), /LP-E6NH fits/).level).toBe('warn');
  });
  it('filter needs a step-up ring when no lens matches', () => {
    const r = run(['nikon-z6'], ['nikon-f50d', 'nikon-z2470s'], ['filter-uv58', 'nikon-ftz']);
    expect(find(r, /step-up/).level).toBe('warn');
  });
  it('filter that fits one lens is fine, others are notes', () => {
    const r = run(['nikon-z7ii'], ['nikon-f2870d', 'sigma-70200sports-f', 'nikon-z2470f4'], ['filter-bw-007-77', 'nikon-ftz2']);
    expect(find(r, /fits AF-S 28-70/).level).toBe('ok');
    expect(find(r, /too small for some/).level).toBe('info');
    expect(r.checks.filter((c) => c.category === 'Filters' && c.level === 'bad')).toHaveLength(0);
  });
  it('filter that fits nothing is a problem', () => {
    expect(find(run(['nikon-z7ii'], ['sigma-70200sports-f'], ['filter-uv58']), /fits no lens/).level).toBe('bad');
  });
  it('gimbal payload', () => {
    expect(find(run(['sony-a7iv'], ['sony-200600g'], ['gimbal-rs3mini']), /overloaded/).level).toBe('bad');
    expect(find(run(['sony-a7iv'], ['sony-35gm'], ['gimbal-rs4']), /handles/).level).toBe('ok');
  });
  it('Sony digital mic needs a digital audio shoe', () => {
    expect(find(run(['sony-a6400'], [], ['mic-ecmb10']), /does not work/).level).toBe('bad');
    expect(find(run(['canon-r5'], [], ['mic-ecmb10']), /does not work/).level).toBe('bad');
  });
  it('off-brand flash is manual only', () => {
    expect(find(run(['canon-r5'], [], ['flash-godox-v1s']), /manual flash/).level).toBe('warn');
  });
});

describe('editing apps', () => {
  it('BRAW needs a plugin in Premiere, native in Resolve', () => {
    const r = run(['bmd-p6kpro'], [], [], { apps: ['premiere', 'resolveStudio'] });
    expect(find(r, /Premiere/).level).toBe('warn');
    expect(find(r, /Studio/).level).toBe('ok');
  });
  it('ProRes RAW is flagged in Resolve, as a caution when other formats work', () => {
    const r = find(run(['nikon-z8'], [], [], { apps: ['resolveStudio'] }), /Studio/);
    expect(r.level).toBe('warn');
    expect(r.detail).toMatch(/ProRes RAW: not supported/);
  });
  it('a camera with no editable format is a problem', () => {
    const cam = { ...byId['nikon-z8'], id: 'x', videoFormats: ['ProRes RAW'] };
    const r = checkPreset({ bodyIds: ['x'], lensIds: [], accessoryIds: [] }, { ...byId, x: cam }, { apps: ['resolve'] }, CATALOG);
    expect(find(r, /video formats/).level).toBe('bad');
  });
  it('free Resolve warns about 8K', () => {
    expect(find(run(['canon-r5'], [], [], { apps: ['resolve'] }), /8K footage/)).toBeTruthy();
  });
  it('Lightroom reads every RAW format', () => {
    const r = run(['fuji-xt5'], [], [], { apps: ['lightroom'] });
    expect(find(r, /Lightroom/).level).toBe('ok');
  });
});

describe('seed presets', () => {
  it('all evaluate without errors', () => {
    for (const g of SEED_GROUPS) for (const p of g.presets) {
      const r = checkPreset(p, byId, {}, CATALOG);
      expect(r.checks.length).toBeGreaterThan(0);
    }
  });
});

describe('resolved issues', () => {
  it('resolving an issue removes it from counts and verdict', () => {
    const r = run(['nikon-z7ii'], [], ['card-amzn-microsd512']);
    expect(r.overall).toBe('warn');
    const issue = r.checks.find((c) => c.level === 'warn');
    const after = applyResolved(r, [checkKey(issue)]);
    expect(['ok', 'info']).toContain(after.overall);
    expect(after.counts.warn).toBe(0);
    expect(after.resolvedCount).toBe(1);
  });
  it('stale resolved keys are ignored', () => {
    const r = run(['nikon-z7ii'], [], ['card-amzn-microsd512']);
    expect(applyResolved(r, ['Storage|something else']).overall).toBe('warn');
  });
});

describe('news', () => {
  const news = JSON.parse(readFileSync(new URL('../../news.json', import.meta.url), 'utf8'));
  it('news.json is valid', () => {
    expect(isValidNews(news)).toBe(true);
    for (const m of news.months) {
      expect(m.id).toMatch(/^\d{4}-\d{2}$/);
      expect(m.summary.length).toBeGreaterThan(0);
      for (const i of m.items) {
        expect(i.date.startsWith(m.id), `${i.name} date`).toBe(true);
        expect(i.highlights.length, i.name).toBeGreaterThan(0);
      }
    }
  });
  it('news items link to real catalog gear', () => {
    for (const m of news.months) for (const i of m.items) if (i.catalogId) expect(byId[i.catalogId], i.catalogId).toBeTruthy();
  });
});
