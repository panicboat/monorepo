# Multi Profile P5: Messaging and Notifications Actor Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** messaging slice と notifications slice が持つ「行為者の id」を表す名前を、カラム・proto・Ruby・BFF・frontend のすべてで profile に揃える。挙動は変えない。

**Architecture:** 値は段 1 から profile の id なので、変えるのは名前だけである。改名は決まった規則の置換(perl)で行う。messaging は、送信側が JSON にして PostgreSQL の NOTIFY に流す event と、stream 側がそれを読み戻す処理が、文字列の key で結ばれている。notifications の発行(`Emit`)は post と social から呼ばれ、内部の例外を握りつぶす。どちらも名前がずれるとエラーにならずに壊れるので、実 database を使う結線の spec を先に書き、改名の前後で赤 → 緑を確かめる。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の「その他の proto」、Schema changes の messaging と notifications の 5 行、Delivery の段 5)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた script と file をゼロから再適用して、同じ差分(59 ファイル)になることも確かめた。最終結果は monolith `628 examples, 0 failures`、frontend `tsc` エラー 0・vitest `88` ファイル `344` 件通過。各 Step の Expected のうち数を示したものは、その再適用での実測である。migration は up → down → up を実行して確かめた。Review Focus に「テストで守る」と書いた項目は、該当箇所を壊すと赤になることを確かめてある。

この plan は stack の 5 段目で、ブランチ `feat/dystopia-multi-profile-messaging`(`feat/dystopia-multi-profile-social` の上)に積む。

## Naming

| 場所 | 旧 | 新 |
|---|---|---|
| `messaging.threads` | `account_a` / `account_b` | `profile_a` / `profile_b` |
| `messaging.messages` | `sender_id` | `sender_profile_id` |
| `messaging.read_states` | `account_id` | `profile_id` |
| `notifications.notifications` | `recipient_id` / `latest_actor_id` | `recipient_profile_id` / `latest_actor_profile_id` |
| `notifications.preferences` | `account_id` | `profile_id` |
| proto(messaging) | `Message.sender_id` / `recipient_account_id` / event の `account_id` | `sender_profile_id` / `recipient_profile_id` / `profile_id` |
| messaging の event(JSON の key) | `sender_id` / `account_id` | `sender_profile_id` / `profile_id` |
| messaging の use case と repository の引数 | `sender_id:` / `recipient_id:` / `recipient_account_id:` / `viewer_id:` / `account_id:` / `account_a:` / `account_b:` | `sender_profile_id:` / `recipient_profile_id:` / `recipient_profile_id:` / `viewer_profile_id:` / `profile_id:` / `profile_a:` / `profile_b:` |
| `SendMessage#call` の中 | 解決後の相手 `recipient_id` | `resolved_recipient_profile_id`(引数 `recipient_profile_id` と区別する) |
| notifications の use case と repository の引数 | `recipient_id:` / `actor_id:` / `account_id:` | `recipient_profile_id:` / `actor_profile_id:` / `profile_id:` |
| repository のメソッド | `delete_read_states_by_account` / `delete_notifications_by_account` / `delete_preferences_by_account` | `delete_read_states_by_profile` / `delete_notifications_by_profile` / `delete_preferences_by_profile` |
| handler | `current_user_id` | `current_profile_id` |
| frontend の view と event | `MessageView.senderId` / event の `accountId` | `senderProfileId` / `profileId` |
| frontend の props と BFF の body | `targetAccountId`(`StartChatButton` / `NotificationBell`)/ `recipientAccountId` | `targetProfileId` / `recipientProfileId` |

proto の field 番号は変えない。notifications の proto には改名する field が無い(行為者は `profile.v1.Profile` で返している)。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-messaging`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `619 examples, 0 failures`、vitest 87 ファイル 341 件通過、`tsc` エラー 0。
- 挙動を変えない。この plan が足すテスト以外の spec と test は、名前の置換だけで通る。期待値(件数・順序・status)を書き換えて通すことはしない。
- script は必ず `bash` で実行する。zsh は変数に入れたファイル一覧を単語に分割しないので、`zsh` で実行すると置換が 1 件も適用されない。
- 本物の account の id は変えない。messaging と notifications の handler は、profile の表示のために `account_id`(profile の行が持つ account の id)から role を引く(`role_for(account_id)`)。
- 他 slice が持つ名前は変えない。変えるのは、post・social・footprints の中から notifications の use case を呼ぶ行の、notifications が持つ引数名だけである。footprints の `viewer_id:` / `visitor_id:` などは段 6 で改名する。
- 退会の purge の入口(`Messaging::UseCases::PurgeAccount#call(account_id:)`、`Notifications::UseCases::PurgeAccount#call(account_id:)`)は変えない。段 8 で作り替える。
- `Current.account_id` と `create_account_with_profile` の引数(fixture)は変えない。
- カラムを改名したら、名前にカラム名を含む index・unique 制約・check 制約・NOT NULL 制約も改名する(全環境が PostgreSQL 18.6)。
- テスト用 database に seed や手動の行を入れない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan の手順はコメントを追加しない(既存のコメント 1 行の語を直す)。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

改名で壊れやすく、既存のテストでは検知できない箇所。各行のテストは括弧内のタスクに入れてある。

