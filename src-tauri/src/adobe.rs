// Lightroom's own colour, read from the Adobe Camera Raw files that Lightroom
// Classic installs on this computer (nothing of Adobe's ships with Flightroom):
//
// - Camera profiles (.dcp, DNG specification chapter 6): "Adobe Standard" and
//   "Camera Standard" for each camera. Each has the camera's colour matrices,
//   forward matrices, a hue/saturation map, a look table and, for some, a tone
//   curve. Develop renders with them exactly as Adobe's DNG SDK does
//   (src/develop/adobe.js).
// - Adobe Color: a look on top of Adobe Standard (its own look table and a
//   point curve), kept as an .xmp preset by Camera Raw, or written into a
//   photo's sidecar by Lightroom ("Save Metadata to File").

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// A hue/saturation map or look table: `dims` = hue, saturation and value
/// divisions; `data` = (hue shift in degrees, saturation scale, value scale)
/// for each entry, value-major, then hue, then saturation.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HueSatMap {
    pub dims: [u32; 3],
    pub data: Vec<f32>,
    /// Values are looked up and scaled sRGB-encoded (otherwise linear).
    pub srgb: bool,
}

/// One illuminant of a profile.
#[derive(Serialize, Clone, Debug)]
pub struct Illuminant {
    /// Colour temperature, as Adobe's DNG SDK assigns it to the illuminant.
    pub temp: f64,
    /// XYZ -> camera.
    pub color: [f64; 9],
    /// Camera (white balanced) -> XYZ D50, if the profile has one.
    pub forward: Option<[f64; 9]>,
    pub hue_sat: Option<HueSatMap>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Dcp {
    pub name: String,
    pub camera: String,
    /// One or two illuminants, the warmer light (lower temperature) first.
    pub illuminants: Vec<Illuminant>,
    pub look: Option<HueSatMap>,
    /// The profile's tone curve (x, y pairs); none means Adobe's default curve.
    pub tone: Option<Vec<f32>>,
    pub exposure_offset: f64,
}

/// A Lightroom look (such as Adobe Color): its look table and its point curve.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Look {
    pub name: String,
    pub table: Option<HueSatMap>,
    /// ToneCurvePV2012 points, 0-255.
    pub curve: Vec<[f32; 2]>,
}

// --- TIFF-style reading ----------------------------------------------------

struct Ifd<'a> {
    b: &'a [u8],
    le: bool,
    entries: HashMap<u16, (u16, u32, usize)>,
}

const TYPE_SIZE: [usize; 13] = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

impl<'a> Ifd<'a> {
    fn u16(b: &[u8], le: bool, o: usize) -> Option<u16> {
        let s: [u8; 2] = b.get(o..o + 2)?.try_into().ok()?;
        Some(if le { u16::from_le_bytes(s) } else { u16::from_be_bytes(s) })
    }
    fn u32(b: &[u8], le: bool, o: usize) -> Option<u32> {
        let s: [u8; 4] = b.get(o..o + 4)?.try_into().ok()?;
        Some(if le { u32::from_le_bytes(s) } else { u32::from_be_bytes(s) })
    }

