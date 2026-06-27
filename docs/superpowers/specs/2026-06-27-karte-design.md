# Karte Design

Date: 2026-06-27
Status: Design spec (implementation-ready)
Scope: 北極星 (`docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md`) の柱 B「自己防衛」の核 = karte (Cast 間 Guest 評価共有) を新規 slice として greenfield 構築する。並行して、方向の真逆な旧 `trust` slice (guest→cast 公開 review) を完全 destroy する。法務は北極星の方針どおり product 確立後に defer (本 spec 対象外)。

由来: 北極星が「最大の未知、独立 brainstorm/spec 必須」と明記。前段 brainstorm で MVP 用途・lookup key・共有範囲・abuse 対策・可視性・edit 権限・paywall 境界を決着。

## Concept

karte は Cast にだけ見える Guest 評価 DB。

- **使われる瞬間**: 指名・予約直前の素性チェック (read 主体)。書きは事後 (接客後)。
- **対象 Guest**: **本プラットフォーム登録済 Guest だけ** (account_id ベース)。電話番号/SNS handle 等は lookup key にしない (個人情報リスク・同名出魔・名誉毀損リスク回避)。
- **可視性**: 完全 silent。Guest 側 UI には一切表示せず、Guest からの異議申し立て経路を MVP では持たない。
- **読み手**: 全 Cast。ただし `karte__access` がある Cast のみ。
- **書き手**: 同上。

**Why silent**: ① 北極星「凍結しない」と摩擦しない (公開晒しでなく内部秘密)、② 書き手の心理的安全性最大、③ 「指名前 5 秒判定」の Cast 視点では Guest 可視性は不要。代償として「被害 Guest が虚偽 karte に反論できない」リスクを残すが、これは abuse 対策 (下記) と admin 介入で抑える。

## Decisions

| 項目 | 決定 |
|---|---|
| 対象 Guest 識別 | `account_id` (本プラットフォーム登録済 Guest のみ) |
| 記録項目 | `rating` (1-5) + `body` (任意、最大 500 文字) |
| target role 検証 | use_case 層で `target.role == GUEST` を要求 (DB 制約は使えない) |
| 1 author × 1 guest の重複 | 許可 (時系列で複数 entry 可、unique 制約なし) |
| Guest 可視性 | 完全 silent (Guest UI なし) |
| 読み手範囲 | 全 Cast + `karte__access` 必要 |
| 利用ゲート | `karte__access` table の存在判定 (boolean に等価)。MVP 付与は **DB 直 SQL** で手動 (`INSERT INTO karte__access (account_id, granted_at, granted_by) VALUES (...)`)。self-serve 課金は別 sub-project |
| abuse 対策 | ① author identity 透明化 (read 時に author Cast の username/avatar を表示)、② Cast 間 `ReportEntry` (内部シグナル、admin 巡回用)、③ `flagged: bool` (`reported_count >= 3`) を read API で公開、raw `reported_count` は非公開 |
| edit/delete | 書き手いつでも可 (SNS と同じ) |
| 旧 trust slice | 同 sub-project 内で完全 destroy (T1〜T4)。pre-prod ゆえ DB DROP も含む |
| aggregate 計算 | `count` / `avg_rating` は flagged も含む全 entry で集計 (シンプル、abuse 経路を作らない) |
| paywall 拡張余地 | `karte__access` は別 table で `granted_at` / `granted_by` を持つ。後で `expires_at` や `plan_id` を加える形で Stripe 等を後付け可 |
| Guest 可視性の将来余地 | 本 MVP では visibility 列を持たない。後で per-entry public モードを足す際に追加 |

## Grounding

post-#763 main を基点。

- identity slice: `Users(id, phone_number, password_digest, role, failed_login_attempts, locked_until, created_at, updated_at)`、role = 1 (GUEST) / 2 (CAST)
- profile slice: `Profiles(account_id PK, username, display_name, avatar_media_id, ...)`、`ListProfilesByAccountIds` で username/avatar を hydrate するパターンが social/feed で既に確立
- social slice: 既存の cross-slice adapter swap パターン (`Profile::Slice[...]`) を踏襲
- 旧 trust slice: `slices/trust/`, `proto/trust/v1`, frontend `modules/trust/` + `app/api/{cast,me,shared}/trust/*`, DB `trust__{reviews,review_media,tags,taggings}` (migration 6 本)。bin/grpc 登録あり、Profile adapter から参照されているかは plan 段で grep 確認

