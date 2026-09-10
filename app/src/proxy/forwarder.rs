// app/src/proxy/forwarder.rs
//
// The single seam the proxy handler talks to Kanidm through. A trait so
// the handler is unit-testable without a server (mirrors KanidmAuthOps);
// the production impl is a shared reqwest client with a 30 s timeout.
// Bodies are buffered (10 MB route limit) which keeps the trait
// trivially mockable.

use async_trait::async_trait;
use axum::body::Bytes;
use axum::http::{Method, StatusCode};
use std::time::Duration;

use crate::settings::kanidm::KanidmSettings;

/// Everything needed to replay one request against Kanidm.
#[derive(Debug, Clone)]
pub struct ForwardRequest {
    pub method: Method,
    /// Path + query exactly as received after the /api/kanidm prefix,
    /// e.g. "/v1/person" or "/v1/person?_search=abc".
    pub path_and_query: String,
    /// Content-Type verbatim (None for bodyless requests). Multipart
    /// boundaries MUST survive unchanged.
    pub content_type: Option<String>,
    pub body: Bytes,
    /// Session token for the Authorization: Bearer header.
    pub bearer_token: String,
}

/// A buffered upstream response.
#[derive(Debug, Clone)]
pub struct ForwardResponse {
    pub status: StatusCode,
    pub content_type: Option<String>,
    pub body: Bytes,
}

/// Transport-level failure (connect/DNS/TLS/timeout).
#[derive(Debug)]
pub struct ForwardTransportError(pub String);

impl Clone for ForwardTransportError {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

#[async_trait]
pub trait Forwarder: Send + Sync {
    async fn forward(
        &self,
        request: ForwardRequest,
    ) -> Result<ForwardResponse, ForwardTransportError>;
}

/// Production forwarder: one shared reqwest client (connection pool,
/// 30 s total timeout) pointed at the configured Kanidm URL.
pub struct ReqwestForwarder {
    client: reqwest::Client,
    /// Base URL without trailing slash, e.g. "https://localhost:8443".
    base_url: String,
}

impl ReqwestForwarder {
    /// Build from the [kanidm] settings, honoring verify_ca / ca_path the
    /// same way auth::ops::client_builder_from_settings does.
    pub fn from_settings(settings: &KanidmSettings) -> Result<Self, String> {
        let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(30));

        if !settings.verify_ca {
            builder = builder
                .danger_accept_invalid_certs(true)
                .danger_accept_invalid_hostnames(true);
        }
        if let Some(ca_path) = settings.ca_path.as_deref().filter(|p| !p.is_empty()) {
            let pem = std::fs::read(ca_path)
                .map_err(|e| format!("failed to read kanidm CA {ca_path}: {e}"))?;
            let cert = reqwest::Certificate::from_pem(&pem)
                .map_err(|e| format!("invalid kanidm CA {ca_path}: {e}"))?;
            builder = builder.add_root_certificate(cert);
        }

        let client = builder
            .build()
            .map_err(|e| format!("failed to build proxy client: {e}"))?;
        let base_url = settings.url.trim_end_matches('/').to_string();
        Ok(Self { client, base_url })
    }
}

#[async_trait]
impl Forwarder for ReqwestForwarder {
    async fn forward(
        &self,
        request: ForwardRequest,
    ) -> Result<ForwardResponse, ForwardTransportError> {
        let url = format!("{}{}", self.base_url, request.path_and_query);
        let method = reqwest::Method::from_bytes(request.method.as_str().as_bytes())
            .map_err(|e| ForwardTransportError(format!("invalid method: {e}")))?;

        let mut upstream = self.client.request(method, url);
        if let Some(content_type) = &request.content_type {
            upstream = upstream.header(reqwest::header::CONTENT_TYPE, content_type);
        }
        if !request.body.is_empty() {
            upstream = upstream.body(request.body.to_vec());
        }
        // The bearer token is always attached, including /ui/images GETs.
        let upstream = upstream.bearer_auth(&request.bearer_token);

        let response = upstream
            .send()
            .await
            .map_err(|e| ForwardTransportError(format!("kanidm request failed: {e}")))?;

        let status = StatusCode::from_u16(response.status().as_u16())
            .map_err(|e| ForwardTransportError(format!("upstream status: {e}")))?;
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let body = response
            .bytes()
            .await
            .map_err(|e| ForwardTransportError(format!("kanidm body read failed: {e}")))?;

        Ok(ForwardResponse {
            status,
            content_type,
            body,
        })
    }
}

/// Mock used by the handler tests. Records the last request;
/// returns a configured response or a transport error.
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    pub(crate) struct MockForwarder {
        pub last_request: Mutex<Option<ForwardRequest>>,
        /// Response to return; None -> transport error.
        pub response: Mutex<Option<Result<ForwardResponse, ForwardTransportError>>>,
        pub call_count: Mutex<usize>,
    }

    impl MockForwarder {
        pub fn with_response(response: ForwardResponse) -> Self {
            Self {
                response: Mutex::new(Some(Ok(response))),
                ..Default::default()
            }
        }

        pub fn transport_error() -> Self {
            Self {
                response: Mutex::new(Some(Err(ForwardTransportError(
                    "mock transport failure".to_string(),
                )))),
                ..Default::default()
            }
        }

        pub fn calls(&self) -> usize {
            *self.call_count.lock().expect("call count lock")
        }

        pub fn last_request(&self) -> Option<ForwardRequest> {
            self.last_request.lock().expect("last request lock").clone()
        }
    }

    #[async_trait]
    impl Forwarder for MockForwarder {
        async fn forward(
            &self,
            request: ForwardRequest,
        ) -> Result<ForwardResponse, ForwardTransportError> {
            *self.call_count.lock().expect("call count lock") += 1;
            *self.last_request.lock().expect("last request lock") = Some(request);
            self.response
                .lock()
                .expect("response lock")
                .clone()
                .unwrap_or_else(|| Err(ForwardTransportError("unconfigured mock".to_string())))
        }
    }

    /// Test helper: a 200 JSON forward response.
    pub(crate) fn ok_json_response(body: &'static [u8]) -> ForwardResponse {
        ForwardResponse {
            status: StatusCode::OK,
            content_type: Some("application/json".to_string()),
            body: Bytes::from_static(body),
        }
    }
}
