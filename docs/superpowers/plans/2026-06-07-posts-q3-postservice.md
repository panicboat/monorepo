# Posts Q3: symmetric PostService implementation (additive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 対称 `PostService` RPC（`ListPosts`/`GetPost`/`SavePost`/`DeletePost`）を実装する。著者解決は統合 ProfileService 経由（新 `ProfileAuthorAdapter`）、投稿者＝`author_id`（account）。旧 `CastPost` 系 RPC は温存。

**Architecture:** **Additive / build-green**。`PostHandler` に対称 RPC メソッドを**追加**（旧 ListCastPosts 等は不変）。cast/guest split・follow-gate は使わない（follow-gate は social スライスへ defer、post-level visibility のみ）。著者は ProfileService（`use_cases.get_profile`）で解決。LikeService 対称化は **Q3b**、comments 著者解決は後続。

**Tech Stack:** Ruby / Hanami 2 / gruf（gRPC）/ ROM。proto stub = `Post::V1::Post/PostAuthor/PostMedia`（Q1）、repo = `list_posts`/`find_by_id_and_author`/`create_post(author_id:)`/`account_liked_status_batch`（Q2）、cross-slice = `Profile::Slice["use_cases.get_profile"]`（profile スライス、main マージ済）。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（API / Monolith post slice）。前提: Q1・Q2 完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-slice`。app root: `services/monolith/workspace`。branch `feat/posts-slice`。**push しない**。
- 検索は `/usr/bin/grep`。DB は localhost:5432（起動中・シード済）、`hanami` は postgres@18 PATH。
- **build-green / additive**: `PostHandler` の旧 `list_cast_posts`/`get_cast_post`/`save_cast_post`/`delete_cast_post` と既存 private メソッド・旧 use_cases・旧 presenter メソッドは**無改変**。新 RPC メソッド + 新 adapter + 新 presenter メソッドを**追加**するだけ。
- **follow-gate は使わない**（社交グラフは social スライス）。対称版は post-level visibility のみ: 公開タイムライン = visibility "public"、private 投稿は著者本人にのみ表示。

### 既存（確定、再利用する）

- base `Post::Grpc::Handler`: Deps `post_repo`/`like_repo`/`comment_repo`、`Grpc::Authenticatable`（`current_user_id` / `authenticate_user!`）、`Concerns::CursorPagination`（`encode_cursor(created_at:, id:)` / `decode_cursor(str)` / `DEFAULT_LIMIT`）、private `load_media_files_for_posts(posts)`、`media_adapter`。`PostPresenter = Post::Presenters::PostPresenter`。
- repo（Q2）: `post_repo.list_posts(limit:, cursor:, author_id: nil)` / `find_by_id(id)` / `find_by_id_and_author(id:, author_id:)` / `create_post(author_id:, content:, visibility:)` / `update_post(id, data)` / `delete_post(id)` / `save_media(post_id:, media_data:)` / `save_hashtags(post_id:, hashtags:)`。`like_repo.likes_count(post_id:)` / `likes_count_batch(post_ids:)` / `account_liked?(post_id:, account_id:)` / `account_liked_status_batch(post_ids:, account_id:)`。`comment_repo.comments_count(post_id:, exclude_user_ids:)` / `comments_count_batch(post_ids:, exclude_user_ids:)`。
- profile スライス（main）: `Profile::Slice["use_cases.get_profile"].call(account_id:)` → profile struct（`account_id`/`display_name`/`username`/`avatar_media_id`）。
- proto（Q1）: `Post::V1::Post{ id, author_id, content, media[], created_at, author(PostAuthor), likes_count, comments_count, visibility, hashtags[], liked }`、`PostAuthor{ account_id, display_name, username, avatar_url }`、`PostMedia{ id, media_type, url, thumbnail_url, media_id }`、`ListPostsRequest{ limit, cursor, author_id, filter }` / `ListPostsResponse{ posts[], next_cursor, has_more }`、`SavePostRequest{ id, content, media[], visibility, hashtags[] }` / `SavePostResponse{ post }`、`GetPost*`、`DeletePost*`。

## File Structure

- Create: `slices/post/adapters/profile_author_adapter.rb`
- Modify: `slices/post/presenters/post_presenter.rb`（`to_post_proto` 等を追加）
- Modify: `slices/post/grpc/post_handler.rb`（対称 RPC を追加）

---

## Task 1: ProfileAuthorAdapter（著者解決を ProfileService 化）

**Files:** Create `slices/post/adapters/profile_author_adapter.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require_relative "media_adapter"

