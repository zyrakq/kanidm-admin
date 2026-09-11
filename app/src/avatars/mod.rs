// app/src/avatars/mod.rs
//
// Local person avatar storage: kanidm (vendored 1.12.0-dev) has no
// person image attribute or endpoint, so avatars live on our backend's
// disk and are served from /api/avatar/{id}. See design 2026-09-11.
//
// Wire contract:
//   GET    /api/avatar/{id}  any valid session   bytes + content-type
//   POST   /api/avatar/{id}  idm_people_admins   multipart field "image"
//   DELETE /api/avatar/{id}  idm_people_admins   204 / 404

pub mod store;

pub use store::{store_from_settings, AvatarStore, FsAvatarStore, StoredAvatar};

use axum::extract::{
    multipart::MultipartRejection, DefaultBodyLimit, Multipart, Path, State,
};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use time::OffsetDateTime;

use crate::auth::error::{map_auth_error, ApiError, ApiErrorCode};
use crate::auth::handlers::{cookie_token, expired_response};
use crate::auth::known_groups::resolve_groups;
use crate::auth::token::{decode_user_auth_token, is_active};
use crate::auth::AppState;

/// Multipart field name carrying the image (oauth2 upload pattern).
const FIELD_NAME: &str = "image";
/// Browser cache window; the frontend cache-busts with `?v=N` after
/// every mutation, so a long TTL is safe.
const CACHE_CONTROL: &str = "private, max-age=86400";
/// Group allowed to write avatars (people administration).
const WRITE_GROUP: &str = "idm_people_admins";
/// Multipart overhead headroom on top of the raw image limit
/// (boundaries + headers); oversize bodies are rejected by the layer
/// with axum's default 413 before the handler runs.
const BODY_LIMIT: usize = store::MAX_AVATAR_BYTES + 64 * 1024;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/avatar/{id}",
            get(get_avatar).post(post_avatar).delete(delete_avatar),
        )
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
}

/// Map a store error onto the API error envelope. Disk failures use
/// `kanidm_error` (the established 500 code — the envelope has no
/// generic internal-error code).
fn store_error(error: store::AvatarStoreError) -> ApiError {
    match error {
        store::AvatarStoreError::InvalidId => {
            ApiError::validation_error("Invalid avatar id.")
        }
        store::AvatarStoreError::UnsupportedType(_) => {
            ApiError::validation_error("Avatar must be a JPEG, PNG, GIF or WebP image.")
        }
        store::AvatarStoreError::Io(_) => {
            ApiError::new(ApiErrorCode::KanidmError, "Avatar storage failed.")
        }
    }
}

fn not_found_avatar() -> Response {
    ApiError::new(ApiErrorCode::NotFound, "Avatar not found.").into_response()
}

/// Decode + activity-check the session cookie (LOCAL decode only, no
/// Kanidm roundtrip); returns the token string on success, which the
/// write handlers reuse for the whoami gating roundtrip.
fn session_token(headers: &HeaderMap) -> Result<&str, Response> {
    let Some(token) = cookie_token(headers) else {
        return Err(ApiError::session_expired().into_response());
    };
    let Ok(uat) = decode_user_auth_token(token) else {
        return Err(ApiError::session_expired().into_response());
    };
    if !is_active(&uat, OffsetDateTime::now_utc()) {
        return Err(expired_response());
    }
    Ok(token)
}

