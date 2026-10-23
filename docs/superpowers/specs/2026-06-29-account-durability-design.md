# Account Durability Design

Date: 2026-06-29
Status: Design spec (implementation-ready)
Scope: 北極星 (`docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md`) 柱 A「集客力の安定」の `durability` 部分を実装する。MVP の最後の sub-project (auth/onboarding ✅ → karte ✅ → 本 spec)。「audience / データの export」要件は本 spec で MVP から外す。

由来: 北極星 doc が「凍結しない (永久 BAN 機構を持たない)」「アカウント / オーディエンスの永続性」「export」の 3 要件を MVP に挙げていたが、brainstorm の結論として export は不要 (「凍結しない」自体が "顧客を失わない" を担保するため冗長) とし、本 sub-project は **「凍結しない / 永続性」の不変保証 + 本人退会 (2-stage soft→hard)** に scope を絞る。

## Concept

「凍結しない」は de-facto 既に実現済み — codebase に admin による永久 BAN / 永久削除 / suspend 機構は一切存在しない (2026-06-29 grep 確認)。本 spec はこの状態を不変条件として明文化し、加えて **Cast 自身による退会 (2-stage soft-delete → 30-day grace → hard-delete)** を実装する。

- 「凍結しない」= 運営/admin がアカウントを永久停止/削除する経路を作らない (不変、コード追加でなくコード追加禁止)
- 「永続性」= followers / profile / posts / 履歴は Cast の資産。運営が単独で消せない
- 「本人退会」= mainstream SNS (X / Instagram / Facebook) と同じ 2-stage モデル。grace 中の login で auto-reactivate

## Decisions

| 項目 | 決定 |
|---|---|
| export 機能 | **MVP 外** (北極星 doc を update してダウングレード)。「凍結しない」自体が顧客を失わない保証なので export は冗長 |
| 退会モデル | 2-stage: deactivate → grace 期間 → hard-delete cron |
| grace 期間 | **30 日** (X / Instagram / Facebook 業界標準) |
| admin override | **不可**。hard-delete trigger は本人退会 + grace 経過 cron だけ。admin の介入経路を一切作らない (= 「凍結しない」不変と完全一貫) |
| Login on deactivated | **auto-reactivate + login 成功** (Instagram スタイル)。同じ phone + password で OTP 通れば deactivated_at を null に戻して通常応答 |
| cascade 範囲 | **karte 以外**は全 cascade (profile / posts / likes / comments / follows / blocks / bookmarks / footprints / notifications / media)。**karte (Cast 自身が書いた entries) は残置** — 他 Cast の安全情報としての価値を保つ |
| karte 残置の運用 | author の profile lookup が nil の時 frontend は `"(退会済)"` 表示。「残した後どうするか」はリリース後に再検討 |
| messaging cascade | **sender null 化** (mainstream パターン) — thread / messages は残す、`messages.sender_id` を null、`threads.account_a/b` を null。`read_states` は PK 制約上 cascade delete |
| media cascade | 現状 `media__files` に owner 情報なし。本 spec で **`uploader_account_id` 列を NULLABLE で追加** + Upload use_case を optional param で拡張 (新規 upload のみ owner 記録)。Media.PurgeAccount は `uploader_account_id = self` を delete (新規分のみ)。**既存 caller 全件更新 + backfill + NOT NULL 化 + 物理 object storage cleanup は MVP scope 外** (将来「Media uploader tracking 移行」sub-project で処理)。本 sub-project は「将来 clean モデルに進む土台」を作るだけ |
| cascade 実装方式 | application-level (cross-schema FK 未使用のため)。各 slice に `PurgeAccount` use_case、identity の `PurgeDeactivatedAccounts` が orchestrate |
| hard-delete trigger | rake task `account:purge_deactivated`、production で cron が呼ぶ運用 (cron 設定は本 spec scope 外) |
| 一時ペナルティ (時限的 disable) | MVP 外 (北極星 doc どおり)。将来の運用検討 |

## Invariants (明文化、将来も守る)

以下を本 spec 以降も継続的に守る:

