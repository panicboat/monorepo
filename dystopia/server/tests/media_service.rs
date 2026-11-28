mod support;

use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use async_trait::async_trait;
use dystopia_server::media::repository::{MediaRepository, MediaRow};
use dystopia_server::media::service::MediaHandler;
use dystopia_server::media::storage::{Storage, StorageError};
use dystopia_server::stub::media::v1 as pb;
use dystopia_server::stub::media::v1::media_service_server::MediaService;
use sqlx::PgPool;
use support::{Cleanup, FakeStorage, pool};
use tonic::{Code, Request, Status};
use uuid::Uuid;

const IMAGE: i32 = pb::MediaType::Image as i32;
const VIDEO: i32 = pb::MediaType::Video as i32;

struct RecordingStorage {
    inner: Arc<FakeStorage>,
    deleted: Mutex<Vec<String>>,
}

#[async_trait]
impl Storage for RecordingStorage {
    async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError> {
        self.inner.upload_url(key, content_type).await
    }

    async fn download_url(&self, key: &str, now: SystemTime) -> Result<String, StorageError> {
        self.inner.download_url(key, now).await
    }

    async fn delete(&self, key: &str) -> bool {
        self.deleted.lock().unwrap().push(key.to_string());
        self.inner.delete(key).await
    }

    async fn tag(&self, key: &str, tags: &[(&str, &str)]) -> bool {
        self.inner.tag(key, tags).await
    }
}

#[derive(Clone, Copy)]
struct Actor {
    account: Uuid,
    profile: Uuid,
}

impl Actor {
    fn request<T>(&self, message: T) -> Request<T> {
        with_headers(
            message,
            &[
                ("x-user-id", &self.account.to_string()),
                ("x-profile-id", &self.profile.to_string()),
            ],
        )
    }
}

type Headers<'a> = Vec<(&'static str, &'a str)>;

