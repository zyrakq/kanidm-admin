// app/src/customization/store.rs
//
// Filesystem store for customization overrides. Four image slots
// (logo/favicon, light and dark), each one file named exactly after the
// slot plus a `<slot>.meta` sidecar holding the persisted content type.
// Theme variants are ordinary `.css` files in per-mode subfolders of
// the `themes/` directory (`themes/light/`, `themes/dark/`; separate
// namespaces — the same file name may exist in both). The active
// variant per mode resolves as: stored page selection
// (`selection.json`) → config-set file name (validated against that
// mode's discovered list) → none (built-in default).
// The manifest version is the max mtime across slot files, variant
// files and the selection file (unix seconds) and doubles as the
// frontend cache-buster.

use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::customization::sanitize::sanitize_svg;

/// Themes subdirectory of the customization dir (implied, not configured).
const THEMES_SUBDIR: &str = "themes";

/// Persisted per-mode page selection, stored as `selection.json`.
const SELECTION_FILE: &str = "selection.json";

/// The four overrideable image slots (logo/favicon, light and dark).
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

/// Allowed image content types (SVG is sanitized at write time).
const IMAGE_TYPES: [&str; 2] = ["image/svg+xml", "image/png"];

/// Theme mode addressed by the selection endpoint and the serve URLs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeMode {
    Light,
    Dark,
}

impl ThemeMode {
    pub const ALL: [ThemeMode; 2] = [ThemeMode::Light, ThemeMode::Dark];

    pub fn as_str(self) -> &'static str {
        match self {
            ThemeMode::Light => "light",
            ThemeMode::Dark => "dark",
        }
    }

    /// Parse a mode name ("light" / "dark").
    pub fn parse(name: &str) -> Option<ThemeMode> {
        ThemeMode::ALL.iter().copied().find(|m| m.as_str() == name)
    }
}

/// Stored page selection per mode (`selection.json`). `None` means the
/// config default (or the built-in stylesheet) applies.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ThemeSelection {
    #[serde(default)]
    pub light: Option<String>,
    #[serde(default)]
    pub dark: Option<String>,
}

impl ThemeSelection {
    fn get(&self, mode: ThemeMode) -> Option<String> {
        match mode {
            ThemeMode::Light => self.light.clone(),
            ThemeMode::Dark => self.dark.clone(),
        }
    }

    fn set(&mut self, mode: ThemeMode, name: Option<String>) {
        match mode {
            ThemeMode::Light => self.light = name,
            ThemeMode::Dark => self.dark = name,
        }
    }
}

/// Per-mode theme info for the manifest.
#[derive(Debug, Clone, Serialize)]
pub struct ThemeModeInfo {
    /// Sorted discovered variant file names for this mode's folder
    /// (auto-discovery; each folder is its own namespace).
    pub available: Vec<String>,
    /// Effective variant file name, or `None` for the built-in default.
    pub selected: Option<String>,
    /// Config/env-set deployment default (as configured, even when the
    /// file is missing — `selected` already fell through in that case).
    pub config_selected: Option<String>,
    /// Where `selected` comes from: "selection", "config" or "builtin".
    pub source: &'static str,
}

/// Theme section of the manifest.
#[derive(Debug, Clone, Serialize)]
pub struct ThemeManifest {
    pub light: ThemeModeInfo,
    pub dark: ThemeModeInfo,
}

/// Persisted manifest entry for one image slot.
#[derive(Debug, Clone, Serialize)]
pub struct SlotEntry {
    pub present: bool,
    pub content_type: Option<String>,
    pub updated_at: Option<i64>,
}

/// Full manifest returned by `GET /api/customization`.
#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    /// Max mtime across slots, variants and the selection file (unix
    /// seconds, "0" when empty) — the frontend cache-buster.
    pub version: String,
    /// All four image slots, always.
    pub slots: Vec<(String, SlotEntry)>,
    /// Theme variants and per-mode resolution.
    pub theme: ThemeManifest,
}

