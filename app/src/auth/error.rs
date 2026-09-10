// app/src/auth/error.rs
//
// The API error convention: every error response is
// { "error": { "code", "message" } } with a stable machine-readable
// code the frontend localizes messages by.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use kanidm_client::ClientError;
use kanidm_proto::internal::OperationError;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiErrorCode {
    InvalidCredentials,
    SessionExpired,
    ReauthRequired,
    KanidmUnreachable,
    ValidationError,
    AccessDenied,
    NotFound,
    Conflict,
    KanidmBadRequest,
    KanidmRejected,
    KanidmError,
}

impl ApiErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InvalidCredentials => "invalid_credentials",
            Self::SessionExpired => "session_expired",
            Self::ReauthRequired => "reauth_required",
            Self::KanidmUnreachable => "kanidm_unreachable",
            Self::ValidationError => "validation_error",
            Self::AccessDenied => "access_denied",
            Self::NotFound => "not_found",
            Self::Conflict => "conflict",
            Self::KanidmBadRequest => "kanidm_bad_request",
            Self::KanidmRejected => "kanidm_rejected",
            Self::KanidmError => "kanidm_error",
        }
    }

    pub fn status(self) -> StatusCode {
        match self {
            Self::InvalidCredentials | Self::SessionExpired => StatusCode::UNAUTHORIZED,
            Self::ReauthRequired => StatusCode::FORBIDDEN,
            Self::KanidmUnreachable => StatusCode::BAD_GATEWAY,
            Self::ValidationError => StatusCode::BAD_REQUEST,
            Self::AccessDenied => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::KanidmBadRequest => StatusCode::BAD_REQUEST,
            Self::KanidmRejected => StatusCode::UNPROCESSABLE_ENTITY,
            Self::KanidmError => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug)]
pub struct ApiError {
    pub code: ApiErrorCode,
    pub message: String,
}

impl ApiError {
    pub fn new(code: ApiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn invalid_credentials(message: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::InvalidCredentials, message)
    }

    pub fn session_expired() -> Self {
        Self::new(
            ApiErrorCode::SessionExpired,
            "Your session has expired. Please sign in again.",
        )
    }
    #[cfg(test)]
    pub fn reauth_required() -> Self {
        Self::new(
            ApiErrorCode::ReauthRequired,
            "This operation requires elevated privileges. Re-authenticate to continue.",
        )
    }

    pub fn kanidm_unreachable() -> Self {
        Self::new(
            ApiErrorCode::KanidmUnreachable,
            "The Kanidm server is unreachable.",
        )
    }

    pub fn validation_error(message: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::ValidationError, message)
    }

    /// JSON body in the shared error convention, usable when a response
    /// needs extra headers beyond what `into_response` attaches.
    pub fn body(&self) -> ErrorBody {
        ErrorBody {
            error: ErrorDetail {
                code: self.code.as_str().to_string(),
                message: self.message.clone(),
            },
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.code.status(), Json(self.body())).into_response()
    }
}

/// Map a kanidm_client error from an auth attempt (login / reauth /
/// logout) onto our error shape.
///
/// - bad password or denied attempt        -> invalid_credentials
/// - dead session (401 + SessionExpired /
///   NotAuthenticated, or the dedicated
///   variants)                             -> session_expired
/// - denied with server-side delay (Wait)  -> invalid_credentials
///   with a "try later" message
/// - transport / 5xx / anything else       -> kanidm_unreachable
pub fn map_auth_error(err: ClientError) -> ApiError {
    match err {
        ClientError::AuthenticationFailed => {
            ApiError::invalid_credentials("Invalid username or password.")
        }
        ClientError::Unauthorized | ClientError::SessionExpired => ApiError::session_expired(),
        ClientError::Http(status, op_err, _msg) => {
            if status == StatusCode::UNAUTHORIZED {
                match op_err {
                    Some(OperationError::SessionExpired | OperationError::NotAuthenticated) => {
                        ApiError::session_expired()
                    }
                    Some(OperationError::Wait(_)) => ApiError::invalid_credentials(
                        "Too many attempts. Please try again later.",
                    ),
                    _ => ApiError::invalid_credentials("Invalid username or password."),
                }
            } else {
                ApiError::kanidm_unreachable()
            }
        }
        _ => ApiError::kanidm_unreachable(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use time::OffsetDateTime;

    #[test]
    fn authentication_failed_maps_to_invalid_credentials() {
        let error = map_auth_error(ClientError::AuthenticationFailed);
        assert_eq!(error.code, ApiErrorCode::InvalidCredentials);
        assert_eq!(error.code.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn unauthorized_maps_to_session_expired() {
        let error = map_auth_error(ClientError::Unauthorized);
        assert_eq!(error.code, ApiErrorCode::SessionExpired);
    }

    #[test]
    fn session_expired_variant_maps_to_session_expired() {
        let error = map_auth_error(ClientError::SessionExpired);
        assert_eq!(error.code, ApiErrorCode::SessionExpired);
    }

    #[test]
    fn http_401_with_session_expired_operror_maps_to_session_expired() {
        let err = ClientError::Http(
            StatusCode::UNAUTHORIZED,
            Some(OperationError::SessionExpired),
            "denied".to_string(),
        );
        assert_eq!(map_auth_error(err).code, ApiErrorCode::SessionExpired);
    }

    #[test]
    fn http_401_with_wait_maps_to_invalid_credentials_with_delay_message() {
        let err = ClientError::Http(
            StatusCode::UNAUTHORIZED,
            Some(OperationError::Wait(OffsetDateTime::UNIX_EPOCH)),
            "delayed".to_string(),
        );
        let error = map_auth_error(err);
        assert_eq!(error.code, ApiErrorCode::InvalidCredentials);
        assert!(error.message.contains("later"), "message: {}", error.message);
    }

    #[test]
    fn http_401_plain_maps_to_invalid_credentials() {
        let err = ClientError::Http(StatusCode::UNAUTHORIZED, None, "denied".to_string());
        assert_eq!(map_auth_error(err).code, ApiErrorCode::InvalidCredentials);
    }

    #[test]
    fn http_5xx_maps_to_kanidm_unreachable() {
        let err = ClientError::Http(StatusCode::BAD_GATEWAY, None, "upstream".to_string());
        let error = map_auth_error(err);
        assert_eq!(error.code, ApiErrorCode::KanidmUnreachable);
        assert_eq!(error.code.status(), StatusCode::BAD_GATEWAY);
    }

    #[test]
    fn system_error_maps_to_kanidm_unreachable() {
        let error = map_auth_error(ClientError::SystemError);
        assert_eq!(error.code, ApiErrorCode::KanidmUnreachable);
    }

    #[tokio::test]
    async fn api_error_renders_json_error_body() {
        let response = ApiError::reauth_required().into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let body: serde_json::Value = serde_json::from_slice(&bytes).expect("parse body");
        assert_eq!(body["error"]["code"], "reauth_required");
        assert!(body["error"]["message"].is_string());
    }
}
