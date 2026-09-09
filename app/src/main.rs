mod frontend;
mod logging;
mod preflight;
mod routes;
mod settings;

use settings::Settings;
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();

    logging::init();

    let settings = Settings::load()?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let _bun_watch = frontend::start(&settings.frontend, &manifest_dir.join("ui"))?;

    let listener = TcpListener::bind(&settings.server.address).await?;
    let router =
        routes::build().fallback_service(routes::static_files(&settings.frontend, &manifest_dir));

    info!("Server running at http://{}", settings.server.address);
    axum::serve(listener, router).await?;

    Ok(())
}