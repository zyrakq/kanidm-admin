mod auth;
mod customization;
mod frontend;
mod frontend_assets;
mod logging;
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
    // Container mode turns on only when the
    // KANIDM_ADMIN_TESTCONTAINERS env var is set (see
    // testcontainer::start); otherwise the configured [kanidm]
    // settings pass through unchanged.
    let (kanidm_settings, _testcontainers_handle) = testcontainer::start(&settings).await?;
    let state = auth::app_state_from_settings(&kanidm_settings)?;
    let status_probe = status::probe_from_settings(&kanidm_settings)?;
    let customization_store = customization::CustomizationStore::new(
        settings.customization.effective_dir(&manifest_dir),
        settings.customization.max_size_bytes,
    );

    let listener = TcpListener::bind(&settings.server.address).await?;
    let router = routes::mount_fallback(
        routes::build(
            state,
            status_probe,
            customization::router(std::sync::Arc::new(customization_store)),
        ),
        &settings.frontend,
        &manifest_dir,
    );

    info!("Server running at http://{}", settings.server.address);
    info!("Kanidm at {}", kanidm_settings.url);
    // Unlike the two URLs above, the mailpit URL is logged only
    // when the mailpit testcontainer actually runs.
    if let Some(url) = _testcontainers_handle.mailpit_url() {
        info!("Mailpit at {url}");
    }
    axum::serve(listener, router).await?;

    Ok(())
}
