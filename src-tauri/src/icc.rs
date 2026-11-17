// What a picture's colour profile (ICC) says its numbers mean, for pictures
// that aren't camera RAW files: how each channel turns into light (its tone
// curve), and which colour each channel's full light is (its primaries, as
// XYZ seen under D50). That is enough for the profiles almost every photo
// carries (sRGB, Display P3, Adobe RGB, ProPhoto, a camera's or a
// monitor's). Profiles of other kinds (lookup tables, CMYK) are read as sRGB.

/// The light (0-1) of each 16-bit value of each channel, and RGB -> XYZ (D50), row by row.
pub struct Profile {
    pub curves: [Vec<f32>; 3],
    pub to_xyz: [f32; 9],
}

/// sRGB's primaries as an ICC profile states them (adapted to D50 with Bradford).
pub const SRGB_XYZ: [f32; 9] = [0.43607, 0.38515, 0.14307, 0.22249, 0.71687, 0.06061, 0.01392, 0.09708, 0.71410];

fn srgb_to_light(v: f32) -> f32 {
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

/// The 65536-entry table of a tone function.
fn table(f: impl Fn(f32) -> f32) -> Vec<f32> {
    (0..65536).map(|i| f(i as f32 / 65535.0)).collect()
}

pub fn srgb() -> Profile {
    let c = table(srgb_to_light);
    Profile { curves: [c.clone(), c.clone(), c], to_xyz: SRGB_XYZ }
}

/// The profile's tone curves and primaries; sRGB's when it has none that can be read.
pub fn read(icc: Option<&[u8]>) -> Profile {
    icc.and_then(parse).unwrap_or_else(srgb)
}

fn be32(d: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(d.get(at..at + 4)?.try_into().ok()?))
}
fn s15(d: &[u8], at: usize) -> Option<f32> {
    Some(be32(d, at)? as i32 as f32 / 65536.0)
}

fn parse(d: &[u8]) -> Option<Profile> {
    let space = d.get(16..20)?;
    if space != b"RGB " && space != b"GRAY" {
        return None;
    }
    let n = be32(d, 128)? as usize;
    let mut tags = std::collections::HashMap::new();
    for i in 0..n.min(200) {
        let at = 132 + i * 12;
        let sig: [u8; 4] = d.get(at..at + 4)?.try_into().ok()?;
        let (off, len) = (be32(d, at + 4)? as usize, be32(d, at + 8)? as usize);
        tags.insert(sig, d.get(off..off.checked_add(len)?)?);
    }
    if space == b"GRAY" {
        // Grey pictures come as equal R, G and B: any primaries whose white is D50 keep them grey.
        let c = curve(tags.get(b"kTRC")?)?;
        return Some(Profile { curves: [c.clone(), c.clone(), c], to_xyz: SRGB_XYZ });
    }
    let xyz = |k: &[u8; 4]| -> Option<[f32; 3]> {
        let t = tags.get(k)?;
        if t.get(0..4)? != b"XYZ " {
            return None;
        }
        Some([s15(t, 8)?, s15(t, 12)?, s15(t, 16)?])
    };
    let (r, g, b) = (xyz(b"rXYZ")?, xyz(b"gXYZ")?, xyz(b"bXYZ")?);
    let curves = [curve(tags.get(b"rTRC")?)?, curve(tags.get(b"gTRC")?)?, curve(tags.get(b"bTRC")?)?];
    Some(Profile { curves, to_xyz: [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]] })
}

