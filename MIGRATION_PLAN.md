# 📚 deploy-actions 移行計画・進捗管理ドキュメント

## 🎯 プロジェクト概要

**目的**: monorepo/.github のスクリプトを別リポジトリ deploy-actions に移動し、GitHub Actions の再利用性を向上させる

**アプローチ**: 運用前のため破壊的変更可能。セキュリティ境界を明確にした設計で一括移行。

**作成日**: 2025-07-06
**最終更新**: 2025-07-06

## 📋 調査結果サマリー

### 現在の構成
```
monorepo/.github/
├── scripts/
│   ├── label-dispatcher/          # PRファイル変更検知 → deploy:service ラベル付与
│   ├── deploy-trigger/            # ブランチpush → マージPRラベル取得 → デプロイマトリックス生成
│   ├── config-manager/            # workflow-config.yaml の管理・検証
│   └── shared/                    # 共通コンポーネント（entities, infrastructure, interfaces）
├── workflows/                     # 自動化ワークフロー
└── actions/                       # カスタムアクション
```

### 重要な依存関係
- **共通設定**: `shared/workflow-config.yaml`
- **Ruby依存**: `scripts/Gemfile`, `scripts/Gemfile.lock`
- **実行パス**: scripts ディレクトリから `bundle exec` で実行
- **相対パス**: `../shared/shared_loader` で共通コンポーネント読み込み

### 各スクリプトの役割

#### label-dispatcher
- **機能**: PRのファイル変更を検知し、適切なデプロイラベルを自動付与
- **入力**: PR番号、base-ref、head-ref
- **出力**: `deploy:{service}` ラベル
- **依存**: shared components, GitHub API

#### deploy-trigger
- **機能**: ブランチpushからマージPRのラベルを取得し、デプロイマトリックス生成
- **入力**: イベントタイプ、PR番号/ブランチ名
- **出力**: デプロイメントターゲットのJSONマトリックス
- **依存**: shared components, GitHub API

#### config-manager
- **機能**: workflow-config.yaml の管理・検証・診断
- **入力**: 設定ファイルパス
- **出力**: 検証結果、診断レポート
- **依存**: shared components

## 🏗️ 移行後の目標構成

### deploy-actions リポジトリ
```
deploy-actions/
├── .github/workflows/
│   ├── reusable--label-dispatcher.yaml
│   ├── reusable--deploy-trigger.yaml
│   ├── reusable--terragrunt-executor.yaml
│   └── reusable--kubernetes-executor.yaml
├── scripts/
│   ├── label-dispatcher/
│   ├── deploy-trigger/
│   ├── config-manager/
│   ├── shared/
│   ├── Gemfile
│   └── Gemfile.lock
├── actions/
│   └── （汎用化されたアクション）
├── README.md
└── CHANGELOG.md
```

### monorepo（移行後）
```
monorepo/.github/
├── workflows/
│   ├── auto-label--label-dispatcher.yaml    # deploy-actions呼び出し
│   └── auto-label--deploy-trigger.yaml      # deploy-actions呼び出し
├── config/
│   └── workflow-config.yaml                 # 設定ファイルのみ
└── MIGRATION_PLAN.md                        # このドキュメント
```

## 🔒 セキュリティ設計原則

### 初期化処理分離
- **monorepo側**: GitHub App Token生成、PR情報取得、リポジトリ固有情報
- **deploy-actions側**: 受け取った情報でロジック実行

### 情報の流れ
```
monorepo → GitHub App Token生成 → deploy-actions reusable workflow呼び出し
monorepo → PR情報取得 → token, pr-info, config をsecretsで渡す
deploy-actions → 受け取った情報でスクリプト実行
```

### セキュリティ境界
- 機密情報（app-id、private-key）は monorepo 内のみ
- deploy-actions は生成済みの token のみ受け取り

## 📝 詳細移行計画

### Phase 1: deploy-actions リポジトリ準備
- [x] 1.1: リポジトリ初期化・基本構造作成 ✅ **完了**
- [x] 1.2: scripts ディレクトリ全体移行 ✅ **完了**
- [x] 1.3: Gemfile/依存関係の動作確認 ✅ **完了**
- [x] 1.4: 設定ファイルパス外部化対応 ✅ **完了**

### Phase 2: Reusable Workflows 作成
- [x] 2.1: reusable--label-dispatcher.yaml 作成 ✅ **完了**
- [x] 2.2: reusable--deploy-trigger.yaml 作成 ✅ **完了**
- [x] 2.3: reusable--terragrunt-executor.yaml 移行 ✅ **完了**
- [x] 2.4: reusable--kubernetes-executor.yaml 移行 ✅ **完了**