1. 生の SQL の中で、表の別名を通してカラムを読んでいる箇所(`rs.account_id`)。`.` の直後の `account_id` は本物の account の id(`profile.account_id`)と区別がつかないので、置換の一般規則では変えていない。個別の規則で直す。漏れると未読数の SQL が実行時に失敗する(Task 1 の結線 spec の未読数。`rs.account_id` に戻すと落ちることを確かめた)。
2. messaging の event。送信側が作る JSON の key と、stream 側が読む key が一致していること(Task 1 の結線 spec の event payloads。送信側の key を旧名に戻すと落ちることを確かめた)。
3. `SendMessage#call` で、呼び出し元が指定した相手(`recipient_profile_id`、thread を指定したときは空)と、解決した相手(`resolved_recipient_profile_id`)が別の名前のままであること(Task 1 の Step 5 の script の 1 番と確認。結線 spec は、thread の id だけで返信できること、参加者でない profile が送れないことを確かめる)。
4. `Notifications::UseCases::Emit` は内部の例外を握りつぶして `nil` を返す。内部で呼ぶ repository と設定の引数名を間違えると、通知が 1 件も作られなくなる(`spec/slices/notifications/use_cases/emit_spec.rb` と結線 spec が、作られた通知が返ることを確かめる。設定の引数名を旧名に戻すと落ちることを確かめた)。
5. 本物の account の id(`role_for(account_id)`)が置換に巻き込まれない(Task 1 の結線 spec が、thread の相手と通知の行為者の `role` を確かめる。`role_for` に profile の id を渡すと落ちることを確かめた)。
6. BFF が新しい body の名前を読み、旧い名前を受け付けない(Task 2 の route test)。「メッセージを送る」ボタンが送る body の名前は component の test で確かめる。stream の event の `profileId` を読む frontend のコードは型でしか守られていない(Known gaps)。

---

### Task 1: Proto, schema and monolith

**Files:**
- Modify: `proto/dystopia/messaging/v1/messaging_service.proto`
- Generate: `dystopia/monolith/stubs/messaging/v1/messaging_service_pb.rb`
- Create: `dystopia/monolith/config/db/migrate/20261008040000_rename_messaging_and_notification_actor_columns_to_profile.rb`
- Create: `dystopia/monolith/spec/slices/messaging/rpc_and_event_wiring_spec.rb`
- Modify: `dystopia/monolith/slices/messaging/**`、`dystopia/monolith/slices/notifications/**`、`dystopia/monolith/spec/slices/messaging/**`、`dystopia/monolith/spec/slices/notifications/**`
- Modify(notifications の use case を呼ぶ行のみ): `slices/post/grpc/like_handler.rb`、`slices/post/grpc/post_handler.rb`、`slices/post/use_cases/comments/add_comment.rb`、`slices/social/use_cases/follows/follow.rb`、`slices/social/use_cases/follows/approve_follow_request.rb`、`slices/footprints/use_cases/record_visit.rb`
- Modify(spec): `spec/slices/post/grpc/post_handler_spec.rb`、`spec/slices/post/use_cases/comments/add_comment_spec.rb`、`spec/slices/identity/use_cases/account/purge_wiring_spec.rb`、`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`

**Interfaces:**
- Consumes: `Grpc::Authenticatable#current_profile_id`、`ProfileFixtures`
- Produces: Naming の表のとおり。主なものは次のとおり。
  - `Notifications::Slice["use_cases.emit"].call(recipient_profile_id:, type:, target_resource_id:, actor_profile_id:, target_post_id: nil)`
  - `Notifications::Slice["use_cases.get_preferences"].call(profile_id:)`
  - `Messaging::Slice["use_cases.send_message"].call(sender_profile_id:, content:, thread_id: nil, recipient_profile_id: nil)`
  - `Messaging::Slice["use_cases.get_or_create_thread"].call(viewer_profile_id:, recipient_profile_id:)`
  - `Messaging::UseCases::AuthorizeMessage#call(sender_profile_id:, recipient_profile_id:)`

- [ ] **Step 1: 結線の spec を書く(失敗する)**

