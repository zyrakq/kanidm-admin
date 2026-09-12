// app/src/proxy/integration.rs
//
// Docker-gated integration tests: the real proxy + auth router against
// a real, ephemeral Kanidm container (same flow as the dev container
// mode). Each test starts its own container, logs in through the real
// login handler, and exercises the proxy pipeline end-to-end with REAL
// TLS verification via the temp CA.
//
// Ignored by default (needs Docker); run explicitly with
// `cargo test -p server -- --ignored`.

use axum::body::{Body, to_bytes};
use axum::http::{header, Request, StatusCode};
use axum::Router;
use serde_json::Value;
use testcontainers::{ContainerAsync, GenericImage};
use testcontainers::core::{CmdWaitFor, ExecCommand};
use tower::ServiceExt;

use crate::auth;
use crate::proxy;
use crate::settings::testcontainer::TestcontainerSettings;
use crate::testcontainer::{
    parse_recover_account_password, start_containers, DevCredentials, TestcontainersHandle,
    ADMIN_USERNAME, IDM_ADMIN_USERNAME,
};

/// Minimal valid 1x1 PNG (70 bytes) for the image upload roundtrip.
const TINY_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
    0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x64,
    0x60, 0xf8, 0x5f, 0x0f, 0x00, 0x02, 0x87, 0x01, 0x80, 0xeb, 0x47, 0xba, 0x92, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

/// Start a fresh Kanidm container and build the full router under test:
/// auth routes (login + profile) merged with the proxy catch-all, over
/// the production AppState built from the container's effective
/// settings (real TLS verification via the temp CA).
async fn container_router() -> (Router, TestcontainersHandle, DevCredentials) {
    // Only the kanidm container is needed here — the mail chain
    // stays disabled (these tests do not exercise it).
    let mut settings = TestcontainerSettings::default();
    settings.kanidm.enabled = true;

    let (effective, handle) = start_containers(&settings)
        .await
        .expect("container should start and provision");

    // recover-account issues a FRESH random password per call, so the
    // passwords logged during start are already stale: both built-in
    // accounts are re-recovered on the live container, exactly like
    // the testcontainer module test does.
    let container = match &handle {
        TestcontainersHandle::Containers { kanidm, .. } => &kanidm.container,
        TestcontainersHandle::Disabled => panic!("container mode must return Containers"),
    };
    let credentials = DevCredentials {
        admin_password: recover_password(container, ADMIN_USERNAME).await,
        idm_admin_password: recover_password(container, IDM_ADMIN_USERNAME).await,
    };

    let state = auth::app_state_from_settings(&effective).expect("app state from effective");
    let router = auth::handlers::routes()
        .merge(proxy::handler::routes())
        .with_state(state);
    (router, handle, credentials)
}

/// Log in through the real login handler and harvest the Set-Cookie
/// header for subsequent proxied calls.
async fn login(router: &Router, username: &str, password: &str) -> String {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"username": username, "password": password})
                        .to_string(),
                ))
                .expect("build request"),
        )
        .await
        .expect("login");
    assert_eq!(response.status(), StatusCode::OK);
    response
        .headers()
        .get(header::SET_COOKIE)
        .and_then(|v| v.to_str().ok())
        .expect("set-cookie")
        .to_string()
}

/// Issue a proxied/auth request with the session cookie attached.
fn request_with_cookie(method: &str, uri: &str, cookie: &str, body: Vec<u8>) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("cookie", cookie)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .expect("build request")
}

/// Call the router and return (status, content-type, body bytes).
async fn call(
    router: &Router,
    request: Request<Body>,
) -> (StatusCode, Option<String>, Vec<u8>) {
    let response = router
        .clone()
        .oneshot(request)
        .await
        .expect("router call");
    let status = response.status();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    (status, content_type, bytes.to_vec())
}

/// Call and parse the body as JSON.
async fn call_json(router: &Router, request: Request<Body>) -> (StatusCode, Value) {
    let (status, _, body) = call(router, request).await;
    let value = serde_json::from_slice(&body).unwrap_or_else(|error| {
        panic!("response body is not JSON ({error}): {}", String::from_utf8_lossy(&body))
    });
    (status, value)
}

