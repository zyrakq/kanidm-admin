// app/src/routes.rs
//
// Custom API routes for the application.
// Mount this router alongside TrailBase routes in main.rs.

use axum::{routing::get, Router};

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

async fn health_check() -> &'static str {
    "OK"
}

async fn hello_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({"message": "Hello!"}))
}
