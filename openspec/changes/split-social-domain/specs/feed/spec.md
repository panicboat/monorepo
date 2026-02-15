# feed Specification

## Purpose

複数ドメインからデータを集約してフィードを提供する読み取り専用ドメイン。将来的に BFF へ移行可能な設計とする。

## ADDED Requirements

### Requirement: Feed Domain Boundary

Feed ドメインは読み取り専用の集約機能のみを担当しなければならない (MUST)。

#### Scenario: Feed Domain is Read-Only

- **GIVEN** Feed ドメインが存在する
- **THEN** 以下の機能を提供する:
  - フィード一覧取得（ゲスト向け）
  - フィード一覧取得（キャスト向け）
- **AND** 以下の操作は提供しない:
  - 投稿の作成・更新・削除
  - いいね・コメントの作成・削除
  - フォロー・ブロックの操作

#### Scenario: Feed Domain Aggregates Data

- **GIVEN** Feed ドメインが存在する
- **WHEN** フィードを取得する
- **THEN** Post ドメインと Relationship ドメインからデータを集約する
- **AND** 集約ロジックは Feed ドメイン内に閉じる

### Requirement: Guest Feed API

Feed ドメインはゲスト向けフィード API を提供しなければならない (MUST)。

#### Scenario: List Guest Feed - All

- **GIVEN** 認証済みのゲストユーザー
- **WHEN** `ListGuestFeed(filter: "all")` を呼び出す
- **THEN** 全キャストの公開投稿が返される
- **AND** ゲストがブロック中のユーザーの投稿は除外される

#### Scenario: List Guest Feed - Following

- **GIVEN** 認証済みのゲストユーザー
- **WHEN** `ListGuestFeed(filter: "following")` を呼び出す
- **THEN** フォロー中のキャストの投稿のみが返される
- **AND** ゲストがブロック中のユーザーの投稿は除外される

#### Scenario: List Guest Feed - Favorites

- **GIVEN** 認証済みのゲストユーザー
- **WHEN** `ListGuestFeed(filter: "favorites")` を呼び出す
- **THEN** お気に入り登録したキャストの投稿のみが返される
- **AND** ゲストがブロック中のユーザーの投稿は除外される

### Requirement: Cast Feed API

Feed ドメインはキャスト向けフィード API を提供しなければならない (MUST)。

#### Scenario: List Cast Feed

- **GIVEN** 認証済みのキャストユーザー
- **WHEN** `ListCastFeed(cast_id)` を呼び出す
- **THEN** そのキャストの全投稿が返される（公開・非公開含む）
- **AND** 投稿管理画面で使用される

### Requirement: Feed Internal Flow

Feed ドメインは Post と Relationship を組み合わせてフィードを構築しなければならない (MUST)。

#### Scenario: Feed Aggregation Flow

- **GIVEN** Feed ドメインがフィードを構築する
- **WHEN** `ListGuestFeed(filter: "following")` が呼び出される
- **THEN** 以下の順序で処理する:
  1. Relationship ドメインからフォロー中の cast_ids を取得
  2. Relationship ドメインからブロック中の user_ids を取得
  3. Post ドメインから投稿を取得（cast_ids でフィルタ、user_ids で除外）
  4. 集約結果を返却

### Requirement: Feed Domain Isolation

Feed ドメインは Post と Relationship の内部実装に依存してはならない (MUST)。

#### Scenario: Feed Uses Public APIs Only

- **GIVEN** Feed ドメインが存在する
- **WHEN** Post または Relationship のデータが必要な場合
- **THEN** 各ドメインの公開 API（gRPC）経由でのみアクセスする
- **AND** データベースへの直接アクセスは行わない

### Requirement: BFF Migration Path

Feed ドメインは将来的に BFF へ移行可能な設計でなければならない (MUST)。

#### Scenario: Feed Can Be Replaced by BFF

- **GIVEN** Feed ドメインが読み取り専用である
- **WHEN** 正しい BFF を導入する場合
- **THEN** Feed ドメインの集約ロジックを BFF に移動できる
- **AND** Post と Relationship ドメインは変更不要
- **AND** Feed ドメインを削除できる