### Phase 3: Custom Actions 汎用化 (スキップ - 最小構成で動作確認後)
- [ ] 3.1: extract-deployment-targets アクション汎用化 
- [ ] 3.2: generate-deployment-summary アクション汎用化
- [ ] 3.3: その他アクションの移行判定・実装

### Phase 4: monorepo 側ワークフロー書き換え
- [x] 4.1: 設定ファイルパス調整（shared/ → config/） ✅ **完了**
- [x] 4.2: auto-label--label-dispatcher.yaml 書き換え ✅ **完了**
- [x] 4.3: auto-label--deploy-trigger.yaml 書き換え ✅ **完了**
- [ ] 4.4: 不要ファイル削除 👈 **進行中**

### Phase 5: テスト・検証
- [ ] 5.1: label-dispatcher フロー動作確認
- [ ] 5.2: deploy-trigger フロー動作確認
- [ ] 5.3: 各環境でのデプロイテスト
- [ ] 5.4: エラーハンドリング確認

## 🛠️ 実装詳細テンプレート

### monorepo ワークフロー例

#### auto-label--label-dispatcher.yaml
```yaml
name: 'Auto Label - Label Dispatcher'
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  prepare-dispatch:
    runs-on: ubuntu-latest
    outputs:
      github-token: ${{ steps.app-token.outputs.token }}
      pr-number: ${{ steps.pr-info.outputs.number }}
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2.0.6
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Get PR information
        id: pr-info
        uses: jwalton/gh-find-current-pr@v1
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          state: all
        continue-on-error: true

  dispatch-labels:
    needs: prepare-dispatch
    uses: organization/deploy-actions/.github/workflows/reusable--label-dispatcher.yaml@v1
    with:
      pr-number: ${{ needs.prepare-dispatch.outputs.pr-number || github.event.pull_request.number }}
      repository: ${{ github.repository }}
      config-path: '.github/config/workflow-config.yaml'
    secrets:
      github-token: ${{ needs.prepare-dispatch.outputs.github-token }}
```

#### auto-label--deploy-trigger.yaml
```yaml
name: 'Auto Label - Deploy Trigger'
on:
  push:
    branches: [develop, staging, production]
  pull_request:
    types: [labeled]
    branches: ['**']

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  prepare-deployment:
    runs-on: ubuntu-latest
    outputs:
      github-token: ${{ steps.app-token.outputs.token }}
      pr-number: ${{ steps.pr-info.outputs.number }}
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2.0.6
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Get PR information
        id: pr-info
        uses: jwalton/gh-find-current-pr@v1
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          state: all
        continue-on-error: true

  extract-deployment-targets:
    needs: prepare-deployment
    uses: organization/deploy-actions/.github/workflows/reusable--deploy-trigger.yaml@v1
    with:
      event-type: ${{ github.event_name }}
      pr-number: ${{ needs.prepare-deployment.outputs.pr-number || github.event.pull_request.number }}
      repository: ${{ github.repository }}
      config-path: '.github/config/workflow-config.yaml'
    secrets:
      github-token: ${{ needs.prepare-deployment.outputs.github-token }}

  deploy-terragrunt:
    needs: [prepare-deployment, extract-deployment-targets]
    if: needs.extract-deployment-targets.outputs.has-terragrunt == 'true'
    strategy:
      matrix:
        target: ${{ fromJson(needs.extract-deployment-targets.outputs.terragrunt-targets) }}
      fail-fast: false
    uses: organization/deploy-actions/.github/workflows/reusable--terragrunt-executor.yaml@v1
    with:
      project-name: ${{ matrix.target.service }}
      environment: ${{ matrix.target.environment }}
      action-type: ${{ github.event_name == 'pull_request' && 'plan' || 'apply' }}
      plan-iam-role: ${{ matrix.target.iam_role_plan }}
      apply-iam-role: ${{ matrix.target.iam_role_apply }}
      aws-region: ${{ matrix.target.aws_region }}
      working-directory: ${{ matrix.target.working_directory }}
    secrets:
      github-token: ${{ needs.prepare-deployment.outputs.github-token }}

  deploy-kubernetes:
    needs: [prepare-deployment, extract-deployment-targets]
    if: needs.extract-deployment-targets.outputs.has-kubernetes == 'true'
    strategy:
      matrix:
        target: ${{ fromJson(needs.extract-deployment-targets.outputs.kubernetes-targets) }}
      fail-fast: false
    uses: organization/deploy-actions/.github/workflows/reusable--kubernetes-executor.yaml@v1
    with:
      service-name: ${{ matrix.target.service }}
      environment: ${{ matrix.target.environment }}
      source-path: ${{ matrix.target.working_directory }}
      action-type: ${{ github.event_name == 'pull_request' && 'diff' || 'apply' }}
    secrets:
      github-token: ${{ needs.prepare-deployment.outputs.github-token }}
```

