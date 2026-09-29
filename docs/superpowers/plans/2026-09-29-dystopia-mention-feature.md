# Mention Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿・コメント・リプライの本文中の `@username` を account_id とリンクさせて永続化し、username変更後も正しくリンクされる形で表示し、メンションされたユーザーへ通知する。

**Architecture:** `post.post_mentions`/`post.comment_mentions` テーブルに `(account_id, position, length)` を保存する新設 `Post::UseCases::ExtractMentions` を投稿保存・コメント作成の双方から呼ぶ。表示時は保存済みaccount_idから都度現在のusernameを解決してproto化し、フロントエンドは `content` と `mentions`（position/length）から该当箇所だけリンクにレンダリングする。

**Tech Stack:** Ruby (Hanami 2 / ROM-SQL / gRPC via gruf) monolith, Next.js/TypeScript frontend, protobuf (buf)。

**Spec:** `docs/superpowers/specs/2026-09-29-mention-feature-design.md`

## Global Constraints

- position/lengthはUnicodeコードポイント単位。Ruby側は`String#scan`+`MatchData#begin(0)`（既にコードポイント単位）、フロント側は`Array.from(content)`で変換してから適用する（UTF-16サロゲートペア対策）
- usernameの文字種は`/\A[A-Za-z0-9_]{3,30}\z/`（`Profile::UseCases::CheckUsernameAvailability::USERNAME_FORMAT`と同一）
- username解決は大文字小文字を区別しない（`ProfileRepository#find_by_username`が`lower(username)`比較のため）
- 存在しないusernameは投稿を失敗させず、静かに無視する
- 通知は新規作成時のみ発火し、投稿編集時には発火しない
- コメント・リプライには編集機能自体が存在しない（`AddComment`/`DeleteComment`のみ）
- コミットメッセージに`Co-Authored-By`を含めない

## Review Focus

- 空contentや`@`だけ・`@`の直後にusername文字が続かない入力でExtractMentionsが例外を出さないこと
- 同一投稿内で同じusernameを複数回メンションした場合に、位置が異なる複数のmentionレコードとして保存され、通知は`Notifications::Emit`の`ON CONFLICT`によって1件にまとまること
- 自己メンション（`@自分のusername`）で通知が飛ばないこと（`Emit`の`recipient_id == actor_id`ガードに委譲）
- ブロック関係にあるユーザーをメンションした場合に通知が飛ばないこと（`Emit`の既存ブロックガードに委譲）
- `PostCard`のように投稿全体が`/posts/{id}`への`<Link>`で包まれている文脈で、メンションリンクをネストした`<a>`にせず正しく`/u/{username}`へ遷移できること（クリック伝播を止める）

---

## Task 1: Post mentions migration + relation + repository

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260929000000_create_post_mentions.rb`
- Create: `dystopia/monolith/slices/post/relations/post_mentions.rb`
- Modify: `dystopia/monolith/slices/post/relations/posts.rb`
- Modify: `dystopia/monolith/slices/post/repositories/post_repository.rb`
- Test: `dystopia/monolith/spec/slices/post/repositories/post_repository_spec.rb`

**Interfaces:**
- Produces: `PostRepository#save_mentions(post_id:, mentions:)`（`mentions`は`{ account_id:, position:, length: }`の配列）。`find_by_id`/`find_by_ids`/`find_by_id_and_author`/`list_posts`が返す行は`.post_mentions`（`position`/`length`/`account_id`を持つ行の配列）を持つ

- [ ] **Step 1: マイグレーションを書く**

```ruby
# dystopia/monolith/config/db/migrate/20260929000000_create_post_mentions.rb
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :post__post_mentions do
      column :id, :uuid, null: false
      column :post_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :position, :integer, null: false
      column :length, :integer, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      index :account_id
      foreign_key [:post_id], :post__posts, on_delete: :cascade
    end
  end

  down do
    drop_table :post__post_mentions
  end
end
```

- [ ] **Step 2: マイグレーションを実行して確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: エラーなく完了し、`post.post_mentions`テーブルが作成される

- [ ] **Step 3: リレーションを書く**

```ruby
# dystopia/monolith/slices/post/relations/post_mentions.rb
# frozen_string_literal: true

module Post
  module Relations
    class PostMentions < Post::DB::Relation
      schema(:"post__post_mentions", as: :post_mentions, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :account_id, Types::String
        attribute :position, Types::Integer
        attribute :length, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :posts, foreign_key: :post_id
        end
      end
    end
  end
end
```

`dystopia/monolith/slices/post/relations/posts.rb`の`associations`ブロックに`has_many :post_mentions, foreign_key: :post_id`を追加する（既存の`has_many :post_media, foreign_key: :post_id` / `has_many :hashtags, foreign_key: :post_id`の並びに追記）。

- [ ] **Step 4: 失敗するテストを書く（repository）**

`dystopia/monolith/spec/slices/post/repositories/post_repository_spec.rb`の`#save_hashtags`の`describe`ブロックの直後に追記する:

```ruby
describe "#save_mentions" do
  it "saves mentions for a post" do
    post = repo.create_post(author_id: cast_id, content: "@alice hi")
    mentioned_id = SecureRandom.uuid_v7
    repo.save_mentions(post_id: post.id, mentions: [{ account_id: mentioned_id, position: 0, length: 6 }])

    result = repo.find_by_id(post.id)
    expect(result.post_mentions.length).to eq(1)
    expect(result.post_mentions.first.account_id).to eq(mentioned_id)
    expect(result.post_mentions.first.position).to eq(0)
    expect(result.post_mentions.first.length).to eq(6)
  end

  it "replaces existing mentions" do
    post = repo.create_post(author_id: cast_id, content: "@a @b")
    id_a = SecureRandom.uuid_v7
    id_b = SecureRandom.uuid_v7
    repo.save_mentions(post_id: post.id, mentions: [{ account_id: id_a, position: 0, length: 2 }])
    repo.save_mentions(post_id: post.id, mentions: [{ account_id: id_b, position: 3, length: 2 }])

    result = repo.find_by_id(post.id)
    expect(result.post_mentions.map(&:account_id)).to eq([id_b])
  end
end
```

- [ ] **Step 5: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/repositories/post_repository_spec.rb -e "#save_mentions"`
Expected: FAIL（`save_mentions`が未定義、または`post_mentions`アソシエーションが解決できない）

- [ ] **Step 6: `PostRepository`に`save_mentions`を実装し、既存の`combine`呼び出しに`:post_mentions`を追加する**

`dystopia/monolith/slices/post/repositories/post_repository.rb`を以下のように変更する:

1. `find_by_id`: `posts.combine(:post_media, :hashtags).by_pk(id).one` → `posts.combine(:post_media, :hashtags, :post_mentions).by_pk(id).one`
2. `find_by_ids`: `posts.combine(:post_media, :hashtags).where(id: ids).to_a` → `posts.combine(:post_media, :hashtags, :post_mentions).where(id: ids).to_a`
3. `list_posts`: `posts.combine(:post_media, :hashtags).exclude(...)` → `posts.combine(:post_media, :hashtags, :post_mentions).exclude(...)`
4. `find_by_id_and_author`: `posts.combine(:post_media, :hashtags).where(...)` → `posts.combine(:post_media, :hashtags, :post_mentions).where(...)`
5. `save_hashtags`メソッドの直後に追加:

```ruby
def save_mentions(post_id:, mentions:)
  post_mentions.dataset.where(post_id: post_id).delete
  mentions.each do |mention|
    post_mentions.changeset(
      :create,
      id: SecureRandom.uuid_v7,
      post_id: post_id,
      account_id: mention[:account_id],
      position: mention[:position],
      length: mention[:length]
    ).commit
  end
end
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/repositories/post_repository_spec.rb`
Expected: PASS（全件、既存テストの回帰も含めて）

- [ ] **Step 8: コミット**

```bash
git add dystopia/monolith/config/db/migrate/20260929000000_create_post_mentions.rb \
  dystopia/monolith/slices/post/relations/post_mentions.rb \
  dystopia/monolith/slices/post/relations/posts.rb \
  dystopia/monolith/slices/post/repositories/post_repository.rb \
  dystopia/monolith/spec/slices/post/repositories/post_repository_spec.rb
