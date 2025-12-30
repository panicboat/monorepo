# Feature: Identity Slice Implementation

## Why (なぜ行うのか)
ユーザー登録、認証、ロール管理（Cast/Guest）はアプリケーションの根幹機能です。
Hanami の Slice 機能を使用して `Identity` ドメインを独立させ、堅牢な認証基盤を構築します。
バックエンドは gRPC インターフェースを提供し、BFF から利用可能にします。

## Technical Decisions (技術選定)
- **Database:** **PostgreSQL**
    - Hanami の標準であり、堅牢性と拡張性（JSONB等）から採用します。
- **ORM:** **ROM.rb (Ruby Object Mapper)**
    - Hanami デフォルト。ActiveRecord よりもドメインロジックと永続化層を分離しやすく、綺麗な設計を維持できるため。
- **Methods:**
    - **Password Hashing:** `bcrypt` (ソルト付きハッシュ化)
    - **Token:** `jwt` (Stateless Authentication)

## What Changes (何を変更するのか)
- **Monolith:** `slices/identity` の実装。
    - **Gemfile:** `pg`, `bcrypt`, `jwt` の追加。
    - **Proto:** `proto/identity/v1/service.proto` に `Login`, `Register` メソッドを追加。
    - **Action/Repository:** ユーザー情報の CRUD、パスワードハッシュ化 (bcrypt)。
    - **Token:** JWT 発行ロジック。
    - **gRPC Handler:** `lib/identity/handler.rb` の実装。
- **DB:** `users` テーブルのマイグレーション作成。

## Verification Plan (検証計画)
- `hanami db migrate`: マイグレーションの適用。
- `grpcurl` or `rpc-debug` (BFF Server Action): 登録・ログインの正常系動作確認。
