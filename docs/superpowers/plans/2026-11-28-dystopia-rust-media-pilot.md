# Dystopia Rust Media Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `media.v1.MediaService` の 3 つの RPC を Rust の gRPC サーバー（`dystopia/server`）で作り、Ruby と並べて本番の Lambda に同居させ、比較の測定値を報告する。

**Architecture:** Rust のサーバーは Ruby と同じ DB の `media.files` と同じ S3 バケットを使い、Ruby の media slice と同じ挙動を返す。frontend の `mediaClient` だけが `MEDIA_SERVICE_URL` で Rust に向き、未設定なら今までどおり `MONOLITH_URL`（Ruby）に向く。Ruby のコードは変えない。

**Tech Stack:** Rust 1.100.0、tokio、tonic・prost、sqlx（postgres・rustls）、aws-sdk-s3、buf（stub 生成）、Next.js（ConnectRPC）、Lambda Web Adapter、OpenTofu。

**Spec:** `docs/superpowers/specs/2026-11-28-dystopia-rust-media-pilot-design.md`（Issue #2092）

## Global Constraints

- 利用者から見た挙動は `dystopia/docs/features/media.md` と Ruby の `dystopia/monolith/spec/slices/media/grpc/handler_spec.rb` に合わせる。
- Ruby のコード（`dystopia/monolith/**`）は変えない。
- EKS 用の manifest（`dystopia/*/kubernetes`・`clusters/**`）は変えない。
- `dystopia/server` に `Dockerfile` を置かない（`workflow-config.yaml` の container stack の対象にしないため）。
- Rust の gRPC は `127.0.0.1` で待ち受ける。Lambda では `127.0.0.1:50052`、ローカルの既定は `127.0.0.1:9002`、e2e は `127.0.0.1:9056`。
- 環境変数: `SERVER_BIND_ADDRESS`・`DATABASE_URL`（必須）・`MEDIA_STORAGE`（`local` | `s3`、既定 `local`）・`APP_URL`（既定 `http://localhost:3000`）・`LOCAL_UPLOADS_DIR`（既定 `../monolith/public/uploads`）・`MEDIA_BUCKET_NAME`（`s3` のとき必須）・`MEDIA_BUCKET_REGION`（既定 `ap-northeast-1`）。frontend は `MEDIA_SERVICE_URL`。
- アップロード URL の有効期限 300 秒、配信 URL は毎時の境界時刻で署名し有効期限 7200 秒。
- タグの名前は `owner-account-id`。
- DB の接続数の上限は 2。
- SQL は `sqlx::query`・`sqlx::query_as` の実行時の照合だけを使い、`query!` マクロは使わない（CI で DB や `.sqlx` を要らなくするため）。
- crate を Cargo.toml に足す前と、負荷ツール（ghz）を入れる前に、ユーザーの承認を得る。
- コミットは `git commit -s`、`Co-Authored-By` を付けない。type は `feat(dystopia/server)` のように付ける。
- コードコメントは英語 1 行で、Why not だけを書く。タスクや修正への言及を書かない。

## Review Focus

1. Unicode の文字を含む MIME 種別（例 `image/pngé`）は、Ruby の `\w` が ASCII だけなので拒否される → Task 2 のテストで固定する。
2. Ruby が書いた古い行（`filename`・`content_type`・`size_bytes`・`thumbnail_key`・`uploader_profile_id` が NULL、キーが `media/image/...`）を Rust が読んでも落ちない → Task 4 と Task 6 のテストで固定する。
3. UUID でない `media_id`・`id`・`x-user-id`・`x-profile-id` で INTERNAL が返らない → Task 5 と Task 6 のテストで固定する。
4. 署名付きのアップロード URL は Content-Type を署名に含み、画面が送る Content-Type でしか PUT できない → Task 3 のテストで `X-Amz-SignedHeaders` に `content-type` があることを固定する。
5. `created_at` の文字列が Ruby と同じ形（秒まで、`+00:00`）になる → Task 4 のテストで固定する。

---

## File Structure

