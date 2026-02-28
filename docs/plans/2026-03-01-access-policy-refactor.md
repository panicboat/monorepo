# Access Policy Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** アクセスポリシーを修正する — Guest→Castブロック削除、Cast→Guestブロック強化、お気に入り機能の完全削除。

**Architecture:** 3つの独立した変更を段階的に実施。既存のPolicy/Adapterパターンを活用し、各レイヤー（Proto → Backend → Frontend → Docs）を順に修正する。

**Tech Stack:** Ruby/Hanami (Backend), Next.js/React (Frontend), Protocol Buffers, PostgreSQL

---

## Task 1: お気に入り機能の削除 — Proto & Backend

お気に入り機能のバックエンド実装を全て削除する。

**Files:**
- Delete: `proto/relationship/v1/favorite_service.proto`
- Delete: `services/monolith/workspace/slices/relationship/grpc/favorite_handler.rb`
- Delete: `services/monolith/workspace/slices/relationship/repositories/favorite_repository.rb`
- Delete: `services/monolith/workspace/slices/relationship/relations/favorites.rb`
- Delete: `services/monolith/workspace/slices/relationship/use_cases/favorites/` (directory)
- Modify: `services/monolith/workspace/bin/grpc:44` — `require "relationship/v1/favorite_service_services_pb"` 行を削除
- Modify: `services/monolith/workspace/bin/grpc:74` — `require_relative "../slices/relationship/grpc/favorite_handler"` 行を削除

**Step 1: Proto ファイル削除**

```bash
rm proto/relationship/v1/favorite_service.proto
```

**Step 2: Backend ファイル削除**

```bash
rm services/monolith/workspace/slices/relationship/grpc/favorite_handler.rb
rm services/monolith/workspace/slices/relationship/repositories/favorite_repository.rb
rm services/monolith/workspace/slices/relationship/relations/favorites.rb
rm -rf services/monolith/workspace/slices/relationship/use_cases/favorites/
```

**Step 3: bin/grpc からお気に入り関連の require を削除**

`services/monolith/workspace/bin/grpc` の以下2行を削除:
- L44: `require "relationship/v1/favorite_service_services_pb"`
- L74: `require_relative "../slices/relationship/grpc/favorite_handler"`

**Step 4: Proto を再生成**

```bash
cd services/monolith/workspace && ./bin/codegen
```

生成済みスタブ `stubs/relationship/v1/favorite_service_pb.rb` と `stubs/relationship/v1/favorite_service_services_pb.rb` も削除。

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: remove favorites proto, handler, repository, relations, and use cases"
```

---

## Task 2: お気に入り機能の削除 — Feed & Adapter 層

Feed の FAVORITES フィルタと Adapter のお気に入り関連メソッドを削除する。

**Files:**
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb:37-38,83-96`
- Modify: `services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb:10-12,28-30`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb:39`
- Modify: `services/monolith/workspace/slices/post/adapters/relationship_adapter.rb:31-33,45-47`
- Modify: `proto/feed/v1/feed_service.proto:18`

**Step 1: Feed UseCase から favorites フィルタ削除**

`services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb` を修正:
- `when "favorites"` ブランチ (L37-38) を削除
- `list_favorite_posts` メソッド (L83-96) を削除

修正後の `call` メソッドの case 文:
```ruby
posts, authors = case filter
when "all"
  list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
when "following"
  list_following_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
else
  list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
