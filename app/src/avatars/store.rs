// Filesystem avatar store: `{id}.{ext}` files in the configured
// directory. Ids are validated against a strict charset and rejected
// when they contain `..` so a hostile id can never traverse paths.
// Blocking std::fs calls are fine here: avatar files are small and
// writes are rare.

use std::path::{Path, PathBuf};

use async_trait::async_trait;

use crate::settings::avatars::AvatarSettings;

/// Maximum avatar upload size (2 MB); enforced by the route's body
/// limit and again in the handler before bytes reach the store.
pub const MAX_AVATAR_BYTES: usize = 2 * 1024 * 1024;

/// Accepted avatar content types with their file extensions.
pub const ALLOWED_TYPES: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/png", "png"),
    ("image/gif", "gif"),
    ("image/webp", "webp"),
];

/// A stored avatar: raw bytes plus the content type to serve them with.
#[derive(Debug, Clone)]
pub struct StoredAvatar {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

/// Storage errors; handlers map these onto the API error envelope.
#[derive(Debug)]
pub enum AvatarStoreError {
    /// The id failed validation (charset, `..`, or length).
    InvalidId,
    /// The content type is not in ALLOWED_TYPES.
    UnsupportedType(String),
    /// The disk operation failed.
    Io(std::io::Error),
}

impl std::fmt::Display for AvatarStoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidId => write!(f, "invalid avatar id"),
            Self::UnsupportedType(kind) => write!(f, "unsupported avatar type {kind}"),
            Self::Io(error) => write!(f, "avatar storage error: {error}"),
        }
    }
}

impl std::error::Error for AvatarStoreError {}

/// Valid avatar ids: kanidm person names, spns and uuids are all
/// covered by `[A-Za-z0-9_.@-]`. Slashes, percent signs, whitespace
/// and `..` shapes are rejected BEFORE any path arithmetic. The 64
/// char cap is defensive (uuids are 36, names far shorter).
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.contains("..")
        && id.bytes().all(|b| {
            b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'@' | b'-')
        })
}

/// Storage backend trait so HTTP handlers are testable without a disk.
#[async_trait]
pub trait AvatarStore: Send + Sync {
    /// Fetch the avatar for `id`, if present.
    async fn get(&self, id: &str) -> Result<Option<StoredAvatar>, AvatarStoreError>;
    /// Save the avatar for `id`, replacing any previous file.
    async fn save(&self, id: &str, avatar: StoredAvatar) -> Result<(), AvatarStoreError>;
    /// Delete the avatar for `id`; Ok(false) when absent.
    async fn delete(&self, id: &str) -> Result<bool, AvatarStoreError>;
    /// True when an avatar exists for `id`.
    async fn exists(&self, id: &str) -> Result<bool, AvatarStoreError>;
}

/// Disk-backed store over one directory; created eagerly so a bad
/// configuration fails at startup, not on first upload.
pub struct FsAvatarStore {
    dir: PathBuf,
}

impl FsAvatarStore {
    pub fn new(dir: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&dir)?;
        Ok(Self { dir })
    }

    /// Reject invalid ids before any path arithmetic.
    fn checked(&self, id: &str) -> Result<String, AvatarStoreError> {
        if valid_id(id) {
            Ok(id.to_string())
        } else {
            Err(AvatarStoreError::InvalidId)
        }
    }

    /// Find the stored file for `id` across the known extensions.
    /// NOTE: extensions are APPENDED (`{id}.{ext}`), never swapped via
    /// `with_extension` — ids contain dots (`jdoe@example.com`) and
    /// `with_extension` would mangle them into collisions.
    fn find(&self, id: &str) -> Result<Option<(PathBuf, &'static str)>, AvatarStoreError> {
        let id = self.checked(id)?;
        for (content_type, ext) in ALLOWED_TYPES {
            let path = self.dir.join(format!("{id}.{ext}"));
            if path.is_file() {
                return Ok(Some((path, content_type)));
            }
        }
        Ok(None)
    }
}

#[async_trait]
impl AvatarStore for FsAvatarStore {
    async fn get(&self, id: &str) -> Result<Option<StoredAvatar>, AvatarStoreError> {
        match self.find(id)? {
            Some((path, content_type)) => {
                let bytes = std::fs::read(&path).map_err(AvatarStoreError::Io)?;
                Ok(Some(StoredAvatar {
                    bytes,
                    content_type: content_type.to_string(),
                }))
            }
            None => Ok(None),
        }
    }

    async fn save(&self, id: &str, avatar: StoredAvatar) -> Result<(), AvatarStoreError> {
        let ext = ALLOWED_TYPES
            .iter()
            .find(|(content_type, _)| *content_type == avatar.content_type)
            .map(|(_, ext)| *ext)
            .ok_or_else(|| AvatarStoreError::UnsupportedType(avatar.content_type.clone()))?;
        let id = self.checked(id)?;
        // Sweep other extensions so exactly one file per id remains.
        for (_, other) in ALLOWED_TYPES {
            let stale = self.dir.join(format!("{id}.{other}"));
            if stale.is_file() {
                std::fs::remove_file(&stale).map_err(AvatarStoreError::Io)?;
            }
        }
        let path = self.dir.join(format!("{id}.{ext}"));
        std::fs::write(&path, &avatar.bytes).map_err(AvatarStoreError::Io)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<bool, AvatarStoreError> {
        let Some((path, _)) = self.find(id)? else {
            return Ok(false);
        };
        std::fs::remove_file(&path).map_err(AvatarStoreError::Io)?;
        Ok(true)
    }

    async fn exists(&self, id: &str) -> Result<bool, AvatarStoreError> {
        Ok(self.find(id)?.is_some())
    }
}

/// Build the production store from settings; called once in main so a
/// bad directory fails fast at startup.
pub fn store_from_settings(
    settings: &AvatarSettings,
    manifest_dir: &Path,
) -> Result<FsAvatarStore, Box<dyn std::error::Error + Send + Sync>> {
    let dir = settings.resolve_dir(manifest_dir);
    Ok(FsAvatarStore::new(dir)?)
}

/// In-memory store for handler tests (no disk); same crate, so
/// #[cfg(test)] visibility is enough.
#[cfg(test)]
pub mod test_support {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    pub struct MemoryAvatarStore {
        files: Mutex<HashMap<String, StoredAvatar>>,
    }