- `dystopia/server/Cargo.toml`・`Cargo.lock`・`rust-toolchain.toml`: package `dystopia-server`、bin `dystopia-server`。
- `dystopia/server/buf.gen.yaml`・`bin/codegen`: media の proto だけから Rust の stub を `src/stub/` に生成する。
- `dystopia/server/src/main.rs`: 設定を読み、DB・storage を用意して gRPC を起動する。
- `dystopia/server/src/lib.rs`: モジュールの公開（テストから使う）。
- `dystopia/server/src/config.rs`: 環境変数の読み取り。
- `dystopia/server/src/auth.rs`: metadata から使うアカウントとプロフィールを決める。
- `dystopia/server/src/access_log.rs`: 1 RPC 1 行の JSON。
- `dystopia/server/src/media/{mod,key,storage,repository,presenter,service}.rs`: media slice。
- `dystopia/server/tests/support/mod.rs`: テスト用の DB 接続・データ作成・偽の storage。
- `dystopia/server/tests/{auth,media_service}.rs`: DB を使うテスト。
- `.github/workflows/dystopia-server-test.yaml`: Rust の CI。
- `dystopia/frontend/src/lib/grpc-endpoints.ts`（新規）・`grpc.ts`（変更）。
- `dystopia/lambda/image/{Dockerfile,Dockerfile.dockerignore,start}`、`dystopia/lambda/aws/modules/lambda.tf`・`tests/hosting.tftest.hcl`、`.github/workflows/deploy-dystopia-lambda.yaml`。
- `dystopia/e2e/bin/stack`・`.github/workflows/dystopia-e2e.yaml`。

---

### Task 1: Server scaffold, stub generation, config and CI

**Files:**
- Create: `dystopia/server/Cargo.toml`・`rust-toolchain.toml`・`buf.gen.yaml`・`bin/codegen`・`src/main.rs`・`src/lib.rs`・`src/config.rs`・`src/stub/`（生成物）・`.gitignore`（`/target`）
- Create: `.github/workflows/dystopia-server-test.yaml`
- Test: `dystopia/server/src/config.rs` の `#[cfg(test)]`

**Interfaces:**
- Produces:
  - `pub enum StorageKind { Local, S3 }`
  - `pub struct Config { pub bind_address: std::net::SocketAddr, pub database_url: String, pub storage: StorageKind, pub app_url: String, pub local_uploads_dir: std::path::PathBuf, pub media_bucket_name: Option<String>, pub media_bucket_region: String }`
  - `impl Config { pub fn from_vars(get: impl Fn(&str) -> Option<String>) -> Result<Config, ConfigError> }`（`main` は `std::env::var(..).ok()` を渡す）
  - 生成された stub のモジュール `dystopia_server::stub::media::v1`（`MediaService` trait・`MediaServiceServer`・各 message）

- [ ] **Step 1: crate の一覧をユーザーに示して承認を得る**

一覧: `tokio`・`tonic`・`prost`・`sqlx`（features: `postgres`・`runtime-tokio`・`tls-rustls`・`uuid`・`chrono`）・`aws-config`・`aws-sdk-s3`・`uuid`（`v4`・`v7`）・`chrono`・`regex`・`serde`・`serde_json`・`url`・`thiserror`・`async-trait`。
版は `cargo add` で入る最新を使い、tonic・prost の版に合う buf の remote plugin（`buf.build/community/neoeinstein-prost`・`neoeinstein-tonic`）の版を buf.build の plugin ページで確かめて `buf.gen.yaml` に固定する。
完了条件: ユーザーの承認。

- [ ] **Step 2: `rust-toolchain.toml` を `channel = "1.100.0"`、components `rustfmt`・`clippy` で作り、`cargo init --bin --name dystopia-server` と crate の追加を行う**

- [ ] **Step 3: `bin/codegen` を作る**

`buf generate ../../proto/dystopia --template buf.gen.yaml --path ../../proto/dystopia/media` を実行し、`src/stub/` に出力する。
`src/stub/mod.rs` は `pub mod media { pub mod v1 { include!("media.v1.rs"); } }` の形（生成されたファイル名に合わせる）。
完了条件: `./bin/codegen` が成功し、`git status` に `dystopia/server/src/stub/` 以外の生成物の差分がない。

- [ ] **Step 4: config の失敗するテストを書く**

```rust
#[test] fn defaults_to_local_storage_on_the_local_port()  // DATABASE_URL だけ → bind 127.0.0.1:9002, Local, app_url "http://localhost:3000", local_uploads_dir "../monolith/public/uploads", region "ap-northeast-1"
#[test] fn requires_the_database_url()                    // 空 → Err
#[test] fn requires_the_bucket_for_s3_storage()           // MEDIA_STORAGE=s3, MEDIA_BUCKET_NAME 無し → Err
#[test] fn rejects_an_unknown_storage_kind()              // MEDIA_STORAGE=gcs → Err
```

- [ ] **Step 5: `cargo test config` が FAIL することを確かめる**

- [ ] **Step 6: `Config::from_vars` を実装し、`main` で `MediaServiceServer` を登録せずに `tonic::transport::Server` を `bind_address` で起動するところまで書く**

