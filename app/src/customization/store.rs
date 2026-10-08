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

/// The four overrideable slots (v1 scope).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Slot {
    LogoLight,
    LogoDark,
    FaviconLight,
    FaviconDark,
}

impl Slot {
    pub const ALL: [Slot; 4] = [
        Slot::LogoLight,
        Slot::LogoDark,
        Slot::FaviconLight,
        Slot::FaviconDark,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Slot::LogoLight => "logo-light",
            Slot::LogoDark => "logo-dark",
            Slot::FaviconLight => "favicon-light",
            Slot::FaviconDark => "favicon-dark",
        }
    }

    /// Parse a slot name from a URL path segment.
    pub fn parse(name: &str) -> Option<Slot> {
        Slot::ALL.iter().copied().find(|s| s.as_str() == name)
    }
}

/// Content types accepted for uploads.
const ALLOWED_TYPES: [&str; 2] = ["image/svg+xml", "image/png"];

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
    /// All four slots, always.
    pub slots: Vec<(String, SlotEntry)>,
}

/// Store-level failures, mapped to HTTP responses by the handlers.
#[derive(Debug)]
pub enum StoreError {
    /// Unsupported content type.
    InvalidType(String),
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

    /// Validate, sanitize (SVG only) and persist an upload; returns the
    /// updated manifest entry.
    pub fn store(&self, slot: Slot, content_type: &str, data: &[u8]) -> Result<SlotEntry, StoreError> {
        let normalized = content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
        if !ALLOWED_TYPES.contains(&normalized.as_str()) {
            return Err(StoreError::InvalidType(normalized));
        }
        if data.len() as i64 > self.max_size_bytes {
            return Err(StoreError::TooLarge {
                size: data.len(),
                limit: self.max_size_bytes,
            });
        }

        let bytes: Vec<u8> = if normalized == "image/svg+xml" {
            let text = std::str::from_utf8(data)
                .map_err(|_| StoreError::InvalidType(normalized.clone()))?;
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

    /// Full manifest: all four slots plus the cache-busting version.
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
    fn store_and_read_roundtrip_svg() {
        let (s, _dir) = store();
        let entry = s
            .store(Slot::LogoLight, "image/svg+xml", b"<svg><script>alert(1)</script></svg>")
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
        assert!(matches!(err, StoreError::InvalidType(_)));
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
            vec!["logo-light", "logo-dark", "favicon-light", "favicon-dark"]
        );
        let favicon = &m.slots[2].1;
        assert!(favicon.present);
        assert_eq!(m.version, favicon.updated_at.unwrap().to_string());
    }

    #[test]
    fn missing_file_reads_as_none() {
        let (s, _dir) = store();
        assert!(s.read(Slot::LogoDark).expect("read").is_none());
    }
}
