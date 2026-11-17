// Photos that are neither a camera RAW nor a JPEG: HEIC/HEIF (iPhones, and the
// 10-bit .HIF of Canon, Sony and Fujifilm cameras), AVIF, WebP, PNG, TIFF, BMP
// and GIF. They hold no ready-made JPEG to show, so Culling and the Library get
// one made from the whole picture, once: it's kept with the thumbnails
// (photos.rs). Stars and keywords go in a sidecar, as for a RAW file.

use crate::photolib::{self as lib, Source};
use rayon::prelude::*;

pub const IMAGE_EXTS: &[&str] = &[".heic", ".heif", ".hif", ".avif", ".webp", ".png", ".tif", ".tiff", ".bmp", ".gif", ".psd", ".psb"];

pub fn is_heif(ext: &str) -> bool {
    matches!(ext, ".heic" | ".heif" | ".hif")
}

/// Bigger pictures than this (pixels) are refused rather than decoded.
const MAX_PIXELS: u64 = 250_000_000;

/// A decoded picture: 8-bit RGB, upright (any rotation the file asks for done),
/// with the colour profile it came with.
pub struct Picture {
    pub w: usize,
    pub h: usize,
    pub rgb: Vec<u8>,
    pub icc: Option<Vec<u8>>,
}

pub fn decode(bytes: &[u8], ext: &str) -> Result<Picture, String> {
    if is_heif(ext) {
        heif(bytes)
    } else if ext == ".avif" {
        avif(bytes)
    } else if crate::psd::is_psd(ext) {
        // The flattened picture Photoshop saves with every document.
        let doc = crate::psd::Doc::parse(bytes)?;
        let rgb = doc.merged()?.iter().map(|&v| (v >> 8) as u8).collect();
        Ok(Picture { w: doc.w, h: doc.h, rgb, icc: doc.icc.map(|i| i.to_vec()) })
    } else {
        other(bytes, ext)
    }
}

/// A picture for developing: 16-bit RGB (as stored, not turned upright, except
/// HEIF and AVIF, whose decoders turn them), with its colour profile.
pub struct Deep {
    pub w: usize,
    pub h: usize,
    pub rgb: Vec<u16>,
    pub icc: Option<Vec<u8>>,
    /// A Photoshop document's layers, described for Retouch (psd::describe).
    pub psd: Option<serde_json::Value>,
}

pub fn decode_deep(bytes: &[u8], ext: &str) -> Result<Deep, String> {
    let wide = |p: Picture| Deep { w: p.w, h: p.h, rgb: p.rgb.iter().map(|&v| v as u16 * 257).collect(), icc: p.icc, psd: None };
    if crate::psd::is_psd(ext) {
        let doc = crate::psd::Doc::parse(bytes)?;
        return Ok(Deep { w: doc.w, h: doc.h, rgb: doc.base()?, icc: doc.icc.map(|i| i.to_vec()), psd: Some(crate::psd::describe(&doc)) });
    }
    if lib::JPEG_EXTS.contains(&ext) {
        use zune_jpeg::zune_core::{bytestream::ZCursor, colorspace::ColorSpace, options::DecoderOptions};
        let opts = DecoderOptions::default().jpeg_set_out_colorspace(ColorSpace::RGB).set_max_width(1 << 16).set_max_height(1 << 16);
        let mut d = zune_jpeg::JpegDecoder::new_with_options(ZCursor::new(bytes), opts);
        d.decode_headers().map_err(|e| format!("Couldn't read this JPEG: {e:?}"))?;
        let (w, h) = d.dimensions().ok_or("Couldn't read this JPEG")?;
        if w == 0 || h == 0 || (w * h) as u64 > MAX_PIXELS {
            return Err("This JPEG is too large or empty".into());
        }
        let px = d.decode().map_err(|e| format!("Couldn't decode this JPEG: {e:?}"))?;
        return Ok(wide(Picture { w, h, rgb: px, icc: d.icc_profile() }));
    }
    if is_heif(ext) || ext == ".avif" {
        return decode(bytes, ext).map(wide);
    }
    // PNG, TIFF and the rest: 16 bits a channel when the file has them.
    use image::{DynamicImage, ImageDecoder};
    let format = match ext {
        ".png" => image::ImageFormat::Png,
        ".tif" | ".tiff" => image::ImageFormat::Tiff,
        ".webp" => image::ImageFormat::WebP,
        ".bmp" => image::ImageFormat::Bmp,
        ".gif" => image::ImageFormat::Gif,
        _ => return Err(format!("{ext} files can't be developed")),
    };
    let mut reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(4 << 30);
    reader.limits(limits);
    let mut dec = reader.into_decoder().map_err(|e| format!("Couldn't read this file: {e}"))?;
    let (w, h) = dec.dimensions();
    if w as u64 * h as u64 > MAX_PIXELS {
        return Err("This picture is too large".into());
    }
    let icc = dec.icc_profile().ok().flatten();
    let img = DynamicImage::from_decoder(dec).map_err(|e| format!("Couldn't decode this file: {e}"))?;
    let rgb = img.into_rgb16();
    Ok(Deep { w: rgb.width() as usize, h: rgb.height() as usize, rgb: rgb.into_raw(), icc, psd: None })
}