end
```

**Step 2: Feed Adapter からお気に入りメソッド削除**

`services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb` を修正:
- `favorite_cast_user_ids` メソッド (L10-12) を削除
- `favorite_repo` private メソッド (L28-30) を削除

**Step 3: Feed Handler から FAVORITES 分岐削除**

`services/monolith/workspace/slices/feed/grpc/handler.rb:39` を削除:
```ruby
when :FEED_FILTER_FAVORITES then "favorites"
```

**Step 4: Post Adapter からお気に入りメソッド削除**

`services/monolith/workspace/slices/post/adapters/relationship_adapter.rb` を修正:
- `favorite_cast_user_ids` メソッド (L31-33) を削除
- `favorite_repo` private メソッド (L45-47) を削除

**Step 5: Feed Proto から FAVORITES enum 削除**

`proto/feed/v1/feed_service.proto:18` を削除:
```protobuf
FEED_FILTER_FAVORITES = 3;  // Posts from favorited casts only
```

Proto を再生成:
```bash
cd services/monolith/workspace && ./bin/codegen
```

**Step 6: テスト修正**

`services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb` から `context "with filter: favorites"` ブロック (L105-131) を削除。

**Step 7: テスト実行**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/feed/
```

Expected: All tests pass

**Step 8: Commit**

```bash
git add -A && git commit -m "refactor: remove favorites from feed, adapters, and proto"
```

---

## Task 3: お気に入り機能の削除 — Frontend

Frontend のお気に入り関連コード（hooks, routes, pages, store, components）を全て削除する。

**Files:**
- Delete: `web/nyx/workspace/src/modules/relationship/hooks/useFavorite.ts`
- Delete: `web/nyx/workspace/src/app/api/guest/favorites/route.ts`
- Delete: `web/nyx/workspace/src/app/api/guest/favorites/status/route.ts`
- Delete: `web/nyx/workspace/src/app/(guest)/favorites/page.tsx`
- Modify: `web/nyx/workspace/src/modules/relationship/hooks/index.ts`
- Modify: `web/nyx/workspace/src/modules/relationship/types.ts`
- Modify: `web/nyx/workspace/src/stores/socialStore.ts`
- Modify: `web/nyx/workspace/src/modules/feed/types.ts`
- Modify: `web/nyx/workspace/src/modules/feed/components/feed/TimelineFilters.tsx`
- Modify: `web/nyx/workspace/src/app/api/feed/guest/route.ts`
- Modify: `web/nyx/workspace/src/app/(guest)/casts/[userId]/page.tsx`
- Modify: `web/nyx/workspace/src/modules/portfolio/components/guest/GuestDashboard.tsx`

**Step 1: ファイル削除**

```bash
rm web/nyx/workspace/src/modules/relationship/hooks/useFavorite.ts
rm web/nyx/workspace/src/app/api/guest/favorites/route.ts
rm web/nyx/workspace/src/app/api/guest/favorites/status/route.ts
rm web/nyx/workspace/src/app/\(guest\)/favorites/page.tsx
```

favorites ディレクトリが空になった場合は削除:
```bash
rmdir web/nyx/workspace/src/app/api/guest/favorites 2>/dev/null
rmdir web/nyx/workspace/src/app/\(guest\)/favorites 2>/dev/null
```

**Step 2: hooks/index.ts から useFavorite の export 削除**

`web/nyx/workspace/src/modules/relationship/hooks/index.ts` から以下を削除:
```typescript
export { useFavorite } from "./useFavorite";
```

**Step 3: types.ts からお気に入り型削除**

`web/nyx/workspace/src/modules/relationship/types.ts` から以下を削除:
```typescript
export interface FavoriteCast {
  id: string;
  name: string;
  imageUrl: string;
  area: string;
}

export interface FavoriteState {
  [castId: string]: boolean;
}
```

**Step 4: socialStore.ts からお気に入り関連の state/actions/selectors 削除**

`web/nyx/workspace/src/stores/socialStore.ts` を修正:
- State から削除: `favorites: string[]`, `isFavoritesSynced: boolean`
- Actions から削除: `toggleFavorite`, `setFavorites`, `addFavorite`, `removeFavorite`, `setFavoritesSynced`
- Computed から削除: `isFavorite`
- 初期値から削除: `favorites: []`, `isFavoritesSynced: false`
- 全実装から favorites 関連を削除
- Selectors から削除: `selectFavorites`, `selectIsFavoritesSynced`

**Step 5: Feed types から favorites 削除**

