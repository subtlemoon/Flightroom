// Reads camera files without decoding the RAW data. A 50 MB NEF already holds
// JPEG previews made by the camera (a full-size one and a small 640 px one), so
// the culling view only ever reads those few MB plus the header. Star ratings
// are standard XMP (xmp:Rating), the same field Lightroom, Bridge and Capture One use.

use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};

pub const RAW_EXTS: &[&str] = &[".nef", ".nrw", ".cr2", ".cr3", ".arw", ".dng", ".orf", ".pef", ".rw2", ".raf", ".srw"];
pub const JPEG_EXTS: &[&str] = &[".jpg", ".jpeg"];
const HEADER_BYTES: usize = 256 * 1024;

/// Random access to a file's bytes. `get` returns fewer bytes at the end of the file.
pub trait Source {
    fn get(&self, offset: u64, length: usize) -> Vec<u8>;
    /// Total size in bytes (None if unknown).
    fn size(&self) -> Option<u64>;
}

impl Source for [u8] {
    fn get(&self, offset: u64, length: usize) -> Vec<u8> {
        let start = usize::try_from(offset).unwrap_or(usize::MAX).min(self.len());
        let end = start.saturating_add(length).min(self.len());
        self[start..end].to_vec()
    }
    fn size(&self) -> Option<u64> {
        Some(self.len() as u64)
    }
}

impl Source for std::fs::File {
    fn get(&self, offset: u64, length: usize) -> Vec<u8> {
        // Lengths come from the file's own metadata: never allocate past its end.
        let left = self.size().map_or(0, |n| n.saturating_sub(offset));
        let length = length.min(usize::try_from(left).unwrap_or(usize::MAX));
        let mut buf = vec![0u8; length];
        let mut done = 0;
        while done < length {
            #[cfg(unix)]
            let r = std::os::unix::fs::FileExt::read_at(self, &mut buf[done..], offset + done as u64);
            #[cfg(windows)]
            let r = std::os::windows::fs::FileExt::seek_read(self, &mut buf[done..], offset + done as u64);
            match r {
                Ok(0) | Err(_) => break,
                Ok(n) => done += n,
            }
        }
        buf.truncate(done);
        buf
    }
    fn size(&self) -> Option<u64> {
        self.metadata().ok().map(|m| m.len())
    }
}

fn type_size(t: u16) -> usize {
    match t {
        1 | 2 | 6 | 7 => 1,
        3 | 8 => 2,
        4 | 9 | 11 | 13 => 4,
        5 | 10 | 12 => 8,
        _ => 1,
    }
}

#[derive(Clone, Debug)]
struct Tag {
    typ: u16,
    n: u32,
    bytes: usize,
    inline: Option<[u8; 4]>,
    offset: u32,
}

struct Ifd {
    tags: HashMap<u16, Tag>,
    next: u32,
}

struct Tiff<'a, S: Source + ?Sized> {
    src: &'a S,
    base: u64,
    le: bool,
    ifd0: u32,
}

impl<'a, S: Source + ?Sized> Tiff<'a, S> {
    fn open(src: &'a S, base: u64) -> Option<Self> {
        let h = src.get(base, 8);
        if h.len() < 8 {
            return None;
        }
        let le = match &h[0..2] {
            b"II" => true,
            b"MM" => false,
            _ => return None,
        };
        let mut t = Tiff { src, base, le, ifd0: 0 };
        t.ifd0 = t.u32(&h, 4);
        Some(t)
    }

    fn u16(&self, b: &[u8], o: usize) -> u16 {
        let a = [b[o], b[o + 1]];
        if self.le { u16::from_le_bytes(a) } else { u16::from_be_bytes(a) }
    }

    fn u32(&self, b: &[u8], o: usize) -> u32 {
        let a = [b[o], b[o + 1], b[o + 2], b[o + 3]];
        if self.le { u32::from_le_bytes(a) } else { u32::from_be_bytes(a) }
    }

