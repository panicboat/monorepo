# Proposal: Fix Workflow Config & Add Dockerfiles

## Why
現在、`workflow-config.yaml` の定義（ディレクトリ指定）が実際のファイル構成と一致していないため、CI/CD パイプラインでのビルドが失敗しています。
また、`web/heaven` (Frontend) には `Dockerfile` が存在せず、コンテナビルドが不可能な状態です。

これらを修正し、正しいディレクトリ構成とビルド可能な状態を提供する必要があります。

## What Changes
ユーザーの意図（`services/docs` と同様の構成：k8s/terragrunt等とアプリコードを分離）に合わせ、アプリケーションコードを `docker` ディレクトリ（`workflow-config.yaml` の stack 名 `docker` に対応）に移動します。
また、既存の参照実装である `services/docs` もこのルールに合わせてリネームします。

1.  **`services/monolith` の構造変更**:
    - アプリケーションコード（`app`, `config`, `lib`, `slices`, `Gemfile` 等）を全て `services/monolith/docker` に移動します。
    - `Dockerfile` も `docker` ディレクトリ直下に配置します。
    - `docker-compose.yaml` も `docker` ディレクトリ内に移動し、パスを調整します。

2.  **`web/heaven` の構造変更**:
    - Turborepo ワークスペース全体（`apps`, `packages`, `package.json` 等）を `web/heaven/docker` に移動します。
    - `web/heaven/docker/Dockerfile` を作成します。
    - `web/heaven/docker/docker-compose.yaml` を作成します。

3.  **`services/docs` の構造変更**:
    - 既存の `src` ディレクトリを `docker` にリネームします。

4.  **`workflow-config.yaml` の確認**:
    - ユーザーにより既に `directory: docker` に変更されています。このディレクトリ構成に合わせる実装を行います。

## Application Directory Structure
インフラ設定とアプリケーションコード（Dockerビルドコンテキスト）を物理的に分離します。

```text
services/monolith/
├── kubernetes/
├── terragrunt/
└── docker/ (Hanami App Root)
    ├── app/
    ├── config/
    ├── Gemfile
    └── ...

web/heaven/
├── kubernetes/
├── terragrunt/
└── docker/ (Turborepo Root)
    ├── apps/
    ├── packages/
    ├── package.json
    └── ...
```
