# A5: Drop legacy proto messages + PostPresenter legacy + contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A1-A4c で全 caller が drop された **legacy proto messages** + **PostPresenter legacy methods** + **save_post_contract** を一括 drop し、両 stub を再生成する。A cleanup フェーズの最終 (post adapters cleanup を除く)。

**Architecture:** **Coordinated removal**。proto/Ruby/spec を同時 drop し stub 再生成で整合性確保。残った Ruby caller (PostPresenter + spec) を先に drop してから proto を drop することで boot 時の `Post::V1::CastPost` 未定義エラーを回避。

**Tech Stack:** Ruby / Hanami 2 / protoc-gen-es / buf。monolith codegen=`ruby bin/codegen`、frontend codegen=`pnpm proto:gen`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto`
- branch: `chore/drop-legacy-proto` (origin/main = `3fe7b6f3` base、A4c #674 マージ後)
- 検証: monolith `bundle exec rspec spec/slices/post`, `feed`, `relationship`, `profile`、frontend `pnpm exec tsc --noEmit` + `pnpm build` + `pnpm lint`
- 触らない:
  - `Post::Adapters::*` (cross-slice 依存)
  - Symmetric proto messages (`Post::V1::Post`, `PostAuthor`, `PostMedia`, `ListPostsRequest`, `LikePostRequest` etc.)
  - Symmetric handler/use_case (post/like/feed の symmetric methods)
  - frontend symmetric code (Q4a/Q4b/F4a/F4b 産物)
  - 他 slice の proto/use_case/handler

### 削除対象詳細

**1. PostPresenter legacy methods** (`slices/post/presenters/post_presenter.rb`):
- `def self.to_proto(...)` (L6-25): legacy、returns `Post::V1::CastPost`
- `def self.many_to_proto(...)` (L27-29): legacy
- `def self.media_to_proto(...)` (L31-40): legacy、returns `Post::V1::CastPostMedia`
- `def self.author_to_proto(...)` (L42-55): legacy、returns `Post::V1::CastPostAuthor`
- **保持**: `def self.to_post_proto` (L57-) + `def self.post_media_to_proto` (L78-) + `def self.post_author_to_proto` (L89-) (symmetric)

**2. PostPresenter spec** (`spec/slices/post/presenters/post_presenter_spec.rb`):
- 全テスト (`.to_proto` / `.media_to_proto`) が legacy methods 対象 → **ファイル全削除**
- 新 spec (`to_post_proto` 等) は test infra 整備 PR で追加

**3. save_post_contract** (`slices/post/contracts/save_post_contract.rb`):
- 新 `save_post` handler は inline validation、contract 不使用 → orphan、drop

**4. proto messages drop**:

`proto/post/v1/post_service.proto` から:
- `service PostService {` 内: `rpc ListCastPosts`, `rpc GetCastPost`, `rpc SaveCastPost`, `rpc DeleteCastPost` の 4 行
- `message CastPostAuthor`, `message CastPostMedia`, `message CastPost`, `message ListCastPostsRequest`, `message ListCastPostsResponse`, `message SaveCastPostRequest`, `message SaveCastPostResponse`, `message GetCastPostRequest`, `message GetCastPostResponse`, `message DeleteCastPostRequest`, `message DeleteCastPostResponse`

`proto/post/v1/like_service.proto` から:
- `service LikeService {` 内: `rpc LikeCastPost`, `rpc UnlikeCastPost`, `rpc GetPostLikeStatus` の 3 行
- `message LikeCastPostRequest`, `message LikeCastPostResponse`, `message UnlikeCastPostRequest`, `message UnlikeCastPostResponse`, `message GetPostLikeStatusRequest`, `message GetPostLikeStatusResponse`

`proto/feed/v1/feed_service.proto` から:
- `service FeedService {` 内: `rpc ListGuestFeed`, `rpc ListCastFeed` の 2 行
- `message FeedAuthor`, `message FeedMedia`, `message FeedPost`, `message ListGuestFeedRequest`, `message ListGuestFeedResponse`, `message ListCastFeedRequest`, `message ListCastFeedResponse`
- enum FeedFilter の `FEED_FILTER_FOLLOWING = 2` は新 RPC でも参照 → **保持**

新 symmetric proto messages (Post, PostAuthor, PostMedia, ListPostsRequest, LikePost etc.) は完全保持。

**5. stub 再生成**:
- monolith: `cd services/monolith/workspace && ruby bin/codegen` → 各 service の `_pb.rb` と `_services_pb.rb` が更新
- frontend: `cd services/frontend/workspace && pnpm proto:gen` → `src/stub/{post,feed}/v1/*_pb.ts` 更新

## File Structure

- Modify: `services/monolith/workspace/slices/post/presenters/post_presenter.rb` (legacy methods 削除、symmetric 保持)
- Delete: `services/monolith/workspace/spec/slices/post/presenters/post_presenter_spec.rb`
- Delete: `services/monolith/workspace/slices/post/contracts/save_post_contract.rb`
- Modify: `proto/post/v1/post_service.proto`
- Modify: `proto/post/v1/like_service.proto`
- Modify: `proto/feed/v1/feed_service.proto`
- Regenerate: monolith stub files (`services/monolith/workspace/stubs/post/v1/*.rb`, `services/monolith/workspace/stubs/feed/v1/*.rb`)
- Regenerate: frontend stub files (`services/frontend/workspace/src/stub/post/v1/*.ts`, `services/frontend/workspace/src/stub/feed/v1/*.ts`)

---

## Task 1: PostPresenter から legacy methods を撤去

**Files:** Modify `services/monolith/workspace/slices/post/presenters/post_presenter.rb`。

- [ ] **Step 1: ファイル全体を Read で把握**

- [ ] **Step 2: 編集** — L6-55 (4 legacy methods 全体) を削除

`def self.to_proto` から `def self.author_to_proto` の `end` まで撤去。`def self.to_post_proto` 以降の symmetric methods は無改変。

- [ ] **Step 3: 構文確認**

```bash
cd services/monolith/workspace
ruby -c slices/post/presenters/post_presenter.rb
```

---

## Task 2: PostPresenter spec + contract 削除

**Files:** Delete 2 files。

- [ ] **Step 1: 削除**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto
/usr/bin/git rm services/monolith/workspace/spec/slices/post/presenters/post_presenter_spec.rb
/usr/bin/git rm services/monolith/workspace/slices/post/contracts/save_post_contract.rb
```

---

## Task 3: 3 proto file から legacy messages + RPC を drop

**Files:** Modify 3 proto files。

- [ ] **Step 1: `proto/post/v1/post_service.proto`**

`service PostService { ... }` 内の `rpc ListCastPosts` / `rpc GetCastPost` / `rpc SaveCastPost` / `rpc DeleteCastPost` の 4 行削除 (Symmetric の 4 rpc は保持)。

`message CastPostAuthor { ... }`, `message CastPostMedia { ... }`, `message CastPost { ... }`, `message ListCastPostsRequest { ... }`, `message ListCastPostsResponse { ... }`, `message SaveCastPostRequest { ... }`, `message SaveCastPostResponse { ... }`, `message GetCastPostRequest { ... }`, `message GetCastPostResponse { ... }`, `message DeleteCastPostRequest { ... }`, `message DeleteCastPostResponse { ... }` を全て削除。

Symmetric `message Post`, `PostAuthor`, `PostMedia`, `ListPostsRequest`, `ListPostsResponse`, `SavePostRequest`, `SavePostResponse`, `GetPostRequest`, `GetPostResponse`, `DeletePostRequest`, `DeletePostResponse` は保持。

- [ ] **Step 2: `proto/post/v1/like_service.proto`**

`rpc LikeCastPost` / `rpc UnlikeCastPost` / `rpc GetPostLikeStatus` の 3 行削除 (Symmetric `LikePost`/`UnlikePost`/`GetLikeStatus` は保持)。

`message LikeCastPostRequest/Response`, `UnlikeCastPostRequest/Response`, `GetPostLikeStatusRequest/Response` 削除。Symmetric `LikePostRequest/Response`, `UnlikePostRequest/Response`, `GetLikeStatusRequest/Response` 保持。

- [ ] **Step 3: `proto/feed/v1/feed_service.proto`**

`rpc ListGuestFeed` / `rpc ListCastFeed` の 2 行削除 (Symmetric `ListFeed` 保持)。

`message FeedAuthor`, `FeedMedia`, `FeedPost`, `ListGuestFeedRequest/Response`, `ListCastFeedRequest/Response` 削除。Symmetric `ListFeedRequest/Response` 保持。

`enum FeedFilter` 内 `FEED_FILTER_FOLLOWING = 2` 等の既存値は**保持** (新 `ListFeed` で使用)。

- [ ] **Step 4: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto
buf lint proto 2>&1 | /usr/bin/head -20
```

新規致命的 lint なし期待。

---

## Task 4: stub 再生成

**Files:** Regenerate monolith Ruby stubs + frontend TS stubs。

- [ ] **Step 1: monolith stub 生成**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto/services/monolith/workspace
ruby bin/codegen 2>&1 | /usr/bin/tail -5
```

`✅ Done.` 期待。生成された stub に legacy types が無いこと、symmetric types が保持されること。

- [ ] **Step 2: frontend stub 生成**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto/services/frontend/workspace
pnpm install 2>&1 | /usr/bin/tail -3
pnpm proto:gen 2>&1 | /usr/bin/tail -5
```

- [ ] **Step 3: 構文確認 (monolith stub)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto/services/monolith/workspace
ruby -c stubs/post/v1/post_service_pb.rb
ruby -c stubs/post/v1/like_service_pb.rb
ruby -c stubs/feed/v1/feed_service_pb.rb
```

---

## Task 5: rspec / build / lint 回帰 + commit

- [ ] **Step 1: monolith rspec 4 slice**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待:
- post: post_presenter_spec drop で 67 → 67-N (legacy spec の例数だけ減少、failures 増加なし)
- feed: 0/0 (A4c で全 spec 撤去後 baseline)
- relationship: 31/0 維持
- profile: 148/14 維持

- [ ] **Step 2: container smoke**

```bash
cd services/monolith/workspace
bundle exec ruby -e '
  require "hanami/prepare"
  r = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "ListFeed post_ids=#{r[:post_ids].length}"
  puts "ListPostsByIds: #{Post::Slice["use_cases.posts.list_posts_by_ids"].class}"
' 2>&1 | /usr/bin/tail -5
```

- [ ] **Step 3: frontend tsc + build + lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -15
pnpm lint 2>&1 | /usr/bin/tail -10
```

全部 baseline 同等以下。

- [ ] **Step 4: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto
/usr/bin/git diff --stat origin/main HEAD
```

期待:
- 3 proto file modify
- 2 monolith file (PostPresenter modify + spec/contract delete)
- 2 monolith stub modify (auto-gen)
- 2 frontend stub modify (auto-gen) — es plugin 版で churn が出れば他 stub もあり
- 1 plan
- 合計 10+ files

- [ ] **Step 5: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-proto
/usr/bin/git add proto services/monolith/workspace services/frontend/workspace/src/stub docs/superpowers/plans/2026-06-14-drop-legacy-proto.md
/usr/bin/git commit -s -m "chore(posts,feed): drop legacy proto messages, PostPresenter legacy, save_post_contract"
```

push しない。

---

## Deferred (本 A5 では実施しない)

- **Post::Adapters::CastAdapter / GuestAdapter / UserAdapter 等の drop** → cross-slice 依存 (relationship/trust/access_policy 等) の調査・整理が別 PR で必要 (A4d)
- `slices/post/grpc/handler.rb` (base) の dangling cast_adapter/guest_adapter/user_adapter accessors → 上記と同時 drop
- `comment_handler.rb` の dead `load_media_files_for_comments_with_authors` method → comment slice cleanup PR
- `add_comment.rb` の `user_exists?` リファクタ → UserAdapter 解放 PR
- DB columns drop (`posts.cast_user_id`, `likes.guest_user_id`) → 別 migration PR
- post_presenter / contract / フロントエンド向け新 symmetric spec → test infra 整備 PR

## Self-Review

- **Ruby caller 先 drop**: PostPresenter legacy methods + spec + contract を proto 削除前に撤去、stub regen で `Post::V1::CastPost` 未定義 error を回避
- **新 symmetric path 完全保持**: PostPresenter の `to_post_proto` 系 / 新 proto messages / handler / use_case 全て無改変
- **両 stub 再生成**: monolith Ruby + frontend TS を同 commit に同梱、両端で legacy 型が同時に消える
- **buf lint 致命的 issue なし期待**: 既存 lint 状態と同等を維持
