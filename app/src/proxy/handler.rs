// app/src/proxy/handler.rs
//
// The catch-all reverse proxy: /api/kanidm/{*path} -> {kanidm}/{path}.
// Pipeline: cookie -> local token decode (401 envelope) -> allowlist
// (403) -> write-privilege precheck for mutating methods (403
// reauth_required, BEFORE any upstream call, so withStepUp works for
// every proxied write) -> forward (bearer, content-type verbatim,
// buffered body) -> map response (status preserved, error envelope).

use axum::body::{to_bytes, Body, Bytes};
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::{header, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use axum::{Json, Router};
use time::OffsetDateTime;

use super::allowlist::is_allowed;
use super::error_map::map_upstream_error;
use super::forwarder::ForwardRequest;
use crate::auth::error::{ApiError, ApiErrorCode};
use crate::auth::handlers::{cookie_token, expired_response};
use crate::auth::token::{decode_user_auth_token, is_active, write_privilege};
use crate::auth::AppState;

/// Body limit for proxied requests (image uploads are the largest
/// payloads; 10 MB is generous).
const MAX_BODY_BYTES: usize = 10 * 1024 * 1024;

/// Proxy sub-router; merged into the application router in routes.rs.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/kanidm/{*path}", any(proxy))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
}

pub async fn proxy(State(state): State<AppState>, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let method = parts.method;
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_default();
    // Strip the /api/kanidm prefix.
    let upstream_path = path_and_query
        .strip_prefix("/api/kanidm")
        .unwrap_or(&path_and_query)
        .to_string();

    // 1. Session cookie -> token (401 + clear cookie when absent/expired).
    let Some(token) = cookie_token(&parts.headers) else {
        return expired_response();
    };
    let uat = match decode_user_auth_token(token) {
        Ok(uat) => uat,
        Err(_) => return expired_response(),
    };
    let now = OffsetDateTime::now_utc();
    if !is_active(&uat, now) {
        return expired_response();
    }

    // 2. Allowlist.
    if !is_allowed(&method, &upstream_path) {
        return ApiError::new(ApiErrorCode::AccessDenied, "Path not allowed.")
            .into_response();
    }

    // 3. Write-privilege precheck for mutating methods.
    if matches!(
        method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    ) && !matches!(
        write_privilege(&uat, now),
        kanidm_proto::internal::PrivilegesActive::True
    ) {
        return ApiError::new(
            ApiErrorCode::ReauthRequired,
            "This operation requires elevated privileges. Re-authenticate to continue.",
        )
        .into_response();
    }

    // 4. Buffer the body (DELETE-with-body must survive: system badlist
    //    removal sends a JSON array in a DELETE).
    let body = match to_bytes(body, MAX_BODY_BYTES).await {
        Ok(bytes) => bytes,
        Err(_) => {
            // Body could not be buffered: in practice this is the
            // DefaultBodyLimit / to_bytes length limit firing on an
            // oversized body. axum's convention for that is 413
            // Payload Too Large; we mirror it with our error envelope.
            // Accepted behavior: no nicer envelope is warranted here.
            return (
                StatusCode::PAYLOAD_TOO_LARGE,
                Json(ApiError::validation_error("Request body too large or malformed.").body()),
            )
                .into_response();
        }
    };

    // 5. Forward.
    let content_type = parts
        .headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let forward_request = ForwardRequest {
        method: method.clone(),
        path_and_query: upstream_path,
        content_type,
        body,
        bearer_token: token.to_string(),
    };

    match state.proxy.forward(forward_request).await {
        Ok(upstream) => match upstream.status.is_success() {
            true => passthrough(upstream.status, upstream.content_type, upstream.body),
            false => upstream_error(upstream.status, &upstream.body),
        },
        Err(_) => ApiError::kanidm_unreachable().into_response(),
    }
}

/// 2xx passthrough: status + content-type + body verbatim.
fn passthrough(status: StatusCode, content_type: Option<String>, body: Bytes) -> Response {
    let mut response = Response::builder().status(status);
    if let Some(content_type) = content_type {
        response = response.header(header::CONTENT_TYPE, content_type);
    }
    response.body(Body::from(body)).unwrap()
}

