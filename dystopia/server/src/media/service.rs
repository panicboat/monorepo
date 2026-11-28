use std::fmt::Display;
use std::future::Future;
use std::sync::Arc;
use std::time::{Instant, SystemTime};

use async_trait::async_trait;
use chrono::Utc;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

use crate::access_log::AccessLogEntry;
use crate::auth::{Caller, parse_uuid, request_id, resolve_caller};
use crate::media::key::{extension_of, issued_to, key_for, owned_by, upload_content_type_allowed};
use crate::media::presenter::{media_type_name, to_proto};
use crate::media::repository::{MediaRepository, NewMedia};
use crate::media::storage::Storage;
use crate::stub::media::v1 as pb;
use crate::stub::media::v1::media_service_server::MediaService;

const SERVICE: &str = "media.v1.media_service";
const OWNER_TAG: &str = "owner-account-id";

pub struct MediaHandler {
    pool: PgPool,
    repo: MediaRepository,
    storage: Arc<dyn Storage>,
}

impl MediaHandler {
    pub fn new(pool: PgPool, storage: Arc<dyn Storage>) -> MediaHandler {
        MediaHandler {
            repo: MediaRepository::new(pool.clone()),
            pool,
            storage,
        }
    }

    async fn serve<M, R, Fut>(
        &self,
        method: &'static str,
        request: Request<M>,
        handle: impl FnOnce(Caller, M) -> Fut,
    ) -> Result<Response<R>, Status>
    where
        Fut: Future<Output = Result<R, Status>>,
    {
        let time = Utc::now();
        let timer = Instant::now();
        let (metadata, _, message) = request.into_parts();
        let (request_id, account_id, profile_id, result) =
            match resolve_caller(&self.pool, &metadata).await {
                Ok(caller) => {
                    let request_id = caller.request_id.clone();
                    let account_id = caller.account_id.clone();
                    let profile_id = caller.profile_id.map(|id| id.to_string());
                    let result = handle(caller, message).await;
                    (request_id, account_id, profile_id, result)
                }
                Err(error) => (request_id(&metadata), None, None, Err(unexpected(error))),
            };
        let error = result
            .as_ref()
            .err()
            .map(|status| (status.message().to_string(), format!("{:?}", status.code())));
        AccessLogEntry {
            time,
            request_id,
            method,
            service: SERVICE,
            account_id,
            profile_id,
            duration_ms: timer.elapsed().as_secs_f64() * 1000.0,
            error,
        }
        .emit();
        result.map(Response::new)
    }

    async fn issue_upload_url(
        &self,
        caller: Caller,
        message: pb::GetUploadUrlRequest,
    ) -> Result<pb::GetUploadUrlResponse, Status> {
        let profile_id = caller.require_profile()?;
        if message.filename.is_empty() || !upload_content_type_allowed(&message.content_type) {
            return Err(invalid_input());
        }
        let media_id = Uuid::now_v7().to_string();
        let media_key = key_for(
            &profile_id.to_string(),
            &media_id,
            &extension_of(&message.filename),
        );
        let upload_url = self
            .storage
            .upload_url(&media_key, &message.content_type)
            .await
            .map_err(unexpected)?;
        Ok(pb::GetUploadUrlResponse {
            upload_url,
            media_key,
            media_id,
        })
    }

    async fn register(
        &self,
        caller: Caller,
        message: pb::RegisterMediaRequest,
    ) -> Result<pb::RegisterMediaResponse, Status> {
        let profile_id = caller.require_profile()?;
        let profile = profile_id.to_string();
        let media_id = parse_uuid(&message.media_id)
            .filter(|_| issued_to(&message.media_key, &profile, &message.media_id))
            .ok_or_else(invalid_input)?;
        if !message.thumbnail_key.is_empty() && !owned_by(&message.thumbnail_key, &profile) {
            return Err(invalid_input());
        }
        let account_id = caller
            .account_id
            .ok_or_else(|| unexpected("the caller has no account"))?;
        let owner_account_id = Uuid::parse_str(&account_id).map_err(unexpected)?;
        // Tag before the row exists: an object that cannot be tagged was never uploaded.
        if !self
            .storage
            .tag(&message.media_key, &[(OWNER_TAG, &account_id)])
            .await
            .map_err(unexpected)?
        {
            return Err(Status::failed_precondition(
                "The file has not been uploaded",
            ));
        }
        let row = self
            .repo
            .create(&NewMedia {
                id: media_id,
                media_type: media_type_name(message.media_type).to_string(),
                filename: message.filename,
                content_type: message.content_type,
                size_bytes: message.size_bytes,
                media_key: message.media_key,
                thumbnail_key: Some(message.thumbnail_key).filter(|key| !key.is_empty()),
                uploader_profile_id: profile_id,
                owner_account_id,
            })
            .await
            .map_err(unexpected)?;
        let media = to_proto(&row, self.storage.as_ref(), SystemTime::now())
            .await
            .map_err(unexpected)?;
        Ok(pb::RegisterMediaResponse { media: Some(media) })
    }

    async fn delete(
        &self,
        caller: Caller,
        message: pb::DeleteMediaRequest,
    ) -> Result<pb::DeleteMediaResponse, Status> {
        let profile_id = caller.require_profile()?;
        let not_deleted = Ok(pb::DeleteMediaResponse { success: false });
        let Some(id) = parse_uuid(&message.id) else {
            return not_deleted;
        };
        let Some(row) = self.repo.find_by_id(id).await.map_err(unexpected)? else {
            return not_deleted;
        };
        if row.uploader_profile_id != Some(profile_id) {
            return not_deleted;
        }
        // A refused delete does not short-circuit: every key is tried, so it does not strand the other file.
        let mut all_deleted = true;
        for key in [&row.media_key, &row.thumbnail_key]
            .into_iter()
            .flatten()
            .filter(|key| !key.is_empty())
        {
            all_deleted &= self.storage.delete(key).await.map_err(unexpected)?;
        }
        if !all_deleted {
            return not_deleted;
        }
        self.repo.delete(id).await.map_err(unexpected)?;
        Ok(pb::DeleteMediaResponse { success: true })
    }
}

fn invalid_input() -> Status {
    Status::invalid_argument("Invalid input")
}

fn unexpected(error: impl Display) -> Status {
    eprintln!("[MediaHandler] Unexpected error: {error}");
    Status::internal("Internal error")
}

#[async_trait]
impl MediaService for MediaHandler {
    async fn get_upload_url(
        &self,
        request: Request<pb::GetUploadUrlRequest>,
    ) -> Result<Response<pb::GetUploadUrlResponse>, Status> {
        self.serve("get_upload_url", request, |caller, message| {
            self.issue_upload_url(caller, message)
        })
        .await
    }

    async fn register_media(
        &self,
        request: Request<pb::RegisterMediaRequest>,
    ) -> Result<Response<pb::RegisterMediaResponse>, Status> {
        self.serve("register_media", request, |caller, message| {
            self.register(caller, message)
        })
        .await
    }

    async fn delete_media(
        &self,
        request: Request<pb::DeleteMediaRequest>,
    ) -> Result<Response<pb::DeleteMediaResponse>, Status> {
        self.serve("delete_media", request, |caller, message| {
            self.delete(caller, message)
        })
        .await
    }
}
