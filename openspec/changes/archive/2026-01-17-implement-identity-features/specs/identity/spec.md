# auth Spec Delta

## ADDED Requirements

### Requirement: Refresh Token (MUST)
システムは、アクセストークンの有効期限が切れた後も、ユーザーが再認証なしでセッションを継続できる仕組みを提供しなければならない (MUST)。

#### Scenario: Refresh Access Token
- **WHEN** 有効なリフレッシュトークンを使用してトークン更新リクエストを送信したとき
- **THEN** 新しいアクセストークンと新しいリフレッシュトークンが発行される（Token Rotation）。
- **AND** 古いリフレッシュトークンは無効化される。

#### Scenario: Invalid Refresh Token
- **WHEN** 無効または期限切れのリフレッシュトークンを使用したとき
- **THEN** 更新リクエストは拒否され、ユーザーは再ログインを求められる。

### Requirement: Explicit Logout (MUST)
システムは、ユーザーが明示的にログアウトした際、サーバー側でセッション（リフレッシュトークン）を無効化しなければならない (MUST)。

#### Scenario: User Logout
- **WHEN** ユーザーがログアウト操作を行ったとき
- **THEN** 現在使用中のリフレッシュトークンがサーバー上で削除または無効化される。
- **AND** 以降、そのリフレッシュトークンを使用した更新は失敗する。

### Requirement: Guest Authentication Routing (MUST)
非認証のゲストユーザーは、専用のログインページから認証を行わなければならない (MUST)。ルートパスは認証済みユーザー向けとする。

#### Scenario: Unauthenticated Access to Root
- **WHEN** 非認証ユーザーがルートパス (`/`) にアクセスしたとき
- **THEN** システムは `/login` ページへリダイレクトする。

#### Scenario: Login Page Access
- **WHEN** `/login` ページにアクセスしたとき
- **THEN** ゲスト向けログイン/登録画面（LoginGate）が表示される。

## MODIFIED Requirements

### Requirement: Robust User Authentication (MUST)
システムは、電話番号とパスワードを利用した堅牢な認証フローを提供しなければならない (MUST)。Google OIDCのサポートは将来の検討事項とする。

#### Scenario: Phone & Password Registration [MODIFIED]
- **WHEN** ユーザーが電話番号を入力し、SMS認証を完了した後、パワードを設定したとき
- **THEN** 新しいユーザーアカウントが作成され、ログイン状態となる。
- **AND** **アクセストークンと共にリフレッシュトークンが発行される。**

#### Scenario: Phone & Password Login [MODIFIED]
- **WHEN** ユーザーが登録済みの電話番号とパスワードを入力したとき
- **THEN** ユーザーは認証され、有効なセッション（トークン）を取得してログインできる。
- **AND** **アクセストークンと共にリフレッシュトークンが発行される。**
- **AND** **ユーザーのロール（Guest/Cast）属性が返却される。** (既存挙動の明記)
