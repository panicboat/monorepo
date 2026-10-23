# Dystopia Profile Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 他人のプロフィールを返すすべての応答を軽い共通の形 `profile.v1.ProfileSummary` にそろえ、作者・相手が鍵付きなら名前の横に鍵マークを出す。

**Architecture:** profile slice に、プロフィール id の配列から要約をまとめて作る use case `summarize_profiles` と、proto に詰める `ProfileSummaryPresenter` を置く。9 ドメインの handler と presenter はそれを呼ぶだけにする。frontend は `SocialProfileView` を `ProfileSummaryView` に改名して共通の型にし、名前は共通の部品 `ProfileName` で出す。4 段の stack で出す。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、protobuf（buf）、Next.js + SWR + connect-es（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-18-dystopia-profile-summary-design.md`

## Global Constraints

- `ProfileSummary` の項目は `profile_id`・`username`・`display_name`・`avatar_url`・`is_private`・`role` の 6 つ（番号 1〜6）
- 停止中のプロフィールと無効化されたアカウントのプロフィールは要約を作らない（`find_visible_by_id` と同じ基準）。要約がない作者・相手は項目を未設定にし、画面は「削除したプロフィール」と出す
- プロフィールの画面と編集の応答（`GetProfile`・`GetProfileByUsername`・`ListMyProfiles`・`SaveProfile` など）は完全な `Profile` のまま変えない
- frontend の共通の型は `ProfileSummaryView`（`src/modules/profile/types.ts`）。項目は `profileId`・`username`・`displayName`・`avatarUrl`・`isPrivate`・`role`
- 鍵マークは `LockMark`（読み上げ名「鍵付き」）。投稿の非公開の印は `Users` アイコン（読み上げ名「フォロワーのみ」）
- proto はその場で作り替える。スタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、変更した package の差分だけを commit する（他 package の差分と未追跡の `billing` スタブは戻す）
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` は付けない、末尾に `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証は `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`（`spec_helper` が `spec/support` の billing の spec 6 件も一緒に走らせる）
- frontend の検証は `cd dystopia/frontend && pnpm exec vitest run <paths>` と `pnpm exec tsc --noEmit`（`pnpm lint` は使えない）
- 各段の最後に push して Draft PR を作り、`gh stack submit --auto` で stack に入れる。PR のタイトルは英語の conventional、本文は見出しが英語で本文が日本語（Why / What / Verification）、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL

## Review Focus

1. 一覧の途中に停止中のプロフィールが混ざったとき: その要素だけが消え、他の要素の順番と件数は変わらない（Task 2 の spec で固定）
2. 同じプロフィールが一覧に何度も出るとき（同じ作者の投稿が並ぶ）: 要約は 1 回だけ引かれ、どの要素にも同じ要約が付く（Task 1 の spec で固定）
3. 表示名が空のプロフィール: 名前の欄が空にならず `@username` を出す（Task 8 のテストで固定）
4. メッセージの相手が停止中になったスレッド: 一覧から落ちず、相手が「削除したプロフィール」と出る（Task 2 の spec と Task 10 のテストで固定）
5. 鍵付きでない作者: 鍵マークが出ない（Task 8 のテストで固定。各カードのテストは鍵付きの場合と両方を確かめる）

---

## Stage 1: Summary foundation and profile-embedding domains (branch `refactor/dystopia-profile-summary`)

このブランチは作成済みで、spec の commit が乗っている。作業場所は `.worktrees/fix-dystopia-reply-render`。

### Task 1: ProfileSummary proto, summarize_profiles and presenter

**Files:**
- Modify: `proto/dystopia/profile/v1/service.proto`（`ProfileSummary` を追加）
- Regenerate: `dystopia/monolith/stubs/profile/v1/*`、`dystopia/frontend/src/stub/profile/v1/*`
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`（2 メソッド追加）
- Create: `dystopia/monolith/slices/profile/use_cases/summarize_profiles.rb`
- Create: `dystopia/monolith/slices/profile/presenters/profile_summary_presenter.rb`
- Create: `dystopia/monolith/spec/slices/profile/use_cases/summarize_profiles_spec.rb`
- Create: `dystopia/monolith/spec/slices/profile/presenters/profile_summary_presenter_spec.rb`

**Interfaces:**
- Produces:
  - `Profile::Slice["use_cases.summarize_profiles"].call(profile_ids:)` → `Hash{String => Profile::UseCases::SummarizeProfiles::Summary}`（キーはプロフィール id の文字列。見えないプロフィールはキーごと含まない）
  - `Profile::UseCases::SummarizeProfiles::Summary = Data.define(:profile_id, :username, :display_name, :avatar_url, :is_private, :role)`
  - `Profile::Presenters::ProfileSummaryPresenter.to_proto(summary)` → `::Profile::V1::ProfileSummary` か `nil`
  - `ProfileRepository#visible_by_ids(ids)` → 見えるプロフィールの行の配列、`#roles_by_account_ids(account_ids)` → `Hash{String => Integer}`

- [ ] **Step 1: Add the proto message and regenerate**

`proto/dystopia/profile/v1/service.proto` の `message Profile { ... }` の直後に追加する。

```proto
message ProfileSummary {
  string profile_id = 1;
  string username = 2;
  string display_name = 3;
  string avatar_url = 4;
  bool is_private = 5;
  int32 role = 6;
}
```

```bash
cd dystopia/monolith && bin/codegen && cd ../frontend && pnpm proto:gen && cd ../..
git status --short | awk '{print $2}' | /usr/bin/grep -E 'stubs?/' | /usr/bin/grep -v '/profile/' | xargs -I{} sh -c 'git checkout -- "{}" 2>/dev/null || rm -rf "{}"'
git status --short
```

Expected: 差分は proto と `profile` package のスタブだけ

- [ ] **Step 2: Write the failing specs**

`spec/slices/profile/use_cases/summarize_profiles_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::SummarizeProfiles", type: :database do
  let(:uc) { Profile::Slice["use_cases.summarize_profiles"] }
  let(:db) { Hanami.app["db.gateway"].connection }

  it "summarizes each visible profile with its role and privacy" do
    cast = create_account_with_profile(role: 2, username: "rin", display_name: "りん", is_private: true)
    guest = create_account_with_profile(role: 1, username: "hanako", display_name: "はなこ")

    summaries = uc.call(profile_ids: [cast, guest])

    expect(summaries[cast].to_h).to eq(profile_id: cast, username: "rin", display_name: "りん", avatar_url: "", is_private: true, role: 2)
    expect(summaries[guest].to_h).to include(username: "hanako", is_private: false, role: 1)
  end

  it "fills the avatar url from the media slice" do
    profile = create_account_with_profile(username: "with_avatar")
    media_id = SecureRandom.uuid_v7
    db[:profile__profiles].where(id: profile).update(avatar_media_id: media_id)
    file = Struct.new(:id, :url).new(media_id, "https://cdn.example/avatar.png")
    allow(Media::Slice["use_cases.get_media_batch"]).to receive(:call).with(ids: [media_id]).and_return([file])

    expect(uc.call(profile_ids: [profile])[profile].avatar_url).to eq("https://cdn.example/avatar.png")
  end

  it "leaves out disabled profiles, deactivated accounts, unknown and malformed ids" do
    disabled = create_account_with_profile(username: "disabled")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)
    deactivated_account = create_account
    deactivated = create_account_with_profile(account_id: deactivated_account, username: "deactivated")
    db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)
    shown = create_account_with_profile(username: "shown")

    summaries = uc.call(profile_ids: [disabled, deactivated, SecureRandom.uuid_v7, "abc", nil, shown, shown])

    expect(summaries.keys).to eq([shown])
  end

  it "returns an empty hash for no ids" do
    expect(uc.call(profile_ids: [])).to eq({})
  end

  it "keeps the order of the given ids and reads the repository once per batch" do
    ids = Array.new(5) { |i| create_account_with_profile(username: "many_#{i}") }.reverse
    repo = Profile::Slice["repositories.profile_repository"]
    allow(repo).to receive(:visible_by_ids).and_call_original
    allow(repo).to receive(:roles_by_account_ids).and_call_original

    summaries = Profile::UseCases::SummarizeProfiles.new(profile_repository: repo).call(profile_ids: ids)

    expect(summaries.keys).to eq(ids)
    expect(repo).to have_received(:visible_by_ids).once
    expect(repo).to have_received(:roles_by_account_ids).once
  end
end
````create_account_with_profile` に `is_private:` を渡せないときは、作成後に `db[:profile__profiles].where(id: cast).update(is_private: true)` で設定する。

`spec/slices/profile/presenters/profile_summary_presenter_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Profile::Presenters::ProfileSummaryPresenter do
  it "copies every field into the proto" do
    summary = Profile::UseCases::SummarizeProfiles::Summary.new(
      profile_id: "p-1", username: "rin", display_name: "りん", avatar_url: "https://cdn.example/a.png", is_private: true, role: 2
    )

    proto = described_class.to_proto(summary)

    expect([proto.profile_id, proto.username, proto.display_name, proto.avatar_url, proto.is_private, proto.role])
      .to eq(["p-1", "rin", "りん", "https://cdn.example/a.png", true, 2])
  end

  it "returns nil for no summary" do
    expect(described_class.to_proto(nil)).to be_nil
  end
end
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/profile/use_cases/summarize_profiles_spec.rb spec/slices/profile/presenters/profile_summary_presenter_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: FAIL（`use_cases.summarize_profiles` が登録されていない、`ProfileSummaryPresenter` が未定義）

- [ ] **Step 4: Implement**

`slices/profile/repositories/profile_repository.rb` の `visible_ids(ids)` の下に追加する。

```ruby
      def visible_by_ids(ids)
        ids = ids.select { |id| uuid?(id) }
        return [] if ids.empty?

        visible_profiles.where(id: ids).to_a
      end

      def roles_by_account_ids(account_ids)
        return {} if account_ids.empty?

        profiles.dataset.db[:identity__accounts].where(id: account_ids).select_hash(:id, :role).transform_keys(&:to_s)
      end
```

`slices/profile/use_cases/summarize_profiles.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class SummarizeProfiles
      Summary = Data.define(:profile_id, :username, :display_name, :avatar_url, :is_private, :role)

      include Deps["repositories.profile_repository"]

      def initialize(media_adapter: nil, **deps)
        super(**deps)
        @media_adapter = media_adapter
      end

      def call(profile_ids:)
        ids = Array(profile_ids).compact.map(&:to_s).uniq
        rows = profile_repository.visible_by_ids(ids)
        return {} if rows.empty?

        roles = profile_repository.roles_by_account_ids(rows.map { |row| row.account_id.to_s }.uniq)
        avatars = media_adapter.find_by_ids(rows.filter_map { |row| row.avatar_media_id unless row.avatar_media_id.to_s.empty? })
        by_id = rows.to_h { |row| [row.id.to_s, row] }

        ids.each_with_object({}) do |id, summaries|
          row = by_id[id]
          next unless row

          summaries[id] = Summary.new(
            profile_id: id,
            username: row.username || "",
            display_name: row.display_name || "",
            avatar_url: avatars[row.avatar_media_id]&.url || "",
            is_private: row.is_private ? true : false,
            role: roles[row.account_id.to_s] || 0
          )
        end
      end

      private

      def media_adapter
        @media_adapter ||= Profile::Adapters::MediaAdapter.new
      end
    end
  end
end
```

`slices/profile/presenters/profile_summary_presenter.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module Presenters
    class ProfileSummaryPresenter
      def self.to_proto(summary)
        return nil unless summary

        ::Profile::V1::ProfileSummary.new(
          profile_id: summary.profile_id,
          username: summary.username,
          display_name: summary.display_name,
          avatar_url: summary.avatar_url,
          is_private: summary.is_private,
          role: summary.role
        )
      end
    end
  end
end
```

- [ ] **Step 5: Run the specs**

Run: Step 3 と同じ
Expected: 0 failures（billing の 6 件を除いた件数で、追加した 7 例が通る）

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/profile dystopia/monolith/stubs/profile dystopia/frontend/src/stub/profile dystopia/monolith/slices/profile dystopia/monolith/spec/slices/profile
git commit -s -m "feat(dystopia): summarize profiles in one batched call

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 2: Switch the five profile-embedding domains (backend)

**Files:**
- Modify: `proto/dystopia/footprints/v1/footprints_service.proto`、`discovery/v1/discovery_service.proto`、`social/v1/follow_service.proto`、`social/v1/block_service.proto`、`messaging/v1/messaging_service.proto`、`notifications/v1/notification_service.proto`
- Regenerate: 6 package のスタブ（monolith と frontend）
- Modify: `dystopia/monolith/slices/footprints/grpc/footprints_handler.rb`、`discovery/grpc/discovery_handler.rb`、`social/grpc/follow_handler.rb`、`social/grpc/block_handler.rb`、`messaging/grpc/messaging_handler.rb`、`notifications/grpc/notification_handler.rb`
- Modify: 各 handler の spec（`spec/slices/{footprints,discovery,social,messaging,notifications}/grpc/*_spec.rb` のうち、応答のプロフィールを見ているもの）

**Interfaces:**
- Consumes: Task 1 の `summarize_profiles` と `ProfileSummaryPresenter`
- Produces: 6 package の応答のプロフィール項目が `profile.v1.ProfileSummary`（項目名 `visitor`・`profiles`・`counterpart`・`latest_actor` は変えない）

- [ ] **Step 1: Change the protos and regenerate**

各 proto の該当項目の型を `profile.v1.Profile` から `profile.v1.ProfileSummary` に替える（項目名と番号は変えない）。

```bash
cd proto/dystopia
for f in footprints/v1/footprints_service.proto discovery/v1/discovery_service.proto social/v1/follow_service.proto social/v1/block_service.proto messaging/v1/messaging_service.proto notifications/v1/notification_service.proto; do
  sed -i '' 's/profile\.v1\.Profile /profile.v1.ProfileSummary /g' "$f"
done
/usr/bin/grep -rn "profile.v1.Profile\b" . | /usr/bin/grep -v ProfileSummary
cd ../../dystopia/monolith && bin/codegen && cd ../frontend && pnpm proto:gen && cd ../..
git status --short | awk '{print $2}' | /usr/bin/grep -E 'stubs?/' | /usr/bin/grep -vE '/(footprints|discovery|social|messaging|notifications)/' | xargs -I{} sh -c 'git checkout -- "{}" 2>/dev/null || rm -rf "{}"'
```

Expected: 最初の grep が何も出さない。残る stub の差分は 5 package だけ

- [ ] **Step 2: Write failing handler expectations**

各 handler の spec で応答のプロフィールを見ている例に、次を足す（既存の例の中で、プロフィールを返す呼び出しの直後）。spec ファイルの場所は `ls spec/slices/{footprints,discovery,social,messaging,notifications}/grpc/` で確かめる。

- 足あと（`list_footprints`）: `expect(res.footprints.first.visitor).to be_a(::Profile::V1::ProfileSummary)` と、訪問者が鍵付きなら `is_private` が true
- 検索のユーザー（`search_users`）: 返った要約の `avatar_url` が、アイコンを設定したプロフィールで空でない（`Media::Slice["use_cases.get_media_batch"]` を `allow(...).to receive(:call).and_return([Struct.new(:id, :url).new(media_id, "https://cdn.example/a.png")])` で差し替える）
- フォロー一覧（`list_following` など 3 つ）とブロック一覧（`list_blocked`）: `res.profiles.first` が `ProfileSummary` で、`role` と `is_private` が入る
- メッセージ（`list_threads`）: 相手が停止中のスレッドで、`counterpart` が `nil` になり、スレッドは一覧に残る
- 通知（`list_notifications`）: `latest_actor` が `ProfileSummary`

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/footprints spec/slices/discovery spec/slices/social spec/slices/messaging spec/slices/notifications > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: 足した期待が FAIL する（handler がまだ `ProfilePresenter` を使っている）

- [ ] **Step 3: Replace present_profile in each handler**

6 つの handler で、`present_profile` / `profile_to_proto` と、`role_for`・`identity_account_repo`・`cast_repository` の private メソッドを削除し、次の 2 つに置き換える（`present_profiles` は一覧用、`present_summary` は 1 件用）。

```ruby
      def present_profiles(profiles)
        summaries = summarize_profiles.call(profile_ids: profiles.compact.map(&:id))
        profiles.compact.filter_map { |profile| ::Profile::Presenters::ProfileSummaryPresenter.to_proto(summaries[profile.id.to_s]) }
      end

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end
```

呼び出し側:

- `discovery_handler.rb`: `profiles: result[:profiles].map { |p| present_profile(p) }` の 2 箇所を `profiles: present_profiles(result[:profiles])`
- `follow_handler.rb`: 3 箇所を同様に、`block_handler.rb`: 1 箇所を同様に
- `footprints_handler.rb`: `profiles_by_id` を作る `each_with_object` と `get_profile` を、`summaries = summarize_profiles.call(profile_ids: visitor_profile_ids)` に替え、`filter_map` の中を次にする

```ruby
        footprints = result[:rows].filter_map do |row|
          summary = summaries[row[:visitor_profile_id].to_s]
          next nil unless summary

          ::Footprints::V1::Footprint.new(
            visitor: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(summary),
            last_visited_at: to_proto_ts(row[:last_visited_at]),
            is_unread: row[:is_unread],
            visit_count: row[:visit_count]
          )
        end
```

  `get_profile` の private メソッドが他で使われていなければ削除する

- `notification_handler.rb`: `list_notifications` の先頭で `summaries = summarize_profiles.call(profile_ids: result[:rows].map(&:latest_actor_profile_id))` を作り、`latest_actor: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(summaries[row.latest_actor_profile_id.to_s])` にする（`profiles_by_actor_profile_id` は使わなくなる。use case 側で使われていなければ、その値を作る処理は残してよい）
- `messaging_handler.rb`: `profile_to_proto(counterpart_row)` を、`::Profile::Presenters::ProfileSummaryPresenter.to_proto(summarize_profiles.call(profile_ids: [counterpart_row.id])[counterpart_row.id.to_s])` にする。`counterpart_row` が nil なら nil のまま。一覧（`list_threads`）でスレッドごとに 1 回呼ぶのは許容する（スレッド一覧の 1 ページは 20 件まで）

- [ ] **Step 4: Run the five domains' specs**

Run: Step 2 と同じ
Expected: 0 failures

- [ ] **Step 5: Run the whole monolith suite and commit**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -5 <scratchpad>/rspec.log`
Expected: 0 failures

```bash
git add proto/dystopia dystopia/monolith
git commit -s -m "refactor(dystopia): return profile summaries from the social, discovery, messaging, notification and footprint services

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

frontend は旧スタブの型を参照していて `tsc` が通らない。Task 3 で直す。

### Task 3: ProfileSummaryView and the five domains' frontend, then the stage 1 PR

**Files:**
- Modify: `dystopia/frontend/src/modules/profile/types.ts`（`ProfileSummaryView` を追加）
- Modify: `dystopia/frontend/src/modules/social/types.ts`（`SocialProfileView` を削除）
- Modify: `dystopia/frontend/src/modules/profile/lib/mappers.ts`（`summaryToView` を追加）、`mappers.test.ts`
- Modify: `dystopia/frontend/src/modules/social/lib/mappers.ts`（`profileToSocialProfile` を削除）、`mappers.test.ts`
- Modify: `SocialProfileView` の全参照（`/usr/bin/grep -rln SocialProfileView src` の 17 ファイル）
- Modify: `app/api/discovery/users/route.ts`、`app/api/discovery/suggested-users/route.ts`、`app/api/social/{blocks,followers,following}/route.ts` と、フォロー申請の route（`/usr/bin/grep -rln profileToSocialProfile src/app` で見つかるもの）
- Modify: `src/modules/messaging/lib/mappers.ts`、`src/modules/notifications/lib/mappers.ts`、`src/modules/footprints/lib/mappers.ts`、`src/modules/footprints/types.ts`（`FootprintVisitorView` を `ProfileSummaryView` に置き換え）と、足あとの画面で `visitor.avatarUrl` が `null` を前提にしている箇所

**Interfaces:**
- Consumes: Task 2 のスタブ（`ProfileSummary` を返す 5 package）
- Produces:
  - `ProfileSummaryView { profileId: string; username: string; displayName: string; avatarUrl: string; isPrivate: boolean; role: Role | null }`（`@/modules/profile/types`）
  - `summaryToView(summary: ProfileSummary): ProfileSummaryView`（`@/modules/profile/lib/mappers`）

- [ ] **Step 1: Write the failing mapper test**

`src/modules/profile/lib/mappers.test.ts` に追加する。

```ts
import { create } from "@bufbuild/protobuf";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { summaryToView } from "./mappers";

describe("summaryToView", () => {
  it("maps every field and the role number", () => {
    const view = summaryToView(
      create(ProfileSummarySchema, { profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "https://cdn.example/a.png", isPrivate: true, role: 2 })
    );

    expect(view).toEqual({ profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "https://cdn.example/a.png", isPrivate: true, role: "cast" });
  });

  it("reads an unknown role as null", () => {
    expect(summaryToView(create(ProfileSummarySchema, { profileId: "p-2", role: 0 })).role).toBeNull();
  });
});
```

スタブの生成形式が `create(...Schema)` でない場合（`new ProfileSummary(...)` の形式）は、同じファイルの既存のテストが使っている作り方に合わせる。

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/profile/lib/mappers.test.ts`
Expected: FAIL（`summaryToView` がない）

- [ ] **Step 2: Add the type and the mapper**

`src/modules/profile/types.ts` に追加する。

```ts
import type { Role } from "@/lib/auth";

export interface ProfileSummaryView {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
  role: Role | null;
}
```

`src/modules/profile/lib/mappers.ts` に追加する。

```ts
import type { ProfileSummary } from "@/stub/profile/v1/service_pb";
import type { ProfileSummaryView } from "@/modules/profile/types";

const ROLE_BY_NUMBER: Record<number, ProfileSummaryView["role"]> = { 1: "guest", 2: "cast" };

export function summaryToView(summary: ProfileSummary): ProfileSummaryView {
  return {
    profileId: summary.profileId,
    username: summary.username,
    displayName: summary.displayName,
    avatarUrl: summary.avatarUrl,
    isPrivate: !!summary.isPrivate,
    role: ROLE_BY_NUMBER[summary.role] ?? null,
  };
}
```

- [ ] **Step 3: Rename SocialProfileView and switch the mappers**

```bash
cd dystopia/frontend/src
/usr/bin/grep -rl "SocialProfileView" . | xargs sed -i '' 's/SocialProfileView/ProfileSummaryView/g'
/usr/bin/grep -rn "ProfileSummaryView" . | /usr/bin/grep "import" | /usr/bin/grep -v "modules/profile/types" | cut -c1-160
```

- `modules/social/types.ts` の `export interface ProfileSummaryView {...}` を削除し、`import type { ProfileSummaryView } from "@/modules/profile/types";` に替える。同じファイルの他の型（`PaginatedProfilesResponse` など）はそのまま `ProfileSummaryView` を使う
- 上の grep で出た import のうち、`ProfileSummaryView` を `@/modules/social/types` や `@/modules/social` から取っているものを `@/modules/profile/types` に替える（`modules/social/index.ts` が型を再 export していればそれでもよいが、新しい import は `@/modules/profile/types` から取る）
- `modules/social/lib/mappers.ts` の `profileToSocialProfile` を削除し、呼び出し（discovery の 2 route、social の route、`modules/messaging/lib/mappers.ts`、`modules/notifications/lib/mappers.ts`）を `summaryToView` に替える
- `modules/social/lib/mappers.test.ts` の `profileToSocialProfile` のテストを削除する（`summaryToView` のテストに置き換わった）
- `modules/footprints/types.ts` の `FootprintVisitorView` を削除し、`FootprintView.visitor` を `ProfileSummaryView` にする。`modules/footprints/lib/mappers.ts` の `visitor: {...}` を `visitor: visitor ? summaryToView(visitor) : null` にし、`FootprintView.visitor` を `ProfileSummaryView | null` にする。足あとの画面で `visitor` を使う箇所は、`null` のとき「削除したプロフィール」を出す（`avatarUrl` は `null` ではなく空文字になる）

- [ ] **Step 4: Run all frontend checks**

Run: `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; /usr/bin/grep -E "×|FAIL|Tests |Test Files" <scratchpad>/vitest.log | head -30; pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: 全件 PASS、tsc exit 0。失敗したテストは、モックが旧スタブの `Profile` の形（`id`・`role` など）で作られているものが多いので、`ProfileSummary` の形（`profileId` など）に直す。テストの意図は変えない

- [ ] **Step 5: Commit, push and open the PR**

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): share one profile summary view across the frontend

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
git push -u origin HEAD
gh pr create --draft --base main --title "refactor(dystopia): return profile summaries from profile-embedding services" --body-file <scratchpad>/pr-stage1.md
gh stack init refactor/dystopia-profile-summary
gh stack submit --auto
```

`<scratchpad>/pr-stage1.md`: Why（他人のプロフィールを返す応答の形が 2 系統あり、鍵の情報が投稿などに届かない。組み立ても散らばり、検索のユーザーはアイコンが空だった）、What（`ProfileSummary`・`summarize_profiles`・5 ドメインの切り替え・`ProfileSummaryView` への改名）、Verification、末尾の 2 行。`gh stack init` がすでに stack を持つと言う場合は、`gh stack init` を飛ばして `gh stack submit --auto` だけを実行する。

---

## Stage 2: Post and comment authors (branch `refactor/dystopia-post-author-summary`)

- [ ] **Step 0: Create the branch**: `gh stack add refactor/dystopia-post-author-summary`

### Task 4: Post and comment authors (backend)

**Files:**
- Modify: `proto/dystopia/post/v1/post_service.proto`（`PostAuthor` を削除し、`Post.author` を `profile.v1.ProfileSummary` に）、`proto/dystopia/post/v1/comment_service.proto`（`CommentAuthor` を削除し、`Comment.author` を `profile.v1.ProfileSummary` に）。どちらも `import "profile/v1/service.proto";` を足す
- Regenerate: `post` package のスタブ（monolith と frontend）
- Modify: `dystopia/monolith/slices/post/presenters/post_presenter.rb`、`comment_presenter.rb`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`、`comment_handler.rb`、`use_cases/posts/list_posts_by_ids.rb`、`use_cases/comments/{list_comments,list_replies,list_comments_by_author}.rb`、`use_cases/comments/add_comment.rb`（作者を組み立てていれば）
- Delete: `dystopia/monolith/slices/post/adapters/profile_author_adapter.rb`、`adapters/account_adapter.rb` の `get_user_type`・`get_user_types_batch`（他で使われていなければファイルごと）
- Modify: post の handler と use case の spec

**Interfaces:**
- Consumes: `summarize_profiles`、`ProfileSummaryPresenter`
- Produces: `Post.author` と `Comment.author` が `profile.v1.ProfileSummary`。`PostPresenter.to_post_proto(post, author:, ...)` と `CommentPresenter.to_proto(comment, author:, ...)` / `many_to_proto(comments, authors:, ...)` の `author` は `SummarizeProfiles::Summary` か nil

- [ ] **Step 1: Change the protos and regenerate**

`post_service.proto`: `message PostAuthor {...}` を削除し、`Post` の `PostAuthor author = N;` を `profile.v1.ProfileSummary author = N;` にする（番号は変えない）。`comment_service.proto`: `message CommentAuthor {...}` を削除し、`Comment` の `CommentAuthor author = N;` を `profile.v1.ProfileSummary author = N;` にする。両ファイルの import に `import "profile/v1/service.proto";` を足す。Task 2 Step 1 と同じ方法で再生成し、`post` package 以外のスタブの差分を戻す。

- [ ] **Step 2: Write failing expectations**

`spec/slices/post/grpc/post_handler_spec.rb` と `comment_handler_spec.rb`（なければ `ls spec/slices/post/grpc` で該当を探す）の、投稿・コメントを返す例に足す。

```ruby
    it "returns the author as a profile summary with its privacy" do
      # 鍵付きの作者の投稿を作り、get_post（コメントなら list_comments）で取得する
      expect(response.post.author).to be_a(::Profile::V1::ProfileSummary)
      expect(response.post.author.is_private).to be true
    end
```

（各 spec の既存の helper で投稿とコメントを作る形に合わせて書く。作者のプロフィールは `db[:profile__profiles].where(id: author).update(is_private: true)` で鍵付きにする）

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: FAIL（`PostAuthor` が消えたので presenter が落ちる、または期待が満たされない）

- [ ] **Step 3: Use summaries in the post slice**

- `post_presenter.rb`: `post_author_to_proto` を削除し、`author: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(author)` にする
- `comment_presenter.rb`: `author_to_proto` を削除し、`author: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(author)` にする
- `profile_author_adapter.load(ids)` の呼び出しをすべて `summarize_profiles.call(profile_ids: ids)` に替える（`/usr/bin/grep -rn "profile_author_adapter" slices/post` で全箇所を出す）。戻り値の形（id → `username`・`display_name`・`avatar_url` を持つ値）は同じなので、`.transform_values(&:username)` や `.any?`・`.empty?` の使い方はそのまま動く。キーは文字列なので、`authors[post.author_profile_id]` は `authors[post.author_profile_id.to_s]` にする
- コメントの use case と handler の `build_authors` / `get_comment_author` は、`{ id:, name:, image_url:, user_type:, username: }` のハッシュを作るのをやめ、要約（`Summary`）をそのまま返す
- 各クラスの `profile_author_adapter` の DI（`include Deps[...]` や private メソッド）を `summarize_profiles`（`::Profile::Slice["use_cases.summarize_profiles"]`）に替える
- `adapters/profile_author_adapter.rb` を削除する。`adapters/account_adapter.rb` の `get_user_type` 系が他で使われていなければ削除する

- [ ] **Step 4: Run the post specs, then the whole suite, and commit**

Run: Step 2 と同じあと、`HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -5 <scratchpad>/rspec.log`
Expected: 0 failures

```bash
git add proto/dystopia/post dystopia/monolith
git commit -s -m "refactor(dystopia): return post and comment authors as profile summaries

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 5: Post and comment authors (frontend), then the stage 2 PR

**Files:**
- Modify: `src/modules/post/lib/post-view.ts`（`PostAuthorView` を削除、`author: ProfileSummaryView | null`）、`post-mappers.ts`（`mapPostAuthorToView` を削除し `summaryToView` を使う）
- Modify: `src/modules/post/lib/comment-view.ts`（`CommentAuthorView` を削除、`author: ProfileSummaryView | null`）、`comment-mappers.ts`
- Modify: コメントの作者の参照（`author.name` → `author.displayName`、`author.imageUrl` → `author.avatarUrl`、`userType` → `role`）。`/usr/bin/grep -rn "\.author?\?\.\(name\|imageUrl\|userType\)" src` で全箇所を出す
- Modify: `src/lib/types/index.ts` の `Author`・`AuthorWithType`・`UserType` が使われなくなれば削除
- Modify: 変換のテスト

**Interfaces:**
- Consumes: Task 4 のスタブ、`summaryToView`
- Produces: `PostView.author: ProfileSummaryView | null`、`CommentView.author: ProfileSummaryView | null`

- [ ] **Step 1: Write the failing mapper tests**

`post-mappers.test.ts` に、作者が鍵付きの投稿を変換すると `author.isPrivate` が true になり、作者がない（未設定）なら `author` が null になる例を足す。`comment-mappers.test.ts` に、コメントの作者が `displayName`・`avatarUrl`・`isPrivate` を持つ例を足す（既存の `name`・`imageUrl` の期待は削除する）。

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/post/lib`
Expected: FAIL

- [ ] **Step 2: Switch the types and mappers**

- `post-mappers.ts`: `author: p.author ? summaryToView(p.author) : null`
- `comment-mappers.ts`: `mapAuthor` を削除し、`author: c.author ? summaryToView(c.author) : null`
- 型を上の Files のとおり替え、`pnpm exec tsc --noEmit` のエラーをすべて、上の対応表（`name` → `displayName` など）で直す

- [ ] **Step 3: Run all frontend checks, commit, push and open the PR**

Run: `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; /usr/bin/grep -E "×|FAIL|Tests |Test Files" <scratchpad>/vitest.log | head; pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: 全件 PASS、tsc exit 0

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): read post and comment authors as profile summaries

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
git push -u origin HEAD
gh pr create --draft --base refactor/dystopia-profile-summary --title "refactor(dystopia): return post and comment authors as profile summaries" --body-file <scratchpad>/pr-stage2.md
gh stack submit --auto
```

---

## Stage 3: Karte and review parties (branch `refactor/dystopia-karte-review-summary`)

- [ ] **Step 0: Create the branch**: `gh stack add refactor/dystopia-karte-review-summary`

### Task 6: Karte and review parties (backend)

**Files:**
- Modify: `proto/dystopia/karte/v1/service.proto`、`proto/dystopia/review/v1/service.proto`
- Regenerate: `karte`・`review` package のスタブ
- Modify: `dystopia/monolith/slices/karte/use_cases/present_kartes.rb`、`grpc/karte_handler.rb`、`dystopia/monolith/slices/review/use_cases/present_reviews.rb`、`grpc/review_handler.rb`
- Modify: karte と review の spec（`author_username` などを見ている箇所）

**Interfaces:**
- Consumes: `summarize_profiles`、`ProfileSummaryPresenter`
- Produces: `Karte` / `Review` の `ProfileSummary author`・`ProfileSummary target`。use case の返す hash は `author:`・`target:` に `Summary` か nil を持ち、`author_username` などの平たいキーは持たない

- [ ] **Step 1: Change the protos and regenerate**

`karte.v1.Karte` と `review.v1.Review` から、`author_username`・`author_display_name`・`author_avatar_url`・`target_username`・`target_display_name`・`target_avatar_url` を削除し、`profile.v1.ProfileSummary author` と `profile.v1.ProfileSummary target` を、空いた番号ではなく既存の最大番号の次から足す（例: `Karte` の最大が 17 なら `author = 18`・`target = 19`。削除した番号は `reserved` に入れる）。`author_profile_id`・`target_profile_id` は残す。両ファイルに `import "profile/v1/service.proto";` を足す。Task 2 Step 1 と同じ方法で再生成し、他 package のスタブの差分を戻す。

- [ ] **Step 2: Write failing expectations**

`spec/slices/karte/grpc/karte_handler_spec.rb` と `spec/slices/review/grpc/review_handler_spec.rb` で、`author_username` / `target_username` を見ている箇所を `author.username` / `target.username` に替え、鍵付きのゲスト（カルテの相手）・鍵付きのキャスト（クチコミの相手）で `target.is_private` が true になる例を 1 つずつ足す。`spec/slices/karte/use_cases/*` と `spec/slices/review/use_cases/*` で `author_username:` などのキーを見ている箇所を、`karte[:author].username` などに替える。

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/karte spec/slices/review > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: FAIL

- [ ] **Step 3: Use summaries in present_kartes / present_reviews and the handlers**

`present_kartes.rb`（`present_reviews.rb` も同じ形で `review` に読み替える）:

- `call(kartes:, viewer_account_id:)` の先頭で `summaries = summarize_profiles.call(profile_ids: kartes.flat_map { |k| [k.author_profile_id, k.target_profile_id] })` を作る
- `present` が返す hash の `author_username:`・`author_display_name:`・`author_avatar_url:`・`target_username:`・`target_display_name:`・`target_avatar_url:` の 6 キーを削除し、`author: summaries[karte.author_profile_id.to_s]`・`target: summaries[karte.target_profile_id.to_s]` を足す
- `profile`・`avatar_url`・`get_profile`・`media_adapter` の private メソッドと、`initialize` の `get_profile:`・`media_adapter:` を削除し、`summarize_profiles`（`::Profile::Slice["use_cases.summarize_profiles"]`）に替える。`adapters/media_adapter.rb` が他で使われていなければ削除する

`karte_handler.rb` / `review_handler.rb` の `karte_to_proto` / `review_to_proto`: 6 項目の代入を削除し、`author: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(karte[:author])`・`target: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(karte[:target])` にする。

- [ ] **Step 4: Run the specs, the whole suite, and commit**

Run: Step 2 と同じあと全体
Expected: 0 failures

```bash
git add proto/dystopia/karte proto/dystopia/review dystopia/monolith
git commit -s -m "refactor(dystopia): return karte and review parties as profile summaries

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 7: Karte and review parties (frontend), then the stage 3 PR

**Files:**
- Modify: `src/modules/karte/types.ts`・`lib/mappers.ts`、`src/modules/review/types.ts`・`lib/mappers.ts` とそれぞれのテスト
- Modify: `authorUsername`・`authorDisplayName`・`authorAvatarUrl`・`targetUsername`・`targetDisplayName`・`targetAvatarUrl` の全参照（`/usr/bin/grep -rn "\(author\|target\)\(Username\|DisplayName\|AvatarUrl\)" src --include=*.ts --include=*.tsx`）

**Interfaces:**
- Produces: `Karte` / `Review` の `author: ProfileSummaryView | null`・`target: ProfileSummaryView | null`（`authorProfileId`・`targetProfileId` は残す）

- [ ] **Step 1: Write the failing mapper tests**

`karte/lib/mappers.test.ts` と `review/lib/mappers.test.ts` で、`authorUsername` などの期待を `author: { profileId, username, displayName, avatarUrl, isPrivate, role }` に替え、相手が未設定なら `target` が null になる例を足す。

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/karte/lib src/modules/review/lib`
Expected: FAIL

- [ ] **Step 2: Switch the types, mappers and every reference**

- 型: 6 項目を削除し、`author: ProfileSummaryView | null; target: ProfileSummaryView | null;` を足す
- 変換: `author: karte.author ? summaryToView(karte.author) : null`、`target` も同じ
- 参照の置き換え: `karte.authorUsername` → `karte.author?.username ?? ""`、`karte.authorDisplayName` → `karte.author?.displayName ?? ""`、`karte.authorAvatarUrl` → `karte.author?.avatarUrl ?? ""`（target も同じ。review も同じ）。`profileName(displayName, username)` の呼び出しはそのまま使える
- テストの fixture（`authorUsername: "yuna"` など）を `author: { profileId: "persona-a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" }` の形に直す

- [ ] **Step 3: Run all frontend checks, commit, push and open the PR**

Run: Task 5 Step 3 と同じ
Expected: 全件 PASS、tsc exit 0

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): read karte and review parties as profile summaries

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
git push -u origin HEAD
gh pr create --draft --base refactor/dystopia-post-author-summary --title "refactor(dystopia): return karte and review parties as profile summaries" --body-file <scratchpad>/pr-stage3.md
gh stack submit --auto
```

---

## Stage 4: ProfileName and the lock mark everywhere (branch `feat/dystopia-profile-name`)

- [ ] **Step 0: Create the branch**: `gh stack add feat/dystopia-profile-name`

### Task 8: ProfileName component

**Files:**
- Create: `src/components/ui/profile-name.tsx`、`profile-name.test.tsx`

**Interfaces:**
- Consumes: `ProfileSummaryView`、`LockMark`（`@/components/ui/lock-mark`）
- Produces: `ProfileName({ profile: ProfileSummaryView | null; link?: boolean; className?: string })`

- [ ] **Step 1: Write the failing test** — `src/components/ui/profile-name.test.tsx`

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { ProfileName } from "./profile-name";

const profile = (overrides: Partial<ProfileSummaryView> = {}): ProfileSummaryView => ({
  profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false, role: "cast", ...overrides,
});

describe("ProfileName", () => {
  it("shows the display name and links to the profile", () => {
    const html = renderToStaticMarkup(<ProfileName profile={profile()} link />);

    expect(html).toContain('href="/u/rin"');
    expect(html).toContain("りん");
    expect(html).not.toContain("鍵付き");
  });

  it("adds the lock mark for a private profile", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile({ isPrivate: true })} />)).toContain('aria-label="鍵付き"');
  });

  it("falls back to the handle when the display name is empty", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile({ displayName: "" })} />)).toContain("@rin");
  });

  it("does not link without the link flag or without a username", () => {
    expect(renderToStaticMarkup(<ProfileName profile={profile()} />)).not.toContain("href=");
    expect(renderToStaticMarkup(<ProfileName profile={profile({ username: "" })} link />)).not.toContain("href=");
  });

  it("names a deleted profile without a link or a lock", () => {
    const html = renderToStaticMarkup(<ProfileName profile={null} link />);

    expect(html).toContain("削除したプロフィール");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("鍵付き");
  });
});
```

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui/profile-name.test.tsx`
Expected: FAIL（モジュールがない）

- [ ] **Step 2: Implement** — `src/components/ui/profile-name.tsx`

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { LockMark } from "./lock-mark";

interface ProfileNameProps {
  profile: ProfileSummaryView | null;
  link?: boolean;
  className?: string;
}

export function ProfileName({ profile, link = false, className }: ProfileNameProps) {
  if (!profile) {
    return <span className={cn("truncate font-bold text-text-primary", className)}>削除したプロフィール</span>;
  }

  const name = profile.displayName || (profile.username ? `@${profile.username}` : "削除したプロフィール");
  const label = (
    <>
      <span className="truncate">{name}</span>
      {profile.isPrivate && <LockMark label="鍵付き" className="text-[0.85em] text-text-secondary" />}
    </>
  );
  const classes = cn("inline-flex min-w-0 items-center gap-1 font-bold text-text-primary", className);

  if (link && profile.username) {
    return (
      <Link href={`/u/${encodeURIComponent(profile.username)}`} className={cn(classes, "hover:underline")}>
        {label}
      </Link>
    );
  }
  return <span className={classes}>{label}</span>;
}
```

- [ ] **Step 3: Run the test and commit**

Run: Step 1 と同じ
Expected: PASS

```bash
git add dystopia/frontend/src/components/ui/profile-name.tsx dystopia/frontend/src/components/ui/profile-name.test.tsx
git commit -s -m "feat(dystopia): add a profile name with the lock mark

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 9: Use ProfileName for post, comment, karte and review authors, and the followers-only post icon

**Files:**
- Modify: `src/modules/post/components/PostCardBinding.tsx`、`src/components/ui/post-card.tsx`（作者名の受け取り方と非公開の印）
- Modify: `src/modules/post/components/CommentList.tsx`、`ReplyList.tsx`、`ReplyWithParentRow.tsx`
- Modify: `src/modules/karte/components/KarteCard.tsx`、`KarteDetailSheet.tsx`、`src/modules/review/components/ReviewCard.tsx`、`ReviewDetailSheet.tsx`
- Modify: それぞれのテスト

**Interfaces:**
- Consumes: `ProfileName`

- [ ] **Step 1: Write failing tests**

- `post-card` のテスト（`src/components/ui/post-card.test.tsx`）: 非公開の投稿で `aria-label="フォロワーのみ"` が出て、`aria-label="非公開"` が出ないこと
- `PostCardBinding` のテスト（`PostCardBinding.sheet.test.tsx` の fixture を使う新しい例）: `author.isPrivate: true` で `aria-label="鍵付き"` が出て、false で出ないこと
- `CommentList.test.tsx`: 鍵付きのコメントの作者に `aria-label="鍵付き"` が出ること
- `KarteCard.test.tsx` と `ReviewCard.test.tsx`: 書いた人が鍵付きなら書いた人の名前の横に、相手が鍵付きなら相手の名前の横に `aria-label="鍵付き"` が出ること（両方 false なら出ない）

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui/post-card.test.tsx src/modules/post/components src/modules/karte/components src/modules/review/components`
Expected: 足した例が FAIL

- [ ] **Step 2: Replace the name rendering**

- `post-card.tsx`: props の `author: { name, handle, avatarSrc }` に `isPrivate?: boolean` を足し、名前の横に `{author.isPrivate && <LockMark label="鍵付き" className="text-xs" />}` を出す。投稿の非公開の印 `{isPrivate && <LockMark label="非公開" className="text-xs" />}` を次に替える

```tsx
            {isPrivate && (
              <span role="img" aria-label="フォロワーのみ" title="フォロワーのみ" className="inline-flex shrink-0 items-center text-xs">
                <Users className="size-[1em]" />
              </span>
            )}
```

  （`import { Users } from "lucide-react";` を足す）
- `PostCardBinding.tsx`: `author={{ name: authorName, handle: authorHandle, avatarSrc }}` に `isPrivate: !!post.author?.isPrivate` を足す
- `CommentList.tsx`・`ReplyList.tsx`・`ReplyWithParentRow.tsx`: 作者名を出している `Link` / `span`（`/usr/bin/grep -n "author?.displayName\|author?.name" <file>` で見つかる要素）を `<ProfileName profile={c.author} link className="text-sm" />` に替える（変数名は各ファイルのもの）
- `KarteCard.tsx`・`ReviewCard.tsx`: 書いた人の名前（`authorHref ? <Link ...>{authorName}</Link> : <span ...>{authorName}</span>`）を `<ProfileName profile={karte.author} link className="text-sm" />` に、押せる枠の中の相手の名前の `<span className="font-bold text-text-primary">{profileName(...target...)}</span>` を `<ProfileName profile={karte.target} />` に替える（`review` も同じ）。`authorName`・`authorHref` が他で使われていなければ削除する（アイコンの `href` は `karte.author?.username` から作り続ける）
- `KarteDetailSheet.tsx`・`ReviewDetailSheet.tsx`: 相手の名前（`guest.displayName` / `cast.displayName` を出している `<p>`）の中身を `<ProfileName profile={karte.target} />` に、「記録者 / 書いた人」の後ろの名前を `<ProfileName profile={karte.author} className="font-normal" />` に替える

- [ ] **Step 3: Run the tests and commit**

Run: Step 1 と同じあと `pnpm exec vitest run > <scratchpad>/vitest.log 2>&1` と `pnpm exec tsc --noEmit`
Expected: 全件 PASS、tsc exit 0

```bash
git add -A dystopia/frontend/src
git commit -s -m "feat(dystopia): show the lock mark next to post, comment, karte and review names

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 10: Use ProfileName in lists, messaging, notifications and footprints

**Files:**
- Modify: `src/app/search/page.tsx`、`src/components/shell/SuggestedUsersPane.tsx`、`src/modules/social/components/FollowListView.tsx`、`BlockedAccountsList.tsx`、`src/components/ui/user-card.tsx`（名前を出していれば）
- Modify: メッセージの一覧と会話の見出し（`/usr/bin/grep -rln "counterpart" src/modules/messaging/components src/app/messages`）、通知の一覧（`/usr/bin/grep -rln "latestActor" src/modules/notifications/components src/app/notifications`）、足あとの一覧（`/usr/bin/grep -rln "visitor" src/modules/footprints/components src/app/footprints`）
- Modify: それぞれのテスト

- [ ] **Step 1: Write failing tests**

各画面のテストに、相手（ユーザー・メッセージの相手・通知の相手・訪問者）が鍵付きなら `aria-label="鍵付き"` が出て、そうでなければ出ない例を足す。メッセージの相手が `null` のスレッドで「削除したプロフィール」が出る例を足す。すでに `LockMark` を自前で出している検索・おすすめ・フォロー一覧は、`ProfileName` に替えたあとも同じ期待が通ることを確かめる。

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/search src/components/shell src/modules/social src/modules/messaging src/modules/notifications src/modules/footprints`
Expected: 足した例が FAIL

- [ ] **Step 2: Replace the name rendering**

各ファイルで、表示名を出している要素と、その横の `{p.isPrivate && <LockMark ... />}` を、`<ProfileName profile={p} link={<リンクにしていたか>} className="<元の文字の大きさの class>" />` 1 つに替える。名前全体を囲む `Link`（行全体がプロフィールへのリンク）になっている場合は `link` を付けない（リンクの入れ子を作らない）。

- [ ] **Step 3: Run all checks and commit**

Run: `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; /usr/bin/grep -E "×|FAIL|Tests |Test Files" <scratchpad>/vitest.log | head; pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: 全件 PASS、tsc exit 0。`/usr/bin/grep -rn "LockMark" src --include=*.tsx | /usr/bin/grep -v "test\|lock-mark.tsx\|profile-name.tsx\|ProfileHeader"` が何も出さない（鍵マークは `ProfileName` とプロフィールの見出しだけが出す）

```bash
git add -A dystopia/frontend/src
git commit -s -m "feat(dystopia): show profile names with the lock mark in lists, messages, notifications and footprints

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 11: End-to-end check and the stage 4 PR

- [ ] **Step 1: Run the suites**

Run: monolith の全 rspec、frontend の全 vitest と tsc
Expected: 0 failures、全件 PASS、tsc exit 0

- [ ] **Step 2: Check it in the running app**

memory の `reference_local_e2e_run.md` の手順で起動し、次を確かめてスクリーンショットを `<scratchpad>` に保存する。起動したプロセスは最後に止め、使い捨て DB を消し、ポートが空いたことを確かめる。
1. 鍵付きのキャストで投稿し、ホーム・プロフィール・投稿詳細のカードで名前の横に鍵マークが出る
2. 鍵付きのゲストがコメントすると、投稿詳細のコメントに鍵マークが出る
3. 鍵付きのゲストを相手にしたカルテ、鍵付きのキャストを相手にしたクチコミで、カードと詳細シートの相手の名前に鍵マークが出る
4. 検索のユーザーにアイコンが出る
5. 非公開の投稿は、人のアイコン（読み上げ名「フォロワーのみ」）になり、鍵マークではない
6. 鍵付きでないプロフィールの名前には、どこにも鍵マークが出ない

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --draft --base refactor/dystopia-karte-review-summary --title "feat(dystopia): show the lock mark next to every profile name" --body-file <scratchpad>/pr-stage4.md
gh stack submit --auto
```

`<scratchpad>/pr-stage4.md`: Why（鍵付きの作者・相手に鍵マークが出ていなかった。投稿の非公開の印が作者の鍵マークと同じで、区別できなかった）、What（`ProfileName`、適用した画面、非公開の印の変更）、Verification（Step 1・Step 2 の結果）、末尾の 2 行。
