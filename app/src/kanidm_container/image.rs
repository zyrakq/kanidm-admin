// app/src/kanidm_container/image.rs
//
// Container side of the dev Kanidm: run the two-container flow on the
// official kanidm/server image — a one-shot cert-generate container
// whose TLS material is extracted as bytes, then a server container
// seeded with those bytes in memory. Mirrors container logs into
// tracing and runs commands inside the running container.

use std::time::Duration;

use testcontainers::core::logs::LogFrame;
use testcontainers::core::wait::ExitWaitStrategy;
use testcontainers::core::{CmdWaitFor, ExecCommand, IntoContainerPort, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, GenericImage, ImageExt};
use tracing::warn;

/// Kanidm HTTPS port inside the container.
pub const KANIDM_HTTPS_PORT: u16 = 8443;

/// Readiness marker: kanidm logs this right before binding the HTTPS
/// listener (v1.11.1 tag, server/core/src/https/mod.rs:416). Kanidm
/// logs to stdout (tracing-forest's default stdout printer), hence
/// message_on_stdout.
const READINESS_MARKER: &str = "Starting the web server...";

/// Label for containers started by this app so SIGKILL orphans can be
/// found and pruned: `docker ps -a --filter label=kanidm-admin.dev=true`.
pub const CONTAINER_LABEL_KEY: &str = "kanidm-admin.dev";
const CONTAINER_LABEL_VALUE: &str = "true";

/// Upper bound for pull + start + readiness. The first run pulls the
/// official image, so it needs headroom.
const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);

/// One-shot certificate generation, replacing the image's default
/// `server` cmd on container A.
const CERT_GENERATE_CMD: [&str; 2] = ["/sbin/kanidmd", "cert-generate"];

/// Env-only config shared by both containers. When /data/server.toml
/// is absent and no -c is given, kanidmd builds its config purely
/// from KANIDM_* env vars and prints a WARNING to stderr — expected
/// and harmless (mirrored into tracing; does not affect the stdout
/// readiness wait). The DB path is shared because kanidmd validates
/// the full config for every subcommand — cert-generate exits 1
/// without it (verified against kanidm/server:1.11.1).
const KANIDM_DOMAIN: (&str, &str) = ("KANIDM_DOMAIN", "localhost");
const KANIDM_ORIGIN: (&str, &str) = ("KANIDM_ORIGIN", "https://localhost:8443");
const KANIDM_TLS_CHAIN: (&str, &str) = ("KANIDM_TLS_CHAIN", "/data/chain.pem");
const KANIDM_TLS_KEY: (&str, &str) = ("KANIDM_TLS_KEY", "/data/key.pem");
const KANIDM_DB_PATH: (&str, &str) = ("KANIDM_DB_PATH", "/data/kanidm.db");

/// Server-only env addition. 0.0.0.0 is critical: the compiled-in
/// default bind address is 127.0.0.1:8443, unreachable through the
/// mapped host port.
const KANIDM_BINDADDRESS: (&str, &str) = ("KANIDM_BINDADDRESS", "0.0.0.0:8443");

/// TLS material written by cert-generate inside container A and
/// extracted to the host as bytes.
const CA_PEM_PATH: &str = "/data/ca.pem";
const CHAIN_PEM_PATH: &str = "/data/chain.pem";
const KEY_PEM_PATH: &str = "/data/key.pem";

/// TLS material extracted from the cert-generate container: the CA
/// to trust on the host, plus the bytes seeded into the server
/// container.
pub struct CertMaterial {
    pub ca_pem: Vec<u8>,
    pub chain_pem: Vec<u8>,
    pub key_pem: Vec<u8>,
}

/// A running, ready dev Kanidm server container with its mapped port
/// and the generated CA (needed on the host to trust the server).
pub struct ServerContainer {
    pub container: ContainerAsync<GenericImage>,
    /// Host-side port mapped to the container's 8443.
    pub port: u16,
    /// The container-generated CA, to be trusted on the host.
    pub ca_pem: Vec<u8>,
}

/// Request for container A: one-shot cert-generate that must exit 0.
pub fn cert_generate_request(image: &str) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    GenericImage::new(name, tag)
        // GenericImage methods first (they return Self)...
        .with_wait_for(WaitFor::exit(
            ExitWaitStrategy::new().with_exit_code(0),
        ))
        // ...then ImageExt methods (they return ContainerRequest).
        .with_cmd(CERT_GENERATE_CMD)
        .with_env_var(KANIDM_DOMAIN.0, KANIDM_DOMAIN.1)
        .with_env_var(KANIDM_ORIGIN.0, KANIDM_ORIGIN.1)
        .with_env_var(KANIDM_TLS_CHAIN.0, KANIDM_TLS_CHAIN.1)
        .with_env_var(KANIDM_TLS_KEY.0, KANIDM_TLS_KEY.1)
        .with_env_var(KANIDM_DB_PATH.0, KANIDM_DB_PATH.1)
        .with_log_consumer(mirror_logs)
        .with_startup_timeout(STARTUP_TIMEOUT)
}

