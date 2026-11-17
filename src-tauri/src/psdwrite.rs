// Writes Retouch's work as a Photoshop document Photoshop opens with its layers:
// pixel layers (what each layer draws, rendered by the window), groups, layer
// masks, blend modes, opacity, fill, clipping, visibility, layer styles (as
// Photoshop's own effects) and the adjustment layers Photoshop has (as its
// own, live), Solid Color fills, the patterns its Pattern Overlays use, and
// the flattened picture. Flightroom's own layers (strokes, live text...) go in
// beside them (image resource 7000), with the pictures they draw from (7001),
// so Flightroom opens it again as it was; a fingerprint of the layer records
// tells when Photoshop has changed the file since, and then Photoshop's layers
// are read instead.
use crate::psd::Doc;
use serde::Deserialize;
use serde_json::{json, Value};

pub const STATE_ID: u16 = 7000;
pub const ASSETS_ID: u16 = 7001;

// --- small writers -----------------------------------------------------------------

#[derive(Default)]
pub struct W(pub Vec<u8>);

impl W {
    fn u8(&mut self, v: u8) { self.0.push(v); }
    fn u16(&mut self, v: u16) { self.0.extend(v.to_be_bytes()); }
    fn i16(&mut self, v: i16) { self.0.extend(v.to_be_bytes()); }
    fn u32(&mut self, v: u32) { self.0.extend(v.to_be_bytes()); }
    fn i32(&mut self, v: i32) { self.0.extend(v.to_be_bytes()); }
    fn f32(&mut self, v: f32) { self.0.extend(v.to_be_bytes()); }
    fn f64(&mut self, v: f64) { self.0.extend(v.to_be_bytes()); }
    fn bytes(&mut self, b: &[u8]) { self.0.extend_from_slice(b); }
    fn unicode(&mut self, s: &str) {
        let u: Vec<u16> = s.encode_utf16().collect();
        self.u32(u.len() as u32 + 1);
        for c in u {
            self.u16(c);
        }
        self.u16(0);
    }
    /// A descriptor key or class: four characters as they are, else with its length.
    fn id(&mut self, s: &str) {
        if s.len() == 4 {
            self.u32(0);
        } else {
            self.u32(s.len() as u32);
        }
        self.bytes(s.as_bytes());
    }
    /// A tagged block ('8BIM', key, length, data padded to `pad`).
    fn block(&mut self, key: &[u8; 4], data: &[u8], pad: usize) {
        self.bytes(b"8BIM");
        self.bytes(key);
        let n = data.len().div_ceil(pad) * pad;
        self.u32(n as u32);
        self.bytes(data);
        self.0.resize(self.0.len() + n - data.len(), 0);
    }
}

/// A descriptor's value.
pub enum D {
    Long(i32),
    Doub(f64),
    Unit(&'static str, f64),
    Bool(bool),
    Enum(&'static str, String),
    Text(String),
    Obj(&'static str, Vec<(&'static str, D)>),
    List(Vec<D>),
}

fn put_desc(w: &mut W, class: &str, items: &[(&str, D)]) {
    w.unicode("");
    w.id(class);
    w.u32(items.len() as u32);
    for (k, v) in items {
        w.id(k);
        put_item(w, v);
    }
}

fn put_item(w: &mut W, v: &D) {
    match v {
        D::Long(n) => {
            w.bytes(b"long");
            w.i32(*n);
        }
        D::Doub(f) => {
            w.bytes(b"doub");
            w.f64(*f);
        }
        D::Unit(u, f) => {
            w.bytes(b"UntF");
            w.bytes(u.as_bytes());
            w.f64(*f);
        }
        D::Bool(b) => {
            w.bytes(b"bool");
            w.u8(*b as u8);
        }
        D::Enum(t, v) => {
            w.bytes(b"enum");
            w.id(t);
            w.id(v);
        }
        D::Text(s) => {
            w.bytes(b"TEXT");
            w.unicode(s);
        }
        D::Obj(class, items) => {
            w.bytes(b"Objc");
            put_desc(w, class, items);
        }
        D::List(items) => {
            w.bytes(b"VlLs");
            w.u32(items.len() as u32);
            for i in items {
                put_item(w, i);
            }
        }
    }
}

/// A descriptor block: its version (16), then the descriptor.
fn desc_block(class: &str, items: Vec<(&'static str, D)>) -> Vec<u8> {
    let mut w = W::default();
    w.u32(16);
    put_desc(&mut w, class, &items);
    w.0
}

fn rgb(c: &Value) -> D {
    let f = |i: usize| c.get(i).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) * 255.0;
    D::Obj("RGBC", vec![("Rd  ", D::Doub(f(0))), ("Grn ", D::Doub(f(1))), ("Bl  ", D::Doub(f(2)))])
}

/// Retouch's blend mode as a layer record's key.
pub fn blend_key(name: &str) -> &'static [u8; 4] {
    match name {
        "pass" => b"pass",
        "dissolve" => b"diss",
        "darken" => b"dark",
        "multiply" => b"mul ",
        "colorBurn" => b"idiv",
        "linearBurn" => b"lbrn",
        "darkerColor" => b"dkCl",
        "lighten" => b"lite",
        "screen" => b"scrn",
        "colorDodge" => b"div ",
        "linearDodge" => b"lddg",
        "lighterColor" => b"lgCl",
        "overlay" => b"over",
        "soft" => b"sLit",
        "hardLight" => b"hLit",
        "vividLight" => b"vLit",
        "linearLight" => b"lLit",
        "pinLight" => b"pLit",
        "hardMix" => b"hMix",
        "difference" => b"diff",
        "exclusion" => b"smud",
        "subtract" => b"fsub",
        "divide" => b"fdiv",
        "hue" => b"hue ",
        "saturation" => b"sat ",
        "color" => b"colr",
        "luminosity" => b"lum ",
        _ => b"norm",
    }
}

