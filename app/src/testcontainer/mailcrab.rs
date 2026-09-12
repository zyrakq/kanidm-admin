// app/src/testcontainer/mailcrab.rs
//
// Mailcrab container: the catch-all dev mail sink with a web UI
// under the /_/mailcrab prefix. Started with TLS auth enabled and
// the dev PKI (mail_certs.rs) mounted at the RELATIVE cert/key
// paths mailcrab's SMTP TLS endpoint serves (WORKDIR /app), so
// the sender verifies it with real TLS. Readiness is app-side
// (wait_ready): in-container mode publishes no port, so no
// testcontainers http strategy could probe it.

use testcontainers::core::IntoContainerPort;
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, CopyTargetOptions, GenericImage, ImageExt};
use tracing::warn;

use super::kanidm::{publish_nothing, split_image_tag};
use super::log_file::{file_consumer, LogSubfolder};
use super::mail_certs::MailPki;
use super::{Mode, CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE, STARTUP_TIMEOUT};

/// Container name / DNS name on the shared network.
pub(crate) const MAILCRAB_CONTAINER_NAME: &str = "mailcrab";

/// Mailcrab UI (HTTP) and SMTP ports inside the container.
pub(crate) const MAILCRAB_HTTP_PORT: u16 = 1080;
pub(crate) const MAILCRAB_SMTP_PORT: u16 = 1025;

/// Bounded retry for the readiness probe: same shape as the
/// kanidm smoke auth loop.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// Running mailcrab container plus the upstream base URL used to
/// reach it (loopback + UI port in host mode, the DNS name
/// otherwise). Held by TestcontainersHandle for the process
/// lifetime.
#[allow(dead_code)]
pub(crate) struct MailcrabContainer {
    pub(crate) container: ContainerAsync<GenericImage>,
    pub(crate) upstream: String,
}

/// Container request for mailcrab: TLS auth on, the /_/mailcrab
/// prefix, fixed in-container ports, and the dev PKI mounted at
/// the relative cert/key paths (WORKDIR /app). No with_wait_for:
/// readiness is app-side (wait_ready) because in-container mode
/// publishes no port a testcontainers http strategy could probe.
pub(crate) fn mailcrab_request(
    image: &str,
    mode: Mode,
    network: &str,
    ui_port: u16,
    pki: &MailPki,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    let request = GenericImage::new(name, tag)
        .with_env_var("ENABLE_TLS_AUTH", "true")
        .with_env_var("MAILCRAB_PREFIX", "_/mailcrab")
        .with_env_var("HTTP_PORT", "1080")
        .with_env_var("SMTP_PORT", "1025")
        .with_copy_to(
            CopyTargetOptions::new("/app/cert.pem").with_mode(0o644),
            pki.cert_pem.clone(),
        )
        .with_copy_to(
            CopyTargetOptions::new("/app/key.pem").with_mode(0o600),
            pki.key_pem.clone(),
        )
        .with_container_name(MAILCRAB_CONTAINER_NAME)
        .with_network(network)
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_startup_timeout(STARTUP_TIMEOUT);

    match mode {
        Mode::Host => request.with_mapped_port(ui_port, MAILCRAB_HTTP_PORT.tcp()),
        Mode::InContainer => request.with_host_config_modifier(publish_nothing()),
    }
}

/// Base URL the app and the sender reach mailcrab at: loopback +
/// the fixed UI port in host mode, the container DNS name
/// otherwise. Pure.
pub(crate) fn upstream_base(mode: Mode, ui_port: u16) -> String {
    match mode {
        Mode::Host => format!("http://127.0.0.1:{ui_port}"),
        Mode::InContainer => "http://mailcrab:1080".to_string(),
    }
}

