# UUID v4 → v7 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monorepo 内で DB に保存される UUID 生成を全て v4 から v7 に切り替える。

**Architecture:** ハイブリッド方式。DB の column default を `gen_random_uuid()` → `uuidv7()`（PG18 ネイティブ）に書き換え、Ruby 側の `SecureRandom.uuid` を `SecureRandom.uuid_v7` に置換する。フォーマットは v4 と同一なのでカラム型・バリデーション・テストは変更不要。

**Tech Stack:** PostgreSQL 18.3、Ruby 4.0.2、Hanami 2.x / Sequel、RSpec

**Spec:** `docs/superpowers/specs/2026-04-08-uuid-v7-migration-design.md`

---

## File Structure

純粋な置換タスクで新規ファイルなし。変更対象は2グループ：

1. **マイグレーション (24ファイル)** — `services/monolith/workspace/config/db/migrate/*.rb`
2. **Ruby アプリ/テストコード (30ファイル)** — slices, seeds, lib/tasks, spec 配下

非対象（明示的に触らない）:
- `lib/interceptors/authentication_interceptor.rb` — リクエストID用
- `services/nyx/workspace/src/lib/request.ts` — リクエストID用
- 全 proto ファイルの `string.uuid` バリデーション

---

## Task 1: マイグレーションの `gen_random_uuid()` → `uuidv7()` 置換

**Files (Modify):**
- `services/monolith/workspace/config/db/migrate/20260114002209_create_users.rb`
- `services/monolith/workspace/config/db/migrate/20260114003157_create_sms_verifications.rb`
- `services/monolith/workspace/config/db/migrate/20260117030200_create_casts_table.rb`
- `services/monolith/workspace/config/db/migrate/20260118000000_create_refresh_tokens.rb`
- `services/monolith/workspace/config/db/migrate/20260118120000_create_cast_plans_and_schedules.rb`
- `services/monolith/workspace/config/db/migrate/20260126000000_create_cast_posts.rb`
- `services/monolith/workspace/config/db/migrate/20260129000000_create_cast_post_hashtags.rb`
- `services/monolith/workspace/config/db/migrate/20260129000002_create_areas.rb`
- `services/monolith/workspace/config/db/migrate/20260131001000_create_genres.rb`
- `services/monolith/workspace/config/db/migrate/20260131002000_create_cast_genres.rb`
- `services/monolith/workspace/config/db/migrate/20260201000000_create_guests.rb`
- `services/monolith/workspace/config/db/migrate/20260203000000_create_post_likes.rb`
- `services/monolith/workspace/config/db/migrate/20260203000001_create_cast_follows.rb`
- `services/monolith/workspace/config/db/migrate/20260205000000_create_post_comments.rb`
- `services/monolith/workspace/config/db/migrate/20260205000001_create_comment_media.rb`
- `services/monolith/workspace/config/db/migrate/20260207000000_create_blocks.rb`
- `services/monolith/workspace/config/db/migrate/20260208000000_create_cast_favorites.rb`
- `services/monolith/workspace/config/db/migrate/20260217000000_create_media_files.rb`
- `services/monolith/workspace/config/db/migrate/20260218200000_add_media_id_to_casts.rb`
- `services/monolith/workspace/config/db/migrate/20260220000001_create_trust_tags.rb`
- `services/monolith/workspace/config/db/migrate/20260220000002_create_trust_taggings.rb`
- `services/monolith/workspace/config/db/migrate/20260221000001_refactor_trust_freeform_tagging.rb`
- `services/monolith/workspace/config/db/migrate/20260222000001_create_trust_reviews.rb`
- `services/monolith/workspace/config/db/migrate/20260225000001_create_trust_review_media.rb`

各ファイルに以下のいずれかの形式で出現する：
- `Sequel.lit("gen_random_uuid()")`
- `Sequel.function(:gen_random_uuid)`

これらを **そのままの形式を維持しながら** v7 化する：
- `Sequel.lit("gen_random_uuid()")` → `Sequel.lit("uuidv7()")`
- `Sequel.function(:gen_random_uuid)` → `Sequel.function(:uuidv7)`