/// The same as a layer style's blend mode (BlnM enum).
fn style_mode(name: Option<&str>, def: &str) -> D {
    let v = match name.unwrap_or(def) {
        "dissolve" => "Dslv",
        "darken" => "Drkn",
        "multiply" => "Mltp",
        "colorBurn" => "CBrn",
        "linearBurn" => "linearBurn",
        "darkerColor" => "darkerColor",
        "lighten" => "Lghn",
        "screen" => "Scrn",
        "colorDodge" => "CDdg",
        "linearDodge" => "linearDodge",
        "lighterColor" => "lighterColor",
        "overlay" => "Ovrl",
        "soft" => "SftL",
        "hardLight" => "HrdL",
        "vividLight" => "vividLight",
        "linearLight" => "linearLight",
        "pinLight" => "pinLight",
        "hardMix" => "hardMix",
        "difference" => "Dfrn",
        "exclusion" => "Xclu",
        "subtract" => "blendSubtraction",
        "divide" => "blendDivide",
        "hue" => "H   ",
        "saturation" => "Strt",
        "color" => "Clr ",
        "luminosity" => "Lmns",
        _ => "Nrml",
    };
    D::Enum("BlnM", v.into())
}

fn linear_contour() -> D {
    let pt = |x: f64| D::Obj("CrPt", vec![("Hrzn", D::Doub(x)), ("Vrtc", D::Doub(x))]);
    D::Obj("ShpC", vec![("Nm  ", D::Text("Linear".into())), ("Crv ", D::List(vec![pt(0.0), pt(255.0)]))])
}

/// A pattern's id: the same picture always gets the same one.
pub fn pattern_id(src: &str) -> String {
    let h = fnv(src.as_bytes());
    format!("{:08x}-{:04x}-{:04x}-{:04x}-{:012x}", (h >> 32) as u32, (h >> 16) as u16, h as u16, (h >> 48) as u16, h & 0xffff_ffff_ffff)
}

