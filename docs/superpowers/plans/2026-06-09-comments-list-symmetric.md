# Comments list / list_replies symmetric author resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `list_comments` / `list_replies` use_case の著者解決を **`Post::Adapters::ProfileAuthorAdapter` (symmetric / account-based)** に切替える。既に AddComment 単体で完了している symmetric 化 (#655) を List 系にも展開し、posts スライス全体の author resolution を統一する。`Post::Adapters::AuthorLoader` への 2 callers がこれにより消え、cleanup フェーズで AuthorLoader.rb 自体を drop できる状態になる。

**Architecture:** **Additive / build-green**。`list_comments.rb` / `list_replies.rb` の **2 use_case** で、`author_loader.load_authors(user_ids)` 呼び出しを ProfileAuthorAdapter ベースに置換する。戻り hash は presenter が期待する `{id, name, image_url, user_type}` 形を維持 (key は元の `comment.user_id`、`user_type: ""` で symmetric 表明)。Profile 不在時は entry 無し (AddComment fix と同じ。presenter は `author: nil` で degrade)。`AuthorLoader.rb` 本体は無改変 (cleanup フェーズで drop)、handler / presenter / proto / frontend / spec も無改変。

**Tech Stack:** Ruby / Hanami 2 / gruf (gRPC) / ROM。proto stub = `Post::V1::Comment` / `CommentAuthor`。cross-slice = `Profile::Slice["use_cases.get_profile"]` (Q3 で配線済、`ProfileAuthorAdapter` 経由)。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（§Monolith post slice の「著者解決」「`author_loader` を ProfileService 1 本に集約」、cleanup 方針）。前提: PR #651 (profile) / #652 (posts backend) / #653 (posts frontend) / #654 (post-like hoist) / #655 (comments AddComment symmetric) main マージ済。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-list-symmetric`。app root: `services/monolith/workspace`。branch `feat/comments-list-symmetric` (origin/main base = `a29378a1`)。**push しない・PR は親が判断**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith、シード済)。
- **build-green / additive**: 以下は無改変:
  - `slices/post/grpc/{comment_handler,post_handler,handler}.rb` (handler 群、AddComment 側は既に新 path)
  - `slices/post/adapters/{cast,guest,user,author_loader,media,profile_author_adapter}.rb` (旧 adapter は無改変、cleanup フェーズで drop)
  - `slices/post/presenters/comment_presenter.rb` (`many_to_proto` の lookup シグネチャは現状維持)
  - proto / frontend / spec / 他 slice
  - **use_case の signature** (`def call(post_id:, ...)` / `def call(comment_id:, ...)`) と戻り hash の key set (`{comments|replies:, next_cursor:, has_more:, authors:}`) も維持
- 変更は `list_comments.rb` と `list_replies.rb` の各 `author_loader` accessor + `author_loader.load_authors(user_ids)` 呼び出しを差し替えるだけ。

### 既存（確定、再利用する）

- **`Post::Adapters::ProfileAuthorAdapter#load(account_ids)`** (`profile_author_adapter.rb:16-30`):
  - 戻り `{p.account_id (UUID object) => AuthorInfo(account_id: String, display_name, username, avatar_url)}`
  - 内部で `Profile::Slice["use_cases.get_profile"]` + `MediaAdapter.find_by_ids` 経由で avatar URL 解決
  - profile が見つからない id は **戻り hash から除外**される (`filter_map`)
- **`CommentPresenter.many_to_proto(comments, authors:, media_files:)`** (`comment_presenter.rb:24-29`):
  ```rb
  (comments || []).map do |c|
    author = authors[c.user_id]
    to_proto(c, author: author, media_files: media_files)
  end
  ```
  → lookup key は `c.user_id` (ROM 由来の型)。新 hash も同じ key 型を保つ必要がある。
- **`CommentPresenter.author_to_proto(author_info)`** (`comment_presenter.rb:43-52`):
  - hash アクセス: `author_info[:id]` / `[:name]` / `[:image_url]` / `[:user_type]`
  - nil 入力で `return nil`
  - `user_type: author_info[:user_type] || "guest"` だが `""` は truthy なので空文字がそのまま入る (symmetric 表明維持)
