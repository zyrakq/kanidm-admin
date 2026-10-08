// app/src/testcontainer/mailpit.rs
//
// Mailpit container: the catch-all dev mail sink with a web UI
// under the /_/mailpit prefix (MP_WEBROOT — mailpit serves its UI
// AND API under the webroot, so the app reverse proxy forwards
// paths verbatim). Started with implicit-TLS SMTP only: the dev
// PKI (mail_certs.rs) is copied to /certs (cert 0644, key 0600)
// and referenced via MP_SMTP_TLS_CERT/MP_SMTP_TLS_KEY with
// MP_SMTP_REQUIRE_TLS=true — no SMTP username/password anywhere,
// matching the vendored mailpit-stack step-ca deployment.
// Readiness is app-side (wait_ready) on the messages API under
// the webroot: in-container mode publishes no port, so no
// testcontainers http strategy could probe it. Host mode
// publishes the fixed UI port on 0.0.0.0 and the SMTP port
// loopback-only (the sender on the host network relays via
// localhost).

use testcontainers::bollard::models::{HostConfig, PortBinding};
use testcontainers::core::IntoContainerPort;
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, CopyTargetOptions, GenericImage, ImageExt};
use tracing::warn;

use super::kanidm::{publish_nothing, split_image_tag};
use super::log_file::{file_consumer, LogSubfolder};
use super::mail_certs::MailPki;
use super::{Mode, CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE, STARTUP_TIMEOUT};

/// Container name / DNS name on the shared network.
pub(crate) const MAILPIT_CONTAINER_NAME: &str = "mailpit";

/// Mailpit UI (HTTP) and SMTP ports inside the container.
pub(crate) const MAILPIT_UI_PORT: u16 = 8025;
pub(crate) const MAILPIT_SMTP_PORT: u16 = 1025;

/// Bounded retry for the readiness probe: same shape as the
/// kanidm smoke auth loop.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// Running mailpit container plus the upstream base URL used to
/// reach it (loopback + UI port in host mode, the DNS name
/// otherwise). Held by TestcontainersHandle for the process
/// lifetime.
#[allow(dead_code)]
pub(crate) struct MailpitContainer {
    pub(crate) container: ContainerAsync<GenericImage>,
    pub(crate) upstream: String,
}

/// Container request for mailpit: implicit-TLS SMTP (no auth),
/// the /_/mailpit webroot, fixed in-container ports, and the dev
/// PKI copied to /certs at the absolute paths the MP_SMTP_TLS_*
/// env vars point at. No with_wait_for: readiness is app-side
/// (wait_ready) because in-container mode publishes no port a
/// testcontainers http strategy could probe.
pub(crate) fn mailpit_request(
    image: &str,
    mode: Mode,
    network: &str,
    ui_port: u16,
    pki: &MailPki,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    let request = GenericImage::new(name, tag)
        .with_env_var("MP_WEBROOT", "_/mailpit")
        .with_env_var("MP_SMTP_TLS_CERT", "/certs/cert.pem")
        .with_env_var("MP_SMTP_TLS_KEY", "/certs/key.pem")
        .with_env_var("MP_SMTP_REQUIRE_TLS", "true")
        .with_copy_to(
            CopyTargetOptions::new("/certs/cert.pem").with_mode(0o644),
            pki.cert_pem.clone(),
        )
        .with_copy_to(
            CopyTargetOptions::new("/certs/key.pem").with_mode(0o600),
            pki.key_pem.clone(),
        )
        .with_container_name(MAILPIT_CONTAINER_NAME)
        .with_network(network)
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_startup_timeout(STARTUP_TIMEOUT);

    match mode {
        Mode::Host => request
            .with_mapped_port(ui_port, MAILPIT_UI_PORT.tcp())
            .with_mapped_port(MAILPIT_SMTP_PORT, MAILPIT_SMTP_PORT.tcp())
            .with_host_config_modifier(loopback_bindings(ui_port)),
        Mode::InContainer => request.with_host_config_modifier(publish_nothing()),
    }
}

