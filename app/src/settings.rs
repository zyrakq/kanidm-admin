// app/src/settings.rs

use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
    pub frontend: FrontendSettings,
}

#[derive(Debug, Deserialize)]
pub struct ServerSettings {
    pub address: String,
}

#[derive(Debug, Deserialize)]
pub struct FrontendSettings {
    pub build: bool,
    pub watch: bool,
    /// Empty string means "derive from CARGO_MANIFEST_DIR at runtime in main.rs".
    pub public_dir: String,
}

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

impl FrontendSettings {
    /// Resolve the directory from which static frontend assets are served.
    ///
    /// Uses `public_dir` when set; falls back to `<manifest_dir>/ui/dist`.
    pub fn resolve_public_dir(&self, manifest_dir: &std::path::Path) -> std::path::PathBuf {
        if self.public_dir.is_empty() {
            manifest_dir.join("ui/dist")
        } else {
            std::path::PathBuf::from(&self.public_dir)
        }
    }
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

impl Settings {
    /// Load layered configuration.
    ///
    /// Layer order (each overrides the previous):
    ///   1. `appsettings.toml`            - required base defaults
    ///   2. `appsettings.{APP_ENV}.toml`  - optional env-specific overrides
    ///   3. `appsettings.local.toml`      - optional personal overrides (gitignored)
    ///   4. `APP_*` environment variables - runtime overrides (`APP_SERVER__ADDRESS`)
    ///
    /// `APP_ENV` defaults to `"development"` when not set.
    pub fn load() -> Result<Self, ConfigError> {
        let env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        let manifest_dir = env!("CARGO_MANIFEST_DIR");

        let config = Config::builder()
            // Layer 1: base defaults (required)
            .add_source(
                File::with_name(&format!("{manifest_dir}/appsettings")).required(true),
            )
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use config::{Config, FileFormat};
    use indoc::indoc;

    /// Build a Settings from raw TOML strings without touching the filesystem.
    fn settings_from_toml(base: &str, overlay: &str) -> Result<Settings, ConfigError> {
        Config::builder()
            .add_source(config::File::from_str(base, FileFormat::Toml))
            .add_source(config::File::from_str(overlay, FileFormat::Toml))
            .build()?
            .try_deserialize()
    }

    const BASE_TOML: &str = indoc! {r#"
        [server]
        address = "0.0.0.0:4000"

        [frontend]
        build = false
        watch = false
        public_dir = ""
    "#};

    const DEV_TOML: &str = indoc! {r#"
        [frontend]
        watch = true
    "#};

    const PROD_TOML: &str = indoc! {r#"
        [frontend]
        build = true
    "#};

    #[test]
    fn development_env_enables_watch_disables_build() {
        let s = settings_from_toml(BASE_TOML, DEV_TOML).expect("should deserialize");
        assert!(s.frontend.watch, "watch should be true in development");
        assert!(!s.frontend.build, "build should be false in development");
    }

    #[test]
    fn production_env_enables_build_disables_watch() {
        let s = settings_from_toml(BASE_TOML, PROD_TOML).expect("should deserialize");
        assert!(s.frontend.build, "build should be true in production");
        assert!(!s.frontend.watch, "watch should be false in production");
    }

    #[test]
    fn base_defaults_are_correct() {
        let s = settings_from_toml(BASE_TOML, "").expect("should deserialize");
        assert_eq!(s.server.address, "0.0.0.0:4000");
        assert!(!s.frontend.build);
        assert!(!s.frontend.watch);
        assert_eq!(s.frontend.public_dir, "");
    }

    #[test]
    fn env_var_overrides_production_build_flag() {
        // Set a real env var and verify it overrides the TOML value via the
        // Environment source (prefix="APP", prefix_separator="_", separator="__").
        std::env::set_var("APP_FRONTEND__BUILD", "false");
        let s = Config::builder()
            .add_source(config::File::from_str(BASE_TOML, FileFormat::Toml))
            .add_source(config::File::from_str(PROD_TOML, FileFormat::Toml))
            .add_source(
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__")
                    .try_parsing(true),
            )
            .build()
            .unwrap()
            .try_deserialize::<Settings>()
            .expect("should deserialize");
        std::env::remove_var("APP_FRONTEND__BUILD");
        assert!(!s.frontend.build, "env var should override production build=true");
    }

    #[test]
    fn missing_optional_overlay_does_not_panic() {
        // Empty overlay simulates a missing optional file - must not error
        let result = settings_from_toml(BASE_TOML, "");
        assert!(result.is_ok(), "missing optional overlay must not panic or error");
    }
}
