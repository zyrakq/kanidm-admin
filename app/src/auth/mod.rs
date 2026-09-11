// app/src/auth/mod.rs
//
// Session proxy over the Kanidm auth API. The backend owns the Kanidm
// JWS session token inside an HttpOnly cookie; the browser only ever
// sees derived JSON state (user, sessionExpiresAt, writeUntil). The
// raw token never appears in a response body or a log line.

pub mod cookie;
pub mod error;
pub mod handlers;
pub mod known_groups;
pub mod ops;
pub mod profile;
pub mod token;

use std::sync::Arc;

use crate::avatars::FsAvatarStore;
use crate::proxy::forwarder::{Forwarder, ReqwestForwarder};
use crate::settings::kanidm::KanidmSettings;

/// Shared axum state: auth operations, the proxy forwarder and the local avatar store.
#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<dyn ops::KanidmAuthOps>,
    pub proxy: Arc<dyn Forwarder>,
    pub avatars: Arc<dyn crate::avatars::AvatarStore>,
}

impl AppState {
    pub fn new(
        auth: Arc<dyn ops::KanidmAuthOps>,
        proxy: Arc<dyn Forwarder>,
        avatars: Arc<dyn crate::avatars::AvatarStore>,
    ) -> Self {
        Self { auth, proxy, avatars }
    }
}

/// Build the application state from the `[kanidm]` settings; called once
/// in main so a broken Kanidm configuration fails fast at startup.
pub fn app_state_from_settings(
    settings: &KanidmSettings,
    avatars: FsAvatarStore,
) -> Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    let builder = ops::client_builder_from_settings(settings)
        .map_err(|error| format!("Kanidm client configuration error: {error:?}"))?;
    let forwarder = ReqwestForwarder::from_settings(settings)
        .map_err(|error| format!("Kanidm proxy configuration error: {error}"))?;
    Ok(AppState::new(
        Arc::new(ops::KanidmClientAuthOps::new(builder)),
        Arc::new(forwarder),
        Arc::new(avatars),
    ))
}
