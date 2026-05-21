const DEFAULT_FILTER: &str =
    "info,trailbase_refinery=warn,tracing::span=warn,swc_ecma_codegen=off";

pub fn init() {
    std::env::set_var(
        "RUST_LOG",
        std::env::var("RUST_LOG").unwrap_or_else(|_| DEFAULT_FILTER.to_string()),
    );
    pretty_env_logger::init();
}
