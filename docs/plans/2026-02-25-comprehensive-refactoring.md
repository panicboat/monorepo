# Comprehensive Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** monolith と nyx の全コードを対象に、パターン統一・命名整理・技術的負債を解消する

**Architecture:** 基盤優先アプローチ。まず共通ユーティリティを整備し、その後既存コードに適用する。モジュラーモノリスの原則に従い、共通化は純粋ユーティリティのみに限定する。

**Tech Stack:** Ruby/Hanami 2.x (RSpec), Next.js/React 19/TypeScript (ESLint)

**Design Doc:** `docs/plans/2026-02-25-comprehensive-refactoring-design.md`

---

## Phase 1: Monolith 共通基盤の整備

### Task 1: CursorPagination concern のテスト追加

既存の `Concerns::CursorPagination` にテストがない。リファクタリング前にテストで保護する。

**Files:**
- Read: `services/monolith/workspace/lib/concerns/cursor_pagination.rb`
- Create: `services/monolith/workspace/spec/lib/concerns/cursor_pagination_spec.rb`

**Step 1: テストファイルを作成**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "concerns/cursor_pagination"

RSpec.describe Concerns::CursorPagination do
  let(:test_class) do
    Class.new do
      include Concerns::CursorPagination
      # Make private methods public for testing
      public :normalize_limit, :decode_cursor, :encode_cursor, :build_pagination_result
    end
  end

  let(:instance) { test_class.new }

  describe "#normalize_limit" do
    it "returns default when 0" do
      expect(instance.normalize_limit(0)).to eq(1)
    end

    it "returns default when negative" do
      expect(instance.normalize_limit(-5)).to eq(1)
    end

    it "caps at MAX_LIMIT" do
      expect(instance.normalize_limit(999)).to eq(100)
    end

    it "allows valid limit" do
      expect(instance.normalize_limit(25)).to eq(25)
    end

    it "respects custom MAX_LIMIT" do
      custom_class = Class.new do
        MAX_LIMIT = 50
        include Concerns::CursorPagination
        public :normalize_limit
      end
      expect(custom_class.new.normalize_limit(75)).to eq(50)
    end
  end

  describe "#encode_cursor / #decode_cursor" do
    it "round-trips cursor data" do
      data = { created_at: Time.now.iso8601, id: "abc-123" }
      encoded = instance.encode_cursor(data)
      decoded = instance.decode_cursor(encoded)

      expect(decoded[:id]).to eq("abc-123")
      expect(decoded[:created_at]).to be_a(Time)
    end

    it "returns nil for nil cursor" do
      expect(instance.decode_cursor(nil)).to be_nil
    end

    it "returns nil for empty cursor" do
      expect(instance.decode_cursor("")).to be_nil
    end

    it "returns nil for invalid cursor" do
      expect(instance.decode_cursor("not-valid-base64!!!")).to be_nil
    end
  end

  describe "#build_pagination_result" do
    it "returns has_more: false when items <= limit" do
      items = [1, 2, 3]
      result = instance.build_pagination_result(items: items, limit: 5) { |_| "cursor" }
      expect(result[:has_more]).to be false
      expect(result[:next_cursor]).to be_nil
      expect(result[:items]).to eq([1, 2, 3])
    end

    it "returns has_more: true and truncates when items > limit" do
      items = [1, 2, 3, 4]
      result = instance.build_pagination_result(items: items, limit: 3) { |last| "cursor_#{last}" }
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).to eq("cursor_3")
      expect(result[:items]).to eq([1, 2, 3])
    end
  end
