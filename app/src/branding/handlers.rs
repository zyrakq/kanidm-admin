// app/src/branding/handlers.rs
//
// Branding HTTP surface. Registered before the SPA fallback so the
// routes behave identically in disk and embedded serving modes.
//
//   GET    /api/branding        — manifest (per-slot status + version)
//   PUT    /api/branding/{slot} — multipart upload (field `file`)
//   DELETE /api/branding/{slot} — remove override (back to default)
//   GET    /branding/{slot}     — serve the override file
//
// Caveat (accepted in the design): endpoints are unauthenticated until
// the real Kanidm OIDC integration lands.

use std::sync::Arc;

use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use serde::Serialize;

use crate::branding::store::{BrandingStore, Slot, SlotEntry, StoreError};

pub type BrandingState = Arc<BrandingStore>;

/// Self-contained branding router (state applied inside) so
/// `routes::build` can merge it regardless of its own state type.
pub fn router(store: BrandingState) -> Router {
    Router::new()
        .route("/api/branding", get(manifest_handler))
        .route(
            "/api/branding/{slot}",
            put(upload_handler).delete(delete_handler),
        )
        .route("/branding/{slot}", get(serve_handler))
        .with_state(store)
}

/// API error following the backend JSON convention
/// `{ "error": { "code", "message" } }` consumed by `http-client.ts`.
struct BrandingApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl BrandingApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "validation_error",
            message: message.into(),
        }
    }

    fn not_found() -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            code: "not_found",
            message: "Unknown branding slot.".to_string(),
        }
    }
}

impl IntoResponse for BrandingApiError {
    fn into_response(self) -> Response {
        let body = serde_json::json!({
            "error": { "code": self.code, "message": self.message }
        });
        (self.status, Json(body)).into_response()
    }
}

impl From<StoreError> for BrandingApiError {
    fn from(e: StoreError) -> Self {
        match e {
            StoreError::InvalidType(t) => Self::bad_request(format!(
                "Unsupported content type '{t}'. Allowed: image/svg+xml, image/png."
            )),
            StoreError::TooLarge { size, limit } => Self::bad_request(format!(
                "Upload is {size} bytes; the limit is {limit} bytes."
            )),
            StoreError::Io(e) => {
                tracing::error!("branding storage failure: {e}");
                Self {
                    status: StatusCode::INTERNAL_SERVER_ERROR,
                    code: "kanidm_error",
                    message: "Branding storage is unavailable.".to_string(),
                }
            }
        }
    }
}

#[derive(Serialize)]
struct SlotEntryDto {
    present: bool,
    content_type: Option<String>,
    updated_at: Option<i64>,
}

impl From<SlotEntry> for SlotEntryDto {
    fn from(e: SlotEntry) -> Self {
        Self {
            present: e.present,
            content_type: e.content_type,
            updated_at: e.updated_at,
        }
    }
}

#[derive(Serialize)]
struct ManifestDto {
    version: String,
    slots: std::collections::BTreeMap<String, SlotEntryDto>,
}

async fn manifest_handler(State(store): State<BrandingState>) -> Json<ManifestDto> {
    let m = store.manifest();
    Json(ManifestDto {
        version: m.version,
        slots: m
            .slots
            .into_iter()
            .map(|(name, e)| (name, e.into()))
            .collect(),
    })
}

async fn upload_handler(
    State(store): State<BrandingState>,
    Path(slot): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<SlotEntryDto>, BrandingApiError> {
    let slot = Slot::parse(&slot).ok_or_else(BrandingApiError::not_found)?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| BrandingApiError::bad_request("Malformed multipart body."))?
    {
        if field.name() == Some("file") {
            let content_type = field
                .content_type()
                .map(str::to_string)
                .unwrap_or_default();
            let data = field
                .bytes()
                .await
                .map_err(|_| BrandingApiError::bad_request("Upload body could not be read."))?;
            let entry = store.store(slot, &content_type, &data)?;
            return Ok(Json(entry.into()));
        }
    }

    Err(BrandingApiError::bad_request(
        "Multipart field 'file' is required.",
    ))
}

