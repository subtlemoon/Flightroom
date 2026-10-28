// Small, careful edits to XMP sidecars. Lightroom, Bridge and Capture One keep
// their own data in the same .xmp file, so changes touch only the properties
// being set and leave every other byte as it was.

use std::collections::HashMap;

pub const CRS_NS: &str = "http://ns.adobe.com/camera-raw-settings/1.0/";
/// Flightroom's own settings that Lightroom has no place for.
pub const FR_NS: &str = "http://ns.flightroom.app/1.0/";

pub struct Doc {
    pub text: String,
}

fn is_name_char(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_' || c == b'-' || c == b'.' || c == b':'
}

pub fn escape(v: &str) -> String {
    v.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

pub fn unescape(v: &str) -> String {
    v.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}

impl Doc {
    pub fn new(text: &str) -> Self {
        Doc { text: text.to_string() }
    }

    /// Byte range of the value of attribute `qname="..."` (without quotes).
    fn find_attr(&self, qname: &str) -> Option<(usize, usize)> {
        let b = self.text.as_bytes();
        let mut from = 0;
        while let Some(i) = self.text[from..].find(qname) {
            let at = from + i;
            from = at + qname.len();
            if at > 0 && is_name_char(b[at - 1]) {
                continue;
            }
            let mut j = from;
            while j < b.len() && b[j].is_ascii_whitespace() {
                j += 1;
            }
            if j >= b.len() || b[j] != b'=' {
                continue;
            }
            j += 1;
            while j < b.len() && b[j].is_ascii_whitespace() {
                j += 1;
            }
            if j >= b.len() || (b[j] != b'"' && b[j] != b'\'') {
                continue;
            }
            let q = b[j];
            let start = j + 1;
            let end = start + self.text[start..].find(q as char)?;
            return Some((start, end));
        }
        None
    }

    /// Byte range of a whole `<qname>...</qname>` element and of its content.
    fn find_elem(&self, qname: &str) -> Option<((usize, usize), (usize, usize))> {
        let open = format!("<{qname}");
        let close = format!("</{qname}>");
        let b = self.text.as_bytes();
        let mut from = 0;
        while let Some(i) = self.text[from..].find(&open) {
            let at = from + i;
            from = at + open.len();
            let next = b.get(from).copied().unwrap_or(b'>');
            if is_name_char(next) {
                continue;
            }
            let gt = from + self.text[from..].find('>')?;
            if b[gt - 1] == b'/' {
                return Some(((at, gt + 1), (gt, gt)));
            }
            let end = gt + 1 + self.text[gt + 1..].find(&close)?;
            return Some(((at, end + close.len()), (gt + 1, end)));
        }
        None
    }

    /// The first rdf:Description start tag: (start, end of attributes, is self-closing).
    fn description_tag(&self) -> Option<(usize, usize, bool)> {
        let at = self.text.find("<rdf:Description")?;
        let gt = at + self.text[at..].find('>')?;
        let self_closing = self.text.as_bytes()[gt - 1] == b'/';
        Some((at, if self_closing { gt - 1 } else { gt }, self_closing))
    }

    fn ensure_ns(&mut self, prefix: &str, ns: &str) {
        if self.text.contains(&format!("xmlns:{prefix}=")) {
            return;
        }
        if let Some((_, end, _)) = self.description_tag() {
            self.text.insert_str(end, &format!("\n    xmlns:{prefix}=\"{ns}\""));
        }
    }

    pub fn get(&self, prefix: &str, name: &str) -> Option<String> {
        let q = format!("{prefix}:{name}");
        if let Some((s, e)) = self.find_attr(&q) {
            return Some(unescape(&self.text[s..e]));
        }
        let (_, (s, e)) = self.find_elem(&q)?;
        let inner = self.text[s..e].trim();
        if inner.contains('<') {
            return None;
        }
        Some(unescape(inner))
    }

    /// Items of an rdf:Seq property, such as a tone curve's points.
    pub fn get_seq(&self, prefix: &str, name: &str) -> Option<Vec<String>> {
        let (_, (s, e)) = self.find_elem(&format!("{prefix}:{name}"))?;
        let inner = &self.text[s..e];
        let mut out = Vec::new();
        let mut from = 0;
        while let Some(i) = inner[from..].find("<rdf:li") {
            let gt = from + i + inner[from + i..].find('>')?;
            let end = gt + inner[gt..].find("</rdf:li>")?;
            out.push(unescape(inner[gt + 1..end].trim()));
            from = end;
        }
        Some(out)
    }

    /// Every simple `prefix:Name` value (attributes and plain elements).
    pub fn all(&self, prefix: &str) -> HashMap<String, String> {
        let mut out = HashMap::new();
        let pat = format!("{prefix}:");
        let b = self.text.as_bytes();
        let mut from = 0;
        while let Some(i) = self.text[from..].find(&pat) {
            let at = from + i;
            from = at + pat.len();
            if at > 0 && (is_name_char(b[at - 1]) && b[at - 1] != b'<') {
                continue;
            }
            let name: String = self.text[from..].bytes().take_while(|&c| is_name_char(c) && c != b':').map(|c| c as char).collect();
            if name.is_empty() || out.contains_key(&name) {
                continue;
            }
            if let Some(v) = self.get(prefix, &name) {
                out.insert(name, v);
            }
        }
        out
    }

    /// Sets `prefix:name` to `value`: changes it where it already is, or adds it as
    /// an attribute of the rdf:Description (declaring the namespace if needed).
    pub fn set_attr(&mut self, prefix: &str, name: &str, value: &str, ns: &str) {
        let q = format!("{prefix}:{name}");
        let v = escape(value);
        if let Some((s, e)) = self.find_attr(&q) {
            self.text.replace_range(s..e, &v);
            return;
        }
        if let Some((_, (s, e))) = self.find_elem(&q) {
            if !self.text[s..e].contains('<') {
                self.text.replace_range(s..e, &v);
                return;
            }
        }
        self.ensure_ns(prefix, ns);
        if let Some((_, end, _)) = self.description_tag() {
            self.text.insert_str(end, &format!("\n   {q}=\"{v}\""));
        }
    }

    pub fn remove(&mut self, prefix: &str, name: &str) {
        let q = format!("{prefix}:{name}");
        while let Some((s, e)) = self.find_attr(&q) {
            // From the whitespace before the name to the closing quote.
            let name_at = self.text[..s].rfind(&q).unwrap_or(s);
            let ws = self.text[..name_at].trim_end().len();
            self.text.replace_range(ws..e + 1, "");
        }
        while let Some(((s, e), _)) = self.find_elem(&q) {
            let ws = self.text[..s].trim_end().len();
            self.text.replace_range(ws..e, "");
        }
    }

    /// Replaces an rdf:Seq property with these items (removed when empty).
    pub fn set_seq(&mut self, prefix: &str, name: &str, items: &[String], ns: &str) {
        let lis: String = items.iter().map(|i| format!("\n     <rdf:li>{}</rdf:li>", escape(i))).collect();
        let inner = if items.is_empty() { String::new() } else { format!("\n    <rdf:Seq>{lis}\n    </rdf:Seq>\n   ") };
        self.set_xml(prefix, name, &inner, ns);
    }

    /// Replaces a structured property with `inner` (already-escaped XML; removed when empty).
    pub fn set_xml(&mut self, prefix: &str, name: &str, inner: &str, ns: &str) {
        self.remove(prefix, name);
        if inner.is_empty() {
            return;
        }
        self.ensure_ns(prefix, ns);
        let q = format!("{prefix}:{name}");
        let elem = format!("\n   <{q}>{inner}</{q}>");
        let Some((_, end, self_closing)) = self.description_tag() else { return };
        if self_closing {
            // <rdf:Description .../> becomes <rdf:Description ...> ... </rdf:Description>
            self.text.replace_range(end..end + 2, &format!(">{elem}\n  </rdf:Description>"));
        } else {
            self.text.insert_str(end + 1, &elem);
        }
    }
}

/// A new, empty sidecar.
pub fn empty() -> String {
    "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\" x:xmptk=\"Flightroom\">\n <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n  <rdf:Description rdf:about=\"\"/>\n </rdf:RDF>\n</x:xmpmeta>\n".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const LR: &str = r#"<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   xmp:Rating="2"
   crs:Exposure2012="+0.35"
   crs:Contrast2012="-10">
   <crs:ToneCurvePV2012>
    <rdf:Seq>
     <rdf:li>0, 0</rdf:li>
     <rdf:li>255, 255</rdf:li>
    </rdf:Seq>
   </crs:ToneCurvePV2012>
   <dc:subject><rdf:Bag><rdf:li>kart</rdf:li></rdf:Bag></dc:subject>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>"#;

    #[test]
    fn reads_values_and_sequences() {
        let d = Doc::new(LR);
        let all = d.all("crs");
        assert_eq!(all.get("Exposure2012").map(String::as_str), Some("+0.35"));
        assert_eq!(all.get("Contrast2012").map(String::as_str), Some("-10"));
        assert!(!all.contains_key("ToneCurvePV2012"));
        assert_eq!(d.get_seq("crs", "ToneCurvePV2012").unwrap(), vec!["0, 0", "255, 255"]);
    }

    #[test]
    fn edits_leave_other_data_alone() {
        let mut d = Doc::new(LR);
        d.set_attr("crs", "Exposure2012", "+1.00", CRS_NS);
        d.set_attr("crs", "Clarity2012", "+20", CRS_NS);
        d.set_seq("crs", "ToneCurvePV2012", &["0, 0".into(), "128, 140".into(), "255, 255".into()], CRS_NS);
        assert!(d.text.contains("crs:Exposure2012=\"+1.00\""));
        assert!(d.text.contains("crs:Clarity2012=\"+20\""));
        assert!(d.text.contains("<rdf:li>kart</rdf:li>"));
        assert!(d.text.contains("xmp:Rating=\"2\""));
        assert_eq!(d.get_seq("crs", "ToneCurvePV2012").unwrap().len(), 3);
        assert_eq!(d.text.matches("ToneCurvePV2012>").count(), 2);
    }

    #[test]
    fn adds_crs_to_a_rating_only_sidecar() {
        let mut d = Doc::new(&crate::photolib::new_xmp(3));
        d.set_attr("crs", "Exposure2012", "+0.50", CRS_NS);
        d.set_seq("crs", "ToneCurvePV2012", &["0, 0".into(), "255, 255".into()], CRS_NS);
        assert!(d.text.contains("xmlns:crs=\"http://ns.adobe.com/camera-raw-settings/1.0/\""));
        assert_eq!(crate::photolib::read_rating(&d.text), Some(3));
        assert_eq!(d.get("crs", "Exposure2012").as_deref(), Some("+0.50"));
        assert!(d.text.contains("</rdf:Description>"));
        assert_eq!(d.get_seq("crs", "ToneCurvePV2012").unwrap().len(), 2);
    }

    #[test]
    fn structured_properties() {
        let mut d = Doc::new(&empty());
        d.set_attr("crs", "Exposure2012", "+0.50", CRS_NS);
        d.set_xml("crs", "GradientBasedCorrections", "<rdf:Seq><rdf:li><rdf:Description crs:What=\"Correction\" crs:LocalExposure2012=\"0.5\"/></rdf:li></rdf:Seq>", CRS_NS);
        d.set_attr("fr", "Masks", "[{\"id\":1}]", FR_NS);
        assert_eq!(d.get("crs", "Exposure2012").unwrap(), "+0.50");
        assert_eq!(d.get("fr", "Masks").unwrap(), "[{\"id\":1}]");
        assert!(d.text.contains("xmlns:fr="));
        d.set_xml("crs", "GradientBasedCorrections", "<rdf:Seq/>", CRS_NS);
        assert_eq!(d.text.matches("GradientBasedCorrections>").count(), 2);
        d.set_xml("crs", "GradientBasedCorrections", "", CRS_NS);
        assert!(!d.text.contains("GradientBasedCorrections"));
        assert_eq!(d.get("crs", "Exposure2012").unwrap(), "+0.50");
    }

    #[test]
    fn removes_properties() {
        let mut d = Doc::new(LR);
        d.remove("crs", "Contrast2012");
        d.remove("crs", "ToneCurvePV2012");
        assert!(!d.text.contains("Contrast2012"));
        assert!(!d.text.contains("ToneCurvePV2012"));
        assert!(d.text.contains("crs:Exposure2012=\"+0.35\">"));
    }
}
