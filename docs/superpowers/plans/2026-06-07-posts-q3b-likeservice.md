# Posts Q3b: symmetric LikeService (additive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 対称 `LikeService` RPC（`LikePost`/`UnlikePost`/`GetLikeStatus`）を実装する（account_id ベース）。旧 `LikeCastPost` 系は温存。

**Architecture:** **Additive / build-green**。`LikeHandler` に対称 RPC を追加。Q2 の `like_repo.account_like/account_unlike/account_liked_status_batch` + `likes_count` を直接利用（guest-bound な旧 use_cases は使わない）。`current_user_id`（account）で誰でも like。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`。前提: Q1（proto: LikePost 等）・Q2（account_id schema + repo）完了。

---

## Context

- worktree: `.../feat-posts-slice`、app root `services/monolith/workspace`、branch `feat/posts-slice`。**push しない**。`/usr/bin/grep`。DB は localhost:5432（postgres@18 PATH）。
- base `Post::Grpc::Handler` は `like_repo`/`post_repo`（Deps）+ `Grpc::Authenticatable`（`current_user_id`/`authenticate_user!`）を提供。
- 旧 `like_cast_post`/`unlike_cast_post`/`get_post_like_status` と guest-bound use_cases は**無改変**。
- proto（Q1）: `LikePostRequest{post_id}` / `LikePostResponse{likes_count}` / `UnlikePost*` / `GetLikeStatusRequest{post_ids[]}` / `GetLikeStatusResponse{ map<string,bool> liked }`。

## File Structure

- Modify: `slices/post/grpc/like_handler.rb`（対称 RPC を追加）

---

## Task 1: LikeHandler に対称 RPC を追加

**Files:** Modify `slices/post/grpc/like_handler.rb`。

- [ ] **Step 1: rpc 宣言を追加**

既存 3 つの `rpc :*CastPost*` / `:GetPostLikeStatus` の直後（`include Post::Deps[...]` の前）に:

```ruby
      rpc :LikePost, ::Post::V1::LikePostRequest, ::Post::V1::LikePostResponse
      rpc :UnlikePost, ::Post::V1::UnlikePostRequest, ::Post::V1::UnlikePostResponse
      rpc :GetLikeStatus, ::Post::V1::GetLikeStatusRequest, ::Post::V1::GetLikeStatusResponse
```

- [ ] **Step 2: 対称メソッドを追加**

`def get_post_like_status ... end` の直後（`private` の前）に:

```ruby
      # ---- Symmetric (account-based) API ----

      def like_post
        authenticate_user!

        post = post_repo.find_by_id(request.message.post_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        like_repo.account_like(post_id: request.message.post_id, account_id: current_user_id)
        ::Post::V1::LikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def unlike_post
        authenticate_user!

        like_repo.account_unlike(post_id: request.message.post_id, account_id: current_user_id)
        ::Post::V1::UnlikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def get_like_status
        post_ids = request.message.post_ids.to_a

        liked = if current_user_id
          like_repo.account_liked_status_batch(post_ids: post_ids, account_id: current_user_id)
        else
          post_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Post::V1::GetLikeStatusResponse.new(liked: liked)
      end
```

- [ ] **Step 3: 構文 + additive 確認**

Run: `cd services/monolith/workspace && ruby -c slices/post/grpc/like_handler.rb && /usr/bin/grep -c "def like_cast_post\|def like_post" slices/post/grpc/like_handler.rb`
Expected: `Syntax OK` + `2`（旧 like_cast_post と新 like_post の両方）。

---

## Task 2: 検証してコミット

- [ ] **Step 1: gRPC ロード（対称 RPC bind）**

Run:
```
cd services/monolith/workspace && export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH" && bundle exec ruby -e '
$LOAD_PATH.unshift(File.expand_path("stubs"), File.expand_path("lib"))
require "./config/app"; Hanami.app.prepare
require_relative "./slices/post/grpc/handler"
require_relative "./slices/post/grpc/like_handler"
descs = Post::Grpc::LikeHandler.rpc_descs.keys.map(&:to_s)
puts descs.inspect
puts(["LikePost","UnlikePost","GetLikeStatus"].all? { |r| descs.include?(r) } ? "ok" : "MISSING")
' 2>&1 | tail -3
```
Expected: 旧 `LikeCastPost...` + 新 `LikePost/UnlikePost/GetLikeStatus`、最後に `ok`。

- [ ] **Step 2: post スライス spec で回帰なし**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | tail -5`
Expected: 既存と同じ（67 examples / 0 failures、回帰なし）。

- [ ] **Step 3: コミット**

```bash
cd services/monolith/workspace
git add slices/post/grpc/like_handler.rb
git commit -s -m "feat(post): implement symmetric LikeService (additive)"
```
（push しない。）

---

## Self-Review

- **Additive**: 旧 LikeCastPost RPC/メソッド/use_cases 無改変。新 RPC 3 つ + メソッド 3 つを追加。account_id ベース（誰でも like）。
- **Placeholder 無し**: 完全コード。base Handler の `like_repo`/`post_repo`/`current_user_id` と Q2 の `account_*` メソッド・proto（Q1）と整合。
- **検証**: gRPC ロード + rspec 回帰なし。
