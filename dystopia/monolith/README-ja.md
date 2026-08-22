# Monolith

[🇺🇸 English](README.md) | **日本語**

## 💡 Role

Hanami 2.x で構築された **Modular Monolith** アーキテクチャのバックエンドサービス。

## 🔗 Architecture / Dependencies

### Slice Structure

Hanami の **Slices** 機能を使用してドメインを分離:

```
slices/
├── {domain}/
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

### Slice Communication Pattern

スライス間通信には **Anti-Corruption Layer (ACL)** パターンを使用:

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

### Authentication

共通の認証ロジックは `lib/grpc/authenticatable.rb` で提供:

```ruby
include Grpc::Authenticatable

def some_rpc_method
  authenticate_user!  # 未ログインの場合 UNAUTHENTICATED を raise
  # ...
end
```

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `JWT_SECRET` | JWT 署名用シークレット | `pan1cb0at` | No |
| `DATABASE_URL` | PostgreSQL 接続 URL | - | Yes |

## 🚀 Running Locally

```bash
bundle install
bundle exec hanami server
```
