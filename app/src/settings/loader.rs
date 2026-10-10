use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;

#[cfg(feature = "customization")]
use super::customization::CustomizationSettings;
use super::frontend::FrontendSettings;
use super::kanidm::KanidmSettings;
use super::server::ServerSettings;
#[cfg(feature = "testcontainer")]
use super::testcontainer::TestcontainerSettings;

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
    pub frontend: FrontendSettings,
    pub kanidm: KanidmSettings,
    /// Optional: uploaded customization files and theme variants.
    #[cfg(feature = "customization")]
    #[serde(default)]
    pub customization: CustomizationSettings,
    /// Optional: ephemeral dev containers (kanidm + the mail
    /// chain). An absent section means defaults (disabled); see
    /// settings/testcontainer.rs.
    #[cfg(feature = "testcontainer")]
    #[serde(default)]
    pub testcontainer: TestcontainerSettings,
}

impl Settings {
    /// Load layered configuration.
    ///
    /// Layer order (each overrides the previous):
    ///   1. `appsettings.toml`            - required base defaults
    ///   2. `appsettings.{APP_ENV}.toml`  - optional env-specific overrides
    ///   3. `appsettings.local.toml`     - optional personal overrides (gitignored)
    ///   4. `APP_*` environment variables - runtime overrides (`APP_SERVER__ADDRESS`)
    ///
    /// `APP_ENV` defaults to `"development"` when not set.
    ///
    /// Future optional sections should be added as `#[serde(default)]`
    /// fields here; required sections must stay present in the required
    /// base `appsettings.toml`.
    pub fn load() -> Result<Self, ConfigError> {
        let env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        let manifest_dir = env!("CARGO_MANIFEST_DIR");

        let config = Config::builder()
            // Layer 1: base defaults (required)
            .add_source(File::with_name(&format!("{manifest_dir}/appsettings")).required(true))
            // Layer 2: environment-specific overrides (optional)
            .add_source(
                File::with_name(&format!("{manifest_dir}/appsettings.{env}")).required(false),
            )
            // Layer 3: personal local overrides (optional, gitignored)
            .add_source(
                File::with_name(&format!("{manifest_dir}/appsettings.local")).required(false),
            )
            // Layer 4: environment variables  APP_SERVER__ADDRESS -> server.address
            .add_source(
                Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__")
                    .try_parsing(true),
            )
            .build()?;

        config.try_deserialize()
    }
}
