# Home karte/review tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Homeページにプラットフォーム全体の最新カルテ一覧（castのみ）・最新レビュー一覧（全ロール）を、投稿フィードと同じタブUIで追加する。

**Architecture:** karte・review両serviceに新規`ListRecentEntries` RPCを追加し（既存のByTarget/ByAuthor/Myと並ぶ新スコープ）、monolithで新use case・BFFでNext.js API route・frontendで新hook+カード表示モードを追加し、`page.tsx`の既存タブ列にフラットで統合する。

**Tech Stack:** Ruby (Hanami slices, gRPC, RSpec) / TypeScript (Next.js App Router, Connect-ES gRPC client, SWR, vitest)

**Spec:** `docs/superpowers/specs/2026-09-28-home-karte-review-tabs-design.md`

## Global Constraints

- 新規RPC名は両serviceとも`ListRecentEntries`。レスポンスにaggregateを含めない（spec Architecture節）
- カルテのrecent一覧はビューアーがcast(role=2)のときのみ許可。それ以外は`AccessError`（spec Monolith: karte slice節）
- レビューのrecent一覧はロール制限なし。hidden・reviews_visible=false・ブロック関係・非公開アカウント未フォローのエントリを除外する（spec Monolith: review slice節）
- 既存の`ListEntriesByTarget`/`ListMyEntries`/`CreateEntry`（karte）、billingの`access_repo`集約APIは対象外（issue #1296で別途対応、spec Non-goals）
- カルテのtarget側可視性設定は追加しない（spec Non-goals）
- commitは`git commit -s`（signoff必須）。Co-Authored-Byは付与しない。セッションのsystem reminderが指定するClaude-Session行のみ付与する
- frontendの検証は`tsc --noEmit`と対象テストファイルの`vitest run`で行う。`pnpm lint`は現状ESLint 9系の既知不具合で全体的に失敗するため、本タスクの検証には使わない

## Review Focus

- ゲスト(role=1)のビューアーがカルテのrecent一覧APIを直接呼び出すと`permission_denied`になること（UIでタブを隠すだけでなく、バックエンドが強制すること）— Task 2でカバー
- レビューのrecent一覧で、targetの`reviews_visible`が`false`のエントリが除外されること — Task 3でカバー
- レビューのrecent一覧で、viewerとauthor/targetいずれかがブロック関係にあるエントリが除外されること（従来の単一page_owner前提のロジックとは異なり、viewerが第三者としてブラウズする場面での双方向除外）— Task 3でカバー
- レビューのrecent一覧で、authorまたはtargetが非公開アカウントであり、viewerがフォロー承認されていない場合にそのエントリが除外されること — Task 3でカバー
- Homeの「カルテ」タブはrole===guestのユーザーには表示されず、「レビュー」タブは両ロールに表示されること — Task 7でカバー

---

## Task 1: Proto — `ListRecentEntries` RPCの追加とスタブ再生成

**Files:**
- Modify: `proto/dystopia/karte/v1/service.proto`
- Modify: `proto/dystopia/review/v1/service.proto`
- Generate (via `bin/codegen`): `dystopia/monolith/stubs/karte/v1/service_pb.rb`, `dystopia/monolith/stubs/karte/v1/service_services_pb.rb`, `dystopia/monolith/stubs/review/v1/service_pb.rb`, `dystopia/monolith/stubs/review/v1/service_services_pb.rb`
- Generate (via `pnpm proto:gen`): `dystopia/frontend/src/stub/karte/v1/service_pb.ts`, `dystopia/frontend/src/stub/review/v1/service_pb.ts`

**Interfaces:**
- Produces: `karte.v1.KarteService.ListRecentEntries(limit, cursor) -> {entries: KarteEntry[], next_cursor, has_more}`、`review.v1.ReviewService.ListRecentEntries(limit, cursor) -> {entries: ReviewEntry[], next_cursor, has_more}`。以降のTaskはこの生成コードに依存する

- [ ] **Step 1: `proto/dystopia/karte/v1/service.proto` を編集**

`service KarteService` ブロックの `rpc GetMyAccess(...)` の直後に追加:

```proto
  rpc ListRecentEntries(ListRecentEntriesRequest) returns (ListRecentEntriesResponse);
```

ファイル末尾（`GetMyAccessResponse` の後）に追加:

```proto

message ListRecentEntriesRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListRecentEntriesResponse {
  repeated KarteEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 2: `proto/dystopia/review/v1/service.proto` を編集**

`service ReviewService` ブロックの `rpc UpdateMySettings(...)` の直後に追加:

```proto
  rpc ListRecentEntries(ListRecentEntriesRequest) returns (ListRecentEntriesResponse);
```

ファイル末尾（`UpdateMySettingsResponse` の後）に追加:

```proto

message ListRecentEntriesRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListRecentEntriesResponse {
  repeated ReviewEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 3: lintで確認**

Run: `cd proto/dystopia && buf lint`
Expected: エラーなし

- [ ] **Step 4: monolithのスタブを再生成**

Run: `cd dystopia/monolith && bin/codegen`
Expected: `✅ Done.` と表示され、`stubs/karte/v1/service_pb.rb`・`stubs/karte/v1/service_services_pb.rb`・`stubs/review/v1/service_pb.rb`・`stubs/review/v1/service_services_pb.rb` に `ListRecentEntries` 関連のdiffが入る

- [ ] **Step 5: frontendのスタブを再生成**

Run: `cd dystopia/frontend && pnpm proto:gen`
Expected: `src/stub/karte/v1/service_pb.ts`・`src/stub/review/v1/service_pb.ts` に `listRecentEntries` 関連のdiffが入る

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/karte/v1/service.proto proto/dystopia/review/v1/service.proto \
  dystopia/monolith/stubs/karte/v1/ dystopia/monolith/stubs/review/v1/ \
  dystopia/frontend/src/stub/karte/v1/ dystopia/frontend/src/stub/review/v1/
git commit -s -m "feat(dystopia): add ListRecentEntries RPC to karte and review services"
```

---

## Task 2: Monolith karte — `ListRecentEntries` use case（cast限定）

**Files:**
- Modify: `dystopia/monolith/slices/karte/repositories/entry_repository.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/list_recent_entries.rb`
- Modify: `dystopia/monolith/slices/karte/grpc/karte_handler.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/list_recent_entries_spec.rb`

**Interfaces:**
- Consumes: Task 1が生成した `::Karte::V1::ListRecentEntriesRequest`/`Response`
- Produces: `Karte::Repositories::EntryRepository#list_recent(limit:, cursor:)`、`Karte::UseCases::ListRecentEntries#call(viewer_account_id:, limit: 20, cursor: nil) -> {entries:, next_cursor:, has_more:}`（`Karte::UseCases::ListRecentEntries::AccessError`）、gRPC `list_recent_entries`

- [ ] **Step 1: repository層の失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb` に追記:

```ruby
  describe "#list_recent" do
    it "returns entries across different targets ordered by created_at desc, and respects limit+1 for has_more" do
      other_target_id = SecureRandom.uuid_v7
      e1 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3, body: "first")
      e2 = repo.create(author_account_id: author_id, target_account_id: other_target_id, rating: 4, body: "second")
      e3 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 5, body: "third")

      page = repo.list_recent(limit: 2)

      expect(page.length).to eq(3) # limit + 1 to let the use case detect has_more
      expect(page.map(&:id)).to eq([e3.id, e2.id, e1.id])
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/karte/repositories/entry_repository_spec.rb -e "#list_recent"`
Expected: FAIL（`NoMethodError: undefined method 'list_recent'`）

- [ ] **Step 3: `list_recent` を実装**

`dystopia/monolith/slices/karte/repositories/entry_repository.rb` の `list_by_author` メソッドの直後（`aggregate` メソッドの前）に追加:

```ruby
      def list_recent(limit: 20, cursor: nil)
        scope = apply_cursor(entry_records, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end
```

- [ ] **Step 4: テストを再実行してパスを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/karte/repositories/entry_repository_spec.rb`
Expected: PASS（全件）

- [ ] **Step 5: use caseの失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/use_cases/list_recent_entries_spec.rb` を新規作成:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListRecentEntries do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      user_repo: user_repo,
      get_profile: get_profile_uc,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo)     { double(:entry_repository) }
  let(:user_repo)      { double(:user_repository) }
  let(:get_profile_uc) { double(:get_profile) }
  let(:media_adapter)  { double(:media_adapter) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:now)       { Time.now }

  let(:entry_flagged) do
    double(:entry,
      id: "e-1",
      author_account_id: "author-1",
      target_account_id: "target-1",
      rating: 5,
      body: "flagged entry",
      reported_count: 5,
      created_at: now - 100,
      updated_at: now - 50)
  end

  let(:entry_clean) do
    double(:entry,
      id: "e-2",
      author_account_id: "author-2",
      target_account_id: "target-2",
      rating: 3,
      body: "clean entry",
      reported_count: 0,
      created_at: now - 200,
      updated_at: now - 100)
  end

  let(:profile1) { double(:profile, username: "cast1", avatar_media_id: "media-1") }
  let(:profile2) { double(:profile, username: "cast2", avatar_media_id: nil) }
  let(:target_profile1) { double(:profile, username: "guest1", avatar_media_id: nil) }
  let(:target_profile2) { double(:profile, username: "guest2", avatar_media_id: nil) }

  before do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 2))
  end

  it "returns entries across authors when the viewer is a cast" do
    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean])
    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-1").and_return(target_profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-2").and_return(target_profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:entries].length).to eq(2)
    expect(result[:entries][0][:flagged]).to be(true)
    expect(result[:entries][1][:flagged]).to be(false)
    expect(result[:entries][0][:author_username]).to eq("cast1")
    expect(result[:entries][0][:target_username]).to eq("guest1")
    expect(result[:has_more]).to be(false)
    expect(result[:next_cursor]).to be_nil
  end

  it "rejects when the viewer is a guest" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id)
    }.to raise_error(Karte::UseCases::ListRecentEntries::AccessError)
  end

  it "rejects when the viewer account cannot be found" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id)
    }.to raise_error(Karte::UseCases::ListRecentEntries::AccessError)
  end

  it "sets has_more and next_cursor when the repo returns limit + 1 rows" do
    extra_entry = double(:entry,
      id: "e-3",
      author_account_id: "author-1",
      target_account_id: "target-1",
      rating: 4,
      body: "extra",
      reported_count: 0,
      created_at: now - 300,
      updated_at: now - 200)

    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean, extra_entry])
    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-1").and_return(target_profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-2").and_return(target_profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries].length).to eq(2)
  end
end
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/karte/use_cases/list_recent_entries_spec.rb`
Expected: FAIL（`NameError: uninitialized constant Karte::UseCases::ListRecentEntries`）

- [ ] **Step 7: use caseを実装**

`dystopia/monolith/slices/karte/use_cases/list_recent_entries.rb` を新規作成:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module UseCases
    class ListRecentEntries
      class AccessError < StandardError; end

      include Concerns::CursorPagination
      include Karte::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, user_repo: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @user_repo = user_repo
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, limit: 20, cursor: nil)
        viewer = user_repo.find_by_id(viewer_account_id)
        raise AccessError, "Karte recent list is cast-only" unless viewer&.role == 2

        result = entry_repo.list_recent(limit: limit, cursor: cursor)
        has_more = result.length > limit
        visible = result.take(limit)

        next_cursor = if has_more && visible.any?
          last = visible.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        target_profile = profile_cache[e.target_account_id] ||= get_profile.call(account_id: e.target_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          target_username: target_profile&.username,
          target_avatar_url: avatar_url_for(target_profile),
          rating: e.rating,
          body: e.body,
          flagged: e.reported_count >= ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Karte::Adapters::MediaAdapter.new
      end
    end
  end
end
```

- [ ] **Step 8: テストを再実行してパスを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/karte/use_cases/list_recent_entries_spec.rb`
Expected: PASS（全件）

- [ ] **Step 9: gRPCハンドラに`list_recent_entries`を追加**

`dystopia/monolith/slices/karte/grpc/karte_handler.rb` の `rpc :GetMyAccess, ...` の直後に追加:

```ruby
      rpc :ListRecentEntries,  ::Karte::V1::ListRecentEntriesRequest,  ::Karte::V1::ListRecentEntriesResponse
```

同ファイルの `Karte::Deps[...]` ブロック（`get_my_access_uc: "use_cases.get_my_access"` の行）の直後にキーを追加:

```ruby
        list_recent_uc:      "use_cases.list_recent_entries"
```

`get_my_access` メソッドの直後に新規メソッドを追加:

```ruby
      def list_recent_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_recent_uc.call(
            viewer_account_id: current_user_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListRecentEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end
```

`wrap_errors` の `rescue` 対象リスト（`permission_denied`側）に `Karte::UseCases::ListRecentEntries::AccessError` を追加:

```ruby
      def wrap_errors
        yield
      rescue Karte::UseCases::CreateEntry::AccessError,
             Karte::UseCases::UpdateEntry::AccessError,
             Karte::UseCases::DeleteEntry::AccessError,
             Karte::UseCases::ListEntriesByTarget::AccessError,
             Karte::UseCases::ListMyEntries::AccessError,
             Karte::UseCases::ListRecentEntries::AccessError,
             Karte::UseCases::ReportEntry::AccessError => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::UseCases::CreateEntry::CreateError,
             Karte::UseCases::UpdateEntry::UpdateError,
             Karte::UseCases::DeleteEntry::DeleteError,
             Karte::UseCases::ReportEntry::ReportError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      end
```

- [ ] **Step 10: 全体のrspecを実行**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/karte`
Expected: PASS（全件、既存分含む）

- [ ] **Step 11: Commit**

```bash
git add dystopia/monolith/slices/karte/repositories/entry_repository.rb \
  dystopia/monolith/slices/karte/use_cases/list_recent_entries.rb \
  dystopia/monolith/slices/karte/grpc/karte_handler.rb \
  dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb \
  dystopia/monolith/spec/slices/karte/use_cases/list_recent_entries_spec.rb
git commit -s -m "feat(dystopia/monolith): add cast-only ListRecentEntries to karte"
```

---

## Task 3: Monolith review — `ListRecentEntries` use case（可視性フィルタ）

**Files:**
- Modify: `dystopia/monolith/slices/review/repositories/entry_repository.rb`
- Create: `dystopia/monolith/slices/review/use_cases/list_recent_entries.rb`
- Modify: `dystopia/monolith/slices/review/grpc/review_handler.rb`
- Test: `dystopia/monolith/spec/slices/review/repositories/entry_repository_spec.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/list_recent_entries_spec.rb`

**Interfaces:**
- Consumes: Task 1が生成した `::Review::V1::ListRecentEntriesRequest`/`Response`
- Produces: `Review::Repositories::EntryRepository#list_recent(limit:, cursor:)`、`Review::UseCases::ListRecentEntries#call(viewer_account_id:, limit: 20, cursor: nil) -> {entries:, next_cursor:, has_more:}`、gRPC `list_recent_entries`

- [ ] **Step 1: repository層の失敗するテストを書く**

`dystopia/monolith/spec/slices/review/repositories/entry_repository_spec.rb` を確認し、以下の `describe "#list_recent"` ブロックを追記する（既存ファイルに他のdescribeがあれば同じファイル内に追加）:

```ruby
  describe "#list_recent" do
    it "returns entries across different authors/targets ordered by created_at desc" do
      author1 = SecureRandom.uuid_v7
      author2 = SecureRandom.uuid_v7
      target1 = SecureRandom.uuid_v7
      target2 = SecureRandom.uuid_v7
      now = Time.now

      e1 = repo.create(author_account_id: author1, target_account_id: target1, rating: 3.0, body: "first")
      repo.update(e1.id, created_at: now - 200)
      e2 = repo.create(author_account_id: author2, target_account_id: target2, rating: 4.0, body: "second")
      repo.update(e2.id, created_at: now - 100)

      page = repo.list_recent(limit: 1000)
      ours = page.select { |e| [e1.id, e2.id].include?(e.id) }

      expect(ours.map(&:id)).to eq([e2.id, e1.id])
    end
  end
```

（`created_at` はDBの `now()` デフォルトのため、同一トランザクション内の連続insertが同一timestampになり得る。tie-breakの`id DESC`はUUIDv7のミリ秒内ランダムsuffixに依存するため、明示的に異なる`created_at`を設定してordering assertionを決定的にする。`list_recent`は`ListEntriesByTarget`等と違いtargetでスコープされないため、test DBに他のテストや手動seedによる既存行があっても`page`から自分が作った2件だけを`select`で絞り込んでから順序を検証する — DB内の他の行を消したり、テストの前提としてDBが空であることに依存しない）

もし `spec/slices/review/repositories/entry_repository_spec.rb` が存在しない場合は、以下の内容で新規作成する（`subject`/`let`の宣言込み）:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/entry_repository"

RSpec.describe Review::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  describe "#list_recent" do
    it "returns entries across different authors/targets ordered by created_at desc" do
      author1 = SecureRandom.uuid_v7
      author2 = SecureRandom.uuid_v7
      target1 = SecureRandom.uuid_v7
      target2 = SecureRandom.uuid_v7
      now = Time.now

      e1 = repo.create(author_account_id: author1, target_account_id: target1, rating: 3.0, body: "first")
      repo.update(e1.id, created_at: now - 200)
      e2 = repo.create(author_account_id: author2, target_account_id: target2, rating: 4.0, body: "second")
      repo.update(e2.id, created_at: now - 100)

      page = repo.list_recent(limit: 1000)
      ours = page.select { |e| [e1.id, e2.id].include?(e.id) }

      expect(ours.map(&:id)).to eq([e2.id, e1.id])
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/review/repositories/entry_repository_spec.rb -e "#list_recent"`
Expected: FAIL（`NoMethodError: undefined method 'list_recent'`）

- [ ] **Step 3: `list_recent` を実装**

`dystopia/monolith/slices/review/repositories/entry_repository.rb` の `list_by_author` メソッドの直後に追加:

```ruby
      def list_recent(limit: 20, cursor: nil)
        scope = apply_cursor(entry_records, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end
```

- [ ] **Step 4: テストを再実行してパスを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/review/repositories/entry_repository_spec.rb`
Expected: PASS

- [ ] **Step 5: use caseの失敗するテストを書く**

`dystopia/monolith/spec/slices/review/use_cases/list_recent_entries_spec.rb` を新規作成:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ListRecentEntries do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      cast_settings_repo: cast_settings_repo,
      block_adapter: block_adapter,
      filter_visible_posts: filter_visible_posts,
      get_profile: get_profile,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:cast_settings_repo)    { double(:cast_settings_repository) }
  let(:block_adapter)         { double(:block_adapter) }
  let(:filter_visible_posts)  { double(:filter_visible_posts) }
  let(:get_profile)           { double(:get_profile) }
  let(:media_adapter)         { double(:media_adapter) }

  let(:viewer_id) { "viewer-1" }
  let(:author_id) { "author-1" }
  let(:target_id) { "target-1" }

  def entry(author: author_id, target: target_id, hidden: false, id: SecureRandom.uuid)
    double(:entry, id: id, author_account_id: author, target_account_id: target,
      rating: 4.0, body: "body", hidden: hidden, created_at: Time.now, updated_at: Time.now)
  end

  before do
    allow(cast_settings_repo).to receive(:find_by_account).and_return(nil)
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).and_return([])
    allow(filter_visible_posts).to receive(:call) { |viewer_account_id:, posts:| posts }
    allow(get_profile).to receive(:call) { |account_id:| double(:profile, username: "user-#{account_id}", avatar_media_id: nil) }
  end

  it "returns a visible entry that passes every check" do
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries].length).to eq(1)
    expect(result[:entries].first[:id]).to eq(e.id)
  end

  it "drops hidden entries" do
    e = entry(hidden: true)
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries whose target has reviews_visible = false" do
    allow(cast_settings_repo).to receive(:find_by_account).with(target_id).and_return(double(reviews_visible: false))
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the viewer is blocked with the author" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([author_id])
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the viewer is blocked with the target" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([target_id])
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the author or target is unreachable (private account, not followed)" do
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])
    allow(filter_visible_posts).to receive(:call) do |viewer_account_id:, posts:|
      posts.reject { |p| p.author_id == target_id }
    end

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "sets has_more and next_cursor when the repo returns limit + 1 rows" do
    e1 = entry(id: "e-1")
    e2 = entry(id: "e-2")
    e3 = entry(id: "e-3")
    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil).and_return([e1, e2, e3])

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries].length).to eq(2)
  end
