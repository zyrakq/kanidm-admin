// app/src/customization/store.rs
//
// Filesystem store for customization overrides. One file per slot named
// exactly after the slot (e.g. `logo-light`), plus a `<slot>.meta`
// sidecar holding the persisted content type. The manifest version is
// the max mtime across slot files (unix seconds) and doubles as the
// frontend cache-buster.

use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::customization::sanitize::sanitize_svg;

/// The six overrideable slots: four image slots (logo/favicon, light
/// and dark) and two CSS theme-override slots.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Slot {
    LogoLight,
    LogoDark,
    FaviconLight,
    FaviconDark,
    ThemeLight,
    ThemeDark,
}

/// What kind of content a slot accepts; decides the allowed content
/// types and the serve fallback behavior.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotKind {
    /// SVG/PNG images; SVG is sanitized at write time.
    Image,
    /// Stylesheets stored verbatim (the SVG sanitizer must not run).
    Css,
}

impl Slot {
    pub const ALL: [Slot; 6] = [
        Slot::LogoLight,
        Slot::LogoDark,
        Slot::FaviconLight,
        Slot::FaviconDark,
        Slot::ThemeLight,
        Slot::ThemeDark,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Slot::LogoLight => "logo-light",
            Slot::LogoDark => "logo-dark",
            Slot::FaviconLight => "favicon-light",
            Slot::FaviconDark => "favicon-dark",
            Slot::ThemeLight => "theme-light",
            Slot::ThemeDark => "theme-dark",
        }
    }

    /// Parse a slot name from a URL path segment.
    pub fn parse(name: &str) -> Option<Slot> {
        Slot::ALL.iter().copied().find(|s| s.as_str() == name)
    }

    /// Content kind accepted by this slot.
    pub fn kind(self) -> SlotKind {
        match self {
            Slot::ThemeLight | Slot::ThemeDark => SlotKind::Css,
            Slot::LogoLight | Slot::LogoDark | Slot::FaviconLight | Slot::FaviconDark => {
                SlotKind::Image
            }
        }
    }
}

/// Allowed content types per slot kind.
const IMAGE_TYPES: [&str; 2] = ["image/svg+xml", "image/png"];
const CSS_TYPES: [&str; 1] = ["text/css"];

fn allowed_types(kind: SlotKind) -> &'static [&'static str] {
    match kind {
        SlotKind::Image => &IMAGE_TYPES,
        SlotKind::Css => &CSS_TYPES,
    }
}

/// Persisted manifest entry for one slot.
#[derive(Debug, Clone, Serialize)]
pub struct SlotEntry {
    pub present: bool,
    pub content_type: Option<String>,
    pub updated_at: Option<i64>,
}

/// Full manifest returned by `GET /api/customization`.
#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    /// Max mtime across slots (unix seconds, "0" when empty) — the
    /// frontend cache-buster.
    pub version: String,
    /// All six slots, always.
    pub slots: Vec<(String, SlotEntry)>,
}

/// Store-level failures, mapped to HTTP responses by the handlers.
#[derive(Debug)]
pub enum StoreError {
    /// Unsupported content type; carries the slot's allowed list so the
    /// handler can render a per-slot message.
    InvalidType {
        content_type: String,
        allowed: Vec<String>,
    },
    /// Upload exceeds `max_size_bytes`.
    TooLarge { size: usize, limit: i64 },
    /// Filesystem failure (dir creation, write, read).
    Io(io::Error),
}

impl From<io::Error> for StoreError {
    fn from(e: io::Error) -> Self {
        StoreError::Io(e)
    }
}

/// Filesystem-backed customization store.
pub struct CustomizationStore {
    dir: PathBuf,
    max_size_bytes: i64,
}

impl CustomizationStore {
    pub fn new(dir: PathBuf, max_size_bytes: i64) -> Self {
        Self { dir, max_size_bytes }
    }

    fn slot_path(&self, slot: Slot) -> PathBuf {
        self.dir.join(slot.as_str())
    }

    fn meta_path(&self, slot: Slot) -> PathBuf {
        self.dir.join(format!("{}.meta", slot.as_str()))
    }

