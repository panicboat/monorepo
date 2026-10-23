# Extract ProfileAuthorResolvable concern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 ファイル (`post_handler.rb` / `comment_handler.rb` / `list_comments.rb` / `list_replies.rb`) に同形コピーされている `profile_author_adapter` private accessor を、スライスローカルな concern `Post::Concerns::ProfileAuthorResolvable` に抽出して `include` 1 行で済むようにする。

**Architecture:** **DRY refactor、surgical**。既存の `Concerns::CursorPagination` パターン (use_case で `include Concerns::CursorPagination` 経由) を踏襲して、スライス内 (`slices/post/concerns/`) に置く。動作変更なし、構造のみ整理。

**Tech Stack:** Ruby / Hanami 2。

**Spec:** posts スライス cleanup の一環 (前 PR #656 review で「次に like_handler 等で同パターンが増えるので base 昇格を別 PR で」と明記された debt)。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-profile-author-deps`。app root: `services/monolith/workspace`。branch `refactor/profile-author-deps` (origin/main = `c4935928` base)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。

### 既存パターン (確証要)

- `slices/post/use_cases/comments/list_comments.rb:3` の `require "concerns/cursor_pagination"` + `:10` の `include Concerns::CursorPagination`
- これは `lib/concerns/cursor_pagination.rb` 経由の **トップレベル `Concerns::` 名前空間**の共有 concern。
- **本 PR のスコープ**: スライス固有 (`Post::Adapters::ProfileAuthorAdapter` を参照) なので、トップレベル `Concerns::` ではなくスライス内 `Post::Concerns::` で配置するのが意図一致。

### 削減対象 (caller 4 ファイル)

```bash
/usr/bin/grep -rn "def profile_author_adapter\\|@profile_author_adapter ||=" services/monolith/workspace/slices/post --include="*.rb"
```

期待: 4 ファイル × 各 2 行 (def + ||=) = 8 行ヒット。実装時に位置を確認。

- `slices/post/grpc/post_handler.rb:385-387`
- `slices/post/grpc/comment_handler.rb:166-168`
- `slices/post/use_cases/comments/list_comments.rb:60-62`
- `slices/post/use_cases/comments/list_replies.rb:59-61`

## File Structure

- Create: `slices/post/concerns/profile_author_resolvable.rb`
- Modify: 上記 4 ファイル (private accessor 3 行 → `include Post::Concerns::ProfileAuthorResolvable` 1 行に置換)

---

## Task 1: concern モジュール作成

**Files:** Create `slices/post/concerns/profile_author_resolvable.rb`。

- [ ] **Step 1: 配置ディレクトリ確認**

`/usr/bin/find services/monolith/workspace/slices/post -type d -name "concerns" 2>/dev/null` で既存有無を確認。無ければ新規ディレクトリ。Hanami の slice autoload は `slices/post/concerns/profile_author_resolvable.rb` → `Post::Concerns::ProfileAuthorResolvable` で resolve するはず。

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Post
  module Concerns
    # Lazy-memoized accessor for the unified ProfileAuthorAdapter (symmetric / account-based).
    # Mix into post handlers and use_cases that resolve author info via the Profile slice
    # to avoid copy-pasting the same 3-line accessor in every consumer.
    module ProfileAuthorResolvable
      private

      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end
    end
  end
end
```

- [ ] **Step 3: 構文チェック**

```bash
cd services/monolith/workspace
ruby -c slices/post/concerns/profile_author_resolvable.rb
```

Expected: `Syntax OK`。

---

## Task 2: 4 ファイルから accessor を撤去して include に置換

**Files:** Modify 4 ファイル。

### Step 1: `slices/post/grpc/post_handler.rb`

L385-387 (推定) の private accessor 3 行を削除:

```ruby
      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end
```

クラス本体の冒頭 (`include Post::Deps[...]` 系の近辺) に追加:

```ruby
      include Post::Concerns::ProfileAuthorResolvable
```

### Step 2: `slices/post/grpc/comment_handler.rb`

同様。L166-168 (推定) の accessor 削除 + クラス冒頭の include 群に `include Post::Concerns::ProfileAuthorResolvable` 追加。

### Step 3: `slices/post/use_cases/comments/list_comments.rb`

L60-62 (推定) の accessor 削除 + `include Concerns::CursorPagination` の下に `include Post::Concerns::ProfileAuthorResolvable` 追加。

### Step 4: `slices/post/use_cases/comments/list_replies.rb`

同 Step 3。

### Step 5: 構文確認

```bash
ruby -c slices/post/grpc/post_handler.rb && \
ruby -c slices/post/grpc/comment_handler.rb && \
ruby -c slices/post/use_cases/comments/list_comments.rb && \
ruby -c slices/post/use_cases/comments/list_replies.rb
```

Expected: 全 `Syntax OK`。

---

## Task 3: rspec 回帰確認 + commit

- [ ] **Step 1: rspec**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -20
```

Expected: **67 examples, 0 failures**。失敗があれば autoload / 名前空間の問題なので調査 → BLOCKED で報告。

- [ ] **Step 2: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

Expected: 4 ファイル modify + concern 新規 + plan 新規。他無し。

- [ ] **Step 3: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-profile-author-deps
/usr/bin/git add services/monolith/workspace/slices/post docs/superpowers/plans/2026-06-09-profile-author-resolvable-concern.md
/usr/bin/git commit -s -m "refactor(post): extract ProfileAuthorResolvable concern"
```

push しない。

---

## Trouble-shoot (発生時)

- **`uninitialized constant Post::Concerns::ProfileAuthorResolvable`**: Hanami autoload が `slices/post/concerns/` を見ていない可能性。`slices/post/config/slice.rb` か `config/app.rb` で `autoloader.push_dir` 系の設定がいるかも。**先に類似 dir 構造 (例: `slices/post/adapters/` がどう autoload されているか) を `slices/post/config/` / `config/app.rb` で grep し、適用**。それで解決しない場合は `require_relative "../concerns/profile_author_resolvable"` を 4 ファイル冒頭に追加するワークアラウンドで進める。
- **`include` 位置の衝突**: handlers は `include Concerns::CursorPagination` + `include Post::Deps[...]` を持つ。`include Post::Concerns::ProfileAuthorResolvable` は同階層に追加。コード style に問題なし。

---

## Deferred

- 他 adapter (cast/guest/user/media) を concern 経由にする → 旧 RPC drop 後の cleanup で全体を見直し。
- `profile_author_adapter` を Hanami DI (`Post::Deps[profile_author_adapter: "adapters.profile_author_adapter"]`) に切替え → handlers は現状 adapter 全てを manual accessor で扱っており、mixed pattern を増やさない方が良いので concern が妥当。

## Self-Review

- **DRY**: 4 caller × 3 行 = 12 行が 4 caller × 1 行 + concern 1 ファイル (8 行) に圧縮 (12 → 12 行で見かけ上不変だが、cross-file の duplication が消える＝変更箇所が 1 ファイルに集約)。
- **Additive / build-green**: 動作変更ゼロ (memoize semantics 不変、`Post::Adapters::ProfileAuthorAdapter.new` を呼ぶタイミングも同じ)。
- **Risk**: autoload が slice 内 `concerns/` を pick up しない可能性 → Trouble-shoot に対策明記。
