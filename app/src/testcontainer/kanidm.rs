// app/src/testcontainer/kanidm.rs
//
// Kanidm side of the dev testcontainer chain: run the
// two-container flow on the official kanidm/server image — a
// one-shot cert-generate container whose TLS material is extracted
// as bytes, then a server container seeded with those bytes —
// recover the built-in admin/idm_admin credentials and derive the
// effective [kanidm] settings. Mode-aware: domain, origin and
// port publishing follow host vs in-container mode. Also hosts
// the shared image-split and publish-nothing helpers the other
// container modules reuse.

use testcontainers::bollard::models::{HostConfig, PortBinding, PortMap};
use testcontainers::core::wait::ExitWaitStrategy;
use testcontainers::core::{CmdWaitFor, ExecCommand, IntoContainerPort, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, CopyTargetOptions, GenericImage, ImageExt};
use tracing::{info, warn};

use super::log_file::{file_consumer, LogSubfolder};
use super::styles::{OVERRIDE_CSS, OVERRIDE_CSS_MARKER, OVERRIDE_CSS_PATH};
use super::{
    DevCredentials, Mode, CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE, STARTUP_TIMEOUT,
};
use crate::settings::kanidm::KanidmSettings;

/// Kanidm HTTPS port inside the container.
pub(crate) const KANIDM_HTTPS_PORT: u16 = 8443;

/// Readiness marker: kanidm logs this right before binding the
/// HTTPS listener (v1.11.1 tag, server/core/src/https/mod.rs:416).
/// Kanidm logs to stdout (tracing-forest's default stdout
/// printer), hence message_on_stdout.
const READINESS_MARKER: &str = "Starting the web server...";

/// One-shot certificate generation, replacing the image's default
/// `server` cmd on container A.
const CERT_GENERATE_CMD: [&str; 2] = ["/sbin/kanidmd", "cert-generate"];

/// Env-only config shared by both containers. When
/// /data/server.toml is absent and no -c is given, kanidmd builds
/// its config purely from KANIDM_* env vars and prints a WARNING
/// to stderr — expected and harmless (captured into the run log
/// file; does not affect the stdout readiness wait). The DB path
/// is shared because kanidmd validates the full config for every
/// subcommand — cert-generate exits 1 without it (verified
/// against kanidm/server:1.11.1).
const KANIDM_TLS_CHAIN: (&str, &str) = ("KANIDM_TLS_CHAIN", "/data/chain.pem");
const KANIDM_TLS_KEY: (&str, &str) = ("KANIDM_TLS_KEY", "/data/key.pem");
const KANIDM_DB_PATH: (&str, &str) = ("KANIDM_DB_PATH", "/data/kanidm.db");

/// Server-only env addition. 0.0.0.0 is critical: the compiled-in
/// default bind address is 127.0.0.1:8443, unreachable through
/// the mapped host port.
const KANIDM_BINDADDRESS: (&str, &str) = ("KANIDM_BINDADDRESS", "0.0.0.0:8443");

/// TLS material written by cert-generate inside container A and
/// extracted to the host as bytes.
const CHAIN_PEM_PATH: &str = "/data/chain.pem";
const KEY_PEM_PATH: &str = "/data/key.pem";

/// Built-in accounts recovered on every start: recover-account
/// generates a NEW random password per call, so both are
/// recovered fresh and logged.
pub(crate) const ADMIN_USERNAME: &str = "admin";
pub(crate) const IDM_ADMIN_USERNAME: &str = "idm_admin";

/// Bounded retry for the recover-account exec and the smoke auth:
/// the readiness log line means "listener bound", which can race
/// full request readiness by a moment.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// A running, ready dev Kanidm server with its generated CA chain
/// and recovered credentials.
pub(crate) struct KanidmServer {
    pub(crate) container: ContainerAsync<GenericImage>,
    /// The container-generated CA chain, to be trusted by the
    /// app and the mail sender.
    pub(crate) ca_pem: Vec<u8>,
    pub(crate) credentials: DevCredentials,
    /// Host-side port mapped to the container's 8443 (host mode
    /// only; None in in-container mode).
    pub(crate) host_port: Option<u16>,
}

/// Domain (and certificate SAN) for the dev server: `localhost`
/// in host mode, the container DNS name in in-container mode.
fn kanidm_domain(mode: Mode) -> &'static str {
    match mode {
        Mode::Host => "localhost",
        Mode::InContainer => "kanidm",
    }
}

/// Origin the dev server issues tokens for.
fn kanidm_origin(mode: Mode) -> String {
    format!("https://{}:8443", kanidm_domain(mode))
}

