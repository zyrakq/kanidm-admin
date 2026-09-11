// app/src/auth/profile.rs
//
// GET /api/auth/profile — the signed-in user plus their Kanidm groups.
// The user projection comes from the local token decode (identical to
// /api/auth/session); the groups come from a whoami roundtrip, with
// memberof UUIDs resolved through the builtin known_groups table.

use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use time::OffsetDateTime;

use super::cookie::build_clear_cookie;
use super::error::{map_auth_error, ApiError};
use super::handlers::{cookie_token, session_user};
use super::known_groups::{resolve_groups, ProfileGroup};
use super::token::{decode_user_auth_token, is_active, session_view};
use super::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/auth/profile", get(profile))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResponse {
    pub user: super::handlers::SessionUser,
    pub groups: Vec<ProfileGroup>,
}

pub async fn profile(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(token) = cookie_token(&headers) else {
        return ApiError::session_expired().into_response();
    };
    let uat = match decode_user_auth_token(token) {
        Ok(uat) => uat,
        Err(_) => return ApiError::session_expired().into_response(),
    };
    if !is_active(&uat, OffsetDateTime::now_utc()) {
        return expired_profile_response();
    }

    let entry = match state.auth.whoami_entry(token).await {
        Ok(Some(entry)) => entry,
        // Kanidm rejected the session server-side.
        Ok(None) => return expired_profile_response(),
        Err(error) => return map_auth_error(error).into_response(),
    };

    let memberof = entry.attrs.get("memberof").cloned().unwrap_or_default();
    let view = session_view(&uat);
    (
        StatusCode::OK,
        Json(ProfileResponse {
            user: session_user(&view),
            groups: resolve_groups(&memberof),
        }),
    )
        .into_response()
}

/// 401 session_expired plus a Set-Cookie clearing the stale cookie.
fn expired_profile_response() -> Response {
    let error = ApiError::session_expired();
    (
        error.code.status(),
        [(header::SET_COOKIE, build_clear_cookie())],
        Json(error.body()),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Tests (mock-based, no live Kanidm)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::ops::test_support::{MockAuthOps, MockWhoami};
    use crate::auth::token::test_support::fixture_token;
    use crate::proxy::forwarder::test_support::MockForwarder;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use kanidm_proto::internal::UatPurpose;
    use kanidm_proto::v1::Entry;
    use serde_json::json;
    use std::collections::BTreeMap;
    use std::sync::{Arc, Mutex};
    use time::{Duration, OffsetDateTime};
    use tower::ServiceExt;

    fn router_with(mock: MockAuthOps) -> Router {
        routes().with_state(AppState::new(
            Arc::new(mock),
            Arc::new(MockForwarder::default()),
            Arc::new(crate::avatars::store::test_support::MemoryAvatarStore::default()),
        ))
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

    fn get_with_cookie(uri: &str, cookie: &str) -> Request<Body> {
        Request::builder()
            .uri(uri)
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("build request")
    }

    fn valid_token() -> String {
        fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        )
    }

    #[tokio::test]
    async fn profile_resolves_builtin_uuids_to_names() {
        let token = valid_token();
        let entry = Entry {
            attrs: BTreeMap::from([(
                "memberof".to_string(),
                vec!["00000000-0000-0000-0000-000000000013".to_string()],
            )]),
        };
        let mock = MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Entry(entry))),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(get_with_cookie(
                "/api/auth/profile",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let body = json_body(response).await;
        assert_eq!(body["user"]["username"], "idm_admin@example.com");
        assert_eq!(body["groups"][0]["name"], "idm_people_admins");
        assert_eq!(
            body["groups"][0]["uuid"],
            "00000000-0000-0000-0000-000000000013"
        );
    }

    #[tokio::test]
    async fn profile_without_memberof_returns_empty_groups() {
        let token = valid_token();
        let entry = Entry {
            attrs: BTreeMap::new(),
        };
        let mock = MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Entry(entry))),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(get_with_cookie(
                "/api/auth/profile",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        let body = json_body(response).await;
        assert_eq!(body["groups"], json!([]));
    }

    #[tokio::test]
    async fn profile_without_cookie_returns_401() {
        let response = router_with(MockAuthOps::default())
            .oneshot(get_with_cookie("/api/auth/profile", "theme=dark"))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
    }

    #[tokio::test]
    async fn profile_with_unauthenticated_upstream_clears_cookie() {
        let token = valid_token();
        // Default mock: whoami = None -> Unauthenticated upstream.
        let mock = MockAuthOps::default();

        let response = router_with(mock)
            .oneshot(get_with_cookie(
                "/api/auth/profile",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let cookie = set_cookie(&response).expect("set-cookie header");
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
    }

    #[tokio::test]
    async fn profile_with_unreachable_kanidm_returns_502() {
        let token = valid_token();
        let mock = MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Unreachable)),
            ..Default::default()
        };

        let response = router_with(mock)
            .oneshot(get_with_cookie(
                "/api/auth/profile",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "kanidm_unreachable");
    }

    #[tokio::test]
    async fn profile_with_expired_token_returns_401() {
        let token = fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() - Duration::minutes(1)),
            UatPurpose::ReadOnly,
        );
        let mock = MockAuthOps::default();

        let response = router_with(mock)
            .oneshot(get_with_cookie(
                "/api/auth/profile",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let cookie = set_cookie(&response).expect("set-cookie header");
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
        assert!(cookie.contains("Max-Age=0"), "cookie: {cookie}");
    }
}
