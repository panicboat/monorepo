.PHONY: help init proto-generate proto-lint proto-format dev build clean status install-tools
.DEFAULT_GOAL := help

help: ## ヘルプ表示
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

init: ## プロジェクト初期化
	@echo "Initializing Multi-language Microservice Demo..."
	@echo "Creating go work for backend services..."
	go work init
	go work use ./services/user-service
	go work use ./services/api-gateway
	@echo "Installing frontend dependencies..."
	cd apps/web/shell && npm install
	cd apps/web/user-portal && npm install
	cd apps/web/product-catalog && npm install
	cd apps/web/order-management && npm install
	@echo "Project initialized successfully!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run 'make proto-generate' to generate protocol buffer code"
	@echo "  2. Run 'make dev' to start all services"
	@echo "  3. Open http://localhost:3000 for the Shell App"
	@echo "  4. Open http://localhost:8080/api/v1/users for the API"

proto-generate: ## Protocol Bufferコード生成
	@echo "Generating protocol buffer code..."
	buf generate
	@echo "Protocol buffer code generated in gen/ directory"

proto-lint: ## Protocol Bufferスキーマ検証
	@echo "Linting protocol buffer schemas..."
	buf lint

proto-format: ## Protocol Bufferフォーマット
	@echo "Formatting protocol buffer files..."
	buf format --write

proto-breaking: ## 破壊的変更検出
	@echo "Checking for breaking changes..."
	buf breaking --against '.git#branch=main'

dev: ## Docker環境で開発開始
	@echo "Starting Multi-language Microservice Demo..."
	@echo "This will start:"
	@echo "  - User Service (Go + gRPC):       localhost:50051"
	@echo "  - Product Service (Ruby + gRPC):  localhost:50052" 
	@echo "  - Order Service (TS + gRPC):      localhost:50053"
	@echo "  - API Gateway (Go):               localhost:8080"
	@echo "  - Frontend Shell (React):         localhost:3000"
	@echo "  - Frontend User (React):          localhost:3001"
	@echo "  - Frontend Product (React):       localhost:3002"
	@echo "  - Frontend Order (React):         localhost:3003"
	@echo ""
	docker compose up --build

dev-detached: ## Docker環境でバックグラウンド起動
	@echo "Starting services in background..."
	docker compose up -d --build

stop: ## Docker環境停止
	@echo "Stopping all services..."
	docker compose down

restart: ## Docker環境再起動
	@echo "Restarting all services..."
	docker compose down
	docker compose up --build

# Individual service commands
user-service: ## User Service個別起動 (Go)
	@echo "Starting User Service (Go + gRPC + PostgreSQL)..."
	cd services/user-service && go run main.go

api-gateway: ## API Gateway個別起動 (Go)
	@echo "Starting API Gateway (Go + HTTP/gRPC)..."
	cd services/api-gateway && go run main.go

frontend-shell: ## Shell App個別起動 (React)
	@echo "Starting Frontend Shell App (React + Module Federation Host)..."
	cd apps/web/shell && npm run dev

frontend-user: ## User App個別起動 (React)
	@echo "Starting Frontend User App (React + Module Federation Remote)..."
	cd apps/web/user-portal && npm run dev

frontend-product: ## Product App個別起動 (React)
	@echo "Starting Frontend Product App (React + Module Federation Remote)..."
	cd apps/web/product-catalog && npm run dev

frontend-order: ## Order App個別起動 (React)
	@echo "Starting Frontend Order App (React + Module Federation Remote)..."
	cd apps/web/order-management && npm run dev

# Build commands
build: ## 本番ビルド
	@echo "Building all services for production..."
	cd services/user-service && go build -o bin/user-service main.go
	cd services/api-gateway && go build -o bin/api-gateway main.go
	cd apps/web/shell && npm run build
	cd apps/web/user-portal && npm run build
	cd apps/web/product-catalog && npm run build
	cd apps/web/order-management && npm run build
	@echo "Build completed!"

# Testing commands
test: ## テスト実行
	@echo "Running tests..."
	cd services/user-service && go test ./...
	cd services/api-gateway && go test ./...
	cd apps/web/shell && npm test --watchAll=false
	cd apps/web/user-portal && npm test --watchAll=false
	cd apps/web/product-catalog && npm test --watchAll=false
	cd apps/web/order-management && npm test --watchAll=false

# Status and health checks
status: ## サービス状態確認
	@echo "Checking service status..."
	@echo "=== Backend Services ==="
	@curl -s -o /dev/null -w "gRPC Gateway:    %{http_code}\n" http://localhost:8080/health || echo "gRPC Gateway:    DOWN"
	@echo "=== Frontend Services ==="
	@curl -s -o /dev/null -w "Frontend Shell:  %{http_code}\n" http://localhost:3000 || echo "Frontend Shell:  DOWN"
	@curl -s -o /dev/null -w "Frontend User:   %{http_code}\n" http://localhost:3001 || echo "Frontend User:   DOWN"
	@curl -s -o /dev/null -w "Frontend Product:%{http_code}\n" http://localhost:3002 || echo "Frontend Product:DOWN"
	@curl -s -o /dev/null -w "Frontend Order:  %{http_code}\n" http://localhost:3003 || echo "Frontend Order:  DOWN"
	@echo "=== API Endpoints ==="
	@curl -s -o /dev/null -w "Users API:       %{http_code}\n" http://localhost:8080/api/v1/users || echo "Users API:       DOWN"