- [ ] **Step 7: `cargo test config` が PASS、`DATABASE_URL=postgres://localhost/x cargo run` で待ち受けを始めることを確かめる**

- [ ] **Step 8: CI の workflow を作る**

`dystopia-monolith-test.yaml` を元にする。
- `on.pull_request.paths`: `dystopia/server/**`・`.github/workflows/dystopia-server-test.yaml`。
- postgres service と、Ruby の setup・PostgreSQL 18 client・`hanami db create`・`hanami db migrate --no-dump`（`working-directory: dystopia/monolith`、`HANAMI_ENV: test`）を同じ手順で持つ。
- Rust の手順は `working-directory: dystopia/server` で `cargo fmt --check`・`cargo clippy --all-targets -- -D warnings`・`cargo test`。
- `TEST_DATABASE_URL: postgres://postgres:password@localhost:5432/monolith_test` を渡す。
完了条件: `actionlint` が通る（無ければ YAML の構文確認のみ）。

- [ ] **Step 9: Commit**

```bash
git add dystopia/server .github/workflows/dystopia-server-test.yaml
git commit -s -m "feat(dystopia/server): add the Rust gRPC server scaffold"
```

---

### Task 2: Media keys and input rules

**Files:**
- Create: `dystopia/server/src/media/mod.rs`・`src/media/key.rs`
- Test: `src/media/key.rs` の `#[cfg(test)]`

**Interfaces:**
- Produces（すべて `dystopia_server::media::key`）:
  - `pub fn key_for(profile_id: &str, media_id: &str, extension: &str) -> String` → `media/<profile>/<media><extension>`
  - `pub fn extension_of(filename: &str) -> String` → Ruby の `File.extname(filename).downcase` が `\A\.[a-z0-9]{1,10}\z` に合えばそれ、合わなければ `""`
  - `pub fn upload_content_type_allowed(content_type: &str) -> bool` → `\A(image|video)/[A-Za-z0-9_.+-]+\z`
  - `pub fn owned_by(key: &str, profile_id: &str) -> bool` → `\Amedia/<profile>/[0-9a-f-]{36}(\.[a-z0-9]{1,10})?\z`、profile が空なら false
  - `pub fn issued_to(key: &str, profile_id: &str, media_id: &str) -> bool` → `\A<key_for(profile, media, "")>(\.[a-z0-9]{1,10})?\z`、どちらかが空なら false

regex に埋める ID は `regex::escape` を通す。

- [ ] **Step 1: 失敗するテストを書く**

```rust
#[test] fn lowercases_a_plain_extension()            // extension_of("Photo.JPEG") == ".jpeg"; extension_of("dir/a.tar.gz") == ".gz"
#[test] fn drops_an_extension_that_is_not_plain()    // "photo.p ng", "photo.xxxxxxxxxxx"(11), "photo.p%2Fg", ".bashrc", "a." → ""
#[test] fn allows_only_image_and_video_types()       // "image/png","video/mp4","image/svg+xml" → true; "text/plain","image/","image/png ","image/pngé" → false
#[test] fn issues_keys_only_for_the_profile_and_media() // Ruby handler_spec の refused 6 件 → false; key_for(p,m,"") と key_for(p,m,".png") → true; 空の profile/media → false
#[test] fn owns_only_keys_under_the_profile()        // 他人のキー, "media/image/<id>.png", "media/<p>/../<o>/<id>.png", "anything" → false; key_for(p, uuid, ".jpg") → true; 空の profile → false
```

- [ ] **Step 2: `cargo test key` が FAIL することを確かめる**

- [ ] **Step 3: 5 つの関数を実装する**

`extension_of` は最後の `/` の後ろで、先頭以外にある最後の `.` から後ろを取り（無ければ `""`）、`to_lowercase` してから正規表現に合わせる。

- [ ] **Step 4: `cargo test key` が PASS することを確かめる**

- [ ] **Step 5: Commit**

```bash
git add dystopia/server/src
git commit -s -m "feat(dystopia/server): add media key and input rules"
```

---

### Task 3: Storage

**Files:**
- Create: `dystopia/server/src/media/storage.rs`
- Test: `src/media/storage.rs` の `#[cfg(test)]`

