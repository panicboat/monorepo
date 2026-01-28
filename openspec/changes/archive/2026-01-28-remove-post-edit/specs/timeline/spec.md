## MODIFIED Requirements

### Requirement: Cast Timeline Management
キャストは自身のタイムライン投稿を管理できなければならない (MUST be able to manage their timeline posts)。データはバックエンドに永続化される。この機能は **Social ドメイン** に属する。

#### Scenario: キャストが自分の投稿一覧を表示する
- **GIVEN** 私はログイン済みのキャストである
- **WHEN** 私がタイムライン管理ページにアクセスする
- **THEN** バックエンドから取得した私の投稿一覧が表示される
- **AND** 投稿がない場合は空の状態で表示される

#### Scenario: キャストが新しいタイムライン投稿を行う
- **GIVEN** 私はログイン済みのキャストである
- **WHEN** 私がタイムライン管理ページにアクセスする
- **AND** 私がテキスト「Hello World」を入力し、任意で画像をアップロードする
- **AND** 私が「Post」ボタンをクリックする
- **THEN** 投稿がバックエンドに永続化される
- **AND** 新しい投稿が私のタイムラインリストに表示される
- **AND** それがゲスト側の私のプロフィール/フィードに表示される

#### Scenario: キャストが投稿を削除する
- **GIVEN** 私はログイン済みのキャストである
- **AND** 私には既存の投稿がある
- **WHEN** 私が投稿の「Delete」をクリックする
- **THEN** その投稿がバックエンドから削除される
- **AND** 投稿一覧から消える

### Requirement: Timeline API
フロントエンドはタイムライン API を通じて投稿を管理できなければならない (MUST be able to manage posts through Timeline API)。

#### Scenario: 投稿一覧の取得
- **GIVEN** 認証済みのキャストユーザー
- **WHEN** GET `/api/cast/timeline?limit=20` を呼び出す
- **THEN** そのキャストの最新20件の投稿が返される
- **AND** `next_cursor` と `has_more` が返される

#### Scenario: 投稿一覧の続きを取得
- **GIVEN** 認証済みのキャストユーザー
- **AND** 20件以上の投稿がある
- **WHEN** GET `/api/cast/timeline?limit=20&cursor={next_cursor}` を呼び出す
- **THEN** カーソル以降の投稿が返される

#### Scenario: 新規投稿の保存
- **GIVEN** 認証済みのキャストユーザー
- **WHEN** PUT `/api/cast/timeline` を id なし、content と任意の media で呼び出す
- **THEN** 投稿が新規作成され、作成された投稿が返される

#### Scenario: 投稿の削除
- **GIVEN** 認証済みのキャストユーザー
- **AND** 自分が作成した投稿がある
- **WHEN** DELETE `/api/cast/timeline?id={postId}` を呼び出す
- **THEN** 投稿が削除される

