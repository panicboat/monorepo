# Dystopia Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定画面で有効にした端末へ、アカウントの全プロフィール宛てのアプリ内通知と DM を Web Push で届ける。

**Architecture:** monolith の notifications slice に購読の表・送信の窓口（`SendPush`）・VAPID 署名と暗号化を包む adapter を足し、`Emit` と `SendMessage` から操作の処理の中で直接送る。frontend は `public/sw.js` で受け取り、設定画面で購読し、`/notifications/open` で宛先のプロフィールに切り替えてから対象の画面を開く。VAPID 秘密鍵は `dystopia/lambda` の Terraform で作り、環境変数で渡す。

**Tech Stack:** Hanami 2 / ROM-SQL / gruf（Ruby 3.4 ローカル、Ruby 4.0.7 イメージ）、`web-push` gem 3.1、buf、Next.js 16 / React / TypeScript 7 / vitest、OpenTofu 1.12.6 と `hashicorp/tls` provider 4.4。

**Spec:** `docs/superpowers/specs/2026-10-22-dystopia-web-push-design.md`

## Global Constraints

- 出力・UI の文言は spec の表のとおり日本語。コード内の識別子・コメント・コミットメッセージは英語
- コードコメントは英語 1 行、"why not" だけを書く。タスクや修正への言及をしない。フォールバックには `FALLBACK:`、意図的な握りつぶしには `SILENT:` を付ける（Ruby は `#`、JS/TS は `//`）
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは `feat(dystopia): ...` / `fix(dystopia): ...` / `refactor(dystopia): ...` の形
- 送信の値: TTL `86_400` 秒、urgency は DM（`message`）だけ `"high"`、他は `"normal"`、接続・読み取り・TLS の待ち時間は各 `3` 秒
- 本文は空白の連続を 1 つの空白にしてから前後を削り、100 文字を超えたら先頭 100 文字 + `…`
- 購読を受け付ける endpoint: https・ポート 443・userinfo なし・長さ 2048 以下で、ホストが `fcm.googleapis.com` / `web.push.apple.com` / `updates.push.services.mozilla.com` のいずれか、または `.push.apple.com` / `.push.services.mozilla.com` / `.notify.windows.com` で終わる
- 依存の版: `gem "web-push", "~> 3.1"`、`hashicorp/tls` は `"~> 4.4"`
- proto を変えたら `dystopia/monolith` で `bin/codegen`、`dystopia/frontend` で `pnpm proto:gen` を実行する。commit するのは `monolith/stubs/notifications/` と `frontend/src/stub/notifications/` だけで、他の stub の差分は戻し、未追跡の stub（billing など）は消す
- monolith の検証: Postgres（`brew services`）が動いている前提で、`cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`（最後の `pg_dump` の version mismatch エラーは無視してよい）の後、`HANAMI_ENV=test bundle exec rspec <files> > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`。`$SCRATCH` はシェルごとに消えるので、各コマンドの先頭で `SCRATCH=/private/tmp/claude-501/-Users-takanokenichi-GitHub-panicboat-monorepo/baa50ca4-8335-4d70-835e-a9e9e2c6da0d/scratchpad;` を付ける
- frontend の検証: 初回だけ `cd dystopia/frontend && pnpm install --frozen-lockfile`。テストは `pnpm exec vitest run <files>`、型は `env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`（パイプしない）。`pnpm lint` は壊れているので使わない
- shell の `cat` は `bat` の alias。ファイルの中身を書くときは Write/Edit tool を使う

## Review Focus

1. 中身が無い、または JSON でない push を受けても、service worker は汎用の通知を必ず出す（Safari は通知を出さない push を続けると購読を取り消す） — Task 5 の `sw.test.ts`
2. 宛先か送り手のプロフィールが非表示（無効化・アカウント停止）なら送らない — Task 4 の `send_push_spec.rb`
3. 空白だけの本文は動作の文言だけにし、改行を含む本文は 1 行にまとめる — Task 4 の `build_push_message_spec.rb`
4. 同じブラウザが登録し直したとき（新しい鍵・別アカウント）、行は 1 つのまま最新の鍵と持ち主になる — Task 3 の `push_subscription_rpc_spec.rb`
5. service worker が制御していないウィンドウが開いているときにタップしても、対象の画面が開く（`navigate` が失敗したら `openWindow`） — Task 5 の `sw.test.ts`

---

### Task 1: Keep only notification preferences that take effect

`repost`・`quote`・`oshi` を消し、`post` を `comment` に改名する。proto・DB・monolith・frontend を揃える。

**Files:**
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`
- Regenerate: `dystopia/monolith/stubs/notifications/v1/notification_service_pb.rb`, `dystopia/frontend/src/stub/notifications/v1/notification_service_pb.ts`
- Create: `dystopia/monolith/config/db/migrate/20261027000000_rework_notification_preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/relations/preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/get_preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/repositories/notification_repository.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/emit.rb`
- Create: `dystopia/monolith/spec/slices/notifications/grpc/preferences_rpc_spec.rb`
- Modify: `dystopia/frontend/src/modules/notifications/types.ts`
- Modify: `dystopia/frontend/src/app/api/notifications/preferences/route.ts`
- Create: `dystopia/frontend/src/app/api/notifications/preferences/route.test.ts`
- Modify: `dystopia/frontend/src/modules/notifications/hooks/useNotificationPreferences.ts`
- Modify: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.tsx`

**Interfaces:**
- Produces: preference のキーは monolith で `push_enabled comment like reply follow mention message footprint_unread_badge footprints_record_my_visits`、frontend の `NotificationPreferences` は `pushEnabled comment like reply follow mention message footprintUnreadBadge footprintsRecordMyVisits`。`Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES` はこの 9 キー（全て `true`）

- [ ] **Step 1: Write the failing monolith spec**

`dystopia/monolith/spec/slices/notifications/grpc/preferences_rpc_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Notification preferences RPCs", type: :database do
  let(:profile_id) { create_account_with_profile(username: "prefs_owner") }

  def rpc(method, message)
    Notifications::Grpc::NotificationHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  before do
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  after { Current.clear }

  it "saves and returns the comment preference with the remaining fields" do
    input = Notifications::V1::NotificationPreferences.new(
      push_enabled: false, comment: false, like: true, reply: false, follow: true,
      mention: false, message: true, footprint_unread_badge: false, footprints_record_my_visits: true
    )

    saved = rpc(:update_notification_preferences, Notifications::V1::UpdateNotificationPreferencesRequest.new(preferences: input)).preferences
    fetched = rpc(:get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences

    expect(saved).to eq(input)
    expect(fetched).to eq(input)
  end

  it "returns every preference turned on for a profile that has saved none" do
    fetched = rpc(:get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences

    expect(fetched.to_h.values).to all(be(true))
    expect(fetched.to_h.keys).to contain_exactly(
      :push_enabled, :comment, :like, :reply, :follow, :mention, :message, :footprint_unread_badge, :footprints_record_my_visits
    )
  end
end
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/grpc/preferences_rpc_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`ArgumentError: Unknown field name 'comment'`）

- [ ] **Step 3: Change the proto message**

`proto/dystopia/notifications/v1/notification_service.proto` の `NotificationPreferences` を次に置き換える:

```proto
message NotificationPreferences {
  reserved 4, 5, 10;
  reserved "repost", "quote", "oshi";

  bool push_enabled = 1;
  bool comment = 2;
  bool like = 3;
  bool reply = 6;
  bool follow = 7;
  bool mention = 8;
  bool message = 9;
  bool footprint_unread_badge = 11;
  bool footprints_record_my_visits = 12;
}
```

- [ ] **Step 4: Regenerate the stubs and keep only the notifications package**

```bash
cd dystopia/monolith && bin/codegen
cd ../frontend && pnpm proto:gen
cd .. && git add monolith/stubs/notifications frontend/src/stub/notifications
git checkout -- monolith/stubs frontend/src/stub
git status --porcelain monolith/stubs frontend/src/stub
```

`git status` に `??` で出た未追跡の stub（billing など）は `rm -rf <そのパス>` で消す。`M` が notifications 以外に残っていないことを確かめる。

- [ ] **Step 5: Add the migration**

`dystopia/monolith/config/db/migrate/20261027000000_rework_notification_preferences.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:notifications__preferences) do
      drop_column :repost
      drop_column :quote
      drop_column :oshi
      rename_column :post, :comment
    end
  end

  down do
    alter_table(:notifications__preferences) do
      rename_column :comment, :post
      add_column :repost, :boolean, null: false, default: true
      add_column :quote, :boolean, null: false, default: true
      add_column :oshi, :boolean, null: false, default: true
    end
  end
end
```

- [ ] **Step 6: Update the relation, defaults, repository, handler and emit mapping**

`slices/notifications/relations/preferences.rb` の schema の属性を次にする（`created_at` / `updated_at` / `primary_key` はそのまま）:

```ruby
        attribute :profile_id, Types::String
        attribute :push_enabled, Types::Bool
        attribute :comment, Types::Bool
        attribute :like, Types::Bool
        attribute :reply, Types::Bool
        attribute :follow, Types::Bool
        attribute :mention, Types::Bool
        attribute :message, Types::Bool
        attribute :footprint_unread_badge, Types::Bool
        attribute :footprints_record_my_visits, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time
```

`slices/notifications/use_cases/get_preferences.rb` の `DEFAULT_PREFERENCES`:

```ruby
      DEFAULT_PREFERENCES = {
        push_enabled: true,
        comment: true,
        like: true,
        reply: true,
        follow: true,
        mention: true,
        message: true,
        footprint_unread_badge: true,
        footprints_record_my_visits: true
      }.freeze
```

`slices/notifications/repositories/notification_repository.rb` の `PREFERENCE_COLUMNS`:

```ruby
      PREFERENCE_COLUMNS = %i[
        push_enabled comment like reply follow mention message footprint_unread_badge footprints_record_my_visits
      ].freeze
```

`slices/notifications/grpc/notification_handler.rb` の `update_notification_preferences` の `attrs` と `preferences_to_proto`:

```ruby
        attrs = {
          push_enabled: input.push_enabled,
          comment: input.comment,
          like: input.like,
          reply: input.reply,
          follow: input.follow,
          mention: input.mention,
          message: input.message,
          footprint_unread_badge: input.footprint_unread_badge,
          footprints_record_my_visits: input.footprints_record_my_visits
        }
```

```ruby
      def preferences_to_proto(prefs)
        ::Notifications::V1::NotificationPreferences.new(
          push_enabled: prefs[:push_enabled],
          comment: prefs[:comment],
          like: prefs[:like],
          reply: prefs[:reply],
          follow: prefs[:follow],
          mention: prefs[:mention],
          message: prefs[:message],
          footprint_unread_badge: prefs[:footprint_unread_badge],
          footprints_record_my_visits: prefs[:footprints_record_my_visits]
        )
      end
```

`slices/notifications/use_cases/emit.rb` の `PREFERENCE_FIELD_BY_TYPE` で `"comment" => :post` を `"comment" => :comment` にする（Emit の設定による抑止は Task 4 で外す）。

- [ ] **Step 7: Migrate the test DB and run the monolith specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate; HANAMI_ENV=test bundle exec rspec spec/slices/notifications > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS（`preferences_rpc_spec.rb` と既存の `update_preferences_spec.rb` を含む）

- [ ] **Step 8: Write the failing frontend route test**

`dystopia/frontend/src/app/api/notifications/preferences/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET, PUT } = await import("./route");

