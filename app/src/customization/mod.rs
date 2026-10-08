// app/src/customization/mod.rs
//
// Customization: UI-uploaded logo/favicon/theme-CSS overrides stored on
// disk and served by dedicated routes registered before the SPA fallback.

pub mod handlers;
pub mod sanitize;
pub mod store;

pub use handlers::router;
pub use store::CustomizationStore;