/// `n`-channel 8-bit pixels (grey, grey + alpha, RGB, RGBA) as RGB.
fn to_rgb(px: Vec<u8>, n: usize) -> Vec<u8> {
    match n {
        3 => px,
        1 => px.iter().flat_map(|&v| [v, v, v]).collect(),
        2 => px.chunks_exact(2).flat_map(|p| [p[0], p[0], p[0]]).collect(),
        _ => px.chunks_exact(n).flat_map(|p| [p[0], p[1], p[2]]).collect(),
    }
}

fn heif(bytes: &[u8]) -> Result<Picture, String> {
    use zune_heic::zune_core::{bytestream::ZCursor, options::DecoderOptions};
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get()).min(32) as u8;
    let opts = DecoderOptions::default()
        .hvec_set_use_videotoolbox(false)
        .set_num_threads(threads)
        .set_max_width(1 << 16)
        .set_max_height(1 << 16)
        // The whole image data is read into memory: a 45 MP 10-bit .HIF is over 16 MB (the default).
        .set_hevc_max_mdat_size(1 << 30);
    let mut d = zune_heic::HeifDecoder::new_with_options(ZCursor::new(bytes), opts);
    let icc = || heif_meta(bytes).and_then(|m| m.icc);
    // zune-heic is the fastest (about 3x on a phone's photo) but reads 4:2:0 only;
    // cameras' 4:2:2 and 4:4:4 .HIF files go to heifer. Both apply the file's crop,
    // rotation and mirroring.
    if d.decode_headers().is_ok() {
        let (w, h) = (d.width().unwrap_or(0), d.height().unwrap_or(0));
        if w == 0 || h == 0 || (w * h) as u64 > MAX_PIXELS {
            return Err("This HEIF file's picture is too large or empty".into());
        }
        let n = d.colorspace().map_or(3, |c| c.num_components());
        if let Ok(px) = d.decode() {
            return Ok(Picture { w, h, rgb: to_rgb(px, n), icc: d.icc_data().cloned().or_else(icc) });
        }
    }
    let opts = heifer::Options::new().with_max_pixels(MAX_PIXELS);
    match heifer::decode_rgba8(bytes, &opts) {
        Ok(img) => Ok(Picture { w: img.width as usize, h: img.height as usize, rgb: to_rgb(img.data, 4), icc: icc() }),
        // A HEIF file can hold AV1 pictures instead (an AVIF in all but name).
        Err(e) => avif(bytes).map_err(|_| format!("Couldn't decode this HEIF file: {e}")),
    }
}

