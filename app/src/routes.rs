// app/src/routes.rs
//
// Custom API routes and static file service for the application.

use std::path::Path;

use axum::{routing::get, Router};
use tower_http::services::{ServeDir, ServeFile};

use crate::settings::FrontendSettings;

/// Build the custom API router.
///
/// Routes:
///   GET /api/health  — liveness probe
///   GET /api/hello   — example JSON endpoint
pub fn build() -> Router {
    Router::new()
        .route("/api/health", get(health_check))
        .route("/api/hello", get(hello_handler))
}

/// Build the static file service that serves the SPA with an index.html fallback.
pub fn static_files(settings: &FrontendSettings, manifest_dir: &Path) -> ServeDir<ServeFile> {
    let public_dir = settings.resolve_public_dir(manifest_dir);
    ServeDir::new(&public_dir).fallback(ServeFile::new(public_dir.join("index.html")))
}

async fn health_check() -> &'static str {
    "OK"
}

async fn hello_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({"message": "Hello!"}))
}