end
```

**Step 2: テストを実行して通ることを確認**

Run: `cd services/monolith && bundle exec rspec spec/lib/concerns/cursor_pagination_spec.rb -v`
Expected: ALL PASS

**Step 3: コミット**

```bash
git add spec/lib/concerns/cursor_pagination_spec.rb
git commit -m "test: add specs for CursorPagination concern"
```

---

### Task 2: 共通エラークラスの作成

26 の Use Case に散在する同一構造の `ValidationError` を共通化する。

**Files:**
- Create: `services/monolith/workspace/lib/errors/validation_error.rb`
- Create: `services/monolith/workspace/lib/errors/not_found_error.rb`
- Create: `services/monolith/workspace/lib/errors/access_denied_error.rb`
- Create: `services/monolith/workspace/spec/lib/errors/validation_error_spec.rb`

**Step 1: テストを先に書く**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe Errors::ValidationError do
  it "stores errors" do
    errors = { name: ["is required"] }
    error = described_class.new(errors)
    expect(error.errors).to eq(errors)
  end

  it "has a message from errors" do
    errors = { name: ["is required"] }
    error = described_class.new(errors)
    expect(error.message).to include("name")
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith && bundle exec rspec spec/lib/errors/validation_error_spec.rb -v`
Expected: FAIL — `cannot load such file -- errors/validation_error`

**Step 3: エラークラスを実装**

```ruby
# lib/errors/validation_error.rb
# frozen_string_literal: true

module Errors
  class ValidationError < StandardError
    attr_reader :errors

    def initialize(errors)
      @errors = errors
      super(errors.to_h.to_s)
    end
  end
end
```

```ruby
# lib/errors/not_found_error.rb
# frozen_string_literal: true

module Errors
  class NotFoundError < StandardError; end
end
```

```ruby
# lib/errors/access_denied_error.rb
# frozen_string_literal: true

module Errors
  class AccessDeniedError < StandardError; end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith && bundle exec rspec spec/lib/errors/validation_error_spec.rb -v`
Expected: ALL PASS

**Step 5: コミット**

```bash
git add lib/errors/ spec/lib/errors/
git commit -m "feat: add shared error classes (ValidationError, NotFoundError, AccessDeniedError)"
```

---

### Task 3: Identity スライスのエラークラスを共通版に移行

**Files:**
- Modify: `services/monolith/workspace/slices/identity/use_cases/auth/login.rb`
- Modify: `services/monolith/workspace/slices/identity/use_cases/auth/register.rb`

**Step 1: login.rb のネストした ValidationError を削除し、共通版を require**

`login.rb` の先頭に `require "errors/validation_error"` を追加。
クラス内の `class ValidationError ... end` ブロック（約8行）を削除。
`raise ValidationError` を `raise Errors::ValidationError` に変更。

**Step 2: register.rb も同様に移行**

同じパターンで `RegistrationError` は残し（固有のエラー）、`ValidationError` のみ共通版に移行。

**Step 3: 既存テストが通ることを確認**

Run: `cd services/monolith && bundle exec rspec spec/slices/identity/ -v`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add slices/identity/
git commit -m "refactor(identity): use shared Errors::ValidationError"
```

---

### Task 4: Post スライスのエラークラスを共通版に移行

**Files:**
- Modify: `services/monolith/workspace/slices/post/use_cases/posts/save_post.rb`
- Modify: `services/monolith/workspace/slices/post/use_cases/comments/add_comment.rb`
- Modify: その他 Post スライスの Use Case（`ValidationError` を使用しているもの）

**Step 1: save_post.rb の ValidationError を共通版に移行**

**Step 2: add_comment.rb は固有エラー（PostNotFoundError 等）が多いため、ValidationError のみ移行。固有エラーはそのまま残す。**

**Step 3: テスト実行**

Run: `cd services/monolith && bundle exec rspec spec/slices/post/ -v`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add slices/post/
git commit -m "refactor(post): use shared Errors::ValidationError"
```

---

### Task 5: 残りのスライスのエラークラスを共通版に移行

**Files:**
- Modify: Relationship, Feed, Offer, Portfolio 各スライスの Use Case

**Step 1: 各スライスを順に移行**

各スライスで `class ValidationError < StandardError` のパターンを検索し、共通版に置き換え。

検索コマンド: `grep -rn "class ValidationError" slices/`

**Step 2: スライスごとにテスト実行**

Run: `cd services/monolith && bundle exec rspec -v`
Expected: ALL PASS

**Step 3: コミット**

