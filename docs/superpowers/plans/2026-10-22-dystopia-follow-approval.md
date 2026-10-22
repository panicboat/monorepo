# Dystopia Follow Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 鍵とは別に「フォローを承認制にする」を選べるようにする。

**Architecture:** `profile.profiles.follow_approval_required` を足し、フォローを申請にするかをこれだけで決める。承認制を外して保存したら、残っている申請を全部承認する。フォロー状態の応答に相手が承認制かを足し、画面は「フォローを申請」と出す。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf protobuf、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-22-dystopia-follow-approval-design.md`

## Global Constraints

- 列は `follow_approval_required boolean NOT NULL DEFAULT false`。migration で `is_private = true` の行を `true` にする
- proto: `profile.v1.Profile.follow_approval_required = 22`、`profile.v1.SaveProfileRequest.follow_approval_required = 12`、`social.v1.GetFollowStatusResponse.approval_required = 2`（`map<string, bool>`）
- フォローは `follow_approval_required` が true なら `pending`、false なら `approved`。鍵（`is_private`）は見ない
- 承認制を true から false に変えて保存したら、そのプロフィールへの申請を `ApproveFollowRequest` で 1 件ずつ承認する（申請者への `follow_approved` 通知も今の承認と同じ）
- 画面の文言（そのまま使う）: 編集画面「フォローを承認制にする」、説明「フォローされる前に、あなたが承認します」。ボタン: 未フォローで承認制「フォローを申請」、未フォローで承認制でない「フォロー」、申請中「申請中」、フォロー中「フォロー中」
- スタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、`profile.v1`・`social.v1` の差分だけを commit する。ほかは `git checkout` で戻し、未追跡の billing のスタブは消す
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` は付けない、末尾に空行と `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`（pg_dump の失敗は無視、structure.sql は commit しない）のあと `HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
- frontend の検証: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run <paths>` と `env -u NODE_OPTIONS pnpm exec tsc --noEmit`
- shell: `cat` は bat なので `command cat`。grep は `/usr/bin/grep`

## Review Focus

1. 鍵だけ外して承認制は残したとき: 申請は承認されず残る（Task 1 の spec で固定）
2. 承認制を外すときに鍵も同時に外す保存: 申請は 1 回だけ承認され、通知も 1 回（Task 1 の spec で固定）
3. 既存の鍵付きプロフィール: migration のあとフォローが申請のまま（Task 1 の spec で固定）
4. 自分のプロフィールの編集で、ほかの項目だけ変えて保存しても承認制が勝手に変わらない（Task 2 の test で固定）
5. 申請中にした相手が承認制を外したあと、自分のボタンが「フォロー中」になる（Task 1 で承認、Task 2 で表示）

---

作業場所は worktree `.worktrees/feat-dystopia-followers-feed`、ブランチ `feat/dystopia-follow-approval`（gh stack の最上段、設計書の commit が乗っている）。

### Task 1: Backend

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261023000000_add_follow_approval_required_to_profiles.rb`
- Modify: `proto/dystopia/profile/v1/service.proto`、`proto/dystopia/social/v1/follow_service.proto`、monolith のスタブ
- Modify: `slices/profile/` の relation・repository・`use_cases/save_profile.rb`・presenter と handler の save の受け渡し
- Create: `slices/social/use_cases/follows/approve_all_follow_requests.rb`
- Modify: `slices/social/use_cases/follows/follow.rb`、`get_follow_status.rb`、`grpc/follow_handler.rb`
- Modify/Create: 関係する spec（`/usr/bin/grep -rln "is_private" spec/slices/social spec/slices/profile` で探す）

**Interfaces:**
- Produces: proto の 3 項目、`Social::Slice["use_cases.follows.approve_all_follow_requests"].call(target_profile_id:)`

- [ ] **Step 1: Specs first**
  - follow: 4 通り（鍵×承認制）で `follow` の結果が `pending` / `approved` になる
  - save_profile: 承認制を true → false にすると申請がすべて `approved` になり、申請者ごとに `follow_approved` の通知が 1 件できる。鍵だけ外して承認制は true のままなら申請は残る（Review Focus 1）。鍵と承認制を同時に外すと 1 回だけ承認・通知（Review Focus 2）
  - migration: 鍵付きのプロフィールの `follow_approval_required` が true になる（migration の spec の書き方は `spec/config/db/` の既存 spec に合わせる。無ければ migration 後の行を確かめる spec を profile の repository spec に足す）（Review Focus 3）
  - presenter / handler: `Profile.follow_approval_required` を返し、`SaveProfile` で受け取る
  - `GetFollowStatus`: `approval_required` を対象ごとに返す
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement** — migration（`alter_table` で列を足し、`UPDATE profile.profiles SET follow_approval_required = true WHERE is_private`。down は列を消す）、proto とスタブ、profile と social の変更
- [ ] **Step 4: Run the slice specs and the whole suite, then commit** — `feat(dystopia): choose follow approval apart from the profile lock`

### Task 2: Frontend

**Files:**
- Modify: frontend の `profile` と `social` のスタブ
- Modify: `src/modules/profile/types.ts`・`lib/mappers.ts`（`profileViewToSavePayload` を含む）・`components/EditProfileSheet.tsx`、保存の BFF route（`/usr/bin/grep -rn "isPrivate" src/app/api/profile`）
- Modify: `src/modules/social/hooks/useFollow.ts`（`approvalRequired` を返す）、follow status の BFF route、`components/FollowButton.tsx`、`src/modules/profile/components/ProfileActions.tsx`
- Modify: 関係するテスト

**Interfaces:**
- Consumes: Task 1 の proto
- Produces: `ProfileView.followApprovalRequired`、`useFollow(...).approvalRequired`

- [ ] **Step 1: Tests first**
  - `EditProfileSheet.test.tsx`: 「フォローを承認制にする」を切り替えて保存すると payload の `followApprovalRequired` が変わる。ほかの項目だけ変えた保存では今の値のまま（Review Focus 4）
  - mapper: `followApprovalRequired` の変換と保存の payload
  - `FollowButton` と `ProfileActions`: 未フォロー・承認制「フォローを申請」、未フォロー・承認制でない「フォロー」、申請中「申請中」、フォロー中「フォロー中」
  - `useFollow`: status の応答から `approvalRequired` を返す
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement** — 編集画面の鍵の下に切り替え（`Toggle`、aria-label「フォローを承認制にする」）と説明。ボタンの文言
- [ ] **Step 4: Run the full vitest and tsc, then commit** — `feat(dystopia): let profiles turn follow approval on and off`

### Task 3: End-to-end check and the PR

- [ ] **Step 1: Run the suites** — monolith の全 rspec、frontend の全 vitest と tsc
- [ ] **Step 2: Check it in the running app**（memory の `reference_local_e2e_run.md`、使い捨て DB）
  1. 鍵なしのプロフィールで承認制を入れて保存し、別の人の画面でボタンが「フォローを申請」になり、押すと「申請中」、投稿は見られる
  2. 承認制を外して保存すると申請が承認され、相手のボタンが「フォロー中」になり、フォロワーに入る
  3. 鍵付き・承認制なしのプロフィールにフォローすると、すぐフォローになって投稿が見られる
  起動したプロセスは最後に止め、DB を消し、ポートが空いたことを確かめる
- [ ] **Step 3: Push and open the PR** — `git push -u origin HEAD`、`gh pr create --draft --base feat/dystopia-media-size --title "feat(dystopia): choose follow approval apart from the profile lock" --body-file <scratchpad>/pr.md`、`gh stack submit --auto`。本文: Closes #1581、Why、What、Verification、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL
