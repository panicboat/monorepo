# Design: unify-media-service

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Post Upload │  │Cast Profile │  │Guest Avatar │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                   /api/media/*                              │
│                  (統一エンドポイント)                        │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                     Backend (gRPC)                          │
│                          │                                  │
│              ┌───────────▼───────────┐                      │
│              │    MediaService       │                      │
│              │  ┌─────────────────┐  │                      │
│              │  │ GetUploadUrl    │  │                      │
│              │  │ RegisterMedia   │  │                      │
│              │  │ GetMedia        │  │                      │
│              │  │ GetMediaBatch   │  │                      │
│              │  │ DeleteMedia     │  │                      │
│              │  └─────────────────┘  │                      │
│              └───────────┬───────────┘                      │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐           │
│    │  Post   │     │ Portfolio │    │   Feed    │           │
│    │ Service │     │  Service  │    │  Service  │           │
│    │         │     │           │    │           │           │
│    │media_id │     │ media_id  │    │(read-only)│           │
│    └────┬────┘     └─────┬─────┘    └─────┬─────┘           │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│              ┌───────────▼───────────┐                      │
│              │    media__files       │                      │
│              │  (統一テーブル)        │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### Phase 1: Post Domain

```sql
-- Add media_id to post_media
ALTER TABLE post__post_media
ADD COLUMN media_id UUID REFERENCES media__files(id);

-- Add media_id to comment_media
ALTER TABLE post__comment_media
ADD COLUMN media_id UUID REFERENCES media__files(id);

-- Index for efficient lookup
CREATE INDEX idx_post_media_media_id ON post__post_media(media_id);
CREATE INDEX idx_comment_media_media_id ON post__comment_media(media_id);
```

### Phase 2: Portfolio Cast Domain

```sql
-- Add media references to casts
ALTER TABLE portfolio__casts
ADD COLUMN profile_media_id UUID REFERENCES media__files(id),
ADD COLUMN avatar_media_id UUID REFERENCES media__files(id);

-- Gallery media join table
CREATE TABLE portfolio__cast_gallery_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cast_id UUID NOT NULL REFERENCES portfolio__casts(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media__files(id),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(cast_id, media_id)
);

CREATE INDEX idx_cast_gallery_cast_id ON portfolio__cast_gallery_media(cast_id);
CREATE INDEX idx_cast_gallery_position ON portfolio__cast_gallery_media(cast_id, position);
```

### Phase 3: Portfolio Guest Domain

```sql
-- Add media reference to guests
ALTER TABLE portfolio__guests
ADD COLUMN avatar_media_id UUID REFERENCES media__files(id);
```

## Implementation Details

### Presenter (Clean Implementation)

新形式のみをサポート。Media サービス経由で URL を取得：

```ruby
# New implementation (clean)
def self.to_proto(cast, media_repo:)
  profile_media = media_repo.find_by_id(cast.profile_media_id)
  avatar_media = media_repo.find_by_id(cast.avatar_media_id)

  ::Portfolio::V1::CastProfile.new(
    image_url: profile_media&.url || "",
    avatar_url: avatar_media&.url || ""
  )
end
```

### Proto Changes

旧フィールド/RPC は削除：

```protobuf
// portfolio/v1/cast_service.proto
message SaveCastImagesRequest {
  string profile_media_id = 1;
  repeated string gallery_media_ids = 2;
  string avatar_media_id = 3;
}

// GetUploadUrl RPC は削除 - MediaService.GetUploadUrl を使用
```

### Frontend Migration

Portfolio の画像アップロード API を Media API に統一：

```typescript
// Before: /api/cast/onboarding/upload-url
// After: /api/media/upload-url (共通)

// Before
const { url, key } = await fetch('/api/cast/onboarding/upload-url', {
  method: 'POST',
  body: JSON.stringify({ filename, contentType })
});

// After
const { uploadUrl, mediaKey, mediaId } = await fetch('/api/media/upload-url', {
  method: 'POST',
  body: JSON.stringify({ filename, contentType, mediaType: 'image' })
});
```

## Data Migration Strategy

### Migration Script

```ruby
# migrate_media_to_unified_table.rb
class MigrateMediaToUnifiedTable
  def up
    # 1. Post media migration
    migrate_post_media

    # 2. Comment media migration
    migrate_comment_media

    # 3. Cast profile images
    migrate_cast_images

    # 4. Guest avatars
    migrate_guest_avatars
  end

  private

  def migrate_post_media
    PostMedia.where(media_id: nil).find_each do |pm|
      media = MediaFiles.create!(
        media_type: pm.media_type,
        media_key: pm.url,
        url: Storage.download_url(key: pm.url),
        thumbnail_key: pm.thumbnail_url,
        thumbnail_url: pm.thumbnail_url ? Storage.download_url(key: pm.thumbnail_url) : nil
      )
      pm.update!(media_id: media.id)
    end
  end

  def migrate_cast_images
    Cast.find_each do |cast|
      # Profile image
      if cast.image_path.present? && cast.profile_media_id.nil?
        media = create_media_from_key(cast.image_path, 'image')
        cast.update!(profile_media_id: media.id)
      end

      # Avatar
      if cast.avatar_path.present? && cast.avatar_media_id.nil?
        media = create_media_from_key(cast.avatar_path, 'image')
        cast.update!(avatar_media_id: media.id)
      end

      # Gallery images
      (cast.images || []).each_with_index do |img_key, position|
        next if CastGalleryMedia.exists?(cast_id: cast.id, position: position)
        media = create_media_from_key(img_key, 'image')
        CastGalleryMedia.create!(cast_id: cast.id, media_id: media.id, position: position)
      end
    end
  end
end
```

## Testing Strategy

### Unit Tests

1. MediaRepository: CRUD operations
2. PostPresenter: media_id あり/なし両方のケース
3. ProfilePresenter: 同上

### Integration Tests

1. Post 作成 → media_id 保存 → Feed 取得で URL 正常
2. Cast 画像保存 → media_id 保存 → プロフィール取得で URL 正常

### Migration Tests

1. マイグレーション前後でデータ整合性を検証
2. URL 生成結果が同一であることを確認

## Performance Considerations

### JOIN Impact

Media 参照追加により JOIN が増える。対策：

1. `media_id` に適切なインデックスを追加
2. N+1 回避のため、バッチ取得 (`GetMediaBatch`) を活用
3. 必要に応じてキャッシュ層を検討（将来）

### Expected Query Pattern

```sql
-- Post with media (single query with JOIN)
SELECT p.*, m.url, m.thumbnail_url, m.media_type
FROM post__posts p
LEFT JOIN post__post_media pm ON pm.post_id = p.id
LEFT JOIN media__files m ON m.id = pm.media_id
WHERE p.cast_id = $1
ORDER BY p.created_at DESC
LIMIT 20;
```
