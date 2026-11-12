import { describe, expect, it } from 'vitest';
import { facets, filterPhotos, sharedKeywords, cameraOf } from './library.js';

const P = (name, o = {}) => ({ id: `C:\\Photos\\${o.dir || 'Race'}\\${name}`, name, folder: 'C:\\Photos', ratingIn: 'sidecar', ...o });
const photos = [
  P('JWL_1.NEF', { make: 'NIKON CORPORATION', model: 'NIKON Z 7_2', lens: 'NIKKOR Z 24-70mm f/4 S', takenAt: '2026:10:17 10:00:00', rating: 4, keywords: ['Kart', 'Halloween'] }),
  P('JWL_2.NEF', { make: 'NIKON CORPORATION', model: 'NIKON Z 7_2', lens: 'SIGMA 70-200mm', takenAt: '2026:10:17 11:00:00', rating: 2, keywords: ['kart'], developed: true }),
  P('IMG_3.CR2', { dir: 'Night', make: 'Canon', model: 'Canon EOS 80D', lens: 'EF-S18-135mm', takenAt: '2025:12:24 20:00:00' }),
];

describe('library filters', () => {
  it('names cameras without repeating the maker', () => {
    expect(cameraOf(photos[0])).toBe('NIKON Z 7_2');
    expect(cameraOf({ make: 'FUJIFILM', model: 'X-T5' })).toBe('FUJIFILM X-T5');
    expect(cameraOf({ make: 'Sony', model: 'ILCE-7M4' })).toBe('Sony ILCE-7M4');
  });

  it('filters by camera, lens, date, stars, edits and words', () => {
    expect(filterPhotos(photos, { camera: 'Canon EOS 80D' }).map((p) => p.name)).toEqual(['IMG_3.CR2']);
    expect(filterPhotos(photos, { lens: 'SIGMA 70-200mm' })).toHaveLength(1);
    expect(filterPhotos(photos, { date: '2026-10' })).toHaveLength(2);
    expect(filterPhotos(photos, { stars: 'stars:3+' }).map((p) => p.name)).toEqual(['JWL_1.NEF']);
    expect(filterPhotos(photos, { edited: 'yes' }).map((p) => p.name)).toEqual(['JWL_2.NEF']);
    expect(filterPhotos(photos, { q: 'kart sigma' }).map((p) => p.name)).toEqual(['JWL_2.NEF']);
  });

  it('sorts newest first by default, and by folder, keyword and collection', () => {
    expect(filterPhotos(photos, {}).map((p) => p.name)).toEqual(['JWL_2.NEF', 'JWL_1.NEF', 'IMG_3.CR2']);
    expect(filterPhotos(photos, { sort: 'old' })[0].name).toBe('IMG_3.CR2');
    expect(filterPhotos(photos, { source: { kind: 'folder', path: 'C:\\Photos\\Night' } })).toHaveLength(1);
    expect(filterPhotos(photos, { source: { kind: 'folder', path: 'C:\\Photos' } })).toHaveLength(3);
    expect(filterPhotos(photos, { source: { kind: 'folder', path: 'C:\\Phot' } })).toHaveLength(0);
    expect(filterPhotos(photos, { source: { kind: 'keyword', keyword: 'KART' } })).toHaveLength(2);
    expect(filterPhotos(photos, { source: { kind: 'collection', ids: [photos[2].id] } })).toHaveLength(1);
  });

  it('counts what the menus offer', () => {
    const f = facets(photos);
    expect(f.cameras[0]).toEqual(['NIKON Z 7_2', 2]);
    expect(f.keywords).toEqual([['Halloween', 1], ['Kart', 2]]);
    expect(f.dates.map(([d]) => d)).toEqual(['2026', '2026-10', '2025', '2025-12']);
  });

  it('splits keywords on all or some of the selected photos', () => {
    expect(sharedKeywords(photos.slice(0, 2))).toEqual({ all: ['Kart'], some: ['Halloween'] });
  });
});