    /// The first IFD of a .dcp (magic "RC") or a TIFF/DNG (42).
    fn parse(b: &'a [u8]) -> Option<Ifd<'a>> {
        let le = match b.get(0..2)? {
            b"II" => true,
            b"MM" => false,
            _ => return None,
        };
        let magic = Self::u16(b, le, 2)?;
        if magic != 0x4352 && magic != 42 {
            return None;
        }
        let off = Self::u32(b, le, 4)? as usize;
        let n = Self::u16(b, le, off)? as usize;
        let mut entries = HashMap::new();
        for i in 0..n {
            let e = off + 2 + i * 12;
            let tag = Self::u16(b, le, e)?;
            let typ = Self::u16(b, le, e + 2)?;
            let count = Self::u32(b, le, e + 4)?;
            let size = TYPE_SIZE.get(typ as usize).copied().unwrap_or(0) * count as usize;
            let at = if size <= 4 { e + 8 } else { Self::u32(b, le, e + 8)? as usize };
            entries.insert(tag, (typ, count, at));
        }
        Some(Ifd { b, le, entries })
    }

    fn nums(&self, tag: u16) -> Option<Vec<f64>> {
        let &(typ, count, at) = self.entries.get(&tag)?;
        let (b, le) = (self.b, self.le);
        let count = count as usize;
        if at.checked_add(count * TYPE_SIZE.get(typ as usize).copied().unwrap_or(0))? > b.len() {
            return None;
        }
        let mut out = Vec::with_capacity(count);
        for i in 0..count {
            out.push(match typ {
                1 | 7 => b[at + i] as f64,
                6 => b[at + i] as i8 as f64,
                3 => Self::u16(b, le, at + i * 2)? as f64,
                8 => Self::u16(b, le, at + i * 2)? as i16 as f64,
                4 => Self::u32(b, le, at + i * 4)? as f64,
                9 => Self::u32(b, le, at + i * 4)? as i32 as f64,
                5 | 10 => {
                    let (n, d) = (Self::u32(b, le, at + i * 8)?, Self::u32(b, le, at + i * 8 + 4)?);
                    let (n, d) = if typ == 10 { (n as i32 as f64, d as i32 as f64) } else { (n as f64, d as f64) };
                    if d == 0.0 {
                        0.0
                    } else {
                        n / d
                    }
                }
                11 => f32::from_bits(Self::u32(b, le, at + i * 4)?) as f64,
                12 => {
                    let lo = Self::u32(b, le, at + i * 8)? as u64;
                    let hi = Self::u32(b, le, at + i * 8 + 4)? as u64;
                    f64::from_bits(if le { lo | hi << 32 } else { hi | lo << 32 })
                }
                _ => return None,
            });
        }
        Some(out)
    }

    fn num(&self, tag: u16) -> Option<f64> {
        self.nums(tag)?.first().copied()
    }

    fn text(&self, tag: u16) -> Option<String> {
        let &(typ, count, at) = self.entries.get(&tag)?;
        if typ != 1 && typ != 2 && typ != 7 {
            return None;
        }
        let s = self.b.get(at..at + count as usize)?;
        let s = s.split(|&c| c == 0).next().unwrap_or(&[]);
        Some(String::from_utf8_lossy(s).trim().to_string())
    }

    fn matrix(&self, tag: u16) -> Option<[f64; 9]> {
        let v = self.nums(tag)?;
        (v.len() == 9).then(|| std::array::from_fn(|i| v[i]))
    }
}

const UNIQUE_CAMERA_MODEL: u16 = 50708;
const COLOR_MATRIX: [u16; 2] = [50721, 50722];
const ILLUMINANT: [u16; 2] = [50778, 50779];
const PROFILE_NAME: u16 = 50936;
const HUE_SAT_DIMS: u16 = 50937;
const HUE_SAT_DATA: [u16; 2] = [50938, 50939];
const TONE_CURVE: u16 = 50940;
const FORWARD_MATRIX: [u16; 2] = [50964, 50965];
const LOOK_DIMS: u16 = 50981;
const LOOK_DATA: u16 = 50982;
const HUE_SAT_ENCODING: u16 = 51107;
const LOOK_ENCODING: u16 = 51108;
const EXPOSURE_OFFSET: u16 = 51109;

/// The temperature Adobe's DNG SDK gives an EXIF light source
/// (dng_camera_profile::IlluminantToTemperature).
fn illuminant_temp(light: u32) -> f64 {
    match light {
        17 | 3 => 2850.0,
        24 => 3200.0,
        23 => 5000.0,
        20 | 1 | 9 | 4 | 18 => 5500.0,
        21 | 19 | 10 => 6500.0,
        22 | 11 => 7500.0,
        12 => (5700.0 + 7100.0) * 0.5,
        13 => (4600.0 + 5500.0) * 0.5,
        14 | 2 => (3800.0 + 4500.0) * 0.5,
        15 => (3250.0 + 3800.0) * 0.5,
        16 => (2600.0 + 3250.0) * 0.5,
        _ => 0.0,
    }
}

/// A hue/sat map from its dimensions and floats; a table without its
/// saturation-0 column (allowed by the specification) gets the identity there.
fn hue_sat_map(dims: &[f64], data: &[f64], srgb: bool) -> Option<HueSatMap> {
    let (h, s, v) = (*dims.first()? as usize, *dims.get(1)? as usize, (dims.get(2).copied().unwrap_or(1.0) as usize).max(1));
    if h == 0 || s < 2 || h * s * v > 360 * 256 * 4 {
        return None;
    }
    let full = h * s * v * 3;
    let skip = data.len() == h * (s - 1) * v * 3;
    if data.len() != full && !skip {
        return None;
    }
    let mut out = Vec::with_capacity(full);
    let mut it = data.iter();
    for _ in 0..v * h {
        for si in 0..s {
            if skip && si == 0 {
                out.extend([0.0, 1.0, 1.0]);
            } else {
                for _ in 0..3 {
                    out.push(*it.next()? as f32);
                }
            }
        }
    }
    Some(HueSatMap { dims: [h as u32, s as u32, v as u32], data: out, srgb })
}

/// Reads a camera profile (.dcp file, or the profile inside a DNG).
pub fn parse_dcp(b: &[u8]) -> Option<Dcp> {
    let ifd = Ifd::parse(b)?;
    let dims = ifd.nums(HUE_SAT_DIMS);
    let hs_srgb = ifd.num(HUE_SAT_ENCODING) == Some(1.0);
    let mut illuminants = Vec::new();
    for i in 0..2 {
        let Some(color) = ifd.matrix(COLOR_MATRIX[i]) else { continue };
        let temp = illuminant_temp(ifd.num(ILLUMINANT[i]).unwrap_or(0.0) as u32);
        let hue_sat = dims.as_ref().and_then(|d| hue_sat_map(d, &ifd.nums(HUE_SAT_DATA[i])?, hs_srgb));
        illuminants.push(Illuminant { temp, color, forward: ifd.matrix(FORWARD_MATRIX[i]), hue_sat });
    }
    if illuminants.is_empty() {
        return None;
    }
    // As dng_color_spec: one illuminant unless both have usable, different
    // temperatures; then the warmer one first.
    if illuminants.len() == 2 && (illuminants[0].temp <= 0.0 || illuminants[1].temp <= 0.0 || illuminants[0].temp == illuminants[1].temp) {
        illuminants.truncate(1);
    }
    if illuminants.len() == 2 && illuminants[0].temp > illuminants[1].temp {
        illuminants.swap(0, 1);
    }
    if illuminants.len() == 1 {
        illuminants[0].temp = 5000.0;
    }
    let look = ifd.nums(LOOK_DIMS).and_then(|d| hue_sat_map(&d, &ifd.nums(LOOK_DATA)?, ifd.num(LOOK_ENCODING) == Some(1.0)));
    let tone = ifd.nums(TONE_CURVE).filter(|t| t.len() >= 4 && t.len() % 2 == 0).map(|t| t.iter().map(|&v| v as f32).collect());
    Some(Dcp {
        name: ifd.text(PROFILE_NAME).unwrap_or_default(),
        camera: ifd.text(UNIQUE_CAMERA_MODEL).unwrap_or_default(),
        illuminants,
        look,
        tone,
        exposure_offset: ifd.num(EXPOSURE_OFFSET).unwrap_or(0.0),
    })
}

// --- Finding Lightroom's files ---------------------------------------------

/// Letters and digits only, lower case: "Nikon Z 7_2" and "NIKON Z 7 2" both become "nikonz72".
pub fn norm(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric()).map(|c| c.to_ascii_lowercase()).collect()
}

