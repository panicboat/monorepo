# OpenSpec Rules

## Requirement Format

要件は**日本語 + 英語キーワード**で記述:

```markdown
- ユーザーはプロフィールを編集できなければならない (MUST)
- システムは変更履歴を保持すべきである (SHOULD)
- 管理者は一括削除できてもよい (MAY)
```

| Keyword | 意味 |
|---------|------|
| MUST | 必須要件 |
| SHOULD | 推奨要件 |
| MAY | オプション |

## Commands

| コマンド | 用途 |
|----------|------|
| `/openspec:proposal` | 新規提案の作成 |
| `/openspec:apply` | 承認済み提案の実装 |
| `/openspec:archive` | 完了した提案のアーカイブ |

## Architecture Changes

以下の変更は**実装前にユーザー承認が必要**:

- データベーススキーマの変更
- ライブラリ・フレームワークの追加・置き換え
- 主要なデザインパターンの変更
- API の破壊的変更
