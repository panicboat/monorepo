# Proposal: unify-media-service

## Summary

全サービス（Portfolio、Post、Feed）のメディア管理を `media` サービス（`media__files` テーブル）に統一する。

## Problem

現状、メディア管理が各サービスで独自に実装されている：

| サービス | 保存方式 | 問題点 |
|----------|----------|--------|
| **Portfolio** | `casts.image_path/images/avatar_path` に S3 キー直接保存 | Media サービス未使用 |
| **Post** | `post_media.url` に S3 キー直接保存 | Media サービス未使用 |
| **Media** | `media__files` テーブル | 他サービスから参照されていない |

この状況による課題：
1. メディア URL 生成ロジックが重複（PostPresenter、FeedPresenter、ProfilePresenter）
2. メディアメタデータ（サイズ、MIME タイプ）が各サービスでバラバラに管理
3. 将来の CDN 統合や画像処理パイプライン追加が困難

## Solution

全サービスで `media__files` テーブルを参照し、メディア管理を一元化する。

### Changes

1. **Post ドメイン**
   - `post_media.media_id` カラム追加（`media__files` への参照）
   - `comment_media.media_id` カラム追加
   - Presenter で Media サービス経由の URL 取得

2. **Portfolio ドメイン**
   - `casts` に `profile_media_id`, `avatar_media_id` カラム追加
   - 新テーブル `cast_gallery_media` (cast_id, media_id, position)
   - `guests` に `avatar_media_id` カラム追加
   - Portfolio 独自の `GetUploadUrl` を廃止

3. **Feed ドメイン**
   - Post と同じ Media 参照パターンに統一

4. **データマイグレーション**
   - 既存の S3 キーを `media__files` に移行
   - 新しい参照カラムを設定

## Benefits

- **Storage 依存の局所化** - Storage アダプタ（S3/Local）は Media サービス内のみで使用
- **URL 生成の一元化** - 各サービスの Presenter から `Storage.download_url()` 呼び出しが不要に

## Out of Scope

- CDN 統合
- 画像リサイズ・サムネイル自動生成

## Risks

1. **データマイグレーション** - 既存データの整合性を保つ必要がある
2. **パフォーマンス** - JOIN が増える可能性

## Mitigation

1. マイグレーションスクリプトをテスト環境で検証
2. 十分なテストカバレッジを確保

## Design Principles

- **後方互換性は不要** - 新形式のみをクリーンに実装
- **旧カラム/API は削除** - マイグレーション完了後に即削除
- **テスト必須** - 全ての変更に対してテストを作成