1. **永久 BAN / 永久 suspend / 永久削除を admin が単独で実行できる API / コード経路を作らない**。codebase に grep でヒットしないことを保証。
2. **hard-delete の唯一の trigger は (本人 deactivate request) AND (grace 期間経過)**。admin が grace を短縮する経路も作らない。
3. **followers / profile / posts (+karte entries) は Cast 自身の退会以外で消えない**。運営側からの単独削除手段を持たない。
4. **将来「一時ペナルティ」(時限的 disable) を導入する場合は本 spec を改定し、reversibility (本人または時間経過で必ず解除される) を不変条件として spec に書く**。

## Grounding (現状 main、post-#765)

- identity slice 全 use_cases: `auth/{register,login,logout,reset_password}`, `token/refresh`, `user/get_profile`, `verification/{send_code,verify_code}`。**admin 系 use_case / RPC は存在しない**。
- 全 slice 上で `force.?delete|hard.?delete|permanent|suspend|disable.?account|deactivate|admin.?delete|destroy_account|ban_account` を grep → ヒット 0
- 永続列 = `identity__users(id, phone_number, password_digest, role, failed_login_attempts, locked_until, created_at, updated_at)`。`deactivated_at` 列なし (本 spec で追加)
- cross-schema FK = なし (memory `feedback_no_negative_legacy` 系で確認済)。application-level cascade を採る根拠
- karte: `karte__access(account_id PK)`、`karte__entries(author_account_id, target_account_id, ...)`、`karte__reports(reporter_account_id, ...)`

## A. Schema (backend)

### identity (新規 migration)

`identity__users` に列追加:

| column | type | note |
|---|---|---|
| `deactivated_at` | timestamptz | NULL = active、値あり = deactivated。`deactivated_at + 30 days` 経過で hard-delete cron が拾う。scheduled_delete_at は不要 (計算で出る) |

relation `Users` に `attribute :deactivated_at, Types::Time.optional` を追加。

### media (新規 migration)

`media__files` に列追加:

| column | type | note |
|---|---|---|
| `uploader_account_id` | uuid | **NULLABLE**。新規 upload で書き込み開始、既存行は NULL (backfill MVP scope 外)。NOT NULL 化は将来の「Media uploader tracking 移行」sub-project で |

relation `Files` に `attribute :uploader_account_id, Types::String.optional` を追加。

### messaging (新規 migration)

`messaging__messages` および `messaging__threads` の制約緩和:

- `messaging__messages.sender_id` を nullable に変更 (`ALTER TABLE messaging.messages ALTER COLUMN sender_id DROP NOT NULL`)
- `messaging__threads.account_a` と `account_b` を nullable に変更

`read_states` は composite PK `(thread_id, account_id)` の都合上 nullable 化不可。cascade delete のみ。

## B. Use cases

### Identity slice

**`DeactivateAccount`** (新規)
- 入力: `viewer_account_id`
- viewer = self、deactivated_at = now を user_repo に set
- 失敗条件なし (idempotent — 既に deactivated でも no-op)
- 返り値: nil

**`PurgeDeactivatedAccounts`** (新規、cron orchestrator)
- 入力: `now` (= Time.now、テストで stub 可)
- `user_repo.list_deactivated_before(now - 30.days)` で対象 user 一覧
- 各 user について順番に:
  - 各 slice の `PurgeAccount` を呼ぶ: `Profile::Slice["use_cases.purge_account"].call(account_id: u.id)` … (8 slice 分)
  - 最後に `Identity::UseCases::Purge::PurgeIdentity.call(account_id: u.id)` で identity__users 本体 + 関連 (refresh_tokens, sms_verifications) を消す
- 失敗時の挙動: 1 user の purge が失敗したら次に進む (個別失敗が batch 全体を止めない)、ログ出力

**`Login` 改訂**
- 既存 use_case 内で `user.deactivated_at` を check
- 値あり → `user_repo.reactivate(user.id)` (= deactivated_at を nil に set) してから既存の token 発行ロジック続行
- 返り値に `reactivated: bool` フィールドを追加 (UI が「お帰りなさい」hint に使う、必須ではない)

**`ReactivateAccount`** は **RPC として expose しない**。`Login` use_case の private helper として `user_repo.reactivate` を直接呼ぶ。

### 各 slice の `PurgeAccount` use_case

ファイル: `slices/<slice>/use_cases/purge_account.rb`。入力 `account_id`、返り値 nil、idempotent。

