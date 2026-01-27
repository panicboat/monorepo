<!-- Domain: Social -->
<!-- Backend: slices/social, Frontend: modules/social, Proto: social/v1 -->

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

#### Scenario: キャストが投稿を編集する
- **GIVEN** 私はログイン済みのキャストである
- **AND** 私には既存の投稿がある
- **WHEN** 私が投稿の「Edit」をクリックする
- **AND** テキストを変更して保存する
- **THEN** 変更がバックエンドに永続化される
- **AND** 更新された投稿が表示される

#### Scenario: キャストが投稿を削除する
- **GIVEN** 私はログイン済みのキャストである
- **AND** 私には既存の投稿がある
- **WHEN** 私が投稿の「Delete」をクリックする
- **THEN** その投稿がバックエンドから削除される
- **AND** 投稿一覧から消える

## ADDED Requirements
### Requirement: Timeline Post Data Model
タイムライン投稿は以下のデータを持たなければならない (MUST have the following data)。

#### Scenario: 投稿データの保存
- **GIVEN** キャストが投稿を作成する
- **WHEN** 投稿が保存される
- **THEN** 以下のデータが永続化される:
  - id: 一意の識別子
  - cast_id: 投稿者のキャストID
  - content: テキスト内容
  - created_at: 作成日時
  - updated_at: 更新日時
- **AND** 投稿にはオプションでメディア（画像/動画）を添付できる

#### Scenario: 投稿表示時にキャスト情報を含める
- **GIVEN** 投稿一覧を取得する
- **WHEN** 投稿データがレスポンスされる
- **THEN** 各投稿にキャストの author 情報（id, name, image_url）が含まれる
- **AND** author 情報は casts テーブルから JOIN して取得される

#### Scenario: いいね・コメント機能はスコープ外
- **GIVEN** 投稿が表示される
- **WHEN** いいね数・コメント数が必要な場合
- **THEN** 常に 0 が返される（機能は別提案で実装予定）

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

#### Scenario: 既存投稿の保存
- **GIVEN** 認証済みのキャストユーザー
- **AND** 自分が作成した投稿がある
- **WHEN** PUT `/api/cast/timeline` を id、content で呼び出す
- **THEN** 投稿が更新され、更新された投稿が返される

#### Scenario: 投稿の削除
- **GIVEN** 認証済みのキャストユーザー
- **AND** 自分が作成した投稿がある
- **WHEN** DELETE `/api/cast/timeline?id={postId}` を呼び出す
- **THEN** 投稿が削除される