pub fn fnv(b: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &c in b {
        h ^= c as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

/// Retouch's layer styles as Photoshop's effects (lfx2). `long`: the long edge in px.
pub fn effects(st: &Value, long: f64) -> Option<Vec<u8>> {
    let on = |k: &str| st.get(k).filter(|v| v.get("on").and_then(Value::as_bool) != Some(false));
    let n = |v: &Value, k: &str, def: f64| v.get(k).and_then(Value::as_f64).unwrap_or(def);
    let px = |v: &Value, k: &str| D::Unit("#Pxl", n(v, k, 0.0) * long);
    let pc = |v: &Value, k: &str, def: f64| D::Unit("#Prc", n(v, k, def));
    let ang = |v: &Value, k: &str, def: f64| D::Unit("#Ang", n(v, k, def));
    let col = |v: &Value, k: &str, def: [f64; 3]| rgb(v.get(k).unwrap_or(&json!(def)));
    let mode = |v: &Value, k: &str, def: &str| style_mode(v.get(k).and_then(Value::as_str), def);
    let base = |v: &Value| vec![("enab", D::Bool(true)), ("present", D::Bool(true)), ("showInDialog", D::Bool(true)), ("Opct", pc(v, "opacity", 100.0))];
    let mut items: Vec<(&'static str, D)> = vec![("Scl ", D::Unit("#Prc", 100.0)), ("masterFXSwitch", D::Bool(true))];
    if let Some(v) = on("shadow") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "multiply")), ("Clr ", col(v, "color", [0.0; 3])), ("uglg", D::Bool(false)), ("lagl", ang(v, "angle", 120.0)),
            ("Dstn", px(v, "distance")), ("Ckmt", D::Unit("#Prc", n(v, "spread", 0.0))), ("blur", px(v, "size")), ("Nose", D::Unit("#Prc", 0.0)),
            ("AntA", D::Bool(false)), ("TrnS", linear_contour()), ("layerConceals", D::Bool(true))]);
        items.push(("DrSh", D::Obj("DrSh", i)));
    }
    if let Some(v) = on("innerShadow") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "multiply")), ("Clr ", col(v, "color", [0.0; 3])), ("uglg", D::Bool(false)), ("lagl", ang(v, "angle", 120.0)),
            ("Dstn", px(v, "distance")), ("Ckmt", D::Unit("#Prc", n(v, "choke", 0.0))), ("blur", px(v, "size")), ("Nose", D::Unit("#Prc", 0.0)),
            ("AntA", D::Bool(false)), ("TrnS", linear_contour())]);
        items.push(("IrSh", D::Obj("IrSh", i)));
    }
    if let Some(v) = on("glow") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "screen")), ("Clr ", col(v, "color", [1.0, 1.0, 0.75])), ("GlwT", D::Enum("BETE", "SfBL".into())),
            ("Ckmt", D::Unit("#Prc", n(v, "spread", 0.0))), ("blur", px(v, "size")), ("Nose", D::Unit("#Prc", 0.0)), ("ShdN", D::Unit("#Prc", 0.0)),
            ("AntA", D::Bool(false)), ("TrnS", linear_contour()), ("Inpr", D::Unit("#Prc", 50.0))]);
        items.push(("OrGl", D::Obj("OrGl", i)));
    }
    if let Some(v) = on("innerGlow") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "screen")), ("Clr ", col(v, "color", [1.0, 1.0, 0.75])), ("GlwT", D::Enum("BETE", "SfBL".into())),
            ("Ckmt", D::Unit("#Prc", n(v, "choke", 0.0))), ("blur", px(v, "size")), ("ShdN", D::Unit("#Prc", 0.0)), ("Nose", D::Unit("#Prc", 0.0)),
            ("AntA", D::Bool(false)), ("glwS", D::Enum("IGSr", "SrcE".into())), ("TrnS", linear_contour()), ("Inpr", D::Unit("#Prc", 50.0))]);
        items.push(("IrGl", D::Obj("IrGl", i)));
    }
    if let Some(v) = on("bevel") {
        let style = match v.get("style").and_then(Value::as_str) {
            Some("outer") => "OtrB",
            Some("emboss") => "Embs",
            Some("pillow") => "PlEb",
            _ => "InrB",
        };
        let down = v.get("down").and_then(Value::as_bool).unwrap_or(false);
        items.push(("ebbl", D::Obj("ebbl", vec![
            ("enab", D::Bool(true)), ("present", D::Bool(true)), ("showInDialog", D::Bool(true)),
            ("hglM", mode(v, "hiBlend", "screen")), ("hglC", col(v, "hiColor", [1.0; 3])), ("hglO", pc(v, "hiOpacity", 75.0)),
            ("sdwM", mode(v, "loBlend", "multiply")), ("sdwC", col(v, "loColor", [0.0; 3])), ("sdwO", pc(v, "loOpacity", 75.0)),
            ("bvlT", D::Enum("bvlT", "SfBL".into())), ("bvlS", D::Enum("BESl", style.into())), ("uglg", D::Bool(false)), ("lagl", ang(v, "angle", 120.0)),
            ("Lald", ang(v, "altitude", 30.0)), ("srgR", pc(v, "depth", 100.0)), ("blur", px(v, "size")), ("bvlD", D::Enum("BESs", if down { "Out " } else { "In  " }.into())),
            ("TrnS", linear_contour()), ("antialiasGloss", D::Bool(false)), ("Sftn", px(v, "soften")), ("useShape", D::Bool(false)), ("useTexture", D::Bool(false)),
        ])));
    }
    if let Some(v) = on("satin") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "multiply")), ("Clr ", col(v, "color", [0.0; 3])), ("AntA", D::Bool(true)),
            ("Invr", D::Bool(v.get("invert").and_then(Value::as_bool).unwrap_or(true))), ("lagl", ang(v, "angle", 19.0)), ("Dstn", px(v, "distance")),
            ("blur", px(v, "size")), ("MpgS", linear_contour())]);
        items.push(("ChFX", D::Obj("ChFX", i)));
    }
    if let Some(v) = on("overlay") {
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "normal")), ("Clr ", col(v, "color", [1.0, 0.0, 0.0]))]);
        items.push(("SoFi", D::Obj("SoFi", i)));
    }
    if let Some(v) = on("gradient") {
        let stop = |c: &Value, at: i32| D::Obj("Clrt", vec![("Clr ", rgb(c)), ("Type", D::Enum("Clry", "UsrS".into())), ("Lctn", D::Long(at)), ("Mdpn", D::Long(50))]);
        let trns = |at: i32| D::Obj("TrnS", vec![("Opct", D::Unit("#Prc", 100.0)), ("Lctn", D::Long(at)), ("Mdpn", D::Long(50))]);
        let grad = D::Obj("Grdn", vec![
            ("Nm  ", D::Text("Custom".into())), ("GrdF", D::Enum("GrdF", "CstS".into())), ("Intr", D::Doub(4096.0)),
            ("Clrs", D::List(vec![stop(v.get("c0").unwrap_or(&json!([0, 0, 0])), 0), stop(v.get("c1").unwrap_or(&json!([1, 1, 1])), 4096)])),
            ("Trns", D::List(vec![trns(0), trns(4096)])),
        ]);
        let mut i = base(v);
        let radial = v.get("style").and_then(Value::as_str) == Some("radial");
        i.extend([("Md  ", mode(v, "blend", "normal")), ("Grad", grad), ("Angl", ang(v, "angle", 90.0)), ("Type", D::Enum("GrdT", if radial { "Rdl " } else { "Lnr " }.into())),
            ("Rvrs", D::Bool(v.get("reverse").and_then(Value::as_bool).unwrap_or(false))), ("Algn", D::Bool(true)), ("Scl ", D::Unit("#Prc", 100.0)),
            ("Ofst", D::Obj("Pnt ", vec![("Hrzn", D::Unit("#Prc", 0.0)), ("Vrtc", D::Unit("#Prc", 0.0))]))]);
        items.push(("GrFl", D::Obj("GrFl", i)));
    }
    if let Some(v) = on("pattern").filter(|v| v.get("src").and_then(Value::as_str).is_some()) {
        let src = v["src"].as_str().unwrap_or("");
        let mut i = base(v);
        i.extend([("Md  ", mode(v, "blend", "normal")),
            ("Ptrn", D::Obj("Ptrn", vec![("Nm  ", D::Text(v.get("name").and_then(Value::as_str).unwrap_or("Pattern").into())), ("Idnt", D::Text(pattern_id(src)))])),
            ("Scl ", pc(v, "scale", 100.0)), ("Algn", D::Bool(true)), ("phase", D::Obj("Pnt ", vec![("Hrzn", D::Doub(0.0)), ("Vrtc", D::Doub(0.0))]))]);
        items.push(("patternFill", D::Obj("patternFill", i)));
    }
    if on("stroke").is_some() {
        let v = &st["stroke"];
        let mut i = base(v);
        i.extend([("Styl", D::Enum("FStl", "OutF".into())), ("PntT", D::Enum("FrFl", "SClr".into())), ("Md  ", mode(v, "blend", "normal")),
            ("Sz  ", px(v, "size")), ("Clr ", col(v, "color", [1.0, 0.0, 0.0]))]);
        items.push(("FrFX", D::Obj("FrFX", i)));
    }
    if items.len() == 2 {
        return None;
    }
    let mut w = W::default();
    w.u32(0);
    w.u32(16);
    put_desc(&mut w, "null", &items);
    Some(w.0)
}

/// A picture as a pattern record (Patt block).
fn pattern_record(id: &str, name: &str, w: usize, h: usize, rgba: &[u8]) -> Vec<u8> {
    let mut p = W::default();
    p.u32(1);
    p.u32(3);
    p.u16(h as u16);
    p.u16(w as u16);
    p.unicode(name);
    p.u8(id.len() as u8);
    p.bytes(id.as_bytes());
    let mut v = W::default();
    for (i, rect) in [[0, 0, h as i32, w as i32]].iter().enumerate() {
        let _ = i;
        for r in rect {
            v.i32(*r);
        }
    }
    v.u32(3);
    for c in 0..3 {
        v.u32(1);
        v.u32((23 + w * h) as u32);
        v.u32(8);
        for r in [0, 0, h as i32, w as i32] {
            v.i32(r);
        }
        v.u16(8);
        v.u8(0);
        v.bytes(&rgba.chunks_exact(4).map(|px| px[c]).collect::<Vec<u8>>());
    }
    v.u32(0);
    v.u32(0);
    p.u32(3);
    p.u32(v.0.len() as u32);
    p.bytes(&v.0);
    let mut out = W::default();
    out.u32(p.0.len() as u32);
    out.bytes(&p.0);
    out.0.resize(out.0.len().div_ceil(4) * 4, 0);
    out.0
}

