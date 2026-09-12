// app/src/testcontainer/mailcrab.rs
//
// Mailcrab container: the catch-all dev mail sink with a web UI.
// This file currently holds only the container handle type the
// shared TestcontainersHandle needs; the request building, run
// and readiness logic lands with the container modules batch.

use testcontainers::{ContainerAsync, GenericImage};

/// Running mailcrab container plus the upstream base URL used to
/// reach it. Held by TestcontainersHandle to keep the container
/// alive for the process lifetime.
#[allow(dead_code)]
pub(crate) struct MailcrabContainer {
    pub(crate) container: ContainerAsync<GenericImage>,
    pub(crate) upstream: String,
}