/// Store-level failures, mapped to HTTP responses by the handlers.
#[derive(Debug)]
pub enum StoreError {
    /// Unsupported content type; carries the allowed list so the
    /// handler can render a per-kind message.
    InvalidType {
        content_type: String,
        allowed: Vec<String>,
    },
    /// Upload exceeds `max_size_bytes`.
    TooLarge { size: usize, limit: i64 },
    /// Variant file name failed sanitization.
    InvalidName { name: String, reason: &'static str },
    /// A variant with this name already exists.
    AlreadyExists { name: String },
    /// Selection/deletion names a variant that is not on disk.
    UnknownVariant { name: String },
    /// Filesystem failure (dir creation, write, read, remove).
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
    /// Config/env-set deployment defaults (file names, may be empty).
    config_light: String,
    config_dark: String,
}

impl CustomizationStore {
    /// Build the store and run the legacy-slot startup migration.
    pub fn new(dir: PathBuf, max_size_bytes: i64, config_light: String, config_dark: String) -> Self {
        let store = Self {
            dir,
            max_size_bytes,
            config_light,
            config_dark,
        };
        store.migrate_legacy_slots();
        store
    }

    fn themes_dir(&self, mode: ThemeMode) -> PathBuf {
        self.dir.join(THEMES_SUBDIR).join(mode.as_str())
    }

    fn selection_path(&self) -> PathBuf {
        self.dir.join(SELECTION_FILE)
    }

    fn variant_path(&self, mode: ThemeMode, name: &str) -> PathBuf {
        self.themes_dir(mode).join(name)
    }