| slice | 削除する rows |
|---|---|
| Profile | `profile__profile_areas` (profile_id = self) → `profile__profiles` (account_id = self) |
| Post | `post__likes` (account_id = self) → `post__comments` (account_id = self) → `post__posts` (author_account_id = self) (関連 post_media / hashtags は post_id 経由で連鎖 — 既存 FK or 同 use_case 内で順次 delete) |
| Social | `social__follows` (follower_id = self OR followee_id = self) → `social__blocks` (blocker_id = self OR blocked_id = self) |
| Bookmarks | `bookmarks__bookmarks` (account_id = self) |
| Footprints | `footprints__visits` (visitor_account_id = self OR visited_account_id = self) |
| Notifications | `notifications__notifications` (recipient_account_id = self OR actor_account_id = self) → `notifications__preferences` (account_id = self) |
| Media | `media__files` (uploader_account_id = self) を delete。**uploader_account_id 列は本 spec で新規追加 (NULLABLE)**、新規 upload のみ owner 記録、既存 orphan + 物理 file は残置 (将来 cleanup)。Upload use_case に optional `uploader_account_id` param を追加。**既存 caller (Profile / Post 等) の更新は MVP scope 外** (将来「Media uploader tracking 移行」sub-project) |
| Karte | `karte__access` (account_id = self) → `karte__reports` (reporter_account_id = self)。**`karte__entries` (author_account_id = self) は touch しない (残置)** |
| Messaging | `messaging__read_states` (account_id = self) を delete → `messaging__messages.sender_id` を `UPDATE SET sender_id = NULL WHERE sender_id = self` → `messaging__threads.account_a` / `account_b` の self 参照を `UPDATE SET account_a = NULL WHERE account_a = self` (同様 account_b) |

`PurgeDeactivatedAccounts` orchestrator は上記を以下の順序で呼ぶ (依存関係のないものは順序不問だが、明示順):

```
PurgeAccount を以下の順で呼ぶ:
1. Notifications (他 slice の参照を最小化、軽い)
2. Footprints
3. Bookmarks
4. Karte
5. Messaging
6. Social
7. Post (Profile の前 — profile の photo 参照等を post が持つ可能性)
8. Media
9. Profile
最後に Identity の PurgeIdentity (refresh_tokens / sms_verifications / users 本体)
```

### Identity slice の `PurgeIdentity`

ファイル: `slices/identity/use_cases/user/purge_identity.rb`。入力 `account_id`、返り値 nil。

- `identity__refresh_tokens` (user_id = self) を delete
- `identity__sms_verifications` (phone_number = self.phone_number) を delete (user を fetch して phone を引く必要があるので user fetch を先に)
- `identity__users` (id = self) を delete

`PurgeDeactivatedAccounts` の最後に呼ばれる。

## C. gRPC API

proto `identity/v1/service.proto` に 1 RPC 追加:

```proto
service IdentityService {
  // ...既存 RPC...
  rpc DeactivateAccount(DeactivateAccountRequest) returns (DeactivateAccountResponse);
}

message DeactivateAccountRequest {}
message DeactivateAccountResponse {}
```

`Login` の `LoginResponse` に `reactivated: bool` フィールドを追加 (proto 拡張、後方互換)。

`PurgeDeactivatedAccounts` は **RPC でなく rake task として expose**。`bundle exec rake account:purge_deactivated`。

handler の RPC エラー mapping (既存 pattern 踏襲): use_case が raise した場合は `INVALID_ARGUMENT` 等、認証エラーは `UNAUTHENTICATED`。`DeactivateAccount` は idempotent なので失敗パスは少ない。

## D. Frontend

### 退会 UI

**設定ページ** に「アカウントを退会」セクション (新規)。

- ボタン: 「退会する」(`destructive` style)
- ボタン押下で confirm modal:
  - 文言: 「アカウントを退会しますか？
    - 30 日以内に同じ電話番号で login すれば自動的に復活します。
    - 30 日経過後、データは消えます。
    - **カルテに残した記録は、他の Cast の安全情報として残ります。**」
  - 「退会」ボタンと「キャンセル」ボタン
- 「退会」確定で `POST /api/identity/deactivate` (BFF) → `Identity::DeactivateAccount` RPC
- 成功で `authStore.clearIdentity()` + cookie clear + `/` redirect

### Login 後の "reactivated" toast

