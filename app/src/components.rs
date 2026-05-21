// app/src/components.rs
//
// TrailBase component lifecycle: ensure the auth_ui component wasm is present,
// installing it automatically on first run so users don't have to.

use std::path::Path;
use tracing::info;

/// Ensure the TrailBase `auth_ui` component is installed.
///
/// Checks for the compiled wasm file at
/// `{manifest_dir}/traildepot/wasm/auth_ui_component.wasm`.
/// If the file already exists the function returns immediately — no network
/// access, no subprocess.  If it is missing, `trail` is verified to be in
/// PATH and then `trail components add trailbase/auth_ui` is run synchronously.
pub fn ensure_auth_ui(
    manifest_dir: &Path,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let wasm_path = manifest_dir
        .join("traildepot")
        .join("wasm")
        .join("auth_ui_component.wasm");

    if wasm_path.exists() {
        return Ok(());
    }

    crate::preflight::check_dependency(
        "trail",
        "https://trailbase.io/getting-started/install/",
    )?;

    info!("Installing TrailBase auth_ui component...");

    let status = std::process::Command::new("trail")
        .args(["components", "add", "trailbase/auth_ui"])
        .current_dir(manifest_dir)
        .status()?;

    if !status.success() {
        return Err(
            format!("Failed to install auth_ui component: exit status {status}").into(),
        );
    }

    info!("TrailBase auth_ui component installed");
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn returns_ok_immediately_when_wasm_exists() {
        let dir = tempfile::tempdir().expect("tempdir");
        let wasm_dir = dir.path().join("traildepot").join("wasm");
        fs::create_dir_all(&wasm_dir).expect("create wasm dir");
        fs::write(wasm_dir.join("auth_ui_component.wasm"), b"fake")
            .expect("write fake wasm");

        // Must return Ok without invoking trail (which may not be installed in CI)
        assert!(ensure_auth_ui(dir.path()).is_ok());
    }
}
