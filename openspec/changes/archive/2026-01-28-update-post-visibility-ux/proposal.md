# Change: Update Post Visibility Toggle UX

## Why

Timeline のポスト表示/非表示切り替えボタンが直感的でない。現在は投稿右上に Eye/EyeOff アイコンがあるだけで、機能の意味がわかりにくい。非表示状態の投稿は `opacity-40` になるだけで、状態の違いが不明確。キャストが自分の投稿の公開状態を容易に把握・管理できるよう UX を改善する。

## What Changes

- 非表示投稿にバッジ（「非公開」ラベル）を追加
- 表示/非表示トグルボタンにツールチップまたはラベルを追加
- 非表示投稿の視覚的区別を強化（半透明 + ストライプまたはバナー）
- トグル操作後に Toast で状態変更を通知

## Impact

- Affected specs: timeline
- Affected code:
  - `web/nyx/workspace/src/modules/discovery/components/guest/TimelineFeed.tsx` - `TimelineItem` コンポーネント
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/page.tsx` - `handleToggleVisibility`
