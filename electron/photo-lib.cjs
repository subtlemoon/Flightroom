// Reads camera files without decoding the RAW data. A 50 MB NEF already holds
// JPEG previews made by the camera (a full-size one and a small 640 px one), so
// the culling view only ever reads those few MB plus the header. Star ratings
// are standard XMP (xmp:Rating), the same field Lightroom, Bridge and Capture One use.

const RAW_EXTS = ['.nef', '.nrw', '.cr2', '.arw', '.dng', '.orf', '.pef', '.rw2', '.raf', '.srw'];
const JPEG_EXTS = ['.jpg', '.jpeg'];
const HEADER_BYTES = 256 * 1024;

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };

// get(offset, length) returns a Promise<Buffer> of file bytes (shorter at end of file).
async function readTiff(get, base) {
  const h = await get(base, 8);
  if (h.length < 8) return null;
  const order = h.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));

  async function readIfd(off) {
    if (!off) return null;
    const cb = await get(base + off, 2);
    if (cb.length < 2) return null;
    const count = u16(cb, 0);
    if (!count || count > 1000) return null;
    const b = await get(base + off + 2, count * 12 + 4);
    if (b.length < count * 12) return null;
    const tags = new Map();
    for (let i = 0; i < count; i++) {
      const e = i * 12;
      const type = u16(b, e + 2);
      const n = u32(b, e + 4);
      const bytes = (TYPE_SIZE[type] || 1) * n;
      // Offsets are relative to the TIFF header at `base`.
      const at = bytes <= 4 ? { inline: b.subarray(e + 8, e + 12) } : { offset: u32(b, e + 8) };
      tags.set(u16(b, e), { type, n, bytes, ...at });
    }
    const next = b.length >= count * 12 + 4 ? u32(b, count * 12) : 0;
    return { tags, next };
  }

  async function raw(t) {
    if (!t) return null;
    return t.inline ? t.inline.subarray(0, t.bytes) : get(base + t.offset, t.bytes);
  }

  async function values(t) {
    const b = await raw(t);
    if (!b) return [];
    const out = [];
    const size = TYPE_SIZE[t.type] || 1;
    for (let i = 0; i < t.n && (i + 1) * size <= b.length; i++) {
      const o = i * size;
      switch (t.type) {
        case 3: out.push(u16(b, o)); break;
        case 4: case 13: out.push(u32(b, o)); break;
        case 9: out.push(le ? b.readInt32LE(o) : b.readInt32BE(o)); break;
        case 5: { const d = u32(b, o + 4); out.push(d ? u32(b, o) / d : 0); break; }
        case 10: { const r = le ? [b.readInt32LE(o), b.readInt32LE(o + 4)] : [b.readInt32BE(o), b.readInt32BE(o + 4)]; out.push(r[1] ? r[0] / r[1] : 0); break; }
        default: out.push(b[o]);
      }
    }
    return out;
  }

  const num = async (ifd, tag) => (ifd?.tags.has(tag) ? (await values(ifd.tags.get(tag)))[0] : undefined);
  const str = async (ifd, tag) => {
    const b = ifd?.tags.has(tag) ? await raw(ifd.tags.get(tag)) : null;
    return b ? b.toString('latin1').replace(/\0[\s\S]*$/, '').trim() : undefined;
  };

  return { base, readIfd, raw, values, num, str, ifd0: u32(h, 4) };
}

// Every JPEG the camera embedded, as { offset, length } in file bytes.
async function collectTiffJpegs(tiff, ifd, out) {
  const t = ifd.tags;
  const b = tiff.base;
  if (t.has(0x201) && t.has(0x202)) {
    out.push({ offset: b + (await tiff.num(ifd, 0x201)), length: await tiff.num(ifd, 0x202) });
  }
  const compression = await tiff.num(ifd, 0x103);
  const photometric = await tiff.num(ifd, 0x106);
  const subfile = await tiff.num(ifd, 0xfe);
  const isRawData = photometric === 32803 || photometric === 34892;
  if (t.has(0x111) && t.has(0x117) && t.get(0x111).n === 1 && !isRawData
    && (compression === 6 || (compression === 7 && subfile === 1))) {
    out.push({ offset: b + (await tiff.num(ifd, 0x111)), length: await tiff.num(ifd, 0x117) });
  }
  // Panasonic RW2 keeps its preview as a blob in tag 0x2E.
  if (t.has(0x2e) && t.get(0x2e).offset) out.push({ offset: b + t.get(0x2e).offset, length: t.get(0x2e).bytes });
}

// Width/height from a JPEG's start-of-frame, or null if it isn't a baseline/progressive JPEG.
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    if (m === 0xc3 || m === 0xda) return null; // lossless (raw data) or no frame header before scan
    i += 2 + len;
  }
  return null;
}

// JPEG segments before the image data: [{ marker, start, end, data }].
function jpegSegments(buf) {
  const segs = [];
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return segs;
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = buf.readUInt16BE(i + 2);
    segs.push({ marker, start: i, end: i + 2 + len, data: buf.subarray(i + 4, Math.min(buf.length, i + 2 + len)) });
    i += 2 + len;
  }
  return segs;
}

