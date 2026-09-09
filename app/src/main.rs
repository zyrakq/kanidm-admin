mod auth;
mod frontend;
mod frontend_assets;
mod logging;
mod preflight;
mod routes;
mod settings;

use settings::loader::Settings;
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();

    logging::init();

    let settings = Settings::load()?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let _frontend_handle = frontend::start(&settings.frontend, &manifest_dir)?;
    let state = auth::app_state_from_settings(&settings.kanidm)?;

    let listener = TcpListener::bind(&settings.server.address).await?;
    let router = routes::mount_fallback(routes::build(state), &settings.frontend, &manifest_dir);

    info!("Server running at http://{}", settings.server.address);
    axum::serve(listener, router).await?;

    Ok(())
}
