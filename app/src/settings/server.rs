use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ServerSettings {
    pub address: String,
}
