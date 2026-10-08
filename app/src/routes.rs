// app/src/routes.rs
//
// Custom API routes and static file serving for the application.
// Disk mode uses tower-http ServeDir; embedded mode serves rust-embed
// assets with cache headers. mount_fallback picks between them so
// main.rs stays free of conditionals.

use std::path::Path;
use std::sync::Arc;

use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::Response,
    routing::get,
    Router,
};
use tower_http::services::{ServeDir, ServeFile};

use crate::auth::handlers::routes as auth_routes;
use crate::auth::AppState;
use crate::frontend_assets::Assets;
use crate::settings::frontend::FrontendSettings;
use crate::status::{self, KanidmStatusProbe};

/// Build the custom API router.
///
/// Routes:
///   GET  /api/health        — liveness probe
///   GET  /api/hello         — example JSON endpoint
///   GET  /api/status        — Kanidm server version & state for the footer
///   POST /api/auth/login    — Kanidm password login (sets session cookie)
///   GET  /api/auth/session  — local session state from the cookie
///   POST /api/auth/logout   — revoke session, clear cookie
///   POST /api/auth/reauth   — privilege step-up (refreshes cookie)
///   GET  /api/auth/profile  — signed-in user plus their Kanidm groups
///   ANY  /api/kanidm/{*path} — authenticated proxy to the Kanidm server
///   GET/PUT/DELETE /api/customization[/{slot}] — customization manifest/upload/remove
///   GET  /customization/{slot}   — serve an uploaded customization file
pub fn build(
    state: AppState,
    status_probe: Arc<dyn KanidmStatusProbe>,
    customization_routes: Router,
) -> Router {
    let router = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/hello", get(hello_handler))
        .route(
            "/api/status",
            get(status::status_handler).with_state(status_probe),
        )
        .merge(auth_routes())
        .merge(crate::proxy::bulk::routes())
        .merge(crate::proxy::handler::routes());

    router.with_state(state)
    // The customization router carries its own state (CustomizationState), so it
    // is a stateless `Router<()>`; merge it only after `with_state`
    // has turned the main router stateless too (axum 0.8 semantics).
    .merge(customization_routes)
}

/// Attach the SPA fallback service chosen by `frontend.serve_from`.
///
/// - `"disk"`:     `ServeDir` over the resolved public dir with an
///                 `index.html` fallback file (dev hot reload).
/// - `"embedded"`: embedded asset handler with SPA fallback and cache
///                 headers (prod single binary).
///
/// Any other value has already been rejected by `frontend::start`, which
/// runs before this in `main`; the disk arm is the safe default.
pub fn mount_fallback(
    router: Router,
    settings: &FrontendSettings,
    manifest_dir: &Path,
) -> Router {
    match settings.effective_serve_from() {
        "embedded" => router.fallback_service(get(embedded_static_handler)),
        _ => router.fallback_service(static_files(settings, manifest_dir)),
    }
}

/// Build the static file service that serves the SPA with an index.html fallback.
///
/// HTML responses get `Cache-Control: no-cache` so a stale index.html
/// (pointing at old hashed bundles) can never be pinned by the browser's
/// heuristic cache across deploys; hashed assets keep normal caching.
pub fn static_files(settings: &FrontendSettings, manifest_dir: &Path) -> Router {
    let public_dir = settings.resolve_public_dir(manifest_dir);
    let svc = tower::ServiceBuilder::new()
        .layer(axum::middleware::from_fn(no_cache_html))
        .service(
            ServeDir::new(&public_dir)
                .fallback(ServeFile::new(public_dir.join("index.html"))),
        );
    Router::new().fallback_service(svc)
}

/// Add `Cache-Control: no-cache` to `text/html` responses.
async fn no_cache_html(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let mut res = next.run(req).await;
    let is_html = res
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("text/html"))
        .unwrap_or(false);
    if is_html {
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            header::HeaderValue::from_static("no-cache"),
        );
    }
    res
}

/// Serve a request from the compile-time embedded asset set.
///
/// - Exact asset lookup first (`Assets::get(path)`).
/// - Extension-less paths fall back to `index.html` (SPA client-side
///   routes); paths with an extension 404 so stale hashed names fail
///   loudly instead of returning the app shell.
/// - `index.html` is served with `no-cache`; hashed assets get a year of
///   immutable caching.
pub async fn embedded_static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(file) = Assets::get(path) {
        return embedded_response(path, file);
    }

    if Path::new(path).extension().is_none() {
        if let Some(file) = Assets::get("index.html") {
            return embedded_response("index.html", file);
        }
    }

    not_found().await
}

fn embedded_response(path: &str, file: rust_embed::EmbeddedFile) -> Response {
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let cache_control = if path == "index.html" {
        "no-cache"
    } else {
        "public, max-age=31536000, immutable"
    };

    Response::builder()
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::CACHE_CONTROL, cache_control)
        .body(Body::from(file.data.into_owned()))
        .unwrap()
}

async fn not_found() -> Response {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("404"))
        .unwrap()
}

async fn health_check() -> &'static str {
    "OK"
}

async fn hello_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({"message": "Hello!"}))
}
