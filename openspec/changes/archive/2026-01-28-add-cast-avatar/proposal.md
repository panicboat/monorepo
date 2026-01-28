# Change: Add Dedicated Cast Avatar Image

## Why

現在、キャストのプロフィール画像はポートフォリオの1枚目の画像（`image_path`）を流用しているが、動画が1枚目の場合にアバターが表示されない。また、画像のアスペクト比が正方形でない場合、丸枠内で潰れて表示される。キャスト専用のアバター画像フィールドを追加し、画像のみ・正方形クロップを強制することで、常に適切なプロフィール画像を表示する。

## What Changes

- `portfolio.casts` テーブルに `avatar_path` カラムを追加
- Proto 定義 `CastProfile` に `avatar_path` フィールドを追加
- フロントエンドにアバター画像選択・クロップ UI を追加（正方形クロップ）
- アバター画像は画像ファイルのみ受付（動画は不可）
- `SaveCastImages` API を拡張して `avatar_path` を保存
- アバター未設定時はポートフォリオの最初の画像画像をフォールバック
- Timeline や検索結果でのアバター表示ロジックを更新

## Impact

- Affected specs: portfolio, profile, timeline
- Affected code:
  - `proto/portfolio/v1/service.proto` - CastProfile, SaveCastImagesRequest
  - `slices/portfolio/` - relations, repository, use_cases, presenter
  - `web/nyx/workspace/src/modules/portfolio/` - types, hooks, components
  - `web/nyx/workspace/src/modules/social/` - author image display
  - DB migration: `portfolio.casts` テーブル
