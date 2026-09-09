// app/src/auth/mod.rs
//
// Session proxy over the Kanidm auth API. The backend owns the Kanidm
// JWS session token inside an HttpOnly cookie; the browser only ever
// sees derived JSON state (user, sessionExpiresAt, writeUntil). The
// raw token never appears in a response body or a log line.

pub mod cookie;
pub mod error;
pub mod ops;
pub mod token;

use std::sync::Arc;

use crate::settings::kanidm::KanidmSettings;

/// Shared axum state: auth operations behind the session proxy.
#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<dyn ops::KanidmAuthOps>,
}

impl AppState {
    pub fn new(auth: Arc<dyn ops::KanidmAuthOps>) -> Self {
        Self { auth }
    }
}

/// Build the application state from the `[kanidm]` settings; called once
/// in main so a broken Kanidm configuration fails fast at startup.
pub fn app_state_from_settings(
    settings: &KanidmSettings,
) -> Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    let builder = ops::client_builder_from_settings(settings)
        .map_err(|error| format!("Kanidm client configuration error: {error:?}"))?;
    Ok(AppState::new(Arc::new(ops::KanidmClientAuthOps::new(builder))))
}
