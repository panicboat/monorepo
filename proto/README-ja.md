# Protocol Buffers Definitions

[🇺🇸 English](README.md) | **日本語**

## Overview

このディレクトリはリポジトリ全体の共通 Protocol Buffers (`.proto`) 定義を管理します。サービス間で共有されるAPIやデータ構造はここで定義してください。

## Development Workflow

1.  **編集**: このディレクトリ内の `.proto` ファイルを編集・追加します。
2.  **Lint**: 定義がルールに従っているか確認します。
    ```bash
    buf lint
    ```
3.  **互換性チェック**: mainブランチと比較して、後方互換性が壊れていないか確認します。
    ```bash
    buf breaking --against "../.git#branch=main,subdir=proto"
    ```
4.  **生成**: 反映させたいサービスの生成コマンドを実行します。

## Code Generation

コード生成の設定と実行は、**各サービスのワークスペース内で分散管理**されています。

## Tools

*   **Buf**: Lint実行や内部的なコード生成処理に使用します。
    *   インストール: `brew install buf`