/// The ways Adobe may name a camera ("Nikon Z 7_2"), from rawler's make and models.
pub fn camera_names(clean_make: &str, clean_model: &str, model: &str) -> Vec<String> {
    let mut out = vec![norm(&format!("{clean_make} {clean_model}"))];
    let (mk, m) = (norm(clean_make), norm(model));
    let first = norm(model.split_whitespace().next().unwrap_or(""));
    // "NIKON Z 7_2" (EXIF model with the make in it) or "ILCE-7M4" (without).
    out.push(if !first.is_empty() && mk.starts_with(&first) { format!("{mk}{}", &m[first.len()..]) } else { format!("{mk}{m}") });
    out.dedup();
    out
}

/// Where Camera Raw (and so Lightroom Classic) keeps its settings.
fn camera_raw_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for var in ["PROGRAMDATA", "APPDATA"] {
        if let Some(d) = std::env::var_os(var) {
            dirs.push(PathBuf::from(d).join("Adobe").join("CameraRaw"));
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(home).join("Library/Application Support/Adobe/CameraRaw"));
    }
    dirs.push(PathBuf::from("/Library/Application Support/Adobe/CameraRaw"));
    if let Some(d) = std::env::var_os("FLIGHTROOM_CAMERA_RAW") {
        dirs.insert(0, PathBuf::from(d));
    }
    dirs
}

/// Files under `dir` with extension `ext`, a few folders deep.
fn walk(dir: &Path, ext: &str, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_dir() {
            if depth > 0 {
                walk(&p, ext, depth - 1, out);
            }
        } else if p.extension().is_some_and(|x| x.eq_ignore_ascii_case(ext)) && out.len() < 20000 {
            out.push(p);
        }
    }
}

fn profile_files(dirs: &[PathBuf]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for d in dirs {
        walk(&d.join("CameraProfiles"), "dcp", 4, &mut out);
    }
    out
}