/// A data URL's picture as RGBA.
pub fn decode_data_url(src: &str) -> Option<(usize, usize, Vec<u8>)> {
    use base64::Engine;
    let b64 = src.split_once(";base64,")?.1;
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64).ok()?;
    let im = image::load_from_memory(&bytes).ok()?.to_rgba8();
    Some((im.width() as usize, im.height() as usize, im.into_raw()))
}

/// Retouch's adjustment as Photoshop's own adjustment block, when Photoshop has the same.
pub fn adjustment(a: &Value) -> Option<([u8; 4], Vec<u8>)> {
    let n = |k: &str, def: f64| a.get(k).and_then(Value::as_f64).unwrap_or(def);
    let arr = |v: Option<&Value>, i: usize, def: f64| v.and_then(|v| v.get(i)).and_then(Value::as_f64).unwrap_or(def);
    let mut w = W::default();
    let key: [u8; 4] = match a.get("type").and_then(Value::as_str)? {
        "brightness" => {
            return Some((*b"CgEd", desc_block("null", vec![
                ("Vrsn", D::Long(1)), ("Brgh", D::Long(n("brightness", 0.0).round() as i32)), ("Cntr", D::Long(n("contrast", 0.0).round() as i32)),
                ("means", D::Long(127)), ("Lab ", D::Bool(false)), ("useLegacy", D::Bool(false)), ("Auto", D::Bool(false)),
            ])));
        }
        "vibrance" => {
            return Some((*b"vibA", desc_block("null", vec![("vibrance", D::Long(n("vibrance", 0.0).round() as i32)), ("Strt", D::Long(n("saturation", 0.0).round() as i32))])));
        }
        "bw" => {
            let l = |k: &str, def: f64| D::Long(n(k, def).round() as i32);
            return Some((*b"blwh", desc_block("null", vec![
                ("Rd  ", l("reds", 40.0)), ("Yllw", l("yellows", 60.0)), ("Grn ", l("greens", 40.0)), ("Cyn ", l("cyans", 60.0)), ("Bl  ", l("blues", 20.0)),
                ("Mgnt", l("magentas", 80.0)), ("useTint", D::Bool(a.get("tint").and_then(Value::as_bool).unwrap_or(false))),
                ("tintColor", rgb(a.get("tintColor").unwrap_or(&json!([0.88, 0.78, 0.6])))), ("bwPresetKind", D::Long(1)), ("blackAndWhitePresetFileName", D::Text(String::new())),
            ])));
        }
        "levels" => {
            w.u16(2);
            for k in ["rgb", "r", "g", "b"] {
                let v = a.get(k);
                let g = |f: &str, def: f64| v.and_then(|v| v.get(f)).and_then(Value::as_f64).unwrap_or(def);
                for x in [g("in0", 0.0), g("in1", 255.0), g("out0", 0.0), g("out1", 255.0)] {
                    w.u16(x.round().clamp(0.0, 255.0) as u16);
                }
                w.u16((g("gamma", 1.0) * 100.0).round().clamp(10.0, 999.0) as u16);
            }
            for _ in 4..29 {
                for x in [0, 255, 0, 255, 100] {
                    w.u16(x);
                }
            }
            *b"levl"
        }
        "curves" => {
            let chans: Vec<(u32, Vec<[f64; 2]>)> = ["rgb", "r", "g", "b"].iter().enumerate().filter_map(|(i, k)| {
                let pts: Vec<[f64; 2]> = a.get(*k)?.as_array()?.iter().filter_map(|p| Some([p.get(0)?.as_f64()?, p.get(1)?.as_f64()?])).collect();
                let line = pts.len() == 2 && pts[0] == [0.0, 0.0] && pts[1] == [255.0, 255.0];
                (pts.len() >= 2 && !line).then_some((i as u32, pts))
            }).collect();
            w.u8(0);
            w.u16(1);
            w.u32(chans.iter().fold(0, |m, (i, _)| m | 1 << i));
            for (_, pts) in &chans {
                w.u16(pts.len() as u16);
                for p in pts {
                    w.u16(p[1].round().clamp(0.0, 255.0) as u16);
                    w.u16(p[0].round().clamp(0.0, 255.0) as u16);
                }
            }
            *b"curv"
        }
        "exposure" => {
            w.u16(1);
            w.f32(n("exposure", 0.0) as f32);
            w.f32(n("offset", 0.0) as f32);
            w.f32(n("gamma", 1.0) as f32);
            *b"expA"
        }
        "hsl" => {
            let colorize = a.get("colorize").and_then(Value::as_bool).unwrap_or(false);
            let (h, s, l) = (n("hue", 0.0).round() as i16, n("sat", 0.0).round() as i16, n("light", 0.0).round() as i16);
            w.u16(2);
            w.u8(colorize as u8);
            w.u8(0);
            if colorize {
                w.i16(if h < 0 { h + 360 } else { h });
                w.i16(s);
                w.i16(l);
                w.bytes(&[0; 6]);
            } else {
                w.i16(0);
                w.i16(25);
                w.i16(0);
                w.i16(h);
                w.i16(s);
                w.i16(l);
            }
            for r in [[315, 345, 15, 45], [15, 45, 75, 105], [75, 105, 135, 165], [135, 165, 195, 225], [195, 225, 255, 285], [255, 285, 315, 345]] {
                for v in r {
                    w.i16(v);
                }
                w.bytes(&[0; 6]);
            }
            *b"hue2"
        }
        "balance" => {
            for k in ["shadows", "mid", "highlights"] {
                for i in 0..3 {
                    w.i16(arr(a.get(k), i, 0.0).round() as i16);
                }
            }
            w.u8(a.get("preserve").and_then(Value::as_bool).unwrap_or(true) as u8);
            w.u8(0);
            *b"blnc"
        }
        "photo" => {
            w.u16(2);
            w.u16(0);
            for i in 0..3 {
                w.u16((arr(a.get("color"), i, 0.5).clamp(0.0, 1.0) * 65535.0).round() as u16);
            }
            w.u16(0);
            w.u32(n("density", 25.0).round() as u32);
            w.u8(a.get("preserve").and_then(Value::as_bool).unwrap_or(true) as u8);
            *b"phfl"
        }
        "mixer" => {
            let mono = a.get("mono").and_then(Value::as_bool).unwrap_or(false);
            w.u16(1);
            w.u16(mono as u16);
            let rows = a.get("rows");
            for k in ["r", "g", "b"] {
                let r = rows.and_then(|r| r.get(if mono { "r" } else { k }));
                for i in 0..3 {
                    w.i16(arr(r, i, 0.0).round() as i16);
                }
                w.i16(0);
                w.i16(arr(r, 3, 0.0).round() as i16);
            }
            w.bytes(&[0; 10]);
            *b"mixr"
        }
        "selective" => {
            w.u16(1);
            w.u16(a.get("absolute").and_then(Value::as_bool).unwrap_or(false) as u16);
            w.bytes(&[0; 8]);
            for k in ["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"] {
                let v = a.get("cmyk").and_then(|c| c.get(k));
                for i in 0..4 {
                    w.i16(arr(v, i, 0.0).round() as i16);
                }
            }
            *b"selc"
        }
        "invert" => *b"nvrt",
        "posterize" => {
            w.u16(n("levels", 4.0).round().clamp(2.0, 255.0) as u16);
            w.u16(0);
            *b"post"
        }
        "threshold" => {
            w.u16(n("level", 128.0).round().clamp(1.0, 255.0) as u16);
            w.u16(0);
            *b"thrs"
        }
        _ => return None,
    };
    Some((key, w.0))
}

