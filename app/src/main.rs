use axum::{routing::get, Router};
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting server...");

    let data_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("traildepot");

    // Determine public directory from env var or use default
    let public_dir = std::env::var("PUBLIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist"));

    info!("Serving static files from: {:?}", public_dir);

    let trailbase::Server {
        main_router,
        admin_router,
        tls,
        ..
    } = trailbase::Server::init(trailbase::ServerOptions {
        data_dir: trailbase::DataDir(data_dir),
        address: "0.0.0.0:4000".to_string(),
        ..Default::default()
    })
    .await?;

    // Custom API routes
    let custom_routes = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/hello", get(hello_handler));

    // Static file serving with SPA fallback
    let index_path = public_dir.join("index.html");
    let static_service = ServeDir::new(&public_dir).fallback(ServeFile::new(&index_path));

    // Merge routers: custom API -> trailbase API -> static files
    let router = Router::new()
        .merge(custom_routes)
        .merge(main_router.1)
        .fallback_service(static_service);

    info!("Server running at http://localhost:4000");

    trailbase::api::serve((main_router.0, router), admin_router, tls).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn hello_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({"message": "Hello!"}))
}
