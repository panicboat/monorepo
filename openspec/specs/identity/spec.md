# identity Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
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

### Requirement: Guest Dashboard (MUST)
ゲストユーザーは、自身の活動履歴やお気に入りキャストを確認できなければならない (MUST)。

#### Scenario: View Dashboard
- **WHEN** ログイン済みユーザーがマイページにアクセスしたとき
- **THEN** 「お気に入りキャスト」「過去の予約履歴」が表示されるエリアを提供する。

### Requirement: Guest Reliability Visualization (MUST)
ユーザー（ゲスト）は、自身の信頼度スコア（キャストからの評価状況）を確認できなければならない (MUST)。これにより、良質なふるまいを促進する。

#### Scenario: View Reliability
- **WHEN** ユーザーがマイページを開いたとき
- **THEN** 自身の信頼度（Reliability Score / Trust Rank）が可視化されている。

### Requirement: User Relationships (MUST)
ユーザーは、キャストに対して好意的（Favorite/Follow）または否定的（Block）な関係性を明示的に管理できなければならない (MUST)。

#### Scenario: View Favorites
- **WHEN** ユーザーがお気に入りリストを開いたとき
- **THEN** 過去に「Favorite（気になる）」したキャストが一覧表示され、そこから詳細へ遷移できる。

#### Scenario: View Following
- **WHEN** ユーザーがフォローリストを開いたとき
- **THEN** 「Follow」中のキャストが一覧表示される。

#### Scenario: View Blocking
- **WHEN** ユーザーがブロックリストを開いたとき
- **THEN** ブロック中のキャストが表示され、必要に応じて解除（Unblock）できる。

#### Scenario: Add to Favorites
- **WHEN** キャスト詳細画面で「お気に入り（ハート）」ボタンを押したとき
- **THEN** そのキャストがお気に入りリストに追加される。

#### Scenario: Follow Cast
- **WHEN** キャスト詳細画面またはタイムラインで「フォロー」ボタンを押したとき
- **THEN** そのキャストがフォローリストに追加され、タイムラインでの表示優先度が上がる。

#### Scenario: Block Cast
- **WHEN** キャスト詳細のメニューから「ブロック」を選択したとき
- **THEN** そのキャストとの連絡（チャット等）が遮断され、一覧にも表示されなくなる。

### Requirement: User Trust Visualization (MUST)
ユーザー（ゲスト）は、自身のマイページで「誓約履行率（Vow Completion Rate）」を確認できなければならない (MUST)。これにより、ドタキャン等の少なさを証明できる。

#### Scenario: View My Stats
- **WHEN** ゲストがマイページ（GuestDashboard）を表示したとき
- **THEN** 誓約の完了率と回数が表示される。

### Requirement: Cast Trust Visualization (MUST)
キャストプロフィールにおいても、誓約履行率を表示できる機能を実装しなければならない (MUST)。ただし、表示のON/OFFは将来的に検討する。

#### Scenario: View Cast Profile
- **WHEN** キャスト詳細画面を表示したとき
- **THEN** ソーシャルカウントの並びなどの適切な場所に、誓約履行率が表示される。

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

### Requirement: Request Tracing

システムは、リクエストごとにユニークなトレース ID を生成し、全レイヤーで伝播しなければならない (MUST)。

#### Scenario: Trace ID Generation

- **WHEN** クライアントが API リクエストを送信するとき
- **THEN** リクエストには `X-Request-ID` ヘッダーが含まれなければならない (MUST)
- **AND** 値は UUIDv4 形式である

#### Scenario: Trace ID Propagation

- **GIVEN** `X-Request-ID` ヘッダーを含むリクエストが
- **WHEN** BFF を経由して Backend に到達するとき
- **THEN** 同一の `X-Request-ID` が gRPC metadata として伝播される
- **AND** Backend のログに `X-Request-ID` が含まれる

#### Scenario: Trace ID in Response

- **WHEN** API がレスポンスを返すとき
- **THEN** レスポンスヘッダーに同一の `X-Request-ID` が含まれる

### Requirement: Consistent Authentication Header

認証が必要な全ての API リクエストは、一貫して認証ヘッダーを送信しなければならない (MUST)。

#### Scenario: Authenticated Request

- **GIVEN** ログイン済みのユーザーが
- **WHEN** 認証が必要な API を呼び出すとき
- **THEN** リクエストには `Authorization: Bearer {token}` ヘッダーが含まれる
- **AND** トークンが存在しない場合はログインページにリダイレクトされる

#### Scenario: Token Refresh on Expiry

- **GIVEN** アクセストークンが期限切れのとき
- **WHEN** API リクエストが 401 を返したとき
- **THEN** システムはリフレッシュトークンで新しいアクセストークンを取得する
- **AND** 元のリクエストを再試行する

