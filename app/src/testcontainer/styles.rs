// app/src/kanidm_container/styles.rs
//
// Compile-time embedded override stylesheet for the dev Kanidm login
// page. The stylesheet lives as a real file next to this module so it
// can be borrowed and reused (e.g. for a production Kanidm
// deployment); include_str! folds it into the binary so container
// seeding needs no runtime file I/O.

/// The embedded override stylesheet. Its first line is the marker
/// comment the provisioning check asserts on.
pub(crate) const OVERRIDE_CSS: &str = include_str!("override.css");

/// Marker comment at the top of `override.css`. Provisioning fetches
/// /pkg/override.css from the running container and hard-errors
/// unless the served body contains this exact text — a silently
/// unstyled dev login page must never go unnoticed.
pub(crate) const OVERRIDE_CSS_MARKER: &str =
    "/* kanidm-admin dev override — matches the admin console design language */";

/// Container-internal target path. The Docker image ships a
/// placeholder /hpkg/override.css (the UI package directory is
/// /hpkg in the container_generic build profile); copying over it
/// replaces the placeholder, and the server links override.css LAST
/// in base.html, so equal-specificity rules win without !important.
pub(crate) const OVERRIDE_CSS_PATH: &str = "/hpkg/override.css";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_css_contains_marker_and_key_selectors() {
        assert!(!OVERRIDE_CSS.trim().is_empty(), "embedded CSS must be non-empty");
        assert!(
            OVERRIDE_CSS.starts_with(OVERRIDE_CSS_MARKER),
            "CSS must start with the provisioning marker comment"
        );
        for selector in [".form-signin", ".btn-primary", "[data-bs-theme=\"dark\"]"] {
            assert!(
                OVERRIDE_CSS.contains(selector),
                "embedded CSS is missing selector {selector}"
            );
        }
    }
}
