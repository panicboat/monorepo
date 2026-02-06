# Design: Add Comment Feature

## Architecture Overview

コメント機能は Social ドメイン内に実装する。既存のいいね・フォロー機能と同様のパターンに従う。ゲストとキャストの両方がコメント可能。

```
Guest/Cast App → API Route → gRPC → Social Slice → PostgreSQL
```

## Database Design

### Table: `social.post_comments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| post_id | UUID | FK → cast_posts(id), NOT NULL | 対象投稿 |
| parent_id | UUID | FK → post_comments(id), NULL | 親コメント（返信の場合） |
| user_id | UUID | FK → identity.users(id), NOT NULL | コメント投稿者（Guest/Cast） |
| content | TEXT | NOT NULL, CHECK(length <= 1000) | コメント本文 |
| replies_count | INTEGER | NOT NULL, DEFAULT 0 | 返信数 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |

### Table: `social.comment_media`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| comment_id | UUID | FK → post_comments(id), NOT NULL | 対象コメント |
| media_type | VARCHAR(10) | NOT NULL, CHECK(IN 'image', 'video') | メディアタイプ |
| url | TEXT | NOT NULL | メディア URL |
| thumbnail_url | TEXT | NULL | サムネイル URL（動画用） |
| position | INTEGER | NOT NULL, DEFAULT 0 | 表示順序 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |

### Indexes

```sql
-- post_comments
CREATE INDEX idx_post_comments_post_id ON social.post_comments(post_id);
CREATE INDEX idx_post_comments_parent_id ON social.post_comments(parent_id);
CREATE INDEX idx_post_comments_user_id ON social.post_comments(user_id);
CREATE INDEX idx_post_comments_created_at ON social.post_comments(created_at DESC);

-- comment_media
CREATE INDEX idx_comment_media_comment_id ON social.comment_media(comment_id);
```

### Constraints

- `post_id` は `social.cast_posts(id)` への外部キー（ON DELETE CASCADE）
- `parent_id` は `social.post_comments(id)` への外部キー（ON DELETE CASCADE）
- `comment_id` は `social.post_comments(id)` への外部キー（ON DELETE CASCADE）
- `user_id` は `identity.users(id)` への外部キー（ゲストもキャストも同じテーブル）
- `content` は 1〜1000 文字（空文字不可）
- 返信は1階層のみ: `parent_id` が設定されているコメントには返信不可

### Reply Depth Constraint

返信は1階層のみに制限する。これはアプリケーションレベルで制御：

```ruby
# 親コメントが既に返信（parent_id != null）の場合は拒否
raise Error::InvalidReply if parent.parent_id.present?
```

## Proto Design

```protobuf
// Add to social/v1/service.proto

// Comment RPCs
rpc AddComment(AddCommentRequest) returns (AddCommentResponse);
rpc DeleteComment(DeleteCommentRequest) returns (DeleteCommentResponse);
rpc ListComments(ListCommentsRequest) returns (ListCommentsResponse);
rpc ListReplies(ListRepliesRequest) returns (ListRepliesResponse);

message CommentMedia {
  string id = 1;
  string media_type = 2; // "image" or "video"
  string url = 3;
  string thumbnail_url = 4;
}

message Comment {
  string id = 1;
  string post_id = 2;
  string parent_id = 3; // empty if top-level comment
  string user_id = 4;   // Guest or Cast user ID
  string content = 5;
  string created_at = 6; // ISO8601
  CommentAuthor author = 7;
  repeated CommentMedia media = 8;
  int32 replies_count = 9;
}

message CommentAuthor {
  string id = 1;
  string name = 2;
  string image_url = 3;
  string user_type = 4; // "guest" or "cast"
}

message AddCommentRequest {
  string post_id = 1;
  string content = 2;
  string parent_id = 3; // optional, for replies
  repeated CommentMedia media = 4; // max 3
}

message AddCommentResponse {
  Comment comment = 1;
  int32 comments_count = 2; // updated post comments count
}

message DeleteCommentRequest {
  string comment_id = 1;
}

message DeleteCommentResponse {
  int32 comments_count = 1;
}

message ListCommentsRequest {
  string post_id = 1;
  int32 limit = 2;   // default: 20, max: 50
  string cursor = 3; // optional, for pagination
}

message ListCommentsResponse {
  repeated Comment comments = 1; // top-level comments only
  string next_cursor = 2;
  bool has_more = 3;
}

message ListRepliesRequest {
  string comment_id = 1; // parent comment id
  int32 limit = 2;   // default: 20, max: 50
  string cursor = 3; // optional, for pagination
}

message ListRepliesResponse {
  repeated Comment replies = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

## Backend Implementation

### Files to Create

```
slices/social/
├── repositories/
│   └── comment_repository.rb      # Data access
├── relations/
│   ├── post_comments.rb           # ROM relation
│   └── comment_media.rb           # ROM relation
├── use_cases/
│   └── comments/
│       ├── add.rb                 # Add comment (with media)
│       ├── delete.rb              # Delete comment
│       ├── list.rb                # List top-level comments
│       └── list_replies.rb        # List replies
└── presenters/
    └── comment_presenter.rb       # Proto conversion
