// Develop tab: decodes the full RAW file and hands the window linear camera
// colours to edit on the graphics card. Nothing is ever written to the RAW file:
// edits are saved as Lightroom-style develop settings (crs:) in the photo's .xmp
// sidecar, next to its star rating.
//
// gcimg://localhost/develop/image?p=<file>&edge=<px>
//     The whole photo, at most `edge` pixels on its long side. Each 2x2 block of
//     sensor pixels becomes one RGB pixel (no demosaicing guesswork), then the
//     result is averaged down to size. Cached for the last few photos.
// gcimg://localhost/develop/region?p=<file>&x&y&w&h[&ow&oh]
//     Part of the photo at full resolution (demosaiced with Malvar-He-Cutler),
//     optionally averaged down to ow x oh. Used when zoomed in and for export.
//
// Both take &dn=<0-100>: how much of the photo's AI Denoise result to blend in
// (once it has been worked out with develop_denoise).
//
// Both answer with a 16-byte header ("FRIM", width, height, 3) followed by
// half-float RGB in sensor orientation, black = 0 and sensor white = 1.

use crate::photolib as lib;
use crate::photos::{self, edit_sidecar, respond, HttpResponse, Photos};
use half::f16;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

pub struct Raw {
    path: PathBuf,
    key: String,
    data: Vec<u16>,
    stride: usize,
    ox: usize,
    oy: usize,
    pub w: usize,
    pub h: usize,
    /// Colour (0 R, 1 G, 2 B) at [row % 2][col % 2] of the cropped image.
    cfa: [[u8; 2]; 2],
    black: [[f32; 2]; 2],
    scale: [[f32; 2]; 2],
    wb: [f32; 3],
    matrices: Vec<(f32, [f32; 9])>,
    make: String,
    model: String,
}

fn illuminant_temp(name: &str) -> Option<f32> {
    Some(match name {
        "A" | "Tungsten" | "IsoStudioTungsten" => 2856.0,
        "B" => 4874.0,
        "C" => 6774.0,
        "D50" => 5003.0,
        "D55" | "Daylight" | "FineWeather" | "Flash" => 5503.0,
        "D65" | "CloudyWeather" => 6504.0,
        "D75" | "Shade" => 7504.0,
        "Fluorescent" | "CoolWhiteFluorescent" => 4230.0,
        "WhiteFluorescent" => 3450.0,
        "DaylightFluorescent" => 6430.0,
        "DaylightWhiteFluorescent" => 5050.0,
        _ => return None,
    })
}

impl Raw {
    pub fn decode(path: &Path, key: String) -> Result<Raw, String> {
        let raw = rawler::decode_file(path).map_err(|e| format!("Couldn't read the RAW data: {e}"))?;
        if raw.cpp != 1 || raw.camera.cfa.width != 2 || raw.camera.cfa.height != 2 || !raw.camera.cfa.is_rgb() {
            return Err(format!("{} {} files can't be developed yet (only standard Bayer sensors)", raw.clean_make, raw.clean_model));
        }
        let data = match raw.data {
            rawler::RawImageData::Integer(v) => v,
            rawler::RawImageData::Float(_) => return Err("This RAW format can't be developed yet".into()),
        };
        let crop = raw.crop_area.or(raw.active_area);
        let (ox, oy, w, h) = match crop {
            Some(r) => (r.p.x, r.p.y, r.d.w, r.d.h),
            None => (0, 0, raw.width, raw.height),
        };
        let mut cfa = [[0u8; 2]; 2];
        for (r, row) in cfa.iter_mut().enumerate() {
            for (c, v) in row.iter_mut().enumerate() {
                *v = raw.camera.cfa.color_at(r + oy, c + ox) as u8;
            }
        }
        // Black levels repeat in a small pattern over the full sensor image.
        let bl = &raw.blacklevel;
        let blv = bl.as_vec();
        let white = raw.whitelevel.0.first().copied().unwrap_or(65535) as f32;
        let mut black = [[0f32; 2]; 2];
        let mut scale = [[1f32; 2]; 2];
        for r in 0..2 {
            for c in 0..2 {
                let b = if blv.is_empty() {
                    0.0
                } else {
                    let (bw, bh) = (bl.width.max(1), bl.height.max(1));
                    blv[((r + oy) % bh) * bw + (c + ox) % bw]
                };
                black[r][c] = b;
                scale[r][c] = 1.0 / (white - b).max(1.0);
            }
        }
        let wb = if raw.wb_coeffs[0].is_finite() && raw.wb_coeffs[0] > 0.0 && raw.wb_coeffs[1] > 0.0 {
            let g = raw.wb_coeffs[1];
            [raw.wb_coeffs[0] / g, 1.0, raw.wb_coeffs[2] / g]
        } else {
            [2.0, 1.0, 1.5]
        };
        let mut matrices: Vec<(f32, [f32; 9])> = raw
            .color_matrix
            .iter()
            .filter(|(_, m)| m.len() >= 9)
            .filter_map(|(ill, m)| {
                let t = illuminant_temp(&format!("{ill:?}"))?;
                let mut a = [0f32; 9];
                a.copy_from_slice(&m[..9]);
                Some((t, a))
            })
            .collect();
        matrices.sort_by(|a, b| a.0.total_cmp(&b.0));
        Ok(Raw {
            path: path.to_path_buf(),
            key,
            data,
            stride: raw.width,
            ox,
            oy,
            w,
            h,
            cfa,
            black,
            scale,
            wb,
            matrices,
            make: raw.clean_make,
            model: raw.clean_model,
        })
    }

