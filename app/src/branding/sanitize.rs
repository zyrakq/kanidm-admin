// app/src/branding/sanitize.rs
//
// Deny-list SVG sanitizer for uploaded branding images. Same-origin SVG
// is an XSS vector, so active content is stripped before an upload is
// written to disk: <script>/<foreignObject>/<iframe>/<object>/<embed>
// blocks (including their content), on* event-handler attributes, and
// javascript: / non-image data: URLs in href/xlink:href.
//
// The scanner honors quoted attribute values (a '>' inside quotes does
// not end the tag). v1 scope: deny-list is adequate because uploads are
// admin-provided and the endpoint is documented as unauthenticated only
// until real auth lands.

/// Tags removed together with their entire content.
const BLOCKED_TAGS: [&str; 5] = ["script", "foreignobject", "iframe", "object", "embed"];

/// Strip active content from an SVG document.
pub fn sanitize_svg(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(lt) = rest.find('<') {
        out.push_str(&rest[..lt]);
        rest = &rest[lt..];

        let Some(end) = tag_end(rest) else {
            // Unterminated tag (stray '<'): drop the remainder.
            return out;
        };
        let tag = &rest[..end];
        rest = &rest[end..];

        let (name, self_closing) = tag_name(tag);
        let lower = name.to_ascii_lowercase();
        if BLOCKED_TAGS.contains(&lower.as_str()) {
            if !self_closing {
                rest = skip_block(rest, &lower);
            }
            continue;
        }
        out.push_str(&sanitize_tag(tag));
    }

    out.push_str(rest);
    out
}

/// Byte index just past the closing '>' of the tag starting at `s[0] == '<'`,
/// honoring quoted attribute values. `None` when the tag never closes.
fn tag_end(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut quote: Option<u8> = None;
    for (i, b) in bytes.iter().enumerate() {
        if let Some(q) = quote {
            if *b == q {
                quote = None;
            }
        } else if *b == b'"' || *b == b'\'' {
            quote = Some(*b);
        } else if *b == b'>' {
            return Some(i + 1);
        }
    }
    None
}

/// Tag name and whether the tag is self-closing (`<path/>`).
/// Closing tags (`</g>`) report `name` without the leading slash.
fn tag_name(tag: &str) -> (&str, bool) {
    let inner = tag.trim_start_matches('<').trim_end_matches('>');
    let self_closing = inner.trim_end().ends_with('/');
    let inner = inner.trim_end_matches('/');
    let name = inner.split_whitespace().next().unwrap_or("");
    (name.strip_prefix('/').unwrap_or(name), self_closing)
}

/// Skip a blocked tag's content up to and including its closing tag.
fn skip_block<'a>(rest: &'a str, lower_name: &str) -> &'a str {
    let close = format!("</{}", lower_name);
    let lowered = rest.to_ascii_lowercase();
    match lowered.find(&close) {
        Some(pos) => {
            let after = &rest[pos..];
            after.find('>').map(|gt| &after[gt + 1..]).unwrap_or("")
        }
        None => "",
    }
}

/// Rebuild one tag with dangerous attributes removed.
fn sanitize_tag(tag: &str) -> String {
    let inner = tag.trim_start_matches('<').trim_end_matches('>');
    let self_closing = inner.trim_end().ends_with('/');
    let inner = inner.trim_end_matches('/');
    let closing = inner.starts_with('/');
    let body = if closing { &inner[1..] } else { inner };

    let mut parts = body.splitn(2, char::is_whitespace);
    let name = parts.next().unwrap_or("");
    let attrs = parts.next().unwrap_or("");

    let mut rebuilt = String::from("<");
    if closing {
        rebuilt.push('/');
    }
    rebuilt.push_str(name);
    if !closing {
        for (attr_name, attr_value) in parse_attrs(attrs) {
            if attr_is_dangerous(&attr_name, &attr_value) {
                continue;
            }
            rebuilt.push(' ');
            rebuilt.push_str(&attr_name);
            if let Some(v) = attr_value {
                rebuilt.push_str("=\"");
                rebuilt.push_str(&v.replace('"', "&quot;"));
                rebuilt.push('"');
            }
        }
        if self_closing {
            rebuilt.push('/');
        }
    }
    rebuilt.push('>');
    rebuilt
}

