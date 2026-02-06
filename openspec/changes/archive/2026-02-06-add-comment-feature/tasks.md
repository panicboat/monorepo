# Tasks: Add Comment Feature

## Phase 1: Database & Proto

### 1.1 Create `post_comments` Table
- [x] `social.post_comments` テーブルのマイグレーション作成
  - `user_id` カラム（identity.users への FK、ゲスト・キャスト両対応）
  - `parent_id` カラム追加（返信用）
  - `replies_count` カラム追加
- [x] インデックス追加（post_id, parent_id, user_id, created_at）
- [ ] `rake db:migrate` で適用確認

### 1.2 Create `comment_media` Table
- [x] `social.comment_media` テーブルのマイグレーション作成
- [x] インデックス追加（comment_id）
- [ ] `rake db:migrate` で適用確認

### 1.3 Proto Definition
- [x] `proto/social/v1/service.proto` に Comment 関連メッセージ追加
  - `Comment`, `CommentMedia`, `CommentAuthor`（user_type フィールド含む）
  - `AddComment`, `DeleteComment`, `ListComments`, `ListReplies` RPC
- [x] `buf generate` で Proto 生成

**Dependencies:** なし
**Parallelizable:** 1.1, 1.2, 1.3 は並行可能

---

## Phase 2: Backend Implementation

### 2.1 Repository & Relations
- [x] `slices/social/relations/post_comments.rb` 作成
- [x] `slices/social/relations/comment_media.rb` 作成
- [x] `slices/social/repositories/comment_repository.rb` 作成
  - `create(post_id:, user_id:, content:, parent_id:, media:)`
  - `delete(id:, user_id:)`
  - `list_by_post(post_id:, limit:, cursor:)` (top-level only)
  - `list_replies(parent_id:, limit:, cursor:)`

### 2.2 Use Cases
- [x] `slices/social/use_cases/comments/add_comment.rb` 作成
  - メディア添付対応
  - 返信対応（1階層制限バリデーション）
  - カウント更新（post.comments_count, parent.replies_count）
- [x] `slices/social/use_cases/comments/delete_comment.rb` 作成
  - 返信がある場合の処理
- [x] `slices/social/use_cases/comments/list_comments.rb` 作成
- [x] `slices/social/use_cases/comments/list_replies.rb` 作成

### 2.3 Presenter
- [x] `slices/social/presenters/comment_presenter.rb` 作成
  - メディア変換対応
  - Author の user_type 解決（guest/cast）

### 2.4 gRPC Handler
- [x] `slices/social/grpc/handler.rb` に RPC メソッド追加
  - `add_comment`
  - `delete_comment`
  - `list_comments`
  - `list_replies`

### 2.5 Backend Tests
- [ ] Repository のユニットテスト
- [ ] Use Case のユニットテスト（メディア、返信、ゲスト・キャスト両方）
- [ ] gRPC Handler の統合テスト

**Dependencies:** Phase 1 完了後
**Parallelizable:** 2.1〜2.4 は順次、2.5 は 2.4 完了後

---

## Phase 3: Frontend Implementation

### 3.1 API Routes
- [x] `app/api/guest/comments/route.ts` 作成（POST, GET）- 共通エンドポイント
  - メディア URL 対応
  - 認証トークンからユーザータイプを判別
- [x] `app/api/guest/comments/[id]/route.ts` 作成（DELETE）
- [x] `app/api/guest/comments/[id]/replies/route.ts` 作成（GET）

### 3.2 Types
- [x] `modules/social/types.ts` に Comment 型追加
  - `Comment`, `CommentMedia`, `CommentAuthor`（userType フィールド含む）

### 3.3 Hooks
- [x] `modules/social/hooks/useComments.ts` 作成
  - `fetchComments(postId)`
  - `addComment(postId, content, media?, parentId?)`
  - `deleteComment(commentId)`
  - `fetchReplies(commentId)`

### 3.4 Components
- [x] `modules/social/components/comments/CommentItem.tsx` 作成
  - メディア表示対応
  - 返信ボタン
  - 削除ボタン（自分のコメントのみ）
  - ユーザータイプバッジ（キャストの場合「Cast」表示）
- [x] `modules/social/components/comments/CommentSection.tsx` 作成（CommentList 統合）
  - 無限スクロール対応
- [x] `modules/social/components/comments/CommentForm.tsx` 作成
  - メディアアップロード UI（プレースホルダー）
  - 文字数カウンター
