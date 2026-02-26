---
sidebar_position: 10
---

# Identity Domain

全ての入り口となるゲートキーパー。

## Responsibilities

- ユーザー登録
- SMS 認証
- JWT 発行・検証
- ロール管理（Cast/Guest）
- セッション管理

## Database Tables

- `users` - ユーザー基本情報
- `auth_logs` - 認証ログ

### Cross-Domain ID

`identity__users.id` は全ドメインで統一 ID として使用される。Portfolio ドメインの `casts`/`guests` テーブルは `user_id` を PK として持ち、`users.id` と同一値を使用する。他ドメインの FK カラムは `cast_user_id`/`guest_user_id` で統一。

詳細は [Portfolio Domain - ID Convention](./portfolio.md#id-convention) を参照。

## Why Separate?

セキュリティリスクを局所化するため。また、将来的に店舗向け管理画面など別のフロントエンドができた際も共通利用するため。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/identity/` |
| Frontend | `web/nyx/workspace/src/modules/identity/` |
| Proto | `proto/identity/v1/service.proto` |

## Key APIs

- `SendSms` - SMS 認証コード送信
- `VerifySms` - SMS 認証コード検証
- `Register` - ユーザー登録
- `SignIn` - ログイン
- `RefreshToken` - トークン更新
- `GetMe` - 現在のユーザー情報取得