/// Upstream error: original status + envelope; 401 also clears the cookie.
fn upstream_error(status: StatusCode, body: &[u8]) -> Response {
    let mapped = map_upstream_error(status, body);
    if mapped.status == StatusCode::UNAUTHORIZED {
        return (
            mapped.status,
            [(header::SET_COOKIE, crate::auth::cookie::build_clear_cookie())],
            Json(mapped.error.body()),
        )
            .into_response();
    }
    (mapped.status, Json(mapped.error.body())).into_response()
}

// ---------------------------------------------------------------------------
// Tests (mock-based, no live Kanidm)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::super::forwarder::ForwardResponse;
    use super::*;
    use crate::auth::ops::test_support::MockAuthOps;
    use crate::auth::token::test_support::fixture_token;
    use crate::proxy::forwarder::test_support::{ok_json_response, MockForwarder};
    use axum::http::Request;
    use kanidm_proto::internal::UatPurpose;
    use std::sync::Arc;
    use time::{Duration, OffsetDateTime};
    use tower::ServiceExt;

    fn live_token() -> String {
        let now = OffsetDateTime::now_utc();
        fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(now + Duration::minutes(10)),
            },
        )
    }

    fn readonly_token() -> String {
        let now = OffsetDateTime::now_utc();
        fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadOnly,
        )
    }

    fn expired_token() -> String {
        let now = OffsetDateTime::now_utc();
        fixture_token(
            "idm_admin@example.com",
            Some(now - Duration::minutes(1)),
            UatPurpose::ReadOnly,
        )
    }

    fn router(forwarder: Arc<MockForwarder>) -> Router {
        routes().with_state(AppState::new(
            Arc::new(MockAuthOps::default()),
            forwarder,
            Arc::new(crate::avatars::store::test_support::MemoryAvatarStore::default()),
        ))
    }

    fn request(method: &str, uri: &str, token: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .header("cookie", format!("kadmin_session={token}"))
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .expect("build request")
    }

    fn request_without_cookie(method: &str, uri: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .expect("build request")
    }

    fn multipart_request(uri: &str, token: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("cookie", format!("kadmin_session={token}"))
            .header("content-type", "multipart/form-data; boundary=XYZ123")
            .body(Body::from(body.to_string()))
            .expect("build request")
    }

    fn upstream_response(status: StatusCode, body: &'static [u8]) -> ForwardResponse {
        ForwardResponse {
            status,
            content_type: Some("application/json".to_string()),
            body: Bytes::from_static(body),
        }
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

    #[tokio::test]
    async fn allowed_get_is_forwarded_with_bearer() {
        let token = live_token();
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"[]"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &token, ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(forwarded.path_and_query, "/v1/person");
        assert_eq!(forwarded.bearer_token, token);
        assert_eq!(forwarder.calls(), 1);
    }

    #[tokio::test]
    async fn denied_path_returns_403_without_upstream_call() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"[]"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "POST",
                "/api/kanidm/raw/search",
                &live_token(),
                "{}",
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "access_denied");
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn write_to_images_denied() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"[]"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "POST",
                "/api/kanidm/ui/images/domain",
                &live_token(),
                "{}",
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn get_images_forwarded() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"png"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "GET",
                "/api/kanidm/ui/images/oauth2/rs",
                &live_token(),
                "",
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(forwarded.path_and_query, "/ui/images/oauth2/rs");
        assert_eq!(forwarder.calls(), 1);
    }

    #[tokio::test]
    async fn missing_cookie_returns_401_and_clears_cookie() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"[]"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request_without_cookie("GET", "/api/kanidm/v1/person", ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn expired_token_returns_401() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"[]"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "GET",
                "/api/kanidm/v1/person",
                &expired_token(),
                "",
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn write_with_readonly_token_short_circuits_to_reauth_required() {
        let forwarder = Arc::new(MockForwarder::default());
        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "POST",
                "/api/kanidm/v1/person",
                &readonly_token(),
                r#"{"attrs":{"name":["test"]}}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
        let body: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        assert_eq!(body["error"]["code"], "reauth_required");
        assert_eq!(forwarder.calls(), 0, "precheck must fire before forwarding");
    }

    #[tokio::test]
    async fn write_with_live_window_forwarded() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"{}"#)));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "POST",
                "/api/kanidm/v1/person",
                &live_token(),
                r#"{"attrs":{"name":["test"]}}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(forwarder.calls(), 1);
    }

    #[tokio::test]
    async fn multipart_content_type_forwarded_verbatim() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"{}"#)));
        let body = "--XYZ123\r\ncontent-disposition: form-data; name=\"file\"\r\n\r\nbinary\r\n--XYZ123--\r\n";

        let response = router(Arc::clone(&forwarder))
            .oneshot(multipart_request("/api/kanidm/v1/person", &live_token(), body))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(
            forwarded.content_type.as_deref(),
            Some("multipart/form-data; boundary=XYZ123")
        );
    }

    #[tokio::test]
    async fn upstream_200_passes_status_body_content_type() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(
            br#"{"id":"x"}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE),
            Some(&header::HeaderValue::from_static("application/json"))
        );
        let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
        assert_eq!(bytes.as_ref(), br#"{"id":"x"}"#);
    }

    #[tokio::test]
    async fn upstream_401_maps_to_session_expired_and_clears_cookie() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::UNAUTHORIZED,
            br#"{"error":"SessionExpired"}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let cookie = set_cookie(&response).expect("set-cookie header");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
    }

    #[tokio::test]
    async fn upstream_403_uses_error_field_message() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::FORBIDDEN,
            br#"{"error":"AccessDenied"}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "access_denied");
        assert_eq!(body["error"]["message"], "AccessDenied");
    }

    #[tokio::test]
    async fn upstream_404_maps_to_not_found() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::NOT_FOUND,
            br#"{}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "not_found");
    }

    #[tokio::test]
    async fn upstream_409_maps_to_conflict_envelope() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::CONFLICT,
            br#"{"error":"EntryAlreadyExists"}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "POST",
                "/api/kanidm/v1/person",
                &live_token(),
                r#"{"attrs":{"name":["test"]}}"#,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
        let body: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        assert_eq!(body["error"]["code"], "conflict");
        assert_eq!(body["error"]["message"], "EntryAlreadyExists");
    }

    #[tokio::test]
    async fn upstream_400_humanizes_operation_error() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::BAD_REQUEST,
            br#"{"no_matching_entries":null}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_bad_request");
        assert_eq!(body["error"]["message"], "No matching entries");
    }

    #[tokio::test]
    async fn upstream_422_preserves_status_as_kanidm_rejected() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            br#"{}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_rejected");
    }

    #[tokio::test]
    async fn upstream_500_preserves_status_as_kanidm_error() {
        let forwarder = Arc::new(MockForwarder::with_response(upstream_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            br#"{}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_error");
    }

    #[tokio::test]
    async fn transport_error_returns_502_kanidm_unreachable() {
        let forwarder = Arc::new(MockForwarder::transport_error());

        let response = router(Arc::clone(&forwarder))
            .oneshot(request("GET", "/api/kanidm/v1/person", &live_token(), ""))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_unreachable");
    }

    #[tokio::test]
    async fn delete_with_body_is_forwarded() {
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"{}"#)));
        let body = r#"["password123"]"#;

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                "DELETE",
                "/api/kanidm/v1/system/_attr/badlist_password",
                &live_token(),
                body,
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(forwarded.body, Bytes::from_static(br#"["password123"]"#));
        assert_eq!(forwarder.calls(), 1);
    }

    #[tokio::test]
    async fn oversized_body_rejected() {
        // Accepted behavior: a body over the 10 MB route limit is
        // rejected with 413 Payload Too Large (axum's DefaultBodyLimit
        // convention, mirrored by the handler's envelope mapping)
        // instead of a 500.
        let forwarder = Arc::new(MockForwarder::with_response(ok_json_response(br#"{}"#)));
        let oversized = Request::builder()
            .method("POST")
            .uri("/api/kanidm/v1/person")
            .header("cookie", format!("kadmin_session={}", live_token()))
            .header("content-type", "application/json")
            .body(Body::from(vec![b'a'; MAX_BODY_BYTES + 1]))
            .expect("build request");

        let response = router(Arc::clone(&forwarder))
            .oneshot(oversized)
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(forwarder.calls(), 0);
    }
}
