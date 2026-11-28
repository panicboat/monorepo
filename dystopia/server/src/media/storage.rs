use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use aws_sdk_s3::Client;
use aws_sdk_s3::error::{DisplayErrorContext, SdkError};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::types::{Tag, Tagging};

const UPLOAD_URL_EXPIRES_IN: Duration = Duration::from_secs(300);
const DOWNLOAD_URL_EXPIRES_IN: Duration = Duration::from_secs(7200);
const SIGNING_WINDOW_SECS: u64 = 3600;

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("failed to presign the request: {0}")]
    Presign(String),
    #[error("the storage request failed: {0}")]
    Request(String),
}

#[async_trait]
pub trait Storage: Send + Sync {
    async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError>;
    async fn download_url(&self, key: &str, now: SystemTime) -> Result<String, StorageError>;
    async fn delete(&self, key: &str) -> Result<bool, StorageError>;
    async fn tag(&self, key: &str, tags: &[(&str, &str)]) -> Result<bool, StorageError>;
}

pub fn signing_time(now: SystemTime) -> SystemTime {
    // FALLBACK: a clock before the epoch signs at the epoch.
    let seconds = now
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    UNIX_EPOCH + Duration::from_secs(seconds - seconds % SIGNING_WINDOW_SECS)
}

pub struct LocalStorage {
    pub app_url: String,
    pub uploads_dir: PathBuf,
}

impl LocalStorage {
    // Path::join replaces the base for an absolute key, File.join does not.
    fn path_of(&self, key: &str) -> PathBuf {
        self.uploads_dir.join(key.trim_start_matches('/'))
    }
}

// byte_serialize keeps `*` and escapes `~`, CGI.escape does the opposite.
fn cgi_escape(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes())
        .collect::<String>()
        .replace('*', "%2A")
        .replace("%7E", "~")
}

#[async_trait]
impl Storage for LocalStorage {
    async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError> {
        Ok(format!(
            "{}/storage/upload?key={}&content_type={}",
            self.app_url,
            cgi_escape(key),
            cgi_escape(content_type)
        ))
    }

    async fn download_url(&self, key: &str, _now: SystemTime) -> Result<String, StorageError> {
        if key.is_empty() {
            return Ok(String::new());
        }
        Ok(format!("{}/uploads/{key}", self.app_url))
    }

    async fn delete(&self, key: &str) -> Result<bool, StorageError> {
        if key.is_empty() {
            return Ok(false);
        }
        let path = self.path_of(key);
        if !path.exists() {
            return Ok(true);
        }
        match std::fs::remove_file(&path) {
            Ok(()) => Ok(true),
            Err(error) => {
                eprintln!("[Storage::LocalStorage] Failed to delete {key}: {error}");
                // FALLBACK: Return false when deletion fails.
                Ok(false)
            }
        }
    }

    // Local files carry no tags, so the owner is kept in the database row alone.
    async fn tag(&self, key: &str, _tags: &[(&str, &str)]) -> Result<bool, StorageError> {
        Ok(self.path_of(key).exists())
    }
}

pub struct S3Storage {
    client: Client,
    bucket: String,
}

impl S3Storage {
    pub async fn new(bucket: String, region: String) -> S3Storage {
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_config::Region::new(region))
            .load()
            .await;
        S3Storage::with_client(Client::new(&config), bucket)
    }

    pub fn with_client(client: Client, bucket: String) -> S3Storage {
        S3Storage { client, bucket }
    }
}

fn presign_error(error: impl std::error::Error) -> StorageError {
    StorageError::Presign(DisplayErrorContext(error).to_string())
}

fn request_error(error: impl std::error::Error) -> StorageError {
    StorageError::Request(DisplayErrorContext(error).to_string())
}

#[async_trait]
impl Storage for S3Storage {
    async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError> {
        let config = PresigningConfig::expires_in(UPLOAD_URL_EXPIRES_IN).map_err(presign_error)?;
        let request = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type(content_type)
            .presigned(config)
            .await
            .map_err(presign_error)?;
        Ok(request.uri().to_string())
    }

