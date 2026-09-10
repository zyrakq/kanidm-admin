// app/src/kanidm_container/mod.rs
//
// Single responsibility: provide a running, provisioned, disposable
// Kanidm server for development. When [kanidm_container].enabled is
// false, `start` is a pass-through of the [kanidm] settings, so the
// production startup path is unchanged.

pub mod image;
pub mod provision;

use std::path::Path;

use testcontainers::{ContainerAsync, GenericImage};
use tracing::{info, warn};

use crate::settings::kanidm::KanidmSettings;
use crate::settings::kanidm_container::KanidmContainerSettings;
use crate::settings::loader::Settings;

/// Process-lifetime handle for the dev Kanidm container, mirroring
/// `frontend::FrontendHandle`. Dropping the handle removes the
/// container; the testcontainers `watchdog` feature additionally
/// removes it on SIGTERM/SIGINT/SIGQUIT (Ctrl-C). SIGKILL can orphan
/// the container — it carries the label `kanidm-admin.dev=true` so it
/// can be found and pruned manually.
#[allow(dead_code)]
pub enum KanidmHandle {
    /// Container mode disabled — nothing to keep alive.
    Disabled,
    /// Running dev container, removed when dropped.
    Container {
        container: ContainerAsync<GenericImage>,
    },
}

/// Resolve the Kanidm settings the app connects with.
///
/// Container mode: build, start and provision the dev container, and
/// return effective settings pointing at it (the [kanidm] section is
/// ignored with a warning). Disabled mode: pass [kanidm] through
/// unchanged.
pub async fn start(
    settings: &Settings,
    manifest_dir: &Path,
) -> Result<(KanidmSettings, KanidmHandle), Box<dyn std::error::Error + Send + Sync>> {
    if !settings.kanidm_container.enabled {
        return Ok((settings.kanidm.clone(), KanidmHandle::Disabled));
    }
    warn!("[kanidm] url/verify_ca/ca_path are ignored in container mode");
    start_container(&settings.kanidm_container, manifest_dir).await
}

/// Build, start and provision the dev container. Separate from `start`
/// so the Docker-gated test can run it without a full Settings layer.
async fn start_container(
    settings: &KanidmContainerSettings,
    manifest_dir: &Path,
) -> Result<(KanidmSettings, KanidmHandle), Box<dyn std::error::Error + Send + Sync>> {
    let started = image::build_and_run(settings.effective_image(), manifest_dir).await?;

    let admin_password = image::recover_admin_password(&started.container).await?;
    let url = format!("https://{}:{}", started.host, started.port);
    provision::provision_dev_person(&url, &admin_password).await?;

    info!(url = %url, "dev Kanidm container ready");
    Ok((
        provision::effective_settings(&started.host, started.port),
        KanidmHandle::Container {
            container: started.container,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use kanidm_client::KanidmClientBuilder;
    use std::path::PathBuf;

    /// Full flow against a real Docker daemon: build, start, wait for
    /// readiness, recover the admin password, provision the dev
    /// person, then authenticate as the dev person. Ignored by default
    /// (needs Docker); run explicitly with `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "requires a running Docker daemon"]
    async fn container_starts_and_provisions() {
        let settings = KanidmContainerSettings::default();
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

        let (effective, _handle) = start_container(&settings, &manifest_dir)
            .await
            .expect("container should start and provision");

        let client = KanidmClientBuilder::new()
            .address(effective.url.clone())
            .danger_accept_invalid_certs(!effective.verify_ca)
            .build()
            .expect("client should build");
        client
            .auth_simple_password(provision::DEV_PERSON_USERNAME, provision::DEV_PERSON_PASSWORD)
            .await
            .expect("dev person should authenticate against the container");
    }
}
