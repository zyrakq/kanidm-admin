// app/src/testcontainer/network.rs
//
// Shared Docker network plumbing for the dev containers: host vs
// in-container mode detection, network creation and the app
// container's self-attach. The network is created via bollard
// BEFORE any container starts and persists across runs —
// containers are per-run, the network is stable.

use std::path::Path;

use testcontainers::bollard::models::{NetworkConnectRequest, NetworkCreateRequest};
use testcontainers::bollard::query_parameters::ListNetworksOptions;
use testcontainers::bollard::Docker;
use tracing::{info, warn};

/// Where the app runs: on the host (containers reached via
/// published loopback ports) or inside a container on the shared
/// network (containers reached by DNS name, nothing published).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Mode {
    /// App on the host; container ports published to loopback.
    Host,
    /// App in a container on the shared network; nothing
    /// published.
    InContainer,
}

/// Resolve the configured mode string: explicit "host" /
/// "in-container", or "auto" via environment detection.
pub(crate) fn resolve_mode(setting: &str) -> Result<Mode, String> {
    match setting {
        "host" => Ok(Mode::Host),
        "in-container" => Ok(Mode::InContainer),
        "auto" => Ok(detect_mode()),
        other => Err(format!(
            "unknown testcontainer mode {other:?}: expected \"auto\", \"host\" or \"in-container\""
        )),
    }
}

/// Detect the mode from the environment: inside a container iff
/// `/.dockerenv` exists AND the Docker host is local (unset,
/// empty or a `unix://` socket).
pub(crate) fn detect_mode() -> Mode {
    detect_mode_from(
        Path::new("/.dockerenv").exists(),
        std::env::var("DOCKER_HOST").ok().as_deref(),
    )
}

/// Pure core of `detect_mode`.
pub(crate) fn detect_mode_from(dockerenv_exists: bool, docker_host: Option<&str>) -> Mode {
    let local_docker_host = docker_host
        .map(|host| host.is_empty() || host.starts_with("unix://"))
        .unwrap_or(true);
    if dockerenv_exists && local_docker_host {
        Mode::InContainer
    } else {
        Mode::Host
    }
}

/// Ensure the shared Docker network exists, creating it if
/// needed. The network persists across runs — containers join it
/// via `with_network` without registering it for removal.
pub(crate) async fn ensure_network(
    name: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|error| {
            format!("failed to connect to Docker (is Docker installed and running?): {error}")
        })?;

    let networks = docker
        .list_networks(None::<ListNetworksOptions>)
        .await
        .map_err(|error| {
            format!("failed to list Docker networks (is Docker installed and running?): {error}")
        })?;

    if networks.iter().any(|network| network.name.as_deref() == Some(name)) {
        return Ok(());
    }

    docker
        .create_network(NetworkCreateRequest {
            name: name.to_string(),
            ..Default::default()
        })
        .await
        .map_err(|error| format!("failed to create the Docker network {name}: {error}"))?;
    info!(network = name, "created the shared dev Docker network");
    Ok(())
}

/// Attach the app's own container (in-container mode) to the
/// shared network. Best-effort by design: every failure is
/// logged and never fatal — real breakage surfaces later as a
/// clear DNS/TLS error from the kanidm smoke auth.
pub(crate) async fn self_attach(
    network: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let container = match read_container_id() {
        Some(container) => container,
        None => return Ok(()),
    };

    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(error) => {
            warn!("failed to connect to Docker for the self-attach: {error}");
            return Ok(());
        }
    };

    if let Err(error) = docker
        .connect_network(
            network,
            NetworkConnectRequest {
                container,
                endpoint_config: None,
            },
        )
        .await
    {
        let message = error.to_string();
        if message.contains("already") {
            info!("the app container is already attached to the {network} network");
        } else {
            warn!("failed to attach the app container to the {network} network: {error}");
        }
    }
    Ok(())
}

/// The app's own container id: the trimmed /etc/hostname content
/// (None when the file is missing or empty).
fn read_container_id() -> Option<String> {
    let hostname = std::fs::read_to_string("/etc/hostname").ok()?;
    container_id_from_hostname(&hostname)
}

/// Pure helper: the container id is the trimmed hostname file
/// content (None when empty).
fn container_id_from_hostname(content: &str) -> Option<String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_mode_is_in_container_only_with_dockerenv_and_local_docker_host() {
        // dockerenv + local docker host → in-container.
        assert_eq!(detect_mode_from(true, None), Mode::InContainer);
        assert_eq!(detect_mode_from(true, Some("")), Mode::InContainer);
        assert_eq!(
            detect_mode_from(true, Some("unix:///var/run/docker.sock")),
            Mode::InContainer
        );
        // Remote docker host → host mode even with dockerenv.
        assert_eq!(detect_mode_from(true, Some("tcp://docker:2375")), Mode::Host);
        // No dockerenv → host mode regardless.
        assert_eq!(detect_mode_from(false, None), Mode::Host);
        assert_eq!(
            detect_mode_from(false, Some("unix:///var/run/docker.sock")),
            Mode::Host
        );
    }

    #[test]
    fn resolve_mode_maps_known_values_and_rejects_unknown() {
        assert_eq!(resolve_mode("host"), Ok(Mode::Host));
        assert_eq!(resolve_mode("in-container"), Ok(Mode::InContainer));
        assert!(resolve_mode("auto").is_ok(), "auto resolves via detection");
        let error = resolve_mode("kubernetes").expect_err("unknown mode must be rejected");
        assert!(
            error.contains("kubernetes"),
            "error names the bad value: {error}"
        );
        assert!(error.contains("host"), "error lists the valid values: {error}");
    }

    #[test]
    fn container_id_trims_hostname_content() {
        assert_eq!(
            container_id_from_hostname("abc123\n"),
            Some("abc123".to_string())
        );
        assert_eq!(
            container_id_from_hostname("  abc123  "),
            Some("abc123".to_string())
        );
        assert_eq!(container_id_from_hostname(""), None);
        assert_eq!(container_id_from_hostname("\n"), None);
    }
}