    // Signed at the start of the hour so the URL stays the same for an hour and browsers can cache the media.
    async fn download_url(&self, key: &str, now: SystemTime) -> Result<String, StorageError> {
        if key.is_empty() {
            return Ok(String::new());
        }
        let config = PresigningConfig::builder()
            .start_time(signing_time(now))
            .expires_in(DOWNLOAD_URL_EXPIRES_IN)
            .build()
            .map_err(presign_error)?;
        let request = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(config)
            .await
            .map_err(presign_error)?;
        Ok(request.uri().to_string())
    }

    async fn delete(&self, key: &str) -> Result<bool, StorageError> {
        if key.is_empty() {
            return Ok(false);
        }
        match self
            .client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            // Only a ServiceError is swallowed: Ruby rescues only Aws::S3::Errors::ServiceError, so other failures stay errors.
            Err(error @ SdkError::ServiceError(_)) => {
                eprintln!(
                    "[Storage::S3Storage] Failed to delete {key}: {}",
                    DisplayErrorContext(&error)
                );
                // FALLBACK: Return false when deletion fails.
                Ok(false)
            }
            Err(error) => Err(request_error(error)),
        }
    }

    async fn tag(&self, key: &str, tags: &[(&str, &str)]) -> Result<bool, StorageError> {
        if key.is_empty() {
            return Ok(false);
        }
        let tag_set = tags
            .iter()
            .map(|(name, value)| Tag::builder().key(*name).value(*value).build())
            .collect::<Result<Vec<_>, _>>()
            .map_err(request_error)?;
        let tagging = Tagging::builder()
            .set_tag_set(Some(tag_set))
            .build()
            .map_err(request_error)?;
        match self
            .client
            .put_object_tagging()
            .bucket(&self.bucket)
            .key(key)
            .tagging(tagging)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(error @ SdkError::ServiceError(_)) => {
                eprintln!(
                    "[Storage::S3Storage] Failed to tag {key}: {}",
                    DisplayErrorContext(&error)
                );
                // FALLBACK: Return false when the object is missing or cannot be tagged.
                Ok(false)
            }
            Err(error) => Err(request_error(error)),
        }
    }
}
#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::path::{Path, PathBuf};
    use std::sync::mpsc;
    use std::time::SystemTime;

    use aws_sdk_s3::Client;
    use aws_sdk_s3::config::retry::RetryConfig;
    use aws_sdk_s3::config::{BehaviorVersion, Credentials, Region};

    use super::*;

    fn at(rfc3339: &str) -> SystemTime {
        chrono::DateTime::parse_from_rfc3339(rfc3339)
            .unwrap()
            .into()
    }

    fn query_of(url: &str) -> HashMap<String, String> {
        url::Url::parse(url)
            .unwrap()
            .query_pairs()
            .into_owned()
            .collect()
    }

    fn client(endpoint: Option<&str>) -> Client {
        let mut config = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("ap-northeast-1"))
            .credentials_provider(Credentials::new("AKID", "SECRET", None, None, "test"))
            .retry_config(RetryConfig::disabled());
        if let Some(endpoint) = endpoint {
            config = config.endpoint_url(endpoint).force_path_style(true);
        }
        Client::from_conf(config.build())
    }

    fn s3() -> S3Storage {
        S3Storage::with_client(client(None), "media-bucket".to_string())
    }

    fn fake_s3(status: &'static str, body: &'static str) -> (String, mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0u8; 4096];
            loop {
                let read = stream.read(&mut buffer).unwrap();
                request.extend_from_slice(&buffer[..read]);
                let text = String::from_utf8_lossy(&request).to_string();
                if let Some((head, rest)) = text.split_once("\r\n\r\n") {
                    let length = head
                        .lines()
                        .filter_map(|line| {
                            line.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(str::to_owned)
                        })
                        .find_map(|value| value.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    if rest.len() >= length {
                        break;
                    }
                }
                if read == 0 {
                    break;
                }
            }
            let response = format!(
                "HTTP/1.1 {status}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
            sender
                .send(String::from_utf8_lossy(&request).to_string())
                .unwrap();
        });
        (endpoint, receiver)
    }

    fn closing_s3() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        std::thread::spawn(move || drop(listener.accept()));
        endpoint
    }

    fn uploads_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dystopia-storage-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn local(dir: &Path) -> LocalStorage {
        LocalStorage {
            app_url: "http://localhost:3000".to_string(),
            uploads_dir: dir.to_path_buf(),
        }
    }

    #[tokio::test]
    async fn local_urls_escape_the_key_like_cgi() {
        let storage = local(&uploads_dir());
        let url = storage
            .upload_url("media/a b/c.png", "image/png")
            .await
            .unwrap();
        assert!(
            url.starts_with("http://localhost:3000/storage/upload?"),
            "{url}"
        );
        assert!(
            url.contains("key=media%2Fa+b%2Fc.png&content_type=image%2Fpng"),
            "{url}"
        );
    }

    #[tokio::test]
    async fn local_urls_keep_the_tilde_and_escape_the_asterisk_like_cgi() {
        let storage = local(&uploads_dir());
        let url = storage.upload_url("a~b*c", "image/png").await.unwrap();
        assert!(url.contains("key=a~b%2Ac&"), "{url}");
    }

    #[tokio::test]
    async fn local_download_url_points_under_uploads() {
        let storage = local(&uploads_dir());
        let url = storage
            .download_url("media/p/m.png", SystemTime::now())
            .await
            .unwrap();
        assert_eq!(url, "http://localhost:3000/uploads/media/p/m.png");
    }

    #[tokio::test]
    async fn an_empty_key_has_no_download_url() {
        let local = local(&uploads_dir());
        assert_eq!(local.download_url("", SystemTime::now()).await.unwrap(), "");
        assert_eq!(s3().download_url("", SystemTime::now()).await.unwrap(), "");
    }

    #[tokio::test]
    async fn local_delete_removes_the_file_and_treats_a_missing_file_as_deleted() {
        let dir = uploads_dir();
        std::fs::create_dir_all(dir.join("media/p")).unwrap();
        std::fs::write(dir.join("media/p/m.png"), b"x").unwrap();
        let storage = local(&dir);
        assert!(storage.delete("media/p/m.png").await.unwrap());
        assert!(!dir.join("media/p/m.png").exists());
        assert!(storage.delete("media/p/m.png").await.unwrap());
    }

    #[tokio::test]
    async fn local_delete_refuses_an_empty_key_and_reports_a_failed_removal() {
        let dir = uploads_dir();
        std::fs::create_dir_all(dir.join("media")).unwrap();
        let storage = local(&dir);
        assert!(!storage.delete("").await.unwrap());
        assert!(
            !storage.delete("media").await.unwrap(),
            "a directory cannot be removed as a file"
        );
        assert!(dir.join("media").exists());
    }

    #[tokio::test]
    async fn local_delete_keeps_an_absolute_key_under_the_uploads_dir() {
        let dir = uploads_dir();
        let outside = uploads_dir().join("outside.png");
        std::fs::write(&outside, b"x").unwrap();
        let storage = local(&dir);
        assert!(storage.delete(outside.to_str().unwrap()).await.unwrap());
        assert!(outside.exists());
    }

    #[tokio::test]
    async fn local_tag_follows_whether_the_file_exists() {
        let dir = uploads_dir();
        std::fs::write(dir.join("m.png"), b"x").unwrap();
        let storage = local(&dir);
        assert!(
            storage
                .tag("m.png", &[("owner-account-id", "a")])
                .await
                .unwrap()
        );
        assert!(
            !storage
                .tag("missing.png", &[("owner-account-id", "a")])
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn s3_upload_url_signs_the_content_type() {
        let url = s3().upload_url("media/p/m.png", "image/png").await.unwrap();
        assert!(
            url.starts_with("https://media-bucket.s3.ap-northeast-1.amazonaws.com/media/p/m.png?"),
            "{url}"
        );
        let query = query_of(&url);
        assert_eq!(query["X-Amz-Expires"], "300");
        assert!(
            query["X-Amz-SignedHeaders"]
                .split(';')
                .any(|header| header == "content-type"),
            "{url}"
        );
    }

    #[tokio::test]
    async fn s3_download_url_is_signed_at_the_hour() {
        let storage = s3();
        let first = storage
            .download_url("media/p/m.png", at("2026-11-28T10:59:59Z"))
            .await
            .unwrap();
        let second = storage
            .download_url("media/p/m.png", at("2026-11-28T10:00:01Z"))
            .await
            .unwrap();
        let next_hour = storage
            .download_url("media/p/m.png", at("2026-11-28T11:00:00Z"))
            .await
            .unwrap();
        let query = query_of(&first);
        assert_eq!(query["X-Amz-Date"], "20261128T100000Z");
        assert_eq!(query["X-Amz-Expires"], "7200");
        assert_eq!(first, second);
        assert_ne!(first, next_hour);
    }

    #[test]
    fn signing_time_rounds_down_to_the_hour() {
        assert_eq!(
            signing_time(at("2026-11-28T10:59:59Z")),
            at("2026-11-28T10:00:00Z")
        );
        assert_eq!(
            signing_time(at("2026-11-28T10:00:00Z")),
            at("2026-11-28T10:00:00Z")
        );
        assert_eq!(
            signing_time(at("2026-11-28T11:00:00Z")),
            at("2026-11-28T11:00:00Z")
        );
    }

    #[tokio::test]
    async fn s3_delete_and_tag_refuse_an_empty_key_without_calling_s3() {
        let (endpoint, requests) = fake_s3("200 OK", "");
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        assert!(!storage.delete("").await.unwrap());
        assert!(!storage.tag("", &[("owner-account-id", "a")]).await.unwrap());
        assert!(requests.try_recv().is_err());
    }

    #[tokio::test]
    async fn s3_delete_succeeds_on_a_successful_response() {
        let (endpoint, requests) = fake_s3("204 No Content", "");
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        assert!(storage.delete("media/p/m.png").await.unwrap());
        let request = requests.recv().unwrap();
        assert!(
            request.starts_with("DELETE /media-bucket/media/p/m.png"),
            "{request}"
        );
    }

    #[tokio::test]
    async fn s3_delete_returns_false_on_a_service_error() {
        let (endpoint, _requests) = fake_s3(
            "403 Forbidden",
            "<Error><Code>AccessDenied</Code><Message>no</Message></Error>",
        );
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        assert!(!storage.delete("media/p/m.png").await.unwrap());
    }

    #[tokio::test]
    async fn s3_delete_fails_when_the_connection_closes() {
        let endpoint = closing_s3();
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        let error = storage.delete("media/p/m.png").await.unwrap_err();
        assert!(matches!(error, StorageError::Request(_)), "{error}");
    }

    #[tokio::test]
    async fn s3_tag_sends_the_tag_set() {
        let (endpoint, requests) = fake_s3("200 OK", "");
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        assert!(
            storage
                .tag("media/p/m.png", &[("owner-account-id", "acc-1")])
                .await
                .unwrap()
        );
        let request = requests.recv().unwrap();
        assert!(
            request.starts_with("PUT /media-bucket/media/p/m.png?tagging"),
            "{request}"
        );
        assert!(request.contains("<Key>owner-account-id</Key>"), "{request}");
        assert!(request.contains("<Value>acc-1</Value>"), "{request}");
    }

    #[tokio::test]
    async fn s3_tag_returns_false_when_the_object_is_missing() {
        let (endpoint, _requests) = fake_s3(
            "404 Not Found",
            "<Error><Code>NoSuchKey</Code><Message>gone</Message></Error>",
        );
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        assert!(
            !storage
                .tag("media/p/m.png", &[("owner-account-id", "acc-1")])
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn s3_tag_fails_when_the_connection_closes() {
        let endpoint = closing_s3();
        let storage = S3Storage::with_client(client(Some(&endpoint)), "media-bucket".to_string());
        let error = storage
            .tag("media/p/m.png", &[("owner-account-id", "acc-1")])
            .await
            .unwrap_err();
        assert!(matches!(error, StorageError::Request(_)), "{error}");
    }
}
