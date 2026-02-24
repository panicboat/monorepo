# Review Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** プロフィールページのレビュー一覧にページング機能を追加し、専用ページで無限スクロールによる全件閲覧を提供する。

**Architecture:** カーソルベースページネーション（既存の `Concerns::CursorPagination` パターンを使用）。プロフィールには3件のみ表示し、専用ページで10件ずつ無限スクロール。

**Tech Stack:** Ruby/Hanami (Backend), Next.js/React (Frontend), Protocol Buffers (gRPC)

---

## Task 1: Proto Definition Update

**Files:**
- Modify: `proto/trust/v1/service.proto:119-127`

**Step 1: Update ListReviewsRequest to add pagination params**

```protobuf
message ListReviewsRequest {
  optional string reviewee_id = 1;
  optional string status = 2;
  optional string reviewer_id = 3;
  int32 limit = 4;      // default: 20, max: 50
  string cursor = 5;    // optional, for pagination
}
```

**Step 2: Update ListReviewsResponse to add pagination fields**

```protobuf
message ListReviewsResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

**Step 3: Generate proto stubs**

Run: `cd services/monolith/workspace && bundle exec rake proto:generate`

**Step 4: Generate frontend stubs**

Run: `cd web/nyx/workspace && npm run proto:generate`

**Step 5: Commit**

```bash
git add proto/trust/v1/service.proto services/monolith/workspace/stubs/ web/nyx/workspace/src/stub/
git commit -m "feat(proto): add pagination to ListReviews"
```

---

## Task 2: Backend Repository - Add Paginated Query

**Files:**
- Modify: `services/monolith/workspace/slices/trust/repositories/review_repository.rb:48-52`
- Test: `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`

**Step 1: Write the failing test**

Add to `review_repository_spec.rb`:

```ruby
describe "#list_by_reviewee_paginated" do
  let(:reviewee_id) { "cast-123" }

  before do
    # Create 5 reviews with different timestamps
    5.times do |i|
      repo.create(
        reviewer_id: "guest-#{i}",
        reviewee_id: reviewee_id,
        content: "Review #{i}",
        score: 4,
        status: "approved"
      )
      sleep 0.01 # Ensure different created_at
    end
  end

  it "returns reviews with limit" do
    result = repo.list_by_reviewee_paginated(reviewee_id: reviewee_id, limit: 2)

    expect(result[:items].length).to eq(2)
    expect(result[:has_more]).to be true
    expect(result[:next_cursor]).not_to be_nil
  end

  it "returns next page with cursor" do
    first_page = repo.list_by_reviewee_paginated(reviewee_id: reviewee_id, limit: 2)
    second_page = repo.list_by_reviewee_paginated(
      reviewee_id: reviewee_id,
      limit: 2,
      cursor: first_page[:next_cursor]
    )

    expect(second_page[:items].length).to eq(2)
    expect(second_page[:items].first.id).not_to eq(first_page[:items].first.id)
  end

  it "returns has_more false on last page" do
    result = repo.list_by_reviewee_paginated(reviewee_id: reviewee_id, limit: 10)

    expect(result[:items].length).to eq(5)
    expect(result[:has_more]).to be false
    expect(result[:next_cursor]).to be_nil
  end

  it "filters by status" do
    repo.create(
      reviewer_id: "guest-pending",
      reviewee_id: reviewee_id,
      content: "Pending review",
      score: 3,
      status: "pending"
    )

    result = repo.list_by_reviewee_paginated(
      reviewee_id: reviewee_id,
      status: "approved",
      limit: 10
    )

    expect(result[:items].all? { |r| r.status == "approved" }).to be true
  end
end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -e "list_by_reviewee_paginated"`
Expected: FAIL with "undefined method `list_by_reviewee_paginated'"

**Step 3: Write minimal implementation**

Add to `review_repository.rb`:

```ruby
DEFAULT_LIMIT = 20
MAX_LIMIT = 50

def list_by_reviewee_paginated(reviewee_id:, status: nil, limit: DEFAULT_LIMIT, cursor: nil)
  limit = [[limit.to_i, 1].max, MAX_LIMIT].min
  decoded = decode_cursor(cursor)

  query = reviews.where(reviewee_id: reviewee_id)
  query = query.where(status: status) if status

  if decoded
    query = query.where { (created_at < decoded[:created_at]) | ((created_at =~ decoded[:created_at]) & (id < decoded[:id])) }
  end

  items = query.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a

  build_pagination_result(items: items, limit: limit)
end

def list_by_reviewer_paginated(reviewer_id:, status: nil, limit: DEFAULT_LIMIT, cursor: nil)
  limit = [[limit.to_i, 1].max, MAX_LIMIT].min
  decoded = decode_cursor(cursor)

  query = reviews.where(reviewer_id: reviewer_id)
  query = query.where(status: status) if status

  if decoded
    query = query.where { (created_at < decoded[:created_at]) | ((created_at =~ decoded[:created_at]) & (id < decoded[:id])) }
  end

  items = query.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a

  build_pagination_result(items: items, limit: limit)
end

private

def decode_cursor(cursor)
  return nil if cursor.nil? || cursor.empty?

  parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
  { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
rescue StandardError
  nil
end

def encode_cursor(data)
  Base64.urlsafe_encode64(JSON.generate(data), padding: false)
end

def build_pagination_result(items:, limit:)
  has_more = items.length > limit
  items = items.first(limit) if has_more

  next_cursor = if has_more && items.any?
    last = items.last
    encode_cursor(created_at: last.created_at.iso8601, id: last.id)
  end

  { items: items, next_cursor: next_cursor, has_more: has_more }
end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -e "list_by_reviewee_paginated"`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb
git commit -m "feat(trust): add paginated review queries to repository"
```

---

## Task 3: Backend UseCase - Update ListReviews

**Files:**
- Modify: `services/monolith/workspace/slices/trust/use_cases/reviews/list_reviews.rb`
- Test: `services/monolith/workspace/spec/slices/trust/use_cases/reviews/list_reviews_spec.rb`

**Step 1: Write the failing test**

Create `list_reviews_spec.rb`:

```ruby
# frozen_string_literal: true

RSpec.describe Trust::UseCases::Reviews::ListReviews do
  subject(:use_case) { described_class.new }

  let(:reviewee_id) { "cast-123" }
  let(:review_repo) { Trust::Slice["repositories.review_repository"] }

  before do
    5.times do |i|
      review_repo.create(
        reviewer_id: "guest-#{i}",
        reviewee_id: reviewee_id,
        content: "Review #{i}",
        score: 4,
        status: "approved"
      )
      sleep 0.01
    end
  end

  describe "#call" do
    it "returns paginated results" do
      result = use_case.call(reviewee_id: reviewee_id, limit: 2)

      expect(result[:items].length).to eq(2)
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).not_to be_nil
    end

    it "supports cursor-based pagination" do
      first = use_case.call(reviewee_id: reviewee_id, limit: 2)
      second = use_case.call(reviewee_id: reviewee_id, limit: 2, cursor: first[:next_cursor])

      expect(second[:items].first.id).not_to eq(first[:items].first.id)
    end
  end
end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/use_cases/reviews/list_reviews_spec.rb`
Expected: FAIL

**Step 3: Write minimal implementation**

Update `list_reviews.rb`:

```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:, status: nil, limit: nil, cursor: nil)
          review_repo.list_by_reviewee_paginated(
            reviewee_id: reviewee_id,
            status: status,
            limit: limit,
            cursor: cursor
          )
        end
      end
    end
  end
end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/use_cases/reviews/list_reviews_spec.rb`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/use_cases/reviews/list_reviews.rb services/monolith/workspace/spec/slices/trust/use_cases/reviews/list_reviews_spec.rb
git commit -m "feat(trust): add pagination support to ListReviews use case"
```

---

## Task 4: Backend Handler - Update list_reviews RPC

