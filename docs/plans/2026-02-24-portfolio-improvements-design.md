# Portfolio Improvements Design

## Overview

Portfolio ドメインの表示画面を改善する。主に以下の機能を追加・修正する。

## Requirements

1. 承認率のアイコンを ThumbsUp → Shield に変更 (MUST)
2. キャスト詳細画面でレビュアーのアイコン・名前を表示 (MUST)
3. キャスト詳細画面にゲストからのタグを表示 (MUST)
4. キャストのゲスト詳細画面に承認済みレビュー一覧を追加 (MUST)
5. キャストのゲスト詳細画面にこのゲストをブロック中のキャスト一覧を追加 (MUST)

## Implementation Phases

### Phase 1: Frontend Changes Only

フロントエンドのみの変更で完結する機能。

#### 1.1 Approval Rate Icon Change

- **File**: `web/nyx/workspace/src/modules/trust/components/ReviewStatsDisplay.tsx`
- **Change**: Replace `ThumbsUp` icon with `Shield` icon
- **Rationale**: Shield better represents trust/approval concept

#### 1.2 Guest Tags on Cast Detail Page

- **File**: `web/nyx/workspace/src/modules/trust/components/TrustSection.tsx`
- **Change**: Add "Guest Tags" section above reviews
- **Data Source**: Existing `useTaggings` hook with cast ID as target
- **Display**: Read-only tag pills (guests cannot remove their own tags)

#### 1.3 Approved Reviews on Guest Detail Page

- **File**: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx`
- **Change**: Add `ReviewList` component to show approved reviews
- **Data Source**: Existing `useReviews` hook with guest ID and status="approved"
- **Display**: Star rating and content only (no reviewer info in Phase 1)

### Phase 2: Backend Changes Required

バックエンド変更を伴う機能。

#### 2.1 Reviewer Info in Reviews

**Backend Changes**:
- **File**: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb`
- **Method**: `list_reviews`
- **Change**: Populate `reviewer_name`, `reviewer_avatar_url`, `reviewer_profile_id` (same as `list_pending_reviews`)

**Frontend Changes**:
- **File**: `web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts`
- **Change**: Include reviewer fields in response mapping

#### 2.2 Blocked-By Cast List

**Proto Changes**:
- **File**: `proto/relationship/v1/block_service.proto`
- **New RPC**: `ListBlockedBy`

```protobuf
rpc ListBlockedBy(ListBlockedByRequest) returns (ListBlockedByResponse);

message ListBlockedByRequest {
  string target_id = 1;  // Guest profile ID
}

message ListBlockedByResponse {
  repeated BlockedUser blockers = 1;  // Casts who blocked this guest
}
```

**Backend Changes**:
- **File**: `services/monolith/workspace/slices/relationship/grpc/block_handler.rb`
- **New Method**: `list_blocked_by`
- **Repository**: Add `list_by_blocked_id` method

**Frontend Changes**:
- **New API Route**: `web/nyx/workspace/src/app/api/cast/guests/[id]/blocked-by/route.ts`
- **UI**: Add "Blocked By" section to guest detail page

## Data Flow

### Reviewer Info Flow
```
Guest Detail Page
    → useReviews(guestId, "approved")
    → /api/shared/trust/reviews?reviewee_id=X&status=approved
    → gRPC ListReviews
    → Backend fetches guest profiles by reviewer_ids
    → Returns reviews with reviewer_name, reviewer_avatar_url, reviewer_profile_id
```

### Blocked-By Flow
```
Guest Detail Page
    → useBlockedBy(guestId)
    → /api/cast/guests/[id]/blocked-by
    → gRPC ListBlockedBy
    → Backend fetches blocks where blocked_id = guestId
    → Returns list of casts who blocked this guest
```

## UI Components

### TrustSection (Enhanced)
```
+----------------------------------+
| ゲストからのタグ                   |
| [tag1] [tag2] [tag3]             |
+----------------------------------+
| レビュー               ⭐ 4.5 (12件) 🛡 95% |
| +------------------------------+ |
| | [Avatar] Name     ⭐⭐⭐⭐⭐  | |
| | Review content here...       | |
| +------------------------------+ |
+----------------------------------+
```

### Guest Detail Page (Enhanced)
```
+----------------------------------+
| ゲスト詳細                         |
| [Avatar]                         |
| Name                             |
| Tagline                          |
+----------------------------------+
| ノート                            |
| [tag1] [tag2]  [+ Add Tag]       |
+----------------------------------+
| このゲストのレビュー                 |
| +------------------------------+ |
| | ⭐⭐⭐⭐☆  (content...)       | |
| +------------------------------+ |
+----------------------------------+
| ブロック中のキャスト                 |
| [Cast1 Avatar] Cast1 Name        |
| [Cast2 Avatar] Cast2 Name        |
+----------------------------------+
```

## Testing

### Phase 1
- Unit tests for icon change (visual regression)
- Integration tests for guest tags display
- Integration tests for approved reviews display

### Phase 2
- Backend specs for `list_reviews` with reviewer info
- Backend specs for `list_blocked_by`
- Frontend integration tests for reviewer info display
- Frontend integration tests for blocked-by list

## Migration

バックエンド変更はadditive（既存データへの影響なし）。マイグレーション不要。