`web/nyx/workspace/src/modules/feed/types.ts:6` を修正:
```typescript
// Before:
export type FeedFilter = "all" | "following" | "favorites";
// After:
export type FeedFilter = "all" | "following";
```

**Step 6: TimelineFilters から favorites タブ削除**

`web/nyx/workspace/src/modules/feed/components/feed/TimelineFilters.tsx` を修正:

FilterType を修正:
```typescript
// Before:
export type FilterType = "all" | "following" | "favorites";
// After:
export type FilterType = "all" | "following";
```

filters 配列を修正:
```typescript
// Before:
const filters: FilterType[] = ["all", "following", "favorites"];
// After:
const filters: FilterType[] = ["all", "following"];
```

**Step 7: Guest Feed API route から favorites mapping 削除**

`web/nyx/workspace/src/app/api/feed/guest/route.ts` を修正:
- `FeedFilter` の import から `FAVORITES` を考慮（Proto再生成後に値が消えるため、フォールバック行を削除）
- `else if (filter === "favorites")` 行を削除

**Step 8: Cast Detail Page から FavoriteButton 削除**

`web/nyx/workspace/src/app/(guest)/casts/[userId]/page.tsx` を修正:
- `useFavorite` の import を削除
- `FavoriteButton` コンポーネントとその使用箇所を削除

**Step 9: GuestDashboard からお気に入りセクション削除**

`web/nyx/workspace/src/modules/portfolio/components/guest/GuestDashboard.tsx` を修正:
- `useFavorite` の import を削除
- `FavoriteCast` 型の import を削除
- お気に入りプレビューセクションを削除

**Step 10: GuestTopNavBar からお気に入りパス検出を削除**

`web/nyx/workspace/src/components/layout/guest/GuestTopNavBar.tsx` から `/favorites` パス検出ロジックを削除（存在する場合）。

**Step 11: Proto 再生成（Frontend）**

```bash
cd web/nyx/workspace && pnpm proto:gen
```

**Step 12: ビルド確認**

```bash
cd web/nyx/workspace && pnpm build
```

Expected: Build succeeds with no type errors

**Step 13: Commit**

```bash
git add -A && git commit -m "refactor: remove favorites feature from frontend"
```

---

## Task 4: Guest → Cast ブロック削除 — Backend

Guest がキャストをブロックする機能を AccessPolicy と Adapter から削除する。

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/policies/profile_access_policy.rb`
- Modify: `services/monolith/workspace/slices/portfolio/adapters/social_adapter.rb`
- Modify: `services/monolith/workspace/slices/post/policies/access_policy.rb`
- Modify: `services/monolith/workspace/slices/post/adapters/relationship_adapter.rb`
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`
- Modify: `services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`

**Step 1: ProfileAccessPolicy から Guest→Cast ブロックチェック削除**

`services/monolith/workspace/slices/portfolio/policies/profile_access_policy.rb` を修正:

`can_view_profile?` を簡素化（ブロックチェック不要、常に true）:
```ruby
def can_view_profile?(cast:, viewer_guest_id: nil)
  true
end
```

`can_view_profile_details?` から Guest→Cast ブロックチェックを削除:
```ruby
def can_view_profile_details?(cast:, viewer_guest_id: nil)
  # Public cast = everyone can view details
  return true if cast.visibility == "public"

  # Private cast = only approved followers can view details
  return false if viewer_guest_id.nil?

  social_adapter.approved_follower?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
end
```

**Step 2: SocialAdapter から `blocked?` メソッド削除**

`services/monolith/workspace/slices/portfolio/adapters/social_adapter.rb` から `blocked?` メソッド (L21-25) を削除。`cast_blocked_guest?` はそのまま残す。

**Step 3: PostAccessPolicy から Guest→Cast ブロックチェック削除**

`services/monolith/workspace/slices/post/policies/access_policy.rb` を修正:

