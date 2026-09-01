# Monolith (🌸 Hanami + gRPC)

**English** | [🇯🇵 日本語](README-ja.md)

## 💡 Role

Backend service built with Hanami 2.x using the **Modular Monolith** architecture.

## 🔗 Architecture / Dependencies

Modules:
- **Identity Slice**: Authentication (Register, Login) via gRPC.
- **Portfolio Slice**: Cast profile, plans, schedules management.

### Design Philosophy

本プロジェクトは **Modular Monolith** を採用し、Clean Architecture の思想を部分的に取り入れています。

#### 信念（厳格に守る原則）

| 原則 | 実現方法 |
|------|----------|
| **Slice 間の境界分離** | Identity, Offer, Portfolio, Post, Relationship を独立した Slice として分離 |
| **単一責務 (SRP)** | Use Case ごとにファイル分離（Register, Login, SaveProfile など） |
| **依存性注入 (DI)** | `Deps[]` による Repository・Contract の注入 |
| **型安全性** | gRPC/ConnectRPC + Proto による API 型定義 |
| **将来のマイクロサービス化** | Slice 単位での切り出しを想定した設計 |

#### 妥協（実用性のために緩めている原則）

| Clean Architecture の原則 | 現状 | 理由 |
|---------------------------|------|------|
| Entity 層の独立 | ROM Struct を直接使用 | Hanami/ROM エコシステムとの統合を優先 |
| Repository Interface | Interface 定義なし | Ruby の Duck Typing に依存し、ボイラープレートを削減 |
| 依存性逆転 (DIP) | Use Case が ROM Struct に直接依存 | 変換層のオーバーヘッドを回避 |

#### 設計方針

```
┌─────────────────┐    ┌─────────────────┐
│    Identity     │    │    Portfolio    │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │ Contracts │  │    │  │ Contracts │  │  ← Application Layer (Input)
│  │ Use Cases │  │    │  │ Use Cases │  │  ← Application Layer
│  │ Repos     │  │ ✗  │  │ Repos     │  │  ← Interface Adapters
│  │ Relations │  │────│  │ Relations │  │  ← Infrastructure
│  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘
        ↑                       ↑
        └───────────────────────┘
         Slice 間は疎結合を厳守
         Slice 内は緊密結合を許容
```

- **Vertical Slice Architecture**: 機能（ドメイン）ごとの垂直分割を重視
- **Hanami Way**: 純粋な Clean Architecture より Hanami のエコシステムに従う
- **YAGNI**: 必要になるまで過度な抽象化を避ける

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

### Directory Structure

```
slices/{slice_name}/
├── contracts/       # Application Layer - Input Validation (dry-validation)
│   └── {domain}/
│       └── {action}_contract.rb
├── use_cases/       # Application Layer - Business Logic
│   └── {domain}/
│       └── {action}.rb
├── repositories/    # Interface Adapters - Data Access
│   └── {entity}_repository.rb
├── presenters/      # Interface Adapters - Response Formatting
│   └── {entity}_presenter.rb
├── grpc/            # Interface Adapters - Controllers
│   └── handler.rb
├── relations/       # Infrastructure - ORM (ROM)
│   └── {table}.rb
└── db/              # Infrastructure - Database
    ├── struct.rb
    ├── relation.rb
    └── repo.rb
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
bundle install
bundle exec hanami server
```

### Requirements
- Ruby 3.4+
- PostgreSQL
- Buf (for proto generation)

### Install Dependencies
```bash
bundle install
```

### Database Setup
```bash
# Database listening on 0.0.0.0:5432
docker-compose up -d db
# Update config/app.rb or .env to point to your Postgres
# Default: postgres
bundle exec hanami db drop
bundle exec hanami db create
bundle exec hanami db migrate
bundle exec hanami db seed

# example query
docker-compose exec db psql -U postgres -d monolith -P pager=off -c "set search_path = 'identity'; select * from users";
```

### Bulk Seed Data

For UI/UX testing and demos, you can generate large-scale seed data:

```bash
# Run with bulk seed (adds ~500 users, ~15k posts)
BULK_SEED=true bundle exec hanami db seed

# Or reset and seed with bulk data
bundle exec hanami db reset
BULK_SEED=true bundle exec hanami db seed
```

This generates:
- 100 casts with profiles, plans, schedules
- 400 guests with activity patterns
- ~15,000 posts with hashtags
- ~3,000+ follow relationships
- ~280,000+ likes, ~200,000+ comments
- ~800 reviews

Note: Bulk seed generation takes approximately 20 minutes.

### Run the gRPC server

```bash
# Stop the gRPC server
pkill -f gruf
# gRPC server listening on 0.0.0.0:9001
./bin/grpc
```

## Proto Generation
To update Ruby code from Proto definitions (`proto/**/*.proto`):

```bash
./bin/codegen
# Note: Automatically scans all .proto files in root 'proto' dir
```

## Testing

### Automated Specs
```bash
# From dystopia/monolith directory
bundle exec rspec
```

## Infrastructure

Terragrunt stacks live under `infrastructure/`:

- `infrastructure/aws/production/` — RDS, Cognito Pod Identity, IAM policies (depends on `dystopia/frontend/infrastructure/aws/production` for the Cognito user pool ARN).
- `infrastructure/stripe/production/` — empty scaffold; Stripe Terraform provider and resources land in a follow-up PR.

## Useful links

- [Hanami](http://hanamirb.org)
- [Hanami guides](https://guides.hanamirb.org/)
