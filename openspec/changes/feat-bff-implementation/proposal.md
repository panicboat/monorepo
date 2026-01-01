# Feature: BFF Implementation with Connect

## Why (なぜ行うのか)
Identity Slice のバックエンド実装が完了し、gRPC サーバーが稼働しています。
Frontend (Next.js) からこれらの機能を安全かつ型安全に利用するために、**Connect** を使用した BFF レイヤーを実装します。これにより、クライアントサイドからの直接 gRPC 呼び出しではなく、Server Actions を経由したセキュアな通信を実現します。

## What Changes (何を変更するのか)
1.  **RPC Package (`@heaven/rpc`)**: `buf` を使用して `IdentityService` の TypeScript コードを生成します。
2.  **App Shell (`apps/shell`)**:
    - `src/lib/rpc.ts`: Connect トランスポートの設定（Server Side gRPC Client）。
    - `src/app/actions/auth.ts`: 登録・ログイン用の Server Actions を実装。
    - **Page Update**: 既存のログイン・登録画面を Server Actions に接続。
3.  **Validation**: エンドツーエンドでの登録・ログインフローの動作確認。
