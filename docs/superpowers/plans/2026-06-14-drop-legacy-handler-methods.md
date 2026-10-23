# A4a: Drop legacy monolith handler methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A1 (#669) + A2 (#670) で全 frontend BFF が drop され orphan 化した monolith 側の legacy RPC handler methods を drop する: 9 RPC + 9 method body + 関連 private accessor。use_cases / adapters は本 PR では touch しない (A4b / A4c で個別 drop)。

**Architecture:** **Surgical removal**。3 handler ファイルから RPC 宣言 + method body を一括撤去。`rpc :Xxx` 宣言ごと削除し、対応する `def xxx` method body も削除。private accessor (`list_guest_feed_uc` 等) は他 method で使われていなければ同時撤去。proto stub・use_cases・adapters は無改変。

**Tech Stack:** Ruby / Hanami 2 / gruf (gRPC)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-handler-methods`
- branch: `chore/drop-legacy-handler-methods` (origin/main = `653043fa` base)
- 検証: `bundle exec rspec spec/slices/post` (67/0 維持)、`bundle exec rspec spec/slices/feed` (16/12 baseline 維持)、`ruby -c` 全 file Syntax OK
- 触らない: use_cases (legacy `list_posts.rb` `list_public_posts.rb` `list_guest_feed.rb` `list_cast_feed.rb` 等)、adapters (`cast_adapter.rb` `guest_adapter.rb` `user_adapter.rb` 等)、proto stub、frontend、新 symmetric RPC method (`#list_posts` `#get_post` `#save_post` `#delete_post` 等)

### 削除対象詳細

**`slices/post/grpc/post_handler.rb`**:
- RPC 宣言削除: `rpc :ListCastPosts, ...` (L17), `rpc :GetCastPost, ...` (L18), `rpc :SaveCastPost, ...` (L19), `rpc :DeleteCastPost, ...` (L20)
- method body 削除: `def list_cast_posts` (L35-), `def get_cast_post` (L141-), `def save_cast_post` (L176-), `def delete_cast_post` (L204-) と それぞれの body 全体
- private 関連: `list_cast_posts` / `get_cast_post` / `save_cast_post` / `delete_cast_post` のみが call していた private helper があれば撤去 (例: `list_posts_uc` / `find_my_cast!` 等、本体は実装側で grep して判断)

**`slices/post/grpc/like_handler.rb`**:
- RPC 宣言削除: `rpc :LikeCastPost, ...` (L17), `rpc :UnlikeCastPost, ...` (L18), `rpc :GetPostLikeStatus, ...` (L19)
- 新 RPC 宣言 (`rpc :LikePost, ...` / `rpc :UnlikePost, ...`) は**保持**
- method body 削除: `def like_cast_post` (L30-), `def unlike_cast_post` (L44-), `def get_post_like_status` (L58-) と body
- 関連 private helper を撤去 (使用元が legacy のみのもの)

**`slices/feed/grpc/handler.rb`**:
- RPC 宣言削除: `rpc :ListGuestFeed, ...` (L31), `rpc :ListCastFeed, ...` (L32)
- method body 削除: `def list_guest_feed` (L35-83), `def list_cast_feed` (L84-)
- private accessor 削除: `def list_guest_feed_uc` (L175-), `def list_cast_feed_uc` (L179-) と直下の `@list_*_feed_uc` 関連
- `require_relative "../use_cases/list_guest_feed"` `require_relative "../use_cases/list_cast_feed"` 削除 (ファイル冒頭) — autoload で済むが明示 require があれば削除
- 関連 `require_relative` で legacy adapter (`cast_adapter`, `guest_adapter`, `post_adapter`, `media_adapter` 等) を必要としていれば**残す** (A4c で adapter 自体を drop する時に同時に消す)

## File Structure

- Modify: `services/monolith/workspace/slices/post/grpc/post_handler.rb`
- Modify: `services/monolith/workspace/slices/post/grpc/like_handler.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`

---

## Task 1: `post_handler.rb` の legacy methods 撤去

**Files:** Modify `services/monolith/workspace/slices/post/grpc/post_handler.rb`。

- [ ] **Step 1: 既存ファイルを Read で全体把握 + 関連 private helpers を grep**

```bash
cd services/monolith/workspace
/bin/cat slices/post/grpc/post_handler.rb | /usr/bin/head -50
/usr/bin/grep -n "def list_cast_posts\|def get_cast_post\|def save_cast_post\|def delete_cast_post\|def find_my_cast\|def list_posts_uc\|def get_post_uc\|def save_post_uc\|def delete_post_uc" slices/post/grpc/post_handler.rb
```

- [ ] **Step 2: 編集**

- L17-20 (legacy RPC 宣言 4 件) を削除
- `def list_cast_posts` ... `end` (推定 L35-140) を削除
- `def get_cast_post` ... `end` (推定 L141-175) を削除
- `def save_cast_post` ... `end` (推定 L176-203) を削除
- `def delete_cast_post` ... `end` (推定 L204-end_of_method) を削除
- `def find_my_cast!` 等の legacy-only helper があれば削除 (他で使われているか **grep で再確認してから**)
- `Post::Deps[..., list_posts_uc: "use_cases.posts.list_posts", ...]` の legacy use_case dep 行があれば削除

新 symmetric RPC method (`#list_posts` / `#get_post` / `#save_post` / `#delete_post`) と `#list_posts_by_ids_uc` 関連は**保持**。

- [ ] **Step 3: 構文確認**

