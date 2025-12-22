# Monorepo

**English** | [🇯🇵 日本語](README-ja.md)

## 📖 Overview

## 📂 Structure

```
.
├── .github/            # GitHub Actions Workflows
├── clusters/           # Flux CD Cluster definitions
├── demo/               # Demo application
├── openspec/           # OpenAPI specifications
├── services/           # Microservices source code & manifests
│   ├── {service}/      # Service Name
│   │   ├── src/        # Application Source Code
│   │   ├── kubernetes/ # Kubernetes Manifests (Base/Overlays)
│   │   └── terragrunt/ # Terraform & Terragrunt configurations
└── templates/          # Kubernetes templates
```
## 🛠 Prerequisites

- https://github.com/panicboat/platform/tree/main/kubernetes

## 🚀 Getting Started

Add the following to `/etc/hosts`.

```bash
127.0.0.1 nginx.local
```

## 🏗 Architecture

```mermaid
graph LR
    User[User] -- "1. External IP<br>LoadBalancer" --> NginxLB[Cloud LB]
    NginxLB -- "2. Port 80" --> NginxPod[Nginx Pod<br>Reverse Proxy]
    NginxPod -- "3. http://cilium-gateway<br>Internal" --> CiliumGw[Cilium Gateway]
    CiliumGw -- "4. HTTPRoute<br>Host: nginx.local" --> AppPod[App Pod<br>services/nginx]
```

## 📝 Contribution Guide