module Post
  module Adapters
    # Resolves post authors via the unified Profile slice (symmetric, account-based).
    class ProfileAuthorAdapter
      AuthorInfo = Data.define(:account_id, :display_name, :username, :avatar_url)

      def initialize
        @get_profile = Profile::Slice["use_cases.get_profile"]
        @media_adapter = MediaAdapter.new
      end

      # account_ids -> { account_id => AuthorInfo }
      def load(account_ids)
        ids = (account_ids || []).compact.uniq
        return {} if ids.empty?

        profiles = ids.filter_map { |aid| @get_profile.call(account_id: aid) }

        avatar_ids = profiles.filter_map { |p| p.avatar_media_id unless p.avatar_media_id.to_s.empty? }
        media = avatar_ids.empty? ? {} : @media_adapter.find_by_ids(avatar_ids)

        profiles.each_with_object({}) do |p, hash|
          mf = media[p.avatar_media_id]
          hash[p.account_id] = AuthorInfo.new(
            account_id: p.account_id.to_s,
            display_name: p.display_name || "",
            username: p.username || "",
            avatar_url: mf&.url || ""
          )
        end
      end
    end
  end
end
```

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/adapters/profile_author_adapter.rb`
Expected: `Syntax OK`。

---

## Task 2: PostPresenter に対称 Post を構築するメソッドを追加

**Files:** Modify `slices/post/presenters/post_presenter.rb`。

- [ ] **Step 1: クラス内（既存 `self.author_to_proto` の下、`end` の前）に追加**

```ruby
      def self.to_post_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false, media_files: {})
        return nil unless post

        media = (post.respond_to?(:post_media) ? post.post_media : []) || []
        hashtags = (post.respond_to?(:hashtags) ? post.hashtags : []) || []

        ::Post::V1::Post.new(
          id: post.id.to_s,
          author_id: post.author_id.to_s,
          content: post.content,
          media: media.sort_by(&:position).map { |m| post_media_to_proto(m, media_files: media_files) },
          created_at: post.created_at.iso8601,
          author: post_author_to_proto(author),
          likes_count: likes_count,
          comments_count: comments_count,
          visibility: post.respond_to?(:visibility) ? post.visibility : "public",
          hashtags: hashtags.sort_by(&:position).map(&:tag),
          liked: liked
        )
      end

      def self.post_media_to_proto(media, media_files: {})
        media_file = media_files[media.media_id]
        ::Post::V1::PostMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          url: media_file&.url || "",
          thumbnail_url: media_file&.thumbnail_url || "",
          media_id: media.media_id.to_s
        )
      end

      def self.post_author_to_proto(author)
        return nil unless author

        ::Post::V1::PostAuthor.new(
          account_id: author.account_id.to_s,
          display_name: author.display_name || "",
          username: author.username || "",
          avatar_url: author.avatar_url || ""
        )
      end
```

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/presenters/post_presenter.rb`
Expected: `Syntax OK`。

---

## Task 3: PostHandler に対称 RPC を追加

**Files:** Modify `slices/post/grpc/post_handler.rb`。

- [ ] **Step 1: rpc 宣言を追加**

既存の 4 つの `rpc :*CastPost*` 宣言の直後（`include Post::Deps[...]` の前）に追加:

```ruby
      rpc :ListPosts, ::Post::V1::ListPostsRequest, ::Post::V1::ListPostsResponse
      rpc :GetPost, ::Post::V1::GetPostRequest, ::Post::V1::GetPostResponse
      rpc :SavePost, ::Post::V1::SavePostRequest, ::Post::V1::SavePostResponse
      rpc :DeletePost, ::Post::V1::DeletePostRequest, ::Post::V1::DeletePostResponse
