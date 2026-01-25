---
sidebar_position: 20
---

# Portfolio Domain

最もアクセス負荷が高い「参照系」のサービス。キャストの「生きた」プロフィールを管理する。

## Responsibilities

- キャストのプロフィール情報（写真、タグ）の管理
- リアルタイムステータス（Online/Tonight）の保持
- 検索・フィルタリング
- 料金プラン管理
- スケジュール管理
- 画像アップロード

## Database Tables

- `casts` - キャストプロフィール
- `cast_plans` - 料金プラン
- `cast_schedules` - スケジュール
- `tags` - タグマスタ

## Why Separate?

ユーザーが一番見る画面であり、ここが落ちても「予約」や「チャット」は生かしておきたいため。読み込みが圧倒的に多く、Redis 等のキャッシュ戦略が肝になる。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/portfolio/` |
| Frontend | `web/nyx/workspace/src/modules/portfolio/` |
| Proto | `proto/portfolio/v1/service.proto` |

## Key APIs

- `GetCastProfile` - キャストプロフィール取得
- `SaveCastProfile` - キャストプロフィール保存
- `SaveCastImages` - 画像保存
- `SaveCastPlans` - 料金プラン保存
- `SaveCastSchedules` - スケジュール保存
- `ListCasts` - キャスト一覧取得
- `GetUploadUrl` - 画像アップロード URL 取得

## Related Specs

- `openspec/specs/portfolio/`
- `openspec/specs/schedule/`
