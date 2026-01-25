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

## Git Workflow

### Proposal 作成時

`/openspec:proposal` 実行時は以下の手順を**自動実行**:

1. `main` ブランチに切り替え (`git checkout main`)
2. 最新を取得 (`git pull origin main`)
3. 派生ブランチを作成 (`git checkout -b <change-id>`)
4. proposal ファイルを作成
5. コミット・プッシュはユーザー承認後

### Archive 時

`/openspec:archive` 実行時は以下の手順を**自動実行**:

1. 変更をコミット (未コミットがあれば)
2. リモートにプッシュ
3. `openspec archive <change-id> --yes` を実行
4. `main` ブランチに切り替え (`git checkout main`)
5. 最新を取得 (`git pull origin main`)

## Lifecycle

詳細は `openspec/AGENTS.md` を参照。
