// Writes catalog.json from src/data. Run `npm run catalog` after editing gear data.
import { writeFileSync } from 'node:fs';
import { buildCatalog } from '../src/data/catalog.js';

writeFileSync(new URL('../catalog.json', import.meta.url), JSON.stringify(buildCatalog(), null, 2) + '\n');
console.log('catalog.json updated');
