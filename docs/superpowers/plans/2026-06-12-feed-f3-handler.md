# Feed F3: symmetric ListFeed handler + use_case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** feed スライスに **symmetric `Feed::Grpc::Handler#list_feed`** + `Feed::UseCases::ListFeed` を新規実装。F1 (proto) + F2 (posts cross-slice hydration) + F3a (profile prefecture lookup) を消費し、3 フィルタ (ALL / AREA / FOLLOWING) で `post.v1.Post[]` を返す。block / follow adapter は symmetric メソッドを additive 追加。旧 `ListGuestFeed` / `ListCastFeed` handler / use_cases は無改変。

**Architecture:** **Additive / build-green**。Feed slice は DB を持たず、post slice (F2 `ListPostsByIds`) / profile slice (F3a `ListAccountIdsByPrefecture`) / relationship slice (block / follow repo) を cross-slice で orchestrate。新 use_case が ordered post_ids を返し、handler が F2 hydration で `Post::V1::Post[]` 化 → response 組み立て。post_repo に symmetric `list_public_post_ids` (id-only クエリ) 追加、relationship repos に symmetric メソッド (`blocker_ids_of`、`following_account_ids`) 追加、feed adapters に symmetric メソッド (`bidirectionally_blocked_account_ids`、`following_account_ids`) を additive 追加。

**Tech Stack:** Ruby / Hanami 2 / gruf (gRPC) / ROM / Sequel。proto stub = F1 で生成済 `Feed::V1::ListFeed*` + `FEED_FILTER_AREA`、cross-slice = `Post::Slice["use_cases.posts.list_posts_by_ids"]` (F2) + `Profile::Slice["use_cases.list_account_ids_by_prefecture"]` (F3a)。

