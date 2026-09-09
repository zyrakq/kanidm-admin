// app/src/auth/cookie.rs
//
// Construction and parsing of the kadmin_session cookie. Handled
// manually (no cookie crate): there is exactly one cookie, and a pure
// string builder is trivially unit-testable. The Kanidm JWS token uses
// only base64url characters plus '.', all cookie-value safe, so no
// quoting is required.

pub const SESSION_COOKIE_NAME: &str = "kadmin_session";

/// Build the Set-Cookie header value for the session token.
///
/// `max_age_secs`: remaining session seconds (cookie garbage-collects in
/// sync with the Kanidm session). `None` omits Max-Age entirely — the
/// cookie then lives for the browser session (token without expiry).
pub fn build_set_cookie(token: &str, max_age_secs: Option<i64>) -> String {
    let mut cookie = format!(
        "{SESSION_COOKIE_NAME}={token}; HttpOnly; Secure; SameSite=Strict; Path=/api"
    );
    if let Some(secs) = max_age_secs {
        cookie.push_str("; Max-Age=");
        cookie.push_str(&secs.to_string());
    }
    cookie
}

/// Build the Set-Cookie header value that clears the session cookie.
pub fn build_clear_cookie() -> String {
    format!(
        "{SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0"
    )
}

/// Extract the session token from a Cookie header value.
/// Returns None when the cookie is absent or empty.
pub fn extract_session_token(cookie_header: &str) -> Option<&str> {
    cookie_header
        .split(';')
        .map(str::trim)
        .find_map(|pair| pair.strip_prefix(&format!("{SESSION_COOKIE_NAME}=")))
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_cookie_contains_all_attributes() {
        let cookie = build_set_cookie("abc.def", Some(3600));
        assert!(
            cookie.starts_with("kadmin_session=abc.def;"),
            "cookie: {cookie}"
        );
        for attribute in [
            "HttpOnly",
            "Secure",
            "SameSite=Strict",
            "Path=/api",
            "Max-Age=3600",
        ] {
            assert!(cookie.contains(attribute), "missing {attribute} in {cookie}");
        }
    }

    #[test]
    fn set_cookie_without_max_age_omits_attribute() {
        let cookie = build_set_cookie("tok", None);
        assert!(!cookie.contains("Max-Age"), "cookie: {cookie}");
    }

    #[test]
    fn clear_cookie_zeroes_max_age() {
        let cookie = build_clear_cookie();
        assert!(cookie.starts_with("kadmin_session=;"), "cookie: {cookie}");
        assert!(cookie.contains("Max-Age=0"));
        assert!(cookie.contains("Path=/api"));
        assert!(cookie.contains("HttpOnly"));
    }

    #[test]
    fn extract_token_from_multi_cookie_header() {
        let header = "theme=dark; kadmin_session=abc.def; other=x";
        assert_eq!(extract_session_token(header), Some("abc.def"));
    }

    #[test]
    fn extract_token_sole_cookie() {
        assert_eq!(extract_session_token("kadmin_session=tok"), Some("tok"));
    }

    #[test]
    fn extract_token_missing_returns_none() {
        assert_eq!(extract_session_token("theme=dark"), None);
    }

    #[test]
    fn extract_token_empty_value_returns_none() {
        assert_eq!(extract_session_token("kadmin_session="), None);
    }

    #[test]
    fn extract_token_empty_header_returns_none() {
        assert_eq!(extract_session_token(""), None);
    }
}