// --- pixels ----------------------------------------------------------------------------

/// One channel's pixels (8 or 16 bit samples, big-endian) as RLE (PackBits) rows: (row lengths, data).
fn rle(plane: &[u16], w: usize, h: usize, depth: u16) -> (Vec<u16>, Vec<u8>) {
    let mut counts = Vec::with_capacity(h);
    let mut data = Vec::new();
    let mut row = Vec::with_capacity(w * 2);
    for y in 0..h {
        row.clear();
        for &v in &plane[y * w..(y + 1) * w] {
            if depth == 8 {
                row.push((v >> 8) as u8);
            } else {
                row.extend(v.to_be_bytes());
            }
        }
        let start = data.len();
        packbits_row(&row, &mut data);
        counts.push((data.len() - start) as u16);
    }
    (counts, data)
}

fn packbits_row(src: &[u8], out: &mut Vec<u8>) {
    let mut i = 0;
    while i < src.len() {
        // A run of the same byte.
        let mut run = 1;
        while i + run < src.len() && run < 128 && src[i + run] == src[i] {
            run += 1;
        }
        if run >= 3 {
            out.push((1i16 - run as i16) as i8 as u8);
            out.push(src[i]);
            i += run;
            continue;
        }
        // Bytes as they are, until the next run of 3.
        let s = i;
        while i < src.len() && i - s < 128 {
            if i + 2 < src.len() && src[i] == src[i + 1] && src[i] == src[i + 2] {
                break;
            }
            i += 1;
        }
        out.push((i - s - 1) as u8);
        out.extend_from_slice(&src[s..i]);
    }
}

/// A channel as written in a layer: compression (1) then row lengths and rows.
fn layer_channel(plane: &[u16], w: usize, h: usize, depth: u16) -> Vec<u8> {
    if w == 0 || h == 0 {
        return vec![0, 0];
    }
    let (counts, data) = rle(plane, w, h, depth);
    let mut out = Vec::with_capacity(2 + h * 2 + data.len());
    out.extend(1u16.to_be_bytes());
    for c in counts {
        out.extend(c.to_be_bytes());
    }
    out.extend(data);
    out
}

/// A layer's pixels and mask ready to write.
#[derive(Clone, Default)]
pub struct Pixels {
    /// top, left, bottom, right
    pub rect: [i32; 4],
    /// (channel id, data with its compression)
    pub chans: Vec<(i16, Vec<u8>)>,
}

/// RGBA over the whole canvas (rows top first) as a layer's channels, cut to where it isn't clear.
pub fn layer_pixels(rgba: &[u8], cw: usize, ch: usize, depth: u16) -> Pixels {
    let (mut x0, mut y0, mut x1, mut y1) = (cw, ch, 0, 0);
    for y in 0..ch {
        let row = &rgba[y * cw * 4..(y + 1) * cw * 4];
        if let Some(first) = row.chunks_exact(4).position(|p| p[3] != 0) {
            let last = row.chunks_exact(4).rposition(|p| p[3] != 0).unwrap();
            x0 = x0.min(first);
            x1 = x1.max(last + 1);
            y0 = y0.min(y);
            y1 = y1.max(y + 1);
        }
    }
    if x1 <= x0 || y1 <= y0 {
        return Pixels { rect: [0; 4], chans: [-1, 0, 1, 2].iter().map(|&id| (id, vec![0, 0])).collect() };
    }
    let (w, h) = (x1 - x0, y1 - y0);
    let mut planes = vec![vec![0u16; w * h]; 4];
    for y in 0..h {
        for x in 0..w {
            let p = &rgba[((y0 + y) * cw + x0 + x) * 4..][..4];
            let a = p[3] as u32;
            // Rendered pixels have their colour times their alpha: Photoshop keeps it apart.
            for c in 0..3 {
                let v = if a == 0 { 0 } else { ((p[c] as u32 * 255 + a / 2) / a).min(255) };
                planes[c][y * w + x] = v as u16 * 257;
            }
            planes[3][y * w + x] = a as u16 * 257;
        }
    }
    let chans = [(-1i16, 3usize), (0, 0), (1, 1), (2, 2)].iter().map(|&(id, i)| (id, layer_channel(&planes[i], w, h, depth))).collect();
    Pixels { rect: [y0 as i32, x0 as i32, y1 as i32, x1 as i32], chans }
}