fn with_headers<T>(message: T, headers: &[(&'static str, &str)]) -> Request<T> {
    let mut request = Request::new(message);
    for (name, value) in headers {
        request.metadata_mut().insert(*name, value.parse().unwrap());
    }
    request
}

fn key_for(profile: Uuid, media: Uuid, extension: &str) -> String {
    format!("media/{profile}/{media}{extension}")
}

fn register_request(
    media_id: &str,
    media_key: &str,
    media_type: i32,
    thumbnail_key: &str,
) -> pb::RegisterMediaRequest {
    pb::RegisterMediaRequest {
        media_id: media_id.to_string(),
        media_key: media_key.to_string(),
        media_type,
        filename: "a.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 10,
        thumbnail_key: thumbnail_key.to_string(),
    }
}

fn upload_request(filename: &str, content_type: &str) -> pb::GetUploadUrlRequest {
    pb::GetUploadUrlRequest {
        filename: filename.to_string(),
        content_type: content_type.to_string(),
        media_type: IMAGE,
    }
}

fn assert_status(status: &Status, code: Code, message: &str) {
    assert_eq!(status.code(), code, "{status:?}");
    assert_eq!(status.message(), message, "{status:?}");
}

struct Fixture {
    pool: PgPool,
    cleanup: Cleanup,
    fake: Arc<FakeStorage>,
    storage: Arc<RecordingStorage>,
    handler: MediaHandler,
    repo: MediaRepository,
}

impl Fixture {
    async fn new() -> Fixture {
        let pool = pool().await;
        let fake = Arc::new(FakeStorage::new());
        let storage = Arc::new(RecordingStorage {
            inner: fake.clone(),
            deleted: Mutex::new(Vec::new()),
        });
        Fixture {
            handler: MediaHandler::new(pool.clone(), storage.clone()),
            repo: MediaRepository::new(pool.clone()),
            pool,
            cleanup: Cleanup::new(),
            fake,
            storage,
        }
    }

    async fn actor(&self) -> Actor {
        let (account, profile) = self.cleanup.create_profile(&self.pool).await;
        Actor { account, profile }
    }

    fn media_id(&self) -> Uuid {
        let id = Uuid::now_v7();
        self.cleanup.track_media(id);
        id
    }

    async fn try_register(
        &self,
        actor: Actor,
        message: pb::RegisterMediaRequest,
    ) -> Result<pb::Media, Status> {
        let response = self.handler.register_media(actor.request(message)).await?;
        Ok(response.into_inner().media.expect("the media is returned"))
    }

    async fn register_as(
        &self,
        actor: Actor,
        media_type: i32,
        media_id: Uuid,
        thumbnail_key: &str,
    ) -> pb::Media {
        let key = key_for(actor.profile, media_id, ".png");
        let message = register_request(&media_id.to_string(), &key, media_type, thumbnail_key);
        self.try_register(actor, message)
            .await
            .expect("the media is registered")
    }

    async fn register(&self, actor: Actor) -> Uuid {
        let media_id = self.media_id();
        self.register_as(actor, IMAGE, media_id, "").await;
        media_id
    }

    async fn upload_url(&self, actor: Actor, filename: &str) -> pb::GetUploadUrlResponse {
        let message = upload_request(filename, "image/png");
        self.handler
            .get_upload_url(actor.request(message))
            .await
            .expect("the upload url is issued")
            .into_inner()
    }

    async fn delete(&self, actor: Actor, id: &str) -> bool {
        let message = pb::DeleteMediaRequest { id: id.to_string() };
        self.handler
            .delete_media(actor.request(message))
            .await
            .expect("the answer is returned")
            .into_inner()
            .success
    }

    async fn row(&self, id: Uuid) -> Option<MediaRow> {
        self.repo.find_by_id(id).await.unwrap()
    }

    async fn rows_of(&self, actor: Actor) -> i64 {
        sqlx::query_scalar("SELECT count(*) FROM media.files WHERE uploader_profile_id = $1")
            .bind(actor.profile)
            .fetch_one(&self.pool)
            .await
            .unwrap()
    }

    fn tagged(&self) -> Vec<(String, Vec<(String, String)>)> {
        let mut tagged: Vec<_> = self
            .fake
            .tagged
            .lock()
            .unwrap()
            .clone()
            .into_iter()
            .collect();
        tagged.sort();
        tagged
    }
}

#[tokio::test]
async fn records_the_uploader_and_owner() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;

    let media_id = fx.register(uploader).await;

    let row = fx.row(media_id).await.expect("the row exists");
    assert_eq!(row.uploader_profile_id, Some(uploader.profile));
    assert_eq!(row.owner_account_id, Some(uploader.account));
    assert_eq!(row.filename.as_deref(), Some("a.png"));
    assert_eq!(row.content_type.as_deref(), Some("image/png"));
    assert_eq!(row.size_bytes, Some(10));
    assert_eq!(
        row.media_key.as_deref(),
        Some(key_for(uploader.profile, media_id, ".png").as_str())
    );
}

#[tokio::test]
async fn stores_and_returns_the_media_type() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let ids = [fx.media_id(), fx.media_id(), fx.media_id(), fx.media_id()];

    let image = fx.register_as(uploader, IMAGE, ids[0], "").await;
    let video = fx.register_as(uploader, VIDEO, ids[1], "").await;
    let by_number = fx.register_as(uploader, 2, ids[2], "").await;
    let unspecified = fx.register_as(uploader, 0, ids[3], "").await;

    let stored: Vec<String> = {
        let mut names = Vec::new();
        for id in ids {
            names.push(fx.row(id).await.unwrap().media_type);
        }
        names
    };
    assert_eq!(stored, ["image", "video", "video", "unknown"]);
    assert_eq!(
        [
            image.media_type,
            video.media_type,
            by_number.media_type,
            unspecified.media_type
        ],
        [IMAGE, VIDEO, VIDEO, pb::MediaType::Unspecified as i32]
    );
}

#[tokio::test]
async fn issues_a_key_under_the_profile_without_the_account() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;

    let issued = fx.upload_url(uploader, "Photo.JPEG").await;

    let media_id = Uuid::parse_str(&issued.media_id).expect("the media id is a UUID");
    assert_eq!(media_id.get_version_num(), 7);
    assert_eq!(
        issued.media_key,
        format!("media/{}/{}.jpeg", uploader.profile, issued.media_id)
    );
    assert!(!issued.media_key.contains(&uploader.account.to_string()));
    assert!(
        issued
            .upload_url
            .contains(&issued.media_key.replace('/', "%2F")),
        "{}",
        issued.upload_url
    );
    assert!(issued.upload_url.contains("content_type=image%2Fpng"));
}

#[tokio::test]
async fn drops_an_extension_that_is_not_plain() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;

    for filename in ["photo.p ng", "photo.xxxxxxxxxxx", "photo.p%2Fg"] {
        let issued = fx.upload_url(uploader, filename).await;

        assert_eq!(
            issued.media_key,
            format!("media/{}/{}", uploader.profile, issued.media_id),
            "{filename:?}"
        );
    }
}