**Interfaces:**
- Produces:
  - `#[async_trait] pub trait Storage: Send + Sync { async fn upload_url(&self, key: &str, content_type: &str) -> Result<String, StorageError>; async fn download_url(&self, key: &str, now: std::time::SystemTime) -> Result<String, StorageError>; async fn delete(&self, key: &str) -> bool; async fn tag(&self, key: &str, tags: &[(&str, &str)]) -> bool; }`
  - `pub struct LocalStorage { pub app_url: String, pub uploads_dir: PathBuf }`
  - `pub struct S3Storage` と `pub async fn S3Storage::new(bucket: String, region: String) -> S3Storage`、テスト用に `S3Storage::with_client(client: aws_sdk_s3::Client, bucket: String)`
  - `pub fn signing_time(now: SystemTime) -> SystemTime`（毎時の境界に切り下げる）

挙動は Ruby の `lib/storage/local_adapter.rb`・`s3_adapter.rb` と同じにする。
- Local: upload は `{app_url}/storage/upload?key={k}&content_type={c}`（`url::form_urlencoded::byte_serialize` で Ruby の `CGI.escape` と同じに符号化）、download は `{app_url}/uploads/{key}`、空のキーは `""`、delete は `uploads_dir/key` が無ければ true、tag はファイルがあれば true。
- S3: upload は `put_object`（content_type 付き）を 300 秒で presign、download は `get_object` を `signing_time(now)` を start_time にして 7200 秒で presign、空のキーは `""`、delete・tag は SDK のエラーで false。

- [ ] **Step 1: 失敗するテストを書く**

```rust
#[tokio::test] async fn local_urls_escape_the_key_like_cgi()      // upload_url("media/a b/c.png","image/png") に "key=media%2Fa+b%2Fc.png&content_type=image%2Fpng" を含む
#[tokio::test] async fn an_empty_key_has_no_download_url()        // Local と S3 の両方で ""
#[tokio::test] async fn s3_upload_url_signs_the_content_type()    // X-Amz-Expires=300、X-Amz-SignedHeaders に content-type
#[tokio::test] async fn s3_download_url_is_signed_at_the_hour()   // now=2026-11-28T10:59:59Z → X-Amz-Date=20261128T100000Z、X-Amz-Expires=7200、同じ時間帯の 2 つの now で同じ URL
#[test] fn signing_time_rounds_down_to_the_hour()
```

S3 のテストは固定の credentials（`aws_sdk_s3::config::Credentials::new("AKID","SECRET",None,None,"test")`）と region `ap-northeast-1` の client を `with_client` に渡し、通信しない。

- [ ] **Step 2: `cargo test storage` が FAIL することを確かめる**

- [ ] **Step 3: 実装する**

- [ ] **Step 4: `cargo test storage` が PASS することを確かめる**

- [ ] **Step 5: Commit**

```bash
git add dystopia/server/src
git commit -s -m "feat(dystopia/server): add local and S3 media storage"
```

---

### Task 4: Repository and presenter

**Files:**
- Create: `dystopia/server/src/media/repository.rs`・`src/media/presenter.rs`・`tests/support/mod.rs`
- Test: `dystopia/server/tests/media_repository.rs`、`src/media/presenter.rs` の `#[cfg(test)]`

**Interfaces:**
- Consumes: Task 3 の `Storage`。
- Produces:
  - `#[derive(sqlx::FromRow)] pub struct MediaRow { pub id: Uuid, pub media_type: String, pub filename: Option<String>, pub content_type: Option<String>, pub size_bytes: Option<i64>, pub media_key: Option<String>, pub thumbnail_key: Option<String>, pub created_at: DateTime<Utc>, pub uploader_profile_id: Option<Uuid>, pub owner_account_id: Option<Uuid> }`
  - `pub struct NewMedia { pub id: Uuid, pub media_type: String, pub filename: String, pub content_type: String, pub size_bytes: i64, pub media_key: String, pub thumbnail_key: Option<String>, pub uploader_profile_id: Uuid, pub owner_account_id: Uuid }`
  - `pub struct MediaRepository { pool: PgPool }`、`new(pool)`、`async fn find_by_id(&self, id: Uuid) -> sqlx::Result<Option<MediaRow>>`、`async fn create(&self, new: &NewMedia) -> sqlx::Result<MediaRow>`（`created_at` は DB の既定値、`RETURNING`）、`async fn delete(&self, id: Uuid) -> sqlx::Result<()>`
  - `pub fn media_type_name(value: i32) -> &'static str`（1→`image`、2→`video`、他→`unknown`）
  - `pub fn media_type_enum(name: &str) -> MediaType`（小文字にして `image`・`video`、他は `Unspecified`）
  - `pub fn format_created_at(at: DateTime<Utc>) -> String`（`to_rfc3339_opts(SecondsFormat::Secs, false)`）
  - `pub async fn to_proto(row: &MediaRow, storage: &dyn Storage, now: SystemTime) -> Result<pb::Media, StorageError>`（NULL は `""`・`0`）
  - `tests/support`: `pub async fn pool() -> PgPool`（`TEST_DATABASE_URL`、既定 `postgres://postgres:password@localhost:5432/monolith_test`）、`pub async fn create_profile(pool) -> (account_id: Uuid, profile_id: Uuid)`（`identity.accounts` と `profile.profiles` に必須の列だけ入れる）、`pub struct FakeStorage { tagged: Mutex<HashMap<String, Vec<(String,String)>>>, missing_keys: Mutex<Vec<String>>, failing_deletes: AtomicBool }`（`Storage` を実装、URL は `LocalStorage` と同じ形）

