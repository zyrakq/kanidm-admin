mod auth;
mod branding;
mod frontend;
mod frontend_assets;
mod logging;
mod mailcrab_proxy;
mod preflight;
mod proxy;
mod routes;
mod settings;
mod status;
mod testcontainer;

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
    let (kanidm_settings, _testcontainers_handle) = testcontainer::start(&settings).await?;
    let state = auth::app_state_from_settings(&kanidm_settings)?;
    let status_probe = status::probe_from_settings(&kanidm_settings)?;
    let branding_store = branding::BrandingStore::new(
        settings.branding.effective_dir(&manifest_dir),
        settings.branding.max_size_bytes,
    );

    let listener = TcpListener::bind(&settings.server.address).await?;
    let router = routes::mount_fallback(
        routes::build(
            state,
            status_probe,
            _testcontainers_handle.mailcrab_upstream(),
            branding::router(std::sync::Arc::new(branding_store)),
        ),
        &settings.frontend,
        &manifest_dir,
    );

    info!("Server running at http://{}", settings.server.address);
    axum::serve(listener, router).await?;

    Ok(())
}
