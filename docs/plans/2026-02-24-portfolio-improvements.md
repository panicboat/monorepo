# Portfolio Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Portfolio 画面を改善し、承認率アイコン変更、ゲストタグ表示、レビュー一覧追加、ブロック中キャスト一覧を実装する

**Architecture:** Phase 1 でフロントエンドのみの変更を行い、Phase 2 でバックエンド変更を含む機能を実装する。TDD アプローチで進め、各タスクは小さなステップに分割する。

**Tech Stack:** Next.js (React), TypeScript, Tailwind CSS, Ruby (Hanami), gRPC, Protocol Buffers

---

## Phase 1: Frontend Changes Only

### Task 1: Approval Rate Icon Change

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/ReviewStatsDisplay.tsx:3,45`

**Step 1: Update import statement**

Change the import from `ThumbsUp` to `Shield`:

```typescript
import { Star, Shield } from "lucide-react";
```

**Step 2: Update icon usage**

Replace `ThumbsUp` with `Shield` on line 45:

```typescript
<Shield className="h-4 w-4 text-green-500" />
```

**Step 3: Verify the change**

Run: `cd web/nyx/workspace && pnpm dev`
Navigate to a cast detail page and verify the approval rate shows a shield icon.

**Step 4: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/ReviewStatsDisplay.tsx
git commit -m "feat(trust): change approval rate icon from ThumbsUp to Shield"
```

---

### Task 2: Create GuestTagsDisplay Component

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/components/GuestTagsDisplay.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTaggings } from "../hooks/useTaggings";
import { TagPill } from "./TagPill";

interface GuestTagsDisplayProps {
  targetId: string;
}