/// The camera named in a .dcp, read from the start of the file when it's there.
fn dcp_camera(p: &Path) -> Option<(String, String)> {
    use std::io::Read;
    let mut f = std::fs::File::open(p).ok()?;
    let mut head = vec![0u8; 64 * 1024];
    let n = f.read(&mut head).ok()?;
    head.truncate(n);
    let read = |b: &[u8]| Ifd::parse(b).map(|i| (i.text(UNIQUE_CAMERA_MODEL), i.text(PROFILE_NAME)));
    if let Some((Some(c), Some(name))) = read(&head) {
        return Some((c, name));
    }
    let all = std::fs::read(p).ok()?;
    let (c, name) = read(&all)?;
    Some((c?, name.unwrap_or_default()))
}

/// Finds and reads the profile called `name` ("Adobe Standard") for a camera.
pub fn find_profile(dirs: &[PathBuf], cameras: &[String], name: &str) -> Option<Dcp> {
    let files = profile_files(dirs);
    let want = norm(name);
    // Adobe names the files "<camera> <profile>.dcp": try those first.
    let by_name = files.iter().filter(|p| {
        let stem = norm(&p.file_stem().unwrap_or_default().to_string_lossy());
        cameras.iter().any(|c| stem == format!("{c}{want}"))
    });
    let rest = files.iter().filter(|p| {
        let stem = norm(&p.file_stem().unwrap_or_default().to_string_lossy());
        stem.contains(&want)
    });
    for p in by_name.chain(rest) {
        let Some((cam, pname)) = dcp_camera(p) else { continue };
        if !cameras.contains(&norm(&cam)) || norm(&pname) != want {
            continue;
        }
        if let Some(d) = std::fs::read(p).ok().and_then(|b| parse_dcp(&b)) {
            return Some(d);
        }
    }
    None
}

// --- Looks (Adobe Color) ---------------------------------------------------

/// Decodes a "big table" as Lightroom writes it into XMP (dng_big_table:
/// a Z85-like text encoding, the length, then zlib).
pub fn decode_table(text: &str) -> Option<Vec<u8>> {
    const T: &[u8; 96] = b"\xFF\x44\xFF\x54\x53\x52\xFF\x49\x4B\x4C\x46\x41\xFF\x3F\x3E\x45\
\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x40\xFF\xFF\x42\xFF\x47\
\x51\x24\x25\x26\x27\x28\x29\x2A\x2B\x2C\x2D\x2E\x2F\x30\x31\x32\
\x33\x34\x35\x36\x37\x38\x39\x3A\x3B\x3C\x3D\x4D\xFF\x4E\x43\xFF\
\x48\x0A\x0B\x0C\x0D\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\
\x19\x1A\x1B\x1C\x1D\x1E\x1F\x20\x21\x22\x23\x4F\x4A\x50\xFF\xFF";
    let mut bin = Vec::with_capacity(text.len() * 4 / 5 + 4);
    let (mut phase, mut value) = (0u32, 0u64);
    for &e in text.as_bytes() {
        if !(32..128).contains(&e) {
            continue;
        }
        let d = T[(e - 32) as usize] as u64;
        if d > 85 {
            continue;
        }
        value += d * 85u64.pow(phase);
        phase += 1;
        if phase == 5 {
            bin.extend_from_slice(&(value as u32).to_le_bytes());
            phase = 0;
            value = 0;
        }
    }
    if phase > 1 {
        bin.extend_from_slice(&(value as u32).to_le_bytes()[..phase as usize - 1]);
    }
    if bin.len() < 5 {
        return None;
    }
    let size = u32::from_le_bytes(bin[0..4].try_into().ok()?) as usize;
    if size > 16 << 20 {
        return None;
    }
    use std::io::Read;
    let mut out = Vec::with_capacity(size);
    flate2::read::ZlibDecoder::new(&bin[4..]).take(size as u64).read_to_end(&mut out).ok()?;
    (out.len() == size).then_some(out)
}

/// A look table from its decoded bytes (dng_look_table::GetStream).
pub fn parse_look_table(b: &[u8]) -> Option<HueSatMap> {
    let u = |i: usize| b.get(i * 4..i * 4 + 4).map(|s| u32::from_le_bytes(s.try_into().unwrap()));
    if u(0)? != 0 || !(1..=2).contains(&u(1)?) {
        return None; // not a look table (an RGB table, say)
    }
    let (h, s, v) = (u(2)? as usize, u(3)? as usize, u(4)? as usize);
    if h == 0 || s < 2 || v == 0 || h * s * v > 36 * 32 * 16 {
        return None;
    }
    let n = h * s * v * 3;
    let data: Vec<f64> = (0..n).map(|i| u(5 + i).map(|x| f32::from_bits(x) as f64)).collect::<Option<_>>()?;
    let srgb = u(5 + n)? == 1;
    hue_sat_map(&[h as f64, s as f64, v as f64], &data, srgb)
}