    /// Normalized sensor value at (x, y) of the cropped image, mirrored at the edges.
    #[inline]
    fn at(&self, x: isize, y: isize) -> f32 {
        let x = mirror(x, self.w);
        let y = mirror(y, self.h);
        let v = self.data[(y + self.oy) * self.stride + x + self.ox] as f32;
        ((v - self.black[y & 1][x & 1]) * self.scale[y & 1][x & 1]).max(-0.02)
    }

    #[inline]
    fn color(&self, x: usize, y: usize) -> u8 {
        self.cfa[y & 1][x & 1]
    }

    /// One RGB value per 2x2 sensor block (top-left at 2bx, 2by).
    #[inline]
    fn binned(&self, bx: usize, by: usize) -> [f32; 3] {
        let mut out = [0f32; 3];
        let mut n = [0f32; 3];
        for dy in 0..2 {
            for dx in 0..2 {
                let (x, y) = (2 * bx + dx, 2 * by + dy);
                let c = self.color(x, y) as usize;
                out[c] += self.at(x as isize, y as isize);
                n[c] += 1.0;
            }
        }
        [out[0] / n[0].max(1.0), out[1] / n[1].max(1.0), out[2] / n[2].max(1.0)]
    }

    /// The whole photo with its long side at most `edge` pixels.
    pub fn overview(&self, edge: usize, dn: Option<(&[u16], f32)>) -> (usize, usize, Vec<u16>) {
        let (bw, bh) = (self.w / 2, self.h / 2);
        let s = (edge as f64 / bw.max(bh) as f64).min(1.0);
        let dw = ((bw as f64 * s).round() as usize).max(1);
        let dh = ((bh as f64 * s).round() as usize).max(1);
        let xw = weights(bw, dw);
        let yw = weights(bh, dh);
        let mut out = vec![0u16; dw * dh * 3];
        out.par_chunks_mut(dw * 3).enumerate().for_each(|(oy, row)| {
            let mut acc = vec![0f32; dw * 3];
            let mut line = vec![[0f32; 3]; bw];
            for &(by, wy) in &yw[oy] {
                for (bx, px) in line.iter_mut().enumerate() {
                    *px = match dn {
                        Some((d, amt)) => mix(self.binned(bx, by), dn_block(d, self.w, bx, by), amt),
                        None => self.binned(bx, by),
                    };
                }
                for (ox, taps) in xw.iter().enumerate() {
                    for &(bx, wx) in taps {
                        let w = wx * wy;
                        let p = line[bx];
                        acc[ox * 3] += p[0] * w;
                        acc[ox * 3 + 1] += p[1] * w;
                        acc[ox * 3 + 2] += p[2] * w;
                    }
                }
            }
            for (o, a) in row.iter_mut().zip(acc) {
                *o = f16::from_f32(a).to_bits();
            }
        });
        (dw, dh, out)
    }

    /// Full-resolution RGB of a region (Malvar-He-Cutler demosaicing).
    pub fn demosaic(&self, x0: usize, y0: usize, w: usize, h: usize, dn: Option<(&[u16], f32)>) -> Vec<f32> {
        let mut out = vec![0f32; w * h * 3];
        out.par_chunks_mut(w * 3).enumerate().for_each(|(ry, row)| {
            let y = y0 + ry;
            for rx in 0..w {
                let x = x0 + rx;
                let mut px = self.mhc(x as isize, y as isize);
                if let Some((d, amt)) = dn {
                    px = mix(px, dn_at(d, (y * self.w + x) * 3), amt);
                }
                row[rx * 3..rx * 3 + 3].copy_from_slice(&px);
            }
        });
        out
    }

