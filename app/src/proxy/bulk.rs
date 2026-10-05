// app/src/proxy/bulk.rs
//
// Server-side bulk delete: POST /api/bulk-delete with
// { kind, ids } -> N sequential DELETE calls to Kanidm through the same
// forwarder the proxy uses, returning a per-item report. The browser
// used to loop single deletes (one step-up prompt per item); doing it
// server-side means one step-up for the whole batch, one HTTP round
// trip, and a structured result the UI can render.
//
// Kanidm has no bulk API, so this is a fan-out of the same single
// DELETE routes the proxy already allows. The session token is checked
// up front (401 envelope, write-privilege precheck -> reauth_required)
// and per item (mid-loop 401 stops the loop). No local business logic:
// Kanidm stays the source of truth for whether an entry may be
// deleted.

use axum::extract::State;
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use super::error_map::map_upstream_error;
use super::forwarder::ForwardRequest;
use crate::auth::error::{ApiError, ApiErrorCode};
use crate::auth::handlers::{cookie_token, expired_response};
use crate::auth::token::{decode_user_auth_token, is_active, write_privilege};
use crate::auth::AppState;
use kanidm_proto::internal::PrivilegesActive;

/// Upper bound on ids per request. The UI sends at most one page of
/// selections; a much larger batch is almost certainly a bug or abuse.
const MAX_BULK_IDS: usize = 100;

/// The five deletable entry kinds, matching the proxy allowlist.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BulkKind {
    Person,
    Group,
    ServiceAccount,
    Oauth2,
    Application,
}