/// A grey mask over the canvas as a layer mask: (rect, what's outside it, data).
pub fn mask_pixels(grey: &[u8], cw: usize, ch: usize, depth: u16) -> (Pixels, u8) {
    // Outside the box it's what most of the edge is.
    let edge: usize = (0..cw).map(|x| grey[x] as usize + grey[(ch - 1) * cw + x] as usize).sum::<usize>() / (2 * cw).max(1);
    let def: u8 = if edge >= 128 { 255 } else { 0 };
    let (mut x0, mut y0, mut x1, mut y1) = (cw, ch, 0, 0);
    for y in 0..ch {
        let row = &grey[y * cw..(y + 1) * cw];
        if let Some(first) = row.iter().position(|&v| v != def) {
            let last = row.iter().rposition(|&v| v != def).unwrap();
            x0 = x0.min(first);
            x1 = x1.max(last + 1);
            y0 = y0.min(y);
            y1 = y1.max(y + 1);
        }
    }
    if x1 <= x0 || y1 <= y0 {
        return (Pixels { rect: [0; 4], chans: vec![(-2, vec![0, 0])] }, def);
    }
    let (w, h) = (x1 - x0, y1 - y0);
    let mut plane = vec![0u16; w * h];
    for y in 0..h {
        for x in 0..w {
            plane[y * w + x] = grey[(y0 + y) * cw + x0 + x] as u16 * 257;
        }
    }
    (Pixels { rect: [y0 as i32, x0 as i32, y1 as i32, x1 as i32], chans: vec![(-2, layer_channel(&plane, w, h, depth))] }, def)
}

// --- the document ----------------------------------------------------------------------

/// One layer record to write, bottom first. Groups: their end marker first, the group itself after its layers.
#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Spec {
    /// "layer", "group" or "end"
    pub t: String,
    pub name: String,
    pub hidden: bool,
    pub opacity: f64,
    pub fill: Option<f64>,
    pub blend: String,
    pub clip: bool,
    pub adj: Option<Value>,
    pub solid: Option<Value>,
    pub style: Option<Value>,
    pub mask_off: bool,
    /// Where its pixels and mask come from (see Save).
    #[serde(skip)]
    pub pixels: Option<Pixels>,
    #[serde(skip)]
    pub mask: Option<(Pixels, u8)>,
}

pub struct Out<'a> {
    pub w: usize,
    pub h: usize,
    pub depth: u16,
    /// The background (RGB, 16-bit samples), none for a document without one.
    pub base: Option<&'a [u16]>,
    pub specs: &'a [Spec],
    /// The flattened picture, RGB 16-bit samples.
    pub merged: &'a [u16],
    /// Flightroom's own layers (JSON), written with the fingerprint of the records.
    pub state: Option<Value>,
    pub assets: &'a [(String, Vec<u8>)],
    pub icc: Option<&'a [u8]>,
}

fn pascal_name(w: &mut W, name: &str) {
    let b: Vec<u8> = name.chars().map(|c| if c.is_ascii() && !c.is_control() { c as u8 } else { b'?' }).take(255).collect();
    let start = w.0.len();
    w.u8(b.len() as u8);
    w.bytes(&b);
    while (w.0.len() - start) % 4 != 0 {
        w.u8(0);
    }
}

