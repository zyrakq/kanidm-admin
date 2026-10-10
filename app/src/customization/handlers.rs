// app/src/customization/handlers.rs
//
// Customization HTTP surface. Registered before the SPA fallback so the
// routes behave identically in disk and embedded serving modes.
//
//   GET    /api/customization               — manifest (slots + theme section)
//   PUT    /api/customization/{slot}        — image slot upload (field `file`)
//   DELETE /api/customization/{slot}        — remove image override
//   POST   /api/customization/themes/{mode}       — theme variant upload (field `file`)
//   PUT    /api/customization/theme/{mode}  — set/clear the stored selection
//   DELETE /api/customization/themes/{mode}/{name} — remove a theme variant
//   GET    /customization/{slot}            — serve an image override
//   GET    /customization/theme-light|dark[.css] — serve the effective
//            variant CSS; `/* custom styles */` placeholder when none
//
// Unset theme modes serve a `/* custom styles */` placeholder instead
// of 404: theme-override-loader.ts appends the override <link> elements
// on every page load and they must never fail (or log console errors).
// Image slots keep the 404.
//
// Caveat (accepted in the design): endpoints are unauthenticated until
// the real Kanidm OIDC integration lands.

use std::sync::Arc;

use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::customization::store::{self, CustomizationStore, Slot, SlotEntry, StoreError, ThemeMode};

pub type CustomizationState = Arc<CustomizationStore>;

/// Body served for unset theme modes — upstream Kanidm's `override.css`
/// convention. Keeps the cascade order stable and the console clean.
const CSS_PLACEHOLDER: &str = "/* custom styles */";

/// Self-contained customization router (state applied inside) so
/// `routes::build` can merge it regardless of its own state type.
pub fn router(store: CustomizationState) -> Router {
    Router::new()
        .route("/api/customization", get(manifest_handler))
        .route(
            "/api/customization/{slot}",
            put(upload_handler).delete(delete_handler),
        )
        .route(
            "/api/customization/themes/{mode}",
            post(upload_variant_handler),
        )
        .route(
            "/api/customization/themes/{mode}/{name}",
            delete(delete_variant_handler),
        )
        .route("/api/customization/theme/{mode}", put(select_variant_handler))
        .route("/customization/{slot}", get(serve_handler))
        .with_state(store)
}

/// API error following the backend JSON convention
/// `{ "error": { "code", "message" } }` consumed by `http-client.ts`.
struct CustomizationApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl CustomizationApiError {
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
            message: "Unknown customization slot.".to_string(),
        }
    }
}

impl IntoResponse for CustomizationApiError {
    fn into_response(self) -> Response {
        let body = serde_json::json!({
            "error": { "code": self.code, "message": self.message }
        });
        (self.status, Json(body)).into_response()
    }
}