end
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/review/use_cases/list_recent_entries_spec.rb`
Expected: FAIL（`NameError: uninitialized constant Review::UseCases::ListRecentEntries`）

- [ ] **Step 7: use caseを実装**

`dystopia/monolith/slices/review/use_cases/list_recent_entries.rb` を新規作成:

```ruby
# frozen_string_literal: true

require "set"
require "concerns/cursor_pagination"

module Review
  module UseCases
    class ListRecentEntries
      AuthorRef = Struct.new(:author_id)

      include Concerns::CursorPagination
      include Review::Deps[
        entry_repo: "repositories.entry_repository",
        cast_settings_repo: "repositories.cast_settings_repository"
      ]

      def initialize(entry_repo: nil, cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil,
                     get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, cast_settings_repo: cast_settings_repo).compact)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, limit: 20, cursor: nil)
        page = entry_repo.list_recent(limit: limit, cursor: cursor)
        has_more = page.length > limit
        page = page.take(limit)

        visible = filter_visible(viewer_account_id, page)

        next_cursor = if has_more && page.any?
          last = page.last
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def filter_visible(viewer_account_id, entries)
        return [] if entries.empty?

        not_hidden = entries.reject(&:hidden)
        visible_target_ids = not_hidden.map(&:target_account_id).uniq.select { |id| reviews_visible?(id) }
        not_hidden = not_hidden.select { |e| visible_target_ids.include?(e.target_account_id) }
        return [] if not_hidden.empty?

        blocked_ids = block_adapter.bidirectionally_blocked_ids(account_id: viewer_account_id)
        not_blocked = not_hidden.reject do |e|
          blocked_ids.include?(e.author_account_id) || blocked_ids.include?(e.target_account_id)
        end
        return [] if not_blocked.empty?

        reachable_ids = reachable_account_ids(viewer_account_id, not_blocked)
        not_blocked.select do |e|
          reachable_ids.include?(e.author_account_id) && reachable_ids.include?(e.target_account_id)
        end
      end

      def reachable_account_ids(viewer_account_id, entries)
        candidate_ids = (entries.map(&:author_account_id) + entries.map(&:target_account_id)).uniq
        refs = candidate_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_account_id: viewer_account_id, posts: refs).map(&:author_id).to_set
      end

      def reviews_visible?(target_account_id)
        settings = cast_settings_repo.find_by_account(target_account_id)
        settings.nil? || settings.reviews_visible != false
      end

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        target_profile = profile_cache[e.target_account_id] ||= get_profile.call(account_id: e.target_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          target_username: target_profile&.username,
          target_avatar_url: avatar_url_for(target_profile),
          rating: e.rating.to_f,
          body: e.body,
          hidden: e.hidden,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Review::Adapters::MediaAdapter.new
      end
    end
  end
end
```

- [ ] **Step 8: テストを再実行してパスを確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/review/use_cases/list_recent_entries_spec.rb`
Expected: PASS（全件）

- [ ] **Step 9: gRPCハンドラに`list_recent_entries`を追加**

`dystopia/monolith/slices/review/grpc/review_handler.rb` の `rpc :UpdateMySettings, ...` の直後に追加:

```ruby
      rpc :ListRecentEntries,   ::Review::V1::ListRecentEntriesRequest,   ::Review::V1::ListRecentEntriesResponse
```

`Review::Deps[...]` ブロック（`update_settings_uc: "use_cases.update_my_settings"` の行）の直後にキーを追加:

```ruby
        list_recent_uc:       "use_cases.list_recent_entries"
```

`update_my_settings` メソッドの直後に新規メソッドを追加:

```ruby
      def list_recent_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = list_recent_uc.call(
          viewer_account_id: current_user_id,
          limit: limit,
          cursor: cursor
        )
        ::Review::V1::ListRecentEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end
```

- [ ] **Step 10: 全体のrspecを実行**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/review`
Expected: PASS（全件、既存分含む）

- [ ] **Step 11: Commit**

```bash
git add dystopia/monolith/slices/review/repositories/entry_repository.rb \
  dystopia/monolith/slices/review/use_cases/list_recent_entries.rb \
  dystopia/monolith/slices/review/grpc/review_handler.rb \
  dystopia/monolith/spec/slices/review/repositories/entry_repository_spec.rb \
  dystopia/monolith/spec/slices/review/use_cases/list_recent_entries_spec.rb
git commit -s -m "feat(dystopia/monolith): add visibility-filtered ListRecentEntries to review"
```

---

## Task 4: Frontend karte — BFF route・型・hook

**Files:**
- Create: `dystopia/frontend/src/app/api/karte/recent/route.ts`
- Modify: `dystopia/frontend/src/modules/karte/types.ts`
- Create: `dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts`
- Modify: `dystopia/frontend/src/modules/karte/hooks/index.ts`

**Interfaces:**
- Consumes: Task 1で生成された `karteClient.listRecentEntries`、Task 2の `list_recent_entries` gRPCメソッド
- Produces: `GET /api/karte/recent?limit=&cursor=`、型 `PaginatedKarteRecentResponse`、`useRecentKarte(enabled: boolean) -> {entries, hasMore, loading, error, loadMore, refresh}`（Task 6・7が消費）

- [ ] **Step 1: 型を追加**

`dystopia/frontend/src/modules/karte/types.ts` の末尾に追加:

```ts

export interface PaginatedKarteRecentResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
}
```

- [ ] **Step 2: BFF routeを作成**

`dystopia/frontend/src/app/api/karte/recent/route.ts` を新規作成:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listRecentEntries({ limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map((e) => ({
        id: e.id,
        authorAccountId: e.authorAccountId,
        targetAccountId: e.targetAccountId,
        authorUsername: e.authorUsername || "",
        authorAvatarUrl: e.authorAvatarUrl || "",
        targetUsername: e.targetUsername || "",
        targetAvatarUrl: e.targetAvatarUrl || "",
        rating: e.rating,
        body: e.body || "",
        flagged: !!e.flagged,
        createdAt: e.createdAt
          ? new Date(Number(e.createdAt.seconds) * 1000).toISOString()
          : "",
        updatedAt: e.updatedAt
          ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString()
          : "",
      })),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListRecentKarte");
  }
}
```

