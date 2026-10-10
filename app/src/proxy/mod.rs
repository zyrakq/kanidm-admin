// app/src/proxy/mod.rs
//
// Generic reverse proxy to Kanidm: allowlist, privilege precheck,
// forwarding, error normalization. No per-endpoint handlers by design.

pub mod allowlist;
pub mod bulk;
pub mod error_map;
pub mod forwarder;
pub mod handler;

// The integration tests drive the real testcontainer chain, so they
// only exist when that subsystem is compiled in.
#[cfg(all(test, feature = "testcontainer"))]
mod integration;
