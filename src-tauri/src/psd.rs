// Photoshop documents (.psd, and .psb for big ones), read so Retouch can
// rebuild them as its own layers: pixel layers (text, shapes and smart objects
// come as the pixels Photoshop drew for them), groups, layer masks, blend
// modes, opacity and fill, clipping, adjustment layers, solid colour fills
// and layer styles. Nothing is ever written back into the file: what you do
// to it in Retouch is saved in its .xmp sidecar, like every other photo.
//
// gcimg://localhost/develop/psdlayer?p=<file>&i=<layer>      a layer's pixels (PNG with transparency)
// gcimg://localhost/develop/psdmask?p=<file>&i=<layer>[&edge] its layer mask (grey PNG)

use serde_json::{json, Map, Value};
use std::ops::Range;

/// A layer's colour channel: its id (0.. colours, -1 transparency, -2 mask, -3 the mask
/// beside a vector mask) and where its data is in the file.
#[derive(Clone, Debug)]
pub struct Chan {
    pub id: i16,
    pub at: Range<usize>,
}

#[derive(Clone, Debug)]
pub struct Mask {
    /// top, left, bottom, right (px)
    pub rect: [i32; 4],
    /// What's outside the rectangle (0 hidden, 255 shown).
    pub default: u8,
    pub flags: u8,
}

#[derive(Clone, Debug)]
pub struct Layer {
    pub name: String,
    /// top, left, bottom, right (px)
    pub rect: [i32; 4],
    pub chans: Vec<Chan>,
    pub blend: [u8; 4],
    pub opacity: u8,
    pub clip: bool,
    pub flags: u8,
    pub mask: Option<Mask>,
    /// The pixel mask when the layer also has a vector mask.
    pub real_mask: Option<Mask>,
    pub blocks: Vec<([u8; 4], Range<usize>)>,
}

pub struct Doc<'a> {
    pub d: &'a [u8],
    pub psb: bool,
    pub w: usize,
    pub h: usize,
    pub channels: usize,
    pub depth: u16,
    /// 1 grey, 3 RGB, 4 CMYK
    pub mode: u16,
    pub icc: Option<&'a [u8]>,
    /// The document's angle for layer styles that use it.
    pub global_angle: f64,
    /// Bottom layer first, as in the file.
    pub layers: Vec<Layer>,
    /// The document's own tagged blocks (patterns among them).
    pub globals: Vec<([u8; 4], Range<usize>)>,
    /// Image resources by id (Flightroom keeps its own in 7000 and 7001).
    pub resources: Vec<(u16, Range<usize>)>,
    /// Where the layer records start and end (Flightroom's saves fingerprint them).
    pub layer_span: Range<usize>,
    /// Where the flattened picture starts.
    merged: usize,
}

struct Rd<'a> {
    d: &'a [u8],
    i: usize,
}

type R<T> = Result<T, String>;
const SHORT: &str = "This Photoshop file is cut short or damaged";