    fn read_ifd(&self, off: u32) -> Option<Ifd> {
        if off == 0 {
            return None;
        }
        let cb = self.src.get(self.base + off as u64, 2);
        if cb.len() < 2 {
            return None;
        }
        let count = self.u16(&cb, 0) as usize;
        if count == 0 || count > 1000 {
            return None;
        }
        let b = self.src.get(self.base + off as u64 + 2, count * 12 + 4);
        if b.len() < count * 12 {
            return None;
        }
        let mut tags = HashMap::new();
        for i in 0..count {
            let e = i * 12;
            let typ = self.u16(&b, e + 2);
            let n = self.u32(&b, e + 4);
            let bytes = type_size(typ).saturating_mul(n as usize);
            // Offsets are relative to the TIFF header at `base`.
            let (inline, offset) = if bytes <= 4 {
                (Some([b[e + 8], b[e + 9], b[e + 10], b[e + 11]]), 0)
            } else {
                (None, self.u32(&b, e + 8))
            };
            tags.insert(self.u16(&b, e), Tag { typ, n, bytes, inline, offset });
        }
        let next = if b.len() >= count * 12 + 4 { self.u32(&b, count * 12) } else { 0 };
        Some(Ifd { tags, next })
    }

    fn raw(&self, t: &Tag) -> Vec<u8> {
        match t.inline {
            Some(b) => b[..t.bytes.min(4)].to_vec(),
            None => self.src.get(self.base + t.offset as u64, t.bytes.min(64 * 1024 * 1024)),
        }
    }

    fn values(&self, t: &Tag) -> Vec<f64> {
        let b = self.raw(t);
        let size = type_size(t.typ);
        let mut out = Vec::new();
        let mut i = 0usize;
        while i < t.n as usize && (i + 1) * size <= b.len() {
            let o = i * size;
            let v = match t.typ {
                3 => self.u16(&b, o) as f64,
                4 | 13 => self.u32(&b, o) as f64,
                9 => self.u32(&b, o) as i32 as f64,
                5 => {
                    let d = self.u32(&b, o + 4);
                    if d == 0 { 0.0 } else { self.u32(&b, o) as f64 / d as f64 }
                }
                10 => {
                    let n = self.u32(&b, o) as i32;
                    let d = self.u32(&b, o + 4) as i32;
                    if d == 0 { 0.0 } else { n as f64 / d as f64 }
                }
                _ => b[o] as f64,
            };
            out.push(v);
            i += 1;
        }
        out
    }

    fn num(&self, ifd: &Ifd, tag: u16) -> Option<f64> {
        ifd.tags.get(&tag).and_then(|t| self.values(t).first().copied())
    }

    fn str(&self, ifd: &Ifd, tag: u16) -> Option<String> {
        let b = self.raw(ifd.tags.get(&tag)?);
        let end = b.iter().position(|&c| c == 0).unwrap_or(b.len());
        let s: String = b[..end].iter().map(|&c| c as char).collect();
        let s = s.trim().to_string();
        if s.is_empty() { None } else { Some(s) }
    }
}