git commit -s -m "feat(dystopia): add post_mentions table and repository support"
```

---

## Task 2: Comment mentions migration + relation + repository

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260929000001_create_comment_mentions.rb`
- Create: `dystopia/monolith/slices/post/relations/comment_mentions.rb`
- Modify: `dystopia/monolith/slices/post/relations/comments.rb`
- Modify: `dystopia/monolith/slices/post/repositories/comment_repository.rb`
- Test: `dystopia/monolith/spec/slices/post/repositories/comment_repository_spec.rb`

**Interfaces:**
- Produces: `CommentRepository#create_comment(post_id:, user_id:, content:, parent_id: nil, media: [], mentions: [])`（`mentions:`引数が追加される）。戻り値の`.comment_mentions`に保存されたmentionが入る

- [ ] **Step 1: マイグレーションを書く**

```ruby
# dystopia/monolith/config/db/migrate/20260929000001_create_comment_mentions.rb
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :post__comment_mentions do
      column :id, :uuid, null: false
      column :comment_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :position, :integer, null: false
      column :length, :integer, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :comment_id
      index :account_id
      foreign_key [:comment_id], :post__comments, on_delete: :cascade
    end
  end

  down do
    drop_table :post__comment_mentions
  end
end
```

- [ ] **Step 2: マイグレーションを実行して確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: エラーなく完了し、`post.comment_mentions`テーブルが作成される

- [ ] **Step 3: リレーションを書く**

```ruby
# dystopia/monolith/slices/post/relations/comment_mentions.rb
# frozen_string_literal: true

module Post
  module Relations
    class CommentMentions < Post::DB::Relation
      schema(:"post__comment_mentions", as: :comment_mentions, infer: false) do
        attribute :id, Types::String
        attribute :comment_id, Types::String
        attribute :account_id, Types::String
        attribute :position, Types::Integer
        attribute :length, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :comments, foreign_key: :comment_id
        end
      end
    end
  end
end
```

`dystopia/monolith/slices/post/relations/comments.rb`の`associations`ブロックに`has_many :comment_mentions, foreign_key: :comment_id`を追加する（既存の`has_many :comment_media, foreign_key: :comment_id`の並びに追記）。

- [ ] **Step 4: 失敗するテストを書く（repository）**

`dystopia/monolith/spec/slices/post/repositories/comment_repository_spec.rb`に、`#create_comment`を検証している`describe`ブロック内（もしくはその直後）に追記する:

```ruby
describe "#create_comment with mentions" do
  it "saves mentions alongside the comment" do
    post = post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "post")
    mentioned_id = SecureRandom.uuid_v7

    comment = repo.create_comment(
      post_id: post.id,
      user_id: SecureRandom.uuid_v7,
      content: "@alice hi",
      mentions: [{ account_id: mentioned_id, position: 0, length: 6 }]
    )

    expect(comment.comment_mentions.length).to eq(1)
    expect(comment.comment_mentions.first.account_id).to eq(mentioned_id)
  end

  it "creates a comment with no mentions when the array is empty" do
    post = post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "post")

    comment = repo.create_comment(post_id: post.id, user_id: SecureRandom.uuid_v7, content: "hi")

    expect(comment.comment_mentions).to eq([])
  end
end
```

`post_repo`のletが未定義であれば`let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }`をファイル冒頭の`let`群に追加する（既存の`repo`定義と並べる）。

- [ ] **Step 5: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/repositories/comment_repository_spec.rb -e "with mentions"`
Expected: FAIL（`create_comment`が`mentions:`キーワード引数を受け付けない）

- [ ] **Step 6: `CommentRepository`を実装する**

`dystopia/monolith/slices/post/repositories/comment_repository.rb`を変更する。

`create_comment`のシグネチャと本体:

```ruby
def create_comment(post_id:, user_id:, content:, parent_id: nil, media: [], mentions: [])
  if parent_id
    parent = comments.where(id: parent_id).one
    return nil unless parent
    return nil if parent.parent_id # Cannot reply to a reply
  end

  comment_data = {
    id: SecureRandom.uuid_v7,
    post_id: post_id,
    user_id: user_id,
    content: content,
    parent_id: parent_id,
    replies_count: 0
  }

  comment = comments.changeset(:create, comment_data).commit

  save_media(comment_id: comment.id, media_data: media) if media.any?
  save_mentions(comment_id: comment.id, mentions: mentions) if mentions.any?

  if parent_id
    comments.dataset.where(id: parent_id).update(
      replies_count: Sequel.expr(:replies_count) + 1
    )
  end

  find_by_id(comment.id)
end
```

`find_by_id`/`list_by_post_id`/`list_replies`/`list_by_author`の4箇所すべてで`comments.combine(:comment_media)` → `comments.combine(:comment_media, :comment_mentions)`に変更する。

`save_media`の直後（`private`セクション内）に追加:

```ruby
def save_mentions(comment_id:, mentions:)
  mentions.each do |mention|
    comment_mentions.changeset(
      :create,
      id: SecureRandom.uuid_v7,
      comment_id: comment_id,
      account_id: mention[:account_id],
      position: mention[:position],
      length: mention[:length]
    ).commit
  end
end
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/repositories/comment_repository_spec.rb`
Expected: PASS（全件）

- [ ] **Step 8: コミット**

```bash
git add dystopia/monolith/config/db/migrate/20260929000001_create_comment_mentions.rb \
  dystopia/monolith/slices/post/relations/comment_mentions.rb \
  dystopia/monolith/slices/post/relations/comments.rb \
  dystopia/monolith/slices/post/repositories/comment_repository.rb \
  dystopia/monolith/spec/slices/post/repositories/comment_repository_spec.rb
git commit -s -m "feat(dystopia): add comment_mentions table and repository support"
```

---

## Task 3: `Post::UseCases::ExtractMentions`

**Files:**
- Create: `dystopia/monolith/slices/post/use_cases/extract_mentions.rb`
- Test: `dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb`

**Interfaces:**
- Consumes: `Profile::Slice["repositories.profile_repository"]#find_by_username(username)`（既存、大文字小文字を区別せず検索し、見つからなければ`nil`を返す。見つかった場合`.account_id`を持つ行を返す）
- Produces: `ExtractMentions#call(content:)` → `[{ account_id: String, position: Integer, length: Integer }, ...]`（Deps経由で`Post::Slice["use_cases.extract_mentions"]`として解決可能）

- [ ] **Step 1: 失敗するテストを書く**

```ruby
# dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::ExtractMentions", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.extract_mentions"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  def create_profile(username:)
    id = SecureRandom.uuid_v7
    profile_repo.create(account_id: id, display_name: username, username: username)
    id
  end

  it "returns an empty array for content with no mentions" do
    expect(use_case.call(content: "hello world")).to eq([])
  end

  it "returns an empty array for empty content" do
    expect(use_case.call(content: "")).to eq([])
  end

  it "resolves a single mention to its account_id, position, and length" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "hi @alice_1!")

    expect(result).to eq([{ account_id: id, position: 3, length: 8 }])
  end

  it "resolves multiple mentions at their respective positions" do
    id_a = create_profile(username: "alice_1")
    id_b = create_profile(username: "bob_2")

    result = use_case.call(content: "@alice_1 and @bob_2")

    expect(result).to eq([
      { account_id: id_a, position: 0, length: 8 },
      { account_id: id_b, position: 13, length: 6 }
    ])
  end

  it "ignores candidates that do not resolve to an existing account" do
    result = use_case.call(content: "hi @nobody_here_xyz")

    expect(result).to eq([])
  end

  it "resolves usernames case-insensitively" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "@ALICE_1")

    expect(result).to eq([{ account_id: id, position: 0, length: 8 }])
  end

  it "does not match a candidate immediately followed by another word character" do
    create_profile(username: "alice")

    result = use_case.call(content: "@alice_and_more")

    expect(result).to eq([])
  end

  it "keeps repeated mentions of the same account as separate entries" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "@alice_1 @alice_1")

    expect(result).to eq([
      { account_id: id, position: 0, length: 8 },
      { account_id: id, position: 9, length: 8 }
    ])
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/extract_mentions_spec.rb`
Expected: FAIL（`use_cases.extract_mentions`がコンテナに存在しない）

