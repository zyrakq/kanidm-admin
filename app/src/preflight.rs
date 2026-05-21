// app/src/preflight.rs
//
// Upfront dependency checks: verify that a CLI tool is installed and in PATH
// before the server attempts to use it, so failures surface with clear messages.

use std::io::ErrorKind;

/// Check that `command` is available in PATH by running `<command> --version`.
///
/// Returns `Ok(())` when the command is found (regardless of its output).
/// Returns a user-facing `Err` when the command is missing, containing the
/// install URL so the user knows exactly what to do.
pub fn check_dependency(
    command: &str,
    install_url: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match std::process::Command::new(command)
        .arg("--version")
        .output()
    {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Err(format!(
            "`{command}` is not installed or not in PATH.\nInstall it at: {install_url}"
        )
        .into()),
        Err(e) => Err(e.into()),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_command_returns_ok() {
        // `echo` is present on every Unix system
        assert!(check_dependency("echo", "https://example.com").is_ok());
    }

    #[test]
    fn missing_command_returns_err_with_install_url() {
        let url = "https://example.com/install";
        let err = check_dependency("__nonexistent_command_xyz__", url)
            .expect_err("should fail for missing command");
        let msg = err.to_string();
        assert!(
            msg.contains(url),
            "error message should contain install URL, got: {msg}"
        );
        assert!(
            msg.contains("__nonexistent_command_xyz__"),
            "error message should contain command name, got: {msg}"
        );
    }
}
