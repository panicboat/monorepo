# A4b: Drop legacy monolith use_cases + specs + dangling constant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A4a (#672) で全 handler caller が drop され orphan 化した 8 legacy use_case ファイル + 2 関連 spec + post_handler.rb の dangling 定数を drop する。adapters は本 PR では touch しない (A4c で個別 drop)。

**Architecture:** **Surgical removal**。caller ゼロ確証済 (controller pre-survey)。`use_cases.posts.list_posts*` の grep false positive (= `list_posts_by_ids` は symmetric F2 で保持) を回避した正確な list を持つ。

**Tech Stack:** Ruby / Hanami 2 / ROM。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases`
- branch: `chore/drop-legacy-use-cases` (origin/main = `0bc3e8bc` base、A4a #672 マージ後)
- 検証: `bundle exec rspec spec/slices/post` (`add_comment_spec` 維持)、`bundle exec rspec spec/slices/feed` (legacy 2 specs 削除後、baseline 16/12 → 14/0 程度に**改善**期待)、container smoke で symmetric F3 `ListFeed` 動作確認
- 触らない: 全 adapters (cast/guest/user/media/follow/block/post/profile_author 各 slice)、proto stub、新 symmetric use_cases (`list_posts_by_ids`, `list_feed`, `comments/{add,delete,list_comments,list_replies}_comment`, `get_profile` etc.)、frontend

### 削除対象詳細

**8 use_case ファイル**:
- `slices/feed/use_cases/list_guest_feed.rb`
- `slices/feed/use_cases/list_cast_feed.rb`
- `slices/post/use_cases/posts/list_posts.rb` (legacy: `def call(cast_user_id:, ...)` cast 専用)
- `slices/post/use_cases/posts/list_public_posts.rb`
- `slices/post/use_cases/posts/save_post.rb` (legacy: `cast_user_id` 引数、新 handler の `def save_post` は post_repo を直接呼ぶ)
- `slices/post/use_cases/likes/like_post.rb` (legacy: `def call(post_id:, guest_user_id:)`)
- `slices/post/use_cases/likes/unlike_post.rb`
- `slices/post/use_cases/likes/get_like_status.rb`

**2 spec ファイル**:
- `spec/slices/feed/use_cases/list_guest_feed_spec.rb`
- `spec/slices/feed/use_cases/list_cast_feed_spec.rb`

**post_handler.rb の 1 dangling 定数**:
- `services/monolith/workspace/slices/post/grpc/post_handler.rb` の `SavePost = Post::UseCases::Posts::SavePost` 行 (推定 L97 周辺)

### 削除前提の確証 (実装前必須)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases

# 1. legacy use_case のキー参照 (false positive 注意: list_posts は list_posts_by_ids にもマッチするので末尾を絞る)
/usr/bin/grep -rln 'use_cases\.posts\.list_posts"\|use_cases\.posts\.list_public_posts\|use_cases\.posts\.save_post"\|use_cases\.likes\.like_post"\|use_cases\.likes\.unlike_post"\|use_cases\.likes\.get_like_status' services/monolith/workspace --include="*.rb" 2>/dev/null

# 2. クラス名 references (Feed::UseCases::ListGuestFeed etc.)
/usr/bin/grep -rln "Feed::UseCases::ListGuestFeed\b\|Feed::UseCases::ListCastFeed\b\|Post::UseCases::Posts::ListPosts\b\|Post::UseCases::Posts::ListPublicPosts\b\|Post::UseCases::Likes::LikePost\b\|Post::UseCases::Likes::UnlikePost\b\|Post::UseCases::Likes::GetLikeStatus\b" services/monolith/workspace --include="*.rb" 2>/dev/null

# 3. Post::UseCases::Posts::SavePost (legacy: post_handler の dangling 定数のみ)
/usr/bin/grep -rln "Post::UseCases::Posts::SavePost\b" services/monolith/workspace --include="*.rb" 2>/dev/null
```

期待:
- (1) 0 件 (handler の Deps は A4a で消えた)
- (2) 削除対象 use_case file 自身 + 削除対象 spec ファイルのみ (8 use_case + 2 spec の合計 = 10 自身 references)
- (3) `services/monolith/workspace/slices/post/grpc/post_handler.rb` 1 件 (dangling 定数)、本 PR で同時 drop

