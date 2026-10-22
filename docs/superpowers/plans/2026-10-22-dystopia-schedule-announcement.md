# Dystopia Schedule Announcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予定を入れるときに「投稿でお知らせする」を選べ、日ごとにひとことと出勤カードの予約投稿ができ、予定の変更・削除に追従する。

**Architecture:** `schedule.schedules.post_id` で予定と投稿をつなぐ。`SaveSchedule`・`DeleteSchedule` が post slice の `PostRepository` で投稿を作る・書き換える・消す。投稿を返すときは投稿 ID の一覧で予定をまとめて引き、`Post.schedule`（`schedule.v1.Schedule`）に入れる。画面は予定のシートに入力を足し、投稿カードに出勤のカードを出す。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf protobuf、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-22-dystopia-schedule-announcement-design.md`

## Global Constraints

- 列: `schedule.schedules.post_id uuid NULL`、部分索引 `WHERE post_id IS NOT NULL`。他の slice の表への FK は張らない
- proto: `post.v1.Post` に `schedule.v1.Schedule schedule = 15;`（`post_service.proto` で `schedule/v1` の proto を import。つながった予定がなければ未設定）。post.v1 に予定の型を新しく定義しない。`profile.v1.ProfileSummary` に `string industry = 7;`。`schedule.v1.SaveScheduleRequest` に `bool announce = 4; string announce_time = 5; string announce_note = 6;`
- 時刻はすべて日本時間（Asia/Tokyo）で解釈する。出勤の終了は、終了時刻が開始時刻以下なら翌日
- 投稿: 本文はひとこと（空でもよい）、表示開始はお知らせ時刻（過ぎていれば今）、表示終了は出勤の終了、公開範囲 `public`
- 保存の表（spec の Saving a schedule）: オン×なし→作る、オン×あり→本文と表示終了を書き換え（表示開始は予約中だけ）、オフ×あり→消して `post_id` を空に、オフ×なし→何もしない。出勤の終了を過ぎた日には新しく作らない。本人が消した投稿は「なし」として扱う
- 検証の文言（そのまま）: 「お知らせの時刻は出勤の終了より前にしてください」「ひとことは200文字以内で入力してください」（INVALID_ARGUMENT）。`announce` がオフなら時刻とひとことは検証しない
- 画面の文言（そのまま）: 「投稿でお知らせする」（初期値オン）、「お知らせする時刻」（初期値 09:00）、「ひとこと」、予定を消すときの「お知らせの投稿も消えます」、カードの小見出し「出勤」、カードの時間「🚗 10/24（金） 20:00〜02:00」の形（先頭は作者の業種アイコン。`src/modules/profile/lib/constants.ts` の `industryIcon`、読み上げ名は業種名。業種が未設定・一覧にないときはアイコンなし）、プレビューの 1 行「出勤 10/24（金）20:00〜02:00」
- スタブは `bin/codegen` と `pnpm proto:gen` で再生成し、`post.v1`・`schedule.v1`・`profile.v1` の差分だけを commit する（ほかは戻し、未追跡の billing は消す）
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` なし、末尾に空行と `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証: `HANAMI_ENV=test bundle exec hanami db migrate`（pg_dump の失敗は無視、structure.sql は commit しない）のあと `HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1`。frontend: `env -u NODE_OPTIONS pnpm exec vitest run <paths>` と `tsc --noEmit`
- shell: `cat` は bat なので `command cat`。grep は `/usr/bin/grep`、ls は `/bin/ls`、find は `/usr/bin/find`

## Review Focus

1. 一括で 14 日分を入れ直したとき: 日ごとに投稿が 1 件のまま（重複して作らない）。2 回目の保存は書き換えになる（Task 1）
2. 本人がお知らせ投稿を消したあと、同じ日を保存し直す: `post_id` が指す投稿がないので作り直し、例外にならない（Task 1）
3. 終了が日をまたぐ予定（20:00〜02:00）を、当日 01:00 に保存し直す: 出勤の終了はまだ先（翌日 02:00）なので書き換えになる。前日の予定の扱いを取り違えない（Task 1）
4. タイムラインの 1 ページにお知らせ投稿が複数あっても、予定の問い合わせは 1 回（Task 2）
5. ひとことが空のお知らせ投稿: カードだけが出て、本文の空の段や「…」が出ない。返信のプレビューは出勤の 1 行（Task 3）

---

作業場所は worktree `.worktrees/feat-dystopia-followers-feed`、ブランチ `feat/dystopia-shift-announcement`（gh stack の最上段、設計書の commit が乗っている）。

### Task 1: Schedule announcements (backend)

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261025000000_add_post_id_to_schedules.rb`
- Create: `dystopia/monolith/slices/schedule/use_cases/announcement_window.rb`（お知らせ時刻・出勤の終了の計算）
- Modify: `proto/dystopia/schedule/v1/*.proto`、monolith の schedule スタブ
- Modify: `slices/schedule/relations/schedule_records.rb`、`repositories/schedule_repository.rb`（`upsert` が `post_id` を返す、`set_post_id(id:, post_id:)`、`find_by_post_ids(post_ids:)`）、`use_cases/save_schedule.rb`、`use_cases/delete_schedule.rb`、`grpc/schedule_handler.rb`
- Modify/Create: `spec/slices/schedule/` の該当 spec

