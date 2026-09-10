// app/src/settings/kanidm_container.rs
//
// [kanidm_container] section: opt-in ephemeral Kanidm container for
// development. When enabled, the app runs the official kanidm/server
// image (a one-shot cert-generate container, then the server),
// recovers the built-in admin/idm_admin credentials and derives
// effective [kanidm] settings pointing at the container with real CA
// verification. Disabled by default; production configs are
// unaffected.

use serde::Deserialize;

/// Default image, pinned to the kanidm_client version the workspace
/// uses (1.11.1).
const DEFAULT_IMAGE: &str = "kanidm/server:1.11.1";

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct KanidmContainerSettings {
    /// Start the ephemeral dev Kanidm container at startup.
    pub enabled: bool,
    /// Official kanidm/server image to run (e.g.
    /// `kanidm/server:1.11.1`). Empty string falls back to the pinned
    /// default.
    pub image: String,
}

impl Default for KanidmContainerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            image: DEFAULT_IMAGE.to_string(),
        }
    }
}

impl KanidmContainerSettings {
    /// Image tag, treating an empty string as unset (same
    /// empty-means-default convention as `frontend.public_dir`).
    pub fn effective_image(&self) -> &str {
        if self.image.is_empty() {
            DEFAULT_IMAGE
        } else {
            &self.image
        }
    }
}