/// Embedded previews are a few MB; a bigger one is a damaged or crafted file.
pub const MAX_PART: u64 = 256 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
pub struct JpegPart {
    pub offset: u64,
    /// None: the whole file is the JPEG.
    pub length: Option<u64>,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoInfo {
    pub orientation: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub f_number: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taken_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lens: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_rating: Option<i32>,
    #[serde(skip)]
    pub preview: Option<JpegPart>,
    #[serde(skip)]
    pub thumb: Option<JpegPart>,
}

// Every JPEG the camera embedded, as (offset, length) in file bytes.
fn collect_tiff_jpegs<S: Source + ?Sized>(tiff: &Tiff<S>, ifd: &Ifd, out: &mut Vec<(u64, u64)>) {
    let t = &ifd.tags;
    let b = tiff.base;
    if t.contains_key(&0x201) && t.contains_key(&0x202) {
        if let (Some(o), Some(l)) = (tiff.num(ifd, 0x201), tiff.num(ifd, 0x202)) {
            out.extend(b.checked_add(o as u64).map(|o| (o, l as u64)));
        }
    }
    let compression = tiff.num(ifd, 0x103);
    let photometric = tiff.num(ifd, 0x106);
    let subfile = tiff.num(ifd, 0xfe);
    let is_raw_data = photometric == Some(32803.0) || photometric == Some(34892.0);
    if let (Some(so), Some(_)) = (t.get(&0x111), t.get(&0x117)) {
        if so.n == 1 && !is_raw_data && (compression == Some(6.0) || (compression == Some(7.0) && subfile == Some(1.0))) {
            if let (Some(o), Some(l)) = (tiff.num(ifd, 0x111), tiff.num(ifd, 0x117)) {
                out.extend(b.checked_add(o as u64).map(|o| (o, l as u64)));
            }
        }
    }
    // Panasonic RW2 keeps its preview as a blob in tag 0x2E.
    if let Some(p) = t.get(&0x2e) {
        if p.inline.is_none() && p.offset > 0 {
            out.extend(b.checked_add(p.offset as u64).map(|o| (o, p.bytes as u64)));
        }
    }
}

/// Width/height from a JPEG's start-of-frame, or None if it isn't a baseline/progressive JPEG.
pub fn jpeg_size(buf: &[u8]) -> Option<(u32, u32)> {
    if buf.len() < 4 || buf[0] != 0xff || buf[1] != 0xd8 {
        return None;
    }
    let mut i = 2;
    while i + 9 < buf.len() {
        if buf[i] != 0xff {
            i += 1;
            continue;
        }
        let m = buf[i + 1];
        if m == 0xd8 || m == 0x01 || (0xd0..=0xd7).contains(&m) || m == 0xff {
            i += if m == 0xff { 1 } else { 2 };
            continue;
        }
        let len = u16::from_be_bytes([buf[i + 2], buf[i + 3]]) as usize;
        if m == 0xc0 || m == 0xc1 || m == 0xc2 {
            let h = u16::from_be_bytes([buf[i + 5], buf[i + 6]]) as u32;
            let w = u16::from_be_bytes([buf[i + 7], buf[i + 8]]) as u32;
            return Some((w, h));
        }
        if m == 0xc3 || m == 0xda {
            return None; // lossless (raw data) or no frame header before scan
        }
        i += 2 + len;
    }
    None
}

pub struct Segment {
    pub marker: u8,
    pub start: usize,
    pub end: usize,
    pub data_start: usize,
}

/// JPEG segments before the image data.
pub fn jpeg_segments(buf: &[u8]) -> Vec<Segment> {
    let mut segs = Vec::new();
    if buf.len() < 2 || buf[0] != 0xff || buf[1] != 0xd8 {
        return segs;
    }
    let mut i = 2;
    while i + 4 <= buf.len() && buf[i] == 0xff {
        let marker = buf[i + 1];
        if marker == 0xda || marker == 0xd9 {
            break;
        }
        let len = u16::from_be_bytes([buf[i + 2], buf[i + 3]]) as usize;
        segs.push(Segment { marker, start: i, end: (i + 2 + len).min(buf.len()), data_start: i + 4 });
        i += 2 + len;
    }
    segs
}

const XMP_SIG: &[u8] = b"http://ns.adobe.com/xap/1.0/\0";

pub fn is_exif(buf: &[u8], s: &Segment) -> bool {
    s.marker == 0xe1 && buf.get(s.data_start..s.data_start + 6) == Some(b"Exif\0\0")
}

pub fn is_xmp(buf: &[u8], s: &Segment) -> bool {
    s.marker == 0xe1 && buf.get(s.data_start..s.data_start + XMP_SIG.len()) == Some(XMP_SIG)
}

/// Removes the Exif block so the browser can't rotate the image a second time:
/// orientation is applied by the viewer from the original file's metadata.
pub fn strip_exif(buf: Vec<u8>) -> Vec<u8> {
    let segs = jpeg_segments(&buf);
    let exif: Vec<&Segment> = segs.iter().filter(|s| is_exif(&buf, s)).collect();
    if exif.is_empty() {
        return buf;
    }
    let mut out = Vec::with_capacity(buf.len());
    let mut at = 0;
    for s in exif {
        out.extend_from_slice(&buf[at..s.start]);
        at = s.end;
    }
    out.extend_from_slice(&buf[at..]);
    out
}

fn read_exif_info<S: Source + ?Sized>(tiff: &Tiff<S>, ifd0: &Ifd, info: &mut PhotoInfo) -> Option<Ifd> {
    info.make = tiff.str(ifd0, 0x10f);
    info.model = tiff.str(ifd0, 0x110);
    info.orientation = tiff.num(ifd0, 0x112).map(|v| v as u32).filter(|&v| v > 0).unwrap_or(1);
    let exif = tiff.num(ifd0, 0x8769).and_then(|o| tiff.read_ifd(o as u32));
    if let Some(e) = &exif {
        info.exposure = tiff.num(e, 0x829a);
        info.f_number = tiff.num(e, 0x829d);
        info.iso = tiff.num(e, 0x8827);
        info.taken_at = tiff.str(e, 0x9003);
        info.focal_length = tiff.num(e, 0x920a);
        info.lens = tiff.str(e, 0xa434);
    }
    if let Some(t) = ifd0.tags.get(&0x2bc) {
        info.file_rating = read_rating(&String::from_utf8_lossy(&tiff.raw(t)));
    }
    exif
}

// Nikon maker notes hold a second, small (640 px) preview in "PreviewIFD".
fn nikon_preview<S: Source + ?Sized>(src: &S, exif_tiff: &Tiff<S>, exif: Option<&Ifd>, out: &mut Vec<(u64, u64)>) {
    let Some(mn) = exif.and_then(|e| e.tags.get(&0x927c)) else { return };
    if mn.inline.is_some() || mn.offset == 0 {
        return;
    }
    let start = exif_tiff.base + mn.offset as u64;
    let head = src.get(start, 10);
    if head.len() < 10 || &head[0..6] != b"Nikon\0" || head[6] != 2 {
        return;
    }
    let Some(tiff) = Tiff::open(src, start + 10) else { return };
    let Some(ifd) = tiff.read_ifd(tiff.ifd0) else { return };
    let Some(preview_off) = tiff.num(&ifd, 0x11) else { return };
    if let Some(preview) = tiff.read_ifd(preview_off as u32) {
        collect_tiff_jpegs(&tiff, &preview, out);
    }
}

pub fn ext_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if !name[i..].contains(['/', '\\']) => name[i..].to_lowercase(),
        _ => String::new(),
    }
}

