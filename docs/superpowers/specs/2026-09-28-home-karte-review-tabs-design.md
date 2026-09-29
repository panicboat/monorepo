# Home karte/review tabs design

## Context

[Issue #1293](https://github.com/panicboat/monorepo/issues/1293)「ホームのタブにカルテやレビューを追加する」への対応。

Homeページ（`dystopia/frontend/src/app/page.tsx`）は現在、投稿フィードのみを「全国／エリア／フォロー中」の3タブで切り替えている。これに加え、プラットフォーム全体の最新カルテ一覧・最新レビュー一覧を、投稿と同じ一覧UIのイメージでタブとして追加する。

現状、karte・review双方とも「特定アカウント宛て／特定アカウント起点」の一覧RPC（`ListEntriesByTarget`, `ListEntriesByAuthor`, `ListMyEntries`）のみを持ち、プラットフォーム全体を横断する一覧RPCが存在しないため、新規に追加する。

### 関連Issueとの切り分け

[Issue #1296](https://github.com/panicboat/monorepo/issues/1296)「カルテの閲覧・作成がロールで制限されていない」は、既存の`ListEntriesByTarget`/`ListMyEntries`/`CreateEntry`がビューアー・執筆者のロールを検証していない不備と、billingの`access_repo`ゲートが機能不全である不備を扱う別issueであり、本specの対象外とする。ただし本specで新設する`Karte::UseCases::ListRecentEntries`は、公開フィードとして成立させるために必要なcast-onlyのビューアーロール検証を自前で持つ（#1296の対応を待たない）。既存の3メソッドの修正は#1296のスコープのまま変更しない。

## Goals

- Homeのタブ列に「カルテ」（cast役割のユーザーにのみ表示）と「レビュー」（全ロールに表示）を追加する
- 各タブは投稿フィードと同様、プラットフォーム全体の最新エントリをページネーション付きで一覧表示する
- 既存のkarte/review機能（プロフィールページでの閲覧・作成・削除・報告・非表示等）には手を入れない

## Non-goals

- #1296で扱う、既存ロール検証・billing集約APIの実装
- カルテのtarget（ゲスト）側の可視性設定の新設（reviewの`reviews_visible`に相当する機能はカルテには存在せず、本specでも追加しない）
- bottom navや`/karte/my`・`/reviews/my`ページの変更・削除（既存のまま維持）

## Architecture

### Tabs (`dystopia/frontend/src/app/page.tsx`)

既存の`TAB_ITEMS`（`FeedFilterValue`: `"all" | "area" | "following"`）は`useFeed`専用の型のため変更しない。`page.tsx`内でHomeページ固有のタブ値を表すローカルなユニオン型を新設し、選択中のタブに応じて表示するコンテンツを切り替える。

```ts
type HomeTabValue = FeedFilterValue | "karte" | "reviews";
```

- タブ項目はroleに応じて動的に構築する: `role === "cast"` の場合のみ「カルテ」を追加、「レビュー」は常に追加
- `useFeed` / `useRecentKarte` / `useRecentReviews` は常に呼び出すが（Reactのフック呼び出し順を守るため）、`useRecentKarte(enabled)` / `useRecentReviews(enabled)` の `enabled` を「そのタブが選択されているか」で渡し、非選択中はSWRの`getKey`が`null`を返して未フェッチのままにする（`useMyKarte`の`if (!userId) return null;`と同じ既存パターン）
- `content`の出し分けは、既存の`filter==="all"|"area"|"following"`のときは投稿フィード、`filter==="karte"`ならカルテ一覧、`filter==="reviews"`ならレビュー一覧、をレンダリングする

### Proto changes

`proto/dystopia/karte/v1/service.proto` と `proto/dystopia/review/v1/service.proto` に、それぞれ既存の`ListEntriesByTarget`/`ListEntriesByAuthor`/`ListMyEntries`と並ぶ新スコープとして`ListRecentEntries`を追加する。

```proto
// karte.v1.KarteService に追加
rpc ListRecentEntries(ListRecentEntriesRequest) returns (ListRecentEntriesResponse);

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

```proto
// review.v1.ReviewService に追加
rpc ListRecentEntries(ListRecentEntriesRequest) returns (ListRecentEntriesResponse);

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

aggregate（count/avg_rating）は特定targetに紐づく概念のため、`ListRecentEntries`のレスポンスには含めない。

### Monolith: karte slice

- `Karte::Repositories::EntryRepository#list_recent(limit:, cursor:)`：`list_by_target`と同型。`where`によるスコープを持たず、`entry_records`全体に対して`apply_cursor`→`order { [created_at.desc, id.desc] }.limit(limit + 1).to_a`
- `Karte::UseCases::ListRecentEntries`（新規）
  - `call(viewer_account_id:, limit: 20, cursor: nil)`
  - `Identity::Slice["repositories.account_repository"].find_by_id(viewer_account_id)` でviewerを取得し、`role == 2`（cast）でなければ`AccessError`を送出する（既存の`CreateEntry`が`target.role == 1`を検証しているのと対の実装）
  - billingの`access_repo`は参照しない
  - エントリの整形（author/target双方のusername・avatar解決、`flagged`判定）は既存の`present_with_author`と同じロジックを踏襲する
- `Karte::Grpc::KarteHandler#list_recent_entries`：既存ハンドラメソッドと同型（`authenticate_user!` → use case呼び出し → proto変換）。`wrap_errors`の`rescue`対象に`Karte::UseCases::ListRecentEntries::AccessError`を追加する

### Monolith: review slice

- `Review::Repositories::EntryRepository#list_recent(limit:, cursor:)`：karte側と同型
- `Review::UseCases::ListRecentEntries`（新規）
  - `call(viewer_account_id:, limit: 20, cursor: nil)`（ロール検証なし。全ロールが閲覧可能）
  - エントリ単位で以下をすべて満たすもののみ残す
    1. `hidden`でない
    2. `target_account_id`の`cast_settings_repo`設定で`reviews_visible`が`false`でない
    3. `author_account_id`・`target_account_id`のいずれも、viewerとの間にブロック関係がない（`block_adapter.bidirectionally_blocked_ids(account_id: viewer_account_id)`の集合に含まれない）
    4. `author_account_id`・`target_account_id`のいずれも、非公開アカウントであればviewerがフォロー承認済みである（`Social::Slice["use_cases.filter_visible_posts"]`と同じprivate+follow判定を、author_idとtarget_idそれぞれを疑似的な投稿者とみなして適用する）
  - 既存の`Review::UseCases::FilterVisibleEntries#page_owner_reachable?`は「単一のページ所有者」を前提にしているためグローバル一覧には流用せず、4.の判定はauthor/target双方に個別適用する新規ロジックとして実装する（3.のブロック判定は既存の考え方をauthor/target双方向に一般化したもの）
- `Review::Grpc::ReviewHandler#list_recent_entries`：既存と同型

### BFF (Next.js API routes)

- `dystopia/frontend/src/app/api/karte/recent/route.ts`：`karteClient.listRecentEntries({ limit, cursor })`を呼び、`/api/karte/my/route.ts`と同型のレスポンス整形を行う
- `dystopia/frontend/src/app/api/review/recent/route.ts`：`reviewClient.listRecentEntries({ limit, cursor })`を呼び、既存の`/api/review/by-author/route.ts`相当のレスポンス整形を行う

### Frontend

- 型追加（`dystopia/frontend/src/modules/karte/types.ts` / `review/types.ts`）
  - `PaginatedKarteRecentResponse { entries: KarteEntry[]; nextCursor: string; hasMore: boolean }`
  - `PaginatedReviewRecentResponse { entries: ReviewEntry[]; nextCursor: string; hasMore: boolean }`
- hook追加
  - `useRecentKarte(enabled: boolean)`（`dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts`）：`useMyKarte`と同じSWRInfiniteパターン。`getKey`は`enabled`が`false`の間は`null`を返す
  - `useRecentReviews(enabled: boolean)`（`dystopia/frontend/src/modules/review/hooks/useRecentReviews.ts`）：同型
- カード表示
  - `KarteEntryCard`・`ReviewEntryCard`の`mode`にそれぞれ`"recent"`を追加。既存は`mode`に応じて相手側1名の身元のみ表示する作りだが、`"recent"`ではauthor→target双方の身元（avatar + username）を表示する（例: `AさんがBさんについて`）
- `page.tsx`：上記Architectureのタブ節を参照

## Testing

- monolith（rspec）
  - `Karte::UseCases::ListRecentEntries`：cast viewerで正常に一覧取得できること／guest viewerで`AccessError`になること／カーソルページネーションが機能すること
  - `Review::UseCases::ListRecentEntries`：`hidden`除外・`reviews_visible: false`除外・ブロック関係除外・非公開アカウント未フォロー除外の各ケースと、通常表示ケース
- frontend（vitest）
  - `useRecentKarte`/`useRecentReviews`：`enabled`による取得制御、ページネーション
  - `page.tsx`：role===castで「カルテ」タブが表示されること／role===guestで表示されないこと、「レビュー」タブは常に表示されること、タブ切り替えで表示コンテンツが切り替わること