/// Start mailcrab and wait until its API answers. Returns the
/// running container plus the upstream base URL.
pub(crate) async fn run(
    image: &str,
    mode: Mode,
    network: &str,
    ui_port: u16,
    pki: &MailPki,
) -> Result<MailcrabContainer, Box<dyn std::error::Error + Send + Sync>> {
    let upstream = upstream_base(mode, ui_port);

    let container = mailcrab_request(image, mode, network, ui_port, pki)
        .with_log_consumer(file_consumer(LogSubfolder::Mailcrab))
        .start()
        .await
        .map_err(|error| {
            format!(
                "failed to start the mailcrab container \
                 (is Docker installed and running?): {error}"
            )
        })?;

    wait_ready(&upstream).await?;
    Ok(MailcrabContainer { container, upstream })
}

/// Bounded-retry readiness probe on the mailcrab version API
/// (10 × 250 ms growing to a 2 s cap — same shape as the kanidm
/// smoke auth loop).
async fn wait_ready(upstream: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let url = format!("{upstream}/_/mailcrab/api/version");

    let mut last_error = String::from("no attempt made");
    for attempt in 0..RETRY_ATTEMPTS {
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => return Ok(()),
            Ok(response) => {
                last_error = format!("mailcrab API returned {}", response.status());
            }
            Err(error) => {
                last_error = format!("mailcrab API unreachable: {error}");
            }
        }
        warn!(
            "mailcrab readiness attempt {} failed: {}",
            attempt + 1,
            last_error
        );
        tokio::time::sleep(retry_delay(attempt)).await;
    }
    Err(format!(
        "mailcrab did not become ready at {upstream} after {RETRY_ATTEMPTS} attempts: \
         {last_error} (container logs are captured under logs/testcontainers/mailcrab/)"
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

    fn test_pki() -> MailPki {
        mail_certs::generate().expect("PKI generation should succeed")
    }

    #[test]
    fn upstream_base_follows_the_mode() {
        assert_eq!(upstream_base(Mode::Host, 1080), "http://127.0.0.1:1080");
        assert_eq!(upstream_base(Mode::Host, 1081), "http://127.0.0.1:1081");
        assert_eq!(
            upstream_base(Mode::InContainer, 1080),
            "http://mailcrab:1080"
        );
    }

    #[test]
    fn request_sets_tls_prefix_ports_and_copies() {
        let pki = test_pki();
        let request = mailcrab_request(
            "marlonb/mailcrab:v1.9.0",
            Mode::Host,
            "kanidm-admin-dev",
            1080,
            &pki,
        );

        let env: BTreeMap<String, String> = request
            .env_vars()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect();
        assert_eq!(
            env.get("ENABLE_TLS_AUTH").map(String::as_str),
            Some("true")
        );
        assert_eq!(
            env.get("MAILCRAB_PREFIX").map(String::as_str),
            Some("_/mailcrab")
        );
        assert_eq!(env.get("HTTP_PORT").map(String::as_str), Some("1080"));
        assert_eq!(env.get("SMTP_PORT").map(String::as_str), Some("1025"));

        // Identity on the shared network + label.
        assert_eq!(
            request.container_name().as_deref(),
            Some(MAILCRAB_CONTAINER_NAME)
        );
        assert_eq!(request.network().as_deref(), Some("kanidm-admin-dev"));
        assert_eq!(
            request.labels().get(CONTAINER_LABEL_KEY).map(String::as_str),
            Some("true")
        );

        // cert + key mounted at the relative WORKDIR paths.
        assert_eq!(request.copy_to_sources().count(), 2);
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains("/app/cert.pem"));
        assert!(debug.contains("/app/key.pem"));

        // Host mode maps the fixed UI port.
        let ports = request.ports().expect("host mode maps the UI port");
        assert!(
            format!("{ports:?}").contains("1080"),
            "the mapped host port is the configured UI port: {ports:?}"
        );
    }

    #[test]
    fn in_container_mode_publishes_nothing() {
        let pki = test_pki();
        let request = mailcrab_request(
            "marlonb/mailcrab:v1.9.0",
            Mode::InContainer,
            "kanidm-admin-dev",
            1080,
            &pki,
        );
        assert!(
            request.ports().is_none() && request.expose_ports().is_empty(),
            "in-container mode must not publish any port"
        );
    }
}
