// app/src/testcontainer/mail_sender.rs
//
// kanidm-mail-sender container: provisions the mail-sender
// service account against the dev kanidm (service account +
// idm_message_senders membership + read-write API token), builds
// the two config TOMLs the sender requires (flat client config +
// mail sender config, both mode-aware), starts the container with
// the kanidm CA and the mailpit CA mounted, and proves the whole
// chain with a one-shot test mail delivered to mailpit. Host
// mode runs the sender on the host network (network_mode "host",
// no shared docker network): kanidm is reached through the app's
// effective loopback URL and mailpit through its loopback-
// published SMTP port, so every leg keeps FULL TLS verification.

use testcontainers::bollard::models::{HostConfig, PortMap};
use testcontainers::core::{CmdWaitFor, ExecCommand, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, CopyTargetOptions, GenericImage, ImageExt};
use tracing::warn;

use super::kanidm::{split_image_tag, IDM_ADMIN_USERNAME};
use super::log_file::{file_consumer, LogSubfolder};
use super::mail_certs::MailPki;
use super::mailpit::MAILPIT_SMTP_PORT;
use super::{DevKanidm, Mode, CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE, STARTUP_TIMEOUT};
use crate::settings::kanidm::KanidmSettings;
use crate::settings::testcontainer::MailSenderContainerSettings;

/// The sender's runtime command: the binary, the root-check skip
/// (the tools image has no USER directive and runs as root) and
/// both config paths.
const SENDER_CMD: [&str; 6] = [
    "/sbin/kanidm-mail-sender",
    "--skip-root-check",
    "-c",
    "/data/kanidm/config",
    "-m",
    "/data/kanidm/mail-sender",
];

/// Readiness marker: the sender logs this on stderr once its
/// scheduler starts (tools/mail_sender main.rs:256).
const READINESS_MARKER: &str = "next mail check on";

/// Flat kanidm client config for the sender (the kanidm client
/// config TOML is a flattened struct). `verify_hostnames` stays
/// true in BOTH modes: kanidm_client 1.11.1 maps `false` to
/// reqwest's `danger_accept_invalid_hostnames`, which the
/// reqwest 0.13 rustls backend rejects at client build time
/// ("disabling rustls hostname verification only allowed with
/// tls_certs_only()"), and the mode-aware uri — the certificate
/// SAN is `localhost` in host mode, `kanidm` in-container —
/// makes full hostname verification pass anyway.
fn client_config_toml(uri: &str) -> String {
    format!(
        "uri = \"{uri}\"
verify_hostnames = true
verify_ca = true
ca_path = \"/data/kanidm/ca.pem\"
connect_timeout = 10
"
    )
}

/// Mail sender config TOML. The `schedule` key is omitted on
/// purpose: kanidm-mail-sender defaults to checking every 5 s
/// when no schedule is set. The relay is mode-aware (loopback in
/// host mode, the mailpit DNS name otherwise) and its port is
/// single-sourced from the mailpit SMTP constant. No
/// mail_username/mail_password: mailpit runs certificate-trust
/// only (both fields are Option in the sender and are omitted).
fn mail_sender_toml(token: &str, instance_url: &str, mail_relay: &str) -> String {
    format!(
        "token = \"{token}\"
instance_display_name = \"Kanidm Admin (dev)\"
instance_url = \"{instance_url}\"
mail_from_address = \"noreply@localhost\"
mail_reply_to_address = \"noreply@localhost\"
mail_relay = \"{mail_relay}\"
mail_connect_timeout_seconds = 15
"
    )
}

