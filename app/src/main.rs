mod settings;

use settings::Settings;
use axum::{routing::get, Router};
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Load .env file if present (for secrets - not configuration)
    let _ = dotenvy::dotenv();

    // Initialise tracing before the first log line
    tracing_subscriber::fmt::init();

    info!("Starting server...");

    // Load layered TOML configuration
    let settings = Settings::load()?;

    // Resolve public_dir: empty string -> default relative to CARGO_MANIFEST_DIR
    let public_dir = if settings.frontend.public_dir.is_empty() {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist")
    } else {
        PathBuf::from(&settings.frontend.public_dir)
    };

    let ui_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui");

    if settings.frontend.build {
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

    let _bun_watch = if settings.frontend.watch {
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

    info!("Serving static files from: {:?}", public_dir);

    let trailbase::Server {
        main_router,
        admin_router,
        tls,
        ..
    } = trailbase::Server::init(trailbase::ServerOptions {
        data_dir: trailbase::DataDir(data_dir),
        address: settings.server.address.clone(),
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

    info!("Server running at http://{}", settings.server.address);

    trailbase::api::serve((main_router.0, router), admin_router, tls).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn hello_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({"message": "Hello!"}))
}