```

- [ ] **Step 2: 対称 RPC メソッド + private ヘルパーを追加**

`def delete_cast_post ... end` の直後（`private` の前）に対称 public メソッドを追加:

```ruby
      # ---- Symmetric (account-authored) API ----

      def list_posts
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : decode_cursor(request.message.cursor)
        author_id = request.message.author_id.empty? ? nil : request.message.author_id

        rows = post_repo.list_posts(limit: limit, cursor: cursor, author_id: author_id)
        has_more = rows.length > limit
        rows = rows.first(limit) if has_more
        next_cursor = if has_more && rows.any?
          encode_cursor(created_at: rows.last.created_at.iso8601, id: rows.last.id)
        else
          ""
        end

        ::Post::V1::ListPostsResponse.new(
          posts: present_posts(rows),
          next_cursor: next_cursor,
          has_more: has_more
        )
      end

      def get_post
        post = post_repo.find_by_id(request.message.id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        # post-level visibility only (account-level follow-gate is social slice's concern)
        if post.visibility == "private" && post.author_id != current_user_id
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        ::Post::V1::GetPostResponse.new(post: present_post(post))
      end

      def save_post
        authenticate_user!

        m = request.message
        content = m.content.to_s
        if content.strip.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "本文を入力してください")
        end
        visibility = m.visibility.empty? ? "public" : m.visibility
        media_data = m.media.map { |x| { media_id: x.media_id, media_type: x.media_type } }
        hashtags = m.hashtags.to_a

        if m.id.empty?
          post = post_repo.create_post(author_id: current_user_id, content: content, visibility: visibility)
        else
          existing = post_repo.find_by_id_and_author(id: m.id, author_id: current_user_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing
          post_repo.update_post(m.id, content: content, visibility: visibility)
          post = post_repo.find_by_id(m.id)
        end

        post_repo.save_media(post_id: post.id, media_data: media_data) if media_data.any?
        post_repo.save_hashtags(post_id: post.id, hashtags: hashtags) if hashtags.any? || !m.id.empty?
        post = post_repo.find_by_id(post.id)

        ::Post::V1::SavePostResponse.new(post: present_post(post))
      end

      def delete_post
        authenticate_user!

        existing = post_repo.find_by_id_and_author(id: request.message.id, author_id: current_user_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

        post_repo.delete_post(request.message.id)
        ::Post::V1::DeletePostResponse.new
      end
```

そして `private` セクション（既存 `def load_media_files_for_posts` の近く）に対称ヘルパーを追加:

```ruby
      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end

      def present_posts(rows)
        post_ids = rows.map(&:id)
        authors = profile_author_adapter.load(rows.map(&:author_id))
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: [])
        liked = current_user_id ? like_repo.account_liked_status_batch(post_ids: post_ids, account_id: current_user_id) : {}
        media_files = load_media_files_for_posts(rows)

        rows.map do |post|
          PostPresenter.to_post_proto(
            post,
            author: authors[post.author_id],
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: liked[post.id] || false,
            media_files: media_files
          )
        end
      end

      def present_post(post)
        authors = profile_author_adapter.load([post.author_id])
        likes_count = like_repo.likes_count(post_id: post.id)
        comments_count = comment_repo.comments_count(post_id: post.id, exclude_user_ids: [])
        liked = current_user_id ? like_repo.account_liked?(post_id: post.id, account_id: current_user_id) : false
        media_files = load_media_files_for_posts([post])

        PostPresenter.to_post_proto(
          post,
          author: authors[post.author_id],
          likes_count: likes_count,
          comments_count: comments_count,
          liked: liked,
          media_files: media_files
        )
      end
```

- [ ] **Step 3: 構文 + 取りこぼし確認**

Run: `cd services/monolith/workspace && ruby -c slices/post/grpc/post_handler.rb && /usr/bin/grep -c "def list_cast_posts\|def list_posts" slices/post/grpc/post_handler.rb`
Expected: `Syntax OK` + `2`（旧 list_cast_posts と新 list_posts が両方存在＝additive）。

---

## Task 4: 検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: app boot + gRPC ロード（対称 RPC が bind されること）**

Run:
```
cd services/monolith/workspace && bundle exec ruby -e '
$LOAD_PATH.unshift(File.expand_path("stubs"), File.expand_path("lib"))
require "./config/app"; Hanami.app.prepare
require_relative "./slices/post/grpc/handler"
require_relative "./slices/post/grpc/post_handler"
descs = Post::Grpc::PostHandler.rpc_descs.keys.map(&:to_s)
puts descs.inspect
puts(["ListPosts","GetPost","SavePost","DeletePost"].all? { |r| descs.include?(r) } ? "symmetric rpcs ok" : "MISSING")
' 2>&1 | tail -5
```
Expected: rpc 一覧に `ListCastPosts...` と `ListPosts/GetPost/SavePost/DeletePost` の両方、最後に `symmetric rpcs ok`。DB 接続エラーが出たら DB 起動（`colima start` 等）後に再実行。`uninitialized constant`（Profile::Slice や Post::Adapters::ProfileAuthorAdapter）が出たら修正。

- [ ] **Step 2: post スライス spec で回帰なし**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | tail -6`
Expected: 既存と同じ結果（対称メソッドは追加のみ。新規失敗ゼロ）。

- [ ] **Step 3: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/monolith/workspace
git add slices/post/adapters/profile_author_adapter.rb slices/post/presenters/post_presenter.rb slices/post/grpc/post_handler.rb
git commit -s -m "feat(post): implement symmetric PostService (additive)"
```
（push しない。）

---

## Deferred（Q3 では実施しない）

- **Q3b**: 対称 LikeService（LikePost/UnlikePost/GetLikeStatus、account_id ベース）。
- comments の著者解決を ProfileService 化（後続）。
- frontend（compose/詳細/like/comment）→ **Q4**。
- 旧 CastPost handler/use_cases/cast-guest adapter・旧カラム drop → **cleanup**。
- account 鍵の follow-gate（social スライス）。

## Self-Review（作成者チェック済）

- **Spec coverage（Q3 範囲）**: 対称 PostService（ListPosts=公開タイムライン+author_id filter、GetPost=post-level visibility、SavePost=author_id 作成/更新、DeletePost=著者所有チェック）。著者解決＝ProfileService（ProfileAuthorAdapter）。`liked` は Q2 の account_liked_status_batch。follow-gate は spec 通り social へ defer。
- **Additive で build-green**: 旧 CastPost RPC・private メソッド・presenter 旧メソッドは無改変。新 RPC/メソッド/adapter/presenter メソッドを追加。`PostHandler` は同一 service（post.v1.PostService）に対称 RPC を追加 bind（Q1 で proto に定義済）。
- **Placeholder 無し**: adapter / presenter / handler すべて完全コード。既存ヘルパー（encode/decode_cursor, DEFAULT_LIMIT, load_media_files_for_posts, comments_count*）を再利用。
- **型/命名整合**: `to_post_proto` の author は `ProfileAuthorAdapter::AuthorInfo`（account_id/display_name/username/avatar_url）。proto `Post`/`PostAuthor`/`PostMedia`（Q1）と一致。repo メソッド（Q2）の引数一致。`Profile::Slice["use_cases.get_profile"]`（P4）一致。
- **検証**: gRPC ロード（対称 RPC bind）+ rspec spec/slices/post 回帰なし。E2E（実 ListPosts/SavePost）はオーケストレータがスタック起動で別途確認可。