`can_view_post?` からブロックチェックを削除:
```ruby
def can_view_post?(post:, cast:, viewer_guest_id: nil)
  # Public cast + public post = visible to all
  return true if cast.visibility == "public" && post.visibility == "public"

  # Otherwise, only approved followers can view
  return false if viewer_guest_id.nil?

  approved_follower?(cast_user_id: cast.user_id, guest_user_id: viewer_guest_id)
end
```

`filter_viewable_posts` から `blocked_cast_ids` の取得と除外ロジックを削除:
```ruby
def filter_viewable_posts(posts:, casts_map:, viewer_guest_id: nil)
  return [] if posts.empty?

  cast_user_ids = posts.map(&:cast_user_id).uniq

  # Get follow status for all casts
  follow_statuses = if viewer_guest_id
    @relationship_adapter.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: viewer_guest_id)
  else
    {}
  end

  posts.select do |post|
    cast = casts_map[post.cast_user_id]
    next false if cast.nil?

    # Public cast + public post = visible
    if cast.visibility == "public" && post.visibility == "public"
      true
    else
      # Approved follower only
      follow_statuses[cast.user_id] == "approved"
    end
  end
end
```

private の `blocked?` メソッドも削除。

**Step 4: Post RelationshipAdapter から Guest ブロック関連メソッド削除**

`services/monolith/workspace/slices/post/adapters/relationship_adapter.rb` から以下を削除:
- `blocked?` メソッド (L19-21)
- `blocked_cast_ids` メソッド (L23-25)

`blocked_guest_ids` メソッド (L27-29) は Cast→Guest ブロック強化で使う可能性があるので残す。`block_repo` private メソッドも残す。

**Step 5: Feed UseCase から Guest→Cast ブロック除外を削除**

`services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb` を修正:

`call` メソッドから `blocked_cast_ids` ロジックを削除。`blocker_id` パラメータは Feed Handler が comment 除外に使っているため、パラメータ自体は残すが UseCase 内では使わない:

```ruby
def call(guest_id:, filter:, limit: DEFAULT_LIMIT, cursor: nil, blocker_id: nil)
  limit = normalize_limit(limit)
  decoded_cursor = decode_cursor(cursor)

  posts, authors = case filter
  when "all"
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor)
  when "following"
    list_following_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor)
  else
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor)
  end

  pagination = build_pagination_result(items: posts, limit: limit) do |last|
    encode_cursor(created_at: last.created_at.iso8601, id: last.id)
  end

  { posts: pagination[:items], next_cursor: pagination[:next_cursor], has_more: pagination[:has_more], authors: authors }
end
```

各 private メソッドから `exclude_cast_ids` パラメータを削除:
```ruby
def list_all_posts(guest_id:, limit:, cursor:)
  public_cast_user_ids = @cast_adapter.public_cast_ids
  followed_cast_user_ids = @relationship_adapter.following_cast_user_ids(guest_user_id: guest_id)

  posts = @post_adapter.list_all_for_authenticated(
    public_cast_user_ids: public_cast_user_ids,
    followed_cast_user_ids: followed_cast_user_ids,
    limit: limit,
    cursor: cursor
  )

  authors = load_authors(posts)
  [posts, authors]
end

def list_following_posts(guest_id:, limit:, cursor:)
  cast_user_ids = @relationship_adapter.following_cast_user_ids(guest_user_id: guest_id)
  return [[], {}] if cast_user_ids.empty?

  posts = @post_adapter.list_all_by_cast_user_ids(
    cast_user_ids: cast_user_ids,
    limit: limit,
    cursor: cursor
  )

  authors = load_authors(posts)
  [posts, authors]
end
```

注意: `@post_adapter` の `list_all_for_authenticated` / `list_all_by_cast_user_ids` メソッドが `exclude_cast_user_ids` パラメータを受け取っている場合は、そのパラメータを渡さないだけでOK（nilまたは省略で空配列扱い）。もし必須パラメータなら、空配列 `[]` を渡す。実装時に確認すること。