異なれば **BLOCKED で escalate**。

## File Structure

- Delete: 8 use_case `.rb` files
- Delete: 2 spec `.rb` files
- Modify: `services/monolith/workspace/slices/post/grpc/post_handler.rb` (`SavePost = ...` 行削除)

---

## Task 1: caller ゼロ再確証 + 8 use_case + 2 spec 削除

- [ ] **Step 1: 削除前 grep 3 回実行** (Context §「削除前提の確証」)

期待結果と異なれば **BLOCKED** で escalate。

- [ ] **Step 2: 8 use_case + 2 spec を `git rm`**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases
/usr/bin/git rm services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb
/usr/bin/git rm services/monolith/workspace/slices/feed/use_cases/list_cast_feed.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/posts/list_posts.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/posts/list_public_posts.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/posts/save_post.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/likes/like_post.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/likes/unlike_post.rb
/usr/bin/git rm services/monolith/workspace/slices/post/use_cases/likes/get_like_status.rb
/usr/bin/git rm services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb
/usr/bin/git rm services/monolith/workspace/spec/slices/feed/use_cases/list_cast_feed_spec.rb
```

---

## Task 2: post_handler.rb の dangling 定数削除

**Files:** Modify `services/monolith/workspace/slices/post/grpc/post_handler.rb`。

- [ ] **Step 1: 該当行を grep で発見**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases/services/monolith/workspace
/usr/bin/grep -n "SavePost = Post::UseCases" slices/post/grpc/post_handler.rb
```

- [ ] **Step 2: 該当 1 行を削除**

`SavePost = Post::UseCases::Posts::SavePost` の 1 行と、その前後に **空行が連続している場合は 1 行整理** (構文に影響なし、cleanup として)。

- [ ] **Step 3: 構文確認**

```bash
ruby -c slices/post/grpc/post_handler.rb
```

`Syntax OK` 必須。

---

## Task 3: rspec 回帰 + container smoke + commit

- [ ] **Step 1: rspec 4 slice**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待:
- post: 67/0 (`add_comment_spec` 維持) または 67-N で legacy spec が無い分の変動なし
- feed: **16/12 → 14/0** に **改善** (legacy 2 spec を drop した分、example が 14 に減り failures が 0 に改善 — F3 `list_feed_spec.rb` 4 examples のみ残る)
- relationship: 31/0 維持
- profile: 148/14 維持

実測との乖離を報告。**重大な regression は BLOCKED**、軽微な fail 改善は OK。

- [ ] **Step 2: container smoke (新 symmetric path 動作確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  r = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "ListFeed: post_ids=#{r[:post_ids].length}"
  puts "ListPostsByIds: #{Post::Slice["use_cases.posts.list_posts_by_ids"].class}"
' 2>&1 | /usr/bin/tail -3
```

期待: 新 `ListFeed` + `list_posts_by_ids` 解決成功。

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases
/usr/bin/git diff --stat origin/main HEAD
```

期待: 10 delete + 1 modify + plan = 12 files。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-use-cases
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-14-drop-legacy-use-cases.md
/usr/bin/git commit -s -m "chore(posts,feed): drop legacy use_cases + specs + dangling constant"
```

push しない。

---

## Deferred (本 A4b では実施しない)

- Legacy adapters (`cast_adapter`, `guest_adapter`, `user_adapter`, `feed/adapters/{cast,guest,post,media}_adapter` 等) → A4c
- proto messages drop (CastPost / FeedPost / LikeCastPost* etc.) → A5
- DB columns (`posts.cast_user_id`, `likes.guest_user_id`) → A5 以降

## Self-Review

- **caller ゼロ確証**: 3 段 grep (key string / class name / SavePost constant)
- **動作変更ゼロ**: 8 use_case は dead code (A4a で全 handler caller drop 済)
- **新 symmetric path 保護**: `list_posts_by_ids` (F2) / `list_feed` (F3) / `add_comment` / `delete_comment` / `list_comments` / `list_replies` / `get_profile` etc. は無改変
- **rspec 改善期待**: feed legacy 2 spec drop で `12 failures` のうち legacy 起源分が消えてベースラインが改善する