/// Host-config modifier for mailpit in host mode: rewrites the
/// runner-derived bindings (with_mapped_port uses a wildcard host
/// IP) so BOTH the UI and the SMTP socket are loopback-only. The
/// UI is reached exclusively through the app's /_/mailpit proxy —
/// a public UI port would defeat the prefix UX; the SMTP socket is
/// reached by the host-network sender via localhost. Nothing may
/// reach mailpit from outside the host.
fn loopback_bindings(ui_port: u16) -> impl Fn(&mut HostConfig) + Send + Sync + 'static {
    move |config: &mut HostConfig| {
        let mut bindings = config.port_bindings.take().unwrap_or_default();
        for port in [ui_port, MAILPIT_SMTP_PORT] {
            bindings.insert(
                format!("{port}/tcp"),
                Some(vec![PortBinding {
                    host_ip: Some("127.0.0.1".to_string()),
                    host_port: Some(port.to_string()),
                }]),
            );
        }
        config.port_bindings = Some(bindings);
        config.publish_all_ports = Some(false);
    }
}

/// Base URL the app and the sender reach mailpit at: loopback +
/// the fixed UI port in host mode, the container DNS name
/// otherwise. Pure.
pub(crate) fn upstream_base(mode: Mode, ui_port: u16) -> String {
    match mode {
        Mode::Host => format!("http://127.0.0.1:{ui_port}"),
        Mode::InContainer => "http://mailpit:8025".to_string(),
    }
}

/// Start mailpit and wait until its API answers. Returns the
/// running container plus the upstream base URL.
pub(crate) async fn run(
    image: &str,
    mode: Mode,
    network: &str,
    ui_port: u16,
    pki: &MailPki,
) -> Result<MailpitContainer, Box<dyn std::error::Error + Send + Sync>> {
    let upstream = upstream_base(mode, ui_port);

    let container = mailpit_request(image, mode, network, ui_port, pki)
        .with_log_consumer(file_consumer(LogSubfolder::Mailpit))
        .start()
        .await
        .map_err(|error| {
            format!(
                "failed to start the mailpit container \
                 (is Docker installed and running?): {error}"
            )
        })?;

    wait_ready(&upstream).await?;
    Ok(MailpitContainer { container, upstream })
}

/// Bounded-retry readiness probe on the mailpit messages API
/// under the webroot (10 × 250 ms growing to a 2 s cap — same
/// shape as the kanidm smoke auth loop). The API is the smoke
/// surface too: `GET /_/mailpit/api/v1/messages` returns a JSON
/// object with a `total` field.
async fn wait_ready(upstream: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let url = format!("{upstream}/_/mailpit/api/v1/messages");

    let mut last_error = String::from("no attempt made");
    for attempt in 0..RETRY_ATTEMPTS {
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => return Ok(()),
            Ok(response) => {
                last_error = format!("mailpit API returned {}", response.status());
            }
            Err(error) => {
                last_error = format!("mailpit API unreachable: {error}");
            }
        }
        warn!(
            "mailpit readiness attempt {} failed: {}",
            attempt + 1,
            last_error
        );
        tokio::time::sleep(retry_delay(attempt)).await;
    }
    Err(format!(
        "mailpit did not become ready at {upstream} after {RETRY_ATTEMPTS} attempts: \
         {last_error} (container logs are captured under logs/testcontainers/mailpit/)"
    )
    .into())
}

