# cast-guest-detail Specification

## Purpose

キャストがゲストの詳細情報を確認するための機能を提供する。

## ADDED Requirements

### Requirement: Guest Detail Page for Cast

キャストはゲストの詳細ページにアクセスできなければならない (MUST)。詳細ページではゲストの基本情報とフォロー関連情報を表示する。

#### Scenario: Access Guest Detail from Followers List

- **GIVEN** キャストがフォロワー一覧ページにいる
- **WHEN** ゲストの名前またはアバターをタップする
- **THEN** `/cast/guests/[id]` に遷移する
- **AND** ゲストの詳細情報が表示される

#### Scenario: Access Guest Detail from Likes

- **GIVEN** キャストが投稿のいいね一覧を閲覧している
- **WHEN** ゲストの名前またはアバターをタップする
- **THEN** `/cast/guests/[id]` に遷移する

#### Scenario: Access Guest Detail from Comments

- **GIVEN** キャストが投稿のコメント一覧を閲覧している
- **WHEN** ゲストの名前またはアバターをタップする
- **THEN** `/cast/guests/[id]` に遷移する

#### Scenario: Display Guest Information

- **GIVEN** キャストがゲスト詳細ページを閲覧している
- **THEN** 以下の情報が表示される:
  - アバター画像（未設定の場合はデフォルト画像）
  - 名前
  - タグライン（設定されている場合）
  - 自己紹介（設定されている場合）
  - フォロー開始日（フォローしている場合）

### Requirement: GetGuestProfileById API

システムはキャストが他のゲストのプロフィールを取得するための API を提供しなければならない (MUST)。

#### Scenario: Get Guest Profile Successfully

- **GIVEN** 認証済みのキャストユーザーである
- **WHEN** `GetGuestProfileById` を guest_id を指定して呼び出す
- **THEN** 指定したゲストのプロフィール情報が返される
- **AND** フォロー情報（フォロー中かどうか、フォロー開始日）が含まれる

#### Scenario: Guest Not Found

- **GIVEN** 認証済みのキャストユーザーである
- **WHEN** 存在しない guest_id で `GetGuestProfileById` を呼び出す
- **THEN** NOT_FOUND エラーが返される

#### Scenario: Unauthorized Access

- **GIVEN** ゲストユーザーまたは未認証ユーザーである
- **WHEN** `GetGuestProfileById` を呼び出す
- **THEN** PERMISSION_DENIED エラーが返される

### Requirement: Block Guest from Detail Page

キャストはゲスト詳細ページからゲストをブロックできなければならない (MUST)。

#### Scenario: Block Guest

- **GIVEN** キャストがゲスト詳細ページを閲覧している
- **WHEN** ブロックボタンをタップする
- **THEN** 確認ダイアログが表示される
- **AND** 確認後、ゲストがブロックされる
- **AND** ブロック一覧ページに遷移する

#### Scenario: Already Blocked Guest

- **GIVEN** キャストが既にブロック済みのゲストの詳細ページを閲覧している
- **THEN** ブロックボタンは「ブロック中」の状態で表示される
- **AND** ブロック解除の操作が可能である

## Related Capabilities

- `guest-profile` - ゲストプロフィールのデータモデルと基本 API
- `favorites` - いいね機能（導線元）
- `post-comments` - コメント機能（導線元）
