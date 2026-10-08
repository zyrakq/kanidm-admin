// app/src/testcontainer/proxy/mod.rs
//
// Dev-only reverse proxy for the mailpit UI under /_/mailpit,
// mounted by routes::build only when the mailpit testcontainer
// is enabled. Forwards HTTP verbatim (http.rs) and bridges the
// mailpit WebSocket (ws.rs) so the dev mail UI needs no extra
// port, no CORS setup, and works identically in host and
// in-container modes. Mirrors the proxy module layout.

mod http;
mod ws;

use axum::extract::Extension;
use axum::response::Redirect;
use axum::routing::{any, get};
use axum::Router;

use crate::auth::AppState;

/// Shared upstream state: the mailpit base URL and one reqwest
/// client with redirects disabled so mailpit's own 3xx responses
/// pass through verbatim (their Location headers keep the
/// /_/mailpit prefix).
#[derive(Clone)]
pub(crate) struct Upstream {
    pub(crate) url: String,
    pub(crate) client: reqwest::Client,
}

/// The mailpit dev routes. Returns Router<AppState> — axum 0.8
/// has no From<Router<()>> for Router<S>, same convention as
/// proxy/handler.rs.
///
/// Route table:
/// - `GET  /_/mailpit` → 301 `/_/mailpit/` (the exact route
///   wins over the wildcard)
/// - `GET  /_/mailpit/api/events` → WebSocket bridge (mailpit's
///   live-events endpoint; the server-side bridge sends no
///   Origin header, so mailpit's CSWSH origin check passes)
/// - `ANY  /_/mailpit/{*path}` → verbatim HTTP forward
pub fn routes(upstream_base: String) -> Router<AppState> {
    let upstream = Upstream {
        client: reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("a reqwest client with redirects disabled always builds"),
        url: upstream_base,
    };

    Router::new()
        .route("/_/mailpit", get(redirect_to_index))
        .route("/_/mailpit/api/events", get(ws::bridge))
        .route("/_/mailpit/{*path}", any(http::forward))
        .layer(Extension(upstream))
}

/// `GET /_/mailpit` → 301 `/_/mailpit/` (mailpit serves its UI
/// assets under the prefix with a trailing slash).
async fn redirect_to_index() -> Redirect {
    Redirect::permanent("/_/mailpit/")
}