- **既存 `comment_handler.rb` の AddComment fix** (#655、L149-160 推定):
  ```rb
  def get_comment_author(user_id, media_files: {})
    infos = profile_author_adapter.load([user_id]).transform_keys(&:to_s)
    info = infos[user_id.to_s]
    return nil unless info
    { id: user_id.to_s, name: info.display_name, image_url: info.avatar_url, user_type: "" }
  end
  ```
  → 同じパターンを List 系に展開する。

## File Structure

- Modify: `slices/post/use_cases/comments/list_comments.rb` (private `author_loader` accessor を `profile_author_adapter` に + `load_authors` 呼び出しを inline build_authors に置換)
- Modify: `slices/post/use_cases/comments/list_replies.rb` (同上、構造は list_comments と一致)
- Leave: `slices/post/adapters/author_loader.rb` (無改変、参照者ゼロになり cleanup PR で削除予定)

---

## Task 1: `list_comments` の author 解決を ProfileAuthorAdapter 化

**Files:** Modify `services/monolith/workspace/slices/post/use_cases/comments/list_comments.rb`。

- [ ] **Step 1: 現行コード確認**

Run: `cd services/monolith/workspace && /usr/bin/cat slices/post/use_cases/comments/list_comments.rb`
Expected: 48 行、L34 で `authors = author_loader.load_authors(user_ids)`、L41-43 で `author_loader` private accessor。

- [ ] **Step 2: 全置換**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListComments
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(post_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_user_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          comments = comment_repo.list_by_post_id(
            post_id: post_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_user_ids: exclude_user_ids
          )
          has_more = comments.length > limit
          comments = comments.first(limit) if has_more

          next_cursor = if has_more && comments.any?
            last = comments.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all comments via the unified Profile slice (symmetric).
          # Profiles that cannot be resolved (e.g. account sync lag) are omitted from the hash;
          # the presenter renders `author: nil` for those comments, matching AddComment behavior.
          user_ids = comments.map(&:user_id).uniq
          authors = build_authors(user_ids)

          { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def build_authors(user_ids)
          return {} if user_ids.empty?

          infos = profile_author_adapter.load(user_ids).transform_keys(&:to_s)
          user_ids.each_with_object({}) do |user_id, hash|
            info = infos[user_id.to_s]
            next unless info

            hash[user_id] = {
              id: user_id.to_s,
              name: info.display_name,
              image_url: info.avatar_url,
              user_type: ""
            }
          end
        end

        def profile_author_adapter
          @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
        end
      end
    end
  end
end
```

key 戦略の確証: `infos` を `.to_s` で正規化 → `user_id.to_s` で引く (型不一致を吸収)。戻り hash の **key は元の `user_id`** (presenter `authors[c.user_id]` が引けるよう、ROM 由来の型を維持)。これは #655 の AddComment fix と同じパターン。

- [ ] **Step 3: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/use_cases/comments/list_comments.rb`
Expected: `Syntax OK`。

---

## Task 2: `list_replies` を同パターンで symmetric 化

**Files:** Modify `services/monolith/workspace/slices/post/use_cases/comments/list_replies.rb`。

- [ ] **Step 1: 全置換** (`list_comments.rb` と構造ミラー、変数名 `replies` のみ違う)

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListReplies
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(comment_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_user_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          replies = comment_repo.list_replies(
            parent_id: comment_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_user_ids: exclude_user_ids
          )
          has_more = replies.length > limit
          replies = replies.first(limit) if has_more

          next_cursor = if has_more && replies.any?
            last = replies.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all replies via the unified Profile slice (symmetric).
          # Profiles that cannot be resolved are omitted; the presenter renders `author: nil`.
          user_ids = replies.map(&:user_id).uniq
          authors = build_authors(user_ids)

          { replies: replies, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def build_authors(user_ids)
          return {} if user_ids.empty?

          infos = profile_author_adapter.load(user_ids).transform_keys(&:to_s)
          user_ids.each_with_object({}) do |user_id, hash|
            info = infos[user_id.to_s]
            next unless info

            hash[user_id] = {
              id: user_id.to_s,
              name: info.display_name,
              image_url: info.avatar_url,
              user_type: ""
            }
          end
        end

        def profile_author_adapter
          @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
        end
      end
    end
  end
end
```

> **重複の意図的許容**: `build_authors` と `profile_author_adapter` accessor は list_comments と完全同形だが、2 callers 程度なら helper class 化は YAGNI (CLAUDE.md "Simplicity First")。3 callers 目が来たときに `Post::UseCases::Comments::Concerns::AuthorBuilding` 等として抽出するのが妥当。本 PR では duplicate を残す。

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/use_cases/comments/list_replies.rb`
Expected: `Syntax OK`。

---

## Task 3: rspec で回帰検証

**Files:** Tests under `spec/`。

- [ ] **Step 1: 関連 spec を grep で発見**

Run: `cd services/monolith/workspace && /usr/bin/find spec -type f \( -name "*list_comments*" -o -name "*list_replies*" \) 2>/dev/null`
Expected: 該当 spec ファイル一覧。

- [ ] **Step 2: 関連 spec を実行**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -30`
Expected: 全 pass (現状 67 examples)。assertions が `name: "Anonymous Cast"` 等の placeholder や `user_type: "cast"/"guest"` を expect している場合は fail する。

- [ ] **Step 3: fail があった場合の対応**

fail パターン別:
- **`user_type` を `"cast"` / `"guest"` で expect している spec**: → `""` (symmetric) を expect するよう更新
- **`name` が `"Anonymous Cast"` / `"Guest"` placeholder を expect している spec**: → 新 path は profile 不在で entry を出さない (nil author) ため、spec も nil 期待か、または seed で profile を追加してから expect 値を変更
- **`authors` hash の key 型不一致**: presenter 経由の統合 spec なら通るはず。直接 hash key を expect していたら ROM の `user_id` 型に合わせる
- spec の `let(:cast_adapter) { double(...) }` 等を mock している場合: ProfileAuthorAdapter または `Profile::Slice["use_cases.get_profile"]` に mock を差し替え

mock 差し替えで pass しないケース (例: profile が DB 上 seed されていない) は **`pending` / `skip` で逃げず、`Status: BLOCKED` で controller に escalate**。

---

## Task 4: commit

**Files:** なし (検証 + commit)。

- [ ] **Step 1: diff 確認**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-list-symmetric && /usr/bin/git diff --stat origin/main HEAD`
Expected: `list_comments.rb` と `list_replies.rb` のみ (+ plan)。`author_loader.rb` / 他 adapter / handler / presenter / spec に diff があれば検出 (handler/presenter は無改変、spec はもし assertion 更新したならそこも diff)。

- [ ] **Step 2: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-list-symmetric
/usr/bin/git add services/monolith/workspace/slices/post/use_cases/comments services/monolith/workspace/spec docs/superpowers/plans/2026-06-09-comments-list-symmetric.md
/usr/bin/git commit -s -m "feat(post): symmetric comment list author resolution via ProfileService"
```
（push しない。）

---

## Deferred（本 plan では実施しない）

- **`AuthorLoader.rb` の削除** → 本 PR で参照者ゼロになるが、削除は cleanup PR で旧 `CastPost` 系 RPC / `cast_adapter` / `guest_adapter` / `user_adapter` と同時に行うのが安全 (互いに連鎖参照していたら巻き添えで壊れる可能性、要 grep)
- **`build_authors` の helper 抽出** → caller が 2 つだけなので YAGNI、3 caller 目で抽出
- **`profile_author_adapter` accessor を base handler / shared concern に昇格** → post_handler / comment_handler とも accessor が散らばっており、別 PR で base に集約
- **handler 直接の spec 追加** → test infra 整備として独立 PR
- **`comment.user_type` proto field の drop** → breaking change、frontend が consume 中の間は維持

## Self-Review（作成者チェック済）

- **Spec coverage**: spec §「`author_loader` を ProfileService 1 本に集約」の comment List 範囲を完遂。AddComment 単体で先行した #655 と合わせて posts スライス内の author 解決が完全 symmetric 化。
- **Additive / build-green**: AuthorLoader.rb・全 adapter・handler・presenter・proto・frontend・他 slice 全て無改変。use_case の signature と戻り hash の key set / key 型も維持。
- **Placeholder 無し**: 2 use_case ともに完全コード提示。
- **型 / 命名整合**:
  - `infos.transform_keys(&:to_s)` で UUID オブジェクト key を String 化 (ProfileAuthorAdapter は無改変、consumer 側で吸収。#655 と同じパターン)
  - 戻り hash key は **元の `user_id`** を保持 → presenter `authors[c.user_id]` が引ける
  - hash value の key set `{id, name, image_url, user_type}` は presenter `author_to_proto` の expect と完全一致
  - `user_type: ""` で symmetric 表明 (presenter `||` フォールバックを bypass、空文字が proto に届く。#655 と同挙動)
  - profile 不在は **entry 出さず** → presenter は `authors[c.user_id]` で nil → `author: nil` proto。AddComment 新 path と同挙動、UX 退化なし (frontend は author 不在を tolerate と #655 で確認済み)
- **テスト方針**: 既存 rspec を回帰、placeholder / role を expect する assertion は symmetric 期待値に更新。新 spec 追加は YAGNI (handler / presenter の単体テストは別 PR で test infra として整備)。
- **WHY コメント**: 各 use_case の `# Load authors ... via the unified Profile slice` ブロックに「symmetric / profile 不在は nil author」の WHY を 2 行で残す。CLAUDE.md "what と why" の why 側。
