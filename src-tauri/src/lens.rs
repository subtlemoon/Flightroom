//! Lens corrections the camera writes into the RAW file.
//!
//! Nikon's mirrorless bodies store their distortion correction in the NEF's raw
//! SubIFD, tag 0xc7d5 (NikonNEFInfo): "Nikon\0", a 4-byte version, then a small
//! TIFF stream. Entry 0x0005 (DistortionInfo) holds the correction mode, three
//! radial coefficients and the zoom that fills the frame; 0x0008 holds the
//! optical centre's offset from the image centre (where in-body stabilisation
//! left the sensor). Lightroom applies it to Z lenses ("On (Required)") whether
//! or not lens profile corrections are on.
//!
//! The layout follows ExifTool's Nikon tag names and LightCraft's notes
//! (github.com/storytold/lightcraft, docs/nikon-lens-corrections.md, MIT/Apache):
//! from an output pixel back to the sensor, around the optical centre,
//! r_src = r_out * (1 + k3 rho^2 + k2 rho^4 + k1 rho^6) / (1 + q), rho = r_out / half diagonal.

use serde::Serialize;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Lens {
    /// Coefficients of rho^2, rho^4 and rho^6 (Nikon's k3, k2, k1).
    pub k: [f64; 3],
    /// The zoom that fills the frame: radii are divided by 1 + q.
    pub q: f64,
    /// Optical centre's offset from the image centre in sensor pixels (x right, y down).
    pub dx: f64,
    pub dy: f64,
    /// The camera requires the correction (Z lenses); otherwise it is optional.
    pub required: bool,
}

struct Tiff<'a> {
    d: &'a [u8],
    le: bool,
}