テストは共有の test DB を使い、表を空にしない。各テストは自分で作った ID だけを確かめる。

- [ ] **Step 1: 失敗するテストを書く**

```rust
#[tokio::test] async fn creates_and_reads_back_a_row()
#[tokio::test] async fn reads_a_row_ruby_wrote_with_nulls()       // media_type "image"、key "media/image/<id>.png"、他の NULL 列 → find_by_id が Some
#[tokio::test] async fn deletes_a_row()
#[test] fn formats_created_at_like_ruby()                         // 2026-11-28T01:02:03.456Z → "2026-11-28T01:02:03+00:00"
#[test] fn maps_media_types_both_ways()                           // 1→"image", 2→"video", 0/99→"unknown"; "IMAGE"→Image, "unknown"→Unspecified
#[tokio::test] async fn presents_nulls_as_empty_values()          // thumbnail_url "", filename "", size_bytes 0
```

- [ ] **Step 2: `cargo test --test media_repository presenter` が FAIL することを確かめる**

- [ ] **Step 3: 実装する（`identity.accounts`・`profile.profiles` の必須列は `dystopia/monolith/config/db/migrate/` から確かめる）**

- [ ] **Step 4: PASS することを確かめる**

- [ ] **Step 5: Commit**

```bash
git add dystopia/server
git commit -s -m "feat(dystopia/server): add the media repository and presenter"
```

---

### Task 5: Caller resolution

**Files:**
- Create: `dystopia/server/src/auth.rs`
- Test: `dystopia/server/tests/auth.rs`

**Interfaces:**
- Consumes: Task 4 の `tests/support`。
- Produces:
  - `pub struct Caller { pub request_id: String, pub account_id: Option<String>, pub profile_id: Option<Uuid>, pub profile_denied: bool }`
  - `pub async fn resolve_caller(pool: &PgPool, metadata: &tonic::metadata::MetadataMap) -> sqlx::Result<Caller>`
  - `impl Caller { pub fn require_profile(&self) -> Result<Uuid, tonic::Status> }`

`dystopia/monolith/lib/interceptors/authentication_interceptor.rb` と `lib/grpc/authenticatable.rb` と同じにする。
- `request_id` は `x-request-id`、無ければ新しい UUID。
- `x-user-id` があれば（空文字列でも）`account_id`。
- 「表示できるプロフィール」は `profile.profiles.disabled_at IS NULL` かつ `account_id IN (SELECT id FROM identity.accounts WHERE deactivated_at IS NULL)`。
- `x-profile-id` が空か無い: そのアカウントの表示できるプロフィールがちょうど 1 つならそれ、それ以外は `None`（UUID でないアカウントは 0 件）。
- `x-profile-id` がある: UUID で、表示でき、その `account_id` の文字列が `x-user-id` と同じなら使う。そうでなければ `profile_denied = true`。
- `require_profile`: アカウントが無い → `UNAUTHENTICATED` "Authentication required"。プロフィールが無く denied → `PERMISSION_DENIED` "Profile is not available"、metadata `error-reason: profile_not_permitted`。denied でない → `FAILED_PRECONDITION` "Active profile required"、`error-reason: profile_required`。

- [ ] **Step 1: 失敗するテストを書く**

```rust
#[tokio::test] async fn uses_the_only_visible_profile_without_a_header()
#[tokio::test] async fn requires_a_choice_when_the_account_has_two_profiles()  // FAILED_PRECONDITION, profile_required
#[tokio::test] async fn uses_the_requested_profile_of_the_account()
#[tokio::test] async fn denies_another_accounts_profile()                     // PERMISSION_DENIED, profile_not_permitted
#[tokio::test] async fn denies_a_disabled_profile_or_a_deactivated_account()
#[tokio::test] async fn denies_a_profile_id_that_is_not_a_uuid()
#[tokio::test] async fn refuses_a_request_without_an_account()                // UNAUTHENTICATED
#[tokio::test] async fn keeps_the_request_id_from_the_header()
```

