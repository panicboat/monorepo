# Media Integration Specification

## Purpose

Media サービスを全ドメイン（Portfolio、Post、Feed）で統一的に利用するための仕様。

## Requirements

## ADDED Requirements

### Requirement: Media Reference for Post (MUST)

Post ドメインの投稿・コメントは、メディア情報を `media__files` テーブルへの参照として管理しなければならない (MUST)。

#### Scenario: 投稿にメディアを添付する

- **GIVEN** ログイン済みのキャストである
- **WHEN** 投稿フォームでメディアを選択し、Media API でアップロード・登録する
- **THEN** 返却された `media_id` が投稿に関連付けられる
- **AND** `post_media.media_id` に保存される

#### Scenario: 投稿のメディアを表示する

- **GIVEN** メディア付きの投稿がある
- **WHEN** タイムラインでその投稿を表示する
- **THEN** `media_id` 経由で `media__files` から URL を取得して表示する

---

### Requirement: Media Reference for Cast Profile (MUST)

Portfolio ドメインのキャストプロフィール画像は、`media__files` テーブルへの参照として管理しなければならない (MUST)。

#### Scenario: プロフィール画像を設定する

- **GIVEN** ログイン済みのキャストである
- **WHEN** プロフィール画像を Media API でアップロード・登録する
- **THEN** 返却された `media_id` がキャストの `profile_media_id` に保存される

#### Scenario: アバター画像を設定する

- **GIVEN** ログイン済みのキャストである
- **WHEN** アバター画像を Media API でアップロード・登録する
- **THEN** 返却された `media_id` がキャストの `avatar_media_id` に保存される

#### Scenario: ギャラリー画像を設定する

- **GIVEN** ログイン済みのキャストである
- **WHEN** 複数のギャラリー画像を Media API でアップロード・登録する
- **THEN** 各 `media_id` が `cast_gallery_media` テーブルに position 付きで保存される

#### Scenario: プロフィール画像を表示する

- **GIVEN** キャストプロフィールを取得する
- **WHEN** `profile_media_id` が設定されている
- **THEN** `media__files` から URL を取得して表示する

---

### Requirement: Media Reference for Guest Profile (MUST)

Portfolio ドメインのゲストアバター画像は、`media__files` テーブルへの参照として管理しなければならない (MUST)。

#### Scenario: ゲストアバターを設定する

- **GIVEN** ログイン済みのゲストである
- **WHEN** アバター画像を Media API でアップロード・登録する
- **THEN** 返却された `media_id` がゲストの `avatar_media_id` に保存される

#### Scenario: ゲストアバターを表示する

- **GIVEN** ゲストプロフィールを取得する
- **WHEN** `avatar_media_id` が設定されている
- **THEN** `media__files` から URL を取得して表示する

---

### Requirement: Unified Upload Endpoint (MUST)

全サービスは Media サービスの統一 API を通じてメディアをアップロードしなければならない (MUST)。

#### Scenario: Cast が画像をアップロードする

- **GIVEN** ログイン済みのキャストである
- **WHEN** `/api/media/upload-url` を呼び出す
- **THEN** MediaService.GetUploadUrl が実行される
- **AND** presigned URL と media_id が返される

#### Scenario: Guest が画像をアップロードする

- **GIVEN** ログイン済みのゲストである
- **WHEN** `/api/media/upload-url` を呼び出す
- **THEN** MediaService.GetUploadUrl が実行される
- **AND** presigned URL と media_id が返される

---

## REMOVED Requirements

### Requirement: Portfolio GetUploadUrl Removal (MUST)

Portfolio サービスの `GetUploadUrl` RPC は削除しなければならない (MUST)。

#### Scenario: 旧 API は存在しない

- **GIVEN** Portfolio.CastService を呼び出す
- **WHEN** GetUploadUrl メソッドを探す
- **THEN** そのメソッドは存在しない
- **AND** MediaService.GetUploadUrl を使用する

---

### Requirement: Legacy Columns Removal (MUST)

旧形式のカラムは削除しなければならない (MUST)。

#### Scenario: Post の旧カラムは存在しない

- **GIVEN** post__post_media テーブルを参照する
- **WHEN** スキーマを確認する
- **THEN** `url`, `thumbnail_url` カラムは存在しない
- **AND** `media_id` カラムのみが存在する

#### Scenario: Cast の旧カラムは存在しない

- **GIVEN** portfolio__casts テーブルを参照する
- **WHEN** スキーマを確認する
- **THEN** `image_path`, `avatar_path`, `images` カラムは存在しない
- **AND** `profile_media_id`, `avatar_media_id` カラムのみが存在する
