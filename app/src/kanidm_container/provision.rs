// app/src/kanidm_container/provision.rs
//
// Server-API side of dev container provisioning: connect to the
// freshly started container over its mapped HTTPS endpoint,
// authenticate as the built-in idm_admin, relax the default MFA
// credential policy, create the dev person and set its password.
// Also derives the effective [kanidm] settings the rest of
// the app connects with.
//
// Note: kanidm_client::ClientError does not implement std::error::Error
// (only Debug), so every call is mapped into a string error — same
// style as auth/mod.rs.

use std::time::Duration;

use kanidm_client::KanidmClientBuilder;
use tracing::{info, warn};

use crate::settings::kanidm::KanidmSettings;

/// Dev person credentials. Constants, not config: dev-only, logged at
/// startup so a contributor can log into the UI immediately. The
/// password must clear Kanidm's quality bar (15-char minimum, no
/// account-name substrings, zxcvbn-grade entropy), so obvious values
/// like "dev-password" are rejected by the server.
pub const DEV_PERSON_USERNAME: &str = "dev";
pub const DEV_PERSON_DISPLAY_NAME: &str = "Dev User";
pub const DEV_PERSON_PASSWORD: &str = "local-Playground-123";

/// Account recovered inside the container that drives provisioning.
/// idm_admin (not admin) holds the person-management privileges
/// provisioning needs. Duplicated in image.rs so both files compile
/// independently.
const IDM_ADMIN_USERNAME: &str = "idm_admin";

/// Built-in group carrying the default account policy applied to all
/// persons.
const ALL_PERSONS_GROUP: &str = "idm_all_persons";

/// Lowest credential strength on the policy ladder, allowing
/// password-only credentials.
const CREDENTIAL_TYPE_ANY: &str = "any";

/// Bounded retry for the first client call: the container readiness
/// log line means "listener bound", which can race full request
/// readiness by a moment.
const RETRY_ATTEMPTS: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 250;

/// Effective [kanidm] settings in container mode: the mapped container
/// URL, no CA file, no certificate verification (self-signed dev
/// certificates are regenerated on every container start).
pub fn effective_settings(host: &str, port: u16) -> KanidmSettings {
    KanidmSettings {
        url: format!("https://{host}:{port}"),
        ca_path: None,
        verify_ca: false,
    }
}

/// Provision the dev person: authenticate as idm_admin (retried),
/// relax the default MFA credential policy, create the dev person,
/// set its password.
///
/// idm_admin is a service account: its password session is
/// read-write directly, so no reauth step-up is needed (reauth is a
/// person-only flow and fails for service accounts). The idm_admin
/// password comes from `recover-account` inside the container (see
/// image::recover_idm_admin_password).
pub(super) async fn provision_dev_person(
    url: &str,
    idm_admin_password: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = KanidmClientBuilder::new()
        .address(url.to_string())
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|error| format!("failed to build provisioning client: {error:?}"))?;

    // First client call, retried with backoff.
    let mut last_error = String::from("no attempt made");
    let mut authenticated = false;
    for attempt in 0..RETRY_ATTEMPTS {
        match client
            .auth_simple_password(IDM_ADMIN_USERNAME, idm_admin_password)
            .await
        {
            Ok(()) => {
                authenticated = true;
                break;
            }
            Err(error) => {
                last_error = format!("idm_admin auth failed: {error:?}");
                warn!(
                    "idm_admin auth attempt {} failed: {}",
                    attempt + 1,
                    last_error
                );
                tokio::time::sleep(retry_delay(attempt)).await;
            }
        }
    }
    if !authenticated {
        return Err(format!(
            "idm_admin auth did not succeed after {RETRY_ATTEMPTS} attempts: {last_error}"
        )
        .into());
    }

    // The server is proven ready by the successful auth above, so the
    // remaining calls run once, without retry.
    //
    // Kanidm 1.11 ships a default account policy on idm_all_persons
    // with credential_type_minimum = mfa, which blocks committing a
    // password-only credential (the commit fails with unresolved
    // MfaRequired warnings). Dev containers want frictionless
    // password logins, so relax the minimum to "any" first.
    client
        .group_account_policy_credential_type_minimum_set(
            ALL_PERSONS_GROUP,
            CREDENTIAL_TYPE_ANY,
        )
        .await
        .map_err(|error| format!("relaxing credential type policy failed: {error:?}"))?;
    client
        .idm_person_account_create(DEV_PERSON_USERNAME, DEV_PERSON_DISPLAY_NAME)
        .await
        .map_err(|error| format!("creating dev person failed: {error:?}"))?;
    client
        .idm_person_account_primary_credential_set_password(
            DEV_PERSON_USERNAME,
            DEV_PERSON_PASSWORD,
        )
        .await
        .map_err(|error| format!("setting dev person password failed: {error:?}"))?;

    info!(
        username = DEV_PERSON_USERNAME,
        password = DEV_PERSON_PASSWORD,
        "provisioned dev person"
    );
    Ok(())
}

/// Linear backoff for the bounded retry: 250ms, 500ms, ... capped at
/// 2s. Duplicated in image.rs so both files compile independently.
fn retry_delay(attempt: u32) -> Duration {
    let millis = (RETRY_BASE_DELAY_MS * u64::from(attempt + 1)).min(2000);
    Duration::from_millis(millis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effective_settings_point_at_container_and_skip_tls_checks() {
        let settings = effective_settings("127.0.0.1", 55001);
        assert_eq!(settings.url, "https://127.0.0.1:55001");
        assert_eq!(settings.ca_path, None);
        assert!(!settings.verify_ca);
    }
}
