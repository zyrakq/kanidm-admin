// app/src/auth/handlers.rs
//
// HTTP handlers for the session proxy endpoints. The raw Kanidm JWS
// token never appears in a response body: it only travels between the
// backend and Kanidm, and between the browser and the backend inside
// the HttpOnly kadmin_session cookie. Passwords transit memory only
// and are never logged.

use axum::extract::{rejection::JsonRejection, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use kanidm_proto::internal::PrivilegesActive;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use super::cookie::{build_clear_cookie, build_set_cookie, extract_session_token};
use super::error::{map_auth_error, ApiError, ApiErrorCode};
use super::token::{
    decode_user_auth_token, is_active, remaining_session_secs, session_view, write_privilege,
    SessionView,
};
use super::AppState;

/// Auth sub-router; merged into the application router in routes.rs.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/session", get(session))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/reauth", post(reauth))
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReauthRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUser {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub user: SessionUser,
    pub session_expires_at: Option<i64>,
    pub write_until: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReauthResponse {
    pub write_until: Option<i64>,
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const USERNAME_MAX_LEN: usize = 255;
const PASSWORD_MAX_LEN: usize = 1024;

fn validate_credentials(username: &str, password: &str) -> Result<(), ApiError> {
    if username.trim().is_empty() || username.len() > USERNAME_MAX_LEN {
        return Err(ApiError::validation_error("Username must be 1-255 characters."));
    }
    if password.is_empty() || password.len() > PASSWORD_MAX_LEN {
        return Err(ApiError::validation_error("Password must be 1-1024 characters."));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn cookie_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(extract_session_token)
}

fn session_user(view: &SessionView) -> SessionUser {
    SessionUser {
        id: view.user_id.clone(),
        username: view.username.clone(),
        display_name: view.display_name.clone(),
        email: view.email.clone(),
    }
}

fn session_response_body(view: &SessionView) -> SessionResponse {
    SessionResponse {
        user: session_user(view),
        session_expires_at: view.session_expires_at,
        write_until: view.write_until,
    }
}

/// 401 session_expired plus a Set-Cookie that clears the stale cookie.
fn expired_response() -> Response {
    let error = ApiError::session_expired();
    (
        error.code.status(),
        [(header::SET_COOKIE, build_clear_cookie())],
        Json(error.body()),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /api/auth/login {username, password}
pub async fn login(
    State(state): State<AppState>,
    payload: Result<Json<LoginRequest>, JsonRejection>,
) -> Response {
    let request = match payload {
        Ok(Json(request)) => request,
        Err(_) => {
            return ApiError::validation_error("Request body must be JSON with username and password.")
                .into_response()
        }
    };
    if let Err(error) = validate_credentials(&request.username, &request.password) {
        return error.into_response();
    }

    let token = match state.auth.auth_password(&request.username, &request.password).await {
        Ok(token) => token,
        Err(error) => return map_auth_error(error).into_response(),
    };

    let uat = match decode_user_auth_token(&token) {
        Ok(uat) => uat,
        Err(_) => return ApiError::kanidm_unreachable().into_response(),
    };

    let now = OffsetDateTime::now_utc();
    let view = session_view(&uat);
    let cookie = build_set_cookie(&token, remaining_session_secs(&uat, now));
    (
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(session_response_body(&view)),
    )
        .into_response()
}

/// GET /api/auth/session — local cookie decode only, no Kanidm roundtrip.
pub async fn session(headers: HeaderMap) -> Response {
    let Some(token) = cookie_token(&headers) else {
        return ApiError::session_expired().into_response();
    };

    let uat = match decode_user_auth_token(token) {
        Ok(uat) => uat,
        Err(_) => return ApiError::session_expired().into_response(),
    };

    if !is_active(&uat, OffsetDateTime::now_utc()) {
        return expired_response();
    }

    let view = session_view(&uat);
    (StatusCode::OK, Json(session_response_body(&view))).into_response()
}

/// POST /api/auth/logout — revoke server-side, clear the cookie.
///
/// On Kanidm unreachable the cookie is KEPT (502) so the user can retry
/// logout; the server-side session would otherwise linger until expiry.
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let clear = [(header::SET_COOKIE, build_clear_cookie())];

    let Some(token) = cookie_token(&headers) else {
        return (StatusCode::NO_CONTENT, clear).into_response();
    };

    match state.auth.logout(token).await {
        Ok(()) => (StatusCode::NO_CONTENT, clear).into_response(),
        Err(error) => map_auth_error(error).into_response(),
    }
}

/// POST /api/auth/reauth {password} — privilege step-up.
pub async fn reauth(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<ReauthRequest>, JsonRejection>,
) -> Response {
    let request = match payload {
        Ok(Json(request)) => request,
        Err(_) => {
            return ApiError::validation_error("Request body must be JSON with a password.")
                .into_response()
        }
    };
    if request.password.is_empty() || request.password.len() > PASSWORD_MAX_LEN {
        return ApiError::validation_error("Password must be 1-1024 characters.").into_response();
    }

    let Some(token) = cookie_token(&headers) else {
        return ApiError::session_expired().into_response();
    };

    let uat = match decode_user_auth_token(token) {
        Ok(uat) => uat,
        Err(_) => return ApiError::session_expired().into_response(),
    };

    let now = OffsetDateTime::now_utc();
    if !is_active(&uat, now) {
        return expired_response();
    }

    // Read-only sessions can never gain a write window.
    if matches!(write_privilege(&uat, now), PrivilegesActive::False) {
        return ApiError::new(
            ApiErrorCode::ReauthRequired,
            "This session is read-only and cannot gain write access.",
        )
        .into_response();
    }

    let new_token = match state.auth.reauth_password(token, &request.password).await {
        Ok(new_token) => new_token,
        Err(error) => return map_auth_error(error).into_response(),
    };

    let new_uat = match decode_user_auth_token(&new_token) {
        Ok(uat) => uat,
        Err(_) => return ApiError::kanidm_unreachable().into_response(),
    };

    let now = OffsetDateTime::now_utc();
    let view = session_view(&new_uat);
    let cookie = build_set_cookie(&new_token, remaining_session_secs(&new_uat, now));
    (
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(ReauthResponse {
            write_until: view.write_until,
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Tests (mock-based, no live Kanidm)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::ops::test_support::{MockAuthOps, MockOutcome};
    use crate::auth::token::test_support::fixture_token;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use kanidm_proto::internal::UatPurpose;
    use serde_json::json;
    use std::sync::{Arc, Mutex};
    use time::{Duration, OffsetDateTime};
    use tower::ServiceExt;

    fn router_with(mock: MockAuthOps) -> Router {
        routes().with_state(AppState::new(Arc::new(mock)))
    }

    async fn json_body(response: Response) -> serde_json::Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        serde_json::from_slice(&bytes).expect("parse json body")
    }

    fn set_cookie(response: &Response) -> Option<String> {
        response
            .headers()
            .get_all(header::SET_COOKIE)
            .iter()
            .find_map(|value| value.to_str().ok().map(str::to_string))
    }

    fn post_json(uri: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .expect("build request")
    }

    fn get_with_cookie(uri: &str, cookie: &str) -> Request<Body> {
        Request::builder()
            .uri(uri)
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("build request")
    }

    #[tokio::test]
    async fn login_success_sets_cookie_and_returns_user() {
        let expiry = OffsetDateTime::now_utc() + Duration::hours(2);
        let token = fixture_token("idm_admin@example.com", Some(expiry), UatPurpose::ReadOnly);
        let mock = MockAuthOps {
            login_token: Mutex::new(Some(token)),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(post_json(
                "/api/auth/login",
                r#"{"username":"idm_admin","password":"secret"}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);

        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(cookie.starts_with("kadmin_session="), "cookie: {cookie}");
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.contains("SameSite=Strict"));
        assert!(cookie.contains("Path=/api"));
        assert!(cookie.contains("Max-Age="));

        let body = json_body(response).await;
        assert_eq!(body["user"]["username"], "idm_admin@example.com");
        assert_eq!(body["user"]["displayName"], "Display idm_admin@example.com");
        assert_eq!(body["sessionExpiresAt"], json!(expiry.unix_timestamp()));
    }

    #[tokio::test]
    async fn login_denied_returns_invalid_credentials() {
        let mock = MockAuthOps {
            login_outcome: Mutex::new(MockOutcome::Denied),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(post_json(
                "/api/auth/login",
                r#"{"username":"idm_admin","password":"wrong"}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "invalid_credentials");
    }

    #[tokio::test]
    async fn login_unreachable_returns_502() {
        let mock = MockAuthOps {
            login_outcome: Mutex::new(MockOutcome::Unreachable),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(post_json(
                "/api/auth/login",
                r#"{"username":"idm_admin","password":"x"}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_unreachable");
    }

    #[tokio::test]
    async fn login_malformed_json_returns_validation_error() {
        let response = router_with(MockAuthOps::default())
            .oneshot(post_json("/api/auth/login", "not json"))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "validation_error");
    }

    #[tokio::test]
    async fn login_blank_username_returns_validation_error() {
        let response = router_with(MockAuthOps::default())
            .oneshot(post_json(
                "/api/auth/login",
                r#"{"username":"   ","password":"x"}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn session_with_valid_cookie_returns_user_and_write_window() {
        let now = OffsetDateTime::now_utc();
        let write_until = now + Duration::minutes(10);
        let token = fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(write_until),
            },
        );

        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie(
                "/api/auth/session",
                &format!("other=1; kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let body = json_body(response).await;
        assert_eq!(body["user"]["username"], "idm_admin@example.com");
        assert_eq!(body["writeUntil"], json!(write_until.unix_timestamp()));
    }

    #[tokio::test]
    async fn session_without_cookie_returns_401() {
        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie("/api/auth/session", "theme=dark"))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
    }

    #[tokio::test]
    async fn session_with_expired_token_clears_cookie() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() - Duration::minutes(1)),
            UatPurpose::ReadOnly,
        );

        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie(
                "/api/auth/session",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
    }

    #[tokio::test]
    async fn logout_get_returns_method_not_allowed() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        );

        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie(
                "/api/auth/logout",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        // get_with_cookie builds a GET; logout is POST-only.
        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn logout_post_returns_204_and_clears_cookie() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        );

        let request = Request::builder()
            .method("POST")
            .uri("/api/auth/logout")
            .header("cookie", format!("kadmin_session={token}"))
            .body(Body::empty())
            .expect("build request");

        let response = router_with(MockAuthOps::default())
            .oneshot(request)
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
    }

    #[tokio::test]
    async fn reauth_success_refreshes_cookie_and_returns_write_until() {
        let now = OffsetDateTime::now_utc();
        let current = fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite { expiry: None },
        );
        let write_until = now + Duration::minutes(10);
        let refreshed = fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(write_until),
            },
        );

        let mock = MockAuthOps {
            reauth_token: Mutex::new(Some(refreshed.clone())),
            ..Default::default()
        };

        let request = Request::builder()
            .method("POST")
            .uri("/api/auth/reauth")
            .header("cookie", format!("kadmin_session={current}"))
            .header("content-type", "application/json")
            .body(Body::from(r#"{"password":"secret"}"#.to_string()))
            .expect("build request");

        let response = router_with(mock)
            .oneshot(request)
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(
            cookie.contains(&refreshed),
            "cookie must carry the refreshed token"
        );

        let body = json_body(response).await;
        assert_eq!(body["writeUntil"], json!(write_until.unix_timestamp()));
    }

    #[tokio::test]
    async fn reauth_without_cookie_returns_401() {
        let response = router_with(MockAuthOps::default())
            .oneshot(post_json("/api/auth/reauth", r#"{"password":"x"}"#))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn reauth_readonly_session_get_returns_method_not_allowed() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        );

        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie(
                "/api/auth/reauth",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        // GET is wrong method; the readonly check needs POST.
        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn reauth_readonly_session_post_returns_403() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        );

        let request = Request::builder()
            .method("POST")
            .uri("/api/auth/reauth")
            .header("cookie", format!("kadmin_session={token}"))
            .header("content-type", "application/json")
            .body(Body::from(r#"{"password":"x"}"#.to_string()))
            .expect("build request");

        let response = router_with(MockAuthOps::default())
            .oneshot(request)
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "reauth_required");
    }

    #[tokio::test]
    async fn reauth_denied_returns_invalid_credentials() {
        let current = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadWrite { expiry: None },
        );
        let mock = MockAuthOps {
            reauth_outcome: Mutex::new(MockOutcome::Denied),
            ..Default::default()
        };

        let request = Request::builder()
            .method("POST")
            .uri("/api/auth/reauth")
            .header("cookie", format!("kadmin_session={current}"))
            .header("content-type", "application/json")
            .body(Body::from(r#"{"password":"wrong"}"#.to_string()))
            .expect("build request");

        let response = router_with(mock)
            .oneshot(request)
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "invalid_credentials");
    }
}