impl Tiff<'_> {
    fn u16(&self, o: usize) -> Option<u16> {
        let b: [u8; 2] = self.d.get(o..o + 2)?.try_into().ok()?;
        Some(if self.le { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    }
    fn u32(&self, o: usize) -> Option<u32> {
        let b: [u8; 4] = self.d.get(o..o + 4)?.try_into().ok()?;
        Some(if self.le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }
    fn i32(&self, o: usize) -> Option<i32> {
        self.u32(o).map(|v| v as i32)
    }
    /// A signed rational at o.
    fn srat(&self, o: usize) -> Option<f64> {
        let (n, d) = (self.i32(o)?, self.i32(o + 4)?);
        (d != 0).then(|| n as f64 / d as f64)
    }
    /// The IFD entries at o as (tag, type, count, value-or-offset).
    fn entries(&self, o: usize) -> Option<Vec<(u16, u16, u32, u32)>> {
        let n = self.u16(o)? as usize;
        if n > 500 {
            return None;
        }
        (0..n).map(|i| {
            let e = o + 2 + 12 * i;
            Some((self.u16(e)?, self.u16(e + 2)?, self.u32(e + 4)?, self.u32(e + 8)?))
        }).collect()
    }
}

fn read_at(f: &mut File, at: u64, len: usize) -> Option<Vec<u8>> {
    let mut b = vec![0u8; len];
    f.seek(SeekFrom::Start(at)).ok()?;
    f.read_exact(&mut b).ok()?;
    Some(b)
}

/// The NikonNEFInfo block of a NEF, from the SubIFDs of its first IFDs.
fn nef_info(path: &Path) -> Option<Vec<u8>> {
    let mut f = File::open(path).ok()?;
    let len = f.metadata().ok()?.len();
    // The IFDs of a NEF sit at its start, before the image data.
    let head = read_at(&mut f, 0, len.min(1 << 20) as usize)?;
    let t = Tiff { le: head.get(..2)? == b"II", d: &head };
    if !matches!(head.get(..2)?, b"II" | b"MM") {
        return None;
    }
    let mut ifds = vec![t.u32(4)? as usize];
    let mut seen = 0;
    while let Some(o) = ifds.pop() {
        seen += 1;
        if seen > 16 {
            break;
        }
        for (tag, _, count, val) in t.entries(o)? {
            match tag {
                0x014a => {
                    if count == 1 {
                        ifds.push(val as usize);
                    } else {
                        ifds.extend((0..count.min(8) as usize).filter_map(|k| t.u32(val as usize + 4 * k)).map(|v| v as usize));
                    }
                }
                0xc7d5 if (16..=1 << 16).contains(&count) => return read_at(&mut f, val as u64, count as usize),
                _ => {}
            }
        }
    }
    None
}

/// Nikon's in-file distortion correction, when the NEF has one.
pub fn nikon(path: &Path) -> Option<Lens> {
    parse_nef_info(&nef_info(path)?)
}

fn parse_nef_info(b: &[u8]) -> Option<Lens> {
    if b.get(..6)? != b"Nikon\0" {
        return None;
    }
    let base = 10;
    let s = b.get(base..)?;
    let t = Tiff { le: s.get(..2)? == b"II", d: s };
    let (mut dist, mut centre) = (None, None);
    for (tag, _, count, val) in t.entries(t.u32(4)? as usize)? {
        let (o, n) = (val as usize, count as usize);
        match tag {
            0x0005 if n >= 72 => dist = Some(o),
            0x0008 if n >= 20 => centre = Some(o),
            _ => {}
        }
    }
    let o = dist?;
    if t.d.get(o..o + 4)? != b"0100" {
        return None;
    }
    let mode = *t.d.get(o + 4)?;
    if mode == 0 || t.u32(o + 16)? < 3 {
        return None;
    }
    // Normalised at the FX half diagonal (21.6 mm): the image's half diagonal.
    let norm = t.srat(o + 8)?;
    if !(20.0..23.0).contains(&norm) {
        return None;
    }
    let (k1, k2, k3, q) = (t.srat(o + 20)?, t.srat(o + 28)?, t.srat(o + 36)?, t.srat(o + 64)?);
    let ok = |v: f64| v.is_finite() && v.abs() < 1.0;
    if ![k1, k2, k3, q].into_iter().all(ok) {
        return None;
    }
    let (dx, dy) = match centre {
        Some(c) if t.d.get(c..c + 4) == Some(b"0100") => (t.srat(c + 4).unwrap_or(0.0), t.srat(c + 12).unwrap_or(0.0)),
        _ => (0.0, 0.0),
    };
    let ok_px = |v: f64| v.is_finite() && v.abs() < 1000.0;
    Some(Lens { k: [k3, k2, k1], q, dx: if ok_px(dx) { dx } else { 0.0 }, dy: if ok_px(dy) { dy } else { 0.0 }, required: mode == 3 })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// NikonNEFInfo of a Z 7II + NIKKOR Z 24-70mm f/4 S at 56 mm (JWL_7345.NEF), cut to the two entries used.
    fn sample() -> Vec<u8> {
        let mut b = b"Nikon\0\x01\x01\0\0".to_vec();
        let mut t = vec![0u8; 0x200];
        t[..8].copy_from_slice(b"II*\0\x08\0\0\0");
        let put = |t: &mut Vec<u8>, o: usize, v: &[u8]| t[o..o + v.len()].copy_from_slice(v);
        put(&mut t, 8, &2u16.to_le_bytes());
        // entries: tag, type 7, count, offset
        for (i, (tag, n, off)) in [(5u16, 0x54u32, 0x40u32), (8, 0x18, 0x100)].into_iter().enumerate() {
            let e = 10 + 12 * i;
            put(&mut t, e, &tag.to_le_bytes());
            put(&mut t, e + 2, &7u16.to_le_bytes());
            put(&mut t, e + 4, &n.to_le_bytes());
            put(&mut t, e + 8, &off.to_le_bytes());
        }
        let d = 0x40;
        put(&mut t, d, b"0100");
        t[d + 4] = 3;
        let rat = |n: i32, den: i32| [n.to_le_bytes(), den.to_le_bytes()].concat();
        put(&mut t, d + 8, &rat(88474, 4096));
        put(&mut t, d + 16, &4u32.to_le_bytes());
        put(&mut t, d + 20, &rat(20343, 1 << 20));
        put(&mut t, d + 28, &rat(-13503, 1 << 20));
        put(&mut t, d + 36, &rat(53672, 1 << 20));
        put(&mut t, d + 64, &rat(83269, 1 << 20));
        let c = 0x100;
        put(&mut t, c, b"0100");
        put(&mut t, c + 4, &rat(2378, 256));
        put(&mut t, c + 12, &rat(-7088, 256));
        b.extend(t);
        b
    }

    #[test]
    fn reads_nikon_distortion() {
        let l = parse_nef_info(&sample()).unwrap();
        assert!(l.required);
        assert!((l.k[0] - 0.05119).abs() < 1e-4 && (l.k[1] + 0.01288).abs() < 1e-4 && (l.k[2] - 0.0194).abs() < 1e-4);
        assert!((l.q - 0.07941).abs() < 1e-4);
        assert!((l.dx - 9.289).abs() < 1e-2 && (l.dy + 27.69).abs() < 1e-2);
    }

    #[test]
    fn ignores_other_blocks() {
        assert_eq!(parse_nef_info(b"Nikon\0\x01\x01\0\0II*\0\x08\0\0\0\0\0"), None);
        assert_eq!(parse_nef_info(b"Canon"), None);
    }

    /// FLIGHTROOM_NEF=<a NEF from a Z body> cargo test lens::tests::reads_a_real_nef -- --nocapture
    #[test]
    fn reads_a_real_nef() {
        let Ok(p) = std::env::var("FLIGHTROOM_NEF") else { return };
        println!("{:?}", nikon(Path::new(&p)));
    }
}
