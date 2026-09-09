use super::loader::Settings;
use config::{Config, ConfigError, Environment, FileFormat};
use indoc::indoc;
use std::collections::HashMap;

/// Build a Settings from raw TOML strings without touching the filesystem.
fn settings_from_toml(base: &str, overlay: &str) -> Result<Settings, ConfigError> {
    settings_from_layers(base, overlay, None)
}

/// Build a Settings from TOML layers plus an optional injected environment.
///
/// The env layer uses the real `Environment` source (same prefix, separator
/// and parsing rules as the loader) with variables supplied by the caller
/// via `Environment::source`, so tests never mutate the process
/// environment and are safe to run in parallel.
fn settings_from_layers(
    base: &str,
    overlay: &str,
    env_vars: Option<HashMap<String, String>>,
) -> Result<Settings, ConfigError> {
    let mut builder = Config::builder()
        .add_source(config::File::from_str(base, FileFormat::Toml))
        .add_source(config::File::from_str(overlay, FileFormat::Toml));

    if let Some(vars) = env_vars {
        builder = builder.add_source(
            Environment::with_prefix("APP")
                .prefix_separator("_")
                .separator("__")
                .try_parsing(true)
                .source(Some(vars)),
        );
    }

    builder.build()?.try_deserialize()
}

const BASE_TOML: &str = indoc! {r#"
    [server]
    address = "0.0.0.0:4000"

    [frontend]
    serve_from = "disk"
    watch = false
    public_dir = ""

    [kanidm]
    url = "https://kanidm.example.com"
"#};

const DEV_TOML: &str = indoc! {r#"
    [frontend]
    serve_from = "disk"
    watch = true
"#};

const PROD_TOML: &str = indoc! {r#"
    [frontend]
    serve_from = "embedded"
"#};

#[test]
fn development_env_enables_watch_in_disk_mode() {
    let s = settings_from_toml(BASE_TOML, DEV_TOML).expect("should deserialize");
    assert!(s.frontend.watch, "watch should be true in development");
    assert_eq!(
        s.frontend.effective_serve_from(),
        "disk",
        "development should serve from disk"
    );
}

#[test]
fn production_env_uses_embedded_serve_mode() {
    let s = settings_from_toml(BASE_TOML, PROD_TOML).expect("should deserialize");
    assert_eq!(
        s.frontend.effective_serve_from(),
        "embedded",
        "production should serve from embedded assets"
    );
    assert!(!s.frontend.watch, "watch should be false in production");
}

#[test]
fn base_defaults_are_correct() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    assert_eq!(s.server.address, "0.0.0.0:4000");
    assert_eq!(s.frontend.effective_serve_from(), "disk");
    assert!(!s.frontend.watch);
    assert_eq!(s.frontend.public_dir, "");
}

#[test]
fn missing_optional_overlay_does_not_panic() {
    let result = settings_from_toml(BASE_TOML, "");
    assert!(
        result.is_ok(),
        "missing optional overlay must not panic or error"
    );
}

#[test]
fn serve_from_defaults_to_disk_when_absent() {
    // A base with no serve_from in [frontend] - exercises the serde default.
    let base = indoc! {r#"
        [server]
        address = "0.0.0.0:4000"

        [frontend]
        watch = false
        public_dir = ""

        [kanidm]
        url = "https://kanidm.example.com"
    "#};
    let s = settings_from_toml(base, "").expect("should deserialize");
    assert_eq!(
        s.frontend.serve_from, "disk",
        "absent serve_from should default to disk via serde default"
    );
    assert_eq!(s.frontend.effective_serve_from(), "disk");
}

#[test]
fn serve_from_empty_string_is_treated_as_disk() {
    let overlay = indoc! {r#"
        [frontend]
        serve_from = ""
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(
        s.frontend.effective_serve_from(),
        "disk",
        "empty serve_from should be treated as disk"
    );
}

#[test]
fn serve_from_embedded_parses() {
    let overlay = indoc! {r#"
        [frontend]
        serve_from = "embedded"
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(s.frontend.serve_from, "embedded");
    assert_eq!(s.frontend.effective_serve_from(), "embedded");
}

#[test]
fn env_var_overrides_serve_from() {
    let env = HashMap::from([(
        "APP_FRONTEND__SERVE_FROM".to_string(),
        "embedded".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, DEV_TOML, Some(env)).expect("should deserialize");
    assert_eq!(
        s.frontend.effective_serve_from(),
        "embedded",
        "APP_FRONTEND__SERVE_FROM should override the TOML value"
    );
}

#[test]
fn env_var_overrides_watch() {
    let env = HashMap::from([(
        "APP_FRONTEND__WATCH".to_string(),
        "false".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, DEV_TOML, Some(env)).expect("should deserialize");
    assert!(
        !s.frontend.watch,
        "APP_FRONTEND__WATCH=false should override development watch=true"
    );
}

#[test]
fn env_var_sets_server_address() {
    let env = HashMap::from([(
        "APP_SERVER__ADDRESS".to_string(),
        "127.0.0.1:9999".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert_eq!(
        s.server.address, "127.0.0.1:9999",
        "APP_SERVER__ADDRESS should set server.address"
    );
}

#[test]
fn public_dir_empty_resolves_to_manifest_ui_dist() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    let manifest = std::path::Path::new("/tmp/manifest");
    assert_eq!(
        s.frontend.resolve_public_dir(manifest),
        manifest.join("ui/dist"),
        "empty public_dir should resolve to <manifest>/ui/dist"
    );
}

#[test]
fn public_dir_set_resolves_to_literal_path() {
    let overlay = indoc! {r#"
        [frontend]
        public_dir = "/srv/static"
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(
        s.frontend.resolve_public_dir(std::path::Path::new("/tmp/manifest")),
        std::path::PathBuf::from("/srv/static"),
        "set public_dir should resolve to the literal path"
    );
}

#[test]
fn kanidm_defaults_verify_ca_and_no_ca() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    assert_eq!(s.kanidm.url, "https://kanidm.example.com");
    assert!(s.kanidm.verify_ca, "verify_ca should default to true");
    assert_eq!(s.kanidm.ca_path, None, "ca_path should default to None");
}

#[test]
fn kanidm_ca_path_overlay_parses() {
    let overlay = indoc! {r#"
        [kanidm]
        ca_path = "/etc/kanidm/ca.pem"
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(
        s.kanidm.ca_path.as_deref(),
        Some("/etc/kanidm/ca.pem"),
        "overlay ca_path should parse"
    );
}

#[test]
fn env_var_overrides_kanidm_url() {
    let env = HashMap::from([(
        "APP_KANIDM__URL".to_string(),
        "https://idm.local:8443".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert_eq!(
        s.kanidm.url, "https://idm.local:8443",
        "APP_KANIDM__URL should override the TOML value"
    );
}

#[test]
fn env_var_disables_verify_ca() {
    let env = HashMap::from([(
        "APP_KANIDM__VERIFY_CA".to_string(),
        "false".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert!(
        !s.kanidm.verify_ca,
        "APP_KANIDM__VERIFY_CA=false should disable CA verification"
    );
}

#[test]
fn missing_kanidm_section_is_rejected() {
    let base = indoc! {r#"
        [server]
        address = "0.0.0.0:4000"

        [frontend]
        serve_from = "disk"
        watch = false
        public_dir = ""
    "#};
    let result = settings_from_toml(base, "");
    assert!(
        result.is_err(),
        "missing [kanidm] must fail deserialization (url is required)"
    );
}