impl From<StoreError> for CustomizationApiError {
    fn from(e: StoreError) -> Self {
        match e {
            StoreError::InvalidType { content_type, allowed } => Self::bad_request(format!(
                "Unsupported content type '{content_type}'. Allowed: {}.",
                allowed.join(", ")
            )),
            StoreError::TooLarge { size, limit } => Self::bad_request(format!(
                "Upload is {size} bytes; the limit is {limit} bytes."
            )),
            StoreError::InvalidName { name, reason } => Self::bad_request(format!(
                "Invalid theme variant name '{name}' ({reason}). Use a file name like 'corporate.css'."
            )),
            StoreError::AlreadyExists { name } => Self::bad_request(format!(
                "A theme variant named '{name}' already exists (delete it first)."
            )),
            StoreError::UnknownVariant { name } => Self {
                status: StatusCode::NOT_FOUND,
                code: "not_found",
                message: format!("Unknown theme variant '{name}'."),
            },
            StoreError::Io(e) => {
                tracing::error!("customization storage failure: {e}");
                Self {
                    status: StatusCode::INTERNAL_SERVER_ERROR,
                    code: "kanidm_error",
                    message: "Customization storage is unavailable.".to_string(),
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
struct ThemeModeInfoDto {
    available: Vec<String>,
    selected: Option<String>,
    config_selected: Option<String>,
    source: String,
}

#[derive(Serialize)]
struct ThemeManifestDto {
    light: ThemeModeInfoDto,
    dark: ThemeModeInfoDto,
}

#[derive(Serialize)]
struct ManifestDto {
    version: String,
    slots: std::collections::BTreeMap<String, SlotEntryDto>,
    theme: ThemeManifestDto,
}

fn theme_mode_info_dto(info: &store::ThemeModeInfo) -> ThemeModeInfoDto {
    ThemeModeInfoDto {
        available: info.available.clone(),
        selected: info.selected.clone(),
        config_selected: info.config_selected.clone(),
        source: info.source.to_string(),
    }
}

async fn manifest_handler(State(store): State<CustomizationState>) -> Json<ManifestDto> {
    let m = store.manifest();
    Json(ManifestDto {
        version: m.version,
        slots: m
            .slots
            .into_iter()
            .map(|(name, e)| (name, e.into()))
            .collect(),
        theme: ThemeManifestDto {
            light: theme_mode_info_dto(&m.theme.light),
            dark: theme_mode_info_dto(&m.theme.dark),
        },
    })
}

async fn upload_handler(
    State(store): State<CustomizationState>,
    Path(slot): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<SlotEntryDto>, CustomizationApiError> {
    let slot = Slot::parse(&slot).ok_or_else(CustomizationApiError::not_found)?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| CustomizationApiError::bad_request("Malformed multipart body."))?
    {
        if field.name() == Some("file") {
            let content_type = field
                .content_type()
                .map(str::to_string)
                .unwrap_or_default();
            let data = field
                .bytes()
                .await
                .map_err(|_| CustomizationApiError::bad_request("Upload body could not be read."))?;
            let entry = store.store(slot, &content_type, &data)?;
            return Ok(Json(entry.into()));
        }
    }

    Err(CustomizationApiError::bad_request(
        "Multipart field 'file' is required.",
    ))
}

async fn delete_handler(
    State(store): State<CustomizationState>,
    Path(slot): Path<String>,
) -> Result<StatusCode, CustomizationApiError> {
    let slot = Slot::parse(&slot).ok_or_else(CustomizationApiError::not_found)?;
    store.remove(slot)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
struct VariantNameDto {
    name: String,
}

async fn upload_variant_handler(
    State(store): State<CustomizationState>,
    Path(mode): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<VariantNameDto>, CustomizationApiError> {
    let mode = ThemeMode::parse(&mode).ok_or_else(CustomizationApiError::not_found)?;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| CustomizationApiError::bad_request("Malformed multipart body."))?
    {
        if field.name() == Some("file") {
            let content_type = field
                .content_type()
                .map(str::to_string)
                .unwrap_or_default();
            let file_name = field.file_name().unwrap_or_default().to_string();
            let data = field
                .bytes()
                .await
                .map_err(|_| CustomizationApiError::bad_request("Upload body could not be read."))?;
            if file_name.is_empty() {
                return Err(CustomizationApiError::bad_request(
                    "Multipart field 'file' must carry a file name ending in '.css'.",
                ));
            }
            let name = store.store_variant(mode, &file_name, &content_type, &data)?;
            return Ok(Json(VariantNameDto { name }));
        }
    }

    Err(CustomizationApiError::bad_request(
        "Multipart field 'file' is required.",
    ))
}

#[derive(Deserialize)]
struct SelectBody {
    name: Option<String>,
}

async fn select_variant_handler(
    State(store): State<CustomizationState>,
    Path(mode): Path<String>,
    Json(body): Json<SelectBody>,
) -> Result<StatusCode, CustomizationApiError> {
    let mode = ThemeMode::parse(&mode).ok_or_else(CustomizationApiError::not_found)?;
    // Selecting a variant that is not on disk is a request-body
    // validation error (400), unlike deleting one (404).
    store.select_variant(mode, body.name).map_err(|e| match e {
        StoreError::UnknownVariant { name } => {
            CustomizationApiError::bad_request(format!("Unknown theme variant '{name}'."))
        }
        other => other.into(),
    })?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_variant_handler(
    State(store): State<CustomizationState>,
    Path((mode, name)): Path<(String, String)>,
) -> Result<StatusCode, CustomizationApiError> {
    let mode = ThemeMode::parse(&mode).ok_or_else(CustomizationApiError::not_found)?;
    store.remove_variant(mode, &name)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn serve_handler(
    State(store): State<CustomizationState>,
    Path(slot_name): Path<String>,
) -> Result<Response, CustomizationApiError> {
    // theme-override-loader.ts requests stylesheets with a .css suffix
    // (/customization/theme-light.css?v=…); strip it before parsing.
    let base = slot_name.strip_suffix(".css").unwrap_or(&slot_name);

    // Theme modes resolve to the effective variant; unset modes serve
    // the placeholder instead of a 404 (see module docs).
    let mode = match base {
        "theme-light" => Some(ThemeMode::Light),
        "theme-dark" => Some(ThemeMode::Dark),
        _ => None,
    };
    if let Some(mode) = mode {
        return match store.read_variant(mode)? {
            Some((content_type, bytes)) => Ok((
                [
                    (header::CONTENT_TYPE, content_type),
                    (header::CACHE_CONTROL, "no-cache".to_string()),
                ],
                bytes,
            )
                .into_response()),
            None => Ok((
                [
                    (header::CONTENT_TYPE, "text/css".to_string()),
                    (header::CACHE_CONTROL, "no-cache".to_string()),
                ],
                CSS_PLACEHOLDER.to_string(),
            )
                .into_response()),
        };
    }

    // Image slots keep the 404 behavior when unset.
    let slot = Slot::parse(base).ok_or_else(CustomizationApiError::not_found)?;
    let Some((content_type, bytes)) = store.read(slot)? else {
        return Err(CustomizationApiError {
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
        app_with_config("", "")
    }

    fn app_with_config(light: &str, dark: &str) -> (Router, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = Arc::new(CustomizationStore::new(
            dir.path().to_path_buf(),
            1024,
            light.to_string(),
            dark.to_string(),
        ));
        (router(store), dir)
    }

    /// Build a minimal multipart body for one `file` field (image slots).
    fn multipart_body(content_type: &str, payload: &[u8]) -> (String, Body) {
        variant_multipart_body("override", content_type, payload)
    }

    /// Multipart body carrying a file name (theme variants).
    fn variant_multipart_body(file_name: &str, content_type: &str, payload: &[u8]) -> (String, Body) {
        let boundary = "customizationboundary";
        let body = format!(
            "--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fn}\"\r\n\
             Content-Type: {ct}\r\n\r\n{payload}\r\n--{b}--\r\n",
            b = boundary,
            fn = file_name,
            ct = content_type,
            payload = String::from_utf8_lossy(payload),
        );
        let headers = format!("Content-Type: multipart/form-data; boundary={boundary}\r\n");
        (headers, Body::from(body))
    }

    fn req(method: &str, uri: &str) -> axum::http::Request<Body> {
        axum::http::Request::builder()
            .method(method)
            .uri(uri)
            .body(Body::empty())
            .unwrap()
    }

    async fn send_multipart(
        app: Router,
        method: &str,
        uri: &str,
        file_name: &str,
        content_type: &str,
        payload: &[u8],
    ) -> axum::http::Response<axum::body::Body> {
        let (headers, body) = variant_multipart_body(file_name, content_type, payload);
        app.oneshot(
            axum::http::Request::builder()
                .method(method)
                .uri(uri)
                .header(
                    "content-type",
                    headers.trim_start_matches("Content-Type: ").trim_end(),
                )
                .body(body)
                .unwrap(),
        )
        .await
        .unwrap()
    }

    async fn put_json(app: Router, uri: &str, body: &str) -> axum::http::Response<axum::body::Body> {
        app.oneshot(
            axum::http::Request::builder()
                .method("PUT")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
    }

    async fn body_string(res: axum::http::Response<axum::body::Body>) -> String {
        String::from_utf8(res.into_body().collect().await.unwrap().to_bytes().to_vec()).unwrap()
    }

    #[tokio::test]
    async fn manifest_starts_empty() {
        let (app, _dir) = app();
        let res = app.oneshot(req("GET", "/api/customization")).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["version"], "0");
        for name in ["logo-light", "logo-dark", "favicon-light", "favicon-dark"] {
            assert_eq!(json["slots"][name]["present"], false, "slot {name} absent");
        }
        assert_eq!(json["theme"]["light"]["available"], serde_json::json!([]));
        assert_eq!(json["theme"]["light"]["source"], "builtin");
        assert_eq!(json["theme"]["dark"]["selected"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn image_slot_roundtrip_unchanged() {
        let (app, _dir) = app();
        let res = send_multipart(
            app.clone(),
            "PUT",
            "/api/customization/logo-light",
            "override",
            "image/svg+xml",
            b"<svg><script>x</script></svg>",
        )
        .await;
        assert_eq!(res.status(), StatusCode::OK);
        // Serve returns sanitized SVG with no-cache; delete → 404.
        let res = app.clone().oneshot(req("GET", "/customization/logo-light")).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers()["cache-control"], "no-cache");
        assert!(!body_string(res).await.contains("script"));
        let res = app.clone().oneshot(req("DELETE", "/api/customization/logo-light")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app.oneshot(req("GET", "/customization/logo-light")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn theme_serves_placeholder_when_unset() {
        let (app, _dir) = app();
        for uri in ["/customization/theme-light", "/customization/theme-dark.css"] {
            let res = app.clone().oneshot(req("GET", uri)).await.unwrap();
            assert_eq!(res.status(), StatusCode::OK, "{uri}");
            assert_eq!(res.headers()["content-type"], "text/css");
            assert_eq!(body_string(res).await, "/* custom styles */");
        }
        let res = app.oneshot(req("GET", "/customization/logo-light")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn variant_upload_select_serve_delete() {
        let (app, _dir) = app();
        // Upload (name is sanitized from the multipart filename).
        let res = send_multipart(
            app.clone(),
            "POST",
            "/api/customization/themes/light",
            "Corporate.CSS",
            "text/css; charset=utf-8",
            b":root { --x: 1; }",
        )
        .await;
        assert_eq!(res.status(), StatusCode::OK);
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["name"], "corporate.css");

        // Select for light mode.
        let res = put_json(app.clone(), "/api/customization/theme/light", r#"{"name":"corporate.css"}"#).await;
        assert_eq!(res.status(), StatusCode::NO_CONTENT);

        // Manifest reports the selection.
        let res = app.clone().oneshot(req("GET", "/api/customization")).await.unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["theme"]["light"]["available"], serde_json::json!(["corporate.css"]));
        assert_eq!(json["theme"]["light"]["source"], "selection");
        assert_eq!(json["theme"]["light"]["selected"], "corporate.css");

        // Serve the effective variant (with and without .css suffix).
        for uri in ["/customization/theme-light", "/customization/theme-light.css?v=1"] {
            let res = app.clone().oneshot(req("GET", uri)).await.unwrap();
            assert_eq!(res.status(), StatusCode::OK, "{uri}");
            assert_eq!(res.headers()["content-type"], "text/css");
            assert_eq!(res.headers()["cache-control"], "no-cache");
            assert_eq!(body_string(res).await, ":root { --x: 1; }", "CSS stored verbatim");
        }

        // Clear → placeholder again.
        let res = put_json(app.clone(), "/api/customization/theme/light", r#"{"name":null}"#).await;
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app.clone().oneshot(req("GET", "/customization/theme-light")).await.unwrap();
        assert_eq!(body_string(res).await, "/* custom styles */");

        // Delete the variant; deleting again is a 404.
        let res = app.clone().oneshot(req("DELETE", "/api/customization/themes/light/corporate.css")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app.oneshot(req("DELETE", "/api/customization/themes/light/corporate.css")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn variant_upload_invalid_type_and_name_are_400() {
        let (app, _dir) = app();
        let res = send_multipart(app.clone(), "POST", "/api/customization/themes/light", "x.css", "image/png", b"png").await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        assert!(body_string(res).await.contains("Allowed: text/css."));
        let res = send_multipart(app.clone(), "POST", "/api/customization/themes/light", "bad name!.css", "text/css", b":root{}").await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        assert!(body_string(res).await.contains("Invalid theme variant name"));
        let res = send_multipart(app, "POST", "/api/customization/themes/light", "", "text/css", b":root{}").await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        assert!(body_string(res).await.contains("file name"));
    }

    #[tokio::test]
    async fn select_unknown_name_is_400_and_unknown_mode_is_404() {
        let (app, _dir) = app();
        let res = put_json(app.clone(), "/api/customization/theme/light", r#"{"name":"nope.css"}"#).await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let res = put_json(app, "/api/customization/theme/mode", r#"{"name":null}"#).await;
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn deleting_selected_variant_clears_selection() {
        let (app, _dir) = app();
        let _ = send_multipart(app.clone(), "POST", "/api/customization/themes/light", "a.css", "text/css", b":root{}").await;
        let _ = put_json(app.clone(), "/api/customization/theme/light", r#"{"name":"a.css"}"#).await;
        let res = app.clone().oneshot(req("DELETE", "/api/customization/themes/light/a.css")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app.oneshot(req("GET", "/api/customization")).await.unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["theme"]["light"]["selected"], serde_json::Value::Null);
        assert_eq!(json["theme"]["light"]["source"], "builtin");
    }

    #[tokio::test]
    async fn config_default_resolves_without_selection() {
        let (app, _dir) = app_with_config("corp.css", "");
        let _ = send_multipart(app.clone(), "POST", "/api/customization/themes/light", "corp.css", "text/css", b":root{}").await;
        let res = app.clone().oneshot(req("GET", "/customization/theme-light")).await.unwrap();
        assert_eq!(body_string(res).await, ":root{}");
        let res = app.oneshot(req("GET", "/api/customization")).await.unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["theme"]["light"]["source"], "config");
        assert_eq!(json["theme"]["light"]["config_selected"], "corp.css");
    }

    #[tokio::test]
    async fn unknown_slot_is_404() {
        let (app, _dir) = app();
        let (_headers, body) = multipart_body("image/png", b"x");
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/api/customization/nope")
                    .header("content-type", "multipart/form-data; boundary=customizationboundary")
                    .body(body)
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "PUT /api/customization/nope");
        // Theme slots no longer accept slot uploads either.
        let (_headers, body) = multipart_body("text/css", b":root{}");
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/api/customization/theme-light")
                    .header("content-type", "multipart/form-data; boundary=customizationboundary")
                    .body(body)
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "PUT /api/customization/theme-light");
        let res = app.oneshot(req("GET", "/customization/nope")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "GET /customization/nope");
    }

    #[tokio::test]
    async fn oversized_upload_is_400() {
        let (app, _dir) = app();
        let res = send_multipart(app, "PUT", "/api/customization/logo-dark", "override", "image/png", &[b'x'; 2048]).await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn variant_folders_are_separate_namespaces() {
        let (app, _dir) = app();
        let _ = send_multipart(app.clone(), "POST", "/api/customization/themes/light", "a.css", "text/css", b":root{}").await;
        let _ = send_multipart(app.clone(), "POST", "/api/customization/themes/dark", "a.css", "text/css", b":root{--d:1}").await;
        let res = app.clone().oneshot(req("GET", "/api/customization")).await.unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["theme"]["light"]["available"], serde_json::json!(["a.css"]));
        assert_eq!(json["theme"]["dark"]["available"], serde_json::json!(["a.css"]));
        // Deleting the light copy leaves the dark copy intact.
        let res = app.clone().oneshot(req("DELETE", "/api/customization/themes/light/a.css")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
        let res = app.oneshot(req("GET", "/api/customization")).await.unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(json["theme"]["light"]["available"], serde_json::json!([]));
        assert_eq!(json["theme"]["dark"]["available"], serde_json::json!(["a.css"]));
    }

    #[tokio::test]
    async fn unknown_variant_mode_is_404() {
        let (app, _dir) = app();
        let res = send_multipart(app.clone(), "POST", "/api/customization/themes/mode", "a.css", "text/css", b":root{}").await;
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        let res = app.oneshot(req("DELETE", "/api/customization/themes/mode/a.css")).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}
