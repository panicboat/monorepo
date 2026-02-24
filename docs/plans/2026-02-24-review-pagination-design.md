# Review Pagination Design

## Overview

プロフィールページのレビュー一覧にページング機能を追加する。プロフィールには概要（3件）のみ表示し、専用ページで無限スクロールによる全件閲覧を提供する。

## Requirements

| 項目 | 値 |
|------|-----|
| プロフィール表示件数 | 3件 (MUST) |
| 無限スクロール読み込み | 10件/回 (MUST) |
| 並び順 | 新着順 (MUST) |
| 対象 | キャスト・ゲスト両方 (MUST) |
| ページング方式 | カーソルベース（既存パターン準拠） (MUST) |

## Architecture

```
【変更箇所】

Proto:
  └── trust/v1/service.proto
      └── ListReviewsRequest に limit/cursor 追加
      └── ListReviewsResponse に next_cursor/has_more 追加

Backend:
  └── slices/trust/
      ├── grpc/trust_handler.rb (ページングパラメータ受け渡し)
      ├── use_cases/reviews/list_reviews.rb (CursorPagination対応)
      └── repositories/review_repository.rb (カーソルクエリ追加)

Frontend:
  ├── 新規ページ
  │   ├── /casts/[id]/reviews    (キャスト → レビュー一覧)
  │   └── /cast/guests/[id]/reviews (ゲスト → レビュー一覧)
  ├── hooks/
  │   ├── useReviews.ts          (limit/cursor対応)
  │   └── useInfiniteReviews.ts  (新規: 無限スクロール用)
  └── components/
      ├── TrustSection.tsx       (3件 + リンク追加)
      └── ReviewListPage.tsx     (新規: 無限スクロールUI)
```

## Proto Changes

```protobuf
message ListReviewsRequest {
  optional string reviewee_id = 1;
  optional string status = 2;
  optional string reviewer_id = 3;
  int32 limit = 4;      // default: 20, max: 50
  string cursor = 5;    // optional, for pagination
}

message ListReviewsResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

## Data Flow

### Profile Page (3 reviews)

```
Browser
  → useReviews(targetId, { status: "approved", limit: 3 })
  → /api/shared/trust/reviews?reviewee_id=X&status=approved&limit=3
  → gRPC ListReviews
  → 3件 + has_more を返却
```

### Review List Page (infinite scroll)

```
Browser
  → useInfiniteReviews(targetId, { status: "approved", limit: 10 })
  → /api/shared/trust/reviews?reviewee_id=X&status=approved&limit=10
  → 10件 + next_cursor + has_more を返却

  ↓ スクロール

  → /api/shared/trust/reviews?...&cursor=ABC123
  → 次の10件を返却
  → 既存のリストに追加
```

## UI Design

### Profile Page

```
+----------------------------------+
| レビュー              ⭐ 4.5 (24件) |
+----------------------------------+
| [Avatar] User1        ⭐⭐⭐⭐⭐   |
| とても良かったです！              |
+----------------------------------+
| [Avatar] User2        ⭐⭐⭐⭐☆   |
| 丁寧な対応でした                 |
+----------------------------------+
| [Avatar] User3        ⭐⭐⭐⭐⭐   |
| また利用したいです               |
+----------------------------------+
|    [ すべてのレビューを見る → ]     |
+----------------------------------+
```

### Review List Page

```
+----------------------------------+
| ← 戻る                           |
+----------------------------------+
| [Avatar] Name のレビュー (24件)   |
| ⭐ 4.5                           |
+----------------------------------+
| [Avatar] User1        ⭐⭐⭐⭐⭐   |
| とても良かったです！              |
+----------------------------------+
| [Avatar] User2 ...               |
+----------------------------------+
| [Avatar] User3 ...               |
+----------------------------------+
|     ↓ スクロール中... ↓           |
|        (自動読み込み)             |
+----------------------------------+
```

## New Pages

| Page | Path | Purpose |
|------|------|---------|
| Cast reviews | `/casts/[id]/reviews` | Cast profile → all reviews |
| Guest reviews | `/cast/guests/[id]/reviews` | Guest profile → all reviews |

## Implementation Files

### Proto

| File | Change |
|------|--------|
| `proto/trust/v1/service.proto` | Add limit/cursor to request, next_cursor/has_more to response |

### Backend

| File | Change |
|------|--------|
| `slices/trust/use_cases/reviews/list_reviews.rb` | Include CursorPagination |
| `slices/trust/grpc/trust_handler.rb` | Pass pagination params |
| `slices/trust/repositories/review_repository.rb` | Add cursor-based query |

### Frontend

| File | Change |
|------|--------|
| `modules/trust/hooks/useReviews.ts` | Add limit/cursor support |
| `modules/trust/hooks/useInfiniteReviews.ts` | New: infinite scroll hook |
| `modules/trust/components/TrustSection.tsx` | Show 3 reviews + link |
| `modules/trust/components/ReviewListPage.tsx` | New: infinite scroll UI |
| `app/(guest)/casts/[id]/reviews/page.tsx` | New: cast reviews page |
| `app/(cast)/cast/guests/[id]/reviews/page.tsx` | New: guest reviews page |
| `app/api/shared/trust/reviews/route.ts` | Add limit/cursor params |

## Testing

- Backend: `list_reviews` pagination behavior (limit, cursor, has_more)
- Frontend: Infinite scroll functionality

## Migration

バックエンド変更は additive（既存データへの影響なし）。マイグレーション不要。
