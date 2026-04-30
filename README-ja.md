# Monorepo

[🇺🇸 English](README.md) | **日本語**

## 📖 Overview

## 📂 Structure

```
.
├── .github/            # GitHub Actions Workflows
├── clusters/           # Flux CD Cluster definitions
├── proto/              # Protocol Buffers definitions
├── services/           # Services source code & manifests
│   └── {service}/      # Service Name
│       ├── workspace/  # Application Source Code
│       ├── kubernetes/ # Kubernetes Manifests (Base/Overlays)
│       └── terragrunt/ # Terraform & Terragrunt configurations
├── templates/          # Kubernetes templates
└── tests/              # Tests
    └── e2e/            # End-to-End tests
```
## 🛠 Prerequisites

- https://github.com/panicboat/platform/tree/main/kubernetes

## 🚀 Getting Started

`/etc/hosts` に以下を設定

```bash
127.0.0.1 nginx.local
127.0.0.1 frontend.local
127.0.0.1 handbooks.local
```

### 🔧 Local Development

Flux による自動同期を停止して、ローカルのマニフェストを直接適用するには以下の手順を実行します。

まずは対象の Kustomization を停止します：

```bash
flux suspend kustomization monolith reverse-proxy frontend -n flux-system
```

次にローカルの変更を適用します：

```bash
# Monolith
kubectl apply -k services/monolith/kubernetes/overlays/develop

# Reverse Proxy
kubectl apply -k services/reverse-proxy/kubernetes/overlays/develop

# Frontend
kubectl apply -k services/frontend/kubernetes/overlays/develop
```

Flux による同期を再開（ローカルの変更は破棄されます）するには：

```bash
flux resume kustomization monolith reverse-proxy frontend -n flux-system
```

## 🏗 Architecture

```mermaid
graph LR
  User[User - Browser] -- "1. External IP<br>LoadBalancer" --> NginxLB[Cloud Load Balancer]
  NginxLB -- "2. Port 80<br>TargetGroupBinding" --> NginxPod[Nginx Pod<br>Reverse Proxy]

  subgraph "Kubernetes Cluster"
    NginxPod -- "3. http://cilium-gateway<br>Internal" --> CiliumGw[Cilium Gateway]
    CiliumGw -- "4. HTTPRoute<br>Host: nginx.local" --> AppPod[App Pod<br>services/nginx]
    CiliumGw -- "4. HTTPRoute<br>Host: frontend.local" --> FrontendPod[Frontend Pod<br>services/frontend]
    FrontendPod -- "5. gRPC<br>Host: monolith.local" --> MonolithPod[Monolith Pod<br>services/monolith]
  end
```

## 🚢 Deployment

### Trigger

- PR ラベルまたは `main` への push で `.github/workflows/auto-label--deploy-trigger.yaml` が起動する。
- `panicboat/deploy-actions/label-resolver` が `workflow-config.yaml` を参照してデプロイ対象を解決する。

### Stacks

| Stack | Path Convention | Tooling |
|-------|-----------------|---------|
| Container | `services/{service}/workspace` | Docker → GHCR (`ghcr.io/panicboat/monorepo`)、`ubuntu-24.04-arm` でビルド |
| Infrastructure | `services/{service}/terragrunt/envs/{environment}` | Terragrunt (AWS OIDC) |
| Kubernetes | `services/{service}/kubernetes/overlays/{environment}` | Kustomize（Flux CD で reconcile） |

### Environments

`workflow-config.yaml` で定義。現状 `develop` のみ有効で、`staging` / `production` は予約済み（コメントアウト）。

| Environment | AWS Region | AWS Account | Status |
|-------------|------------|-------------|--------|
| develop | ap-northeast-1 | 559744160976 | Active |
| staging | - | - | Reserved |
| production | - | - | Reserved |

### Pipeline Flow

```mermaid
flowchart LR
  Trigger[PR / push main] --> Resolver[label-resolver]
  Resolver -->|stack: docker| Builder[container-builder<br/>ubuntu-24.04-arm]
  Resolver -->|stack: terragrunt| Terragrunt[terragrunt-executor<br/>PR は plan / main は apply]
  Builder --> GHCR[(ghcr.io/panicboat/monorepo)]
  Terragrunt --> AWS[(AWS)]
  GHCR --> Flux[Flux CD]
  Main[Commit on main] --> Flux
  Flux --> K8s[(Kubernetes)]
```

### GitOps Sync (Flux CD)

- Flux の `GitRepository` が本リポジトリの `main` ブランチを監視する。
- `clusters/{environment}/services/{service}/service.yaml` に定義された `Kustomization` が 5 分間隔で `services/{service}/kubernetes/overlays/{environment}` を reconcile する。
- `nginx` のみ `ImageRepository` + `ImagePolicy` + `ImageUpdateAutomation` を併用し、Docker Hub を 30 分間隔でポーリングしてイメージタグを自動更新する。

### Related Repositories

- [panicboat/platform](https://github.com/panicboat/platform) — クラスタの bootstrap、共通コンポーネント、OIDC 用 IAM を提供。
- [panicboat/deploy-actions](https://github.com/panicboat/deploy-actions) — 再利用可能な GitHub Actions (`label-resolver` / `container-builder` / `terragrunt` / `auto-approve`)。

## 📝 Contribution Guide