const ALL_ON = {
  pushEnabled: true,
  comment: true,
  like: true,
  reply: true,
  follow: true,
  mention: true,
  message: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

function request(method: string, body?: unknown) {
  const req = new NextRequest("http://localhost/api/notifications/preferences", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/notifications/preferences", () => {
  beforeEach(() => {
    notifications.getNotificationPreferences.mockReset();
    notifications.updateNotificationPreferences.mockReset();
  });

  it("returns the comment preference and none of the removed fields", async () => {
    notifications.getNotificationPreferences.mockResolvedValue({ preferences: { ...ALL_ON, comment: false, message: false } });

    const res = await GET(request("GET"));

    expect(await res.json()).toEqual({ ...ALL_ON, comment: false, message: false });
  });

  it("returns every preference turned on when the monolith sends none", async () => {
    notifications.getNotificationPreferences.mockResolvedValue({});

    const res = await GET(request("GET"));

    expect(await res.json()).toEqual(ALL_ON);
  });

  it("fills the omitted fields with their defaults when saving", async () => {
    notifications.updateNotificationPreferences.mockImplementation(async ({ preferences }) => ({ preferences }));

    const res = await PUT(request("PUT", { comment: false }));

    expect(notifications.updateNotificationPreferences).toHaveBeenCalledWith(
      { preferences: { ...ALL_ON, comment: false } },
      expect.anything()
    );
    expect(await res.json()).toEqual({ ...ALL_ON, comment: false });
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/api/notifications/preferences/route.test.ts`
Expected: FAIL（`comment` が返らず、`repost` などが含まれる）

- [ ] **Step 10: Update the frontend types, route, hook and settings rows**

`src/modules/notifications/types.ts` の `NotificationPreferences`:

```ts
export interface NotificationPreferences {
  pushEnabled: boolean;
  comment: boolean;
  like: boolean;
  reply: boolean;
  follow: boolean;
  mention: boolean;
  message: boolean;
  footprintUnreadBadge: boolean;
  footprintsRecordMyVisits: boolean;
}
```

`src/app/api/notifications/preferences/route.ts` の `DEFAULT_PREFERENCES` と `toView` を次にする（`GET` / `PUT` は変えない）:

```ts
const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  comment: true,
  like: true,
  reply: true,
  follow: true,
  mention: true,
  message: true,
  footprintUnreadBadge: true,
  footprintsRecordMyVisits: true,
};

function toView(prefs: Partial<NotificationPreferences> | undefined): NotificationPreferences {
  if (!prefs) return { ...DEFAULT_PREFERENCES };
  return {
    pushEnabled: !!prefs.pushEnabled,
    comment: !!prefs.comment,
    like: !!prefs.like,
    reply: !!prefs.reply,
    follow: !!prefs.follow,
    mention: !!prefs.mention,
    message: !!prefs.message,
    footprintUnreadBadge: !!prefs.footprintUnreadBadge,
    footprintsRecordMyVisits: !!prefs.footprintsRecordMyVisits,
  };
}
```

`src/modules/notifications/hooks/useNotificationPreferences.ts` の `DEFAULT_PREFERENCES` を route と同じ 9 キー（全て `true`）にする。

`src/modules/notifications/components/NotificationSettings.tsx` の `PUSH_TYPE_ROWS`:

```ts
const PUSH_TYPE_ROWS: Row[] = [
  { field: "like", label: "いいね" },
  { field: "comment", label: "コメント" },
  { field: "reply", label: "リプライ" },
  { field: "mention", label: "メンション" },
  { field: "follow", label: "フォロー" },
  { field: "message", label: "メッセージ" },
];
```

- [ ] **Step 11: Run the frontend tests and the type check**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/api/notifications src/modules/notifications src/app/settings && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: vitest PASS、`tsc exit 0`

- [ ] **Step 12: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add proto/dystopia/notifications dystopia/monolith dystopia/frontend/src
git status --porcelain
git commit -s -m "refactor(dystopia): keep only notification preferences that take effect"
```

---

### Task 2: Stop notifying follow request approvals and name the follow notification

承認不要のフォローの通知を `follow` に改名し、申請の承認では通知を作らない。

**Files:**
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`
- Regenerate: notifications の stub（Task 1 Step 4 と同じ手順）
- Create: `dystopia/monolith/config/db/migrate/20261027000001_rename_follow_notification_type.rb`
- Modify: `dystopia/monolith/slices/social/use_cases/follows/follow.rb`
- Modify: `dystopia/monolith/slices/social/use_cases/follows/approve_follow_request.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/emit.rb`
- Modify: `dystopia/monolith/spec/slices/social/use_cases/follows/follow_spec.rb`
- Modify: `dystopia/monolith/spec/slices/social/use_cases/follows/approve_all_follow_requests_spec.rb`
- Modify: `dystopia/monolith/spec/slices/profile/use_cases/save_profile_spec.rb`
- Modify: `dystopia/monolith/spec/slices/messaging/rpc_wiring_spec.rb`
- Modify: `dystopia/frontend/src/modules/notifications/lib/format.ts`
- Modify: `dystopia/frontend/src/modules/notifications/lib/format.test.ts`

**Interfaces:**
- Consumes: Task 1 の stub 再生成手順
- Produces: 通知の種類の文字列 `"follow"`、proto の `NOTIFICATION_TYPE_FOLLOW = 5`（frontend では `NotificationType.FOLLOW`）。`follow_approved` はどこにも残らない

- [ ] **Step 1: Write the failing specs**

`spec/slices/social/use_cases/follows/follow_spec.rb` の `RSpec.describe` ブロックの末尾（最後の `end` の前）に足す:

```ruby
  describe "notifications" do
    let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
    let(:approve) { Social::Slice["use_cases.follows.approve_follow_request"] }

    def types_for(profile_id)
      notification_repo.list(recipient_profile_id: profile_id).map(&:type)
    end

    it "tells a profile without approval that someone followed it" do
      target = create_account_with_profile(role: 2, username: "open_target")

      follow.call(follower_profile_id: follower, target_profile_id: target)

      expect(types_for(target)).to eq(["follow"])
    end

    it "sends a request to a profile that approves followers, and nothing when it approves" do
      target = create_account_with_profile(role: 2, username: "gated_target", follow_approval_required: true)

      follow.call(follower_profile_id: follower, target_profile_id: target)
      approve.call(target_profile_id: target, requester_profile_id: follower)

      expect(types_for(target)).to eq(["follow_request"])
      expect(types_for(follower)).to be_empty
    end
  end
```

`spec/slices/social/use_cases/follows/approve_all_follow_requests_spec.rb` の最初の example を次にする:

```ruby
  it "approves every pending request to the target without notifying the requesters" do
    follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: target, status: "pending")
    follow_repo.follow(follower_profile_id: second_requester, followee_profile_id: target, status: "pending")
    follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: other_target, status: "pending")

    expect(approve_all.call(target_profile_id: target)).to eq(approved_count: 2)

    expect(follow_repo.status_batch(follower_profile_id: first_requester, followee_profile_ids: [target, other_target]))
      .to eq(target => "approved", other_target => "pending")
    expect(follow_repo.find(follower_profile_id: second_requester, followee_profile_id: target).status).to eq("approved")
    expect(db[:notifications__notifications].where(recipient_profile_id: [first_requester, second_requester]).count).to eq(0)
  end
```

`spec/slices/profile/use_cases/save_profile_spec.rb` の `approvals` の `where(type: "follow_approved")` を `where(type: "follow")` にする。

`spec/slices/messaging/rpc_wiring_spec.rb` の `emit.call(recipient_profile_id: guest, type: "follow_approved", ...)` の `"follow_approved"` を `"follow"` にする。

- [ ] **Step 2: Run them to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/social/use_cases/follows > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`follow_approved` が作られ、承認でも通知が作られる）

- [ ] **Step 3: Change the proto enum and regenerate**

`notification_service.proto` の `NOTIFICATION_TYPE_FOLLOW_APPROVED = 5;` を `NOTIFICATION_TYPE_FOLLOW = 5;` にする。その後 Task 1 Step 4 と同じ手順で stub を再生成し、notifications の stub だけを stage する。

- [ ] **Step 4: Add the migration**

`dystopia/monolith/config/db/migrate/20261027000001_rename_follow_notification_type.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "UPDATE notifications.notifications SET type = 'follow' WHERE type = 'follow_approved'"
  end

  down do
    run "UPDATE notifications.notifications SET type = 'follow_approved' WHERE type = 'follow'"
  end
end
```

- [ ] **Step 5: Change the follow use cases, the handler and the emit mapping**

`slices/social/use_cases/follows/follow.rb`:

```ruby
          notification_type = result[:status] == "approved" ? "follow" : "follow_request"
```

`slices/social/use_cases/follows/approve_follow_request.rb` を次にする:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(target_profile_id:, requester_profile_id:)
          follow_repo.update_status(
            follower_profile_id: requester_profile_id,
            followee_profile_id: target_profile_id,
            status: "approved"
          )

          {}
        end
      end
    end
  end
end
```


`slices/notifications/grpc/notification_handler.rb` の `type_to_enum`:

```ruby
        when "follow" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW
```

（`when "follow_approved"` の行をこれに置き換える。）

`slices/notifications/use_cases/emit.rb` の `PREFERENCE_FIELD_BY_TYPE` の `"follow_approved" => :follow` を `"follow" => :follow` にする。

- [ ] **Step 6: Migrate with a stored follow_approved row, then run the monolith specs**

```bash
cd dystopia/monolith
psql -d monolith_test -c "INSERT INTO notifications.notifications (id, recipient_profile_id, type, target_resource_id, latest_actor_profile_id) VALUES (gen_random_uuid(), gen_random_uuid(), 'follow_approved', gen_random_uuid(), gen_random_uuid())"
HANAMI_ENV=test bundle exec hanami db migrate
psql -d monolith_test -tAc "SELECT type FROM notifications.notifications WHERE type IN ('follow', 'follow_approved')"
psql -d monolith_test -c "DELETE FROM notifications.notifications WHERE type = 'follow'"
```

Expected: `SELECT` の出力が `follow` の 1 行だけ（migration が改名した）。

Run: `SCRATCH=/private/tmp/claude-501/-Users-takanokenichi-GitHub-panicboat-monorepo/baa50ca4-8335-4d70-835e-a9e9e2c6da0d/scratchpad; cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/social spec/slices/profile/use_cases/save_profile_spec.rb spec/slices/messaging/rpc_wiring_spec.rb spec/slices/notifications > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 7: Update the frontend wording and links**

`src/modules/notifications/lib/format.ts` の 2 か所の `case NotificationType.FOLLOW_APPROVED:` を `case NotificationType.FOLLOW:` にする。`format.test.ts` の 2 か所の `NotificationType.FOLLOW_APPROVED` を `NotificationType.FOLLOW` にする。

- [ ] **Step 8: Run the frontend tests and the type check**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: PASS、`tsc exit 0`。`grep -rn "FOLLOW_APPROVED\|follow_approved" dystopia --include=*.rb --include=*.ts --include=*.tsx --include=*.proto` が stub 以外で 0 件（migration ファイルの SQL は除く）

- [ ] **Step 9: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add proto/dystopia/notifications dystopia/monolith dystopia/frontend/src
git status --porcelain
git commit -s -m "fix(dystopia): stop notifying follow request approvals and name the follow notification"
```

---

### Task 3: Store web push subscriptions per account

購読の表・登録と解除・VAPID 公開鍵の RPC・送信 adapter・アカウント削除での後始末を作る。

**Files:**
- Modify: `dystopia/monolith/Gemfile`, `dystopia/monolith/Gemfile.lock`
- Modify: `dystopia/lambda/image/Dockerfile`
- Modify: `dystopia/monolith/config/settings.rb`
- Create: `dystopia/monolith/slices/notifications/adapters/web_push_sender.rb`
- Create: `dystopia/monolith/config/db/migrate/20261027000002_create_push_subscriptions.rb`
- Create: `dystopia/monolith/slices/notifications/relations/push_subscriptions.rb`
- Create: `dystopia/monolith/slices/notifications/repositories/push_subscription_repository.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/register_push_subscription.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/unregister_push_subscription.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/purge_account.rb`
- Modify: `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Create: `dystopia/monolith/spec/slices/notifications/adapters/web_push_sender_spec.rb`
- Create: `dystopia/monolith/spec/slices/notifications/grpc/push_subscription_rpc_spec.rb`
- Create: `dystopia/monolith/spec/slices/notifications/use_cases/purge_account_spec.rb`
- Modify: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb`

**Interfaces:**
- Produces:
  - `Notifications::Adapters::WebPushSender#enabled? -> Boolean`、`#public_key -> String | nil`（base64url、padding なし）、`#deliver(endpoint:, p256dh:, auth:, payload:, urgency:) -> :delivered | :gone | :failed`。container キー `"adapters.web_push_sender"`
  - `Notifications::Repositories::PushSubscriptionRepository`（キー `"repositories.push_subscription_repository"`）: `#upsert(account_id:, endpoint:, p256dh:, auth:)`、`#list_by_account(account_id) -> Array<struct(id, account_id, endpoint, p256dh, auth)>`、`#delete_by_endpoint(endpoint)`、`#delete_for_account(account_id:, endpoint:)`、`#delete_by_account(account_id)`
  - RPC `GetPushConfig` / `RegisterPushSubscription` / `UnregisterPushSubscription`（frontend の client では `getPushConfig` / `registerPushSubscription` / `unregisterPushSubscription`、応答のフィールドは `vapidPublicKey`）

- [ ] **Step 1: Add the gem and let the image build the openssl gem**

`dystopia/monolith/Gemfile` の `gem "aws-sdk-cognitoidentityprovider", "~> 1.154"` の次の行に足す:

```ruby
gem "web-push", "~> 3.1"
```

Run: `cd dystopia/monolith && bundle install && bundle install --frozen`
Expected: `Gemfile.lock` に `web-push (3.1.x)` と `jwt (3.x)` が入り、2 回目も成功する。

`dystopia/lambda/image/Dockerfile` の `monolith-builder` の apt 行を次にする（上に 1 行コメント）:

```dockerfile
# libssl-dev builds the openssl gem the lockfile pins, which differs from the one bundled with this Ruby.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential libpq-dev git libyaml-dev libssl-dev
```

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push && docker build --target monolith-builder -f dystopia/lambda/image/Dockerfile dystopia > "$SCRATCH/docker.log" 2>&1; echo "docker exit $?"; tail -15 "$SCRATCH/docker.log"`
Expected: `docker exit 0`

- [ ] **Step 2: Write the failing sender spec**

`dystopia/monolith/spec/slices/notifications/adapters/web_push_sender_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::Adapters::WebPushSender do
  let(:key) { OpenSSL::PKey::EC.generate("prime256v1") }
  let(:sender) { described_class.new(private_key_pem: key.to_pem, subject: "https://dystopia.city") }
  let(:response) { double(:response, body: "") }

  def deliver
    sender.deliver(endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth", payload: "{}", urgency: "high")
  end

  it "is disabled without a key or a subject" do
    expect(described_class.new(private_key_pem: nil, subject: "https://dystopia.city").enabled?).to be false
    expect(described_class.new(private_key_pem: "  ", subject: "https://dystopia.city").enabled?).to be false
    expect(described_class.new(private_key_pem: key.to_pem, subject: nil).enabled?).to be false
    expect(described_class.new(private_key_pem: nil, subject: nil).public_key).to be_nil
    expect(sender.enabled?).to be true
  end

  it "derives the public key browsers subscribe with from the private key" do
    expect(sender.public_key).to eq(Base64.urlsafe_encode64(key.public_key.to_bn.to_s(2)).delete("="))
  end

  it "sends the payload with a day-long TTL, the urgency and three-second timeouts" do
    allow(WebPush).to receive(:payload_send)

    expect(deliver).to eq(:delivered)
    expect(WebPush).to have_received(:payload_send).with(
      message: "{}", endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth",
      vapid: { subject: "https://dystopia.city", pem: key.to_pem },
      ttl: 86_400, urgency: "high", open_timeout: 3, read_timeout: 3, ssl_timeout: 3
    )
  end

  it "reports a subscription the push service no longer knows as gone" do
    [WebPush::ExpiredSubscription, WebPush::InvalidSubscription].each do |error|
      allow(WebPush).to receive(:payload_send).and_raise(error.new(response, "fcm.googleapis.com"))
      expect(deliver).to eq(:gone)
    end
  end

  it "reports other failures without raising" do
    [WebPush::PushServiceError.new(response, "fcm.googleapis.com"), Net::OpenTimeout.new, Errno::ECONNREFUSED.new].each do |error|
      allow(WebPush).to receive(:payload_send).and_raise(error)
      expect(deliver).to eq(:failed)
    end
  end
end
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/adapters/web_push_sender_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`uninitialized constant Notifications::Adapters`）

- [ ] **Step 4: Add the settings and the sender**

`dystopia/monolith/config/settings.rb` の最後の `setting` の後に足す:

```ruby
    setting :vapid_private_key, default: nil, constructor: Types::String.optional
    setting :vapid_subject, default: nil, constructor: Types::String.optional
```

`dystopia/monolith/slices/notifications/adapters/web_push_sender.rb`:

```ruby
# frozen_string_literal: true

require "web_push"

module Notifications
  module Adapters
    class WebPushSender
      TTL_SECONDS = 86_400
      TIMEOUT_SECONDS = 3

      def initialize(private_key_pem: Hanami.app["settings"].vapid_private_key, subject: Hanami.app["settings"].vapid_subject)
        @private_key_pem = private_key_pem.to_s.strip.empty? ? nil : private_key_pem
        @subject = subject.to_s.strip.empty? ? nil : subject
      end

      def enabled?
        !@private_key_pem.nil? && !@subject.nil?
      end

      def public_key
        return nil unless enabled?

        @public_key ||= WebPush::VapidKey.from_pem(@private_key_pem).public_key_for_push_header
      end

      def deliver(endpoint:, p256dh:, auth:, payload:, urgency:)
        WebPush.payload_send(
          message: payload,
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
          vapid: { subject: @subject, pem: @private_key_pem },
          ttl: TTL_SECONDS,
          urgency: urgency,
          open_timeout: TIMEOUT_SECONDS,
          read_timeout: TIMEOUT_SECONDS,
          ssl_timeout: TIMEOUT_SECONDS
        )
        :delivered
      rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
        :gone
      rescue StandardError => e
        Hanami.logger.warn("Notifications::WebPushSender failed: #{e.class}: #{e.message}")
        # SILENT: An unreachable device must not fail the action that triggered the push.
        :failed
      end
    end
  end
end
```

- [ ] **Step 5: Run the sender spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/adapters/web_push_sender_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 6: Write the failing RPC and purge specs**

`dystopia/monolith/spec/slices/notifications/grpc/push_subscription_rpc_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Push subscription RPCs", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:account_id) { create_account }
  let(:other_account_id) { create_account }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  def rpc(method, message, **deps)
    Notifications::Grpc::NotificationHandler.new(
      method_key: method, service: double, rpc_desc: double, active_call: double, message: message, **deps
    ).public_send(method)
  end

  def act_as_account(id)
    Current.account_id = id
    Current.profile_id = nil
  end

  def register(endpoint: self.endpoint, p256dh: "BNcRdreALRFX", auth: "tBHItJI5svbpez7KI4CCXg")
    rpc(:register_push_subscription, Notifications::V1::RegisterPushSubscriptionRequest.new(endpoint: endpoint, p256dh: p256dh, auth: auth))
  end

  def unregister(endpoint: self.endpoint)
    rpc(:unregister_push_subscription, Notifications::V1::UnregisterPushSubscriptionRequest.new(endpoint: endpoint))
  end

  def rows
    db[:notifications__push_subscriptions].select_map(%i[account_id endpoint p256dh auth])
  end

  def invalid_argument
    raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }
  end

  after { Current.clear }

  it "returns the VAPID public key, or an empty one when push is not configured" do
    act_as_account(account_id)
    request = Notifications::V1::GetPushConfigRequest.new

    expect(rpc(:get_push_config, request, web_push_sender: double(:sender, public_key: "BPublicKey")).vapid_public_key).to eq("BPublicKey")
    expect(rpc(:get_push_config, request, web_push_sender: double(:sender, public_key: nil)).vapid_public_key).to eq("")
  end

  it "registers a subscription for the account without an active profile" do
    act_as_account(account_id)

    register

    expect(rows).to eq([[account_id, endpoint, "BNcRdreALRFX", "tBHItJI5svbpez7KI4CCXg"]])
  end

  it "keeps one row per endpoint, owned by the account that registered it last with the latest keys" do
    act_as_account(account_id)
    register
    register(p256dh: "BRotated", auth: "rotatedAuth")
    act_as_account(other_account_id)
    register(p256dh: "BOther", auth: "otherAuth")

    expect(rows).to eq([[other_account_id, endpoint, "BOther", "otherAuth"]])
  end

  it "accepts each known push service" do
    act_as_account(account_id)
    %w[
      https://fcm.googleapis.com/fcm/send/a
      https://web.push.apple.com/b
      https://api.push.apple.com/c
      https://updates.push.services.mozilla.com/wpush/v2/d
      https://wns2-par02p.notify.windows.com/w/?token=e
    ].each { |url| register(endpoint: url) }

    expect(rows.length).to eq(5)
  end

  it "rejects endpoints outside the known push services and malformed keys" do
    act_as_account(account_id)
    [
      "http://fcm.googleapis.com/fcm/send/a",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/a",
      "https://169.254.169.254/latest",
      "https://fcm.googleapis.com:8443/a",
      "https://user@fcm.googleapis.com/a",
      "https://fcm.googleapis.com/#{'a' * 2048}",
      "not a url"
    ].each { |url| expect { register(endpoint: url) }.to invalid_argument }
    expect { register(p256dh: "") }.to invalid_argument
    expect { register(auth: "bad key!") }.to invalid_argument

    expect(rows).to be_empty
  end

  it "unregisters only the caller's own subscription" do
    act_as_account(account_id)
    register

    act_as_account(other_account_id)
    unregister
    expect(rows.length).to eq(1)

    act_as_account(account_id)
    unregister
    expect(rows).to be_empty
  end

  it "requires a signed-in account" do
    Current.clear

    expect { register }.to raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
  end
end
```

`dystopia/monolith/spec/slices/notifications/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::PurgeAccount, type: :database do
  let(:purge) { Notifications::Slice["use_cases.purge_account"] }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:bystander_id) { create_account }

  it "deletes every subscription of the account and keeps the others" do
    subscriptions.upsert(account_id: account_id, endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth")
    subscriptions.upsert(account_id: account_id, endpoint: "https://web.push.apple.com/b", p256dh: "BKey", auth: "auth")
    subscriptions.upsert(account_id: bystander_id, endpoint: "https://fcm.googleapis.com/fcm/send/c", p256dh: "BKey", auth: "auth")

    purge.call(account_id: account_id)

    expect(subscriptions.list_by_account(account_id)).to be_empty
    expect(subscriptions.list_by_account(bystander_id).map(&:endpoint)).to eq(["https://fcm.googleapis.com/fcm/send/c"])
  end
end
```

`spec/slices/identity/use_cases/account/purge_identity_spec.rb` を次のように変える:

```ruby
  let(:use_case) do
    described_class.new(account_repo: account_repo, purge_profiles: purge_profiles, purge_push_subscriptions: purge_push_subscriptions)
  end
  let(:purge_push_subscriptions) { double(:purge_push_subscriptions) }
```

`before` に `allow(purge_push_subscriptions).to receive(:call)` を足し、最初の example を次にする:

```ruby
  it "purges the account's profiles and push subscriptions, then the Cognito user, then the account" do
    expect(purge_profiles).to receive(:call).with(account_id: sub).ordered
    expect(purge_push_subscriptions).to receive(:call).with(account_id: sub).ordered
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    expect(use_case.call(sub: sub)).to be_nil
  end
```

- [ ] **Step 7: Run them to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/grpc/push_subscription_rpc_spec.rb spec/slices/notifications/use_cases/purge_account_spec.rb spec/slices/identity/use_cases/account/purge_identity_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（RPC・表・use case が無い）

- [ ] **Step 8: Add the RPCs to the proto and regenerate**

`notification_service.proto` の `service NotificationService` に足す:

```proto
  rpc GetPushConfig(GetPushConfigRequest) returns (GetPushConfigResponse);
  rpc RegisterPushSubscription(RegisterPushSubscriptionRequest) returns (RegisterPushSubscriptionResponse);
  rpc UnregisterPushSubscription(UnregisterPushSubscriptionRequest) returns (UnregisterPushSubscriptionResponse);
```

ファイル末尾に足す:

```proto
message GetPushConfigRequest {}

message GetPushConfigResponse {
  string vapid_public_key = 1;
}

message RegisterPushSubscriptionRequest {
  string endpoint = 1;
  string p256dh = 2;
  string auth = 3;
}

message RegisterPushSubscriptionResponse {}

message UnregisterPushSubscriptionRequest {
  string endpoint = 1;
}

message UnregisterPushSubscriptionResponse {}
```

Task 1 Step 4 と同じ手順で stub を再生成する。

- [ ] **Step 9: Add the table, relation and repository**

`dystopia/monolith/config/db/migrate/20261027000002_create_push_subscriptions.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"notifications__push_subscriptions" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :endpoint, :text, null: false
      column :p256dh, :text, null: false
      column :auth, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:endpoint], name: :uq_notifications_push_subscriptions_endpoint
    end

    run "CREATE INDEX idx_notifications_push_subscriptions_account ON notifications.push_subscriptions (account_id)"
  end

  down do
    drop_table :"notifications__push_subscriptions"
  end
end
```

`dystopia/monolith/slices/notifications/relations/push_subscriptions.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module Relations
    class PushSubscriptions < Notifications::DB::Relation
      schema(:"notifications__push_subscriptions", as: :push_subscription_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :endpoint, Types::String
        attribute :p256dh, Types::String
        attribute :auth, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

`dystopia/monolith/slices/notifications/repositories/push_subscription_repository.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module Repositories
    class PushSubscriptionRepository < Notifications::DB::Repo
      def upsert(account_id:, endpoint:, p256dh:, auth:)
        now = Time.now
        sql = <<~SQL
          INSERT INTO notifications.push_subscriptions
            (id, account_id, endpoint, p256dh, auth, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (endpoint) DO UPDATE SET
            account_id = EXCLUDED.account_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        push_subscription_records.dataset.db.fetch(sql, SecureRandom.uuid_v7, account_id, endpoint, p256dh, auth, now, now).first
      end

      def list_by_account(account_id)
        push_subscription_records.where(account_id: account_id).order { [created_at.asc, id.asc] }.to_a
      end

      def delete_by_endpoint(endpoint)
        push_subscription_records.dataset.where(endpoint: endpoint).delete
      end

      def delete_for_account(account_id:, endpoint:)
        push_subscription_records.dataset.where(account_id: account_id, endpoint: endpoint).delete
      end

      def delete_by_account(account_id)
        push_subscription_records.dataset.where(account_id: account_id).delete
      end
    end
  end
end
```

- [ ] **Step 10: Add the use cases and the purge wiring**

`dystopia/monolith/slices/notifications/use_cases/register_push_subscription.rb`:

```ruby
# frozen_string_literal: true

require "uri"

module Notifications
  module UseCases
    class RegisterPushSubscription
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      InvalidSubscriptionError = Class.new(StandardError)

      # The server POSTs to the endpoint, so only known push services are accepted to keep requests away from internal hosts.
      ALLOWED_HOSTS = %w[fcm.googleapis.com web.push.apple.com updates.push.services.mozilla.com].freeze
      ALLOWED_HOST_SUFFIXES = %w[.push.apple.com .push.services.mozilla.com .notify.windows.com].freeze
      MAX_ENDPOINT_LENGTH = 2048
      KEY_FORMAT = /\A[A-Za-z0-9_-]{1,256}={0,2}\z/

      def call(account_id:, endpoint:, p256dh:, auth:)
        raise InvalidSubscriptionError, "endpoint is not a known push service" unless allowed_endpoint?(endpoint.to_s)
        raise InvalidSubscriptionError, "subscription keys are malformed" unless KEY_FORMAT.match?(p256dh.to_s) && KEY_FORMAT.match?(auth.to_s)

        push_subscription_repo.upsert(account_id: account_id, endpoint: endpoint, p256dh: p256dh, auth: auth)
        nil
      end

      private

      def allowed_endpoint?(endpoint)
        return false if endpoint.length > MAX_ENDPOINT_LENGTH

        uri = URI.parse(endpoint)
        host = uri.host.to_s.downcase
        uri.is_a?(URI::HTTPS) && uri.port == 443 && uri.userinfo.nil? &&
          (ALLOWED_HOSTS.include?(host) || ALLOWED_HOST_SUFFIXES.any? { |suffix| host.end_with?(suffix) })
      rescue URI::InvalidURIError
        false
      end
    end
  end
end
```

`dystopia/monolith/slices/notifications/use_cases/unregister_push_subscription.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class UnregisterPushSubscription
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(account_id:, endpoint:)
        push_subscription_repo.delete_for_account(account_id: account_id, endpoint: endpoint.to_s)
        nil
      end
    end
  end
end
```

`dystopia/monolith/slices/notifications/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeAccount
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(account_id:)
        push_subscription_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

`dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb` を次にする:

```ruby
# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(purge_profiles: nil, purge_push_subscriptions: nil, **kwargs)
          super(**kwargs)
          @purge_profiles = purge_profiles
          @purge_push_subscriptions = purge_push_subscriptions
        end

        # Raises on the first failure so the account stays deactivated and the next run repeats the purge.
        def call(sub:)
          purge_profiles.call(account_id: sub)
          purge_push_subscriptions.call(account_id: sub)
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def purge_profiles
          @purge_profiles ||= ::Profile::Slice["use_cases.purge_account"]
        end

        def purge_push_subscriptions
          @purge_push_subscriptions ||= ::Notifications::Slice["use_cases.purge_account"]
        end
      end
    end
  end
end
```

- [ ] **Step 11: Add the handler methods**

`slices/notifications/grpc/notification_handler.rb` の `rpc` 宣言の最後に足す:

```ruby
      rpc :GetPushConfig, ::Notifications::V1::GetPushConfigRequest, ::Notifications::V1::GetPushConfigResponse
      rpc :RegisterPushSubscription, ::Notifications::V1::RegisterPushSubscriptionRequest, ::Notifications::V1::RegisterPushSubscriptionResponse
      rpc :UnregisterPushSubscription, ::Notifications::V1::UnregisterPushSubscriptionRequest, ::Notifications::V1::UnregisterPushSubscriptionResponse
```

`include Notifications::Deps[...]` の最後に足す:

```ruby
        register_push_subscription_uc: "use_cases.register_push_subscription",
        unregister_push_subscription_uc: "use_cases.unregister_push_subscription",
        web_push_sender: "adapters.web_push_sender"
```

`update_notification_preferences` の後（`private` の前）に足す:

```ruby
      def get_push_config
        authenticate_account!
        ::Notifications::V1::GetPushConfigResponse.new(vapid_public_key: web_push_sender.public_key.to_s)
      end

      def register_push_subscription
        authenticate_account!
        message = request.message
        register_push_subscription_uc.call(account_id: current_account_id, endpoint: message.endpoint, p256dh: message.p256dh, auth: message.auth)
        ::Notifications::V1::RegisterPushSubscriptionResponse.new
      rescue ::Notifications::UseCases::RegisterPushSubscription::InvalidSubscriptionError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "この端末の通知を登録できませんでした")
      end

      def unregister_push_subscription
        authenticate_account!
        unregister_push_subscription_uc.call(account_id: current_account_id, endpoint: request.message.endpoint)
        ::Notifications::V1::UnregisterPushSubscriptionResponse.new
      end
```

- [ ] **Step 12: Add a purge wiring assertion**

`spec/slices/identity/use_cases/account/purge_wiring_spec.rb` の example 内で、purge を実行する直前に購読を作り、実行後の確認に足す:

```ruby
    push_subscriptions = Notifications::Slice["repositories.push_subscription_repository"]
    push_subscriptions.upsert(account_id: account_id, endpoint: "https://fcm.googleapis.com/fcm/send/purged", p256dh: "BKey", auth: "auth")
    push_subscriptions.upsert(account_id: bystander_account_id, endpoint: "https://fcm.googleapis.com/fcm/send/kept", p256dh: "BKey", auth: "auth")
```

```ruby
    expect(db[:notifications__push_subscriptions].select_map(:endpoint)).to eq(["https://fcm.googleapis.com/fcm/send/kept"])
```

（作る位置は、example がアカウントを削除する use case を呼ぶ行の直前。確認は既存の `expect` 群の最後。）

- [ ] **Step 13: Migrate and run the specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate; HANAMI_ENV=test bundle exec rspec spec/slices/notifications spec/slices/identity > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 14: Type-check the frontend against the regenerated stub**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: `tsc exit 0`

- [ ] **Step 15: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add proto/dystopia/notifications dystopia/monolith dystopia/frontend/src/stub/notifications dystopia/lambda/image/Dockerfile
git status --porcelain
git commit -s -m "feat(dystopia): store web push subscriptions per account"
```

---

### Task 4: Send web push for notifications and direct messages

宛先・設定の判定、本文と開く URL の作成、並列送信と無効な購読の削除を作り、`Emit` と `SendMessage` から呼ぶ。

**Files:**
- Create: `dystopia/monolith/slices/notifications/adapters/profile_adapter.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/build_push_message.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/send_push.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/emit.rb`
- Modify: `dystopia/monolith/slices/messaging/use_cases/send_message.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/comments/add_comment.rb`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`
- Create: `dystopia/monolith/spec/slices/notifications/use_cases/build_push_message_spec.rb`
- Create: `dystopia/monolith/spec/slices/notifications/use_cases/send_push_spec.rb`
- Modify: `dystopia/monolith/spec/slices/notifications/use_cases/emit_spec.rb`
- Modify: `dystopia/monolith/spec/slices/messaging/use_cases/send_message_spec.rb`
- Modify: `dystopia/monolith/spec/slices/post/use_cases/comments/add_comment_spec.rb`
- Modify: `dystopia/monolith/spec/slices/post/grpc/post_handler_spec.rb`

**Interfaces:**
- Consumes: Task 3 の `WebPushSender`（`enabled?` / `deliver`）と `PushSubscriptionRepository`（`list_by_account` / `delete_by_endpoint` / `upsert`）、Task 1 の preference キー
- Produces:
  - `Notifications::Adapters::ProfileAdapter::PushProfile = Data.define(:id, :account_id, :username, :display_name)`、`ProfileAdapter#find(profile_id) -> PushProfile | nil`（表示中のプロフィールだけ）、`#visible_count(account_id) -> Integer`
  - `Notifications::UseCases::BuildPushMessage#call(kind:, actor:, recipient:, shared_device:, post_id: nil, thread_id: nil, excerpt: nil) -> { title:, body:, url: }`
  - `Notifications::UseCases::SendPush#call(recipient_profile_id:, kind:, actor_profile_id:, post_id: nil, thread_id: nil, excerpt: nil) -> nil`。`kind` は `like comment reply mention follow_request follow message`。例外を外に出さない
  - `Notifications::UseCases::Emit#call(..., excerpt: nil)`

- [ ] **Step 1: Write the failing message spec**

`dystopia/monolith/spec/slices/notifications/use_cases/build_push_message_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::BuildPushMessage do
  let(:build) { described_class.new }
  let(:push_profile) { Notifications::Adapters::ProfileAdapter::PushProfile }
  let(:actor) { push_profile.new(id: "actor-1", account_id: "account-a", username: "rin", display_name: "りん") }
  let(:recipient) { push_profile.new(id: "recipient-1", account_id: "account-b", username: "yuna", display_name: "ゆな") }

  def message(kind, shared_device: false, actor: self.actor, recipient: self.recipient, **rest)
    build.call(kind: kind, actor: actor, recipient: recipient, shared_device: shared_device, **rest)
  end

  def destination(result)
    uri = URI(result[:url])
    [uri.path, URI.decode_www_form(uri.query).to_h]
  end

  it "describes each kind with the in-app wording" do
    {
      "like" => "あなたの投稿にいいねしました",
      "comment" => "あなたの投稿にコメントしました",
      "reply" => "あなたのコメントに返信しました",
      "mention" => "あなたをメンションしました",
      "follow_request" => "フォロー申請が届きました",
      "follow" => "あなたをフォローしました"
    }.each do |kind, body|
      expect(message(kind, post_id: "post-1")).to include(title: "りん", body: body)
    end
  end

  it "adds the text after the action for comments, replies and mentions" do
    expect(message("comment", post_id: "post-1", excerpt: "かわいい")[:body]).to eq("あなたの投稿にコメントしました：かわいい")
    expect(message("reply", post_id: "post-1", excerpt: "ありがとう")[:body]).to eq("あなたのコメントに返信しました：ありがとう")
    expect(message("mention", post_id: "post-1", excerpt: "@yuna またね")[:body]).to eq("あなたをメンションしました：@yuna またね")
  end

  it "shows only the text of a direct message" do
    expect(message("message", thread_id: "thread-1", excerpt: "明日空いてますか？")[:body]).to eq("明日空いてますか？")
  end

  it "cuts the text at 100 characters with an ellipsis" do
    expect(message("message", thread_id: "thread-1", excerpt: "あ" * 100)[:body]).to eq("あ" * 100)
    expect(message("message", thread_id: "thread-1", excerpt: "あ" * 101)[:body]).to eq("#{'あ' * 100}…")
  end

  it "puts multi-line text on one line and drops text that is only whitespace" do
    expect(message("comment", post_id: "post-1", excerpt: "一行目\n\n  二行目 ")[:body]).to eq("あなたの投稿にコメントしました：一行目 二行目")
    expect(message("comment", post_id: "post-1", excerpt: " \n ")[:body]).to eq("あなたの投稿にコメントしました")
  end

  it "names the receiving profile when the device holds more than one" do
    expect(message("like", post_id: "post-1", shared_device: true)[:title]).to eq("りん → ゆな")
  end

  it "opens the target through the handoff page as the receiving profile" do
    expect(destination(message("like", post_id: "post-1"))).to eq(["/notifications/open", { "profile" => "recipient-1", "to" => "/posts/post-1" }])
    expect(destination(message("mention", post_id: "post-2"))[1]["to"]).to eq("/posts/post-2")
    expect(destination(message("follow_request"))[1]["to"]).to eq("/u/yuna/requests")
    expect(destination(message("follow"))[1]["to"]).to eq("/u/rin")
    expect(destination(message("message", thread_id: "thread-1", excerpt: "hi"))[1]["to"]).to eq("/messages/thread-1")
  end

  it "opens the notification list when the target cannot be addressed" do
    nameless = push_profile.new(id: "recipient-1", account_id: "account-b", username: nil, display_name: "ゆな")

    expect(destination(message("follow_request", recipient: nameless))[1]["to"]).to eq("/notifications")
    expect(destination(message("like"))[1]["to"]).to eq("/notifications")
  end
end
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/build_push_message_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`uninitialized constant Notifications::Adapters::ProfileAdapter`）

- [ ] **Step 3: Add the profile adapter and the message builder**

`dystopia/monolith/slices/notifications/adapters/profile_adapter.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module Adapters
    class ProfileAdapter
      PushProfile = Data.define(:id, :account_id, :username, :display_name)

      def find(profile_id)
        profile = profile_repo.find_visible_by_id(profile_id.to_s)
        return nil unless profile

        PushProfile.new(id: profile.id, account_id: profile.account_id, username: profile.username, display_name: profile.display_name)
      end

      def visible_count(account_id)
        profile_repo.visible_ids_by_account(account_id).length
      end

      private

      def profile_repo
        @profile_repo ||= ::Profile::Slice["repositories.profile_repository"]
      end
    end
  end
end
```

`dystopia/monolith/slices/notifications/use_cases/build_push_message.rb`:

```ruby
# frozen_string_literal: true

require "erb"
require "uri"

module Notifications
  module UseCases
    class BuildPushMessage
      ACTIONS = {
        "like" => "あなたの投稿にいいねしました",
        "comment" => "あなたの投稿にコメントしました",
        "reply" => "あなたのコメントに返信しました",
        "mention" => "あなたをメンションしました",
        "follow_request" => "フォロー申請が届きました",
        "follow" => "あなたをフォローしました"
      }.freeze
      POST_KINDS = %w[like comment reply mention].freeze
      EXCERPT_LIMIT = 100
      # FALLBACK: Open the notification list when the target cannot be addressed.
      FALLBACK_PATH = "/notifications"

      def call(kind:, actor:, recipient:, shared_device:, post_id: nil, thread_id: nil, excerpt: nil)
        {
          title: shared_device ? "#{actor.display_name} → #{recipient.display_name}" : actor.display_name,
          body: body(kind, excerpt),
          url: "/notifications/open?#{URI.encode_www_form(profile: recipient.id, to: path(kind, actor, recipient, post_id, thread_id))}"
        }
      end

      private

      def body(kind, excerpt)
        text = shorten(excerpt)
        return text if kind == "message"

        action = ACTIONS.fetch(kind)
        text.empty? ? action : "#{action}：#{text}"
      end

      def shorten(excerpt)
        text = excerpt.to_s.gsub(/\s+/, " ").strip
        text.length > EXCERPT_LIMIT ? "#{text[0, EXCERPT_LIMIT]}…" : text
      end

      def path(kind, actor, recipient, post_id, thread_id)
        target =
          if POST_KINDS.include?(kind) then post_id && "/posts/#{segment(post_id)}"
          elsif kind == "follow_request" then recipient.username && "/u/#{segment(recipient.username)}/requests"
          elsif kind == "follow" then actor.username && "/u/#{segment(actor.username)}"
          elsif kind == "message" then thread_id && "/messages/#{segment(thread_id)}"
          end
        target || FALLBACK_PATH
      end

      def segment(value)
        ERB::Util.url_encode(value.to_s)
      end
    end
  end
end
```

- [ ] **Step 4: Run the message spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/build_push_message_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 5: Write the failing send spec**

`dystopia/monolith/spec/slices/notifications/use_cases/send_push_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::SendPush, type: :database do
  let(:fake_sender_class) do
    Class.new do
      attr_accessor :enabled, :outcomes
      attr_reader :deliveries

      def initialize
        @enabled = true
        @outcomes = {}
        @deliveries = Queue.new
      end

      def enabled?
        @enabled
      end

      def deliver(endpoint:, p256dh:, auth:, payload:, urgency:)
        @deliveries << { endpoint: endpoint, payload: JSON.parse(payload), urgency: urgency }
        outcome = @outcomes.fetch(endpoint, :delivered)
        raise outcome if outcome.is_a?(Exception)

        outcome
      end

      def sent
        list = []
        list << @deliveries.pop until @deliveries.empty?
        list
      end
    end
  end

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:sender) { fake_sender_class.new }
  let(:use_case) { described_class.new(web_push_sender: sender) }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:recipient) { create_account_with_profile(display_name: "ゆな", username: "yuna") }
  let(:actor) { create_account_with_profile(display_name: "りん", username: "rin") }
  let(:post_id) { SecureRandom.uuid_v7 }

  def account_of(profile_id)
    db[:profile__profiles].where(id: profile_id).get(:account_id)
  end

  def endpoint(device)
    "https://fcm.googleapis.com/fcm/send/#{device}"
  end

  def subscribe(profile_id, device)
    subscriptions.upsert(account_id: account_of(profile_id), endpoint: endpoint(device), p256dh: "BKey", auth: "auth")
  end

  def push(kind: "like", **rest)
    use_case.call(recipient_profile_id: recipient, kind: kind, actor_profile_id: actor, post_id: post_id, **rest)
  end

  it "sends to every device of the recipient's account and to no one else" do
    subscribe(recipient, "phone")
    subscribe(recipient, "laptop")
    subscribe(actor, "actor-phone")

    push

    sent = sender.sent
    expect(sent.map { |d| d[:endpoint] }).to contain_exactly(endpoint("phone"), endpoint("laptop"))
    expect(sent.first[:payload]).to eq(
      "title" => "りん",
      "body" => "あなたの投稿にいいねしました",
      "url" => "/notifications/open?profile=#{recipient}&to=%2Fposts%2F#{post_id}"
    )
    expect(sent.map { |d| d[:urgency] }).to all(eq("normal"))
  end

  it "sends a direct message urgently with its text and thread" do
    subscribe(recipient, "phone")

    use_case.call(recipient_profile_id: recipient, kind: "message", actor_profile_id: actor, thread_id: "thread-1", excerpt: "明日空いてますか？")

    expect(sender.sent).to contain_exactly(
      hash_including(urgency: "high", payload: hash_including("body" => "明日空いてますか？", "url" => "/notifications/open?profile=#{recipient}&to=%2Fmessages%2Fthread-1"))
    )
  end

  it "names the receiving profile when the account shows more than one, ignoring a disabled one" do
    subscribe(recipient, "phone")
    disabled_sibling = create_account_with_profile(account_id: account_of(recipient), display_name: "停止中")
    db[:profile__profiles].where(id: disabled_sibling).update(disabled_at: Time.now)

    push
    expect(sender.sent.map { |d| d[:payload]["title"] }).to eq(["りん"])

    create_account_with_profile(account_id: account_of(recipient), display_name: "別名")
    push
    expect(sender.sent.map { |d| d[:payload]["title"] }).to eq(["りん → ゆな"])
  end

  it "sends nothing when the profile turned device notifications off" do
    subscribe(recipient, "phone")
    update_preferences.call(profile_id: recipient, preferences: defaults.merge(push_enabled: false))

    push

    expect(sender.sent).to be_empty
  end

  it "sends nothing for a kind the profile turned off, using the follow setting for both follow kinds" do
    subscribe(recipient, "phone")
    update_preferences.call(profile_id: recipient, preferences: defaults.merge(like: false, follow: false))

    push(kind: "like")
    push(kind: "follow_request")
    push(kind: "follow")
    push(kind: "comment", excerpt: "かわいい")

    expect(sender.sent.map { |d| d[:payload]["body"] }).to eq(["あなたの投稿にコメントしました：かわいい"])
  end

  it "sends nothing when push is not configured" do
    subscribe(recipient, "phone")
    sender.enabled = false

    push

    expect(sender.sent).to be_empty
  end

  it "sends nothing for a hidden recipient or from a hidden actor" do
    subscribe(recipient, "phone")
    db[:identity__accounts].where(id: account_of(actor)).update(deactivated_at: Time.now)
    push
    expect(sender.sent).to be_empty

    db[:identity__accounts].where(id: account_of(actor)).update(deactivated_at: nil)
    db[:profile__profiles].where(id: recipient).update(disabled_at: Time.now)
    push
    expect(sender.sent).to be_empty
  end

  it "drops the subscriptions the push service reports gone and keeps the rest" do
    subscribe(recipient, "phone")
    subscribe(recipient, "laptop")
    sender.outcomes = { endpoint("phone") => :gone, endpoint("laptop") => :failed }

    push

    expect(subscriptions.list_by_account(account_of(recipient)).map(&:endpoint)).to eq([endpoint("laptop")])
  end

  it "raises nothing when a device fails unexpectedly" do
    subscribe(recipient, "phone")
    sender.outcomes = { endpoint("phone") => RuntimeError.new("boom") }

    expect(push).to be_nil
  end
end
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/send_push_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`uninitialized constant Notifications::UseCases::SendPush`）

- [ ] **Step 7: Add the send use case**

`dystopia/monolith/slices/notifications/use_cases/send_push.rb`:

```ruby
# frozen_string_literal: true

require "json"

module Notifications
  module UseCases
    class SendPush
      include Notifications::Deps[
        push_subscription_repo: "repositories.push_subscription_repository",
        get_preferences: "use_cases.get_preferences",
        build_push_message: "use_cases.build_push_message",
        profile_adapter: "adapters.profile_adapter",
        web_push_sender: "adapters.web_push_sender"
      ]

      PREFERENCE_FIELD_BY_KIND = {
        "like" => :like,
        "comment" => :comment,
        "reply" => :reply,
        "mention" => :mention,
        "follow_request" => :follow,
        "follow" => :follow,
        "message" => :message
      }.freeze

      def call(recipient_profile_id:, kind:, actor_profile_id:, post_id: nil, thread_id: nil, excerpt: nil)
        # FALLBACK: An environment without a VAPID key sends nothing.
        return nil unless web_push_sender.enabled?

        preferences = get_preferences.call(profile_id: recipient_profile_id)
        return nil unless preferences[:push_enabled] && preferences[PREFERENCE_FIELD_BY_KIND.fetch(kind)]

        recipient = profile_adapter.find(recipient_profile_id)
        actor = profile_adapter.find(actor_profile_id)
        return nil unless recipient && actor

        subscriptions = push_subscription_repo.list_by_account(recipient.account_id)
        return nil if subscriptions.empty?

        payload = JSON.generate(
          build_push_message.call(
            kind: kind, actor: actor, recipient: recipient,
            shared_device: profile_adapter.visible_count(recipient.account_id) > 1,
            post_id: post_id, thread_id: thread_id, excerpt: excerpt
          )
        )
        deliver_all(subscriptions, payload, kind == "message" ? "high" : "normal")
        nil
      rescue StandardError => e
        Hanami.logger.warn("Notifications::SendPush failed: #{e.class}: #{e.message}")
        # SILENT: A push that cannot be sent must not fail the action that triggered it.
        nil
      end

      private

      # Database work stays on this thread; the worker threads only wait on the push services.
      def deliver_all(subscriptions, payload, urgency)
        outcomes = subscriptions.map do |subscription|
          Thread.new do
            web_push_sender.deliver(endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, payload: payload, urgency: urgency)
          end
        end.map(&:value)

        subscriptions.zip(outcomes).each do |subscription, outcome|
          push_subscription_repo.delete_by_endpoint(subscription.endpoint) if outcome == :gone
        end
      end
    end
  end
end
```

- [ ] **Step 8: Run the send spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/send_push_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 9: Write the failing caller specs**

`spec/slices/notifications/use_cases/emit_spec.rb` を次に置き換える:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::Emit, type: :database do
  let(:send_push) { double(:send_push, call: nil) }
  let(:use_case) { described_class.new(send_push: send_push) }
  let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:recipient_profile_id) { create_account_with_profile }
  let(:actor_profile_id) { create_account_with_profile }
  let(:target_resource_id) { SecureRandom.uuid_v7 }

  def emit(type: "mention", **rest)
    use_case.call(recipient_profile_id: recipient_profile_id, type: type, target_resource_id: target_resource_id, actor_profile_id: actor_profile_id, **rest)
  end

  it "lists the notification even when the recipient turned that kind off for devices" do
    update_preferences.call(profile_id: recipient_profile_id, preferences: defaults.merge(push_enabled: false, mention: false))

    expect(emit).not_to be_nil
    expect(notification_repo.list(recipient_profile_id: recipient_profile_id).map(&:type)).to eq(["mention"])
  end

  it "hands the event to the device push with its post and text" do
    post_id = SecureRandom.uuid_v7

    emit(type: "reply", target_post_id: post_id, excerpt: "ありがとう")

    expect(send_push).to have_received(:call).with(
      recipient_profile_id: recipient_profile_id, kind: "reply", actor_profile_id: actor_profile_id, post_id: post_id, excerpt: "ありがとう"
    )
  end

  it "uses the liked post as the post of a like" do
    emit(type: "like")

    expect(send_push).to have_received(:call).with(hash_including(kind: "like", post_id: target_resource_id, excerpt: nil))
  end

  it "neither lists nor pushes a notification to oneself or from a blocked profile" do
    use_case.call(recipient_profile_id: recipient_profile_id, type: "like", target_resource_id: target_resource_id, actor_profile_id: recipient_profile_id)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)
    emit

    expect(notification_repo.list(recipient_profile_id: recipient_profile_id)).to be_empty
    expect(send_push).not_to have_received(:call)
  end
