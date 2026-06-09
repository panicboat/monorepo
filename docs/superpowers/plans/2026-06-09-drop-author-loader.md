# Drop dead AuthorLoader class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Post::Adapters::AuthorLoader` クラス本体を削除する。#655 / #656 で AddComment / List 系の author 解決を ProfileAuthorAdapter に移行した結果、`AuthorLoader` の caller はゼロになっており、ファイル自体が dead code として残存している。drop することで slice の adapter リストが整理される。

**Architecture:** **Surgical**。`slices/post/adapters/author_loader.rb` 1 ファイル削除のみ。他は触らない。`cast_adapter` / `guest_adapter` / `user_adapter` / `media_adapter` は base `handler.rb` (旧 CastPost RPC) や `add_comment.rb` 等で依然 caller 有り → cleanup の対象は AuthorLoader のみ。

**Tech Stack:** Ruby / Hanami 2。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（§Decomposition の cleanup フェーズ）。前提: #656 main マージ済。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-author-loader`。app root: `services/monolith/workspace`。branch `chore/drop-author-loader` (origin/main = `c4935928` base、tracking 済)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith、シード済)。

### 削除前提の確証 (実装前に必須)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-author-loader
/usr/bin/grep -rn "AuthorLoader\\|author_loader" services/monolith/workspace --include="*.rb"
```

期待結果: `services/monolith/workspace/slices/post/adapters/author_loader.rb:6:    class AuthorLoader` の **1 行のみ**。他は spec / use_cases / handler / adapter / lib / config どこにも残っていないこと。

もし他にヒットがあれば **`Status: BLOCKED`** で報告 (削除すると壊れる、scope 外で要追加調査)。

## File Structure

- Delete: `services/monolith/workspace/slices/post/adapters/author_loader.rb` (全削除、105 行)

> autoload / require_relative リファレンスが他にあれば併せて消す (上記 grep で検出済前提)。

---

## Task 1: ファイル削除 + 構文/spec 確認

**Files:** Delete `services/monolith/workspace/slices/post/adapters/author_loader.rb`。

- [ ] **Step 1: 削除前 grep で caller ゼロ確認** (Context 上記コマンドを実行、出力が class 定義 1 行のみ)

- [ ] **Step 2: ファイル削除**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-author-loader
/usr/bin/git rm services/monolith/workspace/slices/post/adapters/author_loader.rb
```

- [ ] **Step 3: rspec で回帰確認**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -20
```

Expected: **67 examples, 0 failures** (#656 と同じ baseline 維持)。失敗があれば内容を確認、ファイル autoload が他から require されている可能性。

- [ ] **Step 4: gRPC server boot smoke (任意)**

`bundle exec rspec` で autoload は走るので 67/0 緑なら handler 群もロード成功と判定 OK。明示的 boot smoke は環境制約 (timeout 不在) でスキップしてよい。

---

## Task 2: commit

- [ ] **Step 1: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

Expected: `author_loader.rb` 削除 (-105 行) + plan 追加。他に変更が無いこと。

- [ ] **Step 2: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-author-loader
/usr/bin/git add services/monolith/workspace/slices/post/adapters/author_loader.rb docs/superpowers/plans/2026-06-09-drop-author-loader.md
/usr/bin/git commit -s -m "chore(post): drop dead AuthorLoader adapter"
```

push しない。

---

## Deferred

- 旧 `cast_adapter` / `guest_adapter` / `user_adapter` / `media_adapter` の drop → handler / add_comment が依然 caller、Q5 feed migration + 旧 CastPost RPC drop 後に一括 cleanup。

## Self-Review

- **Spec coverage**: spec §cleanup に従い、参照ゼロ化した adapter から順に drop。1 ファイルのみ surgical。
- **Additive 違反なし**: 削除のみで他無改変。
- **Placeholder 無し**: 全 step 完全コマンド付き。
- **Risk**: rspec 67/0 で autoload 検出が緑なら他 file は import していない (Hanami 規約上、ファイル削除で autoload graph が破綻すれば即 LoadError)。
