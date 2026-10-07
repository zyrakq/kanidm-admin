// app/src/mailpit_proxy/http.rs
//
// Verbatim HTTP forwarder for /_/mailpit/{*path}: method,
// headers (minus hop-by-hop), body, status and response headers
// all pass through 1:1 — the path is NOT stripped because
// mailpit serves its UI and API under its own /_/mailpit
// webroot. Redirects pass through untouched (the shared client
// has Policy::none), so mailpit's own Location headers keep the
// prefix.

use axum::body::{to_bytes, Body};
use axum::extract::{Extension, Request};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};

use super::Upstream;

/// Body limit for forwarded requests/responses (the mail UI
/// serves small JSON + assets; 10 MB mirrors the kanidm proxy).
const MAX_BODY_BYTES: usize = 10 * 1024 * 1024;

/// Hop-by-hop headers (RFC 7230 6.1): they are per-connection,
/// never forwarded. `host` is also dropped — reqwest sets it
/// per-URL.
const HOP_BY_HOP_HEADERS: [&str; 10] = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
];

/// Forward one request to the mailpit upstream, verbatim.
pub(super) async fn forward(
    Extension(upstream): Extension<Upstream>,
    request: Request,
) -> Response {
    let (parts, body) = request.into_parts();

    // URL = upstream base + the full path-and-query, 1:1.
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_default();
    let url = format!("{}{}", upstream.url, path_and_query);

    // Buffer the body (mirrors the kanidm proxy's approach).
    let body = match to_bytes(body, MAX_BODY_BYTES).await {
        Ok(bytes) => bytes,
        Err(_) => return plain_status(StatusCode::PAYLOAD_TOO_LARGE),
    };

    // Method passthrough: reqwest shares the http crate with
    // axum, no conversion needed.
    let response = match upstream
        .client
        .request(parts.method, &url)
        .headers(forwarded_headers(&parts.headers))
        .body(reqwest::Body::from(body))
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => return bad_gateway(&upstream.url, &error),
    };

    let status =
        StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let headers = response.headers().clone();
    let body = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => return bad_gateway(&upstream.url, &error),
    };

    let mut builder = Response::builder().status(status);
    for (name, value) in forwarded_headers(&headers).iter() {
        builder = builder.header(name, value.clone());
    }
    builder
        .body(Body::from(body))
        .unwrap_or_else(|_| bad_gateway_body(&upstream.url))
}

/// Copy the headers minus the hop-by-hop set.
fn forwarded_headers(headers: &HeaderMap) -> HeaderMap {
    let mut forwarded = HeaderMap::with_capacity(headers.len());
    for (name, value) in headers.iter() {
        if HOP_BY_HOP_HEADERS.contains(&name.as_str()) {
            continue;
        }
        forwarded.insert(name, value.clone());
    }
    forwarded
}

/// 502 with a short plain-text body naming the upstream URL.
fn bad_gateway(url: &str, error: &reqwest::Error) -> Response {
    tracing::warn!("mailpit forward to {url} failed: {error}");
    bad_gateway_body(url)
}

fn bad_gateway_body(url: &str) -> Response {
    (
        StatusCode::BAD_GATEWAY,
        format!("mailpit upstream {url} is unreachable"),
    )
        .into_response()
}

fn plain_status(status: StatusCode) -> Response {
    (status, "").into_response()
}
