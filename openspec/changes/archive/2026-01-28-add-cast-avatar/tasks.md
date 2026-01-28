## 1. Backend

- [ ] 1.1 DB migration: `portfolio.casts` テーブルに `avatar_path text` カラムを追加
- [ ] 1.2 Proto: `CastProfile` message に `string avatar_path = 21` を追加
- [ ] 1.3 Proto: `SaveCastImagesRequest` に `string avatar_path = 3` を追加
- [ ] 1.4 Relation: `casts` relation に `avatar_path` 属性を追加
- [ ] 1.5 Repository: `save_images` メソッドで `avatar_path` を保存
- [ ] 1.6 Presenter: `ProfilePresenter.to_proto` で `avatar_path` を返却、フォールバックロジック実装
- [ ] 1.7 Social Presenter: `PostPresenter.author_to_proto` で `avatar_path` 優先使用
- [ ] 1.8 Proto コード生成: `buf generate`

## 2. Frontend

- [ ] 2.1 型定義: `CastProfile` 型に `avatarPath` を追加
- [ ] 2.2 アバター選択 UI: 正方形クロップ付きのアバターアップロードコンポーネントを作成
- [ ] 2.3 オンボーディング Step 2: アバター選択セクションを追加
- [ ] 2.4 プロフィール編集: アバター変更 UI を追加
- [ ] 2.5 `useCastData` hook: アバター保存ロジックを追加
- [ ] 2.6 BFF API: `SaveCastImages` で `avatar_path` を送信
- [ ] 2.7 表示更新: Timeline アバター表示で `avatarPath` を優先使用
- [ ] 2.8 フォールバック: アバター未設定時にポートフォリオ1枚目の画像を表示

## 3. Testing

- [ ] 3.1 Backend: アバター保存・取得のテスト
- [ ] 3.2 Backend: フォールバックロジックのテスト
- [ ] 3.3 Frontend: アバタークロップ UI の動作確認
