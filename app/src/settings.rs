// app/src/settings.rs
//
// Modular settings: each section lives in its own file under settings/.
// loader.rs assembles the layered configuration; add future optional
// sections as `#[serde(default)]` fields on Settings in loader.rs.

pub mod branding;
pub mod frontend;
pub mod kanidm;
pub mod loader;
pub mod server;
pub mod testcontainer;

#[cfg(test)]
mod tests;
