# Profile Content Tabs Design — /u/[username] に 投稿 / 返信 / メディア / いいね tabs

Date: 2026-06-17
Status: Design spec (implementation-ready)
Scope: rx-sns visual gap audit Tier 3。`/u/[username]` プロフィールページに rx-sns 同等の content tabs (投稿 / 返信 / メディア / いいね) を追加。各 tab は per-author の post / comment / media-filtered post / liked post を cursor pagination で表示。Post / Comment / Like の 3 slice に必要最小限の RPC 拡張を additive で行う。

Related:
- `2026-06-07-posts-slice-design.md` (`Post::ListPosts(authorId)` を流用 + `media_only` flag 拡張)
- `2026-05-29-design-system-design.md` §6 (Tab primitive、`Tabs` + `TabItem` 既存)
- `.superpowers/rx-sns-render/{cast,guest}-myprofile.png` (rx-sns 実機での tabs 配置 grounded)

## Grounding

- 既存 `/u/[username]/page.tsx` は ProfileHeader + (Follow/Block/StartChat button block) + フォロー数 count のみで content list なし。
- rx-sns desktop capture (`guest-myprofile.png`) で content area に 4 tabs (投稿 / 返信 / メディア / いいね) + 各 tab 配下に post / comment list。空 tab は「まだ投稿はありません」placeholder。
- 既存 `ListPosts(authorId)` 完了済 (Post slice)、`ListComments(postId)` 完了済 (Post slice)、`Like` 表 (Post slice) 完了済。
- 既存 `Tabs` UI primitive (`@/components/ui/tab`) を `/oshi` `/ranking` `/search` で使用済、踏襲可能。

## Goal

`/u/[username]` の ProfileHeader / 数値 表示の下に **4 tabs** を配置、各 tab で per-author content を cursor pagination で表示。「返信」は user authored comments を post hydration 付きで表示、「メディア」は media field 1+ の post のみ、「いいね」は user が like した post。各 tab は独立 hook + 独立 SWR cache。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| Tab 数 | **4 つ全実装** (投稿 / 返信 / メディア / いいね) |
| 「返信」表示 | comment row、parent post の preview (1 行抜粋) を上に小さく添える形 |
| 「メディア」filter | proto `ListPostsRequest.media_only` (bool) 追加、backend で post.media が空でない post のみ filter |
| 「いいね」source | 新 RPC `Like::ListLikedPostsByAccount(account_id)` 追加、`like` 表を post hydration で返す |
| pagination | 各 tab cursor (created_at, id)、limit 20 |
| privacy | 全 tab で post 系は `Social::FilterVisiblePosts` で follow-gate filter (既存 `ListPostsByIds` 再利用) |
| 自分の post tab | tab は viewer / others 共通 (`/u/[me]` も同 layout) |
| 返信 hydration | comment が指す post を per-row `Post::Slice["use_cases.posts.list_posts_by_ids"]` で hydration、batch で取得 |

## Backend extensions

### 1. Post slice (1 modify)

**`Post::Repositories::PostRepository#list_posts`** に `media_only: bool` 引数追加:
```ruby
def list_posts(limit: 20, cursor: nil, author_id: nil, media_only: false)
  scope = posts.where(visibility: "public")
  scope = scope.where(author_id: author_id) if author_id
  scope = scope.where { id =~ post_media.select(:post_id) } if media_only
  # ... existing cursor + order ...
end
```

`Post::V1::ListPostsRequest` に `bool media_only = ?;` 追加、handler で pass-through。

### 2. Comment slice (1 new RPC + 1 new use_case + 1 repo method)

**新 proto RPC**:
```proto
service CommentService {
  // ... existing 4 RPCs ...
  rpc ListCommentsByAuthor(ListCommentsByAuthorRequest) returns (ListCommentsByAuthorResponse);
}

message ListCommentsByAuthorRequest {
  string author_id = 1;
  int32 limit = 2;
  string cursor = 3;
}

message ListCommentsByAuthorResponse {
  repeated Comment comments = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

**`Post::Repositories::CommentRepository#list_by_author`** 新規:
```ruby
def list_by_author(author_id:, limit:, cursor:)
  scope = comments.where(user_id: author_id)
  # cursor (created_at desc, id desc)
  scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
end
```

**`Post::UseCases::Comments::ListCommentsByAuthor`** 新規 use_case (内部で post hydration: 各 comment の post_id をまとめて `Post::Slice["use_cases.posts.list_posts_by_ids"]` で取得して response に詰める、parent post 情報を append)。proto Comment message に `Post parent_post = X` を optional 追加するか、別途 `ListCommentsByAuthorResponse.posts_by_id map` を追加して frontend で join、いずれかを選択 (本 spec は後者を採用、proto 変更最小化)。

**`Post::Grpc::CommentHandler`** に method 追加 + `bin/grpc` は handler require 済のため不要。

### 3. Like slice (1 new RPC + 1 new use_case + 1 repo method)

**新 proto RPC** (post.v1.LikeService に追加):
```proto
service LikeService {
  // ... existing 3 RPCs ...
  rpc ListLikedPostsByAccount(ListLikedPostsByAccountRequest) returns (ListLikedPostsByAccountResponse);
}

message ListLikedPostsByAccountRequest {
  string account_id = 1;
  int32 limit = 2;
  string cursor = 3;
}

message ListLikedPostsByAccountResponse {
  repeated Post posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

**`Post::Repositories::LikeRepository#liked_post_ids_by_account`** 新規:
```ruby
def liked_post_ids_by_account(account_id:, limit:, cursor:)
  scope = likes.where(account_id: account_id)
  # cursor (created_at desc, id desc) on likes 表
  ids = scope.order { [created_at.desc, id.desc] }.limit(limit + 1).select_map(:post_id)
  ids
end
```

**`Post::UseCases::Likes::ListLikedPostsByAccount`** 新規 use_case (post id 取得 → `Post::Slice["use_cases.posts.list_posts_by_ids"]` で hydration、order 保持で返却)。

**`Post::Grpc::LikeHandler`** に method 追加。

## API contract summary

3 service への additive 追加 (新 file なし、既存 proto に append):
- `post.v1.PostService.ListPosts` request に `media_only` field
- `post.v1.CommentService.ListCommentsByAuthor` 新 RPC
- `post.v1.LikeService.ListLikedPostsByAccount` 新 RPC

## Frontend

- **types** (`src/modules/post/lib/profile-tabs.ts` 新規):
  - tab kind enum `"posts" | "replies" | "media" | "likes"`
- **3 hooks** (`src/modules/post/hooks/`):
  - `useAuthorPosts(accountId, mediaOnly)` (`useSWRInfinite` cursor、`media_only` query 含む)
  - `useAuthorComments(accountId)` (`useSWRInfinite` cursor、結果に `commentsView + postsByIdMap` 同梱)
  - `useAuthorLikedPosts(accountId)` (`useSWRInfinite` cursor)
- **3 BFFs**:
  - 既存 `GET /api/posts?author_id=X&media_only=1` (修正のみ、media_only query を渡す)
  - 新 `GET /api/posts/comments-by-author?author_id=X` (新 RPC を呼ぶ)
  - 新 `GET /api/posts/liked-by?account_id=X` (新 RPC を呼ぶ)
- **UI** (`/u/[username]/page.tsx` 修正):
  - ProfileHeader / counts の下に `<Tabs items={TABS} value={tab} onValueChange={setTab} />`
  - 各 tab の content (PostCardBinding.map / 返信 row component / PostCardBinding for media or likes)
  - 「返信」専用 component: comment + parent post preview の 2 段表示

## Decomposition (4 PR)

- **P0** (本 spec、commit + self-review + user 確認)
- **P1**: monolith — proto extensions (3 services への additive 追加) + stubs regen + 3 use_cases + 3 repo extensions + 2 handler methods + container smoke
- **P2**: frontend data — 3 hooks + 3 BFFs (1 修正 + 2 新規) + lib/profile-tabs types
- **P3**: frontend UI — `/u/[username]/page.tsx` に Tabs + 4 tab content rendering + 「返信」専用 component

各 PR build-green / additive / auto-merge 運用。

## Deferred / out of scope

- **viewer 自身の private posts** を tab に含める: 現状の `ListPosts` は `visibility = 'public'` 強制、viewer == author 時の private 含めは別 PR
- **「投稿」tab に reposts**: repost 機能未実装、別 PR
- **comment への reply 含み**: comments tab は top-level + reply の混在表示も option 可、v1 は混在 (replies expansion は M3 で別 PR で実装済)
- **「メディア」grid 表示**: 現状は PostCardBinding 単純 list、grid 化は別 PR
- **infinite scroll**: 各 tab は手動「もっと見る」、別 PR
- **per-tab count badge** (例: 投稿 5)、別 PR

## Verification

- **P1 monolith**: rspec post 62/0 + profile 153/14 baseline 維持、container smoke で 3 use_case 解決、empty path 動作、bin/grpc 起動で既存 binding 維持
- **P2 frontend data**: tsc / build / lint baseline 維持、新 BFFs 出力
- **P3 frontend UI**: tsc / build / lint baseline 維持、`/u/[username]` route 維持 + 4 tabs 動作

全 PR additive / build-green / auto-merge 運用。
