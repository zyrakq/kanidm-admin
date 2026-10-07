mod auth;
mod branding;
mod frontend;
mod frontend_assets;
mod kanidm_container;
mod logging;
mod preflight;
mod proxy;
mod routes;
mod settings;
mod status;

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
    let (kanidm_settings, _kanidm_handle) = kanidm_container::start(&settings).await?;
    kanidm_settings.log_effective_config();
    let state = auth::app_state_from_settings(&kanidm_settings)?;
    let status_probe = status::probe_from_settings(&kanidm_settings)?;

    let listener = TcpListener::bind(&settings.server.address).await?;
    let router = routes::mount_fallback(
        routes::build(state, status_probe),
        &settings.frontend,
        &manifest_dir,
    );

    info!("Server running at http://{}", settings.server.address);
    axum::serve(listener, router).await?;

    Ok(())
}