#[derive(Debug, Deserialize)]
pub struct BulkDeleteRequest {
    kind: BulkKind,
    ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct BulkItemResult {
    id: String,
    ok: bool,
    /// Upstream HTTP status; 0 for transport failures / skipped items.
    status: u16,
    /// Our envelope error code (proxy semantics), None on success.
    code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BulkDeleteResponse {
    deleted: usize,
    /// true when the loop stopped early (session gone / transport
    /// failure); remaining ids are reported as skipped.
    aborted: bool,
    results: Vec<BulkItemResult>,
}

/// Minimal percent-encoding for one path segment (anything outside the
/// RFC 3986 unreserved set). Kanidm names already constrain the
/// character set, but encoding keeps anything odd — or a path
/// traversal — from forming a different upstream path.
fn encode_id(id: &str) -> String {
    let mut out = String::with_capacity(id.len());
    for byte in id.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// The upstream DELETE path for one id of a kind.
fn delete_path(kind: BulkKind, id: &str) -> String {
    let id = encode_id(id);
    match kind {
        BulkKind::Person => format!("/v1/person/{id}"),
        BulkKind::Group => format!("/v1/group/{id}"),
        BulkKind::ServiceAccount => format!("/v1/service_account/{id}"),
        BulkKind::Oauth2 => format!("/v1/oauth2/{id}"),
        BulkKind::Application => format!("/scim/v1/Application/{id}"),
    }
}

/// Sub-router; merged into the application router in routes.rs.
pub fn routes() -> Router<AppState> {
    Router::new().route("/api/bulk-delete", post(bulk_delete))
}

pub async fn bulk_delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BulkDeleteRequest>,
) -> Response {
    // 1. Session cookie -> token (same 401 envelope as the proxy).
    let Some(token) = cookie_token(&headers) else {
        return expired_response();
    };
    let Ok(uat) = decode_user_auth_token(token) else {
        return expired_response();
    };
    let now = OffsetDateTime::now_utc();
    if !is_active(&uat, now) {
        return expired_response();
    }

    // 2. Write-privilege precheck: one reauth_required up front so the
    //    whole batch is covered by a single step-up.
    if !matches!(write_privilege(&uat, now), PrivilegesActive::True) {
        return ApiError::new(
            ApiErrorCode::ReauthRequired,
            "This operation requires elevated privileges. Re-authenticate to continue.",
        )
        .into_response();
    }

    // 3. Validate the batch.
    if payload.ids.is_empty() {
        return ApiError::validation_error("ids must not be empty.").into_response();
    }
    if payload.ids.len() > MAX_BULK_IDS {
        return ApiError::validation_error(&format!(
            "Too many ids: {} (max {MAX_BULK_IDS}).",
            payload.ids.len()
        ))
        .into_response();
    }

    // 4. Fan out: one DELETE per id. Related entries (memberships,
    //    oauth2 scope maps) are cleaned up by Kanidm's referential
    //    integrity plugin, so failures require no special-casing here.
    let kind = payload.kind;
    let mut deleted = 0usize;
    let mut aborted = false;
    let mut results = Vec::with_capacity(payload.ids.len());

    for id in &payload.ids {
        let request = ForwardRequest {
            method: Method::DELETE,
            path_and_query: delete_path(kind, id),
            content_type: None,
            body: Default::default(),
            bearer_token: token.to_string(),
        };

        let result = match state.proxy.forward(request).await {
            Ok(upstream) if upstream.status.is_success() => BulkItemResult {
                id: id.clone(),
                ok: true,
                status: upstream.status.as_u16(),
                code: None,
            },
            Ok(upstream) => {
                let mapped = map_upstream_error(upstream.status, &upstream.body);
                let code_str = mapped.error.code.as_str().to_string();
                let item = BulkItemResult {
                    id: id.clone(),
                    ok: false,
                    status: upstream.status.as_u16(),
                    code: Some(code_str.clone()),
                };
                // Mid-loop session loss: nothing after this will
                // succeed either, stop and report what happened.
                if code_str == "session_expired" {
                    aborted = true;
                }
                item
            }
            Err(_) => {
                results.push(BulkItemResult {
                    id: id.clone(),
                    ok: false,
                    status: StatusCode::BAD_GATEWAY.as_u16(),
                    code: Some("kanidm_unreachable".to_string()),
                });
                aborted = true;
                break;
            }
        };

        let ok = result.ok;
        results.push(result);
        if ok {
            deleted += 1;
        }
        if aborted {
            break;
        }
    }

    (
        StatusCode::OK,
        Json(BulkDeleteResponse {
            deleted,
            aborted,
            results,
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Tests (mock forwarder, same shape as handler.rs tests)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::super::forwarder::ForwardResponse;
    use super::*;
    use crate::auth::ops::test_support::MockAuthOps;
    use crate::auth::token::test_support::fixture_token;
    use crate::proxy::forwarder::test_support::MockForwarder;
    use axum::body::to_bytes;
    use axum::body::Bytes;
    use kanidm_proto::internal::UatPurpose;
    use std::sync::Arc;
    use time::{Duration, OffsetDateTime};
    use tower::ServiceExt;

    fn response(status: StatusCode, body: &'static [u8]) -> ForwardResponse {
        ForwardResponse {
            status,
            content_type: Some("application/json".to_string()),
            body: Bytes::from_static(body),
        }
    }

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

    fn router(forwarder: Arc<MockForwarder>) -> axum::Router {
        routes().with_state(AppState::new(Arc::new(MockAuthOps::default()), forwarder))
    }

    fn request(token: &str, body: &str) -> axum::http::Request<axum::body::Body> {
        axum::http::Request::builder()
            .method("POST")
            .uri("/api/bulk-delete")
            .header("cookie", format!("kadmin_session={token}"))
            .header("content-type", "application/json")
            .body(axum::body::Body::from(body.to_string()))
            .expect("build request")
    }

    async fn json_body(response: Response) -> serde_json::Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        serde_json::from_slice(&bytes).expect("parse json")
    }

    fn body_for(kind: &str, ids: &[&str]) -> String {
        let ids = serde_json::to_string(ids).expect("ids");
        format!(r#"{{"kind":"{kind}","ids":{ids}}}"#)
    }

    #[tokio::test]
    async fn deletes_each_id_and_reports_success() {
        let forwarder = Arc::new(MockForwarder::with_response(response(
            StatusCode::OK,
            br#"{}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(&live_token(), &body_for("person", &["a", "b"])))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(forwarder.calls(), 2);
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(forwarded.path_and_query, "/v1/person/b");
        assert_eq!(forwarded.method, Method::DELETE);
        assert!(forwarded.body.is_empty(), "DELETE must be bodyless");

        let body = json_body(response).await;
        assert_eq!(body["deleted"], 2);
        assert_eq!(body["aborted"], false);
        assert_eq!(body["results"][0]["id"], "a");
        assert_eq!(body["results"][0]["ok"], true);
    }

    #[tokio::test]
    async fn kind_maps_to_upstream_path() {
        let cases: [(&str, &str); 5] = [
            ("person", "/v1/person/x"),
            ("group", "/v1/group/x"),
            ("service_account", "/v1/service_account/x"),
            ("oauth2", "/v1/oauth2/x"),
            ("application", "/scim/v1/Application/x"),
        ];
        for (kind, path) in cases {
            let forwarder = Arc::new(MockForwarder::with_response(response(
                StatusCode::OK,
                br#"{}"#,
            )));
            router(Arc::clone(&forwarder))
                .oneshot(request(&live_token(), &body_for(kind, &["x"])))
                .await
                .expect("router call");
            let forwarded = forwarder.last_request().expect("forwarded request");
            assert_eq!(forwarded.path_and_query, path, "kind {kind}");
        }
    }

    #[tokio::test]
    async fn failure_keeps_going_and_collects_the_rest() {
        // First id 404s, second succeeds: one failure must not abort a
        // valid batch.
        let forwarder = Arc::new(MockForwarder::with_responses(vec![
            response(StatusCode::NOT_FOUND, br#"{}"#),
            response(StatusCode::OK, br#"{}"#),
        ]));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                &live_token(),
                &body_for("group", &["missing", "good"]),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(forwarder.calls(), 2);
        let body = json_body(response).await;
        assert_eq!(body["deleted"], 1);
        assert_eq!(body["results"][0]["ok"], false);
        assert_eq!(body["results"][0]["code"], "not_found");
        assert_eq!(body["results"][1]["ok"], true);
    }

    #[tokio::test]
    async fn mid_loop_session_expiry_aborts() {
        // First id 401s: stop, only one upstream call.
        let forwarder = Arc::new(MockForwarder::with_response(response(
            StatusCode::UNAUTHORIZED,
            br#"{"error":"SessionExpired"}"#,
        )));

        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                &live_token(),
                &body_for("person", &["a", "b", "c"]),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(forwarder.calls(), 1);
        let body = json_body(response).await;
        assert_eq!(body["deleted"], 0);
        assert_eq!(body["aborted"], true);
        assert_eq!(body["results"][0]["code"], "session_expired");
        assert_eq!(body["results"].as_array().expect("results").len(), 1);
    }

    #[tokio::test]
    async fn ids_are_percent_encoded() {
        let forwarder = Arc::new(MockForwarder::with_response(response(
            StatusCode::OK,
            br#"{}"#,
        )));
        router(Arc::clone(&forwarder))
            .oneshot(request(&live_token(), &body_for("person", &["a b/c"])))
            .await
            .expect("router call");
        let forwarded = forwarder.last_request().expect("forwarded request");
        assert_eq!(forwarded.path_and_query, "/v1/person/a%20b%2Fc");
    }

    #[tokio::test]
    async fn readonly_token_short_circuits_to_reauth_required() {
        let forwarder = Arc::new(MockForwarder::default());
        let response = router(Arc::clone(&forwarder))
            .oneshot(request(&readonly_token(), &body_for("person", &["a"])))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(forwarder.calls(), 0);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "reauth_required");
    }

    #[tokio::test]
    async fn missing_cookie_is_401() {
        let forwarder = Arc::new(MockForwarder::default());
        let response = router(Arc::clone(&forwarder))
            .oneshot(request("", &body_for("person", &["a"])))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn empty_ids_rejected() {
        let forwarder = Arc::new(MockForwarder::default());
        let response = router(Arc::clone(&forwarder))
            .oneshot(request(&live_token(), &body_for("person", &[])))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn oversized_batch_rejected() {
        let forwarder = Arc::new(MockForwarder::default());
        let ids: Vec<String> = (0..=MAX_BULK_IDS).map(|i| format!("n{i}")).collect();
        let payload = format!(
            r#"{{"kind":"person","ids":{}}}"#,
            serde_json::to_string(&ids).expect("ids")
        );
        let response = router(Arc::clone(&forwarder))
            .oneshot(request(&live_token(), &payload))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(forwarder.calls(), 0);
    }

    #[tokio::test]
    async fn unknown_kind_rejected_without_upstream_call() {
        let forwarder = Arc::new(MockForwarder::default());
        let response = router(Arc::clone(&forwarder))
            .oneshot(request(
                &live_token(),
                r#"{"kind":"sync_account","ids":["x"]}"#,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(forwarder.calls(), 0);
    }
}
