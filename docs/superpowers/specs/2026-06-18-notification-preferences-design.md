# Notification Preferences Design — per-account toggles + emit/footprint gating

Date: 2026-06-18
Status: Backfill spec (documents shipped implementation — #738 / #739 / #740 / #741 / #742)
Scope: `2026-06-16-notifications-slice-design.md` の Deferred 項目「mark all read / per-trigger mute」を実装した preferences feature を後追いで文書化する。account 単位の通知設定 (12 toggle) を新 `notifications.preferences` 表に永続化し、emit 側 (per-type 抑制) と footprints 訪問記録 (visitor opt-out) のゲートに使う。併せて mark-all-read RPC と COMMENT/REPLY deep-link (`target_post_id`) を追加した。

Related:
- `2026-06-16-notifications-slice-design.md` (本 spec の母体。当時 Decisions で「mark all read / per-trigger mute は v1 drop、別 PR」と明記)
- `2026-06-18-footprints-design.md` (`footprints_record_my_visits` opt-out は本 spec の preferences 表に同居)

## Goal

通知の受信を account ごとに制御できるようにする。具体的には:

1. **per-type mute** — like / post / reply / follow などの種別ごとに通知を抑制する
2. **push master switch** — `push_enabled` 一括 off ですべての種別を止める素地 (実 push provider は未接続、UI/gating のみ)
3. **footprint badge 表示制御** — 足跡未読バッジを出すか
4. **footprint visitor opt-out** — 自分が他人を訪問したとき足跡を残すか (#742)

加えて inbox 体験の補完として **mark all read** (#740) と **COMMENT/REPLY の deep-link** (#741) を入れる。

## Grounding

- 母体 spec (`2026-06-16-notifications-slice-design.md`) の Decisions 表で `mark all read / per-trigger mute` は「v1 drop、別 PR」と明記済。本 feature はその回収。
- `notifications.notifications` 1 表 + Emit の fire-and-forget パターンは母体 spec で確立済。本 feature はそこに preferences 表と読み取りゲートを足す形。
- footprints slice は `Notifications::Slice["use_cases.get_preferences"]` を cross-slice 呼出して visitor opt-out を判定する (#742)。preferences 表が footprints と notifications の共有設定面になる。

## Decisions

| 項目 | 決定 | Why |
|---|---|---|
| preferences 格納先 | `notifications.preferences` 新表 (PK = `account_id`) | 設定は account 単位 1 行で十分。type ごとの行展開はしない |
| 新規 account の扱い | 行が無ければ **default-all-true** を返す。signup 時の eager insert はしない | 初回 update まで行を作らず、UI は default で描画できる |
| update セマンティクス | 全 field を受け取って upsert。初回は行を作成 | partial patch ではなく full replace。frontend hook 側で merge してから送る |
| per-type gating の対象 | emit 時に recipient preferences を読み、type→toggle map で skip | 通知は fire-and-forget なので source action を阻害しない |
| unknown type | **fail open** (抑制しない) | map 未登録の type は通知を握りつぶさない方が安全 |
| push provider | 未接続。`push_enabled` は UI + gating の素地のみ | FCM/APNS/Web Push 選定は別 track (handoff doc Section 11.3) |
| footprint opt-out の置き場所 | footprints 専用表ではなく notifications.preferences の 12 列目 | 「通知/プライバシー設定」として 1 つの設定面に集約 (#742) |

## Domain model

### Schema

母体 spec の `notifications` schema に 1 表追加:

```sql
CREATE TABLE notifications.preferences (
  account_id                   uuid        NOT NULL,
  push_enabled                 boolean     NOT NULL DEFAULT true,
  post                         boolean     NOT NULL DEFAULT true,
  like                         boolean     NOT NULL DEFAULT true,
  repost                       boolean     NOT NULL DEFAULT true,
  quote                        boolean     NOT NULL DEFAULT true,
  reply                        boolean     NOT NULL DEFAULT true,
  follow                       boolean     NOT NULL DEFAULT true,
  mention                      boolean     NOT NULL DEFAULT true,
  message                      boolean     NOT NULL DEFAULT true,
  oshi                         boolean     NOT NULL DEFAULT true,
  footprint_unread_badge       boolean     NOT NULL DEFAULT true,
  footprints_record_my_visits  boolean     NOT NULL DEFAULT true,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id)
);
```

Migrations:
- `20260618200000_create_notification_preferences` — 11 列で作成 (`push_enabled` + 9 type toggle + `footprint_unread_badge`)
- `20260618230000_add_footprints_record_my_visits_to_preferences` — 12 列目を追加 (#742)
- `20260618220000_add_target_post_id_to_notifications` — `notifications.notifications` に `target_post_id uuid NULL` を追加 (#741 deep-link)

ROM relation は `notifications.preferences` を `as: :preference_records` で expose する (slice 名 `notifications` との alias 衝突回避。母体 spec の N1 lesson に従う)。

### Toggle field の意味と現状の配線

9 個の type toggle のうち、emit gating に実配線されているのは **like / post / reply / follow** のみ。`repost` / `quote` / `mention` / `message` / `oshi` は UI・schema に存在するが、対応する通知種別が proto enum (`NOTIFICATION_TYPE_*` = LIKE / COMMENT / REPLY / FOLLOW_REQUEST / FOLLOW_APPROVED) にまだ無いため、現状は将来種別の受け皿として永続化のみ。

emit 側の type→toggle マッピング (`Notifications::UseCases::Emit::PREFERENCE_FIELD_BY_TYPE`):

| notification type | toggle field | Note |
|---|---|---|
| `like` | `like` | |
| `comment` | `post` | rx-sns に comment 専用 toggle が無いため「ポスト」を最寄りとして流用 |
| `reply` | `reply` | |
| `follow_request` | `follow` | FOLLOW_REQUEST / FOLLOW_APPROVED が単一 `follow` toggle を共有 |
| `follow_approved` | `follow` | 同上 |

## API contract — `notifications.v1`

母体 service に RPC を追加:

```proto
service NotificationService {
  // ... (母体: ListNotifications / GetUnreadCount / MarkRead)
  rpc MarkAllRead(MarkAllReadRequest) returns (MarkAllReadResponse);                                    // #740
  rpc GetNotificationPreferences(GetNotificationPreferencesRequest) returns (GetNotificationPreferencesResponse);
  rpc UpdateNotificationPreferences(UpdateNotificationPreferencesRequest) returns (UpdateNotificationPreferencesResponse);
}

message MarkAllReadResponse { int32 affected = 1; }  // 既読化した未読行数

message NotificationPreferences {
  bool push_enabled = 1;
  bool post = 2;
  bool like = 3;
  bool repost = 4;
  bool quote = 5;
  bool reply = 6;
  bool follow = 7;
  bool mention = 8;
  bool message = 9;
  bool oshi = 10;
  bool footprint_unread_badge = 11;
  bool footprints_record_my_visits = 12;  // false = visitor opt-out (足跡を残さない)
}
```

`Notification` message には `string target_post_id = 8;` が追加された (COMMENT / REPLY のみ非空 = 親 post の deep-link 先、#741)。

## Monolith notifications slice

### Use cases

- **`GetPreferences#call(account_id:)`** — 行が無ければ `DEFAULT_PREFERENCES` (全 true) を複製して返す。行があれば全 12 key を hash 化して返す。
- **`UpdatePreferences#call(account_id:, preferences:)`** — 全 field を `upsert_preferences` で upsert。戻り値は更新後の全 field hash。
- **`Emit#call(...)`** — 既存の self-action skip / block-aware skip に加え、`type_enabled_for?(recipient_id, type)` を判定。map 未登録 type は fail open。失敗時は `nil` を返し source action を阻害しない (fire-and-forget)。

### Cross-slice gating

- **emit gating (#739)**: `Notifications::UseCases::Emit` が recipient の preferences を読んで per-type skip。
- **footprint visitor opt-out (#742)**: `Footprints::UseCases::RecordVisit` が visitor の preferences を `Notifications::Slice["use_cases.get_preferences"]` 経由で読み、`footprints_record_my_visits != true` なら upsert を no-op。

## Frontend

- **`useNotificationPreferences` hook** — SWR (`/api/notifications/preferences`, `revalidateOnFocus: false`)。`update(partial)` は現状 preferences に merge して **optimistic mutate** → PUT → 確定値で再 mutate。失敗時は `revalidate: true` で rollback。
- **`NotificationSettings` component** (Settings tab) — 3 section:
  1. push master switch (`push_enabled`)
  2. push 個別設定 9 toggle (master off 時は disabled)
  3. その他: 足跡未読バッジ (`footprint_unread_badge`) / 訪問時に足跡を残す (`footprints_record_my_visits`)
- **mark-all-read (#740)** — `/api/notifications/mark-all-read` BFF + 通知ページ「全て既読にする」ボタン。
- **Drawer footprint badge gating (#739)** — `preferences.footprintUnreadBadge !== false` のとき足跡未読バッジを表示。off なら badge count を 0 に潰す。

## BFF routes

| route | method | maps to |
|---|---|---|
| `/api/notifications/preferences` | GET | `GetNotificationPreferences` |
| `/api/notifications/preferences` | PUT | `UpdateNotificationPreferences` |
| `/api/notifications/mark-all-read` | POST | `MarkAllRead` |

## Decomposition (実装済 PR)

| PR | スコープ |
|---|---|
| #738 | Persistence: preferences 表 (11 列) + Get/Update RPC + Settings tab + hook + BFF |
| #739 | Gating: `Emit` per-type skip + Drawer footprint badge を preferences 読みでゲート |
| #740 | `MarkAllRead` RPC + 通知ページ「全て既読にする」ボタン |
| #741 | COMMENT/REPLY deep-link: `notifications.target_post_id` 列 + proto field |
| #742 | Footprints visitor opt-out: 12 列目 `footprints_record_my_visits` + `RecordVisit` guard |

## Deferred / out of scope

- **実 push 配信** — `push_enabled` は UI + gating の素地のみ。FCM / APNS / Web Push 選定は handoff doc Section 11.3 / 12.3 の MVP feature freeze 判断待ち。
- **repost / quote / mention / message / oshi の emit 配線** — toggle は永続化済だが、対応する notification type が未実装。proto enum 拡張時に `PREFERENCE_FIELD_BY_TYPE` へ追加する。
- **per-trigger 以上の粒度** (account 別ミュート等) — 想定なし。

## Verification

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/notifications
env -u NODE_OPTIONS bundle exec rspec spec/slices/footprints   # RecordVisit opt-out guard

cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm build
```
