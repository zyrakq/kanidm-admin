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

    [testcontainer]
    mode = "auto"
    network = "kanidm-admin-dev"

    [testcontainer.kanidm]
    enabled = false
    image = "kanidm/server:1.11.1"

    [testcontainer.kanidm_mail_sender]
    enabled = false
    image = "kanidm/tools:1.11.1"

    [testcontainer.mailpit]
    enabled = false
    image = "axllent/mailpit:v1.31.2"
    ui_port = 8025
"#};

const DEV_TOML: &str = indoc! {r#"
    [frontend]
    serve_from = "disk"
    watch = true

    [testcontainer.kanidm]
    enabled = true

    [testcontainer.kanidm_mail_sender]
    enabled = true

    [testcontainer.mailpit]
    enabled = true
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

#[test]
fn testcontainer_base_defaults_are_correct() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    assert_eq!(s.testcontainer.mode, "auto");
    assert_eq!(s.testcontainer.network, "kanidm-admin-dev");
    assert!(!s.testcontainer.kanidm.enabled);
    assert_eq!(s.testcontainer.kanidm.image, "kanidm/server:1.11.1");
    assert!(!s.testcontainer.kanidm_mail_sender.enabled);
    assert_eq!(
        s.testcontainer.kanidm_mail_sender.image,
        "kanidm/tools:1.11.1"
    );
    assert!(!s.testcontainer.mailpit.enabled);
    assert_eq!(s.testcontainer.mailpit.image, "axllent/mailpit:v1.31.2");
    assert_eq!(s.testcontainer.mailpit.ui_port, 8025);
}

#[test]
fn dev_overlay_enables_the_mail_chain() {
    let s = settings_from_toml(BASE_TOML, DEV_TOML).expect("should deserialize");
    assert!(
        s.testcontainer.kanidm.enabled,
        "development overlay enables the kanidm container"
    );
    assert!(
        s.testcontainer.kanidm_mail_sender.enabled,
        "development overlay enables the mail sender"
    );
    assert!(
        s.testcontainer.mailpit.enabled,
        "development overlay enables mailpit"
    );
    // Non-overridden fields keep the base values.
    assert_eq!(s.testcontainer.mailpit.ui_port, 8025);
    assert_eq!(s.testcontainer.kanidm.image, "kanidm/server:1.11.1");
}

