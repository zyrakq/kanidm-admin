mod components;
mod frontend;
mod preflight;
mod routes;
mod settings;

use colored::Colorize;
use settings::Settings;
use std::io::Write;
use std::path::PathBuf;
use tracing::info;
use tracing::log::Level;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();

    env_logger::Builder::from_env(
        env_logger::Env::new().default_filter_or(
            "info,trailbase_refinery=warn,tracing::span=warn,swc_ecma_codegen=off",
        ),
    )
    .format(|buf, record| {
        let time = chrono::Local::now().format("%H:%M:%S").to_string();
        let level = match record.level() {
            Level::Error => "ERROR".red().bold(),
            Level::Warn => "WARN ".yellow(),
            Level::Info => "INFO ".green(),
            Level::Debug => "DEBUG".blue(),
            Level::Trace => "TRACE".dimmed(),
        };
        let target = record.target().cyan().dimmed();
        let arrow = "›".dimmed();
        writeln!(buf, "{} {} {} {} {}", time.dimmed(), level, target, arrow, record.args())
    })
    .init();

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