impl<'a> Rd<'a> {
    fn new(d: &'a [u8], i: usize) -> Self {
        Rd { d, i }
    }
    fn take(&mut self, n: usize) -> R<&'a [u8]> {
        let end = self.i.checked_add(n).ok_or(SHORT)?;
        let s = self.d.get(self.i..end).ok_or(SHORT)?;
        self.i = end;
        Ok(s)
    }
    fn u8(&mut self) -> R<u8> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> R<u16> {
        Ok(u16::from_be_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn i16(&mut self) -> R<i16> {
        Ok(self.u16()? as i16)
    }
    fn u32(&mut self) -> R<u32> {
        Ok(u32::from_be_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i32(&mut self) -> R<i32> {
        Ok(self.u32()? as i32)
    }
    fn u64(&mut self) -> R<u64> {
        Ok(u64::from_be_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn f32(&mut self) -> R<f32> {
        Ok(f32::from_bits(self.u32()?))
    }
    fn f64(&mut self) -> R<f64> {
        Ok(f64::from_bits(self.u64()?))
    }
    fn key(&mut self) -> R<[u8; 4]> {
        Ok(self.take(4)?.try_into().unwrap())
    }
    /// A length that is 8 bytes in a .psb.
    fn len(&mut self, big: bool) -> R<usize> {
        Ok(if big { self.u64()? as usize } else { self.u32()? as usize })
    }
    /// UTF-16 with its length (in characters) first.
    fn unicode(&mut self) -> R<String> {
        let n = self.u32()? as usize;
        let b = self.take(n.checked_mul(2).ok_or(SHORT)?)?;
        let u: Vec<u16> = b.chunks_exact(2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect();
        Ok(String::from_utf16_lossy(&u).trim_end_matches('\0').to_string())
    }
    /// A descriptor key: a 4-letter code, or a longer name with its length first.
    fn id(&mut self) -> R<String> {
        let n = self.u32()? as usize;
        let b = self.take(if n == 0 { 4 } else { n })?;
        Ok(String::from_utf8_lossy(b).into_owned())
    }
}

/// Keys whose length is 8 bytes in a .psb.
const BIG_KEYS: &[&[u8; 4]] = &[
    b"LMsk", b"Lr16", b"Lr32", b"Layr", b"Mt16", b"Mt32", b"Mtrn", b"Alph", b"FMsk", b"lnk2", b"lnk3", b"lnkE", b"FEid", b"FXid", b"PxSD", b"pths", b"extd",
    b"extn", b"cinf", b"artd",
];

/// Tagged blocks from `r` until `end` (padding: what their lengths are rounded up to).
fn blocks(r: &mut Rd, end: usize, psb: bool, pad: usize) -> Vec<([u8; 4], Range<usize>)> {
    let mut out = Vec::new();
    while r.i + 12 <= end {
        let Ok(sig) = r.key() else { break };
        if &sig != b"8BIM" && &sig != b"8B64" {
            break;
        }
        let Ok(key) = r.key() else { break };
        let big = psb && BIG_KEYS.contains(&&key);
        let Ok(n) = r.len(big) else { break };
        let at = r.i;
        let Some(e) = at.checked_add(n).filter(|&e| e <= end) else { break };
        out.push((key, at..e));
        r.i = e;
        // Rounded up to `pad` bytes, but writers don't all agree: only when the next block starts there.
        let padded = e.div_ceil(pad) * pad;
        if padded != e && padded + 4 <= end && matches!(r.d.get(padded..padded + 4), Some(b"8BIM") | Some(b"8B64")) {
            r.i = padded;
        }
    }
    out
}

pub fn is_psd(ext: &str) -> bool {
    matches!(ext, ".psd" | ".psb")
}

impl<'a> Doc<'a> {
    pub fn parse(d: &'a [u8]) -> R<Doc<'a>> {
        let mut r = Rd::new(d, 0);
        if r.take(4)? != b"8BPS" {
            return Err("This isn't a Photoshop file".into());
        }
        let version = r.u16()?;
        let psb = version == 2;
        r.take(6)?;
        let channels = r.u16()? as usize;
        let h = r.u32()? as usize;
        let w = r.u32()? as usize;
        let depth = r.u16()?;
        let mode = r.u16()?;
        if !matches!(depth, 1 | 8 | 16 | 32) {
            return Err(format!("{depth}-bit Photoshop files can't be opened"));
        }
        if !matches!(mode, 1 | 3 | 4) {
            let name = match mode {
                0 => "Bitmap",
                2 => "Indexed Color",
                7 => "Multichannel",
                8 => "Duotone",
                9 => "Lab Color",
                _ => "this colour mode",
            };
            return Err(format!("Photoshop files in {name} can't be opened yet (RGB, CMYK and Grayscale can)"));
        }
        if w == 0 || h == 0 || (w as u64 * h as u64) > 400_000_000 {
            return Err("This Photoshop file's picture is too large or empty".into());
        }
        let n = r.u32()? as usize;
        r.take(n)?; // colour mode data
        let n = r.u32()? as usize;
        let res_end = r.i + n;
        let (mut icc, mut global_angle) = (None, 120.0);
        let mut resources = Vec::new();
        while r.i + 12 <= res_end {
            if r.take(4)? != b"8BIM" {
                break;
            }
            let id = r.u16()?;
            let name = r.u8()? as usize;
            r.take(name + (name + 1) % 2)?;
            let size = r.u32()? as usize;
            let at = r.i;
            r.take(size + size % 2)?;
            resources.push((id, at..at + size));
            match id {
                1039 => icc = d.get(at..at + size),
                1037 if size >= 4 => global_angle = i32::from_be_bytes(d[at..at + 4].try_into().unwrap()) as f64,
                _ => {}
            }
        }
        r.i = res_end;
        let n = r.len(psb)?;
        let lm_end = r.i.checked_add(n).ok_or(SHORT)?;
        let mut layers = Vec::new();
        let mut globals = Vec::new();
        let mut layer_span = 0..0;
        if n > 0 {
            let info = r.len(psb)?;
            let info_end = r.i + info;
            if info > 0 {
                layer_span = r.i..info_end;
                layers = layer_info(&mut Rd::new(d, r.i), info_end, psb)?;
            }
            r.i = info_end;
            // Global mask info, then more blocks: 16- and 32-bit documents keep their layers in one.
            if r.i + 4 <= lm_end {
                let g = r.u32()? as usize;
                r.i += g;
            }
            globals = blocks(&mut r, lm_end, psb, 4);
            if layers.is_empty() {
                for (k, at) in &globals {
                    if matches!(k, b"Lr16" | b"Lr32" | b"Layr") {
                        layer_span = at.clone();
                        layers = layer_info(&mut Rd::new(d, at.start), at.end, psb)?;
                    }
                }
            }
        }
        Ok(Doc { d, psb, w, h, channels, depth, mode, icc, global_angle, layers, globals, resources, layer_span, merged: lm_end })
    }

    /// The colour channels a layer of this document has (grey 1, RGB 3, CMYK 4).
    pub fn colours(&self) -> usize {
        match self.mode {
            1 => 1,
            4 => 4,
            _ => 3,
        }
    }

    /// One channel's data as 16-bit values (w x h).
    fn plane(&self, at: &Range<usize>, w: usize, h: usize) -> R<Vec<u16>> {
        if w == 0 || h == 0 {
            return Ok(Vec::new());
        }
        let comp = Rd::new(self.d, at.start).u16()?;
        self.unpack(comp, &self.d[(at.start + 2).min(at.end)..at.end], w, h, None)
    }

    /// Unpacks pixels: raw, PackBits (RLE: `counts` are where the row lengths are, else just before the data), ZIP.
    fn unpack(&self, comp: u16, data: &[u8], w: usize, h: usize, counts: Option<&[usize]>) -> R<Vec<u16>> {
        let bpp = match self.depth {
            1 => 0,
            8 => 1,
            16 => 2,
            _ => 4,
        };
        let row = if bpp == 0 { w.div_ceil(8) } else { w * bpp };
        let bytes: Vec<u8> = match comp {
            0 => data.get(..row * h).ok_or(SHORT)?.to_vec(),
            1 => {
                let cw = if self.psb { 4 } else { 2 };
                let (lens, mut i): (Vec<usize>, usize) = match counts {
                    Some(c) => (c.to_vec(), 0),
                    None => {
                        let head = data.get(..h * cw).ok_or(SHORT)?;
                        let l = head.chunks_exact(cw).map(|c| if cw == 2 { u16::from_be_bytes([c[0], c[1]]) as usize } else { u32::from_be_bytes([c[0], c[1], c[2], c[3]]) as usize }).collect();
                        (l, h * cw)
                    }
                };
                let mut out = vec![0u8; row * h];
                for (y, &n) in lens.iter().enumerate().take(h) {
                    let src = data.get(i..i + n).ok_or(SHORT)?;
                    packbits(src, &mut out[y * row..(y + 1) * row]);
                    i += n;
                }
                out
            }
            2 | 3 => {
                use std::io::Read;
                let mut out = Vec::with_capacity(row * h);
                flate2::read::ZlibDecoder::new(data).take((row * h) as u64).read_to_end(&mut out).map_err(|e| format!("Couldn't unpack this Photoshop file: {e}"))?;
                out.resize(row * h, 0);
                if comp == 3 {
                    unpredict(&mut out, w, h, bpp);
                }
                out
            }
            _ => return Err("This Photoshop file is packed in a way that can't be read".into()),
        };
        Ok(match bpp {
            0 => (0..w * h).map(|i| if bytes[(i / w) * row + (i % w) / 8] >> (7 - i % 8) & 1 == 1 { 0 } else { 65535 }).collect(),
            1 => bytes.iter().map(|&v| v as u16 * 257).collect(),
            2 => bytes.chunks_exact(2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect(),
            // 32-bit documents are linear light: shown as on screen (sRGB's curve).
            _ => bytes.chunks_exact(4).map(|c| (encode_srgb(f32::from_be_bytes([c[0], c[1], c[2], c[3]])) * 65535.0 + 0.5) as u16).collect(),
        })
    }

    /// A layer's channel (by id) at the layer's size; None when it has none.
    fn chan(&self, l: &Layer, id: i16, w: usize, h: usize) -> R<Option<Vec<u16>>> {
        match l.chans.iter().find(|c| c.id == id) {
            Some(c) => self.plane(&c.at, w, h).map(Some),
            None => Ok(None),
        }
    }

    /// A layer's pixels as 8-bit RGBA, at its own size (its rect).
    pub fn layer_rgba(&self, l: &Layer) -> R<(usize, usize, Vec<u8>)> {
        let (w, h) = ((l.rect[3] - l.rect[1]).max(0) as usize, (l.rect[2] - l.rect[0]).max(0) as usize);
        let n = self.colours();
        let mut ch = Vec::new();
        for id in 0..n as i16 {
            ch.push(self.chan(l, id, w, h)?.unwrap_or_else(|| vec![0; w * h]));
        }
        let alpha = self.chan(l, -1, w, h)?;
        let rgb = to_rgb(&ch, self.mode);
        let mut out = vec![0u8; w * h * 4];
        for (i, px) in out.chunks_exact_mut(4).enumerate() {
            px[0] = (rgb[0][i] >> 8) as u8;
            px[1] = (rgb[1][i] >> 8) as u8;
            px[2] = (rgb[2][i] >> 8) as u8;
            px[3] = alpha.as_ref().map_or(255, |a| (a[i] >> 8) as u8);
        }
        Ok((w, h, out))
    }

    /// The layer mask Retouch uses (the pixel mask), with its own rectangle.
    pub fn mask_of<'l>(&self, l: &'l Layer) -> Option<(i16, &'l Mask)> {
        if l.chans.iter().any(|c| c.id == -3) {
            return l.real_mask.as_ref().map(|m| (-3, m));
        }
        if l.chans.iter().any(|c| c.id == -2) {
            return l.mask.as_ref().map(|m| (-2, m));
        }
        None
    }

    /// A layer's mask as 8-bit grey at its rectangle's size.
    pub fn mask_grey(&self, l: &Layer) -> R<Option<(usize, usize, Vec<u8>)>> {
        let Some((id, m)) = self.mask_of(l) else { return Ok(None) };
        let (w, h) = ((m.rect[3] - m.rect[1]).max(0) as usize, (m.rect[2] - m.rect[0]).max(0) as usize);
        Ok(self.chan(l, id, w, h)?.map(|v| (w, h, v.iter().map(|&x| (x >> 8) as u8).collect())))
    }

    /// The flattened picture Photoshop saved with the document, as 16-bit RGB.
    pub fn merged(&self) -> R<Vec<u16>> {
        let (w, h) = (self.w, self.h);
        let mut r = Rd::new(self.d, self.merged);
        let comp = r.u16()?;
        let n = self.colours().min(self.channels.max(1));
        let bpp = match self.depth {
            1 => 0,
            8 => 1,
            16 => 2,
            _ => 4,
        };
        let row = if bpp == 0 { w.div_ceil(8) } else { w * bpp };
        let mut ch = Vec::new();
        if comp == 1 {
            // PackBits: every row's length (of every channel) first, then the rows.
            let cw = if self.psb { 4 } else { 2 };
            let total = h * self.channels;
            let mut lens = Vec::with_capacity(total);
            for _ in 0..total {
                lens.push(if cw == 2 { r.u16()? as usize } else { r.u32()? as usize });
            }
            let mut i = r.i;
            for c in 0..n {
                let l = &lens[c * h..(c + 1) * h];
                let size: usize = l.iter().sum();
                ch.push(self.unpack(1, self.d.get(i..i + size).ok_or(SHORT)?, w, h, Some(l))?);
                i += size;
            }
        } else if comp == 0 {
            for c in 0..n {
                let at = r.i + c * row * h;
                ch.push(self.unpack(0, self.d.get(at..at + row * h).ok_or(SHORT)?, w, h, None)?);
            }
        } else {
            // ZIP: all channels in one stream.
            use std::io::Read;
            let mut all = Vec::new();
            flate2::read::ZlibDecoder::new(&self.d[r.i..]).take((row * h * n) as u64).read_to_end(&mut all).map_err(|e| e.to_string())?;
            all.resize(row * h * n, 0);
            for c in 0..n {
                let mut part = all[c * row * h..(c + 1) * row * h].to_vec();
                if comp == 3 {
                    unpredict(&mut part, w, h, bpp);
                }
                ch.push(self.unpack(0, &part, w, h, None)?);
            }
        }
        let rgb = to_rgb(&ch, self.mode);
        let mut out = vec![0u16; w * h * 3];
        for (i, px) in out.chunks_exact_mut(3).enumerate() {
            px[0] = rgb[0][i];
            px[1] = rgb[1][i];
            px[2] = rgb[2][i];
        }
        Ok(out)
    }

    /// The bottom layer when it's a background Retouch can develop under the
    /// others: covers the whole picture, no see-through pixels, nothing
    /// changing how it shows.
    pub fn background(&self) -> Option<usize> {
        let l = self.layers.first()?;
        let plain = l.blocks.iter().all(|(k, _)| !is_special(k));
        let full = l.rect == [0, 0, self.h as i32, self.w as i32];
        let shown = l.flags & 2 == 0 && l.opacity == 255 && &l.blend == b"norm" && !l.clip && self.mask_of(l).is_none();
        (plain && full && shown && !l.chans.iter().any(|c| c.id == -1)).then_some(0)
    }

    /// The picture Develop starts from: the background layer, the flattened
    /// picture when there are no layers, else white.
    pub fn base(&self) -> R<Vec<u16>> {
        if self.layers.is_empty() {
            return self.merged();
        }
        match self.background() {
            Some(i) => {
                let l = &self.layers[i];
                let n = self.colours();
                let mut ch = Vec::new();
                for id in 0..n as i16 {
                    ch.push(self.chan(l, id, self.w, self.h)?.unwrap_or_else(|| vec![0; self.w * self.h]));
                }
                let rgb = to_rgb(&ch, self.mode);
                Ok((0..self.w * self.h).flat_map(|i| [rgb[0][i], rgb[1][i], rgb[2][i]]).collect())
            }
            None => Ok(vec![65535; self.w * self.h * 3]),
        }
    }

    fn block(&self, l: &Layer, key: &[u8; 4]) -> Option<&'a [u8]> {
        l.blocks.iter().find(|(k, _)| k == key).map(|(_, r)| &self.d[r.clone()])
    }
}

/// A pattern from a document's Patt / Pat2 / Pat3 block: (id, name, w, h, RGBA).
pub type Pattern = (String, String, usize, usize, Vec<u8>);

/// The patterns kept in the document (what its Pattern Overlays fill with).
pub fn patterns(doc: &Doc) -> Vec<Pattern> {
    let mut out = Vec::new();
    for (k, at) in &doc.globals {
        if !matches!(k, b"Patt" | b"Pat2" | b"Pat3") {
            continue;
        }
        let b = &doc.d[at.clone()];
        let mut i = 0;
        while i + 4 <= b.len() {
            let n = u32::from_be_bytes(b[i..i + 4].try_into().unwrap()) as usize;
            let Some(p) = b.get(i + 4..i + 4 + n) else { break };
            if let Some(pat) = pattern(p) {
                out.push(pat);
            }
            i = (i + 4 + n).div_ceil(4) * 4;
        }
    }
    out
}

fn pattern(b: &[u8]) -> Option<Pattern> {
    let mut r = Rd::new(b, 0);
    if r.u32().ok()? != 1 {
        return None;
    }
    let mode = r.u32().ok()?;
    let (ph, pw) = (r.u16().ok()? as usize, r.u16().ok()? as usize);
    let name = r.unicode().ok()?;
    let n = r.u8().ok()? as usize;
    let id = String::from_utf8_lossy(r.take(n).ok()?).into_owned();
    let mut palette = None;
    if mode == 2 {
        palette = Some(r.take(768).ok()?.to_vec());
        r.take(4).ok()?;
    }
    // A virtual memory array list: the picture's channels.
    if r.u32().ok()? != 3 {
        return None;
    }
    r.u32().ok()?;
    let rect = [r.i32().ok()?, r.i32().ok()?, r.i32().ok()?, r.i32().ok()?];
    let (w, h) = ((rect[3] - rect[1]).max(0) as usize, (rect[2] - rect[0]).max(0) as usize);
    let _ = (pw, ph);
    if w == 0 || h == 0 || w * h > 16_000_000 {
        return None;
    }
    let nch = r.u32().ok()? as usize;
    let mut chans: Vec<Option<Vec<u8>>> = Vec::new();
    for _ in 0..(nch + 2).min(64) {
        if r.u32().ok()? == 0 {
            chans.push(None);
            continue;
        }
        let len = r.u32().ok()? as usize;
        if len == 0 {
            chans.push(None);
            continue;
        }
        let start = r.i;
        let depth = r.u32().ok()?;
        r.take(16).ok()?;
        r.u16().ok()?;
        let comp = r.u8().ok()?;
        let data = r.take((start + len).checked_sub(r.i)?).ok()?;
        if depth != 8 {
            chans.push(None);
            continue;
        }
        let plane = if comp == 1 {
            let counts: Vec<usize> = (0..h).map(|y| u16::from_be_bytes([data[y * 2], data[y * 2 + 1]]) as usize).collect();
            let mut out = vec![0u8; w * h];
            let mut at = h * 2;
            for (y, c) in counts.iter().enumerate() {
                packbits(data.get(at..at + c)?, &mut out[y * w..(y + 1) * w]);
                at += c;
            }
            out
        } else {
            data.get(..w * h)?.to_vec()
        };
        chans.push(Some(plane));
    }
    let get = |i: usize| chans.get(i).cloned().flatten();
    let mut rgba = vec![255u8; w * h * 4];
    match mode {
        1 | 8 => {
            let g = get(0)?;
            for (i, v) in g.iter().enumerate() {
                rgba[i * 4..i * 4 + 3].fill(*v);
            }
        }
        2 => {
            let (ix, pal) = (get(0)?, palette?);
            for (i, v) in ix.iter().enumerate() {
                let k = *v as usize;
                rgba[i * 4] = pal[k * 3];
                rgba[i * 4 + 1] = pal[k * 3 + 1];
                rgba[i * 4 + 2] = pal[k * 3 + 2];
            }
        }
        _ => {
            let (r_, g, b) = (get(0)?, get(1)?, get(2)?);
            for i in 0..w * h {
                rgba[i * 4] = r_[i];
                rgba[i * 4 + 1] = g[i];
                rgba[i * 4 + 2] = b[i];
            }
            if let Some(a) = get(3).filter(|_| nch > 3) {
                for i in 0..w * h {
                    rgba[i * 4 + 3] = a[i];
                }
            }
        }
    }
    Some((id, name, w, h, rgba))
}

/// RGBA pixels as a PNG data URL.
pub fn png_data_url(w: usize, h: usize, rgba: &[u8]) -> Option<String> {
    use base64::Engine;
    use image::ImageEncoder;
    let mut png = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png).write_image(rgba, w as u32, h as u32, image::ExtendedColorType::Rgba8).ok()?;
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
}

/// Photoshop's text engine data (a PostScript-like dictionary) as JSON.
fn engine_data(b: &[u8]) -> Option<Value> {
    let mut i = 0;
    let v = engine_value(b, &mut i, 0)?;
    Some(v)
}

fn engine_skip(b: &[u8], i: &mut usize) {
    while *i < b.len() && (b[*i].is_ascii_whitespace() || b[*i] == 0) {
        *i += 1;
    }
}

fn engine_value(b: &[u8], i: &mut usize, depth: usize) -> Option<Value> {
    if depth > 64 {
        return None;
    }
    engine_skip(b, i);
    let c = *b.get(*i)?;
    if b[*i..].starts_with(b"<<") {
        *i += 2;
        let mut m = Map::new();
        loop {
            engine_skip(b, i);
            if b.get(*i..)?.starts_with(b">>") {
                *i += 2;
                return Some(Value::Object(m));
            }
            if b[*i] != b'/' {
                return None;
            }
            *i += 1;
            let s = *i;
            while *i < b.len() && !b[*i].is_ascii_whitespace() && !matches!(b[*i], b'/' | b'<' | b'[' | b'(' | b'>' | b']') {
                *i += 1;
            }
            let k = String::from_utf8_lossy(&b[s..*i]).into_owned();
            let v = engine_value(b, i, depth + 1)?;
            m.insert(k, v);
        }
    }
    match c {
        b'[' => {
            *i += 1;
            let mut a = Vec::new();
            loop {
                engine_skip(b, i);
                if *b.get(*i)? == b']' {
                    *i += 1;
                    return Some(Value::Array(a));
                }
                a.push(engine_value(b, i, depth + 1)?);
            }
        }
        b'(' => {
            *i += 1;
            let mut raw = Vec::new();
            while *i < b.len() && b[*i] != b')' {
                if b[*i] == b'\\' && *i + 1 < b.len() {
                    *i += 1;
                }
                raw.push(b[*i]);
                *i += 1;
            }
            *i += 1;
            let text = if raw.starts_with(&[0xFE, 0xFF]) {
                let u: Vec<u16> = raw[2..].chunks(2).filter(|c| c.len() == 2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect();
                String::from_utf16_lossy(&u)
            } else {
                String::from_utf8_lossy(&raw).into_owned()
            };
            Some(Value::String(text))
        }
        b'/' => {
            *i += 1;
            let s = *i;
            while *i < b.len() && !b[*i].is_ascii_whitespace() && !matches!(b[*i], b'/' | b'<' | b'[' | b'(' | b'>' | b']') {
                *i += 1;
            }
            Some(Value::String(String::from_utf8_lossy(&b[s..*i]).into_owned()))
        }
        _ => {
            let s = *i;
            while *i < b.len() && !b[*i].is_ascii_whitespace() && !matches!(b[*i], b'/' | b'<' | b'[' | b'(' | b'>' | b']') {
                *i += 1;
            }
            let t = std::str::from_utf8(&b[s..*i]).ok()?;
            if *i == s {
                return None;
            }
            Some(match t {
                "true" => Value::Bool(true),
                "false" => Value::Bool(false),
                _ => t.parse::<f64>().map(|f| json!(f)).unwrap_or(Value::String(t.into())),
            })
        }
    }
}

/// A PostScript font name as the family a computer knows it by, and whether it's bold and italic.
fn font_family(ps: &str) -> (String, bool, bool) {
    let (fam, style) = ps.split_once('-').unwrap_or((ps, ""));
    let fam = fam.trim_end_matches("PSMT").trim_end_matches("MT").trim_end_matches("PS");
    let mut out = String::new();
    let cs: Vec<char> = fam.chars().collect();
    for (i, c) in cs.iter().enumerate() {
        if i > 0 && c.is_uppercase() && (cs[i - 1].is_lowercase() || cs.get(i + 1).is_some_and(|n| n.is_lowercase()) && cs[i - 1].is_uppercase()) {
            out.push(' ');
        }
        out.push(*c);
    }
    let st = style.to_ascii_lowercase();
    let bold = st.contains("bold") || st.contains("black") || st.contains("heavy") || ps.to_ascii_lowercase().contains("bold");
    (out, bold, st.contains("italic") || st.contains("oblique"))
}

/// A type layer as Retouch's text: what it says, its font, size, colour and place.
fn text_layer(doc: &Doc, l: &Layer, notes: &mut Vec<String>) -> Option<Value> {
    let b = doc.block(l, b"TySh")?;
    let mut r = Rd::new(b, 0);
    r.u16().ok()?;
    let t: Vec<f64> = (0..6).map(|_| r.f64()).collect::<R<_>>().ok()?;
    r.u16().ok()?;
    r.u32().ok()?;
    let at = r.i;
    let d = descriptor(&mut r, 0).ok()?;
    let mut text = d.get("Txt").and_then(Value::as_str).unwrap_or("").to_string();
    let range = d.get("EngineData").and_then(|e| e.get("data")).and_then(Value::as_array)?;
    let (s, e) = (range.first()?.as_u64()? as usize, range.get(1)?.as_u64()? as usize);
    // tdta positions are within the block.
    let _ = at;
    let ed = engine_data(b.get(s..e)?)?;
    let eng = ed.get("EngineDict")?;
    if text.is_empty() {
        text = eng.get("Editor").and_then(|x| x.get("Text")).and_then(Value::as_str).unwrap_or("").to_string();
    }
    let text = text.trim_end_matches(['\r', '\n']).replace('\r', "\n");
    let runs = eng.get("StyleRun").and_then(|x| x.get("RunArray")).and_then(Value::as_array);
    let first = runs.and_then(|a| a.first()).and_then(|x| x.get("StyleSheet")).and_then(|x| x.get("StyleSheetData"));
    let res = ed.get("ResourceDict").or_else(|| ed.get("DocumentResources"));
    let def = res.and_then(|r| r.get("StyleSheetSet")).and_then(Value::as_array).and_then(|a| a.first()).and_then(|x| x.get("StyleSheetData"));
    let get = |k: &str| first.and_then(|f| f.get(k)).or_else(|| def.and_then(|f| f.get(k)));
    let fonts = res.and_then(|r| r.get("FontSet")).and_then(Value::as_array);
    let ps = get("Font").and_then(Value::as_f64).and_then(|i| fonts?.get(i as usize)?.get("Name")?.as_str()).unwrap_or("ArialMT");
    let (font, bold, italic) = font_family(ps);
    let size = get("FontSize").and_then(Value::as_f64).unwrap_or(12.0);
    let color = get("FillColor").and_then(|c| c.get("Values")).and_then(Value::as_array).map(|v| {
        let f = |i: usize| v.get(i).and_then(Value::as_f64).unwrap_or(0.0);
        [f(1), f(2), f(3)]
    });
    let leading = if get("AutoLeading").and_then(Value::as_bool).unwrap_or(true) { 1.2 } else { get("Leading").and_then(Value::as_f64).map(|v| v / size.max(0.01)).unwrap_or(1.2) };
    let just = eng.get("ParagraphRun").and_then(|x| x.get("RunArray")).and_then(Value::as_array).and_then(|a| a.first())
        .and_then(|x| x.get("ParagraphSheet")).and_then(|x| x.get("Properties")).and_then(|x| x.get("Justification")).and_then(Value::as_f64).unwrap_or(0.0) as i32;
    let align = match just {
        1 => "right",
        2 => "center",
        _ => "left",
    };
    if runs.is_some_and(|a| a.len() > 1) {
        notes.push(format!("{}: text with mixed styles comes in with its first style", l.name));
    }
    // A text box (paragraph text): its lines start at the box's top.
    let shape = eng.get("Rendered").and_then(|x| x.get("Shapes")).and_then(|x| x.get("Children")).and_then(Value::as_array).and_then(|a| a.first());
    let boxed = shape.and_then(|x| x.get("ShapeType")).and_then(Value::as_f64) == Some(1.0);
    let bounds = d.get("bounds").or_else(|| d.get("boundingBox"));
    let bnum = |k: &str| bounds.and_then(|b| num(b, k)).unwrap_or(0.0);
    // Text space -> the picture: x' = xx x + yx y + tx, y' = xy x + yy y + ty.
    let [xx, xy, yx, yy, tx, ty] = [t[0], t[1], t[2], t[3], t[4], t[5]];
    let lh = size * leading;
    // From the top of a line to its baseline, as Retouch lays out a line (canvas 'top').
    let base_drop = (lh - size) / 2.0 + 0.86 * size;
    let x = if boxed {
        let (l0, r0) = (bnum("Left"), bnum("Rght"));
        match align {
            "center" => (l0 + r0) / 2.0,
            "right" => r0,
            _ => l0,
        }
    } else {
        0.0
    };
    let y = if boxed { bnum("Top") } else { -base_drop };
    let (ow, oh) = (doc.w as f64, doc.h as f64);
    let long = ow.max(oh);
    let plain = xy.abs() < 1e-6 && yx.abs() < 1e-6 && (xx - yy).abs() < 1e-6 && xx > 0.0;
    let mut out = json!({
        "text": text, "font": font, "bold": bold || get("FauxBold").and_then(Value::as_bool).unwrap_or(false),
        "italic": italic || get("FauxItalic").and_then(Value::as_bool).unwrap_or(false), "underline": get("Underline").and_then(Value::as_bool).unwrap_or(false),
        "color": color.unwrap_or([0.0; 3]), "align": align, "tracking": get("Tracking").and_then(Value::as_f64).unwrap_or(0.0), "leading": leading,
    });
    if plain {
        out["size"] = json!(size * xx / long);
        out["x"] = json!((tx + x * xx) / ow);
        out["y"] = json!((ty + y * xx) / oh);
    } else {
        out["size"] = json!(size / long);
        out["x"] = json!(x / ow);
        out["y"] = json!(y / oh);
        out["tf"] = json!([xx, yx, tx / long, xy, yy, ty / long]);
    }
    Some(out)
}

/// Blocks that make a layer something other than plain pixels.
fn is_special(k: &[u8; 4]) -> bool {
    ADJUST_KEYS.contains(&k) || matches!(k, b"lsct" | b"lsdk" | b"SoCo" | b"GdFl" | b"PtFl" | b"TySh" | b"lfx2" | b"lmfx" | b"vmsk" | b"vsms")
}

const ADJUST_KEYS: &[&[u8; 4]] = &[
    b"brit", b"CgEd", b"levl", b"curv", b"expA", b"vibA", b"hue2", b"hue ", b"blnc", b"blwh", b"phfl", b"mixr", b"clrL", b"nvrt", b"post", b"thrs", b"grdm", b"selc",
];

fn encode_srgb(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    if v <= 0.0031308 {
        v * 12.92
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    }
}

/// Grey, RGB or CMYK channels as R, G and B.
fn to_rgb(ch: &[Vec<u16>], mode: u16) -> [Vec<u16>; 3] {
    match mode {
        1 => [ch[0].clone(), ch[0].clone(), ch[0].clone()],
        4 if ch.len() >= 4 => {
            // Photoshop stores ink inverted (65535: none). A simple conversion, without the CMYK profile.
            let k = &ch[3];
            let f = |c: &Vec<u16>| c.iter().zip(k).map(|(&c, &k)| ((c as u32 * k as u32) / 65535) as u16).collect::<Vec<u16>>();
            [f(&ch[0]), f(&ch[1]), f(&ch[2])]
        }
        _ => [ch[0].clone(), ch.get(1).unwrap_or(&ch[0]).clone(), ch.get(2).unwrap_or(&ch[0]).clone()],
    }
}

/// PackBits data unpacked into `out`.
pub fn unpack_bits(src: &[u8], out: &mut [u8]) {
    packbits(src, out)
}

fn packbits(src: &[u8], out: &mut [u8]) {
    let (mut i, mut o) = (0, 0);
    while i < src.len() && o < out.len() {
        let n = src[i] as i8;
        i += 1;
        if n >= 0 {
            let c = (n as usize + 1).min(src.len() - i).min(out.len() - o);
            out[o..o + c].copy_from_slice(&src[i..i + c]);
            i += n as usize + 1;
            o += c;
        } else if n != -128 {
            let c = ((1 - n as isize) as usize).min(out.len() - o);
            let v = src.get(i).copied().unwrap_or(0);
            out[o..o + c].fill(v);
            i += 1;
            o += c;
        }
    }
}

/// Undoes ZIP-with-prediction: each row's values were stored as differences
/// (32-bit: the bytes of a row split by significance first).
fn unpredict(b: &mut [u8], w: usize, h: usize, bpp: usize) {
    match bpp {
        1 => {
            for row in b.chunks_exact_mut(w).take(h) {
                for x in 1..w {
                    row[x] = row[x].wrapping_add(row[x - 1]);
                }
            }
        }
        2 => {
            for row in b.chunks_exact_mut(w * 2).take(h) {
                for x in 1..w {
                    let p = u16::from_be_bytes([row[x * 2 - 2], row[x * 2 - 1]]);
                    let v = u16::from_be_bytes([row[x * 2], row[x * 2 + 1]]).wrapping_add(p);
                    row[x * 2..x * 2 + 2].copy_from_slice(&v.to_be_bytes());
                }
            }
        }
        4 => {
            let mut tmp = vec![0u8; w * 4];
            for row in b.chunks_exact_mut(w * 4).take(h) {
                for x in 1..w * 4 {
                    row[x] = row[x].wrapping_add(row[x - 1]);
                }
                for x in 0..w {
                    for k in 0..4 {
                        tmp[x * 4 + k] = row[k * w + x];
                    }
                }
                row.copy_from_slice(&tmp);
            }
        }
        _ => {}
    }
}

fn mask_rec(r: &mut Rd) -> R<Mask> {
    let rect = [r.i32()?, r.i32()?, r.i32()?, r.i32()?];
    let default = r.u8()?;
    let flags = r.u8()?;
    Ok(Mask { rect, default, flags })
}

/// Layer records and where their channels' data is.
fn layer_info(r: &mut Rd, end: usize, psb: bool) -> R<Vec<Layer>> {
    let count = (r.i16()? as i32).unsigned_abs() as usize;
    let mut layers = Vec::with_capacity(count);
    let mut lens = Vec::with_capacity(count);
    for _ in 0..count {
        let rect = [r.i32()?, r.i32()?, r.i32()?, r.i32()?];
        let nc = r.u16()? as usize;
        let mut ch = Vec::with_capacity(nc);
        for _ in 0..nc {
            ch.push((r.i16()?, r.len(psb)?));
        }
        if r.take(4)? != b"8BIM" {
            return Err(SHORT.into());
        }
        let blend = r.key()?;
        let opacity = r.u8()?;
        let clip = r.u8()? != 0;
        let flags = r.u8()?;
        r.u8()?;
        let extra = r.u32()? as usize;
        let extra_end = r.i + extra;
        // Layer mask data.
        let n = r.u32()? as usize;
        let mask_end = r.i + n;
        let (mut mask, mut real_mask) = (None, None);
        if n >= 20 {
            let m = mask_rec(r)?;
            // A pixel mask beside a vector mask has its own header (its density and feather follow; not needed).
            if ch.iter().any(|c| c.0 == -3) && n >= 36 {
                let flags = r.u8()?;
                let default = r.u8()?;
                let rect = [r.i32()?, r.i32()?, r.i32()?, r.i32()?];
                real_mask = Some(Mask { rect, default, flags });
            }
            mask = Some(m);
        }
        r.i = mask_end;
        let n = r.u32()? as usize; // blending ranges
        r.take(n)?;
        let n = r.u8()? as usize;
        let name = String::from_utf8_lossy(r.take(n)?).into_owned();
        r.take((4 - (n + 1) % 4) % 4)?;
        let blocks = blocks(r, extra_end, psb, 1);
        r.i = extra_end;
        let mut l = Layer { name, rect, chans: Vec::new(), blend, opacity, clip, flags, mask, real_mask, blocks };
        if let Some((_, at)) = l.blocks.iter().find(|(k, _)| k == b"luni") {
            if let Ok(s) = Rd::new(r.d, at.start).unicode() {
                l.name = s;
            }
        }
        lens.push(ch);
        layers.push(l);
    }
    // The channels' data, in the same order.
    let mut at = r.i;
    for (l, ch) in layers.iter_mut().zip(lens) {
        for (id, n) in ch {
            let e = at.checked_add(n).ok_or(SHORT)?;
            if e > end {
                return Err(SHORT.into());
            }
            l.chans.push(Chan { id, at: at..e });
            at = e;
        }
    }
    Ok(layers)
}

// --- descriptors -----------------------------------------------------------------

/// An action descriptor (how Photoshop keeps settings) as JSON: objects map
/// their keys to values; enums are "Type.Value"; numbers with units are
/// { "unit", "value" }; class names are under "_class".
fn descriptor(r: &mut Rd, depth: usize) -> R<Value> {
    if depth > 32 {
        return Err(SHORT.into());
    }
    r.unicode()?;
    let class = r.id()?;
    let n = r.u32()? as usize;
    let mut m = Map::new();
    m.insert("_class".into(), Value::String(class));
    for _ in 0..n.min(10_000) {
        let k = r.id()?;
        let t = r.key()?;
        let v = item(r, &t, depth)?;
        m.insert(k.trim_end().to_string(), v);
    }
    Ok(Value::Object(m))
}

fn item(r: &mut Rd, t: &[u8; 4], depth: usize) -> R<Value> {
    Ok(match t {
        b"Objc" | b"GlbO" => descriptor(r, depth + 1)?,
        b"VlLs" => {
            let n = r.u32()? as usize;
            let mut v = Vec::new();
            for _ in 0..n.min(100_000) {
                let t = r.key()?;
                v.push(item(r, &t, depth + 1)?);
            }
            Value::Array(v)
        }
        b"doub" => json!(r.f64()?),
        b"UntF" => {
            let u = String::from_utf8_lossy(&r.key()?).into_owned();
            json!({ "unit": u, "value": r.f64()? })
        }
        b"UnFl" => {
            let u = String::from_utf8_lossy(&r.key()?).into_owned();
            let n = r.u32()? as usize;
            let mut v = Vec::new();
            for _ in 0..n.min(100_000) {
                v.push(r.f64()?);
            }
            json!({ "unit": u, "values": v })
        }
        b"TEXT" => Value::String(r.unicode()?),
        b"enum" => {
            let t = r.id()?;
            let v = r.id()?;
            Value::String(format!("{}.{}", t.trim_end(), v.trim_end()))
        }
        b"long" => json!(r.i32()?),
        b"comp" => json!(r.u64()? as i64),
        b"bool" => json!(r.u8()? != 0),
        b"type" | b"GlbC" => {
            r.unicode()?;
            Value::String(r.id()?)
        }
        b"alis" | b"Pth " => {
            let n = r.u32()? as usize;
            r.take(n)?;
            Value::Null
        }
        b"tdta" => {
            let n = r.u32()? as usize;
            let s = r.i;
            r.take(n)?;
            json!({ "data": [s, s + n] })
        }
        b"obj " => {
            let n = r.u32()? as usize;
            for _ in 0..n.min(1000) {
                let t = r.key()?;
                match &t {
                    b"prop" => {
                        r.unicode()?;
                        r.id()?;
                        r.id()?;
                    }
                    b"Clss" => {
                        r.unicode()?;
                        r.id()?;
                    }
                    b"Enmr" => {
                        r.unicode()?;
                        r.id()?;
                        r.id()?;
                        r.id()?;
                    }
                    b"rele" => {
                        r.unicode()?;
                        r.id()?;
                        r.u32()?;
                    }
                    b"Idnt" | b"indx" => {
                        r.u32()?;
                    }
                    b"name" => {
                        r.unicode()?;
                        r.id()?;
                        r.unicode()?;
                    }
                    _ => return Err(SHORT.into()),
                }
            }
            Value::Null
        }
        b"ObAr" => {
            // Arrays of objects (only in newer shape data): read past them.
            r.u32()?;
            r.unicode()?;
            r.id()?;
            let n = r.u32()? as usize;
            for _ in 0..n.min(10_000) {
                r.id()?;
                let t = r.key()?;
                if &t == b"UnFl" {
                    r.key()?;
                    let k = r.u32()? as usize;
                    r.take(k * 8)?;
                } else {
                    item(r, &t, depth + 1)?;
                }
            }
            Value::Null
        }
        _ => return Err(SHORT.into()),
    })
}

/// The descriptor after a block's version numbers (`skip` bytes).
fn block_descriptor(b: &[u8], skip: usize) -> Option<Value> {
    descriptor(&mut Rd::new(b, skip), 0).ok()
}

fn num(v: &Value, k: &str) -> Option<f64> {
    let x = v.get(k)?;
    x.as_f64().or_else(|| x.get("value")?.as_f64())
}

/// An RGBC (or Grsc, CMYC) colour object as 0-1 RGB.
fn colour(v: &Value) -> Option<[f64; 3]> {
    if let (Some(r), Some(g), Some(b)) = (num(v, "Rd"), num(v, "Grn"), num(v, "Bl")) {
        return Some([r / 255.0, g / 255.0, b / 255.0]);
    }
    if let (Some(r), Some(g), Some(b)) = (num(v, "redFloat"), num(v, "greenFloat"), num(v, "blueFloat")) {
        return Some([r, g, b]);
    }
    if let Some(g) = num(v, "Gry") {
        let g = 1.0 - g / 100.0;
        return Some([g, g, g]);
    }
    if let (Some(c), Some(m), Some(y), Some(k)) = (num(v, "Cyn"), num(v, "Mgnt"), num(v, "Ylw"), num(v, "Blck")) {
        let k = 1.0 - k / 100.0;
        return Some([(1.0 - c / 100.0) * k, (1.0 - m / 100.0) * k, (1.0 - y / 100.0) * k]);
    }
    if let (Some(h), Some(s), Some(b)) = (num(v, "H"), num(v, "Strt"), num(v, "Brgh")) {
        return Some(hsb(h, s / 100.0, b / 100.0));
    }
    None
}

fn hsb(h: f64, s: f64, v: f64) -> [f64; 3] {
    let h = (h.rem_euclid(360.0)) / 60.0;
    let c = v * s;
    let x = c * (1.0 - (h % 2.0 - 1.0).abs());
    let (r, g, b) = match h as u32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = v - c;
    [r + m, g + m, b + m]
}

// --- vector masks -------------------------------------------------------------------

/**
 * A vector mask (vmsk / vsms) as outlines, each a closed list of points
 * (fractions of the picture; curves flattened), and whether it's inverted.
 * None when it's turned off or empty.
 */
fn vector_mask(b: &[u8]) -> Option<(bool, Vec<Vec<[f64; 2]>>)> {
    let mut r = Rd::new(b, 0);
    r.u32().ok()?;
    let flags = r.u32().ok()?;
    if flags & 4 != 0 {
        return None;
    }
    let fixed = |r: &mut Rd| -> Option<f64> { Some(r.i32().ok()? as f64 / (1 << 24) as f64) };
    // Each knot: the control point before it, the point, the control point after it ([x, y]).
    let mut paths: Vec<(bool, Vec<[[f64; 2]; 3]>)> = Vec::new();
    while r.i + 26 <= b.len() {
        let start = r.i;
        let sel = r.u16().ok()?;
        match sel {
            0 | 3 => paths.push((sel == 0, Vec::new())),
            1 | 2 | 4 | 5 => {
                let mut k = [[0.0; 2]; 3];
                for p in k.iter_mut() {
                    let y = fixed(&mut r)?;
                    let x = fixed(&mut r)?;
                    *p = [x, y];
                }
                if let Some(path) = paths.last_mut() {
                    path.1.push(k);
                }
            }
            _ => {}
        }
        r.i = start + 26;
    }
    let mut out = Vec::new();
    for (_, knots) in paths {
        if knots.len() < 2 {
            continue;
        }
        let mut pts = Vec::new();
        for i in 0..knots.len() {
            let (a, b) = (knots[i], knots[(i + 1) % knots.len()]);
            let (p0, p1, p2, p3) = (a[1], a[2], b[0], b[1]);
            let straight = p0 == p1 && p2 == p3;
            let n = if straight { 1 } else { 16 };
            for j in 0..n {
                let t = j as f64 / n as f64;
                let u = 1.0 - t;
                let f = |c: usize| u * u * u * p0[c] + 3.0 * u * u * t * p1[c] + 3.0 * u * t * t * p2[c] + t * t * t * p3[c];
                pts.push([f(0), f(1)]);
            }
        }
        out.push(pts);
    }
    (!out.is_empty()).then_some((flags & 1 != 0, out))
}

// --- into Retouch's layers ---------------------------------------------------------

/// Retouch's name for a blend mode key.
pub fn blend_name(k: &[u8; 4]) -> &'static str {
    match k {
        b"pass" => "pass",
        b"diss" => "dissolve",
        b"dark" => "darken",
        b"mul " => "multiply",
        b"idiv" => "colorBurn",
        b"lbrn" => "linearBurn",
        b"dkCl" => "darkerColor",
        b"lite" => "lighten",
        b"scrn" => "screen",
        b"div " => "colorDodge",
        b"lddg" => "linearDodge",
        b"lgCl" => "lighterColor",
        b"over" => "overlay",
        b"sLit" => "soft",
        b"hLit" => "hardLight",
        b"vLit" => "vividLight",
        b"lLit" => "linearLight",
        b"pLit" => "pinLight",
        b"hMix" => "hardMix",
        b"diff" => "difference",
        b"smud" => "exclusion",
        b"fsub" => "subtract",
        b"fdiv" => "divide",
        b"hue " => "hue",
        b"sat " => "saturation",
        b"colr" => "color",
        b"lum " => "luminosity",
        _ => "normal",
    }
}

/// The same for a layer style's blend mode (a descriptor enum).
fn style_blend(e: Option<&str>) -> &'static str {
    let v = e.and_then(|s| s.split('.').nth(1)).unwrap_or("");
    match v {
        "Dslv" => "dissolve",
        "Drkn" => "darken",
        "Mltp" => "multiply",
        "CBrn" => "colorBurn",
        "linearBurn" => "linearBurn",
        "darkerColor" => "darkerColor",
        "Lghn" => "lighten",
        "Scrn" => "screen",
        "CDdg" => "colorDodge",
        "linearDodge" => "linearDodge",
        "lighterColor" => "lighterColor",
        "Ovrl" => "overlay",
        "SftL" => "soft",
        "HrdL" => "hardLight",
        "vividLight" => "vividLight",
        "linearLight" => "linearLight",
        "pinLight" => "pinLight",
        "hardMix" => "hardMix",
        "Dfrn" => "difference",
        "Xclu" => "exclusion",
        "blendSubtraction" => "subtract",
        "blendDivide" => "divide",
        "H" => "hue",
        "Strt" => "saturation",
        "Clr" => "color",
        "Lmns" => "luminosity",
        _ => "normal",
    }
}

/// An adjustment layer's settings as Retouch's (adjust.js), with what couldn't be kept.
fn adjustment(doc: &Doc, l: &Layer, notes: &mut Vec<String>) -> Option<Value> {
    let get = |k: &[u8; 4]| doc.block(l, k);
    if let Some(b) = get(b"CgEd").and_then(|b| block_descriptor(b, 4)) {
        return Some(json!({ "type": "brightness", "brightness": num(&b, "Brgh").unwrap_or(0.0), "contrast": num(&b, "Cntr").unwrap_or(0.0) }));
    }
    if let Some(b) = get(b"brit") {
        let mut r = Rd::new(b, 0);
        return Some(json!({ "type": "brightness", "brightness": r.i16().ok()?, "contrast": r.i16().ok()? }));
    }
    if let Some(b) = get(b"levl") {
        let mut r = Rd::new(b, 2);
        let mut rec = || -> Option<Value> {
            let (i0, i1, o0, o1, g) = (r.u16().ok()?, r.u16().ok()?, r.u16().ok()?, r.u16().ok()?, r.u16().ok()?);
            Some(json!({ "in0": i0, "in1": i1, "out0": o0, "out1": o1, "gamma": g as f64 / 100.0 }))
        };
        let (m, red, green, blue) = (rec()?, rec()?, rec()?, rec()?);
        return Some(json!({ "type": "levels", "ch": "rgb", "rgb": m, "r": red, "g": green, "b": blue }));
    }
    if let Some(b) = get(b"curv") {
        return curves(b, notes);
    }
    if let Some(b) = get(b"expA") {
        let mut r = Rd::new(b, 2);
        return Some(json!({ "type": "exposure", "exposure": r.f32().ok()?, "offset": r.f32().ok()?, "gamma": r.f32().ok()? }));
    }
    if let Some(d) = get(b"vibA").and_then(|b| block_descriptor(b, 4)) {
        return Some(json!({ "type": "vibrance", "vibrance": num(&d, "vibrance").unwrap_or(0.0), "saturation": num(&d, "Strt").unwrap_or(0.0) }));
    }
    if let Some(b) = get(b"hue2").or_else(|| get(b"hue ")) {
        let mut r = Rd::new(b, 2);
        let colorize = r.u8().ok()? != 0;
        r.u8().ok()?;
        let c = [r.i16().ok()?, r.i16().ok()?, r.i16().ok()?];
        let m = [r.i16().ok()?, r.i16().ok()?, r.i16().ok()?];
        let mut ranges = false;
        for _ in 0..6 {
            r.take(8).ok();
            if let (Ok(a), Ok(b), Ok(c)) = (r.i16(), r.i16(), r.i16()) {
                ranges |= a != 0 || b != 0 || c != 0;
            }
        }
        if ranges && !colorize {
            notes.push(format!("{}: only its Master settings (not the single colour ranges)", l.name));
        }
        let v = if colorize { c } else { m };
        return Some(json!({ "type": "hsl", "hue": v[0], "sat": v[1], "light": v[2], "colorize": colorize }));
    }
    if let Some(b) = get(b"blnc") {
        let mut r = Rd::new(b, 0);
        let mut three = || -> Option<[i16; 3]> { Some([r.i16().ok()?, r.i16().ok()?, r.i16().ok()?]) };
        let (s, m, h) = (three()?, three()?, three()?);
        let preserve = r.u8().map_or(true, |v| v != 0);
        return Some(json!({ "type": "balance", "tone": "mid", "shadows": s, "mid": m, "highlights": h, "preserve": preserve }));
    }
    if let Some(d) = get(b"blwh").and_then(|b| block_descriptor(b, 4)) {
        let g = |k: &str, def: f64| num(&d, k).unwrap_or(def);
        return Some(json!({
            "type": "bw", "reds": g("Rd", 40.0), "yellows": g("Yllw", 60.0), "greens": g("Grn", 40.0), "cyans": g("Cyn", 60.0),
            "blues": g("Bl", 20.0), "magentas": g("Mgnt", 80.0), "tint": d.get("useTint").and_then(Value::as_bool).unwrap_or(false),
            "tintColor": d.get("tintColor").and_then(colour).unwrap_or([0.88, 0.78, 0.6]),
        }));
    }
    if let Some(b) = get(b"phfl") {
        let mut r = Rd::new(b, 0);
        let version = r.u16().ok()?;
        let color = if version == 3 {
            let xyz = [r.i32().ok()? as f64 / 65536.0, r.i32().ok()? as f64 / 65536.0, r.i32().ok()? as f64 / 65536.0];
            lab_xyz_to_srgb(xyz)
        } else {
            let space = r.u16().ok()?;
            let c = [r.u16().ok()?, r.u16().ok()?, r.u16().ok()?, r.u16().ok()?];
            match space {
                0 => [c[0] as f64 / 65535.0, c[1] as f64 / 65535.0, c[2] as f64 / 65535.0],
                7 => lab_to_srgb([c[0] as f64 / 100.0, c[1] as i16 as f64 / 100.0, c[2] as i16 as f64 / 100.0]),
                _ => [0.925, 0.541, 0.0],
            }
        };
        let density = r.u32().ok()?;
        let preserve = r.u8().map_or(true, |v| v != 0);
        return Some(json!({ "type": "photo", "density": density, "color": color, "preserve": preserve }));
    }
    if let Some(b) = get(b"mixr") {
        let mut r = Rd::new(b, 2);
        let mono = r.u16().ok()? != 0;
        let mut row = || -> Option<[i16; 4]> {
            let v = [r.i16().ok()?, r.i16().ok()?, r.i16().ok()?, r.i16().ok()?, r.i16().ok()?];
            Some([v[0], v[1], v[2], v[4]])
        };
        let (rr, gg, bb) = (row()?, row()?, row()?);
        return Some(json!({ "type": "mixer", "out": "r", "mono": mono, "rows": { "r": rr, "g": if mono { rr } else { gg }, "b": if mono { rr } else { bb } } }));
    }
    if let Some(b) = get(b"selc") {
        let mut r = Rd::new(b, 2);
        let absolute = r.u16().ok()? == 1;
        r.take(8).ok()?;
        let names = ["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"];
        let mut cmyk = Map::new();
        for n in names {
            cmyk.insert(n.into(), json!([r.i16().ok()?, r.i16().ok()?, r.i16().ok()?, r.i16().ok()?]));
        }
        return Some(json!({ "type": "selective", "color": "reds", "absolute": absolute, "cmyk": cmyk }));
    }
    if get(b"nvrt").is_some() {
        return Some(json!({ "type": "invert" }));
    }
    if let Some(b) = get(b"post") {
        return Some(json!({ "type": "posterize", "levels": Rd::new(b, 0).u16().ok()?.clamp(2, 255) }));
    }
    if let Some(b) = get(b"thrs") {
        return Some(json!({ "type": "threshold", "level": Rd::new(b, 0).u16().ok()?.clamp(1, 255) }));
    }
    if let Some(b) = get(b"grdm") {
        let mut r = Rd::new(b, 0);
        let version = r.u16().ok()?;
        let reverse = r.u8().ok()? != 0;
        r.u8().ok()?;
        if version == 3 {
            r.take(4).ok()?;
        }
        r.unicode().ok()?;
        let n = r.u16().ok()? as usize;
        let mut stops = Vec::new();
        for _ in 0..n {
            let at = r.u32().ok()?;
            r.u32().ok()?;
            r.u16().ok()?;
            let c = [r.u16().ok()?, r.u16().ok()?, r.u16().ok()?];
            r.take(4).ok()?;
            stops.push((at, c.map(|v| v as f64 / 65535.0)));
        }
        stops.sort_by_key(|s| s.0);
        if stops.len() > 2 {
            notes.push(format!("{}: its gradient kept to its first and last colours", l.name));
        }
        let (c0, c1) = (stops.first().map_or([0.0; 3], |s| s.1), stops.last().map_or([1.0; 3], |s| s.1));
        return Some(json!({ "type": "gradmap", "c0": c0, "c1": c1, "reverse": reverse }));
    }
    if let Some(b) = get(b"clrL") {
        // A Color Lookup keeps its LUT file inside: a .cube one comes over as it is.
        if let Some(d) = block_descriptor(b, 6) {
            let fmt = d.get("LUTFormat").and_then(Value::as_str).unwrap_or("");
            if let Some([s, e]) = d.get("LUT3DFileData").and_then(|v| v.get("data")).and_then(|v| serde_json::from_value::<[usize; 2]>(v.clone()).ok()) {
                if fmt.ends_with("LUTFormatCUBE") {
                    let text = String::from_utf8_lossy(b.get(s..e)?).into_owned();
                    let name = d.get("LUT3DFileName").and_then(Value::as_str).unwrap_or("Lookup").to_string();
                    return Some(json!({ "type": "lut", "cube": text, "name": name }));
                }
            }
        }
        notes.push(format!("{}: its Color Lookup table couldn't be read", l.name));
        return Some(json!({ "type": "lut", "lut": null }));
    }
    None
}

fn curves(b: &[u8], notes: &mut Vec<String>) -> Option<Value> {
    let mut r = Rd::new(b, 0);
    let is_map = r.u8().ok()? != 0;
    let version = r.u16().ok()?;
    let bits = r.u32().ok()?;
    if is_map {
        notes.push("A Curves layer drawn with the pencil came over as a straight line".into());
        return Some(json!({ "type": "curves", "ch": "rgb", "rgb": [[0, 0], [255, 255]], "r": [[0, 0], [255, 255]], "g": [[0, 0], [255, 255]], "b": [[0, 0], [255, 255]] }));
    }
    let ids: Vec<u32> = if version == 1 { (0..32).filter(|i| bits & (1 << i) != 0).collect() } else { (0..bits).collect() };
    let read_points = |r: &mut Rd| -> Option<Vec<[u16; 2]>> {
        let n = r.u16().ok()? as usize;
        let mut p = Vec::with_capacity(n);
        for _ in 0..n.min(64) {
            let (out, inp) = (r.u16().ok()?, r.u16().ok()?);
            p.push([inp, out]);
        }
        Some(p)
    };
    let mut chans: Vec<(u32, Vec<[u16; 2]>)> = Vec::new();
    for &id in &ids {
        chans.push((id, read_points(&mut r)?));
    }
    // Newer files add the same again with each curve's channel named.
    if r.d.get(r.i..r.i + 4) == Some(b"Crv ") {
        r.i += 4;
        if let (Ok(_), Ok(n)) = (r.u16(), r.u32()) {
            let mut extra = Vec::new();
            for _ in 0..n.min(32) {
                let Ok(id) = r.u16() else { break };
                let Some(p) = read_points(&mut r) else { break };
                extra.push((id as u32, p));
            }
            if !extra.is_empty() {
                chans = extra;
            }
        }
    }
    let line = json!([[0, 0], [255, 255]]);
    let mut out = json!({ "type": "curves", "ch": "rgb", "rgb": line, "r": line, "g": line, "b": line });
    for (id, p) in chans {
        let key = match id {
            0 => "rgb",
            1 => "r",
            2 => "g",
            3 => "b",
            _ => continue,
        };
        if p.len() >= 2 {
            out[key] = json!(p);
        }
    }
    Some(out)
}

/// CIE XYZ (D50, 0-1 scale with Y 1 at white) -> sRGB 0-1.
fn lab_xyz_to_srgb(xyz: [f64; 3]) -> [f64; 3] {
    // Photo Filter's colour is stored as XYZ (D50).
    let m = crate::icc::from_xyz(&crate::icc::srgb()).map(|v| v as f64);
    let s = xyz.iter().copied().fold(0.0, f64::max).max(1e-9);
    let k = if s > 2.0 { 1.0 / 100.0 } else { 1.0 };
    let x = [xyz[0] * k, xyz[1] * k, xyz[2] * k];
    let lin = [m[0] * x[0] + m[1] * x[1] + m[2] * x[2], m[3] * x[0] + m[4] * x[1] + m[5] * x[2], m[6] * x[0] + m[7] * x[1] + m[8] * x[2]];
    lin.map(|v| encode_srgb(v as f32) as f64)
}

fn lab_to_srgb(lab: [f64; 3]) -> [f64; 3] {
    let fy = (lab[0] + 16.0) / 116.0;
    let (fx, fz) = (fy + lab[1] / 500.0, fy - lab[2] / 200.0);
    let f = |t: f64| if t > 6.0 / 29.0 { t * t * t } else { 3.0 * (6.0f64 / 29.0).powi(2) * (t - 4.0 / 29.0) };
    lab_xyz_to_srgb([0.9642 * f(fx), f(fy), 0.8249 * f(fz)])
}

/// Layer styles (lfx2) as Retouch's (sizes as fractions of the long side).
fn styles(doc: &Doc, l: &Layer, notes: &mut Vec<String>, pats: &std::collections::HashMap<String, Value>) -> Option<Value> {
    let d = block_descriptor(doc.block(l, b"lfx2")?, 8)?;
    if d.get("masterFXSwitch").and_then(Value::as_bool) == Some(false) {
        return None;
    }
    let long = doc.w.max(doc.h) as f64;
    let px = |v: &Value, k: &str| num(v, k).unwrap_or(0.0) / long;
    let angle = |v: &Value| if v.get("uglg").and_then(Value::as_bool).unwrap_or(false) { doc.global_angle } else { num(v, "lagl").unwrap_or(120.0) };
    let one = |k: &str, multi: &str| -> Option<Value> {
        let v = d.get(k).cloned().or_else(|| d.get(multi)?.as_array()?.iter().find(|e| e.get("enab").and_then(Value::as_bool) != Some(false)).cloned())?;
        (v.get("enab").and_then(Value::as_bool) != Some(false)).then_some(v)
    };
    let col = |v: &Value| v.get("Clr").and_then(colour).unwrap_or([0.0, 0.0, 0.0]);
    let op = |v: &Value| num(v, "Opct").unwrap_or(100.0);
    let mut st = Map::new();
    if let Some(v) = one("DrSh", "dropShadowMulti") {
        st.insert("shadow".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v), "angle": angle(&v), "distance": px(&v, "Dstn"), "size": px(&v, "blur"), "spread": num(&v, "Ckmt").unwrap_or(0.0), "blend": style_blend(v.get("Md").and_then(Value::as_str)) }));
    }
    if let Some(v) = one("IrSh", "innerShadowMulti") {
        st.insert("innerShadow".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v), "angle": angle(&v), "distance": px(&v, "Dstn"), "size": px(&v, "blur"), "choke": num(&v, "Ckmt").unwrap_or(0.0) }));
    }
    if let Some(v) = one("OrGl", "outerGlowMulti") {
        st.insert("glow".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v), "size": px(&v, "blur"), "spread": num(&v, "Ckmt").unwrap_or(0.0), "blend": style_blend(v.get("Md").and_then(Value::as_str)) }));
    }
    if let Some(v) = one("IrGl", "innerGlowMulti") {
        st.insert("innerGlow".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v), "size": px(&v, "blur"), "choke": num(&v, "Ckmt").unwrap_or(0.0) }));
    }
    if let Some(v) = one("FrFX", "frameFXMulti") {
        st.insert("stroke".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v), "size": px(&v, "Sz") }));
    }
    if let Some(v) = one("SoFi", "solidFillMulti") {
        st.insert("overlay".into(), json!({ "on": true, "color": col(&v), "opacity": op(&v) }));
    }
    if let Some(v) = one("GrFl", "gradientFillMulti") {
        let stops: Vec<[f64; 3]> = v.get("Grad").and_then(|g| g.get("Clrs")).and_then(Value::as_array).map(|a| a.iter().filter_map(|s| s.get("Clr").and_then(colour)).collect()).unwrap_or_default();
        let style = match v.get("Type").and_then(Value::as_str).unwrap_or("") {
            s if s.ends_with("Rdl") => "radial",
            _ => "linear",
        };
        st.insert("gradient".into(), json!({
            "on": true, "c0": stops.first().copied().unwrap_or([0.0; 3]), "c1": stops.last().copied().unwrap_or([1.0; 3]), "opacity": op(&v),
            "angle": num(&v, "Angl").unwrap_or(90.0), "style": style, "reverse": v.get("Rvrs").and_then(Value::as_bool).unwrap_or(false),
        }));
    }
    let mode = |v: &Value, k: &str, def: &'static str| v.get(k).and_then(Value::as_str).map(|m| style_blend(Some(m))).unwrap_or(def);
    if let Some(v) = one("ebbl", "bevelEmbossMulti") {
        let style = match v.get("bvlS").and_then(Value::as_str).unwrap_or("") {
            s if s.ends_with("OtrB") => "outer",
            s if s.ends_with("Embs") => "emboss",
            s if s.ends_with("PlEb") => "pillow",
            s if s.ends_with("strokeEmboss") => {
                notes.push(format!("{}: Stroke Emboss comes in as Inner Bevel", l.name));
                "inner"
            }
            _ => "inner",
        };
        let col = |k: &str, def: [f64; 3]| v.get(k).and_then(colour).unwrap_or(def);
        st.insert("bevel".into(), json!({
            "on": true, "style": style, "depth": num(&v, "srgR").unwrap_or(100.0), "down": v.get("bvlD").and_then(Value::as_str).is_some_and(|d| d.ends_with("Out")),
            "size": px(&v, "blur"), "soften": px(&v, "Sftn"), "angle": angle(&v), "altitude": num(&v, "Lald").unwrap_or(30.0),
            "hiColor": col("hglC", [1.0; 3]), "hiOpacity": num(&v, "hglO").unwrap_or(75.0), "hiBlend": mode(&v, "hglM", "screen"),
            "loColor": col("sdwC", [0.0; 3]), "loOpacity": num(&v, "sdwO").unwrap_or(75.0), "loBlend": mode(&v, "sdwM", "multiply"),
        }));
        if v.get("useTexture").and_then(Value::as_bool) == Some(true) || v.get("useShape").and_then(Value::as_bool) == Some(true) {
            notes.push(format!("{}: Bevel & Emboss's contour and texture", l.name));
        }
    }
    if let Some(v) = one("ChFX", "satinMulti") {
        st.insert("satin".into(), json!({
            "on": true, "color": col(&v), "opacity": op(&v), "angle": num(&v, "lagl").unwrap_or(19.0), "distance": px(&v, "Dstn"), "size": px(&v, "blur"),
            "invert": v.get("Invr").and_then(Value::as_bool).unwrap_or(true), "blend": mode(&v, "Md", "multiply"),
        }));
    }
    if let Some(v) = one("patternFill", "patternFillMulti") {
        let id = v.get("Ptrn").and_then(|p| p.get("Idnt")).and_then(Value::as_str).unwrap_or("");
        if let Some(p) = pats.get(id) {
            let mut p = p.clone();
            p["on"] = json!(true);
            p["scale"] = json!(num(&v, "Scl").unwrap_or(100.0));
            p["opacity"] = json!(op(&v));
            st.insert("pattern".into(), p);
        } else {
            notes.push(format!("{}: its Pattern Overlay's pattern isn't saved in the file", l.name));
        }
    }
    (!st.is_empty()).then_some(Value::Object(st))
}