#[test]
fn absent_testcontainer_section_yields_defaults() {
    // BASE_TOML minus every [testcontainer] table: the serde
    // default on the Settings field fills real defaults.
    let base = indoc! {r#"
        [server]
        address = "0.0.0.0:4000"

        [frontend]
        serve_from = "disk"
        watch = false
        public_dir = ""

        [kanidm]
        url = "https://kanidm.example.com"
    "#};
    let s = settings_from_toml(base, "").expect("should deserialize");
    assert!(!s.testcontainer.kanidm.enabled);
    assert_eq!(s.testcontainer.mode, "auto");
    assert_eq!(s.testcontainer.network, "kanidm-admin-dev");
    assert_eq!(s.testcontainer.mailpit.ui_port, 8025);
}

#[test]
fn env_var_disables_kanidm_testcontainer() {
    let env = HashMap::from([(
        "APP_TESTCONTAINER__KANIDM__ENABLED".to_string(),
        "false".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, DEV_TOML, Some(env)).expect("should deserialize");
    assert!(
        !s.testcontainer.kanidm.enabled,
        "APP_TESTCONTAINER__KANIDM__ENABLED=false should override the development overlay"
    );
}

#[test]
fn env_var_enables_sender_through_snake_alias() {
    // Config env keys are snake_case; the kebab-renamed TOML key
    // resolves through its snake_case serde alias.
    let env = HashMap::from([(
        "APP_TESTCONTAINER__KANIDM_MAIL_SENDER__ENABLED".to_string(),
        "true".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert!(
        s.testcontainer.kanidm_mail_sender.enabled,
        "APP_TESTCONTAINER__KANIDM_MAIL_SENDER__ENABLED should reach the kebab-renamed field"
    );
}

#[test]
fn env_var_overrides_mailpit_ui_port() {
    let env = HashMap::from([(
        "APP_TESTCONTAINER__MAILPIT__UI_PORT".to_string(),
        "8026".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, DEV_TOML, Some(env)).expect("should deserialize");
    assert_eq!(
        s.testcontainer.mailpit.ui_port, 8026,
        "APP_TESTCONTAINER__MAILPIT__UI_PORT should override the base value"
    );
}

#[test]
fn env_var_overrides_mode() {
    let env = HashMap::from([(
        "APP_TESTCONTAINER__MODE".to_string(),
        "host".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, DEV_TOML, Some(env)).expect("should deserialize");
    assert_eq!(
        s.testcontainer.mode, "host",
        "APP_TESTCONTAINER__MODE should override the base value"
    );
}

// --- [customization] section ----------------------------------------------

#[test]
fn customization_defaults_when_section_absent() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    assert_eq!(s.customization.dir, "", "dir should default to empty");
    assert_eq!(
        s.customization.max_size_bytes, 512 * 1024,
        "max_size_bytes should default to 512 KiB"
    );
    assert_eq!(
        s.customization.effective_dir(std::path::Path::new("/tmp/manifest")),
        std::path::PathBuf::from("/tmp/manifest/customization"),
        "empty dir should resolve to <manifest>/customization"
    );
}

#[test]
fn customization_overlay_parses() {
    let overlay = indoc! {r#"
        [customization]
        dir = "/srv/customization"
        max_size_bytes = 1048576
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(s.customization.dir, "/srv/customization");
    assert_eq!(s.customization.max_size_bytes, 1048576);
    assert_eq!(
        s.customization.effective_dir(std::path::Path::new("/tmp/manifest")),
        std::path::PathBuf::from("/srv/customization"),
        "set dir should resolve to the literal path"
    );
}

#[test]
fn env_var_overrides_customization_dir() {
    let env = HashMap::from([(
        "APP_CUSTOMIZATION__DIR".to_string(),
        "/var/lib/customization".to_string(),
    )]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert_eq!(
        s.customization.effective_dir(std::path::Path::new("/tmp/manifest")),
        std::path::PathBuf::from("/var/lib/customization"),
        "APP_CUSTOMIZATION__DIR should override the default dir"
    );
}

#[test]
fn customization_theme_defaults_when_absent() {
    let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
    assert_eq!(s.customization.theme.light, "", "theme.light should default to empty");
    assert_eq!(s.customization.theme.dark, "", "theme.dark should default to empty");
}

#[test]
fn customization_theme_overlay_parses() {
    let overlay = indoc! {r#"
        [customization]
        dir = "/srv/customization"

        [customization.theme]
        light = "corporate.css"
        dark = "night.css"
    "#};
    let s = settings_from_toml(BASE_TOML, overlay).expect("should deserialize");
    assert_eq!(s.customization.dir, "/srv/customization");
    assert_eq!(s.customization.theme.light, "corporate.css");
    assert_eq!(s.customization.theme.dark, "night.css");
}

#[test]
fn env_var_overrides_customization_theme() {
    let env = HashMap::from([
        (
            "APP_CUSTOMIZATION__THEME__LIGHT".to_string(),
            "corporate.css".to_string(),
        ),
        (
            "APP_CUSTOMIZATION__THEME__DARK".to_string(),
            "night.css".to_string(),
        ),
    ]);
    let s = settings_from_layers(BASE_TOML, "", Some(env)).expect("should deserialize");
    assert_eq!(
        s.customization.theme.light, "corporate.css",
        "APP_CUSTOMIZATION__THEME__LIGHT should override the default"
    );
    assert_eq!(
        s.customization.theme.dark, "night.css",
        "APP_CUSTOMIZATION__THEME__DARK should override the default"
    );
}