- [ ] **Step 1: 全ての `gen_random_uuid` 出現箇所を Edit ツールで置換**

各ファイルについて Read → Edit を行う。`replace_all: true` を使って同一ファイル内の複数出現を一括置換できる。

例 (`20260126000000_create_cast_posts.rb`):
```ruby
# 変更前
column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
# 変更後
column :id, :uuid, default: Sequel.lit("uuidv7()"), null: false
```

例 (`20260114003157_create_sms_verifications.rb`):
```ruby
# 変更前
column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
# 変更後
column :id, :uuid, default: Sequel.function(:uuidv7), primary_key: true
```

- [ ] **Step 2: 残存確認**

Grep で `gen_random_uuid` が migrate 配下に1件も残っていないことを確認。

```
Grep pattern="gen_random_uuid" path="services/monolith/workspace/config/db/migrate"
```
Expected: `No matches found`

- [ ] **Step 3: マイグレーションが PG で動くことを確認**

```bash
cd services/monolith/workspace
docker compose up -d db
docker compose run --rm app bundle exec rake db:drop db:create db:migrate
```
Expected: エラーなく完走（PG18 の `uuidv7()` が解決されること）

- [ ] **Step 4: v7 が実際に投入されることを確認**

```bash
docker compose run --rm app bundle exec rake db:seed
docker compose exec db psql -U postgres -d monolith -c "SELECT id FROM users LIMIT 3;"
```
Expected: UUID の先頭7桁付近が時刻順プレフィックスになっている（例 `0190xxxx-...`）。version nibble は 4桁目の最初が `7` であること（`xxxxxxxx-xxxx-7xxx-...`）。

- [ ] **Step 5: コミット**