## A. Schema (backend)

新規 migrations。

### `karte__entries`

| column | type | note |
|---|---|---|
| `id` | uuid | PK |
| `author_account_id` | uuid | NOT NULL、FK 相当 (identity__users。実 FK は cross-schema のため貼らず、existing convention) |
| `target_account_id` | uuid | NOT NULL、FK 相当 (identity__users) |
| `rating` | integer | NOT NULL、CHECK (1..5) |
| `body` | text | NULL 可、長さ上限は contract で 500 文字検証 |
| `reported_count` | integer | NOT NULL DEFAULT 0、Cast 間 report の uniq 件数 |
| `created_at` | timestamptz | NOT NULL DEFAULT now |
| `updated_at` | timestamptz | NOT NULL DEFAULT now |

index:
- `(target_account_id, created_at DESC, id DESC)` = read 主経路 (`ListEntriesByTarget`)
- `(author_account_id, created_at DESC, id DESC)` = `ListMyEntries`

### `karte__access`

| column | type | note |
|---|---|---|
| `account_id` | uuid | PK (Cast の id) |
| `granted_at` | timestamptz | NOT NULL |
| `granted_by` | text | NULL 可、付与者メモ (`"admin: <name>"` / `"seed"` 等のフリーテキスト) |

### `karte__reports`

| column | type | note |
|---|---|---|
| `id` | uuid | PK |
| `entry_id` | uuid | NOT NULL (karte__entries の id を参照) |
| `reporter_account_id` | uuid | NOT NULL |
| `reason` | text | NULL 可、任意の理由テキスト |
| `created_at` | timestamptz | NOT NULL DEFAULT now |

unique: `(entry_id, reporter_account_id)` (同 Cast の二重 report 禁止、`ON CONFLICT DO NOTHING` で no-op)。

report 時に `karte__entries.reported_count += 1` を atomic 実行。

## B. Repositories

- `entry_repository`: create / update / delete / find_by_id / list_by_target (cursor) / list_by_author (cursor) / aggregate(target_account_id) → `{count, avg_rating}` / `increment_reported_count(id)`
- `access_repository`: find_by_account / grant(account_id, granted_by) / revoke(account_id) (revoke は MVP では使わなくても API 整合のため定義)
- `report_repository`: create(entry_id, reporter_account_id, reason) (UNIQUE 違反は `ON CONFLICT DO NOTHING` 相当で握りつぶし)

cursor は既存 slice の `(created_at, id)` 複合 cursor を踏襲。

## C. Use cases

`karte::use_cases::*`。

### `CreateEntry`

入力: `viewer_account_id, target_account_id, rating, body?`
- viewer access 検証 (`access_repository.find_by_account(viewer)` 必須)
- target 検証: `identity::user_repository.find_by_id(target_account_id)`、`role == GUEST` でなければ `CreateError, "Target must be a guest"`
- contract: `rating ∈ 1..5`、`body == nil or body.length <= 500`
- `entry_repository.create` → entry を返す

### `UpdateEntry`

入力: `viewer_account_id, entry_id, rating?, body?`
- viewer access 検証
- `entry = entry_repository.find_by_id`、`entry.author_account_id == viewer` を要求 (他人の entry は更新不可)
- 部分更新 (`rating` / `body` 指定があれば差し替え) + `updated_at = now`

### `DeleteEntry`

入力: `viewer_account_id, entry_id`
- viewer access + author 一致を要求
- `entry_repository.delete(entry_id)` (associated reports は cascade させない。reports は監査記録なので残す)

### `ListEntriesByTarget`