**Step 6: Feed Adapter から `blocked_cast_ids` メソッド削除**

`services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb` から `blocked_cast_ids` メソッド (L15-17) を削除。

`blocked_guest_ids` (L19-21) と `block_repo` (L31-33) は Feed Handler の `get_blocked_user_ids` で使われているので残す。

**Step 7: テスト修正**

`services/monolith/workspace/spec/slices/portfolio/policies/profile_access_policy_spec.rb` を修正:
- `can_view_profile?` テストから「returns false when blocked」テスト (L51-58) を削除
- `blocked?` の mock を削除

`services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb` を修正:
- `context "with blocked casts"` ブロック (L133-168) を削除

**Step 8: テスト実行**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/policies/ spec/slices/feed/ spec/slices/post/
```

Expected: All tests pass

**Step 9: Commit**

```bash
git add -A && git commit -m "refactor: remove guest-to-cast block checks from access policies and adapters"
```

---

## Task 5: Guest → Cast ブロック削除 — Frontend & Proto

Guest 側のブロック API route, hook, store を削除する。

**Files:**
- Delete: `web/nyx/workspace/src/app/api/guest/blocks/route.ts`
- Delete: `web/nyx/workspace/src/app/api/guest/blocks/status/route.ts` (存在する場合)
- Modify: `web/nyx/workspace/src/modules/relationship/hooks/useBlock.ts`
- Modify: `web/nyx/workspace/src/stores/socialStore.ts`
- Modify: `web/nyx/workspace/src/modules/relationship/types.ts`

**Step 1: Guest ブロック API route 削除**

```bash
rm web/nyx/workspace/src/app/api/guest/blocks/route.ts
rm -f web/nyx/workspace/src/app/api/guest/blocks/status/route.ts
rmdir web/nyx/workspace/src/app/api/guest/blocks 2>/dev/null
```

**Step 2: useBlock hook から Guest ブロックロジック削除**

`web/nyx/workspace/src/modules/relationship/hooks/useBlock.ts` を修正:
- Guest 側の API 呼び出し（`/api/guest/blocks` エンドポイント）を削除
- Cast 側のブロック機能は残す（`/api/cast/blocks` エンドポイント）
- hook の API が Cast ブロック専用になるよう整理

**Step 3: socialStore から blocking state 削除**

`web/nyx/workspace/src/stores/socialStore.ts` から以下を削除:
- State: `blocking: string[]`
- Actions: `toggleBlock(targetId: string)`
- Computed: `isBlocking(targetId: string)`
- 初期値: `blocking: []`
- 実装の `toggleBlock` 関数
- Selectors: `selectBlocking`
- persist の partialize から `blocking` を削除（blocking がなくなるため、persist 自体を見直す）

**Step 4: types.ts から BlockedUser/BlockState 削除（Guest 専用の場合）**

`web/nyx/workspace/src/modules/relationship/types.ts` を確認:
- `BlockedUser` と `BlockState` が Guest ブロックにのみ使われている場合は削除
- Cast のブロックリスト画面で使われている場合は残す（Cast blocks page は独自に型定義している可能性あり。実装時に確認）

**Step 5: ビルド確認**

```bash
cd web/nyx/workspace && pnpm build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: remove guest-to-cast block from frontend"
```

---

## Task 6: Cast → Guest ブロック強化 — テスト作成

Cast がゲストをブロックした場合に、プロフィール詳細・投稿・フィードが制限されることをテストする。

**Files:**
- Modify: `services/monolith/workspace/spec/slices/portfolio/policies/profile_access_policy_spec.rb`

**Step 1: ProfileAccessPolicy に Cast→Guest ブロックのテスト追加**

`services/monolith/workspace/spec/slices/portfolio/policies/profile_access_policy_spec.rb` に追加:

```ruby
describe "#can_view_profile? (with cast-blocked-guest)" do
  it "returns true even when cast blocked the guest (basic profile always visible)" do
    allow(social_adapter).to receive(:cast_blocked_guest?).and_return(true)

    result = policy.can_view_profile?(cast: yuna, viewer_guest_id: jiro_id)
    expect(result).to eq(true)
  end
