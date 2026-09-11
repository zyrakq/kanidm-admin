// app/src/settings/avatars.rs
//
// Local person avatar storage settings. Kanidm has no person image
// attribute, so avatars live on our backend's disk under `dir`.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct AvatarSettings {
    /// Directory holding `{uuid}.{ext}` avatar files.
    ///
    /// Empty string means "derive from CARGO_MANIFEST_DIR at runtime"
    /// (`<manifest_dir>/data/avatars`); absolute paths are used as-is
    /// (same resolution contract as `frontend.public_dir`).
    #[serde(default)]
    pub dir: String,
}

impl Default for AvatarSettings {
    fn default() -> Self {
        Self {
            dir: String::new(),
        }
    }
}

impl AvatarSettings {
    /// Resolve the avatar storage directory.
    pub fn resolve_dir(&self, manifest_dir: &std::path::Path) -> std::path::PathBuf {
        if self.dir.is_empty() {
            manifest_dir.join("data/avatars")
        } else {
            std::path::PathBuf::from(&self.dir)
        }
    }
}
