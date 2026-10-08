# Multi Profile P4: Social Actor Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** social slice(follow と block)が持つ「行為者の id」を表す名前を、カラム・proto・Ruby・BFF・frontend のすべてで profile に揃える。挙動は変えない。

**Architecture:** 値は段 1 から profile の id なので、変えるのは名前だけである。改名は決まった規則の置換(perl)で行う。social の repository と use case は post / footprints / discovery / feed / review / messaging / notifications から呼ばれているので、それらの呼び出し箇所も social が持つ引数名とメソッド名の部分だけ直す。social には spec が 1 ファイルしか無く、RPC の入口も他 slice からの経路もテストされていない。実 database を使う結線の spec を先に書き、改名の前後で赤 → 緑を確かめる。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の「その他の proto」、Schema changes の social の 2 行、Delivery の段 4)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた script と file をゼロから再適用して、同じ差分(91 ファイル)になることも確かめた。最終結果は monolith `618 examples, 0 failures`、frontend `tsc` エラー 0・vitest `87` ファイル `341` 件通過。各 Step の Expected のうち数を示したものは、その再適用での実測である。migration は up → down → up を実行して確かめた。

この plan は stack の 4 段目で、ブランチ `feat/dystopia-multi-profile-social`(`feat/dystopia-multi-profile-post` の上)に積む。

## Naming

| 場所 | 旧 | 新 |
|---|---|---|
| `social.follows` | `follower_id` / `followee_id` | `follower_profile_id` / `followee_profile_id` |
| `social.blocks` | `blocker_id` / `blocked_id` | `blocker_profile_id` / `blocked_profile_id` |
| proto(follow / block) | `target_account_id` / `target_account_ids` | `target_profile_id` / `target_profile_ids` |
| proto(follow) | `requester_account_id` / `account_id` | `requester_profile_id` / `profile_id` |
| follow repository | `following_account_ids(account_id:)` / `remove_bidirectional(account_a:, account_b:)` / `delete_by_account` | `following_profile_ids(profile_id:)` / `remove_bidirectional(profile_a:, profile_b:)` / `delete_by_profile` |
| block repository | `blocked_ids(account_id:)` / `blocker_ids(account_id:)` / `bidirectionally_blocked_ids(account_id:)` / `delete_by_account` | `blocked_profile_ids(profile_id:)` / `blocker_profile_ids(profile_id:)` / `bidirectionally_blocked_profile_ids(profile_id:)` / `delete_by_profile` |
| repository の引数 | `follower_id:` / `followee_id:` / `followee_ids:` / `blocker_id:` / `blocked_id:` / `blocked_ids:` / `account_id:` | `follower_profile_id:` / `followee_profile_id:` / `followee_profile_ids:` / `blocker_profile_id:` / `blocked_profile_id:` / `blocked_profile_ids:` / `profile_id:` |
| social の use case の引数 | `viewer_account_id:` / `target_account_id:` / `target_account_ids:` / `requester_account_id:` / `account_id:` | `viewer_profile_id:` / `target_profile_id:` / `target_profile_ids:` / `requester_profile_id:` / `profile_id:` |
| social の handler | `current_user_id` | `current_profile_id` |
| frontend の view | `SocialAccountView.accountId` / `FollowRequestItem.requesterAccountId` | `profileId` / `requesterProfileId` |
| frontend の props・引数 | `targetAccountId` / `targetAccountIds` / `accountId`(social の component と hook) | `targetProfileId` / `targetProfileIds` / `profileId` |
| BFF | body `targetAccountId(s)`、query `target_account_id` / `account_id`、path `[requesterAccountId]` | `targetProfileId(s)`、`target_profile_id` / `profile_id`、`[requesterProfileId]` |

