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

## Lifecycle

詳細は `workflow-rules.md` の **OpenSpec Process** を参照。
