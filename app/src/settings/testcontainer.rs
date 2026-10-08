// app/src/settings/testcontainer.rs
//
// [testcontainer] section: opt-in multi-container dev backend
// (kanidm + kanidm-mail-sender + mailpit) on a shared Docker
// network. When enabled, the app starts the containers at startup
// and derives effective [kanidm] settings pointing at the
// container kanidm with real CA verification. Disabled by
// default; production configs are unaffected.

use serde::Deserialize;

/// Default startup mode: detect host vs in-container from the
/// environment.
const DEFAULT_MODE: &str = "auto";

/// Default shared Docker network for the dev containers.
const DEFAULT_NETWORK: &str = "kanidm-admin-dev";

/// Default images, pinned to the kanidm_client version the
/// workspace uses (1.11.1).
const DEFAULT_KANIDM_IMAGE: &str = "kanidm/server:1.11.1";
const DEFAULT_SENDER_IMAGE: &str = "kanidm/tools:1.11.1";
const DEFAULT_MAILPIT_IMAGE: &str = "axllent/mailpit:v1.31.2";

/// Default host port for the mailpit UI — published loopback-only
/// (the UI is reached through the app's /_/mailpit proxy).
const DEFAULT_MAILPIT_UI_PORT: u16 = 8025;

/// Default host-side HTTPS port for the dev kanidm server in host
/// mode: fixed so the effective URL is stable across runs. One
/// above the app's own default port (4000) so both can run
/// side by side.
const DEFAULT_KANIDM_HOST_PORT: u16 = 4001;

/// [testcontainer] table: mode, shared network and the
/// per-container sub-tables. Every field defaults, so absent or
/// partial tables never yield empty strings.
#[derive(Debug, Clone, Deserialize)]
pub struct TestcontainerSettings {
    /// Startup mode: "auto" (detect), "host" or "in-container".
    #[serde(default = "default_mode")]
    pub mode: String,
    /// Shared Docker network the dev containers (and, in
    /// in-container mode, the app itself) join.
    #[serde(default = "default_network")]
    pub network: String,
    /// Kanidm server container settings.
    #[serde(default)]
    pub kanidm: KanidmContainerSettings,
    /// kanidm-mail-sender container settings. The canonical key is
    /// snake_case, matching the config crate's env keys so env
    /// overrides merge cleanly with the TOML layers; the kebab
    /// form is accepted as a serde alias for hand-written TOML.
    /// (A rename + alias pair would make serde reject any config
    /// carrying both key shapes as a duplicate field.)
    #[serde(default, alias = "kanidm-mail-sender")]
    pub kanidm_mail_sender: MailSenderContainerSettings,
    /// Mailpit container settings.
    #[serde(default)]
    pub mailpit: MailpitContainerSettings,
}

impl Default for TestcontainerSettings {
    fn default() -> Self {
        Self {
            mode: default_mode(),
            network: default_network(),
            kanidm: KanidmContainerSettings::default(),
            kanidm_mail_sender: MailSenderContainerSettings::default(),
            mailpit: MailpitContainerSettings::default(),
        }
    }
}

impl TestcontainerSettings {
    /// Fail-fast validation of the enablement chain: mailpit
    /// needs the sender (its smoke test asserts a delivered mail),
    /// the sender needs kanidm (it provisions against it). Error
    /// messages name the TOML tables.
    pub fn validate(&self) -> Result<(), String> {
        if self.mailpit.enabled && !self.kanidm_mail_sender.enabled {
            return Err(
                "[testcontainer.mailpit] requires [testcontainer.kanidm-mail-sender] to be enabled"
                    .to_string(),
            );
        }
        if self.kanidm_mail_sender.enabled && !self.kanidm.enabled {
            return Err(
                "[testcontainer.kanidm-mail-sender] requires [testcontainer.kanidm] to be enabled"
                    .to_string(),
            );
        }
        Ok(())
    }
}

/// [testcontainer.kanidm]: the dev Kanidm server container.
#[derive(Debug, Clone, Deserialize)]
pub struct KanidmContainerSettings {
    /// Start the dev containers at startup (gates the whole
    /// chain).
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Official kanidm/server image to run.
    #[serde(default = "default_kanidm_image")]
    pub image: String,
    /// Host-side HTTPS port the dev server is published on in
    /// host mode (loopback-only). Fixed so the effective URL is
    /// stable across runs.
    #[serde(default = "default_kanidm_host_port")]
    pub host_port: u16,
}

impl Default for KanidmContainerSettings {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            image: default_kanidm_image(),
            host_port: default_kanidm_host_port(),
        }
    }
}

/// [testcontainer.kanidm-mail-sender]: the kanidm-mail-sender
/// container.
#[derive(Debug, Clone, Deserialize)]
pub struct MailSenderContainerSettings {
    /// Start the mail sender (requires kanidm).
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Official kanidm/tools image to run.
    #[serde(default = "default_sender_image")]
    pub image: String,
}

impl Default for MailSenderContainerSettings {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            image: default_sender_image(),
        }
    }
}

/// [testcontainer.mailpit]: the mailpit mail sink container.
#[derive(Debug, Clone, Deserialize)]
pub struct MailpitContainerSettings {
    /// Start mailpit (requires the mail sender).
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Mailpit image to run.
    #[serde(default = "default_mailpit_image")]
    pub image: String,
    /// Host port the mailpit UI is published on (host mode).
    #[serde(default = "default_mailpit_ui_port")]
    pub ui_port: u16,
}

