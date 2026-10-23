# Discovery Slice Design — search (users + posts) + ranking (top liked posts)

Date: 2026-06-17
Status: Design spec (implementation-ready)
Scope: 「周辺」スライス第 3 弾。`/search` (ユーザー + 投稿) と `/ranking` (top liked posts、3 期間 tab) を新スライス `discovery` で実装。自前 table なし、Profile / Post repository を cross-slice 呼出。Phase 1b-A (#699) で stub 化されている `/search` と `/ranking` を実装に置換。

Related:
- `2026-05-31-domain-context-map-design.md` (keep/transform 7 + new 4。discovery は new 4 の第 3 弾)
- `2026-06-02-profile-slice-design.md` (profile.v1.Profile を user search の payload に流用)
- `2026-06-07-posts-slice-design.md` (post.v1.Post を post search / ranking の payload に流用、`Post::ListPostsByIds` で hydration)
- `2026-06-15-social-slice-design.md` (`Social::FilterVisiblePosts` で follow-gate filter を post 結果に適用)
- `2026-06-17-app-shell-design.md` (`/search` / `/ranking` route は #699 で stub、本 spec で実装に置換)
- [[reference-rx-sns-jp]] (`.superpowers/rx-sns-render/{cast,guest}-{search,ranking}.png` で grounded)

## Grounding

- `/search` route = stub page (#699 で "検索機能は準備中です" placeholder)、nav からアクセス可能。
- `/ranking` route = 同じく stub。
- rx-sns 実 capture (`cast-search.png` / `cast-ranking.png`) を grounded:
  - **search**: input "ユーザーを検索…" + tabs (ユーザー / 投稿)、空状態 = 大 🔍 icon + "ユーザーを検索" + "ユーザー名や表示名で検索できます"。filter chips (全て / セラピスト / ショップ) は memory の「商取引次元 drop / 役職細分は採用しない」方針で本プロダクトでは drop。
  - **ranking**: 投稿 list、サムネ + title + count + 時間。metric tab 風 UI あり、本 spec では 3 期間 tab (24h / 1 週間 / 全期間) を採用。

## Goal

ユーザーが他アカウントを検索 / post 内容を検索 / 人気 post を発見する 3 動線を新規 `discovery` slice で提供。自前 table を持たず、Profile / Post repository に **新規 query method を追加**して discovery use_case から呼出。post 系結果は `Social::FilterVisiblePosts` で follow-gate filter (block + is_private) を適用 + visibility=public 強制。frontend は `/search` と `/ranking` を実装に置換、bottom-tab の検索 slot も実機能化。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| scope | search (ユーザー + 投稿) + ranking (top liked posts) の 2 surface |
| search backend | PostgreSQL `ILIKE` で simple match (`%query%`)、case-insensitive。FTS / tsvector / GIN は v1 では不採用。 |
| user search 対象 | `profile.username` + `profile.display_name` の ILIKE OR |
| post search 対象 | `post.content` の ILIKE、`visibility = 'public'` 強制 |
| ranking metric | likes_count desc |
| ranking period | 3 期間 tab: **24h / 1 週間 / 全期間** |
| ranking 対象 | `visibility = 'public'` 強制、`Social::FilterVisiblePosts` で viewer から見えない post 除外 |
| query min length | 1 文字以上 (空文字なら 400 error or 空結果) |
| pagination | cursor (base64) — search は `(created_at, id)` / ranking は `(likes_count, id)` |
| privacy / suppression | post 系は `Social::FilterVisiblePosts` (block + is_private) 必須。user search は public account 全部表示 (block / private 判定は profile 詳細ページで kick) |
| データモデル | discovery 専用 table なし、cross-slice query |

## Domain model

### 既存 repository への追加 method

**`Profile::Repositories::ProfileRepository`**:
```ruby
# Case-insensitive partial match on username or display_name.
def search_by_query(query:, limit: 20, cursor: nil)
  # SELECT ... WHERE (username ILIKE '%' || query || '%' OR display_name ILIKE '%' || query || '%')
  # ORDER BY created_at DESC, id DESC LIMIT N+1
end
```

**`Post::Repositories::PostRepository`**:
```ruby
# Public posts only, content ILIKE match.
def search_by_content(query:, limit: 20, cursor: nil)
  # SELECT id FROM post.posts WHERE visibility = 'public' AND content ILIKE '%' || query || '%'
  # ORDER BY created_at DESC, id DESC LIMIT N+1
end

# Top public posts by likes_count within the period.
# period: 'day' | 'week' | 'all'
def top_by_likes(period:, limit: 20, cursor: nil)
  # SELECT id FROM post.posts
  # WHERE visibility = 'public' AND (period == 'all' OR created_at >= NOW() - INTERVAL '7d/1d')
  # ORDER BY likes_count DESC, id DESC LIMIT N+1
end
```

> `search_by_content` / `top_by_likes` は post id のみ返す。hydration は use_case 側で `Post::Slice["use_cases.posts.list_posts_by_ids"]` 経由 (S3 で確立済 pattern、social ListFollowing 同形)。

### `Discovery` slice 構造

- 自前 schema / table なし、`db/relation` も不要
- `Discovery::Slice` (Hanami slice scaffold)
- 4 use_cases: `SearchUsers` / `SearchPosts` / `RankPosts` / (helper `format_period` 等は inline)
- handler 1: `Discovery::Grpc::DiscoveryHandler` (3 RPC binding)
- `bin/grpc` 登録 (proto stub require + handler require)

### Use case spec

**`SearchUsers`** (Profile cross-slice + hydration):
- `query` を trim、空なら `{ profiles: [], next_cursor: "", has_more: false }`
- `Profile::Slice["repositories.profile_repository"].search_by_query(query:, limit:, cursor:)` で profile rows
- 各 row を `Profile::V1::Profile` proto に hydration (既存 Profile slice の presenter を呼ぶ、または raw row → proto は use_case 内 inline 変換)

**`SearchPosts`** (Post cross-slice + filter + hydration):
- `query` を trim、空なら 空結果
- `Post::Slice["repositories.post_repository"].search_by_content(query:, limit:, cursor:)` で post id list
- `Post::Slice["use_cases.posts.list_posts_by_ids"].call(post_ids:, viewer_account_id:)` で hydration (S3 で内部 `Social::FilterVisiblePosts` 適用済)
- 結果 = filter 済 + hydration 済の `Post::V1::Post[]`

**`RankPosts`** (period filter + hydration):
- `period` enum → `'day'` / `'week'` / `'all'` 文字列
- `Post::Slice["repositories.post_repository"].top_by_likes(period:, limit:, cursor:)` で id list
- `Post::Slice["use_cases.posts.list_posts_by_ids"]` で hydration
- cursor は `(likes_count, id)` の 2 column 形式 (`Concerns::CursorPagination` の流用、`created_at` 引数名を `likes_count` の意味で再利用)

> ranking の cursor は降順なので "次のページ = もっと低 likes 順"。同 likes ↔ id desc で deterministic。

## API contract — `discovery.v1`

```proto
syntax = "proto3";

package discovery.v1;

import "profile/v1/service.proto";
import "post/v1/post_service.proto";

service DiscoveryService {
  rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);
  rpc SearchPosts(SearchPostsRequest) returns (SearchPostsResponse);
  rpc RankPosts(RankPostsRequest) returns (RankPostsResponse);
}

enum RankPeriod {
  RANK_PERIOD_UNSPECIFIED = 0;
  RANK_PERIOD_DAY = 1;       // last 24 hours
  RANK_PERIOD_WEEK = 2;      // last 7 days
  RANK_PERIOD_ALL = 3;       // all-time
}

message SearchUsersRequest {
  string query = 1;
  int32 limit = 2;       // default 20, max 50
  string cursor = 3;     // base64 (created_at, id)
}

message SearchUsersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message SearchPostsRequest {
  string query = 1;
  int32 limit = 2;
  string cursor = 3;     // base64 (created_at, id)
}

message SearchPostsResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message RankPostsRequest {
  RankPeriod period = 1;
  int32 limit = 2;
  string cursor = 3;     // base64 (likes_count, id) — semantic reuse of cursor field
}

message RankPostsResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

## Cross-slice contracts

```ruby
# Profile slice 拡張 (D1 で):
Profile::Slice["repositories.profile_repository"].search_by_query(query:, limit:, cursor:)
  # → Array<profile_row>

# Post slice 拡張 (D1 で):
Post::Slice["repositories.post_repository"].search_by_content(query:, limit:, cursor:)
  # → Array<post_id>
Post::Slice["repositories.post_repository"].top_by_likes(period:, limit:, cursor:)
  # → Array<post_id>

# Discovery slice 内では既存 cross-slice ハイドレーション use_case を再利用:
Post::Slice["use_cases.posts.list_posts_by_ids"].call(post_ids:, viewer_account_id:)
  # → Hash{post_id_string => Post::V1::Post}  (filter_visible_posts 内包済)
```

## Frontend

- **data 層** (`src/modules/discovery/`):
  - `types.ts`: `RankPeriod` literal union、`PaginatedProfilesResponse` (既存 social の流用) / `PaginatedPostsResponse` (既存 post の流用)
  - `hooks/`:
    - `useSearchUsers(query)` — useSWRInfinite、`query` を debounce 300ms
    - `useSearchPosts(query)` — useSWRInfinite、debounce 300ms
    - `useRankPosts(period)` — useSWRInfinite、period 変更で reset
- **BFFs** (`src/app/api/discovery/`):
  - `GET /api/discovery/users?q=...&limit=...&cursor=...`
  - `GET /api/discovery/posts?q=...&limit=...&cursor=...`
  - `GET /api/discovery/ranking?period=day|week|all&limit=...&cursor=...`
- **UI**:
  - `/search/page.tsx` 実装: 上部 input (debounce 300ms) + tabs (ユーザー / 投稿) + 結果 list。各 tab の結果は `useSearchUsers` / `useSearchPosts` を切替消費。empty state = rx-sns 準拠 (🔍 icon + "ユーザーや投稿を検索" + サブテキスト)。
  - `/ranking/page.tsx` 実装: 上部 tabs (24h / 1週間 / 全期間) + 結果 list (`PostCardBinding.map`)。
  - 検索結果ユーザー row は社会 `/oshi` の ProfileRow と同形 (avatar + 名前 + handle + FollowButton)
  - 検索結果 / ranking post 行は既存 `PostCardBinding` を流用
- **stub**: `src/stub/discovery/v1/discovery_service_pb.ts` (D1 で生成)
- **client**: `src/lib/grpc.ts` に `discoveryClient` 追加 (D1 で追記)

## Cross-slice contracts (summary)

Discovery slice → 外部 expose する API なし (frontend のみ消費)。<br>
Discovery slice → 内部依存: `Profile::Slice` (repository)、`Post::Slice` (repository + ListPostsByIds use_case)。

## Decomposition (3 PR)

- **D0** (本 spec、commit + self-review + user 確認)
- **D1**: monolith full vertical — proto + slice scaffold + 4 use_cases + handler + bin/grpc 登録 + Profile/Post repository への 3 method 追加 + container smoke。両 stub 生成 (churn 0)。
- **D2**: frontend full vertical — types + 3 hooks + 3 BFFs + grpc.ts に discoveryClient + `/search` & `/ranking` page 実装 (stub → 実装)。

## Suppression / privacy

- post 系 (SearchPosts / RankPosts) は backend `visibility = 'public'` で hard filter + use_case 内で `Social::FilterVisiblePosts` (block + is_private) を hydration 経由で適用 (S3 #679 の `ListPostsByIds` 内で実装済、cross-slice で transparent)。
- user 系 (SearchUsers) は public account 全部表示。block されているかは検索結果 row には反映しないが、profile 詳細ページで follow-gate / block UI が表示制御する (既存 #686 の `/u/[username]` UX)。

## Deferred / out of scope

- **FTS / tsvector / GIN index**: 規模拡大時に別 PR
- **検索 history / 候補**: 別 PR
- **trending hashtags / topics**: 別 spec (post tagging が別 spec 範囲)
- **user ranking (top followed accounts 等)**: 別 spec
- **search filter (period / location / role 等)**: 別 PR
- **rx-sns の filter chips (全て / セラピスト / ショップ)**: memory 方針 (商取引次元 drop / role 細分化なし) で v1 採用なし
- **/search の input debounce 値 (300ms)** は調整余地、後続 polish PR で。

## Verification

- **D1 monolith**: rspec post 62/0 + profile 153/14 baseline 維持、container smoke で 3 use_case + handler + 新 repo method 解決、`bin/grpc` 起動で `Discovery::V1::DiscoveryService::Service` 登場、空 query + 空 ranking で empty path 動作
- **D2 frontend**: tsc / build / lint baseline 維持、新 3 BFF route 登場、`/search` と `/ranking` が stub から実装に置換

全 PR additive / build-green / auto-merge 運用。