fn avif(bytes: &[u8]) -> Result<Picture, String> {
    use avif_decode::Image;
    let meta = heif_meta(bytes);
    if let Some(m) = &meta {
        if m.width as u64 * m.height as u64 > MAX_PIXELS {
            return Err("This AVIF file's picture is too large".into());
        }
    }
    let img = avif_decode::Decoder::from_avif(bytes).and_then(|d| d.to_image()).map_err(|e| format!("Couldn't decode this AVIF file: {e}"))?;
    let to8 = |v: u16| ((v as u32 * 255 + 32767) / 65535) as u8;
    let (w, h, rgb) = match img {
        Image::Rgb8(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [p.r, p.g, p.b]).collect())
        }
        Image::Rgba8(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [p.r, p.g, p.b]).collect())
        }
        Image::Rgb16(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [to8(p.r), to8(p.g), to8(p.b)]).collect())
        }
        Image::Rgba16(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [to8(p.r), to8(p.g), to8(p.b)]).collect())
        }
        Image::Gray8(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [p.value(); 3]).collect())
        }
        Image::Gray16(i) => {
            let (buf, w, h) = i.into_contiguous_buf();
            (w, h, buf.iter().flat_map(|p| [to8(p.value()); 3]).collect())
        }
    };
    let pic = Picture { w, h, rgb, icc: meta.as_ref().and_then(|m| m.icc.clone()) };
    // The AVIF decoder leaves the file's rotation and mirroring to us.
    Ok(match meta {
        Some(m) => orient(pic, m.rot, m.mirror),
        None => pic,
    })
}

fn other(bytes: &[u8], ext: &str) -> Result<Picture, String> {
    use image::{DynamicImage, ImageDecoder, ImageFormat};
    let format = match ext {
        ".png" => ImageFormat::Png,
        ".tif" | ".tiff" => ImageFormat::Tiff,
        ".webp" => ImageFormat::WebP,
        ".bmp" => ImageFormat::Bmp,
        ".gif" => ImageFormat::Gif,
        _ => return Err(format!("{ext} files can't be opened")),
    };
    let mut reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(4 << 30);
    reader.limits(limits);
    let mut dec = reader.into_decoder().map_err(|e| format!("Couldn't read this file: {e}"))?;
    let (w, h) = dec.dimensions();
    if w as u64 * h as u64 > MAX_PIXELS {
        return Err("This picture is too large".into());
    }
    let icc = dec.icc_profile().ok().flatten();
    let img = DynamicImage::from_decoder(dec).map_err(|e| format!("Couldn't decode this file: {e}"))?;
    let rgb = img.into_rgb8();
    let (w, h) = (rgb.width() as usize, rgb.height() as usize);
    Ok(Picture { w, h, rgb: rgb.into_raw(), icc })
}

/// Turns a picture `rot` quarter turns anticlockwise, then mirrors it (HEIF's
/// irot and imir: axis 0 flips top and bottom, axis 1 left and right).
pub fn orient(p: Picture, rot: u8, mirror: Option<u8>) -> Picture {
    let rot = rot & 3;
    if rot == 0 && mirror.is_none() {
        return p;
    }
    let (w, h) = (p.w, p.h);
    let (dw, dh) = if rot % 2 == 1 { (h, w) } else { (w, h) };
    let mut out = vec![0u8; p.rgb.len()];
    out.par_chunks_mut(dw * 3).enumerate().for_each(|(dy, row)| {
        for dx in 0..dw {
            // Undo the mirror first (it was applied last), then the turn.
            let (mut x, mut y) = (dx, dy);
            match mirror {
                Some(0) => y = dh - 1 - y,
                Some(_) => x = dw - 1 - x,
                None => {}
            }
            let (sx, sy) = match rot {
                1 => (w - 1 - y, x),
                2 => (w - 1 - x, h - 1 - y),
                3 => (y, h - 1 - x),
                _ => (x, y),
            };
            let s = (sy * w + sx) * 3;
            row[dx * 3..dx * 3 + 3].copy_from_slice(&p.rgb[s..s + 3]);
        }
    });
    Picture { w: dw, h: dh, rgb: out, icc: p.icc }
}

/// A size scaled down so its long side is at most `edge`.
pub fn shrunk_size(w: usize, h: usize, edge: usize) -> (usize, usize) {
    let long = w.max(h);
    if long <= edge {
        return (w, h);
    }
    let s = edge as f64 / long as f64;
    (((w as f64 * s).round() as usize).max(1), ((h as f64 * s).round() as usize).max(1))
}

