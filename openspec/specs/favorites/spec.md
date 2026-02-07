# favorites Specification

## Purpose
TBD - created by archiving change add-favorites-feature. Update Purpose after archive.
## Requirements
### Requirement: Cast Favorite Feature

ゲストはキャストをお気に入り登録できなければならない (MUST)。お気に入りはバックエンドに永続化され、デバイス間で同期される。

#### Scenario: ゲストがキャストをお気に入り登録する
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はまだお気に入り登録していないキャストの詳細ページを見ている
- **WHEN** 私がお気に入りボタン（星アイコン）をタップする
- **THEN** お気に入りがバックエンドに保存される
- **AND** お気に入りボタンが登録済み状態（塗りつぶし星）に変わる

#### Scenario: ゲストがお気に入りを解除する
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は既にお気に入り登録済みのキャストの詳細ページを見ている
- **WHEN** 私がお気に入りボタンをタップする
- **THEN** お気に入りがバックエンドから削除される
- **AND** お気に入りボタンが未登録状態（枠線のみの星）に変わる

#### Scenario: お気に入り状態の読み込み
- **GIVEN** 私はログイン済みのゲストである
- **WHEN** 私がキャスト詳細ページを表示する
- **THEN** お気に入り状態がバックエンドから取得されて表示される

#### Scenario: お気に入りキャストのタイムライン表示
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は複数のキャストをお気に入り登録している
- **WHEN** 私がタイムラインの Favorites タブを選択する
- **THEN** お気に入りキャストの投稿のみが表示される
- **AND** フィルタリングはサーバーサイドで実行される

### Requirement: Favorites API

お気に入り機能は API を通じて操作できなければならない (MUST)。

#### Scenario: お気に入りの追加
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** POST `/api/guest/favorites` を cast_id を指定して呼び出す
- **THEN** お気に入りが保存され、成功フラグが返される
- **AND** 既にお気に入り済みの場合は変更なしで成功が返される

#### Scenario: お気に入りの解除
- **GIVEN** 認証済みのゲストユーザー
- **AND** 対象キャストをお気に入り登録中である
- **WHEN** DELETE `/api/guest/favorites?cast_id={castId}` を呼び出す
- **THEN** お気に入りが削除され、成功フラグが返される

#### Scenario: お気に入りリストの取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/favorites?limit=100` を呼び出す
- **THEN** お気に入りの cast_id リストが返される
- **AND** ページネーションに対応している

#### Scenario: お気に入り状態の一括取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/favorites/status?cast_ids={id1,id2,...}` を呼び出す
- **THEN** 各キャストのお気に入り状態がマップ形式で返される

### Requirement: Favorites Data Model

お気に入りデータは `cast_favorites` テーブルに永続化されなければならない (MUST)。

#### Scenario: お気に入りテーブルの構造
- **GIVEN** データベースに `cast_favorites` テーブルがある
- **THEN** テーブルは以下のカラムを持つ
  - `id` (UUID, PRIMARY KEY)
  - `cast_id` (UUID, REFERENCES casts)
  - `guest_id` (UUID, REFERENCES guests)
  - `created_at` (TIMESTAMP)
- **AND** `(cast_id, guest_id)` にユニーク制約がある