**Files:**
- Modify: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb:168-207`

**Step 1: Update list_reviews method**

Replace the `list_reviews` method:

```ruby
def list_reviews
  reviewee_id = request.message.reviewee_id.to_s.empty? ? nil : request.message.reviewee_id
  reviewer_id = request.message.reviewer_id.to_s.empty? ? nil : request.message.reviewer_id
  status = request.message.status.to_s.empty? ? nil : request.message.status
  limit = request.message.limit.to_i
  limit = nil if limit <= 0
  cursor = request.message.cursor.to_s.empty? ? nil : request.message.cursor

  result = if reviewer_id
    review_repo.list_by_reviewer_paginated(reviewer_id: reviewer_id, status: status, limit: limit, cursor: cursor)
  elsif reviewee_id
    list_reviews_uc.call(reviewee_id: reviewee_id, status: status, limit: limit, cursor: cursor)
  else
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "reviewee_id or reviewer_id is required")
  end

  reviews = result[:items]

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

  ::Trust::V1::ListReviewsResponse.new(
    reviews: items,
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more] || false
  )
end
```

**Step 2: Run existing tests to verify no regression**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/`
Expected: PASS

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/grpc/trust_handler.rb
git commit -m "feat(trust): add pagination to list_reviews handler"
```

---

## Task 5: Frontend Types - Update ListReviewsResponse

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/types.ts:45-47`

**Step 1: Update ListReviewsResponse type**

```typescript
export interface ListReviewsResponse {
  reviews: Review[];
  nextCursor?: string;
  hasMore?: boolean;
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/types.ts
git commit -m "feat(trust): add pagination fields to ListReviewsResponse type"
```

---

## Task 6: Frontend API Route - Add Pagination Params

**Files:**
- Modify: `web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts`