end

describe "#can_view_profile_details? with cast-to-guest block" do
  context "public cast (Yuna) blocks guest" do
    it "returns false when cast blocked the guest" do
      allow(social_adapter).to receive(:cast_blocked_guest?)
        .with(cast_user_id: "yuna-id", guest_user_id: jiro_id)
        .and_return(true)

      result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: jiro_id)
      expect(result).to eq(false)
    end
  end

  context "private cast (Mio) blocks guest" do
    it "returns false when cast blocked the guest" do
      allow(social_adapter).to receive(:cast_blocked_guest?)
        .with(cast_user_id: "mio-id", guest_user_id: taro_id)
        .and_return(true)

      result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: taro_id)
      expect(result).to eq(false)
    end
  end
end
```

**Step 2: テスト実行（失敗確認）**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/policies/profile_access_policy_spec.rb
```

Expected: FAIL — `cast_blocked_guest?` が ProfileAccessPolicy 内で呼ばれていないため

**Step 3: Commit**

```bash
git add -A && git commit -m "test: add failing tests for cast-to-guest block in profile access policy"
```

---

## Task 7: Cast → Guest ブロック強化 — ProfileAccessPolicy 実装

Cast → Guest ブロック時に詳細プロフィールを非表示にする。

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/policies/profile_access_policy.rb`

**Step 1: `can_view_profile_details?` に Cast→Guest ブロックチェック追加**

```ruby
def can_view_profile_details?(cast:, viewer_guest_id: nil)
  # Cast blocked this guest → deny details
  if viewer_guest_id && social_adapter.cast_blocked_guest?(cast_user_id: cast.user_id, guest_user_id: viewer_guest_id)
    return false
  end

  # Public cast = everyone can view details
  return true if cast.visibility == "public"

  # Private cast = only approved followers can view details
  return false if viewer_guest_id.nil?

  social_adapter.approved_follower?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
end
```

`can_view_profile?` は変更しない（基本プロフィールは常に見える）。

**Step 2: テスト実行（成功確認）**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/policies/profile_access_policy_spec.rb
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: deny profile details when cast blocks guest"
```

---

## Task 8: Cast → Guest ブロック強化 — PostAccessPolicy & Feed

Cast → Guest ブロック時に投稿とフィードからも除外する。

**Files:**
- Modify: `services/monolith/workspace/slices/post/policies/access_policy.rb`
- Modify: `services/monolith/workspace/slices/post/adapters/relationship_adapter.rb`
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`

**Step 1: PostAccessPolicy に Cast→Guest ブロックチェック追加**

`services/monolith/workspace/slices/post/policies/access_policy.rb` を修正:

```ruby
def can_view_post?(post:, cast:, viewer_guest_id: nil)
  # Cast blocked this guest
  return false if cast_blocked_guest?(cast_user_id: cast.user_id, guest_user_id: viewer_guest_id)

  # Public cast + public post = visible to all
  return true if cast.visibility == "public" && post.visibility == "public"

  # Otherwise, only approved followers can view
  return false if viewer_guest_id.nil?

  approved_follower?(cast_user_id: cast.user_id, guest_user_id: viewer_guest_id)
end

def filter_viewable_posts(posts:, casts_map:, viewer_guest_id: nil)
  return [] if posts.empty?

  cast_user_ids = posts.map(&:cast_user_id).uniq

  # Get cast-blocked-guest IDs for filtering
  blocked_by_cast_ids = if viewer_guest_id
    @relationship_adapter.blocked_by_cast_ids(guest_user_id: viewer_guest_id)
  else
    []
  end

  # Get follow status for all casts
  follow_statuses = if viewer_guest_id
    @relationship_adapter.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: viewer_guest_id)
  else
    {}
  end

  posts.select do |post|
    cast = casts_map[post.cast_user_id]
    next false if cast.nil?
    next false if blocked_by_cast_ids.include?(cast.user_id)

    # Public cast + public post = visible
    if cast.visibility == "public" && post.visibility == "public"
      true
    else
      # Approved follower only
      follow_statuses[cast.user_id] == "approved"
    end
  end
