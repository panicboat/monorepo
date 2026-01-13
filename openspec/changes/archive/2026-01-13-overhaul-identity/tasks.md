# Tasks

1.  **Proto Update**
    - [ ] `SendSmsRequest`, `VerifySmsRequest` メッセージを定義する。
    - [ ] `RegisterRequest` を更新し、 `phone_number` と `password` （および検証済みトークン）を含めるようにする。
    - [ ] `LoginRequest` を更新し、 `email` の代わりに `phone_number` を使用するようにする。

2.  **Backend Implementation (Monolith)**
    - [ ] `users` テーブルに `phone_number` カラムを追加（またはスキーマ更新）する。
    - [ ] `SmsService`（インターフェース + モックアダプタ）を実装する。
    - [ ] `Register` フローの実装: 電話番号検証 -> ユーザー作成 -> パスワード設定。
    - [ ] `Login` フローの実装: 電話番号でユーザー検索 -> パスワード検証 -> トークン発行。
    - [ ] `GetCurrentUser` の実装: トークンデコード -> ユーザー取得。

3.  **Frontend Implementation (Nyx)**
    - [ ] `useAuth` フックを更新し、実際のgRPCクライアントを使用するようにする。
    - [ ] 登録画面のリファクタリング: 電話番号入力 -> OTP入力 -> パスワード入力 の順にする。
    - [ ] ログイン画面のリファクタリング: 電話番号入力 -> パスワード入力 の順にする。
