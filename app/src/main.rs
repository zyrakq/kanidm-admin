mod frontend;
mod routes;
mod settings;

use settings::Settings;
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt::init();
    info!("Starting server...");

    let settings = Settings::load()?;

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let ui_dir = manifest_dir.join("ui");
    let public_dir = settings.frontend.resolve_public_dir(&manifest_dir);
    let _bun_watch = frontend::start(&settings.frontend, &ui_dir)?;

    let data_dir = manifest_dir.join("traildepot");

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

    let static_service = ServeDir::new(&public_dir)
        .fallback(ServeFile::new(public_dir.join("index.html")));

    let router = axum::Router::new()
        .merge(routes::build())
        .merge(main_router.1)
        .fallback_service(static_service);

    info!("Server running at http://{}", settings.server.address);
    trailbase::api::serve((main_router.0, router), admin_router, tls).await?;

    Ok(())
}
