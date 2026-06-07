# Posts Slice Design — symmetric SNS posts (account-authored)

Date: 2026-06-07
Status: Design spec (implementation-ready)
Scope: post context（投稿 / いいね / コメント）を、旧 cast-authored の非対称モデルから、統合 Profile に基づく**対称（account-authored）モデル**へ再構築する。proto → monolith → frontend の縦スライス、additive / build-green。
Related: `2026-05-31-domain-context-map-design.md`（keystone: posts = post/like/comment、SNS feed primary）、`2026-06-02-profile-slice-design.md` / `2026-06-05-profile-ui-design.md`（統合 Profile / ProfileService / role-aware UI 原則）。

## Grounding（実物確認）

- rx-sns 実物（`.superpowers/rx-sns-render/guest-myprofile.png`、高解像度）: **guest アカウント**（バッジ「ユーザー」、@panicboat）に **「投稿する」ボタン** + プロフィールに **投稿 / 返信 / メディア / いいね タブ**。→ **ゲストも投稿できる＝対称モデル**（推測でなく実物根拠）。
- 現状 monolith（main）: `post.posts.cast_user_id`（投稿はキャストのみ）、`post.likes.guest_user_id`（いいねはゲストのみ）、proto は `CastPost` / `ListCastPosts` 中心、`post/adapters/{cast,guest}_adapter` で旧 role 結合、テーブル制約名も `cast_posts_*` 等のレガシー。→ 脱 cast 化が必要。

## Goal

旧 cast/guest 非対称 posts を、**誰でも（cast/guest 問わず）投稿・いいね・コメントできる対称 SNS posts**（投稿者＝account、統合 Profile で著者解決）へ再構築する。将来ビジネスルールで投稿者を絞る場合も、スキーマ/サービスは対称に保ち、制限は policy / UI で表現する。

## Ubiquitous language

| 旧 | 新 |
|---|---|
| CastPost / cast_post | **Post** |
| ListCastPosts / GetCastPost / SaveCastPost / DeleteCastPost | **ListPosts / GetPost / SavePost / DeletePost** |
| cast_user_id（著者） | **author_id**（= account id） |
| guest_user_id（いいね主） | **account_id** |
| CastPostAuthor | **PostAuthor** |

## Domain model（symmetric）

- **Post**: `id, author_id（account, identity.Account と対応）, content, media[], visibility(public/private), hashtags[], created_at, updated_at, likes_count, comments_count, liked(閲覧者視点)`。投稿者＝任意 account。
- **Like**: `post_id, account_id`（誰でも like。1 account 1 post 1 like = unique 制約）。
- **Comment**: `id, post_id, parent_id（threaded）, author_id（account）, content, replies_count, created_at`。現状 `user_id` ベースで既に対称的 → 語彙を author_id に整える。
- **著者解決**: 統合 **ProfileService**（GetProfile by account_id → display_name / username / avatar_url）。旧 `cast_adapter` / `guest_adapter` を **profile 1 本**（`author_loader` → ProfileService）へ集約。
- **media**: `post_media`（image/video, media_id, position）= media スライス（pre-signed URL）参照。実アップロード e2e は object storage 配備後（P5f と同じ制約）。

## Visibility / privacy

- **post-level visibility(public/private)** は維持（投稿単位の公開範囲）。
- **account-level 鍵アカウント**（`profile.is_private`）の follow-gate（鍵アカの投稿は承認フォロワーのみ閲覧）は **social スライス（relationship）** の責務 → **deferred**。posts は post-level visibility のみ扱う。

## Role-aware UI（原則）

データ / サービスは**対称**（両ロール投稿可）。cast / guest のメニュー・ナビ出し分けは **アプリシェル / ナビ層**で表現する（posts スライス外。設計原則として記録）。

## API contract — `post/v1`（additive）

新・対称 RPC を `post/v1` に**追加**（旧 CastPost RPC は cleanup まで温存し build-green）:

- **PostService**: `ListPosts` / `GetPost` / `SavePost` / `DeletePost`。`Post` message = author_id, content, media[], visibility, hashtags[], likes_count, comments_count, liked + `PostAuthor{ account_id, display_name, username, avatar_url }`。
- **LikeService**: `LikePost` / `UnlikePost` / `GetLikeStatus`（account ベース）。
- **CommentService**: `AddComment` / `DeleteComment` / `ListComments` / `ListReplies`（author_id ベース、threaded）。

## Monolith post slice

- **relations**: `posts(author_id)` / `likes(account_id)` / `comments(author_id)` / `post_media` / `comment_media` / `hashtags`。
- **schema（additive）**: `posts` に `author_id` 追加（旧 `cast_user_id` から backfill or reseed）、`likes` に `account_id`（旧 `guest_user_id`）、`likes` に unique(post_id, account_id)。レガシー制約名整理は migration で。旧カラムは残し、cleanup で drop。
- **著者解決**: `author_loader` を ProfileService 1 本に集約（cast/guest adapter は cleanup で撤去）。
- **service**: 対称 PostService / LikeService / CommentService を実装（旧 CastPost RPC と並走）。

## Frontend

- `src/modules/post`: 型 + mappers（proto Post ↔ view）+ hooks（usePosts / usePost / useLike / useComments）+ BFF routes（`/api/posts...`）。
- UI: **コンポーズ**（投稿作成、media 添付）、**投稿詳細** `/posts/[id]`、**PostCard**（既存 `ui/post-card` 活用）、like / comment。
- **feed timeline（一覧集約）は feed スライス（次）**。posts は単体投稿 + 著者 + like / comment まで。

## Decomposition（increments、additive / build-green）

- **Q1**: proto — 対称 Post/Like/Comment を `post/v1` に additive 追加、両 stub（monolith Ruby / frontend TS）再生成。
- **Q2**: monolith schema — `posts.author_id` / `likes.account_id` 追加、unique(post_id, account_id)、relation / repo、reseed。
- **Q3**: monolith service — 対称 PostService / LikeService / CommentService 実装、著者＝ProfileService（`author_loader` 集約）。
- **Q4**: frontend — data 層（client/BFF/hooks/型/mappers）+ コンポーズ / 投稿詳細 / like / comment UI。
- **cleanup（後続）**: 旧 CastPost RPC・cast/guest adapter・旧カラム（cast_user_id / guest_user_id）drop（feed / frontend 乗り換え後）。

## Deferred / out of scope

- account 鍵の follow-gate（social スライス）、feed timeline（feed スライス）、役割別メニュー（アプリシェル）、画像 / 動画の実アップロード e2e（object storage 配備後）、ハッシュタグ検索 / トレンド（discovery）、引用 / リポスト等の拡張。

## Verification

- monolith: `rspec` + gRPC load チェック。frontend: `pnpm build`（型）+ `/dev/ui` / ブラウザ実機。各増分 additive で build-green。