```bash
git add slices/
git commit -m "refactor: use shared Errors::ValidationError across all slices"
```

---

### Task 6: Feed Use Case を CursorPagination concern に移行

**Files:**
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_cast_feed.rb`

**Step 1: list_cast_feed.rb に CursorPagination を適用**

Before:
```ruby
require "base64"
require "json"

module Feed
  module UseCases
    class ListCastFeed
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50
      # ...
      private

      def decode_cursor(cursor)
        # 手動実装（12行）
      end

      def encode_cursor(data)
        # 手動実装（3行）
      end
    end
  end
end
```

After:
```ruby
require "concerns/cursor_pagination"

module Feed
  module UseCases
    class ListCastFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50
      # ...
      # decode_cursor, encode_cursor, build_pagination_result は concern から提供
      # private セクションから手動実装を削除
    end
  end
end
```

`call` メソッド内のページネーション結果構築も `build_pagination_result` に置き換え：

Before:
```ruby
has_more = posts.length > limit
posts = posts.first(limit) if has_more
next_cursor = if has_more && posts.any?
  last = posts.last
  encode_cursor(created_at: last.created_at.iso8601, id: last.id)
end
```

After:
```ruby
pagination = build_pagination_result(items: posts, limit: limit) do |last|
  encode_cursor(created_at: last.created_at.iso8601, id: last.id)
end
# pagination[:items], pagination[:next_cursor], pagination[:has_more] を使用
```

**Step 2: list_guest_feed.rb も同様に移行**

**Step 3: テスト実行**

Run: `cd services/monolith && bundle exec rspec spec/slices/feed/ -v`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add slices/feed/
git commit -m "refactor(feed): use CursorPagination concern in feed use cases"
```

---

### Task 7: Handler の手動カーソル実装を CursorPagination に移行

**Files:**
- Modify: `services/monolith/workspace/slices/post/grpc/handler.rb` (lines 155-170)
- Modify: `services/monolith/workspace/slices/relationship/grpc/handler.rb` (lines 120-135)

**Step 1: post/grpc/handler.rb から手動 encode_cursor/decode_cursor を削除し、concern を include**

**Step 2: relationship/grpc/handler.rb から手動実装を削除し、concern を include**

**Step 3: テスト実行**

Run: `cd services/monolith && bundle exec rspec -v`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add slices/post/grpc/ slices/relationship/grpc/
git commit -m "refactor: use CursorPagination concern in gRPC handlers"
```

---

### Task 8: 各スライスのフォールバック値を整理

各スライス内で `// FALLBACK:` コメント付きの値を見直し、意図を明確化する。

**Files:**
- Modify: 各スライスのハンドラー・プレゼンター（FALLBACK コメントがある箇所）

**Step 1: 全フォールバック箇所を確認**

`grep -rn "FALLBACK" slices/` で一覧取得。

**Step 2: 各スライス内でフォールバック値が適切か確認し、必要に応じてコメントを明確化**

- limit のデフォルト値 → 定数として明示（`DEFAULT_LIMIT = 20` 等）
- メディア URL フォールバック → 意図をコメントで明記
- JWT シークレット → 環境変数の必須チェックを検討

**Step 3: テスト実行**

Run: `cd services/monolith && bundle exec rspec -v`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add slices/
git commit -m "refactor: clarify fallback values across slices"
```

---

## Phase 2: Nyx 共通基盤の整備

### Task 9: gRPC エラーコード定数と API ヘルパーの作成

**Files:**
- Create: `web/nyx/workspace/src/lib/grpc-errors.ts`
- Create: `web/nyx/workspace/src/lib/api-helpers.ts`

**Step 1: gRPC エラーコード定数を作成**

```typescript
// web/nyx/workspace/src/lib/grpc-errors.ts
import { ConnectError } from "@connectrpc/connect";

export const GrpcCode = {
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
} as const;

