# Monorepo

[🇺🇸 English](README.md) | **日本語**

## 📖 Overview

## 📂 Structure

```
.
├── .github/            # GitHub Actions Workflows
├── clusters/           # Flux CD Cluster definitions
├── openspec/           # OpenAPI specifications
├── proto/              # Protocol Buffers definitions
├── services/           # Microservices source code & manifests
│   └── {service}/      # Service Name
│       ├── workspace/  # Application Source Code
│       ├── kubernetes/ # Kubernetes Manifests (Base/Overlays)
│       └── terragrunt/ # Terraform & Terragrunt configurations
├── templates/          # Kubernetes templates
└── web/                # Frontend source code & manifests
    └── {service}/      # Service Name
        ├── workspace/  # Application Source Code
        ├── kubernetes/ # Kubernetes Manifests (Base/Overlays)
        └── terragrunt/ # Terraform & Terragrunt configurations
```
## 🛠 Prerequisites

- https://github.com/panicboat/platform/tree/main/kubernetes

## 🚀 Getting Started

`/etc/hosts` に以下を設定

```bash
127.0.0.1 nginx.local
127.0.0.1 nyx.local
127.0.0.1 docs.local
```

### 🔧 Local Development

Flux による自動同期を停止して、ローカルのマニフェストを直接適用するには以下の手順を実行します。

まずは対象の Kustomization を停止します：

```bash
flux suspend kustomization monolith reverse-proxy nyx -n flux-system
```

次にローカルの変更を適用します：

```bash
# Monolith
kubectl apply -k services/monolith/kubernetes/overlays/develop

# Reverse Proxy
kubectl apply -k services/reverse-proxy/kubernetes/overlays/develop

# Nyx
kubectl apply -k web/nyx/kubernetes/overlays/develop
```

Flux による同期を再開（ローカルの変更は破棄されます）するには：

```bash
flux resume kustomization monolith reverse-proxy nyx -n flux-system
```

## 🏗 Architecture

```mermaid
graph LR
  User[User - Browser] -- "1. External IP<br>LoadBalancer" --> NginxLB[Cloud Load Balancer]
  NginxLB -- "2. Port 80<br>TargetGroupBinding" --> NginxPod[Nginx Pod<br>Reverse Proxy]

  subgraph "Kubernetes Cluster"
    NginxPod -- "3. http://cilium-gateway<br>Internal" --> CiliumGw[Cilium Gateway]
    CiliumGw -- "4. HTTPRoute<br>Host: nginx.local" --> AppPod[App Pod<br>services/nginx]
    CiliumGw -- "4. HTTPRoute<br>Host: nyx.local" --> NyxPod[Nyx Pod<br>web/nyx]
    NyxPod -- "5. gRPC<br>Host: monolith.local" --> MonolithPod[Monolith Pod<br>services/monolith]
  end
```

## 📝 Contribution Guide
