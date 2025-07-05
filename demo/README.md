# Modern Microservices Monorepo Demo

**現代のデファクトスタンダードなマイクロサービスアーキテクチャを学習するためのデモプロジェクト**

このプロジェクトは、2024年現在の業界標準技術を組み合わせて、実際のプロダクション環境で使用されているアーキテクチャパターンを学習できるように設計されています。

## 🏗️ アーキテクチャ概要

### デファクトスタンダード技術スタック

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Module Federation - Netflix OSS Pattern)         │
├─────────────────────────────────────────────────────────────┤
│ Shell App (Host) ← User App (Remote) + Product + Order     │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│ API Gateway (gRPC-Gateway - Google Pattern)                │
└─────────────────────────────────────────────────────────────┘
                              ↓ gRPC
┌─────────────────────────────────────────────────────────────┐
│ Microservices (Domain-Driven Design)                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│ User Service    │ Product Service │ Order Service           │
│ (Go + gRPC)     │ (Ruby + gRPC)   │ (TypeScript + gRPC)     │
│ PostgreSQL      │ PostgreSQL      │ PostgreSQL              │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 現代の業界標準パターン

| パターン | 技術 | 採用企業例 |
|---------|------|-----------|
| **Monorepo** | Buf + Go Workspaces | Google, Meta, Netflix |
| **Micro Frontends** | Module Federation | Spotify, Ikea, Microsoft |
| **API Gateway** | gRPC-Gateway | Uber, Lyft, CoreOS |
| **Service Mesh Ready** | gRPC + Protocol Buffers | Google, Netflix, Dropbox |
| **Database per Service** | PostgreSQL独立DB | Amazon, Netflix, Uber |

## 📁 Monorepo構造 (業界標準)

```
demo/
├── 🎯 apps/                          # デプロイ可能アプリケーション
│   └── web/                          # Webアプリケーション群
│       ├── shell/                    # Module Federation Host
│       ├── user-portal/              # User管理マイクロフロントエンド
│       ├── product-catalog/          # 商品管理マイクロフロントエンド
│       └── order-management/         # 注文管理マイクロフロントエンド
├── 🚀 services/                      # マイクロサービス
│   ├── user-service/                 # Go + gRPC + PostgreSQL
│   ├── product-service/              # Ruby + gRPC + PostgreSQL
│   ├── order-service/                # TypeScript + gRPC + PostgreSQL
│   └── api-gateway/                  # Go + gRPC-Gateway
├── 📦 packages/                      # 共有ライブラリ (将来拡張用)
│   ├── shared-ui/                    # React共有コンポーネント
│   ├── shared-types/                 # TypeScript型定義
│   └── shared-config/                # 設定ファイル共有
├── 🔌 proto/                         # Protocol Buffers (中央集約)
│   ├── user/v1/user.proto           # User Service API定義
│   ├── product/v1/product.proto     # Product Service API定義
│   └── order/v1/order.proto         # Order Service API定義
├── 🏭 gen/                          # 自動生成コード (Git管理対象)
│   ├── go/                          # Go生成コード
│   ├── typescript/                  # TypeScript生成コード
│   └── ruby/                        # Ruby生成コード
├── 🏗️ infrastructure/               # インフラストラクチャ
│   ├── database/                    # DB初期化スクリプト
│   ├── docker/                      # Docker設定
│   └── nginx/                       # リバースプロキシ設定
├── 🛠️ tools/                        # 開発ツール・スクリプト
├── 📚 docs/                         # ドキュメント
├── ⚙️ go.work                       # Go Workspace (依存関係管理)
├── 🔧 buf.yaml                      # Protocol Buffers プロジェクト設定
├── 🏭 buf.gen.yaml                  # コード生成設定
├── 🔨 Makefile                      # タスクランナー
└── 🐳 docker-compose.yml           # 開発環境
```

## 🎯 学習できるアーキテクチャパターン

### 1. 🏢 Monorepo Management
- **Go Workspaces**: 複数Goモジュールの統合管理
- **Buf Protocol Buffers**: 型安全なAPI仕様管理
- **Central Code Generation**: 一元化されたコード生成

