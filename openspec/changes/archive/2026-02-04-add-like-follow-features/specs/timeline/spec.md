# timeline Specification Delta

## ADDED Requirements

### Requirement: Post Like Feature
ゲストはタイムライン投稿にいいねできなければならない (MUST)。いいねはゲストごとに1投稿に対して1回のみ可能。

#### Scenario: ゲストが投稿にいいねする
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はまだいいねしていない投稿を見ている
- **WHEN** 私がいいねボタンをタップする
- **THEN** いいねがバックエンドに保存される
- **AND** いいね数が +1 される
- **AND** いいねボタンがいいね済み状態に変わる

#### Scenario: ゲストがいいねを取り消す
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は既にいいね済みの投稿を見ている
- **WHEN** 私がいいねボタンをタップする
- **THEN** いいねがバックエンドから削除される
- **AND** いいね数が -1 される
- **AND** いいねボタンが未いいね状態に変わる

#### Scenario: いいね状態の読み込み
- **GIVEN** 私はログイン済みのゲストである
- **WHEN** 私がタイムラインを表示する
- **THEN** 各投稿のいいね済み状態が表示される
- **AND** 自分がいいねした投稿はいいねボタンがいいね済み状態で表示される

#### Scenario: いいね数のリアルタイム表示
- **GIVEN** 投稿がタイムラインに表示されている
- **WHEN** いいね数を確認する
- **THEN** 実際のいいね数がバックエンドから取得されて表示される

### Requirement: Like API
いいね機能は API を通じて操作できなければならない (MUST)。

#### Scenario: いいねの追加
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** POST `/api/guest/likes` を post_id を指定して呼び出す
- **THEN** いいねが保存され、最新の likes_count が返される
- **AND** 既にいいね済みの場合は変更なしで現在の likes_count が返される

#### Scenario: いいねの取り消し
- **GIVEN** 認証済みのゲストユーザー
- **AND** 対象投稿にいいね済みである
- **WHEN** DELETE `/api/guest/likes?post_id={postId}` を呼び出す
- **THEN** いいねが削除され、最新の likes_count が返される

#### Scenario: いいね状態の一括取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/likes/status?post_ids={id1,id2,...}` を呼び出す
- **THEN** 各投稿のいいね済み状態がマップ形式で返される

### Requirement: Cast Follow Feature
ゲストはキャストをフォローできなければならない (MUST)。フォローはバックエンドに永続化され、デバイス間で同期される。

#### Scenario: ゲストがキャストをフォローする
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はまだフォローしていないキャストの詳細ページを見ている
- **WHEN** 私がフォローボタンをタップする
- **THEN** フォローがバックエンドに保存される
- **AND** フォローボタンがフォロー中状態に変わる

#### Scenario: ゲストがフォローを解除する
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は既にフォロー中のキャストの詳細ページを見ている
- **WHEN** 私がフォローボタンをタップする
- **THEN** フォローがバックエンドから削除される
- **AND** フォローボタンが未フォロー状態に変わる

#### Scenario: フォロー状態の読み込み
- **GIVEN** 私はログイン済みのゲストである
- **WHEN** 私がキャスト詳細ページを表示する
- **THEN** フォロー済み状態がバックエンドから取得されて表示される

#### Scenario: フォロー中キャストのタイムライン表示
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は複数のキャストをフォローしている
- **WHEN** 私がタイムラインの Following タブを選択する
- **THEN** フォロー中のキャストの投稿のみが表示される
- **AND** フィルタリングはサーバーサイドで実行される

### Requirement: Follow API
フォロー機能は API を通じて操作できなければならない (MUST)。

#### Scenario: フォローの追加
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** POST `/api/guest/following` を cast_id を指定して呼び出す
- **THEN** フォローが保存され、成功フラグが返される
- **AND** 既にフォロー済みの場合は変更なしで成功が返される

#### Scenario: フォローの解除
- **GIVEN** 認証済みのゲストユーザー
- **AND** 対象キャストをフォロー中である
- **WHEN** DELETE `/api/guest/following?cast_id={castId}` を呼び出す
- **THEN** フォローが削除され、成功フラグが返される

#### Scenario: フォロー中リストの取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/following?limit=100` を呼び出す
- **THEN** フォロー中の cast_id リストが返される
- **AND** ページネーションに対応している

#### Scenario: フォロー状態の一括取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/following/status?cast_ids={id1,id2,...}` を呼び出す
- **THEN** 各キャストのフォロー状態がマップ形式で返される

## MODIFIED Requirements

### Requirement: Timeline Post Data Model
タイムライン投稿データに `liked` フラグを追加しなければならない (MUST)。

#### Scenario: 投稿表示時にいいね状態を含める
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** 投稿一覧を取得する
- **THEN** 各投稿に `likes_count` が含まれる
- **AND** 各投稿に自分がいいね済みかどうかの `liked` フラグが含まれる