    /// Sorted names of `*.css` files in the mode's subfolder
    /// (auto-discovery; the identifier is the full file name including
    /// `.css`).
    pub fn list_variants(&self, mode: ThemeMode) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(self.themes_dir(mode))
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter_map(|e| {
                        let name = e.file_name().into_string().ok()?;
                        (name.ends_with(".css") && e.path().is_file()).then_some(name)
                    })
                    .collect()
            })
            .unwrap_or_default();
        names.sort();
        names
    }

    /// Sanitize a variant file name: lowercase, `[a-z0-9._-]` only,
    /// must end `.css`, no path separators, no `..`, non-empty base
    /// that starts with a letter or digit.
    pub fn sanitize_variant_name(name: &str) -> Result<String, StoreError> {
        let reject = |reason: &'static str| {
            Err(StoreError::InvalidName {
                name: name.to_string(),
                reason,
            })
        };
        let lower = name.trim().to_ascii_lowercase();
        if lower.len() < 5 {
            return reject("name must end with '.css' and have a non-empty base");
        }
        if !lower.ends_with(".css") {
            return reject("name must end with '.css'");
        }
        if lower.contains("..") {
            return reject("name must not contain '..'");
        }
        if lower.contains('/') || lower.contains('\\') {
            return reject("name must not contain path separators");
        }
        if !lower
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '_' | '-'))
        {
            return reject("name may only contain a-z, 0-9, '.', '_' and '-'");
        }
        let base = &lower[..lower.len() - 4];
        if base.starts_with('.') {
            return reject("name must start with a letter or digit");
        }
        Ok(lower)
    }

    /// Validate and persist a theme variant upload into the mode's
    /// folder; returns the stored (sanitized) name. CSS is stored
    /// verbatim; collisions are rejected within the mode folder.
    pub fn store_variant(
        &self,
        mode: ThemeMode,
        name: &str,
        content_type: &str,
        data: &[u8],
    ) -> Result<String, StoreError> {
        let name = Self::sanitize_variant_name(name)?;
        let normalized = content_type
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        if normalized != "text/css" {
            return Err(StoreError::InvalidType {
                content_type: normalized,
                allowed: vec!["text/css".to_string()],
            });
        }
        if data.len() as i64 > self.max_size_bytes {
            return Err(StoreError::TooLarge {
                size: data.len(),
                limit: self.max_size_bytes,
            });
        }
        if self.variant_path(mode, &name).exists() {
            return Err(StoreError::AlreadyExists { name });
        }
        fs::create_dir_all(self.themes_dir(mode))?;
        // Write via temp file + rename so a partial write is never served.
        let tmp = self.themes_dir(mode).join(format!(".{name}.tmp"));
        fs::write(&tmp, data)?;
        fs::rename(&tmp, self.variant_path(mode, &name))?;
        Ok(name)
    }

    /// Delete a variant file from the mode's folder and clear that
    /// mode's selection entry if it points at the file. Unknown names
    /// are an error.
    pub fn remove_variant(&self, mode: ThemeMode, name: &str) -> Result<(), StoreError> {
        let name = Self::sanitize_variant_name(name)?;
        if !self.variant_path(mode, &name).exists() {
            return Err(StoreError::UnknownVariant { name });
        }
        fs::remove_file(self.variant_path(mode, &name))?;
        let mut selection = self.selection();
        if selection.get(mode).as_deref() == Some(name.as_str()) {
            selection.set(mode, None);
            self.save_selection(&selection)?;
        }
        Ok(())
    }

    /// Set or clear the stored selection for one mode. Setting a name
    /// requires the variant to exist on disk; clearing is always fine.
    pub fn select_variant(&self, mode: ThemeMode, name: Option<String>) -> Result<(), StoreError> {
        let Some(name) = name else {
            let mut selection = self.selection();
            if selection.get(mode).is_some() {
                selection.set(mode, None);
                self.save_selection(&selection)?;
            }
            return Ok(());
        };
        let name = Self::sanitize_variant_name(&name)?;
        if !self.variant_path(mode, &name).exists() {
            return Err(StoreError::UnknownVariant { name });
        }
        let mut selection = self.selection();
        selection.set(mode, Some(name));
        self.save_selection(&selection)?;
        Ok(())
    }

    /// Stored selection; a corrupt or missing file reads as empty
    /// (corrupt files log a warning, never panic).
    pub fn selection(&self) -> ThemeSelection {
        let path = self.selection_path();
        match fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_else(|_| {
                tracing::warn!("corrupt customization selection file; ignoring it ({})", path.display());
                ThemeSelection::default()
            }),
            Err(_) => ThemeSelection::default(),
        }
    }

    fn save_selection(&self, selection: &ThemeSelection) -> Result<(), StoreError> {
        fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join(".selection.json.tmp");
        fs::write(&tmp, serde_json::to_string(selection).expect("selection serializes"))?;
        fs::rename(&tmp, self.selection_path())?;
        Ok(())
    }

    /// Effective variant for a mode: stored selection → config name
    /// (validated against the discovered list; missing → warn + fall
    /// through) → none.
    pub fn effective_variant(&self, mode: ThemeMode) -> Option<String> {
        if let Some(name) = self.selection().get(mode) {
            return Some(name);
        }
        let config = match mode {
            ThemeMode::Light => &self.config_light,
            ThemeMode::Dark => &self.config_dark,
        };
        if config.is_empty() {
            return None;
        }
        if self.list_variants(mode).iter().any(|v| v == config) {
            return Some(config.clone());
        }
        tracing::warn!(
            "configured theme variant '{config}' for {} mode was not found in {}; \
             falling back to the built-in default",
            mode.as_str(),
            self.themes_dir(mode).display()
        );
        None
    }

    /// Read the effective variant for serving: (content_type, bytes)
    /// or `None` for the built-in default.
    pub fn read_variant(&self, mode: ThemeMode) -> Result<Option<(String, Vec<u8>)>, StoreError> {
        let Some(name) = self.effective_variant(mode) else {
            return Ok(None);
        };
        let bytes = match fs::read(self.variant_path(mode, &name)) {
            Ok(b) => b,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        Ok(Some(("text/css".to_string(), bytes)))
    }

    /// Startup migration: legacy `theme-light` / `theme-dark` files in
    /// the customization root move to `themes/theme-light.css` /
    /// `themes/theme-dark.css` and seed the stored selection. Legacy
    /// `.meta` sidecars are removed; a collision with an existing
    /// variant file drops the legacy file (warn).
    fn migrate_legacy_slots(&self) {
        for (mode, slot) in [(ThemeMode::Light, "theme-light"), (ThemeMode::Dark, "theme-dark")] {
            let legacy = self.dir.join(slot);
            if !legacy.is_file() {
                let _ = fs::remove_file(self.dir.join(format!("{slot}.meta")));
                continue;
            }
            let target_name = format!("{slot}.css");
            if self.variant_path(mode, &target_name).exists() {
                tracing::warn!(
                    "legacy theme file {} collides with {}; removing the legacy file",
                    legacy.display(),
                    self.variant_path(mode, &target_name).display()
                );
                let _ = fs::remove_file(&legacy);
            } else if fs::create_dir_all(self.themes_dir(mode)).is_ok() {
                match fs::rename(&legacy, self.variant_path(mode, &target_name)) {
                    Ok(()) => {
                        let mut selection = self.selection();
                        if selection.get(mode).is_none() {
                            selection.set(mode, Some(target_name));
                            if let Err(e) = self.save_selection(&selection) {
                                tracing::warn!("could not seed theme selection: {e:?}");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("could not migrate legacy theme file {}: {e}", legacy.display())
                    }
                }
            }
            let _ = fs::remove_file(self.dir.join(format!("{slot}.meta")));
        }
    }

    /// Validate, sanitize (SVG images only) and persist an image-slot
    /// upload; returns the updated manifest entry.
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
        if !IMAGE_TYPES.contains(&normalized.as_str()) {
            return Err(StoreError::InvalidType {
                content_type: normalized.clone(),
                allowed: IMAGE_TYPES.iter().map(|t| t.to_string()).collect(),
            });
        }
        if data.len() as i64 > self.max_size_bytes {
            return Err(StoreError::TooLarge {
                size: data.len(),
                limit: self.max_size_bytes,
            });
        }

        // SVG images are sanitized at write time; PNG is stored
        // verbatim (the sanitizer is SVG-specific).
        let bytes: Vec<u8> = if normalized == "image/svg+xml" {
            let text = std::str::from_utf8(data).map_err(|_| StoreError::InvalidType {
                content_type: normalized.clone(),
                allowed: IMAGE_TYPES.iter().map(|t| t.to_string()).collect(),
            })?;
            sanitize_svg(text).into_bytes()
        } else {
            data.to_vec()
        };

        fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join(format!(".{}.tmp", slot.as_str()));
        fs::write(&tmp, &bytes)?;
        fs::rename(&tmp, self.dir.join(slot.as_str()))?;
        fs::write(self.dir.join(format!("{}.meta", slot.as_str())), &normalized)?;

        Ok(self.entry(slot))
    }

    /// Remove an image override (no-op when absent).
    pub fn remove(&self, slot: Slot) -> Result<(), StoreError> {
        for path in [
            self.dir.join(slot.as_str()),
            self.dir.join(format!("{}.meta", slot.as_str())),
        ] {
            match fs::remove_file(&path) {
                Ok(()) => {}
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.into()),
            }
        }
        Ok(())
    }

    /// Read an image override for serving: (content_type, bytes) or `None`.
    pub fn read(&self, slot: Slot) -> Result<Option<(String, Vec<u8>)>, StoreError> {
        let bytes = match fs::read(self.dir.join(slot.as_str())) {
            Ok(b) => b,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let content_type = fs::read_to_string(self.dir.join(format!("{}.meta", slot.as_str())))
            .unwrap_or_else(|_| "application/octet-stream".to_string());
        Ok(Some((content_type, bytes)))
    }

    /// Manifest entry for one image slot (present/absent derived from disk).
    pub fn entry(&self, slot: Slot) -> SlotEntry {
        match fs::metadata(self.dir.join(slot.as_str())) {
            Ok(meta) => SlotEntry {
                present: true,
                content_type: fs::read_to_string(self.dir.join(format!("{}.meta", slot.as_str()))).ok(),
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

    fn mtime_secs(&self, path: &std::path::Path) -> Option<i64> {
        fs::metadata(path)
            .ok()?
            .modified()
            .ok()?
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_secs() as i64)
    }

    fn theme_info(&self, mode: ThemeMode) -> ThemeModeInfo {
        let available = self.list_variants(mode);
        let config = match mode {
            ThemeMode::Light => &self.config_light,
            ThemeMode::Dark => &self.config_dark,
        };
        let config_selected = if config.is_empty() {
            None
        } else {
            Some(config.clone())
        };
        if let Some(name) = self.selection().get(mode) {
            return ThemeModeInfo {
                available: available.clone(),
                selected: Some(name),
                config_selected,
                source: "selection",
            };
        }
        if let Some(name) = &config_selected {
            if available.iter().any(|v| v == name) {
                return ThemeModeInfo {
                    available: available.clone(),
                    selected: Some(name.clone()),
                    config_selected,
                    source: "config",
                };
            }
        }
        ThemeModeInfo {
            available,
            selected: None,
            config_selected,
            source: "builtin",
        }
    }

    /// Full manifest: four image slots, the theme section and the
    /// cache-busting version (max mtime across slot files, variant
    /// files and the selection file).
    pub fn manifest(&self) -> Manifest {
        let slots = Slot::ALL
            .iter()
            .map(|&s| (s.as_str().to_string(), self.entry(s)))
            .collect::<Vec<_>>();
        let mut mtimes: Vec<i64> = slots.iter().filter_map(|(_, e)| e.updated_at).collect();
        for mode in ThemeMode::ALL {
            for name in self.list_variants(mode) {
                mtimes.extend(self.mtime_secs(&self.variant_path(mode, &name)));
            }
        }
        mtimes.extend(self.mtime_secs(&self.selection_path()));
        let version = mtimes.iter().max().copied().unwrap_or(0).to_string();
        let theme = ThemeManifest {
            light: self.theme_info(ThemeMode::Light),
            dark: self.theme_info(ThemeMode::Dark),
        };
        Manifest {
            version,
            slots,
            theme,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (CustomizationStore, tempfile::TempDir) {
        store_with_config("", "")
    }

    fn store_with_config(light: &str, dark: &str) -> (CustomizationStore, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = CustomizationStore::new(
            dir.path().to_path_buf(),
            1024,
            light.to_string(),
            dark.to_string(),
        );
        (s, dir)
    }

    #[test]
    fn slot_parse_roundtrip() {
        for slot in Slot::ALL {
            assert_eq!(Slot::parse(slot.as_str()), Some(slot));
        }
        assert_eq!(Slot::parse("nope"), None);
        assert_eq!(Slot::parse("theme-light"), None, "theme slots left the Slot enum");
        assert_eq!(Slot::parse("../escape"), None);
    }

    #[test]
    fn image_slot_rejects_css_type() {
        let (s, _dir) = store();
        let err = s.store(Slot::LogoLight, "text/css", b":root{}").unwrap_err();
        assert!(matches!(err, StoreError::InvalidType { .. }));
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
        assert!(!String::from_utf8(bytes).unwrap().contains("script"), "sanitized on write");
    }

    #[test]
    fn png_is_stored_verbatim() {
        let (s, _dir) = store();
        s.store(Slot::FaviconDark, "image/png", &[0x89, b'P', b'N', b'G']).expect("store");
        let (_, bytes) = s.read(Slot::FaviconDark).expect("read").expect("present");
        assert_eq!(bytes, vec![0x89, b'P', b'N', b'G']);
    }

    #[test]
    fn content_type_parameters_are_stripped() {
        let (s, _dir) = store();
        s.store(Slot::LogoDark, "image/svg+xml; charset=utf-8", b"<svg/>").expect("store");
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
        let err = s.store(Slot::LogoLight, "image/png", &[0u8; 2048]).unwrap_err();
        assert!(matches!(err, StoreError::TooLarge { size: 2048, limit: 1024 }));
    }

    #[test]
    fn remove_restores_absent_entry() {
        let (s, _dir) = store();
        s.store(Slot::LogoLight, "image/png", b"png").expect("store");
        s.remove(Slot::LogoLight).expect("remove");
        assert!(!s.entry(Slot::LogoLight).present);
        s.remove(Slot::LogoLight).expect("remove of absent slot");
    }

    #[test]
    fn manifest_lists_all_slots_and_versions() {
        let (s, _dir) = store();
        s.store(Slot::FaviconLight, "image/png", b"png").expect("store");
        let m = s.manifest();
        let names: Vec<&str> = m.slots.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, vec!["logo-light", "logo-dark", "favicon-light", "favicon-dark"]);
        assert!(m.slots[2].1.present);
        assert_eq!(m.version, m.slots[2].1.updated_at.unwrap().to_string());
    }

    #[test]
    fn missing_file_reads_as_none() {
        let (s, _dir) = store();
        assert!(s.read(Slot::LogoDark).expect("read").is_none());
    }

    #[test]
    fn variant_name_sanitization() {
        assert_eq!(
            CustomizationStore::sanitize_variant_name("Corporate.CSS").expect("valid name"),
            "corporate.css".to_string()
        );
        for bad in [
            "", "style", ".css", ".hidden.css", "..css", "a..css", "a/b.css", "a\\b.css",
            "a b.css", "стиль.css",
        ] {
            assert!(
                CustomizationStore::sanitize_variant_name(bad).is_err(),
                "{bad} must be rejected"
            );
        }
    }

    #[test]
    fn variant_store_list_roundtrip() {
        let (s, _dir) = store();
        let name = s
            .store_variant(ThemeMode::Light, "Corp.CSS", "text/css; charset=utf-8", b":root{}")
            .expect("store");
        assert_eq!(name, "corp.css", "name is lowercased");
        assert_eq!(s.list_variants(ThemeMode::Light), vec!["corp.css".to_string()]);
    }

    #[test]
    fn variant_store_rejects_bad_type_collision_and_size() {
        let (s, _dir) = store();
        s.store_variant(ThemeMode::Light, "a.css", "text/css", b":root{}").expect("store");
        assert!(matches!(
            s.store_variant(ThemeMode::Light, "a.css", "text/css", b":root{}").unwrap_err(),
            StoreError::AlreadyExists { .. }
        ));
        assert!(matches!(
            s.store_variant(ThemeMode::Light, "b.css", "image/png", b"png").unwrap_err(),
            StoreError::InvalidType { .. }
        ));
        assert!(matches!(
            s.store_variant(ThemeMode::Light, "c.css", "text/css", &[b'x'; 2048]).unwrap_err(),
            StoreError::TooLarge { .. }
        ));
    }

    #[test]
    fn select_clear_and_precedence() {
        let (s, _dir) = store_with_config("corp.css", "");
        // Config names a missing file → falls through to built-in.
        assert_eq!(s.effective_variant(ThemeMode::Light), None);
        // Upload the file → config now resolves.
        s.store_variant(ThemeMode::Light, "corp.css", "text/css", b":root{}").expect("store");
        assert_eq!(s.effective_variant(ThemeMode::Light), Some("corp.css".to_string()));
        // Page selection wins over config.
        s.store_variant(ThemeMode::Light, "other.css", "text/css", b":root{}").expect("store");
        s.select_variant(ThemeMode::Light, Some("other.css".to_string())).expect("select");
        assert_eq!(s.effective_variant(ThemeMode::Light), Some("other.css".to_string()));
        // Clearing falls back to config.
        s.select_variant(ThemeMode::Light, None).expect("clear");
        assert_eq!(s.effective_variant(ThemeMode::Light), Some("corp.css".to_string()));
        // Dark mode has no config and no selection → built-in.
        assert_eq!(s.effective_variant(ThemeMode::Dark), None);
    }

    #[test]
    fn select_unknown_variant_is_rejected() {
        let (s, _dir) = store();
        assert!(matches!(
            s.select_variant(ThemeMode::Dark, Some("nope.css".to_string())).unwrap_err(),
            StoreError::UnknownVariant { .. }
        ));
    }

    #[test]
    fn remove_variant_clears_selection() {
        let (s, _dir) = store();
        s.store_variant(ThemeMode::Light, "a.css", "text/css", b":root{}").expect("store");
        s.select_variant(ThemeMode::Light, Some("a.css".to_string())).expect("select");
        s.remove_variant(ThemeMode::Light, "a.css").expect("remove");
        assert_eq!(s.effective_variant(ThemeMode::Light), None);
        assert_eq!(s.selection().light, None);
        assert!(matches!(
            s.remove_variant(ThemeMode::Light, "a.css").unwrap_err(),
            StoreError::UnknownVariant { .. }
        ));
    }

    #[test]
    fn corrupt_selection_file_reads_as_empty() {
        let (s, dir) = store();
        fs::write(dir.path().join(SELECTION_FILE), b"{not json").unwrap();
        assert_eq!(s.selection(), ThemeSelection::default());
        assert_eq!(s.effective_variant(ThemeMode::Light), None);
    }

    #[test]
    fn migration_moves_legacy_files_and_seeds_selection() {
        let (_s, dir) = store();
        // The first store() already migrated (nothing to do); write the
        // legacy layout afterwards and migrate again via a fresh store.
        fs::write(dir.path().join("theme-light"), b":root{--a:1}").unwrap();
        fs::write(dir.path().join("theme-light.meta"), b"text/css").unwrap();
        fs::write(dir.path().join("theme-dark"), b":root{--b:2}").unwrap();
        let s2 = CustomizationStore::new(dir.path().to_path_buf(), 1024, String::new(), String::new());
        assert_eq!(
            s2.list_variants(ThemeMode::Light),
            vec!["theme-light.css".to_string()]
        );
        assert_eq!(
            s2.list_variants(ThemeMode::Dark),
            vec!["theme-dark.css".to_string()]
        );
        assert_eq!(s2.selection().light.as_deref(), Some("theme-light.css"));
        assert_eq!(s2.selection().dark.as_deref(), Some("theme-dark.css"));
        assert!(!dir.path().join("theme-light").exists());
        assert!(!dir.path().join("theme-light.meta").exists());
        let (ctype, bytes) = s2.read_variant(ThemeMode::Light).expect("read").expect("present");
        assert_eq!(ctype, "text/css");
        assert_eq!(bytes, b":root{--a:1}".to_vec());
    }

    #[test]
    fn version_bumps_on_variant_and_selection_changes() {
        let (s, _dir) = store();
        assert_eq!(s.manifest().version, "0");
        s.store_variant(ThemeMode::Light, "a.css", "text/css", b":root{}").expect("store");
        let v1 = s.manifest().version.clone();
        assert_ne!(v1, "0");
        // The version has 1-second granularity (max mtime); wait so the
        // selection file lands in a later second and the bump is visible.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        s.select_variant(ThemeMode::Light, Some("a.css".to_string())).expect("select");
        assert_ne!(s.manifest().version, v1, "selection change must bump the version");
    }

    #[test]
    fn manifest_theme_section_shape() {
        let (s, _dir) = store_with_config("corp.css", "");
        s.store_variant(ThemeMode::Light, "corp.css", "text/css", b":root{}").expect("store");
        let m = s.manifest();
        assert_eq!(m.theme.light.available, vec!["corp.css".to_string()]);
        assert_eq!(m.theme.dark.available, Vec::<String>::new());
        assert_eq!(m.theme.light.source, "config");
        assert_eq!(m.theme.light.selected.as_deref(), Some("corp.css"));
        assert_eq!(m.theme.light.config_selected.as_deref(), Some("corp.css"));
        assert_eq!(m.theme.dark.source, "builtin");
        assert_eq!(m.theme.dark.selected, None);
        assert_eq!(m.theme.dark.config_selected, None);
    }

    #[test]
    fn folders_are_separate_namespaces() {
        let (s, _dir) = store();
        s.store_variant(ThemeMode::Light, "a.css", "text/css", b":root{}")
            .expect("store");
        s.store_variant(ThemeMode::Dark, "a.css", "text/css", b":root{--d:1}")
            .expect("store");
        assert_eq!(s.list_variants(ThemeMode::Light), vec!["a.css".to_string()]);
        assert_eq!(s.list_variants(ThemeMode::Dark), vec!["a.css".to_string()]);
        // Select in both modes so the later read proves the light copy
        // (file and selection) survives the dark removal.
        s.select_variant(ThemeMode::Light, Some("a.css".to_string()))
            .expect("select");
        s.select_variant(ThemeMode::Dark, Some("a.css".to_string()))
            .expect("select");
        // Removing the dark copy leaves the light copy untouched and
        // clears only the dark selection entry.
        s.remove_variant(ThemeMode::Dark, "a.css").expect("remove");
        assert_eq!(s.selection().dark, None);
        let (ctype, bytes) = s.read_variant(ThemeMode::Light).expect("read").expect("present");
        assert_eq!(ctype, "text/css");
        assert_eq!(bytes, b":root{}".to_vec());
        assert!(matches!(
            s.remove_variant(ThemeMode::Dark, "a.css").unwrap_err(),
            StoreError::UnknownVariant { .. }
        ));
    }
}
