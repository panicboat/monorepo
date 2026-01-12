# Design: Engagement Features

## Domain Model

### 1. Timeline (Social Domain?)
現在は `Concierge` または `Discovery` に位置づけられる機能か？ ユーザー要望は「Timeline: 投稿機能」です。
新しい概念としての「Engagement」、あるいはキャストの資産としての「Portfolio」が適していると考えられます。
`TimelineFeed` は `discovery` にありますが、投稿自体はキャストによって作成されます。
今回は以下のシンプルなスキーマを提案します。

**Table: `posts`**
- `id`: UUID (PK)
- `cast_id`: UUID (FK to `casts`)
- `content`: Text
- `media_urls`: Array<String>
- `media_type`: String (image, video) - **[NEW]**
- `created_at`: Timestamp

**Table: `post_likes`**
- `id`: UUID
- `post_id`: UUID
- `guest_id`: UUID

**Table: `post_comments`**
- `id`: UUID
- `post_id`: UUID
- `guest_id`: UUID
- `content`: Text

### 2. History & Reviews (Trust Domain)
既存の `Trust` ドメインが適切です。

**Table: `reviews`**
- `id`: UUID (PK)
- `cast_id`: UUID (FK to `casts`)
- `guest_id`: UUID (FK to `guests`)
- `rating`: Integer (1-5)
- `comment`: Text
- `tags`: Array<String> (JSONB or separate table)
- `status`: String (pending, public, hidden) - **[NEW]** Cast approval and visibility workflow
    - `pending`: Waiting for approval
    - `public`: Visible on profile
    - `hidden`: Approved but hidden by Cast
- `created_at`: Timestamp

### 3. Frontend Architecture
- **Cast Side (Manage)**:
    - `/manage/timeline`: 過去の投稿一覧、新規投稿フォーム。
    - `/manage/reviews`: 受け取ったレビューの一覧、返信機能（今回はUIのみ）。
    - `/manage/history`: 過去の儀式（予約）一覧 -> `Ritual` ドメインと連携。

- **Guest Side**:
    - Timeline view: タイムライン表示（`TimelineFeed.tsx` に一部実装済み）。
    - Review submission: レビュー投稿（儀式完了後？）。
    - Review list: レビュー一覧（`ReviewList.tsx` に一部実装済み）。

## API Strategy
- **REST/RPC**:
    - `GET /casts/me/posts` (Cast用)
    - `POST /casts/me/posts` (Cast用)
    - `DELETE /casts/me/posts/:id` (Cast用)
    - `GET /casts/:id/reviews` (Guest/Public用)
    - `POST /casts/:id/reviews` (Guest - 認証必須)

## UX Considerations
- **Timeline**: 画像アップロードが重要です。既存の `PhotoUploader` コンポーネントのロジックを活用します。
- **Reviews**: タグはプリセット選択式か自由入力か？ `ReviewList` のモックデータでは "Good Listener" のようなプリセットが示唆されています。
