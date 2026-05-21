// app/src/frontend.rs
//
// Frontend lifecycle helpers: one-shot build and background watch process.
// Extracted from main.rs so the same logic can be reused in other projects.

use std::path::Path;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::ChildStderr;
use tokio::process::ChildStdout;
use std::process::Stdio;
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
    if settings.build || settings.watch {
        crate::preflight::check_dependency("bun", "https://bun.sh/docs/installation")?;
    }
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
