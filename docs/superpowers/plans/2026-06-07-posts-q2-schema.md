# Posts Q2: symmetric schema (author_id / account_id) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `post.posts` に `author_id`、`post.likes` に `account_id` を**追加**（旧 `cast_user_id`/`guest_user_id` から backfill、旧列は nullable 化して温存）、relation/repository を整備、seed を更新する。

**Architecture:** **Additive / build-green**。旧 `cast_user_id`/`guest_user_id` ベースの relation 属性・repo メソッド・seed・handler は**温存**（旧 CastPost/LikeCastPost handler が動き続ける）。新 `author_id`/`account_id` ベースの属性・メソッドを**別名で追加**。対称 service 実装は Q3、comments は Q2 不変（user_id 対称、著者解決は Q3）。

**Tech Stack:** Ruby / Hanami 2 / ROM-SQL（Sequel migration）/ PostgreSQL（schema `post`）/ RSpec。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（Monolith post slice / Decomposition Q2）。前提: Q1（対称 proto）完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-slice`。app root: `services/monolith/workspace`。branch `feat/posts-slice`。**push しない**。
- 検索は `/usr/bin/grep`。
- **DB**: localhost:5432（postgres/password/monolith、起動中・シード済）。`hanami db` は postgres@18 PATH が要る: `export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"`。繋げない場合 `colima start` 等。
- **dev/test 両方 migrate**: `bundle exec hanami db migrate` と `HANAMI_ENV=test bundle exec hanami db migrate`。
- **build-green / additive**: 旧 `cast_user_id`/`guest_user_id` の relation 属性・repo メソッド（`list_by_cast_user_id`, `like(guest_user_id:)` 等）は**残す**。新メソッドは**別名で追加**（kwarg 衝突回避）。

### 既存（確定）

- `post.posts`: id, **cast_user_id (NOT NULL)**, content, visibility, created_at, updated_at。relation `Post::Relations::Posts`（schema `post__posts`, as: :posts, infer:false）。
- `post.likes`: id, post_id, **guest_user_id (NOT NULL)**, created_at。relation `Post::Relations::Likes`（as: :likes）。
- `PostRepository`（`commands :create, update: :by_pk, delete: :by_pk`）: `create_post(data)` は汎用（data hash を changeset）。`list_by_cast_user_id` 等は cast ベース（温存）。
- `LikeRepository`: `like/unlike/liked?(post_id:, guest_user_id:)`, `likes_count`, `likes_count_batch`, `liked_status_batch(guest_user_id:)`（温存）。
- repo spec 例: `Hanami.app.slices[:post]["repositories.like_repository"]`, `post_repo.create_post(cast_user_id:, content:)`, `type: :database`。
- seed: `config/db/seeds/post/posts.rb`（CAST_USER_IDS で cast_user_id 投稿）、`likes.rb`（guests の guest_user_id like）。

## File Structure

- Create: `config/db/migrate/20260607000001_add_author_id_to_posts.rb`
- Create: `config/db/migrate/20260607000002_add_account_id_to_likes.rb`
- Modify: `slices/post/relations/posts.rb`（author_id 属性）、`slices/post/relations/likes.rb`（account_id 属性）
- Modify: `slices/post/repositories/post_repository.rb`（author_id メソッド追加）、`slices/post/repositories/like_repository.rb`（account_id メソッド追加）
- Modify: `config/db/seeds/post/posts.rb`（author_id）、`config/db/seeds/post/likes.rb`（account_id）
- Test: `spec/slices/post/repositories/post_repository_spec.rb` / `like_repository_spec.rb`（新メソッド追記）

---

## Task 1: マイグレーション（posts.author_id / likes.account_id）

**Files:** Create 2 migration、dev/test 適用。

- [ ] **Step 1: `config/db/migrate/20260607000001_add_author_id_to_posts.rb`**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) do
      add_column :author_id, :uuid
    end
    run "UPDATE post.posts SET author_id = cast_user_id WHERE author_id IS NULL"
    alter_table(:post__posts) do
      set_column_allow_null :cast_user_id
    end
  end

  down do
    alter_table(:post__posts) do
      set_column_not_null :cast_user_id
      drop_column :author_id
    end
  end
end
```

- [ ] **Step 2: `config/db/migrate/20260607000002_add_account_id_to_likes.rb`**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__likes) do
      add_column :account_id, :uuid
    end
    run "UPDATE post.likes SET account_id = guest_user_id WHERE account_id IS NULL"
    alter_table(:post__likes) do
      set_column_allow_null :guest_user_id
    end
    add_index :post__likes, [:post_id, :account_id],
      unique: true, name: :idx_post_likes_post_account,
      where: Sequel.lit("account_id IS NOT NULL")
  end

  down do
    drop_index :post__likes, [:post_id, :account_id], name: :idx_post_likes_post_account
    alter_table(:post__likes) do
      set_column_not_null :guest_user_id
      drop_column :account_id
    end
  end
end
```

