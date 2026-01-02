# Change: Add Container Builder Workflow

## Why
現在、デプロイメントパイプラインにおいてコンテナイメージのビルドとプッシュを行う自動化された仕組みが存在しません。
GitOps による継続的デプロイメントを実現するために、GitHub Actions を使用して GitHub Container Registry (GHCR) へイメージをプッシュするワークフローが必要です。

## What Changes
- 再利用可能なコンテナビルドワークフロー (`reusable--container-builder.yaml`) の追加
- デプロイトリガーワークフロー (`auto-label--deploy-trigger.yaml`) への統合
- Docker Buildx のセットアップと GHCR 認証の実装

## Impact
- **Affected Specs:** `ci-cd` (New capability)
- **Affected Code:** `.github/workflows/`