- [ ] **Step 3: hookを作成**

`dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts` を新規作成:

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedKarteRecentResponse } from "../types";

export function useRecentKarte(enabled: boolean) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedKarteRecentResponse | null): string | null => {
    if (!enabled || !userId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/recent${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedKarteRecentResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    entries,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

- [ ] **Step 4: barrelに追加**

`dystopia/frontend/src/modules/karte/hooks/index.ts` の末尾に追加:

```ts
export { useRecentKarte } from "./useRecentKarte";
```

- [ ] **Step 5: 型チェック**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src/app/api/karte/recent/route.ts \
  dystopia/frontend/src/modules/karte/types.ts \
  dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts \
  dystopia/frontend/src/modules/karte/hooks/index.ts
git commit -s -m "feat(dystopia/frontend): add recent karte BFF route and hook"
```

---

## Task 5: Frontend review — BFF route・型・hook

**Files:**
- Create: `dystopia/frontend/src/app/api/review/recent/route.ts`
- Modify: `dystopia/frontend/src/modules/review/types.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useRecentReviews.ts`

**Interfaces:**
- Consumes: Task 1で生成された `reviewClient.listRecentEntries`、Task 3の `list_recent_entries` gRPCメソッド
- Produces: `GET /api/review/recent?limit=&cursor=`、型 `PaginatedReviewRecentResponse`、`useRecentReviews(enabled: boolean) -> {entries, hasMore, loading, error, loadMore, refresh}`（Task 6・7が消費）

- [ ] **Step 1: 型を追加**

`dystopia/frontend/src/modules/review/types.ts` の末尾に追加:

```ts

export interface PaginatedReviewRecentResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}
```

- [ ] **Step 2: BFF routeを作成**

`dystopia/frontend/src/app/api/review/recent/route.ts` を新規作成:

```ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

type ListEntry = Awaited<ReturnType<typeof reviewClient.listRecentEntries>>["entries"][number];

function entryToView(e: ListEntry) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    targetUsername: e.targetUsername || "",
    targetAvatarUrl: e.targetAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listRecentEntries({ limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map(entryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListRecentReviews");
  }
}
```

- [ ] **Step 3: hookを作成**

`dystopia/frontend/src/modules/review/hooks/useRecentReviews.ts` を新規作成:

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedReviewRecentResponse } from "../types";

export function useRecentReviews(enabled: boolean) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedReviewRecentResponse | null): string | null => {
    if (!enabled || !userId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/review/recent${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedReviewRecentResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    entries,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

- [ ] **Step 4: 型チェック**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/app/api/review/recent/route.ts \
  dystopia/frontend/src/modules/review/types.ts \
  dystopia/frontend/src/modules/review/hooks/useRecentReviews.ts
git commit -s -m "feat(dystopia/frontend): add recent review BFF route and hook"
```

---

## Task 6: カード表示 — `mode: "recent"`（author→target両方の身元表示）

**Files:**
- Modify: `dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewEntryCard.tsx`
- Test: `dystopia/frontend/src/modules/karte/components/KarteEntryCard.test.tsx`
- Test: `dystopia/frontend/src/modules/review/components/ReviewEntryCard.test.tsx`

**Interfaces:**
- Consumes: Task 4・5の `KarteEntry`/`ReviewEntry` 型（既存、変更なし）
- Produces: `<KarteEntryCard entry mode="recent" onChanged? />`、`<ReviewEntryCard entry mode="recent" onChanged? />`（Task 7が消費）

- [ ] **Step 1: KarteEntryCardの失敗するテストを書く**

`dystopia/frontend/src/modules/karte/components/KarteEntryCard.test.tsx` を新規作成:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useDeleteKarte", () => ({ useDeleteKarte: () => ({ remove: vi.fn(), loading: false }) }));
vi.mock("../hooks/useReportKarte", () => ({ useReportKarte: () => ({ report: vi.fn(), loading: false }) }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => null }));

const { KarteEntryCard } = await import("./KarteEntryCard");

const baseEntry = {
  id: "e-1",
  authorAccountId: "author-1",
  targetAccountId: "target-1",
  authorUsername: "cast_taro",
  authorAvatarUrl: "",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  rating: 4,
  body: "memo",
  flagged: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("KarteEntryCard recent mode", () => {
  it("shows both author and target identities", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={baseEntry} mode="recent" />);

    expect(html).toContain("cast_taro");
    expect(html).toContain("guest_hanako");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/karte/components/KarteEntryCard.test.tsx`
Expected: FAIL（`recent`が`mode`の型に存在せず、かつauthor/targetの両方は表示されない）

- [ ] **Step 3: `KarteEntryCard.tsx` を実装**

`Props` の `mode` を変更:

```ts
interface Props {
  entry: KarteEntry;
  mode: "my" | "target" | "recent";
  onChanged?: () => void;
}
```

ヘッダー部分（`<div className="flex items-center gap-2 text-sm">` の中身）を以下に置き換え:

```tsx
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityAvatar url={entry.authorAvatarUrl} />
            <span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
            <span className="text-muted-foreground">→</span>
            <IdentityAvatar url={entry.targetAvatarUrl} />
            <span className="font-medium">{entry.targetUsername || "(退会済)"}</span>
          </>
        ) : (
          <>
            <IdentityAvatar url={identityAvatarUrl} />
            <span className="font-medium">{identityUsername || "(退会済)"}</span>
          </>
        )}
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {entry.flagged && (
          <span
            className="ml-auto text-xs text-amber-600"
            title="他 Cast から複数件 report されています"
          >
            ⚠︎
          </span>
        )}
      </div>
```

ファイル末尾（`export function KarteEntryCard` の外）に追加:

```tsx
function IdentityAvatar({ url }: { url: string }) {
  if (!url) return <div className="size-8 rounded-full bg-muted" />;
  return (
    <Image src={url} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
  );
}
```

（Step 3のヘッダー部分の置き換えで元のavatar三項演算子ブロックはすでに置き換わっている）

- [ ] **Step 4: テストを再実行してパスを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/karte/components/KarteEntryCard.test.tsx`
Expected: PASS

- [ ] **Step 5: 既存の`GuestKarteTab`・`MyKartePage`が壊れていないか確認**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし（`mode="target"`/`mode="my"`の既存呼び出しはそのまま型に適合する）

- [ ] **Step 6: ReviewEntryCardの失敗するテストを書く**

`dystopia/frontend/src/modules/review/components/ReviewEntryCard.test.tsx` を新規作成:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useDeleteReview", () => ({ useDeleteReview: () => ({ remove: vi.fn(), loading: false }) }));
vi.mock("../hooks/useHideReview", () => ({ useHideReview: () => ({ hide: vi.fn(), loading: false }) }));
vi.mock("../hooks/useUnhideReview", () => ({ useUnhideReview: () => ({ unhide: vi.fn(), loading: false }) }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => null }));

const { ReviewEntryCard } = await import("./ReviewEntryCard");

const baseEntry = {
  id: "e-1",
  authorAccountId: "author-1",
  targetAccountId: "target-1",
  authorUsername: "guest_hanako",
  authorAvatarUrl: "",
  targetUsername: "cast_taro",
  targetAvatarUrl: "",
  rating: 4.5,
  body: "review body",
  hidden: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ReviewEntryCard recent mode", () => {
  it("shows both author and target identities", () => {
    const html = renderToStaticMarkup(<ReviewEntryCard entry={baseEntry} mode="recent" />);

    expect(html).toContain("guest_hanako");
    expect(html).toContain("cast_taro");
  });
});
```

- [ ] **Step 7: テストが失敗することを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/review/components/ReviewEntryCard.test.tsx`
Expected: FAIL

- [ ] **Step 8: `ReviewEntryCard.tsx` を実装**

`Props` の `mode` を変更:

```ts
interface Props {
  entry: ReviewEntry;
  mode: "written" | "received" | "recent";
  onChanged?: () => void;
}
```

ヘッダー部分を以下に置き換え:

```tsx
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityAvatar url={entry.authorAvatarUrl} />
            <span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
            <span className="text-muted-foreground">→</span>
            <IdentityAvatar url={entry.targetAvatarUrl} />
            <span className="font-medium">{entry.targetUsername || "(退会済)"}</span>
          </>
        ) : (
          <>
            <IdentityAvatar url={identityAvatarUrl} />
            <span className="font-medium">{identityUsername || "(退会済)"}</span>
          </>
        )}
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {isTarget && entry.hidden && (
          <span className="ml-auto text-xs text-amber-600">非表示中</span>
        )}
      </div>
```

ファイル末尾に追加（`KarteEntryCard.tsx`と同一の実装。同名コンポーネントだが別モジュールのため衝突しない）:

```tsx
function IdentityAvatar({ url }: { url: string }) {
  if (!url) return <div className="size-8 rounded-full bg-muted" />;
  return (
    <Image src={url} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
  );
}
```

（Step 8のヘッダー部分の置き換えで元のavatar三項演算子ブロックはすでに置き換わっている）

- [ ] **Step 9: テストを再実行してパスを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/review/components/ReviewEntryCard.test.tsx`
Expected: PASS

- [ ] **Step 10: 型チェック**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 11: Commit**

```bash
git add dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx \
  dystopia/frontend/src/modules/karte/components/KarteEntryCard.test.tsx \
  dystopia/frontend/src/modules/review/components/ReviewEntryCard.tsx \
  dystopia/frontend/src/modules/review/components/ReviewEntryCard.test.tsx
git commit -s -m "feat(dystopia/frontend): add recent mode to karte and review entry cards"
```

---

## Task 7: Homeページへのタブ統合

**Files:**
- Modify: `dystopia/frontend/src/app/page.tsx`
- Test: `dystopia/frontend/src/app/page.test.tsx`

**Interfaces:**
- Consumes: Task 4の `useRecentKarte`、Task 5の `useRecentReviews`、Task 6の `KarteEntryCard`/`ReviewEntryCard`（`mode="recent"`）、既存の `useAuthStore`/`selectRole`
- Produces: Homeページの5タブ構成（全国/エリア/フォロー中/カルテ[castのみ]/レビュー）

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/app/page.test.tsx` を新規作成:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/feed/hooks/useFeed", () => ({
  useFeed: () => ({
    posts: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    initialized: true,
    fetchInitial: vi.fn(),
    fetchMore: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/modules/profile/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { prefecture: "" } }),
}));

