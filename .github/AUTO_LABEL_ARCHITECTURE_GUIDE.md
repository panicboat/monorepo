# Auto Label アーキテクチャ - 実装完了ガイド

## 🎯 実装概要

GitHub Actionsワークフローの疎結合化が完了しました。新しいアーキテクチャでは、差分検知とデプロイ実行が分離され、PRラベルを介した柔軟なデプロイ制御が可能になりました。

## 📁 新しいファイル構成

```
.github/
├── auto-label--directory-mapping.yaml           # 🆕 ディレクトリ-ラベルマッピング定義
├── workflows/
│   ├── auto-label--detect-and-apply.yaml       # 🆕 差分検知・ラベル付与
│   ├── auto-label--deploy-executor.yaml        # 🆕 ラベルベースデプロイ実行
│   ├── github-oidc-auth--ci.yaml               # 🔄 新アーキテクチャテスト用に更新
│   └── github-oidc-auth--ci-legacy.yaml        # 🆕 従来ワークフローのバックアップ
```

## 🚀 新しいワークフロー

### 1. 差分検知・ラベル付与ワークフロー

**ファイル**: `.github/workflows/auto-label--detect-and-apply.yaml`

**動作**:
- PR作成・更新時に自動実行
- 変更されたファイルを検知
- マッピング定義に基づいてPRラベルを自動付与
- 古いラベルの自動削除
- PRコメントでのデプロイ対象通知

**例**:
```
github-oidc-auth/terragrunt/envs/develop/terragrunt.hcl を変更
↓
deploy:github-oidc-auth:develop ラベルを自動付与
```

### 2. ラベルベースデプロイ実行ワークフロー

**ファイル**: `.github/workflows/auto-label--deploy-executor.yaml`

**動作**:
- PRラベル変更時: `terragrunt plan` 実行
- ブランチへのpush時: `terragrunt apply` 実行
- 複数環境の並列実行サポート
- 実行結果のPRコメント通知

## 🎛️ 設定ファイル

### auto-label--directory-mapping.yaml の構造

```yaml
# 環境ごとの共通設定
environment_config:
  develop:
    aws_region: "ap-northeast-1"
    iam_role_plan: "arn:aws:iam::559744160976:role/..."
    iam_role_apply: "arn:aws:iam::559744160976:role/..."

# ディレクトリ構成規約
directory_conventions:
  terragrunt: "{service}/terragrunt/envs/{environment}"
  kubernetes: "{service}/kubernetes/overlays/{environment}"

# マッピング定義
mappings:
  "github-oidc-auth/terragrunt/envs/develop":
    labels:
      - "deploy:github-oidc-auth:develop"
    service: "github-oidc-auth"
    environment: "develop"
    stack: "terragrunt"
```

## 🧪 テスト手順

### Phase 1: 設定検証

新しいアーキテクチャの設定を検証します。

```bash
# 1. 新アーキテクチャの設定検証
gh workflow run github-oidc-auth--ci.yaml \
  -f test_scenario=validate_new_architecture

# 2. 実行結果確認
gh run list --workflow=github-oidc-auth--ci.yaml --limit 1
```

### Phase 2: 差分検知テスト

テスト用PRを作成して差分検知ワークフローをテストします。

```bash
# 1. テスト用ブランチ作成
git checkout -b test/new-architecture-validation

# 2. github-oidc-auth のファイルを変更
echo "# Test change for new architecture" >> github-oidc-auth/terragrunt/envs/develop/test.md

# 3. PRの作成
git add .
git commit -m "test: 新アーキテクチャのテスト用変更"
git push origin test/new-architecture-validation

# 4. PRの作成（GitHubのWeb UIまたはgh CLIで）
gh pr create --title "Test: 新アーキテクチャ検証" --body "新しい差分検知ワークフローのテスト"
```

**期待される動作**:
1. `detect-changes-and-label.yaml` が自動実行される
2. PRに `deploy:github-oidc-auth:develop` ラベルが付与される
3. PRにデプロイ対象の説明コメントが追加される

### Phase 3: ラベルベースデプロイテスト

```bash
# 1. ラベル変更による plan 実行テスト
gh pr edit <PR番号> --add-label "deploy:github-oidc-auth:staging"

# 2. deploy-based-on-labels.yaml の自動実行確認
gh run list --workflow=deploy-based-on-labels.yaml

# 3. ラベル削除テスト
gh pr edit <PR番号> --remove-label "deploy:github-oidc-auth:staging"
```

