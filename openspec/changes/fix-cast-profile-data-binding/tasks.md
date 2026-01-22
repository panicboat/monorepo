# Tasks

## 1. API Route の修正

- [ ] 1.1 `/api/cast/profile/route.ts` の GET レスポンスマッピングを修正
  - proto の全フィールド（`area`, `serviceCategory`, `locationType`, `defaultShiftStart`, `defaultShiftEnd`, `socialLinks`）を正しくマッピング
  - ハードコードされたデフォルト値を削除
- [ ] 1.2 フロントエンドの型定義（`CastProfile`）を確認し、必要に応じて修正

## 2. フロントエンドの認証ヘッダー対応

- [ ] 2.1 `/cast/profile/page.tsx` の `fetchData` で認証ヘッダーを送信するよう修正
- [ ] 2.2 トークン取得とエラーハンドリングを追加

## 3. テスト

- [ ] 3.1 オンボーディング完了後に `/cast/profile` で登録データが表示されることを確認
- [ ] 3.2 プロフィール編集・保存が正しく動作することを確認