- [ ] **Step 3: `ExtractMentions`を実装する**

```ruby
# dystopia/monolith/slices/post/use_cases/extract_mentions.rb
# frozen_string_literal: true

module Post
  module UseCases
    class ExtractMentions
      MENTION_PATTERN = /@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/

      def initialize(profile_repo: nil)
        @profile_repo = profile_repo
      end

      def call(content:)
        return [] if content.to_s.empty?

        matches = []
        content.to_s.scan(MENTION_PATTERN) { matches << Regexp.last_match }

        matches.filter_map do |match|
          account = profile_repo.find_by_username(match[1])
          next unless account

          { account_id: account.account_id.to_s, position: match.begin(0), length: match[0].length }
        end
      end

      private

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end
    end
  end
end
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/extract_mentions_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/slices/post/use_cases/extract_mentions.rb \
  dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb
git commit -s -m "feat(dystopia): add ExtractMentions use case"
```

---

## Task 4: Notifications preference wiring

**Files:**
- Modify: `dystopia/monolith/slices/notifications/use_cases/emit.rb`
- Test: `dystopia/monolith/spec/slices/notifications/use_cases/emit_spec.rb` (create)

**Interfaces:**
- Produces: `type: "mention"`で`Notifications::UseCases::Emit`を呼ぶと`preferences.mention`カラムでON/OFFを制御できる

- [ ] **Step 1: 失敗するテストを書く**

既存の`spec/slices/notifications/use_cases/`には`purge_account_spec.rb`しかないため新規ファイルを作成する:

```ruby
# dystopia/monolith/spec/slices/notifications/use_cases/emit_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Notifications::UseCases::Emit", type: :database do
  let(:use_case) { Hanami.app.slices[:notifications]["use_cases.emit"] }
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:update_preferences) { Hanami.app.slices[:notifications]["use_cases.update_preferences"] }

  let(:recipient_id) { SecureRandom.uuid_v7 }
  let(:actor_id) { SecureRandom.uuid_v7 }

  it "emits a mention notification by default" do
    result = use_case.call(
      recipient_id: recipient_id,
      type: "mention",
      target_resource_id: "post-1",
      actor_id: actor_id
    )

    expect(result).not_to be_nil
    expect(notification_repo.list(recipient_id: recipient_id).first.type).to eq("mention")
  end

  it "does not emit a mention notification when the recipient disabled it" do
    update_preferences.call(account_id: recipient_id, preferences: { mention: false })

    result = use_case.call(
      recipient_id: recipient_id,
      type: "mention",
      target_resource_id: "post-1",
      actor_id: actor_id
    )

    expect(result).to be_nil
    expect(notification_repo.list(recipient_id: recipient_id)).to eq([])
  end
end
```

`update_preferences`の呼び出しシグネチャが異なる場合は`dystopia/monolith/slices/notifications/use_cases/update_preferences.rb`を確認して実際の引数名に合わせる。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/emit_spec.rb`
Expected: 2件目のテストがFAIL（`PREFERENCE_FIELD_BY_TYPE`に`"mention"`のマッピングがないため、常に通知が発火し無効化されない）

- [ ] **Step 3: `PREFERENCE_FIELD_BY_TYPE`に追加する**

`dystopia/monolith/slices/notifications/use_cases/emit.rb`の`PREFERENCE_FIELD_BY_TYPE`定数に`"mention" => :mention`を追加する:

```ruby
PREFERENCE_FIELD_BY_TYPE = {
  "like" => :like,
  "comment" => :post,
  "reply" => :reply,
  "follow_request" => :follow,
  "follow_approved" => :follow,
  "mention" => :mention
}.freeze
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/emit_spec.rb`
Expected: PASS（両方）

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/slices/notifications/use_cases/emit.rb \
  dystopia/monolith/spec/slices/notifications/use_cases/emit_spec.rb
git commit -s -m "feat(dystopia): wire mention notification type to preferences"
```

---

## Task 5: Proto changes + stub regeneration

**Files:**
- Modify: `proto/dystopia/post/v1/post_service.proto`
- Modify: `proto/dystopia/post/v1/comment_service.proto`
- Regenerate: `dystopia/monolith/stubs/post/v1/*` (via buf)
- Regenerate: `dystopia/frontend/src/stub/post/v1/*` (via buf)

**Interfaces:**
- Produces: `Post::V1::PostMention`（Ruby）/ `PostMention`（TS, `@/stub/post/v1/post_service_pb`）with fields `account_id`/`username`/`position`/`length`（Rubyはsnake_case、TSはcamelCase: `accountId`）。`Post::V1::Post#mentions`・`Post::V1::Comment#mentions`（Rubyメソッド名は`mentions`）

- [ ] **Step 1: `post_service.proto`に`PostMention`メッセージと`Post.mentions`フィールドを追加する**

`proto/dystopia/post/v1/post_service.proto`の`message PostMedia { ... }`の直前に追加:

```proto
message PostMention {
  string account_id = 1;
  string username = 2;
  int32 position = 3;
  int32 length = 4;
}
```

`message Post { ... }`の末尾（`bool liked = 11;`の次）に追加:

```proto
  repeated PostMention mentions = 12;
```

- [ ] **Step 2: `comment_service.proto`に`Comment.mentions`フィールドを追加する**

`message Comment { ... }`の末尾（`int32 replies_count = 9;`の次）に追加:

```proto
  repeated PostMention mentions = 10;
```

（`comment_service.proto`は既に`import "post/v1/post_service.proto";`しており、同一パッケージ`post.v1`のため`PostMention`を無修飾で参照できる）

- [ ] **Step 3: protoの構文を確認する**

Run: `cd proto/dystopia && buf lint`
Expected: エラーなし

- [ ] **Step 4: monolith側のRubyスタブを再生成する**

Run: `cd dystopia/monolith && buf generate ../../proto/dystopia`
Expected: `stubs/post/v1/post_service_pb.rb`・`stubs/post/v1/comment_service_pb.rb`が更新される（`PostMention`クラス・`mentions`フィールドが追加される）

- [ ] **Step 5: monolithが正常に起動することを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec ruby -e 'require "hanami/prepare"; puts Post::V1::PostMention.new(account_id: "a", username: "b", position: 1, length: 2).inspect'`
Expected: エラーなくインスタンスが出力される

- [ ] **Step 6: frontend側のTSスタブを再生成する**

Run: `cd dystopia/frontend && pnpm proto:gen`
Expected: `src/stub/post/v1/post_service_pb.ts`・`src/stub/post/v1/comment_service_pb.ts`に`PostMention`型と`mentions`フィールドが追加される

- [ ] **Step 7: フロントの型チェックを実行する**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: 既存コードは`mentions`フィールドを参照していないため、この時点ではエラーなし（後続タスクで型を使い始める）

- [ ] **Step 8: コミット**

```bash
git add proto/dystopia/post/v1/post_service.proto \
  proto/dystopia/post/v1/comment_service.proto \
  dystopia/monolith/stubs/post/v1/post_service_pb.rb \
  dystopia/monolith/stubs/post/v1/post_service_services_pb.rb \
  dystopia/monolith/stubs/post/v1/comment_service_pb.rb \
  dystopia/monolith/stubs/post/v1/comment_service_services_pb.rb \
  dystopia/frontend/src/stub/post/v1/post_service_pb.ts \
  dystopia/frontend/src/stub/post/v1/comment_service_pb.ts
