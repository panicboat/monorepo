# Feed F1: symmetric ListFeed proto contract (additive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `feed/v1/feed_service.proto` に **symmetric `ListFeed` RPC** + `FeedFilter` enum への `FEED_FILTER_AREA` 追加 + `ListFeedRequest` / `ListFeedResponse` messages を additive 追加し、`post/v1/post_service.proto` の `Post` を import / repeat する形で両 stub (monolith Ruby / frontend TS) を再生成する。旧 `ListGuestFeed` / `ListCastFeed` RPC と旧 `FeedPost` / `FeedAuthor` / `FeedMedia` messages は無改変、build-green を維持。

**Architecture:** **Additive only**。proto に新規 RPC・enum value・message を足し、stub を再生成するだけ。新 RPC の monolith 実装 (F3)・posts cross-slice hydration (F2)・profile cross-slice prefecture lookup (F3a)・frontend (F4) は後続増分。

**Tech Stack:** proto / buf。monolith codegen=`ruby bin/codegen` (`services/monolith/workspace/bin/codegen`)、frontend codegen=`pnpm proto:gen` (= `buf generate ../../../proto`)。

**Spec:** `docs/superpowers/specs/2026-06-12-feed-slice-design.md`（§API contract / §Decomposition の F1）。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice`。branch `feat/feed-slice` (origin/main = `7f637236` base、tracking 済)。**push しない・PR は親が判断**。
- 検索は `/usr/bin/grep`。
- **旧 RPC・message は温存**（撤去は cleanup フェーズ）。新 RPC・enum value・message を **additive** に追加するだけ。
- 既知 gotcha (posts Q1 / profile P1 で判明): `pnpm proto:gen` は es plugin 版上げで他 stub に churn が出ることがある (無害、commit する)。
- **enum 番号の spec からの逸脱**: spec illustrative の `FEED_FILTER_AREA = 2` は既存 `FEED_FILTER_FOLLOWING = 2` と衝突するため、additive 維持のため新規追加は `FEED_FILTER_AREA = 3`。proto wire 上は数値が ID なのでタブ順とは無関係 (frontend が tab 順を制御)。

### 現状の `proto/feed/v1/feed_service.proto`

- `enum FeedFilter`: UNSPECIFIED=0, ALL=1, FOLLOWING=2 (3 values)
- `service FeedService`: 2 RPC (ListGuestFeed, ListCastFeed)
- messages: FeedAuthor, FeedMedia, FeedPost, ListGuestFeedRequest, ListGuestFeedResponse, ListCastFeedRequest, ListCastFeedResponse
- `post.v1.Post` の import 無し (新規追加)

## File Structure

- Modify: `proto/feed/v1/feed_service.proto`
  - `import "post/v1/post_service.proto";` 追加
  - `enum FeedFilter` に `FEED_FILTER_AREA = 3;` 追加 (末尾)
  - `service FeedService` に `rpc ListFeed(...) returns (...);` を追加 (旧 2 RPC の下)
  - ファイル末尾に symmetric messages `ListFeedRequest` / `ListFeedResponse` 追加
- Regenerate: `services/monolith/workspace/stubs/feed/v1/*`
- Regenerate: `services/frontend/workspace/src/stub/feed/v1/*` (+ es plugin 版上げで他 stub の churn が出れば一緒に commit)

---

## Task 1: proto に symmetric ListFeed + AREA filter + messages を追加

**Files:** Modify `proto/feed/v1/feed_service.proto`。

- [ ] **Step 1: ファイル冒頭の `package` 宣言の下に import を追加**

ファイル冒頭はおそらく:

```proto
syntax = "proto3";

package feed.v1;

service FeedService {
  ...
}
```

`package feed.v1;` の直後 (`service FeedService {` の前) に追加:

```proto
import "post/v1/post_service.proto";
```

- [ ] **Step 2: `enum FeedFilter` に AREA を additive 追加**

既存 enum:

```proto
enum FeedFilter {
  FEED_FILTER_UNSPECIFIED = 0;
  FEED_FILTER_ALL = 1;        // Public posts + posts from followed casts
  FEED_FILTER_FOLLOWING = 2;  // Posts from followed casts only
}
```

を以下に変更 (既存 3 値保持、末尾に新 1 値):

```proto
enum FeedFilter {
  FEED_FILTER_UNSPECIFIED = 0;
  FEED_FILTER_ALL = 1;        // Public posts + posts from followed casts
  FEED_FILTER_FOLLOWING = 2;  // Posts from followed casts only
  FEED_FILTER_AREA = 3;       // Symmetric ListFeed: posts from authors whose profile.prefecture matches request.prefecture
}
```

- [ ] **Step 3: `service FeedService { ... }` に symmetric RPC を追加**

既存 2 RPC の下 (closing `}` の前) に追加:

```proto
  // Symmetric (account-authored) feed. Old ListGuestFeed / ListCastFeed above are kept until cleanup.
  rpc ListFeed(ListFeedRequest) returns (ListFeedResponse);
```

- [ ] **Step 4: ファイル末尾に symmetric messages を追加**

ファイル末尾 (最終 message の `}` の下) に追加:

```proto
// ---- Symmetric (account-authored) messages ----

message ListFeedRequest {
  FeedFilter filter = 1;       // FEED_FILTER_ALL / FEED_FILTER_AREA / FEED_FILTER_FOLLOWING
  int32 limit = 2;             // default: 20, max: 50
  string cursor = 3;           // optional, base64 encoded (created_at, id)
  string prefecture = 4;       // required when filter == FEED_FILTER_AREA; ignored otherwise
}

message ListFeedResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 5: lint (buf)**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice && buf lint proto 2>&1 | /usr/bin/head -20`
Expected: 新規追加に致命的 lint エラーなし (既存 proto と同等レベル。warning は許容)。

---

## Task 2: 両 stub を生成 (additive)

**Files:** `services/monolith/workspace/stubs/feed/v1/*`、`services/frontend/workspace/src/stub/feed/v1/*`。

- [ ] **Step 1: monolith stub 生成**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice/services/monolith/workspace && ruby bin/codegen 2>&1 | /usr/bin/tail -10`
Expected: `✅ Done.` (または同等の成功 marker)。`stubs/feed/v1/feed_service_pb.rb` に `Feed::V1::ListFeedRequest` / `Feed::V1::ListFeedResponse` / `Feed::V1::FeedFilter::AREA` 等が追加生成される。旧 `Feed::V1::ListGuestFeedRequest` 等は不変。

- [ ] **Step 2: frontend stub 生成**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice/services/frontend/workspace && pnpm proto:gen 2>&1 | /usr/bin/tail -10`
Expected: 成功。`src/stub/feed/v1/feed_service_pb.ts` に新 `ListFeedRequest` / `ListFeedResponse` 型と FeedFilter の AREA リテラル等が出る。旧 RPC / message は不変。**es plugin 版上げで他 stub に churn が出ても無害、commit する** (posts Q1 / profile P1 で確認済)。

---

## Task 3: build green を確認してコミット

**Files:** なし (検証 + commit)。

- [ ] **Step 1: monolith stub が壊れていないこと**

新 RPC は未実装 (handler は旧 ListGuestFeed / ListCastFeed のまま)。新 message はコンパイル可。

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice/services/monolith/workspace && ruby -c stubs/feed/v1/feed_service_pb.rb`
Expected: `Syntax OK`。

(gRPC server boot smoke や rspec は F3 で実装後に実施。F1 は stub 追加のみ。)

- [ ] **Step 2: frontend build green**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice/services/frontend/workspace && pnpm build 2>&1 | /usr/bin/tail -20`
Expected: 成功。新 feed stub は未参照だがコンパイルは通る。

- [ ] **Step 3: diff 確認**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice && /usr/bin/git diff --stat`
Expected: `proto/feed/v1/feed_service.proto` + `services/monolith/workspace/stubs/feed/v1/*` + `services/frontend/workspace/src/stub/feed/v1/*` (+ es plugin churn が出ていれば他 stub) + plan 1 ファイル。**ソースコード変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-slice
/usr/bin/git add proto/feed/v1/feed_service.proto services/monolith/workspace/stubs/feed/v1 services/frontend/workspace/src/stub docs/superpowers/plans/2026-06-12-feed-f1-proto.md
/usr/bin/git commit -s -m "feat(feed): add symmetric ListFeed proto contract (additive)"
```
(push しない。)

---

## Follow-up increments (本 F1 では実施しない)

- **F2**: posts slice cross-slice hydration (`Post::UseCases::ListPostsByIds`、`Post::Slice["use_cases.list_posts_by_ids"]`)。
- **F3a**: profile slice cross-slice prefecture lookup (`Profile::UseCases::ListAccountIdsByPrefecture`)。F3 と分けても合体させても可。
- **F3**: feed slice symmetric handler / use_case 実装 + block_adapter / follow_adapter の symmetric 化。旧 use_cases / handler は温存。
- **F4**: frontend (data 層 + 3 タブ UI + 投稿一覧ページ `/`)。
- **cleanup**: 旧 ListGuestFeed / ListCastFeed RPC、旧 FeedPost / FeedAuthor / FeedMedia messages、旧 use_cases、旧 cast_adapter / guest_adapter、旧 BFFs、旧 hooks の drop。

## Self-Review (作成者チェック済)

- **Spec coverage (F1 範囲)**: spec §API contract の `feed.v1.ListFeed` (FeedFilter ALL/AREA/FOLLOWING + prefecture + cursor + limit, response = `repeated post.v1.Post`) を additive 定義。`post/v1/post_service.proto` の import 含む。enum 番号は spec illustrative の `AREA=2` から `AREA=3` に変更 (additive 互換、wire 上は ID なので tab 順とは無関係) と plan 内に明記。
- **Additive で build-green**: 旧 RPC・message・enum 既存値 (UNSPECIFIED=0/ALL=1/FOLLOWING=2) 全て不変。新 stub は未参照でコンパイルのみ。
- **Placeholder 無し**: proto 追加分は完全コード。
- **命名整合**: `ListFeed` / `ListFeedRequest` / `ListFeedResponse` / `FEED_FILTER_AREA` は spec の Ubiquitous language と一致。`repeated post.v1.Post posts` で cross-package import 利用、Q1 / Q3 で確定した Post message を再利用。
