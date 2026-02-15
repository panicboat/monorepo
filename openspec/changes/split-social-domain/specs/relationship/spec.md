# relationship Specification

## Purpose

ユーザー間の関係性を管理するドメイン。フォロー、ブロック、お気に入りを担当する。

## ADDED Requirements

### Requirement: Relationship Domain Boundary

Relationship ドメインは関係性関連の機能のみを担当しなければならない (MUST)。

#### Scenario: Relationship Domain Responsibilities

- **GIVEN** Relationship ドメインが存在する
- **THEN** 以下の機能を提供する:
  - Follow（フォロー・フォロワー管理、承認制）
  - Block（ブロック管理）
  - Favorite（お気に入り管理）
- **AND** 以下の機能は提供しない:
  - Post（投稿管理）
  - Like（いいね）
  - Comment（コメント）

### Requirement: Relationship Query APIs

Relationship ドメインは他ドメインからの問い合わせに応答しなければならない (MUST)。

#### Scenario: Get Following Cast IDs

- **GIVEN** Relationship ドメインの `ListFollowing` API
- **WHEN** guest_id を指定して呼び出す
- **THEN** そのゲストがフォロー中の cast_id リストが返される
- **AND** status が `approved` のフォローのみが含まれる

#### Scenario: Get Blocked User IDs

- **GIVEN** Relationship ドメインの `ListBlocked` API
- **WHEN** user_id を指定して呼び出す
- **THEN** そのユーザーがブロック中の user_id リストが返される

#### Scenario: Get Favorite Cast IDs

- **GIVEN** Relationship ドメインの `ListFavorites` API
- **WHEN** guest_id を指定して呼び出す
- **THEN** そのゲストがお気に入り登録した cast_id リストが返される

## MODIFIED Requirements

### Requirement: Follow Service Location

Follow Service は `relationship` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `relationship` ドメイン

#### Scenario: Follow Service in Relationship Domain

- **GIVEN** Relationship ドメインが存在する
- **WHEN** フォロー関連の API が呼び出される
- **THEN** `relationship` ドメインの FollowService が処理する
- **AND** proto パッケージは `relationship.v1` である

### Requirement: Block Service Location

Block Service は `relationship` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `relationship` ドメイン

#### Scenario: Block Service in Relationship Domain

- **GIVEN** Relationship ドメインが存在する
- **WHEN** ブロック関連の API が呼び出される
- **THEN** `relationship` ドメインの BlockService が処理する
- **AND** proto パッケージは `relationship.v1` である

### Requirement: Favorite Service Location

Favorite Service は `relationship` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `relationship` ドメイン

#### Scenario: Favorite Service in Relationship Domain

- **GIVEN** Relationship ドメインが存在する
- **WHEN** お気に入り関連の API が呼び出される
- **THEN** `relationship` ドメインの FavoriteService が処理する
- **AND** proto パッケージは `relationship.v1` である

### Requirement: Block Removes Follow

ユーザーをブロックすると、フォロー関係も自動的に解除されなければならない (MUST)。ドメイン分割後も Block 時のフォロー削除は Relationship ドメイン内で完結する。

#### Scenario: Block Removes Follow in Same Domain

- **GIVEN** Relationship ドメインが存在する
- **WHEN** キャストがゲストをブロックする
- **THEN** ブロックリストに追加される
- **AND** 該当ゲストのフォロー関係が削除される
- **AND** この処理は Relationship ドメイン内で完結する
