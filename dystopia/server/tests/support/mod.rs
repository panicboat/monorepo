#![allow(dead_code)]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::SystemTime;

use async_trait::async_trait;
use dystopia_server::media::storage::{LocalStorage, Storage, StorageError};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

const DEFAULT_TEST_DATABASE_URL: &str = "postgres://postgres:password@localhost:5432/monolith_test";

pub async fn pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL").unwrap_or(DEFAULT_TEST_DATABASE_URL.to_string());
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .expect("the test database is reachable")
}

pub async fn create_profile(pool: &PgPool) -> (Uuid, Uuid) {
    let account_id = Uuid::now_v7();
    let profile_id = Uuid::now_v7();
    sqlx::query("INSERT INTO identity.accounts (id, role) VALUES ($1, 1)")
        .bind(account_id)
        .execute(pool)
        .await
        .expect("an account is inserted");
    sqlx::query(
        "INSERT INTO profile.profiles (id, account_id, display_name) VALUES ($1, $2, 'User')",
    )
    .bind(profile_id)
    .bind(account_id)
    .execute(pool)
    .await
    .expect("a profile is inserted");
    (account_id, profile_id)
}

#[derive(Default)]
pub struct FakeStorage {
    pub tagged: Mutex<HashMap<String, Vec<(String, String)>>>,
    pub missing_keys: Mutex<Vec<String>>,
    pub failing_deletes: AtomicBool,
}

impl FakeStorage {
    pub fn new() -> FakeStorage {
        FakeStorage::default()
    }

    // URLs come from LocalStorage, not a copy, so their shape cannot drift from the real adapter.
    fn urls() -> LocalStorage {
        LocalStorage {
            app_url: "http://localhost:3000".to_string(),
            uploads_dir: PathBuf::new(),
        }
    }
}

#[async_trait]
impl Storage for FakeStorage {
    async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError> {
        FakeStorage::urls().upload_url(key, content_type).await
    }

    async fn download_url(&self, key: &str, now: SystemTime) -> Result<String, StorageError> {
        FakeStorage::urls().download_url(key, now).await
    }

    async fn delete(&self, key: &str) -> bool {
        !key.is_empty() && !self.failing_deletes.load(Ordering::SeqCst)
    }

    async fn tag(&self, key: &str, tags: &[(&str, &str)]) -> bool {
        if key.is_empty()
            || self
                .missing_keys
                .lock()
                .unwrap()
                .iter()
                .any(|missing| missing == key)
        {
            return false;
        }
        self.tagged.lock().unwrap().insert(
            key.to_string(),
            tags.iter()
                .map(|(name, value)| (name.to_string(), value.to_string()))
                .collect(),
        );
        true
    }
}
