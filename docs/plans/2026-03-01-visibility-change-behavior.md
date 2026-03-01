# Visibility 変更時の挙動 + Portfolio Adapter 分割 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cast の visibility を `private` → `public` に変更した際、pending フォローリクエストを自動承認する。合わせて `SocialAdapter` を `FollowAdapter` + `BlockAdapter` に分割する。

**Architecture:** Portfolio スライスの `SocialAdapter` をドメイン概念ごとに 2 つの Adapter に分割し、`CastHandler#save_cast_visibility` から `FollowAdapter#approve_all_pending` を呼び出す。既存の `follow_repository.approve_all_pending` と `SaveCastVisibility` の `visibility_changed_to_public` フラグを活用する。

**Tech Stack:** Ruby / Hanami 2.x / RSpec / gRPC (Gruf)

---

### Task 1: FollowAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/portfolio/adapters/follow_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/portfolio/adapters/follow_adapter_spec.rb`

**Step 1: テストを書く**

`spec/slices/portfolio/adapters/follow_adapter_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::FollowAdapter do
  let(:adapter) { described_class.new }
  let(:follow_repo) { instance_double(Relationship::Repositories::FollowRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#approved_follower?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.approved_follower?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to follow_repo.following?" do
      allow(follow_repo).to receive(:following?)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return(true)

      result = adapter.approved_follower?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#follow_status" do
    it "returns nil when guest_user_id is nil" do
      result = adapter.follow_status(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to be_nil
    end

    it "delegates to follow_repo.follow_status" do
      allow(follow_repo).to receive(:follow_status)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return("pending")

      result = adapter.follow_status(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq("pending")
    end
  end

  describe "#get_follow_detail" do
    it "returns default when guest_user_id is nil" do
      result = adapter.get_follow_detail(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq({ is_following: false, followed_at: nil })
    end

    it "delegates to follow_repo.get_follow_detail" do
      detail = { is_following: true, followed_at: Time.now }
      allow(follow_repo).to receive(:get_follow_detail)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return(detail)

      result = adapter.get_follow_detail(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(detail)
    end
  end

  describe "#approve_all_pending" do
    it "delegates to follow_repo.approve_all_pending" do
      expect(follow_repo).to receive(:approve_all_pending)
        .with(cast_user_id: "cast-123")
        .and_return(3)

      result = adapter.approve_all_pending(cast_user_id: "cast-123")
      expect(result).to eq(3)
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/adapters/follow_adapter_spec.rb`
Expected: FAIL — `uninitialized constant Portfolio::Adapters::FollowAdapter`

**Step 3: 実装を書く**

`slices/portfolio/adapters/follow_adapter.rb`:

```ruby
# frozen_string_literal: true

module Portfolio
  module Adapters
    # Anti-Corruption Layer for accessing Follow data from Relationship slice.
    class FollowAdapter
      def approved_follower?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def follow_status(guest_user_id:, cast_user_id:)
        return nil if guest_user_id.nil?

        follow_repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def get_follow_detail(guest_user_id:, cast_user_id:)
        return { is_following: false, followed_at: nil } if guest_user_id.nil?

        follow_repo.get_follow_detail(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def approve_all_pending(cast_user_id:)
        follow_repo.approve_all_pending(cast_user_id: cast_user_id)
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

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/adapters/follow_adapter_spec.rb`
Expected: 7 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/adapters/follow_adapter.rb services/monolith/workspace/spec/slices/portfolio/adapters/follow_adapter_spec.rb
git commit -m "feat(portfolio): add FollowAdapter as ACL for Relationship follow data"
```

---

### Task 2: BlockAdapter を作成

**Files:**
- Create: `services/monolith/workspace/slices/portfolio/adapters/block_adapter.rb`
- Test: `services/monolith/workspace/spec/slices/portfolio/adapters/block_adapter_spec.rb`

**Step 1: テストを書く**

`spec/slices/portfolio/adapters/block_adapter_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::BlockAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Relationship::Repositories::BlockRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
  end

  describe "#blocked?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.blocked?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "guest-123", blocked_id: "cast-456")
        .and_return(true)

      result = adapter.blocked?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#cast_blocked_guest?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.cast_blocked_guest?(cast_user_id: "cast-123", guest_user_id: nil)
      expect(result).to eq(false)
    end

    it "returns false when cast_user_id is nil" do
      result = adapter.cast_blocked_guest?(cast_user_id: nil, guest_user_id: "guest-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "cast-456", blocked_id: "guest-123")
        .and_return(true)

      result = adapter.cast_blocked_guest?(cast_user_id: "cast-456", guest_user_id: "guest-123")
      expect(result).to eq(true)
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/adapters/block_adapter_spec.rb`
Expected: FAIL — `uninitialized constant Portfolio::Adapters::BlockAdapter`

**Step 3: 実装を書く**

`slices/portfolio/adapters/block_adapter.rb`:

```ruby
# frozen_string_literal: true

module Portfolio
  module Adapters
    # Anti-Corruption Layer for accessing Block data from Relationship slice.
    class BlockAdapter
      def blocked?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        block_repo.blocked?(blocker_id: guest_user_id, blocked_id: cast_user_id)
      end

      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        return false if guest_user_id.nil? || cast_user_id.nil?

        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
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

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/adapters/block_adapter_spec.rb`
Expected: 5 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/adapters/block_adapter.rb services/monolith/workspace/spec/slices/portfolio/adapters/block_adapter_spec.rb
git commit -m "feat(portfolio): add BlockAdapter as ACL for Relationship block data"
```

---

### Task 3: ProfileAccessPolicy を新 Adapter に移行

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/policies/profile_access_policy.rb`
- Modify: `services/monolith/workspace/spec/slices/portfolio/policies/profile_access_policy_spec.rb`

**Step 1: テストを更新**

`spec/slices/portfolio/policies/profile_access_policy_spec.rb` を編集。`SocialAdapter` の参照を `FollowAdapter` + `BlockAdapter` に置換：

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Policies::ProfileAccessPolicy do
  let(:policy) { described_class.new }
  let(:follow_adapter) { instance_double(Portfolio::Adapters::FollowAdapter) }
  let(:block_adapter) { instance_double(Portfolio::Adapters::BlockAdapter) }

  before do
    allow(Portfolio::Adapters::FollowAdapter).to receive(:new).and_return(follow_adapter)
    allow(Portfolio::Adapters::BlockAdapter).to receive(:new).and_return(block_adapter)
  end

  # Casts
  let(:yuna) { double(:cast, user_id: "yuna-id", visibility: "public") }
  let(:mio) { double(:cast, user_id: "mio-id", visibility: "private") }
  let(:rin) { double(:cast, user_id: "rin-id", visibility: "public") }

  # Guest IDs
  let(:taro_id) { "taro-guest-id" }
  let(:jiro_id) { "jiro-guest-id" }
  let(:saburo_id) { "saburo-guest-id" }

  describe "#can_view_profile?" do
    it "returns true for unauthenticated user" do
      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: nil)
      expect(result).to eq(true)
    end

    it "returns true when not blocked" do
      allow(block_adapter).to receive(:blocked?).and_return(false)

      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: jiro_id)
      expect(result).to eq(true)
    end

    it "returns false when blocked" do
      allow(block_adapter).to receive(:blocked?)
        .with(guest_user_id: taro_id, cast_user_id: "rin-id")
        .and_return(true)

      result = policy.can_view_profile?(cast: rin, viewer_guest_id: taro_id)
      expect(result).to eq(false)
    end
  end

  describe "#can_view_profile_details? (plans, schedules)" do
    context "public cast (Yuna)" do
      it "returns true for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: nil)
        expect(result).to eq(true)
      end

      it "returns true for non-follower" do
        allow(block_adapter).to receive(:blocked?).and_return(false)

        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(true)
      end

      it "returns false when blocked" do
        allow(block_adapter).to receive(:blocked?).and_return(true)

        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: taro_id)
        expect(result).to eq(false)
      end
    end

    context "private cast (Mio)" do
      it "returns false for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "returns false for non-follower" do
        allow(block_adapter).to receive(:blocked?).and_return(false)
        allow(follow_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "returns false for pending follower" do
        allow(block_adapter).to receive(:blocked?).and_return(false)
        allow(follow_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "returns true for approved follower" do
        allow(block_adapter).to receive(:blocked?).and_return(false)
        allow(follow_adapter).to receive(:approved_follower?).and_return(true)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end
    end
  end
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/policies/profile_access_policy_spec.rb`
Expected: FAIL — adapter メソッドが SocialAdapter に送られるため

**Step 3: 実装を更新**

`slices/portfolio/policies/profile_access_policy.rb`:

```ruby
# frozen_string_literal: true

module Portfolio
  module Policies
    class ProfileAccessPolicy
      def can_view_profile?(cast:, viewer_guest_id: nil)
        return true if viewer_guest_id.nil?

        !block_adapter.blocked?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
      end

      def can_view_profile_details?(cast:, viewer_guest_id: nil)
        if viewer_guest_id && block_adapter.blocked?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
          return false
        end

        return true if cast.visibility == "public"

        return false if viewer_guest_id.nil?

        follow_adapter.approved_follower?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
      end

      private

      def follow_adapter
        @follow_adapter ||= Portfolio::Adapters::FollowAdapter.new
      end

      def block_adapter
        @block_adapter ||= Portfolio::Adapters::BlockAdapter.new
      end
    end
  end
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/policies/profile_access_policy_spec.rb`
Expected: 7 examples, 0 failures

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/policies/profile_access_policy.rb services/monolith/workspace/spec/slices/portfolio/policies/profile_access_policy_spec.rb
git commit -m "refactor(portfolio): migrate ProfileAccessPolicy from SocialAdapter to FollowAdapter + BlockAdapter"
```

---

### Task 4: GuestHandler を新 Adapter に移行

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/grpc/guest_handler.rb`
- Modify: `services/monolith/workspace/spec/slices/portfolio/grpc/guest_handler_spec.rb`

**Step 1: テストを更新**

`spec/slices/portfolio/grpc/guest_handler_spec.rb` で `social_adapter` の参照を `follow_adapter` + `block_adapter` に置換。

テストファイル内の以下のパターンを検索して置換する：
- `social_adapter` → `follow_adapter`（`get_follow_detail` の呼び出し箇所）
- `social_adapter` → `block_adapter`（`cast_blocked_guest?` の呼び出し箇所）
- `allow_any_instance_of(described_class).to receive(:social_adapter)` → `follow_adapter` と `block_adapter` の 2 行に分割

※ `guest_handler_spec.rb` の正確な内容は実装時に確認すること。以下のパターンに従う：

```ruby
let(:follow_adapter) { double(:follow_adapter) }
let(:block_adapter) { double(:block_adapter) }

before do
  allow_any_instance_of(described_class).to receive(:follow_adapter).and_return(follow_adapter)
  allow_any_instance_of(described_class).to receive(:block_adapter).and_return(block_adapter)
end
```

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/grpc/guest_handler_spec.rb`
Expected: FAIL

**Step 3: 実装を更新**

`slices/portfolio/grpc/guest_handler.rb` の `get_guest_profile_by_id` メソッド内と private セクションを更新：

行 54: `social_adapter.get_follow_detail(...)` → `follow_adapter.get_follow_detail(...)`
行 55: `social_adapter.cast_blocked_guest?(...)` → `block_adapter.cast_blocked_guest?(...)`

private セクション（行 96-98）を以下に置換：

```ruby
def follow_adapter
  @follow_adapter ||= Portfolio::Adapters::FollowAdapter.new
end

def block_adapter
  @block_adapter ||= Portfolio::Adapters::BlockAdapter.new
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/grpc/guest_handler_spec.rb`
Expected: All examples pass

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/grpc/guest_handler.rb services/monolith/workspace/spec/slices/portfolio/grpc/guest_handler_spec.rb
git commit -m "refactor(portfolio): migrate GuestHandler from SocialAdapter to FollowAdapter + BlockAdapter"
```

---

### Task 5: SocialAdapter を削除

**Files:**
- Delete: `services/monolith/workspace/slices/portfolio/adapters/social_adapter.rb`
- Delete: `services/monolith/workspace/spec/slices/portfolio/adapters/social_adapter_spec.rb`

**Step 1: SocialAdapter が参照されていないことを確認**

Run: `grep -r "SocialAdapter" services/monolith/workspace/slices/portfolio/ services/monolith/workspace/spec/slices/portfolio/`
Expected: 該当ファイルに言及がないこと（social_adapter.rb と social_adapter_spec.rb 自身のみ）

**Step 2: ファイルを削除**

```bash
rm services/monolith/workspace/slices/portfolio/adapters/social_adapter.rb
rm services/monolith/workspace/spec/slices/portfolio/adapters/social_adapter_spec.rb
```

**Step 3: Portfolio スライスの全テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/`
Expected: All examples pass

**Step 4: コミット**

```bash
git add -A services/monolith/workspace/slices/portfolio/adapters/social_adapter.rb services/monolith/workspace/spec/slices/portfolio/adapters/social_adapter_spec.rb
git commit -m "refactor(portfolio): remove SocialAdapter (replaced by FollowAdapter + BlockAdapter)"
```

---

### Task 6: CastHandler に自動承認ロジックを追加

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb`
- Modify: `services/monolith/workspace/spec/slices/portfolio/grpc/cast_handler_spec.rb`

**Step 1: テストを書く**

`spec/slices/portfolio/grpc/cast_handler_spec.rb` に `describe "#save_cast_visibility"` ブロックを追加：

```ruby
describe "#save_cast_visibility" do
  let(:save_visibility_uc) { double(:save_visibility_uc) }
  let(:follow_adapter) { double(:follow_adapter) }
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      get_profile_uc: get_profile_uc,
      save_profile_uc: save_profile_uc,
      publish_uc: publish_uc,
      save_visibility_uc: save_visibility_uc,
      save_images_uc: save_images_uc,
      list_casts_uc: list_casts_uc,
      repo: repo,
      area_repo: area_repo,
      genre_repo: genre_repo
    )
  }
  let(:message) do
    ::Portfolio::V1::SaveCastVisibilityRequest.new(visibility: :CAST_VISIBILITY_PUBLIC)
  end

  before do
    allow_any_instance_of(described_class).to receive(:follow_adapter).and_return(follow_adapter)
  end

  context "when visibility changes from private to public" do
    it "auto-approves all pending follow requests" do
      expect(save_visibility_uc).to receive(:call)
        .with(user_id: current_user_id, visibility: "public")
        .and_return({ success: true, cast: mock_cast_entity, visibility_changed_to_public: true })
      expect(follow_adapter).to receive(:approve_all_pending)
        .with(cast_user_id: mock_cast_entity.user_id)

      response = handler.save_cast_visibility
      expect(response).to be_a(::Portfolio::V1::SaveCastVisibilityResponse)
    end
  end

  context "when visibility stays the same or changes to private" do
    let(:message) do
      ::Portfolio::V1::SaveCastVisibilityRequest.new(visibility: :CAST_VISIBILITY_PRIVATE)
    end

    it "does not auto-approve pending follow requests" do
      expect(save_visibility_uc).to receive(:call)
        .with(user_id: current_user_id, visibility: "private")
        .and_return({ success: true, cast: mock_cast_entity, visibility_changed_to_public: false })
      expect(follow_adapter).not_to receive(:approve_all_pending)

      response = handler.save_cast_visibility
      expect(response).to be_a(::Portfolio::V1::SaveCastVisibilityResponse)
    end
  end

  context "when cast not found" do
    it "raises NOT_FOUND error" do
      expect(save_visibility_uc).to receive(:call)
        .and_return({ success: false, error: :cast_not_found })

      expect { handler.save_cast_visibility }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end
end
```

※ handler のコンストラクタに `save_visibility_uc` を追加し、既存の `handler` let の外に新しい `handler` let を定義していることに注意。この describe ブロック内でのみ有効。

**Step 2: テストが失敗することを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/grpc/cast_handler_spec.rb`
Expected: FAIL — `follow_adapter` メソッドが未定義、auto-approve が呼ばれない

**Step 3: 実装を更新**

`slices/portfolio/grpc/cast_handler.rb` の `save_cast_visibility` メソッド（行 205-226）を更新：

行 213 の `unless result[:success]` ブロックの後、レスポンス構築の前に以下を追加：

```ruby
# Auto-approve all pending follow requests when changing to public
if result[:visibility_changed_to_public]
  follow_adapter.approve_all_pending(cast_user_id: result[:cast].user_id)
end
```

private セクション（行 346 の後）に `follow_adapter` メソッドを追加：

```ruby
def follow_adapter
  @follow_adapter ||= Portfolio::Adapters::FollowAdapter.new
end
```

**Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/grpc/cast_handler_spec.rb`
Expected: All examples pass

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb services/monolith/workspace/spec/slices/portfolio/grpc/cast_handler_spec.rb
git commit -m "feat(portfolio): auto-approve pending follows when cast changes to public visibility"
```

---

### Task 7: ACCESS_POLICY.md を更新

**Files:**
- Modify: `docs/ACCESS_POLICY.md`

**Step 1: ドキュメントを更新**

`docs/ACCESS_POLICY.md` の "Follow on Visibility Change" セクション（行 272-274）を更新：

変更前:
```markdown
### Follow on Visibility Change

キャストが visibility を変更した場合：
- `public` → `private`: 既存の approved フォロワーはそのまま。新規フォローは pending になる。
- `private` → `public`: `approve_all_pending` メソッドは存在するが **現在は呼ばれていない**。pending リクエストは自動承認されない。
```

変更後:
```markdown
### Follow on Visibility Change

キャストが visibility を変更した場合：
- `public` → `private`: 既存の approved フォロワーはそのまま。新規フォローは pending になる。
- `private` → `public`: 全 pending フォローリクエストが自動承認される（`CastHandler#save_cast_visibility` → `FollowAdapter#approve_all_pending`）。
```

"Future Considerations" セクション（行 279）から該当行を削除：

削除: `- `private` → `public` 切り替え時の pending リクエスト自動承認`

**Step 2: コミット**

```bash
git add docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): update visibility change behavior as implemented"
```

---

### Task 8: 全テスト実行 + リグレッション確認

**Step 1: Portfolio スライスの全テストを実行**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/`
Expected: All examples pass

**Step 2: Relationship スライスのテストも実行（副作用がないことを確認）**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/relationship/`
Expected: All examples pass

**Step 3: 全スライスのテストを実行**

Run: `cd services/monolith/workspace && bundle exec rspec`
Expected: All examples pass

---

### 次のタスク（別チケット）: Feed/Post の RelationshipAdapter 分割

同じ方針で Feed/Post スライスの `RelationshipAdapter` もドメイン概念ごとに分割する。

| スライス | 現在の Adapter | 分割先 |
|---------|---------------|--------|
| Feed | `RelationshipAdapter` | `FollowAdapter`, `BlockAdapter`, `FavoriteAdapter` |
| Post | `RelationshipAdapter` | `FollowAdapter`, `BlockAdapter`, `FavoriteAdapter` |

※ Favorites 削除（Access Policy リファクタリング）と合わせて実施するのが効率的。
