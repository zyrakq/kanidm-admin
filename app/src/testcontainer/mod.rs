// app/src/testcontainer/mod.rs
//
// Single responsibility: orchestrate the dev backend containers —
// kanidm, kanidm-mail-sender and mailpit — on a shared Docker
// network, and hand main.rs the effective kanidm settings plus a
// process-lifetime handle. When [testcontainer.kanidm].enabled is
// false, `start` is a pass-through of the [kanidm] settings, so
// the production startup path is unchanged.
//
// The container flow: ensure the shared network, (in-container
// mode) attach the app's own container, generate the dev mail
// PKI, run the kanidm cert-generate + server containers, recover
// the built-in credentials, then mailpit and the mail sender,
// and prove the chain with smoke checks (kanidm auth, the
// sender's test mail and its kanidm poll) before serving. The
// generated kanidm CA is written to a temp file (the closest to
// in-memory the public kanidm_client API allows:
// add_root_certificate_filepath parses the file at call time),
// the effective settings point at the container kanidm with REAL
// verification. Container output is captured into per-run files
// under logs/testcontainers/ (log_file.rs); the console carries
// only app-level key events.

mod kanidm;
mod log_file;
mod mail_certs;
mod mailpit;
mod mail_sender;
mod network;
mod styles;

// Re-exports consumed only by the Docker-gated proxy integration
// tests (cfg(test)); the gated test in this module uses the module
// paths directly.
#[cfg(test)]
pub(crate) use kanidm::{
    parse_recover_account_password, ADMIN_USERNAME, IDM_ADMIN_USERNAME,
};
pub(crate) use mailpit::MailpitContainer;
pub(crate) use network::Mode;

use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use testcontainers::{ContainerAsync, GenericImage};
use tracing::{info, warn};

use crate::settings::kanidm::KanidmSettings;
use crate::settings::loader::Settings;
use crate::settings::testcontainer::TestcontainerSettings;

/// Startup timeout for every dev container (image pull + first
/// readiness signal), mirroring the old subsystem.
pub(crate) const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);

/// Label every dev container carries: `kanidm-admin.dev=true`.
/// Used to find and prune orphaned containers after a SIGKILL.
pub(crate) const CONTAINER_LABEL_KEY: &str = "kanidm-admin.dev";
pub(crate) const CONTAINER_LABEL_VALUE: &str = "true";

/// Bounded scan for the sender kanidm-poll smoke: ~10 attempts
/// × 1 s — two default poll intervals (the sender checks every
/// 5 s when its config sets no schedule), so at least one poll
/// tick is guaranteed to land in the window.
const SENDER_POLL_ATTEMPTS: u32 = 10;
const SENDER_POLL_DELAY: Duration = Duration::from_secs(1);

/// Success marker for the sender kanidm-poll smoke: the sender's
/// scheduler logs this on stderr on every poll tick.
const SENDER_POLL_TICK: &str = "checking for mail";

/// Failure marker for the sender kanidm-poll smoke: the sender
/// logs this when the kanidm poll (bearer-token auth + SCIM
/// query) fails.
const SENDER_POLL_FAILURE: &str = "Unable to check for queued mail";

/// Temp CA file name prefix; the full name is
/// `kanidm-admin-dev-ca-{pid}-{nanos}.pem` in the system temp dir.
/// Holds a PUBLIC CA certificate (not a key), mode 0600, deleted
/// when the handle drops.
const TEMP_CA_PREFIX: &str = "kanidm-admin-dev-ca-";
const TEMP_CA_SUFFIX: &str = ".pem";

/// Built-in account credentials recovered from the dev kanidm
/// container (fresh random passwords per recover-account call).
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub(crate) struct DevCredentials {
    pub(crate) admin_password: String,
    pub(crate) idm_admin_password: String,
}

/// Running dev kanidm server plus everything the mail chain
/// needs from it: the CA chain backing the temp file, the
/// recovered credentials and the effective settings the app
/// connects with.
#[allow(dead_code)]
pub(crate) struct DevKanidm {
    pub(crate) container: ContainerAsync<GenericImage>,
    pub(crate) ca_pem: Vec<u8>,
    pub(crate) credentials: DevCredentials,
    pub(crate) effective: KanidmSettings,
}

