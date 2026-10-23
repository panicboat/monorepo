# Social S3: cross-slice follow-gate enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S2b で動いた social slice の上に、**`ViewerCanSeePost` / `FilterVisiblePosts` の 2 つの cross-slice use_case** を追加し、`Post::UseCases::Posts::ListPostsByIds` と `Post::Grpc::PostHandler#get_post` に enforce する。これで Feed は ListPostsByIds 経由で自動的に follow-gate が効くようになる。

**Architecture:** social slice に follow-gate を集約。post slice 側は薄い差分のみ (ListPostsByIds の末尾フィルタ + GetPost handler の 1 行 raise)。is_private + bidirectional block + own-post-always-visible の 3 条件で構成。

**Tech Stack:** Ruby / Hanami 2 / cross-slice `Social::Slice[...]` / `Profile::Slice[...]`。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (Cross-slice contracts 節 + S3 節)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s3-followgate`、branch `feat/social-s3-followgate` (origin/main = `69c9b7ed`、S2b #678 マージ後)。**push しない**。
- 触らない: 旧 `slices/relationship/*`、frontend、proto、`slices/post/use_cases/posts/get_post.rb` (legacy dead code、cleanup フェーズで drop)。

### 既存パターン (踏襲)

- cross-slice 呼び出し: `Social::Slice["use_cases.filter_visible_posts"].call(...)` — Profile slice を呼ぶ既存 pattern (`Profile::Slice["use_cases.get_profile"]`) と同じ
- post: `post.author_id`、Sequel `Post::Relations::Posts` row
- profile fetch: `Profile::Slice["use_cases.get_profile"].call(account_id: ...)` → `Profile::V1::Profile` 返却 (`.is_private` 持つ)
- `FollowRepository#status_batch(follower_id:, followee_ids:)` → `{target_id_string => status_string}` (S2a 実装済)
- `BlockRepository#bidirectionally_blocked_ids(account_id:)` → `[id_strings]` / `#blocked?(blocker_id:, blocked_id:)` (S2a 実装済)

### Follow-gate 判定ロジック (spec から)

post.author を viewer が見える条件 (`true` = 見える):

1. viewer が `nil` (匿名) and author.is_private == true → **false**
2. viewer == author (自分の post) → **true**
3. viewer ↔ author の bidirectional block 有り → **false**
4. author.is_private == false → **true**
5. author.is_private == true and viewer ∈ author の approved followers → **true**
6. それ以外 → **false**

## File Structure

- Create: `slices/social/use_cases/viewer_can_see_post.rb` (単件チェック)
- Create: `slices/social/use_cases/filter_visible_posts.rb` (一括フィルタ、batch query 利用)
- Modify: `slices/post/use_cases/posts/list_posts_by_ids.rb` (末尾で filter_visible_posts 適用)
- Modify: `slices/post/grpc/post_handler.rb#get_post` (post-level 後に viewer_can_see_post check)

---

## Task 1: `Social::UseCases::ViewerCanSeePost` (単件チェック)

**Files:** Create `slices/social/use_cases/viewer_can_see_post.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    # Single-post follow-gate check. Used by Post::Grpc::PostHandler#get_post.
    # For batch checks (ListPostsByIds), prefer FilterVisiblePosts to avoid
    # N+1 profile/follow/block queries.
    class ViewerCanSeePost
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      # @param viewer_account_id [String, nil] nil = anonymous
      # @param post [Object] must respond to :author_id
      # @return [Boolean]
      def call(viewer_account_id:, post:)
        author_id = post.author_id
        return true if viewer_account_id && author_id == viewer_account_id

        if viewer_account_id
          return false if block_repo.blocked?(blocker_id: viewer_account_id, blocked_id: author_id) ||
                          block_repo.blocked?(blocker_id: author_id, blocked_id: viewer_account_id)
        end

        profile = get_profile.call(account_id: author_id)
        is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
        return true unless is_private

        return false unless viewer_account_id

        row = follow_repo.find(follower_id: viewer_account_id, followee_id: author_id)
        row && row.status == "approved"
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
cd services/monolith/workspace && ruby -c slices/social/use_cases/viewer_can_see_post.rb
```

---

## Task 2: `Social::UseCases::FilterVisiblePosts` (一括フィルタ、batch query)

**Files:** Create `slices/social/use_cases/filter_visible_posts.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "set"

module Social
  module UseCases
    # Batch follow-gate filter. Used by Post::UseCases::Posts::ListPostsByIds at
    # hydration tail. Order-preserving. Batches profile/follow/block lookups by
    # author_id so a feed of N posts costs O(authors) profile fetches + 2 SQL
    # queries (status_batch + bidirectionally_blocked_ids) instead of O(N).
    class FilterVisiblePosts
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      # @param viewer_account_id [String, nil] nil = anonymous
      # @param posts [Array<#author_id>]
      # @return [Array] order-preserving subset of posts
      def call(viewer_account_id:, posts:)
        return [] if posts.nil? || posts.empty?

        author_ids = posts.map(&:author_id).compact.uniq

        is_private_by_author = author_ids.each_with_object({}) do |aid, h|
          profile = get_profile.call(account_id: aid)
          h[aid] = profile.respond_to?(:is_private) ? !!profile.is_private : false
        end

        if viewer_account_id
          blocked_set = block_repo.bidirectionally_blocked_ids(account_id: viewer_account_id).map(&:to_s).to_set
          follow_statuses = follow_repo.status_batch(follower_id: viewer_account_id, followee_ids: author_ids)
        else
          blocked_set = Set.new
          follow_statuses = {}
        end

        posts.select do |post|
          author_id = post.author_id
          next true if viewer_account_id && author_id == viewer_account_id
          next false if blocked_set.include?(author_id.to_s)
          next true unless is_private_by_author[author_id]
          next false unless viewer_account_id

          follow_statuses[author_id.to_s] == "approved"
        end
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/social/use_cases/filter_visible_posts.rb
```

---

## Task 3: `Post::UseCases::Posts::ListPostsByIds` を変更 (末尾 filter)

**Files:** Modify `slices/post/use_cases/posts/list_posts_by_ids.rb`。

post を fetch した直後 (hydrate 前) に `Social::Slice["use_cases.filter_visible_posts"]` で絞り込み、その後の hydration / proto 変換は filter 済 posts に対してのみ実行する。

- [ ] **Step 1: `posts = post_repo.find_by_ids(...)` の直後に filter を挟む**

旧:

```ruby
posts = post_repo.find_by_ids(ids: post_ids)
return {} if posts.empty?

ids = posts.map(&:id)
```

新:

```ruby
posts = post_repo.find_by_ids(ids: post_ids)
return {} if posts.empty?

posts = visibility_filter.call(viewer_account_id: viewer_account_id, posts: posts)
return {} if posts.empty?

ids = posts.map(&:id)
```

- [ ] **Step 2: private helper `visibility_filter` を `media_adapter` の隣に追加**

```ruby
def visibility_filter
  @visibility_filter ||= Social::Slice["use_cases.filter_visible_posts"]
end
```

- [ ] **Step 3: Syntax check**

```bash
ruby -c slices/post/use_cases/posts/list_posts_by_ids.rb
```

---

## Task 4: `Post::Grpc::PostHandler#get_post` を変更 (single check)

**Files:** Modify `slices/post/grpc/post_handler.rb`。

Line 45-55 の `get_post` メソッドで、post-level visibility check の直後に follow-gate check を入れる。`current_user_id` は base handler の `Grpc::Authenticatable` 提供 (未認証なら `nil`)。

- [ ] **Step 1: 既存 post-level visibility check の直後に追記**

旧:

```ruby
def get_post
  post = post_repo.find_by_id(request.message.id)
  raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

  # post-level visibility only (account-level follow-gate is social slice's concern)
  if post.visibility == "private" && post.author_id != current_user_id
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
  end

  ::Post::V1::GetPostResponse.new(post: present_post(post))
end
```

新:

```ruby
def get_post
  post = post_repo.find_by_id(request.message.id)
  raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

  if post.visibility == "private" && post.author_id != current_user_id
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
  end

  unless viewer_can_see_post.call(viewer_account_id: current_user_id, post: post)
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
  end

  ::Post::V1::GetPostResponse.new(post: present_post(post))
end
```

- [ ] **Step 2: private helper を `present_post` の下に追加**

```ruby
def viewer_can_see_post
  @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
end
```

- [ ] **Step 3: 旧 comment の cleanup**

`# post-level visibility only (account-level follow-gate is social slice's concern)` は実装が入ったので削除 (上記 diff には新版から省いてある)。

- [ ] **Step 4: Syntax check**

```bash
ruby -c slices/post/grpc/post_handler.rb
```

---

## Task 5: rspec baseline + container smoke + commit

- [ ] **Step 1: rspec baseline 維持確認**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: 全 baseline 維持 (post 62/0、feed 0、relationship 31/0、profile 148/14)。
**注意**: post の spec が `viewer_account_id` を渡さない例で fail する可能性あり (anonymous viewer 経路は通る) — fail 時は spec を grep して、`Social::Slice["use_cases.filter_visible_posts"]` が stub されているか確認、もし spec 側でモックが必要なら spec に追記 (post slice spec の責務外なら spec 側を `before { allow(Social::Slice).to receive(:[]).and_call_original }` などで pass させる)。

- [ ] **Step 2: container smoke (新 use_case 2 個 resolve + anonymous filter empty 動作)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  vc = Social::Slice["use_cases.viewer_can_see_post"]
  fv = Social::Slice["use_cases.filter_visible_posts"]
  puts "ViewerCanSeePost: #{vc.class}"
  puts "FilterVisiblePosts: #{fv.class}"

  # anonymous + empty posts
  result = fv.call(viewer_account_id: nil, posts: [])
  puts "empty input: #{result.inspect}"

  # Verify cross-slice wiring (ListPostsByIds picks up filter via Social::Slice)
  lpbi = Post::Slice["use_cases.posts.list_posts_by_ids"]
  puts "ListPostsByIds: #{lpbi.class}"
' 2>&1 | /usr/bin/tail -15
```

期待: `ViewerCanSeePost: Social::UseCases::ViewerCanSeePost` / `FilterVisiblePosts: Social::UseCases::FilterVisiblePosts` / `empty input: []` / `ListPostsByIds: Post::UseCases::Posts::ListPostsByIds`。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 2 new file + 2 modified file + plan = **5 files**、新 use_case 2 個 (~80 行)、ListPostsByIds + PostHandler それぞれ ~5 行追加。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s3-followgate
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-15-social-s3-followgate.md
/usr/bin/git commit -s -m "feat(social): cross-slice follow-gate (ViewerCanSeePost + FilterVisiblePosts)"
```

push しない。

---

## Deferred

- **`Feed::UseCases::ListFeed` の明示 filter**: spec の "可能なら明示 filter も追加" は今回不要。Feed handler は post_ids 取得後に `ListPostsByIds.call(post_ids:, viewer_account_id:)` で hydrate するので、本 PR の ListPostsByIds 変更で自動的に follow-gate が効く (block + is_private 両方)。
- **`Feed::Adapters::BlockAdapter` (relationship.blocks 読取) の Social schema 切替**: cleanup フェーズで実施。本 PR 時点では Feed 内の SQL exclude は relationship.blocks ベース (実 block data はそこにある)、新 social.blocks は空。ListPostsByIds 末尾の filter は social.blocks ベースで動くが、データが空なので block-check は no-op、is_private check が実際の新挙動。
- **post slice spec の新規拡充**: stub posts + is_private profile + viewer/author の組合せで follow-gate を実 SQL 通して見る integration spec は S3 範囲外 (baseline 維持のみ、新規 spec は別 PR で)。
- **`get_post.rb` (legacy dead use_case の drop)**: `slices/post/use_cases/posts/get_post.rb` は `cast_user_id` を参照する dead code (handler から呼ばれていない)。cleanup フェーズで drop。本 PR では無改変。

## Self-Review

- **Spec coverage (S3 範囲)**: ViewerCanSeePost ✓ / FilterVisiblePosts ✓ / ListPostsByIds 統合 ✓ / GetPost handler 統合 ✓ / Feed は ListPostsByIds 経由で自動適用 (spec 明示 OK)。
- **判定ロジック整合**:
  - own post: 両 use_case とも `viewer_account_id && author_id == viewer_account_id` で true
  - block: viewer→author / author→viewer 双方向、anonymous は skip
  - is_private==true: anonymous → false、viewer は approved follower のみ true
  - is_private==false: 常に true (block 通過後)
- **Placeholder 無し**: 全 code 提示、TBD 無し。
- **型 / 命名整合**:
  - `viewer_account_id`: kwarg 統一 (`current_user_id` を handler から渡す)
  - `post.author_id`: Sequel row が確実に持つ
  - `follow_repo.status_batch` は string key 返却なので `author_id.to_s` で lookup
  - `block_repo.bidirectionally_blocked_ids` 戻り値も string 化して Set 比較
- **Cross-slice 呼出**: `Social::Slice["use_cases.viewer_can_see_post"]` / `Social::Slice["use_cases.filter_visible_posts"]` 両方が container に登録されることを Step 2 で smoke 確認。
- **Baseline 維持優先**: 既存 spec が viewer_account_id=nil 経路を含む場合、`filter_visible_posts.call(viewer_account_id: nil, posts: [...])` は profile fetch (is_private 取得) → public author 全 pass / private author 全 drop の挙動。spec が `is_private: false` の profile を fixture 化していれば pass、失敗時は spec 側で stub。