git commit -s -m "feat(dystopia): add PostMention to post/comment proto"
```

実際に変更されたスタブファイル名は`buf generate`の出力に応じて調整すること（生成物のファイル名が上記と異なる場合、`git status`で確認して該当ファイルを追加する）。

---

## Task 6: `PostPresenter` mentioned_usernames wiring

**Files:**
- Modify: `dystopia/monolith/slices/post/presenters/post_presenter.rb`
- Test: `dystopia/monolith/spec/slices/post/presenters/post_presenter_spec.rb` (create)

**Interfaces:**
- Consumes: `post.post_mentions`（Task 1で追加。各要素が`.account_id`/`.position`/`.length`を持つ）
- Produces: `PostPresenter.to_post_proto(post, author:, likes_count:, comments_count:, liked:, media_files:, mentioned_usernames: {})` — `mentioned_usernames`は`{ "account-id" => "username" }`のHash。戻り値の`Post::V1::Post#mentions`に反映される

- [ ] **Step 1: 失敗するテストを書く**

```ruby
# dystopia/monolith/spec/slices/post/presenters/post_presenter_spec.rb
# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"
require "slices/post/presenters/post_presenter"

RSpec.describe Post::Presenters::PostPresenter do
  describe ".to_post_proto mentions" do
    let(:mention) { double(:mention, account_id: "mentioned-1", position: 3, length: 6) }
    let(:post) do
      double(
        :post,
        id: "post-1",
        author_id: "author-1",
        content: "hi @alice",
        created_at: Time.now,
        post_media: [],
        hashtags: [],
        post_mentions: [mention],
        visibility: "public"
      )
    end

    it "resolves the mentioned account's current username" do
      proto = described_class.to_post_proto(post, mentioned_usernames: { "mentioned-1" => "alice_now" })

      expect(proto.mentions.length).to eq(1)
      expect(proto.mentions.first.account_id).to eq("mentioned-1")
      expect(proto.mentions.first.username).to eq("alice_now")
      expect(proto.mentions.first.position).to eq(3)
      expect(proto.mentions.first.length).to eq(6)
    end

    it "defaults to an empty username when unresolved" do
      proto = described_class.to_post_proto(post, mentioned_usernames: {})

      expect(proto.mentions.first.username).to eq("")
    end

    it "defaults to no mentions when the post has none" do
      no_mention_post = double(
        :post, id: "post-2", author_id: "author-1", content: "hi", created_at: Time.now,
        post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )

      proto = described_class.to_post_proto(no_mention_post)

      expect(proto.mentions).to eq([])
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post/presenters/post_presenter_spec.rb`
Expected: FAIL（`to_post_proto`が`mentioned_usernames:`キーワード引数を受け付けない、または`mentions`が組み立てられない）

- [ ] **Step 3: `PostPresenter`を実装する**

`dystopia/monolith/slices/post/presenters/post_presenter.rb`を変更する:

```ruby
def self.to_post_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false, media_files: {}, mentioned_usernames: {})
  return nil unless post

  media = (post.respond_to?(:post_media) ? post.post_media : []) || []
  hashtags = (post.respond_to?(:hashtags) ? post.hashtags : []) || []
  mentions = (post.respond_to?(:post_mentions) ? post.post_mentions : []) || []

  ::Post::V1::Post.new(
    id: post.id.to_s,
    author_id: post.author_id.to_s,
    content: post.content,
    media: media.sort_by(&:position).map { |m| post_media_to_proto(m, media_files: media_files) },
    created_at: post.created_at.iso8601,
    author: post_author_to_proto(author),
    likes_count: likes_count,
    comments_count: comments_count,
    visibility: post.respond_to?(:visibility) ? post.visibility : "public",
    hashtags: hashtags.sort_by(&:position).map(&:tag),
    liked: liked,
    mentions: mentions.map { |m| mention_to_proto(m, mentioned_usernames: mentioned_usernames) }
  )
end

def self.mention_to_proto(mention, mentioned_usernames: {})
  ::Post::V1::PostMention.new(
    account_id: mention.account_id.to_s,
    username: mentioned_usernames[mention.account_id.to_s] || "",
    position: mention.position,
    length: mention.length
  )
end
```

（`self.mention_to_proto`は`self.post_media_to_proto`の直後に追加する）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post/presenters/post_presenter_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/slices/post/presenters/post_presenter.rb \
  dystopia/monolith/spec/slices/post/presenters/post_presenter_spec.rb
git commit -s -m "feat(dystopia): resolve mention usernames in PostPresenter"
```

---

## Task 7: `CommentPresenter` mentioned_usernames wiring

**Files:**
- Modify: `dystopia/monolith/slices/post/presenters/comment_presenter.rb`
- Test: `dystopia/monolith/spec/slices/post/presenters/comment_presenter_spec.rb`

**Interfaces:**
- Consumes: `comment.comment_mentions`（Task 2で追加）
- Produces: `CommentPresenter.to_proto(comment, author: nil, media_files: {}, mentioned_usernames: {})` / `.many_to_proto(comments, authors: {}, media_files: {}, mentioned_usernames: {})`。戻り値の`Post::V1::Comment#mentions`に反映される

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/monolith/spec/slices/post/presenters/comment_presenter_spec.rb`の末尾（既存`describe ".author_to_proto"`ブロックの後）に追記する:

```ruby
describe ".to_proto mentions" do
  let(:mention) { double(:mention, account_id: "mentioned-1", position: 0, length: 6) }
  let(:comment) do
    double(
      :comment,
      id: "comment-1",
      post_id: "post-1",
      parent_id: nil,
      user_id: "user-1",
      content: "@alice hi",
      created_at: Time.now,
      comment_media: [],
      comment_mentions: [mention],
      replies_count: 0
    )
  end

  it "resolves the mentioned account's current username" do
    proto = described_class.to_proto(comment, mentioned_usernames: { "mentioned-1" => "alice_now" })

    expect(proto.mentions.length).to eq(1)
    expect(proto.mentions.first.username).to eq("alice_now")
  end

  it "defaults to an empty username when unresolved" do
    proto = described_class.to_proto(comment, mentioned_usernames: {})

    expect(proto.mentions.first.username).to eq("")
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post/presenters/comment_presenter_spec.rb`
Expected: FAIL

- [ ] **Step 3: `CommentPresenter`を実装する**

`dystopia/monolith/slices/post/presenters/comment_presenter.rb`を変更する:

```ruby
def self.to_proto(comment, author: nil, media_files: {}, mentioned_usernames: {})
  return nil unless comment

  media = (comment.respond_to?(:comment_media) ? comment.comment_media : []) || []
  mentions = (comment.respond_to?(:comment_mentions) ? comment.comment_mentions : []) || []

  ::Post::V1::Comment.new(
    id: comment.id.to_s,
    post_id: comment.post_id.to_s,
    parent_id: comment.parent_id.to_s,
    user_id: comment.user_id.to_s,
    content: comment.content,
    created_at: comment.created_at.iso8601,
    author: author_to_proto(author),
    media: media.sort_by(&:position).map { |m| media_to_proto(m, media_files: media_files) },
    replies_count: comment.replies_count || 0,
    mentions: mentions.map { |m| mention_to_proto(m, mentioned_usernames: mentioned_usernames) }
  )
end

def self.many_to_proto(comments, authors: {}, media_files: {}, mentioned_usernames: {})
  (comments || []).map do |c|
    author = authors[c.user_id]
    to_proto(c, author: author, media_files: media_files, mentioned_usernames: mentioned_usernames)
  end
end

def self.mention_to_proto(mention, mentioned_usernames: {})
  ::Post::V1::PostMention.new(
    account_id: mention.account_id.to_s,
    username: mentioned_usernames[mention.account_id.to_s] || "",
    position: mention.position,
    length: mention.length
  )
end
```

（`mention_to_proto`は`media_to_proto`の直後に追加する）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post/presenters/comment_presenter_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/slices/post/presenters/comment_presenter.rb \
  dystopia/monolith/spec/slices/post/presenters/comment_presenter_spec.rb
git commit -s -m "feat(dystopia): resolve mention usernames in CommentPresenter"
```

---

## Task 8: `PostHandler#save_post` wiring

**Files:**
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`
- Test: `dystopia/monolith/spec/slices/post/grpc/post_handler_spec.rb` (create)

**Interfaces:**
- Consumes: `Post::UseCases::ExtractMentions#call(content:)`（Task 3）、`PostRepository#save_mentions`（Task 1）、`PostPresenter.to_post_proto(..., mentioned_usernames:)`（Task 6）、`Notifications::Slice["use_cases.emit"]`（既存, Task 4で`type: "mention"`対応）