const authMocks = vi.hoisted(() => ({ useAuthStore: vi.fn() }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: authMocks.useAuthStore,
  selectRole: (s: { role: string | null }) => s.role,
}));

const karteMocks = vi.hoisted(() => ({ useRecentKarte: vi.fn() }));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: karteMocks.useRecentKarte }));

const reviewMocks = vi.hoisted(() => ({ useRecentReviews: vi.fn() }));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({ useRecentReviews: reviewMocks.useRecentReviews }));

const { default: HomePage } = await import("./page");

const emptyList = { entries: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };

describe("HomePage tabs", () => {
  it("shows the karte tab for a Cast viewer", () => {
    authMocks.useAuthStore.mockReturnValue("cast");
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("カルテ");
    expect(html).toContain("レビュー");
  });

  it("hides the karte tab for a Guest viewer but keeps the review tab", () => {
    authMocks.useAuthStore.mockReturnValue("guest");
    karteMocks.useRecentKarte.mockReturnValue(emptyList);
    reviewMocks.useRecentReviews.mockReturnValue(emptyList);

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).not.toContain("カルテ");
    expect(html).toContain("レビュー");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/page.test.tsx`
Expected: FAIL（`useRecentKarte`/`useRecentReviews`のモック対象パスが存在しない、または「カルテ」タブが常に出ない）

- [ ] **Step 3: `page.tsx` を実装**

ファイル全体を以下に置き換え:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { Button } from "@/components/ui/button";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useFeed } from "@/modules/feed/hooks/useFeed";
import { useProfile } from "@/modules/profile/hooks/useProfile";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useRecentKarte } from "@/modules/karte/hooks/useRecentKarte";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import { useRecentReviews } from "@/modules/review/hooks/useRecentReviews";
import { ReviewEntryCard } from "@/modules/review/components/ReviewEntryCard";
import type { FeedFilterValue } from "@/modules/feed/types";

type HomeTabValue = FeedFilterValue | "karte" | "reviews";

const POST_TAB_ITEMS: TabItem[] = [
  { id: "all", label: "全国" },
  { id: "area", label: "エリア" },
  { id: "following", label: "フォロー中" },
];

function isFeedFilter(tab: HomeTabValue): tab is FeedFilterValue {
  return tab === "all" || tab === "area" || tab === "following";
}

export default function HomePage() {
  const [tab, setTab] = useState<HomeTabValue>("all");
  const { profile } = useProfile();
  const role = useAuthStore(selectRole);
  const isPostTab = isFeedFilter(tab);
  const filter = isPostTab ? tab : "all";
  const prefecture = filter === "area" ? profile?.prefecture || undefined : undefined;

  const {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = useFeed({ filter, prefecture });

  // Avoid duplicate initial fetches because Next.js can invoke this effect twice.
  const lastFetchFingerprint = useRef<string>("");
  useEffect(() => {
    if (!isPostTab) return;
    const fingerprint = `${filter}::${prefecture ?? ""}`;
    if (lastFetchFingerprint.current === fingerprint) return;
    lastFetchFingerprint.current = fingerprint;
    reset();
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPostTab, filter, prefecture]);

  const karte = useRecentKarte(tab === "karte");
  const reviews = useRecentReviews(tab === "reviews");

  const tabItems: TabItem[] = useMemo(() => {
    const items = [...POST_TAB_ITEMS];
    if (role === "cast") items.push({ id: "karte", label: "カルテ" });
    items.push({ id: "reviews", label: "レビュー" });
    return items;
  }, [role]);

  const showAreaHint = filter === "area" && !prefecture;
  const showEmptyState = initialized && !loading && posts.length === 0 && !showAreaHint;

  const postContent = useMemo(() => {
    if (!initialized && loading) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    if (showAreaHint) {
      return (
        <p className="px-4 py-8 text-center text-text-secondary">
          エリアタブを使うにはプロフィールに都道府県を設定してください。
        </p>
      );
    }
    if (showEmptyState) {
      return <p className="px-4 py-8 text-center text-text-secondary">まだ投稿がありません</p>;
    }
    return (
      <>
        {posts.map((post) => (
          <PostCardBinding key={post.id} post={post} />
        ))}
        {hasMore && (
          <div className="px-4 py-4 text-center">
            <Button
              variant="secondary"
              onClick={() => fetchMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [initialized, loading, error, showAreaHint, showEmptyState, posts, hasMore, loadingMore, fetchMore]);

  const karteContent = useMemo(() => {
    if (karte.loading && karte.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (karte.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    if (karte.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">まだカルテがありません</p>;
    }
    return (
      <>
        {karte.entries.map((e) => (
          <KarteEntryCard key={e.id} entry={e} mode="recent" onChanged={karte.refresh} />
        ))}
        {karte.hasMore && (
          <div className="px-4 py-4 text-center">
            <Button variant="secondary" onClick={() => karte.loadMore()} disabled={karte.loading}>
              {karte.loading ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [karte.loading, karte.error, karte.entries, karte.hasMore, karte.refresh, karte.loadMore]);

  const reviewsContent = useMemo(() => {
    if (reviews.loading && reviews.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (reviews.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    if (reviews.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">まだレビューがありません</p>;
    }
    return (
      <>
        {reviews.entries.map((e) => (
          <ReviewEntryCard key={e.id} entry={e} mode="recent" onChanged={reviews.refresh} />
        ))}
        {reviews.hasMore && (
          <div className="px-4 py-4 text-center">
            <Button variant="secondary" onClick={() => reviews.loadMore()} disabled={reviews.loading}>
              {reviews.loading ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [reviews.loading, reviews.error, reviews.entries, reviews.hasMore, reviews.refresh, reviews.loadMore]);

  const content = tab === "karte" ? karteContent : tab === "reviews" ? reviewsContent : postContent;

  return (
    <main className="mx-auto flex max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 bg-bg">
        <Tabs
          items={tabItems}
          value={tab}
          onValueChange={(id) => setTab(id as HomeTabValue)}
        />
      </header>
      <section>{content}</section>
    </main>
  );
}
```

- [ ] **Step 4: テストを再実行してパスを確認**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/page.test.tsx`
Expected: PASS

- [ ] **Step 5: 型チェックと関連テスト一式を実行**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit && pnpm exec vitest run src/app/page.test.tsx src/modules/karte/components/KarteEntryCard.test.tsx src/modules/review/components/ReviewEntryCard.test.tsx`
Expected: 全てPASS

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src/app/page.tsx dystopia/frontend/src/app/page.test.tsx
git commit -s -m "feat(dystopia/frontend): add karte and review tabs to Home"
```

---

## Final verification

- [ ] `cd dystopia/monolith && bundle exec rspec spec/slices/karte spec/slices/review`（PASS。real DBが必要な場合はローカルPostgresを起動しHANAMI_ENV=testで実行する）
- [ ] `cd dystopia/frontend && pnpm exec tsc --noEmit`（PASS）
- [ ] `cd dystopia/frontend && pnpm exec vitest run`（PASS。既存分含め全体）
- [ ] 手元で `bin/dev` 等を使い、cast/guestそれぞれのアカウントでHomeを開き、タブ表示とカルテ/レビュー一覧の見た目を目視確認する