- [ ] **Step 3: dev/test へ適用**

Run:
```
cd services/monolith/workspace
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
bundle exec hanami db migrate
HANAMI_ENV=test bundle exec hanami db migrate
```
Expected: エラーなく完了。`config/db/structure.sql` に `post.posts.author_id`・`post.likes.account_id`・`idx_post_likes_post_account` が反映、`cast_user_id`/`guest_user_id` は NOT NULL が外れる。

- [ ] **Step 4: 反映確認**

Run: `cd services/monolith/workspace && /usr/bin/grep -nE 'author_id|account_id|idx_post_likes_post_account' config/db/structure.sql | head`
Expected: 上記が出力される。

---

## Task 2: relation に新属性を追加

**Files:** Modify `slices/post/relations/posts.rb`, `slices/post/relations/likes.rb`。

- [ ] **Step 1: `posts.rb` に author_id を追加**

`attribute :cast_user_id, Types::String` の直後に:

```ruby
        attribute :author_id, Types::String.optional
```

- [ ] **Step 2: `likes.rb` に account_id を追加**

`attribute :guest_user_id, Types::String` の直後に:

```ruby
        attribute :account_id, Types::String.optional
```

（`guest_user_id` も nullable になったので `Types::String.optional` に変えてよいが、温存優先で属性追加のみで可。）

- [ ] **Step 3: boot 確認**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require './config/app'; Hanami.app.prepare; p Hanami.app.slices[:post]['relations.posts'].schema.attributes.map(&:name).include?(:author_id); p Hanami.app.slices[:post]['relations.likes'].schema.attributes.map(&:name).include?(:account_id); puts 'ok'" 2>&1 | tail -5`
Expected: `true` / `true` / `ok`。

---

## Task 3: repository に対称メソッドを追加（TDD）

**Files:** Test `spec/slices/post/repositories/{post,like}_repository_spec.rb`; Modify repos。

- [ ] **Step 1: 失敗するテストを追記**

`spec/slices/post/repositories/like_repository_spec.rb` の最後の `end`（describe ブロック群の後、最外 `end` の前）に追加:

```ruby
  describe "account-based likes (symmetric)" do
    let(:account_id) { SecureRandom.uuid_v7 }
    let(:post2) { post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "sym post", visibility: "public") }

    it "creates and detects a like by account" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      expect(repo.account_liked?(post_id: post2.id, account_id: account_id)).to be true
    end

    it "does not duplicate" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      repo.account_like(post_id: post2.id, account_id: account_id)
      expect(repo.likes_count(post_id: post2.id)).to eq(1)
    end

    it "unlikes" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      repo.account_unlike(post_id: post2.id, account_id: account_id)
      expect(repo.account_liked?(post_id: post2.id, account_id: account_id)).to be false
    end

    it "batch status" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      status = repo.account_liked_status_batch(post_ids: [post2.id], account_id: account_id)
      expect(status[post2.id]).to be true
    end
  end
```

`spec/slices/post/repositories/post_repository_spec.rb` の最外 `end` の前に追加:

```ruby
  describe "author-based queries (symmetric)" do
    let(:author_id) { SecureRandom.uuid_v7 }

    it "creates a post with author_id (no cast_user_id) and finds it" do
      created = repo.create_post(author_id: author_id, content: "hello", visibility: "public")
      found = repo.find_by_id_and_author(id: created.id, author_id: author_id)
      expect(found).not_to be_nil
      expect(found.content).to eq("hello")
    end

    it "lists public posts by author_id" do
      repo.create_post(author_id: author_id, content: "p1", visibility: "public")
      repo.create_post(author_id: author_id, content: "p2", visibility: "private")
      result = repo.list_posts(author_id: author_id)
      expect(result.map(&:content)).to include("p1")
      expect(result.map(&:content)).not_to include("p2")
    end
  end
```

