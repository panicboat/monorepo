# Footprints (足跡) Design

## Goal

rx-sns 同等の足跡機能を本リポジトリに実装する。誰が自分のプロフィールを訪問したかを記録・閲覧でき、新規訪問は未読バッジで通知される。

## Scope (Tier の文脈)

rx-sns visual gap audit rev2 (2026-06-17) で抽出した P1 残ギャップのうち、`/footprints` ルートが "準備中" stub のまま放置されている状態を解消する。

設計スコープは rx-sns parity:
- 全ユーザー双方向で記録 (Guest privacy 配慮の opt-out は v1 提供しない)
- visitor 側 opt-out 非対応
- "足跡の未読バッジ" 表示 toggle は Settings 通知設定タブ整備時に併せて (本 spec の範囲外)

## Architecture

新規 slice `slices/footprints/` (notifications / bookmarks と同パターンの独立 primitive)。社会的関係性 (follow / block) を持つ `slices/social/` には統合しない — visit は時刻情報を持ち lifecycle が follow / block と異なるため。

## Data Model

### `footprints.visits`

| column | type | note |
|---|---|---|
| `id` | `uuid` | uuid7、PK |
| `visitor_id` | `uuid` | FK accounts (見る人) |
| `visited_id` | `uuid` | FK accounts (見られる人 = owner) |
| `first_visited_at` | `timestamptz` | 初回訪問時刻 |
| `last_visited_at` | `timestamptz` | 直近訪問時刻 (再訪問で update) |
| `created_at` / `updated_at` | `timestamptz` | 標準 |

制約・index:
- `UNIQUE (visitor_id, visited_id)` — upsert per pair の保証
- `INDEX (visited_id, last_visited_at DESC)` — `ListFootprints` の主スキャン

### `footprints.read_states`

| column | type | note |
|---|---|---|
| `account_id` | `uuid` | PK、FK accounts |
| `last_read_visit_at` | `timestamptz` | この時刻より新しい visit が未読 |
| `created_at` / `updated_at` | `timestamptz` | 標準 |

未読件数 =
```
COUNT(visits)
  WHERE visited_id = me
    AND last_visited_at > read_states.last_read_visit_at
```

### Block 相殺

`RecordVisit` 実行時に `social.blocks` を参照:
- visitor が visited を block、または visited が visitor を block している場合は upsert skip (no-op、OK 返す)
- 既存 visit row が残っている状態で block 関係が成立した場合は引き続き存在 (履歴は消さない)。`ListFootprints` で読み出し時に block 相手は除外する

## gRPC API

新規 `proto/footprints/v1/footprints_service.proto`:

```proto
syntax = "proto3";
package footprints.v1;

import "google/protobuf/timestamp.proto";
import "portfolio/v1/profile.proto";

service FootprintsService {
  rpc RecordVisit(RecordVisitRequest) returns (RecordVisitResponse);
  rpc ListFootprints(ListFootprintsRequest) returns (ListFootprintsResponse);
  rpc GetUnreadCount(GetUnreadCountRequest) returns (GetUnreadCountResponse);
  rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
}

message RecordVisitRequest {
  string visited_id = 1;  // visitor は metadata sub から
}
message RecordVisitResponse {}

message ListFootprintsRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListFootprintsResponse {
  repeated Footprint footprints = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message Footprint {
  portfolio.v1.Profile visitor = 1;
  google.protobuf.Timestamp last_visited_at = 2;
  bool is_unread = 3;  // viewer.last_read_visit_at < last_visited_at
}

message GetUnreadCountRequest {}
message GetUnreadCountResponse { int32 count = 1; }

message MarkReadRequest {}
message MarkReadResponse {}
```

認証は metadata (Authorization Bearer) を全 RPC で必須。`visitor_id` は metadata の sub claim から取り、request body には乗せない。

## Frontend Integration

### Visit 記録 trigger

`src/app/u/[username]/page.tsx` で profile load 成功後、`useEffect` から fire-and-forget:

```ts
useEffect(() => {
  if (!viewerId || !profile?.accountId) return;
  if (viewerId === profile.accountId) return;
  fetch("/api/footprints/visit", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ visitedId: profile.accountId }),
  }).catch(() => {});
}, [viewerId, profile?.accountId]);
```