**Spec:** `docs/superpowers/specs/2026-06-12-feed-slice-design.md` (§Monolith feed slice / §Decomposition の F3)。前提: F1 (#660) + F2 (#661) + F3a (#662) main マージ済、main HEAD = `eae20610`。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3-handler`。app root: `services/monolith/workspace`。branch `feat/feed-f3-handler` (origin/main = `eae20610` base、tracking 済)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith)、`post.posts.author_id` 列 (Q2 で追加済) を使う。
- **build-green / additive**: 以下は無改変:
  - 旧 `Feed::Grpc::Handler#list_guest_feed` / `#list_cast_feed` (本 PR では新 method を追加するだけ)
  - 旧 `Feed::UseCases::ListGuestFeed` / `ListCastFeed`
  - 旧 `Feed::Adapters::{cast,guest,post,media}_adapter`
  - `Feed::Adapters::BlockAdapter` / `FollowAdapter` (新 method を **additive 追加**、既存 method 不変)
  - post_repo の既存 `list_all_visible` / `list_all_by_cast_user_ids` 等 (cast_user_id ベース)、`list_posts` (symmetric author_id ベース、Q3 で追加済) も不変
  - relationship 既存 `BlockRepository` / `FollowRepository` methods
  - proto / frontend / 他 slice

### 既存 (確定、再利用する)

- **`Post::Slice["use_cases.posts.list_posts_by_ids"]`** (F2、#661): `call(post_ids:, viewer_account_id:)` → `Hash<post_id_string => Post::V1::Post>`
- **`Profile::Slice["use_cases.list_account_ids_by_prefecture"]`** (F3a、#662): `call(prefecture:)` → `Array<String>` (account_id 配列)
- **post_repo** (`slices/post/repositories/post_repository.rb`): symmetric `list_posts(limit:, cursor:, author_id:)` あり (Q3で追加済、`scope = posts.where(author_id: author_id)` 一個に絞った場合のみ、本 F3 で必要なのは id 配列を返す version で別途追加)
- **relationship BlockRepository** (`slices/relationship/repositories/block_repository.rb`):
  - 既存: `blocked_user_ids(blocker_id:)` (type 無視で blocker が blocked にした全 ID)、`blocker_ids_for_blocked(blocked_id:, blocker_type:)` (type 必須)
  - 新規必要: `blocker_ids_of(blocked_id:)` (type 無視で blocked にされた全 blocker ID)
- **relationship FollowRepository** (`slices/relationship/repositories/follow_repository.rb`):
  - 既存: `follow(cast_user_id:, guest_user_id:)` 等 cast/guest split
  - **`following_cast_user_ids(guest_user_id:)`** が既存 (feed の follow_adapter で使用済)
  - 新規必要: `following_account_ids(account_id:)` alias (= `follows.where(guest_user_id: account_id).select_map(:cast_user_id)`)。symmetric リネーム
- **`Feed::Grpc::Handler` base** (`slices/feed/grpc/handler.rb`): `Gruf::Controllers::Base` + `Grpc::Authenticatable` で `current_user_id` (= account_id) 取得可、`find_my_guest!` 等は旧 method で本 F3 不使用
- **`Concerns::CursorPagination`** (`lib/concerns/cursor_pagination.rb`): `DEFAULT_LIMIT` / `normalize_limit` / `decode_cursor` / `encode_cursor` / `build_pagination_result`

## File Structure

- Modify: `services/monolith/workspace/slices/post/repositories/post_repository.rb` — `list_public_post_ids(limit:, cursor:, author_ids: nil, excluded_author_ids: [])` を additive 追加
- Modify: `services/monolith/workspace/slices/relationship/repositories/block_repository.rb` — `blocker_ids_of(blocked_id:)` を additive 追加
- Modify: `services/monolith/workspace/slices/relationship/repositories/follow_repository.rb` — `following_account_ids(account_id:)` を additive 追加
- Modify: `services/monolith/workspace/slices/feed/adapters/block_adapter.rb` — `bidirectionally_blocked_account_ids(account_id:)` を additive 追加
- Modify: `services/monolith/workspace/slices/feed/adapters/follow_adapter.rb` — `following_account_ids(account_id:)` を additive 追加
- Create: `services/monolith/workspace/slices/feed/use_cases/list_feed.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb` — `rpc :ListFeed` + `def list_feed` 追加 (旧 RPC は無改変)

---

## Task 1: post_repo に symmetric `list_public_post_ids` を追加

**Files:** Modify `services/monolith/workspace/slices/post/repositories/post_repository.rb`。

- [ ] **Step 1: 既存 `list_posts` (symmetric, Q3) の場所を確認 + 直下に追加**

Run: `cd services/monolith/workspace && /usr/bin/grep -n "def list_posts\b\|def list_all_visible" slices/post/repositories/post_repository.rb`

`list_posts` 直下 (推定 L130 周辺) に追加:

```ruby
      # Symmetric public post id query for feed slice (cursor-paginated).
      # Returns an array of post ids (String) ordered by created_at DESC, id DESC.
      # Filters: visibility='public', author_ids whitelist (if provided), excluded_author_ids blocklist.
      # Returns limit + 1 ids so caller can detect has_more.
      def list_public_post_ids(limit: 20, cursor: nil, author_ids: nil, excluded_author_ids: [])
        scope = posts.where(visibility: "public")
        scope = scope.where(author_id: author_ids) if author_ids && !author_ids.empty?
        scope = scope.exclude(author_id: excluded_author_ids) if excluded_author_ids && !excluded_author_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).select_map(:id).map(&:to_s)
      end
```

**注意**:
- `select_map(:id)` で id 列だけ pluck (post body / media は不要、F2 hydration で取得する)
- `.map(&:to_s)` で UUID オブジェクト → String 配列 (F2 のキー型と整合)
- `author_ids: nil` で FOLLOWING / AREA が空配列を渡したケース → 全件除外 (= `[]` 返り) になるよう注意。**`author_ids: []` を `nil` と区別して空配列なら 0 件返す** semantics:

実装を修正 (明示的 empty チェック):

```ruby
      def list_public_post_ids(limit: 20, cursor: nil, author_ids: nil, excluded_author_ids: [])
        # author_ids: nil = no whitelist (all authors), [] = whitelist of nothing (return empty)
        return [] if !author_ids.nil? && author_ids.empty?

        scope = posts.where(visibility: "public")
        scope = scope.where(author_id: author_ids) if author_ids
        scope = scope.exclude(author_id: excluded_author_ids) if excluded_author_ids && !excluded_author_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).select_map(:id).map(&:to_s)
      end
```

- [ ] **Step 2: 構文チェック**

```bash
cd services/monolith/workspace
ruby -c slices/post/repositories/post_repository.rb
```

---

## Task 2: relationship repos に symmetric methods 追加

**Files:** Modify `services/monolith/workspace/slices/relationship/repositories/{block,follow}_repository.rb`。

- [ ] **Step 1: `BlockRepository#blocker_ids_of` 追加**

既存 `blocker_ids_for_blocked` の直下に追加:

```ruby
      # Symmetric (type-agnostic) version of blocker_ids_for_blocked.
      # Returns account ids of all accounts that have blocked this account_id,
      # regardless of legacy blocker_type. Used by feed slice for bidirectional
      # block evaluation.
      def blocker_ids_of(blocked_id:)
        blocks.dataset
          .where(blocked_id: blocked_id)
          .select_map(:blocker_id)
      end
```

- [ ] **Step 2: `FollowRepository#following_account_ids` 追加**

既存 `following_cast_user_ids` の直下 (存在しない場合は class 末尾) に追加:

```ruby
      # Symmetric alias of following_cast_user_ids. In the symmetric model,
      # follows.guest_user_id is the follower's account_id and cast_user_id is
      # the followee's account_id (column names are legacy; semantics are account ↔ account).
      def following_account_ids(account_id:)
        follows.dataset
          .where(guest_user_id: account_id, status: "approved")
          .select_map(:cast_user_id)
      end
```

**事前確認**: `/usr/bin/grep -n "def following_cast_user_ids" services/monolith/workspace/slices/relationship/repositories/follow_repository.rb` で既存 method の query 形式 (status filter の有無等) を確認、上記 `status: "approved"` を実態に合わせる。**既存と挙動同等**にすること (リネームだけが目的)。

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/relationship/repositories/block_repository.rb
ruby -c slices/relationship/repositories/follow_repository.rb
```

---

## Task 3: feed adapters に symmetric methods 追加

**Files:** Modify `services/monolith/workspace/slices/feed/adapters/{block,follow}_adapter.rb`。

- [ ] **Step 1: `BlockAdapter#bidirectionally_blocked_account_ids` 追加**

既存 method の下 (private 宣言の前) に追加:

```ruby
      # Symmetric: returns union of accounts that this account blocked AND accounts that blocked this account.
      # Used by feed slice to hide posts in both directions.
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        outgoing = block_repo.blocked_user_ids(blocker_id: account_id)
        incoming = block_repo.blocker_ids_of(blocked_id: account_id)
        (outgoing + incoming).uniq
      end
```

- [ ] **Step 2: `FollowAdapter#following_account_ids` 追加**

既存 method の下 (private 宣言の前) に追加:

```ruby
      # Symmetric: returns account ids followed by this account.
      def following_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        follow_repo.following_account_ids(account_id: account_id)
      end
```

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/feed/adapters/block_adapter.rb
ruby -c slices/feed/adapters/follow_adapter.rb
```

---

## Task 4: `Feed::UseCases::ListFeed` use_case 作成

**Files:** Create `services/monolith/workspace/slices/feed/use_cases/list_feed.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Feed
  module UseCases
    # Symmetric account-authored feed query. Returns ordered post_ids + pagination
    # metadata. Hydration (post → Post::V1::Post) is the handler's responsibility
    # via the posts cross-slice contract (Post::Slice["use_cases.posts.list_posts_by_ids"]).
    class ListFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50

      FILTER_ALL = "all"
      FILTER_AREA = "area"
      FILTER_FOLLOWING = "following"

      def initialize
        @block_adapter = Feed::Adapters::BlockAdapter.new
        @follow_adapter = Feed::Adapters::FollowAdapter.new
      end

      # @param filter [String] "all" | "area" | "following"
      # @param viewer_account_id [String] required (handler authenticates first)
      # @param prefecture [String, nil] required when filter == "area"
      # @param limit [Integer]
      # @param cursor [String, nil] base64 cursor
      # @return [Hash] { post_ids: Array<String>, next_cursor: String|nil, has_more: Boolean }
      def call(filter:, viewer_account_id:, prefecture: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)
        excluded = @block_adapter.bidirectionally_blocked_account_ids(account_id: viewer_account_id)

        author_ids = case filter
        when FILTER_ALL
          nil  # no whitelist = all public posts
        when FILTER_AREA
          list_account_ids_by_prefecture_uc.call(prefecture: prefecture)
        when FILTER_FOLLOWING
          @follow_adapter.following_account_ids(account_id: viewer_account_id)
        else
          nil
        end

        # AREA / FOLLOWING with empty author_ids = empty result (per repo semantics)
        post_ids = post_repo.list_public_post_ids(
          limit: limit,
          cursor: decoded_cursor,
          author_ids: author_ids,
          excluded_author_ids: excluded
        )

        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          # Fetch the last post's created_at to encode cursor (we only have ids).
          # post_repo provides find_by_id (Q1) which returns the row with created_at.
          last_post = post_repo.find_by_id(truncated.last)
          last_post ? encode_cursor(created_at: last_post.created_at.iso8601, id: last_post.id) : nil
        end

        { post_ids: truncated, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_account_ids_by_prefecture_uc
        @list_account_ids_by_prefecture_uc ||= Profile::Slice["use_cases.list_account_ids_by_prefecture"]
      end
    end
  end
end
```

**実装上の注意**:
- `find_by_id` を cursor 用に呼ぶのは N+1 1 回追加だが許容 (last post 1 件のみ)。最適化したいなら `list_public_post_ids` を `[id, created_at]` tuple 返しにする手があるが、本 PR は単純さ優先
- `case filter` で正規化済 String を受ける (handler 側で proto enum → String 変換)
- AREA で prefecture が空 / nil の場合 → `ListAccountIdsByPrefecture.call(prefecture: nil/'')` で `[]` 返り → `author_ids: []` で `list_public_post_ids` が `[]` 返り (空結果)。**handler で AREA + prefecture 空は INVALID_ARGUMENT** にすべきだが、本 use_case はガードしない (handler 責務)
- `Post::Slice["repositories.post_repository"]` で cross-slice 直 access (既存 `feed/adapters/post_adapter.rb` と同じ pattern)

- [ ] **Step 2: 構文チェック**

```bash
ruby -c slices/feed/use_cases/list_feed.rb
```

---

## Task 5: `Feed::Grpc::Handler#list_feed` 追加

**Files:** Modify `services/monolith/workspace/slices/feed/grpc/handler.rb`。

- [ ] **Step 1: require_relative 追加**

ファイル冒頭の require_relative 群末尾 (`require_relative "../use_cases/list_cast_feed"` の下) に追加:

```ruby
require_relative "../use_cases/list_feed"
```

- [ ] **Step 2: `rpc :ListFeed` 宣言追加**

既存 `rpc :ListCastFeed, ...` の直下に追加:

```ruby
      rpc :ListFeed, ::Feed::V1::ListFeedRequest, ::Feed::V1::ListFeedResponse
```

- [ ] **Step 3: `def list_feed` メソッド追加**

既存 `def list_cast_feed` の直下、`private` 宣言の前 (or 既存 private accessor 群の前) に追加:

```ruby
      # Symmetric (account-authored) feed handler. Cross-slice:
      # - Feed::UseCases::ListFeed builds ordered post_ids + pagination metadata
      # - Post::Slice["use_cases.posts.list_posts_by_ids"] hydrates ids to Post::V1::Post
      def list_feed
        authenticate_user!

        filter = case request.message.filter
        when :FEED_FILTER_ALL then "all"
        when :FEED_FILTER_AREA then "area"
        when :FEED_FILTER_FOLLOWING then "following"
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "filter is required")
        end

        prefecture = request.message.prefecture.to_s
        if filter == "area" && prefecture.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "prefecture is required for AREA filter")
        end

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_feed_uc.call(
          filter: filter,
          viewer_account_id: current_user_id,
          prefecture: filter == "area" ? prefecture : nil,
          limit: limit,
          cursor: cursor
        )

        # Hydrate via posts cross-slice (F2)
        hydrated = list_posts_by_ids_uc.call(post_ids: result[:post_ids], viewer_account_id: current_user_id)

        # Preserve order; drop entries that disappeared between query and hydration
        posts = result[:post_ids].map { |id| hydrated[id] }.compact

        ::Feed::V1::ListFeedResponse.new(
          posts: posts,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end
```

- [ ] **Step 4: private accessor 2 つ追加**

既存 private accessor 群 (`def list_guest_feed_uc` 等の近辺) に追加:

```ruby
      def list_feed_uc
        @list_feed_uc ||= Feed::UseCases::ListFeed.new
      end

      def list_posts_by_ids_uc
        @list_posts_by_ids_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
```

- [ ] **Step 5: 構文チェック**

```bash
ruby -c slices/feed/grpc/handler.rb
```

---

## Task 6: 回帰確認 + container resolve smoke + commit

- [ ] **Step 1: rspec 全 slice 回帰確認**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

Expected: 各 baseline 維持 (本 PR による regression 0)。profile slice の 14 既存 failures は本 PR 範囲外で許容。

- [ ] **Step 2: container resolve smoke**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  uc = Feed::UseCases::ListFeed.new
  puts "ListFeed class: #{uc.class}"
  # ALL filter で空 DB / cursor nil
  result = uc.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "ALL empty result: #{result.inspect}"
' 2>&1 | /usr/bin/tail -10
```

Expected: `ListFeed class: Feed::UseCases::ListFeed` + `{post_ids: [], next_cursor: nil, has_more: false}` (UUID は無効でも query 自体は空配列返却で OK)。

- [ ] **Step 3: diff 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3-handler
/usr/bin/git diff --stat origin/main HEAD
```

Expected: 7 ファイル変更 + plan = 8 ファイル。**他のファイル変更ゼロ** (旧 use_cases / 旧 adapter / proto / frontend / 他 slice の handler に diff 無いこと)。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3-handler
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-12-feed-f3-handler.md
/usr/bin/git commit -s -m "feat(feed): symmetric ListFeed handler + use_case + adapter methods"
```

(push しない、controller 判断。)

---

## Deferred (本 F3 では実施しない)

- **post_repo.list_public_post_ids の DB index** (visibility + author_id + created_at 複合 index) → 本番投入時の最適化、本 PR では skip
- **cursor 用 last post の N+1**: `find_by_id` 1 回追加。`list_public_post_ids` を tuple 返しに最適化するのは別 PR
- **account 鍵 (profile.is_private) follow-gate**: social スライス着手時 (feed spec の defer 通り)
- **旧 RPC / use_cases / cast/guest adapter の drop**: cleanup PR で一括
- **handler 単体 spec の追加**: test infra 整備 PR で対応 (本 PR は rspec baseline 維持と container smoke で動作確認)

## Self-Review (作成者チェック済)

- **Spec coverage (F3 範囲)**: spec §Monolith feed slice の全項目を実装 — `list_feed` handler、`ListFeed` use_case、`list_public_post_ids` (= `list_post_ids_all/by_authors` を 1 method に統合)、block_adapter / follow_adapter の symmetric 化。F2 hydration を handler で呼び出し、F3a prefecture lookup を use_case 内で呼び出し。
- **Additive / build-green**: 旧 handler method / 旧 use_cases / 旧 cast/guest adapter / 既存 repo methods / proto / frontend 全て無改変。新 method / use_case / handler method を additive 追加するのみ。
- **Placeholder 無し**: 全 task に完全コード。
- **型 / 命名整合**:
  - filter 値: handler で proto enum → String 変換、use_case は String 受け取り (`"all"/"area"/"following"`)
  - prefecture 必須 validation = handler 責務 (AREA で空なら INVALID_ARGUMENT)
  - viewer_account_id = `current_user_id` (Grpc::Authenticatable 提供、account_id)
  - post_ids = String 配列 (`list_public_post_ids` で `.map(&:to_s)`)、F2 hydration の入力 / 出力 key 型と整合
  - block 評価: 双方向 (viewer ↔ author どちらが block していても除外)、symmetric spec 通り
  - account 鍵 follow-gate は無し (social slice の責務)
- **テスト方針**: 4 slice の rspec baseline 維持、container smoke、unit spec は F4 integration で実証 (test infra 整備は別 PR)
