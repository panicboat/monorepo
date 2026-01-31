# Change: Connect Guest Search to Real API

## Why
ゲスト検索画面（`/guest/search`）は現在ハードコードされたモックデータを使用している。既存の `ListCasts` gRPC API を活用してリアルデータに接続し、**ジャンル（運営管理）+ タグ（キャスト自由）のハイブリッド型**フィルタリングを実装することで、ゲストが目的に合ったキャストを効率的に検索できるようにする。

## What Changes

### Genre System（ジャンル）
- メインジャンル（風俗 / P活 / レンタル彼女 など）を初期シードデータとして用意
- キャストは登録時に1つ以上のジャンルを選択 (MUST)
- ゲストはジャンルでフィルタリング可能
- 管理者機能は将来実装（現時点ではシードデータのみ）

### Tag System（タグ - キャスト自由）
- キャストが自由に追加できるタグ（検索補助用）
- 表記ゆれは許容（「清楚系」「清楚」など）
- 人気タグは使用頻度でソートして表示

### Search Integration
- Guest Search ページを ListCasts API に接続
- ジャンル + ステータス + タグの複合フィルタリング
- ハイライトセクション（今スグ遊べる）のリアルデータ表示

## Impact
- Affected specs: `discovery`
- Affected code:
  - `web/nyx/workspace/src/app/(guest)/guest/search/page.tsx`
  - `web/nyx/workspace/src/app/api/guest/search/route.ts` (新規)
  - `services/monolith/workspace/slices/portfolio/grpc/handler.rb` (ListCasts の拡張)
  - `proto/portfolio/v1/service.proto` (Genre メッセージ追加)
