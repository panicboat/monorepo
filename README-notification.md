# GitHub Actions 通知システム

このディレクトリには、IssueやPull Requestに統一された通知を送信するための再利用可能なGitHub Actionsワークフローが含まれています。

## 機能

- ✅ **統一された通知形式**: すべての通知が一貫したフォーマットで表示されます
- 🔄 **コメントの上書き**: 同じbotからの既存のコメントを自動的に更新します
- 🎨 **複数の通知タイプ**: success、failure、warning、infoの4つのタイプをサポート
- 📝 **カスタマイズ可能**: タイトル、メッセージ、表示オプションを柔軟に設定できます
- 🔗 **ワークフロー詳細**: 実行したワークフローの詳細情報を自動的に含めます

## 使用方法

### 基本的な使用例

```yaml
jobs:
  notify_success:
    uses: ./.github/workflows/reusable-notification.yaml
    with:
      notification_type: "success"
      title: "デプロイ完了"
      message: "本番環境へのデプロイが正常に完了しました。"
      comment_id_prefix: "deployment-status"
```

### パラメータ

| パラメータ | 必須 | タイプ | デフォルト | 説明 |
|-----------|------|--------|-----------|------|
| `notification_type` | ✅ | string | - | 通知のタイプ（success、failure、warning、info） |
| `title` | ✅ | string | - | 通知のタイトル |
| `message` | ✅ | string | - | 通知のメッセージ内容 |
| `comment_id_prefix` | ✅ | string | - | コメント識別用のプレフィックス |
| `show_workflow_details` | ❌ | boolean | true | ワークフロー実行詳細の表示有無 |

### 通知タイプ

| タイプ | 絵文字 | 色 | 用途 |
|--------|--------|----|------|
| `success` | ✅ | 緑 | 成功時の通知 |
| `failure` | ❌ | 赤 | 失敗時の通知 |
| `warning` | ⚠️ | 黄 | 警告時の通知 |
| `info` | ℹ️ | 青 | 情報提供時の通知 |

## 実装例

### 1. CI/CDパイプラインでの使用

```yaml
name: CI/CD Pipeline

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    # ... テストジョブの設定

  notify_test_success:
    needs: test
    if: success()
    uses: ./.github/workflows/reusable-notification.yaml
    with:
      notification_type: "success"
      title: "テスト完了"
      message: |
        🎉 すべてのテストがパスしました！

        **実行結果:**
        - 単体テスト: ✅ パス
        - 統合テスト: ✅ パス
        - E2Eテスト: ✅ パス
      comment_id_prefix: "test-results"

  notify_test_failure:
    needs: test
    if: failure()
    uses: ./.github/workflows/reusable-notification.yaml
    with:
      notification_type: "failure"
      title: "テスト失敗"
      message: |
        💥 テストに失敗しました。

        失敗したテストの詳細を確認し、修正をお願いします。
      comment_id_prefix: "test-results"
```

### 2. PR オープン時の自動ガイダンス

```yaml
name: PR Guidelines

on:
  pull_request:
    types: [opened]

jobs:
  pr_guidelines:
    uses: ./.github/workflows/reusable-notification.yaml
    with:
      notification_type: "info"
      title: "Pull Request ガイドライン"
      message: |
        📋 **レビューのお願い**

        このPRをレビューする際は、以下をご確認ください：
        - [ ] コードスタイルの準拠
        - [ ] テストの追加
        - [ ] ドキュメントの更新
        - [ ] 破壊的変更の文書化
      comment_id_prefix: "pr-guidelines"
      show_workflow_details: false
```

### 3. 条件付き通知

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    # ... デプロイジョブ

  notify_deployment:
    needs: deploy
    if: always()
    uses: ./.github/workflows/reusable-notification.yaml
    with:
      notification_type: ${{ needs.deploy.result == 'success' && 'success' || 'failure' }}
      title: ${{ needs.deploy.result == 'success' && 'デプロイ成功' || 'デプロイ失敗' }}
      message: |
        ${{ needs.deploy.result == 'success' &&
        '🚀 本番環境へのデプロイが完了しました。' ||
        '💥 デプロイに失敗しました。ログを確認してください。' }}
      comment_id_prefix: "deployment"
```

## 既存のワークフローへの統合

既存のワークフローに通知機能を追加するには：

1. 通知したいジョブの後に通知ジョブを追加
2. `needs`で依存関係を設定
3. `if`条件で実行タイミングを制御
4. 一意の`comment_id_prefix`を設定

## ベストプラクティス

- **comment_id_prefix**: 各通知用途に対して一意のプレフィックスを使用
- **メッセージ**: Markdownを活用して読みやすい形式にする
- **条件分岐**: `if`条件を使って適切なタイミングで通知を送信
- **情報の整理**: 重要な情報を強調し、詳細は折りたたみ可能にする

## トラブルシューティング

### コメントが更新されない場合

- `comment_id_prefix`が他の通知と重複していないか確認
- GitHub token の権限が適切に設定されているか確認

### 通知が表示されない場合

- IssueまたはPRのコンテキストで実行されているか確認
- ワークフローの権限設定を確認

## 使用しているアクション

- [peter-evans/find-comment](https://github.com/peter-evans/find-comment): 既存のコメントを検索
- [peter-evans/create-or-update-comment](https://github.com/peter-evans/create-or-update-comment): コメントの作成・更新
