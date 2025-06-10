# 統一デプロイメント戦略：完全ガイド

## 📖 背景とコンテキスト

### 現在のシステム構成
- **Monorepo**: 複数のサービス（claude-code-action、github-oidc-auth等）を単一リポジトリで管理
- **Infrastructure as Code**: Terragrunt + Terraform でAWSインフラを管理
- **CI/CD**: GitHub Actions による自動デプロイメント
- **Multi-Environment**: develop、staging、production の3環境

### 解決したい課題
1. **非効率なデプロイ**: 全サービスを毎回デプロイしていた
2. **安全性の懸念**: 意図しないサービスのデプロイが発生
3. **運用複雑性**: 環境毎に異なるデプロイ方式
4. **リソース浪費**: 不要なTerragrunt実行によるコスト増

## 🎯 新しいデプロイメント戦略の全体像

### 基本原則
1. **PRベース**: すべてのデプロイはPull Requestを経由
2. **ラベル駆動**: PRラベルから自動的にデプロイ対象を決定
3. **環境固有**: 各環境では該当環境のサービスのみデプロイ
4. **安全性優先**: 不明な状況では確実にデプロイを停止

### 統一ワークフロー概念図
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  feature/*  │───▶│   develop   │───▶│staging/svc  │───▶│production/  │
│   ブランチ   │    │   ブランチ   │    │   ブランチ   │    │ svc ブランチ │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
    PR作成               PR作成             PR作成             PR作成
       │                   │                   │                   │
   ラベル自動付与        ラベル自動付与      ラベル自動付与      ラベル自動付与
       │                   │                   │                   │
   ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
   │develop  │         │develop  │         │staging  │         │production│
   │デプロイ  │         │デプロイ  │         │デプロイ  │         │デプロイ   │
   └─────────┘         └─────────┘         └─────────┘         └─────────┘
```

## 🏗️ システム構成要素

### 1. 自動ラベル付与システム（auto-label--label-dispatcher.yaml）
- **機能**: ファイル変更を検出してPRに**すべての環境の**デプロイラベルを自動付与
- **ラベル形式**: `deploy:{service}:{environment}`
- **検出ロジック**: サービスディレクトリの変更を監視
- **付与範囲**: develop、staging、production すべての環境ラベルを一括付与

### 2. デプロイトリガーシステム（auto-label--deploy-trigger.yaml）
- **機能**: PRマージ時に**すべての環境ラベル**を読み取り、該当環境のサービスのみデプロイ
- **環境別フィルタリング**: 各ブランチで適切な環境ラベルのみ処理
- **安全性保証**: マージPR情報がない場合はデプロイ中止
- **処理方式**: 網羅的ラベル取得 → 環境固有フィルタリング → 精密デプロイ

### 3. Terragrunt実行システム（reusable--terragrunt-executor.yaml）
- **機能**: 実際のインフラストラクチャ変更を実行
- **並列処理**: 複数サービスの同時デプロイ対応
- **環境別権限**: 各環境に適したIAM Roleを使用

## 🔄 詳細なデプロイフロー

### Phase 1: 開発フェーズ
```
1. feature/new-auth-api ブランチで開発
   └── auth-service/ ディレクトリ内のファイルを変更

2. develop ブランチへPR作成
   ├── auto-label--label-dispatcher.yaml 実行
   ├── ファイル変更検出: auth-service/
   ├── 自動ラベル付与（すべての環境）:
   │   ├── deploy:auth-service:develop
   │   ├── deploy:auth-service:staging
   │   └── deploy:auth-service:production
   └── PRに複数環境ラベルが表示される

3. レビュー・承認・マージ
   ├── PR #123 マージ → develop ブランチ
   └── push イベント発生
```

### Phase 2: Develop デプロイフェーズ
```
4. auto-label--deploy-trigger.yaml 実行
   ├── イベント検出: push to develop
   ├── マージPR情報取得: PR #123
   ├── PRラベル取得（すべての環境）: [
   │     "deploy:auth-service:develop",
   │     "deploy:auth-service:staging",
   │     "deploy:auth-service:production"
   │   ]
   ├── 環境フィルタリング: develop環境のみ
   │   → 抽出結果: ["deploy:auth-service:develop"]
   ├── デプロイマトリックス生成
   └── Terragrunt実行: auth-service の develop 環境のみ
```

### Phase 3: Staging デプロイフェーズ
```
5. staging/auth-service ブランチへPR作成
   ├── develop → staging/auth-service
   ├── auto-label--label-dispatcher.yaml 実行
   ├── ファイル変更検出: auth-service/
   ├── 自動ラベル付与:
   │   ├── deploy:auth-service:develop
   │   ├── deploy:auth-service:staging
   │   └── deploy:auth-service:production
   └── PRに複数環境ラベルが表示される

6. マージ時のデプロイ
   ├── イベント検出: push to staging/auth-service
   ├── PRラベル取得: [
   │     "deploy:auth-service:develop",
   │     "deploy:auth-service:staging",
   │     "deploy:auth-service:production"
   │   ]
   ├── 環境フィルタリング: staging環境のみ
   │   → 抽出結果: ["deploy:auth-service:staging"]
   └── Terragrunt実行: auth-service の staging 環境のみ
```


```
7. production/auth-service ブランチへPR作成
   ├── staging/auth-service → production/auth-service
   ├── 厳格なレビュープロセス
   └── deploy:auth-service:production ラベル

8. マージ時のデプロイ
   ├── イベント検出: push to production/auth-service
   ├── 環境フィルタリング: production環境のみ
   │   → 抽出結果: ["deploy:auth-service:production"]
   └── Terragrunt実行: auth-service の production 環境のみ
```

## 🔍 重要な実装詳細

### 環境別フィルタリングロジック
```ruby
# 各環境のデプロイ時に実行される
case target_environment
when 'develop'
  filtered_labels = all_labels.select { |label| label.include?(':develop') }
when 'staging'
  filtered_labels = all_labels.select { |label| label.include?(':staging') }
when 'production'
  filtered_labels = all_labels.select { |label| label.include?(':production') }
end
```

### 安全性メカニズム
```yaml
# マージPR情報が取得できない場合
- name: Fail deployment - No merged PR found
  if: |
    github.event_name == 'push' &&
    github.ref_name == 'develop' &&
    !steps.merged-pr.outputs.number
  run: |
    echo "::error::No merged PR information found"
    exit 1  # デプロイを確実に停止
```

### ラベル例と処理結果
```
すべてのPRで付与されるラベル（一例）:
- deploy:auth-service:develop
- deploy:auth-service:staging
- deploy:auth-service:production
- deploy:api-gateway:develop
- deploy:api-gateway:staging
- deploy:api-gateway:production

develop ブランチでの処理結果:
→ deploy:auth-service:develop ✅
→ deploy:api-gateway:develop ✅
→ 他の環境（staging/production）❌ (無視)

staging/auth-service ブランチでの処理結果:
→ deploy:auth-service:staging ✅
→ 他のサービス・環境 ❌ (無視)

production/auth-service ブランチでの処理結果:
→ deploy:auth-service:production ✅
→ 他のサービス・環境 ❌ (無視)
```

## 🎁 システムの利点

### 開発効率性
- **精密デプロイ**: 変更したサービスのみを対象
- **時間短縮**: 不要なTerragrunt実行を排除
- **並列化**: 複数サービスの同時デプロイ
- **自動化**: 手動での判断・実行作業を排除

### 安全性・信頼性
- **影響範囲限定**: サービス・環境単位での隔離
- **予測可能性**: デプロイ対象の事前確認
- **段階的展開**: develop → staging → production
- **確実な停止**: 不明状況での自動中止

### 運用性・保守性
- **統一プロセス**: 全環境で同じワークフロー
- **可視性**: GitHub UIでのデプロイ対象確認
- **追跡可能性**: 完全な変更履歴
- **学習コスト**: 一つのパターンの習得のみ

## 🚨 考慮事項と制約

### 前提条件
- **ブランチ命名規則**: `staging/{service}`, `production/{service}` の厳密な遵守
- **PRベースワークフロー**: 直接pushは想定外
- **マージPR情報**: GitHub Actions環境での正常取得が必須

### 潜在的なリスク
- **ラベル付与失敗**: 自動ラベル付与システムの障害時
- **権限設定**: 環境別IAM Roleの適切な設定が必要
- **複雑性**: 初期理解には一定の学習コストが必要

### 運用ルール
- **デプロイ対象確認**: PRマージ前にラベルの確認
- **緊急時手順**: 自動システム障害時の手動デプロイ方法
- **監視**: デプロイ成功/失敗の定期的な確認

## 📊 導入効果の予測

### 定量的効果
- **デプロイ時間**: 70-80%短縮（5サービス環境での推定）
- **AWS API呼び出し**: 60-70%削減
- **CI/CDリソース使用**: 50-60%削減
- **デプロイ成功率**: 向上（影響範囲限定による）

### 定性的効果
- **開発者体験**: デプロイ待ち時間短縮により改善
- **システム安定性**: 意図しない変更の排除により向上
- **運用負荷**: 統一プロセスにより軽減
- **変更管理**: 追跡可能性向上により改善

## 🛠️ 実装ロードマップ

### Phase 1: 基盤整備
1. auto-label--label-dispatcher.yaml の機能拡張
2. auto-label--deploy-trigger.yaml の統一化
3. 環境別フィルタリングロジックの実装

### Phase 2: 段階的導入
1. develop環境での運用開始
2. staging環境への展開
3. production環境への慎重な導入

### Phase 3: 最適化・監視
1. パフォーマンス監視とチューニング
2. エラーハンドリングの改善
3. 運用ドキュメントの整備

この統一デプロイメント戦略により、monorepoにおける安全で効率的なインフラストラクチャ管理が実現されます。
