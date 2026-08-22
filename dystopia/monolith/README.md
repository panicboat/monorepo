# Monolith

**English** | [🇯🇵 日本語](README-ja.md)

## 💡 Role

Backend service built with Hanami 2.x using the **Modular Monolith** architecture.

## 🔗 Architecture / Dependencies

### Slice Structure

Uses Hanami **Slices** to separate domains:

```
slices/
├── {domain}/
│   ├── adapters/     # Inter-slice communication (ACL)
│   ├── contracts/
│   ├── grpc/
│   ├── presenters/
│   ├── repositories/
│   └── use_cases/
└── ...
lib/                  # Shared Kernel
├── grpc/             # Common gRPC logic
│   └── authenticatable.rb
└── ...
```

### Slice Communication Pattern

Uses **Anti-Corruption Layer (ACL)** pattern for inter-slice communication:

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

Common authentication logic is provided via `lib/grpc/authenticatable.rb`:

```ruby
include Grpc::Authenticatable

def some_rpc_method
  authenticate_user!  # Raises UNAUTHENTICATED if not logged in
  # ...
end
```

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `JWT_SECRET` | JWT signing secret | `pan1cb0at` | No |
| `DATABASE_URL` | PostgreSQL connection URL | - | Yes |

## 🚀 Running Locally

```bash
cd workspace
bundle install
bundle exec hanami server
```