- [ ] **Step 1: 失敗するテストを書く**

`Post::Grpc::CommentHandler`の既存specと同じ、handlerを直接インスタンス化して呼ぶパターンを使う。

```ruby
# dystopia/monolith/spec/slices/post/grpc/post_handler_spec.rb
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe Post::Grpc::PostHandler, type: :database do
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:author_id) { create_account }
  let(:mentioned_id) { create_account }

  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  after { Current.clear }

  describe "#save_post mentions" do
    let(:handler) do
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) do
      Post::V1::SavePostRequest.new(id: "", content: "hi @mentioned_user", visibility: "public")
    end

    before do
      profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
      Current.user_id = author_id
    end

    it "includes the resolved mention in the response" do
      response = handler.save_post

      expect(response.post.mentions.length).to eq(1)
      expect(response.post.mentions.first.account_id).to eq(mentioned_id)
      expect(response.post.mentions.first.username).to eq("mentioned_user")
    end

    it "emits a mention notification on create" do
      handler.save_post

      notifications = notification_repo.list(recipient_id: mentioned_id)
      expect(notifications.map(&:type)).to include("mention")
    end

    it "does not emit a mention notification on edit" do
      created = handler.save_post

      edit_message = Post::V1::SavePostRequest.new(id: created.post.id, content: "hi @mentioned_user again", visibility: "public")
      edit_handler = described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: edit_message)
      edit_handler.save_post

      notifications = notification_repo.list(recipient_id: mentioned_id)
      expect(notifications.map(&:type).count("mention")).to eq(1)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/grpc/post_handler_spec.rb`
Expected: FAIL（`response.post.mentions`が空、通知も発火しない）

- [ ] **Step 3: `PostHandler`を実装する**

`dystopia/monolith/slices/post/grpc/post_handler.rb`を変更する。

Deps追加（クラス冒頭の`include Post::Concerns::ProfileAuthorResolvable`の直後）:

```ruby
include Post::Deps[
  extract_mentions: "use_cases.extract_mentions"
]
```

`save_post`メソッドを変更する:

```ruby
def save_post
  authenticate_user!

  m = request.message
  content = m.content.to_s
  if content.strip.empty?
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "本文を入力してください")
  end
  visibility = m.visibility.empty? ? "public" : m.visibility
  media_data = m.media.map { |x| { media_id: x.media_id, media_type: x.media_type } }
  hashtags = m.hashtags.to_a
  mentions = extract_mentions.call(content: content)
  is_create = m.id.empty?

  if is_create
    post = post_repo.create_post(author_id: current_user_id, content: content, visibility: visibility)
  else
    existing = post_repo.find_by_id_and_author(id: m.id, author_id: current_user_id)
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing
    post_repo.update_post(m.id, content: content, visibility: visibility)
    post = post_repo.find_by_id(m.id)
  end

  post_repo.save_media(post_id: post.id, media_data: media_data) if media_data.any?
  post_repo.save_hashtags(post_id: post.id, hashtags: hashtags) if hashtags.any? || !is_create
  post_repo.save_mentions(post_id: post.id, mentions: mentions)
  post = post_repo.find_by_id(post.id)

  if is_create
    mentions.each do |mention|
      notifications_emit.call(
        recipient_id: mention[:account_id],
        type: "mention",
        target_resource_id: post.id,
        actor_id: current_user_id,
        target_post_id: post.id
      )
    end
  end

  mentioned_usernames = mentioned_usernames_for(mentions.map { |m| m[:account_id] })

  ::Post::V1::SavePostResponse.new(post: present_post(post, mentioned_usernames: mentioned_usernames))
end
```

`present_post`/`present_posts`を変更し、`mentioned_usernames`引数を受け取って`PostPresenter.to_post_proto`へ渡す:

```ruby
def present_posts(rows)
  post_ids = rows.map(&:id)
  authors = profile_author_adapter.load(rows.map(&:author_id))
  likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
  comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: [])
  liked = current_user_id ? like_repo.account_liked_status_batch(post_ids: post_ids, account_id: current_user_id) : {}
  media_files = load_media_files_for_posts(rows)
  mentioned_usernames = mentioned_usernames_for(rows.flat_map { |p| p.post_mentions.map(&:account_id) })

  rows.map do |post|
    PostPresenter.to_post_proto(
      post,
      author: authors[post.author_id],
      likes_count: likes_counts[post.id] || 0,
      comments_count: comments_counts[post.id] || 0,
      liked: liked[post.id] || false,
      media_files: media_files,
      mentioned_usernames: mentioned_usernames
    )
  end
end

def present_post(post, mentioned_usernames: nil)
  authors = profile_author_adapter.load([post.author_id])
  likes_count = like_repo.likes_count(post_id: post.id)
  comments_count = comment_repo.comments_count(post_id: post.id, exclude_user_ids: [])
  liked = current_user_id ? like_repo.account_liked?(post_id: post.id, account_id: current_user_id) : false
  media_files = load_media_files_for_posts([post])
  mentioned_usernames ||= mentioned_usernames_for(post.post_mentions.map(&:account_id))

  PostPresenter.to_post_proto(
    post,
    author: authors[post.author_id],
    likes_count: likes_count,
    comments_count: comments_count,
    liked: liked,
    media_files: media_files,
    mentioned_usernames: mentioned_usernames
  )
end

def mentioned_usernames_for(account_ids)
  ids = account_ids.uniq
  return {} if ids.empty?

  profile_author_adapter.load(ids).transform_keys(&:to_s).transform_values(&:username)
end

def notifications_emit
  @notifications_emit ||= Notifications::Slice["use_cases.emit"]
end
```

（`get_post`メソッドは`present_post(post)`のままで良い。`mentioned_usernames:`はキーワード引数のデフォルト`nil`で後方互換）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/grpc/post_handler_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: 既存のpost slice全体のテストを実行し回帰がないことを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post`
Expected: PASS（全件）

- [ ] **Step 6: コミット**

```bash
git add dystopia/monolith/slices/post/grpc/post_handler.rb \
  dystopia/monolith/spec/slices/post/grpc/post_handler_spec.rb
git commit -s -m "feat(dystopia): extract, save, and notify post mentions"
```

---

## Task 9: `AddComment` wiring

**Files:**
- Modify: `dystopia/monolith/slices/post/use_cases/comments/add_comment.rb`
- Test: `dystopia/monolith/spec/slices/post/use_cases/comments/add_comment_spec.rb`

**Interfaces:**
- Consumes: `Post::UseCases::ExtractMentions#call(content:)`（Task 3）、`CommentRepository#create_comment(..., mentions:)`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/monolith/spec/slices/post/use_cases/comments/add_comment_spec.rb`の`describe "#call"`ブロック内、末尾に追記する:

```ruby
context "when content contains a mention" do
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  it "saves the mention and notifies the mentioned account" do
    mentioned_id = SecureRandom.uuid_v7
    profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")

    result = use_case.call(post_id: post.id, user_id: user_id, content: "hi @mentioned_user")

    expect(result[:comment].comment_mentions.map(&:account_id)).to eq([mentioned_id])
    notifications = notification_repo.list(recipient_id: mentioned_id)
    expect(notifications.map(&:type)).to include("mention")
  end

  it "does not save a mention for an unresolved username" do
    result = use_case.call(post_id: post.id, user_id: user_id, content: "hi @nobody_here_xyz")

    expect(result[:comment].comment_mentions).to eq([])
  end

  it "does not notify a self-mention" do
    profile_repo.create(account_id: user_id, display_name: "Self", username: "self_user")

    use_case.call(post_id: post.id, user_id: user_id, content: "hi @self_user")

    expect(notification_repo.list(recipient_id: user_id)).to eq([])
  end

  it "does not notify a mentioned account that has blocked the commenter" do
    block_repo = Hanami.app.slices[:social]["repositories.block_repository"]
    mentioned_id = SecureRandom.uuid_v7
    profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
    block_repo.block(blocker_id: mentioned_id, blocked_id: user_id)

    use_case.call(post_id: post.id, user_id: user_id, content: "hi @mentioned_user")

    expect(notification_repo.list(recipient_id: mentioned_id)).to eq([])
  end

  it "collapses repeated mentions of the same account into a single notification" do
    mentioned_id = SecureRandom.uuid_v7
    profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")

    use_case.call(post_id: post.id, user_id: user_id, content: "@mentioned_user @mentioned_user")

    notifications = notification_repo.list(recipient_id: mentioned_id)
    expect(notifications.length).to eq(1)
    expect(notifications.first.actor_count).to eq(1)
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/comments/add_comment_spec.rb`
Expected: FAIL（`comment_mentions`が空のまま）

