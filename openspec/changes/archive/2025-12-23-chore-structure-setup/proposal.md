# Proposal: Setup Modular Monolith Directory Structure

## Metadata
- **Change ID:** `chore-structure-setup`
- **Created:** 2025-12-23
- **Status:** Draft

## Objective
モジュラーモノリス移行の第一歩として、アプリケーションとサービスの「入れ物」となるディレクトリ構造を整備する。
具体的なサービスやアプリの実装は行わず、ビルド環境と分離のみを目的とする。

## Context
ルートディレクトリの Node.js 依存を排除し、多言語 (Polyglot) なモノレポとして健全な状態を保つため、フロントエンド領域を `web/` に隔離したい。

## Scope
1. **Frontend Isolation:** `web/` ディレクトリを作成し、Node.js ワークスペースのルートとする。
2. **Backend Container:** `services/monolith/` ディレクトリを作成し、モジュラーモノリス形式のバックエンドコードを格納する。
3. **Root Cleanup:** ルートの `package.json` 等を `web/` へ移動、または役割を整理する。

## Out of Scope
- 具体的なサービス (Identity, Portfolio, etc.) の作成。
- 具体的なアプリ (Shell, User App, etc.) の作成。
