// app/src/auth/ops.rs
//
// Thin trait over the auth operations of kanidm_client so the handlers
// are unit-testable without a live Kanidm server. The production impl
// derives a fresh client per call: KanidmClient stores the bearer token
// in interior mutable state, so one instance must never be shared
// between requests.

use async_trait::async_trait;
use kanidm_client::{ClientError, KanidmClient, KanidmClientBuilder};

use crate::settings::kanidm::KanidmSettings;

#[async_trait]
pub trait KanidmAuthOps: Send + Sync {
    /// Password login; returns the issued JWS session token.
    async fn auth_password(&self, username: &str, password: &str)
        -> Result<String, ClientError>;

    /// Step-up re-authentication with the current token; returns the
    /// refreshed token (same session id, live write window).
    async fn reauth_password(&self, token: &str, password: &str)
        -> Result<String, ClientError>;

    /// Server-side session revocation (GET /v1/logout).
    async fn logout(&self, token: &str) -> Result<(), ClientError>;
}

/// Production implementation over kanidm_client.
pub struct KanidmClientAuthOps {
    builder: KanidmClientBuilder,
}

impl KanidmClientAuthOps {
    pub fn new(builder: KanidmClientBuilder) -> Self {
        Self { builder }
    }

    async fn client_with_token(&self, token: &str) -> Result<KanidmClient, ClientError> {
        let client = self.builder.clone().build()?;
        client.set_token(token.to_string()).await;
        Ok(client)
    }
}

#[async_trait]
impl KanidmAuthOps for KanidmClientAuthOps {
    async fn auth_password(
        &self,
        username: &str,
        password: &str,
    ) -> Result<String, ClientError> {
        let client = self.builder.clone().build()?;
        client.auth_simple_password(username, password).await?;
        client
            .get_token()
            .await
            .ok_or(ClientError::EmptyResponse)
    }

    async fn reauth_password(
        &self,
        token: &str,
        password: &str,
    ) -> Result<String, ClientError> {
        let client = self.client_with_token(token).await?;
        client.reauth_simple_password(password).await?;
        client
            .get_token()
            .await
            .ok_or(ClientError::EmptyResponse)
    }

    async fn logout(&self, token: &str) -> Result<(), ClientError> {
        let client = self.client_with_token(token).await?;
        client.logout().await
    }
}

/// Build the startup client builder from the `[kanidm]` settings.
pub fn client_builder_from_settings(
    settings: &KanidmSettings,
) -> Result<KanidmClientBuilder, ClientError> {
    let builder = KanidmClientBuilder::new().address(settings.url.clone());

    let builder = match settings.ca_path.as_deref() {
        Some(path) if !path.is_empty() => builder.add_root_certificate_filepath(path)?,
        _ => builder,
    };

    // danger_accept_invalid_certs(accept) sets verify_ca = !accept,
    // so this honors verify_ca = false from settings.
    Ok(builder.danger_accept_invalid_certs(!settings.verify_ca))
}

/// Mock used by the handler tests (5.1). Configurable outcomes with
/// fixture tokens produced by token::test_support.
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::sync::Mutex;

    #[derive(Debug, Clone, Copy, Default, PartialEq)]
    pub(crate) enum MockOutcome {
        #[default]
        Success,
        Denied,
        Unreachable,
    }

    #[derive(Default)]
    pub(crate) struct MockAuthOps {
        pub login_token: Mutex<Option<String>>,
        pub reauth_token: Mutex<Option<String>>,
        pub login_outcome: Mutex<MockOutcome>,
        pub reauth_outcome: Mutex<MockOutcome>,
    }

    #[async_trait]
    impl KanidmAuthOps for MockAuthOps {
        async fn auth_password(
            &self,
            _username: &str,
            _password: &str,
        ) -> Result<String, ClientError> {
            match *self.login_outcome.lock().expect("login outcome lock") {
                MockOutcome::Success => self
                    .login_token
                    .lock()
                    .expect("login token lock")
                    .clone()
                    .ok_or(ClientError::EmptyResponse),
                MockOutcome::Denied => Err(ClientError::AuthenticationFailed),
                MockOutcome::Unreachable => Err(ClientError::SystemError),
            }
        }

        async fn reauth_password(
            &self,
            _token: &str,
            _password: &str,
        ) -> Result<String, ClientError> {
            match *self.reauth_outcome.lock().expect("reauth outcome lock") {
                MockOutcome::Success => self
                    .reauth_token
                    .lock()
                    .expect("reauth token lock")
                    .clone()
                    .ok_or(ClientError::EmptyResponse),
                MockOutcome::Denied => Err(ClientError::AuthenticationFailed),
                MockOutcome::Unreachable => Err(ClientError::SystemError),
            }
        }

        async fn logout(&self, _token: &str) -> Result<(), ClientError> {
            Ok(())
        }
    }
}
