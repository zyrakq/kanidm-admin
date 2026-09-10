// app/src/proxy/error_map.rs
//
// Normalization of upstream (Kanidm) error responses into our error
// envelope. The upstream HTTP status is preserved; the message is
// extracted from the body: JSON `error` string field first, then a
// humanized single-key OperationError shape, then raw text truncated.

use axum::http::StatusCode;

use crate::auth::error::{ApiError, ApiErrorCode};

/// An upstream error with its original status preserved (the envelope
/// code alone cannot express arbitrary 4xx/5xx statuses).
pub struct UpstreamError {
    pub status: StatusCode,
    pub error: ApiError,
}

/// Map an upstream status + body onto our envelope.
pub fn map_upstream_error(status: StatusCode, body: &[u8]) -> UpstreamError {
    let code = match status {
        StatusCode::UNAUTHORIZED => ApiErrorCode::SessionExpired,
        StatusCode::FORBIDDEN => ApiErrorCode::AccessDenied,
        StatusCode::NOT_FOUND => ApiErrorCode::NotFound,
        StatusCode::CONFLICT => ApiErrorCode::Conflict,
        StatusCode::BAD_REQUEST => ApiErrorCode::KanidmBadRequest,
        s if s.is_client_error() => ApiErrorCode::KanidmRejected,
        s if s.is_server_error() => ApiErrorCode::KanidmError,
        _ => ApiErrorCode::KanidmError,
    };
    let message = extract_message(code, body);
    UpstreamError {
        status,
        error: ApiError::new(code, message),
    }
}

/// Default message per code when the body carries nothing usable.
fn default_message(code: ApiErrorCode) -> &'static str {
    match code {
        ApiErrorCode::SessionExpired => "Your session has expired. Please sign in again.",
        ApiErrorCode::AccessDenied => "Access denied.",
        ApiErrorCode::NotFound => "Not found.",
        ApiErrorCode::Conflict => "The request conflicts with the current state.",
        ApiErrorCode::KanidmBadRequest => "Kanidm rejected the request as invalid.",
        ApiErrorCode::KanidmRejected => "Kanidm rejected the request.",
        ApiErrorCode::KanidmError => "Kanidm reported a server error.",
        _ => "Kanidm request failed.",
    }
}

/// Extract a human-readable message from the upstream body.
///
/// 1. JSON with a string `error` field (kanidm 409 shape) -> that value.
/// 2. JSON that is a single-key object (kanidm OperationError enum shape,
///    e.g. `{"no_matching_entries":null}`) -> the key, humanized.
/// 3. Anything else -> raw text truncated to 200 chars.
fn extract_message(code: ApiErrorCode, body: &[u8]) -> String {
    if body.is_empty() {
        return default_message(code).to_string();
    }
    if let Ok(value) = serde_json::from_slice::<serde_json::Value>(body) {
        if let Some(error) = value.get("error").and_then(|e| e.as_str()) {
            if !error.is_empty() {
                return error.to_string();
            }
        }
        if let Some(map) = value.as_object() {
            if map.len() == 1 {
                let key = map.keys().next().expect("len checked");
                return humanize_key(key);
            }
        }
        return default_message(code).to_string();
    }
    let text = String::from_utf8_lossy(body);
    let text = text.trim();
    if text.is_empty() {
        return default_message(code).to_string();
    }
    text.chars().take(200).collect()
}

/// Humanize a snake_case OperationError key:
/// "no_matching_entries" -> "No matching entries".
fn humanize_key(key: &str) -> String {
    let humanized = key.replace('_', " ");
    let mut chars = humanized.chars();
    match chars.next() {
        Some(initial) => format!("{}{}", initial.to_uppercase(), chars.as_str()),
        None => humanized,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mapped(status: StatusCode, body: &[u8]) -> (StatusCode, ApiErrorCode, String) {
        let result = map_upstream_error(status, body);
        (result.status, result.error.code, result.error.message.clone())
    }

    #[test]
    fn status_table_maps_to_codes() {
        let empty = b"" as &[u8];
        assert_eq!(mapped(StatusCode::UNAUTHORIZED, empty).1, ApiErrorCode::SessionExpired);
        assert_eq!(mapped(StatusCode::FORBIDDEN, empty).1, ApiErrorCode::AccessDenied);
        assert_eq!(mapped(StatusCode::NOT_FOUND, empty).1, ApiErrorCode::NotFound);
        assert_eq!(mapped(StatusCode::CONFLICT, empty).1, ApiErrorCode::Conflict);
        assert_eq!(mapped(StatusCode::BAD_REQUEST, empty).1, ApiErrorCode::KanidmBadRequest);
        assert_eq!(mapped(StatusCode::UNPROCESSABLE_ENTITY, empty).1, ApiErrorCode::KanidmRejected);
        assert_eq!(mapped(StatusCode::INTERNAL_SERVER_ERROR, empty).1, ApiErrorCode::KanidmError);
    }

    #[test]
    fn upstream_status_is_preserved() {
        let result = map_upstream_error(StatusCode::UNPROCESSABLE_ENTITY, b"");
        assert_eq!(result.status, StatusCode::UNPROCESSABLE_ENTITY);
        let result = map_upstream_error(StatusCode::BAD_GATEWAY, b"");
        assert_eq!(result.status, StatusCode::BAD_GATEWAY);
    }

    #[test]
    fn error_string_field_is_used() {
        let (_, _, message) =
            mapped(StatusCode::CONFLICT, br#"{"error":"EntryAlreadyExists"}"#);
        assert_eq!(message, "EntryAlreadyExists");
    }

    #[test]
    fn single_key_operation_error_is_humanized() {
        let (_, code, message) =
            mapped(StatusCode::BAD_REQUEST, br#"{"no_matching_entries":null}"#);
        assert_eq!(code, ApiErrorCode::KanidmBadRequest);
        assert_eq!(message, "No matching entries");
    }

    #[test]
    fn raw_text_is_truncated_to_200_chars() {
        let long = "x".repeat(600).into_bytes();
        let (_, _, message) = mapped(StatusCode::INTERNAL_SERVER_ERROR, &long);
        assert_eq!(message.chars().count(), 200);
    }

    #[test]
    fn empty_body_uses_default_message() {
        let (_, _, message) = mapped(StatusCode::FORBIDDEN, b"");
        assert_eq!(message, "Access denied.");
    }

    #[test]
    fn multi_key_json_falls_back_to_default() {
        let (_, _, message) = mapped(StatusCode::FORBIDDEN, br#"{"a":1,"b":2}"#);
        assert_eq!(message, "Access denied.");
    }
}