```bash
ruby -c slices/post/grpc/post_handler.rb
```

`Syntax OK` 必須。

---

## Task 2: `like_handler.rb` の legacy methods 撤去

**Files:** Modify `services/monolith/workspace/slices/post/grpc/like_handler.rb`。

- [ ] **Step 1: ファイル全体把握**

```bash
/bin/cat slices/post/grpc/like_handler.rb
```

- [ ] **Step 2: 編集**

- L17-19 (legacy RPC 宣言 3 件) を削除
- `def like_cast_post` body 削除
- `def unlike_cast_post` body 削除
- `def get_post_like_status` body 削除
- `Post::Deps` 等で legacy use_case を depend しているなら削除

新 symmetric `#like_post` / `#unlike_post` / `#get_like_status` method は**保持**。

- [ ] **Step 3: 構文確認**

```bash
ruby -c slices/post/grpc/like_handler.rb
```

---

## Task 3: `feed/grpc/handler.rb` の legacy methods 撤去

**Files:** Modify `services/monolith/workspace/slices/feed/grpc/handler.rb`。

- [ ] **Step 1: ファイル全体把握**

```bash
/bin/cat slices/feed/grpc/handler.rb
```

- [ ] **Step 2: 編集**

- ファイル冒頭の `require_relative "../use_cases/list_guest_feed"` `require_relative "../use_cases/list_cast_feed"` 削除
- L31-32 (legacy RPC 宣言 2 件) を削除
- `def list_guest_feed` body 削除 (L35-83 推定、全体)
- `def list_cast_feed` body 削除 (L84-end of method)
- private accessor `def list_guest_feed_uc` / `def list_cast_feed_uc` 削除
- 関連の `@list_guest_feed_uc` / `@list_cast_feed_uc` 変数も自然消滅

新 `#list_feed` method と `#list_feed_uc` / `#list_posts_by_ids_uc` private accessors は**保持**。

`require_relative "../adapters/{cast,guest,post,media}_adapter"` 等の legacy adapter require 行は **A4c で adapter file ごと drop する**ため本 PR では**残す**。boot 時のクラスロードのみ走り、handler 内では参照されなくなるので harmless。

- [ ] **Step 3: 構文確認**

```bash
ruby -c slices/feed/grpc/handler.rb
```

---

## Task 4: rspec 回帰 + commit

- [ ] **Step 1: rspec**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -10
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
```

期待:
- post: **少なくとも 67-N (legacy spec が orphan で fail する可能性、その分は減少して OK)、もしくは baseline 維持**
- feed: 16/12 (baseline 維持) または改善 (`list_guest_feed_spec.rb` 等が consts not found で fail していたものが skip される可能性)
- profile / relationship: baseline 維持

**legacy spec ファイル (`list_cast_posts_spec.rb`, `list_guest_feed_spec.rb`, `list_cast_feed_spec.rb`, `like_cast_post_spec.rb` 等) は本 PR の defer**。spec の delete は A4b/A4c で関連 use_case を drop する時に同時に行う。本 PR ではコードを drop し、spec が壊れる場合は **既知 baseline と同等 or 軽微増加** であれば許容。**重大増加 (例: 新 method の動作が壊れる) は BLOCKED**。

- [ ] **Step 2: container smoke (新 RPC が動作する確証)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  uc = Feed::UseCases::ListFeed.new
  r = uc.call(filter: "all", viewer_account_id: "00000000-0000-0000-0000-000000000000")
  puts "ListFeed: post_ids=#{r[:post_ids].length}, has_more=#{r[:has_more]}"
  puts "ListPostsByIds: #{Post::Slice["use_cases.posts.list_posts_by_ids"].class}"
' 2>&1 | /usr/bin/tail -5
```

新 symmetric RPC 関連が container で resolve できること。

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-handler-methods
/usr/bin/git diff --stat origin/main HEAD
```

期待: 3 source file + plan = 4 files。**他に変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-handler-methods
/usr/bin/git add services/monolith/workspace/slices/post/grpc/post_handler.rb services/monolith/workspace/slices/post/grpc/like_handler.rb services/monolith/workspace/slices/feed/grpc/handler.rb docs/superpowers/plans/2026-06-14-drop-legacy-handler-methods.md
/usr/bin/git commit -s -m "chore(posts,feed): drop legacy RPC handler methods"
```

push しない。

---

## Deferred (本 A4a では実施しない)

- Legacy use_cases (`Post::UseCases::Posts::ListPosts` legacy / `Feed::UseCases::ListGuestFeed` / `ListCastFeed` / 関連 likes use_cases) → A4b
- Legacy adapters (`cast_adapter` / `guest_adapter` / `user_adapter` / `feed/adapters/{cast,guest,post,media}_adapter` 等) → A4c
- Legacy spec ファイル → use_cases / adapters と同時 drop
- proto messages drop (CastPost / FeedPost / LikeCastPost* etc.) → A5
- DB columns (`posts.cast_user_id`, `likes.guest_user_id`) → A5 以降

## Self-Review

- **Surgical removal**: 9 RPC 宣言 + 9 method body のみ delete、use_cases/adapters は次 PR
- **新 symmetric RPC は無改変**: `list_posts` / `get_post` / `save_post` / `delete_post` / `like_post` / `unlike_post` / `get_like_status` / `list_feed` の動作担保
- **rspec baseline 維持**: legacy spec が dependency 切れで fail するのは許容 (next PR で削除)、新 spec は不変
- **A4b への準備**: use_cases が caller ゼロ化、次 PR で drop 可能