proto の field 番号は変えない。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-social`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `609 examples, 0 failures`、vitest 86 ファイル 335 件通過、`tsc` エラー 0。
- 挙動を変えない。この plan が足すテスト以外の spec と test は、名前の置換だけで通る。期待値(件数・順序・status)を書き換えて通すことはしない。
- script は必ず `bash` で実行する。zsh は変数に入れたファイル一覧を単語に分割しないので、`zsh` で実行すると置換が 1 件も適用されない。
- 本物の account の id は変えない。social の handler は、profile の表示のために `profile.account_id` から account の role を引く(`role_for(account_id)`)。この `account_id` は account の id である。
- 他 slice が持つ名前は変えない。該当するのは、feed の adapter のメソッド名(`following_account_ids` / `bidirectionally_blocked_account_ids`)と引数、review の adapter のメソッド名(`bidirectionally_blocked_ids(account_id:)`)、feed / discovery / review / messaging / footprints / notifications の use case 自身の引数(`viewer_account_id:` / `viewer_id:` / `sender_id:` / `recipient_id:` / `visitor_id:` など)である。変えるのは、それらの中から social の repository と use case を呼ぶ行の、social が持つ名前だけである。
- 退会の purge の入口(`Social::UseCases::PurgeAccount#call(account_id:)`)は変えない。段 8 で profile 単位の purge に作り替える。
- `Current.account_id` と `create_account_with_profile` の引数(fixture)は変えない。
- カラムを改名したら、名前にカラム名を含む index・unique 制約・NOT NULL 制約も改名する。全環境が PostgreSQL 18.6 に固定されており、18 は NOT NULL 制約に名前を付ける。
- テスト用 database に seed や手動の行を入れない。spec の truncation は slice の schema の行を消さない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan の手順はコメントを追加しない。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` はしない。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

改名で壊れやすく、既存のテストでは検知できない箇所。各行のテストは括弧内のタスクに入れてある。

1. follow と block の RPC が、新しい field 名と引数名で通しで動く(Task 1 の結線 spec。social の handler と use case には、これまで spec が無かった)。
2. messaging / footprints / notifications / review / feed が、social の repository を新しい名前で呼べる(Task 1 の結線 spec)。`Notifications::UseCases::Emit` は例外を握りつぶして `nil` を返すので、引数名を間違えると、エラーにならず通知が 1 件も届かなくなる。結線 spec は、block していない相手には通知が作られることを確かめる。
3. 本物の account の id(`profile.account_id` と `role_for(account_id)`)が、置換に巻き込まれない(Task 1 の Step 5 の確認と、結線 spec の一覧 RPC。巻き込むと profile の表示で role が引けなくなる)。
4. block したとき、両方向の follow が消える(Task 1 の結線 spec。`remove_bidirectional` の引数名を変える)。
5. BFF が新しい body・query・path の名前を読み、旧い名前を受け付けない(Task 2 の route test)。hook が同じ名前を送ることは、Controller verification のブラウザ確認で確かめる。
6. `SocialAccountView.accountId` を `profileId` に変えると、discovery・messaging・notifications の一覧もこの型を使っているので、そこでの参照も変わる(Task 2 の `tsc`)。

---

### Task 1: Proto, schema and monolith

**Files:**
- Modify: `proto/dystopia/social/v1/follow_service.proto`、`block_service.proto`
- Generate: `dystopia/monolith/stubs/social/v1/*.rb`
- Create: `dystopia/monolith/config/db/migrate/20261008030000_rename_social_actor_columns_to_profile.rb`
- Create: `dystopia/monolith/spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`
- Modify: `dystopia/monolith/slices/social/**`、`dystopia/monolith/spec/slices/social/**`
- Modify(social の名前を呼ぶ行のみ): `slices/post/adapters/block_adapter.rb`、`slices/post/grpc/post_handler.rb`、`slices/post/use_cases/posts/list_posts_by_ids.rb`、`slices/footprints/use_cases/record_visit.rb`、`slices/footprints/use_cases/list_footprints.rb`、`slices/discovery/use_cases/suggest_users.rb`、`slices/feed/adapters/block_adapter.rb`、`slices/feed/adapters/follow_adapter.rb`、`slices/review/adapters/block_adapter.rb`、`slices/review/use_cases/list_recent_entries.rb`、`slices/review/use_cases/filter_visible_entries.rb`、`slices/messaging/use_cases/get_or_create_thread.rb`、`slices/messaging/use_cases/authorize_message.rb`、`slices/messaging/use_cases/send_message.rb`、`slices/notifications/use_cases/emit.rb`
- Modify(spec): `spec/slices/post/grpc/handler_spec.rb`、`spec/slices/post/cross_slice_wiring_spec.rb`、`spec/slices/post/use_cases/comments/add_comment_spec.rb`、`spec/slices/identity/use_cases/account/purge_wiring_spec.rb`、`spec/slices/footprints/use_cases/list_footprints_spec.rb`、`spec/slices/footprints/use_cases/record_visit_spec.rb`、`spec/slices/discovery/use_cases/suggest_users_spec.rb`、`spec/slices/messaging/use_cases/authorize_message_spec.rb`、`spec/slices/review/use_cases/list_recent_entries_spec.rb`

**Interfaces:**
- Consumes: `Grpc::Authenticatable#current_profile_id`、`ProfileFixtures`(`create_account_with_profile(role:, **attrs)` は profile の id を返す)
- Produces: Naming の表のとおり。主なものは次のとおり。
  - `Social::Slice["repositories.follow_repository"]`: `follow(follower_profile_id:, followee_profile_id:, status:)`、`find(follower_profile_id:, followee_profile_id:)`、`status_batch(follower_profile_id:, followee_profile_ids:)`、`following_profile_ids(profile_id:)`
  - `Social::Slice["repositories.block_repository"]`: `block(blocker_profile_id:, blocked_profile_id:)`、`blocked?(blocker_profile_id:, blocked_profile_id:)`、`blocked_profile_ids(profile_id:)`、`bidirectionally_blocked_profile_ids(profile_id:)`
  - `Social::Slice["use_cases.viewer_can_see_post"].call(viewer_profile_id:, post:)`、`Social::Slice["use_cases.filter_visible_posts"].call(viewer_profile_id:, posts:)`

- [ ] **Step 1: 結線の spec を書く(失敗する)**

`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/social/grpc/follow_handler"
require "slices/social/grpc/block_handler"

RSpec.describe "Social slice RPC entry points and the slices that read follows and blocks", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  let(:viewer) { create_account_with_profile(username: "social_viewer") }
  let(:public_cast) { create_account_with_profile(role: 2, username: "social_public") }
  let(:private_cast) { create_account_with_profile(role: 2, username: "social_private", is_private: true) }
  let(:other_guest) { create_account_with_profile(username: "social_other") }

  def rpc(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def follow(target)
    rpc(Social::Grpc::FollowHandler, :follow, Social::V1::FollowRequest.new(target_profile_id: target)).status
  end

  def follow_status(*targets)
    rpc(Social::Grpc::FollowHandler, :get_follow_status, Social::V1::GetFollowStatusRequest.new(target_profile_ids: targets)).statuses.to_h
  end

  def counts(profile_id = "")
    response = rpc(Social::Grpc::FollowHandler, :get_social_counts, Social::V1::GetSocialCountsRequest.new(profile_id: profile_id))
    [response.following_count, response.followers_count]
  end

  after { Current.clear }

  describe "follow RPCs" do
    it "follows a public profile at once and lists both sides by profile" do
      act_as(viewer)

      expect(follow(public_cast)).to eq(:FOLLOW_STATUS_APPROVED)
      expect(follow_status(public_cast, private_cast)).to eq(public_cast => :FOLLOW_STATUS_APPROVED, private_cast => :FOLLOW_STATUS_NONE)
      expect(counts).to eq([1, 0])
      expect(counts(public_cast)).to eq([0, 1])

      following = rpc(Social::Grpc::FollowHandler, :list_following, Social::V1::ListFollowingRequest.new)
      followers = rpc(Social::Grpc::FollowHandler, :list_followers, Social::V1::ListFollowersRequest.new(profile_id: public_cast))
      expect(following.profiles.map(&:id)).to eq([public_cast])
      expect(followers.profiles.map(&:id)).to eq([viewer])
      expect(db[:social__follows].select_map([:follower_profile_id, :followee_profile_id, :status])).to eq([[viewer, public_cast, "approved"]])

      rpc(Social::Grpc::FollowHandler, :unfollow, Social::V1::UnfollowRequest.new(target_profile_id: public_cast))
      expect(counts).to eq([0, 0])
    end

    it "keeps a follow to a private profile pending until the target approves it" do
      act_as(viewer)
      expect(follow(private_cast)).to eq(:FOLLOW_STATUS_PENDING)
      expect(counts(private_cast)).to eq([0, 0])

      act_as(private_cast)
      pending = rpc(Social::Grpc::FollowHandler, :list_pending_follow_requests, Social::V1::ListPendingFollowRequestsRequest.new)
      pending_count = rpc(Social::Grpc::FollowHandler, :get_pending_follow_count, Social::V1::GetPendingFollowCountRequest.new).count
      expect(pending.profiles.map(&:id)).to eq([viewer])
      expect(pending_count).to eq(1)

      rpc(Social::Grpc::FollowHandler, :approve_follow_request, Social::V1::ApproveFollowRequestRequest.new(requester_profile_id: viewer))
      expect(counts).to eq([0, 1])

      act_as(viewer)
      expect(follow_status(private_cast)).to eq(private_cast => :FOLLOW_STATUS_APPROVED)
    end

    it "lets the target reject a request and the requester cancel one" do
      act_as(viewer)
      follow(private_cast)
      act_as(other_guest)
      follow(private_cast)

      act_as(private_cast)
      rpc(Social::Grpc::FollowHandler, :reject_follow_request, Social::V1::RejectFollowRequestRequest.new(requester_profile_id: viewer))
      act_as(other_guest)
      rpc(Social::Grpc::FollowHandler, :cancel_follow_request, Social::V1::CancelFollowRequestRequest.new(target_profile_id: private_cast))

      expect(db[:social__follows].count).to eq(0)
    end

    it "refuses to follow across a block in either direction" do
      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: viewer)
      block_repo.block(blocker_profile_id: other_guest, blocked_profile_id: private_cast)

      act_as(viewer)
      expect(follow(public_cast)).to eq(:FOLLOW_STATUS_NONE)
      act_as(other_guest)
      expect(follow(private_cast)).to eq(:FOLLOW_STATUS_NONE)
      expect(db[:social__follows].count).to eq(0)
    end
  end

  describe "block RPCs" do
    it "blocks a profile, drops follows in both directions, and reports the block only to the blocker" do
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      follow_repo.follow(follower_profile_id: public_cast, followee_profile_id: viewer, status: "approved")
      act_as(viewer)

      rpc(Social::Grpc::BlockHandler, :block, Social::V1::BlockRequest.new(target_profile_id: public_cast))
      status = rpc(Social::Grpc::BlockHandler, :get_block_status, Social::V1::GetBlockStatusRequest.new(target_profile_ids: [public_cast, private_cast])).blocked.to_h
      listed = rpc(Social::Grpc::BlockHandler, :list_blocked, Social::V1::ListBlockedRequest.new)

      expect(status).to eq(public_cast => true, private_cast => false)
      expect(listed.profiles.map(&:id)).to eq([public_cast])
      expect(db[:social__follows].count).to eq(0)
      expect(db[:social__blocks].select_map([:blocker_profile_id, :blocked_profile_id])).to eq([[viewer, public_cast]])

      act_as(public_cast)
      seen_by_blocked = rpc(Social::Grpc::BlockHandler, :get_block_status, Social::V1::GetBlockStatusRequest.new(target_profile_ids: [viewer])).blocked.to_h
      expect(seen_by_blocked).to eq(viewer => false)

      act_as(viewer)
      rpc(Social::Grpc::BlockHandler, :unblock, Social::V1::UnblockRequest.new(target_profile_id: public_cast))
      expect(db[:social__blocks].count).to eq(0)
    end
  end

  describe "slices that read follows and blocks" do
    it "lets a guest message a cast only with an approved follow, and never across a block" do
      authorize = Messaging::UseCases::AuthorizeMessage.new
      open_thread = Messaging::Slice["use_cases.get_or_create_thread"]

      expect(authorize.call(sender_id: viewer, recipient_id: public_cast)).to be false
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      expect(authorize.call(sender_id: viewer, recipient_id: public_cast)).to be true
      expect(open_thread.call(viewer_id: viewer, recipient_account_id: public_cast)[:counterpart].id).to eq(public_cast)

      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: viewer)
      expect { open_thread.call(viewer_id: viewer, recipient_account_id: public_cast) }
        .to raise_error(Messaging::UseCases::GetOrCreateThread::BlockedError)
      expect { Messaging::Slice["use_cases.send_message"].call(sender_id: viewer, content: "hi", recipient_account_id: public_cast) }
        .to raise_error(Messaging::UseCases::SendMessage::BlockedError)
    end

    it "records a visit unless either side blocked the other, and hides blocked visitors from the list" do
      record = Footprints::Slice["use_cases.record_visit"]
      list = Footprints::Slice["use_cases.list_footprints"]

      record.call(visitor_id: viewer, visited_id: public_cast)
      record.call(visitor_id: other_guest, visited_id: public_cast)
      expect(list.call(viewer_id: public_cast)[:rows].map { |row| row[:visitor_id] }).to contain_exactly(viewer, other_guest)

      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: other_guest)
      expect(list.call(viewer_id: public_cast)[:rows].map { |row| row[:visitor_id] }).to eq([viewer])
      expect(record.call(visitor_id: other_guest, visited_id: private_cast)).not_to be_nil
      block_repo.block(blocker_profile_id: other_guest, blocked_profile_id: private_cast)
      expect(record.call(visitor_id: private_cast, visited_id: other_guest)).to be_nil
    end

    it "does not notify a recipient who blocked the actor" do
      emit = Notifications::Slice["use_cases.emit"]
      target = SecureRandom.uuid_v7

      delivered = emit.call(recipient_id: public_cast, type: "like", target_resource_id: target, actor_id: viewer)
      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: other_guest)
      suppressed = emit.call(recipient_id: public_cast, type: "like", target_resource_id: target, actor_id: other_guest)

      expect(delivered).not_to be_nil
      expect(suppressed).to be_nil
    end

    it "gives the review and feed adapters the profiles blocked in either direction and the followed profiles" do
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: private_cast, status: "pending")
      block_repo.block(blocker_profile_id: viewer, blocked_profile_id: other_guest)
      block_repo.block(blocker_profile_id: private_cast, blocked_profile_id: viewer)

      expect(Review::Adapters::BlockAdapter.new.bidirectionally_blocked_ids(account_id: viewer)).to contain_exactly(other_guest, private_cast)
      expect(Feed::Adapters::BlockAdapter.new.bidirectionally_blocked_account_ids(account_id: viewer)).to contain_exactly(other_guest, private_cast)
      expect(Feed::Adapters::FollowAdapter.new.following_account_ids(account_id: viewer)).to eq([public_cast])
    end
  end
end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/social/rpc_and_cross_slice_wiring_spec.rb > /tmp/rspec-p4-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p4-red.txt`
Expected: `15 examples, 9 failures`(spec/support の 6 件は通り、この spec の 9 件がすべて落ちる。新しい field 名・引数名・カラム名がまだ無いため)。

- [ ] **Step 2: proto を改名する**

次の内容を `/tmp/p4-proto.sh` に保存し、リポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で `bash /tmp/p4-proto.sh` を実行する。social の proto の `account_id` は、すべて profile の id を指している。

```bash
set -euo pipefail
perl -pi -e 's/account_id/profile_id/g' proto/dystopia/social/v1/follow_service.proto proto/dystopia/social/v1/block_service.proto
```

Run(root): `/usr/bin/grep -c 'account_id' proto/dystopia/social/v1/*.proto`
Expected: 2 ファイルとも `:0`

- [ ] **Step 3: Ruby の stub を生成する**

`bin/codegen` は全 package の stub を作り直すので、social 以外の差分を戻す。

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v '^stubs/social/' | xargs git checkout --
git status --short stubs
```
Expected: 次の 2 行だけ(RPC の名前は変わらないので `*_services_pb.rb` に差分は出ない)。
```
 M stubs/social/v1/block_service_pb.rb
 M stubs/social/v1/follow_service_pb.rb
```

- [ ] **Step 4: migration を書いて適用する**

`config/db/migrate/20261008030000_rename_social_actor_columns_to_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:social__follows) do
      rename_column :follower_id, :follower_profile_id
      rename_column :followee_id, :followee_profile_id
    end
    alter_table(:social__blocks) do
      rename_column :blocker_id, :blocker_profile_id
      rename_column :blocked_id, :blocked_profile_id
    end

    run "ALTER INDEX social.social_follows_follower_id_index RENAME TO social_follows_follower_profile_id_index"
    run "ALTER INDEX social.social_follows_followee_id_index RENAME TO social_follows_followee_profile_id_index"
    run "ALTER INDEX social.social_follows_followee_id_status_index RENAME TO social_follows_followee_profile_id_status_index"
    run "ALTER INDEX social.social_blocks_blocker_id_index RENAME TO social_blocks_blocker_profile_id_index"
    run "ALTER INDEX social.social_blocks_blocked_id_index RENAME TO social_blocks_blocked_profile_id_index"

    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_id_followee_id_key TO follows_follower_profile_id_followee_profile_id_key"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_id_not_null TO follows_follower_profile_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_followee_id_not_null TO follows_followee_profile_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_id_blocked_id_key TO blocks_blocker_profile_id_blocked_profile_id_key"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_id_not_null TO blocks_blocker_profile_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocked_id_not_null TO blocks_blocked_profile_id_not_null"
  end

  down do
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocked_profile_id_not_null TO blocks_blocked_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_profile_id_not_null TO blocks_blocker_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_profile_id_blocked_profile_id_key TO blocks_blocker_id_blocked_id_key"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_followee_profile_id_not_null TO follows_followee_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_profile_id_not_null TO follows_follower_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_profile_id_followee_profile_id_key TO follows_follower_id_followee_id_key"

    run "ALTER INDEX social.social_blocks_blocked_profile_id_index RENAME TO social_blocks_blocked_id_index"
    run "ALTER INDEX social.social_blocks_blocker_profile_id_index RENAME TO social_blocks_blocker_id_index"
    run "ALTER INDEX social.social_follows_followee_profile_id_status_index RENAME TO social_follows_followee_id_status_index"
    run "ALTER INDEX social.social_follows_followee_profile_id_index RENAME TO social_follows_followee_id_index"
    run "ALTER INDEX social.social_follows_follower_profile_id_index RENAME TO social_follows_follower_id_index"

    alter_table(:social__blocks) do
      rename_column :blocked_profile_id, :blocked_id
      rename_column :blocker_profile_id, :blocker_id
    end
    alter_table(:social__follows) do
      rename_column :followee_profile_id, :followee_id
      rename_column :follower_profile_id, :follower_id
    end
  end
end
```

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。`config/db/structure.sql` の dump は git の管理外なので commit に含めない。

Run: `psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select conname from pg_constraint where connamespace='social'::regnamespace and conname ~ '(follower|followee|blocker|blocked)' union all select indexname from pg_indexes where schemaname='social' and indexname ~ '(follower|followee|blocker|blocked)' order by 1" | /usr/bin/grep -c -v 'profile_id'`
Expected: `0`(旧カラム名を含む制約名・index 名が残っていない)。

- [ ] **Step 5: Ruby の名前を置換する**

次の内容を `/tmp/p4-monolith.sh` に保存し、`dystopia/monolith` で `bash /tmp/p4-monolith.sh` を実行する。

```bash
set -euo pipefail

# 1. the social slice and its specs (the wiring spec already uses the new names; the purge entry point keeps its keyword)
FILES=$(find slices/social spec/slices/social -name '*.rb' ! -name 'rpc_and_cross_slice_wiring_spec.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/\bfollower_id\b/follower_profile_id/g; s/\bfollowee_ids\b/followee_profile_ids/g; s/\bfollowee_id\b/followee_profile_id/g; s/\bblocker_id\b/blocker_profile_id/g; s/\bblocked_id\b/blocked_profile_id/g' $FILES
perl -pi -e 's/bidirectionally_blocked_ids/bidirectionally_blocked_profile_ids/g; s/\bblocked_ids\b/blocked_profile_ids/g; s/\bblocker_ids\b/blocker_profile_ids/g; s/following_account_ids/following_profile_ids/g; s/delete_by_account/delete_by_profile/g' $FILES
perl -pi -e 's/target_account_id(s?)\b/target_profile_id$1/g; s/requester_account_id/requester_profile_id/g; s/viewer_account_id/viewer_profile_id/g; s/\baccount_a\b/profile_a/g; s/\baccount_b\b/profile_b/g; s/\bauthor_id(s?)\b/author_profile_id$1/g; s/request\.message\.account_id/request.message.profile_id/g' $FILES
# the remaining account ids are profile ids, except the real account id read from a profile to look up its role
perl -pi -e 's/(?<![.\w])account_id\b/profile_id/g unless /role_for\(account_id\)|identity_account_repo\.find_by_id\(account_id\)/' $(echo "$FILES" | /usr/bin/grep -v 'purge_account')

# 2. other slices: calls into the social repositories and use cases
CALLERS="slices/post/adapters/block_adapter.rb slices/footprints/use_cases/record_visit.rb slices/footprints/use_cases/list_footprints.rb slices/discovery/use_cases/suggest_users.rb slices/feed/adapters/block_adapter.rb slices/feed/adapters/follow_adapter.rb slices/review/adapters/block_adapter.rb slices/messaging/use_cases/get_or_create_thread.rb slices/messaging/use_cases/authorize_message.rb slices/messaging/use_cases/send_message.rb slices/notifications/use_cases/emit.rb"
perl -pi -e 'if (/(?:block_repo|follow_repo)\b/) { s/\bblocker_id:/blocker_profile_id:/g; s/\bblocked_id:/blocked_profile_id:/g; s/\bfollower_id:/follower_profile_id:/g; s/\bfollowee_id:/followee_profile_id:/g; s/\.following_account_ids\(account_id:/.following_profile_ids(profile_id:/; s/\.bidirectionally_blocked_ids\(account_id:/.bidirectionally_blocked_profile_ids(profile_id:/; s/\.blocked_ids\(account_id:/.blocked_profile_ids(profile_id:/ }' $CALLERS
perl -pi -e 's/^(\s+)\.bidirectionally_blocked_ids\(account_id:/$1.bidirectionally_blocked_profile_ids(profile_id:/' slices/footprints/use_cases/list_footprints.rb
perl -pi -e 's/(viewer_can_see_post\.call\()viewer_account_id:/$1viewer_profile_id:/' slices/post/grpc/post_handler.rb
perl -pi -e 's/(visibility_filter\.call\()viewer_account_id:/$1viewer_profile_id:/' slices/post/use_cases/posts/list_posts_by_ids.rb
perl -0pi -e 's/(filter_visible_posts\.call\(\s*)viewer_account_id:/$1viewer_profile_id:/g' slices/review/use_cases/list_recent_entries.rb slices/review/use_cases/filter_visible_entries.rb

# 3. specs of other slices that create follows and blocks or stub the social use cases
perl -pi -e 's/\bfollower_id\b/follower_profile_id/g; s/\bfollowee_id\b/followee_profile_id/g; s/\bblocker_id\b/blocker_profile_id/g; s/\bblocked_id\b/blocked_profile_id/g' spec/slices/post/grpc/handler_spec.rb spec/slices/post/cross_slice_wiring_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/identity/use_cases/account/purge_wiring_spec.rb spec/slices/footprints/use_cases/list_footprints_spec.rb spec/slices/footprints/use_cases/record_visit_spec.rb spec/slices/discovery/use_cases/suggest_users_spec.rb spec/slices/messaging/use_cases/authorize_message_spec.rb
perl -pi -e 's/(can_see\.call\()viewer_account_id:/$1viewer_profile_id:/; s/(filter_visible_posts"\]\.call\()viewer_account_id:/$1viewer_profile_id:/' spec/slices/post/cross_slice_wiring_spec.rb
perl -pi -e 's/\|viewer_account_id:, posts:\|/|viewer_profile_id:, posts:|/' spec/slices/review/use_cases/list_recent_entries_spec.rb spec/slices/review/use_cases/filter_visible_entries_spec.rb
```

Run: `/usr/bin/grep -rn -E '\b(follower|followee|blocker|blocked)_ids?\b|following_account_ids|current_user_id|\baccount_id\b' slices/social spec/slices/social --include='*.rb' | wc -l`
Expected: `15`。内訳は次のとおりで、これ以外が出たら置換漏れである。

- `slices/social/grpc/block_handler.rb` と `follow_handler.rb` の各 3 行: `role_for(profile.account_id)`、`def role_for(account_id)`、`identity_account_repo.find_by_id(account_id)`(本物の account の id)
- `slices/social/use_cases/purge_account.rb` の 3 行と `spec/slices/social/use_cases/purge_account_spec.rb` の 2 行(purge の入口)
- `spec/slices/social/rpc_and_cross_slice_wiring_spec.rb` の 4 行: `Current.account_id` と、review / feed の adapter の呼び出し 3 行(他 slice が持つ名前)

Run: `git status --short . | wc -l`
Expected: `53`

2 つの旧名が同じ新名になる規則(`account_id` → `profile_id`)があるので、もともと `profile_id` という名前を持っていたファイルで、別々の値が 1 つの名前に潰れていないことを読んで確かめる。

Run:
```bash
git diff --name-only --relative HEAD -- slices/social spec/slices/social | while read -r f; do git cat-file -e "HEAD:dystopia/monolith/$f" 2>/dev/null || continue; old=$(git show "HEAD:dystopia/monolith/$f"); echo "$old" | /usr/bin/grep -q -E '(^|[^.[:alnum:]_])account_id' && echo "$old" | /usr/bin/grep -q -E '(^|[^[:alnum:]_])profile_id' && echo "$f"; done
```
Expected: 次の 4 ファイル。どれも、もとの `profile_id` は `get_profile.call(profile_id: ...)` の引数名だけで、変数ではない。改名後も、引数 `profile_id` と、`get_profile` に渡す別の値(`row.follower_profile_id` など)が区別されていることを確かめる。
```
slices/social/use_cases/filter_visible_posts.rb
slices/social/use_cases/follows/list_followers.rb
slices/social/use_cases/follows/list_following.rb
slices/social/use_cases/follows/list_pending_follow_requests.rb
```

- [ ] **Step 6: 結線の spec と全体が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/social/rpc_and_cross_slice_wiring_spec.rb > /tmp/rspec-p4-green.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p4-green.txt`
Expected: `15 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `618 examples, 0 failures`

失敗がある場合は、名前の置換漏れか置換し過ぎである。期待値を書き換えず、該当の名前だけを直す。直せない場合は BLOCKED として出力を報告する。

- [ ] **Step 7: migration の down を確かめる**

Run:
```bash
HANAMI_ENV=test rbenv exec bundle exec hanami db rollback
psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select table_name, string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='social' group by 1 order by 1"
HANAMI_ENV=test rbenv exec bundle exec hanami db migrate
```
Expected: rollback は `rolled back to 20261008020000_rename_post_actor_columns_to_profile` と出る。カラムは `blocks|id,blocker_id,blocked_id,created_at` と `follows|id,follower_id,followee_id,status,created_at,updated_at` に戻る。最後の migrate は `migrated` と出る。

- [ ] **Step 8: Commit**

```bash
cd ../.. && git add -A proto/dystopia/social dystopia/monolith && git status --short && git commit -s -m "refactor(dystopia): name the social actor columns, fields and arguments after the profile" && cd dystopia/monolith
```

`git status --short` の出力が `proto/dystopia/social` と `dystopia/monolith` の下だけであることを確認してから commit する。

---

### Task 2: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/social/v1/follow_service_pb.ts`、`block_service_pb.ts`
- Create: `dystopia/frontend/src/app/api/social/profile-queries.test.ts`
- Rename: `dystopia/frontend/src/app/api/social/follow/requests/[requesterAccountId]` → `[requesterProfileId]`
- Modify: `dystopia/frontend/src/modules/social/**`、`dystopia/frontend/src/app/api/social/**`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`、`src/app/settings/blocks/page.tsx`、`src/app/settings/follow-requests/page.tsx`、`src/app/search/page.tsx`、`src/components/shell/SuggestedUsersPane.tsx`、`src/modules/notifications/lib/format.test.ts`

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/social` の `SocialAccountView.profileId`、`FollowRequestItem.requesterProfileId`
  - `FollowButton` / `BlockButton` の props は `targetProfileId`、`SocialCountsLinks` / `FollowListView` の props は `profileId`
  - BFF: `POST /api/social/follow` と `POST /api/social/blocks` の body は `{ targetProfileId }`、`DELETE` の query は `target_profile_id`、status の body は `{ targetProfileIds }`、`/api/social/following` / `followers` / `counts` の query は `profile_id`、承認と拒否の path は `/api/social/follow/requests/[requesterProfileId]/approve|reject`

- [ ] **Step 1: stub を生成する**

`pnpm proto:gen` は全 package の stub を作り直し、管理外の `src/stub/billing/` も作る。social 以外を戻す。

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v '^src/stub/social/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: 次の 2 行だけ。
```
 M src/stub/social/v1/block_service_pb.ts
 M src/stub/social/v1/follow_service_pb.ts
```

- [ ] **Step 2: BFF の名前を固定する test を書く(失敗する)**

`src/app/api/social/profile-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follow = vi.hoisted(() => ({
  follow: vi.fn(),
  unfollow: vi.fn(),
  cancelFollowRequest: vi.fn(),
  approveFollowRequest: vi.fn(),
  rejectFollowRequest: vi.fn(),
  getFollowStatus: vi.fn(),
  listFollowing: vi.fn(),
  listFollowers: vi.fn(),
  getSocialCounts: vi.fn(),
}));
const block = vi.hoisted(() => ({
  block: vi.fn(),
  unblock: vi.fn(),
  getBlockStatus: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follow, socialBlockClient: block }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const followRoute = await import("./follow/route");
const followStatusRoute = await import("./follow/status/route");
const approveRoute = await import("./follow/requests/[requesterProfileId]/approve/route");
const rejectRoute = await import("./follow/requests/[requesterProfileId]/reject/route");
const followingRoute = await import("./following/route");
const followersRoute = await import("./followers/route");
const countsRoute = await import("./counts/route");
const blocksRoute = await import("./blocks/route");
const blockStatusRoute = await import("./blocks/status/route");

function request(method: string, path: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const list = { profiles: [], nextCursor: "", hasMore: false };

describe("social routes address other profiles by profile id", () => {
  beforeEach(() => {
    Object.values(follow).forEach((fn) => fn.mockReset().mockResolvedValue({ ...list, statuses: {} }));
    Object.values(block).forEach((fn) => fn.mockReset().mockResolvedValue({ blocked: {} }));
  });

  it("POST /api/social/follow sends targetProfileId and rejects the former field name", async () => {
    const ok = await followRoute.POST(request("POST", "/api/social/follow", { targetProfileId: "prof-1" }));
    const former = await followRoute.POST(request("POST", "/api/social/follow", { targetAccountId: "prof-1" }));

    expect(ok.status).toBe(200);
    expect(former.status).toBe(400);
    expect(follow.follow).toHaveBeenCalledTimes(1);
    expect(follow.follow).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
  });

  it("DELETE /api/social/follow reads target_profile_id for unfollow and for cancel", async () => {
    await followRoute.DELETE(request("DELETE", "/api/social/follow?target_profile_id=prof-1"));
    await followRoute.DELETE(request("DELETE", "/api/social/follow?target_profile_id=prof-2&cancel=1"));
    const former = await followRoute.DELETE(request("DELETE", "/api/social/follow?target_account_id=prof-1"));

    expect(follow.unfollow).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(follow.cancelFollowRequest).toHaveBeenCalledWith({ targetProfileId: "prof-2" }, expect.anything());
    expect(former.status).toBe(400);
  });

  it("POST /api/social/follow/status sends targetProfileIds", async () => {
    await followStatusRoute.POST(request("POST", "/api/social/follow/status", { targetProfileIds: ["prof-1", "prof-2"] }));

    expect(follow.getFollowStatus).toHaveBeenCalledWith({ targetProfileIds: ["prof-1", "prof-2"] }, expect.anything());
  });

  it("approve and reject take the requester profile from the path", async () => {
    const params = Promise.resolve({ requesterProfileId: "prof-9" });
    await approveRoute.POST(request("POST", "/api/social/follow/requests/prof-9/approve"), { params });
    await rejectRoute.POST(request("POST", "/api/social/follow/requests/prof-9/reject"), { params });

    expect(follow.approveFollowRequest).toHaveBeenCalledWith({ requesterProfileId: "prof-9" }, expect.anything());
    expect(follow.rejectFollowRequest).toHaveBeenCalledWith({ requesterProfileId: "prof-9" }, expect.anything());
  });

  it("following, followers and counts read profile_id", async () => {
    await followingRoute.GET(request("GET", "/api/social/following?profile_id=prof-1"));
    await followersRoute.GET(request("GET", "/api/social/followers?profile_id=prof-1"));
    await countsRoute.GET(request("GET", "/api/social/counts?profile_id=prof-1"));

    expect(follow.listFollowing).toHaveBeenCalledWith(expect.objectContaining({ profileId: "prof-1" }), expect.anything());
    expect(follow.listFollowers).toHaveBeenCalledWith(expect.objectContaining({ profileId: "prof-1" }), expect.anything());
    expect(follow.getSocialCounts).toHaveBeenCalledWith({ profileId: "prof-1" }, expect.anything());
  });

  it("block, unblock and block status address the target by profile id", async () => {
    await blocksRoute.POST(request("POST", "/api/social/blocks", { targetProfileId: "prof-1" }));
    await blocksRoute.DELETE(request("DELETE", "/api/social/blocks?target_profile_id=prof-1"));
    await blockStatusRoute.POST(request("POST", "/api/social/blocks/status", { targetProfileIds: ["prof-1"] }));

    expect(block.block).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(block.unblock).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(block.getBlockStatus).toHaveBeenCalledWith({ targetProfileIds: ["prof-1"] }, expect.anything());
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/social/profile-queries.test.ts > /tmp/vitest-p4-red.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p4-red.txt | /usr/bin/grep -E 'Test Files|Tests |Cannot find module' | head -4`
Expected: `Test Files  1 failed (1)` と `Tests  no tests`(path の `[requesterProfileId]` がまだ無く、import が失敗する)。

- [ ] **Step 3: 名前を置換する**

次の内容を `/tmp/p4-frontend.sh` に保存し、`dystopia/frontend` で `bash /tmp/p4-frontend.sh` を実行する。2 回実行しない(`git mv` が 2 回目に失敗する)。

```bash
set -euo pipefail

# 1. the route segment named after the account
git mv "src/app/api/social/follow/requests/[requesterAccountId]" "src/app/api/social/follow/requests/[requesterProfileId]"

# 2. the social module and its BFF routes
SOCIAL=$(find src/modules/social src/app/api/social -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'profile-queries.test.ts')
perl -pi -e 's/targetAccountId(s?)\b/targetProfileId$1/g; s/requesterAccountId/requesterProfileId/g; s/\baccountId\b/profileId/g; s/\baccountQs\b/profileQs/g; s/target_account_id/target_profile_id/g; s/\baccount_id\b/profile_id/g' $SOCIAL

# 3. callers of the social components and of SocialAccountView outside the module
perl -0pi -e 's/(<(?:FollowButton|BlockButton)\s+)targetAccountId=/$1targetProfileId=/g; s/(<SocialCountsLinks\s+)accountId=/$1profileId=/g' "src/app/u/[username]/page.tsx" src/app/settings/blocks/page.tsx src/app/search/page.tsx src/components/shell/SuggestedUsersPane.tsx
perl -pi -e 's/\brequesterAccountId\b/requesterProfileId/g' src/app/settings/follow-requests/page.tsx
perl -pi -e 's/\bp\.accountId\b/p.profileId/g' src/app/search/page.tsx src/app/settings/blocks/page.tsx src/components/shell/SuggestedUsersPane.tsx
perl -pi -e 's/^(\s+)accountId: "actor-1",/$1profileId: "actor-1",/' src/modules/notifications/lib/format.test.ts
```

Run: `/usr/bin/grep -rn -E 'targetAccountId|requesterAccountId|\baccountId\b|account_id' src/modules/social src/app/api/social | /usr/bin/grep -v 'profile-queries.test.ts'`
Expected: 出力なし(`profile-queries.test.ts` は、旧い名前を受け付けないことを確かめるために旧名を含む)。

- [ ] **Step 4: 全体を確認する**

route の path を改名したので、`next dev` が作った型のキャッシュ(`.next`、git の管理外)が古い path を指す。`tsc` はこれも読むので、先に消す。

Run: `rm -rf .next; env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p4.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p4.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  87 passed (87)`、`Tests  341 passed (341)`。

`tsc` がエラーを出した場合は、`SocialAccountView` の `accountId` を読んでいる箇所が残っている。出力された箇所だけを `profileId` に直す。messaging の `StartChatButton` と notifications の `NotificationBell` の `targetAccountId` という props、messaging の event の `accountId` は変えない。

Run: `git status --short . | wc -l; git status --short src/stub | wc -l`
Expected: `36` と `2`

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -s -m "refactor(dystopia/frontend): address followed and blocked profiles by profile id"
```

---

## Controller verification (not dispatched)

Task 2 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` で開く、終了後に生成物と database を削除)。

- フォロー・フォロー解除ができ、フォロー数とフォロワー数、フォロー中 / フォロワーの一覧が変わる。
- 非公開の profile へのフォローが申請中になり、相手が承認・拒否できる。申請者が取り消せる。
- block・解除ができ、block 一覧に出る。block すると互いのフォローが消え、相手の投稿が feed から消える。
- block した相手に DM のスレッドを開けない。フォローしていない cast に guest が DM を送れない。
- プロフィールページのフォローボタン・block ボタン・フォロー数が表示され、検索結果とおすすめユーザーのフォローボタンが動く(hook が新しい名前を送っていることの確認)。
- gRPC server のログに、意図しない ERROR が無い。`Notifications::Emit failed` の warn が出ていない。

## Known gaps left for later plans

- `Social::UseCases::PurgeAccount#call(account_id:)` は、profile の id を `account_id` という引数名で受け取る。段 8 で改名する。
- social の handler の `role_for(account_id)` は、本物の account の id を受け取る(profile の表示に account の role を使うため)。
- feed の adapter(`following_account_ids` / `bidirectionally_blocked_account_ids`)、review の adapter(`bidirectionally_blocked_ids(account_id:)`)、feed / discovery / review / messaging / footprints / notifications の use case 自身の引数は、それぞれの段(5〜7)で改名する。social を呼ぶ行では、旧い名前の変数を新しい引数名に渡している(`following_profile_ids(profile_id: viewer_account_id)` など)。
- frontend の messaging(`StartChatButton` の `targetAccountId`、event の `accountId`)と notifications(`NotificationBell` の `targetAccountId`)は、段 5 で改名する。
- social の表には、`social_` で始まる index 名が残る(schema 名と重なる接頭辞)。この段はカラム名の部分だけを直した。
- BFF の route と hook が同じ名前を使うことは、route 側だけを test で固定した。hook 側は Controller verification で確かめる。
- P1a・P1b・P2・P3 の Known gaps はそのまま残る。