/// Host-config modifier that publishes nothing: clears port
/// bindings and disables publish-all. Used by the transient
/// cert-generate container (both modes), the server in
/// in-container mode, and (via re-export) mailpit in
/// in-container mode. Without it the runner would publish every
/// EXPOSEd port ephemeral on 0.0.0.0 — the kanidm/server image
/// EXPOSEs 8443 AND 3636.
pub(super) fn publish_nothing() -> impl Fn(&mut HostConfig) + Send + Sync + 'static {
    |config: &mut HostConfig| {
        config.port_bindings = Some(PortMap::new());
        config.publish_all_ports = Some(false);
    }
}

/// Host-config modifier for the server in host mode: a
/// loopback-only ephemeral binding for 8443, nothing else
/// published (3636 stays unreachable).
fn loopback_https() -> impl Fn(&mut HostConfig) + Send + Sync + 'static {
    |config: &mut HostConfig| {
        config.port_bindings = Some(PortMap::from([(
            format!("{KANIDM_HTTPS_PORT}/tcp"),
            Some(vec![PortBinding {
                host_ip: Some("127.0.0.1".to_string()),
                host_port: None,
            }]),
        )]));
        config.publish_all_ports = Some(false);
    }
}

/// Request for container A: one-shot cert-generate that must exit
/// 0. Transient in both modes — no network, nothing published.
fn cert_generate_request(image: &str, mode: Mode) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    GenericImage::new(name, tag)
        // GenericImage methods first (they return Self)...
        .with_wait_for(WaitFor::exit(
            ExitWaitStrategy::new().with_exit_code(0),
        ))
        // ...then ImageExt methods (they return ContainerRequest).
        .with_cmd(CERT_GENERATE_CMD)
        .with_env_var("KANIDM_DOMAIN", kanidm_domain(mode))
        .with_env_var("KANIDM_ORIGIN", kanidm_origin(mode))
        .with_env_var(KANIDM_TLS_CHAIN.0, KANIDM_TLS_CHAIN.1)
        .with_env_var(KANIDM_TLS_KEY.0, KANIDM_TLS_KEY.1)
        .with_env_var(KANIDM_DB_PATH.0, KANIDM_DB_PATH.1)
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_host_config_modifier(publish_nothing())
        .with_startup_timeout(STARTUP_TIMEOUT)
}

/// Request for container B: the server, seeded with A's TLS
/// material AND the dev login-page override stylesheet (copied
/// over the image's /hpkg/override.css placeholder at seed time).
/// No `with_cmd` — the image's own `CMD ["kanidmd", "server"]`
/// runs.
fn server_request(
    image: &str,
    mode: Mode,
    network: &str,
    chain_pem: Vec<u8>,
    key_pem: Vec<u8>,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    let request = GenericImage::new(name, tag)
        .with_wait_for(WaitFor::message_on_stdout(READINESS_MARKER))
        .with_exposed_port(KANIDM_HTTPS_PORT.tcp())
        .with_env_var("KANIDM_DOMAIN", kanidm_domain(mode))
        .with_env_var("KANIDM_ORIGIN", kanidm_origin(mode))
        .with_env_var(KANIDM_TLS_CHAIN.0, KANIDM_TLS_CHAIN.1)
        .with_env_var(KANIDM_TLS_KEY.0, KANIDM_TLS_KEY.1)
        .with_env_var(KANIDM_DB_PATH.0, KANIDM_DB_PATH.1)
        .with_env_var(KANIDM_BINDADDRESS.0, KANIDM_BINDADDRESS.1)
        .with_copy_to(CHAIN_PEM_PATH, chain_pem)
        .with_copy_to(KEY_PEM_PATH, key_pem)
        .with_copy_to(
            CopyTargetOptions::new(OVERRIDE_CSS_PATH).with_mode(0o644),
            OVERRIDE_CSS.as_bytes().to_vec(),
        )
        .with_container_name("kanidm")
        .with_network(network)
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_startup_timeout(STARTUP_TIMEOUT);

    match mode {
        Mode::Host => request.with_host_config_modifier(loopback_https()),
        Mode::InContainer => request.with_host_config_modifier(publish_nothing()),
    }
}

