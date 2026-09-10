// app/src/status.rs
//
// GET /api/status — Kanidm server version and reachability for the
// footer. The backend is the only party allowed to talk to Kanidm (the
// proxy architecture keeps TLS/CA config in [kanidm] settings), so this
// module pings the server with a raw HTTP request, reads the KVERSION
// response header (the same mechanism kanidm_client's expect_version
// uses), compares it with the compile-time client version and returns a
// ready-to-render state. Always answers 200 JSON — the payload carries
// the outcome, including `unreachable`.
//
// /api/health stays a plain "OK" liveness probe and is not touched.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::settings::kanidm::KanidmSettings;

/// Total ping timeout. /api/status must answer in ~3s even when Kanidm
/// is unresponsive, so the footer never hangs on a dead server.
const PING_TIMEOUT_SECS: u64 = 3;

/// Header Kanidm sets on every response, carrying its server version
/// (e.g. `1.11.1`). Header names are case-insensitive; reqwest stores
/// them lowercase.
const KVERSION_HEADER: &str = "kversion";

/// Fallback for the compile-time client version when build.rs could not
/// extract it from Cargo.lock. Keep in sync with the kanidm_client
/// version in the workspace Cargo.toml.
const FALLBACK_CLIENT_VERSION: &str = "1.11.1";

/// Compile-time kanidm_client version (from Cargo.lock via build.rs).
pub fn client_version() -> &'static str {
    match option_env!("KANIDM_CLIENT_VERSION") {
        Some(version) if !version.is_empty() => version,
        _ => FALLBACK_CLIENT_VERSION,
    }
}

// ---------------------------------------------------------------------------
// Version parsing and the conflict rule (pure functions, unit-tested)
// ---------------------------------------------------------------------------

/// Parsed `major.minor.patch` version — the KVERSION format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
}

/// Parse a strict `major.minor.patch` string. Anything else — missing or
/// extra parts, non-numeric components, a `v` prefix, pre-release
/// suffixes — yields None; a malformed header is treated as "version
/// unknown" and never as an error.
pub fn parse_version(value: &str) -> Option<Version> {
    let value = value.trim();
    let mut parts = value.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some(Version { major, minor, patch })
}

/// Conflict rule: the client is NEWER by major, or the SAME major and
/// older by minor/patch. A newer server (including a newer major) is
/// fine — servers stay backward compatible with older clients.
pub fn version_conflict(client: &Version, server: &Version) -> bool {
    if client.major != server.major {
        return client.major > server.major;
    }
    (client.minor, client.patch) < (server.minor, server.patch)
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusState {
    Alive,
    Unreachable,
    VersionConflict,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub state: StatusState,
    pub server_version: Option<String>,
    pub client_version: String,
}

// ---------------------------------------------------------------------------
// Kanidm probe
// ---------------------------------------------------------------------------

/// Result of one Kanidm ping.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ProbeOutcome {
    /// false = network error or timeout — no HTTP response at all.
    pub reachable: bool,
    /// Parsed KVERSION header; None = header absent or malformed.
    pub server_version: Option<Version>,
}

/// Probe abstraction so the handler is unit-testable without a live
/// Kanidm server (same pattern as auth::ops::KanidmAuthOps).
#[async_trait]
pub trait KanidmStatusProbe: Send + Sync {
    async fn probe(&self) -> ProbeOutcome;
}

/// Production probe: unauthenticated GET to the Kanidm URL root.
pub struct KanidmHttpProbe {
    client: reqwest::Client,
    url: String,
}

impl KanidmHttpProbe {
    /// Builds the reqwest client once; a broken CA configuration fails
    /// fast at startup, mirroring the auth client builder behavior.
    pub fn new(
        settings: &KanidmSettings,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {
            client: build_reqwest_client(settings)?,
            url: settings.url.clone(),
        })
    }
}