/// The picture averaged down so its long side is at most `edge` pixels.
pub fn shrink(p: &Picture, edge: usize) -> Picture {
    let long = p.w.max(p.h);
    if long <= edge {
        return Picture { w: p.w, h: p.h, rgb: p.rgb.clone(), icc: p.icc.clone() };
    }
    let (dw, dh) = shrunk_size(p.w, p.h, edge);
    let (xw, yw) = (crate::develop::weights(p.w, dw), crate::develop::weights(p.h, dh));
    let mut out = vec![0u8; dw * dh * 3];
    out.par_chunks_mut(dw * 3).enumerate().for_each(|(oy, row)| {
        let mut acc = vec![0f32; dw * 3];
        for &(sy, wy) in &yw[oy] {
            let line = &p.rgb[sy * p.w * 3..(sy + 1) * p.w * 3];
            for (ox, taps) in xw.iter().enumerate() {
                for &(sx, wx) in taps {
                    let wt = wx * wy;
                    for c in 0..3 {
                        acc[ox * 3 + c] += line[sx * 3 + c] as f32 * wt;
                    }
                }
            }
        }
        for (o, a) in row.iter_mut().zip(acc) {
            *o = a.round().clamp(0.0, 255.0) as u8;
        }
    });
    Picture { w: dw, h: dh, rgb: out, icc: p.icc.clone() }
}

/// The picture as a JPEG (with its colour profile, so the window shows its colours right).
pub fn to_jpeg(p: &Picture, quality: u8) -> Result<Vec<u8>, String> {
    if p.w > 65535 || p.h > 65535 {
        return Err("This picture is too large for a JPEG preview".into());
    }
    let mut out = Vec::new();
    let mut enc = jpeg_encoder::Encoder::new(&mut out, quality);
    if let Some(icc) = &p.icc {
        let _ = enc.add_icc_profile(icc);
    }
    enc.encode(&p.rgb, p.w as u16, p.h as u16, jpeg_encoder::ColorType::Rgb).map_err(|e| e.to_string())?;
    Ok(out)
}

// --- HEIF / AVIF structure ------------------------------------------------------

/// What Culling needs from a HEIF or AVIF file's `meta` box, without decoding it.
#[derive(Default, Debug)]
pub struct HeifMeta {
    /// The primary picture's size as stored (before the turn).
    pub width: u32,
    pub height: u32,
    /// Quarter turns anticlockwise (irot) and mirror axis (imir).
    pub rot: u8,
    pub mirror: Option<u8>,
    /// Where the Exif and XMP blocks are in the file (offset, length).
    pub exif: Option<(u64, u64)>,
    pub xmp: Option<(u64, u64)>,
    pub icc: Option<Vec<u8>>,
}

impl HeifMeta {
    /// The size as shown, after the turn.
    pub fn shown(&self) -> (u32, u32) {
        if self.rot % 2 == 1 {
            (self.height, self.width)
        } else {
            (self.width, self.height)
        }
    }
}

fn be(b: &[u8], at: usize, n: usize) -> Option<u64> {
    let s = b.get(at..at.checked_add(n)?)?;
    Some(s.iter().fold(0u64, |v, &c| (v << 8) | c as u64))
}

