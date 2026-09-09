// app/src/frontend_assets.rs
//
// Compile-time asset container. In release builds rust-embed inlines
// ui/dist into the binary; in debug builds assets are read from disk on
// each request so `bun watch` rebuilds are picked up live.

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "ui/dist/"]
pub struct Assets;