/// Linear backoff for the bounded retries: 250ms, 500ms, ...
/// capped at 2s.
fn retry_delay(attempt: u32) -> std::time::Duration {
    let millis = (RETRY_BASE_DELAY_MS * u64::from(attempt + 1)).min(2000);
    std::time::Duration::from_millis(millis)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testcontainer::mail_certs;
    use std::collections::BTreeMap;
    use testcontainers::bollard::models::PortMap;

    fn test_pki(mode: Mode) -> MailPki {
        mail_certs::generate(mode).expect("PKI generation should succeed")
    }

    #[test]
    fn upstream_base_follows_the_mode() {
        assert_eq!(upstream_base(Mode::Host, 8025), "http://127.0.0.1:8025");
        assert_eq!(upstream_base(Mode::Host, 8026), "http://127.0.0.1:8026");
        assert_eq!(
            upstream_base(Mode::InContainer, 8025),
            "http://mailpit:8025"
        );
    }

    #[test]
    fn request_sets_tls_webroot_and_copies() {
        let pki = test_pki(Mode::Host);
        let request = mailpit_request(
            "axllent/mailpit:v1.31.2",
            Mode::Host,
            "kanidm-admin-dev",
            8025,
            &pki,
        );

        let env: BTreeMap<String, String> = request
            .env_vars()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect();
        assert_eq!(
            env.get("MP_WEBROOT").map(String::as_str),
            Some("_/mailpit")
        );
        assert_eq!(
            env.get("MP_SMTP_TLS_CERT").map(String::as_str),
            Some("/certs/cert.pem")
        );
        assert_eq!(
            env.get("MP_SMTP_TLS_KEY").map(String::as_str),
            Some("/certs/key.pem")
        );
        assert_eq!(
            env.get("MP_SMTP_REQUIRE_TLS").map(String::as_str),
            Some("true")
        );
        // No SMTP auth env vars — certificate trust only.
        assert!(
            !env.keys().any(|key| key.contains("AUTH")),
            "mailpit must run without SMTP auth env: {env:?}"
        );

        // Identity on the shared network + label.
        assert_eq!(
            request.container_name().as_deref(),
            Some(MAILPIT_CONTAINER_NAME)
        );
        assert_eq!(request.network().as_deref(), Some("kanidm-admin-dev"));
        assert_eq!(
            request.labels().get(CONTAINER_LABEL_KEY).map(String::as_str),
            Some("true")
        );

        // cert (0644) + key (0600) copied to /certs.
        assert_eq!(request.copy_to_sources().count(), 2);
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains("/certs/cert.pem"));
        assert!(debug.contains("/certs/key.pem"));

        // Host mode maps the fixed UI port and the SMTP port
        // (the modifier then pins the SMTP binding to loopback).
        let ports = request.ports().expect("host mode maps the UI and SMTP ports");
        let debug = format!("{ports:?}");
        assert!(
            debug.contains("8025"),
            "the mapped host port is the configured UI port: {ports:?}"
        );
        assert!(
            debug.contains("1025"),
            "the SMTP port is mapped for the loopback rewrite: {ports:?}"
        );
    }

    #[test]
    fn in_container_mode_publishes_nothing() {
        let pki = test_pki(Mode::InContainer);
        let request = mailpit_request(
            "axllent/mailpit:v1.31.2",
            Mode::InContainer,
            "kanidm-admin-dev",
            8025,
            &pki,
        );
        assert!(
            request.ports().is_none() && request.expose_ports().is_empty(),
            "in-container mode must not publish any port"
        );
    }

    #[test]
    fn loopback_bindings_modifier_pins_ui_and_smtp_to_loopback() {
        // HostConfig as the runner builds it for host mode: both
        // mapped ports carry wildcard host IPs.
        let mut config = HostConfig {
            port_bindings: Some(PortMap::from([
                (
                    "8025/tcp".to_string(),
                    Some(vec![PortBinding {
                        host_ip: None,
                        host_port: Some("8025".to_string()),
                    }]),
                ),
                (
                    "1025/tcp".to_string(),
                    Some(vec![PortBinding {
                        host_ip: None,
                        host_port: Some("1025".to_string()),
                    }]),
                ),
            ])),
            ..Default::default()
        };

        loopback_bindings(8025)(&mut config);

        let bindings = config.port_bindings.expect("bindings stay present");
        for (key, port) in [("8025/tcp", "8025"), ("1025/tcp", "1025")] {
            let binding = bindings
                .get(key)
                .and_then(|binding| binding.as_ref())
                .and_then(|list| list.first());
            assert_eq!(
                binding.and_then(|binding| binding.host_ip.as_deref()),
                Some("127.0.0.1"),
                "{key} must be loopback-only"
            );
            assert_eq!(
                binding.and_then(|binding| binding.host_port.as_deref()),
                Some(port)
            );
        }
        assert_eq!(config.publish_all_ports, Some(false));
    }

    #[test]
    fn loopback_bindings_follow_a_custom_ui_port() {
        let mut config = HostConfig {
            port_bindings: Some(PortMap::from([(
                "8026/tcp".to_string(),
                Some(vec![PortBinding {
                    host_ip: None,
                    host_port: Some("8026".to_string()),
                }]),
            )])),
            ..Default::default()
        };
        loopback_bindings(8026)(&mut config);
        let binding = config
            .port_bindings
            .expect("bindings present")
            .get("8026/tcp")
            .and_then(|binding| binding.as_ref())
            .and_then(|list| list.first())
            .and_then(|binding| binding.host_ip.clone());
        assert_eq!(binding.as_deref(), Some("127.0.0.1"));
    }
}
