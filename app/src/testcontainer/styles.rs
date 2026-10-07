// app/src/testcontainer/styles.rs
//
// Compile-time embedded override stylesheet for the dev Kanidm
// login page. The stylesheet lives as a real file next to this
// module so it can be borrowed and reused (e.g. for a production
// Kanidm deployment); include_str! folds it into the binary so
// container seeding needs no runtime file I/O.
//
// Injection model (testcontainer flow): the stylesheet is copied
// into the kanidm server container at SEED TIME —
// `with_copy_to(OVERRIDE_CSS_PATH, ...)` in
// testcontainer/kanidm.rs `server_request` — and verified
// post-start with a `grep -F` exec against the marker. There is
// no HTTP fetch: the server container publishes nothing in
// in-container mode, so an in-container probe would be
// unreachable.

/// The embedded override stylesheet. Its first line is the marker
/// comment the post-start grep verifies.
pub(crate) const OVERRIDE_CSS: &str = include_str!("override.css");

/// Marker comment at the top of `override.css`. The post-start
/// `grep -F` exec hard-errors unless the seeded file contains
/// this exact text — a silently unstyled dev login page must
/// never go unnoticed.
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
