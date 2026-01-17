# Tasks: Cast Implementation

- [ ] **Identity Update**
    - [ ] `proto/identity/v1/service.proto` を更新し、`RegisterRequest` に `role` を追加する。
    - [ ] Monolith で `bin/codegen` を実行する。
    - [ ] `slices/identity/grpc/handler.rb` を更新し、ロール割り当て処理を実装する。

- [ ] **Frontend Auth UI (Nyx)**
    - [ ] `/cast/page.tsx` (キャストポータルページ) を作成し、登録・ログイン機能を実装する。
    - [ ] Onboarding (`/cast/onboarding`) にステップごとの保存処理を追加する。
    - [ ] 更新された Identity GRPC クライアントとの統合を行う。

- [ ] **Database & Entity (Monolith)**
    - [ ] `casts` テーブル作成用のマイグレーションファイルを作成する。
        - **Note**: `users` テーブルへの外部キー制約は設定しないこと（uuid型の論理参照のみ）。
    - [ ] マイグレーションを実行する。
    - [ ] `Cast` エンティティとリポジトリを実装する。

- [ ] **Cast Service (Monolith)**
    - [ ] `proto/cast/v1/service.proto` の定義（Create, Get, List）を検証・確定する。
    - [ ] `slices/cast` サービス（CreateProfile, GetProfile）を実装する。
    - [ ] `slices/cast/grpc/handler.rb` を実装する。

- [ ] **Frontend Integration (Nyx)**
    - [ ] `useCastAuth` または同等のフック修正を実装する。
    - [ ] ポートフォリオページを実際のキャストデータと接続する。