pub fn base_of(name: &str) -> &str {
    match name.rfind('.') {
        Some(i) => &name[..i],
        None => name,
    }
}

/// Everything the viewer needs from one file: orientation, shooting info, in-file
/// rating, and where the biggest (preview) and a small (thumb) JPEG sit in the file.
pub fn read_photo_info<S: Source + ?Sized>(src: &S, ext: &str) -> PhotoInfo {
    let mut info = PhotoInfo { orientation: 1, ..Default::default() };
    let mut jpegs: Vec<(u64, u64)> = Vec::new();
    let head = src.get(0, HEADER_BYTES);

    if JPEG_EXTS.contains(&ext) {
        for s in jpeg_segments(&head) {
            if is_exif(&head, &s) {
                if let Some(tiff) = Tiff::open(src, s.start as u64 + 10) {
                    if let Some(ifd0) = tiff.read_ifd(tiff.ifd0) {
                        read_exif_info(&tiff, &ifd0, &mut info);
                    }
                }
            } else if is_xmp(&head, &s) {
                let body = &head[(s.data_start + XMP_SIG.len()).min(s.end)..s.end];
                info.file_rating = read_rating(&String::from_utf8_lossy(body));
            }
        }
        let (w, h) = jpeg_size(&head).unwrap_or((0, 0));
        info.preview = Some(JpegPart { offset: 0, length: None, width: w, height: h });
        return info;
    }

    if ext == ".raf" {
        // Fujifilm: big-endian offset/length of the embedded JPEG at bytes 84 and 88.
        if head.len() < 92 {
            return info;
        }
        let off = u32::from_be_bytes([head[84], head[85], head[86], head[87]]) as u64;
        let len = u32::from_be_bytes([head[88], head[89], head[90], head[91]]) as u64;
        let jpg = src.get(off, (len as usize).min(HEADER_BYTES));
        for s in jpeg_segments(&jpg) {
            if !is_exif(&jpg, &s) {
                continue;
            }
            if let Some(tiff) = Tiff::open(src, off + s.start as u64 + 10) {
                if let Some(ifd0) = tiff.read_ifd(tiff.ifd0) {
                    read_exif_info(&tiff, &ifd0, &mut info);
                }
            }
        }
        jpegs.push((off, len));
    } else {
        let Some(tiff) = Tiff::open(src, 0) else { return info };
        let mut seen = HashSet::new();
        let mut queue = VecDeque::from([(tiff.ifd0, 0u32)]);
        let mut first = true;
        while let Some((off, depth)) = queue.pop_front() {
            if seen.len() >= 12 {
                break;
            }
            if off == 0 || !seen.insert(off) {
                continue;
            }
            let Some(ifd) = tiff.read_ifd(off) else { continue };
            if first {
                first = false;
                let exif = read_exif_info(&tiff, &ifd, &mut info);
                nikon_preview(src, &tiff, exif.as_ref(), &mut jpegs);
            }
            collect_tiff_jpegs(&tiff, &ifd, &mut jpegs);
            if depth < 2 {
                if let Some(t) = ifd.tags.get(&0x14a) {
                    for s in tiff.values(t) {
                        queue.push_back((s as u32, depth + 1));
                    }
                }
            }
            if depth == 0 && ifd.next != 0 {
                queue.push_back((ifd.next, 0));
            }
        }
    }

    let mut found: Vec<JpegPart> = Vec::new();
    let size = src.size().unwrap_or(0);
    for (offset, length) in jpegs {
        // Offsets and lengths are the file's own word: keep only parts inside it.
        if !(1000..=MAX_PART).contains(&length) || offset.checked_add(length).map_or(true, |end| end > size) {
            continue;
        }
        if let Some((width, height)) = jpeg_size(&src.get(offset, (length as usize).min(65536))) {
            found.push(JpegPart { offset, length: Some(length), width, height });
        }
    }
    found.sort_by_key(|j| std::cmp::Reverse(j.width as u64 * j.height as u64));
    if let Some(p) = found.first() {
        info.preview = Some(*p);
    }
    info.thumb = found.iter().skip(1).rfind(|j| j.width.max(j.height) >= 400).copied();
    info
}