    /// Validate, sanitize (SVG images only) and persist an upload;
    /// returns the updated manifest entry. CSS is stored verbatim.
    pub fn store(
        &self,
        slot: Slot,
        content_type: &str,
        data: &[u8],
    ) -> Result<SlotEntry, StoreError> {
        let normalized = content_type
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        let allowed = allowed_types(slot.kind());
        if !allowed.contains(&normalized.as_str()) {
            return Err(StoreError::InvalidType {
                content_type: normalized.clone(),
                allowed: allowed.iter().map(|t| t.to_string()).collect(),
            });
        }
        if data.len() as i64 > self.max_size_bytes {
            return Err(StoreError::TooLarge {
                size: data.len(),
                limit: self.max_size_bytes,
            });
        }

        // SVG images are sanitized at write time; PNG and CSS are
        // stored verbatim (the sanitizer is SVG-specific).
        let bytes: Vec<u8> = if normalized == "image/svg+xml" {
            let text = std::str::from_utf8(data).map_err(|_| StoreError::InvalidType {
                content_type: normalized.clone(),
                allowed: allowed.iter().map(|t| t.to_string()).collect(),
            })?;
            sanitize_svg(text).into_bytes()
        } else {
            data.to_vec()
        };

        fs::create_dir_all(&self.dir)?;
        // Write via temp file + rename so a partial write is never served.
        let tmp = self.dir.join(format!(".{}.tmp", slot.as_str()));
        fs::write(&tmp, &bytes)?;
        fs::rename(&tmp, self.slot_path(slot))?;
        fs::write(self.meta_path(slot), &normalized)?;

        Ok(self.entry(slot))
    }