**期待される動作**:
1. ラベル追加時に `terragrunt plan` が実行される
2. ラベル削除時にそのデプロイ対象が除外される
3. PRに plan 結果のコメントが追加される

### Phase 4: Apply実行テスト

```bash
# developブランチへのマージでapply実行テスト
# （本番環境での実行は慎重に行ってください）

# 1. PRをマージ（develop環境のみテスト推奨）
gh pr merge <PR番号> --merge

# 2. deploy-based-on-labels.yaml でのapply実行確認
gh run list --workflow=deploy-based-on-labels.yaml --limit 5
```

## 🔄 段階的移行計画

### ステップ1: 並行運用期間（推奨2週間）

- 新しいワークフローを有効化
- 既存ワークフローも並行稼働
- 新旧両方の動作確認

### ステップ2: 新アーキテクチャ本格運用

- 既存ワークフローの無効化
- 新しいワークフローのみで運用
- 問題発生時の緊急時手順確立

### ステップ3: クリーンアップ

- 古いワークフローファイルの削除
- 不要な設定ファイルの削除
- ドキュメント更新

## 🛠️ 運用方法

### 手動でのデプロイ制御

```bash
# 特定環境のデプロイをスキップ
gh pr edit <PR番号> --remove-label "deploy:service:environment"

# 追加環境へのデプロイ
gh pr edit <PR番号> --add-label "deploy:service:environment"

# 現在のPRラベル確認
gh pr view <PR番号> --json labels
```

### 新サービスの追加

`auto-label--directory-mapping.yaml` にマッピング定義を追加するだけです：

```yaml
mappings:
  "new-service/terragrunt/envs/develop":
    labels:
      - "deploy:new-service:develop"
    service: "new-service"
    environment: "develop"
    stack: "terragrunt"
```

### トラブルシューティング

#### ワークフローが実行されない

```bash
# 1. トリガー条件の確認
gh workflow view detect-changes-and-label.yaml

# 2. 実行履歴の確認
gh run list --workflow=detect-changes-and-label.yaml --limit 10

# 3. ログの詳細確認
gh run view <run-id> --log
```

#### ラベルが正しく付与されない

```bash
# 1. マッピング設定の確認
yq e '.mappings' .github/auto-label--directory-mapping.yaml

# 2. 変更ファイルパスの確認
git diff --name-only origin/main...HEAD

# 3. マッピングのマッチング確認
# （ファイルパスがマッピングキーと一致するか）
```

#### デプロイが失敗する

```bash
# 1. 従来のワークフローで動作確認
gh workflow run github-oidc-auth--ci.yaml \
  -f test_scenario=emergency_deploy \
  -f target_environment=develop

# 2. IAMロール・権限の確認
# environment_config の設定値を確認

# 3. working_directory の確認
# directory_conventions の設定が正しいか確認
```

## 📋 チェックリスト

### 実装完了確認

- [x] `auto-label--directory-mapping.yaml` 作成完了
- [x] `detect-changes-and-label.yaml` 作成完了
- [x] `deploy-based-on-labels.yaml` 作成完了
- [x] 既存ワークフローのバックアップ作成
- [x] テスト用ワークフロー更新

### テスト完了確認

- [ ] 設定検証テスト実行
- [ ] 差分検知テスト実行
- [ ] ラベル付与テスト実行
- [ ] Plan実行テスト実行
- [ ] Apply実行テスト実行（develop環境のみ）

### 本格運用準備

- [ ] チーム内での新アーキテクチャ説明
- [ ] 緊急時対応手順の確立
- [ ] 既存ワークフローの無効化
- [ ] 運用ドキュメント更新

## 🎉 期待される効果

### 保守性の向上
- ✅ 新サービス追加時はマッピング定義の更新のみ
- ✅ 各ワークフローが単一責任で修正が局所化
- ✅ 設定の一元管理

### 運用性の向上
- ✅ PRラベルによる視覚的なデプロイ対象確認
- ✅ 手動ラベル操作による柔軟なデプロイ制御
- ✅ 詳細なデプロイ状況のPRコメント表示

### 拡張性の向上
- ✅ 技術スタック別制御への対応準備完了
- ✅ 新しいデプロイ対象の追加が容易
- ✅ 並列実行制御の仕組み

---

**注意**: 本格運用開始前に、必ずdevelop環境での十分なテストを実施してください。特にIAMロールの権限設定と、terragruntの実行ディレクトリが正しく設定されていることを確認してください。