- [x] `modules/social/components/comments/index.ts` 作成

### 3.5 Post Detail Integration
- [x] `app/(guest)/timeline/[id]/page.tsx` にコメントセクション追加
- [ ] `app/(cast)/timeline/[id]/page.tsx` にコメントセクション追加（キャスト用）
- [x] コメント数の表示

### 3.6 Frontend Tests
- [ ] Hook のユニットテスト
- [ ] Component のユニットテスト

**Dependencies:** Phase 2 完了後
**Parallelizable:** 3.1〜3.4 は並行可能、3.5 は 3.1〜3.4 完了後

---

## Phase 4: Seed Data & Validation

### 4.1 Seed Data
- [x] `config/db/seeds.rb` にコメントのシードデータ追加
  - ゲストからのコメント
  - キャストからのコメント
  - 返信コメント
  - メディア付きコメント（TODO: 追加予定）

### 4.2 End-to-End Validation
- [ ] 手動テスト：ゲストがコメント追加（テキストのみ）
- [ ] 手動テスト：キャストがコメント追加（テキストのみ）
- [ ] 手動テスト：コメント追加（メディア付き）
- [ ] 手動テスト：コメントへの返信（ゲスト・キャスト両方）
- [ ] 手動テスト：返信への返信は不可であることを確認
- [ ] 手動テスト：コメント一覧表示（ユーザータイプバッジ確認）
- [ ] 手動テスト：返信一覧の展開/折りたたみ
- [ ] 手動テスト：コメント削除
- [ ] 手動テスト：ページネーション

**Dependencies:** Phase 3 完了後

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Database & Proto | 3 | ✅ Complete (migration pending apply) |
| 2. Backend | 5 | ✅ Complete (tests pending) |
| 3. Frontend | 6 | ✅ Complete (tests pending) |
| 4. Seed & Validation | 2 | Partial (seed done, validation pending) |

**Total:** 16 tasks

## Key Implementation Notes

1. **ゲスト・キャスト共通**: `user_id` で identity.users を参照（両ユーザータイプ対応）
2. **API エンドポイント共通**: `/api/guest/comments` で統一（認証トークンでユーザータイプ判別）
3. **返信の1階層制限**: `parent_id` が設定されているコメントには返信不可
4. **メディア上限**: コメントあたり最大3枚
5. **既存のアップロードフローを再利用**: Presigned URL パターン（TODO）
6. **カウント管理**: `cast_posts.comments_count` と `post_comments.replies_count` の両方を更新
7. **ユーザータイプ表示**: キャストのコメントには「Cast」バッジを表示

## Files Created/Modified

### Backend (Monolith)
- `config/db/migrate/20260205000000_create_post_comments.rb` (new)
- `config/db/migrate/20260205000001_create_comment_media.rb` (new)
- `slices/social/relations/post_comments.rb` (new)
- `slices/social/relations/comment_media.rb` (new)
- `slices/social/repositories/comment_repository.rb` (new)
- `slices/social/adapters/user_adapter.rb` (new)
- `slices/social/use_cases/comments/add_comment.rb` (new)
- `slices/social/use_cases/comments/delete_comment.rb` (new)
- `slices/social/use_cases/comments/list_comments.rb` (new)
- `slices/social/use_cases/comments/list_replies.rb` (new)
- `slices/social/presenters/comment_presenter.rb` (new)
- `slices/social/grpc/handler.rb` (modified)
- `config/db/seeds.rb` (modified)

### Proto
- `proto/social/v1/service.proto` (modified)
- `stubs/social/v1/service_pb.rb` (regenerated)
- `stubs/social/v1/service_services_pb.rb` (regenerated)

### Frontend (Nyx)
- `src/app/api/guest/comments/route.ts` (new)
- `src/app/api/guest/comments/[id]/route.ts` (new)
- `src/app/api/guest/comments/[id]/replies/route.ts` (new)
- `src/modules/social/types.ts` (modified)
- `src/modules/social/hooks/useComments.ts` (new)
- `src/modules/social/components/comments/CommentItem.tsx` (new)
- `src/modules/social/components/comments/CommentForm.tsx` (new)
- `src/modules/social/components/comments/CommentSection.tsx` (new)
- `src/modules/social/components/comments/index.ts` (new)
- `src/app/(guest)/timeline/[id]/page.tsx` (modified)
