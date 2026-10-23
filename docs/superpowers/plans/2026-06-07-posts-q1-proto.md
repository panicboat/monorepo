# Posts Q1: symmetric proto contract (additive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `post/v1` に**対称（account-authored）な Post / Like の messages・RPC を追加**し、両 stub（monolith Ruby / frontend TS）を生成する。旧 `CastPost` 系 RPC は残すので build-green。

**Architecture:** **Additive**。proto に新メッセージ/RPC を足し、stub 再生成のみ。新 RPC の monolith 実装・schema 変更・frontend は後続増分（Q2–Q4）。comments は既に `user_id` 対称なので Q1 では proto 不変（著者解決の ProfileService 化は Q3）。

**Tech Stack:** proto / buf。monolith codegen=`ruby bin/codegen`、frontend codegen=`pnpm proto:gen`。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（API contract / Ubiquitous language）。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-slice`。branch `feat/posts-slice`。**push しない**。worktree 内のパスのみ編集。
- proto は repo-root `proto/`。codegen は各サービスから:
  - monolith: `cd services/monolith/workspace && ruby bin/codegen` → `stubs/post/v1/*`（`Post::V1::*`）
  - frontend: `cd services/frontend/workspace && pnpm proto:gen` → `src/stub/post/v1/*`
- 検索は `/usr/bin/grep`。
- **旧 `CastPost` 系（ListCastPosts/GetCastPost/SaveCastPost/DeleteCastPost, CastPost, CastPostAuthor, CastPostMedia）と LikeCastPost 系は残す**（撤去は cleanup フェーズ）。新メッセージ/RPC を**追加**するだけ。
- 既知 gotcha（profile P1 で判明）: `pnpm proto:gen` は es plugin 版上げで他 stub を churn することがある（無害、commit する）。新 stub は未参照だがコンパイルは通る。

## File Structure

- Modify: `proto/post/v1/post_service.proto`（対称 Post/PostAuthor/PostMedia + ListPosts/GetPost/SavePost/DeletePost を追加）
- Modify: `proto/post/v1/like_service.proto`（対称 LikePost/UnlikePost/GetLikeStatus を追加）
- Regenerate: `services/monolith/workspace/stubs/post/v1/*`、`services/frontend/workspace/src/stub/post/v1/*`

---

## Task 1: post_service.proto に対称メッセージ/RPC を追加

**Files:** Modify `proto/post/v1/post_service.proto`。

- [ ] **Step 1: PostService に対称 RPC を追加**

`service PostService { ... }` の既存 4 RPC の下（`}` の前）に追加:

```proto
  // Symmetric (account-authored) API. Old CastPost RPCs above are kept until cleanup.
  rpc ListPosts(ListPostsRequest) returns (ListPostsResponse);
  rpc GetPost(GetPostRequest) returns (GetPostResponse);
  rpc SavePost(SavePostRequest) returns (SavePostResponse);
  rpc DeletePost(DeletePostRequest) returns (DeletePostResponse);
```

- [ ] **Step 2: 対称メッセージをファイル末尾に追加**

```proto
// ---- Symmetric (account-authored) messages ----

message PostAuthor {
  string account_id = 1;
  string display_name = 2;
  string username = 3;
  string avatar_url = 4;
}

message PostMedia {
  string id = 1;
  string media_type = 2; // "image" or "video"
  string url = 3;
  string thumbnail_url = 4;
  string media_id = 5; // Reference to media__files.id (required for input)
}

message Post {
  string id = 1;
  string author_id = 2;       // account id (any role)
  string content = 3;
  repeated PostMedia media = 4;
  string created_at = 5;      // ISO8601
  PostAuthor author = 6;
  int32 likes_count = 7;
  int32 comments_count = 8;
  string visibility = 9;      // "public" or "private"
  repeated string hashtags = 10;
  bool liked = 11;            // whether current account liked this post
}

message ListPostsRequest {
  int32 limit = 1;            // default: 20, max: 50
  string cursor = 2;         // optional, base64 encoded
  string author_id = 3;      // optional, filter by author account
  string filter = 4;         // optional, e.g. "following"
}

message ListPostsResponse {
  repeated Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message SavePostRequest {
  string id = 1;             // empty for create, set for update
  string content = 2;
  repeated PostMedia media = 3;
  string visibility = 4;     // "public" or "private", defaults to "public"
  repeated string hashtags = 5;
}

message SavePostResponse {
  Post post = 1;
}

message GetPostRequest {
  string id = 1;
}

message GetPostResponse {
  Post post = 1;
}

message DeletePostRequest {
  string id = 1;
}

message DeletePostResponse {}
```

---

## Task 2: like_service.proto に対称 RPC を追加

**Files:** Modify `proto/post/v1/like_service.proto`。

- [ ] **Step 1: LikeService に対称 RPC を追加**

`service LikeService { ... }` の既存 3 RPC の下に追加:

```proto
  // Symmetric (account-based). Old LikeCastPost RPCs above are kept until cleanup.
  rpc LikePost(LikePostRequest) returns (LikePostResponse);
  rpc UnlikePost(UnlikePostRequest) returns (UnlikePostResponse);
  rpc GetLikeStatus(GetLikeStatusRequest) returns (GetLikeStatusResponse);
```

- [ ] **Step 2: 対称メッセージをファイル末尾に追加**

```proto
// ---- Symmetric (account-based) messages ----

message LikePostRequest {
  string post_id = 1;
}

message LikePostResponse {
  int32 likes_count = 1;
}

message UnlikePostRequest {
  string post_id = 1;
}

message UnlikePostResponse {
  int32 likes_count = 1;
}

message GetLikeStatusRequest {
  repeated string post_ids = 1;
}

message GetLikeStatusResponse {
  map<string, bool> liked = 1; // post_id -> is_liked
}
```

- [ ] **Step 3: lint（buf）**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-slice && buf lint proto 2>&1 | head`
Expected: 新規追加に致命的 lint エラーなし（既存 proto と同等レベル。warning は許容）。

---

## Task 3: 両 stub を生成（additive）

**Files:** `services/monolith/workspace/stubs/post/v1/*`、`services/frontend/workspace/src/stub/post/v1/*`。

- [ ] **Step 1: monolith stub 生成**

Run: `cd services/monolith/workspace && ruby bin/codegen`
Expected: `✅ Done.`。`stubs/post/v1/post_service_pb.rb` に `Post::V1::Post` / `Post::V1::PostAuthor` / `Post::V1::ListPostsRequest` 等、`like_service_pb.rb` に `Post::V1::LikePostRequest` 等が追加生成される。旧 `CastPost` 系は不変。

- [ ] **Step 2: frontend stub 生成**

Run: `cd services/frontend/workspace && pnpm proto:gen`
Expected: `src/stub/post/v1/post_service_pb.ts` に `Post` / `PostAuthor` / `ListPosts` 等、`like_service_pb.ts` に `LikePost` 等が追加。旧 `CastPost` 系は不変（es plugin 版上げで他 stub に churn が出ても無害、commit する）。

---

## Task 4: build green を確認してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: monolith が壊れていないこと**

新 RPC は未実装（handler は旧 CastPost のまま）。新メッセージはコンパイル可。
Run: `cd services/monolith/workspace && ruby -c stubs/post/v1/post_service_pb.rb && ruby -c stubs/post/v1/like_service_pb.rb`
Expected: 両方 `Syntax OK`。（gRPC server boot や rspec は Q3 で実装後に。Q1 は stub 追加のみ。）

- [ ] **Step 2: frontend build green**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -20`
Expected: 成功。新 post stub は未参照だがコンパイルは通る。

- [ ] **Step 3: コミット（signoff、Co-Authored-By 無し）**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-slice
git add proto/post/v1 services/monolith/workspace/stubs/post/v1 services/frontend/workspace/src/stub
git commit -s -m "feat(post): add symmetric Post/Like proto contract (additive)"
```
（push しない。）

---

## Follow-up increments（本 Q1 では実施しない）

- **Q2**: monolith schema（`posts.author_id` / `likes.account_id` 追加、unique(post_id, account_id)、relation/repo、reseed）。
- **Q3**: 対称 PostService/LikeService 実装（著者＝ProfileService、`author_loader` 集約）。comments の著者解決も ProfileService 化。旧 CastPost handler と並走。
- **Q4**: frontend（data 層 + コンポーズ/詳細/like/comment UI）。
- **cleanup**: 旧 CastPost RPC・cast/guest adapter・旧カラム drop。

## Self-Review（作成者チェック済）

- **Spec coverage（Q1 範囲）**: §API の対称 PostService（ListPosts/GetPost/SavePost/DeletePost + Post{author_id,...}/PostAuthor{account_id,...}/PostMedia）・LikeService（LikePost/UnlikePost/GetLikeStatus）を additive 定義。comments は既に user_id 対称のため Q1 では proto 不変（Q3 で著者解決を ProfileService 化）と spec の decomposition に沿う。
- **Additive で build-green**: 旧 CastPost/LikeCastPost RPC・メッセージは不変。新 stub は未参照でコンパイルのみ。
- **Placeholder 無し**: proto 追加分は完全。
- **命名整合**: `Post`/`PostAuthor`/`PostMedia`、`author_id`（account）、RPC 名は spec の Ubiquitous language と一致。`PostAuthor{account_id, display_name, username, avatar_url}` は ProfileService の返す Profile（P4）と整合。