/// The layer records and their channels (the layer info's contents).
fn layer_info(o: &Out, patterns_long: f64) -> Vec<u8> {
    let mut recs = W::default();
    let mut data = W::default();
    let full = [0, 0, o.h as i32, o.w as i32];
    let mut count = 0i16;
    let mut emit = |rect: [i32; 4], chans: &[(i16, Vec<u8>)], blend: &[u8; 4], opacity: u8, clip: bool, flags: u8, mask: Option<([i32; 4], u8, u8)>, name: &str, blocks: Vec<([u8; 4], Vec<u8>)>| {
        count += 1;
        for r in rect {
            recs.i32(r);
        }
        recs.u16(chans.len() as u16);
        for (id, d) in chans {
            recs.i16(*id);
            recs.u32(d.len() as u32);
            data.bytes(d);
        }
        recs.bytes(b"8BIM");
        recs.bytes(blend);
        recs.u8(opacity);
        recs.u8(clip as u8);
        recs.u8(flags);
        recs.u8(0);
        let mut extra = W::default();
        match mask {
            Some((r, def, fl)) => {
                extra.u32(20);
                for v in r {
                    extra.i32(v);
                }
                extra.u8(def);
                extra.u8(fl);
                extra.u16(0);
            }
            None => extra.u32(0),
        }
        extra.u32(0);
        pascal_name(&mut extra, name);
        let mut lu = W::default();
        let u: Vec<u16> = name.encode_utf16().collect();
        lu.u32(u.len() as u32);
        for c in u {
            lu.u16(c);
        }
        extra.block(b"luni", &lu.0, 4);
        for (k, d) in blocks {
            extra.block(&k, &d, 4);
        }
        recs.u32(extra.0.len() as u32);
        recs.bytes(&extra.0);
    };
    if let Some(base) = o.base {
        let n = o.w * o.h;
        let chans: Vec<(i16, Vec<u8>)> = (0..3).map(|c| (c as i16, layer_channel(&(0..n).map(|i| base[i * 3 + c]).collect::<Vec<u16>>(), o.w, o.h, o.depth))).collect();
        emit(full, &chans, b"norm", 255, false, 0, None, "Background", vec![]);
    }
    let empty: Vec<(i16, Vec<u8>)> = [-1i16, 0, 1, 2].iter().map(|&id| (id, vec![0, 0])).collect();
    for s in o.specs {
        let opacity = (s.opacity.clamp(0.0, 100.0) * 2.55).round() as u8;
        let hidden = if s.hidden { 2 } else { 0 };
        let mut blocks: Vec<([u8; 4], Vec<u8>)> = Vec::new();
        let mut chans = empty.clone();
        let mut rect = [0; 4];
        let mut mask = None;
        if let Some((m, def)) = &s.mask {
            chans.extend(m.chans.iter().cloned());
            mask = Some((m.rect, *def, if s.mask_off { 2 } else { 0 }));
        }
        let blend = blend_key(&s.blend);
        match s.t.as_str() {
            "end" => {
                blocks.push((*b"lsct", 3u32.to_be_bytes().to_vec()));
                emit(rect, &chans, b"norm", 255, false, hidden | 0x18, None, "</Layer group>", blocks);
                continue;
            }
            "group" => {
                let mut b = W::default();
                b.u32(1);
                b.bytes(b"8BIM");
                b.bytes(blend);
                blocks.push((*b"lsct", b.0));
                emit(rect, &chans, if blend == b"pass" { b"pass" } else { blend }, opacity, false, hidden | 0x18, mask, &s.name, blocks);
                continue;
            }
            _ => {}
        }
        if let Some(fx) = s.style.as_ref().and_then(|st| effects(st, patterns_long)) {
            blocks.push((*b"lfx2", fx));
        }
        let fill = s.fill.unwrap_or(100.0);
        if fill < 100.0 {
            blocks.push((*b"iOpa", vec![(fill.clamp(0.0, 100.0) * 2.55).round() as u8, 0, 0, 0]));
        }
        if let Some((k, d)) = s.adj.as_ref().and_then(adjustment) {
            blocks.push((k, d));
        } else if let Some(c) = &s.solid {
            blocks.push((*b"SoCo", desc_block("null", vec![("Clr ", rgb(c))])));
        } else if let Some(p) = &s.pixels {
            rect = p.rect;
            let m: Vec<(i16, Vec<u8>)> = chans.iter().filter(|(id, _)| *id < -1).cloned().collect();
            chans = p.chans.clone();
            chans.extend(m);
        }
        emit(rect, &chans, if blend == b"pass" { b"norm" } else { blend }, opacity, s.clip, hidden, mask, &s.name, blocks);
    }
    let mut out = W::default();
    out.i16(count);
    out.bytes(&recs.0);
    out.bytes(&data.0);
    // Rounded up to 4 bytes here, so the fingerprint covers what readers see.
    out.0.resize(out.0.len().div_ceil(4) * 4, 0);
    out.0
}

/// The patterns the layers' Pattern Overlays use, as a Patt block.
fn patterns_block(specs: &[Spec]) -> Option<Vec<u8>> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for s in specs {
        let Some(p) = s.style.as_ref().and_then(|st| st.get("pattern")).filter(|p| p.get("on").and_then(Value::as_bool) != Some(false)) else { continue };
        let Some(src) = p.get("src").and_then(Value::as_str) else { continue };
        if !seen.insert(src.to_string()) {
            continue;
        }
        if let Some((w, h, rgba)) = decode_data_url(src) {
            out.extend(pattern_record(&pattern_id(src), p.get("name").and_then(Value::as_str).unwrap_or("Pattern"), w, h, &rgba));
        }
    }
    (!out.is_empty()).then_some(out)
}

/// The whole document.
pub fn write(o: &Out) -> Vec<u8> {
    let long = o.w.max(o.h) as f64;
    let info = layer_info(o, long);
    let fp = format!("{:016x}", fnv(&info));
    let mut f = W::default();
    f.bytes(b"8BPS");
    f.u16(1);
    f.bytes(&[0; 6]);
    f.u16(3);
    f.u32(o.h as u32);
    f.u32(o.w as u32);
    f.u16(o.depth);
    f.u16(3);
    f.u32(0);
    // Image resources.
    let mut res = W::default();
    let mut resource = |id: u16, d: &[u8]| {
        res.bytes(b"8BIM");
        res.u16(id);
        res.u16(0);
        res.u32(d.len() as u32);
        res.bytes(d);
        if d.len() % 2 == 1 {
            res.u8(0);
        }
    };
    // 72 pixels an inch.
    resource(1005, &[0, 72, 0, 0, 0, 1, 0, 2, 0, 72, 0, 0, 0, 1, 0, 2]);
    if let Some(icc) = o.icc {
        resource(1039, icc);
    }
    if let Some(st) = &o.state {
        let mut st = st.clone();
        st["fp"] = json!(fp);
        resource(STATE_ID, st.to_string().as_bytes());
    }
    if !o.assets.is_empty() {
        let mut a = W::default();
        for (k, d) in o.assets {
            a.u16(k.len() as u16);
            a.bytes(k.as_bytes());
            a.u32(d.len() as u32);
            a.bytes(d);
        }
        resource(ASSETS_ID, &a.0);
    }
    f.u32(res.0.len() as u32);
    f.bytes(&res.0);
    // Layers and masks: 16-bit documents keep their layers in an Lr16 block.
    let mut lm = W::default();
    if o.depth == 8 {
        lm.u32(info.len() as u32);
        lm.bytes(&info);
        lm.u32(0);
    } else {
        lm.u32(0);
        lm.u32(0);
        lm.block(b"Lr16", &info, 4);
    }
    if let Some(p) = patterns_block(o.specs) {
        lm.block(b"Patt", &p, 4);
    }
    f.u32(lm.0.len() as u32);
    f.bytes(&lm.0);
    // The flattened picture.
    let n = o.w * o.h;
    let mut all_counts = Vec::new();
    let mut all_data = Vec::new();
    for c in 0..3 {
        let plane: Vec<u16> = (0..n).map(|i| o.merged[i * 3 + c]).collect();
        let (counts, data) = rle(&plane, o.w, o.h, o.depth);
        all_counts.extend(counts);
        all_data.extend(data);
    }
    f.u16(1);
    for c in all_counts {
        f.u16(c);
    }
    f.bytes(&all_data);
    f.0
}