### 2. 🌐 Micro Frontends (Netflix Pattern)
- **Module Federation**: Webpack 5のランタイム統合
- **独立デプロイ**: 各フロントエンドの独立開発・デプロイ
- **共有ライブラリ**: packages/での共通コンポーネント管理

### 3. 🚪 API Gateway Pattern
- **gRPC-Gateway**: HTTP/REST → gRPC変換
- **Protocol Buffers**: 言語非依存なAPI定義
- **統一エントリーポイント**: 単一APIエンドポイント

### 4. 🔧 Microservices Best Practices
- **Database per Service**: 各サービス独立DB
- **Language Diversity**: Go/Ruby/TypeScript polyglot
- **gRPC Communication**: 高性能サービス間通信

## 🚀 クイックスタート

### 前提条件
```bash
# 必要ツール
go 1.21+      # Go Workspaces
node 18+      # Frontend
docker        # 開発環境
buf           # Protocol Buffers (オプション)
```

### 1. 環境初期化
```bash
# 依存関係インストール & Go Workspace初期化
make init
```

### 2. Protocol Buffers コード生成 (オプション)
```bash
# buf CLIがある場合のみ
make proto-generate
```

### 3. 全サービス起動
```bash
# Docker Composeで全サービス起動
make dev
```

### 4. 動作確認
```bash
# サービス状態確認
make status

# アクセス先
echo "🌐 Shell App (Module Federation Host): http://localhost:3000"
echo "👤 User Portal:                        http://localhost:3001"  
echo "🛍️ Product Catalog:                   http://localhost:3002"
echo "📋 Order Management:                   http://localhost:3003"
echo "🔗 API Gateway:                       http://localhost:8080"
echo "📊 Users API:                         http://localhost:8080/api/v1/users"
```

## 🔧 核心技術の詳細

### Go Workspace (go.work)
```go
go 1.24.4

use (
    ./services/api-gateway    # gRPC Gateway
    ./services/user-service   # User Microservice
)
```
- **役割**: 複数Goモジュールの依存関係を自動解決
- **メリット**: `replace`ディレクティブ不要でローカル開発

### Protocol Buffers Central Management
```yaml
# buf.yaml - プロジェクト設定
version: v2
modules:
  - path: proto
    name: buf.build/panicboat/monorepo-demo
lint:
  use: [STANDARD]
breaking:
  use: [FILE]
```

```yaml
# buf.gen.yaml - コード生成設定
plugins:
  - remote: buf.build/protocolbuffers/go:v1.31.0
    out: gen/go
  - remote: buf.build/grpc/go:v1.3.0  
    out: gen/go
  - remote: buf.build/grpc-ecosystem/gateway:v2.18.0
    out: gen/go
```

### Module Federation Configuration
```javascript
// apps/web/shell/webpack.config.js - Host
new ModuleFederationPlugin({
  name: "shell",
  remotes: {
    userApp: "userApp@http://localhost:3001/remoteEntry.js",
    productApp: "productApp@http://localhost:3002/remoteEntry.js",
    orderApp: "orderApp@http://localhost:3003/remoteEntry.js",
  },
})

// apps/web/user-portal/webpack.config.js - Remote
new ModuleFederationPlugin({
  name: "userApp", 
  filename: "remoteEntry.js",
  exposes: {
    "./App": "./src/App",
    "./UserList": "./src/components/UserList",
  },
})
```

## 📊 サービス仕様

| サービス | 技術スタック | ポート | データベース | 責任範囲 |
|---------|-------------|--------|------------|----------|
| **User Service** | Go + gRPC | 50051 | PostgreSQL (独立) | ユーザー管理・認証 |
| **Product Service** | Ruby + gRPC | 50052 | PostgreSQL (独立) | 商品管理・在庫 |
| **Order Service** | TypeScript + gRPC | 50053 | PostgreSQL (独立) | 注文管理・決済 |
| **API Gateway** | Go + gRPC-Gateway | 8080 | - | HTTP→gRPC変換 |
| **Shell App** | React + Module Federation | 3000 | - | フロントエンド統合 |
| **User Portal** | React + Module Federation | 3001 | - | ユーザー管理UI |
| **Product Catalog** | React + Module Federation | 3002 | - | 商品管理UI |
| **Order Management** | React + Module Federation | 3003 | - | 注文管理UI |

