# Architecture Overview

## Core Strategy: Modular Monolith

本プロジェクトは **Modular Monolith** アーキテクチャを採用しています。
これは、将来的なマイクロサービス化（Microservices）を見据えつつ、開発初期の複雑性を抑えるための戦略です。

### Why Modular Monolith?

1. **Velocity:** マイクロサービス特有の「分散トランザクション」「ネットワーク遅延」「デプロイの複雑さ」を回避し、機能開発に集中する。
2. **Boundary:** ただし、コードベース内部では明確にドメイン境界（Boundary）を定義し、将来的な切り出し（Slice）を容易にする。
3. **Type Safety:** フロントエンドとバックエンド間で型安全性（Type Safety）を担保するため、gRPC/ConnectRPC を採用する。

詳細な設計思想については [分散システム設計/MICROSERVICE.md](分散システム設計/MICROSERVICE.md) を参照してください。

---

## Technical Stack

| Category | Technology | Description |
| --- | --- | --- |
| **Backend** | **Hanami (Ruby)** | Modular Monolith構成を強力にサポートするRubyアプリケーションフレームワーク。 |
| **Frontend** | **Next.js (App Router)** | Server Componentsを活用したモダンなフロントエンド。 |
| **Communication** | **ConnectRPC** | ブラウザ・サーバー間でgRPCプロトコルを扱うためのライブラリ。 |
| **Database** | **PostgreSQL** | リレーショナルデータベース。スキーマはHanami側で管理。 |
| **Infrastructure** | **Kubernetes** | コンテナオーケストレーション。ローカル開発は `k3d`。 |

---

## Domain Architecture

各ドメインの責務、データベーステーブル、実装パスの詳細は **[domains/](./domains/README.md)** を参照してください。

| Domain | Backend | Frontend |
|--------|---------|----------|
| Identity | `slices/identity/` | `modules/identity/` |
| Portfolio | `slices/portfolio/` | `modules/portfolio/` |
| Concierge | `slices/concierge/` | `modules/concierge/` |
| Ritual | `slices/ritual/` | `modules/ritual/` |
| Trust | `slices/trust/` | `modules/trust/` |
| Social | `slices/social/` | `modules/social/` |

---

## Service Documentation

各サービスの詳細なアーキテクチャは個別の README を参照してください：

- **Backend:** [services/monolith/README.md](../../../monolith/README.md)
- **Frontend:** [web/nyx/README.md](../../../../web/nyx/README.md)