```

### Use Case Patterns

いいね・フォロー機能と同様のパターンを踏襲：

```ruby
# use_cases/comments/add.rb
module Social
  module UseCases
    module Comments
      class Add
        include Social::Deps[
          comment_repo: "repositories.comment_repository",
          post_repo: "repositories.post_repository"
        ]

        def call(user_id:, post_id:, content:, parent_id: nil, media: [])
          # 1. Validate post exists
          # 2. Validate parent (if reply) - must be top-level
          # 3. Validate media count (max 3)
          # 4. Create comment with media
          # 5. Update counts (post.comments_count, parent.replies_count)
          # 6. Return comment with updated count
        end
      end
    end
  end
end
```

### Author Resolution

コメント投稿者の情報は `user_id` から取得：

```ruby
# comment_presenter.rb
def build_author(user)
  {
    id: user.id,
    name: user.guest? ? user.guest.nickname : user.cast.name,
    image_url: user.guest? ? user.guest.image_url : user.cast.profile_image_url,
    user_type: user.user_type # "guest" or "cast"
  }
end
```

## Frontend Implementation

### API Routes

ゲスト用とキャスト用で共通の API を使用（認証トークンでユーザータイプを判別）：

```
app/api/comments/
├── route.ts              # POST (add), GET (list) - 共通
├── [id]/
│   └── route.ts          # DELETE - 共通
└── [id]/replies/
    └── route.ts          # GET (list replies) - 共通
```

### Components

```
modules/social/components/
└── comments/
    ├── CommentList.tsx      # Comment list with pagination
    ├── CommentForm.tsx      # Comment input form with media upload
    ├── CommentItem.tsx      # Single comment display (with user type badge)
    ├── CommentMedia.tsx     # Media display (carousel if multiple)
    └── ReplyList.tsx        # Reply list under a comment
```

### UI/UX

投稿詳細ページ (`/timeline/[id]`) にコメントセクションを追加：

1. **コメント一覧** - 投稿下部にトップレベルコメント一覧を表示
2. **ユーザータイプ表示** - キャストのコメントには「Cast」バッジを表示
3. **返信表示** - 各コメント下に「返信を見る (N件)」ボタン → 展開で返信一覧
4. **コメント投稿フォーム** - 固定フッターまたは一覧下部に配置
5. **メディア添付** - 画像/動画アイコンタップでメディア選択（最大3枚）
6. **返信フォーム** - コメントの「返信」ボタンタップで返信フォーム表示
7. **削除機能** - 自分のコメント/返信のみ削除可能

### State Management

```typescript
// modules/social/hooks/useComments.ts
export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchComments = useCallback(async () => { ... }, [postId]);
  const addComment = useCallback(async (content: string, media?: File[], parentId?: string) => { ... }, [postId]);
  const deleteComment = useCallback(async (commentId: string) => { ... }, []);
  const fetchReplies = useCallback(async (commentId: string) => { ... }, []);

  return { comments, loading, hasMore, fetchComments, addComment, deleteComment, fetchReplies };
}
```

## Media Upload Flow

既存の Presigned URL パターンを使用：

```
1. Frontend: Call /api/upload-url with filename
2. Backend: Generate S3 presigned URL
3. Frontend: Upload file directly to S3
4. Frontend: Send comment with media URLs to API
```

### Media Constraints

- 最大3枚のメディア
- 対応フォーマット: JPEG, PNG, GIF, WebP (画像), MP4, WebM (動画)
- ファイルサイズ: 画像 10MB, 動画 100MB（既存制限に準拠）

## Security Considerations

1. **認証必須** - コメント追加・削除は認証済みユーザー（ゲストまたはキャスト）のみ
2. **権限チェック** - 削除は投稿者本人のみ可能
3. **入力検証** - コンテンツの長さ制限（1〜1000文字）
4. **メディア検証** - ファイルタイプ、サイズ、枚数の制限
5. **返信階層制限** - 1階層のみ許可（アプリケーションレベル）
6. **レート制限** - 将来的に連投制限を検討（今回はスコープ外）

## Performance Considerations

1. **Pagination** - cursor-based pagination で大量コメントに対応
2. **Count の同期** - `cast_posts.comments_count` と `post_comments.replies_count` はコメント追加・削除時に更新
3. **Index 設計** - `post_id` + `created_at DESC` でソート取得を最適化
4. **返信の遅延読み込み** - 返信は展開時に取得（初期ロードを軽く）

## Migration Strategy

1. `post_comments` テーブル作成（新規）
2. `comment_media` テーブル作成（新規）
3. `cast_posts` テーブルに `comments_count` カラムは既存（現在は 0 固定）
4. シードデータにサンプルコメント・返信・メディアを追加（ゲスト・キャスト両方）
