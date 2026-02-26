---
sidebar_position: 20
---

# Portfolio Domain

最もアクセス負荷が高い「参照系」のサービス。キャストの「生きた」プロフィールを管理する。

## ID Convention

cast/guest テーブルは `user_id` を PK として使用する。Identity ドメインの `users.id` と同一値。

```
identity__users.id = portfolio__casts.user_id (PK) = portfolio__guests.user_id (PK)
```

他ドメインからの FK カラムは `cast_user_id` / `guest_user_id` で統一:

| 参照元テーブル | FK カラム | 参照先 |
|---------------|-----------|--------|
| `offer__plans` | `cast_user_id` | `portfolio__casts.user_id` |
| `offer__schedules` | `cast_user_id` | `portfolio__casts.user_id` |
| `post__posts` | `cast_user_id` | `portfolio__casts.user_id` |
| `post__likes` | `guest_user_id` | `portfolio__guests.user_id` |
| `relationship__follows` | `cast_user_id`, `guest_user_id` | 各テーブルの `user_id` |
| `relationship__favorites` | `cast_user_id`, `guest_user_id` | 各テーブルの `user_id` |
| `portfolio__cast_areas` | `cast_user_id` | `portfolio__casts.user_id` |
| `portfolio__cast_genres` | `cast_user_id` | `portfolio__casts.user_id` |
| `portfolio__cast_gallery_media` | `cast_user_id` | `portfolio__casts.user_id` |

## Responsibilities

- キャストのプロフィール情報（写真、タグ）の管理
- ゲストのプロフィール情報（名前、アバター）の管理
- リアルタイムステータス（Online/Tonight）の保持
- 検索・フィルタリング
- 画像アップロード

## Database Tables

- `casts` - キャストプロフィール
- `guests` - ゲストプロフィール
- `tags` - タグマスタ

## Why Separate?

ユーザーが一番見る画面であり、ここが落ちても「予約」や「チャット」は生かしておきたいため。読み込みが圧倒的に多く、Redis 等のキャッシュ戦略が肝になる。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/portfolio/` |
| Frontend | `web/nyx/workspace/src/modules/portfolio/` |
| Proto (Cast) | `proto/portfolio/v1/service.proto` |
| Proto (Guest) | `proto/portfolio/v1/guest.proto` |

## Key APIs

### CastService

- `GetCastProfile` - キャストプロフィール取得
- `SaveCastProfile` - キャストプロフィール保存
- `SaveCastImages` - 画像保存
- `ListCasts` - キャスト一覧取得
- `GetUploadUrl` - 画像アップロード URL 取得

### GuestService

- `GetGuestProfile` - ゲストプロフィール取得
- `SaveGuestProfile` - ゲストプロフィール保存（upsert）
- `GetUploadUrl` - 画像アップロード URL 取得

## Guest Profile

ゲスト（一般ユーザー）のプロフィール管理機能。

### Data Model

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | UUID | Primary key（Identity の `users.id` と同一） |
| `name` | String | ニックネーム（1-20文字） |
| `avatar_path` | String | アバター画像のパス（オプション） |

### Frontend Integration

- `/onboarding` - 新規ゲストのプロフィール設定
- `/mypage/profile` - プロフィール編集

### Hooks

- `useGuestData` - ゲストデータの取得・更新・保存

## Related Specs

- `openspec/specs/portfolio/`
