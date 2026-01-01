# Feature: BFF Implementation (Integrated)

## Why (なぜ行うのか)
Identity Slice のバックエンド実装 (gRPC) が完了しました。
Frontend (Next.js) からこれらの機能を安全かつ効率的に利用するために、**Connect** を使用した BFF レイヤーを実装します。
アーキテクチャとしては、Next.js (`apps/shell`) の **Server Actions** を BFF として機能させる「統合型」を採用し、通信オーバーヘッドの削減と開発効率の最大化を図ります。

## Architecture
```mermaid
graph TD
    Browser[Browser] -- HTTP (RSC Payload) --> Shell[Next.js Application (BFF)]
    Shell -- gRPC (Connect) --> Hanami[Monolith Backend]
```

## What Changes (何を変更するのか)
1.  **RPC Package (`@heaven/rpc`)**: `buf` を使用して `IdentityService` の TypeScript コードを生成します。
2.  **App Shell (`apps/shell`)**:
    - `src/lib/rpc.ts`: Connect トランスポートの設定 (Server-Side gRPC Client)。
    - `src/app/actions/auth.ts`: 登録・ログイン用の Server Actions を実装。
    - **Page Update**: 既存のログイン・登録画面を Server Actions に接続し、実バックエンドを使用するように修正。
3.  **Validation**: エンドツーエンドでの登録・ログインフローの動作確認。