/// The document's layers as Retouch will make them, bottom first: what each
/// is, its settings, and where its pixels and mask are (fractions of the
/// picture). `base`: the layer developed under them, if any. `notes`: what
/// didn't come over as it was.
pub fn describe(doc: &Doc) -> Value {
    let (w, h) = (doc.w as f64, doc.h as f64);
    let base = doc.background();
    let mut notes = Vec::new();
    let mut out = Vec::new();
    let pats: std::collections::HashMap<String, Value> = patterns(doc)
        .into_iter()
        .filter_map(|(id, name, pw, ph, rgba)| {
            // Photoshop's own patterns are named like "$$$/Patterns/Defaults/Water=Water".
            let name = name.rsplit('=').next().unwrap_or(&name).to_string();
            Some((id, json!({ "name": name, "w": pw, "h": ph, "src": png_data_url(pw, ph, &rgba)? })))
        })
        .collect();
    // Groups: their end marker comes first (below their layers), the group itself last.
    let mut open: Vec<usize> = Vec::new();
    let mut next_group = 0;
    for (i, l) in doc.layers.iter().enumerate() {
        if Some(i) == base {
            continue;
        }
        let section = doc.block(l, b"lsct").or_else(|| doc.block(l, b"lsdk")).and_then(|b| Rd::new(b, 0).u32().ok());
        let parent = open.last().map(|g| format!("g{g}"));
        let mut e = Map::new();
        e.insert("index".into(), json!(i));
        e.insert("name".into(), json!(l.name));
        e.insert("hidden".into(), json!(l.flags & 2 != 0));
        e.insert("opacity".into(), json!((l.opacity as f64 / 2.55).round()));
        let fill = doc.block(l, b"iOpa").and_then(|b| b.first().copied()).unwrap_or(255);
        e.insert("fill".into(), json!((fill as f64 / 2.55).round()));
        e.insert("blend".into(), json!(blend_name(&l.blend)));
        e.insert("clip".into(), json!(l.clip));
        match section {
            Some(3) => {
                open.push(next_group);
                next_group += 1;
                continue;
            }
            Some(1) | Some(2) => {
                let g = open.pop().unwrap_or_else(|| {
                    next_group += 1;
                    next_group - 1
                });
                e.insert("kind".into(), json!("group"));
                e.insert("id".into(), json!(format!("g{g}")));
                e.insert("parent".into(), json!(open.last().map(|g| format!("g{g}"))));
                if let Some((_, m)) = doc.mask_of(l) {
                    let rect = |r: [i32; 4]| json!([r[1] as f64 / w, r[0] as f64 / h, r[3] as f64 / w, r[2] as f64 / h]);
                    let (mw, mh) = (m.rect[3] - m.rect[1], m.rect[2] - m.rect[0]);
                    e.insert("mask".into(), json!({ "rect": rect(m.rect), "size": [mw.max(0), mh.max(0)], "default": m.default, "off": m.flags & 2 != 0 }));
                }
                out.push(Value::Object(e));
                continue;
            }
            _ => {}
        }
        e.insert("parent".into(), json!(parent));
        let rect = |r: [i32; 4]| json!([r[1] as f64 / w, r[0] as f64 / h, r[3] as f64 / w, r[2] as f64 / h]);
        if let Some(adj) = adjustment(doc, l, &mut notes) {
            e.insert("kind".into(), json!("adjust"));
            e.insert("adj".into(), adj);
        } else if let Some(c) = doc.block(l, b"SoCo").and_then(|b| block_descriptor(b, 4)).and_then(|d| d.get("Clr").and_then(colour)) {
            e.insert("kind".into(), json!("fill"));
            e.insert("color".into(), json!(c));
        } else {
            let (lw, lh) = (l.rect[3] - l.rect[1], l.rect[2] - l.rect[0]);
            if lw > 0 && lh > 0 {
                e.insert("kind".into(), json!("image"));
                e.insert("size".into(), json!([lw, lh]));
                e.insert("rect".into(), rect(l.rect));
            } else {
                e.insert("kind".into(), json!("pixel"));
            }
            if doc.block(l, b"TySh").is_some() {
                match text_layer(doc, l, &mut notes) {
                    Some(t) => e.insert("text".into(), t),
                    None => e.insert("text".into(), json!(true)),
                };
            }
        }
        let vector = doc.block(l, b"vmsk").or_else(|| doc.block(l, b"vsms")).and_then(vector_mask);
        if let Some((invert, paths)) = &vector {
            // Beside a vector mask, channel -2 is the vector mask drawn as pixels (used as it is);
            // a pixel mask of its own as well (-3) can't be combined with it in Retouch.
            if doc.mask_of(l).is_some_and(|(id, _)| id == -3) {
                notes.push(format!("{}: its vector mask (it keeps its pixel mask)", l.name));
            } else if doc.mask_of(l).is_none() {
                e.insert("vector".into(), json!({ "invert": invert, "paths": paths }));
            }
        }
        // A shape's outline: as a Stroke layer style (drawn outside the shape).
        let outline = doc.block(l, b"vstk").and_then(|b| block_descriptor(b, 4)).filter(|d| d.get("strokeEnabled").and_then(Value::as_bool) == Some(true)).map(|d| {
            let width = num(&d, "strokeStyleLineWidth").unwrap_or(1.0);
            let k = match d.get("strokeStyleLineAlignment").and_then(Value::as_str).unwrap_or("") {
                a if a.ends_with("AlignInside") => 0.0,
                a if a.ends_with("AlignCenter") => 0.5,
                _ => 1.0,
            };
            let color = d.get("strokeStyleContent").and_then(|c| c.get("Clr")).and_then(colour).unwrap_or([0.0; 3]);
            json!({ "on": true, "color": color, "opacity": num(&d, "strokeStyleOpacity").unwrap_or(100.0), "size": width * k / doc.w.max(doc.h) as f64 })
        });
        if let Some((_, m)) = doc.mask_of(l) {
            let (mw, mh) = (m.rect[3] - m.rect[1], m.rect[2] - m.rect[0]);
            e.insert("mask".into(), json!({ "rect": rect(m.rect), "size": [mw.max(0), mh.max(0)], "default": m.default, "off": m.flags & 2 != 0 }));
        }
        let mut style = styles(doc, l, &mut notes, &pats);
        if let Some(o) = outline.filter(|o| o["size"].as_f64().unwrap_or(0.0) > 0.0) {
            let st = style.get_or_insert_with(|| json!({}));
            if st.get("stroke").is_none() {
                st["stroke"] = o;
            }
        }
        if let Some(st) = style {
            e.insert("style".into(), st);
        }
        out.push(Value::Object(e));
    }
    if doc.mode == 4 {
        notes.push("CMYK colours are shown with a simple conversion, not the document's CMYK profile".into());
    }
    json!({ "layers": out, "base": base.map(|i| doc.layers[i].name.clone()), "notes": notes })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unpacks_packbits() {
        let mut out = [0u8; 8];
        packbits(&[2, 1, 2, 3, (-3i8) as u8, 9, 0, 7], &mut out);
        assert_eq!(out, [1, 2, 3, 9, 9, 9, 9, 7]);
    }

    #[test]
    fn undoes_prediction() {
        let mut b = vec![1, 1, 1, 0, 0, 2, 0, 1];
        unpredict(&mut b, 4, 2, 1);
        assert_eq!(b, [1, 2, 3, 3, 0, 2, 2, 3]);
    }

    /// psd-tools' test documents, with the pictures Photoshop made of them (FLIGHTROOM_PSDS: their folder).
    #[test]
    #[ignore]
    fn reads_sample_documents() {
        let dir = std::env::var("FLIGHTROOM_PSDS").expect("FLIGHTROOM_PSDS");
        let mut n = 0;
        for e in walk(std::path::Path::new(&dir)) {
            let ext = e.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
            if ext != "psd" && ext != "psb" {
                continue;
            }
            let d = std::fs::read(&e).unwrap();
            match Doc::parse(&d) {
                Ok(doc) => {
                    let info = describe(&doc);
                    for l in &doc.layers {
                        doc.layer_rgba(l).unwrap_or_else(|err| panic!("{}: {}: {err}", e.display(), l.name));
                        if let Err(err) = doc.mask_grey(l) {
                            println!("FAIL mask {}: {}: {err}", e.display(), l.name);
                        }
                    }
                    match doc.base() {
                        Ok(base) => assert_eq!(base.len(), doc.w * doc.h * 3),
                        Err(err) => println!("FAIL base {}: {err}", e.display()),
                    }
                    println!("{} {}x{} {} layers {}", e.display(), doc.w, doc.h, doc.layers.len(), info);
                    n += 1;
                }
                Err(err) => println!("{}: {err}", e.display()),
            }
        }
        assert!(n > 50);
    }

    fn walk(p: &std::path::Path) -> Vec<std::path::PathBuf> {
        let mut out = Vec::new();
        for e in std::fs::read_dir(p).unwrap().flatten() {
            if e.path().is_dir() {
                out.extend(walk(&e.path()));
            } else {
                out.push(e.path());
            }
        }
        out.sort();
        out
    }
}