**Step 1: Update GET handler to support pagination**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");
    const reviewerId = req.nextUrl.searchParams.get("reviewer_id");
    const status = req.nextUrl.searchParams.get("status");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const cursor = req.nextUrl.searchParams.get("cursor");

    if (!revieweeId && !reviewerId) {
      return NextResponse.json(
        { error: "reviewee_id or reviewer_id is required" },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const response = await trustClient.listReviews(
      {
        revieweeId: revieweeId || undefined,
        reviewerId: reviewerId || undefined,
        status: status || undefined,
        limit: limit || 0,
        cursor: cursor || undefined,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // FALLBACK: Returns empty array when response reviews is missing
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

    return NextResponse.json({
      reviews,
      nextCursor: response.nextCursor || null,
      hasMore: response.hasMore || false,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListReviews Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts
git commit -m "feat(trust): add pagination params to reviews API route"
```

---

## Task 7: Frontend Hook - Update useReviews with Pagination

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/hooks/useReviews.ts`

**Step 1: Update useReviews to support limit param**

```typescript
"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Review, CreateReviewRequest, CreateReviewResponse, ListReviewsResponse } from "../types";

interface FetchReviewsOptions {
  limit?: number;
  cursor?: string;
}

export function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchReviews = useCallback(async (
    revieweeId: string,
    status?: string,
    options?: FetchReviewsOptions
  ) => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }

    setLoading(true);
    try {
      let url = `/api/shared/trust/reviews?reviewee_id=${revieweeId}`;
      if (status) {
        url += `&status=${status}`;
      }
      if (options?.limit) {
        url += `&limit=${options.limit}`;
      }
      if (options?.cursor) {
        url += `&cursor=${encodeURIComponent(options.cursor)}`;
      }
      const data = await authFetch<ListReviewsResponse>(url);
      setReviews(data.reviews);
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);
      return data;
    } catch (e) {
      console.error("Fetch reviews error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewsByReviewer = useCallback(async (
    reviewerId: string,
    status?: string,
    options?: FetchReviewsOptions
  ) => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }

    setLoading(true);
    try {
      let url = `/api/shared/trust/reviews?reviewer_id=${reviewerId}`;
      if (status) {
        url += `&status=${status}`;
      }
      if (options?.limit) {
        url += `&limit=${options.limit}`;
      }
      if (options?.cursor) {
        url += `&cursor=${encodeURIComponent(options.cursor)}`;
      }
      const data = await authFetch<ListReviewsResponse>(url);
      setReviews(data.reviews);
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);
      return data;
    } catch (e) {
      console.error("Fetch reviews by reviewer error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createReview = useCallback(async (request: CreateReviewRequest) => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }

    setLoading(true);
    try {
      const data = await authFetch<CreateReviewResponse>("/api/me/trust/reviews", {
        method: "POST",
        body: request,
      });
      return data;
    } catch (e) {
      console.error("Create review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateReview = useCallback(async (id: string, content: string | undefined, score: number) => {
    // FALLBACK: Returns false when not authenticated
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "PATCH",
        body: { content, score },
      });

      if (data.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, content, score } : r))
        );
      }
      return data.success;
    } catch (e) {
      console.error("Update review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    // FALLBACK: Returns false when not authenticated
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(`/api/me/trust/reviews/${id}`, {
        method: "DELETE",
      });

      if (data.success) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Delete review error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reviews,
    fetchReviews,
    fetchReviewsByReviewer,
    createReview,
    updateReview,
    deleteReview,
    loading,
    hasMore,
    nextCursor,
  };
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/hooks/useReviews.ts
git commit -m "feat(trust): add pagination support to useReviews hook"
```

---

## Task 8: Frontend Hook - Create useInfiniteReviews

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/hooks/useInfiniteReviews.ts`
- Modify: `web/nyx/workspace/src/modules/trust/hooks/index.ts`

**Step 1: Create useInfiniteReviews hook**

```typescript
"use client";

import { useCallback, useState, useRef } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Review, ListReviewsResponse } from "../types";

const PAGE_SIZE = 10;

interface UseInfiniteReviewsOptions {
  revieweeId?: string;
  reviewerId?: string;
  status?: string;
}

export function useInfiniteReviews(options: UseInfiniteReviewsOptions) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const buildUrl = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams();
    if (options.revieweeId) {
      params.set("reviewee_id", options.revieweeId);
    }
    if (options.reviewerId) {
      params.set("reviewer_id", options.reviewerId);
    }
    if (options.status) {
      params.set("status", options.status);
    }
    params.set("limit", String(PAGE_SIZE));
    if (cursor) {
      params.set("cursor", cursor);
    }
    return `/api/shared/trust/reviews?${params.toString()}`;
  }, [options.revieweeId, options.reviewerId, options.status]);

  const fetchInitial = useCallback(async () => {
    if (!getAuthToken()) {
      throw new Error("Authentication required");
    }

    setLoading(true);
    try {
      const url = buildUrl();
      const data = await authFetch<ListReviewsResponse>(url);
      setReviews(data.reviews);
      setHasMore(data.hasMore || false);
      cursorRef.current = data.nextCursor || null;
      initializedRef.current = true;
      return data;
    } catch (e) {
      console.error("Fetch reviews error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const fetchMore = useCallback(async () => {
    if (!getAuthToken() || !hasMore || loadingMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const url = buildUrl(cursorRef.current);
      const data = await authFetch<ListReviewsResponse>(url);
      // Prevent duplicate entries during pagination
      setReviews((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newReviews = data.reviews.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newReviews];
      });
      setHasMore(data.hasMore || false);
      cursorRef.current = data.nextCursor || null;
      return data;
    } catch (e) {
      console.error("Fetch more reviews error:", e);
      throw e;
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, hasMore, loadingMore]);

  const reset = useCallback(() => {
    setReviews([]);
    setHasMore(true);
    cursorRef.current = null;
    initializedRef.current = false;
  }, []);

  return {
    reviews,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
    initialized: initializedRef.current,
  };
}
```

**Step 2: Export from index.ts**

Add to `hooks/index.ts`:

```typescript
export { useInfiniteReviews } from "./useInfiniteReviews";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/hooks/useInfiniteReviews.ts web/nyx/workspace/src/modules/trust/hooks/index.ts
git commit -m "feat(trust): add useInfiniteReviews hook for infinite scroll"
```

---

## Task 9: Frontend Component - Create ReviewListPage

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/components/ReviewListPage.tsx`
- Modify: `web/nyx/workspace/src/modules/trust/components/index.ts`

**Step 1: Create ReviewListPage component**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2, ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useInfiniteReviews } from "../hooks/useInfiniteReviews";
import { ReviewCard } from "./ReviewCard";
import type { ReviewStats } from "../types";

interface ReviewListPageProps {
  targetId: string;
  targetName: string;
  targetType: "cast" | "guest";
  backUrl: string;
  stats?: ReviewStats | null;
}

export function ReviewListPage({
  targetId,
  targetName,
  targetType,
  backUrl,
  stats,
}: ReviewListPageProps) {
  const { reviews, loading, loadingMore, hasMore, fetchInitial, fetchMore } =
    useInfiniteReviews({
      revieweeId: targetType === "cast" ? targetId : undefined,
      reviewerId: targetType === "guest" ? targetId : undefined,
      status: "approved",
    });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Prevent browser scroll restoration from applying previous page's scroll position
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loadingMore) {
        fetchMore();
      }
    },
    [hasMore, loadingMore, fetchMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: "100px",
    });
    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  return (
    <div className="min-h-screen bg-surface-secondary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href={backUrl}
            className="p-2 -ml-2 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">
              {targetName} のレビュー
            </h1>
            {stats && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span>{stats.averageScore.toFixed(1)}</span>
                <span className="text-text-muted">({stats.totalReviews}件)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <p className="text-sm">レビューはまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showReviewerLink={targetType === "cast"}
              />
            ))}

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-4" />

            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            )}

            {!hasMore && reviews.length > 0 && (
              <div className="text-center py-4 text-sm text-text-muted">
                すべてのレビューを表示しました
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Export from index.ts**

Add to `components/index.ts`:

```typescript
export { ReviewListPage } from "./ReviewListPage";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/ReviewListPage.tsx web/nyx/workspace/src/modules/trust/components/index.ts
git commit -m "feat(trust): add ReviewListPage component with infinite scroll"
```

---

## Task 10: Frontend Component - Update TrustSection

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/TrustSection.tsx`

**Step 1: Update TrustSection to show 3 reviews + link**

```typescript
"use client";

import { useEffect, useCallback } from "react";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useReviews, useReviewStats } from "../hooks";
import { ReviewStatsDisplay } from "./ReviewStatsDisplay";
import { ReviewList } from "./ReviewList";

interface TrustSectionProps {
  targetId: string;
  targetName?: string;
  showWriteReview?: boolean;
  reviewsLinkHref?: string;
}

const PREVIEW_LIMIT = 3;

export function TrustSection({
  targetId,
  reviewsLinkHref,
}: TrustSectionProps) {
  const { reviews, loading: reviewsLoading, fetchReviews, hasMore } = useReviews();
  const { stats, loading: statsLoading } = useReviewStats(targetId);

  const loadReviews = useCallback(async () => {
    if (targetId) {
      await fetchReviews(targetId, "approved", { limit: PREVIEW_LIMIT });
    }
  }, [targetId, fetchReviews]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const totalReviews = stats?.totalReviews || 0;
  const showSeeAllLink = reviewsLinkHref && (hasMore || totalReviews > PREVIEW_LIMIT);

  return (
    <div className="space-y-4">
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
        showReviewerLink={false}
        emptyMessage="まだレビューはありません"
      />

      {/* See All Link */}
      {showSeeAllLink && (
        <Link
          href={reviewsLinkHref}
          className="flex items-center justify-center gap-1 py-3 text-sm text-info hover:text-info-hover transition-colors"
        >
          <span>すべてのレビューを見る</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/TrustSection.tsx
git commit -m "feat(trust): show 3 reviews with see-all link in TrustSection"
```

---

## Task 11: Frontend - Update Module Exports

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/index.ts`

**Step 1: Export new components and hooks**

Ensure `index.ts` exports:

```typescript
export { useInfiniteReviews } from "./hooks";
export { ReviewListPage } from "./components";
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/index.ts
git commit -m "feat(trust): export infinite reviews hook and page component"
```

---

## Task 12: Frontend Page - Create Cast Reviews Page

**Files:**
- Create: `web/nyx/workspace/src/app/(guest)/casts/[id]/reviews/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ReviewListPage, useReviewStats } from "@/modules/trust";

interface CastData {
  profile: {
    id: string;
    name: string;
  };
}

export default function CastReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [castData, setCastData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useReviewStats(id);

  useEffect(() => {
    async function fetchCast() {
      try {
        const res = await fetch(`/api/guest/casts/${id}`);
        if (!res.ok) {
          setError("Cast not found");
          return;
        }
        const json = await res.json();
        setCastData(json);
      } catch (e) {
        setError("Failed to load cast");
      } finally {
        setLoading(false);
      }
    }
    fetchCast();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
      </div>
    );
  }

  if (error || !castData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <p className="text-text-secondary">{error || "Cast not found"}</p>
      </div>
    );
  }

  return (
    <ReviewListPage
      targetId={id}
      targetName={castData.profile.name}
      targetType="cast"
      backUrl={`/casts/${id}`}
      stats={stats}
    />
  );
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/app/\(guest\)/casts/\[id\]/reviews/page.tsx
git commit -m "feat(trust): add cast reviews page with infinite scroll"
```

---

## Task 13: Frontend Page - Create Guest Reviews Page

**Files:**
- Create: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/reviews/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { ReviewListPage } from "@/modules/trust";

interface GuestDetail {
  id: string;
  userId: string;
  name: string;
}

export default function GuestReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = getAuthToken();

  const { data, error, isLoading } = useSWR<GuestDetail>(
    token ? `/api/cast/guests/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-role-cast" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <p className="text-text-secondary">ゲストが見つかりません</p>
      </div>
    );
  }

  return (
    <ReviewListPage
      targetId={data.userId}
      targetName={data.name || "ゲスト"}
      targetType="guest"
      backUrl={`/cast/guests/${id}`}
      stats={null}
    />
  );
}
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/app/\(cast\)/cast/guests/\[id\]/reviews/page.tsx
git commit -m "feat(trust): add guest reviews page with infinite scroll"
```

---

## Task 14: Frontend - Update Profile Pages with Review Links

**Files:**
- Modify: `web/nyx/workspace/src/app/(guest)/casts/[id]/page.tsx`
- Modify: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx`

**Step 1: Update Cast Detail Page**

In `TrustSectionWrapper`, pass `reviewsLinkHref`:

```typescript
function TrustSectionWrapper({
  castId,
  castName,
}: {
  castId: string;
  castName?: string;
}) {
  return (
    <div className="mx-4 my-4">
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
        <TrustSection
          targetId={castId}
          targetName={castName}
          showWriteReview={false}
          reviewsLinkHref={`/casts/${castId}/reviews`}
        />
      </div>
    </div>
  );
}
```

**Step 2: Update Guest Detail Page**

Replace the Reviews Section with TrustSection or add link:

```typescript
{/* Reviews Section */}
<div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-text-secondary">
      このゲストが書いたレビュー
    </h3>
    {reviews.length > 0 && (
      <Link
        href={`/cast/guests/${id}/reviews`}
        className="text-sm text-info hover:text-info-hover flex items-center gap-1"
      >
        すべて見る
        <ChevronRight className="h-4 w-4" />
      </Link>
    )}
  </div>
  <ReviewList
    reviews={reviews.slice(0, 3)}
    loading={reviewsLoading}
    emptyMessage="このゲストはまだレビューを書いていません"
  />
</div>
```

Add import:

```typescript
import { ChevronRight } from "lucide-react";
import Link from "next/link";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/app/\(guest\)/casts/\[id\]/page.tsx web/nyx/workspace/src/app/\(cast\)/cast/guests/\[id\]/page.tsx
git commit -m "feat(trust): add review page links to profile pages"
```

---

## Task 15: Integration Test

**Step 1: Run backend tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/`
Expected: All PASS

**Step 2: Run frontend type check**

Run: `cd web/nyx/workspace && npm run typecheck`
Expected: No errors

**Step 3: Manual test**

1. Open cast detail page → verify 3 reviews shown
2. Click "すべてのレビューを見る" → navigate to reviews page
3. Scroll down → verify infinite scroll loads more reviews
4. Repeat for guest detail page

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review pagination integration issues"
```