`spec/slices/messaging/rpc_and_event_wiring_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/messaging/grpc/messaging_handler"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Messaging and notifications RPC entry points and event payloads", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "wiring_cast") }
  let(:guest) { create_account_with_profile(username: "wiring_guest") }
  let(:outsider) { create_account_with_profile(username: "wiring_outsider") }

  def handler(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def rpc(handler_class, method, message)
    handler(handler_class, method, message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def send_message(**attrs)
    rpc(Messaging::Grpc::MessagingHandler, :send_message, Messaging::V1::SendMessageRequest.new(**attrs))
  end

  def threads
    rpc(Messaging::Grpc::MessagingHandler, :list_threads, Messaging::V1::ListThreadsRequest.new)
  end

  def total_unread
    rpc(Messaging::Grpc::MessagingHandler, :get_total_unread_count, Messaging::V1::GetTotalUnreadCountRequest.new).count
  end

  after { Current.clear }

  describe "messaging RPCs" do
    it "sends a message to a profile and stores the participants as an ordered profile pair" do
      act_as(cast)

      sent = send_message(recipient_profile_id: guest, content: "hello")

      expect(sent.message.sender_profile_id).to eq(cast)
      expect(db[:messaging__messages].select_map([:thread_id, :sender_profile_id])).to eq([[sent.thread_id, cast]])
      expect(db[:messaging__threads].select_map([:profile_a, :profile_b])).to eq([[cast, guest].minmax])
    end

    it "shows the thread to both participants with the counterpart and the unread count" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "one").thread_id
      send_message(thread_id: thread_id, content: "two")

      expect(threads.threads.map { |t| [t.counterpart.id, t.unread_count] }).to eq([[guest, 0]])
      expect(total_unread).to eq(0)

      act_as(guest)
      listed = threads
      expect(listed.threads.map { |t| [t.id, t.counterpart.id, t.counterpart.role, t.unread_count] }).to eq([[thread_id, cast, 2, 2]])
      expect(listed.total_unread_count).to eq(2)
      expect(total_unread).to eq(2)

      messages = rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread_id)).messages
      expect(messages.map(&:sender_profile_id)).to eq([cast, cast])

      rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread_id, message_id: messages.first.id))
      expect(total_unread).to eq(0)
      expect(db[:messaging__read_states].select_map([:thread_id, :profile_id])).to eq([[thread_id, guest]])
    end

    it "opens a thread by recipient profile and replies through the thread id" do
      act_as(cast)
      opened = rpc(Messaging::Grpc::MessagingHandler, :get_or_create_thread, Messaging::V1::GetOrCreateThreadRequest.new(recipient_profile_id: guest)).thread
      send_message(thread_id: opened.id, content: "from cast")

      act_as(guest)
      expect { send_message(thread_id: opened.id, content: "without a follow") }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: guest, followee_profile_id: cast, status: "approved")
      reply = send_message(thread_id: opened.id, content: "from guest")

      expect(opened.counterpart.id).to eq(guest)
      expect(reply.thread_id).to eq(opened.id)
      expect(db[:messaging__messages].order(:created_at).select_map(:sender_profile_id)).to eq([cast, guest])
    end

    it "keeps a non-participant out of the thread" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "private").thread_id

      act_as(outsider)

      expect { rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { rpc(Messaging::Grpc::MessagingHandler, :send_typing, Messaging::V1::SendTypingRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { send_message(thread_id: thread_id, content: "intrusion") }.to raise_error(GRPC::BadStatus)
      expect(threads.threads).to eq([])
    end
  end

  describe "event payloads" do
    def capture(use_case)
      published = []
      allow(use_case).to receive(:notify) { |channel, payload| published << [channel, payload] }
      published
    end

    def parse(payload)
      handler(Messaging::Grpc::MessagingHandler, :stream_events, Messaging::V1::StreamEventsRequest.new).send(:parse_payload_to_event, payload)
    end

    it "publishes a message to both participants in a shape the stream can read back" do
      use_case = Messaging::Slice["use_cases.send_message"]
      published = capture(use_case)

      use_case.call(sender_profile_id: cast, content: "event", recipient_profile_id: guest)

      expect(published.map(&:first)).to eq(["messaging_user_#{cast}", "messaging_user_#{guest}"])
      event = parse(published.first.last)
      expect(event.message_event.sender_profile_id).to eq(cast)
      expect(event.message_event.content).to eq("event")
    end

    it "publishes read state and typing to the counterpart in a shape the stream can read back" do
      thread_id = Messaging::Slice["use_cases.send_message"].call(sender_profile_id: cast, content: "x", recipient_profile_id: guest)[:thread_id]
      mark_read = Messaging::Slice["use_cases.mark_read"]
      typing = Messaging::Slice["use_cases.send_typing"]
      read_published = capture(mark_read)
      typing_published = capture(typing)

      mark_read.call(thread_id: thread_id, viewer_profile_id: guest, message_id: nil)
      typing.call(thread_id: thread_id, viewer_profile_id: guest)

      expect(read_published.map(&:first)).to eq(["messaging_user_#{cast}"])
      expect(parse(read_published.first.last).read_state.profile_id).to eq(guest)
      expect(typing_published.map(&:first)).to eq(["messaging_user_#{cast}"])
      expect(parse(typing_published.first.last).typing.profile_id).to eq(guest)
    end
  end

  describe "notification RPCs" do
    let(:emit) { Notifications::Slice["use_cases.emit"] }

    def notifications
      rpc(Notifications::Grpc::NotificationHandler, :list_notifications, Notifications::V1::ListNotificationsRequest.new)
    end

    def unread
      rpc(Notifications::Grpc::NotificationHandler, :get_unread_count, Notifications::V1::GetUnreadCountRequest.new).count
    end

    it "lists a recipient's notifications with the latest actor and marks them read" do
      first = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      emit.call(recipient_profile_id: guest, type: "follow_approved", target_resource_id: cast, actor_profile_id: cast)
      emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      expect(db[:notifications__notifications].where(id: first[:id]).select_map([:recipient_profile_id, :latest_actor_profile_id])).to eq([[guest, cast]])

      act_as(guest)
      listed = notifications
      expect(listed.notifications.map { |n| [n.latest_actor.id, n.latest_actor.role] }).to eq([[cast, 2], [cast, 2]])
      expect(listed.unread_count).to eq(2)
      expect(unread).to eq(2)

      rpc(Notifications::Grpc::NotificationHandler, :mark_read, Notifications::V1::MarkReadRequest.new(id: first[:id]))
      expect(unread).to eq(1)
      affected = rpc(Notifications::Grpc::NotificationHandler, :mark_all_read, Notifications::V1::MarkAllReadRequest.new).affected
      expect(affected).to eq(1)
      expect(unread).to eq(0)

      act_as(outsider)
      expect(unread).to eq(1)
    end

    it "does not let a profile mark another profile's notification as read" do
      mine = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)

      act_as(outsider)
      rpc(Notifications::Grpc::NotificationHandler, :mark_read, Notifications::V1::MarkReadRequest.new(id: mine[:id]))

      act_as(guest)
      expect(unread).to eq(1)
    end

    it "stores preferences per profile and applies them when a notification is emitted" do
      act_as(guest)
      current = rpc(Notifications::Grpc::NotificationHandler, :get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences
      expect(current.like).to be true

      muted = Notifications::V1::NotificationPreferences.new(**current.to_h.merge(like: false))
      updated = rpc(Notifications::Grpc::NotificationHandler, :update_notification_preferences, Notifications::V1::UpdateNotificationPreferencesRequest.new(preferences: muted)).preferences

      expect(updated.like).to be false
      expect(db[:notifications__preferences].select_map(:profile_id)).to eq([guest])
      expect(emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).to be_nil
      expect(emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).not_to be_nil
    end
  end
end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/messaging/rpc_and_event_wiring_spec.rb > /tmp/rspec-p5-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p5-red.txt`
Expected: `15 examples, 9 failures`(spec/support の 6 件は通り、この spec の 9 件がすべて落ちる)。

