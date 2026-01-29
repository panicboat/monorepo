# Change: Connect Guest Search to Real API

## Why
ゲスト検索画面（`/guest/search`）は現在ハードコードされたモックデータを使用している。既存の `ListCasts` gRPC API を活用してリアルデータに接続することで、実際のキャスト一覧を表示できるようにする。

## What Changes
- Guest Search ページを ListCasts API に接続
- フィルタリング機能（Online/New/Ranking）の実装
- ハイライトセクション（今スグ遊べる）のリアルデータ表示
- 人気タグの動的取得

## Impact
- Affected specs: `discovery`
- Affected code:
  - `web/nyx/workspace/src/app/(guest)/guest/search/page.tsx`
  - `web/nyx/workspace/src/app/api/guest/search/route.ts` (新規)
  - `services/monolith/workspace/slices/portfolio/grpc/handler.rb` (ListCasts の拡張)
