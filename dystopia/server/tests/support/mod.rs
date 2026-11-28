#![allow(dead_code)]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::SystemTime;

use async_trait::async_trait;
use dystopia_server::media::storage::{LocalStorage, Storage, StorageError};
use sqlx::postgres::PgPoolOptions;
use sqlx::{Connection, PgConnection, PgPool};
use uuid::Uuid;

const DEFAULT_TEST_DATABASE_URL: &str = "postgres://postgres:password@localhost:5432/monolith_test";

fn database_url() -> String {
    std::env::var("TEST_DATABASE_URL").unwrap_or(DEFAULT_TEST_DATABASE_URL.to_string())
}

pub async fn pool() -> PgPool {
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url())
        .await
        .expect("the test database is reachable")
}

pub async fn create_profile(pool: &PgPool) -> (Uuid, Uuid) {
    insert_profile(pool, Uuid::now_v7(), Uuid::now_v7()).await
}

async fn insert_profile(pool: &PgPool, account_id: Uuid, profile_id: Uuid) -> (Uuid, Uuid) {
    sqlx::query("INSERT INTO identity.accounts (id, role) VALUES ($1, 1)")
        .bind(account_id)
        .execute(pool)
        .await
        .expect("an account is inserted");
    insert_profile_row(pool, account_id, profile_id).await;
    (account_id, profile_id)
}

async fn insert_profile_row(pool: &PgPool, account_id: Uuid, profile_id: Uuid) {
    sqlx::query(
        "INSERT INTO profile.profiles (id, account_id, display_name) VALUES ($1, $2, 'User')",
    )
    .bind(profile_id)
    .bind(account_id)
    .execute(pool)
    .await
    .expect("a profile is inserted");
}

// Removal runs in Drop, not at the end of a test, so a failing test leaves no row for Ruby's count specs.
#[derive(Default)]
pub struct Cleanup {
    media_ids: Mutex<Vec<Uuid>>,
    account_ids: Mutex<Vec<Uuid>>,
}

impl Cleanup {
    pub fn new() -> Cleanup {
        Cleanup::default()
    }

    pub fn track_media(&self, id: Uuid) {
        self.media_ids.lock().unwrap().push(id);
    }

    pub fn track_account(&self, id: Uuid) {
        self.account_ids.lock().unwrap().push(id);
    }

    pub async fn create_profile(&self, pool: &PgPool) -> (Uuid, Uuid) {
        let account_id = Uuid::now_v7();
        self.track_account(account_id);
        insert_profile(pool, account_id, Uuid::now_v7()).await
    }

    // The account must come from create_profile, which tracks it, so Drop removes the added profile too.
    pub async fn add_profile(&self, pool: &PgPool, account_id: Uuid) -> Uuid {
        let profile_id = Uuid::now_v7();
        insert_profile_row(pool, account_id, profile_id).await;
        profile_id
    }
}

pub async fn disable_profile(pool: &PgPool, profile_id: Uuid) {
    sqlx::query("UPDATE profile.profiles SET disabled_at = now() WHERE id = $1")
        .bind(profile_id)
        .execute(pool)
        .await
        .expect("a profile is disabled");
}

pub async fn deactivate_account(pool: &PgPool, account_id: Uuid) {
    sqlx::query("UPDATE identity.accounts SET deactivated_at = now() WHERE id = $1")
        .bind(account_id)
        .execute(pool)
        .await
        .expect("an account is deactivated");
}

async fn remove_rows(media_ids: Vec<Uuid>, account_ids: Vec<Uuid>) -> sqlx::Result<()> {
    let mut connection = PgConnection::connect(&database_url()).await?;
    sqlx::query(
        "DELETE FROM media.files WHERE id = ANY($1) OR owner_account_id = ANY($2) \
         OR uploader_profile_id IN (SELECT id FROM profile.profiles WHERE account_id = ANY($2))",
    )
    .bind(&media_ids)
    .bind(&account_ids)
    .execute(&mut connection)
    .await?;
    sqlx::query("DELETE FROM profile.profiles WHERE account_id = ANY($1)")
        .bind(&account_ids)
        .execute(&mut connection)
        .await?;
    sqlx::query("DELETE FROM identity.accounts WHERE id = ANY($1)")
        .bind(&account_ids)
        .execute(&mut connection)
        .await?;
    Ok(())
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        let media_ids = std::mem::take(&mut *self.media_ids.lock().unwrap());
        let account_ids = std::mem::take(&mut *self.account_ids.lock().unwrap());
        // A pool belongs to the test's runtime, so a thread with its own runtime and connection removes the rows.
        let outcome = std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("a runtime is built")
                .block_on(remove_rows(media_ids, account_ids))
        })
        .join();
        match outcome {
            Ok(Ok(())) => {}
            // SILENT: a panic in Drop while unwinding aborts the process, so a failed cleanup is only logged.
            Ok(Err(error)) => eprintln!("[support::Cleanup] Failed to remove rows: {error}"),
            Err(_) => eprintln!("[support::Cleanup] The cleanup thread panicked"),
        }
    }
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
