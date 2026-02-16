# media Specification

## Purpose

メディアファイル（画像・動画）のライフサイクルを管理する共通ドメイン。

## ADDED Requirements

### Requirement: Media Domain Boundary

Media ドメインはメディアファイルの管理のみを担当しなければならない (MUST)。

#### Scenario: Media Domain Responsibilities

- **GIVEN** Media ドメインが存在する
- **THEN** 以下の機能を提供する:
  - メディアファイルのアップロード
  - メディアファイルの削除
  - メディアファイルの取得
  - メディアファイルのバッチ取得
- **AND** 以下の機能は提供しない:
  - メディアの所有者管理（Post や Profile との紐付け）
  - メディアの表示順序管理

### Requirement: Media Ownership Pattern

Media ドメインはメディアの所有者を管理しないこと (MUST)。

#### Scenario: Ownership Managed by Consumer Domains

- **GIVEN** Media ドメインが存在する
- **WHEN** Post ドメインがメディアを投稿に添付する
- **THEN** Post ドメインが `post.post_media` テーブルで関連を管理する
- **AND** Media ドメインは関連を知らない

#### Scenario: Shared Media Usage

- **GIVEN** Media ドメインが存在する
- **WHEN** Portfolio ドメインがプロフィール画像を設定する（将来）
- **THEN** Portfolio ドメインが関連を管理する
- **AND** 同じ `media.files` テーブルを参照する

### Requirement: Media Upload API

メディアアップロード API は `media_type` と `url` を必須としなければならない (MUST)。

#### Scenario: Upload Image

- **GIVEN** Media ドメインの `UploadMedia` API
- **WHEN** `media_type: "image"` と `url: "storage-key"` が指定される
- **THEN** 新しいメディアレコードが作成される
- **AND** メディア ID が返される

#### Scenario: Upload Video with Thumbnail

- **GIVEN** Media ドメインの `UploadMedia` API
- **WHEN** `media_type: "video"` と `thumbnail_url` が指定される
- **THEN** サムネイル付きのメディアレコードが作成される

### Requirement: Media Batch Retrieval

複数のメディアを一度に取得できなければならない (MUST)。

#### Scenario: Get Multiple Media

- **GIVEN** 複数のメディアが存在する
- **WHEN** `GetMediaBatch` API に複数の `media_ids` が指定される
- **THEN** 指定されたすべてのメディアが返される
- **AND** N+1 クエリは発生しない

### Requirement: Media Deletion

メディア削除時に関連するストレージファイルも削除すべきである (SHOULD)。

#### Scenario: Delete Media

- **GIVEN** メディアが存在する
- **WHEN** `DeleteMedia` API が呼び出される
- **THEN** メディアレコードが削除される
- **AND** 関連するストレージファイルの削除がトリガーされる

## MODIFIED Requirements

なし（新規ドメインのため）

## Database Schema

### media.files

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| media_type | VARCHAR(10) | "image" or "video" |
| url | TEXT | Storage key |
| thumbnail_url | TEXT | Thumbnail storage key (optional) |
| metadata | JSONB | Width, height, duration など |
| created_at | TIMESTAMP | 作成日時 |

## API Reference

### proto/media/v1/media_service.proto

```protobuf
service MediaService {
  rpc UploadMedia(UploadMediaRequest) returns (UploadMediaResponse);
  rpc DeleteMedia(DeleteMediaRequest) returns (DeleteMediaResponse);
  rpc GetMedia(GetMediaRequest) returns (GetMediaResponse);
  rpc GetMediaBatch(GetMediaBatchRequest) returns (GetMediaBatchResponse);
}
```
