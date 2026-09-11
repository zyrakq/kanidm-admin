// app/src/avatars/mod.rs
//
// Local person avatar storage: kanidm (vendored 1.12.0-dev) has no
// person image attribute or endpoint, so avatars live on our backend's
// disk and are served from /api/avatar/{id}. See design 2026-09-11.

pub mod store;

pub use store::{store_from_settings, AvatarStore, FsAvatarStore, StoredAvatar};