    /// Remove an override (no-op when absent).
    pub fn remove(&self, slot: Slot) -> Result<(), StoreError> {
        for path in [self.slot_path(slot), self.meta_path(slot)] {
            match fs::remove_file(&path) {
                Ok(()) => {}
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.into()),
            }
        }
        Ok(())
    }

    /// Read an override for serving: (content_type, bytes) or `None`.
    pub fn read(&self, slot: Slot) -> Result<Option<(String, Vec<u8>)>, StoreError> {
        let bytes = match fs::read(self.slot_path(slot)) {
            Ok(b) => b,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let content_type = fs::read_to_string(self.meta_path(slot))
            .unwrap_or_else(|_| "application/octet-stream".to_string());
        Ok(Some((content_type, bytes)))
    }

    /// Manifest entry for one slot (present/absent derived from disk).
    pub fn entry(&self, slot: Slot) -> SlotEntry {
        match fs::metadata(self.slot_path(slot)) {
            Ok(meta) => SlotEntry {
                present: true,
                content_type: fs::read_to_string(self.meta_path(slot)).ok(),
                updated_at: meta
                    .modified()
                    .ok()
                    .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64),
            },
            Err(_) => SlotEntry {
                present: false,
                content_type: None,
                updated_at: None,
            },
        }
    }

    /// Full manifest: all six slots plus the cache-busting version.
    pub fn manifest(&self) -> Manifest {
        let slots = Slot::ALL
            .iter()
            .map(|&s| (s.as_str().to_string(), self.entry(s)))
            .collect::<Vec<_>>();
        let version = slots
            .iter()
            .filter_map(|(_, e)| e.updated_at)
            .max()
            .unwrap_or(0)
            .to_string();
        Manifest { version, slots }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (CustomizationStore, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = CustomizationStore::new(dir.path().to_path_buf(), 1024);
        (s, dir)
    }

    #[test]
    fn slot_parse_roundtrip() {
        for slot in Slot::ALL {
            assert_eq!(Slot::parse(slot.as_str()), Some(slot));
        }
        assert_eq!(Slot::parse("nope"), None);
        assert_eq!(Slot::parse("../escape"), None);
    }

    #[test]
    fn slot_kinds() {
        assert_eq!(Slot::LogoLight.kind(), SlotKind::Image);
        assert_eq!(Slot::FaviconDark.kind(), SlotKind::Image);
        assert_eq!(Slot::ThemeLight.kind(), SlotKind::Css);
        assert_eq!(Slot::ThemeDark.kind(), SlotKind::Css);
    }

    #[test]
    fn store_and_read_roundtrip_svg() {
        let (s, _dir) = store();
        let entry = s
            .store(
                Slot::LogoLight,
                "image/svg+xml",
                b"<svg><script>alert(1)</script></svg>",
            )
            .expect("store should succeed");
        assert!(entry.present);
        let (ctype, bytes) = s.read(Slot::LogoLight).expect("read").expect("present");
        assert_eq!(ctype, "image/svg+xml");
        let text = String::from_utf8(bytes).unwrap();
        assert!(!text.contains("script"), "sanitized on write");
    }

    #[test]
    fn png_is_stored_verbatim() {
        let (s, _dir) = store();
        s.store(Slot::FaviconDark, "image/png", &[0x89, b'P', b'N', b'G'])
            .expect("store should succeed");
        let (_, bytes) = s.read(Slot::FaviconDark).expect("read").expect("present");
        assert_eq!(bytes, vec![0x89, b'P', b'N', b'G']);
    }

    #[test]
    fn css_roundtrip_is_verbatim() {
        let (s, _dir) = store();
        let css = b":root { --theme-color-primary: #8b5cf6; }";
        let entry = s
            .store(Slot::ThemeLight, "text/css", css)
            .expect("store css should succeed");
        assert!(entry.present);
        let (ctype, bytes) = s.read(Slot::ThemeLight).expect("read").expect("present");
        assert_eq!(ctype, "text/css");
        assert_eq!(bytes, css.to_vec(), "CSS must not be sanitized or transformed");
    }

    #[test]
    fn css_content_type_parameters_are_stripped() {
        let (s, _dir) = store();
        s.store(Slot::ThemeLight, "text/css; charset=utf-8", b":root{}")
            .expect("store should succeed");
        let (ctype, _) = s.read(Slot::ThemeLight).expect("read").expect("present");
        assert_eq!(ctype, "text/css");
    }

    #[test]
    fn css_slot_rejects_image_type() {
        let (s, _dir) = store();
        let err = s.store(Slot::ThemeDark, "image/png", b"png").unwrap_err();
        match err {
            StoreError::InvalidType { allowed, .. } => {
                assert_eq!(allowed, vec!["text/css".to_string()]);
            }
            other => panic!("expected InvalidType, got {other:?}"),
        }
    }

    #[test]
    fn image_slot_rejects_css_type() {
        let (s, _dir) = store();
        let err = s.store(Slot::LogoLight, "text/css", b":root{}").unwrap_err();
        assert!(matches!(err, StoreError::InvalidType { .. }));
    }

    #[test]
    fn content_type_parameters_are_stripped() {
        let (s, _dir) = store();
        s.store(Slot::LogoDark, "image/svg+xml; charset=utf-8", b"<svg/>")
            .expect("store should succeed");
        let (ctype, _) = s.read(Slot::LogoDark).expect("read").expect("present");
        assert_eq!(ctype, "image/svg+xml");
    }

    #[test]
    fn unsupported_type_is_rejected() {
        let (s, _dir) = store();
        let err = s.store(Slot::LogoLight, "image/gif", b"GIF8").unwrap_err();
        assert!(matches!(err, StoreError::InvalidType { .. }));
    }

    #[test]
    fn oversized_upload_is_rejected() {
        let (s, _dir) = store();
        let err = s
            .store(Slot::LogoLight, "image/png", &[0u8; 2048])
            .unwrap_err();
        assert!(matches!(err, StoreError::TooLarge { size: 2048, limit: 1024 }));
    }

    #[test]
    fn oversized_css_upload_is_rejected() {
        let (s, _dir) = store();
        let err = s
            .store(Slot::ThemeLight, "text/css", &[b'x'; 2048])
            .unwrap_err();
        assert!(matches!(err, StoreError::TooLarge { size: 2048, limit: 1024 }));
    }

    #[test]
    fn remove_restores_absent_entry() {
        let (s, _dir) = store();
        s.store(Slot::LogoLight, "image/png", b"png").expect("store");
        s.remove(Slot::LogoLight).expect("remove");
        let entry = s.entry(Slot::LogoLight);
        assert!(!entry.present);
        assert_eq!(entry.content_type, None);
        // Removing again is still fine.
        s.remove(Slot::LogoLight).expect("remove of absent slot");
    }

    #[test]
    fn manifest_lists_all_slots_and_versions() {
        let (s, _dir) = store();
        s.store(Slot::FaviconLight, "image/png", b"png").expect("store");
        let m = s.manifest();
        let names: Vec<&str> = m.slots.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "logo-light",
                "logo-dark",
                "favicon-light",
                "favicon-dark",
                "theme-light",
                "theme-dark"
            ]
        );
        let favicon = &m.slots[2].1;
        assert!(favicon.present);
        assert_eq!(m.version, favicon.updated_at.unwrap().to_string());
    }

    #[test]
    fn version_reflects_latest_upload() {
        let (s, _dir) = store();
        assert_eq!(s.manifest().version, "0");
        s.store(Slot::ThemeDark, "text/css", b":root{}").expect("store");
        assert_ne!(s.manifest().version, "0");
    }

    #[test]
    fn missing_file_reads_as_none() {
        let (s, _dir) = store();
        assert!(s.read(Slot::LogoDark).expect("read").is_none());
        assert!(s.read(Slot::ThemeLight).expect("read").is_none());
    }
}
