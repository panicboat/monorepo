# Proposal: Image Upload Feature

## Why
現在、キャストのプロフィール画像などをアップロードする機能が実装されていません。
AWS S3 (本番) と ローカルファイルシステム (開発) を透過的に扱える安全なアップロード機能が必要です。
マイクロサービスアーキテクチャの観点から、独立した Storage Service は作成せず、Portfolio Service 内で完結させつつコードを共通化する方針を採ります。

## What Changes
1.  **Shared Logic (`lib/storage_helper.rb`)**:
    -   環境 (Production/Development) に応じて、S3 Presigned URL または Local URL を発行するロジックを共通化。
2.  **Portfolio Service**:
    -   `GetUploadUrl` RPC を実装し、クライアントにアップロード用URL (Presigned URL) を提供。
    -   `local_uploader.rb` を PUT リクエストに対応させ、本番 (S3) とのリクエストメソッドの差異を吸収。
3.  **Frontend**:
    -   画像をアップロードし、取得した Key (Path) または URL をプロフィール保存時に送信。

## Schemas
- `Portfolio` Service に `GetUploadUrl` RPC を追加 (以前削除したものを復活・再設計)。