- 自分プロフィール訪問は frontend 側で skip + backend でも `visitor == visited` を no-op で防御
- 未認証時は trigger なし
- 失敗は silent (UX に出さない)
- React 19 StrictMode の double-render で 2 回飛んでも upsert なので影響なし。`useRef` guard は YAGNI

### `/footprints` page

`src/app/footprints/page.tsx`:
- mount 時に `useFootprints()` で initial 取得 + `markRead()` を fire (badge クリア)
- 行コンポーネント = avatar + displayName + @username + relative time
- 未読の行 (`is_unread`) は左に accent stripe
- "もっと見る" cursor pagination (既存 hook pattern と同型)
- 空状態: "あなたを訪問した人はまだいません"
- 行 tap → `/u/[username]` 遷移

### Badge surface

`src/components/shell/Drawer.tsx` の `NAV_ITEMS` に `badgeKey: "footprints_unread"` を追加し、`useFootprintsUnreadCount()` の値を bind。

TopBar bell は notifications 専用のまま (footprints は drawer のみ surface)。

### Hooks / BFFs

| hook | BFF |
|---|---|
| `useFootprints()` | GET `/api/footprints/list?limit=&cursor=` |
| `useFootprintsUnreadCount()` | GET `/api/footprints/unread-count` |
| `useRecordVisit()` (or inline fetch) | POST `/api/footprints/visit` |
| `markFootprintsRead()` | POST `/api/footprints/mark-read` |

## Decomposition (PR plan)

| PR | スコープ | 主成果物 |
|---|---|---|
| **F0 spec** | このドキュメント | `docs/superpowers/specs/2026-06-18-footprints-design.md` |
| **F1 monolith** | proto + slice + migration + relations + repo + use_cases + handler + bin/grpc 登録 | `slices/footprints/`, `proto/footprints/v1/footprints_service.proto`, migration |
| **F2 frontend data** | stub 取り込み + hooks + BFFs | `src/modules/footprints/hooks/*`, `src/app/api/footprints/{visit,list,unread-count,mark-read}/route.ts` |
| **F3 frontend UI** | `/footprints` page + visit trigger + drawer badge | `src/app/footprints/page.tsx`, `src/modules/footprints/components/FootprintRow.tsx`, `Drawer.tsx`, `/u/[username]/page.tsx` |

## Testing

### F1 (monolith)

- use_case spec 必須項目:
  - `RecordVisit` で `visitor == visited` の no-op
  - `RecordVisit` で visitor / visited が相互 block の片方を満たすケースの no-op
  - `RecordVisit` 連続呼び出しで row が 1 件に upsert されること (last_visited_at 更新)
  - `ListFootprints` で block 相手の visit が結果から除外されること
  - `GetUnreadCount` が `last_read_visit_at` 境界を正しく扱うこと (= 境界含意のスペック確定: `>` exclusive)
  - `MarkRead` で `last_read_visit_at` が DB 時刻に近い now() で更新されること
- handler 単体 spec は他 slice 同様薄め (grpc 実機テストで賄う既存方針)

### F2 / F3 (frontend)

- type check + build green + lint baseline 維持 (5 errors / 7 warnings)
- e2e 確認は puppeteer による手動 capture (rx-sns parity 比較)
- StrictMode double-fire 確認 (upsert 結果が 1 行で last_visited_at だけ更新される)

## Risks & Non-Goals

### Risks
- Guest privacy: rx-sns parity で visit は全件記録される。Settings 通知設定タブで future "足跡を残さない" toggle を提供する場合は visitor_id を null にする等の方式 (本 spec 範囲外)
- Visit を `useEffect` で fire するため、page 遷移を伴わない子 component re-render では追記録されないが、URL 変更 (`/u/foo` → `/u/bar`) は別 navigation なので正常に発火

### Non-Goals (v1)
- visitor opt-out (記録しない / 残さないモード)
- 訪問回数表示 (upsert per pair なので row に count を持たない)
- 訪問者の表示順カスタマイズ (常に last_visited_at DESC)
- "足跡の未読バッジ" 表示 toggle (Settings 通知設定タブ整備時に併せ)
- Cast 専用の閲覧履歴可視化 (= Guest 評価共有との連携設計時)