/// Process-lifetime handle for the dev containers, mirroring
/// `frontend::FrontendHandle`. Dropping the handle removes the
/// containers and the temp CA file; the testcontainers `watchdog`
/// feature additionally removes the containers on
/// SIGTERM/SIGINT/SIGQUIT (Ctrl-C). SIGKILL can orphan both — the
/// containers carry the label `kanidm-admin.dev=true` so they can
/// be found and pruned manually; an orphaned temp CA file is
/// harmless (public cert) and prunable with
/// `rm /tmp/kanidm-admin-dev-ca-*.pem`.
#[allow(dead_code)]
pub(crate) enum TestcontainersHandle {
    /// Container mode disabled — nothing to keep alive.
    Disabled,
    /// Running dev containers + the temp CA file backing the
    /// effective settings; all removed when dropped.
    Containers {
        kanidm: DevKanidm,
        sender: Option<ContainerAsync<GenericImage>>,
        mailpit: Option<MailpitContainer>,
        temp_ca: PathBuf,
        mode: Mode,
        ui_port: u16,
    },
}

impl TestcontainersHandle {
    /// Base URL the app (and tests) reach the mailpit UI/API at:
    /// loopback + the fixed UI port in host mode, the container
    /// DNS name in in-container mode. None when mailpit is not
    /// running (or containers are disabled).
    pub(crate) fn mailpit_upstream(&self) -> Option<String> {
        let TestcontainersHandle::Containers {
            mailpit,
            mode,
            ui_port,
            ..
        } = self
        else {
            return None;
        };
        if mailpit.is_none() {
            return None;
        }
        Some(match mode {
            Mode::Host => format!("http://127.0.0.1:{ui_port}"),
            Mode::InContainer => "http://mailpit:8025".to_string(),
        })
    }
}

impl Drop for TestcontainersHandle {
    fn drop(&mut self) {
        if let TestcontainersHandle::Containers { temp_ca, .. } = self {
            info!("dev testcontainers stopping");
            delete_temp_ca(temp_ca);
        }
    }
}

/// Resolve the Kanidm settings the app connects with.
///
/// Container mode: run the dev containers, recover the built-in
/// accounts, and return effective settings pointing at the
/// containers (the [kanidm] section is ignored with a warning).
/// Disabled mode: pass [kanidm] through unchanged.
pub(crate) async fn start(
    settings: &Settings,
) -> Result<(KanidmSettings, TestcontainersHandle), Box<dyn std::error::Error + Send + Sync>> {
    if !settings.testcontainer.kanidm.enabled {
        return Ok((settings.kanidm.clone(), TestcontainersHandle::Disabled));
    }
    warn!("[kanidm] url/verify_ca/ca_path are ignored while the testcontainer is enabled");
    start_containers(&settings.testcontainer).await
}