export function GuestTagsDisplay({ targetId }: GuestTagsDisplayProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const { targetTaggings, fetchTargetTags, loading } = useTaggings();
  const [initialized, setInitialized] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await fetchTargetTags(targetId);
    } catch (e) {
      console.error("Failed to load tags:", e);
    } finally {
      setInitialized(true);
    }
  }, [fetchTargetTags, targetId]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      loadData();
    } else if (isHydrated) {
      setInitialized(true);
    }
  }, [isHydrated, isAuthenticated, loadData]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
      </div>
    );
  }

  if (targetTaggings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TagIcon className="h-4 w-4 text-text-muted" />
        <h4 className="text-sm font-bold text-text-primary">ゲストからのタグ</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {targetTaggings.map((tagging) => (
          <TagPill
            key={tagging.id}
            name={tagging.tagName}
            variant="guest"
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Export the component**

Modify `web/nyx/workspace/src/modules/trust/components/index.ts`:

```typescript
export * from "./GuestTagsDisplay";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/GuestTagsDisplay.tsx
git add web/nyx/workspace/src/modules/trust/components/index.ts
git commit -m "feat(trust): add GuestTagsDisplay component for read-only guest tags"
```

---

### Task 3: Add Guest Tags to TrustSection

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/TrustSection.tsx`

**Step 1: Import GuestTagsDisplay**

Add import at top:

```typescript
import { GuestTagsDisplay } from "./GuestTagsDisplay";
```

**Step 2: Add GuestTagsDisplay to render**

Update the return statement to include GuestTagsDisplay above reviews:

```typescript
return (
  <div className="space-y-4">
    {/* Guest Tags Section */}
    <GuestTagsDisplay targetId={targetId} />

    {/* Header with Stats */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-text-muted" />
        <h4 className="text-sm font-bold text-text-primary">レビュー</h4>
      </div>
      <ReviewStatsDisplay stats={stats} loading={statsLoading} />
    </div>

    {/* Review List */}
    <ReviewList
      reviews={reviews}
      loading={reviewsLoading}
      emptyMessage="まだレビューはありません"
    />
  </div>
);
```

**Step 3: Verify the change**

Run: `cd web/nyx/workspace && pnpm dev`
Navigate to a cast detail page and verify guest tags appear above reviews.

**Step 4: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/TrustSection.tsx
git commit -m "feat(trust): add guest tags section to TrustSection component"
```

---

### Task 4: Add Approved Reviews to Guest Detail Page

**Files:**
- Modify: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx`

**Step 1: Import ReviewList and useReviewStats**

Update imports:

```typescript
import { TrustTagsSection, WriteTrustModal, useReviews, useReviewStats, ReviewList, ReviewStatsDisplay } from "@/modules/trust";
```

**Step 2: Add reviews fetching in component**

After `const { createReview } = useReviews();`, add:

```typescript
const { reviews, fetchReviews, loading: reviewsLoading } = useReviews();
const { stats, loading: statsLoading } = useReviewStats(id);

useEffect(() => {
  if (id) {
    fetchReviews(id, "approved").catch(console.error);
  }
}, [id, fetchReviews]);
```

**Step 3: Add Reviews Section to UI**

After the Notes section, add:

```typescript
{/* Reviews Section */}
<div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-text-secondary">
      このゲストのレビュー
    </h3>
    <ReviewStatsDisplay stats={stats} loading={statsLoading} />
  </div>
  <ReviewList
    reviews={reviews}
    loading={reviewsLoading}
    emptyMessage="このゲストのレビューはまだありません"
  />
</div>
```

**Step 4: Add useEffect import**

Ensure useEffect is imported:

```typescript
import { useState, use, useEffect } from "react";
```

**Step 5: Verify the change**

Run: `cd web/nyx/workspace && pnpm dev`
Navigate to cast's guest detail page and verify reviews appear.

**Step 6: Commit**

```bash
git add web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx
git commit -m "feat(portfolio): add approved reviews section to guest detail page"
```

---

## Phase 2: Backend Changes Required

### Task 5: Add Reviewer Info to ListReviews Backend

**Files:**
- Modify: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb:167-176`

**Step 1: Update list_reviews method**

Replace the `list_reviews` method:

```ruby
def list_reviews
  reviews = list_reviews_uc.call(
    reviewee_id: request.message.reviewee_id,
    status: request.message.status.to_s.empty? ? nil : request.message.status
  )

  # Collect reviewer IDs
  reviewer_ids = reviews.map do |r|
    r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
  end.compact.uniq

  # Fetch guest profiles by user IDs
  guests_by_user_id = guest_adapter.find_by_user_ids(reviewer_ids)

  # Fetch avatar media for guests
  avatar_media_ids = guests_by_user_id.values.map(&:avatar_media_id).compact
  media_files = media_adapter.find_by_ids(avatar_media_ids)

  items = reviews.map do |r|
    reviewer_id = r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
    guest = guests_by_user_id[reviewer_id]
    avatar_url = guest&.avatar_media_id ? media_files[guest.avatar_media_id]&.url : nil

    build_review_proto(
      r,
      reviewer_name: guest&.name,
      reviewer_avatar_url: avatar_url,
      reviewer_profile_id: guest&.id
    )
  end

  ::Trust::V1::ListReviewsResponse.new(reviews: items)
end
```

**Step 2: Run backend tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/grpc/trust_handler.rb
git commit -m "feat(trust): add reviewer info to list_reviews response"
```

---

### Task 6: Update Frontend API to Include Reviewer Info

**Files:**
- Modify: `web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts:28-36`

**Step 1: Update response mapping**

Replace the reviews mapping:

```typescript
const reviews = (response.reviews || []).map((r) => ({
  id: r.id,
  reviewerId: r.reviewerId,
  revieweeId: r.revieweeId,
  content: r.content,
  score: r.score,
  status: r.status,
  createdAt: r.createdAt,
  reviewerName: r.reviewerName,
  reviewerAvatarUrl: r.reviewerAvatarUrl,
  reviewerProfileId: r.reviewerProfileId,
}));
```

**Step 2: Verify the change**

Run: `cd web/nyx/workspace && pnpm dev`
Navigate to cast detail page and verify reviewer avatars and names appear in reviews.

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts
git commit -m "feat(trust): include reviewer info in reviews API response"
```

---

### Task 7: Add ListBlockedBy to Proto

**Files:**
- Modify: `proto/relationship/v1/block_service.proto`

**Step 1: Add new RPC and messages**

Add after `GetBlockStatus`:

```protobuf
rpc ListBlockedBy(ListBlockedByRequest) returns (ListBlockedByResponse);
```

Add after `GetBlockStatusResponse`:

```protobuf
message ListBlockedByRequest {
  string target_id = 1;  // Guest profile ID
}

message ListBlockedByResponse {
  repeated BlockedUser blockers = 1;  // Casts who blocked this guest
}
```

**Step 2: Generate stubs**

Run: `cd services/monolith/workspace && ./bin/proto-gen`
Run: `cd web/nyx/workspace && pnpm proto:gen`

**Step 3: Commit**

```bash
git add proto/relationship/v1/block_service.proto
git add services/monolith/workspace/stubs/
git add web/nyx/workspace/src/stub/
git commit -m "feat(proto): add ListBlockedBy RPC to block service"
```

---

### Task 8: Implement ListBlockedBy in Backend Repository

**Files:**
- Modify: `services/monolith/workspace/slices/relationship/repositories/block_repository.rb`

**Step 1: Add list_by_blocked_id method**

Add after existing methods:

```ruby
def list_by_blocked_id(blocked_id:, limit: 50)
  blocks.where(blocked_id: blocked_id)
    .order { created_at.desc }
    .limit(limit)
    .to_a
end
```

**Step 2: Write spec**

Create or modify `services/monolith/workspace/slices/relationship/spec/repositories/block_repository_spec.rb`:

```ruby
RSpec.describe Relationship::Repositories::BlockRepository do
  describe "#list_by_blocked_id" do
    it "returns blocks for the given blocked_id" do
      # Setup test data
      result = subject.list_by_blocked_id(blocked_id: "guest-id")
      expect(result).to be_an(Array)
    end
  end
end
```

**Step 3: Run tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/relationship/`
Expected: Tests pass

**Step 4: Commit**

```bash
git add services/monolith/workspace/slices/relationship/repositories/block_repository.rb
git add services/monolith/workspace/slices/relationship/spec/
git commit -m "feat(relationship): add list_by_blocked_id to block repository"
```

---

### Task 9: Implement ListBlockedBy Handler

**Files:**
- Modify: `services/monolith/workspace/slices/relationship/grpc/block_handler.rb`

**Step 1: Add rpc declaration**

Add to rpc declarations:

```ruby
rpc :ListBlockedBy, ::Relationship::V1::ListBlockedByRequest, ::Relationship::V1::ListBlockedByResponse
```

**Step 2: Implement list_blocked_by method**

Add method:

```ruby
def list_blocked_by
  authenticate_user!

  blocks = block_repo.list_by_blocked_id(blocked_id: request.message.target_id)

  # Get blocker (cast) info
  blocker_ids = blocks.map(&:blocker_id).uniq
  casts = cast_adapter.find_by_ids(blocker_ids)

  # Get avatar media
  avatar_media_ids = casts.values.compact.map(&:avatar_media_id).compact
  media_files = media_adapter.find_by_ids(avatar_media_ids)

  blockers = blocks.map do |block|
    cast = casts[block.blocker_id]
    next nil unless cast

    avatar_url = cast.avatar_media_id ? media_files[cast.avatar_media_id]&.url : nil

    ::Relationship::V1::BlockedUser.new(
      id: cast.id,
      user_type: "cast",
      name: cast.name || "",
      image_url: avatar_url || "",
      blocked_at: block.created_at&.iso8601 || ""
    )
  end.compact

  ::Relationship::V1::ListBlockedByResponse.new(blockers: blockers)
end
```

**Step 3: Run tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/relationship/`
Expected: Tests pass

**Step 4: Commit**

```bash
git add services/monolith/workspace/slices/relationship/grpc/block_handler.rb
git commit -m "feat(relationship): implement ListBlockedBy handler"
```

---

### Task 10: Create Frontend API Route for Blocked-By

**Files:**
- Create: `web/nyx/workspace/src/app/api/cast/guests/[id]/blocked-by/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await blockClient.listBlockedBy(
      { targetId: id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      blockers: (response.blockers || []).map((user) => ({
        id: user.id,
        userType: user.userType,
        name: user.name,
        imageUrl: user.imageUrl,
        blockedAt: user.blockedAt,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListBlockedBy Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/app/api/cast/guests/[id]/blocked-by/route.ts
git commit -m "feat(portfolio): add blocked-by API route for guest detail"
```

---

### Task 11: Create useBlockedBy Hook

**Files:**
- Create: `web/nyx/workspace/src/modules/relationship/hooks/useBlockedBy.ts`

**Step 1: Create the hook**

```typescript
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";

interface BlockedByUser {
  id: string;
  userType: string;
  name: string;
  imageUrl: string;
  blockedAt: string;
}

interface BlockedByResponse {
  blockers: BlockedByUser[];
}

export function useBlockedBy(guestId: string) {
  const { data, error, isLoading, mutate } = useSWR<BlockedByResponse>(
    guestId ? `/api/cast/guests/${guestId}/blocked-by` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    blockers: data?.blockers || [],
    loading: isLoading,
    error,
    mutate,
  };
}
```

**Step 2: Export from hooks index**

Modify `web/nyx/workspace/src/modules/relationship/hooks/index.ts`:

```typescript
export * from "./useBlockedBy";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/relationship/hooks/useBlockedBy.ts
git add web/nyx/workspace/src/modules/relationship/hooks/index.ts
git commit -m "feat(relationship): add useBlockedBy hook"
```

---

### Task 12: Add Blocked-By Section to Guest Detail Page

**Files:**
- Modify: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx`

**Step 1: Import useBlockedBy**

Add import:

```typescript
import { useBlockedBy } from "@/modules/relationship";
```

**Step 2: Add useBlockedBy hook call**

After other hooks:

```typescript
const { blockers, loading: blockersLoading } = useBlockedBy(id);
```

**Step 3: Add Blocked-By Section UI**

After Actions section:

```typescript
{/* Blocked By Section */}
{blockers.length > 0 && (
  <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
    <h3 className="text-sm font-medium text-text-secondary mb-3">
      ブロック中のキャスト
    </h3>
    {blockersLoading ? (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    ) : (
      <div className="space-y-3">
        {blockers.map((blocker) => (
          <div key={blocker.id} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-secondary">
              {blocker.imageUrl ? (
                <img
                  src={blocker.imageUrl}
                  alt={blocker.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  <Users className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {blocker.name}
              </p>
              <p className="text-xs text-text-muted">
                {formatDate(blocker.blockedAt)} からブロック中
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

**Step 4: Verify the change**

Run: `cd web/nyx/workspace && pnpm dev`
Navigate to cast's guest detail page and verify blocked-by section appears.

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx
git commit -m "feat(portfolio): add blocked-by casts section to guest detail page"
```

---

## Summary

| Phase | Task | Description |
|-------|------|-------------|
| 1 | 1 | Approval rate icon change (ThumbsUp → Shield) |
| 1 | 2 | Create GuestTagsDisplay component |
| 1 | 3 | Add guest tags to TrustSection |
| 1 | 4 | Add approved reviews to guest detail page |
| 2 | 5 | Backend: Add reviewer info to list_reviews |
| 2 | 6 | Frontend: Include reviewer info in API response |
| 2 | 7 | Proto: Add ListBlockedBy RPC |
| 2 | 8 | Backend: Implement list_by_blocked_id repository |
| 2 | 9 | Backend: Implement ListBlockedBy handler |
| 2 | 10 | Frontend: Create blocked-by API route |
| 2 | 11 | Frontend: Create useBlockedBy hook |
| 2 | 12 | Frontend: Add blocked-by section to guest detail |
