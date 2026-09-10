// app/src/proxy/allowlist.rs
//
// Path/method allowlist for the reverse proxy. Anything not explicitly
// allowed is rejected with 403 access_denied BEFORE any upstream call.

use axum::http::Method;

/// True when the method + path may be forwarded to Kanidm.
///
/// - any method under /v1/ or /scim/v1/ (the API surface)
/// - GET/HEAD under /ui/images/ (oauth2 + domain images)
pub fn is_allowed(method: &Method, path: &str) -> bool {
    if path.starts_with("/v1/") || path.starts_with("/scim/v1/") {
        return true;
    }
    if path.starts_with("/ui/images/")
        && (method == Method::GET || method == Method::HEAD)
    {
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v1_prefix_allowed_for_all_methods() {
        for method in [Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE] {
            assert!(is_allowed(&method, "/v1/person"), "{method}");
            assert!(is_allowed(&method, "/v1/oauth2/rs/_image"), "{method}");
        }
    }

    #[test]
    fn scim_prefix_allowed() {
        assert!(is_allowed(&Method::GET, "/scim/v1/Application"));
        assert!(is_allowed(&Method::POST, "/scim/v1/Application"));
    }

    #[test]
    fn images_allowed_for_get_and_head_only() {
        assert!(is_allowed(&Method::GET, "/ui/images/oauth2/rs"));
        assert!(is_allowed(&Method::HEAD, "/ui/images/domain"));
        assert!(!is_allowed(&Method::POST, "/ui/images/domain"));
        assert!(!is_allowed(&Method::DELETE, "/ui/images/oauth2/rs"));
    }

    #[test]
    fn everything_else_denied() {
        assert!(!is_allowed(&Method::GET, "/v1")); // bare /v1 (no slash)
        assert!(!is_allowed(&Method::GET, "/ui/login"));
        assert!(!is_allowed(&Method::POST, "/raw/create"));
        assert!(!is_allowed(&Method::GET, "/admin"));
        assert!(!is_allowed(&Method::GET, "/"));
    }
}
