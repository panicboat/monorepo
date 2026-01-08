# Nyx

**English** | [🇯🇵 日本語](README-ja.md)

## 💡 Role

## 🔗 Architecture

**Frontend (Next.js) → BFF (Next.js API) → Backend (gRPC)**

- **Frontend**: Next.js App Router (React Server Components + Client Components).
- **BFF (Backend for Frontend)**: integrated into Next.js (API Routes / Server Actions). Handles authentication, session management, and data aggregation.
- **Backend Communication**: Communicates with backend microservices via **gRPC** (using [ConnectRPC](https://connectrpc.com/)).
- **Protocol**: `Frontend` --(HTTP/JSON)--> `BFF` --(gRPC/Proto)--> `Backend Services`.

- **Frontend**: Next.js App Router (React Server Components + Client Components)。
- **BFF (Backend for Frontend)**: Next.js (API Routes / Server Actions) に統合。認証、セッション管理、データの集約を担当。
- **Backend Communication**: バックエンドのマイクロサービスとは **gRPC** (via [ConnectRPC](https://connectrpc.com/)) で通信。
- **Protocol**: `Frontend` --(HTTP/JSON)--> `BFF` --(gRPC/Proto)--> `Backend Services`。

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |

## 🚀 Running Locally