/// Request for container B: the server, seeded with A's TLS material.
/// No `with_cmd` — the image's own `CMD ["kanidmd", "server"]` runs.
pub fn server_request(
    image: &str,
    material: &CertMaterial,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    GenericImage::new(name, tag)
        .with_wait_for(WaitFor::message_on_stdout(READINESS_MARKER))
        .with_exposed_port(KANIDM_HTTPS_PORT.tcp())
        .with_env_var(KANIDM_DOMAIN.0, KANIDM_DOMAIN.1)
        .with_env_var(KANIDM_ORIGIN.0, KANIDM_ORIGIN.1)
        .with_env_var(KANIDM_TLS_CHAIN.0, KANIDM_TLS_CHAIN.1)
        .with_env_var(KANIDM_TLS_KEY.0, KANIDM_TLS_KEY.1)
        .with_env_var(KANIDM_DB_PATH.0, KANIDM_DB_PATH.1)
        .with_env_var(KANIDM_BINDADDRESS.0, KANIDM_BINDADDRESS.1)
        .with_copy_to(CHAIN_PEM_PATH, material.chain_pem.clone())
        .with_copy_to(KEY_PEM_PATH, material.key_pem.clone())
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_log_consumer(mirror_logs)
        .with_startup_timeout(STARTUP_TIMEOUT)
}

/// Run the two-container flow: cert-generate (A) → extract → remove →
/// server (B). Returns the ready server container, its mapped port,
/// and the generated CA.
///
/// The most common failure here is no running Docker daemon; the
/// start errors are wrapped with an actionable hint.
pub async fn run_server(
    image: &str,
) -> Result<ServerContainer, Box<dyn std::error::Error + Send + Sync>> {
    let material = generate_certificates(image).await?;

    let container = server_request(image, &material)
        .start()
        .await
        .map_err(|error| {
            format!(
                "failed to start the dev Kanidm server container \
                 (is Docker installed and running?): {error}"
            )
        })?;
    let port = container
        .get_host_port_ipv4(KANIDM_HTTPS_PORT.tcp())
        .await?;

    Ok(ServerContainer {
        container,
        port,
        ca_pem: material.ca_pem,
    })
}

/// Run the one-shot cert-generate container, extract its TLS material
/// as bytes, then remove it explicitly — deterministic cleanup that
/// also unregisters the container from the watchdog.
async fn generate_certificates(
    image: &str,
) -> Result<CertMaterial, Box<dyn std::error::Error + Send + Sync>> {
    let container = cert_generate_request(image)
        .start()
        .await
        .map_err(|error| {
            format!(
                "failed to run the Kanidm cert-generate container \
                 (is Docker installed and running?): {error}"
            )
        })?;

    // copy_file_from works on exited containers — A has already
    // waited for exit code 0.
    let ca_pem = extract_file(&container, CA_PEM_PATH).await?;
    let chain_pem = extract_file(&container, CHAIN_PEM_PATH).await?;
    let key_pem = extract_file(&container, KEY_PEM_PATH).await?;

    // The material is already extracted, so removal failure is not
    // fatal — warn and move on.
    if let Err(error) = container.rm().await {
        warn!("failed to remove the cert-generate container: {error}");
    }

    Ok(CertMaterial {
        ca_pem,
        chain_pem,
        key_pem,
    })
}

/// Copy a single file out of a container into memory.
async fn extract_file(
    container: &ContainerAsync<GenericImage>,
    path: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    container
        .copy_file_from(path, Vec::new())
        .await
        .map_err(|error| format!("failed to copy {path} out of the container: {error}").into())
}

/// Run a command inside the running container (expecting exit code 0)
/// and return its stdout bytes.
pub(super) async fn exec_stdout(
    container: &ContainerAsync<GenericImage>,
    command: &[&str],
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let mut exec = container
        .exec(
            ExecCommand::new(command.to_vec())
                .with_cmd_ready_condition(CmdWaitFor::exit_code(0)),
        )
        .await?;
    Ok(exec.stdout_to_vec().await?)
}

/// Split `name:tag` on the LAST colon, so registry addresses with
/// ports (`localhost:5000/kanidm/server:1.11.1`) resolve correctly.
/// No tag → `latest` (Docker's own default).
pub fn split_image_tag(image: &str) -> (String, String) {
    match image.rsplit_once(':') {
        Some((name, tag)) if !tag.contains('/') => (name.to_string(), tag.to_string()),
        _ => (image.to_string(), "latest".to_string()),
    }
}