- [ ] **Step 2: proto を改名する**

次の内容を `/tmp/p5-proto.sh` に保存し、リポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で `bash /tmp/p5-proto.sh` を実行する。

```bash
set -euo pipefail
perl -pi -e 's/sender_id/sender_profile_id/g; s/recipient_account_id/recipient_profile_id/g; s/\baccount_id\b/profile_id/g' proto/dystopia/messaging/v1/messaging_service.proto
```

Run(root): `/usr/bin/grep -c -E 'account_id|sender_id' proto/dystopia/messaging/v1/messaging_service.proto`
Expected: `0`

- [ ] **Step 3: Ruby の stub を生成する**

`bin/codegen` は全 package の stub を作り直す。messaging の `messaging_service_pb.rb` 以外の差分を戻す(RPC の名前は変わらない。`messaging_service_services_pb.rb` に出る差分は generator がコメントを落とすだけのもので、戻す)。

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v '^stubs/messaging/v1/messaging_service_pb.rb$' | xargs git checkout --
git status --short stubs
```
Expected: ` M stubs/messaging/v1/messaging_service_pb.rb` の 1 行だけ。

- [ ] **Step 4: migration を書いて適用する**

`config/db/migrate/20261008040000_rename_messaging_and_notification_actor_columns_to_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:messaging__threads) do
      rename_column :account_a, :profile_a
      rename_column :account_b, :profile_b
    end
    alter_table(:messaging__messages) { rename_column :sender_id, :sender_profile_id }
    alter_table(:messaging__read_states) { rename_column :account_id, :profile_id }
    alter_table(:notifications__notifications) do
      rename_column :recipient_id, :recipient_profile_id
      rename_column :latest_actor_id, :latest_actor_profile_id
    end
    alter_table(:notifications__preferences) { rename_column :account_id, :profile_id }

    run "ALTER INDEX messaging.idx_threads_account_a_last RENAME TO idx_threads_profile_a_last"
    run "ALTER INDEX messaging.idx_threads_account_b_last RENAME TO idx_threads_profile_b_last"

    run "ALTER TABLE messaging.threads RENAME CONSTRAINT uq_threads_account_pair TO uq_threads_profile_pair"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT chk_threads_account_order TO chk_threads_profile_order"
    run "ALTER TABLE messaging.read_states RENAME CONSTRAINT read_states_account_id_not_null TO read_states_profile_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_recipient_id_not_null TO notifications_recipient_profile_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_latest_actor_id_not_null TO notifications_latest_actor_profile_id_not_null"
    run "ALTER TABLE notifications.preferences RENAME CONSTRAINT preferences_account_id_not_null TO preferences_profile_id_not_null"
  end

  down do
    run "ALTER TABLE notifications.preferences RENAME CONSTRAINT preferences_profile_id_not_null TO preferences_account_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_latest_actor_profile_id_not_null TO notifications_latest_actor_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_recipient_profile_id_not_null TO notifications_recipient_id_not_null"
    run "ALTER TABLE messaging.read_states RENAME CONSTRAINT read_states_profile_id_not_null TO read_states_account_id_not_null"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT chk_threads_profile_order TO chk_threads_account_order"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT uq_threads_profile_pair TO uq_threads_account_pair"

    run "ALTER INDEX messaging.idx_threads_profile_b_last RENAME TO idx_threads_account_b_last"
    run "ALTER INDEX messaging.idx_threads_profile_a_last RENAME TO idx_threads_account_a_last"

    alter_table(:notifications__preferences) { rename_column :profile_id, :account_id }
    alter_table(:notifications__notifications) do
      rename_column :latest_actor_profile_id, :latest_actor_id
      rename_column :recipient_profile_id, :recipient_id
    end
    alter_table(:messaging__read_states) { rename_column :profile_id, :account_id }
    alter_table(:messaging__messages) { rename_column :sender_profile_id, :sender_id }
    alter_table(:messaging__threads) do
      rename_column :profile_b, :account_b
      rename_column :profile_a, :account_a
    end
  end
