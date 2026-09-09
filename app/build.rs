// app/build.rs
//
// Compile-time frontend build. Runs before the crate compiles so that
// rust-embed (frontend_assets.rs) has a fresh ui/dist to embed in release
// builds. Ported from vendor/velora/app/build.rs minus the WASM parts.

use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    let manifest_dir = manifest_dir();
    let ui_dir = manifest_dir.join("ui");

    // Register the skip flag as a rerun trigger BEFORE the early return so
    // flipping it always re-runs this script and is honored deterministically.
    println!("cargo::rerun-if-env-changed=APP_SKIP_FRONTEND_BUILD");

    // Always ensure ui/dist exists so the rust-embed derive in
    // frontend_assets.rs compiles - even when the build is skipped
    // (APP_SKIP_FRONTEND_BUILD=1) or bun is unavailable. An empty dist
    // yields an empty asset set; the embedded-mode sanity check in
    // frontend::start() catches a missing index.html at runtime with a
    // clear message.
    ensure_ui_dist_exists(&ui_dir);

    if skip_frontend_build() {
        return;
    }

    build_frontend(&manifest_dir, &ui_dir);
}

fn manifest_dir() -> PathBuf {
    PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"))
}

fn ensure_ui_dist_exists(ui_dir: &Path) {
    std::fs::create_dir_all(ui_dir.join("dist"))
        .unwrap_or_else(|e| panic!("failed to create ui/dist: {e}"));
}

fn skip_frontend_build() -> bool {
    let skip = std::env::var("APP_SKIP_FRONTEND_BUILD").as_deref() == Ok("1");
    if skip {
        println!("cargo::warning=APP_SKIP_FRONTEND_BUILD=1: skipping frontend build");
    }
    skip
}

/// Install frontend dependencies if stale, then run `bun run build`.
/// Panics with an actionable message on any non-zero exit (fails the cargo
/// build) - no silent failures.
fn build_frontend(manifest_dir: &Path, ui_dir: &Path) {
    // Re-run when dependency manifests change. Do NOT watch ui/src -
    // `bun watch` handles src-to-dist rebuilds in dev, and cargo re-running
    // a full frontend build on every source edit would be wasteful.
    // Emission is guarded on existence because Docker's Rust stage has no
    // ui sources: a watched-but-missing path would defeat caching there.
    emit_rerun_if_changed(manifest_dir, "ui/package.json");
    emit_rerun_if_changed(manifest_dir, "ui/bun.lock");

    if needs_install(ui_dir) {
        println!("cargo::warning=Installing frontend dependencies...");
        let status = Command::new("bun")
            .arg("install")
            .current_dir(ui_dir)
            .status()
            .unwrap_or_else(|_| panic!(
                "failed to run `bun install` in {}; install bun from https://bun.sh/docs/installation",
                ui_dir.display()
            ));
        if !status.success() {
            panic!("bun install failed in {}", ui_dir.display());
        }
    }

    println!("cargo::warning=Building frontend...");
    let status = Command::new("bun")
        .args(["run", "build"])
        .current_dir(ui_dir)
        .status()
        .unwrap_or_else(|_| panic!("failed to run `bun run build` in {}", ui_dir.display()));
    if !status.success() {
        panic!("bun run build failed in {}", ui_dir.display());
    }
}

/// Emit a rerun-if-changed hint only when the watched file exists.
/// `rel` is package-root-relative: cargo resolves rerun-if-changed paths
/// against the package root (the build script's cwd), not against ui_dir.
fn emit_rerun_if_changed(manifest_dir: &Path, rel: &str) {
    if manifest_dir.join(rel).exists() {
        println!("cargo::rerun-if-changed={rel}");
    }
}

/// `true` if `bun install` should run: node_modules missing, or older than
/// package.json / bun.lock (deps changed since last install).
fn needs_install(ui_dir: &Path) -> bool {
    let node_modules = ui_dir.join("node_modules");
    if !node_modules.exists() {
        return true;
    }
    let nm_mtime = node_modules.metadata().and_then(|m| m.modified()).ok();
    let pkg_mtime = ui_dir
        .join("package.json")
        .metadata()
        .and_then(|m| m.modified())
        .ok();
    let lock_mtime = ui_dir
        .join("bun.lock")
        .metadata()
        .and_then(|m| m.modified())
        .ok();
    match nm_mtime {
        Some(nm) => pkg_mtime.is_some_and(|p| p > nm) || lock_mtime.is_some_and(|l| l > nm),
        None => true,
    }
}
