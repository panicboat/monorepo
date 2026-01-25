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
