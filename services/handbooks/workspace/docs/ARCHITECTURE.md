# Architecture Overview

## Core Strategy: Modular Monolith

本プロジェクトは **Modular Monolith** アーキテクチャを採用しています。
これは、将来的なマイクロサービス化（Microservices）を見据えつつ、開発初期の複雑性を抑えるための戦略です。

### Why Modular Monolith?
1.  **Velocity:** マイクロサービス特有の「分散トランザクション」「ネットワーク遅延」「デプロイの複雑さ」を回避し、機能開発に集中する。
2.  **Boundary:** ただし、コードベース内部では明確にドメイン境界（Boundary）を定義し、将来的な切り出し（Slice）を容易にする。
3.  **Type Safety:** フロントエンドとバックエンド間で型安全性（Type Safety）を担保するため、gRPC/ConnectRPC を採用する。

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

## Code Mapping (Implementation Map)

デザインドキュメントで定義された概念（Concept）が、実際のコードベース（Implementation）のどこに存在するかを示します。

> **Note:** ドメイン定義の詳細は [分散システム設計/MICROSERVICE.md](分散システム設計/MICROSERVICE.md) を参照してください。

### Backend Structure: `services/monolith`
Hanamiの **Slices** 機能を使用し、ドメインごとにディレクトリを分割します。

- `slices/identity/` -> **Identity Service** (Auth, Roles)
- `slices/portfolio/` -> **Portfolio Service** (Profile, Search)
- `slices/ritual/` -> **Ritual Service** (Reservation Logic)
- `slices/trust/` -> **Trust Service** (Review, Radar Chart)
- `lib/` -> Shared Kernel (Common Entities)

### Frontend Structure: `web/nyx`
Next.jsのディレクトリ構造内で、ドメインごとにディレクトリを分割します。

- `src/modules/concierge/` -> **Concierge Domain** (Chat UI, Room List)
- `src/modules/portfolio/` -> **Portfolio Domain** (Cast List, Profile Page)
- `src/modules/ritual/` -> **Ritual Domain** (Reservation Modal, Pledge Action)
- `src/modules/trust/` -> **Trust Domain** (Radar Chart, Reviews)
- `src/app/` -> Routing & Pages (Modulesを組み合わせてページを構成)