async fn delete_handler(
    State(store): State<BrandingState>,
    Path(slot): Path<String>,
) -> Result<StatusCode, BrandingApiError> {
    let slot = Slot::parse(&slot).ok_or_else(BrandingApiError::not_found)?;
    store.remove(slot)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn serve_handler(
    State(store): State<BrandingState>,
    Path(slot): Path<String>,
) -> Result<Response, BrandingApiError> {
    let slot = Slot::parse(&slot).ok_or_else(BrandingApiError::not_found)?;
    let Some((content_type, bytes)) = store.read(slot)? else {
        return Err(BrandingApiError {
            status: StatusCode::NOT_FOUND,
            code: "not_found",
            message: "No override for this slot.".to_string(),
        });
    };

    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (header::CACHE_CONTROL, "no-cache".to_string()),
        ],
        bytes,
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    fn app() -> (Router, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = Arc::new(BrandingStore::new(
            dir.path().to_path_buf(),
            1024,
        ));
        (router(store), dir)
    }

    /// Build a minimal multipart body for one `file` field.
    fn multipart_body(content_type: &str, payload: &[u8]) -> (String, Body) {
        let boundary = "brandingboundary";
        let body = format!(
            "--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"logo.svg\"\r\n\
             Content-Type: {ct}\r\n\r\n{payload}\r\n--{b}--\r\n",
            b = boundary,
            ct = content_type,
            payload = String::from_utf8_lossy(payload),
        );
        let headers = format!(
            "Content-Type: multipart/form-data; boundary={boundary}\r\n"
        );
        (headers, Body::from(body))
    }

    #[tokio::test]
    async fn manifest_starts_empty() {
        let (app, _dir) = app();
        let res = app
            .oneshot(axum::http::Request::builder().uri("/api/branding").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["version"], "0");
        assert_eq!(json["slots"]["logo-light"]["present"], false);
        assert_eq!(json["slots"]["favicon-dark"]["present"], false);
    }

    #[tokio::test]
    async fn upload_then_manifest_then_delete() {
        let (app, _dir) = app();
        let (headers, body) = multipart_body("image/svg+xml", b"<svg><script>x</script></svg>");

        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/api/branding/logo-light")
                    .header("content-type", headers.trim_start_matches("Content-Type: ").trim_end())
                    .body(body)
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["present"], true);
        assert_eq!(json["content_type"], "image/svg+xml");

        // Manifest now reports the slot and a non-zero version.
        let res = app
            .clone()
            .oneshot(axum::http::Request::builder().uri("/api/branding").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["slots"]["logo-light"]["present"], true);
        assert_ne!(json["version"], "0");

        // Serve returns sanitized SVG with no-cache.
        let res = app
            .clone()
            .oneshot(axum::http::Request::builder().uri("/branding/logo-light").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers()["cache-control"], "no-cache");
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        assert!(!String::from_utf8(bytes.to_vec()).unwrap().contains("script"));

        // Delete resets to default.
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("DELETE")
                    .uri("/api/branding/logo-light")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app
            .oneshot(axum::http::Request::builder().uri("/branding/logo-light").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn unknown_slot_is_404() {
        let (app, _dir) = app();
        // The PUT leg must carry a valid multipart body: the Multipart
        // extractor rejects a bare body with 400 before the handler can map
        // the unknown slot to 404. The serve route only accepts GET, so the
        // unknown slot is checked there with GET.
        let (_headers, body) = multipart_body("image/png", b"x");
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/api/branding/nope")
                    .header(
                        "content-type",
                        "multipart/form-data; boundary=brandingboundary",
                    )
                    .body(body)
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "PUT /api/branding/nope");
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/branding/nope")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "GET /branding/nope");
    }

    #[tokio::test]
    async fn oversized_upload_is_400() {
        let (app, _dir) = app();
        let (headers, body) = multipart_body("image/png", &[b'x'; 2048]);
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/api/branding/logo-dark")
                    .header("content-type", headers.trim_start_matches("Content-Type: ").trim_end())
                    .body(body)
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }
}