/// Provision the mail-sender service account against the dev
/// kanidm as idm_admin: create the account, add it to the
/// idm_message_senders group, generate a read-write API token.
/// Fresh kanidm DB per run — no idempotency handling needed.
/// ClientError does not implement std::error::Error, so it is
/// mapped via Debug formatting (same style as auth/mod.rs).
async fn provision(
    effective: &KanidmSettings,
    idm_admin_password: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let builder = crate::auth::ops::client_builder_from_settings(effective)
        .map_err(|error| format!("failed to build the provisioning client: {error:?}"))?;
    let client = builder
        .build()
        .map_err(|error| format!("failed to build the provisioning client: {error:?}"))?;

    client
        .auth_simple_password(IDM_ADMIN_USERNAME, idm_admin_password)
        .await
        .map_err(|error| format!("idm_admin auth for mail-sender provisioning failed: {error:?}"))?;

    client
        .idm_service_account_create("mail-sender", "Mail Sender", "idm_admins")
        .await
        .map_err(|error| format!("service account create failed: {error:?}"))?;

    client
        .idm_group_add_members("idm_message_senders", &["mail-sender"])
        .await
        .map_err(|error| format!("group add-members failed: {error:?}"))?;

    let token = client
        .idm_service_account_generate_api_token("mail-sender", "mail-sender-dev", None, true, false)
        .await
        .map_err(|error| format!("api token generate failed: {error:?}"))?;

    Ok(token)
}

/// Container request for the sender: readiness on the startup
/// marker logged on stderr, both config TOMLs + both CAs mounted
/// with the modes the sender's security checks require (both
/// config files 0600, the trust anchor 0644). No ports — the
/// tools image has no EXPOSE, there is nothing to publish. Host
/// mode runs on the host network (no shared docker network);
/// in-container mode joins the shared network.
fn sender_request(
    image: &str,
    mode: Mode,
    network: &str,
    client_toml: String,
    mail_toml: String,
    kanidm_ca: Vec<u8>,
    mailpit_ca: Vec<u8>,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    let request = GenericImage::new(name, tag)
        .with_wait_for(WaitFor::message_on_stderr(READINESS_MARKER))
        .with_cmd(SENDER_CMD)
        .with_env_var("SSL_CERT_FILE", "/etc/pki/trust/anchors/mailpit-dev-ca.pem")
        .with_copy_to(
            CopyTargetOptions::new("/data/kanidm/config").with_mode(0o600),
            client_toml.into_bytes(),
        )
        .with_copy_to(
            CopyTargetOptions::new("/data/kanidm/mail-sender").with_mode(0o600),
            mail_toml.into_bytes(),
        )
        .with_copy_to(
            CopyTargetOptions::new("/data/kanidm/ca.pem").with_mode(0o600),
            kanidm_ca,
        )
        .with_copy_to(
            CopyTargetOptions::new("/etc/pki/trust/anchors/mailpit-dev-ca.pem").with_mode(0o644),
            mailpit_ca,
        )
        .with_container_name("kanidm-mail-sender")
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_startup_timeout(STARTUP_TIMEOUT);

    match mode {
        Mode::Host => request.with_host_config_modifier(host_network()),
        Mode::InContainer => request.with_network(network),
    }
}

/// Host-config modifier for the sender in host mode: run on the
/// host network (`network_mode = "host"`), so `localhost` inside
/// the sender is the host's loopback — the kanidm HTTPS port and
/// the mailpit SMTP port, both published loopback-only, are
/// reachable without any shared-network DNS. Nothing is
/// published (the tools image has no EXPOSE).
fn host_network() -> impl Fn(&mut HostConfig) + Send + Sync + 'static {
    |config: &mut HostConfig| {
        config.network_mode = Some("host".to_string());
        config.port_bindings = Some(PortMap::new());
        config.publish_all_ports = Some(false);
    }
}

