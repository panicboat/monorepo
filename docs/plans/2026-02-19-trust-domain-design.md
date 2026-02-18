# Trust Domain Design

Trust ドメイン — キャストとゲスト間の双方向タグ・レビュー機能。

## Design Principles

- **双方向**: キャスト⇔ゲスト、全ての機能が双方向
- **キャスト→ゲスト**: 即時反映、他キャスト参照可、ゲスト非公開
- **ゲスト→キャスト**: 承認制、承認後は全公開。数値スコアは無条件公開
- **承認率の可視化**: キャストのレビュー承認率をプロフィールに表示

## Phased Rollout

### Phase 1: Tags

双方向タグ機能。

| 方向 | 公開範囲 | 承認 |
|------|---------|------|
| キャスト → ゲスト | 他キャスト参照可、ゲスト非公開 | 不要 |
| ゲスト → キャスト | 承認後に全公開 | 必要 |

- カスタムタグのみ（システムタグなし）
- 色選択なし（名前のみ）
- 上限: 50個/ユーザー

### Phase 2: Reviews (Future)

双方向レビュー機能（テキスト + メディア添付 + ★5段階スコア）。

| 方向 | 公開範囲 | 承認 | スコア |
|------|---------|------|--------|
| キャスト → ゲスト | 他キャスト参照可、ゲスト非公開 | 不要 | ★5段階 |
| ゲスト → キャスト | 承認後に全公開 | テキストは必要 | ★5段階、無条件公開 |

制限値:
- レビュー文字数: 1000文字
- メディア上限: 5件/レビュー
- メディアサイズ: Media ドメインの既存制限に準拠

不正レビュー対策:
- **承認率の可視化** — 低い承認率がシグナルになる
- **スコア無条件公開** — 数値評価は操作できない

## Database Schema

### Phase 1 Tables

```sql
-- trust__tags: ユーザーが作成したタグ定義
CREATE TABLE trust__tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES identity__identities(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (identity_id, name)
);

-- trust__taggings: タグの付与記録
CREATE TABLE trust__taggings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES trust__tags(id),
    tagger_id UUID NOT NULL REFERENCES identity__identities(id),
    target_id UUID NOT NULL REFERENCES identity__identities(id),
    status VARCHAR NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tag_id, target_id, tagger_id)
);
-- status: 'pending' | 'approved' | 'rejected'
-- cast→guest: always 'approved'
-- guest→cast: starts as 'pending'
```

### Phase 2 Tables (Design Only)

```sql
-- trust__reviews: レビュー記録
CREATE TABLE trust__reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES identity__identities(id),
    reviewee_id UUID NOT NULL REFERENCES identity__identities(id),
    content TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    status VARCHAR NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: cast→guest always 'approved', guest→cast starts 'pending'

-- trust__review_media: レビューメディア（Media ドメイン連携）
CREATE TABLE trust__review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES trust__reviews(id),
    media_type VARCHAR NOT NULL,
    path VARCHAR NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API Design (Phase 1)

Proto: `proto/trust/v1/service.proto`

| RPC | 説明 |
|-----|------|
| `ListTags` | 自分のタグ一覧取得 |
| `CreateTag` | タグ作成 |
| `DeleteTag` | タグ削除 |
| `ListTargetTags` | 対象者に付けられたタグ一覧取得 |
| `AddTagging` | 対象者にタグ付与 |
| `RemoveTagging` | 対象者からタグ解除 |
| `ApproveTagging` | タグ付与を承認（キャストのみ） |
| `RejectTagging` | タグ付与を却下（キャストのみ） |

## Architecture

### Backend Structure

```
slices/trust/
├── db/
│   ├── relation.rb
│   └── repo.rb
├── relations/
│   ├── tags.rb
│   └── taggings.rb
├── repositories/
│   ├── tag_repository.rb
│   └── tagging_repository.rb
├── use_cases/
│   ├── tags/
│   │   ├── list_tags.rb
│   │   ├── create_tag.rb
│   │   └── delete_tag.rb
│   └── taggings/
│       ├── list_target_tags.rb
│       ├── add_tagging.rb
│       ├── remove_tagging.rb
│       ├── approve_tagging.rb
│       └── reject_tagging.rb
└── grpc/
    ├── handler.rb
    └── trust_handler.rb
```

### Frontend Structure

```
web/nyx/workspace/src/
├── modules/trust/
│   ├── types.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useTags.ts
│   │   └── useTaggings.ts
│   └── index.ts
└── app/api/
    ├── cast/trust/
    │   ├── tags/
    │   │   ├── route.ts
    │   │   └── [id]/route.ts
    │   └── taggings/
    │       ├── route.ts
    │       ├── [id]/route.ts
    │       └── [id]/approve/route.ts
    └── guest/trust/
        └── tags/
            ├── route.ts
            └── [id]/route.ts
```

### Data Flow

キャスト→ゲスト（即時）:
```
Cast UI → POST /api/cast/trust/taggings → gRPC AddTagging → status='approved'
```

ゲスト→キャスト（承認制）:
```
Guest UI → POST /api/guest/trust/taggings → gRPC AddTagging → status='pending'
Cast UI → POST /api/cast/trust/taggings/{id}/approve → gRPC ApproveTagging → status='approved'
```

### UI Access Point

ゲストプロフィールページから「ノート」タブ/ボタンでアクセス。

## Error Handling

| ケース | gRPC Status | HTTP |
|--------|------------|------|
| 未認証 | `UNAUTHENTICATED` | 401 |
| タグ上限超過（50個） | `RESOURCE_EXHAUSTED` | 429 |
| タグ名重複（同一ユーザー内） | `ALREADY_EXISTS` | 409 |
| 存在しないタグ/対象 | `NOT_FOUND` | 404 |
| 権限なし（ゲストが他人のタグ参照等） | `PERMISSION_DENIED` | 403 |
| 承認権限なし | `PERMISSION_DENIED` | 403 |

## Testing Strategy

**バックエンド（RSpec）:**
- Repository: CRUD操作、上限チェック、権限フィルタリング
- UseCase: ビジネスロジック（承認フロー、権限チェック）
- gRPC Handler: リクエスト/レスポンス変換、認証

**フロントエンド:**
- Hooks: API呼び出しとステート管理
- API Routes: gRPC クライアント呼び出しとエラーハンドリング
