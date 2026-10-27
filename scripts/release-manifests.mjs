// Writes the two update manifests next to the installer:
//   latest.json  read by Flightroom itself (src-tauri/src/updater.rs)
//   latest.yml   read by GearCheck 1.x (electron-updater), so old installs
//                update straight into Flightroom
// Usage: node scripts/release-manifests.mjs <installer.exe> <version>
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

const [file, version] = process.argv.slice(2);
if (!file || !version) throw new Error('usage: release-manifests.mjs <installer.exe> <version>');
const data = readFileSync(file);
const name = basename(file);
const dir = dirname(file);
const sha256 = createHash('sha256').update(data).digest('hex');
const sha512 = createHash('sha512').update(data).digest('base64');

writeFileSync(join(dir, 'latest.json'), `${JSON.stringify({ version, file: name, sha256 }, null, 2)}\n`);
writeFileSync(join(dir, 'latest.yml'), [
  `version: ${version}`,
  'files:',
  `  - url: ${name}`,
  `    sha512: ${sha512}`,
  `    size: ${data.length}`,
  `path: ${name}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n'));
console.log(`${name}: ${data.length} bytes, sha256 ${sha256}`);