end
```

`spec/slices/messaging/use_cases/send_message_spec.rb` の `use_case` と依存を次にする:

```ruby
  let(:use_case) do
    described_class.new(messaging_repo: messaging_repo, send_restriction: send_restriction, get_profile: get_profile, send_push: send_push)
  end
  let(:send_push) { double(:send_push, call: nil) }
```

"raises FollowRequiredError when the sender must follow the recipient first" の example の最後に `expect(send_push).not_to have_received(:call)` を足し、"sends the message when nothing restricts the sender" の example の最後に次を足す:

```ruby
    expect(send_push).to have_received(:call).with(
      recipient_profile_id: recipient_profile_id, kind: "message", actor_profile_id: sender_profile_id, thread_id: "thread-1", excerpt: "hi"
    )
```

`spec/slices/post/use_cases/comments/add_comment_spec.rb` の `context "when content contains a mention"` の中に足す:

```ruby
      it "passes the comment text to every notification it emits" do
        create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
        calls = []
        allow_any_instance_of(Notifications::UseCases::Emit).to receive(:call) { |_emit, **kwargs| calls << kwargs }

        use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "  よろしく @mentioned_user  ")

        expect(calls.map { |c| [c[:type], c[:excerpt]] }).to contain_exactly(
          ["comment", "よろしく @mentioned_user"], ["mention", "よろしく @mentioned_user"]
        )
      end
