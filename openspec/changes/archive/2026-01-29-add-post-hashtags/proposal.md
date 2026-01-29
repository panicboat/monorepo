# Change: Add Post Hashtags

## Why

タイムライン投稿にハッシュタグ機能を追加する。コメント機能とは独立して管理し、投稿の分類・検索を可能にする。ハッシュタグは投稿テキスト内ではなく、別の入力欄で自由入力する形式とする。

## What Changes

- Social ドメインに `cast_post_hashtags` テーブルを追加（投稿とタグの多対多関係）
- 投稿作成/編集時にハッシュタグ入力欄を追加
- 投稿表示時にハッシュタグを表示
- 将来的にハッシュタグによる検索・フィルタリング機能を追加予定

## Impact

- Affected specs: timeline
- Affected code:
  - `services/monolith/workspace/slices/social/` - DB, relations, repositories, use cases
  - `proto/social/v1/service.proto` - hashtags field
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/` - hashtag input UI
  - `web/nyx/workspace/src/modules/social/` - types, hooks, mappers