const XMP_SIG = 'http://ns.adobe.com/xap/1.0/\0';
const isExif = (s) => s.marker === 0xe1 && s.data.toString('latin1', 0, 6) === 'Exif\0\0';
const isXmp = (s) => s.marker === 0xe1 && s.data.toString('latin1', 0, XMP_SIG.length) === XMP_SIG;

// Removes the Exif block so the browser can't rotate the image a second time:
// orientation is applied by the viewer from the original file's metadata.
function stripExif(buf) {
  const exif = jpegSegments(buf).filter(isExif);
  if (!exif.length) return buf;
  const parts = [];
  let at = 0;
  for (const s of exif) { parts.push(buf.subarray(at, s.start)); at = s.end; }
  parts.push(buf.subarray(at));
  return Buffer.concat(parts);
}

async function readExifInfo(tiff, ifd0, info) {
  info.make = await tiff.str(ifd0, 0x10f);
  info.model = await tiff.str(ifd0, 0x110);
  info.orientation = (await tiff.num(ifd0, 0x112)) || 1;
  const exifOff = await tiff.num(ifd0, 0x8769);
  const exif = exifOff ? await tiff.readIfd(exifOff) : null;
  if (exif) {
    info.exposure = await tiff.num(exif, 0x829a);
    info.fNumber = await tiff.num(exif, 0x829d);
    info.iso = await tiff.num(exif, 0x8827);
    info.takenAt = await tiff.str(exif, 0x9003);
    info.focalLength = await tiff.num(exif, 0x920a);
    info.lens = await tiff.str(exif, 0xa434);
  }
  if (ifd0.tags.has(0x2bc)) {
    const xmp = await tiff.raw(ifd0.tags.get(0x2bc));
    info.fileRating = readRating(xmp.toString('utf8'));
  }
  return exif;
}

// Nikon maker notes hold a second, small (640 px) preview in "PreviewIFD".
async function nikonPreview(get, exifTiff, exif, out) {
  const mn = exif?.tags.get(0x927c);
  if (!mn?.offset) return;
  const start = exifTiff.base + mn.offset;
  const head = await get(start, 10);
  if (head.toString('latin1', 0, 6) !== 'Nikon\0' || head[6] !== 2) return;
  const tiff = await readTiff(get, start + 10);
  const ifd = tiff && await tiff.readIfd(tiff.ifd0);
  const previewOff = ifd && await tiff.num(ifd, 0x11);
  const preview = previewOff && await tiff.readIfd(previewOff);
  if (preview) await collectTiffJpegs(tiff, preview, out);
}

// Everything the viewer needs from one file: orientation, shooting info, in-file
// rating, and where the biggest (preview) and a small (thumb) JPEG sit in the file.
async function readPhotoInfo(get, ext) {
  const info = { orientation: 1 };
  const jpegs = [];
  const head = await get(0, HEADER_BYTES);

  if (JPEG_EXTS.includes(ext)) {
    for (const s of jpegSegments(head)) {
      if (isExif(s)) {
        const tiff = await readTiff(get, s.start + 10);
        const ifd0 = tiff && await tiff.readIfd(tiff.ifd0);
        if (ifd0) await readExifInfo(tiff, ifd0, info);
      } else if (isXmp(s)) {
        info.fileRating = readRating(s.data.toString('utf8', XMP_SIG.length));
      }
    }
    const size = jpegSize(head);
    info.preview = { offset: 0, length: null, ...size };
    return info;
  }

  if (ext === '.raf') {
    // Fujifilm: big-endian offset/length of the embedded JPEG at bytes 84 and 88.
    const off = head.readUInt32BE(84);
    const len = head.readUInt32BE(88);
    const jpg = await get(off, Math.min(len, HEADER_BYTES));
    for (const s of jpegSegments(jpg)) {
      if (!isExif(s)) continue;
      const tiff = await readTiff(get, off + s.start + 10);
      const ifd0 = tiff && await tiff.readIfd(tiff.ifd0);
      if (ifd0) await readExifInfo(tiff, ifd0, info);
    }
    jpegs.push({ offset: off, length: len });
  } else {
    const tiff = await readTiff(get, 0);
    if (!tiff) return info;
    const seen = new Set();
    const queue = [{ off: tiff.ifd0, depth: 0 }];
    let first = true;
    while (queue.length && seen.size < 12) {
      const { off, depth } = queue.shift();
      if (!off || seen.has(off)) continue;
      seen.add(off);
      const ifd = await tiff.readIfd(off);
      if (!ifd) continue;
      if (first) {
        first = false;
        const exif = await readExifInfo(tiff, ifd, info);
        await nikonPreview(get, tiff, exif, jpegs);
      }
      await collectTiffJpegs(tiff, ifd, jpegs);
      if (depth < 2 && ifd.tags.has(0x14a)) for (const s of await tiff.values(ifd.tags.get(0x14a))) queue.push({ off: s, depth: depth + 1 });
      if (depth === 0 && ifd.next) queue.push({ off: ifd.next, depth: 0 });
    }
  }

  const found = [];
  for (const j of jpegs) {
    if (!j.length || j.length < 1000) continue;
    const size = jpegSize(await get(j.offset, Math.min(j.length, 65536)));
    if (size) found.push({ ...j, ...size });
  }
  found.sort((a, b) => b.width * b.height - a.width * a.height);
  if (found[0]) info.preview = found[0];
  const small = found.filter((j) => Math.max(j.width, j.height) >= 400 && j !== found[0]).at(-1);
  if (small) info.thumb = small;
  return info;
}

