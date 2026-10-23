# Dystopia Timed Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿に表示開始と表示終了を指定でき、表示期間外の投稿は本人以外にどこにも出ないようにする。投稿画面の「公開」を「全員」に変える。

**Architecture:** `post.posts` に `published_at`・`expires_at` を足す。一覧の問い合わせは SQL の段階で「表示中」に絞り、並びとカーソルを `published_at` にする。詳細などは `FilterVisiblePosts` に「本人以外は表示中だけ」を足す。保存で時刻を検証し、予約で作った投稿ではメンションを通知しない。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf protobuf、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-23-dystopia-timed-posts-design.md`

## Global Constraints

- 列: `published_at timestamptz NOT NULL DEFAULT now()`（migration で既存行に `created_at`）、`expires_at timestamptz NULL`、制約 `expires_at IS NULL OR expires_at > published_at`、索引 `(published_at DESC, id DESC)`
- 表示中: `published_at <= now()` かつ（`expires_at IS NULL` または `expires_at > now()`）
- 本人以外には表示中の投稿だけ。本人のタイムラインも表示中だけ。本人のプロフィールの一覧だけは、本人に予約中・表示終了も出す
- 並び: タイムライン（`list_post_ids`）とプロフィールの一覧（`list_posts`）は `published_at DESC, id DESC`、カーソルも `published_at`。ランキングの期間の絞り込みは `published_at`
- 保存: 新規の表示開始は空なら今、指定するなら今より後。表示終了は表示開始より後かつ今より後。編集で表示開始を変えられるのは予約中だけ。違反は INVALID_ARGUMENT
- 予約で作った投稿（作成時に `published_at > now`）はメンションを通知しない
- proto: `post.v1.Post.published_at = 13`、`post.v1.Post.expires_at = 14`（`created_at` と同じ文字列形式、なければ空）、`post.v1.SavePostRequest.published_at = 6`、`post.v1.SavePostRequest.expires_at = 7`（空は指定なし）
- 画面の文言（そのまま使う）: 投稿画面の切り替え「全員 / フォロワーのみ」（読み上げ名「フォロワーのみ」は今のまま）、「表示期間を指定」、「表示開始」、「表示終了」。カードの印: 本人の予約中「予約 M/D HH:mm から」、表示終了「表示終了」
- スタブは `bin/codegen` と `pnpm proto:gen` で再生成し、`post.v1` の差分だけを commit する（ほかは戻し、未追跡の billing は消す）
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` なし、末尾に空行と `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証: `HANAMI_ENV=test bundle exec hanami db migrate`（pg_dump の失敗は無視、structure.sql は commit しない）のあと `HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1`。frontend: `env -u NODE_OPTIONS pnpm exec vitest run <paths>` と `tsc --noEmit`
- shell: `cat` は bat なので `command cat`。grep は `/usr/bin/grep`

## Review Focus

1. 表示終了をちょうど過ぎた投稿: 次の読み込みで他人のタイムライン・詳細から消える（Task 1 の spec で時刻を進めて固定）
2. 予約投稿へのいいね・コメント・ブックマーク: 他人は開始前にできない（詳細が見つからない扱い。Task 1）
3. 表示開始で並べたときのページ送り: 開始時刻が同じ投稿が続いてもカーソルで重複・抜けがない（Task 1）
4. 編集で表示開始を空にした予約投稿: 今すぐ表示になる（Task 1、Task 2 の入力）
5. 投稿画面で表示期間を切り替えて閉じたとき: 保存する値に時刻が残らない（Task 2）

---

作業場所は worktree `.worktrees/feat-dystopia-followers-feed`、ブランチ `feat/dystopia-timed-posts`（gh stack の最上段、設計書の commit が乗っている）。

### Task 1: Backend

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261024000000_add_display_window_to_posts.rb`
- Modify: `proto/dystopia/post/v1/post_service.proto`、monolith の post スタブ
- Modify: `slices/post/`（relation、repository の `list_posts`・`list_post_ids`・検索・ハッシュタグ・ランキング、保存の handler / use case、presenter、メンションの通知）、`slices/social/use_cases/filter_visible_posts.rb`
- Modify/Create: 関係する spec

**Interfaces:**
- Produces: proto の 4 項目。presenter が `published_at`・`expires_at` を返す

- [ ] **Step 1: Specs first** — Spec の Testing の monolith の項目と Review Focus 1〜4。時刻は `Timecop` などがあればそれで、無ければ `published_at`・`expires_at` を直接過去・未来に入れて作る（`/usr/bin/grep -rn "Timecop\|travel_to" spec | head` で既存のやり方を確かめる）
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the post, social, feed, discovery, bookmarks specs and the whole suite, then commit** — `feat(dystopia): show posts only within their display window`

### Task 2: Frontend

**Files:**
- Modify: frontend の post スタブ、`src/modules/post/`（型、mapper、保存の payload、`components/PostComposer.tsx`）、`src/components/ui/post-card.tsx`（印と時刻）、投稿の BFF route（`/usr/bin/grep -rln "visibility" src/app/api/posts`）
- Modify: 関係するテスト（`PostComposer.test.tsx` などの「公開」の期待値も「全員」に）

**Interfaces:**
- Consumes: Task 1 の proto
- Produces: `PostView.publishedAt`・`PostView.expiresAt`

- [ ] **Step 1: Tests first**
  - 投稿画面: 切り替えの文言が「全員 / フォロワーのみ」。「表示期間を指定」を入れると「表示開始」「表示終了」の入力が出て、保存の payload に入る。切り替えを外すと payload に時刻が残らない（Review Focus 5）。予約中の投稿の編集では表示開始も、それ以外では表示終了だけを変えられる
  - カード: 本人の予約中に「予約 M/D HH:mm から」、表示終了に「表示終了」。他人には出ない（そもそも届かない）。「〇分前」は表示開始の時刻
  - mapper と BFF: `publishedAt`・`expiresAt` の受け渡し（日時の入力値は ISO 8601 に変換して送る）
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the full vitest and tsc, then commit** — `feat(dystopia): schedule a post's display window and call public posts everyone`

### Task 3: End-to-end check and the PR

- [ ] **Step 1: Run the suites**
- [ ] **Step 2: Check it in the running app**（memory の `reference_local_e2e_run.md`、使い捨て DB）
  1. 予約で投稿すると、本人のプロフィールに「予約 … から」で出て、他人のタイムライン・プロフィール・詳細には出ない
  2. 表示終了が過去の投稿（DB で `expires_at` を過去にする）は、他人から消え、本人のプロフィールに「表示終了」で残る
  3. 投稿画面の切り替えが「全員 / フォロワーのみ」
  起動したプロセスは最後に止め、DB を消し、ポートが空いたことを確かめる
- [ ] **Step 3: Push and open the PR** — `git push -u origin HEAD`、`gh pr create --draft --base feat/dystopia-follow-approval --title "feat(dystopia): show posts only within their display window" --body-file <scratchpad>/pr.md`、`gh stack submit --auto`。本文: Closes #1585、Why、What、Verification、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL
