use axum::{routing::get, Router};
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

fn parse_bool_env(key: &str, default: bool) -> bool {
    std::env::var(key)
        .map(|v| matches!(v.to_lowercase().as_str(), "true" | "1" | "yes"))
        .unwrap_or(default)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Load .env file if present, errors are silently ignored
    let _ = dotenvy::dotenv();

    info!("Starting server...");

    let ui_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui");

    let should_build = parse_bool_env("FRONTEND_BUILD", cfg!(not(debug_assertions)));
    let should_watch = parse_bool_env("FRONTEND_WATCH", cfg!(debug_assertions));

    if should_build {
        info!("Building frontend...");
        let status = std::process::Command::new("bun")
            .args(["run", "build"])
            .current_dir(&ui_dir)
            .status();
        match status {
            Ok(s) if s.success() => info!("Frontend build completed successfully"),
            Ok(s) => return Err(format!("Frontend build failed with exit status: {s}").into()),
            Err(e) => return Err(format!("Failed to run `bun run build`: {e}").into()),
        }
    }

    let _bun_watch = if should_watch {
        match tokio::process::Command::new("bun")
            .args(["watch"])
            .current_dir(&ui_dir)
            .kill_on_drop(true)
            .spawn()
        {
            Ok(child) => {
                info!("Started bun watch (pid: {:?})", child.id());
                Some(child)
            }
            Err(e) => {
                tracing::warn!("Could not start bun watch: {e}");
                None
            }
        }
    } else {
        None
    };

    let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("traildepot");

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