/// The value of `crs:<name>`, as an attribute or an element.
fn crs_value<'a>(text: &'a str, name: &str) -> Option<&'a str> {
    let attr = format!("crs:{name}=\"");
    if let Some(i) = text.find(&attr) {
        let s = &text[i + attr.len()..];
        return Some(&s[..s.find('"')?]);
    }
    let open = format!("<crs:{name}>");
    let i = text.find(&open)? + open.len();
    let s = &text[i..];
    Some(&s[..s.find('<')?])
}

/// Points of a crs:ToneCurvePV2012 sequence.
fn curve_points(text: &str) -> Vec<[f32; 2]> {
    let Some(i) = text.find("<crs:ToneCurvePV2012>") else { return Vec::new() };
    let s = &text[i..];
    let s = &s[..s.find("</crs:ToneCurvePV2012>").unwrap_or(s.len())];
    s.split("<rdf:li>")
        .skip(1)
        .filter_map(|li| {
            let li = &li[..li.find('<')?];
            let (x, y) = li.split_once(',')?;
            Some([x.trim().parse().ok()?, y.trim().parse().ok()?])
        })
        .collect()
}

/// Whether this XMP text names the look `name` (crs:Name as attribute or alt-language text).
fn names_look(text: &str, name: &str) -> bool {
    text.contains(&format!("crs:Name=\"{name}\"")) || text.contains(&format!(">{name}</rdf:li>"))
}

/// Reads the look called `name` from XMP text: a Camera Raw preset file, or a
/// photo's sidecar (inside its crs:Look). The table is found anywhere in the text.
pub fn look_from_xmp(text: &str, name: &str) -> Option<Look> {
    let part = match (text.find("<crs:Look>"), text.find("</crs:Look>")) {
        (Some(a), Some(b)) if b > a => &text[a..b],
        _ => text,
    };
    if !names_look(part, name) {
        return None;
    }
    let table = crs_value(part, "LookTable").and_then(|fp| {
        let t = crs_value(text, &format!("Table_{fp}"))?;
        parse_look_table(&decode_table(t)?)
    });
    // An RGB-table look (creative profiles) isn't supported.
    if table.is_none() && crs_value(part, "RGBTable").is_some() {
        return None;
    }
    Some(Look { name: name.to_string(), table, curve: curve_points(part) })
}

/// A sidecar without its crs:Look element, and that element (with the
/// whitespace before it).
pub fn split_look(text: &str) -> (String, Option<String>) {
    match (text.find("<crs:Look>"), text.find("</crs:Look>")) {
        (Some(a), Some(b)) if b > a => {
            let a = text[..a].trim_end().len();
            let b = b + "</crs:Look>".len();
            (format!("{}{}", &text[..a], &text[b..]), Some(text[a..b].to_string()))
        }
        _ => (text.to_string(), None),
    }
}

/// Puts a crs:Look element (from split_look) back at the end of the photo's settings.
pub fn put_look(text: &str, look: &str) -> String {
    let end = text.find("</rdf:RDF>").unwrap_or(text.len());
    match text[..end].rfind("</rdf:Description>") {
        Some(i) => {
            let i = text[..i].trim_end().len();
            format!("{}{look}{}", &text[..i], &text[i..])
        }
        None => text.to_string(),
    }
}

/// The name of the look in a crs:Look element.
pub fn look_name(look: &str) -> Option<String> {
    crs_value(look, "Name").map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).or_else(|| {
        let i = look.find("<crs:Name>")?;
        let s = &look[i..];
        let li = s.find("<rdf:li")?;
        let s = &s[li..];
        let gt = s.find('>')? + 1;
        Some(s[gt..gt + s[gt..].find('<')?].trim().to_string())
    })
}

/// Looks with their table, found in Camera Raw's settings, cached for this run.
fn find_look(dirs: &[PathBuf], name: &str) -> Option<Look> {
    let mut files = Vec::new();
    for d in dirs {
        walk(&d.join("Settings"), "xmp", 6, &mut files);
    }
    files.into_iter().find_map(|p| {
        if std::fs::metadata(&p).map(|m| m.len() > 8 << 20).unwrap_or(true) {
            return None;
        }
        let text = std::fs::read_to_string(&p).ok()?;
        look_from_xmp(&text, name).filter(|l| l.table.is_some())
    })
}

// --- What Develop asks for -------------------------------------------------

/// Lightroom's profiles and looks for a photo's camera.
#[derive(Serialize, Clone, Default)]
pub struct Adobe {
    /// "Adobe Standard" and "Camera Standard", when Lightroom has them for this camera.
    pub profiles: HashMap<String, Dcp>,
    pub looks: HashMap<String, Look>,
}