/// Mirror container logs into tracing under the `kanidm` target so
/// container-side failures surface next to app logs.
fn mirror_logs(frame: &LogFrame) {
    let text = String::from_utf8_lossy(frame.bytes());
    match frame {
        LogFrame::StdOut(_) => tracing::info!(target: "kanidm", "{text}"),
        LogFrame::StdErr(_) => tracing::warn!(target: "kanidm", "{text}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    /// Collect a request's env vars into a map for assertions.
    fn env_map(request: &ContainerRequest<GenericImage>) -> BTreeMap<String, String> {
        request
            .env_vars()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect()
    }

    #[test]
    fn splits_image_tag_on_last_colon() {
        assert_eq!(
            split_image_tag("kanidm/server:1.11.1"),
            ("kanidm/server".to_string(), "1.11.1".to_string())
        );
        // Registry port colon must not be mistaken for a tag colon.
        assert_eq!(
            split_image_tag("localhost:5000/kanidm/server:1.11.1"),
            (
                "localhost:5000/kanidm/server".to_string(),
                "1.11.1".to_string()
            )
        );
        // Registry with port, no tag.
        assert_eq!(
            split_image_tag("localhost:5000/kanidm/server"),
            (
                "localhost:5000/kanidm/server".to_string(),
                "latest".to_string()
            )
        );
        // No tag at all.
        assert_eq!(
            split_image_tag("kanidm/server"),
            ("kanidm/server".to_string(), "latest".to_string())
        );
    }

    #[test]
    fn cert_generate_request_sets_cmd_env_and_exit_wait() {
        let request = cert_generate_request("kanidm/server:1.11.1");

        assert_eq!(request.descriptor(), "kanidm/server:1.11.1");
        assert_eq!(
            request.cmd().collect::<Vec<_>>(),
            vec!["/sbin/kanidmd", "cert-generate"]
        );

        let env = env_map(&request);
        assert_eq!(
            env.get("KANIDM_DOMAIN").map(String::as_str),
            Some("localhost")
        );
        assert_eq!(
            env.get("KANIDM_ORIGIN").map(String::as_str),
            Some("https://localhost:8443")
        );
        assert_eq!(
            env.get("KANIDM_TLS_CHAIN").map(String::as_str),
            Some("/data/chain.pem")
        );
        assert_eq!(
            env.get("KANIDM_TLS_KEY").map(String::as_str),
            Some("/data/key.pem")
        );
        // cert-generate shares the DB path (kanidmd validates the
        // full config for every subcommand) but needs no bind address.
        assert_eq!(
            env.get("KANIDM_DB_PATH").map(String::as_str),
            Some("/data/kanidm.db")
        );
        assert!(!env.contains_key("KANIDM_BINDADDRESS"));

        // WaitFor is Debug + Clone but not PartialEq, so assert the
        // variant via matches! and the exit code via the Debug render.
        let conditions = request.ready_conditions();
        assert!(
            matches!(conditions.as_slice(), [WaitFor::Exit(_)]),
            "expected exactly one exit wait, got {conditions:?}"
        );
        assert!(format!("{conditions:?}").contains("expected_code: Some(0)"));
    }

    #[test]
    fn server_request_sets_env_seeding_port_and_log_wait() {
        let material = CertMaterial {
            ca_pem: b"ca".to_vec(),
            chain_pem: b"chain".to_vec(),
            key_pem: b"key".to_vec(),
        };
        let request = server_request("kanidm/server:1.11.1", &material);

        // Default server cmd is not overridden.
        assert_eq!(request.cmd().count(), 0);

        let env = env_map(&request);
        for key in [
            "KANIDM_DOMAIN",
            "KANIDM_ORIGIN",
            "KANIDM_TLS_CHAIN",
            "KANIDM_TLS_KEY",
            "KANIDM_DB_PATH",
            "KANIDM_BINDADDRESS",
        ] {
            assert!(env.contains_key(key), "missing env {key}");
        }
        assert_eq!(
            env.get("KANIDM_BINDADDRESS").map(String::as_str),
            Some("0.0.0.0:8443")
        );

        // Readiness: exactly one stdout log wait on the marker.
        // WaitFor is Debug + Clone but not PartialEq, so assert the
        // variant via matches! and the message via the Debug render
        // (Bytes render as b"...").
        let conditions = request.ready_conditions();
        assert!(
            matches!(conditions.as_slice(), [WaitFor::Log(_)]),
            "expected exactly one log wait, got {conditions:?}"
        );
        assert!(format!("{conditions:?}").contains(READINESS_MARKER));

        // Port exposure + label.
        assert!(request.expose_ports().contains(&KANIDM_HTTPS_PORT.tcp()));
        assert_eq!(
            request.labels().get(CONTAINER_LABEL_KEY).map(String::as_str),
            Some("true")
        );

        // Copy-to seeding: CopyToContainer fields are private, so
        // assert via the count and the Debug render.
        assert_eq!(
            request.copy_to_sources().count(),
            2,
            "expected chain + key seeding"
        );
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains(CHAIN_PEM_PATH));
        assert!(debug.contains(KEY_PEM_PATH));
        assert!(debug.contains("Data("));
    }
}
