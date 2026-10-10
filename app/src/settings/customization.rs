// app/src/settings/customization.rs
//
// [customization] section: directory and size limit for UI-uploaded
// logo and favicon overrides, plus the theme-variant file names
// ([customization.theme]) that act as the deployment default for the
// light/dark override stylesheets. Optional section — absent means
// defaults (the `customization/` directory next to the manifest,
// 512 KiB per upload, no theme file names), following the same
// `#[serde(default)]` + `Default` pattern as kanidm_container.rs.
//
// [customization.page] toggles the standalone customization page
// (management API + footer link); enabled by default.

use serde::Deserialize;

/// Default directory name, resolved relative to the crate manifest dir.
const DEFAULT_DIR: &str = "customization";

/// Default per-slot upload size limit: 512 KiB is plenty for an SVG
/// logo, a favicon PNG or a CSS theme variant.
const DEFAULT_MAX_SIZE_BYTES: i64 = 512 * 1024;

/// Deployment-default theme variant file names. Values are file names
/// only (no path) — the `themes/` subdirectory of the customization
/// dir is implied. Empty string means unset.
#[derive(Debug, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct ThemeSettings {
    /// Variant file name for the light mode override, e.g. "corporate.css".
    pub light: String,
    /// Variant file name for the dark mode override.
    pub dark: String,
}

/// Standalone customization page toggle (`[customization.page]`).
/// Controls only the mutating management surface: the upload/remove/
/// selection `/api/customization*` routes and the footer link. The
/// read-only manifest and asset serving (`GET /customization/{slot}`)
/// are never gated — the site header logo, login page and favicon
/// resolve their overrides through the manifest on every page.
#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct PageSettings {
    /// Whether the standalone customization page is enabled.
    pub enabled: bool,
}

impl Default for PageSettings {
    fn default() -> Self {
        // Enabled by default: preserves the pre-flag behavior for
        // existing deployments whose TOML files never mention the key.
        Self { enabled: true }
    }
}

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct CustomizationSettings {
    /// Directory where uploaded customization files are stored. Empty
    /// string falls back to `<manifest_dir>/customization/` (same
    /// empty-means-default convention as `frontend.public_dir`).
    pub dir: String,
    /// Maximum accepted upload size per slot, in bytes.
    pub max_size_bytes: i64,
    /// Deployment-default theme variant names (`[customization.theme]`).
    pub theme: ThemeSettings,
    /// Standalone page toggle (`[customization.page]`).
    pub page: PageSettings,
}

impl Default for CustomizationSettings {
    fn default() -> Self {
        Self {
            dir: String::new(),
            max_size_bytes: DEFAULT_MAX_SIZE_BYTES,
            theme: ThemeSettings::default(),
            page: PageSettings::default(),
        }
    }
}

impl CustomizationSettings {
    /// Storage directory, treating an empty string as unset.
    pub fn effective_dir(&self, manifest_dir: &std::path::Path) -> std::path::PathBuf {
        if self.dir.is_empty() {
            manifest_dir.join(DEFAULT_DIR)
        } else {
            std::path::PathBuf::from(&self.dir)
        }
    }
}