pub const PROFILE_NAMES: [&str; 2] = ["Adobe Standard", "Camera Standard"];
pub const LOOK_NAMES: [&str; 1] = ["Adobe Color"];

static PROFILES: OnceLock<Mutex<HashMap<String, Option<Dcp>>>> = OnceLock::new();
static LOOKS: OnceLock<Mutex<HashMap<String, Option<Look>>>> = OnceLock::new();

/// The profiles and looks for a camera. `sidecar` (the photo's XMP) may carry
/// a look's table, which is then kept in `cache` for every other photo.
pub fn for_camera(cameras: &[String], sidecar: Option<&str>, cache: &Path) -> Adobe {
    let dirs = camera_raw_dirs();
    let mut out = Adobe::default();
    let profiles = PROFILES.get_or_init(Default::default);
    for name in PROFILE_NAMES {
        let key = format!("{}|{name}", cameras.join(","));
        let found = {
            let known = profiles.lock().unwrap().get(&key).cloned();
            match known {
                Some(f) => f,
                None => {
                    let f = find_profile(&dirs, cameras, name);
                    profiles.lock().unwrap().insert(key, f.clone());
                    f
                }
            }
        };
        if let Some(d) = found {
            out.profiles.insert(name.to_string(), d);
        }
    }
    let looks = LOOKS.get_or_init(Default::default);
    for name in LOOK_NAMES {
        let file = cache.join(format!("{}.json", norm(name)));
        if let Some(l) = sidecar.and_then(|t| look_from_xmp(t, name)).filter(|l| l.table.is_some()) {
            // Lightroom wrote this look's table into the sidecar: keep it for every photo.
            let _ = std::fs::create_dir_all(cache);
            if let Ok(j) = serde_json::to_string(&LookFile::from(&l)) {
                let _ = std::fs::write(&file, j);
            }
            looks.lock().unwrap().insert(name.to_string(), Some(l));
        }
        let known = looks.lock().unwrap().get(name).cloned();
        let found = match known {
            Some(f) => f,
            None => {
                let f = std::fs::read_to_string(&file).ok().and_then(|j| serde_json::from_str::<LookFile>(&j).ok()).map(Look::from).or_else(|| find_look(&dirs, name));
                looks.lock().unwrap().insert(name.to_string(), f.clone());
                f
            }
        };
        if let Some(l) = found {
            out.looks.insert(name.to_string(), l);
        }
    }
    out
}

/// A look as kept on disk.
#[derive(Serialize, serde::Deserialize)]
struct LookFile {
    name: String,
    dims: [u32; 3],
    data: Vec<f32>,
    srgb: bool,
    curve: Vec<[f32; 2]>,
}

impl From<&Look> for LookFile {
    fn from(l: &Look) -> Self {
        let t = l.table.clone().unwrap_or(HueSatMap { dims: [0; 3], data: Vec::new(), srgb: false });
        LookFile { name: l.name.clone(), dims: t.dims, data: t.data, srgb: t.srgb, curve: l.curve.clone() }
    }
}

