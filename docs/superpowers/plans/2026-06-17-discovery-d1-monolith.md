# Discovery D1: monolith full vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** discovery slice 第 1 段。proto `discovery.v1` + 両 stub + slice scaffold + 3 use_cases + 2 handler + `bin/grpc` 登録 + **Profile/Post repository への 3 method 追加**を 1 PR で additive 追加し、`discovery.v1.DiscoveryService` 全 3 RPC が production で応答する状態にする。

**Architecture:** bookmarks B1 + notifications N1+N2 同形。自前 table なし、`Profile::Slice["repositories.profile_repository"]` (新 method `search_by_query`) と `Post::Slice["repositories.post_repository"]` (新 method `search_by_content` / `top_by_likes`) を呼び、結果 id を `Profile::Slice["use_cases.get_profile"]` (per id) / `Post::Slice["use_cases.posts.list_posts_by_ids"]` (batch、内部に `Social::FilterVisiblePosts` 包含) で hydration。

**Tech Stack:** Protobuf / Ruby / Hanami 2 / ROM-SQL / gruf。

**Spec:** `docs/superpowers/specs/2026-06-17-discovery-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-discovery-d1-monolith`、branch `feat/discovery-d1-monolith` (origin/main = `a5aa8ff1`、spec #707 マージ後)。**push しない**。
- 触らない: 他 slice の既存 method、frontend (stub regen 以外)、proto 他 package、emit 連動 (本 spec ではそもそも emit 連動なし)。

### 既存パターン (踏襲)

- slice scaffold = bookmarks B1 (#701)、notifications N1 (#692)、social S2a (#677) と同形
- use_case = social `Social::UseCases::Follows::ListFollowing` パターン (cursor pagination + per-id hydration)
- post hydration = bookmarks `ListBookmarks` パターン (`Post::Slice["use_cases.posts.list_posts_by_ids"]` で id → proto map、`filter_map` で順序保持)
- bin/grpc 登録 = proto stub require + handler require 同 PR (S2b hidden bug 回避)
- ROM relation alias = discovery には relation 不要 (table 無し)

## File Structure

**Proto (1 new):**
- `proto/discovery/v1/discovery_service.proto`

**Monolith stubs (2 new):**
- `services/monolith/workspace/stubs/discovery/v1/discovery_service_pb.rb`
- `services/monolith/workspace/stubs/discovery/v1/discovery_service_services_pb.rb`

**Frontend stub (1 new):**
- `services/frontend/workspace/src/stub/discovery/v1/discovery_service_pb.ts`

**Monolith slice (7 new):**
- `services/monolith/workspace/slices/discovery/config/slice.rb`
- `services/monolith/workspace/slices/discovery/db/repo.rb`
- `services/monolith/workspace/slices/discovery/db/relation.rb`
- `services/monolith/workspace/slices/discovery/use_cases/search_users.rb`
- `services/monolith/workspace/slices/discovery/use_cases/search_posts.rb`
- `services/monolith/workspace/slices/discovery/use_cases/rank_posts.rb`
- `services/monolith/workspace/slices/discovery/grpc/handler.rb`
- `services/monolith/workspace/slices/discovery/grpc/discovery_handler.rb`

**Monolith repository modify (2):**
- `services/monolith/workspace/slices/profile/repositories/profile_repository.rb` (add `search_by_query`)
- `services/monolith/workspace/slices/post/repositories/post_repository.rb` (add `search_by_content` + `top_by_likes`)

**Monolith bin/grpc (1 modify):**
- `services/monolith/workspace/bin/grpc` (proto stub require + handler require、合計 3 行追加)

**Plan (1 new):**
- `docs/superpowers/plans/2026-06-17-discovery-d1-monolith.md`

合計 17 file (proto 1 + stubs 3 + slice 8 + repo 2 + bin/grpc 1 + plan 1) + 場合により structure.sql 不更新 (migration なし、新 table なし)。

---

## Task 1: proto `discovery.v1`

**Files:** Create `proto/discovery/v1/discovery_service.proto`。

- [ ] **Step 1: 実装**

```proto
syntax = "proto3";

package discovery.v1;

import "profile/v1/service.proto";
import "post/v1/post_service.proto";

service DiscoveryService {
  rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);
  rpc SearchPosts(SearchPostsRequest) returns (SearchPostsResponse);
  rpc RankPosts(RankPostsRequest) returns (RankPostsResponse);
}

enum RankPeriod {
  RANK_PERIOD_UNSPECIFIED = 0;
  RANK_PERIOD_DAY = 1;       // last 24 hours
  RANK_PERIOD_WEEK = 2;      // last 7 days
  RANK_PERIOD_ALL = 3;       // all-time
}

message SearchUsersRequest {
  string query = 1;
  int32 limit = 2;
  string cursor = 3;
}

message SearchUsersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message SearchPostsRequest {
  string query = 1;
  int32 limit = 2;
  string cursor = 3;
}

message SearchPostsResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message RankPostsRequest {
  RankPeriod period = 1;
  int32 limit = 2;
  string cursor = 3;
}

message RankPostsResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 2: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto && buf lint 2>&1 | /usr/bin/tail -5
```

---

## Task 2: 両 stub 再生成

- [ ] **Step 1: frontend stub 生成**

```bash
cd services/frontend/workspace
pnpm proto:gen 2>&1 | /usr/bin/tail -5
```

期待: `src/stub/discovery/v1/discovery_service_pb.ts` のみ新規、他 stub churn 0。

- [ ] **Step 2: monolith stub 生成 (arm64-darwin)**

```bash
cd services/monolith/workspace
bundle exec grpc_tools_ruby_protoc \
  --proto_path=../../../proto \
  --ruby_out=stubs \
  --grpc_out=stubs \
  ../../../proto/discovery/v1/discovery_service.proto 2>&1 | /usr/bin/tail -3
```

期待: `stubs/discovery/v1/discovery_service_{pb,services_pb}.rb` 2 file 新規。

---

## Task 3: Profile repository に `search_by_query` 追加

**Files:** Modify `services/monolith/workspace/slices/profile/repositories/profile_repository.rb`。

末尾 (private 前) に追記。`username` / `display_name` ILIKE、ORDER BY `(created_at desc, id desc)`、cursor pagination は既存 `Concerns::CursorPagination` 同形だが Profile repo は cursor を持っていないため、本 method 内で inline 実装。

ただし profile 表 schema の `created_at` / `id` 列を実装時確認、無ければ別 column で代用。

- [ ] **Step 1: 実装**

```ruby
def search_by_query(query:, limit: 20, cursor: nil)
  q = query.to_s.strip
  return [] if q.empty?

  pattern = "%#{q}%"
  scope = profiles.where { Sequel.|({ Sequel.function(:lower, :username) => Sequel.function(:lower, pattern) }, { Sequel.function(:lower, :display_name) => Sequel.function(:lower, pattern) }) }

  if cursor
    decoded = decode_cursor(cursor)
    scope = scope.where { (created_at < decoded[:created_at]) | ((created_at =~ decoded[:created_at]) & (id < decoded[:id])) }
  end

  scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
end

# concerns dependency
include ::Concerns::CursorPagination
```

> **Note**: SQL 風の `LOWER(col) LIKE LOWER(pattern)` は Sequel の Sequel.function で表現。Postgres には `ILIKE` operator もあり、より直接的:
> ```ruby
> scope = profiles.where(Sequel.|({ Sequel.lit("username ILIKE ?", pattern) => true }, { Sequel.lit("display_name ILIKE ?", pattern) => true }))
> ```
> 実装時は Sequel の dialect の動作を確認し、ILIKE 直書きが clean ならそちらを採用。

- [ ] **Step 2: include 確認**

クラス先頭で `include ::Concerns::CursorPagination` (上記 inline 記述 or class 直下) を含めること。既存 method `username_available?` などに cursor が無いなら、本 PR で新規追加が必要。

- [ ] **Step 3: Syntax check**

```bash
ruby -c slices/profile/repositories/profile_repository.rb
```

---

## Task 4: Post repository に `search_by_content` + `top_by_likes` 追加

**Files:** Modify `services/monolith/workspace/slices/post/repositories/post_repository.rb`。

- [ ] **Step 1: `search_by_content` 実装 (末尾)**

```ruby
def search_by_content(query:, limit: 20, cursor: nil)
  q = query.to_s.strip
  return [] if q.empty?

  pattern = "%#{q}%"
  scope = posts.where(visibility: "public").where(Sequel.lit("content ILIKE ?", pattern))

  if cursor
    decoded = decode_cursor(cursor)
    scope = scope.where { (created_at < decoded[:created_at]) | ((created_at =~ decoded[:created_at]) & (id < decoded[:id])) }
  end

  scope.order { [created_at.desc, id.desc] }.limit(limit + 1).select_map(:id)
end
```

> Note: 既存 `list_public_post_ids` も同様の cursor pattern なので、それを参考。

- [ ] **Step 2: `top_by_likes` 実装 (`search_by_content` の直下)**

```ruby
# period: "day" | "week" | "all"
def top_by_likes(period:, limit: 20, cursor: nil)
  scope = posts.where(visibility: "public")

  case period.to_s
  when "day"
    scope = scope.where { created_at >= Sequel.lit("NOW() - INTERVAL '1 day'") }
  when "week"
    scope = scope.where { created_at >= Sequel.lit("NOW() - INTERVAL '7 days'") }
  when "all"
    # no filter
  else
    return []
  end

  if cursor
    decoded = decode_cursor(cursor)
    # cursor field "created_at" is reused semantically as "likes_count" (integer-as-string).
    likes_at = decoded[:created_at].to_i
    scope = scope.where { (likes_count < likes_at) | ((likes_count =~ likes_at) & (id < decoded[:id])) }
  end

  scope.order { [likes_count.desc, id.desc] }.limit(limit + 1).select_map(:id)
end
```

> **Cursor field reuse**: `Concerns::CursorPagination` の `encode_cursor(created_at:, id:)` をそのまま流用、`created_at` 引数に `last.likes_count.to_s` を入れて encode、decode 後は `to_i` で likes_count を回収する。意味的 hack だが仕様変更コストを避ける。caller (`Discovery::UseCases::RankPosts`) でこれを expectation として handle する。

- [ ] **Step 3: Syntax check**

```bash
ruby -c slices/post/repositories/post_repository.rb
```

---

## Task 5: Discovery slice scaffold

### Task 5.1: `slices/discovery/config/slice.rb`

```ruby
# frozen_string_literal: true

module Discovery
  class Slice < Hanami::Slice
  end
end
```

### Task 5.2: `slices/discovery/db/{repo,relation}.rb`

```ruby
# frozen_string_literal: true

module Discovery
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

```ruby
# frozen_string_literal: true

module Discovery
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

> Note: discovery には自前 table が無いが、Hanami slice 配置の慣例で db base file を一応置く。container resolve に影響しない。

- [ ] **Step 1: 3 file Syntax check**

---

## Task 6: 3 use_cases

### Task 6.1: `Discovery::UseCases::SearchUsers`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    class SearchUsers
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      def call(query:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        rows = profile_repo.search_by_query(query: query, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.account_id) }

        { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
      end

      private

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
```

> **Note**: profile rows の primary key 名は実装時確認。`row.account_id` か `row.id` のどちらかで `get_profile.call` を呼ぶ。

### Task 6.2: `Discovery::UseCases::SearchPosts`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    class SearchPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      def call(query:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        post_ids = post_repo.search_by_content(query: query, limit: limit, cursor: cursor)
        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          last_created_at = post_repo.created_at_for_id(truncated.last)
          last_created_at ? encode_cursor(created_at: last_created_at.iso8601, id: truncated.last) : nil
        end

        post_protos_map = list_posts_uc.call(post_ids: truncated, viewer_account_id: viewer_account_id)
        ordered_posts = truncated.filter_map { |id| post_protos_map[id.to_s] }

        { posts: ordered_posts, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_posts_uc
        @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
    end
  end
end
```

> **Note**: `created_at_for_id` は既存 method (`PostRepository#created_at_for_id`)、`Feed::UseCases::ListFeed` で同様に使用済。

### Task 6.3: `Discovery::UseCases::RankPosts`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    class RankPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      VALID_PERIODS = %w[day week all].freeze

      def call(period:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        period = period.to_s
        return { posts: [], next_cursor: nil, has_more: false } unless VALID_PERIODS.include?(period)

        post_ids = post_repo.top_by_likes(period: period, limit: limit, cursor: cursor)
        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        # cursor encodes (likes_count, id) — reuse the (created_at, id) encoder semantically.
        next_cursor = if has_more && truncated.any?
          last_likes = post_repo.likes_count_for_id(truncated.last)
          last_likes ? encode_cursor(created_at: last_likes.to_s, id: truncated.last) : nil
        end

        post_protos_map = list_posts_uc.call(post_ids: truncated, viewer_account_id: viewer_account_id)
        ordered_posts = truncated.filter_map { |id| post_protos_map[id.to_s] }

        { posts: ordered_posts, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_posts_uc
        @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
    end
  end
end
```

> **Note**: `likes_count_for_id` は Post repo に既存しない可能性があり、追加が必要。本 PR で Post::PostRepository に追加するか、`top_by_likes` の戻り値を `{id, likes_count}` の Array<Hash> に変更して cursor 用に最終要素から likes_count を取り出す方が cleaner。**実装時は後者を採用**:
>
> `top_by_likes` の戻り値を `select_map([:id, :likes_count])` で `[[id, likes], ...]` の Array<Array> に変更し、use_case 側で:
> ```ruby
> rows = post_repo.top_by_likes(...)
> has_more = rows.length > limit
> truncated = has_more ? rows.first(limit) : rows
> next_cursor = if has_more && truncated.any?
>   last = truncated.last
>   encode_cursor(created_at: last[1].to_s, id: last[0])
> end
> ids = truncated.map(&:first)
> post_protos_map = list_posts_uc.call(post_ids: ids, viewer_account_id: viewer_account_id)
> ordered_posts = ids.filter_map { |id| post_protos_map[id.to_s] }
> ```
>
> repository の Task 4 Step 2 の戻り値を `.select_map([:id, :likes_count])` に変更すれば、追加 method 不要。

- [ ] **Step: 3 use_case Syntax check**

```bash
for f in slices/discovery/use_cases/*.rb; do ruby -c "$f"; done
```

---

## Task 7: handler base + DiscoveryHandler

### Task 7.1: `slices/discovery/grpc/handler.rb`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Discovery
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination
    end
  end
end
```

(discovery handler は base に repo dep を持たない、各 use_case が cross-slice 呼出を完結する)

### Task 7.2: `slices/discovery/grpc/discovery_handler.rb`

```ruby
# frozen_string_literal: true

require "discovery/v1/discovery_service_services_pb"
require_relative "handler"

module Discovery
  module Grpc
    class DiscoveryHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "discovery.v1.DiscoveryService"

      bind ::Discovery::V1::DiscoveryService::Service

      self.rpc_descs.clear

      rpc :SearchUsers, ::Discovery::V1::SearchUsersRequest, ::Discovery::V1::SearchUsersResponse
      rpc :SearchPosts, ::Discovery::V1::SearchPostsRequest, ::Discovery::V1::SearchPostsResponse
      rpc :RankPosts, ::Discovery::V1::RankPostsRequest, ::Discovery::V1::RankPostsResponse

      include Discovery::Deps[
        search_users_uc: "use_cases.search_users",
        search_posts_uc: "use_cases.search_posts",
        rank_posts_uc: "use_cases.rank_posts"
      ]

      def search_users
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = search_users_uc.call(query: request.message.query, limit: limit, cursor: cursor)
        ::Discovery::V1::SearchUsersResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def search_posts
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = search_posts_uc.call(
          query: request.message.query,
          viewer_account_id: current_user_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::SearchPostsResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def rank_posts
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        period = period_to_string(request.message.period)

        result = rank_posts_uc.call(
          period: period,
          viewer_account_id: current_user_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::RankPostsResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      def period_to_string(enum)
        case enum
        when ::Discovery::V1::RankPeriod::RANK_PERIOD_DAY then "day"
        when ::Discovery::V1::RankPeriod::RANK_PERIOD_WEEK then "week"
        when ::Discovery::V1::RankPeriod::RANK_PERIOD_ALL then "all"
        else "week"  # default
        end
      end
    end
  end
end
```

- [ ] **Step: 2 file Syntax check**

```bash
ruby -c slices/discovery/grpc/handler.rb
ruby -c slices/discovery/grpc/discovery_handler.rb
```

---

## Task 8: `bin/grpc` 登録

**Files:** Modify `services/monolith/workspace/bin/grpc`。

- [ ] **Step 1: proto stub require 追加**

`require "bookmarks/v1/bookmark_service_services_pb"` の直下:
```ruby
require "bookmarks/v1/bookmark_service_services_pb"
require "discovery/v1/discovery_service_services_pb"
```

- [ ] **Step 2: handler require 追加**

`require_relative "../slices/bookmarks/grpc/bookmark_handler"` の直下:
```ruby
require_relative "../slices/bookmarks/grpc/bookmark_handler"
require_relative "../slices/discovery/grpc/handler"
require_relative "../slices/discovery/grpc/discovery_handler"
```

---

## Task 9: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持 (新 repo method 追加で既存 spec が壊れないこと)。

- [ ] **Step 2: container resolve smoke + empty path 動作**

```bash
bundle exec ruby -I stubs -I lib -e '
  require "hanami/prepare"

  %w[
    use_cases.search_users
    use_cases.search_posts
    use_cases.rank_posts
  ].each { |k| puts "#{k} => #{Discovery::Slice[k].class}" }

  puts "DiscoveryHandler: #{Discovery::Grpc::DiscoveryHandler}"

  zero = "00000000-0000-0000-0000-000000000000"

  # Empty path: query 空文字
  r1 = Discovery::Slice["use_cases.search_users"].call(query: "")
  puts "search_users empty query: profiles=#{r1[:profiles].length}"

  r2 = Discovery::Slice["use_cases.search_posts"].call(query: "", viewer_account_id: zero)
  puts "search_posts empty query: posts=#{r2[:posts].length}"

  r3 = Discovery::Slice["use_cases.rank_posts"].call(period: "all", viewer_account_id: zero)
  puts "rank_posts all empty: posts=#{r3[:posts].length}, has_more=#{r3[:has_more]}"
' 2>&1 | /usr/bin/tail -15
```

期待: 全 use_case + handler resolve 成功、各 empty path で `0` 件返却。

- [ ] **Step 3: bin/grpc 起動 smoke**

```bash
cd services/monolith/workspace
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec ruby -I stubs -I lib bin/grpc 2>&1 &
GRPC_PID=$!
sleep 8
kill $GRPC_PID 2>/dev/null
wait $GRPC_PID 2>&1 | /usr/bin/grep -E "Starting|Discovery|Services:" | /usr/bin/head -5
```

期待: `Services:` line に `Discovery::V1::DiscoveryService::Service` 登場。

- [ ] **Step 4: frontend tsc / build**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -5
pnpm build 2>&1 | /usr/bin/tail -10
```

期待: 緑 (stub のみで consumer なし、影響無し)。

- [ ] **Step 5: diff stat**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 proto + 3 stub + 8 monolith slice + 2 repo modify + 1 bin/grpc + plan = **16 file 前後**。

- [ ] **Step 6: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-discovery-d1-monolith
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-17-discovery-d1-monolith.md
/usr/bin/git commit -s -m "feat(discovery): proto + monolith slice (3 RPC + cross-slice search/rank, D1)"
```

push しない。

---

## Deferred

- **D2** (frontend full vertical): types + 3 hooks + 3 BFFs + grpc.ts に discoveryClient + /search & /ranking page 実装 (stub から置換)

## Self-Review

- **Spec coverage (D1 範囲)**: proto 3 RPC + 3 use_case + 2 handler + bin/grpc 登録 + Profile/Post repo に 3 method 追加 = monolith 側全て
- **Placeholder 無し**: 全 ruby code + proto 完全列挙
- **Cross-slice**: `Profile::Slice["repositories.profile_repository"]`、`Profile::Slice["use_cases.get_profile"]`、`Post::Slice["repositories.post_repository"]`、`Post::Slice["use_cases.posts.list_posts_by_ids"]` の 4 cross-slice 呼出、emit 系なし
- **bin/grpc lesson 適用**: proto stub require + handler require を本 PR で同時追加
- **Post visibility filter**: `top_by_likes` / `search_by_content` で `visibility = 'public'` 強制 + `list_posts_by_ids` 内で `Social::FilterVisiblePosts` (block + is_private follow-gate) 自動適用
- **Ranking cursor reuse**: `(created_at, id)` の cursor field を `(likes_count, id)` として semantic に流用、`top_by_likes` の戻り値を `[[id, likes_count], ...]` に変更、use_case 側で last の likes を encode
- **検証**: rspec baseline + container smoke + bin/grpc 起動 smoke + frontend tsc/build