```

`spec/slices/post/grpc/post_handler_spec.rb` の `describe "#save_post mentions"` の中に足す:

```ruby
    it "passes the post text to the mention notification" do
      calls = []
      allow_any_instance_of(Notifications::UseCases::Emit).to receive(:call) { |_emit, **kwargs| calls << kwargs }

      handler.save_post

      expect(calls.map { |c| [c[:type], c[:excerpt]] }).to eq([["mention", "hi @mentioned_user"]])
    end
```

- [ ] **Step 10: Run them to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications/use_cases/emit_spec.rb spec/slices/messaging/use_cases/send_message_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/grpc/post_handler_spec.rb > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: FAIL（`unknown keyword: :send_push`、`excerpt` が渡らない）

- [ ] **Step 11: Change Emit, SendMessage and the callers**

`slices/notifications/use_cases/emit.rb` を次にする:

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class Emit
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        send_push: "use_cases.send_push"
      ]

      def call(recipient_profile_id:, type:, target_resource_id:, actor_profile_id:, target_post_id: nil, excerpt: nil)
        return nil if recipient_profile_id.nil? || actor_profile_id.nil?
        return nil if recipient_profile_id.to_s == actor_profile_id.to_s

        return nil if block_repo.blocked?(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)

        notification = notification_repo.emit(
          recipient_profile_id: recipient_profile_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_profile_id: actor_profile_id,
          target_post_id: target_post_id
        )
        send_push.call(
          recipient_profile_id: recipient_profile_id,
          kind: type.to_s,
          actor_profile_id: actor_profile_id,
          post_id: target_post_id || target_resource_id,
          excerpt: excerpt
        )
        notification
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        # SILENT: Notification delivery failure must not fail the triggering action.
        nil
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
```

