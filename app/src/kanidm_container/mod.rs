// app/src/kanidm_container/mod.rs
//
// Single responsibility: provide a running, provisioned, disposable
// Kanidm server for development. When [kanidm_container].enabled is
// false, `start` is a pass-through of the [kanidm] settings, so the
// production startup path is unchanged.
//
// Container mode runs the official kanidm/server image twice: a
// one-shot cert-generate container, then the server seeded with the
// generated TLS material. The generated CA is written to a temp file
// (the closest to in-memory the public kanidm_client API allows:
// add_root_certificate_filepath parses the file at call time), the
// effective settings point at the container with REAL verification,
// and a smoke auth proves the chain end-to-end before serving.

pub mod image;
pub mod provision;

use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use testcontainers::{ContainerAsync, GenericImage};
use tracing::{info, warn};

use crate::settings::kanidm::KanidmSettings;
use crate::settings::kanidm_container::KanidmContainerSettings;
use crate::settings::loader::Settings;

/// Temp CA file name prefix; the full name is
/// `kanidm-admin-dev-ca-{pid}-{nanos}.pem` in the system temp dir.
/// Holds a PUBLIC CA certificate (not a key), mode 0600, deleted when
/// the handle drops.
const TEMP_CA_PREFIX: &str = "kanidm-admin-dev-ca-";
const TEMP_CA_SUFFIX: &str = ".pem";

/// Process-lifetime handle for the dev Kanidm container, mirroring
/// `frontend::FrontendHandle`. Dropping the handle removes the
/// container and the temp CA file; the testcontainers `watchdog`
/// feature additionally removes the container on
/// SIGTERM/SIGINT/SIGQUIT (Ctrl-C). SIGKILL can orphan both — the
/// container carries the label `kanidm-admin.dev=true` so it can be
/// found and pruned manually; an orphaned temp CA file is harmless
/// (public cert) and prunable with `rm /tmp/kanidm-admin-dev-ca-*.pem`.
#[allow(dead_code)]
pub enum KanidmHandle {
    /// Container mode disabled — nothing to keep alive.
    Disabled,
    /// Running dev container + the temp CA file backing the effective
    /// settings; both removed when dropped.
    Container {
        container: ContainerAsync<GenericImage>,
        temp_ca: PathBuf,
    },
}

impl Drop for KanidmHandle {
    fn drop(&mut self) {
        if let KanidmHandle::Container { temp_ca, .. } = self {
            remove_temp_ca(temp_ca);
        }
    }
}

/// Resolve the Kanidm settings the app connects with.
///
/// Container mode: run the dev containers, recover the built-in
/// accounts, and return effective settings pointing at the container
/// (the [kanidm] section is ignored with a warning). Disabled mode:
/// pass [kanidm] through unchanged.
pub async fn start(
    settings: &Settings,
) -> Result<(KanidmSettings, KanidmHandle), Box<dyn std::error::Error + Send + Sync>> {
    if !settings.kanidm_container.enabled {
        return Ok((settings.kanidm.clone(), KanidmHandle::Disabled));
    }
    warn!("[kanidm] url/verify_ca/ca_path are ignored in container mode");
    start_container(&settings.kanidm_container).await
}

/// Run the dev containers and derive the effective settings.
/// Separate from `start` so the Docker-gated test can run it without
/// a full Settings layer.
async fn start_container(
    settings: &KanidmContainerSettings,
) -> Result<(KanidmSettings, KanidmHandle), Box<dyn std::error::Error + Send + Sync>> {
    let server = image::run_server(settings.effective_image()).await?;

    let credentials = provision::recover_builtin_credentials(&server.container).await?;

    // The temp CA file must outlive this function: main.rs builds the
    // auth state from the returned settings AFTER start() returns,
    // and the client builder parses the CA from the file at that
    // point. The handle deletes it on drop (app shutdown).
    let temp_ca = write_temp_ca(&server.ca_pem)?;
    let effective = provision::effective_settings(server.port, &temp_ca.to_string_lossy());

    provision::log_dev_credentials(&effective.url, &credentials);
    provision::smoke_auth(&effective, &credentials.idm_admin_password).await?;

    info!(url = %effective.url, "dev Kanidm container ready");
    Ok((
        effective,
        KanidmHandle::Container {
            container: server.container,
            temp_ca,
        },
    ))
}