    impl MemoryAvatarStore {
        fn checked(&self, id: &str) -> Result<String, AvatarStoreError> {
            if valid_id(id) {
                Ok(id.to_string())
            } else {
                Err(AvatarStoreError::InvalidId)
            }
        }
    }

    #[async_trait]
    impl AvatarStore for MemoryAvatarStore {
        async fn get(&self, id: &str) -> Result<Option<StoredAvatar>, AvatarStoreError> {
            let id = self.checked(id)?;
            Ok(self.files.lock().expect("lock").get(&id).cloned())
        }

        async fn save(&self, id: &str, avatar: StoredAvatar) -> Result<(), AvatarStoreError> {
            let id = self.checked(id)?;
            self.files.lock().expect("lock").insert(id, avatar);
            Ok(())
        }

        async fn delete(&self, id: &str) -> Result<bool, AvatarStoreError> {
            let id = self.checked(id)?;
            Ok(self.files.lock().expect("lock").remove(&id).is_some())
        }

        async fn exists(&self, id: &str) -> Result<bool, AvatarStoreError> {
            let id = self.checked(id)?;
            Ok(self.files.lock().expect("lock").contains_key(&id))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (FsAvatarStore, TempDir) {
        let dir = TempDir::new().expect("tempdir");
        let file_store = FsAvatarStore::new(dir.path().to_path_buf()).expect("create store");
        (file_store, dir)
    }

    fn png() -> StoredAvatar {
        StoredAvatar {
            bytes: vec![1, 2, 3],
            content_type: "image/png".to_string(),
        }
    }

    #[test]
    fn valid_id_accepts_kanidm_shapes() {
        for id in [
            "jdoe",
            "jdoe@example.com",
            "00000000-0000-0000-0000-000000000013",
            "a_b-c.d",
        ] {
            assert!(valid_id(id), "should accept {id}");
        }
    }

    #[test]
    fn valid_id_rejects_traversal_and_exotic_chars() {
        for id in ["", "..", "../evil", "a/b", "a\\b", "a b", "a:b", "%2e%2e", "a\nb"] {
            assert!(!valid_id(id), "should reject {id:?}");
        }
        assert!(!valid_id(&"x".repeat(65)), "should reject over-length id");
    }

    #[tokio::test]
    async fn fs_store_roundtrip() {
        let (file_store, _dir) = store();
        assert!(file_store.get("jdoe").await.unwrap().is_none());
        assert!(!file_store.exists("jdoe").await.unwrap());

        file_store.save("jdoe", png()).await.expect("save");

        let avatar = file_store.get("jdoe").await.unwrap().expect("saved avatar");
        assert_eq!(avatar.bytes, vec![1, 2, 3]);
        assert_eq!(avatar.content_type, "image/png");
        assert!(file_store.exists("jdoe").await.unwrap());
    }

    #[tokio::test]
    async fn fs_store_save_replaces_other_extension() {
        let (file_store, dir) = store();
        file_store.save("jdoe", png()).await.unwrap();
        file_store
            .save(
                "jdoe",
                StoredAvatar {
                    bytes: vec![9],
                    content_type: "image/jpeg".to_string(),
                },
            )
            .await
            .unwrap();

        // Exactly one file remains; the latest write wins.
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
        assert_eq!(file_store.get("jdoe").await.unwrap().unwrap().bytes, vec![9]);
    }

    #[tokio::test]
    async fn fs_store_delete() {
        let (file_store, _dir) = store();
        file_store.save("jdoe", png()).await.unwrap();
        assert!(file_store.delete("jdoe").await.unwrap());
        assert!(!file_store.delete("jdoe").await.unwrap());
        assert!(file_store.get("jdoe").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn fs_store_rejects_invalid_ids() {
        let (file_store, _dir) = store();
        for id in ["../evil", "a/b", ".."] {
            assert!(matches!(
                file_store.get(id).await,
                Err(AvatarStoreError::InvalidId)
            ));
            assert!(matches!(
                file_store.save(id, png()).await,
                Err(AvatarStoreError::InvalidId)
            ));
            assert!(matches!(
                file_store.delete(id).await,
                Err(AvatarStoreError::InvalidId)
            ));
        }
    }

    #[tokio::test]
    async fn fs_store_rejects_unknown_content_type() {
        let (file_store, _dir) = store();
        let result = file_store
            .save(
                "jdoe",
                StoredAvatar {
                    bytes: vec![1],
                    content_type: "text/plain".to_string(),
                },
            )
            .await;
        assert!(matches!(result, Err(AvatarStoreError::UnsupportedType(_))));
    }
}