    #[inline]
    fn mhc(&self, x: isize, y: isize) -> [f32; 3] {
        let f = |dx: isize, dy: isize| self.at(x + dx, y + dy);
        let c = f(0, 0);
        let col = self.color(mirror(x, self.w), mirror(y, self.h));
        let cross = f(0, -1) + f(0, 1) + f(-1, 0) + f(1, 0);
        let far = f(0, -2) + f(0, 2) + f(-2, 0) + f(2, 0);
        let diag = f(-1, -1) + f(1, -1) + f(-1, 1) + f(1, 1);
        let mut px = [0f32; 3];
        if col == 1 {
            // Green pixel: red and blue come from its row or column neighbours.
            let horiz = f(-1, 0) + f(1, 0);
            let vert = f(0, -1) + f(0, 1);
            let hfar = f(-2, 0) + f(2, 0);
            let vfar = f(0, -2) + f(0, 2);
            let along_row = (5.0 * c + 4.0 * horiz - hfar - diag + 0.5 * vfar) / 8.0;
            let along_col = (5.0 * c + 4.0 * vert - vfar - diag + 0.5 * hfar) / 8.0;
            let row_color = self.color(mirror(x + 1, self.w), mirror(y, self.h));
            px[1] = c;
            if row_color == 0 {
                px[0] = along_row;
                px[2] = along_col;
            } else {
                px[2] = along_row;
                px[0] = along_col;
            }
        } else {
            let g = (4.0 * c + 2.0 * cross - far) / 8.0;
            let other = (6.0 * c + 2.0 * diag - 1.5 * far) / 8.0;
            px[1] = g;
            px[col as usize] = c;
            px[2 - col as usize] = other;
        }
        px
    }
}

#[inline]
fn dn_at(d: &[u16], k: usize) -> [f32; 3] {
    [f16::from_bits(d[k]).to_f32(), f16::from_bits(d[k + 1]).to_f32(), f16::from_bits(d[k + 2]).to_f32()]
}

/// The denoised photo averaged over the 2x2 block that `Raw::binned` reads.
#[inline]
fn dn_block(d: &[u16], w: usize, bx: usize, by: usize) -> [f32; 3] {
    let mut o = [0f32; 3];
    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
        let p = dn_at(d, ((2 * by + dy) * w + 2 * bx + dx) * 3);
        for c in 0..3 {
            o[c] += p[c] * 0.25;
        }
    }
    o
}