fn build_reqwest_client(
    settings: &KanidmSettings,
) -> Result<reqwest::Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(PING_TIMEOUT_SECS))
        // verify_ca = false is a development-only escape hatch, the same
        // as in auth::ops::client_builder_from_settings.
        .danger_accept_invalid_certs(!settings.verify_ca);

    if let Some(path) = settings.ca_path.as_deref() {
        if !path.is_empty() {
            let pem = std::fs::read(path)
                .map_err(|error| format!("failed to read kanidm CA file {path}: {error}"))?;
            let certificate = reqwest::Certificate::from_pem(&pem)
                .map_err(|error| format!("invalid kanidm CA file {path}: {error}"))?;
            builder = builder.add_root_certificate(certificate);
        }
    }

    Ok(builder.build()?)
}

#[async_trait]
impl KanidmStatusProbe for KanidmHttpProbe {
    async fn probe(&self) -> ProbeOutcome {
        // Any HTTP response — 401, 404, 5xx included — proves the server
        // is alive; only network errors and timeouts mean unreachable.
        match self.client.get(&self.url).send().await {
            Ok(response) => ProbeOutcome {
                reachable: true,
                server_version: response
                    .headers()
                    .get(KVERSION_HEADER)
                    .and_then(|value| value.to_str().ok())
                    .and_then(parse_version),
            },
            Err(_) => ProbeOutcome::default(),
        }
    }
}

