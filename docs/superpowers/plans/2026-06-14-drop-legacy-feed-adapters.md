# A4c: Drop legacy feed adapters + presenter + handler dangling code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A4a (#672) + A4b (#673) で全 caller が drop された **feed slice** の legacy adapters + presenter + handler に残った dangling code を一括 cleanup。post slice の cast/guest/user adapters は relationship/trust/access_policy 等の cross-slice consumer が active なので**本 PR では touch しない** (別途調査が必要)。

**Architecture:** **Surgical removal**。feed slice 内のみ、orphan ファイル削除 + handler.rb から 6 require_relative + 7+ private accessor + presenter 1 個を撤去。symmetric F3 `list_feed` 動作維持確証。

**Tech Stack:** Ruby / Hanami 2 / ROM。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-adapters`
- branch: `chore/drop-legacy-adapters` (origin/main = `20b68474` base、A4b #673 マージ後)
- 検証: `bundle exec rspec spec/slices/feed` (4/0 baseline 維持)、`bundle exec rspec spec/slices/post` (67/0)、`bundle exec rspec spec/slices/relationship` (31/0)、`bundle exec rspec spec/slices/profile` (148/14)、container smoke で F3 `ListFeed` 動作確認
- 触らない:
  - **Post::Adapters::* (cast_adapter, guest_adapter, user_adapter, block_adapter, follow_adapter, media_adapter, profile_author_adapter)**: cross-slice consumer (relationship/grpc/handler, trust/grpc/handler, post/policies/access_policy, comment_handler の `user_exists?` 等) が active、別 PR で個別判断
  - `slices/post/grpc/handler.rb` (base)、`slices/post/grpc/comment_handler.rb`、`slices/post/grpc/post_handler.rb`
  - proto stub、frontend、他 slice

### 削除対象詳細

**4 feed adapter ファイル**:
- `slices/feed/adapters/cast_adapter.rb` (caller: handler.rb のみ、dangling)
- `slices/feed/adapters/guest_adapter.rb` (dangling)
- `slices/feed/adapters/post_adapter.rb` (dangling)
- `slices/feed/adapters/media_adapter.rb` (dangling)

**1 presenter + spec**:
- `slices/feed/presenters/feed_presenter.rb` (caller: handler.rb dangling code のみ)
- `spec/slices/feed/presenters/feed_presenter_spec.rb`

**`slices/feed/grpc/handler.rb` の cleanup**:
- 削除する require_relative (6 行、推定 L6-11):
  - `../adapters/post_adapter`
  - `../adapters/follow_adapter` ← **保持** (新 `list_feed` で symmetric `following_account_ids` 経由で利用)
  - `../adapters/block_adapter` ← **保持** (新 `list_feed` で symmetric `bidirectionally_blocked_account_ids` 経由で利用)
  - `../adapters/cast_adapter` ← 削除
  - `../adapters/guest_adapter` ← 削除
  - `../adapters/media_adapter` ← 削除
  - `../presenters/feed_presenter` ← 削除
- 削除する private accessor (def):
  - `def post_adapter`
  - `def cast_adapter`
  - `def guest_adapter`
  - `def media_adapter`
  - `def find_my_cast`
  - `def find_my_cast!`
  - `def find_my_guest`
  - `def find_my_guest!`
  - `def find_blocker`
  - `def get_blocked_user_ids(blocker_id)`
  - `def load_media_files_for_posts_and_authors(posts, authors)`
- 保持する accessor:
  - `def list_feed_uc`
  - `def list_posts_by_ids_uc`
  - `def follow_adapter` (F3 symmetric が使用)
  - `def block_adapter` (F3 symmetric が使用)

### 削除前提の確証 (実装前必須)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-adapters

# 1. feed 4 adapter callers (各々 自身 + handler.rb dangling code のみ期待)
for a in CastAdapter GuestAdapter PostAdapter MediaAdapter; do
  /usr/bin/grep -l "Feed::Adapters::$a\b" services/monolith/workspace --include="*.rb" -r 2>/dev/null
  echo "---^^^ Feed::Adapters::$a"
done

# 2. FeedPresenter callers
/usr/bin/grep -rln "FeedPresenter\b" services/monolith/workspace --include="*.rb" 2>/dev/null
```

期待:
- 各 feed adapter は 1-2 file ヒット (`handler.rb` + 自身)、その handler.rb の参照は dangling private accessor のみ
- `FeedPresenter` は 3 file ヒット (handler.rb dangling + presenter 自身 + spec)、handler.rb で実際に呼ばれているのは dangling code のみ

異なれば **BLOCKED で escalate**。

## File Structure

