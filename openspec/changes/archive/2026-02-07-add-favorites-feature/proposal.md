# Change: Add Favorites Feature

## Why

現在、ゲストがキャストを「お気に入り」に登録する機能は localStorage のみで管理されており、デバイス間で同期されない。お気に入り機能をバックエンドに永続化することで、以下のメリットが得られる：

1. **デバイス間同期** - スマートフォンでお気に入り登録したキャストが、PCでも表示される
2. **データの永続性** - ブラウザのキャッシュクリアや端末変更でもデータが失われない
3. **タイムラインフィルタリング** - Favorites タブでお気に入りキャストの投稿のみを表示可能に

## What Changes

- `cast_favorites` テーブルを追加（お気に入り関係の永続化）
- Proto 定義に Favorites 関連の RPC を追加（`AddFavorite`, `RemoveFavorite`, `ListFavorites`, `GetFavoriteStatus`）
- Backend に UseCase/Repository を追加
- Frontend の API Routes を追加
- `useSocial` hook と `socialStore` を API 同期に対応
- タイムラインの Favorites タブをサーバーサイドフィルタリングに変更

## Follow vs Favorites

| Feature | Follow | Favorites |
|---------|--------|-----------|
| 目的 | キャストの投稿をタイムラインで追う | 特に気に入ったキャストを一覧管理 |
| 用途 | 日常的な情報収集 | 検索・比較・再訪問のため |
| タイムライン | Following タブで投稿表示 | Favorites タブで投稿表示 |
| UI | フォローボタン | お気に入り（星）ボタン |

両方を併用可能で、独立した概念として扱う。

## Impact

- Affected specs: `timeline`
- Affected code:
  - Backend: `slices/social/` (新規 relation, repository, use_cases)
  - Proto: `proto/social/v1/service.proto`
  - Frontend: API Routes, Social hooks, socialStore, TimelineFeed