`slices/messaging/use_cases/send_message.rb`:

```ruby
      def initialize(get_profile: nil, send_push: nil, **kwargs)
        super(**kwargs)
        @get_profile = get_profile
        @send_push = send_push
      end
```

`call` の最後（`messaging_repo.insert_message(...)` の後）を次にする:

```ruby
        thread_id = thread[:id] || thread.id
        message = messaging_repo.insert_message(
          thread_id: thread_id,
          sender_profile_id: sender_profile_id,
          content: content
        )

        send_push.call(
          recipient_profile_id: resolved_recipient_profile_id,
          kind: "message",
          actor_profile_id: sender_profile_id,
          thread_id: thread_id,
          excerpt: content
        )

        { message: message, thread_id: thread_id }
```

`private` 以下に足す:

```ruby
      def send_push
        @send_push ||= Notifications::Slice["use_cases.send_push"]
      end
```

`slices/post/use_cases/comments/add_comment.rb` の 3 か所の `notifications_emit.call(...)`（`reply`・`comment`・`mention`）に `excerpt: normalized_content` を足す。

`slices/post/grpc/post_handler.rb` の mention の `notifications_emit.call(...)` に `excerpt: content` を足す。

- [ ] **Step 12: Run the notifications, messaging, post and social specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/notifications spec/slices/messaging spec/slices/post spec/slices/social > "$SCRATCH/rspec.log" 2>&1; tail -30 "$SCRATCH/rspec.log"`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add dystopia/monolith
git status --porcelain
git commit -s -m "feat(dystopia): send web push for notifications and direct messages"
```

---

### Task 5: Subscribe browsers through a service worker

BFF の route、購読の処理、service worker を作る。

**Files:**
- Create: `dystopia/frontend/src/app/api/notifications/push/config/route.ts`
- Create: `dystopia/frontend/src/app/api/notifications/push/config/route.test.ts`
- Create: `dystopia/frontend/src/app/api/notifications/push/subscription/route.ts`
- Create: `dystopia/frontend/src/app/api/notifications/push/subscription/route.test.ts`
- Create: `dystopia/frontend/src/modules/notifications/lib/push.ts`
- Create: `dystopia/frontend/src/modules/notifications/lib/push.test.ts`
- Create: `dystopia/frontend/public/sw.js`
- Create: `dystopia/frontend/src/lib/pwa/sw.test.ts`

