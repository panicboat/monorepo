# Feature: BFF Architecture with Connect

## Why (なぜ行うのか)
Next.js フロントエンドを Hanami gRPC バックエンドに直接接続するには、ブラウザが生の gRPC を話せないため、ブリッジが必要です。私たちは Next.js API Routes と **Connect** エコシステムを使用した **BFF (Backend For Frontend)** レイヤーを導入します。これにより、バックエンドのトポロジーを隠蔽しつつ、フロントエンドからバックエンドまでの型安全性を確保します。

## What Changes (何を変更するのか)
- **ツール:** Protocol Buffer 管理のために `buf` を導入します。
- **Frontend:** `@connectrpc/connect`, `@connectrpc/connect-web`, `@connectrpc/protoc-gen-connect-es` をインストールします。
- **BFF:** Next.js の **Server Components / Server Actions** 内で Connect クライアントを使用し、バックエンドと通信します。
    - 認証やデータ集約（Aggregation）をこの層で行います。
    - クライアントサイドからは Server Actions を通じて透過的にバックエンドの機能を呼び出す形になります（直接 gRPC/Connect を叩くわけではありません）。

## Architecture
```mermaid
graph TD
    Browser[Browser] -- HTTP (Action/RSC Payload) --> NextJS[Next.js BFF (Server Components / Actions)]
    NextJS -- gRPC (Connect) --> Hanami[Hanami Monolith (gruf)]
```

## Verification Plan (検証計画)
- `buf lint`: Protoファイルの検証。
- `pnpm dev`: ブラウザコンソールから BFF 経由で gRPC メソッド（例: `HealthCheck`）を呼び出し、疎通を確認する。
