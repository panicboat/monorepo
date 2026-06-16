# Bookmarks Slice Design — private post saver (binary, simple list)

Date: 2026-06-17
Status: Design spec (implementation-ready)
Scope: 「周辺」スライス第 2 弾。post を後から見るために viewer が「保存」できる binary flag + 一覧。private (viewer のみ自分の bookmarks を見える)、folder / collection 機能なし、aggregation なし。rx-sns 同等のシンプル UX。

Related:
- `2026-05-31-domain-context-map-design.md` (keep/transform 7 + new 4。bookmarks は new 4 の第 2 弾)
- `2026-06-07-posts-slice-design.md` (post.v1.Post message を本 spec の hydration ターゲットに流用)
- `2026-06-16-notifications-slice-design.md` (cross-slice contract pattern を踏襲、emit 系は本 spec では不要)
- `2026-06-17-app-shell-design.md` (`/bookmarks` route は #699 で stub 作成済、本 spec で実装に置換)
- [[reference-rx-sns-jp]] (`.superpowers/rx-sns-render/cast-bookmarks.png` で empty state grounded)

## Grounding

- 既存 `/bookmarks` route = stub page (`#699` で「ブックマーク機能は準備中です」placeholder)、drawer + bottom-tab で nav 可能だが機能未実装。
- 既存 `Post::UseCases::Posts::ListPostsByIds` (S3 で社会 follow-gate + Post 内部 hydration を内包) を bookmarks の list 系で再利用予定。
- 既存 `useFollowList` / `useFollowerList` の `useSWRInfinite` cursor pagination パターンを bookmarks list で踏襲。
- 実 capture `.superpowers/rx-sns-render/cast-bookmarks.png`: empty 状態 = bookmark icon + "ブックマークはまだありません" + "投稿をブックマークすると、ここに表示されます" の 2 段。folder / collection 表示なし。

## Goal

viewer が任意の post に対し binary に「保存」フラグを立て / 解除し、`/bookmarks` page で自分の bookmarks を新しい順に一覧、PostCard 内の bookmark icon で feed / profile / post detail どこからでも toggle 可能にする。emit / 通知連動なし。Folder / 課金は drop。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| データモデル | binary (account_id, post_id) per row、`UNIQUE(account_id, post_id)` で idempotent |
| privacy | 完全 private、他者の bookmarks は API で expose しない |
| folder / collection | 不採用 (rx-sns 同等のフラット list) |
| 通知連動 | なし (bookmark されても通知発火しない) |
| button placement | PostCard 内に like icon の隣に bookmark icon、post detail でも同 PostCard 経由で表示 |
| /bookmarks page | `useBookmarkList` + `PostCardBinding.map` で post hydration 経由表示、cursor pagination "もっと見る" |
| 空状態 | rx-sns 準拠の "ブックマークはまだありません" + サブテキスト |
| 同期 | viewer の bookmark status は SWR で fetch、PostCard `useBookmarkStatusBatch` で feed 一覧上の bookmark icon 表示初期化 |
| Suppression | なし (自分の post もブックマーク可能、特段制限なし) |

## Domain model

### Schema

新 PostgreSQL schema `bookmarks`、1 表:

```sql
CREATE SCHEMA bookmarks;

CREATE TABLE bookmarks.bookmarks (
  id          uuid        NOT NULL,
  account_id  uuid        NOT NULL,
  post_id     uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (account_id, post_id)
);

CREATE INDEX idx_bookmarks_account_created
  ON bookmarks.bookmarks (account_id, created_at DESC);
```

idempotent INSERT `ON CONFLICT (account_id, post_id) DO NOTHING`。

### Repository API

`Bookmarks::Repositories::BookmarkRepository`:
- `bookmark(account_id:, post_id:)` → idempotent INSERT、戻り値 `Boolean` (新規 true / 既存 false)
- `unbookmark(account_id:, post_id:)` → DELETE、戻り値 `Boolean` (削除あり true / 元から無し false)
- `list(account_id:, limit:, cursor:)` → bookmark row の `created_at, id` cursor 形式
- `status_batch(account_id:, post_ids:)` → `Hash{post_id_string => Boolean}` (キーは全 input、無し = false)
- `bookmarked?(account_id:, post_id:)` → 単発 query (補助、status_batch があるので handler では使わない可能性大)

### Suppression rules

なし。block されている account の post も bookmark 可能 (block は表示 hide の責務であり、bookmark は private 行為)。viewer が自分の post を bookmark するのも許可。

## API contract — `bookmarks.v1`

```proto
syntax = "proto3";
package bookmarks.v1;

import "post/v1/post_service.proto";

service BookmarkService {
  rpc Bookmark(BookmarkRequest) returns (BookmarkResponse);
  rpc Unbookmark(UnbookmarkRequest) returns (UnbookmarkResponse);
  rpc ListBookmarks(ListBookmarksRequest) returns (ListBookmarksResponse);
  rpc GetBookmarkStatus(GetBookmarkStatusRequest) returns (GetBookmarkStatusResponse);
}

message BookmarkRequest  { string post_id = 1; }
message BookmarkResponse {}

message UnbookmarkRequest  { string post_id = 1; }
message UnbookmarkResponse {}

message ListBookmarksRequest {
  int32 limit = 1;    // default 20, max 50
  string cursor = 2;  // base64 (created_at, id)
}

message ListBookmarksResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetBookmarkStatusRequest {
  repeated string post_ids = 1;
}

message GetBookmarkStatusResponse {
  map<string, bool> bookmarked = 1;  // post_id -> true if bookmarked by viewer
}
```

- post hydration は `Post::Slice["use_cases.posts.list_posts_by_ids"]` 経由、social ListFollowing 同形
- batch status は 1 post 単体でも array で送る (frontend 側で convenient)

## Monolith bookmarks slice

- **schema migration**: `20260617000000_create_bookmarks_schema.rb` (新 schema + table + 1 index)
- **slice base**: `Bookmarks::DB::Repo`、`Bookmarks::DB::Relation`、Hanami 同形
- **relations / repository**:
  - `Bookmarks::Relations::Bookmarks` (`as: :bookmark_records` で ROM-SQL alias 衝突回避 = notifications N1 の lesson 適用)
  - `Bookmarks::Repositories::BookmarkRepository` (5 method 上記)
- **use_cases**:
  - `Bookmarks::UseCases::Bookmark` (repo.bookmark 呼び)
  - `Bookmarks::UseCases::Unbookmark` (repo.unbookmark 呼び)
  - `Bookmarks::UseCases::ListBookmarks` (cursor pagination + post hydration via `Post::Slice["use_cases.posts.list_posts_by_ids"]`)
  - `Bookmarks::UseCases::GetBookmarkStatus` (status_batch + missing key 埋め)
- **handler**: `Bookmarks::Grpc::Handler` (base) + `Bookmarks::Grpc::BookmarkHandler` (4 RPC binding)
- **bin/grpc 登録**: proto stub require + handler require (S2b hidden bug 回避済 pattern 踏襲)
- **cross-slice**: post hydration のみ。emit 系なし。

## Frontend

- **data 層** (`src/modules/bookmarks/`):
  - `types.ts`: `BookmarkStatusMap = Record<string, boolean>`、`PaginatedPostsResponse` (既存 `@/modules/post` 型を流用)
  - `lib/index.ts`: 必要に応じて mapper (今回は proto Post を view へ変換は既存 `@/modules/post` が担保、bookmarks 固有 mapper なし可能性大)
  - `hooks/`:
    - `useBookmark(postId)`: `{ isBookmarked, bookmark, unbookmark, loading }` (社会 `useBlock` と同 pattern)
    - `useBookmarkStatusBatch(postIds[])`: `{ bookmarked: BookmarkStatusMap, getStatus }`
    - `useBookmarkList()`: useSWRInfinite cursor、 `{ posts, hasMore, loading, error, loadMore, refresh }`
- **BFFs** (`src/app/api/bookmarks/`):
  - `POST /api/bookmarks/[postId]` → Bookmark
  - `DELETE /api/bookmarks/[postId]` → Unbookmark
  - `GET /api/bookmarks?limit=20&cursor=...` → ListBookmarks
  - `POST /api/bookmarks/status` (body: `{ postIds: string[] }`) → GetBookmarkStatus
- **UI**:
  - `PostCard` 拡張: like icon の隣に bookmark icon (📑 or `🔖`)、`bookmarked` prop + `onBookmarkToggle` callback。`PostCardBinding` で `useBookmark(post.id)` を呼んで wire up。
  - `/bookmarks/page.tsx` 実装 (stub から実装): `useBookmarkList` で post 一覧、`PostCardBinding.map` で render、cursor "もっと見る" button、empty 状態 = rx-sns 準拠の placeholder
- **stub**: `src/stub/bookmarks/v1/bookmark_service_pb.ts` (B1 で生成)
- **client**: `src/lib/grpc.ts` に `bookmarkClient` 追加 (B1 で追記)

## Cross-slice contracts

```ruby
# Bookmarks slice は他 slice に何も expose しない (private 機能)。
# 他 slice からの emit 連動 / 参照無し。
# Post::Slice["use_cases.posts.list_posts_by_ids"] を ListBookmarks 内で消費するのみ。
```

## Decomposition (3 PR、notifications より小)

- **B0** (本 spec、commit + self-review + user 確認)
- **B1**: proto `bookmarks.v1` + monolith slice 全部 (schema migration + relations + repository + 4 use_cases + 2 handler file + bin/grpc 登録、両 stub 生成、container smoke、build-green)
- **B2**: frontend 全部 (types + 3 hook + 4 BFF route + grpc.ts に bookmarkClient + PostCard 拡張 + /bookmarks page 実装 + /dev/ui mock)

各 PR build-green / additive / auto-merge 運用。

## Deferred / out of scope

- **Folder / Collection** (フォルダ分け、タグ付け、private collection 等): 別 spec、需要顕在化後
- **共有 bookmark** (公開 list、shared collection): privacy ポリシー再検討込み別 spec
- **通知連動** (誰かが自分の post を bookmark した時の通知): 採用しない (rx-sns 同等、surveillance 感を避ける)
- **bookmark ranking** (人気 post ランキング): discovery slice の責務、別 spec
- **bookmark に reaction (タグ・メモ追加)**: 別 spec
- **PostCard の更なる icon 拡張 (share / reply 等)**: 必要時に別 PR

## Verification

- **B1 monolith**: `bundle exec rspec spec/slices/{post,profile}` baseline 維持、container smoke で 4 use_case 解決、bookmark/unbookmark の empty path 動作、`bin/grpc` boot 後 `Gruf.services` リストに `Bookmarks::V1::BookmarkService::Service` 登場
- **B2 frontend**: `pnpm exec tsc --noEmit` 緑、`pnpm build` 緑、新 4 BFFs が route 一覧、`pnpm lint` baseline 同等、`/bookmarks` route が「準備中」から実 list 表示に切替、PostCard の bookmark icon が tap で状態切替

全 PR additive / build-green / auto-merge 運用。
