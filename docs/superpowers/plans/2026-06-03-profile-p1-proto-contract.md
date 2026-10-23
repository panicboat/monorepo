# Profile P1: proto contract (unified ProfileService) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新しい統合 `profile/v1` proto（ProfileService + 統合 Profile message）を**追加**し、両 stub（monolith Ruby / frontend TS）を生成する。旧 `portfolio/v1`（CastService/GuestService）は残すので何も壊れない（build-green）。

**Architecture:** **Additive**。proto を新規追加・stub 生成のみ。新 ProfileService の monolith 実装・portfolio/v1 撤去・テーブル統合は後続増分（P2-P5）。本 P1 で生成される profile/v1 stub は未参照（コンパイルは通る）。

**Tech Stack:** proto/buf。monolith codegen=`ruby bin/codegen`、frontend codegen=`pnpm proto:gen`。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。branch `feat/profile-slice`。push しない。worktree 内のパスのみ編集（main checkout は触らない）。
- proto は repo-root `proto/`。codegen は各サービスから走らせる:
  - monolith: `cd services/monolith/workspace && ruby bin/codegen` → `stubs/profile/v1/`
  - frontend: `cd services/frontend/workspace && pnpm proto:gen` → `src/stub/profile/v1/`
- 旧 `proto/portfolio/v1/*` は**残す**（撤去は P2+）。
- 既知 gotcha（identity 実装時）: `pnpm proto:gen` は es plugin 版上げで全 stub を churn することがある（無害、commit する）。stale-ref 検索は `/usr/bin/grep`（bare grep がこのシェルで不安定）。

## File Structure

- Create: `proto/profile/v1/service.proto`
- Regenerate: `services/monolith/workspace/stubs/profile/v1/*`、`services/frontend/workspace/src/stub/profile/v1/*`

---

## Task 1: 統合 profile/v1 proto を作成

**Files:** Create `proto/profile/v1/service.proto`。

- [ ] **Step 1: proto を書く**

Create `proto/profile/v1/service.proto`:

```proto
syntax = "proto3";

package profile.v1;

// Unified profile service (replaces portfolio CastService + GuestService).
// One Profile per account (1:1 with identity.Account). role-specific fields are
// optional (cast extras). Escort commerce dimension (plans/schedules/genres) dropped.
service ProfileService {
  rpc GetProfile (GetProfileRequest) returns (GetProfileResponse);
  rpc GetProfileByUsername (GetProfileByUsernameRequest) returns (GetProfileResponse);
  rpc SaveProfile (SaveProfileRequest) returns (SaveProfileResponse);
  rpc CheckUsernameAvailability (CheckUsernameAvailabilityRequest) returns (CheckUsernameAvailabilityResponse);
  rpc SaveProfileMedia (SaveProfileMediaRequest) returns (SaveProfileMediaResponse);
  rpc ListAreas (ListAreasRequest) returns (ListAreasResponse);
}

message Profile {
  string account_id = 1;       // 1:1 with identity.Account
  string username = 2;         // @handle, case-insensitive unique
  string display_name = 3;
  string bio = 4;              // max 160 (enforced in monolith)
  string avatar_media_id = 5;
  string avatar_url = 6;       // read-only download URL
  string cover_media_id = 7;
  string cover_url = 8;        // read-only download URL
  string website = 9;
  SnsLinks sns_links = 10;
  string prefecture = 11;      // location (guest 都道府県 / display)
  bool is_private = 12;        // 鍵アカウント
  string registered_at = 13;   // onboarding completion (empty if not)

  // cast extras (role = cast)
  int32 age = 14;
  int32 height_cm = 15;
  string cup_size = 16;
  string industry = 17;        // 業種 / service category (enum 値は §10 で確定)
  repeated Area areas = 18;    // 活動エリア (max 2)
  string shop_id = 19;         // 所属店舗 ref (shop domain は §10 で defer)
}

message SnsLinks {
  string x = 1;          // X (Twitter)
  string instagram = 2;
  string tiktok = 3;
  string bluesky = 4;
  string line = 5;
}

message Area {
  string id = 1;
  string region = 2;       // 地方
  string prefecture = 3;   // 都道府県
  string name = 4;         // エリアクラスタ (例: 池袋・赤羽・日暮里エリア)
  string code = 5;
}

message GetProfileRequest { string account_id = 1; }
message GetProfileByUsernameRequest { string username = 1; }
message GetProfileResponse { Profile profile = 1; }

message SaveProfileRequest {
  string username = 1;          // 変更時。空なら据え置き
  string display_name = 2;
  string bio = 3;
  string website = 4;
  SnsLinks sns_links = 5;
  string prefecture = 6;
  bool is_private = 7;
  // cast extras
  int32 age = 8;
  int32 height_cm = 9;
  string cup_size = 10;
  string industry = 11;
  repeated string area_ids = 12; // max 2
  string shop_id = 13;
}
message SaveProfileResponse { Profile profile = 1; }

message CheckUsernameAvailabilityRequest { string username = 1; }
message CheckUsernameAvailabilityResponse {
  bool available = 1;
  string message = 2;
}

message SaveProfileMediaRequest {
  string avatar_media_id = 1;
  string cover_media_id = 2;
}
message SaveProfileMediaResponse { Profile profile = 1; }

message ListAreasRequest { string prefecture = 1; } // optional filter
message ListAreasResponse { repeated Area areas = 1; }
```