const GRPC_TO_HTTP: Record<number, number> = {
  [GrpcCode.INVALID_ARGUMENT]: 400,
  [GrpcCode.NOT_FOUND]: 404,
  [GrpcCode.ALREADY_EXISTS]: 409,
  [GrpcCode.PERMISSION_DENIED]: 403,
  [GrpcCode.UNAUTHENTICATED]: 401,
};

export function grpcCodeToHttpStatus(code: number): number {
  return GRPC_TO_HTTP[code] ?? 500;
}

export function isConnectError(error: unknown): error is ConnectError {
  return error instanceof ConnectError;
}
```

**Step 2: API ヘルパーを作成**

```typescript
// web/nyx/workspace/src/lib/api-helpers.ts
import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { grpcCodeToHttpStatus } from "./grpc-errors";

/**
 * 認証ヘッダーを検証し、存在しない場合は 401 レスポンスを返す
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * ページネーションパラメータを抽出
 */
export function extractPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20
): { limit: number; cursor: string } {
  return {
    limit: parseInt(searchParams.get("limit") || String(defaultLimit), 10),
    cursor: searchParams.get("cursor") || "",
  };
}

/**
 * gRPC エラーを HTTP レスポンスに変換
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  if (error instanceof ConnectError) {
    const status = grpcCodeToHttpStatus(error.code);
    const message = error.rawMessage || error.message;
    return NextResponse.json({ error: message }, { status });
  }

  if (context) {
    console.error(`[${context}] Error:`, error);
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
```

**Step 3: lint で確認**

Run: `cd web/nyx/workspace && pnpm lint`
Expected: No errors

**Step 4: コミット**

```bash
git add src/lib/grpc-errors.ts src/lib/api-helpers.ts
git commit -m "feat(nyx): add gRPC error constants and API route helpers"
```

---

### Task 10: API ルートの Post マッピング重複を解消

`api/guest/timeline`, `api/cast/timeline`, `api/feed/guest` で同一の Post マッピングロジックが複製されている。既存の `post/lib/mappers.ts` にサーバーサイド用マッパーを追加。

**Files:**
- Create: `web/nyx/workspace/src/modules/post/lib/api-mappers.ts`
- Modify: `web/nyx/workspace/src/app/api/guest/timeline/route.ts`
- Modify: `web/nyx/workspace/src/app/api/cast/timeline/route.ts`
- Modify: `web/nyx/workspace/src/app/api/feed/guest/route.ts`

**Step 1: Proto → JSON のサーバーサイドマッパーを作成**

```typescript
// web/nyx/workspace/src/modules/post/lib/api-mappers.ts

/**
 * Proto の Post オブジェクトを API レスポンス用 JSON にマッピング。
 * API route (BFF) で使用。クライアントサイドの mappers.ts とは別。
 */
export function mapProtoPostToJson(post: {
  id: string;
  castId: string;
  content: string;
  media: { id: string; mediaType: string; url: string; thumbnailUrl: string }[];
  createdAt: string;
  author?: { id: string; name: string; imageUrl: string } | null;
  likesCount: number;
  commentsCount: number;
  visibility: string;
  hashtags: string[];
  liked: boolean;
}) {
  return {
    id: post.id,
    castId: post.castId,
    content: post.content,
    media: post.media.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    })),
    createdAt: post.createdAt,
    author: post.author
      ? {
          id: post.author.id,
          name: post.author.name,
          imageUrl: post.author.imageUrl,
        }
      : null,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    visibility: post.visibility,
    hashtags: post.hashtags,
    liked: post.liked,
  };
}

