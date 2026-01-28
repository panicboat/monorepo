# Change: Add Multi-Media Post Support

## Why

Timeline のポスト投稿が1枚のメディア（画像/動画）しか添付できない。バックエンドの `cast_post_media` テーブルと Proto 定義（`repeated CastPostMedia`）は既に複数メディアに対応しているが、フロントエンド UI が単一ファイルのみの実装になっている。キャストは複数の画像・動画を1つの投稿に添付して、より魅力的なタイムラインを作成したい。

## What Changes

- 投稿フォームで複数ファイルの選択・アップロードに対応
- メディアプレビューをグリッド/カルーセル表示に変更
- タイムラインの投稿表示で複数メディアをカルーセル表示
- 個別ファイルの削除・並び替え機能
- 投稿あたりのメディア上限を設定（例：最大10枚）

## Impact

- Affected specs: timeline
- Affected code:
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/page.tsx` - 投稿フォーム（`mediaFile` → `mediaFiles[]`）
  - `web/nyx/workspace/src/modules/discovery/components/guest/TimelineFeed.tsx` - メディア表示
  - `web/nyx/workspace/src/modules/social/types.ts` - FeedItem 型
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/[id]/page.tsx` - 詳細ページ
  - `web/nyx/workspace/src/app/(guest)/timeline/[id]/page.tsx` - ゲスト側詳細ページ