end
```

private メソッド追加:
```ruby
def cast_blocked_guest?(cast_user_id:, guest_user_id:)
  return false if guest_user_id.nil?

  @relationship_adapter.cast_blocked_guest?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
end
```

**Step 2: Post RelationshipAdapter にメソッド追加**

`services/monolith/workspace/slices/post/adapters/relationship_adapter.rb` に追加:

```ruby
# Check if cast has blocked this guest
def cast_blocked_guest?(cast_user_id:, guest_user_id:)
  block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
end

# Get cast IDs that have blocked this guest
def blocked_by_cast_ids(guest_user_id:)
  # Reverse lookup: find casts where blocker_id = cast, blocked_id = guest
  block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
end
```

注意: `block_repo` に `blocker_ids_for_blocked` メソッドが必要。存在しない場合は `block_repository.rb` に追加:
```ruby
def blocker_ids_for_blocked(blocked_id:, blocker_type:)
  blocks.dataset
    .where(blocked_id: blocked_id, blocker_type: blocker_type)
    .select_map(:blocker_id)
end
```

**Step 3: Feed UseCase に Cast→Guest ブロック除外追加**

`services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb` の `call` メソッドを修正:

```ruby
def call(guest_id:, filter:, limit: DEFAULT_LIMIT, cursor: nil, blocker_id: nil)
  limit = normalize_limit(limit)
  decoded_cursor = decode_cursor(cursor)

  # Get cast IDs that have blocked this guest
  blocked_by_cast_ids = @relationship_adapter.blocker_cast_ids_for_guest(guest_user_id: guest_id)

  posts, authors = case filter
  when "all"
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids)
  when "following"
    list_following_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids)
  else
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids)
  end

  pagination = build_pagination_result(items: posts, limit: limit) do |last|
    encode_cursor(created_at: last.created_at.iso8601, id: last.id)
  end

  { posts: pagination[:items], next_cursor: pagination[:next_cursor], has_more: pagination[:has_more], authors: authors }
end
```

private メソッドは `exclude_cast_ids` パラメータを引き続き受け取る（Task 4 で削除した場合は元に戻す形）。

Feed Adapter に追加:
```ruby
def blocker_cast_ids_for_guest(guest_user_id:)
  block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
end
```

**Step 4: テスト実行**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/post/ spec/slices/feed/ spec/slices/portfolio/
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: deny post access and feed when cast blocks guest"
```

---

## Task 9: Guest → Cast ブロック削除 — Proto/Backend 整理

block_service.proto と block_handler.rb から Guest が blocker として使用される不要な部分を整理する。

**Files:**
- Modify: `proto/relationship/v1/block_service.proto`
- Modify: `services/monolith/workspace/slices/relationship/grpc/block_handler.rb`
- Modify: `services/monolith/workspace/slices/relationship/repositories/block_repository.rb`

**Step 1: Proto の整理**

`proto/relationship/v1/block_service.proto` を確認し、以下の観点で整理:
- `BlockUserRequest` の `blocker_type` フィールドはそのまま残す（Cast 用に使う）
- RPC 自体は Cast 用としてそのまま残す
- コメントを更新してCast専用であることを明記

**Step 2: block_repository.rb から `blocked_cast_ids` メソッド削除**

Guest が Cast をブロックするケースがなくなるため、`blocked_cast_ids` (L58-62) を削除。

`blocked_guest_ids` (L64-68) は Cast→Guest で使うので残す。

**Step 3: block_handler.rb の整理**

`list_blocked_by` RPC は Cast → Guest ブロックの逆引き（ゲスト詳細画面でどのキャストがこのゲストをブロックしているか表示）に使われているので残す。

