# Review Media Attachment & Cast Reviews Page Design

**Date:** 2026-02-25
**Status:** Approved

## Overview

2つの機能を追加する:
1. レビューへの画像/動画メディア添付（最大3ファイル）
2. キャスト向けレビュー一覧ページ（ステータス別フィルタ付き）

## Approach

Post ドメインの確立されたメディア添付パターン（中間テーブル + `media__files` へのソフト参照）を踏襲する。

### 選定理由
- `post__post_media` と同じ設計で一貫性を維持
- Presenter、バッチロード、FALLBACK 処理を再利用可能
- ソフト参照によりメディア削除時の影響を限定

---

## Feature 1: Review Media Attachment

### Data Model

#### New Table: `trust__review_media`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| review_id | UUID | `trust__reviews.id` への参照 |
| media_id | UUID (nullable) | `media__files.id` へのソフト参照 |
| media_type | VARCHAR | `"image"` / `"video"` |
| position | INTEGER | 表示順序 (0, 1, 2) |
| created_at | TIMESTAMPTZ | 作成日時 |

**Index:** `review_id`, `media_id`
**Constraint:** position は 0-2 の範囲（最大3ファイル）

### Proto Changes

```protobuf
// Review メッセージに media フィールド追加
message Review {
  // ... existing fields ...
  repeated ReviewMedia media = 11;
}

message ReviewMedia {
  string id = 1;
  string media_type = 2;
  string url = 3;
  string thumbnail_url = 4;
}

// CreateReviewRequest に media 追加
message CreateReviewRequest {
  // ... existing fields ...
  repeated MediaInput media = 5;  // max 3
}

message MediaInput {
  string media_type = 1;
  string media_id = 2;
}
```

### Backend Changes

1. **Migration:** `trust__review_media` テーブル作成
2. **Relation:** `ReviewMedia` relation 追加
3. **Repository:** `save_media`, メディアバッチロード処理追加
4. **Use Case:** `CreateReview` でメディアデータの保存、3ファイル上限バリデーション
5. **Handler:** リスト/取得時にメディアを解決して Proto に含める
6. **Presenter:** `media_to_proto` メソッド追加（Post の Presenter パターン踏襲）

### Frontend Changes

1. **WriteReviewModal 拡張:**
   - メディア添付ボタン追加（テキストエリアの下）
   - S3 アップロードフロー（GetUploadUrl → Upload → RegisterMedia）
   - アップロード中プログレス表示
   - サムネイルプレビュー + 削除ボタン
   - 3ファイル上限カウンター

2. **ReviewCard 拡張:**
   - 本文下にメディアサムネイルグリッド表示
   - 画像: タップで拡大（ライトボックス）
   - 動画: サムネイル + 再生アイコン、タップで再生

3. **Types 更新:**
   - `Review` interface に `media` フィールド追加
   - `CreateReviewRequest` に `media` 追加

---

## Feature 2: Cast Reviews Page

### Page: `/cast/reviews`

#### Header
- レビュー統計表示（`useReviewStats` 利用）
  - 平均スコア、総レビュー数、承認率

#### Filter Tabs
- 「すべて」「承認待ち」「承認済み」「却下」の4タブ
- タブ切替で `useInfiniteReviews` の `status` パラメータ変更

#### Review List
- `ReviewCard` コンポーネント再利用
- 「承認待ち」タブ: 承認/却下アクションボタン表示
- InfiniteScroll による無限スクロール
- メディアサムネイル表示（Feature 1 の拡張後）

#### Empty States
- タブごとに適切な空メッセージ

### Backend Changes

```protobuf
message ListReviewsRequest {
  // ... existing fields ...
  optional string status = 5;  // "pending" / "approved" / "rejected"
}
```

- `ReviewRepository#list_by_reviewee_paginated` にステータスフィルタを追加
- 既存の `ListReviews` RPC でステータスフィルタに対応

### Navigation
- キャスト管理メニュー（MyPage）にレビュー一覧リンク追加
