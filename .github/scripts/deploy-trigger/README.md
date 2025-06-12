# Deploy Trigger 完全理解ガイド

## 🎯 概要

Deploy Trigger は、Issue #107 戦略に基づいてブランチの push イベントから適切なデプロイメントを実行するシステムです。

## 🔄 Issue #107 戦略の実装

```mermaid
graph LR
    subgraph "ブランチフロー"
        A[feature/*] --> B[develop]
        B --> C[staging/service]
        C --> D[production/service]
    end

    subgraph "環境マッピング"
        B --> E[develop環境]
        C --> F[staging環境]
        D --> G[production環境]
    end

    subgraph "デプロイ対象"
        E --> H[全サービス]
        F --> I[単一サービス]
        G --> J[単一サービス]
    end

    style E fill:#e8f5e8
    style F fill:#fff3e0
    style G fill:#ffebee
```

## 🚀 処理フロー詳細

```mermaid
sequenceDiagram
    participant GHA as GitHub Actions
    participant DT as Deploy Trigger
    participant API as GitHub API
    participant Safety as Safety Check
    participant Matrix as Matrix Generator
    participant TG as Terragrunt

    GHA->>GHA: ブランチ push 検出
    GHA->>API: マージPR情報取得
    API-->>GHA: PR #123 情報
    GHA->>DT: trigger from_pr 123

    DT->>DT: 環境判定 (develop)
    DT->>API: PR #123 ラベル取得
    API-->>DT: deploy:auth:develop, deploy:api:develop

    DT->>DT: 環境フィルタリング (develop のみ)
    DT->>Safety: 安全性チェック実行
    Safety-->>DT: ✅ PASS

    DT->>Matrix: デプロイマトリックス生成
    Matrix-->>DT: 2個のターゲット
    DT-->>GHA: デプロイマトリックス

    GHA->>TG: auth-service:develop 並列実行
    GHA->>TG: api-service:develop 並列実行
```

## 🎯 核心：環境判定とサービス組み合わせ

```mermaid
graph TD
    A[Push Event] --> B{ブランチ判定}

    B -->|develop/main| C[develop環境]
    B -->|staging/*| D[staging環境]
    B -->|production/*| E[production環境]

    C --> F[PRラベル取得]
    D --> F
    E --> F

    F --> G[deploy:auth-service, deploy:api-gateway]

    G --> H{develop環境の場合}
    G --> I{staging環境の場合}
    G --> J{production環境の場合}

    H --> K[全サービスをdevelop環境でデプロイ]
    I --> L[全サービスをstaging環境でデプロイ]
    J --> M[全サービスをproduction環境でデプロイ]

    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#ffebee
    style K fill:#e8f5e8
    style L fill:#fff3e0
    style M fill:#ffebee
```

## 🛡️ 安全性チェック詳細

```mermaid
graph TD
    A[安全性チェック開始] --> B[マージPR確認]
    B --> C{PR情報存在?}

    C -->|No| D[🚨 DEPLOYMENT STOPPED]
    C -->|Yes| E[ラベル存在確認]

    E --> F{ラベル存在?}
    F -->|No| G[🚨 DEPLOYMENT STOPPED]
    F -->|Yes| H[ブランチパターン確認]

    H --> I{正規パターン?}
    I -->|No| J[⚠️ WARNING]
    I -->|Yes| K[環境一致確認]

    K --> L{環境一致?}
    L -->|No| M[🚨 DEPLOYMENT STOPPED]
    L -->|Yes| N[✅ DEPLOYMENT ALLOWED]

    style D fill:#ffebee
    style G fill:#ffebee
    style J fill:#fff3e0
    style M fill:#ffebee
    style N fill:#e8f5e8
```

## 🏗️ アーキテクチャ

### 主要ユースケース
```ruby
module UseCases
  module DeployTrigger
    class DetermineTargetEnvironment
      # ブランチ名から対象環境を判定
    end

    class GetMergedPrLabels
      # GitHub Actions で取得されたPR番号からラベル取得
    end

    class ValidateDeploymentSafety
      # Issue #107 安全性要件のチェック
    end

    class GenerateMatrix
      # サービスラベル + 対象環境 → Terragrunt実行マトリックス生成
    end
  end
end
```

## 📋 設定ファイル連携

### ブランチパターン設定
```yaml
branch_patterns:
  develop:
    target_environment: develop
  main:
    target_environment: develop
  staging:
    pattern: "staging/*"
    target_environment: staging
  production:
    pattern: "production/*"
    target_environment: production
```

### 安全性チェック設定
```yaml
safety_checks:
  require_merged_pr: true      # マージPR情報必須
  fail_on_missing_pr: true     # PR情報なしでデプロイ停止
  max_retry_attempts: 3        # API エラー時のリトライ
```

## 🎪 GitHub Actions 統合

