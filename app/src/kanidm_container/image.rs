// app/src/kanidm_container/image.rs
//
// Container side of the dev Kanidm: build the dev image from the
// dev/kanidm/ context, start it on a dynamic host port, wait for the
// readiness log line, mirror container logs into tracing, and run
// commands inside the running container (idm_admin password recovery).

use std::path::{Path, PathBuf};
use std::time::Duration;

use testcontainers::core::logs::LogFrame;
use testcontainers::core::{
    BuildImageOptions, CmdWaitFor, ExecCommand, IntoContainerPort, WaitFor,
};
use testcontainers::runners::{AsyncBuilder, AsyncRunner};
use testcontainers::{ContainerAsync, GenericBuildableImage, GenericImage, ImageExt};
use tracing::warn;

/// Name and tag of the locally built dev image (never pushed).
const IMAGE_NAME: &str = "kanidm-admin-dev-kanidm";
const IMAGE_TAG: &str = "latest";

/// Dockerfile build arg carrying the base image tag, so bumping the
/// Kanidm version needs no Dockerfile edit.
const BUILD_ARG_BASE_IMAGE: &str = "BASE_IMAGE";

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

/// Upper bound for build + start + readiness. The first build pulls
/// both base images, so it needs headroom.
const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);

/// Account recovered inside the container to drive provisioning.
/// idm_admin (not admin) holds the person-management privileges
/// provisioning needs. Duplicated in provision.rs so both files
/// compile independently.
const IDM_ADMIN_USERNAME: &str = "idm_admin";

/// Bounded retry for the recover-account exec: the command talks to
/// the server's admin socket, which can lag the readiness line by a
/// moment.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// A running, ready dev Kanidm container with its mapped address.
pub struct StartedContainer {
    pub container: ContainerAsync<GenericImage>,
    /// Docker host address to connect to (e.g. `127.0.0.1`).
    pub host: String,
    /// Host-side port mapped to the container's 8443.
    pub port: u16,
}

/// Resolve the dev/kanidm build context (`<repo>/dev/kanidm`) from the
/// app manifest dir (`app/`).
pub fn context_dir(manifest_dir: &Path) -> PathBuf {
    manifest_dir.join("..").join("dev").join("kanidm")
}

/// Build the dev image and start a container from it.
///
/// The most common failure here is no running Docker daemon; the
/// build error is wrapped with an actionable hint.
pub async fn build_and_run(
    base_image: &str,
    manifest_dir: &Path,
) -> Result<StartedContainer, Box<dyn std::error::Error + Send + Sync>> {
    let context = context_dir(manifest_dir);

    let image = GenericBuildableImage::new(IMAGE_NAME, IMAGE_TAG)
        .with_dockerfile(context.join("Dockerfile"))
        .with_file(context.join("entrypoint.sh"), "./entrypoint.sh")
        .with_file(context.join("server.toml"), "./server.toml")
        .build_image_with(
            BuildImageOptions::new().with_build_arg(BUILD_ARG_BASE_IMAGE, base_image),
        )
        .await
        .map_err(|error| {
            format!(
                "failed to build the dev Kanidm image from dev/kanidm/ \
                 (is Docker installed and running?): {error}"
            )
        })?;

    let container = image
        // GenericImage methods first (they return Self)...
        .with_exposed_port(KANIDM_HTTPS_PORT.tcp())
        .with_wait_for(WaitFor::message_on_stdout(READINESS_MARKER))
        // ...then ImageExt methods (they return ContainerRequest).
        .with_label(CONTAINER_LABEL_KEY, CONTAINER_LABEL_VALUE)
        .with_log_consumer(|frame: &LogFrame| {
            let text = String::from_utf8_lossy(frame.bytes());
            match frame {
                LogFrame::StdOut(_) => tracing::info!(target: "kanidm", "{text}"),
                LogFrame::StdErr(_) => tracing::warn!(target: "kanidm", "{text}"),
            }
        })
        .with_startup_timeout(STARTUP_TIMEOUT)
        .start()
        .await?;

    let host = container.get_host().await?.to_string();
    let port = container.get_host_port_ipv4(KANIDM_HTTPS_PORT.tcp()).await?;

    Ok(StartedContainer {
        container,
        host,
        port,
    })
}

/// Run a command inside the running container (expecting exit code 0)
/// and return its stdout bytes.
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

/// Recover the idm_admin password by exec'ing `kanidmd scripting
/// recover-account idm_admin` inside the running container, with bounded
/// retry. The command prints JSON status lines on stdout; the password
/// is the `output` field of the ok line.
pub(super) async fn recover_idm_admin_password(
    container: &ContainerAsync<GenericImage>,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let command = ["/sbin/kanidmd", "scripting", "recover-account", IDM_ADMIN_USERNAME];

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

/// Extract the idm_admin password from `recover-account` stdout: scan the
/// lines for a `{"status":"ok","output":...}` JSON object (kanidmd
/// also logs to stdout, so other lines are skipped).
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

/// Linear backoff for the bounded retry: 250ms, 500ms, ... capped at
/// 2s. Duplicated in provision.rs so both files compile independently.
fn retry_delay(attempt: u32) -> Duration {
    let millis = (RETRY_BASE_DELAY_MS * u64::from(attempt + 1)).min(2000);
    Duration::from_millis(millis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn context_dir_points_at_repo_dev_kanidm() {
        let manifest = Path::new("/repo/app");
        assert_eq!(
            context_dir(manifest),
            PathBuf::from("/repo/app/../dev/kanidm"),
            "context dir is derived from the app manifest dir"
        );
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
}
