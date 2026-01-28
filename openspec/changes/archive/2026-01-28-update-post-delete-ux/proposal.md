# Change: Update Post Delete UX

## Why

Timeline のポスト削除時に `window.confirm()` によるブラウザネイティブダイアログが表示されるが、見た目が古く、アプリ全体のモダンな UI と不整合である。また、キャスト自身が投稿した内容を削除する操作であり、確認ダイアログなしで即時削除しても問題ない。誤削除への対策として、削除後に Undo 付き Toast を表示するアプローチを採用する。

## What Changes

- `confirm()` ダイアログを削除し、即時削除に変更
- 削除後に Undo 付き Toast 通知を表示
- Undo 操作で投稿を復元（一定時間内のみ）
- Toast コンポーネントの Undo 対応拡張

## Impact

- Affected specs: timeline
- Affected code:
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/page.tsx` - `handleDelete` 関数
  - `web/nyx/workspace/src/modules/discovery/components/guest/TimelineFeed.tsx` - `onDelete` コールバック
  - `web/nyx/workspace/src/components/ui/Toast.tsx` - Undo アクション対応