# Database management
db-reset: ## データベースリセット
	@echo "Resetting all databases..."
	docker compose down
	docker volume rm demo_user_postgres_data demo_product_postgres_data demo_order_postgres_data 2>/dev/null || true
	docker compose up -d user-postgres product-postgres order-postgres

db-logs: ## データベースログ表示
	@echo "Showing database logs..."
	docker compose logs -f user-postgres product-postgres order-postgres

db-shell-user: ## User データベースシェル接続
	docker compose exec user-postgres psql -U user_admin -d user_db

db-shell-product: ## Product データベースシェル接続
	docker compose exec product-postgres psql -U product_admin -d product_db

db-shell-order: ## Order データベースシェル接続
	docker compose exec order-postgres psql -U order_admin -d order_db

# Cleanup commands
clean: ## クリーンアップ
	@echo "Cleaning up..."
	docker compose down -v
	docker system prune -f
	rm -rf services/user-service/bin
	rm -rf services/api-gateway/bin
	rm -rf apps/web/shell/dist
	rm -rf apps/web/user-portal/dist
	rm -rf apps/web/product-catalog/dist
	rm -rf apps/web/order-management/dist
	rm -rf gen

# Code quality
format: ## コードフォーマット
	@echo "Formatting code..."
	cd services/user-service && go fmt ./...
	cd services/api-gateway && go fmt ./...
	cd apps/web/shell && npm run format 2>/dev/null || echo "No format script in shell"
	cd apps/web/user-portal && npm run format 2>/dev/null || echo "No format script in user-portal"
	cd apps/web/product-catalog && npm run format 2>/dev/null || echo "No format script in product-catalog"
	cd apps/web/order-management && npm run format 2>/dev/null || echo "No format script in order-management"

lint: ## コードリント
	@echo "Running linters..."
	cd services/user-service && go vet ./...
	cd services/api-gateway && go vet ./...
	cd apps/web/shell && npm run lint 2>/dev/null || echo "No lint script in shell"
	cd apps/web/user-portal && npm run lint 2>/dev/null || echo "No lint script in user-portal"
	cd apps/web/product-catalog && npm run lint 2>/dev/null || echo "No lint script in product-catalog"
	cd apps/web/order-management && npm run lint 2>/dev/null || echo "No lint script in order-management"

# Development tools
install-tools: ## 開発ツールインストール
	@echo "Installing development tools..."
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	@echo "Tools installed successfully!"

# Quick development workflow
quick-start: init dev ## プロジェクト初期化 + 開発開始

demo: ## デモ用クイックスタート
	@echo "=========================================="
	@echo "Multi-language Microservice Demo"
	@echo "=========================================="
	@echo ""
	@echo "Architecture:"
	@echo "  Backend:  User Service (Go) + Product Service (Ruby) + Order Service (TypeScript)"
	@echo "  Gateway:  gRPC Gateway (Go + HTTP/gRPC conversion)"
	@echo "  Frontend: Shell App (React + Module Federation Host)"
	@echo "           User App (React + Module Federation Remote)"
	@echo ""
	@echo "Starting demo environment..."
	@echo ""
	make dev-detached
	@echo ""
	@echo "Waiting for services to start..."
	@sleep 10
	@echo ""
	@echo "Demo URLs:"
	@echo "  🌐 Frontend Shell App:  http://localhost:3000"
	@echo "  👥 Frontend User App:   http://localhost:3001"
	@echo "  🛍️ Frontend Product App: http://localhost:3002"
	@echo "  📋 Frontend Order App:  http://localhost:3003"
	@echo "  🔗 API Gateway:         http://localhost:8080"
	@echo "  📋 Users API:           http://localhost:8080/api/v1/users"
	@echo ""
	@echo "Use 'make status' to check service health"
	@echo "Use 'make stop' to stop all services"

# Protocol Buffers (for future use)

# Check all services
check-all: status test ## 全チェック実行

# Development workflow help
workflow: ## 開発ワークフロー説明
	@echo "Development Workflow:"
	@echo ""
	@echo "1. First time setup:"
	@echo "   make init          # Initialize project"
	@echo ""
	@echo "2. Development:"
	@echo "   make demo          # Quick demo start"
	@echo "   make dev           # Start all services (foreground)"
	@echo "   make dev-detached  # Start all services (background)"
	@echo ""
	@echo "3. Testing:"
	@echo "   make status        # Check service health"
	@echo "   make test          # Run tests"
	@echo ""
	@echo "4. Individual services:"
	@echo "   make user-service       # Start User Service only"
	@echo "   make grpc-gateway       # Start gRPC Gateway only"
	@echo "   make frontend-shell     # Start Shell App only"
	@echo "   make frontend-product   # Start Product App only"
	@echo "   make frontend-order     # Start Order App only"
	@echo ""
	@echo "5. Database management:"
	@echo "   make db-reset      # Reset all databases"
	@echo "   make db-logs       # Show database logs"
	@echo ""
	@echo "6. Cleanup:"
	@echo "   make stop          # Stop services"
	@echo "   make clean         # Full cleanup"