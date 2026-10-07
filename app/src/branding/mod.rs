// app/src/branding/mod.rs
//
// Custom branding: UI-uploaded logo/favicon overrides stored on disk
// and served by dedicated routes registered before the SPA fallback.

pub mod handlers;
pub mod sanitize;
pub mod store;

pub use handlers::router;
pub use store::BrandingStore;