- [ ] **Step 2: `cargo test --test auth` が FAIL することを確かめる**

- [ ] **Step 3: 実装する**

- [ ] **Step 4: PASS することを確かめる**

- [ ] **Step 5: Commit**

```bash
git add dystopia/server
git commit -s -m "feat(dystopia/server): resolve the acting profile from request metadata"
```

---

### Task 6: MediaService and access log

**Files:**
- Create: `dystopia/server/src/media/service.rs`・`src/access_log.rs`
- Modify: `dystopia/server/src/main.rs`（`MediaServiceServer` を登録し、`MEDIA_STORAGE` で storage を選ぶ）
- Test: `dystopia/server/tests/media_service.rs`、`src/access_log.rs` の `#[cfg(test)]`

**Interfaces:**
- Consumes: Task 2〜5 のすべて。
- Produces:
  - `pub struct MediaHandler { pool: PgPool, repo: MediaRepository, storage: Arc<dyn Storage> }`、`MediaHandler::new(pool: PgPool, storage: Arc<dyn Storage>) -> MediaHandler`、`impl MediaService for MediaHandler`
  - `pub struct AccessLogEntry { pub time: DateTime<Utc>, pub request_id: String, pub method: &'static str, pub service: &'static str, pub account_id: Option<String>, pub profile_id: Option<String>, pub duration_ms: f64, pub error: Option<(String, String)> }`、`pub fn to_json_line(&self) -> String`

RPC の挙動は Ruby の `slices/media/grpc/handler.rb` と `use_cases/*` に合わせる。各 RPC は最初に `require_profile` を通す。
- `GetUploadUrl`: ファイル名が空か `upload_content_type_allowed` が false → `INVALID_ARGUMENT` "Invalid input"。media_id は UUID v7、キーは `key_for(profile, media_id, extension_of(filename))`。
- `RegisterMedia`: 次の順で判定する。
  1. `media_id` が UUID でない、または `issued_to` が false → `INVALID_ARGUMENT` "Invalid input"（UUID でない ID はタグを付ける前に止める。Ruby は INTERNAL を返すが、画面は送らない値なので私の判断で揃えない）。
  2. 空でない `thumbnail_key` が `owned_by` でない → 同じ。
  3. `tag(media_key, [("owner-account-id", account_id)])` が false → `FAILED_PRECONDITION` "The file has not been uploaded"。
  4. 行を作り、`media_type_name`、空の thumbnail_key は NULL にして、`to_proto` を返す。
- `DeleteMedia`: ID が UUID でない、行が無い、`uploader_profile_id` が NULL か別人 → `success: false`。本体とサムネイルの空でないキーを全部 delete してから、1 つでも false なら行を残して false、全部 true なら行を消して true。
- access log: `service` は `media.v1.media_service`、`method` は `get_upload_url`・`register_media`・`delete_media`。JSON の key は `time`・`request_id`・`method`・`service`・`account_id`・`profile_id`・`duration_ms`（小数 2 桁）・`status`（`OK` | `ERROR`）、ERROR のときだけ `error`（status の message）と `error_class`（status の code の名前）。`time` は `format_created_at` と同じ形。標準出力に 1 行で出す。

- [ ] **Step 1: 失敗するテストを書く**

`handler_spec.rb` の各 `it` を 1 つずつ移す。`Request::new(msg)` に `x-user-id`・`x-profile-id` を入れ、`FakeStorage` を使う。件数は自分が作ったプロフィールの行だけで数える。

```rust
#[tokio::test] async fn records_the_uploader_and_owner()
#[tokio::test] async fn stores_and_returns_the_media_type()           // IMAGE→"image", VIDEO→"video", 2→"video"
#[tokio::test] async fn issues_a_key_under_the_profile_without_the_account() // "Photo.JPEG" → "media/<p>/<id>.jpeg"、アカウント ID を含まない、upload_url にエスケープしたキー
#[tokio::test] async fn drops_an_extension_that_is_not_plain()
#[tokio::test] async fn refuses_an_upload_url_for_a_bad_type_or_empty_name() // INVALID_ARGUMENT
#[tokio::test] async fn tags_the_object_with_the_owning_account()
#[tokio::test] async fn registers_only_a_key_issued_to_the_profile()  // refused 6 件 + UUID でない media_id → INVALID_ARGUMENT、タグ無し・行無し
#[tokio::test] async fn accepts_only_an_own_thumbnail()
#[tokio::test] async fn refuses_a_file_that_was_never_uploaded()      // FAILED_PRECONDITION、行無し
#[tokio::test] async fn lets_the_uploader_delete()
#[tokio::test] async fn keeps_the_row_when_a_file_cannot_be_deleted()
#[tokio::test] async fn answers_false_for_others_and_unknown_ids()    // 別人・存在しない UUID・UUID でない ID
#[tokio::test] async fn no_one_deletes_a_row_without_an_uploader()    // Ruby が書いた NULL の行
#[tokio::test] async fn refuses_every_rpc_without_a_profile_or_account()
#[test] fn writes_the_access_log_fields_ruby_writes()                 // OK と ERROR の JSON の key と値
```

