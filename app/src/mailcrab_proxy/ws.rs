// app/src/mailcrab_proxy/ws.rs
//
// WebSocket bridge for /_/mailcrab/ws: upgrades the client
// socket, connects to the mailcrab upstream's /_/mailcrab/ws
// endpoint and pumps messages in both directions. The mail UI
// uses this socket for live updates; without the bridge it would
// need a second port/CORS origin that in-container mode does not
// even publish.

use axum::extract::ws::{Message, WebSocketUpgrade};
use axum::extract::Extension;
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message as TungsteniteMessage;

use super::Upstream;

/// Bridge one client WebSocket to the mailcrab upstream.
pub(super) async fn bridge(
    Extension(upstream): Extension<Upstream>,
    ws: WebSocketUpgrade,
) -> Response {
    let ws_url = upstream_ws_url(&upstream.url);
    ws.on_upgrade(move |mut client_socket| async move {
        let upstream_socket = match tokio_tungstenite::connect_async(&ws_url).await {
            Ok((socket, _)) => socket,
            Err(error) => {
                tracing::warn!("mailcrab websocket connect to {ws_url} failed: {error}");
                let _ = client_socket.close().await;
                return;
            }
        };

        // Both sockets are split: axum's WebSocket cannot be
        // select!ed unsplit.
        let (mut client_sink, mut client_stream) = client_socket.split();
        let (mut upstream_sink, mut upstream_stream) = upstream_socket.split();

        loop {
            tokio::select! {
                client_message = client_stream.next() => {
                    match client_message {
                        Some(Ok(message)) => {
                            if upstream_sink.send(to_tungstenite(message)).await.is_err() {
                                break;
                            }
                        }
                        _ => break,
                    }
                }
                upstream_message = upstream_stream.next() => {
                    match upstream_message {
                        Some(Ok(message)) => {
                            if let Some(message) = to_axum(message) {
                                if client_sink.send(message).await.is_err() {
                                    break;
                                }
                            }
                        }
                        _ => break,
                    }
                }
            }
        }
    })
}

/// The upstream WebSocket URL: scheme swapped http→ws / https→wss,
/// path fixed to the mailcrab ws endpoint.
fn upstream_ws_url(upstream_base: &str) -> String {
    let ws_base = if let Some(rest) = upstream_base.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = upstream_base.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        upstream_base.to_string()
    };
    format!("{ws_base}/_/mailcrab/ws")
}

/// axum → tungstenite message. Binary/Ping/Pong are pure variant
/// moves (both sides use the same Bytes type); Text goes through
/// &str (axum 0.8.8 wraps tungstenite's Utf8Bytes in its own
/// newtype); Close becomes Close(None) — axum has its own
/// CloseFrame type, and the close handshake still works without
/// the frame details.
fn to_tungstenite(message: Message) -> TungsteniteMessage {
    match message {
        Message::Text(text) => TungsteniteMessage::Text(text.as_str().into()),
        Message::Binary(bytes) => TungsteniteMessage::Binary(bytes),
        Message::Ping(bytes) => TungsteniteMessage::Ping(bytes),
        Message::Pong(bytes) => TungsteniteMessage::Pong(bytes),
        Message::Close(_) => TungsteniteMessage::Close(None),
    }
}

/// tungstenite → axum message; None skips the message (Frame is
/// tungstenite's internal raw-frame variant, never forwarded).
fn to_axum(message: TungsteniteMessage) -> Option<Message> {
    Some(match message {
        TungsteniteMessage::Text(text) => Message::Text(text.as_str().into()),
        TungsteniteMessage::Binary(bytes) => Message::Binary(bytes),
        TungsteniteMessage::Ping(bytes) => Message::Ping(bytes),
        TungsteniteMessage::Pong(bytes) => Message::Pong(bytes),
        TungsteniteMessage::Close(_) => Message::Close(None),
        TungsteniteMessage::Frame(_) => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ws_url_swaps_scheme_and_targets_the_bridge_path() {
        assert_eq!(
            upstream_ws_url("http://127.0.0.1:1080"),
            "ws://127.0.0.1:1080/_/mailcrab/ws"
        );
        assert_eq!(
            upstream_ws_url("https://mailcrab:1080"),
            "wss://mailcrab:1080/_/mailcrab/ws"
        );
    }
}
