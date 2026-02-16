---
sidebar_position: 30
---

# Media Domain

メディアファイル（画像・動画）の統一管理サービス。

## Responsibilities

- 署名付きアップロード URL の発行
- メディアファイルの登録・取得・削除
- メディアメタデータの管理
- バッチ取得（複数メディア一括取得）

## Database Tables

| Table | Schema | Description |
|-------|--------|-------------|
| `files` | `media` | メディアファイル情報 |

### media.files

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `media_type` | VARCHAR(10) | `image` or `video` |
| `url` | TEXT | ファイル URL |
| `thumbnail_url` | TEXT | サムネイル URL |
| `metadata` | JSONB | 追加メタデータ |
| `created_at` | TIMESTAMPTZ | 作成日時 |

## Why Separate?

メディア管理は他のドメイン（Post、Portfolio）から共通で利用される。将来的に CDN 連携や画像処理パイプラインを追加する際にも、独立したドメインとして進化させやすい。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/media/` |
| Frontend | `web/nyx/workspace/src/modules/media/` (planned) |
| Proto | `proto/media/v1/media_service.proto` |

## Key APIs

### MediaService

- `GetUploadUrl` - 署名付きアップロード URL 取得
- `RegisterMedia` - メディア登録
- `GetMedia` - メディア取得
- `GetMediaBatch` - 複数メディア一括取得
- `DeleteMedia` - メディア削除

## Status

**Backend 実装済み** - Frontend 統合は未着手

## Related Domains

- **Post** - 投稿・コメントにメディアを添付
- **Portfolio** - プロフィール画像