/// Run the two-container flow: cert-generate (A) → extract →
/// remove → server (B) → recover credentials. Returns the ready
/// server container, the CA chain and the built-in credentials.
pub(crate) async fn run(
    image: &str,
    mode: Mode,
    network: &str,
) -> Result<KanidmServer, Box<dyn std::error::Error + Send + Sync>> {
    let (chain_pem, key_pem) = generate_certificates(image, mode).await?;
    info!("dev Kanidm certificates generated");

    let container = server_request(image, mode, network, chain_pem.clone(), key_pem)
        .with_log_consumer(file_consumer(LogSubfolder::Server))
        .start()
        .await
        .map_err(|error| {
            format!(
                "failed to start the dev Kanidm server container \
                 (is Docker installed and running?): {error}"
            )
        })?;

    // The seeded override stylesheet must actually be in place:
    // a silently unstyled dev login page must never go
    // unnoticed. The kanidm image is distroless, so the check
    // copies the file out and verifies the marker app-side.
    verify_override_css(&container).await?;

    let host_port = match mode {
        Mode::Host => Some(
            container
                .get_host_port_ipv4(KANIDM_HTTPS_PORT.tcp())
                .await?,
        ),
        Mode::InContainer => None,
    };

    let credentials = recover_builtin_credentials(&container).await?;

    Ok(KanidmServer {
        container,
        ca_pem: chain_pem,
        credentials,
        host_port,
    })
}

