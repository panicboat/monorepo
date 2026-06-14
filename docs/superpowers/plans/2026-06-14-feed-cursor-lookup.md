# Feed cursor lightweight lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `Feed::UseCases::ListFeed` で next_cursor 計算用に呼ばれる `post_repo.find_by_id(truncated.last)` を **軽量 lookup** `post_repo.created_at_for_id(id)` に置換する。F3 (#663) の `# TODO:` を解消、不要な `post_media + hashtags` の eager-load (combine) を撤去。

**Architecture:** **Surgical**。`post_repository.rb` に 1 method 追加 + `list_feed.rb` の 1 行差し替え + TODO コメント削除。動作変更ゼロ (next_cursor の組み立て式は同じ、`created_at.iso8601` 取得ルートだけ変わる)。

**Tech Stack:** Ruby / Hanami 2 / ROM / Sequel。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-feed-cursor-lookup`
- branch: `refactor/feed-cursor-lookup` (origin/main = `bc3ed635` base)
- 検証: `bundle exec rspec spec/slices/post` (baseline 67/0 維持) + `bundle exec rspec spec/slices/feed` (baseline 16/12 維持) + container smoke で実 DB から next_cursor 取得確認
- 触らない: `find_by_id` 本体 (他から widely 使われている)、`list_public_post_ids`、handler、他 use_case、他 slice、frontend

## File Structure

- Modify: `services/monolith/workspace/slices/post/repositories/post_repository.rb` (1 method 追加)
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_feed.rb` (1 行差し替え + TODO 削除)

---

## Task 1: post_repo に `created_at_for_id` を追加

**Files:** Modify `services/monolith/workspace/slices/post/repositories/post_repository.rb`。

- [ ] **Step 1: 既存 `find_by_id` の場所を確認 (推定 L88)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-feed-cursor-lookup/services/monolith/workspace
/usr/bin/grep -n "def find_by_id\b\|def find_by_ids\|def list_public_post_ids" slices/post/repositories/post_repository.rb
```

- [ ] **Step 2: `find_by_id` の直下に追加**

```ruby
      # Lightweight lookup for cursor pagination: returns just the created_at
      # for an id without eager-loading post_media / hashtags. Used by feed
      # slice cursor encoding (see Feed::UseCases::ListFeed).
      def created_at_for_id(id)
        posts.dataset.where(id: id).get(:created_at)
      end
```

`posts.dataset.where(...).get(:column)` は Sequel Dataset の単一列・単一行 fetch (`SELECT created_at FROM posts WHERE id = ? LIMIT 1` 相当)。存在しない id は `nil` 返り。

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/post/repositories/post_repository.rb
```

---

## Task 2: `list_feed.rb` で find_by_id を置換 + TODO 削除

**Files:** Modify `services/monolith/workspace/slices/feed/use_cases/list_feed.rb`。

- [ ] **Step 1: 該当箇所を Read で確認 (推定 L52-62 周辺、`# TODO:` + `find_by_id` 呼び出し)**

- [ ] **Step 2: TODO コメント + `find_by_id` 呼び出しを軽量版に置換**

現状:

```ruby
          # TODO: find_by_id eagerly loads post_media + hashtags via combine,
          # which is wasted work — we only need created_at for cursor. Consider
          # adding post_repo.created_at_for_id(id) or returning tuples from
          # list_public_post_ids to drop this overhead.
          last_post = post_repo.find_by_id(truncated.last)
          last_post ? encode_cursor(created_at: last_post.created_at.iso8601, id: last_post.id) : nil
```

を以下に変更:

```ruby
          last_created_at = post_repo.created_at_for_id(truncated.last)
          last_created_at ? encode_cursor(created_at: last_created_at.iso8601, id: truncated.last) : nil
```

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/feed/use_cases/list_feed.rb
```

---

## Task 3: rspec 回帰 + container smoke + commit

- [ ] **Step 1: rspec**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -10
```

post 67/0、feed 16/12 (baseline) 維持必須。

- [ ] **Step 2: container smoke (F3 同等)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  uc = Feed::UseCases::ListFeed.new
  r = uc.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "post_ids: #{r[:post_ids].length}"
  puts "next_cursor: #{r[:next_cursor]&.[](0, 20)}..."
  puts "has_more: #{r[:has_more]}"
' 2>&1 | /usr/bin/tail -5
```

実 DB seed の状態によるが、F3 と同じ shape の結果 (post_ids 数 + base64 next_cursor + has_more) が返ること。

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-feed-cursor-lookup
/usr/bin/git diff --stat origin/main HEAD
```

期待: 2 ファイル + plan = 3 ファイル。他に変更ゼロ。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-feed-cursor-lookup
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-14-feed-cursor-lookup.md
/usr/bin/git commit -s -m "refactor(feed): use lightweight created_at lookup for cursor encoding"
```

push しない。

---

## Self-Review

- **F3 の TODO 解消**: `find_by_id` の post_media + hashtags eager-load 撤去。
- **Surgical / build-green**: 2 ファイル、動作変更ゼロ (next_cursor の組み立て式は同じ、created_at 取得経路だけ軽量化)。
- **Additive 性**: `find_by_id` は他から widely 使われているので無改変。`created_at_for_id` を新規追加するのみ。
