# identity Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
### Requirement: Robust User Authentication (MUST)
システムは、OIDCプロバイダ（特にGoogle）およびSMS認証を利用した堅牢な認証フローを提供しなければならない。

#### Scenario: Google OIDC Login
- **WHEN** ユーザーが「Googleでログイン」を選択したとき
- **THEN** ユーザーはプロバイダにリダイレクトされ、認証され、有効なセッションと共に戻ってくる。

#### Scenario: SMS Verification
- **WHEN** ユーザーが電話番号を提供したとき
- **THEN** SMS経由でOTPが送信され、ユーザーは認証のためにそれを入力しなければならない。

### Requirement: Guest Dashboard (MUST)
ゲストユーザーは、自身の活動履歴やお気に入りキャストを確認できなければならない。

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