/// Reads the `meta` box of a HEIF/AVIF file (ISO base media file format).
pub fn heif_meta<S: Source + ?Sized>(src: &S) -> Option<HeifMeta> {
    let size = src.size()?;
    let meta = lib::bmff_boxes(src, 0, size).into_iter().find(|b| &b.kind == b"meta")?;
    // Its contents (a few KB, usually) start after version and flags.
    let len = (meta.end - meta.data).min(16 << 20) as usize;
    let body = src.get(meta.data, len);
    if body.len() < 4 {
        return None;
    }
    let body = &body[4..];
    let children = lib::bmff_boxes(body, 0, body.len() as u64);
    let child = |k: &[u8; 4]| children.iter().find(|b| &b.kind == k).map(|b| &body[b.data as usize..b.end as usize]);

    let primary = child(b"pitm").and_then(|b| if b.first() == Some(&0) { be(b, 4, 2) } else { be(b, 4, 4) })? as u32;

    // Item types: Exif, and XMP (a "mime" item of type application/rdf+xml).
    let (mut exif_item, mut xmp_item) = (None, None);
    if let Some(iinf) = child(b"iinf") {
        let skip = if iinf.first() == Some(&0) { 6 } else { 8 };
        for infe in lib::bmff_boxes(iinf, skip as u64, iinf.len() as u64).iter().filter(|b| &b.kind == b"infe") {
            let e = &iinf[infe.data as usize..infe.end as usize];
            let v = *e.first()?;
            if v < 2 {
                continue;
            }
            let (id, at) = if v == 2 { (be(e, 4, 2), 6) } else { (be(e, 4, 4), 8) };
            let (Some(id), Some(kind)) = (id, e.get(at + 2..at + 6)) else { continue };
            if kind == b"Exif" {
                exif_item.get_or_insert(id as u32);
            } else if kind == b"mime" {
                let rest = &e[(at + 6).min(e.len())..];
                let name_end = rest.iter().position(|&c| c == 0).map_or(rest.len(), |i| i + 1);
                if rest[name_end.min(rest.len())..].starts_with(b"application/rdf+xml") {
                    xmp_item.get_or_insert(id as u32);
                }
            }
        }
    }

    let mut out = HeifMeta::default();
    if let Some(iloc) = child(b"iloc") {
        let locs = iloc_entries(iloc);
        let find = |id: Option<u32>| id.and_then(|id| locs.iter().find(|l| l.0 == id)).map(|l| (l.1, l.2));
        out.exif = find(exif_item);
        out.xmp = find(xmp_item);
    }

    // The primary item's properties: size, turn, mirror, colour profile.
    if let Some(iprp) = child(b"iprp") {
        let parts = lib::bmff_boxes(iprp, 0, iprp.len() as u64);
        let ipco = parts.iter().find(|b| &b.kind == b"ipco")?;
        let props = lib::bmff_boxes(iprp, ipco.data, ipco.end);
        for ipma in parts.iter().filter(|b| &b.kind == b"ipma") {
            let m = &iprp[ipma.data as usize..ipma.end as usize];
            let (v, flags) = (*m.first()?, be(m, 1, 3)?);
            let count = be(m, 4, 4)? as usize;
            let mut at = 8;
            for _ in 0..count.min(1 << 16) {
                let id = if v < 1 { be(m, at, 2) } else { be(m, at, 4) }? as u32;
                at += if v < 1 { 2 } else { 4 };
                let n = *m.get(at)? as usize;
                at += 1;
                for _ in 0..n {
                    let index = if flags & 1 == 1 { be(m, at, 2)? & 0x7fff } else { be(m, at, 1)? & 0x7f } as usize;
                    at += if flags & 1 == 1 { 2 } else { 1 };
                    if id != primary || index == 0 {
                        continue;
                    }
                    let Some(p) = props.get(index - 1) else { continue };
                    let d = &iprp[p.data as usize..p.end as usize];
                    match &p.kind {
                        b"ispe" => {
                            out.width = be(d, 4, 4).unwrap_or(0) as u32;
                            out.height = be(d, 8, 4).unwrap_or(0) as u32;
                        }
                        b"irot" => out.rot = d.first().map_or(0, |a| a & 3),
                        b"imir" => out.mirror = d.first().map(|a| a & 1),
                        b"colr" if matches!(d.get(0..4), Some(b"prof") | Some(b"rICC")) => out.icc = Some(d[4..].to_vec()),
                        _ => {}
                    }
                }
            }
        }
    }
    Some(out)
}