impl Default for MailpitContainerSettings {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            image: default_mailpit_image(),
            ui_port: default_mailpit_ui_port(),
        }
    }
}

fn default_mode() -> String {
    DEFAULT_MODE.to_string()
}

fn default_network() -> String {
    DEFAULT_NETWORK.to_string()
}

fn default_enabled() -> bool {
    false
}

fn default_kanidm_image() -> String {
    DEFAULT_KANIDM_IMAGE.to_string()
}

fn default_kanidm_host_port() -> u16 {
    DEFAULT_KANIDM_HOST_PORT
}

fn default_sender_image() -> String {
    DEFAULT_SENDER_IMAGE.to_string()
}

fn default_mailpit_image() -> String {
    DEFAULT_MAILPIT_IMAGE.to_string()
}

fn default_mailpit_ui_port() -> u16 {
    DEFAULT_MAILPIT_UI_PORT
}

#[cfg(test)]
mod tests {
    use super::*;
    use config::{Config, FileFormat};
    use indoc::indoc;

    /// Deserialize TestcontainerSettings from raw TOML holding the
    /// *contents* of the [testcontainer] table (the loader-level
    /// wrapper is covered by the settings tests).
    fn from_toml(toml: &str) -> Result<TestcontainerSettings, config::ConfigError> {
        Config::builder()
            .add_source(config::File::from_str(toml, FileFormat::Toml))
            .build()?
            .try_deserialize()
    }

    #[test]
    fn absent_tables_yield_real_defaults() {
        let s = from_toml("").expect("empty config deserializes");
        assert_eq!(s.mode, "auto");
        assert_eq!(s.network, "kanidm-admin-dev");
        assert!(!s.kanidm.enabled);
        assert_eq!(s.kanidm.image, "kanidm/server:1.11.1");
        assert_eq!(s.kanidm.host_port, 4001);
        assert!(!s.kanidm_mail_sender.enabled);
        assert_eq!(s.kanidm_mail_sender.image, "kanidm/tools:1.11.1");
        assert!(!s.mailpit.enabled);
        assert_eq!(s.mailpit.image, "axllent/mailpit:v1.31.2");
        assert_eq!(s.mailpit.ui_port, 8025);
    }

    #[test]
    fn partial_sub_tables_fill_field_defaults() {
        let toml = indoc! {r#"
            [kanidm]
            enabled = true
            host_port = 4002

            [mailpit]
            enabled = true
            ui_port = 8026
        "#};
        let s = from_toml(toml).expect("should deserialize");
        assert!(s.kanidm.enabled);
        assert_eq!(s.kanidm.host_port, 4002);
        assert_eq!(
            s.kanidm.image, "kanidm/server:1.11.1",
            "absent image keeps the pinned default"
        );
        assert!(s.mailpit.enabled);
        assert_eq!(s.mailpit.ui_port, 8026);
        assert_eq!(s.mailpit.image, "axllent/mailpit:v1.31.2");
        assert_eq!(s.mode, "auto", "absent scalars keep defaults");
        assert_eq!(s.network, "kanidm-admin-dev");
    }

    #[test]
    fn kebab_sender_alias_parses() {
        let toml = indoc! {r#"
            [kanidm-mail-sender]
            enabled = true
        "#};
        let s = from_toml(toml).expect("kebab alias deserializes");
        assert!(s.kanidm_mail_sender.enabled);
        assert_eq!(s.kanidm_mail_sender.image, "kanidm/tools:1.11.1");
    }

    #[test]
    fn snake_sender_key_parses() {
        let toml = indoc! {r#"
            [kanidm_mail_sender]
            enabled = true
        "#};
        let s = from_toml(toml).expect("snake_case key deserializes");
        assert!(s.kanidm_mail_sender.enabled);
    }

    #[test]
    fn validate_rejects_mailpit_without_sender() {
        let mut s = TestcontainerSettings::default();
        s.kanidm.enabled = true;
        s.mailpit.enabled = true;
        let error = s.validate().expect_err("mailpit requires the sender");
        assert_eq!(
            error,
            "[testcontainer.mailpit] requires [testcontainer.kanidm-mail-sender] to be enabled"
        );
    }

    #[test]
    fn validate_rejects_sender_without_kanidm() {
        let mut s = TestcontainerSettings::default();
        s.kanidm_mail_sender.enabled = true;
        let error = s.validate().expect_err("sender requires kanidm");
        assert_eq!(
            error,
            "[testcontainer.kanidm-mail-sender] requires [testcontainer.kanidm] to be enabled"
        );
    }

    #[test]
    fn validate_accepts_full_chain_and_lesser_combinations() {
        let mut full = TestcontainerSettings::default();
        full.kanidm.enabled = true;
        full.kanidm_mail_sender.enabled = true;
        full.mailpit.enabled = true;
        assert!(full.validate().is_ok());

        let mut kanidm_only = TestcontainerSettings::default();
        kanidm_only.kanidm.enabled = true;
        assert!(kanidm_only.validate().is_ok());

        let mut kanidm_and_sender = TestcontainerSettings::default();
        kanidm_and_sender.kanidm.enabled = true;
        kanidm_and_sender.kanidm_mail_sender.enabled = true;
        assert!(kanidm_and_sender.validate().is_ok());

        assert!(TestcontainerSettings::default().validate().is_ok());
    }
}