end
```

`messaging.threads` の 2 つのカラムと `messaging.messages.sender_id` には NOT NULL 制約が無い(退会時に `NULL` にするため)。`idx_notifications_recipient_latest` などの index 名は、カラム名ではなく役割の語を含むだけなので変えない。

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。`config/db/structure.sql` の dump は git の管理外なので commit に含めない。

Run: `psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(n, ' ' order by n) from (select conname n from pg_constraint where connamespace in ('messaging'::regnamespace,'notifications'::regnamespace) and conname ~ '(account|sender_id|recipient_id|actor_id|profile)' union select indexname from pg_indexes where schemaname in ('messaging','notifications') and indexname ~ '(account|profile)') x"`
Expected: `chk_threads_profile_order idx_threads_profile_a_last idx_threads_profile_b_last notifications_latest_actor_profile_id_not_null notifications_recipient_profile_id_not_null preferences_profile_id_not_null read_states_profile_id_not_null uq_threads_profile_pair`

- [ ] **Step 5: Ruby の名前を置換する**

次の内容を `/tmp/p5-monolith.sh` に保存し、`dystopia/monolith` で `bash /tmp/p5-monolith.sh` を実行する。2 回実行しない。

```bash
set -euo pipefail

# 1. send_message keeps the requested recipient and the resolved recipient under different names
perl -pi -e 's/recipient_id = resolve_recipient\(/resolved_recipient_profile_id = resolve_recipient(/; s/sender_id\.to_s == recipient_id\.to_s/sender_id.to_s == resolved_recipient_profile_id.to_s/; s/bidirectionally_blocked\?\(sender_id, recipient_id\)/bidirectionally_blocked?(sender_id, resolved_recipient_profile_id)/; s/recipient_id: recipient_id\)/recipient_id: resolved_recipient_profile_id)/g; s/\[sender_id\.to_s, recipient_id\.to_s\]/[sender_id.to_s, resolved_recipient_profile_id.to_s]/' slices/messaging/use_cases/send_message.rb

# 2. the messaging slice and its specs (the purge entry point keeps its keyword; role_for takes a real account id)
MSG=$(find slices/messaging spec/slices/messaging -name '*.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/sender_id/sender_profile_id/g; s/recipient_account_id/recipient_profile_id/g; s/\brecipient_id\b/recipient_profile_id/g; s/\bviewer_id\b/viewer_profile_id/g; s/\baccount_a\b/profile_a/g; s/\baccount_b\b/profile_b/g; s/delete_read_states_by_account/delete_read_states_by_profile/g' $MSG
perl -pi -e 's/(?<![.\w])account_id\b/profile_id/g unless /role_for\(account_id\)|identity_account_repo\.find_by_id\(account_id\)/' $(echo "$MSG" | /usr/bin/grep -v 'purge_account')

# 3. the notifications slice and its specs
NOTI=$(find slices/notifications spec/slices/notifications -name '*.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/\brecipient_id\b/recipient_profile_id/g; s/actor_id(s?)\b/actor_profile_id$1/g; s/delete_notifications_by_account/delete_notifications_by_profile/g; s/delete_preferences_by_account/delete_preferences_by_profile/g' $NOTI
perl -pi -e 's/(?<![.\w])account_id\b/profile_id/g unless /role_for\(account_id\)|identity_account_repo\.find_by_id\(account_id\)/' $(echo "$NOTI" | /usr/bin/grep -v 'purge_account')

# 4. other slices: the keywords of Notifications::UseCases::Emit and GetPreferences
perl -pi -e 's/^(\s+)recipient_id:/$1recipient_profile_id:/; s/^(\s+)actor_id:/$1actor_profile_id:/' slices/post/grpc/like_handler.rb slices/post/grpc/post_handler.rb slices/post/use_cases/comments/add_comment.rb slices/social/use_cases/follows/follow.rb slices/social/use_cases/follows/approve_follow_request.rb
perl -pi -e 's/notifications_get_prefs\.call\(account_id:/notifications_get_prefs.call(profile_id:/' slices/footprints/use_cases/record_visit.rb

# 5. a column reached through a table alias in raw SQL, and a comment that still says account
perl -pi -e 's/\brs\.account_id\b/rs.profile_id/; s/normalized account pairs/normalized profile pairs/' slices/messaging/repositories/messaging_repository.rb

# 6. specs of other slices that call the messaging and notifications repositories and use cases
perl -pi -e 's/notification_repo\.list\(recipient_id:/notification_repo.list(recipient_profile_id:/' spec/slices/post/grpc/post_handler_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb
perl -pi -e 's/^(\s+)recipient_id:/$1recipient_profile_id:/; s/^(\s+)actor_id:/$1actor_profile_id:/; s/\baccount_a\b/profile_a/g; s/\baccount_b\b/profile_b/g; s/(upsert_read_state\(thread_id: [^,]+, )account_id:/$1profile_id:/; s/latest_actor_id:/latest_actor_profile_id:/; s/(db\[:messaging__read_states\]\.where\((?:thread_id: [^,]+, )?)account_id:/$1profile_id:/' spec/slices/identity/use_cases/account/purge_wiring_spec.rb
perl -pi -e 's/authorize\.call\(sender_id: (\w+), recipient_id:/authorize.call(sender_profile_id: $1, recipient_profile_id:/; s/open_thread\.call\(viewer_id: (\w+), recipient_account_id:/open_thread.call(viewer_profile_id: $1, recipient_profile_id:/; s/\.call\(sender_id: (\w+), content: "hi", recipient_account_id:/.call(sender_profile_id: $1, content: "hi", recipient_profile_id:/; s/emit\.call\(recipient_id: (\w+), type: "like", target_resource_id: target, actor_id:/emit.call(recipient_profile_id: $1, type: "like", target_resource_id: target, actor_profile_id:/' spec/slices/social/rpc_and_cross_slice_wiring_spec.rb
```