// --- XMP ratings -----------------------------------------------------------

/// xmp:Rating from an XMP packet: 1-5 stars, 0 = no stars, -1 = rejected (Bridge).
pub fn read_rating(xmp: &str) -> Option<i32> {
    for prefix in ["xmp:Rating", "xap:Rating"] {
        let mut from = 0;
        while let Some(i) = xmp[from..].find(prefix) {
            let at = from + i;
            from = at + prefix.len();
            // Word boundary before (so MicrosoftPhoto:Rating doesn't count).
            if at > 0 && is_word(xmp.as_bytes()[at - 1]) {
                continue;
            }
            let rest = &xmp[from..];
            let t = rest.trim_start();
            if let Some(t) = t.strip_prefix('=') {
                let t = t.trim_start();
                let q = t.chars().next();
                if q == Some('"') || q == Some('\'') {
                    let v: String = t[1..].chars().take_while(|c| *c == '-' || c.is_ascii_digit()).collect();
                    if t[1 + v.len()..].starts_with(q.unwrap()) {
                        if let Ok(n) = v.parse() {
                            return Some(n);
                        }
                    }
                }
            } else if let Some(t) = rest.strip_prefix('>') {
                let v: String = t.trim_start().chars().take_while(|c| *c == '-' || c.is_ascii_digit()).collect();
                if let Ok(n) = v.parse() {
                    return Some(n);
                }
            }
        }
    }
    None
}

fn is_word(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

pub const XMP_NS: &str = "http://ns.adobe.com/xap/1.0/";

pub fn new_xmp(rating: i32) -> String {
    format!(
        "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\" x:xmptk=\"Flightroom\">\n <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n  <rdf:Description rdf:about=\"\"\n    xmlns:xmp=\"{XMP_NS}\"\n   xmp:Rating=\"{rating}\"/>\n </rdf:RDF>\n</x:xmpmeta>\n"
    )
}

/// An XMP packet's bytes as text Flightroom can edit in place. None: blank, so a
/// new packet may be written. Anything else (not UTF-8, no rdf:Description) is an
/// error, so metadata Flightroom can't read is never replaced with a new packet.
pub fn xmp_text(bytes: Vec<u8>) -> Result<Option<String>, String> {
    let text = String::from_utf8(bytes).map_err(|_| "its XMP isn't UTF-8 text, so Flightroom leaves it unchanged".to_string())?;
    if text.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}' || c == '\0').is_empty() {
        return Ok(None);
    }
    if !text.contains("<rdf:Description") {
        return Err("its XMP has no rdf:Description Flightroom can edit, so it is left unchanged".into());
    }
    Ok(Some(text))
}