- [ ] **Step 3: `AddComment`を実装する**

`dystopia/monolith/slices/post/use_cases/comments/add_comment.rb`を変更する。

Deps追加:

```ruby
include Post::Deps[
  comment_repo: "repositories.comment_repository",
  post_repo: "repositories.post_repository",
  account_adapter: "adapters.account_adapter",
  extract_mentions: "use_cases.extract_mentions"
]
```

`call`メソッド内、`media_data`組み立ての直後に追加:

```ruby
mentions = extract_mentions.call(content: content.to_s)
```

`comment_repo.create_comment`呼び出しに`mentions: mentions`を追加:

```ruby
comment = comment_repo.create_comment(
  post_id: post_id,
  user_id: user_id,
  content: content.strip,
  parent_id: parent_id,
  media: media_data,
  mentions: mentions
)
```

既存の通知発火ブロック（`if parent` / `else`）の直後に追加:

```ruby
mentions.each do |mention|
  notifications_emit.call(
    recipient_id: mention[:account_id],
    type: "mention",
    target_resource_id: comment.id,
    actor_id: user_id,
    target_post_id: post.id
  )
end
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/comments/add_comment_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/slices/post/use_cases/comments/add_comment.rb \
  dystopia/monolith/spec/slices/post/use_cases/comments/add_comment_spec.rb
git commit -s -m "feat(dystopia): extract, save, and notify comment/reply mentions"
```

---

## Task 10: List use cases + `CommentHandler` wiring

**Files:**
- Modify: `dystopia/monolith/slices/post/use_cases/comments/list_comments.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/comments/list_replies.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/comments/list_comments_by_author.rb`
- Modify: `dystopia/monolith/slices/post/grpc/comment_handler.rb`
- Test: `dystopia/monolith/spec/slices/post/use_cases/comments/list_comments_spec.rb`
- Test: `dystopia/monolith/spec/slices/post/grpc/comment_handler_spec.rb`

**Interfaces:**
- Produces: `ListComments#call`等の戻り値ハッシュに`mentioned_usernames: { "account-id" => "username" }`が追加される。`CommentHandler#add_comment`のレスポンスにも`mentions`が反映される

- [ ] **Step 1: `list_replies.rb`・`list_comments_by_author.rb`を先に読む**

Run: `cat dystopia/monolith/slices/post/use_cases/comments/list_replies.rb dystopia/monolith/slices/post/use_cases/comments/list_comments_by_author.rb`

`list_comments.rb`と同じ`build_authors(user_ids)`private methodパターンを使っているはずなので、その構造に合わせて実装する（下記Step 3はそのパターンを前提にした実装例）。

- [ ] **Step 2: 失敗するテストを書く**

`dystopia/monolith/spec/slices/post/use_cases/comments/list_comments_spec.rb`の末尾に追記する（既存のletや`describe`ブロック構造は実ファイルを見て合わせること）:

```ruby
context "when a comment contains a mention" do
  it "returns mentioned_usernames resolving the current username" do
    mentioned_id = SecureRandom.uuid_v7
    profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
    add_comment.call(post_id: post.id, user_id: SecureRandom.uuid_v7, content: "hi @mentioned_user")

    result = use_case.call(post_id: post.id)

    expect(result[:mentioned_usernames][mentioned_id]).to eq("mentioned_user")
  end
end
```

（`profile_repo`・`add_comment`のletが未定義であれば、`let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }` / `let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }`をファイル冒頭に追加する）

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/comments/list_comments_spec.rb`
Expected: FAIL（`result[:mentioned_usernames]`が存在しない）

- [ ] **Step 4: `ListComments`を実装する**

`dystopia/monolith/slices/post/use_cases/comments/list_comments.rb`の`call`メソッドを変更する:

```ruby
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

  user_ids = comments.map(&:user_id).uniq
  authors = build_authors(user_ids)
  mentioned_usernames = build_mentioned_usernames(comments)

  { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors, mentioned_usernames: mentioned_usernames }
end

private

def build_mentioned_usernames(comments)
  ids = comments.flat_map { |c| c.comment_mentions.map(&:account_id) }.uniq
  return {} if ids.empty?

  profile_author_adapter.load(ids).transform_keys(&:to_s).transform_values(&:username)
end
```

（`build_authors`の直前に`build_mentioned_usernames`を追加する。`profile_author_adapter`は`include Post::Concerns::ProfileAuthorResolvable`が既にあるか確認し、なければ追加する）

`list_replies.rb`・`list_comments_by_author.rb`にも同じ`build_mentioned_usernames`private methodと戻り値への`mentioned_usernames:`追加を、それぞれの`call`の構造に合わせて適用する（`comments`変数名がそれぞれ`replies`等になっている場合はそれに合わせる）。

- [ ] **Step 5: `CommentHandler`を実装する**

`dystopia/monolith/slices/post/grpc/comment_handler.rb`を変更する。

`add_comment`メソッド内、`author = get_comment_author(current_user_id, media_files: media_files)`の直後に追加:

```ruby
mentioned_usernames = mentioned_usernames_for(result[:comment].comment_mentions.map(&:account_id))
```

`CommentPresenter.to_proto`呼び出しに`mentioned_usernames: mentioned_usernames`を追加する。

`list_comments`・`list_replies`・`list_comments_by_author`の各メソッド内、`CommentPresenter.many_to_proto`呼び出しに`mentioned_usernames: result[:mentioned_usernames] || {}`を追加する。

`private`セクションに追加:

```ruby
def mentioned_usernames_for(account_ids)
  ids = account_ids.uniq
  return {} if ids.empty?

  profile_author_adapter.load(ids).transform_keys(&:to_s).transform_values(&:username)
end
```

- [ ] **Step 6: `comment_handler_spec.rb`に統合テストを追加する**

末尾（既存`describe "#list_comments_by_author"`ブロックの後）に追記する:

```ruby
describe "#add_comment mentions" do
  let(:handler) do
    described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
  end
  let(:message) { Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @mentioned_user") }
  let(:author_id) { SecureRandom.uuid_v7 }
  let(:mentioned_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "post") }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }

  before do
    profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
    Current.user_id = author_id
  end

  after { Current.clear }

  it "resolves the mentioned username in the response" do
    response = handler.add_comment

    expect(response.comment.mentions.length).to eq(1)
    expect(response.comment.mentions.first.username).to eq("mentioned_user")
  end
end
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post`
Expected: PASS（全件、post slice全体の回帰確認を含む）

- [ ] **Step 8: コミット**

```bash
git add dystopia/monolith/slices/post/use_cases/comments/list_comments.rb \
  dystopia/monolith/slices/post/use_cases/comments/list_replies.rb \
  dystopia/monolith/slices/post/use_cases/comments/list_comments_by_author.rb \
  dystopia/monolith/slices/post/grpc/comment_handler.rb \
  dystopia/monolith/spec/slices/post/use_cases/comments/list_comments_spec.rb \
  dystopia/monolith/spec/slices/post/grpc/comment_handler_spec.rb
