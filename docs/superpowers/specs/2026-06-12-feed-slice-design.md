# Feed Slice Design — symmetric account-authored timeline aggregation

Date: 2026-06-12
Status: Design spec (implementation-ready)
Scope: `feed` context (timeline aggregation) を、旧 cast/guest split から **対称 (account-authored) post の集約 timeline** に再構築する。`feed.v1.ListFeed` 1 RPC で 3 タブ (全員 / エリア / フォロー中) を提供。`ListGuestFeed` / `ListCastFeed` は temporary に温存、cleanup で drop。proto → monolith → frontend の縦スライス、additive / build-green。

Related:
- `2026-05-31-domain-context-map-design.md` (keystone: feed は posts の集約、SNS feed primary)
- `2026-06-07-posts-slice-design.md` (posts symmetric model、feed timeline を本 spec に defer)
- `2026-06-02-profile-slice-design.md` (統合 Profile / prefecture フィールド)

## Grounding (実物確認)

- rx-sns 実物 (`.superpowers/rx-sns-render/{guest,cast}-home.png`、実機 capture 済): 中央フィードに **3 タブ** (全員 / エリア / フォロー中)、author + 本文 + media grid + reactions、Cast/Guest で構造同一。
- 現状 monolith (main = `7f637236`): `slices/feed/grpc/handler.rb` が `list_guest_feed` (filter ALL/FOLLOWING + prefecture) + `list_cast_feed` (自分の投稿管理) の 2 RPC、`FeedPost { cast_user_id, ... }` 等の独自 message。adapter 6 個 (cast/guest/post/follow/block/media)。
- 現状 frontend: `useTimeline` / `useGuestPost` hook、`/api/feed/cast` + `/api/feed/guest` BFF。

## Goal

旧非対称 feed (cast/guest split + 独自 FeedPost message) を、**symmetric な account-authored post の集約 timeline** に再構築する。3 フィルタ (ALL / AREA / FOLLOWING) + cursor pagination の 1 RPC で、Cast/Guest 区別なく同じ feed UI を提供。投稿の hydration (author / engagement / liked / media) は posts スライス側に集約し、feed スライスはタイムラインクエリと pagination に責務集中する。

## Ubiquitous language

| 旧 | 新 |
|---|---|
| ListGuestFeed / ListCastFeed | **ListFeed** |
| FeedPost / FeedAuthor / FeedMedia | **post.v1.Post / PostAuthor / PostMedia** を直接 import |
| cast_user_id (FeedPost) | **author_id** (post.v1.Post 経由) |
| FeedFilter { ALL, FOLLOWING } | **FeedFilter { ALL, AREA, FOLLOWING }** |
| list_guest_feed / list_cast_feed (use_case) | **list_feed** |
| feed/adapters/{cast,guest}_adapter | (drop in cleanup) |

## Domain model

Feed は **stored model ではなく projection** (集約クエリ)。Posts テーブルが source of truth。フィルタ条件で post_id リストを生成し、posts slice にハイドレーション依頼。

- **FeedFilter**: 3 値
  - `ALL`: `posts.visibility = 'public'` を時系列降順
  - `AREA`: `posts.visibility = 'public' AND author profile.prefecture = $prefecture`
  - `FOLLOWING`: `posts.visibility = 'public' AND posts.author_id IN (viewer の follow set)`
- 全 RPC 呼び出しは認証必須 (`authenticate_user!`)、`viewer_account_id` は常に取得済み。
- 全フィルタ共通: **block は bidirectional 評価** (viewer ↔ author いずれかが block していたら除外)、削除済み投稿除外、`created_at DESC, id DESC` で安定ソート、cursor base64 `(created_at, id)`
- **viewer perspective field** (`post.v1.Post.liked`): viewer_account_id ベースで毎回算出
- **account 鍵 (profile.is_private) follow-gate は本 spec の defer** (social スライス担当)

## Cross-slice contract

posts スライスに `Post::UseCases::ListPostsByIds` を新規追加。

```ruby
# slices/post/use_cases/list_posts_by_ids.rb
class ListPostsByIds
  include Post::Concerns::ProfileAuthorResolvable
  # post_repo / like_repo / comment_repo は DI

  def call(post_ids:, viewer_account_id: nil)
    # 戻り: Hash<post_id (String) => Post::V1::Post>
    # - author 解決: profile_author_adapter で batch
    # - engagement: like_repo / comment_repo の batch メソッド
    # - liked: viewer_account_id 渡し → account_liked_status_batch
    # - media: post_media を含めて hydrate
    # - visibility / 削除 filter は caller 責務 (feed は public しか渡さない)
  end
end
```

`Post::Slice["use_cases.list_posts_by_ids"]` 経由で feed handler から呼び出し。Profile スライスを `Profile::Slice["use_cases.get_profile"]` で呼ぶ既存パターンと同形 (#651 / #655 / #656)。

## API contract — `feed/v1` (additive)

```proto
syntax = "proto3";
package feed.v1;
import "post/v1/post_service.proto";

// 旧 (cleanup で drop)
service FeedService {
  rpc ListGuestFeed(ListGuestFeedRequest) returns (ListGuestFeedResponse);
  rpc ListCastFeed(ListCastFeedRequest) returns (ListCastFeedResponse);

  // Symmetric
  rpc ListFeed(ListFeedRequest) returns (ListFeedResponse);
}

enum FeedFilter {
  FEED_FILTER_UNSPECIFIED = 0;
  FEED_FILTER_ALL = 1;
  FEED_FILTER_AREA = 2;
  FEED_FILTER_FOLLOWING = 3;
}

message ListFeedRequest {
  FeedFilter filter = 1;
  int32 limit = 2;          // default 20, max 50
  string cursor = 3;        // base64 (created_at, id)
  string prefecture = 4;    // required when filter == AREA; ignored otherwise
}

message ListFeedResponse {
  repeated post.v1.Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

旧 `FeedPost` / `FeedAuthor` / `FeedMedia` messages と旧 RPC は本 spec の範囲では**温存**、cleanup PR で drop。

## Monolith feed slice (symmetric)

- **handler**: `Feed::Grpc::Handler#list_feed` 新設。`authenticate_user!` で `current_account_id` 取得 → filter validation (`AREA` で prefecture 空なら `INVALID_ARGUMENT`) → ListFeed use_case 呼び出し (返り = ordered post_ids + next_cursor) → cross-slice hydration (`Post::Slice["use_cases.list_posts_by_ids"]`) → 順序保持で response 構築。
- **use_case**: `Feed::UseCases::ListFeed#call(filter:, viewer_account_id:, prefecture:, limit:, cursor:)`。filter に応じて relation で post_ids を絞り込み、ordered list を返す。
- **relation / repo**: 既存 `feed_repo` を拡張して symmetric query を追加。`list_post_ids_all`, `list_post_ids_by_area(prefecture:)`, `list_post_ids_by_following(account_id:)` の 3 メソッド (cursor / limit / block 適用込み)。
- **block_adapter**: `account_id` ベースで symmetric 化 (旧 `cast_user_id` / `guest_user_id` 区別撤去)。block 関係を viewer ↔ author で対称評価。
- **follow_adapter**: 既存 (FOLLOWING フィルタで利用) は signature を `account_id` ベースに symmetric 化。relationship スライス未着手の間は posts/feed 直で account ↔ account のフォロー関係を見る。
- **author profile (prefecture)**: AREA フィルタで profile.prefecture を引く → `Profile::Slice["use_cases.list_account_ids_by_prefecture"]` 等の cross-slice 新規 use_case を profile slice に追加 (本 spec の F3 範囲)。
- **cross-slice hydration**: `Post::Slice["use_cases.list_posts_by_ids"]` を呼んで `Hash<id => Post>` 受け取り、handler 側で順序保持して response の `posts` に packed。

## Frontend

- **data 層**: `src/lib/grpc.ts` の `feedClient` は既存 bound。`src/modules/feed` (型 `FeedView` / mappers / hooks) + BFF route `/api/feed?filter=&prefecture=&cursor=&limit=` 1 本。
- **hooks**: `useFeed(filter: 'all' | 'area' | 'following', prefecture?: string)` で SWR + cursor pagination (`usePaginatedFetch` 経由、posts と同パターン)。
- **UI**: タブ component `<Tabs>` (既存 primitive) で 全員 / エリア / フォロー中 切替。`PostCardBinding` (#653/#654) を再利用してリスト描画。投稿一覧ページ = ルート `/` (= ホーム、rx-sns 踏襲)。
- 旧 `useTimeline` / `useGuestPost` hook、`/api/feed/cast` / `/api/feed/guest` BFF は温存 (cleanup で drop)。
- AREA タブで使う prefecture は viewer の profile.prefecture を `useProfile` から取得して default 設定 (UI 上で変更可能にするかは F4 の範囲外、まずは固定)。

## Visibility / privacy / safety

| 項目 | 本 spec での扱い | 後続 owner |
|---|---|---|
| `post.visibility = "public" \| "private"` | 既存維持、feed は public のみ | posts |
| `profile.is_private` (account 鍵 follow-gate) | 本 spec では無視 | social スライス |
| followers-only post visibility | 採用せず | 別 PR (proto breaking) |
| NSFW / 年齢ゲート | 本 spec の defer | discovery / safety スライス + 弁護士 hard gate |
| mute / hide post | 本 spec の defer | UX 別 PR |
| block (account ↔ account 対称) | symmetric 化を本 spec で実施 | feed (本 spec) |
| repost / quote | 本 spec の defer | posts 拡張 |

## Decomposition (increments、additive / build-green)

- **F1 — proto**: `feed/v1/feed_service.proto` に `ListFeed` RPC + `FeedFilter { ALL, AREA, FOLLOWING }` enum + `ListFeedRequest/Response` を additive 追加。`post/v1/post_service.proto` を import。両 stub (monolith Ruby / frontend TS) 再生成。旧 `ListGuestFeed` / `ListCastFeed` RPC と旧 message (FeedPost / FeedAuthor / FeedMedia) は温存。
- **F2 — posts cross-slice hydration**: `Post::UseCases::ListPostsByIds` を新規追加 (`Post::Slice["use_cases.list_posts_by_ids"]` で外部 callable)。`post_ids` と `viewer_account_id` から `Hash<post_id_string => Post::V1::Post>` を返す。`Post::Concerns::ProfileAuthorResolvable` で author 解決、like_repo / comment_repo の batch メソッドで engagement、viewer perspective の liked を含めて hydrate。**posts slice 内のみ touch**、feed slice には触れず先に PR 化可能。
- **F3a — profile cross-slice (prefecture lookup)**: `Profile::UseCases::ListAccountIdsByPrefecture` を新規追加 (`Profile::Slice["use_cases.list_account_ids_by_prefecture"]`)。AREA フィルタで feed が呼ぶ。F3 と分けても合体させても可、scope 規模次第。
- **F3 — feed slice symmetric handler**: `Feed::Grpc::Handler#list_feed` 実装 + `Feed::UseCases::ListFeed` 新規。`feed_repo` に 3 メソッド (list_post_ids_all / by_area / by_following) 追加。`block_adapter` / `follow_adapter` を **symmetric 化** (account_id ベース)。cross-slice hydration (F2) で `post.v1.Post[]` 化。旧 use_cases は温存。
- **F4 — frontend**: data 層 (`/api/feed` BFF + `useFeed` hook + `FeedView` 型 + mapper) と UI (`<Tabs>` 3 タブ + `PostCardBinding` リスト描画 + 投稿一覧ページ) を実装。F4a (data) / F4b (UI) の 2 PR 分割か 1 PR か は plan 時にユーザ確認 (posts Q4 と同じ運用)。旧 `useTimeline` / `useGuestPost` / `/api/feed/{cast,guest}` は温存。
- **cleanup (Q5 後の独立 PR)**: 旧 RPC / 旧 message / 旧 use_cases / 旧 cast_adapter / guest_adapter / 旧 BFFs / 旧 hooks を drop。posts cleanup と合流して `Post::Adapters::CastAdapter` / `GuestAdapter` / `UserAdapter` 全削除の道筋もここで確定。

## Deferred / out of scope

- account 鍵 follow-gate (social スライス、posts spec と同じ defer)
- followers-only visibility (post-level 3rd state、proto breaking change)
- NSFW gate / 年齢ゲート (discovery / safety スライス + 弁護士 hard gate)
- hashtag / トレンド / おすすめ タブ (discovery スライス)
- 推薦 / engagement ベース ranking (時系列降順のみ、score-based は discovery)
- mute / hide post from timeline (UX 別 PR)
- リアルタイム push (新 post の WebSocket 通知 → notifications スライス)
- repost / quote / 引用 (posts 拡張、別 PR)
- media 実 upload e2e (object storage 配備後、posts と同じ defer)
- 旧 BFF / 旧 hook / 旧 RPC / 旧 use_cases / 旧 adapter の drop (cleanup PR)
- AREA タブの prefecture UI 変更機能 (F4 では viewer.profile.prefecture 固定、後で UI 追加)

## Verification

- **F1 (proto)**: `buf lint` 致命傷無し、monolith stub `ruby -c stubs/feed/v1/feed_service_pb.rb` Syntax OK、frontend stub `pnpm proto:gen` + `pnpm exec tsc --noEmit` + `pnpm build` 緑。
- **F2 (posts cross-slice)**: `bundle exec rspec spec/slices/post` 既存 67 examples 緑維持。追加 unit spec は YAGNI で skip (cross-slice integration は F3 で実証)。
- **F3 (feed slice)**: `bundle exec rspec spec/slices/feed` 既存緑維持。旧 use_cases 不変。新 handler 経由動作は frontend e2e で実証可。
- **F4 (frontend)**: `pnpm exec tsc --noEmit` + `pnpm build` + `pnpm lint` (#659 で復活、新 violation 出さない) 緑。`/dev/ui` で mock visual 確認 (puppeteer screenshot)。ローカル e2e (`[[local-e2e-run]]` メモリ手順) で実 backend と疎通。
- 全 PR additive / build-green、push して Draft PR、cleanup は別 PR。