/// Sets xmp:Rating in an existing XMP packet and leaves everything else untouched
/// (Lightroom keeps edits, keywords and labels in the same file).
pub fn set_rating(xmp: Option<&str>, rating: i32) -> String {
    let Some(xmp) = xmp.filter(|x| x.contains("<rdf:Description")) else { return new_xmp(rating) };
    let mut doc = crate::xmp::Doc::new(xmp);
    doc.set_attr("xmp", "Rating", &rating.to_string(), XMP_NS);
    doc.text
}

/// Returns a copy of a JPEG file with its XMP packet's rating set (added if missing).
pub fn set_jpeg_rating(buf: &[u8], rating: i32) -> Result<Vec<u8>, String> {
    let segs = jpeg_segments(buf);
    let old = segs.iter().find(|s| is_xmp(buf, s));
    let old_packet = match old {
        Some(s) => xmp_text(buf[(s.data_start + XMP_SIG.len()).min(s.end)..s.end].to_vec()).map_err(|e| format!("This JPEG can't be rated: {e}"))?,
        None => None,
    };
    let packet = set_rating(old_packet.as_deref(), rating);
    let wrapped = if packet.contains("<?xpacket begin") {
        packet
    } else {
        format!("<?xpacket begin=\"\u{feff}\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n{packet}<?xpacket end=\"w\"?>")
    };
    let mut body = XMP_SIG.to_vec();
    body.extend_from_slice(wrapped.as_bytes());
    if body.len() + 2 > 0xffff {
        return Err("XMP block is too large".into());
    }
    let mut seg = vec![0xff, 0xe1];
    seg.extend_from_slice(&((body.len() + 2) as u16).to_be_bytes());
    seg.extend_from_slice(&body);
    let mut out = Vec::with_capacity(buf.len() + seg.len());
    if let Some(o) = old {
        out.extend_from_slice(&buf[..o.start]);
        out.extend_from_slice(&seg);
        out.extend_from_slice(&buf[o.end..]);
    } else {
        // Put it after the JFIF/Exif headers, where other apps expect it.
        let at = segs.iter().rfind(|s| s.marker == 0xe0 || is_exif(buf, s)).map(|s| s.end).unwrap_or(2);
        out.extend_from_slice(&buf[..at]);
        out.extend_from_slice(&seg);
        out.extend_from_slice(&buf[at..]);
    }
    Ok(out)
}

// --- Folder listing ---------------------------------------------------------

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Group {
    pub base: String,
    pub raw: Option<String>,
    pub jpeg: Option<String>,
    pub sidecar: Option<String>,
    pub file: String,
    pub rating_in_file: bool,
}

/// Natural sort like Explorer: "DSC_9" before "DSC_10", case-insensitive.
pub fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let (a, b) = (a.to_lowercase(), b.to_lowercase());
    let (mut x, mut y) = (a.as_bytes(), b.as_bytes());
    loop {
        match (x.first(), y.first()) {
            (None, None) => return Ordering::Equal,
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
            (Some(c), Some(d)) if c.is_ascii_digit() && d.is_ascii_digit() => {
                let n = x.iter().take_while(|c| c.is_ascii_digit()).count();
                let m = y.iter().take_while(|c| c.is_ascii_digit()).count();
                let (p, q) = (&x[..n], &y[..m]);
                let pt = std::str::from_utf8(p).unwrap().trim_start_matches('0');
                let qt = std::str::from_utf8(q).unwrap().trim_start_matches('0');
                let o = pt.len().cmp(&qt.len()).then(pt.cmp(qt));
                if o != Ordering::Equal {
                    return o;
                }
                x = &x[n..];
                y = &y[m..];
            }
            (Some(c), Some(d)) => {
                if c != d {
                    return c.cmp(d);
                }
                x = &x[1..];
                y = &y[1..];
            }
        }
    }
}

