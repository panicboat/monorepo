# UUID v4 → v7 Migration

## Background

monorepo は PK に UUID を使っているが、現状は全て **UUID v4**（完全ランダム）で生成されている。

- DB: PostgreSQL の `gen_random_uuid()`（マイグレーション約30ファイル）
- Ruby: `SecureRandom.uuid`（repositories / use_cases / seeds / specs / rake task）
- TS: `crypto.randomUUID()`（リクエストID用、DB には入らない）

ランダム UUID を B-tree PK に使うと、INSERT のたびにインデックスのランダム位置に書き込まれ、ページ分割・キャッシュ効率低下・インデックス肥大化を招く。

**UUID v7** は先頭 48bit が Unix time(ms) の単調増加プレフィックスのため、新しい行が B-tree の右端に追記され、上記問題を解消できる。フォーマットは v4 と同じ 128bit UUID なので、`string.uuid` バリデーションやカラム型は変更不要。

## Goal

monorepo 内で **DB に保存される UUID** を全て v7 で生成するように切り替える。既存データは破棄してよい（DB を作り直す前提）。

## Approach: Hybrid (DB default + App-side generation)

| Layer | 変更内容 |
|-------|----------|
| PostgreSQL | マイグレーションの `default: Sequel.lit("gen_random_uuid()")` を `Sequel.lit("uuidv7()")` に直接書き換え |
| Ruby | `SecureRandom.uuid` を `SecureRandom.uuid_v7` に置換 |
| TypeScript | 変更なし |

### Why hybrid

- DB default を `uuidv7()` にする → アプリが ID を渡し忘れても v7 が入る安全網
- アプリでも `SecureRandom.uuid_v7` を明示 → INSERT 前に ID が必要なケース（FK の事前生成、ログ出力、テストフィクスチャ）でも v7 が得られる

### Version prerequisites (verified)

- PostgreSQL **18.3** （docker-compose `postgres:18.3-alpine`）→ ネイティブ `uuidv7()` 利用可
- Ruby **4.0.2** （Dockerfile `FROM ruby:4.0.2-slim`）→ `SecureRandom.uuid_v7` 利用可（3.3+）

## Scope

### In scope

1. **DB マイグレーション**: `services/monolith/workspace/config/db/migrate/**/*.rb` 内の全ての `gen_random_uuid()` を `uuidv7()` に置換
2. **Ruby アプリコード**: 以下の `SecureRandom.uuid` を `SecureRandom.uuid_v7` に置換
   - `services/monolith/workspace/slices/**/*.rb`（repositories, use_cases）
   - `services/monolith/workspace/config/db/seeds/**/*.rb`
   - `services/monolith/workspace/lib/tasks/migrate_media.rake`
   - `services/monolith/workspace/spec/**/*.rb`

### Out of scope (intentional)

- `services/monolith/workspace/lib/interceptors/authentication_interceptor.rb` の `SecureRandom.uuid`
  - 用途: `x-request-id` のフォールバック生成（ログ相関用）
  - 理由: DB の PK ではなく、時刻順である必要もない。v4 のままでよい
- `services/nyx/workspace/src/lib/request.ts` の `crypto.randomUUID()`
  - 用途: フロント側のリクエストID生成
  - 理由: 同上
- `proto/portfolio/v1/cast_service.proto` 等の `string.uuid = true` バリデーション
  - 理由: v7 も v4 もフォーマットは同一（128bit UUID）なので変更不要

## Verification

1. DB を作り直してマイグレーション実行
   ```
   bundle exec rake db:drop db:create db:migrate db:seed
   ```
2. 任意のテーブルから ID をサンプリングし、先頭が時刻順になっていることを確認
   ```sql
   SELECT id, created_at FROM cast_posts ORDER BY created_at LIMIT 5;
   ```
   v7 の先頭文字列（例: `01900...`）が created_at 順に単調増加していれば OK
3. RSpec が緑のままであることを確認（フォーマット互換なので影響なし想定）
   ```
   bundle exec rspec
   ```

## Non-Goals

- 既存データのマイグレーション（破棄してよい）
- インデックスの再構築や VACUUM の実行（DB 作り直しなので不要）
- v7 ライブラリの導入（Ruby 標準・PG ネイティブのみで完結）