impl From<LookFile> for Look {
    fn from(f: LookFile) -> Self {
        let table = (f.dims[0] > 0).then_some(HueSatMap { dims: f.dims, data: f.data, srgb: f.srgb });
        Look { name: f.name, table, curve: f.curve }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A little-endian .dcp with the given (tag, type, values) entries.
    fn dcp(entries: &[(u16, u16, Vec<u8>, u32)]) -> Vec<u8> {
        let mut b = b"IIRC".to_vec();
        b.extend(8u32.to_le_bytes());
        let n = entries.len();
        b.extend((n as u16).to_le_bytes());
        let mut data_at = 8 + 2 + n * 12 + 4;
        let mut data: Vec<u8> = Vec::new();
        for (tag, typ, bytes, count) in entries {
            b.extend(tag.to_le_bytes());
            b.extend(typ.to_le_bytes());
            b.extend(count.to_le_bytes());
            if bytes.len() <= 4 {
                let mut v = bytes.clone();
                v.resize(4, 0);
                b.extend(v);
            } else {
                b.extend((data_at as u32).to_le_bytes());
                data.extend(bytes);
                data_at += bytes.len();
            }
        }
        b.extend(0u32.to_le_bytes());
        b.extend(data);
        b
    }
    fn srat(v: &[f64]) -> Vec<u8> {
        v.iter().flat_map(|x| [((x * 10000.0).round() as i32).to_le_bytes(), 10000i32.to_le_bytes()].concat()).collect()
    }
    fn floats(v: &[f32]) -> Vec<u8> {
        v.iter().flat_map(|x| x.to_le_bytes()).collect()
    }

    #[test]
    fn reads_a_dual_illuminant_profile() {
        let cm_a = [1.4496, -0.8028, 0.0682, -0.465, 1.2681, 0.2185, -0.021, 0.0781, 0.8334];
        let cm_d65 = [1.3705, -0.6004, -0.14, -0.5464, 1.3568, 0.2062, -0.094, 0.1706, 0.7618];
        let fm = [0.7, 0.2, 0.05, 0.3, 0.6, 0.1, 0.0, 0.1, 0.7];
        // A 3x2x1 hue/sat map without its saturation-0 column, and a tone curve.
        let hs1: Vec<f32> = (0..3).flat_map(|h| [h as f32, 1.1, 0.9]).collect();
        let hs2: Vec<f32> = (0..3).flat_map(|h| [-(h as f32), 1.2, 1.0]).collect();
        let b = dcp(&[
            (50708, 2, b"Nikon Z 7_2\0".to_vec(), 12),
            // Illuminant 1 is D65 and 2 is A: they come out warmer first.
            (50721, 10, srat(&cm_d65), 9),
            (50722, 10, srat(&cm_a), 9),
            (50778, 3, 21u16.to_le_bytes().to_vec(), 1),
            (50779, 3, 17u16.to_le_bytes().to_vec(), 1),
            (50936, 2, b"Adobe Standard\0".to_vec(), 15),
            (50937, 4, [3u32, 2, 1].iter().flat_map(|x| x.to_le_bytes()).collect(), 3),
            (50938, 11, floats(&hs1), 9),
            (50939, 11, floats(&hs2), 9),
            (50940, 11, floats(&[0.0, 0.0, 0.5, 0.6, 1.0, 1.0]), 6),
            (50964, 10, srat(&fm), 9),
            (51109, 10, srat(&[-0.25]), 1),
        ]);
        let d = parse_dcp(&b).unwrap();
        assert_eq!(d.name, "Adobe Standard");
        assert_eq!(d.camera, "Nikon Z 7_2");
        assert_eq!(d.illuminants.len(), 2);
        assert_eq!(d.illuminants[0].temp, 2850.0);
        assert_eq!(d.illuminants[1].temp, 6500.0);
        assert!((d.illuminants[0].color[0] - 1.4496).abs() < 1e-9);
        assert!(d.illuminants[0].forward.is_none());
        assert!((d.illuminants[1].forward.unwrap()[0] - 0.7).abs() < 1e-9);
        let hs = d.illuminants[1].hue_sat.as_ref().unwrap();
        assert_eq!(hs.dims, [3, 2, 1]);
        assert_eq!(hs.data, vec![0.0, 1.0, 1.0, 0.0, 1.1, 0.9, 0.0, 1.0, 1.0, 1.0, 1.1, 0.9, 0.0, 1.0, 1.0, 2.0, 1.1, 0.9]);
        assert_eq!(d.illuminants[0].hue_sat.as_ref().unwrap().data[16], 1.2);
        assert_eq!(d.tone.as_deref(), Some(&[0.0, 0.0, 0.5, 0.6, 1.0, 1.0][..]));
        assert!((d.exposure_offset + 0.25).abs() < 1e-9);
        assert!(d.look.is_none());
    }

    #[test]
    fn camera_names_match_adobes() {
        let n = camera_names("Nikon", "Z 7 2", "NIKON Z 7_2");
        assert!(n.contains(&norm("Nikon Z 7_2")));
        let n = camera_names("Sony", "ILCE-7M4", "ILCE-7M4");
        assert!(n.contains(&norm("Sony ILCE-7M4")));
        let n = camera_names("Canon", "EOS R5", "Canon EOS R5");
        assert!(n.contains(&norm("Canon EOS R5")));
    }

    /// The inverse of decode_table, as dng_big_table encodes.
    fn encode_table(bin: &[u8]) -> String {
        use std::io::Write;
        let mut z = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        z.write_all(bin).unwrap();
        let mut data = (bin.len() as u32).to_le_bytes().to_vec();
        data.extend(z.finish().unwrap());
        const E: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?`'|()[]{}@%$#";
        let mut s = String::new();
        for chunk in data.chunks(4) {
            let mut v = [0u8; 4];
            v[..chunk.len()].copy_from_slice(chunk);
            let mut x = u32::from_le_bytes(v) as u64;
            for _ in 0..chunk.len() + 1 {
                s.push(E[(x % 85) as usize] as char);
                x /= 85;
            }
        }
        s
    }

    #[test]
    fn reads_a_look_from_a_sidecar() {
        // A 2x2x1 look table, sRGB encoded.
        let mut bin: Vec<u8> = [0u32, 1, 2, 2, 1].iter().flat_map(|x| x.to_le_bytes()).collect();
        for v in [0.0f32, 1.0, 1.0, 5.0, 1.2, 1.0, 0.0, 1.0, 1.0, -5.0, 0.8, 1.0] {
            bin.extend(v.to_le_bytes());
        }
        bin.extend(1u32.to_le_bytes());
        let enc = encode_table(&bin);
        assert_eq!(decode_table(&enc).unwrap(), bin);
        let xmp = format!(
            r#"<rdf:Description crs:Table_ABC="{enc}" crs:CameraProfile="Adobe Standard">
   <crs:Look><rdf:Description crs:Name="Adobe Color" crs:Amount="1"><crs:Parameters><rdf:Description crs:LookTable="ABC">
   <crs:ToneCurvePV2012><rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>22, 16</rdf:li><rdf:li>255, 255</rdf:li></rdf:Seq></crs:ToneCurvePV2012>
   </rdf:Description></crs:Parameters></rdf:Description></crs:Look>
   <crs:ToneCurvePV2012><rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>97, 21</rdf:li><rdf:li>255, 255</rdf:li></rdf:Seq></crs:ToneCurvePV2012>"#
        );
        let l = look_from_xmp(&xmp, "Adobe Color").unwrap();
        let t = l.table.unwrap();
        assert_eq!(t.dims, [2, 2, 1]);
        assert!(t.srgb);
        assert_eq!(t.data[3], 5.0);
        assert_eq!(l.curve, vec![[0.0, 0.0], [22.0, 16.0], [255.0, 255.0]]);
        assert!(look_from_xmp(&xmp, "Adobe Vivid").is_none());
    }

    #[test]
    fn a_sidecars_look_is_set_aside_and_put_back() {
        let xmp = "<x:xmpmeta><rdf:RDF><rdf:Description crs:Exposure2012=\"0\">\n   <crs:ToneCurvePV2012><rdf:Seq><rdf:li>0, 0</rdf:li></rdf:Seq></crs:ToneCurvePV2012>\n   <crs:Look>\n    <rdf:Description crs:Name=\"Adobe Color\"><crs:Parameters><rdf:Description crs:CameraProfile=\"Adobe Standard\"/></crs:Parameters></rdf:Description>\n   </crs:Look>\n  </rdf:Description>\n </rdf:RDF></x:xmpmeta>";
        let (rest, look) = split_look(xmp);
        let look = look.unwrap();
        assert!(!rest.contains("Look") && !rest.contains("CameraProfile"));
        assert!(rest.contains("ToneCurvePV2012"));
        assert_eq!(look_name(&look).as_deref(), Some("Adobe Color"));
        assert_eq!(put_look(&rest, &look), xmp);
        let alt = "<crs:Look><rdf:Description><crs:Name><rdf:Alt><rdf:li xml:lang=\"x-default\">Adobe Color</rdf:li></rdf:Alt></crs:Name></rdf:Description></crs:Look>";
        assert_eq!(look_name(alt).as_deref(), Some("Adobe Color"));
        assert_eq!(split_look("<rdf:Description/>"), ("<rdf:Description/>".to_string(), None));
    }

    #[test]
    fn finds_a_profile_in_a_camera_raw_folder() {
        let dir = std::env::temp_dir().join(format!("fr-adobe-{}", std::process::id()));
        let sub = dir.join("CameraProfiles").join("Adobe Standard");
        std::fs::create_dir_all(&sub).unwrap();
        let cm = [1.37, -0.6, -0.14, -0.55, 1.36, 0.21, -0.09, 0.17, 0.76];
        let make = |cam: &str, name: &str| {
            dcp(&[
                (50708, 2, format!("{cam}\0").into_bytes(), cam.len() as u32 + 1),
                (50721, 10, srat(&cm), 9),
                (50778, 3, 21u16.to_le_bytes().to_vec(), 1),
                (50936, 2, format!("{name}\0").into_bytes(), name.len() as u32 + 1),
            ])
        };
        std::fs::write(sub.join("Nikon Z 7 Adobe Standard.dcp"), make("Nikon Z 7", "Adobe Standard")).unwrap();
        std::fs::write(sub.join("Nikon Z 7_2 Adobe Standard.dcp"), make("Nikon Z 7_2", "Adobe Standard")).unwrap();
        let cams = camera_names("Nikon", "Z 7 2", "NIKON Z 7_2");
        let d = find_profile(&[dir.clone()], &cams, "Adobe Standard").unwrap();
        assert_eq!(d.camera, "Nikon Z 7_2");
        assert_eq!(d.illuminants[0].temp, 5000.0);
        assert!(find_profile(&[dir.clone()], &cams, "Camera Standard").is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