// --- reading Flightroom's own back --------------------------------------------------------

/// Flightroom's layers saved in the document, and whether the file is still as Flightroom
/// wrote it (false: changed in Photoshop since, so its own layers are read instead).
pub fn saved_state(doc: &Doc) -> Option<(Value, bool)> {
    let (_, at) = doc.resources.iter().find(|(id, _)| *id == STATE_ID)?;
    let v: Value = serde_json::from_slice(&doc.d[at.clone()]).ok()?;
    let fp = format!("{:016x}", fnv(&doc.d[doc.layer_span.clone()]));
    let ok = v.get("fp").and_then(Value::as_str) == Some(fp.as_str());
    Some((v, ok))
}

/// A picture Flightroom kept in the document (when the file is still as it wrote it).
pub fn asset<'a>(doc: &Doc<'a>, key: &str) -> Option<&'a [u8]> {
    if !saved_state(doc)?.1 {
        return None;
    }
    assets(doc).into_iter().find(|(k, _)| k == key).map(|(_, d)| d)
}

pub fn assets<'a>(doc: &Doc<'a>) -> Vec<(String, &'a [u8])> {
    let Some((_, at)) = doc.resources.iter().find(|(id, _)| *id == ASSETS_ID) else { return Vec::new() };
    let b = &doc.d[at.clone()];
    let mut out = Vec::new();
    let mut i = 0;
    while i + 2 <= b.len() {
        let kn = u16::from_be_bytes([b[i], b[i + 1]]) as usize;
        let Some(k) = b.get(i + 2..i + 2 + kn) else { break };
        let j = i + 2 + kn;
        let Some(len) = b.get(j..j + 4).map(|x| u32::from_be_bytes(x.try_into().unwrap()) as usize) else { break };
        let Some(d) = b.get(j + 4..j + 4 + len) else { break };
        out.push((String::from_utf8_lossy(k).into_owned(), d));
        i = j + 4 + len;
    }
    out
}

/// A plain document: one background of `colour` (0-1), or a picture.
pub fn plain(w: usize, h: usize, depth: u16, rgb16: &[u16], icc: Option<&[u8]>) -> Vec<u8> {
    write(&Out { w, h, depth, base: Some(rgb16), specs: &[], merged: rgb16, state: None, assets: &[], icc })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packbits_round_trips() {
        let src: Vec<u8> = (0..300).map(|i| if i % 50 < 20 { 7 } else { (i * 13 % 256) as u8 }).collect();
        let mut packed = Vec::new();
        packbits_row(&src, &mut packed);
        let mut back = vec![0u8; src.len()];
        crate::psd::unpack_bits(&packed, &mut back);
        assert_eq!(back, src);
    }

    #[test]
    fn writes_a_document_that_reads_back() {
        let (w, h) = (40, 30);
        let base: Vec<u16> = (0..w * h * 3).map(|i| ((i % 251) * 257) as u16).collect();
        let mut rgba = vec![0u8; w * h * 4];
        for y in 5..15 {
            for x in 10..20 {
                rgba[(y * w + x) * 4..][..4].copy_from_slice(&[200, 100, 50, 255]);
            }
        }
        let mut grey = vec![255u8; w * h];
        grey[..w * 3].fill(0);
        for depth in [8u16, 16] {
        let specs = vec![
            Spec { t: "end".into(), ..Default::default() },
            Spec { t: "layer".into(), name: "Paint".into(), opacity: 80.0, blend: "multiply".into(), pixels: Some(layer_pixels(&rgba, w, h, depth)), mask: Some(mask_pixels(&grey, w, h, depth)),
                style: Some(json!({ "bevel": { "on": true, "size": 0.1 }, "shadow": { "on": true, "size": 0.05, "distance": 0.02, "color": [0, 0, 0], "opacity": 50 } })), ..Default::default() },
            Spec { t: "layer".into(), name: "Curves".into(), opacity: 100.0, blend: "normal".into(), adj: Some(json!({ "type": "curves", "rgb": [[0, 0], [128, 160], [255, 255]] })), ..Default::default() },
            Spec { t: "group".into(), name: "Group".into(), opacity: 100.0, blend: "pass".into(), ..Default::default() },
        ];
            let bytes = write(&Out { w, h, depth, base: Some(&base), specs: &specs, merged: &base, state: Some(json!({ "v": 1, "layers": "z:" })), assets: &[("psd:3".into(), vec![1, 2, 3])], icc: None });
            let doc = Doc::parse(&bytes).unwrap();
            assert_eq!(doc.layers.len(), 5);
            assert_eq!(doc.background(), Some(0));
            let d = crate::psd::describe(&doc);
            let ls = d["layers"].as_array().unwrap();
            assert_eq!(ls[0]["name"], "Paint");
            assert_eq!(ls[0]["blend"], "multiply");
            assert_eq!(ls[0]["opacity"], 80.0);
            assert_eq!(ls[0]["style"]["bevel"]["style"], "inner");
            assert!((ls[0]["style"]["shadow"]["distance"].as_f64().unwrap() - 0.02).abs() < 1e-6);
            assert_eq!(ls[1]["adj"]["rgb"][1], json!([128, 160]));
            assert_eq!(ls[2]["kind"], "group");
            let (pw, ph, px) = doc.layer_rgba(&doc.layers[2]).unwrap();
            assert_eq!((pw, ph), (10, 10));
            assert_eq!(&px[..4], &[200, 100, 50, 255]);
            let (_, _, m) = doc.mask_grey(&doc.layers[2]).unwrap().unwrap();
            assert!(m.iter().all(|&v| v == 255));
            assert_eq!(doc.base().unwrap()[..6], base[..6]);
            let (st, ok) = saved_state(&doc).unwrap();
            assert!(ok && st["layers"] == "z:");
            assert_eq!(asset(&doc, "psd:3"), Some(&[1u8, 2, 3][..]));
        }
    }
}
