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

## Lifecycle

```
1. /openspec:proposal → [ユーザー承認]
2. /openspec:apply    → [ユーザー承認]
3. /openspec:archive
```

詳細は `openspec/AGENTS.md` を参照。