Run: `/usr/bin/grep -rn -E '\baccount_id\b|sender_id|\b(recipient|viewer|actor)_ids?\b|current_user_id|\baccount_[ab]\b' slices/messaging slices/notifications spec/slices/messaging spec/slices/notifications --include='*.rb' | wc -l`
Expected: `16`。内訳は次のとおりで、これ以外が出たら置換漏れである。

- `slices/messaging/grpc/messaging_handler.rb` と `slices/notifications/grpc/notification_handler.rb` の各 3 行: `role_for(....account_id)`、`def role_for(account_id)`、`identity_account_repo.find_by_id(account_id)`(本物の account の id)
- `slices/messaging/use_cases/purge_account.rb` の 4 行、`slices/notifications/use_cases/purge_account.rb` の 3 行、それぞれの `purge_account_spec.rb`(purge の入口)
- `spec/slices/messaging/rpc_and_event_wiring_spec.rb` の `Current.account_id` の 1 行

Run: `/usr/bin/grep -n 'recipient_profile_id' slices/messaging/use_cases/send_message.rb | /usr/bin/grep -c 'resolved_recipient_profile_id'`
Expected: `6`(`call` の中で、解決した相手を使う行。引数の `recipient_profile_id` と混ざっていない)

Run: `git status --short . | wc -l`
Expected: `45`

- [ ] **Step 6: 結線の spec と全体が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/messaging/rpc_and_event_wiring_spec.rb > /tmp/rspec-p5-green.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p5-green.txt`
Expected: `15 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `628 examples, 0 failures`

失敗がある場合は、名前の置換漏れか置換し過ぎである。期待値を書き換えず、該当の名前だけを直す。直せない場合は BLOCKED として出力を報告する。

- [ ] **Step 7: migration の down を確かめる**

Run:
```bash
HANAMI_ENV=test rbenv exec bundle exec hanami db rollback
psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(table_schema||'.'||table_name||'('||cols||')', ' ' order by 1) from (select table_schema, table_name, string_agg(column_name, ',' order by ordinal_position) cols from information_schema.columns where table_schema in ('messaging','notifications') and column_name ~ '(account|sender|recipient|actor|profile)' group by 1,2) y"
HANAMI_ENV=test rbenv exec bundle exec hanami db migrate
```
Expected: rollback は `rolled back to 20261008030000_rename_social_actor_columns_to_profile` と出る。カラムは `messaging.messages(sender_id) messaging.read_states(account_id) messaging.threads(account_a,account_b) notifications.notifications(recipient_id,actor_count,latest_actor_id) notifications.preferences(account_id)` に戻る。最後の migrate は `migrated` と出る。

- [ ] **Step 8: Commit**

```bash
cd ../.. && git add -A proto/dystopia/messaging dystopia/monolith && git status --short && git commit -s -m "refactor(dystopia): name the messaging and notification actor columns, fields and arguments after the profile" && cd dystopia/monolith
```

`git status --short` の出力が `proto/dystopia/messaging` と `dystopia/monolith` の下だけであることを確認してから commit する。

---

### Task 2: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/messaging/v1/messaging_service_pb.ts`
- Create: `dystopia/frontend/src/app/api/messaging/profile-names.test.ts`
- Modify: `dystopia/frontend/src/modules/messaging/**`、`src/modules/notifications/**`、`src/app/api/messaging/**`、`src/app/messages/**`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/messaging/types` の `MessageView.senderProfileId`、event の `data.profileId`
  - `StartChatButton` と `NotificationBell` の props は `targetProfileId`
  - BFF: `POST /api/messaging/messages` の body は `{ threadId, recipientProfileId, content }`、`POST /api/messaging/threads` の body は `{ recipientProfileId }`

- [ ] **Step 1: stub を生成する**

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v '^src/stub/messaging/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: ` M src/stub/messaging/v1/messaging_service_pb.ts` の 1 行だけ。

- [ ] **Step 2: BFF の名前を固定する test を書く(失敗する)**

`src/app/api/messaging/profile-names.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { MessageSchema } from "@/stub/messaging/v1/messaging_service_pb";

