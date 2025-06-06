# Terragrunt CI/CD GitHub Actions ワークフロー - 完全仕様書

## 背景・目的
https://github.com/panicboat/monorepo において、Terragruntを使用したインフラストラクチャ管理のCI/CDパイプラインを構築する。PR作成時にPlan、Merge時にApplyを自動実行し、複数のサービスと環境に対応した汎用的なワークフローを実現する。

## ディレクトリ構造の要件
以下の複数パターンのディレクトリ構造に対応する必要がある：

```
# パターン1: サービス直下
service/terragrunt/
├── root.hcl
├── Makefile
├── modules/
└── envs/
    ├── develop/
    ├── staging/
    └── production/

# パターン2: カテゴリ配下
category/service/terragrunt/
├── root.hcl
├── Makefile
├── modules/
└── envs/
    ├── develop/
    ├── staging/
    └── production/

# パターン3: Repository名ベース
**/service/terragrunt/
├── root.hcl
├── Makefile
├── modules/
└── envs/
    ├── repository-name/
    ├── repository-name/
    └── repository-name/
```

## 実行要件

### 基本動作
- **PR時**: 変更されたterragrunt環境に対してPlanを実行
- **Merge時**: 変更されたterragrunt環境に対してApplyを実行
- **環境単位実行**: `envs/`直下の各ディレクトリ（develop, staging, production, repository名等）ごとに個別実行
- **並列実行**: 複数環境に変更がある場合、その数分のplan/applyを並列実行

### 変更検出ロジック
- ファイル変更を検出し、影響のあるterragrunt環境ディレクトリのみを対象とする
- `**/service/terragrunt/envs/[環境名]/**` パターンの変更を検出
- 変更のない環境では実行しない（効率化）

## 設定ファイル仕様

### `.github/terragrunt-actions-config.yaml`
```yaml
# Terragrunt Actions IAM Role Configuration

default:
  iam_role_plan: arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role
  iam_role_apply: arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role
  aws_region: ap-northeast-1

develop:
  iam_role_plan: arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role
  iam_role_apply: arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role
  aws_region: ap-northeast-1
  working_directory: "**/terragrunt/envs/develop"

staging:
  iam_role_plan: arn:aws:iam::123456789012:role/terragrunt-plan-staging-role
  iam_role_apply: arn:aws:iam::123456789012:role/terragrunt-apply-staging-role
  aws_region: ap-northeast-1
  working_directory: "**/terragrunt/envs/staging"

production:
  iam_role_plan: arn:aws:iam::123456789012:role/terragrunt-plan-production-role
  iam_role_apply: arn:aws:iam::123456789012:role/terragrunt-apply-production-role
  aws_region: ap-northeast-1
  working_directory: "**/terragrunt/envs/production"

claude-code-action:
  iam_role_plan: arn:aws:iam::123456789012:role/GitHubActions-TerragruntCustom-Role
  iam_role_apply: arn:aws:iam::123456789012:role/GitHubActions-TerragruntCustom-Role
  aws_region: ap-northeast-1
```

### IAMロール選択ルール
- **Plan用**: `{env}.iam_role_plan` → `default.iam_role_plan`
- **Apply用**: `{env}.iam_role_apply` → `default.iam_role_apply`
- **working_directory**: 設定値 → 自動検出パス
- **aws_region**: `{env}.aws_region` → `default.aws_region` → `us-east-1`

## 技術仕様

### 使用する人気GitHub Actions
- `gruntwork-io/terragrunt-action@v2`: Terragrunt実行用
- `aws-actions/configure-aws-credentials@v4`: AWS OIDC認証用
- `actions/checkout@v4`: ソースコード取得用
- `peter-evans/find-comment@v3`: 既存PRコメント検索用
- `peter-evans/create-or-update-comment@v4`: PRコメント作成・更新用

### 認証方式
- **OIDC認証**: 長期間のAWSキーを使用せず、一時的な認証を実現
- **Plan/Apply権限分離**: 各操作に対応する適切な権限のIAMロールを使用

### 必要な環境変数
```yaml
# Plan用
env:
  TF_INPUT: false
  TERRAGRUNT_IAM_ROLE: ${{ steps.load-config.outputs.plan-iam-role }}
  AWS_DEFAULT_REGION: ${{ steps.load-config.outputs.aws-region }}

# Apply用
env:
  TF_INPUT: false
  TERRAGRUNT_IAM_ROLE: ${{ steps.load-config.outputs.apply-iam-role }}
  AWS_DEFAULT_REGION: ${{ steps.load-config.outputs.aws-region }}
```

## ワークフロー構成

### 1. 再利用可能ワークフロー
- `reusable-terragrunt-plan.yaml`: PR時のPlan実行用
- `reusable-terragrunt-apply.yaml`: Merge時のApply実行用