/// Write the container-generated CA to a temp file for
/// `add_root_certificate_filepath`. The kanidm_client public API has
/// no in-memory CA setter, so this brief file is the bridge: it holds
/// a PUBLIC certificate (not a key), is created with O_EXCL semantics
/// (`create_new`) and mode 0600, and is deleted when the handle
/// drops. The builder parses the file at call time, so it only needs
/// to exist while the auth state is constructed in main.
fn write_temp_ca(ca_pem: &[u8]) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let path = temp_ca_path();
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)
        .and_then(|mut file| std::io::Write::write_all(&mut file, ca_pem))
        .map_err(|error| format!("failed to write the dev CA to {}: {error}", path.display()))?;
    Ok(path)
}

/// Unique temp CA path: `kanidm-admin-dev-ca-{pid}-{nanos}.pem` in
/// the system temp dir. Uniqueness avoids collisions between
/// concurrent dev runs; `create_new` fails loudly if the path
/// somehow exists.
fn temp_ca_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!(
        "{TEMP_CA_PREFIX}{}-{nanos}{TEMP_CA_SUFFIX}",
        std::process::id()
    ))
}

/// Delete the temp CA file. Best-effort: failure is logged as a
/// warning, never fatal (the file holds a public cert).
fn remove_temp_ca(path: &Path) {
    if let Err(error) = std::fs::remove_file(path) {
        warn!(
            "failed to remove the temp CA file {}: {error}",
            path.display()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temp_ca_file_is_private_and_round_trips() {
        let ca_pem = b"-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n";
        let path = write_temp_ca(ca_pem).expect("temp CA file should be written");

        // Unique name with the expected prefix.
        assert!(path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(TEMP_CA_PREFIX)));

        // Content round-trips.
        assert_eq!(std::fs::read(&path).expect("file readable"), ca_pem);

        // Mode 0600 (owner read/write only) — add_root_certificate_
        // filepath's permission check warns on anything looser.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path)
                .expect("metadata readable")
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }

        remove_temp_ca(&path);
        assert!(!path.exists(), "temp CA file removed");
    }

    #[test]
    fn remove_temp_ca_does_not_panic_on_missing_file() {
        let path = std::env::temp_dir().join("kanidm-admin-dev-ca-does-not-exist.pem");
        remove_temp_ca(&path); // must not panic
    }

    /// Full flow against a real Docker daemon: both containers,
    /// credential recovery, REAL TLS verification via the production
    /// client path, and temp CA cleanup on drop. Ignored by default
    /// (needs Docker); run explicitly with `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "requires a running Docker daemon"]
    async fn container_starts_with_real_certificate_verification() {
        let settings = KanidmContainerSettings::default();

        let (effective, handle) = start_container(&settings)
            .await
            .expect("container should start and provision");

        // Real verification is the point of v2: the effective
        // settings carry the temp CA and verify_ca = true.
        assert!(
            effective.verify_ca,
            "effective settings must verify the CA"
        );
        let ca_path = effective.ca_path.as_deref().expect("temp CA path");
        assert!(
            Path::new(ca_path).exists(),
            "temp CA file exists while the handle is alive"
        );

        // Production client path: the builder parses the CA from the
        // temp file, the client performs REAL TLS verification.
        let builder = crate::auth::ops::client_builder_from_settings(&effective)
            .expect("client builder from effective settings");
        let client = builder.build().expect("client should build");

        // Re-recover idm_admin on the live container (recover-account
        // issues a fresh random password per call) and authenticate
        // with it through the production path.
        let credentials = match &handle {
            KanidmHandle::Container { container, .. } => {
                provision::recover_builtin_credentials(container)
                    .await
                    .expect("re-recover credentials on the live container")
            }
            KanidmHandle::Disabled => panic!("container mode must return a Container handle"),
        };
        client
            .auth_simple_password(provision::IDM_ADMIN_USERNAME, &credentials.idm_admin_password)
            .await
            .expect("idm_admin should authenticate with real TLS verification");

        // Dropping the handle deletes the temp CA file (the container
        // itself is removed by ContainerAsync's own Drop + watchdog).
        let temp_ca = match &handle {
            KanidmHandle::Container { temp_ca, .. } => temp_ca.clone(),
            KanidmHandle::Disabled => unreachable!(),
        };
        drop(handle);
        assert!(!temp_ca.exists(), "temp CA file deleted on drop");
    }
}