/// Build the production probe from the [kanidm] settings; called once in
/// main so a broken CA configuration fails fast at startup.
pub fn probe_from_settings(
    settings: &KanidmSettings,
) -> Result<Arc<dyn KanidmStatusProbe>, Box<dyn std::error::Error + Send + Sync>> {
    Ok(Arc::new(KanidmHttpProbe::new(settings)?))
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /api/status — always 200; the `state` field carries the outcome.
pub async fn status_handler(
    State(probe): State<Arc<dyn KanidmStatusProbe>>,
) -> Json<StatusResponse> {
    Json(compute_response(client_version(), probe.probe().await))
}

/// Pure decision logic, kept out of the handler so the full design table
/// is unit-testable with arbitrary client versions (the compiled-in env
/// version cannot be controlled from tests).
fn compute_response(client_version: &str, outcome: ProbeOutcome) -> StatusResponse {
    let client_version = client_version.to_string();

    if !outcome.reachable {
        return StatusResponse {
            state: StatusState::Unreachable,
            server_version: None,
            client_version,
        };
    }

    let Some(server) = outcome.server_version else {
        // Alive but version unknown (absent or malformed KVERSION):
        // no conflict check is possible.
        return StatusResponse {
            state: StatusState::Alive,
            server_version: None,
            client_version,
        };
    };

    // An unknown client version (env var missing AND fallback malformed)
    // also disables the comparison rather than guessing a conflict.
    let conflict = parse_version(&client_version)
        .map(|client| version_conflict(&client, &server))
        .unwrap_or(false);

    StatusResponse {
        state: if conflict {
            StatusState::VersionConflict
        } else {
            StatusState::Alive
        },
        server_version: Some(format!("{}.{}.{}", server.major, server.minor, server.patch)),
        client_version,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// The Cargo.lock parser lives in build.rs (build scripts have no test
// target of their own), so the file is included here as a module to unit
// test the pure function. Top-level placement keeps the #[path] relative
// to src/, where ../build.rs is the real file.
#[cfg(test)]
#[path = "../build.rs"]
#[allow(dead_code)]
mod build_script;

#[cfg(test)]
mod tests {
    use super::build_script::extract_kanidm_client_version;
    use super::{
        client_version, compute_response, parse_version, status_handler, version_conflict,
        KanidmStatusProbe, ProbeOutcome, StatusState, Version,
    };
    use async_trait::async_trait;
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use axum::routing::get;
    use axum::Router;
    use indoc::indoc;
    use serde_json::json;
    use std::sync::Arc;
    use tower::ServiceExt;

    // -- parse_version ------------------------------------------------------

    #[test]
    fn parse_version_accepts_strict_semver() {
        assert_eq!(
            parse_version("1.11.1"),
            Some(Version { major: 1, minor: 11, patch: 1 })
        );
    }

    #[test]
    fn parse_version_tolerates_surrounding_whitespace() {
        assert_eq!(parse_version(" 1.11.1\n"), parse_version("1.11.1"));
    }

    #[test]
    fn parse_version_rejects_malformed_values() {
        for value in [
            "", "1", "1.11", "1.11.1.1", "v1.11.1", "1.11.x", "1.11.1-rc.1", "1..1",
        ] {
            assert_eq!(parse_version(value), None, "value: {value:?}");
        }
    }

    // -- version_conflict: the design table ---------------------------------

    #[test]
    fn conflict_rule_matches_the_design_table() {
        let v = |major, minor, patch| Version { major, minor, patch };

        // client 1.11.1 vs server 1.11.0 — client newer by patch: ok
        assert!(!version_conflict(&v(1, 11, 1), &v(1, 11, 0)));
        // client 1.11.1 vs server 1.11.2 — client older by patch: conflict
        assert!(version_conflict(&v(1, 11, 1), &v(1, 11, 2)));
        // client 1.11.1 vs server 1.12.0 — client older by minor: conflict
        assert!(version_conflict(&v(1, 11, 1), &v(1, 12, 0)));
        // client 2.0.0 vs server 1.11.1 — client newer by major: conflict
        assert!(version_conflict(&v(2, 0, 0), &v(1, 11, 1)));
        // client 1.11.1 vs server 2.0.0 — server newer by major: ok
        assert!(!version_conflict(&v(1, 11, 1), &v(2, 0, 0)));
        // identical versions: ok
        assert!(!version_conflict(&v(1, 11, 1), &v(1, 11, 1)));
        // client newer by minor within the same major: ok
        assert!(!version_conflict(&v(1, 12, 0), &v(1, 11, 9)));
    }

    // -- compute_response ---------------------------------------------------

    fn outcome(reachable: bool, server: Option<&str>) -> ProbeOutcome {
        ProbeOutcome {
            reachable,
            server_version: server.and_then(parse_version),
        }
    }

    #[test]
    fn compute_response_unreachable() {
        let response = compute_response("1.11.1", outcome(false, Some("1.11.1")));
        assert_eq!(response.state, StatusState::Unreachable);
        assert_eq!(response.server_version, None);
        assert_eq!(response.client_version, "1.11.1");
    }

    #[test]
    fn compute_response_alive_without_header_skips_conflict_check() {
        let response = compute_response("1.11.1", outcome(true, None));
        assert_eq!(response.state, StatusState::Alive);
        assert_eq!(response.server_version, None);
    }

    #[test]
    fn compute_response_alive_when_client_newer_or_equal() {
        let response = compute_response("1.11.1", outcome(true, Some("1.11.0")));
        assert_eq!(response.state, StatusState::Alive);
        assert_eq!(response.server_version.as_deref(), Some("1.11.0"));
    }

    #[test]
    fn compute_response_conflict_when_client_older_by_patch() {
        let response = compute_response("1.11.1", outcome(true, Some("1.11.2")));
        assert_eq!(response.state, StatusState::VersionConflict);
        assert_eq!(response.server_version.as_deref(), Some("1.11.2"));
        assert_eq!(response.client_version, "1.11.1");
    }

    #[test]
    fn compute_response_conflict_when_client_newer_by_major() {
        let response = compute_response("2.0.0", outcome(true, Some("1.11.1")));
        assert_eq!(response.state, StatusState::VersionConflict);
    }

    #[test]
    fn compute_response_ok_when_server_newer_by_major() {
        let response = compute_response("1.11.1", outcome(true, Some("2.0.0")));
        assert_eq!(response.state, StatusState::Alive);
        assert_eq!(response.server_version.as_deref(), Some("2.0.0"));
    }

    #[test]
    fn compute_response_unknown_client_version_disables_comparison() {
        let response = compute_response("unknown", outcome(true, Some("1.11.2")));
        assert_eq!(response.state, StatusState::Alive);
        assert_eq!(response.client_version, "unknown");
    }

    // -- handler wiring (mock probe, no live Kanidm) ------------------------

    struct MockProbe(ProbeOutcome);

    #[async_trait]
    impl KanidmStatusProbe for MockProbe {
        async fn probe(&self) -> ProbeOutcome {
            self.0
        }
    }

    fn router_with(outcome: ProbeOutcome) -> Router {
        Router::new().route(
            "/api/status",
            get(status_handler).with_state(Arc::new(MockProbe(outcome))),
        )
    }

    async fn get_status(outcome: ProbeOutcome) -> serde_json::Value {
        let response = router_with(outcome)
            .oneshot(
                Request::builder()
                    .uri("/api/status")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("router call");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        serde_json::from_slice(&bytes).expect("parse json body")
    }

    #[tokio::test]
    async fn handler_returns_alive_with_camel_case_fields() {
        // Server 9999.0.0 is newer by major than any 1.x client, so this
        // stays `alive` regardless of the compiled-in client version.
        let body = get_status(outcome(true, Some("9999.0.0"))).await;
        assert_eq!(body["state"], json!("alive"));
        assert_eq!(body["serverVersion"], json!("9999.0.0"));
        assert!(
            body["clientVersion"].as_str().is_some_and(|v| !v.is_empty()),
            "clientVersion must be a non-empty string: {body}"
        );
    }

    #[tokio::test]
    async fn handler_returns_unreachable_on_network_failure() {
        let body = get_status(outcome(false, None)).await;
        assert_eq!(body["state"], json!("unreachable"));
        assert_eq!(body["serverVersion"], json!(null));
    }

    #[tokio::test]
    async fn handler_returns_conflict_for_ancient_server() {
        // Server 0.0.0 is older by major than any 1.x client, so this is
        // a conflict regardless of the compiled-in client version.
        let body = get_status(outcome(true, Some("0.0.0"))).await;
        assert_eq!(body["state"], json!("version_conflict"));
    }

    // -- compile-time client version pipeline --------------------------------

    #[test]
    fn client_version_is_always_valid_semver() {
        // build.rs emits KANIDM_CLIENT_VERSION before its early returns,
        // so under cargo test the env var is set and must parse; the
        // fallback constant must parse too.
        let version = client_version();
        assert!(
            parse_version(version).is_some(),
            "client version {version:?} must be major.minor.patch"
        );
    }

    // -- build.rs Cargo.lock parser ------------------------------------------

    #[test]
    fn lockfile_parser_extracts_kanidm_client_version() {
        let lock = indoc! {r#"
            version = 4

            [[package]]
            name = "server"
            version = "0.1.0"

            [[package]]
            name = "kanidm_client"
            version = "1.11.1"
            source = "registry+https://github.com/rust-lang/crates.io-index"

            [[package]]
            name = "kanidm_proto"
            version = "1.11.1"
        "#};
        assert_eq!(
            extract_kanidm_client_version(lock),
            Some("1.11.1".to_string())
        );
    }

    #[test]
    fn lockfile_parser_ignores_top_level_lockfile_version() {
        // The top-level `version = 4` is the lockfile format version, not
        // a package version — it must never be picked up.
        let lock = indoc! {r#"
            version = 4
        "#};
        assert_eq!(extract_kanidm_client_version(lock), None);
    }

    #[test]
    fn lockfile_parser_returns_none_without_kanidm_client() {
        let lock = indoc! {r#"
            [[package]]
            name = "serde"
            version = "1.0.219"
        "#};
        assert_eq!(extract_kanidm_client_version(lock), None);
    }
}