/// Split `a="1" b='2' c=3 bare` into (name, Option<value>) pairs.
fn parse_attrs(attrs: &str) -> Vec<(String, Option<String>)> {
    let mut out = Vec::new();
    let bytes = attrs.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        let name_start = i;
        while i < bytes.len() && bytes[i] != b'=' && !bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if name_start == i {
            break;
        }
        let name = attrs[name_start..i].to_string();

        let mut value: Option<String> = None;
        if i < bytes.len() && bytes[i] == b'=' {
            i += 1;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'') {
                let quote = bytes[i];
                i += 1;
                let vstart = i;
                while i < bytes.len() && bytes[i] != quote {
                    i += 1;
                }
                value = Some(attrs[vstart..i].to_string());
                i += 1; // past the closing quote
            } else {
                let vstart = i;
                while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
                    i += 1;
                }
                value = Some(attrs[vstart..i].to_string());
            }
        }
        out.push((name, value));
    }

    out
}

/// Event handlers and dangerous URL schemes are stripped.
fn attr_is_dangerous(name: &str, value: &Option<String>) -> bool {
    let n = name.to_ascii_lowercase();
    if n.starts_with("on") {
        return true;
    }
    let Some(v) = value else {
        return false;
    };
    if n != "href" && n != "xlink:href" {
        return false;
    }
    let v = v.trim_start().to_ascii_lowercase();
    v.starts_with("javascript:") || (v.starts_with("data:") && !v.starts_with("data:image/"))
}

#[cfg(test)]
mod tests {
    use super::sanitize_svg;

    #[test]
    fn plain_svg_passes_through() {
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="currentColor"/></svg>"##;
        assert_eq!(sanitize_svg(svg), svg);
    }

    #[test]
    fn script_block_is_removed_with_content() {
        let svg = r#"<svg><script>alert(1)</script><path d="M0 0"/></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><path d="M0 0"/></svg>"#);
    }

    #[test]
    fn script_block_is_removed_case_insensitive() {
        let svg = r#"<svg><SCRIPT>alert(1)</SCRIPT><path d="M0 0"/></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><path d="M0 0"/></svg>"#);
    }

    #[test]
    fn foreign_object_block_is_removed() {
        let svg = r#"<svg><foreignObject><body><p>hi</p></body></foreignObject><circle r="1"/></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><circle r="1"/></svg>"#);
    }

    #[test]
    fn event_handler_attributes_are_removed() {
        let svg = r#"<svg onload="alert(1)"><path OnClick="alert(1)" d="M0 0"/></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><path d="M0 0"/></svg>"#);
    }

    #[test]
    fn javascript_href_is_removed() {
        let svg = r#"<svg><a xlink:href="javascript:alert(1)"><text>x</text></a><a href="JavaScript:alert(2)"/></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><a><text>x</text></a><a/></svg>"#);
    }

    #[test]
    fn image_data_urls_are_kept() {
        let svg = r#"<svg><image href="data:image/png;base64,AAAA"/></svg>"#;
        assert_eq!(sanitize_svg(svg), svg);
    }

    #[test]
    fn html_data_urls_are_removed() {
        let svg = r#"<svg><a href="data:text/html;base64,AAAA"><text>x</text></a></svg>"#;
        assert_eq!(sanitize_svg(svg), r#"<svg><a><text>x</text></a></svg>"#);
    }

    #[test]
    fn quoted_attribute_containing_gt_is_handled() {
        let svg = r#"<svg><path title="a>b" d="M0 0"/></svg>"#;
        assert_eq!(sanitize_svg(svg), svg);
    }

    #[test]
    fn unterminated_tag_is_dropped() {
        assert_eq!(sanitize_svg(r#"<svg><path d="M0 0""#), r#"<svg>"#);
    }
}
