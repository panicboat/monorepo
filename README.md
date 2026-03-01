# Monorepo

**English** | [🇯🇵 日本語](README-ja.md)

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

Add the following to `/etc/hosts`.

```bash
127.0.0.1 nginx.local
127.0.0.1 nyx.local
127.0.0.1 handbooks.local
```

### 🚀 Running Locally

To edit manifests locally without Flux overwriting changes, suspend the Kustomizations:

```bash
flux suspend kustomization monolith reverse-proxy nyx -n flux-system
```

Then apply your local changes:

```bash
# Monolith
kubectl apply -k services/monolith/kubernetes/overlays/develop

# Reverse Proxy
kubectl apply -k services/reverse-proxy/kubernetes/overlays/develop

# Nyx
kubectl apply -k services/nyx/kubernetes/overlays/develop
```

To resume Flux synchronization (discarding local changes):

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
    CiliumGw -- "4. HTTPRoute<br>Host: nyx.local" --> NyxPod[Nyx Pod<br>services/nyx]
    NyxPod -- "5. gRPC<br>Host: monolith.local" --> MonolithPod[Monolith Pod<br>services/monolith]
  end
```

## 📝 Contribution Guide

- [handbook](services/handbooks/workspace/docs)
- [blog](services/handbooks/workspace/blog)
