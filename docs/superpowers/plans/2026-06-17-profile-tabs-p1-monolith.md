# Profile Content Tabs P1: monolith proto + repo + use_cases + handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec #718 の Tier 3 第 1 段。Post / Comment / Like の 3 proto service への additive 拡張 + 両 stub regen + 3 repo methods + 2 use_cases + 2 handler methods を 1 PR で。`/u/[username]` の 4 tabs (投稿 / 返信 / メディア / いいね) のうち、投稿 / メディア は既存 `ListPosts(author_id, media_only)` で、返信 は新 `CommentService.ListCommentsByAuthor` で、いいね は新 `LikeService.ListLikedPostsByAccount` で対応する backend を整備する。

**Architecture:** discovery D1 + bookmarks B1 と同形 (proto 拡張 + repo extension + use_case + handler method 追加)、ただし新スライス無し、3 既存 slice (Post::PostHandler / CommentHandler / LikeHandler) に method を追加。post hydration は `Post::Slice["use_cases.posts.list_posts_by_ids"]` を 2 use_case で再利用。

**Tech Stack:** Protobuf / Ruby / Hanami 2 / ROM-SQL / gruf。

**Spec:** `docs/superpowers/specs/2026-06-17-profile-content-tabs-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-tabs-p1-monolith`、branch `feat/profile-tabs-p1-monolith` (origin/main = `57cda61f`、spec #718 マージ後)。**push しない**。
- 触らない: 他 slice、frontend (stub regen 以外)、emit 連動 (本 spec ではそもそも emit 連動なし)。

### 既存パターン (踏襲)

- proto 拡張: discovery D1 (#708) の `social.v1.FollowService` への `GetSocialCounts` 追加と同形 = additive (互換破壊なし)
- repo + use_case: `Post::UseCases::Posts::ListPostsByIds` 既存 (S3 #679) + `Post::PostRepository#list_posts` (現状 author_id filter 既存) を踏襲
- hydration: bookmarks `ListBookmarks` (#701) と同形 (post_ids 取得 → `list_posts_by_ids` で proto Post hydration + viewer-aware `Social::FilterVisiblePosts` 内包)
- ROM relation alias 衝突なし (post / comment / like は既存)

## File Structure

**Proto (3 modify):**
- `proto/post/v1/post_service.proto` (ListPostsRequest に `media_only` field 追加)
- `proto/post/v1/comment_service.proto` (新 RPC + 2 message 追加)
- `proto/post/v1/like_service.proto` (新 RPC + 2 message 追加)

**Monolith stubs (3 modify):**
- `services/monolith/workspace/stubs/post/v1/post_service_pb.rb` (regen)
- `services/monolith/workspace/stubs/post/v1/comment_service_pb.rb` (regen)
- `services/monolith/workspace/stubs/post/v1/like_service_pb.rb` (regen)
- `services/monolith/workspace/stubs/post/v1/comment_service_services_pb.rb` (regen、新 RPC のため)
- `services/monolith/workspace/stubs/post/v1/like_service_services_pb.rb` (regen、新 RPC のため)

**Frontend stubs (3 modify):**
- `services/frontend/workspace/src/stub/post/v1/post_service_pb.ts` (regen)
- `services/frontend/workspace/src/stub/post/v1/comment_service_pb.ts` (regen)
- `services/frontend/workspace/src/stub/post/v1/like_service_pb.ts` (regen)

**Monolith slice (5 modify + 2 new):**
- `services/monolith/workspace/slices/post/repositories/post_repository.rb` (modify: `list_posts` に `media_only` 引数 + SQL filter)
- `services/monolith/workspace/slices/post/repositories/comment_repository.rb` (modify: `list_by_author` 新規 method)
- `services/monolith/workspace/slices/post/repositories/like_repository.rb` (modify: `liked_post_ids_by_account` 新規 method)
- `services/monolith/workspace/slices/post/use_cases/comments/list_comments_by_author.rb` (new)
- `services/monolith/workspace/slices/post/use_cases/likes/list_liked_posts_by_account.rb` (new)
- `services/monolith/workspace/slices/post/grpc/post_handler.rb` (modify: `list_posts` で `media_only` を pass)
- `services/monolith/workspace/slices/post/grpc/comment_handler.rb` (modify: 新 RPC binding + handler method)
- `services/monolith/workspace/slices/post/grpc/like_handler.rb` (modify: 新 RPC binding + handler method)

**Plan (1 new):**
- `docs/superpowers/plans/2026-06-17-profile-tabs-p1-monolith.md`

合計 ~17 file。

---

## Task 1: proto 拡張

### Task 1.1: `proto/post/v1/post_service.proto`

旧 (line 41-46):
```proto
message ListPostsRequest {
  int32 limit = 1;
  string cursor = 2;
  string author_id = 3;
  string filter = 4;
}
```

新:
```proto
message ListPostsRequest {
  int32 limit = 1;
  string cursor = 2;
  string author_id = 3;
  string filter = 4;
  bool media_only = 5;       // optional, filter posts with at least 1 media attachment
}
```

### Task 1.2: `proto/post/v1/comment_service.proto`

service block に追加 (line 9 の下):
```proto
rpc ListCommentsByAuthor(ListCommentsByAuthorRequest) returns (ListCommentsByAuthorResponse);
```

file 末尾に message 追加:
```proto
message ListCommentsByAuthorRequest {
  string author_id = 1;
  int32 limit = 2;
  string cursor = 3;
}

message ListCommentsByAuthorResponse {
  repeated Comment comments = 1;
  string next_cursor = 2;
  bool has_more = 3;
  // Parent posts keyed by post_id (for the "返信" tab UI to render quoted parent posts).
  // Frontend joins by comment.post_id.
  map<string, post.v1.Post> posts_by_id = 4;
}
```

> Note: `post.v1.Post` を import するために file 頭に `import "post/v1/post_service.proto";` 追加。

### Task 1.3: `proto/post/v1/like_service.proto`

service block に追加 (line 8 の下):
```proto
rpc ListLikedPostsByAccount(ListLikedPostsByAccountRequest) returns (ListLikedPostsByAccountResponse);
```

file 末尾:
```proto
message ListLikedPostsByAccountRequest {
  string account_id = 1;
  int32 limit = 2;
  string cursor = 3;
}

message ListLikedPostsByAccountResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

> Note: `post.v1.Post` を import するために `import "post/v1/post_service.proto";` 追加。

- [ ] **Step: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto && buf lint 2>&1 | /usr/bin/tail -5
```

---

## Task 2: 両 stub 再生成

- [ ] **Step 1: frontend stub**

```bash
cd services/frontend/workspace && pnpm proto:gen 2>&1 | /usr/bin/tail -5
```

期待: post_service_pb / comment_service_pb / like_service_pb が変更、他 stub churn 0。

- [ ] **Step 2: monolith stub** (3 service 個別)

```bash
cd services/monolith/workspace
for svc in post comment like; do
  bundle exec grpc_tools_ruby_protoc \
    --proto_path=../../../proto \
    --ruby_out=stubs --grpc_out=stubs \
    ../../../proto/post/v1/${svc}_service.proto 2>&1 | /usr/bin/tail -2
done
```

期待: 3 service の `_pb.rb` + `_services_pb.rb` 計 6 file 更新。

- [ ] **Step 3: stub ruby -c**

---

## Task 3: `PostRepository#list_posts` に `media_only` 引数追加

**Files:** Modify `services/monolith/workspace/slices/post/repositories/post_repository.rb`。

既存 `list_posts(limit: 20, cursor: nil, author_id: nil)` に `media_only: false` 引数追加、true 時に post_media JOIN で filter:

```ruby
def list_posts(limit: 20, cursor: nil, author_id: nil, media_only: false)
  scope = posts.where(visibility: "public")
  scope = scope.where(author_id: author_id) if author_id

  if media_only
    # filter to posts that have at least 1 media attachment
    media_post_ids = post_media.dataset.select(:post_id).distinct
    scope = scope.where(id: media_post_ids)
  end

  # ... existing cursor + order ...
end
```

> Note: `post_media` は `Post::Relations::PostMedia` を ROM relation reader として参照 (既存 relation あり、確認後 alias で呼ぶ)。実装時 `slices/post/relations/post_media.rb` で alias 名確認、無ければ別途 dataset で `posts.dataset.db[:post__post_media]` を直接読む選択肢あり。

---

## Task 4: `CommentRepository#list_by_author` 新規

**Files:** Modify `services/monolith/workspace/slices/post/repositories/comment_repository.rb`。

```ruby
def list_by_author(author_id:, limit: 20, cursor: nil)
  scope = comments.where(user_id: author_id)
  scope = apply_cursor(scope, cursor) if cursor
  scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
end
```

cursor decode は既存 `Concerns::CursorPagination` を include、または既存 method (例: `list_comments`) の cursor処理を参考。

---

## Task 5: `LikeRepository#liked_post_ids_by_account` 新規

**Files:** Modify `services/monolith/workspace/slices/post/repositories/like_repository.rb`。

```ruby
def liked_post_ids_by_account(account_id:, limit: 20, cursor: nil)
  scope = likes.where(account_id: account_id)
  scope = apply_cursor(scope, cursor) if cursor
  scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
end
```

戻り値は like row 配列 (id, post_id, created_at が含まれる)、caller で `post_id` 抽出 + cursor encode に `created_at` + `id` を使う。

---

## Task 6: `Post::UseCases::Comments::ListCommentsByAuthor` 新規

**Files:** Create `services/monolith/workspace/slices/post/use_cases/comments/list_comments_by_author.rb`。

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListCommentsByAuthor
        include ::Concerns::CursorPagination
        include Post::Deps[comment_repo: "repositories.comment_repository"]

        MAX_LIMIT = 50

        def call(author_id:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)

          rows = comment_repo.list_by_author(author_id: author_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Hydrate parent posts (key by post_id).
          post_ids = result[:items].map(&:post_id).uniq
          posts_by_id = list_posts_uc.call(post_ids: post_ids, viewer_account_id: viewer_account_id)

          {
            comments: result[:items],
            posts_by_id: posts_by_id,
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
end
```

---

## Task 7: `Post::UseCases::Likes::ListLikedPostsByAccount` 新規

**Files:** Create `services/monolith/workspace/slices/post/use_cases/likes/list_liked_posts_by_account.rb`。

`use_cases/likes/` ディレクトリは新規 (今は handler 直接実装、use_case 不在のため `mkdir -p` 必要)。

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Likes
      class ListLikedPostsByAccount
        include ::Concerns::CursorPagination
        include Post::Deps[like_repo: "repositories.like_repository"]

        MAX_LIMIT = 50

        def call(account_id:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)

          rows = like_repo.liked_post_ids_by_account(account_id: account_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Hydrate posts, preserve order from like rows.
          post_ids = result[:items].map(&:post_id)
          posts_map = list_posts_uc.call(post_ids: post_ids, viewer_account_id: viewer_account_id)
          ordered_posts = post_ids.filter_map { |id| posts_map[id.to_s] }

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
end
```

---

## Task 8: handler 追加

### Task 8.1: `Post::Grpc::PostHandler#list_posts` に `media_only` pass

`slices/post/grpc/post_handler.rb` の `list_posts` 内、`post_repo.list_posts(...)` 呼出に `media_only: request.message.media_only` を渡す。

### Task 8.2: `Post::Grpc::CommentHandler` に `ListCommentsByAuthor` RPC binding + method

`slices/post/grpc/comment_handler.rb`:
- `self.rpc_descs.clear` の後に `rpc :ListCommentsByAuthor, ...` 追加
- `include Post::Deps[...]` に `list_comments_by_author_uc: "use_cases.comments.list_comments_by_author"` 追加
- handler method 実装:

```ruby
def list_comments_by_author
  authenticate_user!
  limit = request.message.limit.zero? ? 20 : request.message.limit
  cursor = request.message.cursor.empty? ? nil : request.message.cursor

  result = list_comments_by_author_uc.call(
    author_id: request.message.author_id,
    viewer_account_id: current_user_id,
    limit: limit,
    cursor: cursor
  )

  comment_protos = result[:comments].map { |c| comment_row_to_proto(c) }
  posts_by_id_proto = result[:posts_by_id]  # already proto Post values

  ::Post::V1::ListCommentsByAuthorResponse.new(
    comments: comment_protos,
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more],
    posts_by_id: posts_by_id_proto
  )
end
```

> Note: `comment_row_to_proto` は既存 `CommentPresenter.to_proto` を流用、author / media 引数は本 PR では空でも可 (UI は本文 + 時刻 + parent post preview だけで足りる、別 PR で author hydration 追加余地)。`posts_by_id_proto` は use_case が `Post::V1::Post` の proto value を持つ Hash を返すため、そのまま map field に詰める。

### Task 8.3: `Post::Grpc::LikeHandler` に `ListLikedPostsByAccount` RPC binding + method

`slices/post/grpc/like_handler.rb`:
- `rpc :ListLikedPostsByAccount, ...`
- `include Post::Deps[..., list_liked_posts_by_account_uc: "use_cases.likes.list_liked_posts_by_account"]`
- handler method:

```ruby
def list_liked_posts_by_account
  authenticate_user!
  limit = request.message.limit.zero? ? 20 : request.message.limit
  cursor = request.message.cursor.empty? ? nil : request.message.cursor

  result = list_liked_posts_by_account_uc.call(
    account_id: request.message.account_id,
    viewer_account_id: current_user_id,
    limit: limit,
    cursor: cursor
  )

  ::Post::V1::ListLikedPostsByAccountResponse.new(
    posts: result[:posts],
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more]
  )
end
```

---

## Task 9: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke**

```bash
bundle exec ruby -I stubs -I lib -e '
  require "hanami/prepare"

  %w[
    use_cases.comments.list_comments_by_author
    use_cases.likes.list_liked_posts_by_account
  ].each { |k| puts "#{k} => #{Post::Slice[k].class}" }

  zero = "00000000-0000-0000-0000-000000000000"
  r1 = Post::Slice["use_cases.comments.list_comments_by_author"].call(author_id: zero, viewer_account_id: zero)
  puts "comments empty: count=#{r1[:comments].length}, has_more=#{r1[:has_more]}"
  r2 = Post::Slice["use_cases.likes.list_liked_posts_by_account"].call(account_id: zero, viewer_account_id: zero)
  puts "likes empty: count=#{r2[:posts].length}, has_more=#{r2[:has_more]}"
' 2>&1 | /usr/bin/tail -10
```

期待: 2 use_case 解決、empty path で 0 件返却。

- [ ] **Step 3: bin/grpc 起動 smoke**

```bash
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec ruby -I stubs -I lib bin/grpc 2>&1 &
GRPC_PID=$!
sleep 8
kill $GRPC_PID 2>/dev/null
wait $GRPC_PID 2>&1 | /usr/bin/grep -E "Starting|Services:" | /usr/bin/head -5
```

期待: 既存 service 全部 + Post / Comment / Like service の rpc_descs に新 RPC が追加 (service 名は同じ)。

- [ ] **Step 4: frontend tsc / build (新 stub 影響なし、consumer は P2 で)**

- [ ] **Step 5: diff stat + commit**

期待: 3 proto + 5-6 stub + 5 monolith slice modify + 2 use_case new + 1 plan = **15-17 file**。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-tabs-p1-monolith
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-17-profile-tabs-p1-monolith.md
/usr/bin/git commit -s -m "feat(post): proto + repo + use_cases for profile content tabs (media_only + ListCommentsByAuthor + ListLikedPostsByAccount, P1)"
```

push しない。

---

## Deferred

- **P2** (frontend data): 3 hooks + 3 BFFs + types
- **P3** (frontend UI): `/u/[username]` に Tabs + 4 tab content

## Self-Review

- **Spec coverage (P1 範囲)**: 3 proto additive + 3 repo extension + 2 use_case + 2 handler method
- **Placeholder 無し**: 全 ruby code + proto 完全列挙
- **Privacy**: 「いいね」「メディア」「投稿」は backend `visibility = 'public'` 強制 + use_case 内 `Post::Slice["use_cases.posts.list_posts_by_ids"]` の内部 `Social::FilterVisiblePosts` 自動適用
- **Cross-slice**: `Post::Slice["use_cases.posts.list_posts_by_ids"]` のみ、他 slice への依存なし
- **stub regen**: 3 service の `_pb.rb` + 新 RPC ある 2 service の `_services_pb.rb` も regen 必要 (comment + like)
- **検証**: rspec baseline + container smoke (2 use_case empty path) + bin/grpc 起動