/// Write gating: valid session AND idm_people_admins membership
/// (whoami roundtrip + known_groups resolution — the profile pattern).
async fn require_people_admin(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(), Response> {
    let token = session_token(headers)?;
    let entry = match state.auth.whoami_entry(token).await {
        Ok(Some(entry)) => entry,
        // Kanidm rejected the session server-side.
        Ok(None) => return Err(expired_response()),
        Err(error) => return Err(map_auth_error(error).into_response()),
    };
    let memberof = entry.attrs.get("memberof").cloned().unwrap_or_default();
    let admin = resolve_groups(&memberof)
        .iter()
        .any(|group| group.name.as_deref() == Some(WRITE_GROUP));
    if admin {
        Ok(())
    } else {
        Err(ApiError::new(
            ApiErrorCode::AccessDenied,
            "Avatar writes require the idm_people_admins group.",
        )
        .into_response())
    }
}

/// GET /api/avatar/{id} — serve the stored bytes with the content type
/// recorded at upload time.
pub async fn get_avatar(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(error) = session_token(&headers) {
        return error;
    }
    match state.avatars.get(&id).await {
        Ok(Some(avatar)) => Response::builder()
            .header(header::CONTENT_TYPE, avatar.content_type)
            .header(header::CACHE_CONTROL, CACHE_CONTROL)
            .body(axum::body::Body::from(avatar.bytes))
            .unwrap(),
        Ok(None) => not_found_avatar(),
        Err(error) => store_error(error).into_response(),
    }
}

/// POST /api/avatar/{id} — multipart upload (field "image"); writes
/// require idm_people_admins. Gating runs BEFORE the body is parsed.
pub async fn post_avatar(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    multipart: Result<Multipart, MultipartRejection>,
) -> Response {
    if let Err(error) = require_people_admin(&state, &headers).await {
        return error;
    }
    let mut multipart = match multipart {
        Ok(multipart) => multipart,
        Err(_) => {
            return ApiError::validation_error(
                "Request body must be multipart with an image field.",
            )
            .into_response()
        }
    };

    let mut avatar: Option<StoredAvatar> = None;
    loop {
        let field = match multipart.next_field().await {
            Ok(Some(field)) => field,
            Ok(None) => break,
            Err(_) => {
                return ApiError::validation_error("Malformed multipart body.").into_response()
            }
        };
        if field.name() != Some(FIELD_NAME) {
            continue; // ignore unrelated parts
        }
        let content_type = field.content_type().unwrap_or("").to_string();
        if !store::ALLOWED_TYPES
            .iter()
            .any(|(known, _)| *known == content_type)
        {
            return ApiError::validation_error(
                "Avatar must be a JPEG, PNG, GIF or WebP image.",
            )
            .into_response();
        }
        let bytes = match field.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => {
                return ApiError::validation_error("Malformed multipart body.").into_response()
            }
        };
        if bytes.len() > store::MAX_AVATAR_BYTES {
            return ApiError::validation_error("Avatar must be at most 2 MB.").into_response();
        }
        avatar = Some(StoredAvatar {
            bytes: bytes.to_vec(),
            content_type,
        });
        break;
    }

    let Some(avatar) = avatar else {
        return ApiError::validation_error(
            "Multipart body must contain an image field.",
        )
        .into_response();
    };

    match state.avatars.save(&id, avatar).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => store_error(error).into_response(),
    }
}

