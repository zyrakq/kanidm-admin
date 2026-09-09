// app/src/frontend.rs
//
// Frontend lifecycle coordinator. Dispatches between disk mode (dev hot
// reload via `bun watch` + ServeDir) and embedded mode (assets compiled
// into the binary via rust-embed). The one-shot `bun run build` is no
// longer done here - build.rs handles install + build at compile time.

use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdout};
use tracing::{info, warn};

use crate::frontend_assets::Assets;
use crate::settings::frontend::FrontendSettings;

/// Outcome of `start`: how the frontend is being served.
///
/// Keep the returned handle alive for the duration of the server - dropping
/// `Disk { watch_child: Some(_) }` kills the `bun watch` process
/// (`kill_on_drop(true)`).
pub enum FrontendHandle {
    /// Serve from `ui/dist/` on disk; `watch_child` is the background
    /// `bun watch` process when `settings.watch` is true.
    //
    // `watch_child` is held but never read: dropping the handle kills the
    // watcher (`kill_on_drop(true)`), so it must outlive `main`. The field
    // is intentionally read-only-for-lifetime.
    #[allow(dead_code)]
    Disk { watch_child: Option<Child> },
    /// Serve from assets embedded into the binary at compile time.
    Embedded,
}

/// Start the frontend in the mode configured by `settings.serve_from`.
///
/// - `disk`:     sanity-check `node_modules/`, optionally spawn `bun watch`.
/// - `embedded`: sanity-check `Assets::get("index.html")` is present.
///
/// `manifest_dir` is `CARGO_MANIFEST_DIR` (the `app/` directory); the UI
/// lives at `manifest_dir/ui`. No `bun run build` is run here - build.rs
/// did it at compile time.
pub fn start(
    settings: &FrontendSettings,
    manifest_dir: &Path,
) -> Result<FrontendHandle, Box<dyn std::error::Error + Send + Sync>> {
    let ui_dir = manifest_dir.join("ui");

    match settings.effective_serve_from() {
        "disk" => {
            // build.rs already ran `bun install`, so node_modules should
            // exist. Sanity-check anyway so the error is clear instead of a
            // `bun watch` failure with an opaque message.
            if !ui_dir.join("node_modules").exists() {
                return Err(format!(
                    "ui/node_modules is missing in disk mode.\n\
                     Re-run `cargo run` - build.rs will run `bun install` \
                     automatically.\n\
                     (looked in {})",
                    ui_dir.display()
                )
                .into());
            }

            if settings.watch {
                crate::preflight::check_dependency("bun", "https://bun.sh/docs/installation")?;
            }

            let watch_child = if settings.watch {
                spawn_watch(&ui_dir)
            } else {
                None
            };
            Ok(FrontendHandle::Disk { watch_child })
        }
        "embedded" => {
            if Assets::get("index.html").is_none() {
                return Err(
                    "embedded mode selected but `index.html` is not present in \
                     the compiled-in assets. The binary was built without \
                     `ui/dist/` populated. Rebuild with `cargo build` after \
                     ensuring `bun run build` succeeds in app/ui."
                        .into(),
                );
            }
            Ok(FrontendHandle::Embedded)
        }
        other => Err(format!(
            "unknown frontend.serve_from value: {other:?}. Expected \"disk\" or \"embedded\"."
        )
        .into()),
    }
}

// ---------------------------------------------------------------------------
// bun watch (unchanged from the previous version of this file)
// ---------------------------------------------------------------------------

/// Spawn `bun watch` as a background process in the given UI directory.
///
/// Stdout and stderr of the child process are piped and filtered: only lines
/// that are meaningful to the developer (build start, completion, errors,
/// warnings, failure indicators) are forwarded to stderr. Per-module
/// transformation lines are discarded.
///
/// The returned child process is kept alive as long as the `Option` is held.
/// It is killed automatically when dropped (`kill_on_drop(true)`).
///
/// Returns `None` if the process could not be launched (non-fatal, logged as warning).
fn spawn_watch(ui_dir: &Path) -> Option<tokio::process::Child> {
    let mut cmd = tokio::process::Command::new("bun");
    cmd.args(["watch"])
        .current_dir(ui_dir)
        .kill_on_drop(true)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            info!("Started bun watch (pid: {:?})", child.id());

            match child.stdout.take() {
                Some(stdout) => {
                    tokio::spawn(filter_and_print_stdout(stdout));
                }
                None => {
                    warn!("bun watch stdout pipe unavailable; output will not be filtered");
                }
            }

            match child.stderr.take() {
                Some(stderr) => {
                    tokio::spawn(filter_and_print_stderr(stderr));
                }
                None => {
                    warn!("bun watch stderr pipe unavailable; output will not be filtered");
                }
            }

            Some(child)
        }
        Err(e) => {
            warn!("Could not start bun watch: {e}");
            None
        }
    }
}

/// Returns `true` if the line should be shown to the developer.
///
/// Show rules (applied in order, first match wins):
/// - Contains "error"  (case-insensitive) — build errors
/// - Contains "warn"   (case-insensitive) — build warnings
/// - Contains "build started"             — rebuild triggered
/// - Contains "built in"                  — rebuild completed with timing
/// - Contains "watching for file changes" — watcher ready confirmation
/// - Starts with "✗" or "×"              — failure indicators
///
/// Everything else (per-module transform lines, empty lines, etc.) is hidden.
fn should_show(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("error")
        || lower.contains("warn")
        || line.contains("build started")
        || line.contains("built in")
        || line.contains("watching for file changes")
        || line.starts_with('✗')
        || line.starts_with('×')
}

/// Read lines from the child's stdout pipe and forward matching lines to stderr.
async fn filter_and_print_stdout(stdout: ChildStdout) {
    let mut lines = BufReader::new(stdout).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if should_show(&line) {
                    eprintln!("{line}");
                }
            }
            Ok(None) => break, // pipe closed — child exited
            Err(_) => break,   // read error — exit silently
        }
    }
}

/// Read lines from the child's stderr pipe and forward matching lines to stderr.
async fn filter_and_print_stderr(stderr: ChildStderr) {
    let mut lines = BufReader::new(stderr).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if should_show(&line) {
                    eprintln!("{line}");
                }
            }
            Ok(None) => break,
            Err(_) => break,
        }
    }
}
