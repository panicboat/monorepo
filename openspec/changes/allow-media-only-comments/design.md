# Design: allow-media-only-comments

## Overview

コメントのバリデーションを「テキスト必須」から「テキストまたはメディアのいずれか必須」に変更する。

## Current Implementation

### Backend (AddComment UseCase)

```ruby
# services/monolith/workspace/slices/post/use_cases/comments/add_comment.rb
raise EmptyContentError if content.nil? || content.strip.empty?
```

現在は `content` が空の場合に無条件でエラーを発生させている。

### Frontend (CommentForm)

```typescript
// web/nyx/workspace/src/modules/post/components/comments/CommentForm.tsx
if (!content.trim() && mediaFiles.length === 0) {
  setError("Comment cannot be empty");
  return;
}
```

フロントエンドは既に「テキストまたはメディア必須」のバリデーションを実装済み。

## Proposed Implementation

### Backend Changes

`AddComment` UseCase のバリデーションを以下のように変更:

```ruby
# Before
raise EmptyContentError if content.nil? || content.strip.empty?

# After
empty_content = content.nil? || content.strip.empty?
empty_media = media.nil? || media.empty?
raise EmptyContentError if empty_content && empty_media
```

### Frontend Changes

変更不要。既に期待する動作を実装済み。

## Error Handling

| 条件 | 結果 |
|------|------|
| テキストあり + メディアなし | ✅ 許可 |
| テキストなし + メディアあり | ✅ 許可（新規） |
| テキストあり + メディアあり | ✅ 許可 |
| テキストなし + メディアなし | ❌ エラー |

## Testing Strategy

1. 既存テストの確認と修正
2. 新規テストケース追加:
   - メディアのみのコメント投稿成功
   - メディアのみの返信投稿成功
   - テキストとメディア両方なしの場合はエラー
