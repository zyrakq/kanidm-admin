mod auth;
#[cfg(feature = "customization")]
mod customization;
mod frontend;
mod frontend_assets;
mod logging;
mod preflight;
mod proxy;
mod routes;
mod settings;
mod status;
#[cfg(feature = "testcontainer")]
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

    #[cfg(feature = "testcontainer")]
    let (kanidm_settings, _testcontainers_handle) = {
        // Container mode turns on only when the [testcontainer]
        // enabled master switch is set (see testcontainer::start);
        // otherwise the configured [kanidm] settings pass through
        // unchanged.
        testcontainer::start(&settings).await?
    };
    // Without the feature the configured [kanidm] settings always
    // pass through unchanged.
    #[cfg(not(feature = "testcontainer"))]
    let kanidm_settings = settings.kanidm.clone();

    let state = auth::app_state_from_settings(&kanidm_settings)?;
    let status_probe = status::probe_from_settings(&kanidm_settings)?;

    #[cfg(feature = "customization")]
    let customization_state = std::sync::Arc::new(customization::CustomizationStore::new(
        settings.customization.effective_dir(&manifest_dir),
        settings.customization.max_size_bytes,
        settings.customization.theme.light.clone(),
        settings.customization.theme.dark.clone(),
    ));

    let status_state = status::StatusAppState {
        probe: status_probe,
        // The status API contract keeps the field in every feature
        // combination; without the subsystem it is simply false.
        #[cfg(feature = "customization")]
        customization_page: settings.customization.page.enabled,
        #[cfg(not(feature = "customization"))]
        customization_page: false,
    };

    let listener = TcpListener::bind(&settings.server.address).await?;

    #[cfg(feature = "customization")]
    let router = {
        // Asset serving is unconditional: the site header logo, login
        // page and theme overrides request /customization/{slot} on
        // every page.
        let mut router = routes::build(
            state,
            status_state,
            customization::serving_router(customization_state.clone()),
        );
        // Mutating management endpoints mount only when the standalone
        // page is enabled; disabled means a 404 by absence for them.
        // The read-only manifest stays mounted with asset serving so
        // logo/favicon overrides keep resolving with the page off.
        if settings.customization.page.enabled {
            router = router.merge(customization::management_router(customization_state));
        }
        router
    };
    #[cfg(not(feature = "customization"))]
    let router = routes::build(state, status_state);

    let router = routes::mount_fallback(router, &settings.frontend, &manifest_dir);

    info!("Server running at http://{}", settings.server.address);
    info!("Kanidm at {}", kanidm_settings.url);
    // Unlike the two URLs above, the mailpit URL is logged only
    // when the mailpit testcontainer actually runs.
    #[cfg(feature = "testcontainer")]
    if let Some(url) = _testcontainers_handle.mailpit_url() {
        info!("Mailpit at {url}");
    }
    axum::serve(listener, router).await?;

    Ok(())
}
