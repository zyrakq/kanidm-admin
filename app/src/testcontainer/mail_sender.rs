// app/src/testcontainer/mail_sender.rs
//
// kanidm-mail-sender container: provisions the mail-sender
// service account against the dev kanidm (service account +
// idm_message_senders membership + read-write API token), builds
// the two config TOMLs the sender requires (flat client config +
// mail sender config, both mode-aware), starts the container with
// the kanidm CA and the mailcrab CA mounted, and proves the whole
// chain with a one-shot test mail delivered to mailcrab.

use testcontainers::core::{CmdWaitFor, ExecCommand, WaitFor};
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ContainerRequest, CopyTargetOptions, GenericImage, ImageExt};
use tracing::warn;

use super::kanidm::{split_image_tag, IDM_ADMIN_USERNAME};
use super::log_file::{file_consumer, LogSubfolder};
use super::mail_certs::MailPki;
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
/// config TOML is a flattened struct). `verify_hostnames` follows
/// the mode: the dev certificate's SAN is `localhost` in host
/// mode (the sender connects via the container DNS name `kanidm`,
/// so hostname verification would fail) and `kanidm` in
/// in-container mode.
fn client_config_toml(mode: Mode) -> String {
    let verify_hostnames = match mode {
        Mode::Host => "false",
        Mode::InContainer => "true",
    };
    format!(
        "uri = \"https://kanidm:8443\"
verify_hostnames = {verify_hostnames}
verify_ca = true
ca_path = \"/data/kanidm/ca.pem\"
connect_timeout = 10
"
    )
}