/// DELETE /api/avatar/{id} — same gating as POST; 404 when absent.
pub async fn delete_avatar(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(error) = require_people_admin(&state, &headers).await {
        return error;
    }
    match state.avatars.delete(&id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => not_found_avatar(),
        Err(error) => store_error(error).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Tests (mock-based, no live Kanidm, no disk)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::ops::test_support::{MockAuthOps, MockWhoami};
    use crate::auth::token::test_support::fixture_token;
    use crate::avatars::store::test_support::MemoryAvatarStore;
    use crate::proxy::forwarder::test_support::MockForwarder;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use kanidm_proto::internal::UatPurpose;
    use kanidm_proto::v1::Entry;
    use std::collections::BTreeMap;
    use std::sync::{Arc, Mutex};
    use time::Duration;
    use time::OffsetDateTime;
    use tower::ServiceExt;

    const PNG_BYTES: &[u8] = &[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
    const PEOPLE_ADMINS_UUID: &str = "00000000-0000-0000-0000-000000000013";

    fn valid_token() -> String {
        fixture_token(
            "idm_admin@example.com",
            Some(OffsetDateTime::now_utc() + Duration::hours(1)),
            UatPurpose::ReadOnly,
        )
    }

    fn admin_mock() -> MockAuthOps {
        MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Entry(Entry {
                attrs: BTreeMap::from([(
                    "memberof".to_string(),
                    vec![PEOPLE_ADMINS_UUID.to_string()],
                )]),
            }))),
            ..Default::default()
        }
    }

    fn non_admin_mock() -> MockAuthOps {
        MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Entry(Entry {
                attrs: BTreeMap::new(),
            }))),
            ..Default::default()
        }
    }

    fn router_with(mock: MockAuthOps, store: MemoryAvatarStore) -> Router {
        routes().with_state(AppState::new(
            Arc::new(mock),
            Arc::new(MockForwarder::default()),
            Arc::new(store),
        ))
    }

    fn get_with_cookie(uri: &str, cookie: &str) -> Request<Body> {
        Request::builder()
            .uri(uri)
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("build request")
    }

    fn delete_with_cookie(uri: &str, cookie: &str) -> Request<Body> {
        Request::builder()
            .method("DELETE")
            .uri(uri)
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("build request")
    }

    /// Hand-rolled multipart body with one part. The `field` parameter
    /// lets the missing-field test send a differently-named part.
    fn post_multipart(
        uri: &str,
        token: &str,
        field: &str,
        content_type: &str,
        data: &[u8],
    ) -> Request<Body> {
        let boundary = "testboundary";
        let mut body: Vec<u8> = Vec::new();
        body.extend_from_slice(
            format!(
                "--{boundary}\r\ncontent-disposition: form-data; name=\"{field}\"; filename=\"avatar\"\r\ncontent-type: {content_type}\r\n\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(data);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("cookie", format!("kadmin_session={token}"))
            .header(
                "content-type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(body))
            .expect("build request")
    }

    async fn json_body(response: Response) -> serde_json::Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        serde_json::from_slice(&bytes).expect("parse json body")
    }

    #[tokio::test]
    async fn get_without_cookie_returns_401() {
        let response = router_with(MockAuthOps::default(), MemoryAvatarStore::default())
            .oneshot(get_with_cookie("/api/avatar/jdoe", "theme=dark"))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn get_missing_avatar_returns_404() {
        let token = valid_token();
        let response = router_with(MockAuthOps::default(), MemoryAvatarStore::default())
            .oneshot(get_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "not_found");
    }

    #[tokio::test]
    async fn get_serves_stored_bytes_with_cache_headers() {
        let token = valid_token();
        let store = MemoryAvatarStore::default();
        store
            .save(
                "jdoe",
                StoredAvatar {
                    bytes: PNG_BYTES.to_vec(),
                    content_type: "image/png".to_string(),
                },
            )
            .await
            .expect("seed store");

        let response = router_with(MockAuthOps::default(), store)
            .oneshot(get_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
        assert_eq!(
            response.headers().get(header::CACHE_CONTROL).unwrap(),
            "private, max-age=86400"
        );
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        assert_eq!(&bytes[..], PNG_BYTES);
    }

    #[tokio::test]
    async fn get_invalid_id_returns_validation_error() {
        // ":" is URI-safe in a path segment but outside the avatar id
        // charset — no percent-decoding ambiguity in the test.
        let token = valid_token();
        let response = router_with(MockAuthOps::default(), MemoryAvatarStore::default())
            .oneshot(get_with_cookie(
                "/api/avatar/a:b",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "validation_error");
    }

    #[tokio::test]
    async fn post_admin_upload_is_readable_back() {
        let token = valid_token();
        let store = MemoryAvatarStore::default();
        // Router is Clone (Arc state) — reuse it to prove the write landed.
        let router = router_with(admin_mock(), store);

        let response = router
            .clone()
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "image",
                "image/png",
                PNG_BYTES,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = router
            .oneshot(get_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn post_non_admin_returns_403() {
        let token = valid_token();
        let response = router_with(non_admin_mock(), MemoryAvatarStore::default())
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "image",
                "image/png",
                PNG_BYTES,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "access_denied");
    }

    #[tokio::test]
    async fn post_without_cookie_returns_401() {
        let request = Request::builder()
            .method("POST")
            .uri("/api/avatar/jdoe")
            .body(Body::empty())
            .expect("build request");
        let response = router_with(admin_mock(), MemoryAvatarStore::default())
            .oneshot(request)
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn post_session_rejected_upstream_returns_401() {
        // Default mock: whoami = None -> Kanidm rejected the session.
        let token = valid_token();
        let response = router_with(MockAuthOps::default(), MemoryAvatarStore::default())
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "image",
                "image/png",
                PNG_BYTES,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "session_expired");
    }

    #[tokio::test]
    async fn post_unreachable_returns_502() {
        let token = valid_token();
        let mock = MockAuthOps {
            whoami: Mutex::new(Some(MockWhoami::Unreachable)),
            ..Default::default()
        };
        let response = router_with(mock, MemoryAvatarStore::default())
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "image",
                "image/png",
                PNG_BYTES,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn post_wrong_content_type_returns_validation_error() {
        let token = valid_token();
        let response = router_with(admin_mock(), MemoryAvatarStore::default())
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "image",
                "text/plain",
                b"hello",
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = json_body(response).await;
        assert_eq!(body["error"]["code"], "validation_error");
    }

    #[tokio::test]
    async fn post_missing_image_field_returns_validation_error() {
        let token = valid_token();
        let response = router_with(admin_mock(), MemoryAvatarStore::default())
            .oneshot(post_multipart(
                "/api/avatar/jdoe",
                &token,
                "other",
                "image/png",
                PNG_BYTES,
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn delete_admin_removes_avatar() {
        let token = valid_token();
        let store = MemoryAvatarStore::default();
        store
            .save(
                "jdoe",
                StoredAvatar {
                    bytes: PNG_BYTES.to_vec(),
                    content_type: "image/png".to_string(),
                },
            )
            .await
            .expect("seed store");

        let response = router_with(admin_mock(), store)
            .oneshot(delete_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn delete_missing_returns_404() {
        let token = valid_token();
        let response = router_with(admin_mock(), MemoryAvatarStore::default())
            .oneshot(delete_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn delete_non_admin_returns_403() {
        let token = valid_token();
        let response = router_with(non_admin_mock(), MemoryAvatarStore::default())
            .oneshot(delete_with_cookie(
                "/api/avatar/jdoe",
                &format!("kadmin_session={token}"),
            ))
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}
