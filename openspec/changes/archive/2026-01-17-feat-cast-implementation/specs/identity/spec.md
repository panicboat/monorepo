# Identity Spec Delta

## ADDED Requirements

### Requirement: Cast Authentication UI (MUST)
キャストは、ゲストとは異なる専用のログイン・登録画面からアクセスできなければならない (MUST)。

#### Scenario: Cast Registration
- **WHEN** ユーザーがキャスト登録画面（`/cast/entry`等）から電話番号認証とパスワード設定を行ったとき
- **THEN** システムは `role: CAST` (2) としてユーザーを作成し、続けてプロフィール作成フローへ遷移させる。

#### Scenario: Cast Login
- **WHEN** ユーザーがキャストログイン画面（`/cast/login`）からログインしたとき
- **THEN** キャスト権限で認証され、キャスト専用ダッシュボードへ遷移する。

### Requirement: Role-based Registration (MUST)
システムは、ユーザー登録時にそのユーザーの役割（Guest または Cast）を指定して作成できなければならない (MUST)。

#### Scenario: Register as Cast
- **WHEN** APIクライアントが `role: CAST` を指定して登録リクエストを送信したとき
- **THEN** 作成されたユーザーは `CAST` 権限を持つ。
