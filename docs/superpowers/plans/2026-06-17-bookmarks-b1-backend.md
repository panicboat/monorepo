# Bookmarks B1: backend full vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bookmarks slice の monolith 側 1 PR 仕上げ。proto `bookmarks.v1` + 両 stub + schema migration + slice scaffold + repo + 4 use_cases + 2 handler + `bin/grpc` 登録を 1 PR で additive 追加し、`bookmarks.v1.BookmarkService` 全 4 RPC が production で応答する状態にする。

**Architecture:** notifications N1+N2 + social S1+S2a+S2b の合体 pattern。slice 構成は最近の慣例通り (`as: :bookmark_records` で ROM-SQL alias 衝突回避、proto stub require + handler require を `bin/grpc` に同時登録)。post hydration は `Post::Slice["use_cases.posts.list_posts_by_ids"]` 経由 (社会 ListFollowing 同形)。

**Tech Stack:** Protobuf / buf / Ruby / Hanami 2 / ROM-SQL / gruf / PostgreSQL。

**Spec:** `docs/superpowers/specs/2026-06-17-bookmarks-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-bookmarks-b1-backend`、branch `feat/bookmarks-b1-backend` (origin/main = `56dd5559`、spec #700 マージ後)。**push しない**。
- 触らない: 他 slice、frontend、cross-slice emit hook (本 spec ではそもそも emit 連動なし)。

### 既存パターン (踏襲)

- slice scaffold = notifications N1 の構造、relations alias は **`as: :bookmark_records`** で衝突回避
- repository = idempotent INSERT (`ON CONFLICT (account_id, post_id) DO NOTHING`)、social `Follow#follow` の `ON CONFLICT` パターン参考
- list use_case = `Concerns::CursorPagination` + `Post::Slice["use_cases.posts.list_posts_by_ids"]` で post hydration (social `ListFollowing` 同形だが、Profile ではなく Post をフェッチ)
- handler base = social `Social::Grpc::Handler` 同形 (Gruf base + Authenticatable + CursorPagination + repo deps)
- bin/grpc 登録: proto stub require ブロック + handler require ブロックの両方に追加

## File Structure

**Proto (1 new):**
- `proto/bookmarks/v1/bookmark_service.proto`

**Monolith stubs (2 new):**
- `services/monolith/workspace/stubs/bookmarks/v1/bookmark_service_pb.rb`
- `services/monolith/workspace/stubs/bookmarks/v1/bookmark_service_services_pb.rb`

**Frontend stub (1 new):**
- `services/frontend/workspace/src/stub/bookmarks/v1/bookmark_service_pb.ts`

**Monolith slice (10 new):**
- `services/monolith/workspace/config/db/migrate/20260617120000_create_bookmarks_schema.rb`
- `services/monolith/workspace/slices/bookmarks/config/slice.rb`
- `services/monolith/workspace/slices/bookmarks/db/repo.rb`
- `services/monolith/workspace/slices/bookmarks/db/relation.rb`
- `services/monolith/workspace/slices/bookmarks/relations/bookmarks.rb`
- `services/monolith/workspace/slices/bookmarks/repositories/bookmark_repository.rb`
- `services/monolith/workspace/slices/bookmarks/use_cases/bookmark.rb`
- `services/monolith/workspace/slices/bookmarks/use_cases/unbookmark.rb`
- `services/monolith/workspace/slices/bookmarks/use_cases/list_bookmarks.rb`
- `services/monolith/workspace/slices/bookmarks/use_cases/get_bookmark_status.rb`
- `services/monolith/workspace/slices/bookmarks/grpc/handler.rb`
- `services/monolith/workspace/slices/bookmarks/grpc/bookmark_handler.rb`

**Monolith bin/grpc (1 modify):**
- `services/monolith/workspace/bin/grpc` (proto stub require + handler require、合計 3 行追加)

**Plan (1 new):**
- `docs/superpowers/plans/2026-06-17-bookmarks-b1-backend.md`

(structure.sql は migration 実行で自動更新、これも diff に含まれる)

合計 16 + structure.sql 自動更新 = 約 17 file。

---

## Task 1: proto `bookmarks.v1`

**Files:** Create `proto/bookmarks/v1/bookmark_service.proto`。

- [ ] **Step 1: 実装**

```proto
syntax = "proto3";

package bookmarks.v1;

import "post/v1/post_service.proto";

service BookmarkService {
  rpc Bookmark(BookmarkRequest) returns (BookmarkResponse);
  rpc Unbookmark(UnbookmarkRequest) returns (UnbookmarkResponse);
  rpc ListBookmarks(ListBookmarksRequest) returns (ListBookmarksResponse);
  rpc GetBookmarkStatus(GetBookmarkStatusRequest) returns (GetBookmarkStatusResponse);
}

message BookmarkRequest {
  string post_id = 1;
}

message BookmarkResponse {}

message UnbookmarkRequest {
  string post_id = 1;
}

message UnbookmarkResponse {}

message ListBookmarksRequest {
  int32 limit = 1;      // default 20, max 50
  string cursor = 2;    // base64 (created_at, id)
}

message ListBookmarksResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetBookmarkStatusRequest {
  repeated string post_ids = 1;
}

message GetBookmarkStatusResponse {
  map<string, bool> bookmarked = 1;  // post_id -> true if bookmarked by viewer
}
```

- [ ] **Step 2: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto
buf lint 2>&1 | /usr/bin/tail -10
```

期待: 致命傷 error 無し。

---

## Task 2: 両 stub 再生成

実装 agent が proto 生成コマンドを runtime で確認 (`pnpm proto:gen` / `bundle exec grpc_tools_ruby_protoc` 等) し、bookmarks/v1 のみ再生成。

- [ ] **Step 1: frontend stub 生成**

```bash
cd services/frontend/workspace
pnpm proto:gen 2>&1 | /usr/bin/tail -10
```

期待: `src/stub/bookmarks/v1/bookmark_service_pb.ts` のみ新規、他 stub は無変更 (notifications N1 同様 churn 0)。churn あれば revert (`git checkout -- src/stub/<path>`)。

- [ ] **Step 2: monolith stub 生成 (arm64-darwin)**

```bash
cd services/monolith/workspace
bundle exec grpc_tools_ruby_protoc \
  --proto_path=../../../proto \
  --ruby_out=stubs \
  --grpc_out=stubs \
  ../../../proto/bookmarks/v1/bookmark_service.proto 2>&1 | /usr/bin/tail -5
```

期待: `stubs/bookmarks/v1/bookmark_service_{pb,services_pb}.rb` 2 file 新規。

- [ ] **Step 3: stub syntax check**

```bash
ruby -c stubs/bookmarks/v1/bookmark_service_pb.rb
ruby -c stubs/bookmarks/v1/bookmark_service_services_pb.rb
```

---

## Task 3: schema migration

**Files:** Create `services/monolith/workspace/config/db/migrate/20260617120000_create_bookmarks_schema.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS bookmarks"

    create_table :"bookmarks__bookmarks" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :post_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id, :post_id], name: :uq_bookmarks_account_post
    end

    run <<~SQL
      CREATE INDEX idx_bookmarks_account_created
        ON bookmarks.bookmarks (account_id, created_at DESC)
    SQL
  end

  down do
    drop_table :"bookmarks__bookmarks"
    run "DROP SCHEMA IF EXISTS bookmarks CASCADE"
  end
