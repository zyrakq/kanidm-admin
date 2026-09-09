use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct FrontendSettings {
    /// Where to serve frontend assets from.
    ///
    /// - `"disk"`: serve from `ui/dist/` on disk via `tower_http::ServeDir`
    ///   (dev hot reload; `bun watch` repopulates `dist/` live).
    /// - `"embedded"`: serve from assets inlined into the binary at compile
    ///   time via `rust-embed` (prod; no `ui/`, `bun`, or `node` at runtime).
    ///
    /// Empty string or absent -> `"disk"` (backwards compatible with configs
    /// that don't set it). See `effective_serve_from`.
    #[serde(default = "default_serve_from")]
    pub serve_from: String,

    /// Spawn `bun watch` in the background (disk mode only).
    pub watch: bool,

    /// Empty string means "derive from CARGO_MANIFEST_DIR at runtime in main.rs".
    pub public_dir: String,
}

fn default_serve_from() -> String {
    "disk".to_string()
}

impl FrontendSettings {
    /// Resolve the directory from which static frontend assets are served
    /// (disk mode).
    ///
    /// Uses `public_dir` when set; falls back to `<manifest_dir>/ui/dist`.
    pub fn resolve_public_dir(&self, manifest_dir: &std::path::Path) -> std::path::PathBuf {
        if self.public_dir.is_empty() {
            manifest_dir.join("ui/dist")
        } else {
            std::path::PathBuf::from(&self.public_dir)
        }
    }

    /// Normalized serve mode: treats an empty `serve_from` as `"disk"`.
    ///
    /// All consumers (`frontend::start`, `routes::mount_fallback`) call
    /// this instead of reading `serve_from` directly, so a legacy config
    /// with `serve_from = ""` behaves as disk rather than erroring.
    pub fn effective_serve_from(&self) -> &str {
        if self.serve_from.is_empty() {
            "disk"
        } else {
            &self.serve_from
        }
    }
}
