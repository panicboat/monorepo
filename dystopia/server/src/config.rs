use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageKind {
    Local,
    S3,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub bind_address: SocketAddr,
    pub database_url: String,
    pub storage: StorageKind,
    pub app_url: String,
    pub local_uploads_dir: PathBuf,
    pub media_bucket_name: Option<String>,
    pub media_bucket_region: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("{0} is required")]
    Missing(&'static str),
    #[error("MEDIA_STORAGE must be `local` or `s3`, got `{0}`")]
    UnknownStorage(String),
    #[error("SERVER_BIND_ADDRESS must be a socket address, got `{0}`")]
    InvalidBindAddress(String),
}

impl Config {
    pub fn from_vars(get: impl Fn(&str) -> Option<String>) -> Result<Config, ConfigError> {
        // Empty values count as unset so that `KEY=` falls back to the default instead of failing later.
        let var = |key: &str| get(key).filter(|value| !value.is_empty());
        let var_or = |key: &str, default: &str| var(key).unwrap_or_else(|| default.to_string());

        let database_url = var("DATABASE_URL").ok_or(ConfigError::Missing("DATABASE_URL"))?;

        let bind_address = var_or("SERVER_BIND_ADDRESS", "127.0.0.1:9002");
        let bind_address = bind_address
            .parse()
            .map_err(|_| ConfigError::InvalidBindAddress(bind_address))?;

        let storage = match var_or("MEDIA_STORAGE", "local").as_str() {
            "local" => StorageKind::Local,
            "s3" => StorageKind::S3,
            other => return Err(ConfigError::UnknownStorage(other.to_string())),
        };

        let media_bucket_name = var("MEDIA_BUCKET_NAME");
        if storage == StorageKind::S3 && media_bucket_name.is_none() {
            return Err(ConfigError::Missing("MEDIA_BUCKET_NAME"));
        }

        Ok(Config {
            bind_address,
            database_url,
            storage,
            app_url: var_or("APP_URL", "http://localhost:3000"),
            local_uploads_dir: PathBuf::from(var_or(
                "LOCAL_UPLOADS_DIR",
                "../monolith/public/uploads",
            )),
            media_bucket_name,
            media_bucket_region: var_or("MEDIA_BUCKET_REGION", "ap-northeast-1"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn load(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let vars: HashMap<String, String> = pairs
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect();
        Config::from_vars(|key| vars.get(key).cloned())
    }

    #[test]
    fn defaults_to_local_storage_on_the_local_port() {
        let config = load(&[("DATABASE_URL", "postgres://localhost/x")]).unwrap();

        assert_eq!(config.bind_address, "127.0.0.1:9002".parse().unwrap());
        assert_eq!(config.database_url, "postgres://localhost/x");
        assert_eq!(config.storage, StorageKind::Local);
        assert_eq!(config.app_url, "http://localhost:3000");
        assert_eq!(
            config.local_uploads_dir,
            PathBuf::from("../monolith/public/uploads")
        );
        assert_eq!(config.media_bucket_name, None);
        assert_eq!(config.media_bucket_region, "ap-northeast-1");
    }

    #[test]
    fn requires_the_database_url() {
        assert_eq!(load(&[]), Err(ConfigError::Missing("DATABASE_URL")));
        assert_eq!(
            load(&[("DATABASE_URL", "")]),
            Err(ConfigError::Missing("DATABASE_URL"))
        );
    }

    #[test]
    fn requires_the_bucket_for_s3_storage() {
        let result = load(&[
            ("DATABASE_URL", "postgres://localhost/x"),
            ("MEDIA_STORAGE", "s3"),
        ]);

        assert_eq!(result, Err(ConfigError::Missing("MEDIA_BUCKET_NAME")));
    }

    #[test]
    fn rejects_an_unknown_storage_kind() {
        let result = load(&[
            ("DATABASE_URL", "postgres://localhost/x"),
            ("MEDIA_STORAGE", "gcs"),
        ]);

        assert_eq!(result, Err(ConfigError::UnknownStorage("gcs".to_string())));
    }

    #[test]
    fn reads_every_override() {
        let config = load(&[
            ("DATABASE_URL", "postgres://db/media"),
            ("SERVER_BIND_ADDRESS", "127.0.0.1:50052"),
            ("MEDIA_STORAGE", "s3"),
            ("APP_URL", "https://example.test"),
            ("LOCAL_UPLOADS_DIR", "/var/uploads"),
            ("MEDIA_BUCKET_NAME", "media-bucket"),
            ("MEDIA_BUCKET_REGION", "us-east-1"),
        ])
        .unwrap();

        assert_eq!(config.bind_address, "127.0.0.1:50052".parse().unwrap());
        assert_eq!(config.storage, StorageKind::S3);
        assert_eq!(config.app_url, "https://example.test");
        assert_eq!(config.local_uploads_dir, PathBuf::from("/var/uploads"));
        assert_eq!(config.media_bucket_name.as_deref(), Some("media-bucket"));
        assert_eq!(config.media_bucket_region, "us-east-1");
    }

    #[test]
    fn rejects_an_invalid_bind_address() {
        let result = load(&[
            ("DATABASE_URL", "postgres://localhost/x"),
            ("SERVER_BIND_ADDRESS", "not-an-address"),
        ]);

        assert_eq!(
            result,
            Err(ConfigError::InvalidBindAddress(
                "not-an-address".to_string()
            ))
        );
    }
}