#[tokio::test]
async fn refuses_an_upload_url_for_a_bad_type_or_empty_name() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;

    for (filename, content_type) in [
        ("a.txt", "text/plain"),
        ("a.png", ""),
        ("a.png", "image/pngé"),
        ("a.png", "image/"),
        ("", "image/png"),
    ] {
        let status = fx
            .handler
            .get_upload_url(uploader.request(upload_request(filename, content_type)))
            .await
            .unwrap_err();

        assert_status(&status, Code::InvalidArgument, "Invalid input");
    }
}

#[tokio::test]
async fn tags_the_object_with_the_owning_account() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let media_id = fx.media_id();

    fx.register_as(uploader, IMAGE, media_id, "").await;

    assert_eq!(
        fx.tagged(),
        [(
            key_for(uploader.profile, media_id, ".png"),
            vec![("owner-account-id".to_string(), uploader.account.to_string())]
        )]
    );
}

#[tokio::test]
async fn registers_only_a_key_issued_to_the_profile() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let other = fx.actor().await;
    let media_id = fx.media_id();
    let media = media_id.to_string();
    let refused = [
        (media.clone(), key_for(other.profile, media_id, ".png")),
        (
            media.clone(),
            key_for(uploader.profile, Uuid::now_v7(), ".png"),
        ),
        (media.clone(), format!("media/image/{media_id}.png")),
        (
            media.clone(),
            format!(
                "media/{}/../{}/{media_id}.png",
                uploader.profile, other.profile
            ),
        ),
        (
            media.clone(),
            format!("{}/extra", key_for(uploader.profile, media_id, ".png")),
        ),
        (media.clone(), key_for(uploader.profile, media_id, ".p ng")),
        (
            "not-a-uuid".to_string(),
            format!("media/{}/not-a-uuid.png", uploader.profile),
        ),
    ];

    for (refused_id, media_key) in &refused {
        let message = register_request(refused_id, media_key, IMAGE, "");
        let status = fx.try_register(uploader, message).await.unwrap_err();

        assert_status(&status, Code::InvalidArgument, "Invalid input");
    }

    assert_eq!(fx.rows_of(uploader).await, 0);
    assert!(fx.tagged().is_empty());
    let accepted = register_request(&media, &key_for(uploader.profile, media_id, ""), IMAGE, "");
    let registered = fx.try_register(uploader, accepted).await.unwrap();
    assert_eq!(registered.id, media);
}

#[tokio::test]
async fn accepts_only_an_own_thumbnail() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let other = fx.actor().await;
    let victim_id = fx.register(other).await;
    let refused = [
        key_for(other.profile, victim_id, ".png"),
        format!("media/image/{victim_id}.png"),
        format!(
            "media/{}/../{}/{victim_id}.png",
            uploader.profile, other.profile
        ),
        "anything".to_string(),
    ];

    for thumbnail_key in &refused {
        let media_id = fx.media_id();
        let message = register_request(
            &media_id.to_string(),
            &key_for(uploader.profile, media_id, ".png"),
            IMAGE,
            thumbnail_key,
        );
        let status = fx.try_register(uploader, message).await.unwrap_err();

        assert_status(&status, Code::InvalidArgument, "Invalid input");
    }
    assert_eq!(fx.rows_of(uploader).await, 0);
    assert_eq!(fx.tagged().len(), 1, "only the victim's own file is tagged");

    let plain_id = fx.media_id();
    let plain = fx.register_as(uploader, IMAGE, plain_id, "").await;
    assert_eq!(fx.row(plain_id).await.unwrap().thumbnail_key, None);
    assert_eq!(plain.thumbnail_url, "");

    let own_thumbnail = key_for(uploader.profile, Uuid::now_v7(), ".jpg");
    let media_id = fx.media_id();
    let media = fx
        .register_as(uploader, IMAGE, media_id, &own_thumbnail)
        .await;
    assert_eq!(
        fx.row(media_id).await.unwrap().thumbnail_key.as_deref(),
        Some(own_thumbnail.as_str())
    );
    assert!(media.thumbnail_url.ends_with(&own_thumbnail));
}

#[tokio::test]
async fn refuses_a_file_that_was_never_uploaded() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let media_id = fx.media_id();
    fx.fake
        .missing_keys
        .lock()
        .unwrap()
        .push(key_for(uploader.profile, media_id, ".png"));

    let message = register_request(
        &media_id.to_string(),
        &key_for(uploader.profile, media_id, ".png"),
        IMAGE,
        "",
    );
    let status = fx.try_register(uploader, message).await.unwrap_err();

    assert_status(
        &status,
        Code::FailedPrecondition,
        "The file has not been uploaded",
    );
    assert!(fx.row(media_id).await.is_none());
}

