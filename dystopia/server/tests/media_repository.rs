mod support;

use std::time::SystemTime;

use chrono::{TimeZone, Utc};
use dystopia_server::media::presenter::to_proto;
use dystopia_server::media::repository::{MediaRepository, MediaRow, NewMedia};
use dystopia_server::stub::media::v1::MediaType;
use sqlx::PgPool;
use support::{FakeStorage, create_profile, pool};
use uuid::Uuid;

async fn purge(pool: &PgPool, id: Uuid) {
    sqlx::query("DELETE FROM media.files WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
}

fn row_with_nulls(id: Uuid) -> MediaRow {
    MediaRow {
        id,
        media_type: "image".to_string(),
        filename: None,
        content_type: None,
        size_bytes: None,
        media_key: None,
        thumbnail_key: None,
        created_at: Utc.with_ymd_and_hms(2026, 11, 28, 1, 2, 3).unwrap(),
        uploader_profile_id: None,
        owner_account_id: None,
    }
}

#[tokio::test]
async fn creates_and_reads_back_a_row() {
    let pool = pool().await;
    let (account_id, profile_id) = create_profile(&pool).await;
    let repository = MediaRepository::new(pool.clone());
    let id = Uuid::now_v7();
    let new = NewMedia {
        id,
        media_type: "video".to_string(),
        filename: "clip.mp4".to_string(),
        content_type: "video/mp4".to_string(),
        size_bytes: 4096,
        media_key: format!("media/{profile_id}/{id}.mp4"),
        thumbnail_key: Some(format!("media/{profile_id}/{id}-thumb.jpg")),
        uploader_profile_id: profile_id,
        owner_account_id: account_id,
    };

    let created = repository.create(&new).await.unwrap();
    let found = repository.find_by_id(id).await.unwrap().unwrap();

    assert_eq!(created.id, id);
    assert_eq!(found.media_type, "video");
    assert_eq!(found.filename.as_deref(), Some("clip.mp4"));
    assert_eq!(found.content_type.as_deref(), Some("video/mp4"));
    assert_eq!(found.size_bytes, Some(4096));
    assert_eq!(found.media_key.as_deref(), Some(new.media_key.as_str()));
    assert_eq!(found.thumbnail_key, new.thumbnail_key);
    assert_eq!(found.uploader_profile_id, Some(profile_id));
    assert_eq!(found.owner_account_id, Some(account_id));
    assert_eq!(found.created_at, created.created_at);
    assert!(
        Utc::now()
            .signed_duration_since(found.created_at)
            .num_seconds()
            .abs()
            < 60
    );
    purge(&pool, id).await;
}

#[tokio::test]
async fn reads_a_row_ruby_wrote_with_nulls() {
    let pool = pool().await;
    let repository = MediaRepository::new(pool.clone());
    let id = Uuid::now_v7();
    sqlx::query("INSERT INTO media.files (id, media_type, media_key) VALUES ($1, 'image', $2)")
        .bind(id)
        .bind(format!("media/image/{id}.png"))
        .execute(&pool)
        .await
        .unwrap();

    let found = repository.find_by_id(id).await.unwrap().unwrap();

    assert_eq!(found.media_type, "image");
    assert_eq!(found.media_key, Some(format!("media/image/{id}.png")));
    assert_eq!(found.filename, None);
    assert_eq!(found.content_type, None);
    assert_eq!(found.size_bytes, None);
    assert_eq!(found.thumbnail_key, None);
    assert_eq!(found.uploader_profile_id, None);
    assert_eq!(found.owner_account_id, None);
    purge(&pool, id).await;
}

#[tokio::test]
async fn deletes_a_row() {
    let pool = pool().await;
    let (account_id, profile_id) = create_profile(&pool).await;
    let repository = MediaRepository::new(pool.clone());
    let id = Uuid::now_v7();
    repository
        .create(&NewMedia {
            id,
            media_type: "image".to_string(),
            filename: "a.png".to_string(),
            content_type: "image/png".to_string(),
            size_bytes: 1,
            media_key: format!("media/{profile_id}/{id}.png"),
            thumbnail_key: None,
            uploader_profile_id: profile_id,
            owner_account_id: account_id,
        })
        .await
        .unwrap();

    repository.delete(id).await.unwrap();

    assert!(repository.find_by_id(id).await.unwrap().is_none());
    repository.delete(id).await.unwrap();
}

#[tokio::test]
async fn presents_nulls_as_empty_values() {
    let id = Uuid::now_v7();

    let media = to_proto(&row_with_nulls(id), &FakeStorage::new(), SystemTime::now())
        .await
        .unwrap();

    assert_eq!(media.id, id.to_string());
    assert_eq!(media.media_type, MediaType::Image as i32);
    assert_eq!(media.url, "");
    assert_eq!(media.thumbnail_url, "");
    assert_eq!(media.filename, "");
    assert_eq!(media.content_type, "");
    assert_eq!(media.size_bytes, 0);
    assert_eq!(media.created_at, "2026-11-28T01:02:03+00:00");
}

#[tokio::test]
async fn presents_urls_and_columns_of_a_full_row() {
    let id = Uuid::now_v7();
    let row = MediaRow {
        media_type: "video".to_string(),
        filename: Some("clip.mp4".to_string()),
        content_type: Some("video/mp4".to_string()),
        size_bytes: Some(4096),
        media_key: Some("media/p/m.mp4".to_string()),
        thumbnail_key: Some("media/p/m-thumb.jpg".to_string()),
        ..row_with_nulls(id)
    };

    let media = to_proto(&row, &FakeStorage::new(), SystemTime::now())
        .await
        .unwrap();

    assert_eq!(media.media_type, MediaType::Video as i32);
    assert_eq!(media.url, "http://localhost:3000/uploads/media/p/m.mp4");
    assert_eq!(
        media.thumbnail_url,
        "http://localhost:3000/uploads/media/p/m-thumb.jpg"
    );
    assert_eq!(media.filename, "clip.mp4");
    assert_eq!(media.content_type, "video/mp4");
    assert_eq!(media.size_bytes, 4096);
}
