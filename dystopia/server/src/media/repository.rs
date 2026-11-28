use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, sqlx::FromRow)]
pub struct MediaRow {
    pub id: Uuid,
    pub media_type: String,
    pub filename: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub media_key: Option<String>,
    pub thumbnail_key: Option<String>,
    pub created_at: DateTime<Utc>,
    pub uploader_profile_id: Option<Uuid>,
    pub owner_account_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub struct NewMedia {
    pub id: Uuid,
    pub media_type: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub media_key: String,
    pub thumbnail_key: Option<String>,
    pub uploader_profile_id: Uuid,
    pub owner_account_id: Uuid,
}

// sqlx 0.9 accepts only 'static SQL, so the column list is shared through concat! instead of format!.
macro_rules! columns {
    () => {
        "id, media_type, filename, content_type, size_bytes, media_key, \
         thumbnail_key, created_at, uploader_profile_id, owner_account_id"
    };
}

const FIND_BY_ID: &str = concat!("SELECT ", columns!(), " FROM media.files WHERE id = $1");

const INSERT: &str = concat!(
    "INSERT INTO media.files (id, media_type, filename, content_type, size_bytes, media_key, \
     thumbnail_key, uploader_profile_id, owner_account_id) \
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ",
    columns!()
);

pub struct MediaRepository {
    pool: PgPool,
}

impl MediaRepository {
    pub fn new(pool: PgPool) -> MediaRepository {
        MediaRepository { pool }
    }

    pub async fn find_by_id(&self, id: Uuid) -> sqlx::Result<Option<MediaRow>> {
        sqlx::query_as(FIND_BY_ID)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn create(&self, new: &NewMedia) -> sqlx::Result<MediaRow> {
        sqlx::query_as(INSERT)
            .bind(new.id)
            .bind(&new.media_type)
            .bind(&new.filename)
            .bind(&new.content_type)
            .bind(new.size_bytes)
            .bind(&new.media_key)
            .bind(&new.thumbnail_key)
            .bind(new.uploader_profile_id)
            .bind(new.owner_account_id)
            .fetch_one(&self.pool)
            .await
    }

    pub async fn delete(&self, id: Uuid) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM media.files WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