`LoginResponse.reactivated == true` のとき、login 完了画面で 1 回だけ toast:
- 「お帰りなさい。アカウントは復活しました。」

実装: useAuth の login 関数で response.reactivated を受け、UI 通知 hook を呼ぶ。

### Karte entry author fallback

`KarteEntryCard.tsx` の author hydration:
- `entry.authorUsername` が空 (= author profile が見つからない、= 退会済) のとき:
  - username 表示 = `"(退会済)"`
  - avatar = グレースケール placeholder (既存の `bg-muted` で代用可)

### DM message sender fallback

`messaging` モジュールの message 表示コンポーネントで:
- `message.senderId == null` (= sender 退会) のとき:
  - sender 名表示 = `"(退会)"`
  - avatar = グレースケール placeholder

### BFFs (新規)

- `POST /api/identity/deactivate` → `Identity::DeactivateAccount` RPC。auth-hardening の cookie mediation に乗る (`requireAuth(req)` + `buildGrpcHeaders(req)`)
- `LoginResponse.reactivated` は既存 `POST /api/identity/sign-in` BFF を改修して body に含める

## E. Operations (本 spec scope 外、運用 doc 化)

- `account:purge_deactivated` を production cron で 1 日 1 回呼ぶ運用
- media object storage の孤児 file cleanup は別 sub-project (将来)

## Decomposition

| # | scope | 層 |
|---|---|---|
| D1 | identity schema (deactivated_at migration + relation update) | backend |
| D2 | identity `DeactivateAccount` use_case (TDD) + Login 改訂 (deactivated check + auto-reactivate + reactivated flag) (TDD) | backend identity |
| D3 | identity proto: `DeactivateAccount` RPC + `LoginResponse.reactivated` 追加 + stub regen + handler 追加 | backend identity |
| D4 | messaging schema migration (sender_id nullable + threads.account_a/b nullable) | backend messaging |
| D4b | media schema migration (uploader_account_id NULLABLE 追加 + relation 属性追加 + Media Upload use_case に optional param) | backend media |
| D5 | 8 slice の `PurgeAccount` use_case 一括: profile / post / social / bookmarks / footprints / notifications / media / karte (各 slice ごとに 1 PR or 合体は plan で判断) | backend (8 slices) |
| D6 | messaging の Purge: sender null 化 + threads.account_a/b null 化 + read_states cascade | backend messaging |
| D7 | identity `PurgeIdentity` use_case + `PurgeDeactivatedAccounts` cron orchestrator + rake task | backend identity (orchestrator) |
| D8 | frontend BFF: `POST /api/identity/deactivate` + sign-in BFF に reactivated 追加 | frontend BFF |
| D9 | frontend UI: 退会 ボタン + confirm modal + 退会後 redirect + reactivated toast | frontend |
| D10 | frontend null fallback: karte entry author "(退会済)" + DM sender "(退会)" | frontend |
| D11 | 北極星 doc update (export を MVP 必須 → MVP 外 にダウングレード) — 別 commit | docs |

writing-plans 段で合体・分割を再判断。`PurgeAccount` の 8 slice は機械的なので 1〜2 PR にまとめ可能。

## Verification

backend:
```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity spec/slices/karte spec/slices/profile spec/slices/post spec/slices/social spec/slices/bookmarks spec/slices/footprints spec/slices/notifications spec/slices/messaging spec/slices/media
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate
```

frontend:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint   # 0e/0w
env -u NODE_OPTIONS pnpm build
```

成功基準 (MVP):

- Cast が settings から「退会」を押すと `deactivated_at` が立ち、login も他人視点での見え方も deactivated になる (具体的にはタイミング次第で karte entries 以外見えない)
- grace 30 日以内に同じ phone で login すると auto-reactivate して通常通り使える、`reactivated: true` が返る
- grace 30 日経過後に `account:purge_deactivated` を実行すると、対象 user の全 slice 関連データが消える (karte entries と messaging thread/messages は残置、karte entries の author lookup は null、DM messages の sender_id は null)
- admin 経路から永久削除/BAN/suspend する API が一切存在しない (grep で確認)
- 北極星 doc が export を MVP 外に降格していること
- 既存 spec 全 green (identity + karte + profile + post + social + bookmarks + footprints + notifications + messaging + media)
- frontend tsc / lint(0e/0w) / build green