### deploy-actions reusable workflow例

#### reusable--label-dispatcher.yaml
```yaml
name: 'Reusable Label Dispatcher'
on:
  workflow_call:
    inputs:
      pr-number:
        required: true
        type: string
      repository:
        required: true
        type: string
      config-path:
        required: false
        type: string
        default: '.github/config/workflow-config.yaml'
    secrets:
      github-token:
        required: true

jobs:
  dispatch-labels:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout deploy-actions
        uses: actions/checkout@v4

      - name: Checkout source repository
        uses: actions/checkout@v4
        with:
          repository: ${{ inputs.repository }}
          token: ${{ secrets.github-token }}
          path: source-repo
          fetch-depth: 0

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.4'
          bundler-cache: true
          working-directory: scripts

      - name: Copy configuration
        run: |
          cp source-repo/${{ inputs.config-path }} scripts/shared/workflow-config.yaml

      - name: Dispatch labels
        working-directory: scripts
        run: |
          bundle exec ruby label-dispatcher/bin/dispatcher dispatch ${{ inputs.pr-number }}
        env:
          GITHUB_TOKEN: ${{ secrets.github-token }}
          GITHUB_REPOSITORY: ${{ inputs.repository }}
```

#### reusable--deploy-trigger.yaml
```yaml
name: 'Reusable Deploy Trigger'
on:
  workflow_call:
    inputs:
      event-type:
        required: true
        type: string
        description: 'Event type: pull_request or push'
      branch-name:
        required: false
        type: string
        description: 'Branch name for push events'
      pr-number:
        required: false
        type: string
        description: 'PR number (from prepare job output or event)'
      repository:
        required: true
        type: string
      config-path:
        required: false
        type: string
        default: '.github/config/workflow-config.yaml'
    secrets:
      github-token:
        required: true
    outputs:
      targets:
        description: 'Deployment targets JSON'
        value: ${{ jobs.extract-targets.outputs.targets }}
      has-targets:
        description: 'Whether targets found'
        value: ${{ jobs.extract-targets.outputs.has-targets }}
      terragrunt-targets:
        description: 'Terragrunt targets JSON'
        value: ${{ jobs.extract-targets.outputs.terragrunt-targets }}
      kubernetes-targets:
        description: 'Kubernetes targets JSON'
        value: ${{ jobs.extract-targets.outputs.kubernetes-targets }}
      has-terragrunt:
        description: 'Whether terragrunt targets exist'
        value: ${{ jobs.extract-targets.outputs.has-terragrunt }}
      has-kubernetes:
        description: 'Whether kubernetes targets exist'
        value: ${{ jobs.extract-targets.outputs.has-kubernetes }}

jobs:
  extract-targets:
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.extract.outputs.targets }}
      has-targets: ${{ steps.extract.outputs.has-targets }}
      terragrunt-targets: ${{ steps.filter.outputs.terragrunt-targets }}
      kubernetes-targets: ${{ steps.filter.outputs.kubernetes-targets }}
      has-terragrunt: ${{ steps.filter.outputs.has-terragrunt }}
      has-kubernetes: ${{ steps.filter.outputs.has-kubernetes }}
    steps:
      - name: Checkout deploy-actions
        uses: actions/checkout@v4

      - name: Checkout source repository
        uses: actions/checkout@v4
        with:
          repository: ${{ inputs.repository }}
          token: ${{ secrets.github-token }}
          path: source-repo

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.4'
          bundler-cache: true
          working-directory: scripts

      - name: Copy configuration
        run: |
          cp source-repo/${{ inputs.config-path }} scripts/shared/workflow-config.yaml

      - name: Extract deployment targets
        id: extract
        working-directory: scripts
        run: |
          if [ "${{ inputs.event-type }}" = "pull_request" ]; then
            bundle exec ruby deploy-trigger/bin/trigger from_pr ${{ inputs.pr-number }}
          else
            # Push event - use merged PR number from prepare job
            bundle exec ruby deploy-trigger/bin/trigger from_pr ${{ inputs.pr-number }}
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.github-token }}
          GITHUB_REPOSITORY: ${{ inputs.repository }}

      - name: Filter targets by stack
        id: filter
        run: |
          # Parse DEPLOYMENT_TARGETS and filter by stack
          echo "terragrunt-targets=${TERRAGRUNT_TARGETS:-[]}" >> $GITHUB_OUTPUT
          echo "kubernetes-targets=${KUBERNETES_TARGETS:-[]}" >> $GITHUB_OUTPUT
          echo "has-terragrunt=${HAS_TERRAGRUNT:-false}" >> $GITHUB_OUTPUT
          echo "has-kubernetes=${HAS_KUBERNETES:-false}" >> $GITHUB_OUTPUT
        env:
          DEPLOYMENT_TARGETS: ${{ steps.extract.outputs.targets }}
```

