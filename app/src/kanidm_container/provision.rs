// app/src/kanidm_container/provision.rs
//
// Account side of dev container provisioning: recover the built-in
// admin and idm_admin passwords via exec on the running container,
// log them for the contributor, and smoke-test the effective
// connection settings end-to-end (real TLS verification against the
// container's own CA). Also derives the effective [kanidm] settings
// the rest of the app connects with.
//
// Note: kanidm_client::ClientError does not implement std::error::Error
// (only Debug), so every client call is mapped into a string error —
// same style as auth/mod.rs.

use std::time::Duration;

use testcontainers::{ContainerAsync, GenericImage};
use tracing::{info, warn};

use crate::settings::kanidm::KanidmSettings;

use super::image::exec_stdout;
use super::styles::{OVERRIDE_CSS_MARKER, OVERRIDE_CSS_PATH};

/// Built-in accounts recovered on every start: recover-account
/// generates a NEW random password per call, so both are recovered
/// fresh and logged.
pub const ADMIN_USERNAME: &str = "admin";
pub const IDM_ADMIN_USERNAME: &str = "idm_admin";

/// Bounded retry for the recover-account exec and the smoke auth: the
/// readiness log line means "listener bound", which can race full
/// request readiness by a moment.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// Server URL endpoint serving the UI package files; the container
/// path (OVERRIDE_CSS_PATH) and this URL path are distinct namespaces.
const OVERRIDE_CSS_ENDPOINT: &str = "/pkg/override.css";

/// Both recovered credentials, ready for logging and smoke auth.
pub struct DevCredentials {
    pub admin_password: String,
    pub idm_admin_password: String,
}

/// Recover the built-in admin and idm_admin passwords by exec'ing
/// `kanidmd scripting recover-account <name>` inside the running
/// container, with bounded retry.
pub(super) async fn recover_builtin_credentials(
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
/// prints JSON status lines on stdout; the password is the `output`
/// field of the ok line.
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

/// Extract the password from `recover-account` stdout: scan the lines
/// for a `{"status":"ok","output":...}` JSON object (kanidmd also
/// logs to stdout, so other lines are skipped).
pub fn parse_recover_account_password(stdout: &[u8]) -> Option<String> {
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

/// Log the dev connection details, credentials included. Dev-only by
/// construction: this module runs exclusively in container mode.
pub(super) fn log_dev_credentials(url: &str, credentials: &DevCredentials) {
    info!(
        url = %url,
        admin = ADMIN_USERNAME,
        admin_password = %format!("'{}'", credentials.admin_password),
        idm_admin = IDM_ADMIN_USERNAME,
        idm_admin_password = %format!("'{}'", credentials.idm_admin_password),
        "dev Kanidm credentials — log in with either account"
    );
}

/// Effective [kanidm] settings in container mode: the mapped
/// container URL with `localhost` as host (the generated certificate's
/// SAN is the domain part of KANIDM_ORIGIN, i.e. localhost, so
/// hostname verification passes), the temp CA file, and REAL
/// certificate verification.
pub fn effective_settings(port: u16, ca_path: &str) -> KanidmSettings {
    KanidmSettings {
        url: format!("https://localhost:{port}"),
        ca_path: Some(ca_path.to_string()),
        verify_ca: true,
    }
}

/// Startup smoke test: authenticate as idm_admin through the same
/// production client path the app uses (`client_builder_from_settings`
/// → real TLS verification against the container CA), with bounded
/// retry. A successful auth proves TLS trust + credentials + server
/// readiness end-to-end (a broken chain would fail with a TLS error,
/// not an auth error).
pub(super) async fn smoke_auth(
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
         (full container logs are captured under logs/kanidm-dev/server/)"
    )
    .into())
}

/// Startup check that the dev container serves the mounted override
/// stylesheet: fetch /pkg/override.css through the production client
/// path (real TLS verification against the container CA) and require
/// the embedded marker in the body. Runs AFTER smoke_auth, which has
/// already proven full request readiness, so a single attempt
/// suffices — no retry loop. Hard error: a silently unstyled dev
/// login page must never go unnoticed.
pub(super) async fn smoke_css(
    effective: &KanidmSettings,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let builder = crate::auth::ops::client_builder_from_settings(effective)
        .map_err(|error| format!("failed to build override-css client: {error:?}"))?;
    let client = builder
        .build()
        .map_err(|error| format!("failed to build override-css client: {error:?}"))?;

    let response = client
        .client()
        .get(client.make_url(OVERRIDE_CSS_ENDPOINT))
        .send()
        .await
        .map_err(|error| {
            format!("failed to fetch {OVERRIDE_CSS_ENDPOINT} from the dev Kanidm: {error}")
        })?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read the {OVERRIDE_CSS_ENDPOINT} body: {error}"))?;

    if status.is_success() && body.contains(OVERRIDE_CSS_MARKER) {
        info!("dev Kanidm serves the override stylesheet ({OVERRIDE_CSS_PATH})");
        return Ok(());
    }
    Err(format!(
        "dev Kanidm {OVERRIDE_CSS_ENDPOINT} check failed: status {status}, body does not carry \
         the override marker (the container image may predate the /hpkg UI package layout or \
         the override mount failed; full container logs are captured under \
         logs/kanidm-dev/server/)"
    )
    .into())
}

/// Linear backoff for the bounded retries: 250ms, 500ms, ... capped
/// at 2s.
fn retry_delay(attempt: u32) -> Duration {
    let millis = (RETRY_BASE_DELAY_MS * u64::from(attempt + 1)).min(2000);
    Duration::from_millis(millis)
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn effective_settings_point_at_localhost_with_real_verification() {
        let settings = effective_settings(55001, "/tmp/ca.pem");
        assert_eq!(settings.url, "https://localhost:55001");
        assert_eq!(settings.ca_path.as_deref(), Some("/tmp/ca.pem"));
        assert!(settings.verify_ca);
    }
}