/// Provision + start the sender and prove the mail chain with
/// the one-shot test mail (the `-t` smoke must exit 0 and the
/// mailpit API must hold at least one message afterwards). The
/// kanidm-poll smoke lives in mod.rs (`assert_sender_polling`),
/// run against the returned container's stderr.
pub(crate) async fn run(
    settings: &MailSenderContainerSettings,
    mode: Mode,
    network: &str,
    dev: &DevKanidm,
    pki: &MailPki,
    mailpit_upstream: &str,
) -> Result<ContainerAsync<GenericImage>, Box<dyn std::error::Error + Send + Sync>> {
    // 1. Provision the service account + API token as idm_admin.
    let token = provision(&dev.effective, &dev.credentials.idm_admin_password).await?;

    // 2. Mode-aware endpoints. Host mode: the sender runs on the
    //    host network, so kanidm is the app's effective URL (the
    //    loopback-published ephemeral port, certificate SAN
    //    `localhost`) and the relay is mailpit's loopback-
    //    published SMTP port. In-container mode: the shared-network
    //    DNS names, as before.
    let uri = match mode {
        Mode::Host => dev.effective.url.as_str(),
        Mode::InContainer => "https://kanidm:8443",
    };
    let mail_relay = match mode {
        Mode::Host => format!("smtps://localhost:{MAILPIT_SMTP_PORT}"),
        Mode::InContainer => format!("smtps://mailpit:{MAILPIT_SMTP_PORT}"),
    };

    // 3. Build the configs and start the container (readiness via
    //    the stderr startup marker).
    let client_toml = client_config_toml(uri);
    let mail_toml = mail_sender_toml(&token, &dev.effective.url, &mail_relay);
    let container = sender_request(
        &settings.image,
        mode,
        network,
        client_toml,
        mail_toml,
        dev.ca_pem.clone(),
        pki.ca_pem.clone(),
    )
    .with_log_consumer(file_consumer(LogSubfolder::MailSender))
    .start()
    .await
    .map_err(|error| {
        format!(
            "failed to start the kanidm-mail-sender container \
             (is Docker installed and running?): {error}"
        )
    })?;

    // 4. Best-effort CA store refresh; SSL_CERT_FILE is the
    //    deterministic fallback, so failure only warns.
    if let Err(error) = container.exec(ExecCommand::new(["update-ca-trust"])).await {
        warn!("update-ca-trust exec failed (SSL_CERT_FILE covers it): {error}");
    }

    // 5. One-shot test mail through the sender binary.
    container
        .exec(
            ExecCommand::new(SENDER_CMD.iter().copied().chain(["-t", "test@example.com"]))
                .with_cmd_ready_condition(CmdWaitFor::exit_code(0)),
        )
        .await
        .map_err(|error| {
            format!(
                "the mail-sender test mail failed: {error} \
                 (container logs are captured under logs/testcontainers/kanidm-mail-sender/)"
            )
        })?;

    // 6. The test mail must have arrived in mailpit.
    assert_mail_delivered(mailpit_upstream).await?;

    Ok(container)
}