const messaging = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  getOrCreateThread: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ messagingClient: messaging }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const messagesRoute = await import("./messages/route");
const threadsRoute = await import("./threads/route");

function post(path: string, body: unknown) {
  const req = new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("messaging routes address the counterpart by profile id", () => {
  beforeEach(() => {
    messaging.sendMessage.mockReset().mockResolvedValue({
      message: create(MessageSchema, { id: "m-1", threadId: "t-1", senderProfileId: "viewer-1", content: "hi" }),
      threadId: "t-1",
    });
    messaging.getOrCreateThread.mockReset().mockResolvedValue({ thread: undefined });
  });

  it("POST /api/messaging/messages sends recipientProfileId and returns the sender profile", async () => {
    const res = await messagesRoute.POST(post("/api/messaging/messages", { recipientProfileId: "prof-1", content: "hi" }));

    expect(messaging.sendMessage).toHaveBeenCalledWith(
      { threadId: "", recipientProfileId: "prof-1", content: "hi" },
      expect.anything()
    );
    expect((await res.json()).message).toMatchObject({ id: "m-1", senderProfileId: "viewer-1" });
  });

  it("POST /api/messaging/messages rejects the former field name", async () => {
    const res = await messagesRoute.POST(post("/api/messaging/messages", { recipientAccountId: "prof-1", content: "hi" }));

    expect(res.status).toBe(400);
    expect(messaging.sendMessage).not.toHaveBeenCalled();
  });

  it("POST /api/messaging/threads opens a thread by recipientProfileId and rejects the former field name", async () => {
    const ok = await threadsRoute.POST(post("/api/messaging/threads", { recipientProfileId: "prof-1" }));
    const former = await threadsRoute.POST(post("/api/messaging/threads", { recipientAccountId: "prof-1" }));

    expect(ok.status).toBe(200);
    expect(former.status).toBe(400);
    expect(messaging.getOrCreateThread).toHaveBeenCalledTimes(1);
    expect(messaging.getOrCreateThread).toHaveBeenCalledWith({ recipientProfileId: "prof-1" }, expect.anything());
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/messaging/profile-names.test.ts > /tmp/vitest-p5-red.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p5-red.txt | /usr/bin/grep -E 'Test Files|Tests ' | head -3`
Expected: `Test Files  1 failed (1)` と `Tests  3 failed (3)`(route がまだ旧い名前を読むため)。

- [ ] **Step 3: 名前を置換する**

次の内容を `/tmp/p5-frontend.sh` に保存し、`dystopia/frontend` で `bash /tmp/p5-frontend.sh` を実行する。

```bash
set -euo pipefail

# 1. the messaging and notifications modules, their BFF routes and their pages
FILES=$(find src/modules/messaging src/modules/notifications src/app/api/messaging src/app/api/notifications src/app/messages src/app/notifications -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'profile-names.test.ts')
perl -pi -e 's/\bsenderId\b/senderProfileId/g; s/recipientAccountId/recipientProfileId/g; s/targetAccountId/targetProfileId/g; s/\baccountId\b/profileId/g' $FILES

# 2. callers of the two components outside the modules
perl -0pi -e 's/(<(?:StartChatButton|NotificationBell)\s+)targetAccountId=/$1targetProfileId=/g' "src/app/u/[username]/page.tsx"
```

Run: `/usr/bin/grep -rn -E 'senderId|recipientAccountId|targetAccountId|\baccountId\b' src/modules/messaging src/modules/notifications src/app/api/messaging src/app/api/notifications src/app/messages src/app/notifications | /usr/bin/grep -v 'profile-names.test.ts'`
Expected: 出力なし(`profile-names.test.ts` は、旧い名前を受け付けないことを確かめるために旧名を含む)。

型の付いていない mock や fixture は `tsc` で拾えない。messaging の旧い key が test や他の module に残っていないことを、`src` 全体で確かめる。

Run: `/usr/bin/grep -rn -E 'senderId|recipientAccountId' src --include='*.ts' --include='*.tsx' | /usr/bin/grep -v -E '^src/stub/|profile-names.test.ts'`
Expected: 出力なし。

- [ ] **Step 4: 全体を確認する**

Run: `rm -rf .next; env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p5.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  88 passed (88)`、`Tests  344 passed (344)`。

`rm -rf .next` を shell が拒否した場合は、`.next` が存在しないことを確かめてから残りを実行する。

Run: `git status --short . | wc -l; git status --short src/stub | wc -l`
Expected: `13` と `1`

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -s -m "refactor(dystopia/frontend): address message senders and recipients by profile id"
```

---

## Controller verification (not dispatched)

Task 2 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` で開く、終了後に生成物と database を削除)。

- cast が guest に DM を送れる。guest は、フォローが承認されている cast にだけ送れる。thread 一覧に相手と未読数が出て、開くと既読になる。
- 送信・入力中・既読で monolith が発行する NOTIFY の payload の key と channel が、改名後の名前になっている(`psql` の `LISTEN` で受け取って確かめる)。
- いいね・コメント・mention・フォローで通知が届き、一覧に行為者が表示される。既読と全件既読が動く。通知の設定を切ると、その種類の通知が作られない。
- プロフィールページの「メッセージを送る」が動く(hook が新しい名前を送っていることの確認)。
- gRPC server のログに、意図しない ERROR と、`notify failed` / `Notifications::Emit failed` / `bad payload` の warn が無い。

## Known gaps left for later plans

- `Messaging::UseCases::PurgeAccount#call(account_id:)` と `Notifications::UseCases::PurgeAccount#call(account_id:)` は、profile の id を `account_id` という引数名で受け取る。段 8 で改名する。
- messaging と notifications の handler の `role_for(account_id)` は、本物の account の id を受け取る。
- PostgreSQL の NOTIFY の channel 名は `messaging_user_<profile の id>` のままである。名前の中の `user` は id の種類を表していないので変えていない。
- messaging の stream の event を BFF が JSON に写す処理(`src/app/api/messaging/stream/route.ts`)と、hook が event を読む処理(`useTyping`)は、型でしか守られていない。frontend に stream を開くコードも `messaging:typing` を発火するコードも無いので、ブラウザでは確かめられない。
- `idx_notifications_recipient_latest` などの index 名と `uq_notifications_group` は、カラム名を含まないので変えていない。
- P1a・P1b・P2・P3・P4 の Known gaps はそのまま残る。
- frontend の hook にある `const userId = useAuthStore((s) => s.activeProfileId)` は、messaging と notifications の 6 箇所を `profileId` に改名した。残りは 21 箇所ある(VERIFIED: `/usr/bin/grep -rn 'const userId = useAuthStore' src`)。footprints 2・bookmarks 1 は段 6、review 4・discovery 4 は段 7、social 5・karte 4・profile 1 は段 9 で改名する。
- 以下は main に元からある不具合で、この stack では直していない(別の PR で扱う)。
  - `StreamEvents` は最初の event で `no block given (yield)` になって終わる。grpc は server streaming の handler を block なしで呼ぶ(`rpc_desc.rb` の `handle_server_streamer`)。
  - `RACK_ENV` / `RAILS_ENV` が未設定だと gruf が development として動き、RPC ごとに reload の書き込みロックを取る。終わらない `StreamEvents` が読み取りロックを持ち続けるので、stream が 1 本開くと以降の全 RPC が待ち続ける。`bin/grpc` は `HANAMI_ENV` しか設定していない。
  - `NotificationRepository#upsert_preferences` の `ON CONFLICT ... DO UPDATE SET` が `updated_at` しか更新しないので、通知設定は 2 回目以降の保存が反映されない(`update_assignments` が SQL に入っていない)。
  - 幅 390px では、DM の入力欄の中央に下部ナビの link が重なる。

## Changes after the whole-branch review

branch 全体のレビュー(Critical なし)の指摘を受けて、次を変えた。挙動は変えていない。

- `spec/slices/messaging/rpc_and_event_wiring_spec.rb`: 参加者でない profile の送信を `PERMISSION_DENIED` で確かめる(以前は status を指定しておらず、所属の判定を壊しても「フォローが必要」の拒否で通っていた)。thread の id だけで返信したときに event が相手の channel に発行されることを確かめる example を足した。どちらも、対象の行を壊すと失敗することを確かめた。
- `src/modules/messaging/components/StartChatButton.request.test.tsx`: ボタンが `recipientProfileId` で thread を開くことを確かめる(body は型の無い object なので `tsc` では守れない)。
- messaging と notifications の hook の `userId` を `profileId` に改名した。
- `src/app/api/messaging/profile-names.test.ts` と `src/app/api/social/profile-queries.test.ts`: test の名前と変数から「former」を外し、拒否する field の名前で書いた。
- `MessagingRepository` の、pair の順序についてのコメントを、対象の method(`find_thread_by_pair`)の上に移し、制約の名前(`chk_threads_profile_order`)で書き直した。

## Controller verification result

2026-10-08 に、使い捨ての database と実サーバー(`bin/grpc` + `next dev`)で確認した(修正前の commit `af0a383f` に対して。修正は spec・test・hook の変数名・コメントだけを変える)。gruf の reload のロックを避けるため、確認用の server には `RACK_ENV=production` を export した。

- API 51 項目のうち 47 項目が通った: thread を開ける相手(cast から guest、フォローが承認された guest から cast)、送信と返信、thread 一覧の相手と未読数、既読、参加者でない profile の拒否、旧い名前(`recipientAccountId`)の 400、フォロー・いいね・コメント・mention の通知と行為者、既読と全件既読、通知の設定を切った種類が作られないこと、足跡の記録。
- 通らなかった 4 項目はすべて stream の受信で、原因は Known gaps に書いた `StreamEvents` の不具合である。monolith が発行する payload は `psql` の `LISTEN` で受け取り、message が `sender_profile_id`、typing と read_state が `profile_id` を持ち、相手(message は両者)の channel に届くことを確かめた。
- headless Chrome(幅 1280px、2 つの browser context): 「メッセージを送る」が `recipientProfileId` で thread を開き、送信と返信ができ、吹き出しが自分と相手に正しく分かれ、thread 一覧と通知一覧に相手が表示される。失敗した呼び出しは無い。
- gRPC server のログの ERROR は、意図した拒否の 3 件と `StreamEvents` の 2 件だけで、`notify failed` / `Notifications::Emit failed` / `bad payload` の warn は無かった。
