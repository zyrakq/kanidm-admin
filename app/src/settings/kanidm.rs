// app/src/settings/kanidm.rs
//
// [kanidm] section: connection settings for the Kanidm server the
// admin panel proxies to. Required section — the panel is useless
// without a Kanidm instance.

use serde::Deserialize;
use tracing::info;

// Clone: kanidm_container::start returns an owned copy of these
// settings in the disabled (non-container) path.
#[derive(Debug, Clone, Deserialize)]
pub struct KanidmSettings {
    /// Base URL of the Kanidm server, e.g. `https://idm.example.com:8443`.
    pub url: String,
    /// Optional PEM file with the CA certificate that signed the Kanidm
    /// server certificate (for servers with a self-hosted CA).
    /// Empty string is treated as unset.
    pub ca_path: Option<String>,
    /// Verify the server TLS certificate against the system CA store or
    /// `ca_path`. Defaults to `true`; disable only for development.
    #[serde(default = "default_verify_ca")]
    pub verify_ca: bool,
}

fn default_verify_ca() -> bool {
    true
}

impl KanidmSettings {
    /// Log the effective connection config (url, ca_path, verify_ca)
    /// as one structured `info!` line. Called from `main` on the value
    /// returned by `kanidm_container::start`, i.e. after env overrides
    /// and container-mode substitution have been resolved, so the
    /// values shown are the ones the app actually connects with.
    pub fn log_effective_config(&self) {
        info!(
            url = %self.url,
            ca_path = %self.ca_path_display(),
            verify_ca = self.verify_ca,
            "Kanidm effective config"
        );
    }

    /// Display form of `ca_path` for logs: `None` and the empty string
    /// both mean unset (the client falls back to the system trust
    /// store) and render as "not set"; any other value is verbatim.
    pub(crate) fn ca_path_display(&self) -> &str {
        match self.ca_path.as_deref() {
            Some(path) if !path.is_empty() => path,
            _ => "not set",
        }
    }
}