/// A curv or para tag as a 16-bit table.
fn curve(t: &[u8]) -> Option<Vec<f32>> {
    match t.get(0..4)? {
        b"curv" => {
            let n = be32(t, 8)? as usize;
            match n {
                0 => Some(table(|v| v)),
                1 => {
                    let g = u16::from_be_bytes(t.get(12..14)?.try_into().ok()?) as f32 / 256.0;
                    Some(table(|v| v.powf(g)))
                }
                _ => {
                    let pts: Vec<f32> = (0..n).map(|i| u16::from_be_bytes(t.get(12 + i * 2..14 + i * 2)?.try_into().ok()?).into()).collect::<Option<Vec<u16>>>()?.into_iter().map(|v: u16| v as f32 / 65535.0).collect();
                    Some(table(|v| {
                        let f = v * (n - 1) as f32;
                        let i = (f as usize).min(n - 2);
                        pts[i] + (pts[i + 1] - pts[i]) * (f - i as f32)
                    }))
                }
            }
        }
        b"para" => {
            let kind = u16::from_be_bytes(t.get(8..10)?.try_into().ok()?);
            let count = [1, 3, 4, 5, 7].get(kind as usize).copied()?;
            let p: Vec<f32> = (0..count).map(|i| s15(t, 12 + i * 4)).collect::<Option<_>>()?;
            let g = p[0];
            Some(table(|x| match kind {
                0 => x.powf(g),
                1 => {
                    if x >= -p[2] / p[1] {
                        (p[1] * x + p[2]).max(0.0).powf(g)
                    } else {
                        0.0
                    }
                }
                2 => {
                    if x >= -p[2] / p[1] {
                        (p[1] * x + p[2]).max(0.0).powf(g) + p[3]
                    } else {
                        p[3]
                    }
                }
                3 => {
                    if x >= p[4] {
                        (p[1] * x + p[2]).max(0.0).powf(g)
                    } else {
                        p[3] * x
                    }
                }
                _ => {
                    if x >= p[4] {
                        (p[1] * x + p[2]).max(0.0).powf(g) + p[5]
                    } else {
                        p[3] * x + p[6]
                    }
                }
            }))
        }
        _ => None,
    }
}

/// XYZ (D50) -> the picture's RGB: what Develop takes as the "camera" matrix.
pub fn from_xyz(p: &Profile) -> [f32; 9] {
    inv3(p.to_xyz)
}

pub fn inv3(m: [f32; 9]) -> [f32; 9] {
    let m: [f64; 9] = m.map(|v| v as f64);
    let det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    let k = 1.0 / det;
    [
        (m[4] * m[8] - m[5] * m[7]) * k,
        (m[2] * m[7] - m[1] * m[8]) * k,
        (m[1] * m[5] - m[2] * m[4]) * k,
        (m[5] * m[6] - m[3] * m[8]) * k,
        (m[0] * m[8] - m[2] * m[6]) * k,
        (m[2] * m[3] - m[0] * m[5]) * k,
        (m[3] * m[7] - m[4] * m[6]) * k,
        (m[1] * m[6] - m[0] * m[7]) * k,
        (m[0] * m[4] - m[1] * m[3]) * k,
    ]
    .map(|v| v as f32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn srgb_round_trips() {
        let p = srgb();
        let back = inv3(from_xyz(&p));
        for (a, b) in back.iter().zip(SRGB_XYZ) {
            assert!((a - b).abs() < 1e-5);
        }
        assert!((p.curves[0][65535] - 1.0).abs() < 1e-6);
        assert!((p.curves[0][32768] - 0.2140).abs() < 1e-3);
    }

    #[test]
    fn reads_a_parametric_profile() {
        // A minimal RGB profile: primaries and a gamma 2.2 'para' curve on each channel.
        let mut tags: Vec<([u8; 4], Vec<u8>)> = Vec::new();
        for (k, v) in [(b"rXYZ", [0.6, 0.3, 0.03]), (b"gXYZ", [0.2, 0.6, 0.07]), (b"bXYZ", [0.15, 0.1, 0.72])] {
            let mut t = b"XYZ \0\0\0\0".to_vec();
            for x in v {
                t.extend(((x * 65536.0f32).round() as i32).to_be_bytes());
            }
            tags.push((*k, t));
        }
        for k in [b"rTRC", b"gTRC", b"bTRC"] {
            let mut t = b"para\0\0\0\0\0\0\0\0".to_vec();
            t.extend(((2.2f32 * 65536.0).round() as i32).to_be_bytes());
            tags.push((*k, t));
        }
        let mut d = vec![0u8; 128];
        d[16..20].copy_from_slice(b"RGB ");
        d.extend((tags.len() as u32).to_be_bytes());
        let mut off = 132 + tags.len() * 12;
        let mut body: Vec<u8> = Vec::new();
        for (k, t) in &tags {
            d.extend(k);
            d.extend((off as u32).to_be_bytes());
            d.extend((t.len() as u32).to_be_bytes());
            off += t.len();
            body.extend(t);
        }
        d.extend(body);
        let p = read(Some(&d));
        assert!((p.to_xyz[0] - 0.6).abs() < 1e-4 && (p.to_xyz[1] - 0.2).abs() < 1e-4);
        assert!((p.curves[1][32768] - 0.5f32.powf(2.2)).abs() < 1e-3);
    }
}