### 2. サービス固有ワークフロー例
```yaml
name: 'Example Service - CI/CD'

on:
  pull_request:
    branches: [develop, staging/*, production/*]
    paths:
      - 'example-service/**'
      - 'category/example-service/**'
      - '.github/workflows/example-service-*.yaml'
  push:
    branches: [develop, staging/*, production/*]
    paths:
      - 'example-service/**'
      - 'category/example-service/**'

env:
  SERVICE_NAME: example-service

jobs:
  terragrunt-plan:
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/reusable-terragrunt-plan.yaml
    with:
      project_name: ${{ env.SERVICE_NAME }}
      terraform_version: '1.5.7'
      terragrunt_version: '0.53.2'

  terragrunt-apply:
    if: github.event_name == 'push'
    uses: ./.github/workflows/reusable-terragrunt-apply.yaml
    with:
      project_name: ${{ env.SERVICE_NAME }}
      terraform_version: '1.5.7'
      terragrunt_version: '0.53.2'
```

## レポート機能

### Plan結果PRコメント
```markdown
## 📋 Terragrunt Plan Results

**Project**: my-service
**Environment**: `develop`
**Directory**: `category/my-service/terragrunt/envs/develop`
**IAM Role (Plan)**: arn:aws:iam::123456789012:role/terragrunt-plan-develop-role
**AWS Region**: ap-northeast-1
**Status**: ✅ Success

### 📊 Plan Summary

| Action    | Count |
| --------- | ----- |
| 🟢 Add     | 3     |
| 🟡 Change  | 1     |
| 🔴 Destroy | 0     |

📝 Plan Output (折りたたみで詳細出力表示)
```

### Apply結果PRコメント
```markdown
## 🚀 Terragrunt Apply Completed

**Project**: my-service
**Environment**: `develop`
**Status**: ✅ Success

### 📊 Apply Summary

| Action      | Count |
| ----------- | ----- |
| 🟢 Added     | 3     |
| 🟡 Changed   | 1     |
| 🔴 Destroyed | 0     |

📝 Apply Output (折りたたみで詳細出力表示)
```

### コメント管理機能
- **`peter-evans/find-comment@v3`**: 既存コメントの効率的検索
- **`peter-evans/create-or-update-comment@v4`**: コメントの作成・更新
- **一意識別子**: `terragrunt-plan-{env_name}-{project_name}` / `terragrunt-apply-{env_name}-{project_name}`
- **重複回避**: 環境ごとに独立したコメント管理

## 出力制限と全出力確認

### 出力制限
- **Plan出力**: 30,000文字まで（GitHubコメント制限対応）
- **Apply出力**: 20,000文字まで
- **制限時表示**: `... (output truncated, see workflow logs for full details)`

### 全出力確認場所
1. **GitHub Actions ワークフローログ** ⭐ メイン確認場所
   - 完全な出力が制限なしで表示
   - リアルタイム確認可能
   - 永続保存（GitHub設定による）

2. **コメント内リンク**: ワークフローログへの直接リンク提供

## 実行例シナリオ

### シナリオ1: 単一環境変更
```
変更: example-service/terragrunt/envs/develop/main.tf
実行: develop環境のみでplan/apply（develop専用IAMロール使用）
```

### シナリオ2: 複数環境変更
```
変更:
- example-service/terragrunt/envs/develop/main.tf
- example-service/terragrunt/envs/staging/variables.tf
- example-service/terragrunt/envs/production/outputs.tf

実行: 3環境で並列plan/apply
- develop（develop専用plan/applyロール）
- staging（staging専用plan/applyロール）
- production（production専用plan/applyロール）
```

### シナリオ3: カスタム環境
```
変更: my-service/terragrunt/envs/claude-code-action/main.tf
実行: claude-code-action環境でplan/apply（設定ファイル定義のIAMロール使用）
```

### シナリオ4: 未定義環境
```
変更: my-service/terragrunt/envs/undefined-env/main.tf
実行: undefined-env環境でplan/apply（default IAMロール使用）
```

## セキュリティ特徴

### Plan/Apply権限分離
- **Plan用ロール**: 読み取り専用権限（describe, get, list等）
- **Apply用ロール**: 書き込み権限（create, update, delete等）
- **Principle of Least Privilege**: 操作に必要な最小権限のみ付与

### OIDC認証
- 長期間のAWSキー不要
- セッションベースの一時的認証
- GitHub Actions環境との安全な連携

## 汎用性要件
- 任意のサービス名、カテゴリ名に対応
- 任意の環境名に対応（develop/staging/production以外も可）
- `iam_role_plan`/`iam_role_apply`の明示的分離（後方互換性なし）
- オプションの`working_directory`で実行パス指定可能
- ディレクトリ構造の違いを自動検出・対応

## 実装時の注意点

1. **必須設定**: `default`セクションに`iam_role_plan`/`iam_role_apply`が必須
2. **Plan/Apply分離**: 全環境で明示的なロール分離を推奨
3. **出力解析**: Terragruntの出力パターンに依存する変更数カウント
4. **エラーハンドリング**: `continue-on-error: true`で失敗時も継続実行
5. **GitHub制限**: コメント文字数制限への対応

この仕様書に基づいて、セキュリティを重視した汎用的なTerragrunt CI/CDワークフローが構築できます。