### GitHub Actions での実装
```yaml
- name: Get merged PR information
  id: get-merged-pr
  uses: actions-ecosystem/action-get-merged-pull-request@v1
  continue-on-error: true

- name: Setup Ruby
  uses: ruby/setup-ruby@v1
  with:
    ruby-version: '3.4'
    bundler-cache: true
    working-directory: .github/scripts/shared

- name: Deploy Trigger
  working-directory: .github/scripts/shared
  run: |
    if [ -n "${{ steps.get-merged-pr.outputs.number }}" ]; then
      bundle exec ruby ../deploy-trigger/bin/trigger from_pr ${{ steps.get-merged-pr.outputs.number }}
    else
      echo "::error::No merged PR found - deployment stopped"
      exit 1
    fi
```

### 重要なポイント
- **PR情報取得**: GitHub Actions の actions-ecosystem アクションを使用
- **Ruby 環境**: `shared` ディレクトリで Gemfile 管理
- **実行方式**: `bundle exec` で依存関係を正しく解決
- **安全性**: PR情報がない場合はデプロイ停止

### マトリックス出力
```yaml
strategy:
  matrix:
    target: ${{ fromJson(needs.extract-deployment-targets.outputs.targets) }}
```

## 🚀 CLI 使用方法

### 基本コマンド
```bash
# shared ディレクトリから実行（推奨）
cd .github/scripts/shared

# ブランチベースでトリガー
bundle exec ruby ../deploy-trigger/bin/trigger from_branch develop

# PR番号指定でトリガー
bundle exec ruby ../deploy-trigger/bin/trigger from_pr 123

# テスト実行
bundle exec ruby ../deploy-trigger/bin/trigger test develop

# GitHub Actions環境シミュレート
bundle exec ruby ../deploy-trigger/bin/trigger simulate develop
```

### 高度なコマンド
```bash
# デバッグモード
bundle exec ruby ../deploy-trigger/bin/trigger debug develop --commit-sha=abc123

# 環境変数検証
bundle exec ruby ../deploy-trigger/bin/trigger validate_env

# または deploy-trigger ディレクトリから直接実行
cd .github/scripts/deploy-trigger
ruby bin/trigger from_branch develop
```

## 📊 実行例

### develop ブランチの場合

**入力:**
```bash
# develop ブランチへ push
# マージPR #123 のラベル:
# - deploy:auth-service
# - deploy:api-gateway
```

**処理:**
```ruby
# 1. 環境判定: develop
# 2. ラベル取得: deploy:auth-service, deploy:api-gateway
# 3. マトリックス生成: 各サービス × develop環境
```

**出力:**
```json
{
  "targets": [
    {
      "service": "auth-service",
      "environment": "develop",
      "working_directory": "auth-service/terragrunt/envs/develop",
      "iam_role_plan": "arn:aws:iam::123:role/plan-develop",
      "iam_role_apply": "arn:aws:iam::123:role/apply-develop"
    },
    {
      "service": "api-gateway",
      "environment": "develop",
      "working_directory": "api-gateway/terragrunt/envs/develop",
      "iam_role_plan": "arn:aws:iam::123:role/plan-develop",
      "iam_role_apply": "arn:aws:iam::123:role/apply-develop"
    }
  ]
}
```

### staging/auth-service ブランチの場合

**入力:**
```bash
# staging/auth-service ブランチへ push
# マージPR #124 のラベル:
# - deploy:auth-service
# - deploy:api-gateway  # 他のサービスラベルも存在する可能性
```

**処理:**
```ruby
# 1. 環境判定: staging
# 2. ラベル取得: deploy:auth-service, deploy:api-gateway
# 3. マトリックス生成: 全ラベル × staging環境
# 注: ブランチ名は staging/auth-service だが、全ラベルがデプロイ対象
```

**出力:**
```json
{
  "targets": [
    {
      "service": "auth-service",
      "environment": "staging",
      "working_directory": "auth-service/terragrunt/envs/staging"
    },
    {
      "service": "api-gateway",
      "environment": "staging",
      "working_directory": "api-gateway/terragrunt/envs/staging"
    }
  ]
}
```

## 🐛 トラブルシューティング

### よくあるエラー

1. **No merged PR found**
   ```bash
   # 原因: 直接 push で PR 経由でない
   # 解決: PR 経由でマージする
   ```

2. **No deployment labels found**
   ```bash
   # 原因: PR にデプロイラベルがない
   # 解決: Label Dispatcher の動作確認
   ```

3. **Safety validation failed**
   ```bash
   # 原因: 安全性チェックに引っかかった
   # 解決: ブランチパターンや環境設定を確認
   ```

### デバッグ方法
```bash
# ステップバイステップデバッグ
ruby bin/trigger debug staging/auth-service

# 設定確認
ruby .github/scripts/config-manager/bin/config-manager validate

# GitHub API 接続確認
ruby bin/trigger validate_env
```

---

Deploy Trigger により、Issue #107 で定義された安全で確実なデプロイメント戦略が完全に自動化されます。