```bash
git add services/monolith/workspace/config/db/migrate
git commit -m "$(cat <<'EOF'
chore(monolith/db): switch column defaults from gen_random_uuid() to uuidv7()

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: アプリ/テストコードの `SecureRandom.uuid` → `SecureRandom.uuid_v7` 置換

**Files (Modify):**

アプリコード:
- `services/monolith/workspace/config/db/seeds/trust/reviews.rb`
- `services/monolith/workspace/lib/tasks/migrate_media.rake`
- `services/monolith/workspace/slices/media/use_cases/get_upload_url.rb`
- `services/monolith/workspace/slices/trust/repositories/review_repository.rb`

テストコード:
- `services/monolith/workspace/spec/slices/feed/presenters/feed_presenter_spec.rb`
- `services/monolith/workspace/spec/slices/feed/use_cases/list_cast_feed_spec.rb`
- `services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb`
- `services/monolith/workspace/spec/slices/media/repositories/media_repository_spec.rb`
- `services/monolith/workspace/spec/slices/offer/repositories/offer_repository_spec.rb`
- `services/monolith/workspace/spec/slices/offer/use_cases/plans/get_plans_spec.rb`
- `services/monolith/workspace/spec/slices/offer/use_cases/plans/save_plans_spec.rb`
- `services/monolith/workspace/spec/slices/offer/use_cases/schedules/get_schedules_spec.rb`
- `services/monolith/workspace/spec/slices/offer/use_cases/schedules/save_schedules_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/grpc/cast_handler_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/presenters/cast/profile_presenter_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/repositories/cast_repository_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/use_cases/cast/images/save_images_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/use_cases/cast/profile/publish_spec.rb`
- `services/monolith/workspace/spec/slices/portfolio/use_cases/cast/profile/save_profile_spec.rb`
- `services/monolith/workspace/spec/slices/post/adapters/user_adapter_spec.rb`
- `services/monolith/workspace/spec/slices/post/presenters/post_presenter_spec.rb`
- `services/monolith/workspace/spec/slices/post/repositories/comment_repository_spec.rb`
- `services/monolith/workspace/spec/slices/post/repositories/like_repository_spec.rb`
- `services/monolith/workspace/spec/slices/post/repositories/post_repository_spec.rb`
- `services/monolith/workspace/spec/slices/post/use_cases/comments/add_comment_spec.rb`
- `services/monolith/workspace/spec/slices/relationship/repositories/block_repository_spec.rb`
- `services/monolith/workspace/spec/slices/relationship/repositories/follow_repository_spec.rb`
- `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`
- `services/monolith/workspace/spec/slices/trust/repositories/tagging_repository_spec.rb`
- `services/monolith/workspace/spec/slices/trust/use_cases/reviews/list_reviews_spec.rb`

**置換ルール:**
- `SecureRandom.uuid` (語境界 `\b` で終わるもの) → `SecureRandom.uuid_v7`
- `SecureRandom.uuid_v7` 自身は触らない（既に v7 のため。今はないが冪等性のため）

**触らないファイル:**
- `services/monolith/workspace/lib/interceptors/authentication_interceptor.rb` — リクエストID生成のため意図的に v4 のまま据え置き

- [ ] **Step 1: 各ファイルで `SecureRandom.uuid` を `SecureRandom.uuid_v7` に置換**

各ファイルを Read → Edit (`replace_all: true`) で置換する。`SecureRandom.uuid` の出現は語境界で終わるもののみ対象。Edit ツールでは `SecureRandom.uuid` と `SecureRandom.uuid_v7` は別文字列なので、`SecureRandom.uuid` → `SecureRandom.uuid_v7` の単純置換で安全。

例 (`slices/trust/repositories/review_repository.rb`):
```ruby
# 変更前
id: SecureRandom.uuid,
# 変更後
id: SecureRandom.uuid_v7,
```

- [ ] **Step 2: authentication_interceptor.rb が変更されていないことを確認**

```
Grep pattern="SecureRandom\.uuid_v7" path="services/monolith/workspace/lib/interceptors/authentication_interceptor.rb"
```
Expected: `No matches found`（v4 のまま据え置きが正しい）

```
Grep pattern="SecureRandom\.uuid\b" path="services/monolith/workspace/lib/interceptors/authentication_interceptor.rb"
```
Expected: 1件マッチ（`x-request-id` フォールバック生成箇所）

- [ ] **Step 3: 残存確認**

```
Grep pattern="SecureRandom\.uuid\b" path="services/monolith/workspace"
```
Expected: `authentication_interceptor.rb` の1件のみ

```
Grep pattern="SecureRandom\.uuid_v7" path="services/monolith/workspace" output_mode="count"
```
Expected: 上記 30 ファイルそれぞれで1件以上マッチ

- [ ] **Step 4: RSpec を流して緑であることを確認**

```bash
cd services/monolith/workspace
docker compose run --rm app bundle exec rspec
```
Expected: 既存テストが全てパス（`uuid_v7` も `uuid` と同じ文字列フォーマット・同じ長さなので影響なし想定）

- [ ] **Step 5: コミット**

```bash
git add services/monolith/workspace
git commit -m "$(cat <<'EOF'
chore(monolith): switch SecureRandom.uuid to uuid_v7 for DB primary keys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 最終検証

- [ ] **Step 1: 全体 grep で取りこぼしがないことを確認**

```
Grep pattern="gen_random_uuid" path="services/monolith/workspace"
```
Expected: `No matches found`

```
Grep pattern="SecureRandom\.uuid\b" path="services/monolith/workspace"
```
Expected: `authentication_interceptor.rb` の1件のみ

- [ ] **Step 2: DB を作り直して end-to-end 確認**

```bash
cd services/monolith/workspace
docker compose run --rm app bundle exec rake db:drop db:create db:migrate db:seed
docker compose exec db psql -U postgres -d monolith -c "SELECT id, created_at FROM cast_posts ORDER BY created_at LIMIT 5;"
```
Expected: id の先頭桁が created_at 順に単調増加していること、version nibble が `7` であること。

- [ ] **Step 3: RSpec 全体実行**

```bash
docker compose run --rm app bundle exec rspec
```
Expected: 全テスト pass

- [ ] **Step 4: 完了報告**

ユーザーに完了を報告し、`superpowers:finishing-a-development-branch` で次のステップ（PR or merge）を選んでもらう。
