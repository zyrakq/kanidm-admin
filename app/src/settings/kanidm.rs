// app/src/settings/kanidm.rs
//
// [kanidm] section: connection settings for the Kanidm server the
// admin panel proxies to. Required section — the panel is useless
// without a Kanidm instance.

use serde::Deserialize;

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