git commit -s -m "feat(dystopia): resolve mention usernames across comment list RPCs"
```

---

## Task 11: Frontend types + mappers

**Files:**
- Modify: `dystopia/frontend/src/modules/post/lib/post-view.ts`
- Modify: `dystopia/frontend/src/modules/post/lib/comment-view.ts`
- Modify: `dystopia/frontend/src/modules/post/lib/post-mappers.ts`
- Modify: `dystopia/frontend/src/modules/post/lib/comment-mappers.ts`
- Modify: `dystopia/frontend/src/app/dev/ui/page.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/CommentList.test.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/ReplyList.test.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/ReplyWithParentRow.test.tsx`

**Interfaces:**
- Produces: `MentionView { accountId: string; username: string; position: number; length: number }`（`post-view.ts`で定義し`comment-view.ts`からimportして再利用）。`PostView.mentions: MentionView[]` / `CommentView.mentions: MentionView[]`

- [ ] **Step 1: 失敗するテストを書く（mapper）**

`dystopia/frontend/src/modules/post/lib/post-mappers.ts`用のテストファイルは存在しないため新規作成する:

```ts
// dystopia/frontend/src/modules/post/lib/post-mappers.test.ts
import { describe, expect, it } from "vitest";
import { mapPostToView } from "./post-mappers";
import type { Post } from "@/stub/post/v1/post_service_pb";