- [ ] **Step 2: lint（buf）**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice && buf lint proto 2>&1 | head`
Expected: 新規 proto に致命的 lint エラーなし（既存 proto と同等の lint レベル。warning は許容）。

---

## Task 2: 両 stub を生成（additive）

**Files:** `services/monolith/workspace/stubs/profile/v1/*`、`services/frontend/workspace/src/stub/profile/v1/*`。

- [ ] **Step 1: monolith stub 生成**

Run: `cd services/monolith/workspace && ruby bin/codegen`
Expected: `✅ Done.`。`stubs/profile/v1/service_pb.rb` + `service_services_pb.rb` が生成され、`Profile::V1::ProfileService` / `Profile::V1::Profile` 等を含む。`stubs/portfolio/v1/*` は不変。

- [ ] **Step 2: frontend stub 生成**

Run: `cd services/frontend/workspace && pnpm proto:gen`
Expected: `src/stub/profile/v1/service_pb.ts` 生成。`src/stub/portfolio/v1/*` は不変（es plugin 版上げで他 stub に `| undefined` churn が出ても無害、commit する）。

---

## Task 3: build green を確認してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: monolith が壊れていないこと**

新 stub は未参照（ProfileService を実装する handler はまだ無い）。既存 portfolio/v1 も不変。
Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio 2>&1 | tail -5`
Expected: 既存と同じ結果（rename/実装はしていないので portfolio spec は不変・green。既存の pre-existing 失敗があればそのまま）。新 stub の構文は `ruby -c stubs/profile/v1/service_pb.rb` で OK。

- [ ] **Step 2: frontend build green**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功。profile/v1 stub は未参照だがコンパイルは通る。

- [ ] **Step 3: コミット**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice
git add proto/profile/v1 services/monolith/workspace/stubs/profile/v1 services/frontend/workspace/src/stub
git commit -s -m "feat(profile): add unified profile/v1 proto contract (additive)"
```

---

## Follow-up increments（本 P1 では実施しない）

- **P2**: monolith スライス rename `portfolio`→`profile`（module/dir/Deps/slice 名）。
- **P3**: テーブル統合 casts+guests→`profiles`（migration + relation + repo 再編、username LOWER unique 追加）。**最大リスク**。
- **P4**: drop（genres/cast_genres/blood_type/3sizes除cup/offer連動/default_schedules/tags）+ ProfileService の monolith 実装（handler/use_cases/presenters を新 proto に）+ portfolio/v1 撤去。
- **P5**: frontend module `portfolio`→`profile` + 統合 Profile 型 + 編集フォーム（rx-sns 準拠）。

## Self-Review（作成者チェック済）

- **Spec coverage（P1 範囲）**: 統合 Profile message（共通 + cast extras）・SnsLinks(X/IG/TikTok/Bluesky/LINE)・Area(region/prefecture/name/code)・ProfileService の RPC を spec §3/§Area/§API に沿って定義。drop（blood_type/3sizes除cup/genres/plans/schedules/tags）は proto に含めず。
- **Additive で build-green**: portfolio/v1 と既存 monolith 実装は不変。新 stub は未参照でコンパイルのみ。
- **Placeholder**: なし。industry の enum 値・shop ドメインは spec で §10 defer 済（proto は string ref のみ）。
- **命名整合**: package `profile.v1`、message `Profile`/`SnsLinks`/`Area`、RPC 名は spec の API contract と一致。
