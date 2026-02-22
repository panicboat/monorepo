# Trust Domain Phase 2: Reviews Design

Trust ドメイン Phase 2 — 双方向レビュー機能の設計。

## Overview

キャストとゲスト間の双方向レビュー機能を実装する。テキスト + メディア + ★5段階スコアで構成。

## Requirements

### Core Specification

| Item | Cast → Guest | Guest → Cast |
|------|--------------|--------------|
| Visibility | Other casts can view, guest cannot | Public after approval |
| Approval | Not required (immediate) | Required for text, score is unconditional |
| Text | Optional (score only is OK) | Required |
| Edit | Anytime | Not allowed |
| Delete | Anytime | Allowed |
| Multiple posts | Yes (accumulate over time) | Yes (accumulate over time) |
| Media | Up to 5 | Up to 5 |

### Display Specification

| Item | Specification |
|------|---------------|
| Score display | Average only (e.g., ★4.2) |
| Score calculation | User-average → Overall-average (prevents spam) |
| Approval rate | Percentage (e.g., 87%) |
| Sort order | Default newest, switchable |
| Notification | Badge display (notification system deferred) |

### UI Placement

| Location | Content |
|----------|---------|
| Guest profile | "Review" button → Modal (tags + reviews integrated) |
| Cast profile | Public review list + "Write review" button → Modal |
| Home | Trust pending section (tags + reviews integrated) |
| My page | My reviews list page |

## Database Schema

```sql
-- trust__reviews: Review records
CREATE TABLE trust__reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES identity__identities(id),
    reviewee_id UUID NOT NULL REFERENCES identity__identities(id),
    content TEXT,                                          -- Optional for cast→guest
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    status VARCHAR NOT NULL DEFAULT 'approved',            -- 'pending' | 'approved' | 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- trust__review_media: Review media
CREATE TABLE trust__review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES trust__reviews(id) ON DELETE CASCADE,
    media_type VARCHAR NOT NULL,   -- 'image' | 'video'
    path VARCHAR NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reviews_reviewee_id ON trust__reviews(reviewee_id);
CREATE INDEX idx_reviews_reviewer_id ON trust__reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON trust__reviews(status);
CREATE INDEX idx_review_media_review_id ON trust__review_media(review_id);
```

### Score Calculation Query

```sql
-- User-average → Overall-average (prevents single user spam)
SELECT AVG(user_avg) AS overall_score
FROM (
    SELECT reviewer_id, AVG(score) AS user_avg
    FROM trust__reviews
    WHERE reviewee_id = :cast_id AND status = 'approved'
    GROUP BY reviewer_id
) AS user_averages;
```

## API Design

Proto: `proto/trust/v1/service.proto`

### RPC List

| RPC | Description | Permission |
|-----|-------------|------------|
| `CreateReview` | Create review | Authenticated user |
| `UpdateReview` | Edit review | Cast (own reviews only) |
| `DeleteReview` | Delete review | Author only |
| `ListReviews` | List reviews | Filtered by permission |
| `GetReviewStats` | Get average score & approval rate | Public |
| `ApproveReview` | Approve review | Cast (own reviews only) |
| `RejectReview` | Reject review | Cast (own reviews only) |
| `ListPendingReviews` | List pending reviews | Cast (own reviews only) |

### Message Definition

```protobuf
message Review {
  string id = 1;
  string reviewer_id = 2;
  string reviewee_id = 3;
  optional string content = 4;
  int32 score = 5;
  string status = 6;
  repeated ReviewMedia media = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}

message ReviewStats {
  double average_score = 1;      // User-average → Overall-average
  int32 total_reviews = 2;       // Approved review count
  int32 approval_rate = 3;       // Approval rate (percentage)
}

message ReviewMedia {
  string id = 1;
  string media_type = 2;
  string path = 3;
  int32 position = 4;
}
```

### Permission Filtering

| Caller | Visible in `ListReviews` |
|--------|--------------------------|
| Guest | Own reviews only |
| Cast | All reviews to self + reviews to guests by other casts |
| Unauthenticated | Approved reviews to casts only |

## Architecture

### Backend Structure

```
services/monolith/workspace/slices/trust/
├── relations/
│   ├── reviews.rb
│   └── review_media.rb
├── repositories/
│   ├── review_repository.rb
│   └── review_media_repository.rb
├── use_cases/
│   └── reviews/
│       ├── create_review.rb
│       ├── update_review.rb
│       ├── delete_review.rb
│       ├── list_reviews.rb
│       ├── get_review_stats.rb
│       ├── approve_review.rb
│       ├── reject_review.rb
│       └── list_pending_reviews.rb
└── grpc/
    └── trust_handler.rb
```

### Frontend Structure

```
web/nyx/workspace/src/
├── modules/trust/
│   ├── components/
│   │   ├── ReviewModal.tsx         # Tags + reviews integrated modal (cast)
│   │   ├── WriteReviewModal.tsx    # Write review modal (guest)
│   │   ├── ReviewList.tsx          # Public review list
│   │   ├── ReviewStats.tsx         # Average score & approval rate
│   │   ├── PendingTrustSection.tsx # Home pending section
│   │   └── MyReviewsPage.tsx       # My reviews list
│   ├── hooks/
│   │   ├── useReviews.ts
│   │   ├── useReviewStats.ts
│   │   └── usePendingTrust.ts
│   └── types.ts
└── app/api/
    ├── cast/trust/reviews/
    └── shared/trust/reviews/
```

### Data Flow

**Cast → Guest (immediate):**
```
Cast UI → POST /api/cast/trust/reviews → gRPC CreateReview → status='approved'
```

**Guest → Cast (approval required):**
```
Guest UI → POST /api/guest/trust/reviews → gRPC CreateReview → status='pending'
Cast Home → POST /api/cast/trust/reviews/{id}/approve → gRPC ApproveReview → status='approved'
```

## Phased Rollout

### Phase 2a: Basic Reviews

| Layer | Content |
|-------|---------|
| DB | Create `trust__reviews` table |
| Proto | Add Review message and basic RPCs |
| Backend | CRUD + approval flow |
| Frontend | Minimal post/display UI (no media) |

**Done when:** Can post, approve, and display reviews with text + score

### Phase 2b: Media Attachment

| Layer | Content |
|-------|---------|
| DB | Create `trust__review_media` table |
| Proto | Add ReviewMedia message |
| Backend | Media domain integration |
| Frontend | Media upload/display UI |

**Done when:** Can attach images/videos to reviews

### Phase 2c: UI Integration & Polish

| Layer | Content |
|-------|---------|
| Frontend | Modal integration (tags + reviews) |
| Frontend | Home pending section (Trust integrated) |
| Frontend | My reviews list page |
| Frontend | Sort toggle, badge display |
| Backend | Stats API (average score, approval rate) |

**Done when:** All UI integrated, production ready

## UI Changes

### Deprecated

- `/cast/guests/[id]/notes` page → Replaced by modal

### New

- Guest profile: "Review" button → Modal
- Cast profile: Public reviews section + "Write review" button
- Home: Trust pending section (tags + reviews)
- My reviews list page