// --- XMP ratings -----------------------------------------------------------

// xmp:Rating from an XMP packet: 1-5 stars, 0 = no stars, -1 = rejected (Bridge).
function readRating(xmp) {
  if (!xmp) return null;
  const m = xmp.match(/\b(?:xmp|xap):Rating\s*=\s*["'](-?\d+)["']/) || xmp.match(/<(?:xmp|xap):Rating>\s*(-?\d+)\s*</);
  return m ? Number(m[1]) : null;
}

const XMP_NS = 'http://ns.adobe.com/xap/1.0/';

function newXmp(rating) {
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="GearCheck">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="${XMP_NS}"
   xmp:Rating="${rating}"/>
 </rdf:RDF>
</x:xmpmeta>
`;
}

// Sets xmp:Rating in an existing XMP packet and leaves everything else untouched
// (Lightroom keeps edits, keywords and labels in the same file).
function setRating(xmp, rating) {
  if (!xmp || !/<rdf:Description\b/.test(xmp)) return newXmp(rating);
  const attr = /\b((?:xmp|xap):Rating\s*=\s*)(["'])-?\d+\2/;
  if (attr.test(xmp)) return xmp.replace(attr, `$1$2${rating}$2`);
  const elem = /(<(xmp|xap):Rating>)\s*-?\d+\s*(<\/\2:Rating>)/;
  if (elem.test(xmp)) return xmp.replace(elem, `$1${rating}$3`);
  return xmp.replace(/<rdf:Description\b([^>]*?)(\/?>)/, (all, attrs, close) => {
    const ns = /\bxmlns:xmp\s*=/.test(attrs) ? '' : `\n    xmlns:xmp="${XMP_NS}"`;
    return `<rdf:Description${attrs}${ns}\n   xmp:Rating="${rating}"${close}`;
  });
}

// Returns a copy of a JPEG file with its XMP packet's rating set (added if missing).
function setJpegRating(buf, rating) {
  const segs = jpegSegments(buf);
  const old = segs.find(isXmp);
  const packet = setRating(old ? old.data.toString('utf8', XMP_SIG.length) : null, rating);
  const wrapped = /<\?xpacket begin/.test(packet) ? packet
    : `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n${packet}<?xpacket end="w"?>`;
  const body = Buffer.concat([Buffer.from(XMP_SIG, 'latin1'), Buffer.from(wrapped, 'utf8')]);
  if (body.length + 2 > 0xffff) throw new Error('XMP block is too large');
  const seg = Buffer.alloc(4);
  seg.writeUInt16BE(0xffe1, 0);
  seg.writeUInt16BE(body.length + 2, 2);
  const newSeg = Buffer.concat([seg, body]);
  if (old) return Buffer.concat([buf.subarray(0, old.start), newSeg, buf.subarray(old.end)]);
  // Put it after the JFIF/Exif headers, where other apps expect it.
  const after = segs.filter((s) => s.marker === 0xe0 || isExif(s)).at(-1);
  const at = after ? after.end : 2;
  return Buffer.concat([buf.subarray(0, at), newSeg, buf.subarray(at)]);
}

// --- Folder listing ---------------------------------------------------------

const extOf = (name) => { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.slice(i).toLowerCase(); };
const baseOf = (name) => { const i = name.lastIndexOf('.'); return i < 0 ? name : name.slice(0, i); };

// Groups a folder's file names into photos. A RAW and a JPEG with the same name
// (RAW+JPEG shooting) are one photo, rated through the RAW's .xmp sidecar the way
// Lightroom treats them. A JPEG on its own keeps its rating inside the file.
function groupPhotos(names) {
  const byBase = new Map();
  for (const name of names) {
    const ext = extOf(name);
    const key = baseOf(name).toLowerCase();
    if (!byBase.has(key)) byBase.set(key, { base: baseOf(name) });
    const g = byBase.get(key);
    if (RAW_EXTS.includes(ext) && !g.raw) g.raw = name;
    else if (JPEG_EXTS.includes(ext) && !g.jpeg) g.jpeg = name;
    else if (ext === '.xmp') g.sidecar = name;
  }
  return [...byBase.values()]
    .filter((g) => g.raw || g.jpeg)
    .map((g) => ({ ...g, file: g.raw || g.jpeg, ratingIn: g.raw ? 'sidecar' : 'file' }))
    .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));
}

module.exports = {
  RAW_EXTS, JPEG_EXTS, extOf, baseOf, readPhotoInfo, readRating, setRating, setJpegRating,
  stripExif, jpegSize, groupPhotos,
};