- [ ] **Step 2: 失敗を確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/repositories/like_repository_spec.rb spec/slices/post/repositories/post_repository_spec.rb 2>&1 | tail -8`
Expected: 新規 example が FAIL（`account_like` / `find_by_id_and_author` / `list_posts` 未定義、または create_post が cast_user_id NOT NULL で失敗 → 本タスクの migration 適用後なら NoMethodError）。

- [ ] **Step 3: `like_repository.rb` に account メソッドを追加**

`class LikeRepository < Post::DB::Repo` 内（末尾 `end` の前）に追加（旧 guest_user_id メソッドは残す）:

```ruby
      def account_like(post_id:, account_id:)
        existing = likes.where(post_id: post_id, account_id: account_id).one
        return if existing

        likes.changeset(:create, id: SecureRandom.uuid_v7, post_id: post_id, account_id: account_id).commit
      end

      def account_unlike(post_id:, account_id:)
        likes.dataset.where(post_id: post_id, account_id: account_id).delete
      end

      def account_liked?(post_id:, account_id:)
        likes.where(post_id: post_id, account_id: account_id).exist?
      end

      def account_liked_status_batch(post_ids:, account_id:)
        return {} if post_ids.empty? || account_id.nil?

        liked_ids = likes.dataset
          .where(post_id: post_ids, account_id: account_id)
          .select_map(:post_id)

        post_ids.each_with_object({}) do |id, hash|
          hash[id] = liked_ids.include?(id)
        end
      end
```

- [ ] **Step 4: `post_repository.rb` に author メソッドを追加**

`class PostRepository < Post::DB::Repo` 内（末尾 `end` の前）に追加（旧 cast メソッドは残す）:

```ruby
      def list_posts(limit: 20, cursor: nil, author_id: nil)
        scope = posts.combine(:post_media, :hashtags).exclude(author_id: nil).where(visibility: "public")
        scope = scope.where(author_id: author_id) if author_id

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def find_by_id_and_author(id:, author_id:)
        posts.combine(:post_media, :hashtags).where(id: id, author_id: author_id).one
      end
```

- [ ] **Step 5: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/repositories/like_repository_spec.rb spec/slices/post/repositories/post_repository_spec.rb 2>&1 | tail -8`
Expected: 全 example PASS（新規含む、既存の cast/guest 系も不変で green）。

---

## Task 4: seed 更新 + 全体検証 + コミット

**Files:** Modify `config/db/seeds/post/posts.rb`, `config/db/seeds/post/likes.rb`。

- [ ] **Step 1: `config/db/seeds/post/posts.rb` の insert に author_id を追加**

`db[:"post__posts"].insert(` の `cast_user_id: cast_user_id,` の直後に:

```ruby
      author_id: cast_user_id,
```

- [ ] **Step 2: `config/db/seeds/post/likes.rb` の insert に account_id を追加**

`db[:"post__likes"].insert(` の `guest_user_id: guest[:user_id],` の直後に:

```ruby
      account_id: guest[:user_id],
```

- [ ] **Step 3: post スライス全体で回帰なし**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | tail -6`
Expected: 新規 example 追加・全 green（既存 cast/guest 系 spec は不変）。pre-existing 失敗があればそのまま（新規失敗ゼロ）。

- [ ] **Step 4: db prepare が green**

Run: `cd services/monolith/workspace && export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH" && bundle exec hanami db prepare 2>&1 | tail -6`
Expected: 成功（seed の author_id/account_id 反映）。

- [ ] **Step 5: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/monolith/workspace
git add config/db/migrate config/db/structure.sql slices/post/relations slices/post/repositories config/db/seeds/post spec/slices/post/repositories
git commit -s -m "feat(post): add symmetric author_id/account_id schema (additive)"
```
（push しない。）

---

## Deferred（Q2 では実施しない）

- 対称 PostService/LikeService 実装（著者＝ProfileService、author_loader 集約）+ comments 著者解決 → **Q3**。
- frontend → **Q4**。
- 旧 `cast_user_id`/`guest_user_id` 列・cast/guest 系メソッド・旧 handler drop → **cleanup**。

## Self-Review（作成者チェック済）

- **Spec coverage（Q2 範囲）**: `posts.author_id`（cast_user_id backfill + nullable 化）、`likes.account_id`（guest_user_id backfill + nullable + unique(post_id,account_id)）、relation 属性、author/account ベース repo メソッド、seed 更新。comments は Q2 不変（spec の decomposition 通り）。
- **Additive で build-green**: 旧列・旧 relation 属性・旧 repo メソッド・旧 handler は無改変。新メソッドは別名（account_*/list_posts/find_by_id_and_author）で kwarg 衝突回避。`cast_user_id` NOT NULL→nullable は後方互換（旧コードは常に値を入れる）。
- **Placeholder 無し**: migration/relation/repo/spec/seed すべて完全コード。
- **型/命名整合**: `list_posts(author_id:)` / `find_by_id_and_author(id:, author_id:)` / `account_like/unlike/liked?/liked_status_batch(account_id:)`。`create_post(author_id:, content:, visibility:)` は cast_user_id nullable 化後に通る。container キー `repositories.{post,like}_repository` / `relations.{posts,likes}`。
- **検証**: dev/test migrate、TDD（RED→GREEN）、`rspec spec/slices/post`、`db prepare`。
