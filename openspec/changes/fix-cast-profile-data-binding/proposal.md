# Change: Fix Cast Profile Data Binding

## Why

`/cast/profile` ページでオンボーディング時に登録したプロフィールデータが正しく表示されていない。
API Route のマッピングが古い状態のまま放置されており、proto に定義されているフィールドが使われていない。
また、フロントエンドが認証ヘッダーを送信していないため、API 呼び出しが失敗する可能性がある。

## What Changes

- `/api/cast/profile` (GET) のレスポンスマッピングを修正し、proto の全フィールドを正しく返す
- `/cast/profile/page.tsx` の初期データ取得時に認証ヘッダーを送信する
- フロントエンドの型定義（`CastProfile`）と proto の整合性を確保する

## Impact

- Affected specs: `profile`
- Affected code:
  - `web/nyx/workspace/src/app/api/cast/profile/route.ts`
  - `web/nyx/workspace/src/app/(cast)/cast/profile/page.tsx`
  - `web/nyx/workspace/src/modules/portfolio/types.ts`