export function mapProtoPostsListToJson(response: {
  posts: Parameters<typeof mapProtoPostToJson>[0][];
  nextCursor: string;
  hasMore: boolean;
}) {
  return {
    posts: response.posts.map(mapProtoPostToJson),
    nextCursor: response.nextCursor,
    hasMore: response.hasMore,
  };
}
```

**Step 2: 3つの API ルートをリファクタリング**

各ルートの `response.posts.map(...)` ブロック（約20行）を `mapProtoPostsListToJson(response)` に置き換え。

例（`api/guest/timeline/route.ts`）:

Before:
```typescript
const posts = response.posts.map((post) => ({
  id: post.id,
  // ... 20行のマッピング
}));
return NextResponse.json({ posts, nextCursor: response.nextCursor, hasMore: response.hasMore });
```

After:
```typescript
import { mapProtoPostsListToJson } from "@/modules/post/lib/api-mappers";
// ...
return NextResponse.json(mapProtoPostsListToJson(response));
```

**Step 3: lint 確認**

Run: `cd web/nyx/workspace && pnpm lint`
Expected: No errors

**Step 4: コミット**

```bash
git add src/modules/post/lib/api-mappers.ts src/app/api/guest/timeline/ src/app/api/cast/timeline/ src/app/api/feed/guest/
git commit -m "refactor(nyx): extract shared post API mapper, remove duplicate mapping in routes"
```

---

### Task 11: API ルートに認証・エラーヘルパーを適用（cast/timeline の例）

**Files:**
- Modify: `web/nyx/workspace/src/app/api/cast/timeline/route.ts`

**Step 1: requireAuth と handleApiError を適用**

Before:
```typescript
export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ...
  } catch (error: any) {
    console.error("ListCastPosts Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

After:
```typescript
import { requireAuth, handleApiError } from "@/lib/api-helpers";
// ...
export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    // ...
  } catch (error: unknown) {
    return handleApiError(error, "ListCastPosts");
  }
}
```

PUT, DELETE メソッドも同様に適用。

**Step 2: lint 確認**

Run: `cd web/nyx/workspace && pnpm lint`
Expected: No errors

**Step 3: コミット**

```bash
git add src/app/api/cast/timeline/
git commit -m "refactor(nyx): apply auth/error helpers to cast/timeline route"
```

---

### Task 12: 残りの API ルートにヘルパーを適用

Task 11 と同じパターンで、残りのルートに `requireAuth`, `handleApiError`, `extractPaginationParams` を適用。

**Files:**
- Modify: `src/app/api/guest/comments/route.ts`
- Modify: `src/app/api/guest/likes/route.ts`
- Modify: `src/app/api/guest/following/route.ts`
- Modify: `src/app/api/guest/favorites/route.ts`
- Modify: `src/app/api/guest/blocks/route.ts`
- Modify: `src/app/api/cast/blocks/route.ts`
- Modify: `src/app/api/cast/following/requests/route.ts`
- Modify: `src/app/api/identity/me/route.ts`
- Modify: `src/app/api/me/trust/reviews/route.ts`
- Modify: `src/app/api/media/upload-url/route.ts`
- Modify: `src/app/api/media/register/route.ts`
- Modify: その他認証チェック or ConnectError ハンドリングのあるルート

**Step 1: 各ルートを順に移行**

パターン:
1. `if (!req.headers.get("authorization"))` → `requireAuth(req)` に置換
2. `if (error instanceof ConnectError && error.code === N)` → `handleApiError(error)` に置換
3. マジックナンバー `3`, `5`, `16` → `GrpcCode.INVALID_ARGUMENT` 等に置換（ルート固有のエラーメッセージが必要な場合は `isConnectError` + `GrpcCode` で分岐）
4. `parseInt(searchParams.get("limit") || "20", 10)` → `extractPaginationParams` に置換

**Step 2: lint + build 確認**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors

**Step 3: コミット**

```bash
git add src/app/api/
git commit -m "refactor(nyx): apply auth/error/pagination helpers across all API routes"
```

---

### Task 13: Relationship ドメインの mapper 作成

**Files:**
- Create: `web/nyx/workspace/src/modules/relationship/lib/mappers.ts`
- Modify: `web/nyx/workspace/src/app/api/guest/following/route.ts`
- Modify: `web/nyx/workspace/src/app/api/guest/favorites/route.ts`
- Modify: `web/nyx/workspace/src/app/api/guest/blocks/route.ts`
- Modify: `web/nyx/workspace/src/app/api/cast/blocks/route.ts`

**Step 1: mapper を作成**

API ルートにインライン記述されている Follow/Block/Favorite の変換ロジックを抽出。
各ルートの `response.xxx.map(...)` を確認し、共通パターンを mapper に集約。

**Step 2: API ルートを mapper 参照に変更**

**Step 3: lint 確認**

Run: `cd web/nyx/workspace && pnpm lint`
Expected: No errors

**Step 4: コミット**

```bash
git add src/modules/relationship/ src/app/api/guest/following/ src/app/api/guest/favorites/ src/app/api/guest/blocks/ src/app/api/cast/blocks/
git commit -m "refactor(nyx): extract relationship domain mappers from API routes"
```

---

### Task 14: Trust ドメインの mapper 作成

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/lib/mappers.ts`
- Modify: `web/nyx/workspace/src/app/api/me/trust/reviews/route.ts`
- Modify: `web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts`（存在する場合）

**Step 1: mapper を作成**

Review の変換ロジックを抽出。

**Step 2: API ルートを mapper 参照に変更**

**Step 3: lint 確認 + コミット**

```bash
git add src/modules/trust/lib/ src/app/api/me/trust/ src/app/api/shared/trust/
git commit -m "refactor(nyx): extract trust domain mappers from API routes"
```

---

## Phase 3: Nyx フック・状態管理の整理

### Task 15: デッドコード削除（useGuestFeed, useCastFeed）

**Files:**
- Delete: `web/nyx/workspace/src/modules/feed/hooks/useGuestFeed.ts`
- Delete: `web/nyx/workspace/src/modules/feed/hooks/useCastFeed.ts`
- Modify: `web/nyx/workspace/src/modules/feed/hooks/index.ts`

**Step 1: 使用箇所がないことを最終確認**

検索: `grep -rn "useGuestFeed\|useCastFeed" src/` で確認。
hooks/index.ts からの export 以外にヒットしないこと。

**Step 2: ファイル削除と export 更新**

`index.ts` から以下を削除:
```typescript
export { useGuestFeed } from "./useGuestFeed";
export { useCastFeed } from "./useCastFeed";
```

`index.ts` が空になる場合は、ファイルも削除。

**Step 3: lint + build 確認**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors（未使用ファイルなのでビルドに影響なし）

**Step 4: コミット**

```bash
git add -A src/modules/feed/hooks/
git commit -m "refactor(nyx): remove dead code (useGuestFeed, useCastFeed)"
```

---

### Task 16: useCastPosts を usePaginatedFetch に移行

**Files:**
- Modify: `web/nyx/workspace/src/modules/post/hooks/useCastPosts.ts`
- Read: `web/nyx/workspace/src/modules/post/hooks/useTimeline.ts`（パターン参考）

**Step 1: useCastPosts のページネーション部分を usePaginatedFetch に置き換え**

`useTimeline` のパターンに倣い:
1. `buildParams`, `mapResponse`, `getItemId`, `fetchFn` を定義
2. `usePaginatedFetch` を呼び出し
3. 手動の `useState` (posts, loading, error, nextCursor, hasMore) を削除
4. `fetchPosts(cursor?)` と `loadMore()` を `fetchInitial()` と `fetchMore()` に置き換え

CRUD 操作（`savePost`, `toggleVisibility`, `deletePost`, `removePostLocally`, `restorePostLocally`）はそのまま維持。`setItems` を使って状態を更新。

`authFetch` を使用するよう `fetchFn` を定義:
```typescript
const fetchFn = useCallback(
  async (url: string): Promise<PostsListResponse> => {
    return authFetch<PostsListResponse>(url);
  },
  []
);
```

CRUD 操作内の手動 `fetch` + `Authorization` ヘッダーも `authFetch` に移行。

**Step 2: useCastPosts を使用しているコンポーネントの互換性を確認**

使用箇所を検索: `grep -rn "useCastPosts" src/`
返り値の形が変わる場合（`fetchPosts` → `fetchInitial` 等）、呼び出し側も更新。

**Step 3: lint + build 確認**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors

**Step 4: コミット**

```bash
git add src/modules/post/hooks/useCastPosts.ts
git commit -m "refactor(nyx): migrate useCastPosts to usePaginatedFetch + authFetch"
```

---

### Task 17: useReviews をリファクタリング

`useReviews` は CRUD 操作（create, update, delete）+ リスト取得を兼ねている。
リスト取得は `useInfiniteReviews` が担うため、`useReviews` は CRUD 操作に特化させる。

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/hooks/useReviews.ts`
- Check: `useReviews` の使用箇所で `fetchReviews` / `fetchReviewsByReviewer` を `useInfiniteReviews` に移行できるか確認

**Step 1: useReviews の使用箇所を調査**

`grep -rn "useReviews" src/` で使用箇所を確認。
`fetchReviews`/`fetchReviewsByReviewer` がどこで使われているか特定。

**Step 2: useReviews からリスト取得ロジックを削除し、CRUD 操作に特化**

残す: `createReview`, `updateReview`, `deleteReview`
削除: `reviews` state, `fetchReviews`, `fetchReviewsByReviewer`, `hasMore`, `nextCursor`
リスト表示が必要な箇所は `useInfiniteReviews` を使用するよう更新。

**Step 3: lint + build 確認**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors

**Step 4: コミット**

```bash
git add src/modules/trust/
git commit -m "refactor(nyx): simplify useReviews to CRUD-only, use useInfiniteReviews for listing"
```

---

### Task 18: Portfolio モジュールの any 型を修正

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/hooks/useCastData.ts`
- Modify: `web/nyx/workspace/src/modules/portfolio/hooks/useCastProfile.ts`
- Modify: `web/nyx/workspace/src/modules/portfolio/lib/cast/mappers.ts`
- Create or modify: `web/nyx/workspace/src/modules/portfolio/types.ts`（API レスポンス型を追加）

**Step 1: API レスポンスの実際の形を API ルートから確認**

対応する API ルート（`api/cast/profile/route.ts` 等）のレスポンスの形を読み、型を定義。

**Step 2: 型を定義し mappers の any を置き換え**

```typescript
// portfolio/types.ts に追加
interface ApiSchedule {
  start: string;
  end: string;
}

interface ApiArea {
  id: string;
  name?: string;
}

interface ApiGenre {
  id: string;
  name?: string;
}

interface ApiSocialLinks {
  x?: string;
  instagram?: string;
  tiktok?: string;
  cityheaven?: string;
  litlink?: string;
  others?: string[];
}

interface ApiProfile {
  name?: string;
  slug?: string;
  tagline?: string;
  bio?: string;
  areas?: ApiArea[];
  genres?: ApiGenre[];
  defaultSchedules?: ApiSchedule[];
  socialLinks?: ApiSocialLinks;
  // ... 他のフィールド
}
```

`mappers.ts` の `any[]` → 具体的な型に置き換え。
`useCastData.ts` の `CastDataApiResponse` も更新。

**Step 3: lint + build 確認**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors

**Step 4: コミット**

```bash
git add src/modules/portfolio/
git commit -m "refactor(nyx): replace any types with proper interfaces in portfolio module"
```

---

## Phase 4: 最終確認

### Task 19: 全体ビルド + lint の最終確認

**Step 1: Monolith 全テスト実行**

Run: `cd services/monolith && bundle exec rspec -v`
Expected: ALL PASS

**Step 2: Nyx lint + build 実行**

Run: `cd web/nyx/workspace && pnpm lint && pnpm build`
Expected: No errors

**Step 3: git status で未コミットの変更がないか確認**

Run: `git status`

---

## Summary

| Phase | Tasks | 対象 |
|-------|-------|------|
| Phase 1 | Task 1-8 | Monolith: エラークラス共通化、CursorPagination 徹底、フォールバック整理 |
| Phase 2 | Task 9-14 | Nyx: API ヘルパー、Post/Relationship/Trust mapper |
| Phase 3 | Task 15-18 | Nyx: デッドコード削除、フック移行、型修正 |
| Phase 4 | Task 19 | 最終確認 |