**Interfaces:**
- Consumes: Task 3 の client メソッド `notificationClient.getPushConfig` / `registerPushSubscription` / `unregisterPushSubscription`
- Produces（`@/modules/notifications/lib/push`）:
  - `type PushSupport = "unsupported" | "needs-install" | "denied" | "available"`
  - `readPushEnvironment(): PushEnvironment | null`、`detectPushSupport(env: PushEnvironment | null): PushSupport`
  - `base64UrlToBytes(value: string): Uint8Array<ArrayBuffer>`
  - `fetchVapidPublicKey(): Promise<string>`（空文字は未設定）
  - `currentPushSubscription(): Promise<PushSubscription | null>`
  - `enablePush(vapidPublicKey: string): Promise<"subscribed" | "denied">`
  - `disablePush(): Promise<void>`
  - `resyncPushSubscription(): Promise<void>`（例外を出さない）
- BFF: `GET /api/notifications/push/config` → `{ vapidPublicKey: string }`、`POST /api/notifications/push/subscription`（`{ endpoint, p256dh, auth }`）→ `{}`、`DELETE /api/notifications/push/subscription`（`{ endpoint }`）→ `{}`
- push の payload（monolith から）: `{ "title": string, "body": string, "url": string }`

- [ ] **Step 1: Write the failing route tests**

`src/app/api/notifications/push/config/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({ getPushConfig: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET } = await import("./route");

function request(signedIn = true) {
  const req = new NextRequest("http://localhost/api/notifications/push/config");
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("GET /api/notifications/push/config", () => {
  it("returns the VAPID public key", async () => {
    notifications.getPushConfig.mockResolvedValue({ vapidPublicKey: "BPublicKey" });

    const res = await GET(request());

    expect(await res.json()).toEqual({ vapidPublicKey: "BPublicKey" });
  });

  it("requires a session", async () => {
    const res = await GET(request(false));

    expect(res.status).toBe(401);
  });
});
```

`src/app/api/notifications/push/subscription/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const notifications = vi.hoisted(() => ({
  registerPushSubscription: vi.fn(),
  unregisterPushSubscription: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ notificationClient: notifications }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { POST, DELETE } = await import("./route");

function request(method: string, body: unknown) {
  const req = new NextRequest("http://localhost/api/notifications/push/subscription", { method, body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/notifications/push/subscription", () => {
  beforeEach(() => {
    notifications.registerPushSubscription.mockReset().mockResolvedValue({});
    notifications.unregisterPushSubscription.mockReset().mockResolvedValue({});
  });

  it("registers the subscription's endpoint and keys", async () => {
    const res = await POST(request("POST", { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" }));

    expect(notifications.registerPushSubscription).toHaveBeenCalledWith(
      { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" },
      expect.anything()
    );
    expect(res.status).toBe(200);
  });

  it("sends empty strings for fields that are not strings", async () => {
    await POST(request("POST", { endpoint: 1, p256dh: null }));

    expect(notifications.registerPushSubscription).toHaveBeenCalledWith({ endpoint: "", p256dh: "", auth: "" }, expect.anything());
  });

  it("returns 400 when the monolith rejects the subscription", async () => {
    notifications.registerPushSubscription.mockRejectedValue(new ConnectError("この端末の通知を登録できませんでした", Code.InvalidArgument));

    const res = await POST(request("POST", { endpoint: "https://evil.example", p256dh: "BKey", auth: "auth" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("この端末の通知を登録できませんでした");
  });

  it("unregisters the endpoint", async () => {
    await DELETE(request("DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/a" }));

    expect(notifications.unregisterPushSubscription).toHaveBeenCalledWith({ endpoint: "https://fcm.googleapis.com/fcm/send/a" }, expect.anything());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/api/notifications/push`
Expected: FAIL（`./route` が無い）

- [ ] **Step 3: Add the routes**

`src/app/api/notifications/push/config/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const res = await notificationClient.getPushConfig({}, { headers });
    return NextResponse.json({ vapidPublicKey: res.vapidPublicKey });
  } catch (error: unknown) {
    return handleApiError(error, "GetPushConfig");
  }
}
```

`src/app/api/notifications/push/subscription/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await notificationClient.registerPushSubscription(
      { endpoint: text(body?.endpoint), p256dh: text(body?.p256dh), auth: text(body?.auth) },
      { headers }
    );
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "RegisterPushSubscription");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await notificationClient.unregisterPushSubscription({ endpoint: text(body?.endpoint) }, { headers });
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "UnregisterPushSubscription");
  }
}
```

- [ ] **Step 4: Run the route tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/api/notifications/push`
Expected: PASS

- [ ] **Step 5: Write the failing push library test**

`src/modules/notifications/lib/push.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const {
  base64UrlToBytes,
  detectPushSupport,
  disablePush,
  enablePush,
  resyncPushSubscription,
} = await import("./push");

const AVAILABLE = {
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default" as NotificationPermission,
};

function fakeSubscription(endpoint = "https://fcm.googleapis.com/fcm/send/a") {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "BKey", auth: "auth" } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function installBrowser({ permission = "granted", existing = null as ReturnType<typeof fakeSubscription> | null } = {}) {
  const calls: string[] = [];
  const created = fakeSubscription();
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => existing),
      subscribe: vi.fn(async () => created),
    },
  };
  const serviceWorker = {
    register: vi.fn(async () => {
      calls.push("register");
      return registration;
    }),
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
  };
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      calls.push("requestPermission");
      return permission;
    }),
  };
  vi.stubGlobal("navigator", { userAgent: AVAILABLE.userAgent, platform: AVAILABLE.platform, maxTouchPoints: 5, serviceWorker });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("window", { PushManager: function PushManager() {}, Notification: notification, matchMedia: () => ({ matches: false }) });
  return { calls, registration, serviceWorker, created };
}

