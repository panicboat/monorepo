# Feed/Post RelationshipAdapter 分割 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Feed/Post スライスの `RelationshipAdapter` をドメイン概念ごとに `FollowAdapter` + `BlockAdapter` + `FavoriteAdapter` に分割する。

**Architecture:** Portfolio スライスで行った SocialAdapter 分割と同じ方針。各スライスの `RelationshipAdapter` を 3 つのドメイン特化 Adapter に分割し、参照元を全て置換した後、元ファイルを削除する。

**Tech Stack:** Ruby / Hanami 2.x / RSpec / gRPC (Gruf)

---

## Feed スライス

### Task 1: Feed::FollowAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/feed/adapters/follow_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/feed/adapters/follow_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Feed::Adapters::FollowAdapter do
  let(:adapter) { described_class.new }
  let(:follow_repo) { instance_double(Relationship::Repositories::FollowRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#following_cast_user_ids" do
    it "delegates to follow_repo" do
      expect(follow_repo).to receive(:following_cast_user_ids)
        .with(guest_user_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.following_cast_user_ids(guest_user_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/follow_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Follow data from Relationship slice.
    class FollowAdapter
      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/follow_adapter_spec.rb`
Expected: 1 example, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/feed/adapters/follow_adapter.rb services/monolith/workspace/spec/slices/feed/adapters/follow_adapter_spec.rb
git commit -m "feat(feed): add FollowAdapter as ACL for Relationship follow data"
```

---

### Task 2: Feed::BlockAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/feed/adapters/block_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/feed/adapters/block_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Feed::Adapters::BlockAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Relationship::Repositories::BlockRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
  end

  describe "#blocked_cast_ids" do
    it "delegates to block_repo" do
      expect(block_repo).to receive(:blocked_cast_ids)
        .with(blocker_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.blocked_cast_ids(blocker_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end

  describe "#blocked_guest_ids" do
    it "delegates to block_repo" do
      expect(block_repo).to receive(:blocked_guest_ids)
        .with(blocker_id: "guest-123")
        .and_return(%w[guest-1 guest-2])

      result = adapter.blocked_guest_ids(blocker_id: "guest-123")
      expect(result).to eq(%w[guest-1 guest-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/block_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Block data from Relationship slice.
    class BlockAdapter
      def blocked_cast_ids(blocker_id:)
        block_repo.blocked_cast_ids(blocker_id: blocker_id)
      end

      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/block_adapter_spec.rb`
Expected: 2 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/feed/adapters/block_adapter.rb services/monolith/workspace/spec/slices/feed/adapters/block_adapter_spec.rb
git commit -m "feat(feed): add BlockAdapter as ACL for Relationship block data"
```

---

### Task 3: Feed::FavoriteAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/feed/adapters/favorite_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/feed/adapters/favorite_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Feed::Adapters::FavoriteAdapter do
  let(:adapter) { described_class.new }
  let(:favorite_repo) { instance_double(Relationship::Repositories::FavoriteRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.favorite_repository").and_return(favorite_repo)
  end

  describe "#favorite_cast_user_ids" do
    it "delegates to favorite_repo" do
      expect(favorite_repo).to receive(:favorite_cast_user_ids)
        .with(guest_user_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.favorite_cast_user_ids(guest_user_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/favorite_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Favorite data from Relationship slice.
    class FavoriteAdapter
      def favorite_cast_user_ids(guest_user_id:)
        favorite_repo.favorite_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def favorite_repo
        @favorite_repo ||= Relationship::Slice["repositories.favorite_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/adapters/favorite_adapter_spec.rb`
Expected: 1 example, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/feed/adapters/favorite_adapter.rb services/monolith/workspace/spec/slices/feed/adapters/favorite_adapter_spec.rb
git commit -m "feat(feed): add FavoriteAdapter as ACL for Relationship favorite data"
```

---

### Task 4: Feed スライスの参照元を新 Adapter に移行

**Files:**
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`
- Modify: `services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb`

**Step 1: 各ファイルを読み、`relationship_adapter` の参照箇所を確認**

`list_guest_feed.rb` の変更:
- `@relationship_adapter = Feed::Adapters::RelationshipAdapter.new` → 3 つのアダプタに分割
- `@relationship_adapter.blocked_cast_ids(...)` → `@block_adapter.blocked_cast_ids(...)`
- `@relationship_adapter.following_cast_user_ids(...)` → `@follow_adapter.following_cast_user_ids(...)`
- `@relationship_adapter.favorite_cast_user_ids(...)` → `@favorite_adapter.favorite_cast_user_ids(...)`

`grpc/handler.rb` の変更:
- `require_relative "../adapters/relationship_adapter"` → 3 つの require に変更
- `relationship_adapter` メソッド → `follow_adapter`, `block_adapter`, `favorite_adapter` に分割
- `relationship_adapter.blocked_cast_ids(...)` → `block_adapter.blocked_cast_ids(...)`
- `relationship_adapter.blocked_guest_ids(...)` → `block_adapter.blocked_guest_ids(...)`

`list_guest_feed_spec.rb` の変更:
- `require_relative "../../../../slices/feed/adapters/relationship_adapter"` の行を削除（不要になるか 3 つに分割）

**Step 2: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/`
Expected: All examples pass

**Step 3: コミット**

```bash
git add services/monolith/workspace/slices/feed/ services/monolith/workspace/spec/slices/feed/
git commit -m "refactor(feed): migrate from RelationshipAdapter to FollowAdapter + BlockAdapter + FavoriteAdapter"
```

---

### Task 5: Feed::RelationshipAdapter を削除

**Files:**
- Delete: `services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb`

**Step 1: 参照がないことを確認**

Run: `grep -r "RelationshipAdapter" services/monolith/workspace/slices/feed/ services/monolith/workspace/spec/slices/feed/`
Expected: relationship_adapter.rb 自身のみ

**Step 2: 削除**

```bash
rm services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb
```

**Step 3: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/feed/`
Expected: All examples pass

**Step 4: コミット**

```bash
git add -A services/monolith/workspace/slices/feed/adapters/relationship_adapter.rb
git commit -m "refactor(feed): remove RelationshipAdapter (replaced by FollowAdapter + BlockAdapter + FavoriteAdapter)"
```

---

## Post スライス

### Task 6: Post::FollowAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/post/adapters/follow_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/post/adapters/follow_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::Adapters::FollowAdapter do
  let(:adapter) { described_class.new }
  let(:follow_repo) { instance_double(Relationship::Repositories::FollowRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#following?" do
    it "delegates to follow_repo" do
      expect(follow_repo).to receive(:following?)
        .with(cast_user_id: "cast-123", guest_user_id: "guest-456")
        .and_return(true)

      result = adapter.following?(cast_user_id: "cast-123", guest_user_id: "guest-456")
      expect(result).to eq(true)
    end
  end

  describe "#following_status_batch" do
    it "delegates to follow_repo" do
      batch = { "cast-1" => "approved", "cast-2" => "none" }
      expect(follow_repo).to receive(:following_status_batch)
        .with(cast_user_ids: %w[cast-1 cast-2], guest_user_id: "guest-123")
        .and_return(batch)

      result = adapter.following_status_batch(cast_user_ids: %w[cast-1 cast-2], guest_user_id: "guest-123")
      expect(result).to eq(batch)
    end
  end

  describe "#following_cast_user_ids" do
    it "delegates to follow_repo" do
      expect(follow_repo).to receive(:following_cast_user_ids)
        .with(guest_user_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.following_cast_user_ids(guest_user_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/follow_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Follow data from Relationship slice.
    class FollowAdapter
      def following?(cast_user_id:, guest_user_id:)
        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        follow_repo.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: guest_user_id)
      end

      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/follow_adapter_spec.rb`
Expected: 3 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/post/adapters/follow_adapter.rb services/monolith/workspace/spec/slices/post/adapters/follow_adapter_spec.rb
git commit -m "feat(post): add FollowAdapter as ACL for Relationship follow data"
```

---

### Task 7: Post::BlockAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/post/adapters/block_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/post/adapters/block_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::Adapters::BlockAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Relationship::Repositories::BlockRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
  end

  describe "#blocked?" do
    it "delegates to block_repo" do
      expect(block_repo).to receive(:blocked?)
        .with(blocker_id: "guest-123", blocked_id: "cast-456")
        .and_return(true)

      result = adapter.blocked?(blocker_id: "guest-123", blocked_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#blocked_cast_ids" do
    it "delegates to block_repo" do
      expect(block_repo).to receive(:blocked_cast_ids)
        .with(blocker_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.blocked_cast_ids(blocker_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end

  describe "#blocked_guest_ids" do
    it "delegates to block_repo" do
      expect(block_repo).to receive(:blocked_guest_ids)
        .with(blocker_id: "guest-123")
        .and_return(%w[guest-1 guest-2])

      result = adapter.blocked_guest_ids(blocker_id: "guest-123")
      expect(result).to eq(%w[guest-1 guest-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/block_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Block data from Relationship slice.
    class BlockAdapter
      def blocked?(blocker_id:, blocked_id:)
        block_repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)
      end

      def blocked_cast_ids(blocker_id:)
        block_repo.blocked_cast_ids(blocker_id: blocker_id)
      end

      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/block_adapter_spec.rb`
Expected: 3 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/post/adapters/block_adapter.rb services/monolith/workspace/spec/slices/post/adapters/block_adapter_spec.rb
git commit -m "feat(post): add BlockAdapter as ACL for Relationship block data"
```

---

### Task 8: Post::FavoriteAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/post/adapters/favorite_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/post/adapters/favorite_adapter_spec.rb`

**Step 1: テストを書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::Adapters::FavoriteAdapter do
  let(:adapter) { described_class.new }
  let(:favorite_repo) { instance_double(Relationship::Repositories::FavoriteRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.favorite_repository").and_return(favorite_repo)
  end

  describe "#favorite_cast_user_ids" do
    it "delegates to favorite_repo" do
      expect(favorite_repo).to receive(:favorite_cast_user_ids)
        .with(guest_user_id: "guest-123")
        .and_return(%w[cast-1 cast-2])

      result = adapter.favorite_cast_user_ids(guest_user_id: "guest-123")
      expect(result).to eq(%w[cast-1 cast-2])
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/favorite_adapter_spec.rb`
Expected: FAIL

**Step 3: 実装を書く**

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Favorite data from Relationship slice.
    class FavoriteAdapter
      def favorite_cast_user_ids(guest_user_id:)
        favorite_repo.favorite_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def favorite_repo
        @favorite_repo ||= Relationship::Slice["repositories.favorite_repository"]
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/adapters/favorite_adapter_spec.rb`
Expected: 1 example, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/post/adapters/favorite_adapter.rb services/monolith/workspace/spec/slices/post/adapters/favorite_adapter_spec.rb
git commit -m "feat(post): add FavoriteAdapter as ACL for Relationship favorite data"
```

---

### Task 9: Post スライスの参照元を新 Adapter に移行

**Files:**
- Modify: `services/monolith/workspace/slices/post/grpc/handler.rb`
- Modify: `services/monolith/workspace/slices/post/grpc/post_handler.rb`
- Modify: `services/monolith/workspace/slices/post/policies/access_policy.rb`

**Step 1: 各ファイルを読み、`relationship_adapter` の参照箇所を確認・置換**

`grpc/handler.rb`:
- `require_relative "../adapters/relationship_adapter"` → 3 つの require に変更
- `relationship_adapter` メソッド → `follow_adapter`, `block_adapter`, `favorite_adapter` に分割
- `relationship_adapter.blocked_cast_ids(...)` → `block_adapter.blocked_cast_ids(...)`
- `relationship_adapter.blocked_guest_ids(...)` → `block_adapter.blocked_guest_ids(...)`

`grpc/post_handler.rb`:
- `relationship_adapter.following_cast_user_ids(...)` → `follow_adapter.following_cast_user_ids(...)`
- `relationship_adapter.favorite_cast_user_ids(...)` → `favorite_adapter.favorite_cast_user_ids(...)`
- `relationship_adapter.following?(...)` → `follow_adapter.following?(...)`

`policies/access_policy.rb`:
- `@relationship_adapter = Post::Adapters::RelationshipAdapter.new` → 2 つに分割（follow + block のみ使用）
- `@relationship_adapter.blocked_cast_ids(...)` → `@block_adapter.blocked_cast_ids(...)`
- `@relationship_adapter.following_status_batch(...)` → `@follow_adapter.following_status_batch(...)`
- `@relationship_adapter.blocked?(...)` → `@block_adapter.blocked?(...)`
- `@relationship_adapter.following?(...)` → `@follow_adapter.following?(...)`

**Step 2: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/`
Expected: All examples pass

**Step 3: コミット**

```bash
git add services/monolith/workspace/slices/post/ services/monolith/workspace/spec/slices/post/
git commit -m "refactor(post): migrate from RelationshipAdapter to FollowAdapter + BlockAdapter + FavoriteAdapter"
```

---

### Task 10: Post::RelationshipAdapter を削除

**Files:**
- Delete: `services/monolith/workspace/slices/post/adapters/relationship_adapter.rb`

**Step 1: 参照がないことを確認**

Run: `grep -r "RelationshipAdapter" services/monolith/workspace/slices/post/ services/monolith/workspace/spec/slices/post/`
Expected: relationship_adapter.rb 自身のみ。

**重要:** Relationship スライスと Trust スライスが `Post::Adapters::RelationshipAdapter` を直接参照している可能性あり。以下も確認：

Run: `grep -r "Post::Adapters::RelationshipAdapter" services/monolith/workspace/slices/relationship/ services/monolith/workspace/slices/trust/`

もし参照があれば、Task 11 で対応する。

**Step 2: 削除**

```bash
rm services/monolith/workspace/slices/post/adapters/relationship_adapter.rb
```

**Step 3: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/`
Expected: All examples pass

**Step 4: コミット**

```bash
git add -A services/monolith/workspace/slices/post/adapters/relationship_adapter.rb
git commit -m "refactor(post): remove RelationshipAdapter (replaced by FollowAdapter + BlockAdapter + FavoriteAdapter)"
```

---

### Task 11: 他スライスからの Post::RelationshipAdapter 参照を修正（必要な場合）

Relationship スライスと Trust スライスが `Post::Adapters::RelationshipAdapter` を直接インポートしている場合、それらも修正する。

**Step 1: 参照を確認**

Run: `grep -r "relationship_adapter\|RelationshipAdapter" services/monolith/workspace/slices/relationship/ services/monolith/workspace/slices/trust/`

**Step 2: 参照がある場合、各ファイルで `Post::Adapters::RelationshipAdapter` → 適切な新 Adapter に置換**

- `blocked_cast_ids` / `blocked_guest_ids` / `blocked?` → `Post::Adapters::BlockAdapter`
- `following?` / `following_cast_user_ids` / `following_status_batch` → `Post::Adapters::FollowAdapter`
- `favorite_cast_user_ids` → `Post::Adapters::FavoriteAdapter`

**Step 3: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/relationship/ spec/slices/trust/`
Expected: All examples pass

**Step 4: コミット**

```bash
git add services/monolith/workspace/slices/relationship/ services/monolith/workspace/slices/trust/ services/monolith/workspace/spec/slices/relationship/ services/monolith/workspace/spec/slices/trust/
git commit -m "refactor(relationship,trust): update Post adapter references after RelationshipAdapter split"
```

---

### Task 12: 全テスト実行 + リグレッション確認

**Step 1: 全スライスのテストを実行**

Run: `cd services/monolith/workspace && bundle exec rspec`
Expected: All examples pass
