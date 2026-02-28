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

## Service Documentation

各サービスの詳細なアーキテクチャは個別の README を参照してください：

- **Backend:** [services/monolith/README.md](../../../monolith/README.md)
- **Frontend:** [web/nyx/README.md](../../../../web/nyx/README.md)

---

## Coding Patterns

### Backend Patterns

#### Cursor-based Pagination

すべてのリスト取得 API は Cursor ベースのページネーションを使用します。

```ruby
require "concerns/cursor_pagination"

class ListPosts
  include Concerns::CursorPagination

  MAX_LIMIT = 50

  def call(limit: DEFAULT_LIMIT, cursor: nil)
    limit = normalize_limit(limit)
    decoded_cursor = decode_cursor(cursor)
    # ... fetch data ...
    next_cursor = encode_cursor(created_at: last.created_at.iso8601, id: last.id)
    { items: items, next_cursor: next_cursor, has_more: has_more }
  end
end
```

#### Adapter Pattern (Cross-Slice Communication)

スライス間の通信は Adapter パターンを使用して隔離します。

```ruby
# slices/social/adapters/cast_adapter.rb
class CastAdapter
  CastInfo = Data.define(:id, :user_id, :name, :image_path)

  def find_by_user_id(user_id)
    cast = portfolio_cast_repository.find_by_user_id(user_id)
    return nil unless cast
    CastInfo.new(id: cast.id, ...)
  end

  private

  def portfolio_cast_repository
    @portfolio_cast_repository ||= Portfolio::Slice["repositories.cast_repository"]
  end
end
```

### Frontend Patterns

#### API Calls

すべての API 呼び出しは `authFetch` を使用します。

```typescript
import { authFetch } from "@/lib/auth/fetch";

const data = await authFetch<ResponseType>("/api/endpoint", {
  method: "POST",
  body: { key: value },
});
```

#### Error Handling

すべての Hook で `throw` パターンを使用します。呼び出し側でキャッチして処理します。

```typescript
try {
  await someAsyncOperation();
} catch (e) {
  console.error("Operation failed:", e);
  throw e; // Re-throw for caller to handle
}
```

#### Hydration

認証状態が必要な処理は `useHydrated` / `useOnHydrated` を使用します。

```typescript
import { useHydrated, useOnHydrated } from "@/lib/hooks";

// Check hydration status
const isHydrated = useHydrated();
if (!isHydrated) return <Loading />;

// Execute after hydration
useOnHydrated(() => {
  fetchUserData();
});
```