- Delete: 4 feed adapter files + 1 presenter + 1 presenter spec = 6 file
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`

---

## Task 1: caller ゼロ再確証 + 6 file 削除

- [ ] **Step 1: 削除前 grep 実行** (Context §「削除前提の確証」)

期待結果と異なれば **BLOCKED** で escalate。

- [ ] **Step 2: 6 file を `git rm`**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-adapters
/usr/bin/git rm services/monolith/workspace/slices/feed/adapters/cast_adapter.rb
/usr/bin/git rm services/monolith/workspace/slices/feed/adapters/guest_adapter.rb
/usr/bin/git rm services/monolith/workspace/slices/feed/adapters/post_adapter.rb
/usr/bin/git rm services/monolith/workspace/slices/feed/adapters/media_adapter.rb
/usr/bin/git rm services/monolith/workspace/slices/feed/presenters/feed_presenter.rb
/usr/bin/git rm services/monolith/workspace/spec/slices/feed/presenters/feed_presenter_spec.rb
```

---

## Task 2: `feed/grpc/handler.rb` の dangling code 整理

**Files:** Modify `services/monolith/workspace/slices/feed/grpc/handler.rb`。

- [ ] **Step 1: 全体を Read で把握**

```bash
/bin/cat services/monolith/workspace/slices/feed/grpc/handler.rb
```

- [ ] **Step 2: 編集** (Context §「`feed/grpc/handler.rb` の cleanup」)

ファイル冒頭の require_relative ブロック:
- 削除: `../adapters/post_adapter`、`../adapters/cast_adapter`、`../adapters/guest_adapter`、`../adapters/media_adapter`、`../presenters/feed_presenter`
- 保持: `../../../lib/grpc/authenticatable`、`../adapters/follow_adapter`、`../adapters/block_adapter`、`../use_cases/list_feed`

private 領域の def:
- 削除: `def post_adapter`, `def cast_adapter`, `def guest_adapter`, `def media_adapter`, `def find_my_cast`, `def find_my_cast!`, `def find_my_guest`, `def find_my_guest!`, `def find_blocker`, `def get_blocked_user_ids(blocker_id)`, `def load_media_files_for_posts_and_authors(posts, authors)`
- 保持: `def list_feed_uc`, `def list_posts_by_ids_uc`, `def follow_adapter`, `def block_adapter`

`list_feed` method body 本体は無改変。

- [ ] **Step 3: 構文確認**

```bash
cd services/monolith/workspace
ruby -c slices/feed/grpc/handler.rb
```

`Syntax OK` 必須。

---

## Task 3: rspec 回帰 + container smoke + commit

- [ ] **Step 1: rspec 4 slice**

```bash
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待:
- feed: 4/0 維持 OR 改善 (feed_presenter_spec drop で 4 → N 件)
- post: 67/0 維持
- relationship: 31/0 維持
- profile: 148/14 維持

- [ ] **Step 2: container smoke (新 F3 動作)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  r = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "ListFeed: post_ids=#{r[:post_ids].length}"
' 2>&1 | /usr/bin/tail -3
```

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-adapters
/usr/bin/git diff --stat origin/main HEAD
```

期待: 6 delete + 1 modify + plan = 8 files。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-adapters
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-14-drop-legacy-feed-adapters.md
/usr/bin/git commit -s -m "chore(feed): drop legacy adapters + presenter + handler dangling code"
```

push しない。

---

## Deferred (本 A4c では実施しない)

- **Post::Adapters::CastAdapter / GuestAdapter / UserAdapter etc. の drop** → cross-slice 依存 (relationship/trust/access_policy 等) があるため別 PR で個別判断
- `slices/post/grpc/handler.rb` (base) の dangling `cast_adapter` / `guest_adapter` / `user_adapter` accessors → 上記と同時 drop
- `comment_handler.rb` の dead `load_media_files_for_comments_with_authors` method (user_adapter 経由) → comment slice の cleanup と一緒に
- `add_comment.rb` の `user_exists?` check リファクタ (UserAdapter 依存解消) → 別 PR
- proto messages drop (CastPost / FeedPost / LikeCastPost* etc.) → A5
- DB columns drop → A5 以降

## Self-Review

- **Scope 限定**: feed slice のみで close、post slice の cross-slice 依存は別 PR で安全に
- **caller ゼロ確証**: 6 file の caller は handler.rb dangling code + 自身 + spec のみ
- **新 F3 path 保護**: follow_adapter / block_adapter は新 symmetric メソッドで使用、`list_feed` method 本体は無改変
- **rspec baseline 維持期待**: feed_presenter_spec drop で examples が減るが failures は増えない
