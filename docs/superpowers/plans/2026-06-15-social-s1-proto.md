# Social S1: greenfield `social.v1` proto contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規 `proto/social/v1/` 配下に `follow_service.proto` + `block_service.proto` を greenfield 作成し、両 stub (monolith Ruby / frontend TS) を生成する。旧 `relationship.v1` は無改変、build-green 維持。

**Architecture:** **Greenfield + additive**。新規ディレクトリと proto package で、symmetric account ↔ account の Follow/Block API を一気に定義。`profile.v1.Profile` (既存) を import して list 系 response の hydration に使う。codegen のみ、Ruby/TS 側の手書きコードは 0。

**Tech Stack:** proto / buf。monolith codegen=`ruby bin/codegen` (`services/monolith/workspace/bin/codegen`)、frontend codegen=`pnpm proto:gen` (= `buf generate ../../../proto`)。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (§API contract / §Decomposition の S1)。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice`。branch `feat/social-slice` (origin/main = `2d21cf02` base、spec commit `23091507` が既に乗っている)。**push しない**、PR は親が判断。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- 既知 gotcha: `pnpm proto:gen` は es plugin 版上げで他 stub に churn が出ることがある (無害、commit する)。
- 触らない: 旧 `proto/relationship/v1/*.proto`、他 slice の proto、ruby / TS 手書きコード。

### 既存パターン

- proto cross-package import: feed F1 で `import "post/v1/post_service.proto";` を採用済 (#660)。同じく `import "profile/v1/service.proto";` で `profile.v1.Profile` 参照可。
- enum 命名: `FEED_FILTER_*` のように全大文字 + slice prefix (新 `FOLLOW_STATUS_*`)。
- message 命名: Request/Response 各 RPC ごとに別 message (相互利用しない)。

## File Structure

- Create: `proto/social/v1/follow_service.proto`
- Create: `proto/social/v1/block_service.proto`
- Regenerate: `services/monolith/workspace/stubs/social/v1/*.rb` (codegen で自動生成)
- Regenerate: `services/frontend/workspace/src/stub/social/v1/*.ts` (codegen で自動生成)

---

## Task 1: `follow_service.proto` 作成

**Files:** Create `proto/social/v1/follow_service.proto`。

- [ ] **Step 1: 実装**

```proto
syntax = "proto3";

package social.v1;

import "profile/v1/service.proto";

service FollowService {
  rpc Follow(FollowRequest) returns (FollowResponse);
  rpc Unfollow(UnfollowRequest) returns (UnfollowResponse);
  rpc CancelFollowRequest(CancelFollowRequestRequest) returns (CancelFollowRequestResponse);
  rpc ApproveFollowRequest(ApproveFollowRequestRequest) returns (ApproveFollowRequestResponse);
  rpc RejectFollowRequest(RejectFollowRequestRequest) returns (RejectFollowRequestResponse);
  rpc ListFollowing(ListFollowingRequest) returns (ListFollowingResponse);
  rpc ListFollowers(ListFollowersRequest) returns (ListFollowersResponse);
  rpc ListPendingFollowRequests(ListPendingFollowRequestsRequest) returns (ListPendingFollowRequestsResponse);
  rpc GetFollowStatus(GetFollowStatusRequest) returns (GetFollowStatusResponse);
  rpc GetPendingFollowCount(GetPendingFollowCountRequest) returns (GetPendingFollowCountResponse);
}

enum FollowStatusValue {
  FOLLOW_STATUS_UNSPECIFIED = 0;
  FOLLOW_STATUS_NONE = 1;       // not following
  FOLLOW_STATUS_PENDING = 2;    // follow request pending approval
  FOLLOW_STATUS_APPROVED = 3;   // approved follower
}

// ---- mutation requests ----

message FollowRequest {
  string target_account_id = 1;
}

message FollowResponse {
  FollowStatusValue status = 1;  // PENDING (target is_private) or APPROVED (public)
}

message UnfollowRequest {
  string target_account_id = 1;
}

message UnfollowResponse {}

message CancelFollowRequestRequest {
  string target_account_id = 1;
}

message CancelFollowRequestResponse {}

message ApproveFollowRequestRequest {
  string requester_account_id = 1;
}

message ApproveFollowRequestResponse {}

message RejectFollowRequestRequest {
  string requester_account_id = 1;
}

message RejectFollowRequestResponse {}

// ---- list requests ----

message ListFollowingRequest {
  string account_id = 1;  // empty = viewer (current account)
  int32 limit = 2;        // default 20, max 50
  string cursor = 3;      // base64 (created_at, id)
}

message ListFollowingResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListFollowersRequest {
  string account_id = 1;
  int32 limit = 2;
  string cursor = 3;
}

message ListFollowersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListPendingFollowRequestsRequest {
  int32 limit = 1;
  string cursor = 2;
}

message ListPendingFollowRequestsResponse {
  repeated profile.v1.Profile profiles = 1;  // requesters' profiles
  string next_cursor = 2;
  bool has_more = 3;
}

// ---- batch / count ----

message GetFollowStatusRequest {
  repeated string target_account_ids = 1;
}

message GetFollowStatusResponse {
  map<string, FollowStatusValue> statuses = 1;  // target_account_id -> status
}

message GetPendingFollowCountRequest {}

message GetPendingFollowCountResponse {
  int32 count = 1;
}
```

- [ ] **Step 2: buf lint**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice && buf lint proto 2>&1 | /usr/bin/grep -E "social|FATAL|ERROR" | /usr/bin/head -10`
Expected: social 分の新規エラーなし (既存の identity/portfolio/profile 等の warning は出てよい)。

---

## Task 2: `block_service.proto` 作成

**Files:** Create `proto/social/v1/block_service.proto`。

- [ ] **Step 1: 実装**

```proto
syntax = "proto3";

package social.v1;

import "profile/v1/service.proto";

service BlockService {
  rpc Block(BlockRequest) returns (BlockResponse);
  rpc Unblock(UnblockRequest) returns (UnblockResponse);
  rpc ListBlocked(ListBlockedRequest) returns (ListBlockedResponse);
  rpc GetBlockStatus(GetBlockStatusRequest) returns (GetBlockStatusResponse);
}

message BlockRequest {
  string target_account_id = 1;
}

message BlockResponse {}

message UnblockRequest {
  string target_account_id = 1;
}

message UnblockResponse {}

message ListBlockedRequest {
  int32 limit = 1;       // default 20, max 50
  string cursor = 2;
}

message ListBlockedResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetBlockStatusRequest {
  repeated string target_account_ids = 1;
}

message GetBlockStatusResponse {
  map<string, bool> blocked = 1;  // target_account_id -> bool (viewer blocked them?)
}
```

- [ ] **Step 2: buf lint**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice && buf lint proto 2>&1 | /usr/bin/grep -E "social|FATAL|ERROR" | /usr/bin/head -10`
Expected: social 分の新規エラーなし。

---

## Task 3: 両 stub を生成

**Files:** `services/monolith/workspace/stubs/social/v1/*.rb`、`services/frontend/workspace/src/stub/social/v1/*.ts`。

- [ ] **Step 1: monolith stub 生成**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice/services/monolith/workspace && ruby bin/codegen 2>&1 | /usr/bin/tail -10`
Expected: `✅ Done.`。`stubs/social/v1/follow_service_pb.rb` + `stubs/social/v1/follow_service_services_pb.rb` + `stubs/social/v1/block_service_pb.rb` + `stubs/social/v1/block_service_services_pb.rb` (計 4 file) が生成される。`Social::V1::FollowService::Service` / `Social::V1::BlockService::Service` 等が定義されること。

- [ ] **Step 2: frontend stub 生成**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice/services/frontend/workspace
pnpm install 2>&1 | /usr/bin/tail -3   # node_modules 未配備対応
pnpm proto:gen 2>&1 | /usr/bin/tail -10
```

Expected: 成功。`src/stub/social/v1/follow_service_pb.ts` + `block_service_pb.ts` が生成される。`FollowService` / `BlockService` の MethodInfo + 各 Request/Response 型が export される。**es plugin 版上げで他 stub に churn が出ても無害、commit する** (feed F1 / posts Q1 と同じ既知挙動)。

---

## Task 4: build green 確認 + commit

- [ ] **Step 1: monolith stub が壊れていないこと**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice/services/monolith/workspace
ruby -c stubs/social/v1/follow_service_pb.rb
ruby -c stubs/social/v1/follow_service_services_pb.rb
ruby -c stubs/social/v1/block_service_pb.rb
ruby -c stubs/social/v1/block_service_services_pb.rb
```

Expected: 全 4 file `Syntax OK`。

新 RPC は未実装 (handler 不在)。stub のみ追加なので boot smoke は本 PR 範囲外、rspec も baseline 維持 (新 spec 0、既存 0 影響)。

- [ ] **Step 2: frontend build green**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
```

Expected: 両方緑。新 social stub は未参照だがコンパイル通過。

- [ ] **Step 3: diff 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice
/usr/bin/git diff --stat origin/main HEAD
```

Expected: 2 proto file 新規 + monolith stub 4 file 新規 + frontend stub 2 file 新規 (+ es plugin churn が出ていれば他 stub) + spec (前 commit) + plan ファイル。**ソースコード変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-slice
/usr/bin/git add proto/social services/monolith/workspace/stubs/social services/frontend/workspace/src/stub docs/superpowers/plans/2026-06-15-social-s1-proto.md
/usr/bin/git commit -s -m "feat(social): add symmetric Follow/Block proto contract (greenfield)"
```

push しない (controller 判断)。

---

## Follow-up increments (本 S1 では実施しない)

- **S2**: monolith — `slices/social/` 新規 (relations / repository / use_cases / handlers + 新 DB schema migration)
- **S3**: cross-slice follow-gate enforcement (posts + feed への enforce)
- **S4**: frontend data 層 (BFF + hooks + `socialClient` 配線)
- **S5**: frontend UI (FollowButton + /oshi + pending requests)
- **cleanup**: 旧 `relationship` 一括 drop (frontend hooks → BFFs → handler/use_case/adapter → proto → DB schema)

## Self-Review (作成者チェック済)

- **Spec coverage (S1 範囲)**: spec §API contract の `social.v1` 全 RPC (10 follow + 4 block = 14) + enum + 全 Request/Response message を additive 追加。`profile.v1.Profile` import で list 系 response に対応。
- **Greenfield**: 既存 `relationship.v1` 完全無改変、新ディレクトリ + 新 package で名前空間衝突なし。
- **Placeholder 無し**: proto は完全コード提示。
- **命名整合**: `FollowStatusValue` (旧 `FollowStatus` と区別)、`FOLLOW_STATUS_*` enum、`Follow*` / `*FollowRequest` / `ApproveFollowRequest*` 等の Request/Response 命名が spec §Ubiquitous language と一致。
- **Cursor pagination**: `limit` / `cursor` / `next_cursor` / `has_more` を Feed/Post と同形に統一、後続 S2 monolith で base64 `(created_at, id)` cursor 採用。
- **build-green**: stub のみ追加で monolith/frontend のソースコードに diff 0、後続増分まで動作変更なし。