/// Smoke assertion: the mailpit API holds at least one message
/// (the `-t` test mail the sender just delivered). Mailpit's
/// messages API returns a JSON object with a `total` count.
async fn assert_mail_delivered(
    mailpit_upstream: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{mailpit_upstream}/_/mailpit/api/v1/messages");
    let response = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|error| {
            format!(
                "failed to reach the mailpit API at {mailpit_upstream} after the \
                 test mail: {error} (container logs are captured under \
                 logs/testcontainers/kanidm-mail-sender/)"
            )
        })?;
    let messages: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("the mailpit API response was not valid JSON: {error}"))?;
    let total = messages
        .get("total")
        .and_then(|total| total.as_u64())
        .unwrap_or(0);
    if total == 0 {
        return Err(format!(
            "no message reached mailpit at {mailpit_upstream} after the test mail \
             (container logs are captured under logs/testcontainers/kanidm-mail-sender/)"
        )
        .into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use indoc::indoc;

    #[test]
    fn client_config_toml_keeps_full_verification() {
        assert_eq!(
            client_config_toml("https://localhost:55001"),
            indoc! {r#"
                uri = "https://localhost:55001"
                verify_hostnames = true
                verify_ca = true
                ca_path = "/data/kanidm/ca.pem"
                connect_timeout = 10
            "#}
        );
    }

    #[test]
    fn mail_sender_toml_carries_token_instance_url_and_relay() {
        assert_eq!(
            mail_sender_toml("tok-123", "https://localhost:55001", "smtps://localhost:1025"),
            indoc! {r#"
                token = "tok-123"
                instance_display_name = "Kanidm Admin (dev)"
                instance_url = "https://localhost:55001"
                mail_from_address = "noreply@localhost"
                mail_reply_to_address = "noreply@localhost"
                mail_relay = "smtps://localhost:1025"
                mail_connect_timeout_seconds = 15
            "#}
        );
    }

    #[test]
    fn sender_cmd_skips_root_check_with_both_configs() {
        assert_eq!(
            SENDER_CMD,
            [
                "/sbin/kanidm-mail-sender",
                "--skip-root-check",
                "-c",
                "/data/kanidm/config",
                "-m",
                "/data/kanidm/mail-sender",
            ]
        );
    }

    #[test]
    fn sender_request_mounts_configs_and_cas_with_modes() {
        let request = sender_request(
            "kanidm/tools:1.11.1",
            Mode::InContainer,
            "kanidm-admin-dev",
            client_config_toml("https://kanidm:8443"),
            mail_sender_toml("tok", "https://kanidm:8443", "smtps://mailpit:1025"),
            b"kanidm-ca".to_vec(),
            b"mailpit-ca".to_vec(),
        );

        // Readiness: exactly one stderr log wait on the marker.
        let conditions = request.ready_conditions();
        assert!(
            matches!(conditions.as_slice(), [WaitFor::Log(_)]),
            "expected exactly one log wait, got {conditions:?}"
        );
        assert!(format!("{conditions:?}").contains(READINESS_MARKER));

        // Command + identity + label.
        assert_eq!(
            request.cmd().collect::<Vec<_>>(),
            SENDER_CMD.to_vec(),
            "the sender runs with the root-check skip and both configs"
        );
        assert_eq!(
            request.container_name().as_deref(),
            Some("kanidm-mail-sender")
        );
        assert_eq!(request.network().as_deref(), Some("kanidm-admin-dev"));
        assert_eq!(
            request.labels().get(CONTAINER_LABEL_KEY).map(String::as_str),
            Some("true")
        );

        // SSL_CERT_FILE is always set as the deterministic CA
        // fallback.
        let env: std::collections::BTreeMap<String, String> = request
            .env_vars()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect();
        assert_eq!(
            env.get("SSL_CERT_FILE").map(String::as_str),
            Some("/etc/pki/trust/anchors/mailpit-dev-ca.pem")
        );

        // Four copies: client TOML, mail TOML, kanidm CA,
        // mailpit CA.
        assert_eq!(request.copy_to_sources().count(), 4);
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains("/data/kanidm/config"));
        assert!(debug.contains("/data/kanidm/mail-sender"));
        assert!(debug.contains("/data/kanidm/ca.pem"));
        assert!(debug.contains("/etc/pki/trust/anchors/mailpit-dev-ca.pem"));
    }

    #[test]
    fn sender_request_host_mode_joins_no_network() {
        let request = sender_request(
            "kanidm/tools:1.11.1",
            Mode::Host,
            "kanidm-admin-dev",
            client_config_toml("https://localhost:55001"),
            mail_sender_toml("tok", "https://localhost:55001", "smtps://localhost:1025"),
            b"kanidm-ca".to_vec(),
            b"mailpit-ca".to_vec(),
        );

        // Host mode: the shared docker network is NOT attached
        // (the sender runs on the host network instead).
        assert_eq!(
            request.network(),
            &None,
            "host mode must not attach the shared docker network"
        );

        // The rest of the request shape is mode-independent.
        assert_eq!(
            request.container_name().as_deref(),
            Some("kanidm-mail-sender")
        );
        assert_eq!(request.copy_to_sources().count(), 4);
    }

    #[test]
    fn host_network_modifier_sets_host_mode_and_publishes_nothing() {
        let mut config = HostConfig::default();
        host_network()(&mut config);
        assert_eq!(config.network_mode.as_deref(), Some("host"));
        assert!(
            config
                .port_bindings
                .as_ref()
                .is_some_and(|bindings| bindings.is_empty()),
            "no ports are published"
        );
        assert_eq!(config.publish_all_ports, Some(false));
    }
}
