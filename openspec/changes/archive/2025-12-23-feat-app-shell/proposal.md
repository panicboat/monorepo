# Proposal: App Shell & MSW (Frontend)

## Metadata
- **Change ID:** `feat-app-shell`
- **Created:** 2025-12-23
- **Status:** Draft

## Objective
フロントエンドのホストアプリケーションとなる「App Shell」を構築し、バックエンド開発と並行して UI 開発を進めるための MSW (Mock Service Worker) 環境をセットアップする。

## Context
Step 1 で `web/` ワークスペースが用意され、Step 2 でバックエンドの認証 API (`identity.proto`) が定義された。
これらを利用して、ユーザーが最初にアクセスする Web アプリケーションの基盤を作成する。

## Scope
1. **App Creation:** `web/apps/shell` に Next.js アプリケーションを作成する。
2. **UI Library:** `web/packages/ui` を作成し、共通デザインコンポーネント (Button, Layout等) を `demo` から移植・整理する。
3. **MSW Setup:** ブラウザおよびサーバーサイド (Next.js) で動作する MSW 環境を構築する。
4. **Mock Implementation:** Step 2 で定義した `IdentityService` のモックハンドラを実装する。

## Out of Scope
- `user-app` や `cast-app` などの子アプリケーション（これらは後のステップで追加）。
- 本物のバックエンドサーバーへの接続（現段階では全てモックで動作させる）。