コメントを更新して、Guest 側のブロック操作が不要であることを明記。

**Step 4: Proto 再生成**

```bash
cd services/monolith/workspace && ./bin/codegen
```

**Step 5: テスト実行**

```bash
cd services/monolith/workspace && bundle exec rspec
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: clean up block proto and repository after guest-block removal"
```

---

## Task 10: シードデータ更新

テストシナリオのシードデータを新しいアクセスポリシーに合わせて更新する。

**Files:**
- Modify: `services/monolith/workspace/config/db/seeds.rb`
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/relationship_generator.rb`

**Step 1: seeds.rb から Guest→Cast ブロックとお気に入りを削除**

`services/monolith/workspace/config/db/seeds.rb` を修正:
- 太郎の Rin ブロック（Guest→Cast ブロック）のシードデータを削除
- お気に入りのシードデータ（太郎→Yuna/Mio、四郎→Rin）を全て削除
- Cast→Guest ブロックのテストデータを追加（例: Rin が 太郎 をブロック）

**Step 2: bulk generator からお気に入りと Guest ブロックを削除**

`services/monolith/workspace/config/db/seeds/bulk/generators/relationship_generator.rb` を修正:
- お気に入り生成ロジック（`FAVORITE_FROM_FOLLOW_RATE` 等）を削除
- Guest → Cast ブロック生成（80%のブロック）を削除し、Cast → Guest ブロック（100%に変更）のみにする

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor: update seed data for new access policy (remove guest-block and favorites)"
```

---

## Task 11: DB マイグレーション作成

お気に入りテーブルを drop するマイグレーションを作成する。

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/YYYYMMDDHHMMSS_drop_cast_favorites.rb`

**Step 1: マイグレーションファイル作成**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  change do
    drop_table(:social__cast_favorites)
  end
end
```

ファイル名のタイムスタンプは作成時の日時。

**Step 2: マイグレーション実行確認**

```bash
cd services/monolith/workspace && bundle exec hanami db migrate
```

Expected: Migration succeeds

**Step 3: Commit**

```bash
git add -A && git commit -m "migrate: drop social__cast_favorites table"
```

---

## Task 12: ACCESS_POLICY.md 更新

ドキュメントを新しいアクセスポリシーに合わせて全面更新する。

**Files:**
- Modify: `docs/ACCESS_POLICY.md`

**Step 1: ACCESS_POLICY.md を更新**

主な変更:
- Terminology: Block を「Cast → Guest のみ」に変更（双方向 → 単方向）
- Block Policy: Guest → Cast セクションを削除、Cast → Guest の効果を拡充
- Access Rules: Guest→Cast ブロックの判定を全て削除し、Cast→Guest ブロックの判定を追加
- Access Matrix: Blocked (G→C) 列を削除し、Blocked (C→G) 列を追加
- Feed Filtering: FAVORITES フィルタを削除、Cast→Guest ブロック除外を追加
- Action Permissions: Favorite 行を削除、Cast→Guest ブロック時の Deny を追加
- Test Scenarios: 太郎のブロックと favorites を削除、Cast→Guest ブロックシナリオを追加
- Implementation: 削除されたファイルの参照を削除、新しいメソッドの参照を追加

**Step 2: Commit**

```bash
git add docs/ACCESS_POLICY.md && git commit -m "docs(access-policy): update for cast-to-guest block and remove favorites"
```

---

## Task 13: 最終確認

全テスト実行とビルド確認を行う。

**Step 1: Backend テスト**

```bash
cd services/monolith/workspace && bundle exec rspec
```

Expected: All tests pass

**Step 2: Frontend ビルド**

```bash
cd web/nyx/workspace && pnpm build
```

Expected: Build succeeds

**Step 3: Proto 整合性確認**

```bash
cd services/monolith/workspace && ./bin/codegen
cd web/nyx/workspace && pnpm proto:gen
```

Expected: No changes (already up to date)