/// Run the full dev container chain and derive the effective
/// settings. Separate from `start` so the Docker-gated tests can
/// run it without a full Settings layer.
///
/// Order matters: kanidm first (the sender provisions against
/// it), mailpit second (the sender smoke asserts its API already
/// holds a message), the sender last.
pub(crate) async fn start_containers(
    tc: &TestcontainerSettings,
) -> Result<(KanidmSettings, TestcontainersHandle), Box<dyn std::error::Error + Send + Sync>>
{
    tc.validate()?;

    let mode = network::resolve_mode(&tc.mode)?;
    network::ensure_network(&tc.network).await?;
    if mode == Mode::InContainer {
        network::self_attach(&tc.network).await?;
    }

    // The mail PKI is only needed when the mail chain runs.
    let pki = if tc.mailpit.enabled {
        Some(mail_certs::generate(mode)?)
    } else {
        None
    };

    let server = kanidm::run(&tc.kanidm.image, mode, &tc.network).await?;

    // The temp CA file must outlive this function: main.rs builds
    // the auth state from the returned settings AFTER start()
    // returns, and the client builder parses the CA from the file
    // at that point. The handle deletes it on drop (app
    // shutdown).
    let temp_ca = write_temp_ca(&server.ca_pem)?;
    let effective =
        kanidm::effective_settings(mode, server.host_port, &temp_ca.to_string_lossy());

    kanidm::log_dev_credentials(&effective.url, &server.credentials);
    kanidm::smoke_auth(&effective, &server.credentials.idm_admin_password).await?;

    let dev = DevKanidm {
        container: server.container,
        ca_pem: server.ca_pem,
        credentials: server.credentials,
        effective: effective.clone(),
    };

    let mailpit = if tc.mailpit.enabled {
        let pki = pki
            .as_ref()
            .expect("mailpit enabled implies the mail PKI was generated");
        Some(
            mailpit::run(&tc.mailpit.image, mode, &tc.network, tc.mailpit.ui_port, pki)
                .await?,
        )
    } else {
        None
    };

    let sender = if tc.kanidm_mail_sender.enabled {
        let pki = pki
            .as_ref()
            .expect("sender enabled implies mailpit enabled implies the mail PKI");
        let upstream = mailpit::upstream_base(mode, tc.mailpit.ui_port);
        let container =
            mail_sender::run(&tc.kanidm_mail_sender, mode, &tc.network, &dev, pki, &upstream)
                .await?;
        assert_sender_polling(&container).await?;
        Some(container)
    } else {
        None
    };

    info!(url = %effective.url, "dev testcontainers ready");
    Ok((
        effective,
        TestcontainersHandle::Containers {
            kanidm: dev,
            sender,
            mailpit,
            temp_ca,
            mode,
            ui_port: tc.mailpit.ui_port,
        },
    ))
}

/// Sender kanidm-poll smoke: the `-t` test-mail smoke bypasses
/// kanidm entirely (direct SMTP), so the sender's kanidm leg —
/// bearer-token auth plus the SCIM ready-message poll — is
/// otherwise unproven. Bounded scan of the sender's stderr
/// requiring a poll tick with no poll failure; the container
/// start has already waited for the readiness marker.
async fn assert_sender_polling(
    sender: &ContainerAsync<GenericImage>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    for attempt in 0..SENDER_POLL_ATTEMPTS {
        let stderr = sender
            .stderr_to_vec()
            .await
            .map_err(|error| format!("failed to read the mail-sender stderr: {error}"))
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())?;
        if poll_smoke_satisfied(&stderr) {
            info!("mail-sender kanidm poll smoke succeeded");
            return Ok(());
        }
        warn!(
            "mail-sender poll smoke attempt {} not satisfied yet",
            attempt + 1
        );
        tokio::time::sleep(SENDER_POLL_DELAY).await;
    }
    Err(format!(
        "the mail-sender did not complete a kanidm mail poll within {} s: \
         expected '{SENDER_POLL_TICK}' without '{SENDER_POLL_FAILURE}' in its stderr \
         (container logs are captured under logs/testcontainers/kanidm-mail-sender/)",
        SENDER_POLL_ATTEMPTS
    )
    .into())
}

/// Pure core of the sender poll smoke: satisfied iff the stderr
/// shows a poll tick and no poll failure.
fn poll_smoke_satisfied(stderr: &str) -> bool {
    stderr.contains(SENDER_POLL_TICK) && !stderr.contains(SENDER_POLL_FAILURE)
}

/// Write the container-generated CA to a temp file for
/// `add_root_certificate_filepath`. The kanidm_client public API
/// has no in-memory CA setter, so this brief file is the bridge:
/// it holds a PUBLIC certificate (not a key), is created with
/// O_EXCL semantics (`create_new`) and mode 0600, and is deleted
/// when the handle drops. The builder parses the file at call
/// time, so it only needs to exist while the auth state is
/// constructed in main.
fn write_temp_ca(ca_pem: &[u8]) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let path = temp_ca_path();
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)
        .and_then(|mut file| std::io::Write::write_all(&mut file, ca_pem))
        .map_err(|error| format!("failed to write the dev CA to {}: {error}", path.display()))?;
    Ok(path)
}