**Interfaces:**
- Produces: `Schedule::Slice["repositories.schedule_repository"].find_by_post_ids(post_ids:)` → `{ "<post_id>" => { work_date: "YYYY-MM-DD", start_time: "HH:MM", end_time: "HH:MM" } }`（Task 2 が使う）。`SaveScheduleRequest.announce / announce_time / announce_note`（Task 3 が送る）
- Consumes: `Post::Slice["repositories.post_repository"]` の `create_post(author_profile_id:, content:, visibility:, published_at:, expires_at:)`・`update_post(id, attrs)`・`delete_post(id)`・`find_by_id(id)`（既存。シグネチャは実コードで確かめる）

- [ ] **Step 1: Specs first**（`save_schedule_spec.rb`・`delete_schedule_spec.rb`・`schedule_repository_spec.rb`・`schedule_handler_spec.rb`。時刻は `Time` を固定できる既存のやり方を `/usr/bin/grep -rn "Timecop\|travel_to\|allow(Time)" spec | head` で確かめ、無ければ `now:` を use case に注入できるようにする）
  - オンで保存すると投稿ができ、本文＝ひとこと、`published_at`＝出勤日のお知らせ時刻（JST）、`expires_at`＝出勤の終了、`visibility`＝public、`post_id` が入る
  - 20:00〜02:00 の `expires_at` が翌日 02:00（JST）
  - お知らせ時刻を過ぎていれば `published_at` が今。出勤の終了を過ぎた日には作らない
  - 2 回目の保存（時間を変える）は同じ投稿の `expires_at` と本文を書き換え、投稿は 1 件のまま（Review Focus 1）。表示中の投稿の `published_at` は変わらない。予約中なら新しいお知らせ時刻になる
  - 当日 01:00 に前日 20:00〜02:00 の予定を保存し直すと書き換えになる（Review Focus 3）
  - オフで保存すると投稿が消え、`post_id` が空になる。オフ×なしでは何も起きない
  - 本人が投稿を消したあとオンで保存すると作り直す（Review Focus 2）
  - `DeleteSchedule` でつながった投稿が消える
  - お知らせ時刻が出勤の終了以降、ひとことが 201 文字で、それぞれの文言の INVALID_ARGUMENT（handler spec）。オフなら検証しない
  - `find_by_post_ids` がつながった予定だけを返す
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement** — migration（`alter_table :schedule__schedules { add_column :post_id, :uuid }` と `add_index :post_id, where: Sequel.~(post_id: nil)`。down は列を消す）、proto とスタブ、repository、`AnnouncementWindow`（入力: work_date, start_time, end_time, announce_time, now → `published_at`・`expires_at`・`ended?`）、`SaveSchedule` に `announce:, announce_time:, announce_note:` を足して上の表どおりに投稿を扱う、`DeleteSchedule`、handler の受け渡し
- [ ] **Step 4: Run the schedule and post specs and the whole suite, then commit** — `feat(dystopia): announce a schedule with a scheduled post`

### Task 2: Schedule on posts (backend)

**Files:**
- Modify: `proto/dystopia/post/v1/post_service.proto`、`proto/dystopia/profile/v1/` の `ProfileSummary`、monolith の post・profile スタブ
- Modify: `slices/profile/use_cases/summarize_profiles.rb` と `slices/profile/presenters/profile_summary_presenter.rb`（`industry` を読んで詰める）
- Create: `dystopia/monolith/slices/post/adapters/schedule_adapter.rb`（`Post::Adapters::*` の既存の形に合わせる。読み取りだけ）
- Modify: `slices/post/presenters/post_presenter.rb`（`schedules:` を受け取り `schedule` を入れる。`author` に `ProfileSummaryPresenter` を使うのと同じく、schedule の proto を組み立てる）、`slices/post/use_cases/posts/list_posts_by_ids.rb`、`slices/post/grpc/post_handler.rb`（`present_posts`・`present_post`）
- Modify/Create: 該当 spec