end
```

- [ ] **Step 2: Syntax check + migration 実行 + structure.sql 再 dump**

```bash
cd services/monolith/workspace
ruby -c config/db/migrate/20260617120000_create_bookmarks_schema.rb
bundle exec hanami db migrate 2>&1 | /usr/bin/tail -5
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec hanami db structure dump 2>&1 | /usr/bin/tail -5
```

---

## Task 4: monolith slice base + relation + repo

### Task 4.1: `slices/bookmarks/config/slice.rb`

```ruby
# frozen_string_literal: true

module Bookmarks
  class Slice < Hanami::Slice
  end
end
```

### Task 4.2: `slices/bookmarks/db/{repo,relation}.rb`

```ruby
# frozen_string_literal: true

module Bookmarks
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

```ruby
# frozen_string_literal: true

module Bookmarks
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

### Task 4.3: `slices/bookmarks/relations/bookmarks.rb`

**重要**: alias は `:bookmark_records` で ROM-SQL の dry-monitor instrumentation 衝突回避 (notifications N1 の lesson)。

```ruby
# frozen_string_literal: true

module Bookmarks
  module Relations
    class Bookmarks < Bookmarks::DB::Relation
      schema(:"bookmarks__bookmarks", as: :bookmark_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :post_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

### Task 4.4: `slices/bookmarks/repositories/bookmark_repository.rb`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Bookmarks
  module Repositories
    class BookmarkRepository < Bookmarks::DB::Repo
      include ::Concerns::CursorPagination

      # Idempotent INSERT. Returns true if a new row was inserted, false if it already existed.
      def bookmark(account_id:, post_id:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO bookmarks.bookmarks (id, account_id, post_id, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (account_id, post_id) DO NOTHING
          RETURNING id
        SQL

        ds = bookmark_records.dataset.db
        result = ds.fetch(sql, new_id, account_id, post_id, now).first
        !result.nil?
      end

      def unbookmark(account_id:, post_id:)
        deleted = bookmark_records.dataset
          .where(account_id: account_id, post_id: post_id)
          .delete
        deleted > 0
      end

      # Cursor: (created_at, id) DESC
      def list(account_id:, limit: 20, cursor: nil)
        scope = bookmark_records.where(account_id: account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # @return [Hash{post_id (String) => Boolean}] for ALL inputs, missing => false
      def status_batch(account_id:, post_ids:)
        return {} if post_ids.nil? || post_ids.empty?

        present = bookmark_records.dataset
          .where(account_id: account_id, post_id: post_ids)
          .select_map(:post_id)
          .map(&:to_s)
        post_ids.each_with_object({}) { |id, h| h[id.to_s] = present.include?(id.to_s) }
      end

      def bookmarked?(account_id:, post_id:)
        bookmark_records.where(account_id: account_id, post_id: post_id).exist?
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

- [ ] **Step: 4 file Syntax check**

```bash
ruby -c slices/bookmarks/config/slice.rb
ruby -c slices/bookmarks/db/repo.rb
ruby -c slices/bookmarks/db/relation.rb
ruby -c slices/bookmarks/relations/bookmarks.rb
ruby -c slices/bookmarks/repositories/bookmark_repository.rb
```

---

## Task 5: use_cases (4 個)

### Task 5.1: `Bookmark`

`slices/bookmarks/use_cases/bookmark.rb`:

```ruby
# frozen_string_literal: true

module Bookmarks
  module UseCases
    class Bookmark
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:, post_id:)
        bookmark_repo.bookmark(account_id: account_id, post_id: post_id)
        {}
      end
    end
  end
end
```

### Task 5.2: `Unbookmark`

```ruby
# frozen_string_literal: true

module Bookmarks
  module UseCases
    class Unbookmark
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:, post_id:)
        bookmark_repo.unbookmark(account_id: account_id, post_id: post_id)
        {}
      end
    end
  end
end
```

### Task 5.3: `ListBookmarks`

post hydration は `Post::Slice["use_cases.posts.list_posts_by_ids"]` 経由。social ListFollowing と同形。

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Bookmarks
  module UseCases
    class ListBookmarks
      include ::Concerns::CursorPagination
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      MAX_LIMIT = 50

      def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = bookmark_repo.list(account_id: account_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        post_ids = result[:items].map(&:post_id)
        post_protos_map = list_posts_uc.call(post_ids: post_ids, viewer_account_id: account_id)

        # Preserve bookmark order (most-recent first) instead of hash order.
        ordered_posts = post_ids.filter_map { |id| post_protos_map[id.to_s] }

        {
          posts: ordered_posts,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more]
        }
      end

      private

      def list_posts_uc
        @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
    end
  end
end
```

### Task 5.4: `GetBookmarkStatus`

```ruby
# frozen_string_literal: true

module Bookmarks
  module UseCases
    class GetBookmarkStatus
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:, post_ids:)
        post_ids = (post_ids || []).compact.uniq
        bookmark_repo.status_batch(account_id: account_id, post_ids: post_ids)
      end
    end
  end
end
```

- [ ] **Step: 4 use_case Syntax check**

```bash
for f in slices/bookmarks/use_cases/*.rb; do ruby -c "$f"; done
```

---

## Task 6: handler base + BookmarkHandler

### Task 6.1: `slices/bookmarks/grpc/handler.rb`

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Bookmarks
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination

      include Bookmarks::Deps[
        bookmark_repo: "repositories.bookmark_repository"
      ]
    end
  end
end
```

### Task 6.2: `slices/bookmarks/grpc/bookmark_handler.rb`

4 RPC binding + method、social `FollowHandler` 同形。

```ruby
# frozen_string_literal: true

require "bookmarks/v1/bookmark_service_services_pb"
require_relative "handler"

module Bookmarks
  module Grpc
    class BookmarkHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "bookmarks.v1.BookmarkService"

      bind ::Bookmarks::V1::BookmarkService::Service

      self.rpc_descs.clear

      rpc :Bookmark, ::Bookmarks::V1::BookmarkRequest, ::Bookmarks::V1::BookmarkResponse
      rpc :Unbookmark, ::Bookmarks::V1::UnbookmarkRequest, ::Bookmarks::V1::UnbookmarkResponse
      rpc :ListBookmarks, ::Bookmarks::V1::ListBookmarksRequest, ::Bookmarks::V1::ListBookmarksResponse
      rpc :GetBookmarkStatus, ::Bookmarks::V1::GetBookmarkStatusRequest, ::Bookmarks::V1::GetBookmarkStatusResponse

      include Bookmarks::Deps[
        bookmark_uc: "use_cases.bookmark",
        unbookmark_uc: "use_cases.unbookmark",
        list_bookmarks_uc: "use_cases.list_bookmarks",
        get_bookmark_status_uc: "use_cases.get_bookmark_status"
      ]

      def bookmark
        authenticate_user!
        bookmark_uc.call(account_id: current_user_id, post_id: request.message.post_id)
        ::Bookmarks::V1::BookmarkResponse.new
      end

      def unbookmark
        authenticate_user!
        unbookmark_uc.call(account_id: current_user_id, post_id: request.message.post_id)
        ::Bookmarks::V1::UnbookmarkResponse.new
      end

      def list_bookmarks
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_bookmarks_uc.call(account_id: current_user_id, limit: limit, cursor: cursor)
        ::Bookmarks::V1::ListBookmarksResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_bookmark_status
        authenticate_user!
        statuses = get_bookmark_status_uc.call(
          account_id: current_user_id,
          post_ids: request.message.post_ids.to_a
        )
        ::Bookmarks::V1::GetBookmarkStatusResponse.new(bookmarked: statuses)
      end
    end
  end
end
```

- [ ] **Step: 2 file Syntax check**

```bash
ruby -c slices/bookmarks/grpc/handler.rb
ruby -c slices/bookmarks/grpc/bookmark_handler.rb
```

---

## Task 7: `bin/grpc` に proto stub require + handler require 追加

**Files:** Modify `services/monolith/workspace/bin/grpc`。

S2b hidden bug 回避のため、proto stub require + handler require を同 PR で追加 (notifications N1 lesson)。

- [ ] **Step 1: proto stub require 追加**

旧 (proto stub require ブロック末尾):
```ruby
require "notifications/v1/notification_service_services_pb"
```

新:
```ruby
require "notifications/v1/notification_service_services_pb"
require "bookmarks/v1/bookmark_service_services_pb"
```

- [ ] **Step 2: handler require 追加**

旧 (handler require ブロック末尾):
```ruby
require_relative "../slices/notifications/grpc/handler"
require_relative "../slices/notifications/grpc/notification_handler"
```

新:
```ruby
require_relative "../slices/notifications/grpc/handler"
require_relative "../slices/notifications/grpc/notification_handler"
require_relative "../slices/bookmarks/grpc/handler"
require_relative "../slices/bookmarks/grpc/bookmark_handler"
```

---

## Task 8: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke + empty path 動作**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  %w[
    repositories.bookmark_repository
    use_cases.bookmark
    use_cases.unbookmark
    use_cases.list_bookmarks
    use_cases.get_bookmark_status
  ].each { |k| puts "#{k} => #{Bookmarks::Slice[k].class}" }

  puts "Bookmarks::Grpc::BookmarkHandler: #{Bookmarks::Grpc::BookmarkHandler}"

  zero = "00000000-0000-0000-0000-000000000000"
  list = Bookmarks::Slice["use_cases.list_bookmarks"].call(account_id: zero)
  puts "list empty posts: #{list[:posts].length}, has_more: #{list[:has_more]}"

  status = Bookmarks::Slice["use_cases.get_bookmark_status"].call(account_id: zero, post_ids: [zero])
  puts "status(empty post): #{status.inspect}"
' 2>&1 | /usr/bin/tail -15
```

期待:
- 全 use_case + handler class 解決
- `list empty posts: 0, has_more: false`
- `status(empty post): {"00000000-...": false}`

- [ ] **Step 3: bin/grpc boot smoke (`Bookmarks::V1::BookmarkService::Service` 登場確認)**

```bash
cd services/monolith/workspace
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec ruby -I stubs -I lib bin/grpc 2>&1 &
GRPC_PID=$!
sleep 8
kill $GRPC_PID 2>/dev/null
wait $GRPC_PID 2>&1 | /usr/bin/grep -E "Starting|Bookmarks|Services:" | /usr/bin/head -5
```

期待: "Starting gRPC Stub Server" + `Services:` line に `Bookmarks::V1::BookmarkService::Service` を含む。

- [ ] **Step 4: frontend tsc / build (新 stub 影響なし確認)**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -5
pnpm build 2>&1 | /usr/bin/tail -10
```

期待: 緑、stub のみで consumer なし、影響無し。

- [ ] **Step 5: diff stat**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 proto + 3 stub + 12 monolith slice + 1 bin/grpc + 1 structure.sql + plan = **18 file 前後**。

- [ ] **Step 6: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-bookmarks-b1-backend
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-17-bookmarks-b1-backend.md
/usr/bin/git commit -s -m "feat(bookmarks): proto + monolith slice (schema + repo + use_cases + handler, B1)"
```

push しない。

---

## Deferred

- **B2** (frontend full vertical): types + 3 hook + 4 BFFs + grpc.ts に bookmarkClient + PostCard に bookmark icon + /bookmarks page 実装 + /dev/ui mock

## Self-Review

- **Spec coverage (B1 範囲)**: proto 4 RPC + 4 use_case + 2 handler + bin/grpc 登録 = monolith 側全て
- **Placeholder 無し**: 全 ruby code + proto + SQL を完全列挙
- **ROM relation alias lesson 適用**: `as: :bookmark_records` で衝突回避
- **bin/grpc lesson 適用**: proto stub require + handler require を本 PR で同時追加 (S2b hidden bug 回避)
- **Cross-slice**: Post hydration のみ (`Post::Slice["use_cases.posts.list_posts_by_ids"]`)、emit / 通知連動なし
- **型 / 命名整合**:
  - `account_id` / `post_id` を kwarg 統一
  - cursor encode は `created_at, id` の 2 column 形式、`Concerns::CursorPagination` 互換
  - status_batch return 値は `Hash{post_id_string => Boolean}`、missing key も `false` で埋め
- **検証**: rspec baseline + container smoke (4 use_case + empty path) + bin/grpc 起動 smoke + frontend tsc/build
