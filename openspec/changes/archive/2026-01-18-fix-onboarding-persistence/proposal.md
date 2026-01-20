# Proposal: Fix Onboarding Persistence

## Summary
キャストのオンボーディングフローにおいて、データ損失を防ぎ、途中再開を可能にするために、ステップごとのデータ永続化を実装します。ユーザーからのフィードバックに基づき、プラン情報（Plans）はプロフィールとは別のテーブルとして適切に扱われるよう設計しました。`UpdateProfile` は `UpdateCastProfile` にリネームされ、プランとスケジュールの更新もサポートします。
また、`get_upload_url` オペレーションは `storage` スライスに統合済みであるため、`portfolio` スライスからは削除します。

## Why
現在、オンボーディングフローは `localStorage` への保存のみを行っていますが、信頼性が低くデバイス間同期ができません。
サーバー側での永続化を実現するため、以下の変更を行います：
1.  `UpsertCastProfile` RPC を使用し、ステップごとにデータをサーバーに保存する。
2.  オンボーディングの各ステップへのアクセスには認証を必須とする。

## What Changes
1.  **Portfolio Spec Update**:
    -   `UpdateProfile` RPC を `UpsertCastProfile` にリネーム（実態がUpsertであるため）。
    -   `GetProfile` RPC を `GetCastProfile` にリネーム（Guestとの曖昧性排除）。
    -   `UpdateStatus` RPC を `UpdateCastStatus` にリネーム（Guestとの曖昧性排除）。
    -   `Plans` (cast_plans) と `Schedules` (cast_schedules) の永続化をサポート。
    -   `get_upload_url` の削除（重複排除）。
    -   `CreateProfile` の削除（`UpsertCastProfile` への統合）。
2.  **Backend Implementation**:
    -   **Operations Renaming**:
        -   `update_cast_profile.rb` -> `upsert_cast_profile.rb`
        -   `get_profile.rb` -> `get_cast_profile.rb`
        -   `update_status.rb` -> `update_cast_status.rb`
        -   `create_profile.rb` -> 削除
    -   `Portfolio::Grpc::Handler` の実装更新 (`UpsertCastProfile`, `GetCastProfile`, `UpdateCastStatus` 対応)。
    -   **Migration**: `portfolio__cast_plans` および `portfolio__cast_schedules` テーブルを作成 (ROM::SQL.migration形式)。
3.  **Frontend Integration**:
    -   `CastAuthGuard` (`web/nyx/workspace/src/modules/identity/components/CastAuthGuard.tsx`) を修正し、`/cast/onboarding/step-*` を保護対象に追加。
    -   各ステップ完了時に `UpdateCastProfile` を呼び出す。

## Verification Plan
-   **Automated Tests (RSpec)**:
    -   `Portfolio::Grpc::Handler` および `Operations` のテスト。
    -   プランとシフトが正しく保存・更新されることを確認。
-   **Manual Verification**:
    -   未ログインでの `/cast/onboarding/step-1` アクセス時のリダイレクト確認。
    -   オンボーディング途中でのブラウザクローズ・再開時の状態復元確認。
