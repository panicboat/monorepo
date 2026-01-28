## 1. Frontend

- [ ] 1.1 `handleDelete` から `confirm()` ダイアログを削除
- [ ] 1.2 削除実行後に Undo 付き Toast を表示する仕組みを実装
- [ ] 1.3 Toast コンポーネントに action ボタン（Undo）を追加
- [ ] 1.4 Undo 実行時に投稿を復元するロジックを実装（楽観的 UI 更新 + API 再保存）
- [ ] 1.5 Undo タイムアウト（5秒程度）後にバックエンドに確定削除を送信

## 2. Testing

- [ ] 2.1 削除→Toast 表示→Undo 操作の動作確認
- [ ] 2.2 Undo タイムアウト後の確定削除の動作確認
