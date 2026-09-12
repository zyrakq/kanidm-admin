// app/src/mailcrab_proxy/mod.rs
//
// Dev-only reverse proxy for the mailcrab UI under /_/mailcrab,
// mounted by routes::build only when the mailcrab testcontainer
// is enabled. Forwards HTTP verbatim (http.rs) and bridges the
// mailcrab WebSocket (ws.rs) so the dev mail UI needs no extra
// port, no CORS setup, and works identically in host and
// in-container modes. Mirrors the proxy module layout.

mod http;
mod ws;

use axum::extract::Extension;
use axum::response::Redirect;
use axum::routing::{any, get};
use axum::Router;

use crate::auth::AppState;

/// Shared upstream state: the mailcrab base URL and one reqwest
/// client with redirects disabled so mailcrab's own 3xx responses
/// pass through verbatim (their Location headers keep the
/// /_/mailcrab prefix).
#[derive(Clone)]
pub(crate) struct Upstream {
    pub(crate) url: String,
    pub(crate) client: reqwest::Client,
}

/// The mailcrab dev routes. Returns Router<AppState> — axum 0.8
/// has no From<Router<()>> for Router<S>, same convention as
/// proxy/handler.rs.
///
/// Route table:
/// - `GET  /_/mailcrab` → 301 `/_/mailcrab/` (the exact route
///   wins over the wildcard)
/// - `GET  /_/mailcrab/ws` → WebSocket bridge
/// - `ANY  /_/mailcrab/{*path}` → verbatim HTTP forward
pub fn routes(upstream_base: String) -> Router<AppState> {
    let upstream = Upstream {
        client: reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("a reqwest client with redirects disabled always builds"),
        url: upstream_base,
    };

    Router::new()
        .route("/_/mailcrab", get(redirect_to_index))
        .route("/_/mailcrab/ws", get(ws::bridge))
        .route("/_/mailcrab/{*path}", any(http::forward))
        .layer(Extension(upstream))
}

/// `GET /_/mailcrab` → 301 `/_/mailcrab/` (mailcrab serves its UI
/// assets under the prefix with a trailing slash).
async fn redirect_to_index() -> Redirect {
    Redirect::permanent("/_/mailcrab/")
}
