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
├── identity/         # 認証・認可
│   ├── contracts/
│   ├── grpc/
│   ├── presenters/
│   ├── repositories/
│   └── use_cases/
├── portfolio/        # プロフィール管理
│   ├── adapters/     # スライス間通信 (ACL)
│   ├── contracts/
│   ├── grpc/
│   ├── presenters/
│   ├── repositories/
│   └── use_cases/
├── social/           # タイムライン
│   ├── adapters/     # スライス間通信 (ACL)
│   ├── contracts/
│   ├── grpc/
│   ├── presenters/
│   ├── repositories/
│   └── use_cases/
└── ...
lib/                  # Shared Kernel
├── grpc/             # 共通 gRPC ロジック
│   └── authenticatable.rb
└── ...
```

#### Slice Communication Pattern

スライス間の通信には **Anti-Corruption Layer (ACL)** パターンを使用します。

```ruby
# slices/social/adapters/cast_adapter.rb
module Social
  module Adapters
    class CastAdapter
      CastInfo = Data.define(:id, :name, :image_path, :handle)

      def find_by_user_id(user_id)
        cast = portfolio_cast_repository.find_by_user_id(user_id)
        return nil unless cast
        CastInfo.new(id: cast.id, name: cast.name, ...)
      end
    end
  end
end
```

### Frontend: `web/nyx/workspace/src/`

Next.js のディレクトリ構造内で、ドメインごとに modules を分割します。

```
src/
├── app/              # Routing & Pages
├── components/       # 共通コンポーネント
│   ├── layout/       # レイアウト (TopNavBar, BottomNavBar 等)
│   │   ├── cast/
│   │   └── guest/
│   ├── shared/       # クロスドメイン共有
│   ├── ui/           # プリミティブ UI
│   └── providers/    # グローバル Provider
├── modules/          # ドメイン固有モジュール (6ドメイン)
│   ├── identity/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── portfolio/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types.ts
│   ├── social/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types.ts
│   ├── concierge/
│   ├── ritual/
│   └── trust/
├── stores/           # Zustand グローバルストア
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── socialStore.ts
├── lib/              # ユーティリティ
│   └── auth/         # トークン管理
│       ├── tokens.ts
│       ├── migration.ts
│       └── index.ts
└── config/
    └── theme.ts      # デザイントークン参照
```

---

## State Management

フロントエンドは以下の状態管理パターンを採用しています。

| 状態タイプ | ツール | 用途 |
|-----------|--------|------|
| **グローバル状態** | Zustand | 認証、UI状態、ローカル永続化 |
| **サーバー状態** | SWR | リモートデータ取得、キャッシュ |
| **フォーム状態** | useState / React Hook Form | ローカルコンポーネント内 |

### Zustand Stores

- `stores/authStore.ts` - 認証トークン管理（persist ミドルウェア）
- `stores/uiStore.ts` - モーダル、サイドバー状態
- `stores/socialStore.ts` - フォロー、お気に入り（persist ミドルウェア）

---

## Design Tokens

デザイントークンは CSS カスタムプロパティと Tailwind `@theme inline` を使用して定義されています。

### Token Categories

| カテゴリ | トークン例 | 用途 |
|----------|-----------|------|
| Brand | `--color-brand-primary` | プライマリカラー (Guest: pink, Cast: blue) |
| Semantic | `--color-surface`, `--color-border` | 背景、ボーダー |
| Status | `--color-success`, `--color-error` | 成功、エラー状態 |
| Role | `--color-role-guest`, `--color-role-cast` | ロール別カラー |

### Usage

```tsx
// CSS クラス (Tailwind)
<button className="bg-brand hover:bg-brand-hover">Click</button>

// TypeScript 参照
import { colors } from '@/config/theme';
<div style={{ color: colors.brand.primary }}>...</div>
```
