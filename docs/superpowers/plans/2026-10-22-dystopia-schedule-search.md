# Dystopia Schedule Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索画面の「出勤」タブで、出勤日・都道府県・開始時間帯・フォロー中だけ・名前から、その日に出勤するキャストを探せるようにする。

**Architecture:** discovery に `SearchSchedules` を足す。use case が profile（表示可能なキャストを都道府県・名前で絞った ID と都道府県）と social（フォロー中・ブロック）から対象を集め、schedule の repository で出勤日・時間帯・並び・カーソルで予定を引き、作者の要約とお知らせ投稿の本文（見る人に見えるものだけ）を添える。画面は検索のタブに絞り込みとカードの一覧を足す。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf protobuf、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-22-dystopia-schedule-search-design.md`

## Global Constraints

- 名前: 識別子・URL・RPC は schedule（`schedules`）。`shift` は使わない
- proto（`discovery.v1`）: `rpc SearchSchedules`、`SearchSchedulesRequest { string work_date = 1; string prefecture = 2; string time_band = 3; bool following_only = 4; string query = 5; int32 limit = 6; string cursor = 7; }`、`ScheduleSearchResult { schedule.v1.Schedule schedule = 1; profile.v1.ProfileSummary profile = 2; string prefecture = 3; string note = 4; }`、`SearchSchedulesResponse { repeated ScheduleSearchResult results = 1; string next_cursor = 2; bool has_more = 3; }`
- `time_band`: `""`（すべて）、`"day"` 05:00〜17:59、`"evening"` 18:00〜20:59、`"night"` 21:00〜翌 04:59（開始時刻で判定）。それ以外と不正な `work_date` は INVALID_ARGUMENT
- 並び: 開始が 05:00 より前のものを 23:59 の後ろに置いた開始時刻順、同じならプロフィール ID 順。20 件ずつ、カーソルで続き
- 出す相手: 表示可能なキャスト（停止中・無効化を除く、`identity.accounts.role = 2`）。鍵付きも出す。両方向のブロックを除く。フォロー中だけなら承認済みのフォロー中に限る。名前は display_name・username の部分一致（大文字小文字を区別しない）
- `note`: その予定の `post_id` の投稿を、見る人に見える（`FilterVisiblePosts` を通る）ときだけ本文。なければ空
- 画面の文言（そのまま）: タブ「出勤」、絞り込みの見出し「出勤日」「エリア」「開始時間帯」、時間帯「すべて」「昼（〜17時）」「夜（18〜20時）」「深夜（21時〜）」、切り替え「フォロー中だけを見る」、エリアの全体「全国」、日付チップの今日・明日は「今日」「明日」、見出し「10/22（木）の出勤予定」の形、終了が開始以下なら「翌日」、注記「キャストが公開した出勤予定です。予約の空きや受付可否を保証するものではありません。」、空「この日の出勤予定はまだありません」、ボタン「プロフィール →」
- スタブは `bin/codegen` と `pnpm proto:gen` で再生成し、`discovery.v1` の差分だけを commit する（ほかは戻し、未追跡の billing は消す）
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` なし、末尾に空行と `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証: `HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1`。frontend: `env -u NODE_OPTIONS pnpm exec vitest run <paths>` と `env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false`（終了コードはパイプせずに取る）
- shell: `cat` は bat なので `command cat`。grep は `/usr/bin/grep`、ls は `/bin/ls`、find は `/usr/bin/find`

## Review Focus

1. 深夜帯の並びとページ送り: 22:00・23:30・00:30・04:00 の開始が 1 ページの境目をまたいでも、この順で重複・抜けなく続く（Task 1）
2. 時間帯の境目: 04:59 は深夜、05:00 は昼、17:59 は昼、18:00 は夜、20:59 は夜、21:00 は深夜（Task 1）
3. 鍵付きキャストのお知らせ投稿がフォロワーのみ、または予約中: カードは出るがひとことは空（本文を漏らさない）（Task 1）
4. 検索ボックスに文字を入れたまま出勤タブに切り替える、または絞り込みを変える: 古い結果と新しい結果が混ざらず、1 ページ目から読み直す（Task 2）
5. 日付チップの「今日」: 端末の時間帯が日本以外でも日本時間の今日から 14 日分（Task 2）

---

作業場所は worktree `.worktrees/feat-dystopia-followers-feed`、ブランチ `feat/dystopia-schedule-search`（gh stack の最上段、設計書の commit が乗っている）。

### Task 1: SearchSchedules (backend)

**Files:**
- Modify: `proto/dystopia/discovery/v1/*.proto`（`schedule/v1` と `profile/v1` を import）、monolith の discovery スタブ
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`（`visible_cast_prefectures(prefecture: nil, query: nil)` → `{ "<profile_id>" => "<prefecture>" }`。`visible_profiles` と既存の `filter_by_role` の副問い合わせを使う）
- Modify: `dystopia/monolith/slices/schedule/repositories/schedule_repository.rb`（`search(work_date:, time_band:, profile_ids:, limit:, cursor:)` → 行の配列。並びとカーソルは Global Constraints のとおり。`start_time` の列の型を確かめて比較を書く）
- Create: `dystopia/monolith/slices/discovery/use_cases/search_schedules.rb`（`SuggestUsers`・`SearchPosts` と同じく他 slice の repository / use case を `Slice[...]` で使う）
- Modify: `dystopia/monolith/slices/discovery/grpc/discovery_handler.rb`（`search_schedules`、認証と INVALID_ARGUMENT の扱いは既存の RPC に合わせる）
- Create/Modify: 該当 spec（profile repository、schedule repository、discovery use case、discovery handler）

**Interfaces:**
- Consumes: `Social::Slice["repositories.follow_repository"].following_profile_ids(profile_id:)`、`Social::Slice["repositories.block_repository"].bidirectionally_blocked_profile_ids(profile_id:)`、`Profile::Slice["use_cases.summarize_profiles"]`（業種を含む）、`Post::Slice["repositories.post_repository"].find_by_ids(ids:)` と `Social::Slice["use_cases.filter_visible_posts"].call(viewer_profile_id:, posts:)`、`Profile::Presenters::ProfileSummaryPresenter`。シグネチャは実コードで確かめる
- Produces: `discovery.v1.SearchSchedules`（Task 2 が呼ぶ）

- [ ] **Step 1: Specs first**
  - profile repository: キャストだけ・停止中と無効化を除く・都道府県・名前（display_name / username、大文字小文字を区別しない）で絞り、都道府県を返す
  - schedule repository: 出勤日と ID で絞る。時間帯の境目（Review Focus 2）。並びと、2 件ずつのページ送りで 22:00 → 23:30 → 00:30 → 04:00 が重複・抜けなく続く（Review Focus 1）。同じ開始時刻はプロフィール ID 順
  - use case / handler: 鍵付きキャストは出る。両方向のブロック相手は出ない。フォロー中だけで承認済みのフォロー中に限る（申請中は出ない）。ゲストの予定は出ない
  - ひとこと: 表示中で見えるお知らせは本文が入る。予約中・表示終了・フォロワーのみ（見る人が承認済みフォロワーでない）は空（Review Focus 3）。お知らせのない予定も空
  - 1 ページのお知らせ投稿の本文は 1 回の問い合わせで引く（呼び出し回数を数える）
  - 不正な `work_date`（`2026-13-45` を含む）と `time_band` は INVALID_ARGUMENT
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the discovery, schedule, profile specs and the whole suite, then commit** — `feat(dystopia): search schedules by date, area and start time`

### Task 2: Frontend

**Files:**
- Modify: frontend の `discovery.v1` スタブ
- Create: `dystopia/frontend/src/app/api/discovery/schedules/route.ts`（既存の `src/app/api/discovery/users/route.ts` に合わせる。クエリ `date`・`prefecture`・`timeBand`・`followingOnly`・`q`・`cursor`）
- Create: `dystopia/frontend/src/modules/discovery/hooks/useSearchSchedules.ts`（既存の `useSearchUsers.ts` のページ送りに合わせる。絞り込みが変わったら 1 ページ目から読み直す）と `types.ts` の型
- Create: `dystopia/frontend/src/modules/schedule/components/ScheduleSearchPanel.tsx`（絞り込み＋一覧）と `ScheduleSearchCard.tsx`（カード）
- Modify: `dystopia/frontend/src/app/search/page.tsx`（「出勤」タブ、id `schedules`。`?tab=schedules` で開く。検索ボックスの文字を名前の絞り込みに渡す。出勤タブでは文字が空でも一覧を出す）
- Modify: 関係するテスト

**Interfaces:**
- Consumes: Task 1 の `SearchSchedules`
- Produces: 画面のみ

- [ ] **Step 1: Tests first**
  - 出勤タブの初期値: 出勤日は日本時間の今日（Review Focus 5。`todayInJapan` を使い、端末の時間帯をずらしたテスト）、14 個のチップの先頭 2 つが「今日」「明日」、エリア「全国」、開始時間帯「すべて」、「フォロー中だけを見る」オフ
  - 絞り込みを変えると BFF に `date`・`prefecture`・`timeBand`・`followingOnly`・`q` が渡り、1 ページ目から読み直す（Review Focus 4）
  - `?tab=schedules` で出勤タブが開く。検索ボックスの文字が `q` に入る。文字が空でも一覧を出す
  - カード: 名前・@username・業種アイコン（読み上げ名＝業種名、空・一覧外は出さない）・都道府県・「開始〜終了」と終了が開始以下なら「翌日」・ひとこと（あるときだけ）・自分にはフォローボタンを出さない・「プロフィール →」が `/u/<username>`
  - 見出し「10/22（木）の出勤予定」、注記、結果がないときの「この日の出勤予定はまだありません」
  - BFF route: 不正な値をそのまま渡し、サーバーの INVALID_ARGUMENT を 400 で返す
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**（日付チップの表示は `src/modules/schedule/lib/dates.ts` の既存関数、カードの枠と業種アイコンは `PostScheduleCard.tsx` と同じ扱い、フォローは `src/modules/social/components/FollowButton.tsx`、都道府県は `src/modules/profile/lib/constants.ts` の `PREFECTURES`）
- [ ] **Step 4: Run the full vitest and tsc, then commit** — `feat(dystopia): add a schedules tab to search`

### Task 3: End-to-end check and the PR

- [ ] **Step 1: Run the suites** — monolith の全 rspec、frontend の全 vitest と `tsc --noEmit --incremental false`
- [ ] **Step 2: Check it in the running app**（memory の `reference_local_e2e_run.md`、使い捨て DB）
  1. 2 人のキャストに今日の予定（20:00〜02:00 と 23:30〜04:00）を入れ、片方はお知らせありにする。ゲストで `/search?tab=schedules` を開くと 2 人が開始時刻順に出て、お知らせのひとことがカードに出る
  2. 時間帯「夜」で 20:00 の人だけ、「深夜」で 23:30 の人だけ。都道府県とフォロー中だけで出たり消えたりする。検索ボックスに名前を入れると絞れる
  3. キャストにブロックされたゲストには、そのキャストが出ない
  起動したプロセスは最後に止め、DB を消し、ポートが空いたことを確かめる
- [ ] **Step 3: Push and open the PR** — `git push -u origin HEAD`、`gh pr create --draft --base feat/dystopia-shift-announcement --title "feat(dystopia): search schedules from the search screen" --body-file <scratchpad>/pr.md`、`gh stack submit --auto`。本文: Closes #1549、Why、What、Verification、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL
