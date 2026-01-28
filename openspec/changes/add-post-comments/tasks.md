## 1. Backend - Database

- [ ] 1.1 DB migration: `social.post_comments` テーブル作成
  - id (uuid, PK)
  - post_id (uuid, FK → cast_posts.id)
  - user_id (uuid, NOT NULL) - コメント投稿者
  - parent_id (uuid, nullable, FK → post_comments.id) - 返信先
  - content (text, NOT NULL)
  - created_at (timestamp)
  - updated_at (timestamp)
- [ ] 1.2 インデックス: `post_id`, `parent_id`, `created_at`

## 2. Backend - Proto

- [ ] 2.1 `PostComment` message の定義
- [ ] 2.2 `ListPostCommentsRequest/Response` の定義
- [ ] 2.3 `CreatePostCommentRequest/Response` の定義
- [ ] 2.4 `DeletePostCommentRequest/Response` の定義
- [ ] 2.5 `TimelineService` に `ListPostComments`, `CreatePostComment`, `DeletePostComment` RPC を追加
- [ ] 2.6 Proto コード生成: `buf generate`

## 3. Backend - Business Logic

- [ ] 3.1 Relation: `post_comments` relation 定義
- [ ] 3.2 Repository: `CommentRepository` 作成（create, list_by_post, delete, find_by_id）
- [ ] 3.3 Contract: `CreateCommentContract` 作成（content 必須、最大1000文字）
- [ ] 3.4 UseCase: `ListComments` 作成（post_id でフィルタ、親子関係を含む）
- [ ] 3.5 UseCase: `CreateComment` 作成（認証ユーザーのみ、parent_id で返信対応）
- [ ] 3.6 UseCase: `DeleteComment` 作成（投稿者本人またはポストのキャストのみ削除可能）
- [ ] 3.7 Presenter: `CommentPresenter` 作成
- [ ] 3.8 gRPC Handler: 3つの RPC エンドポイントを実装
- [ ] 3.9 `PostPresenter` の `comments_count` を実データに更新

## 4. Frontend - API

- [ ] 4.1 BFF API route: `GET /api/posts/[postId]/comments` 作成
- [ ] 4.2 BFF API route: `POST /api/posts/[postId]/comments` 作成
- [ ] 4.3 BFF API route: `DELETE /api/posts/[postId]/comments/[commentId]` 作成
- [ ] 4.4 gRPC client: social client にコメント関連メソッドを追加

## 5. Frontend - UI

- [ ] 5.1 型定義: `PostComment` 型を追加
- [ ] 5.2 Hook: `usePostComments(postId)` 作成（SWR）
- [ ] 5.3 コメント一覧コンポーネント: スレッド表示（親→子の1階層ネスト）
- [ ] 5.4 コメント投稿フォーム: テキスト入力 + 送信ボタン
- [ ] 5.5 返信フォーム: 「返信」ボタン押下で返信先を指定
- [ ] 5.6 コメント削除: 投稿者本人またはポストのキャストが削除可能
- [ ] 5.7 `TimelineItem` にコメント展開セクションを追加
- [ ] 5.8 投稿詳細ページにコメントセクションを統合

## 6. Testing

- [ ] 6.1 Backend: コメント作成・取得・削除のテスト
- [ ] 6.2 Backend: 返信の親子関係テスト
- [ ] 6.3 Backend: 認可テスト（削除権限）
- [ ] 6.4 Frontend: コメント表示・投稿・削除の動作確認
