# Nyx

**English** | [🇯🇵 日本語](README-ja.md)

## 💡 Role

## 🔗 Architecture / Dependencies

**Frontend (Next.js) → BFF (Next.js API) → Backend (gRPC)**

- **Frontend**: Next.js App Router (React Server Components + Client Components).
- **BFF (Backend for Frontend)**: integrated into Next.js (API Routes / Server Actions). Handles authentication, session management, and data aggregation.
- **Backend Communication**: Communicates with backend microservices via **gRPC** (using [ConnectRPC](https://connectrpc.com/)).
- **Protocol**: `Frontend` --(HTTP/JSON)--> `BFF` --(gRPC/Proto)--> `Backend Services`.

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |

## 🚀 Running Locally