## 📊 進捗管理

### 現在のステータス
**Phase**: 調査・計画完了
**次のアクション**: Phase 1.1 deploy-actions リポジトリ初期化

### TODO進捗
- ✅ monorepo/.github 構造調査
- ✅ 各スクリプトの役割理解
- ✅ パス依存関係分析
- ✅ 設定ファイル・ワークフロー調査
- ✅ 移行計画作成・ドキュメント化
- 🔄 移行実行（準備中）

### 完了した調査項目
1. **ディレクトリ構造**: `.github/scripts`, `.github/workflows`, `.github/actions` の全体把握
2. **スクリプト機能**: label-dispatcher, deploy-trigger, config-manager の詳細理解
3. **依存関係**: `shared/shared_loader.rb`, `workflow-config.yaml`, Ruby Gemfile の分析
4. **ワークフロー統合**: 既存の GitHub Actions との連携パターン理解
5. **セキュリティ設計**: Token管理とPR情報の受け渡し方法の設計

## 🚨 注意事項・リスク

### 技術的注意点
1. **設定ファイルパス**: `shared/workflow-config.yaml` → `.github/config/workflow-config.yaml` への変更が必要
2. **相対パス**: deploy-actions での require_relative パス調整が必要
3. **GitHub Token 権限**: 適切な permissions 設定が重要
4. **バージョン管理**: deploy-actions のタグ戦略を決定する必要

### 移行リスク
1. **ダウンタイム**: 破壊的変更のため、移行中は一時的にワークフローが停止
2. **設定漏れ**: workflow-config.yaml の参照パス変更による設定読み込みエラー
3. **権限不足**: 新しいワークフローでの適切な権限設定が必要
4. **依存関係**: Ruby gem の互換性問題の可能性

### 対策
- 各Phaseで動作確認を実施
- 設定ファイルの存在確認を各ワークフローに組み込み
- 権限設定のテストを別ブランチで実施
- bundle install の動作確認を移行初期に実施

## 📞 継続作業のための情報

### リポジトリ情報
- **メインリポジトリ**: `/Users/takanokenichi/GitHub/panicboat/monorepo`
- **移行先**: `deploy-actions` (初期化待ち)
- **organization**: 要確認・設定

### 重要なファイルパス
- **スクリプト本体**: `monorepo/.github/scripts/`
- **設定ファイル**: `monorepo/.github/scripts/shared/workflow-config.yaml`
- **ワークフロー**: `monorepo/.github/workflows/auto-label--*.yaml`
- **カスタムアクション**: `monorepo/.github/actions/`

### 実行環境
- **Ruby**: 3.4
- **依存関係管理**: bundler
- **実行環境**: GitHub Actions (ubuntu-latest)
- **権限**: GitHub App Token による認証

### コマンド例
```bash
# 現在のスクリプトテスト
cd monorepo/.github/scripts
bundle exec ruby label-dispatcher/bin/dispatcher test
bundle exec ruby deploy-trigger/bin/trigger test develop
bundle exec ruby config-manager/bin/config-manager validate

# 設定確認
bundle exec ruby config-manager/bin/config-manager show
bundle exec ruby config-manager/bin/config-manager diagnostics
```

## 📚 参考情報

### GitHub Actions Reusable Workflows
- [GitHub Docs: Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [GitHub Docs: Using secrets in reusable workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows#using-secrets)

### セキュリティベストプラクティス
- [GitHub Docs: Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [GitHub Docs: Using OpenID Connect with reusable workflows](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/using-openid-connect-with-reusable-workflows)

---

**このドキュメントは移行作業の進捗に応じて更新してください。**

**最終更新**: 2025-07-06
**更新者**: Claude Code
**次回更新予定**: Phase 1完了時