/// Recover one account's password on the live container (fresh random
/// per call). recover_builtin_credentials/exec_stdout are private to
/// the testcontainer module, so the exec is replicated here via the
/// public testcontainers API and parsed with the re-exported
/// parse_recover_account_password helper.
async fn recover_password(container: &ContainerAsync<GenericImage>, username: &str) -> String {
    let command = ["/sbin/kanidmd", "scripting", "recover-account", username];
    let mut exec = container
        .exec(
            ExecCommand::new(command.to_vec())
                .with_cmd_ready_condition(CmdWaitFor::exit_code(0)),
        )
        .await
        .expect("recover-account exec");
    let stdout = exec.stdout_to_vec().await.expect("recover-account stdout");
    parse_recover_account_password(&stdout).expect("password in recover-account stdout")
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

/// idm_admin's profile groups must include idm_people_admins —
/// a transitive memberof through group nesting, resolved through the
/// builtin known_groups table.
#[tokio::test]
#[ignore = "requires a running Docker daemon"]
async fn profile_idm_admin_includes_people_admins() {
    let (router, _handle, credentials) = container_router().await;
    let cookie = login(&router, IDM_ADMIN_USERNAME, &credentials.idm_admin_password).await;

    let (status, body) = call_json(
        &router,
        request_with_cookie("GET", "/api/auth/profile", &cookie, Vec::new()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let groups = body["groups"].as_array().expect("groups array");
    let names: Vec<&str> = groups
        .iter()
        .filter_map(|group| group["name"].as_str())
        .map(|name| name.split('@').next().expect("non-empty name"))
        .collect();
    assert!(
        names.contains(&"idm_people_admins"),
        "idm_admin groups must contain idm_people_admins, got: {names:?}"
    );
}

/// admin's profile groups must include domain_admins.
#[tokio::test]
#[ignore = "requires a running Docker daemon"]
async fn profile_admin_includes_domain_admins() {
    let (router, _handle, credentials) = container_router().await;
    let cookie = login(&router, ADMIN_USERNAME, &credentials.admin_password).await;

    let (status, body) = call_json(
        &router,
        request_with_cookie("GET", "/api/auth/profile", &cookie, Vec::new()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let groups = body["groups"].as_array().expect("groups array");
    let names: Vec<&str> = groups
        .iter()
        .filter_map(|group| group["name"].as_str())
        .map(|name| name.split('@').next().expect("non-empty name"))
        .collect();
    assert!(
        names.contains(&"domain_admins"),
        "admin groups must contain domain_admins, got: {names:?}"
    );
}

/// Full person lifecycle through the proxy with the idm_admin cookie:
/// create, list, get, delete, find in recycle bin, revive.
#[tokio::test]
#[ignore = "requires a running Docker daemon"]
async fn proxy_person_crud_roundtrip() {
    let (router, _handle, credentials) = container_router().await;
    let cookie = login(&router, IDM_ADMIN_USERNAME, &credentials.idm_admin_password).await;

    // POST /v1/person
    let create_body = serde_json::json!({
        "attrs": {"name": ["itperson"], "displayname": ["IT Person"]}
    });
    let (status, _) = call_json(
        &router,
        request_with_cookie(
            "POST",
            "/api/kanidm/v1/person",
            &cookie,
            create_body.to_string().into_bytes(),
        ),
    )
    .await;
    assert!(
        status.is_success(),
        "person create failed: {status}"
    );

    // GET /v1/person — list contains it.
    let (status, body) = call_json(
        &router,
        request_with_cookie("GET", "/api/kanidm/v1/person", &cookie, Vec::new()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let listed = body
        .as_array()
        .expect("person list is an array")
        .iter()
        .any(|entry| entry["attrs"]["name"][0] == "itperson");
    assert!(listed, "person list must contain itperson");

    // GET /v1/person/itperson
    let (status, _) = call_json(
        &router,
        request_with_cookie("GET", "/api/kanidm/v1/person/itperson", &cookie, Vec::new()),
    )
    .await;
    assert!(status.is_success(), "person get failed: {status}");

    // DELETE /v1/person/itperson
    let (status, _, _) = call(
        &router,
        request_with_cookie(
            "DELETE",
            "/api/kanidm/v1/person/itperson",
            &cookie,
            Vec::new(),
        ),
    )
    .await;
    assert!(status.is_success(), "person delete failed: {status}");

    // GET /v1/recycle_bin — contains it. Recycle-bin read rights belong
    // to idm_recycle_bin_admins (admin), not idm_admin, so this step
    // runs under the admin cookie.
    let admin_cookie = login(&router, ADMIN_USERNAME, &credentials.admin_password).await;
    let (status, body) = call_json(
        &router,
        request_with_cookie("GET", "/api/kanidm/v1/recycle_bin", &admin_cookie, Vec::new()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let recycled = body
        .as_array()
        .expect("recycle bin list is an array")
        .iter()
        .any(|entry| entry["attrs"]["name"][0] == "itperson");
    assert!(recycled, "recycle bin must contain itperson");

    // POST /v1/recycle_bin/itperson/_revive
    let (status, _, _) = call(
        &router,
        request_with_cookie(
            "POST",
            "/api/kanidm/v1/recycle_bin/itperson/_revive",
            &admin_cookie,
            Vec::new(),
        ),
    )
    .await;
    assert!(status.is_success(), "person revive failed: {status}");
}

/// OAuth2 client + image roundtrip through the proxy: create a basic
/// resource server with the exact attr keys the vendored
/// idm_oauth2_rs_basic_create sends, upload a tiny PNG via a
/// hand-built multipart body (part name "image", mirroring the
/// vendored idm_oauth2_rs_update_image), fetch it back through
/// /ui/images, then delete the client.
#[tokio::test]
#[ignore = "requires a running Docker daemon"]
async fn proxy_oauth2_image_roundtrip() {
    let (router, _handle, credentials) = container_router().await;
    let cookie = login(&router, IDM_ADMIN_USERNAME, &credentials.idm_admin_password).await;

    // POST /v1/oauth2/_basic — attr keys copied from the vendored
    // idm_oauth2_rs_basic_create.
    let create_body = serde_json::json!({
        "attrs": {
            "name": ["test_rs"],
            "displayname": ["Test RS"],
            "oauth2_rs_origin_landing": ["https://test.example.com"],
            "oauth2_strict_redirect_uri": ["true"]
        }
    });
    let (status, _, _) = call(
        &router,
        request_with_cookie(
            "POST",
            "/api/kanidm/v1/oauth2/_basic",
            &cookie,
            create_body.to_string().into_bytes(),
        ),
    )
    .await;
    assert!(status.is_success(), "oauth2 basic create failed: {status}");

    // POST /v1/oauth2/test_rs/_image — hand-built multipart body,
    // part name "image" (vendored idm_oauth2_rs_update_image).
    let boundary = "kanidmadminintegrationboundary";
    let mut multipart = Vec::new();
    multipart.extend_from_slice(
        format!(
            "--{boundary}\r\n\
             content-disposition: form-data; name=\"image\"; filename=\"logo.png\"\r\n\
             content-type: image/png\r\n\
             \r\n"
        )
        .as_bytes(),
    );
    multipart.extend_from_slice(TINY_PNG);
    multipart.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let (status, _, _) = call(
        &router,
        Request::builder()
            .method("POST")
            .uri("/api/kanidm/v1/oauth2/test_rs/_image")
            .header("cookie", &cookie)
            .header(
                "content-type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(multipart))
            .expect("build request"),
    )
    .await;
    assert!(status.is_success(), "oauth2 image upload failed: {status}");

    // GET /ui/images/oauth2/test_rs through the proxy — 2xx with an
    // image/ content type. The bearer is attached by the forwarder
    // regardless; this also proves the cookie path works for /ui/images.
    let (status, content_type, body) = call(
        &router,
        request_with_cookie(
            "GET",
            "/api/kanidm/ui/images/oauth2/test_rs",
            &cookie,
            Vec::new(),
        ),
    )
    .await;
    assert!(status.is_success(), "oauth2 image fetch failed: {status}");
    let content_type = content_type.unwrap_or_default();
    assert!(
        content_type.starts_with("image/"),
        "image content type expected, got: {content_type}"
    );
    assert_eq!(body, TINY_PNG, "image bytes must round-trip verbatim");

    // DELETE /v1/oauth2/test_rs
    let (status, _, _) = call(
        &router,
        request_with_cookie(
            "DELETE",
            "/api/kanidm/v1/oauth2/test_rs",
            &cookie,
            Vec::new(),
        ),
    )
    .await;
    assert!(status.is_success(), "oauth2 delete failed: {status}");
}

/// Access enforcement: idm_admin must not modify the builtin admin
/// account; Kanidm denies the write with 403 and the proxy preserves
/// the status, normalizing the envelope code to access_denied.
#[tokio::test]
#[ignore = "requires a running Docker daemon"]
async fn proxy_access_enforcement_maps_403() {
    let (router, _handle, credentials) = container_router().await;
    let cookie = login(&router, IDM_ADMIN_USERNAME, &credentials.idm_admin_password).await;

    // idm_admin can read the builtin admin account but must not modify
    // it (that right belongs to domain_admins/system admins only).
    let (status, body) = call_json(
        &router,
        request_with_cookie(
            "PUT",
            "/api/kanidm/v1/person/admin/_attr/displayname",
            &cookie,
            serde_json::json!(["x"]).to_string().into_bytes(),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(
        body["error"]["code"], "access_denied",
        "envelope must normalize to access_denied, got: {body}"
    );
}
