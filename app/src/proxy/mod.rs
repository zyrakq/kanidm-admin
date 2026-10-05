// app/src/proxy/mod.rs
//
// Generic reverse proxy to Kanidm: allowlist, privilege precheck,
// forwarding, error normalization. No per-endpoint handlers by design.

pub mod allowlist;
pub mod bulk;
pub mod error_map;
pub mod forwarder;
pub mod handler;

#[cfg(test)]
mod integration;