describe("mapPostToView mentions", () => {
  it("maps proto mentions into MentionView", () => {
    const proto = {
      id: "p1",
      authorId: "a1",
      content: "hi @alice",
      media: [],
      createdAt: "",
      likesCount: 0,
      commentsCount: 0,
      visibility: "public",
      hashtags: [],
      liked: false,
      mentions: [{ accountId: "acc-1", username: "alice", position: 3, length: 6 }],
    } as unknown as Post;

    const view = mapPostToView(proto);

    expect(view.mentions).toEqual([
      { accountId: "acc-1", username: "alice", position: 3, length: 6 },
    ]);
  });

  it("defaults to an empty array when mentions is absent", () => {
    const proto = {
      id: "p1", authorId: "a1", content: "hi", media: [], createdAt: "",
      likesCount: 0, commentsCount: 0, visibility: "public", hashtags: [], liked: false,
    } as unknown as Post;

    const view = mapPostToView(proto);

    expect(view.mentions).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/lib/post-mappers.test.ts`
Expected: FAIL（`view.mentions`が`undefined`)

- [ ] **Step 3: 型とmapperを実装する**

`dystopia/frontend/src/modules/post/lib/post-view.ts`に追加（ファイル冒頭、`PostAuthorView`の前）:

```ts
export interface MentionView {
  accountId: string;
  username: string;
  position: number;
  length: number;
}
```

`PostView`インターフェースに`mentions: MentionView[];`を`hashtags: string[];`の直後に追加する。

`dystopia/frontend/src/modules/post/lib/post-mappers.ts`を変更する:

```ts
import type {
  Post,
  PostAuthor,
  PostMedia,
  PostMention,
} from "@/stub/post/v1/post_service_pb";
import type {
  MentionView,
  PostAuthorView,
  PostMediaView,
  PostView,
  PostsListView,
  SavePostPayload,
} from "@/modules/post/lib/post-view";

export function mapMentionToView(m: PostMention): MentionView {
  return {
    accountId: m.accountId || "",
    username: m.username || "",
    position: m.position || 0,
    length: m.length || 0,
  };
}
```

`mapPostToView`の戻り値オブジェクトに`mentions: (p.mentions || []).map(mapMentionToView),`を`hashtags: p.hashtags || [],`の直後に追加する。

`dystopia/frontend/src/modules/post/lib/comment-view.ts`を変更する:

```ts
import type { MentionView } from "./post-view";

export interface CommentAuthorView {
  userId: string;
  name: string;
  imageUrl: string;
  username: string;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  content: string;
  createdAt: string;
  author: CommentAuthorView | null;
  repliesCount: number;
  mentions: MentionView[];
}

export interface PaginatedCommentsResponse {
  comments: CommentView[];
  nextCursor: string;
  hasMore: boolean;
}

export type { MentionView };
```

`dystopia/frontend/src/modules/post/lib/comment-mappers.ts`を変更する:

```ts
import type { Comment, CommentAuthor, ListCommentsResponse } from "@/stub/post/v1/comment_service_pb";
import { mapMentionToView } from "./post-mappers";
import type {
  CommentAuthorView,
  CommentView,
  PaginatedCommentsResponse,
} from "./comment-view";
```

`mapCommentToView`の戻り値オブジェクトに`mentions: (c.mentions || []).map(mapMentionToView),`を`repliesCount: c.repliesCount,`の直後に追加する。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/lib/post-mappers.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: 既存の型エラーをすべて解消する**

`PostView`/`CommentView`が`mentions`必須フィールドになったことで、既存の固定データ（fixture）がコンパイルエラーになる。以下のファイルの`hashtags: [...]`/`repliesCount: ...`の直後に`mentions: [],`を追加する:

- `dystopia/frontend/src/app/dev/ui/page.tsx`（2箇所、`hashtags: ["新作", "渋谷"],`と`hashtags: [],`の後）
- `dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx`（`hashtags: [],`の後）
- `dystopia/frontend/src/modules/post/components/CommentList.test.tsx`（`repliesCount: 0,`の後）
- `dystopia/frontend/src/modules/post/components/ReplyList.test.tsx`（`repliesCount: 0,`の後）
- `dystopia/frontend/src/modules/post/components/ReplyWithParentRow.test.tsx`（`repliesCount: 0,`の後。このファイルは`PostView`のfixtureも持つ可能性があるため両方確認する）

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: 既存テストを実行して回帰がないことを確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post`
Expected: PASS（全件）

- [ ] **Step 7: コミット**

```bash
git add dystopia/frontend/src/modules/post/lib/post-view.ts \
  dystopia/frontend/src/modules/post/lib/comment-view.ts \
  dystopia/frontend/src/modules/post/lib/post-mappers.ts \
  dystopia/frontend/src/modules/post/lib/post-mappers.test.ts \
  dystopia/frontend/src/modules/post/lib/comment-mappers.ts \
  dystopia/frontend/src/app/dev/ui/page.tsx \
  dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx \
  dystopia/frontend/src/modules/post/components/CommentList.test.tsx \
  dystopia/frontend/src/modules/post/components/ReplyList.test.tsx \
  dystopia/frontend/src/modules/post/components/ReplyWithParentRow.test.tsx
git commit -s -m "feat(dystopia): map mention data into PostView/CommentView"
```

---

## Task 12: `MentionText` component

**Files:**
- Create: `dystopia/frontend/src/modules/post/lib/mention-text.tsx`
- Test: `dystopia/frontend/src/modules/post/lib/mention-text.test.tsx`

**Interfaces:**
- Consumes: `MentionView`（Task 11）
- Produces: `splitContentByMentions(content: string, mentions: MentionView[]): Array<{ type: "text"; value: string } | { type: "mention"; accountId: string; username: string; value: string }>`、`<MentionText content={string} mentions={MentionView[]} />`（Reactコンポーネント。usernameが空文字のmentionはプレーンテキスト扱い。クリックは`stopPropagation`/`preventDefault`してから`router.push`する。`<a>`は使わない）

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// dystopia/frontend/src/modules/post/lib/mention-text.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { splitContentByMentions, MentionText } from "./mention-text";
import type { MentionView } from "./post-view";

describe("splitContentByMentions", () => {
  it("splits content into text and mention parts", () => {
    const mentions: MentionView[] = [{ accountId: "a1", username: "alice", position: 3, length: 6 }];

    const parts = splitContentByMentions("hi @alice!", mentions);

    expect(parts).toEqual([
      { type: "text", value: "hi " },
      { type: "mention", accountId: "a1", username: "alice", value: "@alice" },
      { type: "text", value: "!" },
    ]);
  });

  it("returns the whole content as text when there are no mentions", () => {
    expect(splitContentByMentions("hello", [])).toEqual([{ type: "text", value: "hello" }]);
  });

  it("treats a mention with an empty username as plain text", () => {
    const mentions: MentionView[] = [{ accountId: "a1", username: "", position: 0, length: 6 }];

    const parts = splitContentByMentions("@alice hi", mentions);

    expect(parts).toEqual([{ type: "text", value: "@alice hi" }]);
  });

  it("computes positions by codepoint, not UTF-16 code unit", () => {
    // "🎉" は1コードポイントだがUTF-16では2コードユニットを占める
    const mentions: MentionView[] = [{ accountId: "a1", username: "alice", position: 2, length: 6 }];

    const parts = splitContentByMentions("🎉 @alice", mentions);

    expect(parts).toEqual([
      { type: "text", value: "🎉 " },
      { type: "mention", accountId: "a1", username: "alice", value: "@alice" },
    ]);
  });

  it("sorts out-of-order mentions by position", () => {
    const mentions: MentionView[] = [
      { accountId: "b1", username: "bob", position: 9, length: 4 },
      { accountId: "a1", username: "alice", position: 0, length: 6 },
    ];

    const parts = splitContentByMentions("@alice hi @bob", mentions);

    expect(parts.map((p) => p.value)).toEqual(["@alice", " hi ", "@bob"]);
  });
});

describe("MentionText", () => {
  it("renders mention parts as clickable spans pointing at /u/{username}", () => {
    const mentions: MentionView[] = [{ accountId: "a1", username: "alice", position: 0, length: 6 }];

    const html = renderToStaticMarkup(<MentionText content="@alice hi" mentions={mentions} />);

    expect(html).toContain("@alice");
    expect(html).not.toContain("<a ");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/lib/mention-text.test.tsx`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: `mention-text.tsx`を実装する**

```tsx
// dystopia/frontend/src/modules/post/lib/mention-text.tsx
"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { MentionView } from "./post-view";

export type ContentPart =
  | { type: "text"; value: string }
  | { type: "mention"; accountId: string; username: string; value: string };

export function splitContentByMentions(content: string, mentions: MentionView[]): ContentPart[] {
  const chars = Array.from(content);
  const resolved = mentions
    .filter((m) => m.username.length > 0)
    .slice()
    .sort((a, b) => a.position - b.position);

  const parts: ContentPart[] = [];
  let cursor = 0;

  for (const mention of resolved) {
    if (mention.position < cursor) continue; // 重複・不正な範囲は無視する
    if (mention.position > cursor) {
      parts.push({ type: "text", value: chars.slice(cursor, mention.position).join("") });
    }
    const value = chars.slice(mention.position, mention.position + mention.length).join("");
    parts.push({ type: "mention", accountId: mention.accountId, username: mention.username, value });
    cursor = mention.position + mention.length;
  }

  if (cursor < chars.length) {
    parts.push({ type: "text", value: chars.slice(cursor).join("") });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: content });
  }

  return parts;
}

export interface MentionTextProps {
  content: string;
  mentions: MentionView[];
  className?: string;
}

export function MentionText({ content, mentions, className }: MentionTextProps) {
  const router = useRouter();
  const parts = splitContentByMentions(content, mentions);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <span
            key={i}
            role="link"
            tabIndex={0}
            className="cursor-pointer text-accent hover:underline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/u/${encodeURIComponent(part.username)}`);
            }}
          >
            {part.value}
          </span>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </span>
  );
}
```

`text-accent`が既存デザインシステムのトークンとして存在しない場合は、`dystopia/frontend/src`内の他のリンク系コンポーネント（例: `src/components/ui/post-card.tsx`のリンク表現）で使われている実際の色トークンに合わせる。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/lib/mention-text.test.tsx`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add dystopia/frontend/src/modules/post/lib/mention-text.tsx \
  dystopia/frontend/src/modules/post/lib/mention-text.test.tsx
git commit -s -m "feat(dystopia): add MentionText rendering helper"
```

---

## Task 13: Wire `MentionText` into post/comment/reply rendering

**Files:**
- Modify: `dystopia/frontend/src/components/ui/post-card.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/CommentList.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/ReplyList.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/ReplyWithParentRow.tsx`
- Test: `dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx`
- Test: `dystopia/frontend/src/modules/post/components/CommentList.test.tsx`

**Interfaces:**
- Consumes: `MentionText`（Task 12）、`PostView.mentions`/`CommentView.mentions`（Task 11）

- [ ] **Step 1: 失敗するテストを書く（PostCardBinding）**

`dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx`の既存テスト群の末尾に追記する（実ファイルの既存構造・fixture変数名に合わせて調整すること）:

```tsx
it("renders a mention in the post content as a link to the mentioned user", () => {
  const post = {
    ...basePost, // 既存fixtureの変数名に合わせる
    content: "hi @alice",
    mentions: [{ accountId: "acc-1", username: "alice", position: 3, length: 6 }],
  };

  const html = renderToStaticMarkup(<PostCardBinding post={post} />);

  expect(html).toContain("@alice");
  expect(html).not.toMatch(/<a[^>]*><a/); // ネストしたaタグがないこと
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/components/PostCardBinding.test.tsx`
Expected: FAIL（`@alice`が単なるプレーンテキストとしてしか存在せず、メンション用のマークアップがない。または現状でも文字列としては含まれるため、このテストはレンダリング後のDOM構造で判定する必要がある点に注意。最低限「ネストした`<a>`が存在しない」保証を主目的とする）

- [ ] **Step 3: `PostCard`の`body`をReactNode化する**

`dystopia/frontend/src/components/ui/post-card.tsx`の`PostCardProps`の`body: string;`を`body: React.ReactNode;`に変更する（内部の`{body}`の使い方はそのままで良い）。

- [ ] **Step 4: `PostCardBinding`で`MentionText`を使う**

`dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`にimportを追加:

```tsx
import { MentionText } from "@/modules/post/lib/mention-text";
```

`<PostCard ... body={post.content} ... />`を以下に変更する:

```tsx
body={<MentionText content={post.content} mentions={post.mentions} />}
```

- [ ] **Step 5: `CommentList`・`ReplyList`・`ReplyWithParentRow`で`MentionText`を使う**

`dystopia/frontend/src/modules/post/components/CommentList.tsx`にimportを追加し、`<p className="mt-1 whitespace-pre-wrap text-text-primary">{c.content}</p>`を以下に変更する:

```tsx
<p className="mt-1 whitespace-pre-wrap text-text-primary">
  <MentionText content={c.content} mentions={c.mentions} />
</p>
```

`dystopia/frontend/src/modules/post/components/ReplyList.tsx`も同様に`{r.content}`を`<MentionText content={r.content} mentions={r.mentions} />`に変更する。

`dystopia/frontend/src/modules/post/components/ReplyWithParentRow.tsx`は2箇所変更する:
- `<p className="mt-1 line-clamp-2 text-sm text-text-primary">{parentPost.content}</p>`（親投稿プレビュー、外側が`<Link>`でラップされている）→ `<MentionText content={parentPost.content} mentions={parentPost.mentions} />`
- `<p className="mt-1 whitespace-pre-wrap text-text-primary">{comment.content}</p>`（コメント本体）→ `<MentionText content={comment.content} mentions={comment.mentions} />`

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/components/PostCardBinding.test.tsx src/modules/post/components/CommentList.test.tsx src/modules/post/components/ReplyList.test.tsx src/modules/post/components/ReplyWithParentRow.test.tsx`
Expected: PASS（全件）

- [ ] **Step 7: 型チェックとpost module全体のテストを実行する**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit && pnpm vitest run src/modules/post src/app`
Expected: PASS（全件、エラーなし）

- [ ] **Step 8: コミット**

```bash
git add dystopia/frontend/src/components/ui/post-card.tsx \
  dystopia/frontend/src/modules/post/components/PostCardBinding.tsx \
  dystopia/frontend/src/modules/post/components/CommentList.tsx \
  dystopia/frontend/src/modules/post/components/ReplyList.tsx \
  dystopia/frontend/src/modules/post/components/ReplyWithParentRow.tsx \
  dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx
git commit -s -m "feat(dystopia): render mentions as links in post/comment/reply content"
```

---

## Final Verification

- [ ] `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec` — 全specが通ること（既存の回帰含む）
- [ ] `cd dystopia/frontend && pnpm exec tsc --noEmit` — 型エラーがないこと
- [ ] `cd dystopia/frontend && pnpm vitest run` — 全testが通ること
- [ ] `docs/superpowers/specs/2026-09-29-mention-feature-design.md`のGoals全項目が実装されていることを目視確認する