#[tokio::test]
async fn lets_the_uploader_delete() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let media_id = fx.media_id();
    let thumbnail = key_for(uploader.profile, Uuid::now_v7(), ".jpg");
    fx.register_as(uploader, IMAGE, media_id, &thumbnail).await;

    assert!(fx.delete(uploader, &media_id.to_string()).await);

    assert!(fx.row(media_id).await.is_none());
    assert_eq!(
        *fx.storage.deleted.lock().unwrap(),
        [key_for(uploader.profile, media_id, ".png"), thumbnail]
    );
}

#[tokio::test]
async fn keeps_the_row_when_a_file_cannot_be_deleted() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let media_id = fx.media_id();
    let thumbnail = key_for(uploader.profile, Uuid::now_v7(), ".jpg");
    fx.register_as(uploader, IMAGE, media_id, &thumbnail).await;
    fx.fake
        .failing_deletes
        .store(true, std::sync::atomic::Ordering::SeqCst);

    assert!(!fx.delete(uploader, &media_id.to_string()).await);

    assert!(fx.row(media_id).await.is_some());
    assert_eq!(fx.storage.deleted.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn answers_false_for_others_and_unknown_ids() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let other = fx.actor().await;
    let media_id = fx.register(uploader).await;

    assert!(!fx.delete(other, &media_id.to_string()).await);
    assert!(!fx.delete(other, &Uuid::now_v7().to_string()).await);
    assert!(!fx.delete(uploader, &Uuid::now_v7().to_string()).await);
    assert!(!fx.delete(uploader, "not-a-uuid").await);
    assert!(!fx.delete(uploader, "").await);

    assert!(fx.row(media_id).await.is_some());
    assert!(fx.storage.deleted.lock().unwrap().is_empty());
}

#[tokio::test]
async fn no_one_deletes_a_row_without_an_uploader() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let other = fx.actor().await;
    let media_id = fx.media_id();
    sqlx::query(
        "INSERT INTO media.files (id, media_type, media_key, created_at) VALUES ($1, 'image', $2, now())",
    )
    .bind(media_id)
    .bind(format!("media/image/{media_id}.png"))
    .execute(&fx.pool)
    .await
    .unwrap();

    assert!(!fx.delete(other, &media_id.to_string()).await);
    assert!(!fx.delete(uploader, &media_id.to_string()).await);

    assert!(fx.row(media_id).await.is_some());
    assert!(fx.storage.deleted.lock().unwrap().is_empty());
}

#[tokio::test]
async fn refuses_every_rpc_without_a_profile_or_account() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let other = fx.actor().await;
    let media_id = fx.register(uploader).await;
    let (account, other_profile) = (uploader.account.to_string(), other.profile.to_string());
    let stranger = Uuid::now_v7().to_string();
    let cases: Vec<(Headers, Code, &str)> = vec![
        (vec![], Code::Unauthenticated, "Authentication required"),
        (
            vec![("x-user-id", &stranger)],
            Code::FailedPrecondition,
            "Active profile required",
        ),
        (
            vec![("x-user-id", "not-a-uuid")],
            Code::FailedPrecondition,
            "Active profile required",
        ),
        (
            vec![("x-user-id", &account), ("x-profile-id", &other_profile)],
            Code::PermissionDenied,
            "Profile is not available",
        ),
        (
            vec![("x-user-id", &account), ("x-profile-id", "not-a-uuid")],
            Code::PermissionDenied,
            "Profile is not available",
        ),
    ];

    for (headers, code, message) in &cases {
        let upload = fx
            .handler
            .get_upload_url(with_headers(upload_request("a.png", "image/png"), headers))
            .await
            .unwrap_err();
        let register = fx
            .handler
            .register_media(with_headers(
                register_request(&stranger, "media/x/y.png", IMAGE, ""),
                headers,
            ))
            .await
            .unwrap_err();
        let delete = fx
            .handler
            .delete_media(with_headers(
                pb::DeleteMediaRequest {
                    id: media_id.to_string(),
                },
                headers,
            ))
            .await
            .unwrap_err();

        for status in [upload, register, delete] {
            assert_status(&status, *code, message);
        }
    }

    assert_eq!(fx.rows_of(uploader).await, 1);
    assert!(fx.row(media_id).await.is_some());
    assert_eq!(fx.tagged().len(), 1);
}

#[tokio::test]
async fn answers_internal_without_details_when_the_database_fails() {
    let fx = Fixture::new().await;
    let uploader = fx.actor().await;
    let closed = pool().await;
    closed.close().await;
    let handler = MediaHandler::new(closed, fx.storage.clone());

    let status = handler
        .get_upload_url(uploader.request(upload_request("a.png", "image/png")))
        .await
        .unwrap_err();

    assert_status(&status, Code::Internal, "Internal error");
}
