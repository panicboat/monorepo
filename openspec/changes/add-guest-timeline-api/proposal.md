# Change: Add Guest Timeline API

## Why

現在、ゲスト側のタイムライン表示はモックデータを使用している。キャストが投稿した内容をゲストが閲覧できるよう、API 接続を実装する必要がある。これにより Social ドメインのゲスト向け機能が完成し、プロダクションレディに近づく。

## What Changes

- ゲスト向けタイムライン API（`GET /api/guest/timeline`）を追加
- `TimelineFeed.tsx` を API 接続に更新
- 投稿詳細ページ（`/timeline/[id]`）を API 接続
- キャスト詳細ページ内でそのキャストの投稿のみ表示する機能を追加

## Impact

- Affected specs: `timeline`
- Affected code:
  - `web/nyx/workspace/src/app/api/guest/timeline/route.ts` (new)
  - `web/nyx/workspace/src/app/api/guest/timeline/[id]/route.ts` (new)
  - `web/nyx/workspace/src/modules/social/components/guest/TimelineFeed.tsx`
  - `web/nyx/workspace/src/modules/social/hooks/useSocial.ts`
  - `web/nyx/workspace/src/app/(guest)/timeline/[id]/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/casts/[id]/page.tsx`
