// app/src/frontend.rs
//
// Frontend lifecycle helpers: one-shot build and background watch process.
// Extracted from main.rs so the same logic can be reused in other projects.

use std::path::Path;
use tracing::{info, warn};

use crate::settings::FrontendSettings;

/// Run the full frontend lifecycle based on settings.
///
/// - If `settings.build` is true: runs `bun run build` and returns an error on failure.
/// - If `settings.watch` is true: spawns `bun watch` in the background.
///
/// Returns the watch child process, if started. Keep the returned value alive
/// for the duration of the server — dropping it kills the watch process.
pub fn start(
    settings: &FrontendSettings,
    ui_dir: &Path,
) -> Result<Option<tokio::process::Child>, Box<dyn std::error::Error + Send + Sync>> {
    if settings.build {
        build(ui_dir)?;
    }
    Ok(if settings.watch {
        spawn_watch(ui_dir)
    } else {
        None
    })
}

/// Run `bun run build` once in the given UI directory.
///
/// Returns an error if the command could not be launched or exited
/// with a non-zero status.
fn build(ui_dir: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Building frontend...");
    let status = std::process::Command::new("bun")
        .args(["run", "build"])
        .current_dir(ui_dir)
        .status();
    match status {
        Ok(s) if s.success() => {
            info!("Frontend build completed successfully");
            Ok(())
        }
        Ok(s) => Err(format!("Frontend build failed with exit status: {s}").into()),
        Err(e) => Err(format!("Failed to run `bun run build`: {e}").into()),
    }
}

/// Spawn `bun watch` as a background process in the given UI directory.
///
/// The returned child process is kept alive as long as the `Option` is held.
/// It is killed automatically when dropped (`kill_on_drop(true)`).
///
/// Returns `None` if the process could not be launched (non-fatal, logged as warning).
fn spawn_watch(ui_dir: &Path) -> Option<tokio::process::Child> {
    match tokio::process::Command::new("bun")
        .args(["watch"])
        .current_dir(ui_dir)
        .kill_on_drop(true)
        .spawn()
    {
        Ok(child) => {
            info!("Started bun watch (pid: {:?})", child.id());
            Some(child)
        }
        Err(e) => {
            warn!("Could not start bun watch: {e}");
            None
        }
    }
}
