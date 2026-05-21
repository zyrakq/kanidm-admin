mod components;
mod frontend;
mod logging;
mod preflight;
mod routes;
mod settings;

use settings::Settings;
use std::path::PathBuf;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();

    logging::init();

    tokio_rustls::rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let settings = Settings::load()?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    components::ensure_auth_ui(&manifest_dir)?;

    let _bun_watch = frontend::start(&settings.frontend, &manifest_dir.join("ui"))?;

    let trailbase::Server {
        main_router,
        admin_router,
        tls,
        ..
    } = trailbase::Server::init(trailbase::ServerOptions {
        data_dir: trailbase::DataDir(manifest_dir.join("traildepot")),
        address: settings.server.address.clone(),
        ..Default::default()
    })
    .await?;

    let router = axum::Router::new()
        .merge(routes::build())
        .merge(main_router.1)
        .fallback_service(routes::static_files(&settings.frontend, &manifest_dir));

    info!("Server running at http://{}", settings.server.address);
    trailbase::api::serve((main_router.0, router), admin_router, tls).await?;

    Ok(())
}