/// Mail sender config TOML (exact content from the design). The
/// `schedule` key is omitted on purpose: kanidm-mail-sender
/// defaults to checking every 5 s when no schedule is set.
fn mail_sender_toml(token: &str, instance_url: &str) -> String {
    format!(
        "token = \"{token}\"
instance_display_name = \"Kanidm Admin (dev)\"
instance_url = \"{instance_url}\"
mail_from_address = \"noreply@localhost\"
mail_reply_to_address = \"noreply@localhost\"
mail_relay = \"smtps://mailcrab:1025\"
mail_username = \"mailcrab\"
mail_password = \"mailcrab\"
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
/// tools image has no EXPOSE, there is nothing to publish.
fn sender_request(
    image: &str,
    mode: Mode,
    network: &str,
    client_toml: String,
    mail_toml: String,
    kanidm_ca: Vec<u8>,
    mailcrab_ca: Vec<u8>,
) -> ContainerRequest<GenericImage> {
    let (name, tag) = split_image_tag(image);
    GenericImage::new(name, tag)
        .with_wait_for(WaitFor::message_on_stderr(READINESS_MARKER))
        .with_cmd(SENDER_CMD)
        .with_env_var("SSL_CERT_FILE", "/etc/pki/trust/anchors/mailcrab-dev-ca.pem")
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
            CopyTargetOptions::new("/etc/pki/trust/anchors/mailcrab-dev-ca.pem").with_mode(0o644),
            mailcrab_ca,
        )
        .with_container_name("kanidm-mail-sender")
        .with_network(network)
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_startup_timeout(STARTUP_TIMEOUT)
}

/// Provision + start the sender and prove the mail chain with a
/// one-shot test mail: the sender's `-t` smoke must exit 0 and
/// the mailcrab API must hold at least one message afterwards.
pub(crate) async fn run(
    settings: &MailSenderContainerSettings,
    mode: Mode,
    network: &str,
    dev: &DevKanidm,
    pki: &MailPki,
    mailcrab_upstream: &str,
) -> Result<ContainerAsync<GenericImage>, Box<dyn std::error::Error + Send + Sync>> {
    // 1. Provision the service account + API token as idm_admin.
    let token = provision(&dev.effective, &dev.credentials.idm_admin_password).await?;

    // 2. Build the configs and start the container (readiness via
    //    the stderr startup marker).
    let client_toml = client_config_toml(mode);
    let mail_toml = mail_sender_toml(&token, &dev.effective.url);
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

    // 3. Best-effort CA store refresh; SSL_CERT_FILE is the
    //    deterministic fallback, so failure only warns.
    if let Err(error) = container.exec(ExecCommand::new(["update-ca-trust"])).await {
        warn!("update-ca-trust exec failed (SSL_CERT_FILE covers it): {error}");
    }

    // 4. One-shot test mail through the sender binary.
    container
        .exec(
            ExecCommand::new([...SENDER_CMD, "-t", "test@example.com"])
                .with_cmd_ready_condition(CmdWaitFor::exit_code(0)),
        )
        .await
        .map_err(|error| {
            format!(
                "the mail-sender test mail failed: {error} \
                 (container logs are captured under logs/testcontainers/kanidm-mail-sender/)"
            )
        })?;

    // 5. The test mail must have arrived in mailcrab.
    assert_mail_delivered(mailcrab_upstream).await?;

    Ok(container)
}

/// Smoke assertion: the mailcrab API holds at least one message
/// (the `-t` test mail the sender just delivered).
async fn assert_mail_delivered(
    mailcrab_upstream: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{mailcrab_upstream}/_/mailcrab/api/messages");
    let response = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|error| {
            format!(
                "failed to reach the mailcrab API at {mailcrab_upstream} after the \
                 test mail: {error} (container logs are captured under \
                 logs/testcontainers/kanidm-mail-sender/)"
            )
        })?;
    let messages: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("the mailcrab API response was not valid JSON: {error}"))?;
    let count = messages.as_array().map(|messages| messages.len()).unwrap_or(0);
    if count == 0 {
        return Err(format!(
            "no message reached mailcrab at {mailcrab_upstream} after the test mail \
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
    fn client_config_toml_matches_host_mode() {
        assert_eq!(
            client_config_toml(Mode::Host),
            indoc! {r#"
                uri = "https://kanidm:8443"
                verify_hostnames = false
                verify_ca = true
                ca_path = "/data/kanidm/ca.pem"
                connect_timeout = 10
            "#}
        );
    }

    #[test]
    fn client_config_toml_matches_in_container_mode() {
        assert_eq!(
            client_config_toml(Mode::InContainer),
            indoc! {r#"
                uri = "https://kanidm:8443"
                verify_hostnames = true
                verify_ca = true
                ca_path = "/data/kanidm/ca.pem"
                connect_timeout = 10
            "#}
        );
    }

    #[test]
    fn mail_sender_toml_carries_token_and_instance_url() {
        assert_eq!(
            mail_sender_toml("tok-123", "https://localhost:55001"),
            indoc! {r#"
                token = "tok-123"
                instance_display_name = "Kanidm Admin (dev)"
                instance_url = "https://localhost:55001"
                mail_from_address = "noreply@localhost"
                mail_reply_to_address = "noreply@localhost"
                mail_relay = "smtps://mailcrab:1025"
                mail_username = "mailcrab"
                mail_password = "mailcrab"
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
            Mode::Host,
            "kanidm-admin-dev",
            client_config_toml(Mode::Host),
            mail_sender_toml("tok", "https://localhost:55001"),
            b"kanidm-ca".to_vec(),
            b"mailcrab-ca".to_vec(),
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
            Some("/etc/pki/trust/anchors/mailcrab-dev-ca.pem")
        );

        // Four copies: client TOML, mail TOML, kanidm CA,
        // mailcrab CA.
        assert_eq!(request.copy_to_sources().count(), 4);
        let debug = format!("{:?}", request.copy_to_sources().collect::<Vec<_>>());
        assert!(debug.contains("/data/kanidm/config"));
        assert!(debug.contains("/data/kanidm/mail-sender"));
        assert!(debug.contains("/data/kanidm/ca.pem"));
        assert!(debug.contains("/etc/pki/trust/anchors/mailcrab-dev-ca.pem"));
    }
}