/// Groups a folder's file names into photos. A RAW and a JPEG with the same name
/// (RAW+JPEG shooting) are one photo, rated through the RAW's .xmp sidecar the way
/// Lightroom treats them. A JPEG on its own keeps its rating inside the file.
pub fn group_photos(names: &[String]) -> Vec<Group> {
    let mut order: Vec<String> = Vec::new();
    let mut by_base: HashMap<String, Group> = HashMap::new();
    for name in names {
        let ext = ext_of(name);
        let key = base_of(name).to_lowercase();
        let g = by_base.entry(key.clone()).or_insert_with(|| {
            order.push(key.clone());
            Group { base: base_of(name).to_string(), ..Default::default() }
        });
        if RAW_EXTS.contains(&ext.as_str()) && g.raw.is_none() {
            g.raw = Some(name.clone());
        } else if JPEG_EXTS.contains(&ext.as_str()) && g.jpeg.is_none() {
            g.jpeg = Some(name.clone());
        } else if ext == ".xmp" {
            g.sidecar = Some(name.clone());
        }
    }
    let mut out: Vec<Group> = order
        .into_iter()
        .filter_map(|k| by_base.remove(&k))
        .filter(|g| g.raw.is_some() || g.jpeg.is_some())
        .map(|mut g| {
            g.file = g.raw.clone().or(g.jpeg.clone()).unwrap();
            g.rating_in_file = g.raw.is_none();
            g
        })
        .collect();
    out.sort_by(|a, b| natural_cmp(&a.file, &b.file));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const LR_SIDECAR: &str = r#"<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   xmp:Rating="2"
   crs:Exposure2012="+0.35">
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>"#;

    #[test]
    fn creates_a_sidecar_lightroom_can_read() {
        let x = set_rating(None, 4);
        assert_eq!(read_rating(&x), Some(4));
        assert!(x.contains("xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\""));
    }

    #[test]
    fn changes_only_the_rating_in_an_existing_sidecar() {
        let x = set_rating(Some(LR_SIDECAR), 5);
        assert_eq!(read_rating(&x), Some(5));
        assert_eq!(x.replace("xmp:Rating=\"5\"", "xmp:Rating=\"2\""), LR_SIDECAR);
    }

    #[test]
    fn adds_a_rating_to_a_sidecar_that_has_none() {
        let no_rating = LR_SIDECAR
            .replace("\n   xmp:Rating=\"2\"", "")
            .replace("\n    xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\"", "");
        let x = set_rating(Some(&no_rating), 3);
        assert_eq!(read_rating(&x), Some(3));
        assert!(x.contains("crs:Exposure2012=\"+0.35\""));
        assert!(x.contains("xmlns:xmp="));
    }

    #[test]
    fn element_form_and_microsoft_ratings() {
        let elem = "<rdf:Description><xmp:Rating>1</xmp:Rating><MicrosoftPhoto:Rating>99</MicrosoftPhoto:Rating></rdf:Description>";
        assert_eq!(read_rating(elem), Some(1));
        assert_eq!(read_rating(&set_rating(Some(elem), 0)), Some(0));
        assert_eq!(read_rating("<x MicrosoftPhoto:Rating=\"75\"/>"), None);
        assert_eq!(read_rating("<x xmp:Rating=\"-1\"/>"), Some(-1));
    }

    const JPEG: [u8; 25] = [0xff, 0xd8, 0xff, 0xe0, 0, 6, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xc0, 0, 11, 8, 0, 200, 1, 44, 1, 1, 0x11, 0, 0xff, 0xd9];

    /// A little-endian TIFF whose IFD0 points at a JPEG `claimed` bytes long (`real` of them in the file).
    fn tiff_with_jpeg(offset: u32, claimed: u32, real: usize) -> Vec<u8> {
        let mut t = b"II*\0".to_vec();
        t.extend(8u32.to_le_bytes());
        t.extend(2u16.to_le_bytes());
        for (tag, v) in [(0x201u16, offset), (0x202, claimed)] {
            t.extend(tag.to_le_bytes());
            t.extend(4u16.to_le_bytes());
            t.extend(1u32.to_le_bytes());
            t.extend(v.to_le_bytes());
        }
        t.extend(0u32.to_le_bytes());
        t.resize(offset as usize, 0);
        t.extend(JPEG);
        t.resize(offset as usize + real, 0);
        t
    }

    #[test]
    fn previews_must_lie_inside_the_file() {
        let ok = tiff_with_jpeg(64, 5000, 5000);
        let p = read_photo_info(&ok[..], ".nef").preview.unwrap();
        assert_eq!((p.offset, p.length, p.width), (64, Some(5000), 300));
        // Claims 4 GB, or runs past the end: no preview rather than a huge read.
        assert!(read_photo_info(&tiff_with_jpeg(64, u32::MAX, 5000)[..], ".nef").preview.is_none());
        assert!(read_photo_info(&tiff_with_jpeg(64, 5001, 5000)[..], ".nef").preview.is_none());
        // The same through a file, whose reads never allocate past its end.
        let path = std::env::temp_dir().join(format!("flightroom-test-preview-{}.nef", std::process::id()));
        std::fs::write(&path, tiff_with_jpeg(64, u32::MAX, 5000)).unwrap();
        let f = std::fs::File::open(&path).unwrap();
        assert!(read_photo_info(&f, ".nef").preview.is_none());
        assert_eq!(f.get(64, usize::MAX).len(), 5000);
        assert!(f.get(u64::MAX, 10).is_empty());
        drop(f);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn xmp_it_cant_read_is_never_replaced() {
        assert_eq!(xmp_text(b" \n".to_vec()), Ok(None));
        assert!(xmp_text(LR_SIDECAR.as_bytes().to_vec()).unwrap().is_some());
        assert!(xmp_text(vec![0xff, 0xfe, b'<', 0]).is_err());
        assert!(xmp_text(b"<x:xmpmeta/>".to_vec()).is_err());
        // A JPEG whose XMP isn't UTF-8 keeps it: rating it is refused.
        let mut body = XMP_SIG.to_vec();
        body.extend([0xc3, 0x28, b'<']);
        let mut j = JPEG[..2].to_vec();
        j.extend([0xff, 0xe1]);
        j.extend(((body.len() + 2) as u16).to_be_bytes());
        j.extend(&body);
        j.extend(&JPEG[2..]);
        assert!(set_jpeg_rating(&j, 3).is_err());
    }

    #[test]
    fn reads_jpeg_size() {
        assert_eq!(jpeg_size(&JPEG), Some((300, 200)));
    }

    #[test]
    fn writes_and_rewrites_the_rating_inside_a_jpeg() {
        let once = set_jpeg_rating(&JPEG, 3).unwrap();
        let twice = set_jpeg_rating(&once, 5).unwrap();
        let info = read_photo_info(&twice[..], ".jpg");
        assert_eq!(info.file_rating, Some(5));
        assert_eq!(info.preview.map(|p| (p.width, p.height)), Some((300, 200)));
        assert_eq!(twice.len(), once.len());
        assert_eq!(&twice[twice.len() - 14..], &JPEG[JPEG.len() - 14..]); // image data untouched
    }

    #[test]
    fn pairs_raw_and_jpeg_and_sorts_like_explorer() {
        let names: Vec<String> = ["DSC_10.NEF", "DSC_9.NEF", "DSC_9.JPG", "DSC_9.xmp", "solo.jpg", "clip.MP4", "notes.txt"]
            .iter().map(|s| s.to_string()).collect();
        let photos = group_photos(&names);
        let files: Vec<&str> = photos.iter().map(|p| p.file.as_str()).collect();
        assert_eq!(files, ["DSC_9.NEF", "DSC_10.NEF", "solo.jpg"]);
        assert_eq!(photos[0].raw.as_deref(), Some("DSC_9.NEF"));
        assert_eq!(photos[0].jpeg.as_deref(), Some("DSC_9.JPG"));
        assert_eq!(photos[0].sidecar.as_deref(), Some("DSC_9.xmp"));
        assert!(!photos[0].rating_in_file);
        assert!(photos[2].rating_in_file);
    }

    #[test]
    fn strips_exif() {
        let mut j = vec![0xff, 0xd8, 0xff, 0xe1, 0, 8];
        j.extend_from_slice(b"Exif\0\0");
        j.extend_from_slice(&JPEG[2..]);
        let s = strip_exif(j);
        assert_eq!(s, JPEG.to_vec());
    }
}

#[cfg(test)]
mod real_file {
    /// FLIGHTROOM_NEF=<file> cargo test -- --ignored --nocapture
    #[test]
    #[ignore]
    fn reads_a_real_file() {
        let p = std::env::var("FLIGHTROOM_NEF").expect("set FLIGHTROOM_NEF");
        let f = std::fs::File::open(&p).unwrap();
        let info = super::read_photo_info(&f, &super::ext_of(&p));
        println!("{} preview {:?} thumb {:?}", serde_json::to_string(&info).unwrap(), info.preview, info.thumb);
        assert!(info.preview.is_some() && info.thumb.is_some());
    }
}