## 🛠️ 開発ワークフロー

### Protocol Buffers 変更時
```bash
# 1. .protoファイル編集
vim proto/user/v1/user.proto

# 2. Lint & フォーマット
make proto-lint
make proto-format

# 3. コード生成
make proto-generate

# 4. サービス実装
# gen/go/ 以下の生成コードを各サービスで使用
```

### サービス開発
```bash
# 個別サービス起動 (開発用)
make user-service        # User Service のみ
make api-gateway         # API Gateway のみ
make frontend-shell      # Shell App のみ

# テスト実行
make test               # 全サービステスト
make lint               # 全サービスLint

# ビルド
make build              # 本番ビルド
```

### Database管理
```bash
# DB接続
make db-shell-user      # User DB接続
make db-shell-product   # Product DB接続
make db-shell-order     # Order DB接続

# DBリセット
make db-reset           # 全DB初期化
```

## 🎓 学習ポイント

### 1. Monorepo Best Practices
- ✅ **統一されたツール管理**: 単一Makefile、統一CI/CD
- ✅ **コード共有**: packages/での共通ライブラリ
- ✅ **型安全**: Protocol Buffersによるサービス間通信

### 2. Microservices Patterns  
- ✅ **Database per Service**: 各サービス独立データストア
- ✅ **API Gateway**: 統一エントリーポイント
- ✅ **Service Discovery**: Docker Composeによるサービス発見

### 3. Modern Frontend Architecture
- ✅ **Micro Frontends**: 独立開発・デプロイ可能なフロントエンド
- ✅ **Module Federation**: ランタイム統合
- ✅ **Shared Libraries**: 共通コンポーネントの効率的管理

### 4. DevOps & Tooling
- ✅ **Container-First**: Docker/Kubernetes対応
- ✅ **Infrastructure as Code**: 宣言的インフラ管理
- ✅ **Developer Experience**: ワンコマンド起動・テスト

## 🔍 実際のプロダクション適用例

### Netflix
- **Micro Frontends**: Module Federationの発明元
- **Monorepo**: 数千のマイクロサービスを単一リポジトリ管理

### Google  
- **Protocol Buffers**: gRPCとPbの発明元
- **Monorepo**: 数百万行のコードを単一リポジトリ管理

### Uber
- **API Gateway**: gRPC-Gatewayを大規模運用
- **Microservices**: 数千のサービスをgRPCで接続

## 📈 次のステップ・拡張案

### Level 1: 基本理解
- [ ] 各サービスの起動・停止
- [ ] Protocol Buffers編集とコード生成
- [ ] Module Federationの動作確認

### Level 2: 実装体験
- [ ] 新しいAPIエンドポイント追加
- [ ] 新しいマイクロフロントエンド作成
- [ ] サービス間通信の実装

### Level 3: プロダクション対応
- [ ] Kubernetes対応 (Helm Charts)
- [ ] Observability追加 (OpenTelemetry)
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Security強化 (mTLS, RBAC)

### Level 4: スケーリング
- [ ] Service Mesh導入 (Istio)
- [ ] Event-Driven Architecture (Kafka)
- [ ] CQRS/Event Sourcing
- [ ] Multi-region deployment

## 🤝 貢献・学習サポート

このプロジェクトは学習目的で設計されています：

- **Issue**: 疑問点・改善提案
- **PR**: 新機能・改良の提案
- **Discussion**: アーキテクチャ議論

## 📚 参考資料

### Books
- 「Building Microservices (2nd Edition)」- Sam Newman
- 「Microservices Patterns」- Chris Richardson  
- 「Monolith to Microservices」- Sam Newman

### Official Docs
- [Protocol Buffers](https://protobuf.dev/)
- [gRPC](https://grpc.io/)
- [Module Federation](https://webpack.js.org/concepts/module-federation/)
- [Go Workspaces](https://go.dev/doc/tutorial/workspaces)

### Industry Examples
- [Netflix Tech Blog](https://netflixtechblog.com/)
- [Uber Engineering](https://eng.uber.com/)
- [Google Cloud Architecture](https://cloud.google.com/architecture)

---

**🎯 このプロジェクトで、現代のマイクロサービス開発のデファクトスタンダードを実践的に学習できます！**