入力: `viewer_account_id, target_account_id, cursor?, limit?`
- viewer access 検証
- `entry_repository.list_by_target(target, cursor, limit)` で entries 取得
- `entry_repository.aggregate(target)` で `{count, avg_rating}` 取得 (flagged 込みの全 entry を集計)
- author hydration: `profile::list_profiles_by_account_ids(authors)` で username/avatar を解決 (cross-slice、既存 pattern)
- response 構築: `KarteEntry { ..., flagged: reported_count >= MIN_FLAG_REPORTS }`、`MIN_FLAG_REPORTS = 3` (定数)

### `ListMyEntries`

入力: `viewer_account_id, cursor?, limit?`
- viewer access 検証
- `entry_repository.list_by_author(viewer, cursor, limit)`
- author = viewer なので author hydration は不要 (frontend 側で viewer profile を使う) だが、API 一貫性のため hydration して返す

### `ReportEntry`

入力: `viewer_account_id, entry_id, reason`
- viewer access 検証
- `entry = entry_repository.find_by_id`、存在しなければエラー
- `entry.author_account_id != viewer` を要求 (自分の entry は report 不可)
- `report_repository.create(entry_id, viewer, reason)` + `entry_repository.increment_reported_count(entry_id)`、UNIQUE 違反時は両方とも no-op

### `GetMyAccess`

入力: `viewer_account_id`
- `access_repository.find_by_account(viewer)` で `{has_access: bool, granted_at?: time}` を返す
- access 不要 (Cast なら誰でも呼べる、access 自体を聞きに来る経路)

## D. gRPC API

proto: `proto/karte/v1/service.proto` を新規。

```proto
service KarteService {
  rpc CreateEntry(CreateEntryRequest) returns (CreateEntryResponse);
  rpc UpdateEntry(UpdateEntryRequest) returns (UpdateEntryResponse);
  rpc DeleteEntry(DeleteEntryRequest) returns (DeleteEntryResponse);
  rpc ListEntriesByTarget(ListEntriesByTargetRequest) returns (ListEntriesByTargetResponse);
  rpc ListMyEntries(ListMyEntriesRequest) returns (ListMyEntriesResponse);
  rpc ReportEntry(ReportEntryRequest) returns (ReportEntryResponse);
  rpc GetMyAccess(GetMyAccessRequest) returns (GetMyAccessResponse);
}

message KarteEntry {
  string id = 1;
  string author_account_id = 2;
  string target_account_id = 3;
  string author_username = 4;
  string author_avatar_url = 5;
  int32 rating = 6;
  string body = 7;
  bool flagged = 8;
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
}

message Aggregate {
  int32 count = 1;
  double avg_rating = 2;
}
```

list 系は cursor (`next_cursor`, `has_more`) を返す既存パターン。`ListEntriesByTargetResponse` だけ `aggregate: Aggregate` を持つ。

`reported_count` の raw 値は API に出さない。`flagged` のみ。

## E. Frontend

### Module layout

`modules/karte/` を新規:
- `types.ts` (KarteEntry, Aggregate)
- `hooks/useGuestKarte.ts` (= ListEntriesByTarget、useSWRInfinite)
- `hooks/useMyKarte.ts`
- `hooks/useCreateKarte.ts` / `useUpdateKarte.ts` / `useDeleteKarte.ts`
- `hooks/useReportKarte.ts`
- `hooks/useMyKarteAccess.ts` (boot 時 1 回 fetch、`dedupingInterval` 長め)
- `lib/api-mappers.ts`

### BFFs

- `GET /api/karte/by-target?account_id=...` → `ListEntriesByTarget`
- `GET /api/karte/my[?cursor=...]` → `ListMyEntries`
- `POST /api/karte` → `CreateEntry`
- `PATCH /api/karte/[id]` → `UpdateEntry`
- `DELETE /api/karte/[id]` → `DeleteEntry`
- `POST /api/karte/[id]/report` → `ReportEntry`
- `GET /api/karte/access` → `GetMyAccess`

すべて auth-hardening の `callWithRefresh` ヘルパに乗る (#763 で確立)。

### UI 配置

| 画面 | 場所 |
|---|---|
| Guest profile の「カルテ」タブ | `/u/[username]` (target が Guest かつ viewer = Cast + access ありの時のみ表示) |
| 自分の投稿一覧 | `/karte/my` |
| 書き込み (create) | Guest profile タブ内 inline composer + `/karte/my` の FAB |
| アクセス無時の見え方 | タブ自体を出さない (`useMyKarteAccess` で判定)、`/karte/my` 直接訪問時はメッセージ表示 |

### Entry card

- 書き手 Cast の avatar + username + 相対時刻
- rating ★1〜5
- body (改行保持)
- `flagged: true` のときは控えめな ⚠︎ アイコン + tooltip「他 Cast から複数件 report されています」
- 自分の entry: edit / delete メニュー
- 他人の entry: report メニュー

### Aggregate header

- タブ上部に「**N 件 / 平均 ★X.Y**」だけ表示 (5 秒判定用)
- count == 0 のときは「カルテはまだありません」

### Drawer

- access あり Cast のみ「カルテ」項目 (= `/karte/my`) を追加
- bottom-tab には追加しない (常用 UI ではない)

## F. Trust destroy (同 sub-project)

| step | scope |
|---|---|
| T1 | frontend `modules/trust/` + `app/api/{cast,me,shared}/trust/*` + `stub/trust/` を完全削除 |
| T2 | monolith `slices/trust/` (handler, use_cases, repositories, relations, spec) + `bin/grpc` の登録解除 + Profile slice 等の adapter swap (grep で確認、必要なら fallback 実装) |
| T3 | proto `trust/v1/` 削除 + `bin/codegen` 再生成 |
| T4 | DB DROP migration: `trust__reviews` / `trust__review_media` / `trust__taggings` / `trust__tags` を物理 DROP (pre-prod、データ損失許容) |

順序: K1〜K7 で karte 着地 → T1〜T4 で trust 削除。中間 commit で「破壊 → 復旧不能」を避ける。

## Decomposition

| 段 | scope | 層 |
|---|---|---|
| K1 | proto `karte/v1/service.proto` 追加 + `bin/codegen` で ruby + ts stub 生成 (handler 未実装で何も壊れず green) | proto |
| K2 | monolith schema (migrations + relations: entries / access / reports) | backend schema |
| K3 | monolith repositories (entry / access / report) | backend |
| K4 | monolith use_cases (Create/Update/Delete/ListByTarget/ListMy/Report/GetMyAccess) + role 検証 + author hydration (TDD) | backend |
| K5 | monolith grpc handler + `bin/grpc` 登録 + dev seed (sample Cast に karte__access 付与) | backend |
| K6 | frontend types + 7 BFFs + grpc client + hooks | frontend data |
| K7 | frontend UI: guest profile タブ + entry card + composer + aggregate header + flagged バッジ + `/karte/my` page + Drawer nav + `/dev/ui` mock | frontend UI |
| T1 | frontend trust 削除 | cleanup |
| T2 | monolith trust slice 削除 + adapter swap | cleanup |
| T3 | proto trust 削除 + stub 再生成 | cleanup |
| T4 | DB DROP trust 物理削除 | cleanup |

各段 1 PR ベース (= 11 PR 目安)。粒度は writing-plans 段で再判断 (K2+K3 結合等の合体は可)。

## Verification

backend (TDD は K4 で必須):

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/karte
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate
```

frontend (unit test なし、検証は tsc + lint + build):

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint   # 0e/0w
env -u NODE_OPTIONS pnpm build
```

成功基準 (MVP):

- access 無い Cast は karte API がすべて拒否される (`UNAUTHENTICATED` or `PERMISSION_DENIED`)
- access あり Cast は guest profile の「カルテ」タブで全 entry + aggregate を見られる
- target が Cast の id だと `CreateEntry` が `Target must be a guest` で拒否される
- 同 Cast が同じ entry を 2 回 report しても `reported_count` は 1 のまま
- 3 Cast が同じ entry を report すると `flagged: true` になる
- write 後すぐ自分の entry を edit/delete できる
- 旧 trust slice の proto/monolith/frontend/DB がすべて消えている (grep で `trust` が hit しない、`\dt trust__*` が空)
- identity / profile / social / その他既存 slice の rspec が全 green、frontend tsc/lint(0e/0w)/build green
