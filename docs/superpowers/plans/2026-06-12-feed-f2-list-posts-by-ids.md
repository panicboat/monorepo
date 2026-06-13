# Feed F2: posts cross-slice hydration (`ListPostsByIds`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** posts スライスに **`Post::UseCases::Posts::ListPostsByIds`** を新規追加。`post_ids` と `viewer_account_id` を受け取り、`Hash<post_id_string => Post::V1::Post>` を返す cross-slice 用 use_case。feed slice (F3) がこれを `Post::Slice["use_cases.posts.list_posts_by_ids"]` 経由で呼び、自分は timeline query と pagination のみに責務集中する。

**Architecture:** **Additive / build-green**。post_repo に `find_by_ids(ids:)` batch fetch method を新規追加 (既存 `find_by_id` の id 配列版)、use_case で `present_posts` (post_handler の private method) と同じ hydration を実行して proto 化。`PostPresenter.to_post_proto` と `Post::Concerns::ProfileAuthorResolvable` を再利用、like_repo / comment_repo の既存 batch メソッドを利用。post_handler 側 `present_posts` の DRY 化は本 PR の defer (surgical 優先、後続 refactor PR で扱う)。

**Tech Stack:** Ruby / Hanami 2 / gruf (gRPC) / ROM。proto stub = `Post::V1::Post` (#652 Q1)、`profile_author_adapter` (#658 で concern 抽出)、`like_repo.likes_count_batch` / `account_liked_status_batch` (Q3b 既存)、`comment_repo.comments_count_batch` (既存)。

**Spec:** `docs/superpowers/specs/2026-06-12-feed-slice-design.md` (§Cross-slice contract / §Decomposition の F2)。前提: F1 (proto) は #660 で merge 済、本 PR は posts スライス内のみ touch、feed slice は無改変。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f2-list-posts-by-ids`。app root: `services/monolith/workspace`。branch `feat/feed-f2-list-posts-by-ids` (origin/main = `eebfd8aa` base、tracking 済)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith、シード済)。
- **build-green / additive**: 以下は無改変:
  - `slices/post/grpc/post_handler.rb` (present_posts の DRY 化は別 PR)
  - `slices/post/grpc/comment_handler.rb` / 他 handler
  - `slices/post/use_cases/{posts,comments,likes}/` の既存 use_case
  - `slices/post/presenters/post_presenter.rb` (`to_post_proto` を呼ぶだけ)
  - `slices/post/concerns/profile_author_resolvable.rb` (#658)
  - `slices/post/repositories/{like_repository,comment_repository}.rb` (batch メソッド既存)
  - `slices/post/adapters/*` (`profile_author_adapter` / `media_adapter` を経由)
  - proto / frontend / 他 slice
- 変更は: `post_repository.rb` に `find_by_ids(ids:)` 追加 + 新規 use_case ファイル 1 個の 2 ファイル。

### 既存 (確定、再利用する)

- **`Post::Concerns::ProfileAuthorResolvable`** (`slices/post/concerns/profile_author_resolvable.rb`、#658):
  ```rb
  include Post::Concerns::ProfileAuthorResolvable
  # 提供: private profile_author_adapter (memoize、Post::Adapters::ProfileAuthorAdapter.new)
  # ProfileAuthorAdapter#load(account_ids) → { UUID => AuthorInfo(account_id, display_name, username, avatar_url) }
  ```
- **`Post::Repositories::LikeRepository`** の batch メソッド (`slices/post/repositories/like_repository.rb`):
  - `likes_count_batch(post_ids:)` → `{ post_id => Integer }`
  - `account_liked_status_batch(post_ids:, account_id:)` → `{ post_id => Boolean }`
- **`Post::Repositories::CommentRepository`** (`slices/post/repositories/comment_repository.rb`):
  - `comments_count_batch(post_ids:, exclude_user_ids: nil)` → `{ post_id => Integer }`
- **`PostPresenter.to_post_proto`** (`slices/post/presenters/post_presenter.rb:57-76`):
  ```rb
  to_post_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false, media_files: {})
  # → Post::V1::Post
  # author は AuthorInfo (Data) を受け取る (post_author_to_proto がアクセス)
  ```
- **`Post::Adapters::MediaAdapter`** (handler から `media_adapter.find_by_ids(media_ids)` で呼ばれている): `{ media_id => MediaFile }`
- **`post_handler#present_posts`** (`slices/post/grpc/post_handler.rb:386`、本 PR は無改変だが pattern reference):
  - rows → post_ids 抽出 → authors load → likes/comments/liked batch → media files load → map each row to to_post_proto
- **post_handler#load_media_files_for_posts** (`post_handler.rb:374`): 同じ pattern を use_case 内に inline する (post_handler は無改変方針)。

### Hanami 名前空間 / container key

- 既存 use_case ファイル配置: `slices/post/use_cases/{posts,comments,likes}/<name>.rb` → 例 `Post::Slice["use_cases.posts.list_posts"]` で resolve (post_handler の `Post::Deps[list_posts_uc: "use_cases.posts.list_posts"]` 参照)。
- 本 PR の新 use_case: `slices/post/use_cases/posts/list_posts_by_ids.rb` → key = **`"use_cases.posts.list_posts_by_ids"`**。
- spec illustrative の `Post::Slice["use_cases.list_posts_by_ids"]` (posts. 無し) は既存 namespace 規約と整合させて `use_cases.posts.list_posts_by_ids` に修正。F3 plan で feed slice から呼ぶ際もこのキーを使う。

## File Structure

- Modify: `services/monolith/workspace/slices/post/repositories/post_repository.rb` (`find_by_ids(ids:)` method 追加、既存 `find_by_id` の下に)
- Create: `services/monolith/workspace/slices/post/use_cases/posts/list_posts_by_ids.rb`

---

## Task 1: `post_repo.find_by_ids(ids:)` を追加

**Files:** Modify `services/monolith/workspace/slices/post/repositories/post_repository.rb`。

- [ ] **Step 1: 既存 `find_by_id` メソッドの場所を確認**

Run: `cd services/monolith/workspace && /usr/bin/grep -n "def find_by_id\b\|def find_by_id_and_author" slices/post/repositories/post_repository.rb`
Expected: 該当行 (推定 L88 周辺)。

- [ ] **Step 2: `find_by_ids(ids:)` を直下に追加**

`find_by_id` メソッドの直後に追加 (root_relation の名前は既存ファイル冒頭で確認、通常 `root` か `posts`):

```ruby
      # Batch fetch posts by id list. Used by cross-slice consumers (e.g. feed slice)
      # that have already determined which posts to display and need full hydration.
      # Returns an unordered array — caller is responsible for re-ordering if needed.
      def find_by_ids(ids:)
        return [] if ids.nil? || ids.empty?

        root.combine(:post_media, :hashtags).where(id: ids).to_a
      end
```

**実装上の注意**:
- `root.combine(:post_media, :hashtags)` は既存 `find_by_id` と同じ associations を eager load (`post.post_media` / `post.hashtags` を `PostPresenter` が参照するため)
- `to_a` で配列化、ROM relation でなく POROs として返す
- `where(id: ids)` で IN 句に展開される
- 順序保証なし (caller 側で id → post の辞書を組んで順序復元する想定)
- 削除済み (もし soft delete があれば) は既存 `find_by_id` のスコープに従う。**`find_by_id` を Read で確認**、特別なスコープがあれば同じスコープを `find_by_ids` にも適用する

- [ ] **Step 3: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/repositories/post_repository.rb`
Expected: `Syntax OK`。

---

## Task 2: `ListPostsByIds` use_case を新規作成

**Files:** Create `services/monolith/workspace/slices/post/use_cases/posts/list_posts_by_ids.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      # Cross-slice hydration: feed slice (and any future consumer) passes a list of
      # post ids + the viewer's account id, and receives a Hash<post_id_string => Post::V1::Post>
      # with author, engagement counts, viewer-perspective liked flag, and media URLs filled in.
      # The hash shape (rather than an ordered array) lets callers re-order or drop missing
      # entries without depending on this use_case's return order.
      class ListPostsByIds
        include Post::Concerns::ProfileAuthorResolvable
        include Post::Deps[
          post_repo: "repositories.post_repository",
          like_repo: "repositories.like_repository",
          comment_repo: "repositories.comment_repository"
        ]

        # @param post_ids [Array<String>] ordered post ids to hydrate (order not preserved in result)
        # @param viewer_account_id [String, nil] account id of the request viewer; nil = unauthenticated
        # @return [Hash{String => Post::V1::Post}] keyed by post_id (string), missing posts omitted
        def call(post_ids:, viewer_account_id: nil)
          return {} if post_ids.nil? || post_ids.empty?

          posts = post_repo.find_by_ids(ids: post_ids)
          return {} if posts.empty?

          ids = posts.map { |p| p.id.to_s }
          authors = profile_author_adapter.load(posts.map(&:author_id))
          likes_counts = like_repo.likes_count_batch(post_ids: ids)
          comments_counts = comment_repo.comments_count_batch(post_ids: ids, exclude_user_ids: [])
          liked = if viewer_account_id
            like_repo.account_liked_status_batch(post_ids: ids, account_id: viewer_account_id)
          else
            {}
          end
          media_files = load_media_files(posts)

          posts.each_with_object({}) do |post, hash|
            proto = PostPresenter.to_post_proto(
              post,
              author: authors[post.author_id],
              likes_count: likes_counts[post.id] || 0,
              comments_count: comments_counts[post.id] || 0,
              liked: liked[post.id] || false,
              media_files: media_files
            )
            hash[post.id.to_s] = proto if proto
          end
        end

        private

        # Same pattern as post_handler#load_media_files_for_posts. Inlined here to avoid
        # cross-class coupling (handler stays untouched; this use_case is self-contained).
        def load_media_files(posts)
          media_ids = posts.flat_map do |post|
            next [] unless post.respond_to?(:post_media)
            (post.post_media || []).filter_map(&:media_id)
          end.uniq

          return {} if media_ids.empty?

          media_adapter.find_by_ids(media_ids)
        end

        def media_adapter
          @media_adapter ||= Post::Adapters::MediaAdapter.new
        end
      end
    end
  end
end
```

**実装上の注意**:
- `comments_count_batch(exclude_user_ids: [])` で **block 適用なし**。feed slice 側で post_id を絞った後 (block 適用済) に渡される前提なので二重適用は不要、かつ comment count は post 単位で集計するため block を反映しない方が正しい (commenter は block 対象外)。
- `liked` は viewer なしで全 false。
- `media_files` 取得は private method として use_case 内に inline (handler の `load_media_files_for_posts` を**コピペ重複**するが、handler を触らない方針)。
- `PostPresenter.to_post_proto` が nil を返すケース (post が nil) は filter している (`if proto`)。
- `authors[post.author_id]` の key 型: ProfileAuthorAdapter の戻り key は UUID オブジェクト、`post.author_id` も DB 由来 UUID と仮定 (#655 の AddComment fix では `.transform_keys(&:to_s)` で文字列正規化したが、ここでは両方 UUID で揃うはずなので transform 不要。**実装前に `post_handler#present_posts` の方法を確認**、handler が `authors[post.author_id]` で直接引いているなら transform 不要)。

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/use_cases/posts/list_posts_by_ids.rb`
Expected: `Syntax OK`。

- [ ] **Step 3: Hanami container 解決確認 (rspec 経由)**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -10`
Expected: 67 examples / 0 failures (baseline 維持、新規 spec 追加無しなので件数も baseline と同じ)。autoload グラフが新ファイルで壊れていないことを示唆。

---

## Task 3: cross-slice resolve smoke (Hanami container key 確認)

**Files:** なし (rspec で間接確認)。

- [ ] **Step 1: container key の resolve 確認**

Hanami 規約上 `slices/post/use_cases/posts/list_posts_by_ids.rb` → key `use_cases.posts.list_posts_by_ids` で resolve される。明示テストは無いが Step 2 で smoke 確認。

- [ ] **Step 2: rb -e で smoke (require + 解決)**

Run:

```bash
cd services/monolith/workspace
bundle exec ruby -e '
  require_relative "config/app"
  uc = Post::Slice["use_cases.posts.list_posts_by_ids"]
  puts "Resolved: #{uc.class}"
  result = uc.call(post_ids: [], viewer_account_id: nil)
  puts "Empty input result: #{result.inspect}"
' 2>&1 | /usr/bin/tail -10
```

Expected: 
- `Resolved: Post::UseCases::Posts::ListPostsByIds`
- `Empty input result: {}`

Hanami の boot が失敗する場合 (環境問題で `config/app` がロードできない等) は **Status: BLOCKED** で controller に escalate せず、Task 4 の rspec 緑を主担保にして本 step は skip 報告で構わない (rspec が緑ということは autoload 含めて壊れていない)。

---

## Task 4: diff 確認 + commit

- [ ] **Step 1: diff stat**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f2-list-posts-by-ids && /usr/bin/git diff --stat origin/main HEAD`
Expected: `post_repository.rb` (+10 行程度) + `list_posts_by_ids.rb` (新規 +60 行程度) + plan 1 ファイル。**ソースコード変更ゼロ** (handler / presenter / 他 use_case / 他 slice / proto / frontend に diff 無いこと)。

- [ ] **Step 2: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f2-list-posts-by-ids
/usr/bin/git add services/monolith/workspace/slices/post docs/superpowers/plans/2026-06-12-feed-f2-list-posts-by-ids.md
/usr/bin/git commit -s -m "feat(post): add ListPostsByIds use_case for cross-slice hydration"
```
(push しない。)

---

## Deferred (本 F2 では実施しない)

- **`post_handler#present_posts` の DRY 化** (本 use_case を call させて handler を thin にする) → 別 refactor PR、本 PR は additive 優先
- **`media_adapter` の `Post::Concerns::*` 抽出** → 4 ファイル (post_handler / list_posts_by_ids / 他) に accessor が分散しているが、3 caller 以下は YAGNI で本 PR は inline
- **unit spec for `ListPostsByIds`** → test infra 整備 PR で対応、F3 で integration 動作確認
- **`comments_count_batch` の exclude_user_ids 引き渡し** (viewer の block list) → block は post 表示単位で適用、コメント count は post 単位 (commenter は別軸の block) なので exclude_user_ids 空のまま

## Self-Review (作成者チェック済)

- **Spec coverage (F2 範囲)**: spec §Cross-slice contract の `Post::UseCases::ListPostsByIds(post_ids:, viewer_account_id:) → Hash<post_id => Post::V1::Post>` を完全実装。author / engagement / liked / media 全て hydrate、profile 不在は entry omit (#655/#656 と同 semantics)。
- **Additive / build-green**: handler / presenter / 他 use_case / 他 slice / proto / frontend 全て無改変。post_repo に additive 1 method 追加、新 use_case 1 file 追加のみ。
- **Placeholder 無し**: 全 task に完全コード提示。
- **型 / 命名整合**:
  - 戻り key は **String** (`hash[post.id.to_s]`) → F3 handler 側で `result[post_id.to_s]` で引く
  - `posts.map(&:author_id)` の戻り key は ProfileAuthorAdapter の戻りと同型 (両方 DB 由来) → `authors[post.author_id]` 直接 lookup OK
  - container key = `use_cases.posts.list_posts_by_ids` (spec illustrative の `use_cases.list_posts_by_ids` から namespace 整合のため修正、plan 内に注記)
- **テスト方針**: rspec baseline 67/0 維持確認、unit spec は YAGNI (F3 integration で実証)、cross-slice resolve smoke は ruby -e で確認 (環境 BLOCKED でも rspec 緑なら OK)