/// Run the one-shot cert-generate container, extract its TLS
/// material as bytes, then remove it explicitly — deterministic
/// cleanup that also unregisters the container from the watchdog.
async fn generate_certificates(
    image: &str,
    mode: Mode,
) -> Result<(Vec<u8>, Vec<u8>), Box<dyn std::error::Error + Send + Sync>> {
    let container = cert_generate_request(image, mode)
        .with_log_consumer(file_consumer(LogSubfolder::CertGenerate))
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
    let chain_pem = extract_file(&container, CHAIN_PEM_PATH).await?;
    let key_pem = extract_file(&container, KEY_PEM_PATH).await?;

    // The material is already extracted, so removal failure is
    // not fatal — warn and move on.
    if let Err(error) = container.rm().await {
        warn!("failed to remove the cert-generate container: {error}");
    }

    Ok((chain_pem, key_pem))
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

/// Verify the seeded login-page stylesheet: copy the seeded file
/// out of the running container and check it carries the marker
/// comment. The kanidm image is distroless (no shell, no grep),
/// so the check runs on the app side over the copied-out bytes.
/// A missing file or a missing marker surfaces as a startup
/// error — styles are a hard requirement, not best-effort.
async fn verify_override_css(
    container: &ContainerAsync<GenericImage>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let seeded = extract_file(container, OVERRIDE_CSS_PATH).await.map_err(|error| {
        format!(
            "the dev login-page stylesheet is not correctly seeded at \
             {OVERRIDE_CSS_PATH} (copy-out failed): {error}"
        )
    })?;
    let seeded = String::from_utf8(seeded)
        .map_err(|error| format!("the seeded override.css is not UTF-8: {error}"))?;
    if !seeded.contains(OVERRIDE_CSS_MARKER) {
        return Err(format!(
            "the dev login-page stylesheet at {OVERRIDE_CSS_PATH} lacks the \
             expected marker comment — the seeded file is not the dev override"
        )
        .into());
    }
    Ok(())
}

/// Run a command inside the running container (expecting exit
/// code 0) and return its stdout bytes.
async fn exec_stdout(
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

/// Recover the built-in admin and idm_admin passwords by exec'ing
/// `kanidmd scripting recover-account <name>` inside the running
/// container, with bounded retry.
async fn recover_builtin_credentials(
    container: &ContainerAsync<GenericImage>,
) -> Result<DevCredentials, Box<dyn std::error::Error + Send + Sync>> {
    let admin_password = recover_account_password(container, ADMIN_USERNAME).await?;
    let idm_admin_password = recover_account_password(container, IDM_ADMIN_USERNAME).await?;
    Ok(DevCredentials {
        admin_password,
        idm_admin_password,
    })
}

/// Recover one account's password, with bounded retry. The command
/// prints JSON status lines on stdout; the password is the
/// `output` field of the ok line.
async fn recover_account_password(
    container: &ContainerAsync<GenericImage>,
    username: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let command = ["/sbin/kanidmd", "scripting", "recover-account", username];

    let mut last_error = String::from("no attempt made");
    for attempt in 0..RETRY_ATTEMPTS {
        let failure = match exec_stdout(container, &command).await {
            Ok(stdout) => match parse_recover_account_password(&stdout) {
                Some(password) => return Ok(password),
                None => format!(
                    "recover-account stdout had no ok-status line: {}",
                    String::from_utf8_lossy(&stdout)
                ),
            },
            Err(error) => format!("recover-account exec failed: {error}"),
        };
        last_error = failure;
        warn!(
            "recover-account attempt {} failed: {}",
            attempt + 1,
            last_error
        );
        tokio::time::sleep(retry_delay(attempt)).await;
    }
    Err(format!(
        "recover-account did not succeed after {RETRY_ATTEMPTS} attempts: {last_error}"
    )
    .into())
}

/// Extract the password from `recover-account` stdout: scan the
/// lines for a `{"status":"ok","output":...}` JSON object (kanidmd
/// also logs to stdout, so other lines are skipped).
pub(crate) fn parse_recover_account_password(stdout: &[u8]) -> Option<String> {
    for line in String::from_utf8_lossy(stdout).lines() {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if value.get("status").and_then(|status| status.as_str()) == Some("ok") {
            if let Some(password) = value.get("output").and_then(|output| output.as_str()) {
                return Some(password.to_string());
            }
        }
    }
    None
}

/// Log the dev connection details, credentials included. Dev-only
/// by construction: this module runs exclusively in container
/// mode.
pub(crate) fn log_dev_credentials(url: &str, credentials: &DevCredentials) {
    warn!(
        url = %url,
        admin = ADMIN_USERNAME,
        admin_password = %credentials.admin_password,
        idm_admin = IDM_ADMIN_USERNAME,
        idm_admin_password = %credentials.idm_admin_password,
        "dev Kanidm credentials — log in with either account"
    );
}

/// Effective [kanidm] settings in container mode: the mapped
/// container URL in host mode (the generated certificate's SAN is
/// the domain, so hostname verification passes), the in-container
/// DNS URL otherwise; the temp CA file; REAL certificate
/// verification. Pure function.
pub(crate) fn effective_settings(
    mode: Mode,
    host_port: Option<u16>,
    ca_path: &str,
) -> KanidmSettings {
    let url = match (mode, host_port) {
        (Mode::Host, Some(port)) => format!("https://localhost:{port}"),
        (Mode::InContainer, _) => "https://kanidm:8443".to_string(),
        (Mode::Host, None) => unreachable!("host mode always resolves a mapped port"),
    };
    KanidmSettings {
        url,
        ca_path: Some(ca_path.to_string()),
        verify_ca: true,
    }
}

/// Startup smoke test: authenticate as idm_admin through the same
/// production client path the app uses
/// (`client_builder_from_settings` → real TLS verification against
/// the container CA), with bounded retry. A successful auth proves
/// TLS trust + credentials + server readiness end-to-end (a broken
/// chain would fail with a TLS error, not an auth error).
pub(crate) async fn smoke_auth(
    effective: &KanidmSettings,
    idm_admin_password: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let builder = crate::auth::ops::client_builder_from_settings(effective)
        .map_err(|error| format!("failed to build smoke-test client: {error:?}"))?;
    let client = builder
        .build()
        .map_err(|error| format!("failed to build smoke-test client: {error:?}"))?;

    let mut last_error = String::from("no attempt made");
    for attempt in 0..RETRY_ATTEMPTS {
        match client
            .auth_simple_password(IDM_ADMIN_USERNAME, idm_admin_password)
            .await
        {
            Ok(()) => {
                info!("dev Kanidm smoke auth succeeded (real TLS verification)");
                return Ok(());
            }
            Err(error) => {
                last_error = format!("idm_admin smoke auth failed: {error:?}");
                warn!(
                    "idm_admin smoke auth attempt {} failed: {}",
                    attempt + 1,
                    last_error
                );
                tokio::time::sleep(retry_delay(attempt)).await;
            }
        }
    }
    Err(format!(
        "idm_admin smoke auth did not succeed after {RETRY_ATTEMPTS} attempts: {last_error} \
         (full container logs are captured under logs/testcontainers/kanidm-server/)"
    )
    .into())
}

/// Linear backoff for the bounded retries: 250ms, 500ms, ...
/// capped at 2s.
fn retry_delay(attempt: u32) -> std::time::Duration {
    let millis = (RETRY_BASE_DELAY_MS * u64::from(attempt + 1)).min(2000);
    std::time::Duration::from_millis(millis)
}

/// Split `name:tag` on the LAST colon, so registry addresses with
/// ports (`localhost:5000/kanidm/server:1.11.1`) resolve
/// correctly. No tag → `latest` (Docker's own default). Shared
/// with the other container modules.
pub(crate) fn split_image_tag(image: &str) -> (String, String) {
    match image.rsplit_once(':') {
        Some((name, tag)) if !tag.contains('/') => (name.to_string(), tag.to_string()),
        _ => (image.to_string(), "latest".to_string()),
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
        // Registry port colon must not be mistaken for a tag
        // colon.
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
    fn domain_and_origin_follow_the_mode() {
        assert_eq!(kanidm_domain(Mode::Host), "localhost");
        assert_eq!(kanidm_origin(Mode::Host), "https://localhost:8443");
        assert_eq!(kanidm_domain(Mode::InContainer), "kanidm");
        assert_eq!(kanidm_origin(Mode::InContainer), "https://kanidm:8443");
    }

    #[test]
    fn cert_generate_request_sets_cmd_env_and_exit_wait() {
        let request = cert_generate_request("kanidm/server:1.11.1", Mode::Host);

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
        // full config for every subcommand) but needs no bind
        // address.
        assert_eq!(
            env.get("KANIDM_DB_PATH").map(String::as_str),
            Some("/data/kanidm.db")
        );
        assert!(!env.contains_key("KANIDM_BINDADDRESS"));

        // The transient cert container joins no network.
        assert_eq!(request.network(), &None);

        // WaitFor is Debug + Clone but not PartialEq, so assert
        // the variant via matches! and the exit code via the Debug
        // render.
        let conditions = request.ready_conditions();
        assert!(
            matches!(conditions.as_slice(), [WaitFor::Exit(_)]),
            "expected exactly one exit wait, got {conditions:?}"
        );
        assert!(format!("{conditions:?}").contains("expected_code: Some(0)"));
    }

    #[test]
    fn cert_generate_request_env_follows_in_container_mode() {
        let request = cert_generate_request("kanidm/server:1.11.1", Mode::InContainer);
        let env = env_map(&request);
        assert_eq!(env.get("KANIDM_DOMAIN").map(String::as_str), Some("kanidm"));
        assert_eq!(
            env.get("KANIDM_ORIGIN").map(String::as_str),
            Some("https://kanidm:8443")
        );
    }

    #[test]
    fn server_request_sets_env_seeding_identity_and_log_wait() {
        let request = server_request(
            "kanidm/server:1.11.1",
            Mode::Host,
            "kanidm-admin-dev",
            b"chain".to_vec(),
            b"key".to_vec(),
        );

        // Default server cmd is not overridden.
        assert_eq!(request.cmd().count(), 0);

        // Identity on the shared network.
        assert_eq!(
            request.container_name().as_deref(),
            Some("kanidm"),
            "the server container has a stable DNS name"
        );
        assert_eq!(
            request.network().as_deref(),
            Some("kanidm-admin-dev"),
            "the server container joins the shared network"
        );

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

        // Copy-to seeding: chain + key + override stylesheet.
        assert_eq!(
            request.copy_to_sources().count(),
            3,
            "expected chain + key + override.css seeding"
        );
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains(CHAIN_PEM_PATH));
        assert!(debug.contains(KEY_PEM_PATH));
        assert!(debug.contains(OVERRIDE_CSS_PATH));
    }

    #[test]
    fn parses_password_from_ok_status_line() {
        let stdout = b"{\"status\":\"ok\",\"output\":\"s3cr3t-password\"}\n";
        assert_eq!(
            parse_recover_account_password(stdout),
            Some("s3cr3t-password".to_string())
        );
    }

    #[test]
    fn skips_log_lines_and_non_ok_status() {
        let stdout = b"some log line\n{\"status\":\"err\",\"output\":\"nope\"}\n{\"status\":\"ok\",\"output\":\"real-one\"}\n";
        assert_eq!(
            parse_recover_account_password(stdout),
            Some("real-one".to_string())
        );
    }

    #[test]
    fn returns_none_when_no_ok_line() {
        assert_eq!(parse_recover_account_password(b"no json here"), None);
        assert_eq!(
            parse_recover_account_password(b"{\"status\":\"err\",\"output\":\"x\"}"),
            None
        );
    }

    #[test]
    fn effective_settings_follow_the_mode() {
        let host = effective_settings(Mode::Host, Some(55001), "/tmp/ca.pem");
        assert_eq!(host.url, "https://localhost:55001");
        assert_eq!(host.ca_path.as_deref(), Some("/tmp/ca.pem"));
        assert!(host.verify_ca);

        let in_container = effective_settings(Mode::InContainer, None, "/tmp/ca.pem");
        assert_eq!(in_container.url, "https://kanidm:8443");
        assert_eq!(in_container.ca_path.as_deref(), Some("/tmp/ca.pem"));
        assert!(in_container.verify_ca);
    }
}