/// (item, offset, length) of each item stored in the file itself (iloc,
/// construction method 0), its extents taken as one run from the first.
fn iloc_entries(b: &[u8]) -> Vec<(u32, u64, u64)> {
    let mut out = Vec::new();
    let Some(&v) = b.first() else { return out };
    let (Some(s1), Some(s2)) = (b.get(4), b.get(5)) else { return out };
    let (off_size, len_size, base_size) = ((s1 >> 4) as usize, (s1 & 15) as usize, (s2 >> 4) as usize);
    let index_size = if v >= 1 { (s2 & 15) as usize } else { 0 };
    let (count, mut at) = if v < 2 { (be(b, 6, 2), 8) } else { (be(b, 6, 4), 10) };
    let Some(count) = count else { return out };
    for _ in 0..count.min(1 << 16) {
        let Some(id) = (if v < 2 { be(b, at, 2) } else { be(b, at, 4) }) else { break };
        at += if v < 2 { 2 } else { 4 };
        let mut method = 0;
        if v >= 1 {
            method = be(b, at, 2).unwrap_or(0) & 15;
            at += 2;
        }
        at += 2; // data reference index
        let base = be(b, at, base_size).unwrap_or(0);
        at += base_size;
        let Some(n) = be(b, at, 2) else { break };
        at += 2;
        let mut first: Option<(u64, u64)> = None;
        let mut total = 0u64;
        for _ in 0..n {
            at += index_size;
            let (Some(o), Some(l)) = (be(b, at, off_size), be(b, at + off_size, len_size)) else { return out };
            at += off_size + len_size;
            first.get_or_insert((o, l));
            total = total.saturating_add(l);
        }
        if let (0, Some((o, l))) = (method, first) {
            // Several extents are only read as one when they follow each other.
            let len = if n > 1 { total } else { l };
            out.push((id as u32, base.saturating_add(o), len));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pic(w: usize, h: usize) -> Picture {
        Picture { w, h, rgb: (0..w * h).flat_map(|i| [i as u8, 0, 0]).collect(), icc: None }
    }
    fn at(p: &Picture, x: usize, y: usize) -> u8 {
        p.rgb[(y * p.w + x) * 3]
    }

    #[test]
    fn turns_and_mirrors_like_heif() {
        // 3 x 2:  0 1 2 / 3 4 5
        let p = orient(pic(3, 2), 1, None); // a quarter turn anticlockwise: 2 5 / 1 4 / 0 3
        assert_eq!((p.w, p.h), (2, 3));
        assert_eq!([at(&p, 0, 0), at(&p, 1, 0), at(&p, 0, 2), at(&p, 1, 2)], [2, 5, 0, 3]);
        let p = orient(pic(3, 2), 3, None); // clockwise: 3 0 / 4 1 / 5 2
        assert_eq!([at(&p, 0, 0), at(&p, 1, 0), at(&p, 0, 2)], [3, 0, 5]);
        let p = orient(pic(3, 2), 2, None);
        assert_eq!([at(&p, 0, 0), at(&p, 2, 1)], [5, 0]);
        let p = orient(pic(3, 2), 0, Some(1)); // left and right swapped
        assert_eq!([at(&p, 0, 0), at(&p, 2, 0)], [2, 0]);
        let p = orient(pic(3, 2), 0, Some(0)); // top and bottom swapped
        assert_eq!([at(&p, 0, 0), at(&p, 0, 1)], [3, 0]);
    }

    #[test]
    fn shrinks_to_the_long_side() {
        let p = shrink(&Picture { w: 400, h: 100, rgb: vec![200; 400 * 100 * 3], icc: None }, 100);
        assert_eq!((p.w, p.h), (100, 25));
        assert!(p.rgb.iter().all(|&v| v == 200));
    }

    /// FLIGHTROOM_IMAGES=<folder> cargo test --release decodes_sample_files -- --ignored --nocapture
    #[test]
    #[ignore]
    fn decodes_sample_files() {
        let dir = std::env::var("FLIGHTROOM_IMAGES").unwrap();
        let mut names: Vec<_> = std::fs::read_dir(&dir).unwrap().flatten().map(|e| e.path()).collect();
        names.sort();
        for p in names {
            let ext = lib::ext_of(&p.to_string_lossy());
            if !IMAGE_EXTS.contains(&ext.as_str()) {
                continue;
            }
            let bytes = std::fs::read(&p).unwrap();
            let t = std::time::Instant::now();
            let meta = heif_meta(&bytes[..]);
            match decode(&bytes, &ext) {
                Ok(pic) => {
                    let ms = t.elapsed().as_millis();
                    let jpg = to_jpeg(&shrink(&pic, 1600), 90).unwrap();
                    let (w, h) = lib::jpeg_size(&jpg).unwrap();
                    println!("{}: ok {ms} ms -> {w}x{h} meta {:?}", p.display(), meta.map(|m| (m.width, m.height, m.rot, m.mirror, m.exif, m.icc.map(|i| i.len()))));
                    std::fs::write(format!("{}.preview.jpg", p.display()), jpg).unwrap();
                }
                Err(e) => println!("{}: FAILED {e}", p.display()),
            }
        }
    }
}