- [ ] **Step 2: `cargo test` が FAIL することを確かめる**

- [ ] **Step 3: 実装し、`main` で `MEDIA_STORAGE` に応じて `LocalStorage` か `S3Storage` を作り、`PgPoolOptions::new().max_connections(2)` で DB に接続して登録する**

- [ ] **Step 4: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` がすべて通ることを確かめる**

- [ ] **Step 5: 手で確かめる**

ローカルで `monolith` の dev DB と seed を使い、`cargo run` したサーバーに、frontend を `MEDIA_SERVICE_URL=http://127.0.0.1:9002` で起動して画像付きの投稿を作る。
完了条件: 投稿に画像が表示され、Rust の標準出力に `register_media` の OK の行がある。
ローカルの開発環境で `/storage/upload` を受ける Ruby の HTTP サーバーを起動できなければ、この確認は飛ばし、起動できなかった理由を報告に書く。

- [ ] **Step 6: Commit**

```bash
git add dystopia/server
git commit -s -m "feat(dystopia/server): serve MediaService"
```

---

### Task 7: Frontend media endpoint

**Files:**
- Create: `dystopia/frontend/src/lib/grpc-endpoints.ts`・`src/lib/grpc-endpoints.test.ts`
- Modify: `dystopia/frontend/src/lib/grpc.ts:23-29,31`

**Interfaces:**
- Produces: `export function monolithUrl(env: NodeJS.ProcessEnv): string`（`MONOLITH_URL` または `http://localhost:9001`）、`export function mediaServiceUrl(env: NodeJS.ProcessEnv): string`（`MEDIA_SERVICE_URL` または `monolithUrl(env)`）

- [ ] **Step 1: 失敗するテストを書く**

```ts
it("sends media to the monolith when no media service is set")   // { MONOLITH_URL: "http://127.0.0.1:50051" } → "http://127.0.0.1:50051"
it("sends media to the media service when it is set")             // + MEDIA_SERVICE_URL → その値
it("falls back to the local monolith")                            // {} → "http://localhost:9001"
```

- [ ] **Step 2: `pnpm vitest run src/lib/grpc-endpoints.test.ts` が FAIL することを確かめる**

- [ ] **Step 3: 実装し、`grpc.ts` で `mediaClient` だけを `mediaServiceUrl(process.env)` の transport（`traceContextInterceptor` 付き）で作る**