#[inline]
fn mix(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

#[inline]
fn mirror(v: isize, n: usize) -> usize {
    let n = n as isize;
    let mut v = v;
    if v < 0 {
        v = -v;
    }
    if v >= n {
        v = 2 * (n - 1) - v;
    }
    v.clamp(0, n - 1) as usize
}

/// Area-averaging weights: for each of `dst` output pixels, the source pixels it
/// covers and how much of each.
fn weights(src: usize, dst: usize) -> Vec<Vec<(usize, f32)>> {
    let s = src as f64 / dst as f64;
    (0..dst)
        .map(|i| {
            let (a, b) = (i as f64 * s, (i as f64 + 1.0) * s);
            let mut taps = Vec::new();
            let mut j = a.floor() as usize;
            while (j as f64) < b && j < src {
                let cover = (b.min(j as f64 + 1.0) - a.max(j as f64)) / s;
                if cover > 1e-6 {
                    taps.push((j, cover as f32));
                }
                j += 1;
            }
            taps
        })
        .collect()
}

/// Averages an RGB f32 image down to dw x dh.
pub fn shrink(src: &[f32], sw: usize, sh: usize, dw: usize, dh: usize) -> Vec<f32> {
    let xw = weights(sw, dw);
    let yw = weights(sh, dh);
    let mut out = vec![0f32; dw * dh * 3];
    out.par_chunks_mut(dw * 3).enumerate().for_each(|(oy, row)| {
        for &(sy, wy) in &yw[oy] {
            let line = &src[sy * sw * 3..(sy + 1) * sw * 3];
            for (ox, taps) in xw.iter().enumerate() {
                for &(sx, wx) in taps {
                    let w = wx * wy;
                    row[ox * 3] += line[sx * 3] * w;
                    row[ox * 3 + 1] += line[sx * 3 + 1] * w;
                    row[ox * 3 + 2] += line[sx * 3 + 2] * w;
                }
            }
        }
    });
    out
}

fn frame(w: usize, h: usize, data: impl IntoIterator<Item = u16>, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(16 + len * 2);
    out.extend_from_slice(b"FRIM");
    out.extend_from_slice(&(w as u32).to_le_bytes());
    out.extend_from_slice(&(h as u32).to_le_bytes());
    out.extend_from_slice(&3u32.to_le_bytes());
    for v in data {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

// --- state ------------------------------------------------------------------

const OVERVIEWS_KEPT: usize = 2; // this photo and the next, decoded ahead

#[derive(Default)]
pub struct Develop {
    /// The RAW data of the photo being developed (only one: about 90 MB for 45 MP).
    current: Mutex<Option<Arc<Raw>>>,
    /// One decode at a time, so looking ahead never slows down the photo on screen.
    decoding: Mutex<()>,
    overviews: Mutex<VecDeque<(PathBuf, String, usize, Arc<Vec<u8>>)>>,
    exports: Mutex<HashMap<String, Export>>,
    /// The AI Denoise result of the photo being developed (cache file key, half floats).
    denoised: Mutex<Option<(String, Arc<Vec<u16>>)>>,
    cancel_denoise: AtomicBool,
}

impl Develop {
    /// The decoded RAW for `p`. With `keep`, it becomes the photo kept in memory.
    fn raw(&self, p: &Path, keep: bool) -> Result<Arc<Raw>, String> {
        let key = std::fs::metadata(p).map(|m| format!("{}:{:?}", m.len(), m.modified().ok())).map_err(|e| e.to_string())?;
        let hit = |cur: &Option<Arc<Raw>>| cur.as_ref().filter(|r| r.path == p && r.key == key).cloned();
        if let Some(r) = hit(&self.current.lock().unwrap()) {
            return Ok(r);
        }
        let _g = self.decoding.lock().unwrap();
        if let Some(r) = hit(&self.current.lock().unwrap()) {
            return Ok(r);
        }
        let raw = Arc::new(Raw::decode(p, key)?);
        if keep {
            *self.current.lock().unwrap() = Some(raw.clone());
        }
        Ok(raw)
    }

    fn overview(&self, app: &AppHandle, p: &Path, edge: usize, keep: bool, dn: usize) -> Result<Arc<Vec<u8>>, String> {
        let key = std::fs::metadata(p).map(|m| format!("{}:{:?}:{dn}", m.len(), m.modified().ok())).map_err(|e| e.to_string())?;
        if let Some(hit) = self.overviews.lock().unwrap().iter().find(|o| o.0 == p && o.1 == key && o.2 == edge) {
            return Ok(hit.3.clone());
        }
        let raw = self.raw(p, keep)?;
        let d = if dn > 0 { self.denoised(app, &raw) } else { None };
        let (w, h, data) = raw.overview(edge, d.as_deref().map(|d| (d.as_slice(), dn as f32 / 100.0)));
        let bytes = Arc::new(frame(w, h, data, w * h * 3));
        let mut ov = self.overviews.lock().unwrap();
        ov.retain(|o| o.0 != p);
        ov.push_front((p.to_path_buf(), key, edge, bytes.clone()));
        ov.truncate(OVERVIEWS_KEPT);
        Ok(bytes)
    }

    /// The photo's AI Denoise result, if it has been worked out.
    fn denoised(&self, app: &AppHandle, raw: &Raw) -> Option<Arc<Vec<u16>>> {
        let path = denoise_file(app, raw);
        let name = path.to_string_lossy().to_string();
        let mut cur = self.denoised.lock().unwrap();
        if let Some((k, d)) = cur.as_ref() {
            if *k == name {
                return Some(d.clone());
            }
        }
        let bytes = std::fs::read(&path).ok()?;
        if bytes.len() != 8 + raw.w * raw.h * 6 || bytes[..8] != [&(raw.w as u32).to_le_bytes()[..], &(raw.h as u32).to_le_bytes()[..]].concat() {
            return None;
        }
        let d = Arc::new(bytes[8..].chunks_exact(2).map(|b| u16::from_le_bytes([b[0], b[1]])).collect::<Vec<u16>>());
        *cur = Some((name, d.clone()));
        Some(d)
    }

    /// Frees the RAW data and cached overviews (leaving the Develop tab).
    pub fn release(&self) {
        *self.current.lock().unwrap() = None;
        self.overviews.lock().unwrap().clear();
        *self.denoised.lock().unwrap() = None;
    }
}

fn num(q: &HashMap<String, String>, k: &str) -> Option<usize> {
    q.get(k).and_then(|v| v.parse::<f64>().ok()).map(|v| v.max(0.0) as usize)
}

pub fn handle(app: &AppHandle, kind: &str, q: &HashMap<String, String>) -> HttpResponse {
    let Some(p) = q.get("p").and_then(|p| app.state::<Photos>().allowed(p)) else { return respond(403, "text/plain", Vec::new()) };
    let dev = app.state::<Develop>();
    let fail = |e: String| respond(500, "text/plain", e.into_bytes());
    match kind {
        "image" => {
            let edge = num(q, "edge").unwrap_or(2560).clamp(64, 8192);
            let keep = q.get("ahead").is_none();
            match dev.overview(app, &p, edge, keep, num(q, "dn").unwrap_or(0).min(100)) {
                Ok(b) => respond(200, "application/octet-stream", b.as_ref().clone()),
                Err(e) => fail(e),
            }
        }
        "region" => {
            let raw = match dev.raw(&p, true) {
                Ok(r) => r,
                Err(e) => return fail(e),
            };
            let x = num(q, "x").unwrap_or(0).min(raw.w - 1);
            let y = num(q, "y").unwrap_or(0).min(raw.h - 1);
            let w = num(q, "w").unwrap_or(raw.w).clamp(1, raw.w - x);
            let h = num(q, "h").unwrap_or(raw.h).clamp(1, raw.h - y);
            if w * h > 40_000_000 {
                return fail("region too large".into());
            }
            let ow = num(q, "ow").unwrap_or(w).clamp(1, w);
            let oh = num(q, "oh").unwrap_or(h).clamp(1, h);
            let dn = num(q, "dn").unwrap_or(0).min(100);
            let d = if dn > 0 { dev.denoised(app, &raw) } else { None };
            let mut rgb = raw.demosaic(x, y, w, h, d.as_deref().map(|d| (d.as_slice(), dn as f32 / 100.0)));
            if ow != w || oh != h {
                rgb = shrink(&rgb, w, h, ow, oh);
            }
            let len = rgb.len();
            respond(200, "application/octet-stream", frame(ow, oh, rgb.into_iter().map(|v| f16::from_f32(v).to_bits()), len))
        }
        _ => photos::not_found(),
    }
}

// --- commands ---------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Opened {
    width: usize,
    height: usize,
    orientation: u32,
    as_shot: [f32; 3],
    /// XYZ -> camera matrices with the colour temperature they were measured at.
    matrices: Vec<(f32, [f32; 9])>,
    camera: String,
    #[serde(flatten)]
    saved: Saved,
    /// AI Denoise has been worked out for this photo.
    denoised: bool,
}

/// Decodes a RAW file for developing and reads its saved settings.
#[tauri::command]
pub async fn develop_open(app: AppHandle, id: String, sidecar: Option<String>) -> Result<Opened, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let photos = app.state::<Photos>();
        let p = photos.allowed(&id).ok_or("This photo's folder isn't open")?;
        let raw = app.state::<Develop>().raw(&p, true)?;
        let orientation = photos.info(&p).map(|(_, i)| i.orientation).unwrap_or(1);
        Ok(Opened {
            width: raw.w,
            height: raw.h,
            orientation,
            as_shot: raw.wb,
            matrices: raw.matrices.clone(),
            camera: format!("{} {}", raw.make, raw.model),
            saved: saved(&photos, sidecar),
            denoised: denoise_file(&app, &raw).exists(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Develop settings in a sidecar.
#[derive(Serialize, Default)]
pub struct Saved {
    /// crs: names without the prefix.
    settings: HashMap<String, String>,
    /// Point curves: ToneCurvePV2012 and its Red, Green and Blue versions.
    curves: HashMap<String, Vec<String>>,
    /// Flightroom's own values (fr: names), such as its masks.
    own: HashMap<String, String>,
}

fn saved(photos: &Photos, sidecar: Option<String>) -> Saved {
    let text = sidecar.and_then(|s| photos.allowed(&s)).and_then(|s| std::fs::read_to_string(s).ok());
    let doc = crate::xmp::Doc::new(text.as_deref().unwrap_or(""));
    Saved {
        settings: doc.all("crs"),
        curves: ["", "Red", "Green", "Blue"]
            .iter()
            .filter_map(|c| {
                let name = format!("ToneCurvePV2012{c}");
                doc.get_seq("crs", &name).map(|v| (name, v))
            })
            .collect(),
        own: doc.all("fr"),
    }
}

/// A photo's saved settings without decoding it (for pasting settings and presets onto it).
#[tauri::command]
pub fn develop_read(app: AppHandle, sidecar: Option<String>) -> Saved {
    saved(&app.state::<Photos>(), sidecar)
}

/// Frees memory when leaving the Develop tab.
#[tauri::command]
pub fn develop_close(app: AppHandle) {
    app.state::<Develop>().release();
}

// --- AI Denoise ------------------------------------------------------------------

const DENOISE_KEPT: usize = 12;

/// Where a photo's AI Denoise result is kept (about 6 bytes a pixel, so only the last few photos).
fn denoise_file(app: &AppHandle, raw: &Raw) -> PathBuf {
    use sha1::{Digest, Sha1};
    let mut h = Sha1::new();
    h.update(raw.path.to_string_lossy().as_bytes());
    h.update(raw.key.as_bytes());
    let dir = app.path().app_local_data_dir().unwrap_or_default().join("denoise");
    dir.join(format!("{}.frdn", hex::encode(h.finalize())))
}

#[derive(Serialize, Clone)]
struct DenoiseProgress {
    done: usize,
    total: usize,
}

/// Works out AI Denoise for a photo (reporting "ai:denoise" progress) and keeps the result.
#[tauri::command]
pub async fn develop_denoise(app: AppHandle, id: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = app.state::<Photos>().allowed(&id).ok_or("This photo's folder isn't open")?;
        let dev = app.state::<Develop>();
        let raw = dev.raw(&p, true)?;
        if dev.denoised(&app, &raw).is_some() {
            return Ok(true);
        }
        dev.cancel_denoise.store(false, Ordering::Relaxed);
        let ai = app.state::<crate::ai::Ai>();
        let out = crate::ai::denoise(&ai, (raw.w, raw.h), raw.wb, |x, y, w, h| raw.demosaic(x, y, w, h, None), &dev.cancel_denoise, |done, total| {
            let _ = app.emit("ai:denoise", DenoiseProgress { done, total });
        })?;
        let file = denoise_file(&app, &raw);
        let dir = file.parent().unwrap();
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let mut bytes = Vec::with_capacity(8 + out.len() * 2);
        bytes.extend((raw.w as u32).to_le_bytes());
        bytes.extend((raw.h as u32).to_le_bytes());
        for v in &out {
            bytes.extend(v.to_le_bytes());
        }
        let part = file.with_extension("part");
        std::fs::write(&part, bytes).map_err(|e| format!("Couldn't save the denoised photo: {e}"))?;
        std::fs::rename(&part, &file).map_err(|e| e.to_string())?;
        *dev.denoised.lock().unwrap() = Some((file.to_string_lossy().to_string(), Arc::new(out)));
        dev.overviews.lock().unwrap().clear();
        // Only the newest few results stay on disk.
        if let Ok(rd) = std::fs::read_dir(dir) {
            let mut files: Vec<_> = rd.flatten().filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path()))).collect();
            files.sort_by_key(|f| std::cmp::Reverse(f.0));
            for (_, f) in files.into_iter().skip(DENOISE_KEPT) {
                let _ = std::fs::remove_file(f);
            }
        }
        // The model takes a lot of memory; it loads again next time.
        ai.release();
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn develop_denoise_cancel(app: AppHandle) {
    app.state::<Develop>().cancel_denoise.store(true, Ordering::Relaxed);
}

#[derive(Deserialize)]
pub struct SaveArgs {
    sidecar: String,
    set: HashMap<String, String>,
    remove: Vec<String>,
    seqs: HashMap<String, Vec<String>>,
    /// Structured crs: properties (masks), as XML inside the element; empty removes it.
    #[serde(default)]
    xml: HashMap<String, String>,
    /// Flightroom's own values (fr: names); empty removes one.
    #[serde(default)]
    own: HashMap<String, String>,
}

/// Writes develop settings to the sidecar, keeping everything else in it.
#[tauri::command]
pub async fn develop_save(app: AppHandle, args: SaveArgs) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let sidecar = app.state::<Photos>().allowed(&args.sidecar).filter(|s| lib::ext_of(&s.to_string_lossy()) == ".xmp").ok_or("Invalid sidecar")?;
        edit_sidecar(&app, &sidecar, |old| {
            let base = old.filter(|t| t.contains("<rdf:Description")).unwrap_or_else(crate::xmp::empty);
            let mut doc = crate::xmp::Doc::new(&base);
            for name in &args.remove {
                doc.remove("crs", name);
            }
            let mut names: Vec<&String> = args.set.keys().collect();
            names.sort();
            for name in names {
                doc.set_attr("crs", name, &args.set[name], crate::xmp::CRS_NS);
            }
            for (name, items) in &args.seqs {
                doc.set_seq("crs", name, items, crate::xmp::CRS_NS);
            }
            for (name, inner) in &args.xml {
                doc.set_xml("crs", name, inner, crate::xmp::CRS_NS);
            }
            for (name, value) in &args.own {
                if value.is_empty() {
                    doc.remove("fr", name);
                } else {
                    doc.set_attr("fr", name, value, crate::xmp::FR_NS);
                }
            }
            doc.text
        })?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- export -----------------------------------------------------------------

pub struct Export {
    path: PathBuf,
    w: usize,
    h: usize,
    quality: u8,
    source: Option<PathBuf>,
    rgb: Vec<u8>,
}

#[derive(Deserialize)]
pub struct ExportArgs {
    job: String,
    /// Folder to save into, and the file name to use (made unique there).
    folder: String,
    name: String,
    width: usize,
    height: usize,
    quality: u8,
    source: Option<String>,
}

#[tauri::command]
pub fn export_begin(app: AppHandle, args: ExportArgs) -> Result<String, String> {
    if args.width == 0 || args.height == 0 || args.width > 65535 || args.height > 65535 {
        return Err("Invalid export size".into());
    }
    let folder = PathBuf::from(&args.folder);
    std::fs::create_dir_all(&folder).map_err(|e| format!("Couldn't create {}: {e}", folder.display()))?;
    let safe: String = args.name.chars().map(|c| if r#"<>:"/\|?*"#.contains(c) || c.is_control() { '_' } else { c }).collect();
    let base = lib::base_of(&safe).to_string();
    let mut path = folder.join(format!("{base}.jpg"));
    let mut n = 2;
    while path.exists() {
        path = folder.join(format!("{base}-{n}.jpg"));
        n += 1;
    }
    let source = args.source.and_then(|s| app.state::<Photos>().allowed(&s));
    let shown = path.to_string_lossy().to_string();
    app.state::<Develop>().exports.lock().unwrap().insert(
        args.job,
        Export { path, w: args.width, h: args.height, quality: args.quality.clamp(10, 100), source, rgb: vec![0; args.width * args.height * 3] },
    );
    Ok(shown)
}

/// A rendered tile: RGBA bytes, bottom row first (as WebGL reads them).
#[tauri::command]
pub fn export_tile(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("expected bytes".into()) };
    let h = request.headers();
    let get = |k: &str| h.get(k).and_then(|v| v.to_str().ok()).map(str::to_string).ok_or(format!("missing {k}"));
    let job = get("x-job")?;
    let n = |k: &str| -> Result<usize, String> { get(k)?.parse().map_err(|_| format!("bad {k}")) };
    let (x, y, w, th) = (n("x-x")?, n("x-y")?, n("x-w")?, n("x-h")?);
    let dev = app.state::<Develop>();
    let mut exports = dev.exports.lock().unwrap();
    let e = exports.get_mut(&job).ok_or("export was cancelled")?;
    if x + w > e.w || y + th > e.h || bytes.len() < w * th * 4 {
        return Err("tile out of range".into());
    }
    for row in 0..th {
        let src = &bytes[(th - 1 - row) * w * 4..(th - row) * w * 4];
        let dst = &mut e.rgb[((y + row) * e.w + x) * 3..((y + row) * e.w + x + w) * 3];
        for (d, s) in dst.chunks_exact_mut(3).zip(src.chunks_exact(4)) {
            d.copy_from_slice(&s[..3]);
        }
    }
    Ok(true)
}

/// Encodes the finished image as JPEG (with the camera's Exif) and saves it.
#[tauri::command]
pub async fn export_finish(app: AppHandle, job: String, cancel: Option<bool>) -> Result<String, String> {
    let e = app.state::<Develop>().exports.lock().unwrap().remove(&job).ok_or("export not found")?;
    if cancel == Some(true) {
        return Ok(String::new());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::with_capacity(e.w * e.h / 2);
        let mut enc = jpeg_encoder::Encoder::new(&mut out, e.quality);
        if e.quality >= 90 {
            enc.set_sampling_factor(jpeg_encoder::SamplingFactor::R_4_4_4);
        }
        if let Some(exif) = e.source.as_deref().and_then(camera_exif) {
            let _ = enc.add_app_segment(1, &exif);
        }
        enc.encode(&e.rgb, e.w as u16, e.h as u16, jpeg_encoder::ColorType::Rgb).map_err(|err| err.to_string())?;
        drop(e.rgb);
        photos::atomic_write(&e.path, &out).map_err(|err| err.to_string())?;
        Ok(e.path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The Exif block of the camera's own preview, marked upright (exports are
/// already rotated), so exports keep the camera, lens and exposure details.
fn camera_exif(p: &Path) -> Option<Vec<u8>> {
    let f = std::fs::File::open(p).ok()?;
    let info = lib::read_photo_info(&f, &lib::ext_of(&p.to_string_lossy()));
    let part = info.preview?;
    let head = lib::Source::get(&f, part.offset, (part.length.unwrap_or(256 * 1024) as usize).min(256 * 1024));
    let seg = lib::jpeg_segments(&head).into_iter().find(|s| lib::is_exif(&head, s))?;
    let mut exif = head[seg.data_start..seg.end].to_vec();
    set_orientation_upright(&mut exif[6..]);
    Some(exif)
}

fn set_orientation_upright(tiff: &mut [u8]) {
    if tiff.len() < 8 {
        return;
    }
    let le = &tiff[0..2] == b"II";
    let u16_at = |b: &[u8], o: usize| if le { u16::from_le_bytes([b[o], b[o + 1]]) } else { u16::from_be_bytes([b[o], b[o + 1]]) };
    let ifd = if le { u32::from_le_bytes([tiff[4], tiff[5], tiff[6], tiff[7]]) } else { u32::from_be_bytes([tiff[4], tiff[5], tiff[6], tiff[7]]) } as usize;
    if ifd + 2 > tiff.len() {
        return;
    }
    let n = u16_at(tiff, ifd) as usize;
    for i in 0..n {
        let e = ifd + 2 + i * 12;
        if e + 12 > tiff.len() {
            return;
        }
        if u16_at(tiff, e) == 0x112 {
            let one = if le { 1u16.to_le_bytes() } else { 1u16.to_be_bytes() };
            tiff[e + 8] = one[0];
            tiff[e + 9] = one[1];
        }
    }
}

/// Saves text the window made (settings backups) where the user chose.
#[tauri::command]
pub fn save_text_file(path: String, text: String) -> Result<bool, String> {
    photos::atomic_write(Path::new(&path), text.as_bytes()).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn area_weights_cover_each_source_pixel_once() {
        for (s, d) in [(10, 3), (4128, 2560), (7, 7), (5, 2)] {
            let w = weights(s, d);
            let mut total = vec![0f32; s];
            for taps in &w {
                let sum: f32 = taps.iter().map(|t| t.1).sum();
                assert!((sum - 1.0).abs() < 1e-4, "{s}->{d}: {sum}");
                for &(j, c) in taps {
                    total[j] += c;
                }
            }
            for t in total {
                assert!((t - d as f32 / s as f32).abs() < 1e-3);
            }
        }
    }

    #[test]
    fn mirror_stays_inside() {
        assert_eq!(mirror(-1, 10), 1);
        assert_eq!(mirror(-2, 10), 2);
        assert_eq!(mirror(10, 10), 8);
        assert_eq!(mirror(11, 10), 7);
        assert_eq!(mirror(5, 10), 5);
    }

    /// FLIGHTROOM_NEF=<file> cargo test --release -- --ignored --nocapture
    #[test]
    #[ignore]
    fn decodes_a_real_nef() {
        let p = std::env::var("FLIGHTROOM_NEF").expect("set FLIGHTROOM_NEF");
        let t = std::time::Instant::now();
        let raw = Raw::decode(Path::new(&p), String::new()).unwrap();
        println!("decode {:?} {}x{} cfa {:?} wb {:?} matrices {:?}", t.elapsed(), raw.w, raw.h, raw.cfa, raw.wb, raw.matrices.iter().map(|m| m.0).collect::<Vec<_>>());
        let t = std::time::Instant::now();
        let (w, h, data) = raw.overview(2560, None);
        println!("overview {:?} {w}x{h}", t.elapsed());
        assert_eq!(data.len(), w * h * 3);
        let t = std::time::Instant::now();
        let reg = raw.demosaic(1000, 1000, 2560, 1440, None);
        println!("region {:?}", t.elapsed());
        let mean: f32 = reg.iter().sum::<f32>() / reg.len() as f32;
        assert!(mean > 0.0 && mean < 1.0);
        if let Ok(out) = std::env::var("FLIGHTROOM_DUMP") {
            std::fs::write(&out, frame(w, h, data.iter().copied(), data.len())).unwrap();
            let info = serde_json::json!({ "width": raw.w, "height": raw.h, "orientation": 1, "asShot": raw.wb, "matrices": raw.matrices });
            std::fs::write(format!("{out}.json"), info.to_string()).unwrap();
            let reg = raw.demosaic(3000, 2000, 1200, 800, None);
            std::fs::write(format!("{out}.region"), frame(1200, 800, reg.iter().map(|v| f16::from_f32(*v).to_bits()), reg.len())).unwrap();
        }
    }

    /// FLIGHTROOM_NEF=<file> FLIGHTROOM_AI_TEST=<models> cargo test --release denoises -- --ignored --nocapture
    /// Writes <models>/dn-before and dn-after: a 768 x 512 crop as frames.
    #[test]
    #[ignore]
    fn denoises_a_real_nef() {
        let raw = Raw::decode(Path::new(&std::env::var("FLIGHTROOM_NEF").unwrap()), String::new()).unwrap();
        let dir = PathBuf::from(std::env::var("FLIGHTROOM_AI_TEST").unwrap());
        let ai = crate::ai::Ai::new(dir.clone());
        let (cx, cy, w, h) = (raw.w / 2 - 384, raw.h / 2 - 256, 768, 512);
        let t = std::time::Instant::now();
        let out = crate::ai::denoise(&ai, (w, h), raw.wb, |x, y, tw, th| raw.demosaic(cx + x, cy + y, tw, th, None), &AtomicBool::new(false), |_, _| {}).unwrap();
        println!("denoise {w}x{h} in {:?}", t.elapsed());
        let before = raw.demosaic(cx, cy, w, h, None);
        std::fs::write(dir.join("dn-before"), frame(w, h, before.iter().map(|v| f16::from_f32(*v).to_bits()), before.len())).unwrap();
        std::fs::write(dir.join("dn-after"), frame(w, h, out.iter().copied(), out.len())).unwrap();
    }
}
