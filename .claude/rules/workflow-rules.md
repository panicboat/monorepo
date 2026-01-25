# Workflow Rules

## User Approval

### Pre-Implementation (実装前)

以下の変更は**実装前にユーザー承認が必要**:

- データベーススキーマの変更
- ライブラリ・フレームワークの追加・置き換え
- 主要なデザインパターンの変更
- API の破壊的変更

### Post-Implementation (実装後)

以下のアクションは**実行前にユーザー承認が必要**:

- Git commit / push
- OpenSpec のアーカイブ
- ブランチの作成・削除・マージ

実装完了時は変更内容のサマリーを提示し、ユーザーの明示的な承認を待つこと。

## OpenSpec Process

アーキテクチャ変更は OpenSpec で提案:

1. `/openspec:proposal` でドラフト作成 → **ユーザー承認**
2. `/openspec:apply` で実装
3. 実装完了を報告 → **ユーザー承認**
4. `/openspec:archive` でアーカイブ