/// Unique temp CA path: `kanidm-admin-dev-ca-{pid}-{nanos}.pem`
/// in the system temp dir. Uniqueness avoids collisions between
/// concurrent dev runs; `create_new` fails loudly if the path
/// somehow exists.
fn temp_ca_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!(
        "{TEMP_CA_PREFIX}{}-{nanos}{TEMP_CA_SUFFIX}",
        std::process::id()
    ))
}

/// Delete the temp CA file. Best-effort: failure is logged as a
/// warning, never fatal (the file holds a public cert).
fn delete_temp_ca(path: &Path) {
    if let Err(error) = std::fs::remove_file(path) {
        warn!(
            "failed to remove the temp CA file {}: {error}",
            path.display()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temp_ca_file_is_private_and_round_trips() {
        let ca_pem = b"-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n";
        let path = write_temp_ca(ca_pem).expect("temp CA file should be written");

        // Unique name with the expected prefix.
        assert!(path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(TEMP_CA_PREFIX)));

        // Content round-trips.
        assert_eq!(std::fs::read(&path).expect("file readable"), ca_pem);

        // Mode 0600 (owner read/write only) — add_root_certificate_
        // filepath's permission check warns on anything looser.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path)
                .expect("metadata readable")
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }

        delete_temp_ca(&path);
        assert!(!path.exists(), "temp CA file removed");
    }

    #[test]
    fn delete_temp_ca_does_not_panic_on_missing_file() {
        let path = std::env::temp_dir().join("kanidm-admin-dev-ca-does-not-exist.pem");
        delete_temp_ca(&path); // must not panic
    }

    #[test]
    fn poll_smoke_requires_tick_without_failure() {
        assert!(
            poll_smoke_satisfied("checking for mail ..."),
            "a poll tick satisfies the smoke"
        );
        assert!(
            poll_smoke_satisfied("next mail check on ...\nchecking for mail ...\n"),
            "a tick among other lines satisfies the smoke"
        );
        assert!(
            !poll_smoke_satisfied("next mail check on ..."),
            "the readiness line alone does not satisfy the smoke"
        );
        assert!(
            !poll_smoke_satisfied("checking for mail ...\nUnable to check for queued mail\n"),
            "a failed poll never satisfies the smoke"
        );
        assert!(
            !poll_smoke_satisfied(""),
            "empty stderr does not satisfy the smoke"
        );
    }

    /// Full flow against a real Docker daemon: all three
    /// containers start, the sender's test mail is visible in the
    /// mailpit API, and the temp CA is cleaned up on drop.
    /// Ignored by default (needs Docker); run explicitly with
    /// `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "requires a running Docker daemon"]
    async fn three_containers_start_and_deliver_test_mail() {
        let mut settings = TestcontainerSettings::default();
        settings.kanidm.enabled = true;
        settings.kanidm_mail_sender.enabled = true;
        settings.mailpit.enabled = true;

        let (effective, handle) = start_containers(&settings)
            .await
            .expect("the container chain should start and provision");

        // Real verification is the point: the effective settings
        // carry the temp CA and verify_ca = true.
        assert!(
            effective.verify_ca,
            "effective settings must verify the CA"
        );

        // The sender's startup smoke mail is already delivered.
        let upstream = handle
            .mailpit_upstream()
            .expect("mailpit upstream with mailpit enabled");
        let response = reqwest::Client::new()
            .get(format!("{upstream}/_/mailpit/api/v1/messages"))
            .send()
            .await
            .expect("mailpit API reachable");
        let messages: serde_json::Value = response.json().await.expect("mailpit API JSON");
        let total = messages
            .get("total")
            .and_then(|total| total.as_u64())
            .unwrap_or(0);
        assert!(total >= 1, "the sender test mail must be listed");

        // Dropping the handle deletes the temp CA file (the
        // containers themselves are removed by ContainerAsync's
        // own Drop + watchdog).
        let temp_ca = match &handle {
            TestcontainersHandle::Containers { temp_ca, .. } => temp_ca.clone(),
            TestcontainersHandle::Disabled => panic!("container mode must return Containers"),
        };
        drop(handle);
        assert!(!temp_ca.exists(), "temp CA file deleted on drop");
    }
}
