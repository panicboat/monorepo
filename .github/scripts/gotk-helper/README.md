# GitOps Toolkit Helper

GitOps Toolkit (GoTK) Helper は、Kubernetes マニフェストの自動生成と GitOps リポジトリへの配布を管理するためのツールです。

## 概要

このツールは以下の機能を提供します：

- Kustomize ビルド結果を GitOps リポジトリへ配置
- フィーチャーブランチの作成と管理
- プルリクエストの自動作成と auto-merge 設定
- 環境とサービス別のラベル管理

## アーキテクチャ

Clean Architecture パターンに従って実装されています：

```
gotk-helper/
├── entities/                    # ドメインエンティティ
│   ├── manifest_update_request.rb
│   └── pull_request_result.rb
├── use_cases/                   # ビジネスロジック
│   ├── update_manifest.rb
│   └── create_pull_request.rb
├── controllers/                 # インターフェース制御
│   └── gotk_helper_controller.rb
├── application.rb               # 依存関係注入
└── bin/gotk-helper             # CLI エントリーポイント
```

## 使用方法

### 基本的な使用例

```bash
# PR からマニフェストの更新と PR 作成
bundle exec bin/gotk-helper update_from_pr 123 \
  --manifest-file=/tmp/generated-manifest.yaml \
  --target-repo=panicboat/generated-manifests \
  --target-branch=develop
```

### 必要な環境変数

- `GITHUB_TOKEN`: GitHub パーソナルアクセストークン
- `GITHUB_REPOSITORY`: ソースリポジトリ名（OWNER/REPO 形式）

### オプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `PR_NUMBER` | プルリクエスト番号（位置引数） | `123` |
| `--manifest-file` | 生成されたマニフェストファイルのパス | `/tmp/manifest.yaml` |
| `--target-repo` | GitOps リポジトリ | `panicboat/generated-manifests` |
| `--target-branch` | 対象ブランチ | `develop` |

## ワークフロー

1. **PR解析**: deploy ラベルからサービス名を抽出（例：`deploy:demo-service`）
2. **環境決定**: ブランチ名から対象環境を決定（例：`develop`）
3. **ターゲット特定**: Kubernetes デプロイメントターゲットをフィルタリング
4. **マニフェスト更新**: 各サービス・環境組み合わせでマニフェスト更新
5. **フィーチャーブランチ作成**: `auto-update/{service}-{environment}-{sha}`
6. **マニフェスト配置**: `{environment}/{service}.yaml`
7. **プルリクエスト作成**: 適切なラベル付きで作成
8. **Auto-merge 有効化**: Squash merge で自動統合

## 出力構造

GitOps リポジトリでは以下の構造でマニフェストが管理されます：

```
generated-manifests/
├── develop/
│   ├── demo-service.yaml
│   └── user-service.yaml
├── staging/
│   ├── demo-service.yaml
│   └── user-service.yaml
└── production/
    ├── demo-service.yaml
    └── user-service.yaml
```

## エラーハンドリング

- 無効なリクエストパラメータの検証
- Git 操作の失敗に対する適切なエラーメッセージ
- GitHub API エラーの処理
- ファイルシステム操作の例外処理

## 依存関係

- Ruby 環境
- Bundler
- Git クライアント
- GitHub CLI または GitHub API アクセス
- 共有コンポーネント（Infrastructure、Presenters）

## テスト・デバッグ

### 基本テスト
```bash
# API呼び出しなしでワークフローをテスト
bundle exec bin/gotk-helper test 123

# カスタムオプションでテスト
bundle exec bin/gotk-helper test 123 \
  --manifest-file=/tmp/custom.yaml \
  --target-repo=my/repo \
  --target-branch=staging
```

### GitHub Actions環境のシミュレーション
```bash
# 実際のPR情報を取得してワークフローをシミュレーション（マニフェスト更新とPR作成はモック）
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY=owner/repo \
bundle exec bin/gotk-helper simulate 123

# カスタムオプションでシミュレーション
bundle exec bin/gotk-helper simulate 123 \
  --manifest-file=/tmp/custom-manifest.yaml \
  --target-repo=my-org/my-gitops-repo \
  --target-branch=staging
```

**simulateの動作**:
- ✅ 実際のPR情報をGitHub APIから取得（失敗時は終了）
- ✅ 実際のdeployラベルと環境を使用  
- 🔄 マニフェスト更新とPR作成はシミュレーション（実際のファイル変更なし）

### 環境設定の確認
```bash
# 環境変数と依存関係の検証
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY=owner/repo \
bundle exec bin/gotk-helper validate_env

# 使用例とTipsの表示
bundle exec bin/gotk-helper help_usage
```

## 拡張性

将来的な機能拡張の準備：

- FluxCD Kustomization リソースの自動生成
- 複数クラスター対応
- カスタム検証ルールの追加
- メトリクス収集機能