- [ ] **Step 4: テストが PASS し、`pnpm exec tsc --noEmit --incremental false` の exit code が 0 であることを確かめる（パイプしない）**

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/lib
git commit -s -m "feat(dystopia/frontend): route the media client by MEDIA_SERVICE_URL"
```

---

### Task 8: Lambda image and configuration

**Files:**
- Modify: `dystopia/lambda/image/Dockerfile`・`Dockerfile.dockerignore`・`start`・`tests/image_test.sh`
- Modify: `dystopia/lambda/aws/modules/lambda.tf`・`tests/hosting.tftest.hcl`
- Modify: `.github/workflows/deploy-dystopia-lambda.yaml`

- [ ] **Step 1: tftest に失敗する assert を足す**

アプリ用関数の環境変数で `SERVER_BIND_ADDRESS == "127.0.0.1:50052"`・`MEDIA_SERVICE_URL == "http://127.0.0.1:50052"`・`MEDIA_STORAGE == "s3"`。task 用関数には無いこと。

- [ ] **Step 2: `tofu test`（`dystopia/lambda/aws/modules`）が FAIL することを確かめる**

- [ ] **Step 3: `lambda.tf` の locals に `server_port = 50052` を足し、アプリ用関数の環境変数に上の 3 つを足す**

- [ ] **Step 4: `tofu test` が PASS することを確かめる**

- [ ] **Step 5: `image_test.sh` に失敗する確認を足す**

アプリのコンテナで Rust のサーバーが `127.0.0.1:50052` で待ち受けていることと、Rust のプロセスを kill するとコンテナが終わることを確かめる（既存の確認の書き方に合わせる）。

- [ ] **Step 6: イメージを変える**

- Dockerfile に `FROM rust:1.100.0-slim-trixie AS server-builder` の段を足し、`server/` を COPY して `cargo build --release --locked`、runner に `/app/server/dystopia-server` だけをコピーする。
  - runner の `ruby:4.0.10-slim` が Debian 13（trixie）なので、glibc を揃える。
- `.dockerignore` に `server/target/` を足す。
- `start` で `/app/server/dystopia-server` を起動し、`wait -n` を 3 つのプロセスにする。
- deploy workflow の `push.paths` に `dystopia/server/**` を足す。

- [ ] **Step 7: colima を起動して `bash dystopia/lambda/image/tests/image_test.sh` を実行し、exit code が 0 であることを確かめる（`| tail` を挟まない）**

- [ ] **Step 8: Commit**

```bash
git add dystopia/lambda .github/workflows/deploy-dystopia-lambda.yaml
git commit -s -m "feat(dystopia/lambda): run the Rust media server beside the monolith"
```

---

### Task 9: E2E stack

**Files:**
- Modify: `dystopia/e2e/bin/stack`・`.github/workflows/dystopia-e2e.yaml`

- [ ] **Step 1: `bin/stack` に `start_server` を足す**

`cargo build --release`（`dystopia/server`）の後、`SERVER_BIND_ADDRESS=127.0.0.1:9056`・`DATABASE_URL=$MONOLITH_DB_URL` で起動し、pid と log を `server` の名前で持つ。
`stop_processes`・`print_logs`・`wait_until_ready` の生存確認・`up` のポート確認に `server` を足し、frontend に `MEDIA_SERVICE_URL=http://127.0.0.1:9056` を渡す。

- [ ] **Step 2: e2e の workflow で cargo が使えることを確かめ、無ければ Rust を入れる手順を足す（`rust-toolchain.toml` が版を決める）**

- [ ] **Step 3: `bin/stack up` が "stack is ready" を出し、`.e2e/stack/server.log` に待ち受けの行があり、`pnpm exec e2e run` が通り、`bin/stack down` で全プロセスが止まることを確かめる**

- [ ] **Step 4: Commit**

```bash
git add dystopia/e2e/bin/stack .github/workflows/dystopia-e2e.yaml
git commit -s -m "test(dystopia/e2e): start the Rust media server in the stack"
```

---

### Task 10: Draft PR, measurements and report

- [ ] **Step 1: push して Draft PR を作る**

`git push -u origin HEAD`、PR テンプレート（リポジトリ → `panicboat/.github`）に従って `gh pr create --draft`。本文の先頭に `Closes #2092` は付けない（報告が終わるまで Issue を開けておく）。`Part of #2092` とする。
完了条件: CI（server test・frontend test・monolith test）が通る。

- [ ] **Step 2: ローカルの負荷比較の準備**

ghz を入れる前にユーザーの承認を得る。
Ruby（`bin/grpc`、9001）と Rust（9002）を、同じ dev DB、`MEDIA_STORAGE=s3`・`MEDIA_BUCKET_NAME=bench`・`AWS_ACCESS_KEY_ID=bench`・`AWS_SECRET_ACCESS_KEY=bench` で起動する（両方とも通信せずに presign する）。

- [ ] **Step 3: `GetUploadUrl` に同じ条件で負荷をかける**

seed のプロフィールの `x-user-id`・`x-profile-id` を metadata に付け、ghz で 20,000 件・並列 20 を Ruby と Rust に 3 回ずつ送る。
p50・p95・p99・最大値・件数/秒を記録する。

- [ ] **Step 4: 起動時間と常駐メモリを測る**

ローカルで各サーバーを起動してから待ち受けを始めるまでの時間と、待ち受け中の RSS（`ps -o rss`）を 3 回ずつ測る。

- [ ] **Step 5: 本番の値を集める（ユーザーが PR を merge し、デプロイが終わった後）**

`AWS_PROFILE=production` で CloudWatch Logs の `/aws/lambda/dystopia` から、デプロイの前後 7 日の `REPORT` 行の `Init Duration` と `Max Memory Used` の中央値と最大値を取る。
CI のビルド時間（server test の job、deploy の build step）を `gh run view` で取る。

- [ ] **Step 6: 報告を Issue #2092 にコメントする**

Measurements の 5 項目の値、Rust と Ruby の行数（`dystopia/server/src` の stub を除く行数と、Ruby の media の handler・use_cases・repository・presenter・`lib/storage` の行数）、実装したタスク数とレビューで戻した回数を書き、ユーザーに所感と次の進め方を聞く。
