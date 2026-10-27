// Culling: lists photos in a folder, serves their embedded previews to the window
// through the gcimg:// protocol, caches thumbnails on disk, and writes star ratings.
const { app, dialog, ipcMain, protocol } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const lib = require('./photo-lib.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'gcimg', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const thumbDir = () => path.join(app.getPath('userData'), 'thumbs');
const folders = new Set(); // folders opened this session; only their files are served
const infoCache = new Map(); // file path -> { key, info }

const inOpenFolder = (p) => typeof p === 'string' && folders.has(path.dirname(path.resolve(p)));

// Runs at most `n` tasks at once, so a 2,000-photo folder doesn't open 2,000 files together.
function limiter(n) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= n || !waiting.length) return;
    active++;
    const { fn, resolve, reject } = waiting.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { waiting.push({ fn, resolve, reject }); next(); });
}
const ioLimit = limiter(6);

async function withFile(p, fn) {
  const fh = await fsp.open(p, 'r');
  try {
    const get = async (offset, length) => {
      const buf = Buffer.alloc(Math.max(0, length));
      const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
      return buf.subarray(0, bytesRead);
    };
    return await fn(get, fh);
  } finally {
    await fh.close();
  }
}

async function photoInfo(p) {
  const st = await fsp.stat(p);
  const key = `${st.size}:${st.mtimeMs}`;
  const hit = infoCache.get(p);
  if (hit?.key === key) return hit.info;
  const info = await ioLimit(() => withFile(p, (get) => lib.readPhotoInfo(get, lib.extOf(p))));
  info.key = key;
  infoCache.set(p, { key, info });
  return info;
}

async function readJpeg(p, part) {
  if (!part) return null;
  if (part.length == null) return fsp.readFile(p); // a JPEG file is its own preview
  return withFile(p, (get) => get(part.offset, part.length));
}

const thumbPath = (p, info) => path.join(thumbDir(), `${crypto.createHash('sha1').update(`${p}|${info.key}`).digest('hex')}.jpg`);

const jpegResponse = (buf) => new Response(buf, {
  headers: { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
});

// gcimg://photo/preview?p=<file>  full-size embedded JPEG
// gcimg://photo/thumb?p=<file>    small JPEG (cached on disk); 404 when the file has
//                                 none, and the window makes one and sends it back.
async function handleImage(req) {
  const url = new URL(req.url);
  const p = url.searchParams.get('p');
  if (!inOpenFolder(p)) return new Response(null, { status: 403 });
  try {
    const info = await photoInfo(p);
    if (url.pathname === '/preview') {
      const buf = await readJpeg(p, info.preview);
      return buf ? jpegResponse(lib.stripExif(buf)) : new Response(null, { status: 404 });
    }
    const cached = thumbPath(p, info);
    const hit = await fsp.readFile(cached).catch(() => null);
    if (hit) return jpegResponse(hit);
    if (!info.thumb) return new Response(null, { status: 404 });
    const buf = lib.stripExif(await readJpeg(p, info.thumb));
    fsp.mkdir(thumbDir(), { recursive: true }).then(() => fsp.writeFile(cached, buf)).catch(() => {});
    return jpegResponse(buf);
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function scanFolder(folder) {
  const dir = path.resolve(folder);
  const names = (await fsp.readdir(dir, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name);
  folders.add(dir);
  const photos = await Promise.all(lib.groupPhotos(names).map(async (g) => {
    const file = path.join(dir, g.file);
    let rating = null;
    if (g.sidecar) {
      rating = lib.readRating(await fsp.readFile(path.join(dir, g.sidecar), 'utf8').catch(() => ''));
    }
    return {
      id: file,
      name: g.file,
      raw: g.raw && path.join(dir, g.raw),
      jpeg: g.jpeg && path.join(dir, g.jpeg),
      sidecar: path.join(dir, g.sidecar || `${g.base}.xmp`),
      ratingIn: g.ratingIn,
      rating,
    };
  }));
  return { folder: dir, photos };
}

// Shooting info, orientation and the rating stored inside the file itself.
async function photoMeta(ids) {
  const out = {};
  await Promise.all(ids.filter(inOpenFolder).map(async (p) => {
    try {
      const { preview, thumb, key, ...rest } = await photoInfo(p);
      out[p] = { ...rest, width: preview?.width, height: preview?.height, hasThumb: !!thumb };
    } catch {
      out[p] = { error: true };
    }
  }));
  return out;
}

// Writes go through a temporary file and a rename, so a crash or full disk can
// never leave a half-written sidecar or JPEG. Writes to one file run in order.
const writeChains = new Map();
function queueWrite(file, fn) {
  const run = (writeChains.get(file) || Promise.resolve()).then(fn, fn);
  writeChains.set(file, run.catch(() => {}));
  return run;
}

async function atomicWrite(file, data) {
  const tmp = `${file}.gearcheck-tmp`;
  await fsp.writeFile(tmp, data);
  try {
    await fsp.rename(tmp, file);
  } catch (err) {
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }
}

async function setRating({ id, rating, ratingIn, sidecar }) {
  if (!inOpenFolder(id) || !Number.isInteger(rating) || rating < -1 || rating > 5) throw new Error('Invalid rating');
  if (ratingIn === 'file') {
    // A JPEG on its own: the rating goes in the file's XMP block (Lightroom reads it there).
    await queueWrite(id, async () => atomicWrite(id, lib.setJpegRating(await fsp.readFile(id), rating)));
    infoCache.delete(id);
  } else {
    if (!inOpenFolder(sidecar) || lib.extOf(sidecar) !== '.xmp') throw new Error('Invalid sidecar');
    await queueWrite(sidecar, async () => {
      const old = await fsp.readFile(sidecar, 'utf8').catch(() => null);
      await atomicWrite(sidecar, lib.setRating(old, rating));
    });
  }
  return { ok: true };
}

async function dirSize(dir) {
  const names = await fsp.readdir(dir).catch(() => []);
  let bytes = 0;
  for (const n of names) bytes += (await fsp.stat(path.join(dir, n)).catch(() => ({ size: 0 }))).size;
  return { bytes, files: names.length };
}

function setupPhotos(getWindow) {
  protocol.handle('gcimg', handleImage);
  const safe = (fn) => async (_e, ...args) => {
    try { return await fn(...args); } catch (err) { return { error: err.message }; }
  };
  ipcMain.handle('cull:pick', async () => {
    const r = await dialog.showOpenDialog(getWindow(), { title: 'Choose a folder of photos', properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('cull:scan', safe(scanFolder));
  ipcMain.handle('cull:meta', safe(photoMeta));
  ipcMain.handle('cull:rate', safe(setRating));
  ipcMain.handle('cull:saveThumb', safe(async (id, bytes) => {
    if (!inOpenFolder(id)) return { ok: false };
    const info = await photoInfo(id);
    await fsp.mkdir(thumbDir(), { recursive: true });
    await fsp.writeFile(thumbPath(id, info), Buffer.from(bytes));
    return { ok: true };
  }));
  ipcMain.handle('cull:cacheSize', safe(() => dirSize(thumbDir())));
  ipcMain.handle('cull:clearCache', safe(async () => {
    await fsp.rm(thumbDir(), { recursive: true, force: true });
    return { ok: true };
  }));
}

module.exports = { setupPhotos };
