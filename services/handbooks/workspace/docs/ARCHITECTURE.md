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

## Code Mapping

### Backend: `services/monolith/workspace/`

Hanami の **Slices** 機能を使用し、ドメインごとにディレクトリを分割します。

```
slices/
├── identity/     # 認証・認可
├── portfolio/    # プロフィール管理
├── social/       # タイムライン
└── ...
lib/
├── shared_services/  # Cross-slice services (DI via providers)
└── ...               # Other shared utilities
```

#### Slice Directory Structure

各スライスは以下の標準構造に従います：

```
slices/{domain}/
├── config/
│   └── providers/      # DI provider definitions
├── contracts/
│   └── {feature}/      # Dry-validation contracts by feature
│       └── *_contract.rb
├── db/
│   ├── relation.rb     # ROM relation base class
│   ├── repo.rb         # ROM repository base class
│   └── struct.rb       # ROM struct base class (MUST exist)
├── grpc/
│   └── handler.rb      # Gruf handler
├── presenters/
│   └── *_presenter.rb  # Proto message presenters
├── relations/
│   └── *.rb            # ROM relations
├── repositories/
│   └── *_repository.rb # ROM repositories
├── structs/            # (Optional) Custom structs
└── use_cases/
    └── {feature}/
        └── *.rb        # Use case implementations
```

**Notes:**
- `db/struct.rb` MUST exist in all slices for ROM struct inheritance
- Contracts are organized by feature under `contracts/`
- Use cases are organized by feature under `use_cases/`
- Cross-slice access MUST go through `lib/shared_services/`

### Frontend: `web/nyx/workspace/src/`

Next.js のディレクトリ構造内で、ドメインごとに modules を分割します。

```
modules/
├── identity/     # 認証 UI
├── portfolio/    # プロフィール UI
├── social/       # タイムライン UI
└── ...
stores/           # Zustand stores
lib/
├── auth/         # Token management
├── api-response.ts
└── ...
config/
└── theme.ts      # Design tokens
app/              # Routing & Pages
```

#### Module Directory Structure

各モジュールは以下の標準構造に従います：

```
modules/{domain}/
├── components/
│   ├── cast/       # Cast向けコンポーネント
│   └── guest/      # Guest向けコンポーネント
├── hooks/          # データフェッチ、状態管理
├── lib/            # マッパー、ユーティリティ
└── types.ts        # ドメイン型定義 (MUST exist)
```

**Notes:**
- `types.ts` MUST exist in all modules for domain type definitions
- Components are separated by user role (cast/guest)
- Hooks use SWR for server data, Zustand for client state
- Design tokens are defined in `config/theme.ts`