beforeEach(() => {
  auth.authFetch.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectPushSupport", () => {
  it("is available on a browser with the push APIs", () => {
    expect(detectPushSupport(AVAILABLE)).toBe("available");
  });

  it("asks iOS users to add the app to the home screen first", () => {
    const iphone = { ...AVAILABLE, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", hasPushManager: false };
    const ipad = { ...AVAILABLE, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 };

    expect(detectPushSupport(iphone)).toBe("needs-install");
    expect(detectPushSupport(ipad)).toBe("needs-install");
    expect(detectPushSupport({ ...iphone, standalone: true, hasPushManager: true })).toBe("available");
  });

  it("reports a browser without the push APIs and a denied permission", () => {
    expect(detectPushSupport({ ...AVAILABLE, hasPushManager: false })).toBe("unsupported");
    expect(detectPushSupport(null)).toBe("unsupported");
    expect(detectPushSupport({ ...AVAILABLE, permission: "denied" })).toBe("denied");
  });
});

describe("base64UrlToBytes", () => {
  it("decodes unpadded base64url", () => {
    expect(Array.from(base64UrlToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("enablePush", () => {
  it("asks for permission before anything else, then subscribes with the key and registers the subscription", async () => {
    const browser = installBrowser();

    expect(await enablePush("AQID_-8")).toBe("subscribed");

    expect(browser.calls).toEqual(["requestPermission", "register"]);
    expect(browser.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    const options = browser.registration.pushManager.subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect(Array.from(options.applicationServerKey)).toEqual([1, 2, 3, 255, 239]);
    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", {
      method: "POST",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" },
    });
  });

  it("registers an existing subscription instead of creating another", async () => {
    const existing = fakeSubscription("https://web.push.apple.com/existing");
    const browser = installBrowser({ existing });

    await enablePush("AQID_-8");

    expect(browser.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", expect.objectContaining({
      body: expect.objectContaining({ endpoint: "https://web.push.apple.com/existing" }),
    }));
  });

  it("stops without registering anything when permission is not granted", async () => {
    const browser = installBrowser({ permission: "denied" });

    expect(await enablePush("AQID_-8")).toBe("denied");

    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(auth.authFetch).not.toHaveBeenCalled();
  });
});

describe("disablePush", () => {
  it("unregisters on the server, then unsubscribes the browser", async () => {
    const existing = fakeSubscription();
    installBrowser({ existing });

    await disablePush();

    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", {
      method: "DELETE",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
    });
    expect(existing.unsubscribe).toHaveBeenCalled();
  });

  it("does nothing without a subscription", async () => {
    installBrowser();

    await disablePush();

    expect(auth.authFetch).not.toHaveBeenCalled();
  });
});

describe("resyncPushSubscription", () => {
  it("registers the browser's subscription again when permission is granted", async () => {
    installBrowser({ existing: fakeSubscription() });

    await resyncPushSubscription();

    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", expect.objectContaining({ method: "POST" }));
  });

  it("does nothing before permission is granted", async () => {
    installBrowser({ permission: "default", existing: fakeSubscription() });

    await resyncPushSubscription();

    expect(auth.authFetch).not.toHaveBeenCalled();
  });

  it("swallows a failed registration", async () => {
    installBrowser({ existing: fakeSubscription() });
    auth.authFetch.mockRejectedValue(new Error("offline"));

    await expect(resyncPushSubscription()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/lib/push.test.ts`
Expected: FAIL（`./push` が無い）

- [ ] **Step 7: Add the push library**

`src/modules/notifications/lib/push.ts`:

```ts
import { authFetch } from "@/lib/auth";

export type PushSupport = "unsupported" | "needs-install" | "denied" | "available";

export interface PushEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
}

const CONFIG_URL = "/api/notifications/push/config";
const SUBSCRIPTION_URL = "/api/notifications/push/subscription";
const SERVICE_WORKER_URL = "/sw.js";

export function readPushEnvironment(): PushEnvironment | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { standalone?: boolean };
  const hasNotification = "Notification" in window;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true,
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: "PushManager" in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
  };
}

// iPadOS reports itself as a Mac, so a touch-capable Mac is treated as an iPad.
export function detectPushSupport(env: PushEnvironment | null): PushSupport {
  if (!env) return "unsupported";
  const isIOS = /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === "MacIntel" && env.maxTouchPoints > 1);
  if (isIOS && !env.standalone) return "needs-install";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "denied";
  return "available";
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function fetchVapidPublicKey(): Promise<string> {
  const { vapidPublicKey } = await authFetch<{ vapidPublicKey: string }>(CONFIG_URL);
  return vapidPublicKey;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

function subscriptionBody(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? "", p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export async function enablePush(vapidPublicKey: string): Promise<"subscribed" | "denied"> {
  // Ask first: Safari only shows the prompt while the tap that started this is still active.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }));
  await authFetch(SUBSCRIPTION_URL, { method: "POST", body: subscriptionBody(subscription) });
  return "subscribed";
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await authFetch(SUBSCRIPTION_URL, { method: "DELETE", body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

export async function resyncPushSubscription(): Promise<void> {
  if (detectPushSupport(readPushEnvironment()) !== "available" || Notification.permission !== "granted") return;
  try {
    const subscription = await currentPushSubscription();
    if (subscription) await authFetch(SUBSCRIPTION_URL, { method: "POST", body: subscriptionBody(subscription) });
  } catch {
    // SILENT: The previous owner keeps the subscription until the next launch registers it again.
  }
}
```

- [ ] **Step 8: Run the push library test**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/lib/push.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing service worker test**

`src/lib/pwa/sw.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");
const ORIGIN = "https://dystopia.city";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(windows: Array<{ url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }> = []) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const self = {
    location: { origin: ORIGIN },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
  };
  vm.runInNewContext(source, { self, URL });
  return { listeners, showNotification, openWindow };
}

async function dispatch(listener: Listener, event: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  listener({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
  await Promise.all(pending);
}

const pushData = (payload: unknown) => ({ json: () => payload });
const brokenData = { json: () => JSON.parse("not json") };

function click(url: unknown) {
  return { notification: { close: vi.fn(), data: { url } } };
}

describe("service worker", () => {
  it("shows the pushed title and body and keeps the page to open", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.push, { data: pushData({ title: "りん", body: "あなたの投稿にいいねしました", url: "/notifications/open?profile=p&to=%2Fposts%2F1" }) });

    expect(worker.showNotification).toHaveBeenCalledWith("りん", {
      body: "あなたの投稿にいいねしました",
      icon: "/pwa-icon/192",
      data: { url: "/notifications/open?profile=p&to=%2Fposts%2F1" },
    });
  });

  it("still shows a generic notification for a missing or unreadable payload", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.push, { data: null });
    await dispatch(worker.listeners.push, { data: brokenData });
    await dispatch(worker.listeners.push, { data: pushData({ title: 1, url: "https://evil.example" }) });

    expect(worker.showNotification).toHaveBeenCalledTimes(3);
    for (const [title, options] of worker.showNotification.mock.calls) {
      expect(title).toBe("dystopia");
      expect(options).toEqual({ body: "新しいお知らせがあります", icon: "/pwa-icon/192", data: { url: "/notifications" } });
    }
  });

  it("brings an open window forward and navigates it to the page", async () => {
    const open = { url: `${ORIGIN}/home`, focus: vi.fn(async () => open), navigate: vi.fn(async () => open) };
    const worker = loadWorker([open]);
    const event = click("/notifications/open?profile=p&to=%2Fposts%2F1");

    await dispatch(worker.listeners.notificationclick, event);

    expect(event.notification.close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/notifications/open?profile=p&to=%2Fposts%2F1`);
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when none is open or the open one cannot be navigated", async () => {
    const stuck = { url: `${ORIGIN}/home`, focus: vi.fn(async () => stuck), navigate: vi.fn(async () => Promise.reject(new TypeError("not controlled"))) };
    const empty = loadWorker();
    const uncontrolled = loadWorker([stuck]);

    await dispatch(empty.listeners.notificationclick, click("/posts/1"));
    await dispatch(uncontrolled.listeners.notificationclick, click("/posts/1"));

    expect(empty.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/1`);
    expect(uncontrolled.openWindow).toHaveBeenCalledWith(`${ORIGIN}/posts/1`);
  });

  it("opens the notification list for a page outside the app", async () => {
    const worker = loadWorker();

    await dispatch(worker.listeners.notificationclick, click("//evil.example/x"));

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/lib/pwa/sw.test.ts`
Expected: FAIL（`ENOENT ... public/sw.js`）

- [ ] **Step 11: Add the service worker**

`dystopia/frontend/public/sw.js`:

```js
const FALLBACK_TITLE = "dystopia";
const FALLBACK_BODY = "新しいお知らせがあります";
const FALLBACK_URL = "/notifications";
const ICON_URL = "/pwa-icon/192";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function isAppPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function readPayload(data) {
  try {
    const payload = data ? data.json() : null;
    if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string" || !isAppPath(payload.url)) {
      throw new Error("unreadable payload");
    }
    return { title: payload.title, body: payload.body, url: payload.url };
  } catch {
    // FALLBACK: Safari revokes a subscription whose push shows nothing, so an unreadable payload still shows a generic notification.
    return { title: FALLBACK_TITLE, body: FALLBACK_BODY, url: FALLBACK_URL };
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = readPayload(event.data);
  event.waitUntil(self.registration.showNotification(title, { body, icon: ICON_URL, data: { url } }));
});

async function openPage(path) {
  const url = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (existing) {
    try {
      await existing.focus();
      await existing.navigate(url);
      return;
    } catch {
      // FALLBACK: A window this worker does not control cannot be navigated, so a new one is opened.
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(openPage(isAppPath(target) ? target : FALLBACK_URL));
});
```

- [ ] **Step 12: Run the frontend tests and the type check**

Run: `cd dystopia/frontend && pnpm exec vitest run src/lib/pwa src/modules/notifications src/app/api/notifications && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: PASS、`tsc exit 0`

- [ ] **Step 13: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add dystopia/frontend
git status --porcelain
git commit -s -m "feat(dystopia): subscribe browsers to web push through a service worker"
```

---

### Task 6: Manage web push in settings and open notifications as their profile

設定画面に端末とプロフィールの区分を作り、`/notifications/open` を作り、アプリを開いたときに購読を登録し直す。

**Files:**
- Create: `dystopia/frontend/src/modules/notifications/hooks/usePushDevice.ts`
- Create: `dystopia/frontend/src/modules/notifications/hooks/usePushDevice.test.tsx`
- Modify: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.tsx`
- Create: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.test.tsx`
- Create: `dystopia/frontend/src/modules/notifications/lib/open.ts`
- Create: `dystopia/frontend/src/modules/notifications/lib/open.test.ts`
- Create: `dystopia/frontend/src/app/notifications/open/page.tsx`
- Create: `dystopia/frontend/src/app/notifications/open/page.test.tsx`
- Create: `dystopia/frontend/src/modules/notifications/hooks/usePushResync.ts`
- Create: `dystopia/frontend/src/modules/notifications/hooks/usePushResync.test.tsx`
- Modify: `dystopia/frontend/src/components/shell/AppShell.tsx`

**Interfaces:**
- Consumes: Task 5 の `@/modules/notifications/lib/push`、Task 1 の `NotificationPreferences`、既存の `useAccountProfiles()`（`profiles: ProfileView[]`）、`selectableProfiles(profiles, deniedProfileId)`、`useAuthStore`（`selectActiveProfileId` / `selectDeniedProfileId` / `setActiveProfile`）
- Produces:
  - `type PushDeviceState = "loading" | "unsupported" | "needs-install" | "denied" | "unconfigured" | "off" | "on"`、`usePushDevice(): { state, busy, failed, enable(): Promise<void>, disable(): Promise<void> }`
  - `resolveNotificationOpen({ profileId, to, selectableProfileIds, activeProfileId }): { switchTo: string | null; destination: string }`
  - `usePushResync(accountId: string | null): void`

- [ ] **Step 1: Write the failing open resolver test**

`src/modules/notifications/lib/open.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveNotificationOpen } from "./open";

const base = { profileId: "p2", to: "/posts/1", selectableProfileIds: ["p1", "p2"], activeProfileId: "p1" };

describe("resolveNotificationOpen", () => {
  it("switches to the receiving profile when it is another of the account's profiles", () => {
    expect(resolveNotificationOpen(base)).toEqual({ switchTo: "p2", destination: "/posts/1" });
  });

  it("goes straight to the page when the receiving profile is already active", () => {
    expect(resolveNotificationOpen({ ...base, activeProfileId: "p2" })).toEqual({ switchTo: null, destination: "/posts/1" });
  });

  it("does not switch to a profile the account cannot act as", () => {
    expect(resolveNotificationOpen({ ...base, profileId: "someone-else" })).toEqual({ switchTo: null, destination: "/posts/1" });
    expect(resolveNotificationOpen({ ...base, profileId: null })).toEqual({ switchTo: null, destination: "/posts/1" });
  });

  it("opens the notification list instead of a page outside the app", () => {
    for (const to of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "posts/1"]) {
      expect(resolveNotificationOpen({ ...base, to }).destination).toBe("/notifications");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/lib/open.test.ts`
Expected: FAIL（`./open` が無い）

- [ ] **Step 3: Add the resolver**

`src/modules/notifications/lib/open.ts`:

```ts
export interface NotificationOpenInput {
  profileId: string | null;
  to: string | null;
  selectableProfileIds: string[];
  activeProfileId: string | null;
}

const FALLBACK_DESTINATION = "/notifications";

function isAppPath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export function resolveNotificationOpen({ profileId, to, selectableProfileIds, activeProfileId }: NotificationOpenInput) {
  const switchTo = profileId && profileId !== activeProfileId && selectableProfileIds.includes(profileId) ? profileId : null;
  // FALLBACK: A destination outside the app opens the notification list instead.
  const destination = isAppPath(to) ? to : FALLBACK_DESTINATION;
  return { switchTo, destination };
}
```

- [ ] **Step 4: Write the failing page test**

`src/app/notifications/open/page.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  setActiveProfile: vi.fn(),
  state: { activeProfileId: "p1" as string | null, deniedProfileId: null as string | null },
  profiles: [{ id: "p1", disabled: false }, { id: "p2", disabled: false }],
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/modules/profile/context/AccountProfilesContext", () => ({
  useAccountProfiles: () => ({ profiles: mocks.profiles }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ ...mocks.state, setActiveProfile: mocks.setActiveProfile }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
  selectDeniedProfileId: (state: { deniedProfileId: string | null }) => state.deniedProfileId,
}));

const { default: NotificationOpenPage } = await import("./page");

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;

async function open(query: string) {
  mocks.params = new URLSearchParams(query);
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(createElement(NotificationOpenPage)));
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.setActiveProfile.mockReset();
  mocks.state.activeProfileId = "p1";
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("NotificationOpenPage", () => {
  it("switches to the receiving profile before opening anything", async () => {
    await open("profile=p2&to=%2Fposts%2F1");

    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("opens the page once the receiving profile is active", async () => {
    mocks.state.activeProfileId = "p2";

    await open("profile=p2&to=%2Fposts%2F1");

    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/posts/1");
  });

  it("opens the notification list for a destination outside the app", async () => {
    await open("profile=p1&to=https%3A%2F%2Fevil.example");

    expect(mocks.replace).toHaveBeenCalledWith("/notifications");
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/app/notifications/open/page.test.tsx`
Expected: FAIL（`./page` が無い）

- [ ] **Step 6: Add the page**

`src/app/notifications/open/page.tsx`:

```tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
import { selectableProfiles } from "@/modules/profile/lib/session";
import { resolveNotificationOpen } from "@/modules/notifications/lib/open";
import { useAuthStore, selectActiveProfileId, selectDeniedProfileId } from "@/stores/authStore";

export default function NotificationOpenPage() {
  return (
    <Suspense>
      <NotificationOpen />
    </Suspense>
  );
}

// Renders nothing so the target page is first drawn as the receiving profile, never leaving footprints or reads as another.
function NotificationOpen() {
  const params = useSearchParams();
  const router = useRouter();
  const { profiles } = useAccountProfiles();
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((state) => state.setActiveProfile);
  const profileId = params?.get("profile") ?? null;
  const to = params?.get("to") ?? null;

  useEffect(() => {
    const { switchTo, destination } = resolveNotificationOpen({
      profileId,
      to,
      selectableProfileIds: selectableProfiles(profiles, deniedProfileId).map((profile) => profile.id),
      activeProfileId,
    });
    if (switchTo) {
      setActiveProfile(switchTo);
      return;
    }
    router.replace(destination);
  }, [profileId, to, profiles, deniedProfileId, activeProfileId, setActiveProfile, router]);

  return null;
}
```

- [ ] **Step 7: Run the open tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/lib/open.test.ts src/app/notifications/open/page.test.tsx`
Expected: PASS

- [ ] **Step 8: Write the failing device hook test**

`src/modules/notifications/hooks/usePushDevice.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.hoisted(() => ({
  support: "available" as string,
  readPushEnvironment: vi.fn(() => ({})),
  detectPushSupport: vi.fn(() => push.support),
  fetchVapidPublicKey: vi.fn(async () => "BPublicKey"),
  currentPushSubscription: vi.fn(async () => null as object | null),
  enablePush: vi.fn(async () => "subscribed"),
  disablePush: vi.fn(async () => {}),
}));
vi.mock("@/modules/notifications/lib/push", () => push);

const { usePushDevice } = await import("./usePushDevice");

let latest: ReturnType<typeof usePushDevice>;
let root: ReturnType<typeof createRoot>;

function Probe() {
  latest = usePushDevice();
  return null;
}

async function mount() {
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
}

beforeEach(() => {
  push.support = "available";
  push.fetchVapidPublicKey.mockReset().mockResolvedValue("BPublicKey");
  push.currentPushSubscription.mockReset().mockResolvedValue(null);
  push.enablePush.mockReset().mockResolvedValue("subscribed");
  push.disablePush.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("usePushDevice", () => {
  it("reports why the device cannot receive notifications", async () => {
    for (const support of ["unsupported", "needs-install", "denied"]) {
      push.support = support;
      await mount();
      expect(latest.state).toBe(support);
      await act(async () => root.unmount());
    }
    push.support = "available";
    push.fetchVapidPublicKey.mockResolvedValue("");
    await mount();
    expect(latest.state).toBe("unconfigured");
  });

  it("is on when the browser already holds a subscription", async () => {
    push.currentPushSubscription.mockResolvedValue({});

    await mount();

    expect(latest.state).toBe("on");
  });

  it("turns on with the fetched key, and reports a refused permission", async () => {
    await mount();
    expect(latest.state).toBe("off");

    await act(async () => latest.enable());
    expect(push.enablePush).toHaveBeenCalledWith("BPublicKey");
    expect(latest.state).toBe("on");

    push.enablePush.mockResolvedValue("denied");
    await act(async () => latest.disable());
    expect(latest.state).toBe("off");
    await act(async () => latest.enable());
    expect(latest.state).toBe("denied");
  });

  it("keeps the previous state and flags a failure when a change fails", async () => {
    await mount();
    push.enablePush.mockRejectedValue(new Error("offline"));

    await act(async () => latest.enable());

    expect(latest.state).toBe("off");
    expect(latest.failed).toBe(true);
    expect(latest.busy).toBe(false);
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/hooks/usePushDevice.test.tsx`
Expected: FAIL（`./usePushDevice` が無い）

- [ ] **Step 10: Add the device hook**

`src/modules/notifications/hooks/usePushDevice.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  currentPushSubscription,
  detectPushSupport,
  disablePush,
  enablePush,
  fetchVapidPublicKey,
  readPushEnvironment,
} from "@/modules/notifications/lib/push";

export type PushDeviceState = "loading" | "unsupported" | "needs-install" | "denied" | "unconfigured" | "off" | "on";

export function usePushDevice() {
  const [state, setState] = useState<PushDeviceState>("loading");
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const support = detectPushSupport(readPushEnvironment());
      if (support !== "available") {
        if (!cancelled) setState(support);
        return;
      }
      try {
        const key = await fetchVapidPublicKey();
        if (cancelled) return;
        if (!key) {
          setState("unconfigured");
          return;
        }
        setVapidPublicKey(key);
        const subscription = await currentPushSubscription();
        if (!cancelled) setState(subscription ? "on" : "off");
      } catch {
        if (!cancelled) {
          setState("off");
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const change = useCallback(async (action: () => Promise<PushDeviceState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await action());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(
    () => change(async () => ((await enablePush(vapidPublicKey)) === "subscribed" ? "on" : "denied")),
    [change, vapidPublicKey]
  );
  const disable = useCallback(
    () =>
      change(async () => {
        await disablePush();
        return "off";
      }),
    [change]
  );

  return { state, busy, failed, enable, disable };
}
```

- [ ] **Step 11: Run the device hook test**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/hooks/usePushDevice.test.tsx`
Expected: PASS

- [ ] **Step 12: Write the failing settings test**

`src/modules/notifications/components/NotificationSettings.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  device: { state: "off" as string, busy: false, failed: false, enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) },
  preferences: {
    pushEnabled: true,
    comment: true,
    like: true,
    reply: true,
    follow: true,
    mention: true,
    message: true,
    footprintUnreadBadge: true,
    footprintsRecordMyVisits: true,
  },
  update: vi.fn(async () => {}),
}));

vi.mock("@/modules/notifications/hooks/usePushDevice", () => ({ usePushDevice: () => mocks.device }));
vi.mock("@/modules/notifications/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({ preferences: mocks.preferences, loading: false, updating: false, error: null, update: mocks.update }),
}));

const { NotificationSettings } = await import("./NotificationSettings");

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;

async function mount() {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(createElement(NotificationSettings)));
}

function toggle(label: string) {
  return container.querySelector(`[role="switch"][aria-label="${label}"]`) as HTMLButtonElement;
}

beforeEach(() => {
  mocks.device = { state: "off", busy: false, failed: false, enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) };
  mocks.preferences = { ...mocks.preferences, pushEnabled: true };
  mocks.update.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("NotificationSettings", () => {
  it("lists the device switch, the profile switch and the six kinds", async () => {
    await mount();

    for (const label of ["この端末で受け取る", "端末に通知を送る", "いいね", "コメント", "リプライ", "メンション", "フォロー", "メッセージ"]) {
      expect(toggle(label)).not.toBeNull();
    }
    for (const removed of ["リポスト", "引用", "推し！", "ポスト"]) {
      expect(toggle(removed)).toBeNull();
    }
    expect(container.textContent).toContain("アプリ内の通知一覧には、設定に関係なくすべて表示されます");
  });

  it("explains why the device cannot receive notifications and locks its switch", async () => {
    const notes: Record<string, string> = {
      unsupported: "この端末では受け取れません",
      "needs-install": "ホーム画面に追加すると受け取れます",
      denied: "ブラウザの設定で通知を許可してください",
      unconfigured: "この環境では受け取れません",
    };
    for (const [state, note] of Object.entries(notes)) {
      mocks.device = { ...mocks.device, state };
      await mount();
      expect(container.textContent).toContain(note);
      expect(toggle("この端末で受け取る").disabled).toBe(true);
      await act(async () => root.unmount());
    }
    await mount();
  });

  it("turns the device on and off", async () => {
    await mount();
    await act(async () => toggle("この端末で受け取る").click());
    expect(mocks.device.enable).toHaveBeenCalled();
    await act(async () => root.unmount());

    mocks.device = { ...mocks.device, state: "on" };
    await mount();
    expect(toggle("この端末で受け取る").getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle("この端末で受け取る").click());
    expect(mocks.device.disable).toHaveBeenCalled();
  });

  it("locks the kinds while the profile sends nothing to devices", async () => {
    mocks.preferences = { ...mocks.preferences, pushEnabled: false };

    await mount();

    expect(toggle("いいね").disabled).toBe(true);
    expect(toggle("端末に通知を送る").disabled).toBe(false);
  });

  it("shows a failed device change", async () => {
    mocks.device = { ...mocks.device, failed: true };

    await mount();

    expect(container.textContent).toContain("端末の設定を変更できませんでした");
  });
});
```

- [ ] **Step 13: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/components/NotificationSettings.test.tsx`
Expected: FAIL（「この端末で受け取る」が無い）

- [ ] **Step 14: Rewrite the settings component**

`src/modules/notifications/components/NotificationSettings.tsx` を次にする:

```tsx
"use client";

import { useNotificationPreferences } from "@/modules/notifications/hooks/useNotificationPreferences";
import { usePushDevice, type PushDeviceState } from "@/modules/notifications/hooks/usePushDevice";
import { Toggle } from "@/components/ui/toggle";
import type { NotificationPreferences } from "@/modules/notifications/types";

type ToggleField = keyof NotificationPreferences;

interface Row {
  field: ToggleField;
  label: string;
}

const PUSH_TYPE_ROWS: Row[] = [
  { field: "like", label: "いいね" },
  { field: "comment", label: "コメント" },
  { field: "reply", label: "リプライ" },
  { field: "mention", label: "メンション" },
  { field: "follow", label: "フォロー" },
  { field: "message", label: "メッセージ" },
];

const DEVICE_NOTES: Partial<Record<PushDeviceState, string>> = {
  unsupported: "この端末では受け取れません",
  "needs-install": "ホーム画面に追加すると受け取れます",
  denied: "ブラウザの設定で通知を許可してください",
  unconfigured: "この環境では受け取れません",
};

export function NotificationSettings() {
  const { preferences, loading, updating, error, update } = useNotificationPreferences();
  const device = usePushDevice();

  if (loading) {
    return <div className="py-4 text-sm text-text-secondary">読み込み中…</div>;
  }
  if (error) {
    return <div className="py-4 text-sm text-text-secondary">通知設定を取得できませんでした。</div>;
  }

  const onToggle = (field: ToggleField) => (value: boolean) => {
    void update({ [field]: value } as Partial<NotificationPreferences>);
  };
  const deviceSwitchable = device.state === "on" || device.state === "off";

  return (
    <div className="flex flex-col gap-6 py-4">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">この端末</h2>
        <ToggleRow
          label="この端末で受け取る"
          description={DEVICE_NOTES[device.state] ?? "オンにすると、この端末に通知が届きます"}
          checked={device.state === "on"}
          onCheckedChange={(value) => void (value ? device.enable() : device.disable())}
          disabled={device.busy || !deviceSwitchable}
        />
        {device.failed && <p className="text-xs text-text-secondary">端末の設定を変更できませんでした</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">このプロフィール</h2>
        <ToggleRow
          label="端末に通知を送る"
          description="オフにすると、このプロフィール宛ての通知はどの端末にも届きません"
          checked={preferences.pushEnabled}
          onCheckedChange={onToggle("pushEnabled")}
          disabled={updating}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">端末に送る通知</h2>
        <p className="text-xs text-text-muted">アプリ内の通知一覧には、設定に関係なくすべて表示されます</p>
        {PUSH_TYPE_ROWS.map((row) => (
          <ToggleRow
            key={row.field}
            label={row.label}
            checked={preferences[row.field]}
            onCheckedChange={onToggle(row.field)}
            disabled={updating || !preferences.pushEnabled}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">その他</h2>
        <ToggleRow
          label="足跡の未読バッジ"
          description="新しい足跡があるときバッジを表示します"
          checked={preferences.footprintUnreadBadge}
          onCheckedChange={onToggle("footprintUnreadBadge")}
          disabled={updating}
        />
        <ToggleRow
          label="他人のプロフィール訪問時に足跡を残す"
          description="オフにすると訪問先のユーザーに自分の足跡が残りません"
          checked={preferences.footprintsRecordMyVisits}
          onCheckedChange={onToggle("footprintsRecordMyVisits")}
          disabled={updating}
        />
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && <span className="text-xs text-text-muted">{description}</span>}
      </div>
      <Toggle checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  );
}
```

- [ ] **Step 15: Run the settings test**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/components/NotificationSettings.test.tsx src/app/settings`
Expected: PASS

- [ ] **Step 16: Write the failing resync hook test**

`src/modules/notifications/hooks/usePushResync.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.hoisted(() => ({ resyncPushSubscription: vi.fn(async () => {}) }));
vi.mock("@/modules/notifications/lib/push", () => push);

const { usePushResync } = await import("./usePushResync");

function Probe({ accountId }: { accountId: string | null }) {
  usePushResync(accountId);
  return null;
}

describe("usePushResync", () => {
  it("registers the browser's subscription once per signed-in account", async () => {
    const root = createRoot(document.createElement("div"));

    await act(async () => root.render(createElement(Probe, { accountId: null })));
    expect(push.resyncPushSubscription).not.toHaveBeenCalled();

    await act(async () => root.render(createElement(Probe, { accountId: "account-A" })));
    await act(async () => root.render(createElement(Probe, { accountId: "account-A" })));
    expect(push.resyncPushSubscription).toHaveBeenCalledTimes(1);

    await act(async () => root.render(createElement(Probe, { accountId: "account-B" })));
    expect(push.resyncPushSubscription).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });
});
```

- [ ] **Step 17: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/notifications/hooks/usePushResync.test.tsx`
Expected: FAIL（`./usePushResync` が無い）

- [ ] **Step 18: Add the resync hook and call it from the shell**

`src/modules/notifications/hooks/usePushResync.ts`:

```ts
"use client";

import { useEffect } from "react";
import { resyncPushSubscription } from "@/modules/notifications/lib/push";

export function usePushResync(accountId: string | null) {
  useEffect(() => {
    if (accountId) void resyncPushSubscription();
  }, [accountId]);
}
```

`src/components/shell/AppShell.tsx` の import に `import { usePushResync } from "@/modules/notifications/hooks/usePushResync";` を足し、`useEnterAnimation(mainRef, pathname);` の次の行に足す:

```tsx
  usePushResync(accountId);
```

- [ ] **Step 19: Run the frontend suite and the type check**

Run: `cd dystopia/frontend && pnpm exec vitest run && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: 全テスト PASS（既存の AppShell テストを含む）、`tsc exit 0`

- [ ] **Step 20: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add dystopia/frontend
git status --porcelain
git commit -s -m "feat(dystopia): manage web push in settings and open notifications as their profile"
```

---

### Task 7: Issue the VAPID key for the Lambda deployment

**Files:**
- Modify: `dystopia/lambda/aws/modules/terraform.tf`
- Modify: `dystopia/lambda/aws/modules/lambda.tf`
- Modify: `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`
- Modify: `docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md`

**Interfaces:**
- Consumes: Task 3 の設定名 `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- Produces: app 用と task 用の関数の環境変数に `VAPID_PRIVATE_KEY`（PEM）と `VAPID_SUBJECT`（`https://dystopia.city`）

- [ ] **Step 1: Write the failing Terraform test**

`dystopia/lambda/aws/modules/tests/hosting.tftest.hcl` の `mock_provider "random" {}` の次に足す:

```hcl
mock_provider "tls" {}

override_resource {
  target = tls_private_key.vapid
  values = {
    private_key_pem = "test-vapid-pem"
  }
}
```

ファイル末尾に足す:

```hcl
run "push_settings" {
  command = plan

  assert {
    condition     = tls_private_key.vapid.algorithm == "ECDSA" && tls_private_key.vapid.ecdsa_curve == "P256"
    error_message = "Web push requires an ECDSA P-256 VAPID key."
  }

  assert {
    condition = alltrue([
      for fn in [aws_lambda_function.app, aws_lambda_function.task] :
      fn.environment[0].variables["VAPID_PRIVATE_KEY"] == "test-vapid-pem" &&
      fn.environment[0].variables["VAPID_SUBJECT"] == "https://dystopia.city"
    ])
    error_message = "Both functions must receive the VAPID key and subject."
  }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dystopia/lambda/aws/modules && tofu init -backend=false -input=false -no-color > "$SCRATCH/tofu.log" 2>&1; tofu test -no-color >> "$SCRATCH/tofu.log" 2>&1; echo "tofu exit $?"; tail -20 "$SCRATCH/tofu.log"`
Expected: 失敗（`tls_private_key.vapid` が無い）

- [ ] **Step 3: Add the provider, key and environment**

`terraform.tf` の `required_providers` の `random` の後に足す:

```hcl
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.4"
    }
```

`lambda.tf` の `locals` ブロックの前に足す:

```hcl
# Replacing this key invalidates every browser's push subscription, so each device has to turn notifications on again.
resource "tls_private_key" "vapid" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}
```

`shared_environment` の `BILLING_PORTAL_RETURN_URL` の次に足す:

```hcl
    VAPID_PRIVATE_KEY         = tls_private_key.vapid.private_key_pem
    VAPID_SUBJECT             = "https://${var.domain_name}"
```

- [ ] **Step 4: Format, validate and test**

Run: `cd dystopia/lambda/aws/modules && tofu fmt -recursive && tofu init -backend=false -input=false -no-color > "$SCRATCH/tofu.log" 2>&1; tofu validate -no-color >> "$SCRATCH/tofu.log" 2>&1; tofu test -no-color >> "$SCRATCH/tofu.log" 2>&1; echo "tofu exit $?"; tail -20 "$SCRATCH/tofu.log"; sh tests/contract_test.sh > "$SCRATCH/contract.log" 2>&1; echo "contract exit $?"`
Expected: `tofu exit 0`（全 run が pass）、`contract exit 0`。`.terraform/` と `.terraform.lock.hcl` は commit しない（`git status` で確認し、未追跡なら消す）

- [ ] **Step 5: Document the environment variables**

`docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md` のアプリ用関数の環境変数の表で、`STRIPE_*` / `BILLING_*` の行の次に足す:

```markdown
| `VAPID_PRIVATE_KEY` | `tls_private_key`（ECDSA P-256）の PEM。作り直すと全端末の Web Push 購読が無効になる |
| `VAPID_SUBJECT` | `https://dystopia.city` |
```

同じ文書の「task 用関数は `DATABASE_URL`、`STRIPE_*` / `BILLING_*`、`MEDIA_BUCKET_*`、`COGNITO_*` をアプリ用と同じ値で持つ」の列挙に `VAPID_*` を足す。

- [ ] **Step 6: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-dystopia-web-push
git add dystopia/lambda/aws/modules docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md
git status --porcelain
git commit -s -m "feat(dystopia): issue the VAPID key for the Lambda deployment"
```

---

### Task 8: Verify end to end on a local stack (controller)

実装担当には渡さず、全タスクの後に controller が行う。

- [ ] **Step 1: Run the full suites**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec > "$SCRATCH/rspec-all.log" 2>&1; tail -5 "$SCRATCH/rspec-all.log"` と `cd dystopia/frontend && pnpm exec vitest run && env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: 0 failures、`tsc exit 0`

- [ ] **Step 2: Start the local stack with a VAPID key**

`reference_local_e2e_run` の手順（使い捨て DB、`bin/grpc` を 9055、`next dev` を 3055）で起動する。`bin/grpc` の環境には `VAPID_PRIVATE_KEY="$(openssl ecparam -name prime256v1 -genkey -noout)"` と `VAPID_SUBJECT=https://dystopia.city` を足す。

- [ ] **Step 3: Subscribe from Chrome and receive a push**

インストール済みの Google Chrome（FCM の鍵を持つ）を puppeteer-core で headful 起動し、`Browser.grantPermissions` で `localhost:3055` に通知を許可する。プロフィール A でサインインし、設定画面で「この端末で受け取る」をオンにする。別のアカウント B から A の投稿にいいねする。A のページで `(await navigator.serviceWorker.ready).getNotifications()` に「B の表示名 / あなたの投稿にいいねしました」が 1 件あることを確かめる。通知の `data.url` を開き、`/posts/<id>` に移ることを確かめる。

- [ ] **Step 4: Record what could not be checked**

FCM に届かない、またはヘッドフルの Chrome が使えない場合は、その事実を記録して報告する。本番での iOS の PWA と Lambda からの IPv6 の配信はユーザーの端末で確かめる。