**Interfaces:**
- Consumes: Task 1 の `find_by_post_ids(post_ids:)`
- Produces: `post.v1.Post.schedule`（`schedule.v1.Schedule`）、`profile.v1.ProfileSummary.industry`

- [ ] **Step 1: Specs first**
  - お知らせ投稿を `ListPostsByIds`・`ListPosts`（handler）・`GetPost` で返すと `schedule` に出勤日・開始・終了が入る。ほかの投稿は `schedule` が未設定（`has_schedule?` が false）
  - 予定の時間を変えると、次に読んだ `schedule` が新しい時間
  - 投稿の `author.industry` に作者の業種が入る（`summarize_profiles` の spec と、投稿の一覧の spec）
  - 1 ページに複数のお知らせ投稿があっても、予定の問い合わせは 1 回（Review Focus 4。adapter / repository の呼び出し回数を spy で数える）
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the post, feed, discovery, bookmarks, schedule specs and the whole suite, then commit** — `feat(dystopia): attach the schedule to announcement posts`

### Task 3: Frontend

**Files:**
- Modify: frontend の `post.v1`・`schedule.v1`・`profile.v1` スタブ、`src/modules/profile/types.ts` の `ProfileSummaryView` と `lib/mappers.ts` の `summaryToView`（`industry`）
- Modify: `src/modules/schedule/hooks/useSaveSchedule.ts`、`src/app/api/schedule/save/route.ts`、`src/modules/schedule/components/ScheduleBulkSheet.tsx`
- Modify: `src/modules/post/lib/post-view.ts`（`schedule: { workDate: string; startTime: string; endTime: string } | null`）、`post-mappers.ts`、`src/modules/post/components/PostCardBinding.tsx`（出勤のカード）、`ReplyWithParentRow.tsx`（本文が空なら出勤の 1 行）、投稿詳細でカードが出る場所（`/usr/bin/grep -rln "PostCardBinding\|PostDetail" src/modules/post/components`）
- Create: 出勤のカードの部品（`src/modules/post/components/PostScheduleCard.tsx`）。枠は `ReviewCard.tsx` のカード（`rounded-xl border border-border bg-surface p-3`）に合わせる。日付の形は `src/modules/schedule/lib/dates.ts` の既存関数を探して使う
- Modify: 関係するテスト

**Interfaces:**
- Consumes: Task 1 の `SaveScheduleRequest` の 3 項目、Task 2 の `Post.schedule` と `ProfileSummary.industry`
- Produces: `PostView.schedule`

- [ ] **Step 1: Tests first**
  - シート: 「予定を入れる」で「投稿でお知らせする」（初期値オン）・「お知らせする時刻」（初期値 09:00）・「ひとこと」が出て、反映すると各日の保存に `announce: true, announceTime: "09:00", announceNote: <入力>` が入る。オフにすると `announce: false`。「予定を消す」で「お知らせの投稿も消えます」が出る
  - BFF の保存 route が 3 項目を request に渡す
  - mapper: `schedule` があれば `{ workDate, startTime, endTime }`、なければ `null`
  - 投稿カード: `schedule` があるとき小見出し「出勤」と「10/24（金） 20:00〜02:00」のカードが出て、`/u/<username>` へのリンク。日付の前に作者の業種アイコン（読み上げ名＝業種名）。業種が空・一覧にないときはアイコンなし。本文が空ならひとことの段を出さない（Review Focus 5）。`schedule` がなければ出ない
  - 返信の親投稿のプレビュー: 本文が空で `schedule` があれば「出勤 10/24（金）20:00〜02:00」
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the full vitest and tsc, then commit** — `feat(dystopia): announce schedules from the schedule sheet and show them on posts`

### Task 4: End-to-end check and the PR

- [ ] **Step 1: Run the suites** — monolith の全 rspec、frontend の全 vitest と tsc
- [ ] **Step 2: Check it in the running app**（memory の `reference_local_e2e_run.md`、使い捨て DB）
  1. キャストで「予定をまとめて編集」から明日の予定をお知らせありで入れると、本人のプロフィールに「予約」で出勤カード付きの投稿が出る。他人には出ない
  2. 今日の予定（お知らせ時刻が過去）を入れると、フォロワーのタイムラインに出勤カード付きで出る
  3. 時間を変えるとカードの時間が変わり、投稿は 1 件のまま。予定を消すと投稿も消える
  起動したプロセスは最後に止め、DB を消し、ポートが空いたことを確かめる
- [ ] **Step 3: Push and open the PR** — `git push -u origin HEAD`、`gh pr create --draft --base feat/dystopia-timed-posts --title "feat(dystopia): announce schedules with scheduled posts" --body-file <scratchpad>/pr.md`、`gh stack submit --auto`。本文: Closes #1511、Why、What、Verification、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL
