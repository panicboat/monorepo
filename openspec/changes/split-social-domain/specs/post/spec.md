# post Specification

## Purpose

投稿とそれに対するアクション（いいね、コメント）を管理するドメイン。

## ADDED Requirements

### Requirement: Post Domain Boundary

Post ドメインは投稿関連の機能のみを担当しなければならない (MUST)。

#### Scenario: Post Domain Responsibilities

- **GIVEN** Post ドメインが存在する
- **THEN** 以下の機能を提供する:
  - 投稿の CRUD
  - Like（投稿へのいいね）
  - Comment（投稿へのコメント・リプライ）
- **AND** 以下の機能は提供しない:
  - Follow（フォロー管理）
  - Block（ブロック管理）
  - Favorite（お気に入り管理）

### Requirement: Post Filtering API

Post ドメインは外部からのフィルタリング条件を受け付けなければならない (MUST)。

#### Scenario: List Posts with Exclusion

- **GIVEN** Post ドメインの `ListPublicPosts` API
- **WHEN** `exclude_user_ids` パラメータが指定される
- **THEN** 指定されたユーザーの投稿は結果から除外される
- **AND** Post ドメインはなぜ除外するのかを知る必要はない

#### Scenario: List Posts by Cast IDs

- **GIVEN** Post ドメインの `ListPublicPosts` API
- **WHEN** `cast_ids` パラメータが指定される
- **THEN** 指定されたキャストの投稿のみが返される

## MODIFIED Requirements

### Requirement: Post Service Location

PostService は `post` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `post` ドメイン

#### Scenario: PostService in Post Domain

- **GIVEN** Post ドメインが存在する
- **WHEN** 投稿関連の API が呼び出される
- **THEN** `post` ドメインの PostService が処理する
- **AND** proto パッケージは `post.v1` である

### Requirement: Like Service Location

LikeService は `post` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `post` ドメイン

#### Scenario: LikeService in Post Domain

- **GIVEN** Post ドメインが存在する
- **WHEN** いいね関連の API が呼び出される
- **THEN** `post` ドメインの LikeService が処理する
- **AND** proto パッケージは `post.v1` である

### Requirement: Comment Service Location

CommentService は `post` ドメインに配置されなければならない (MUST)。

> **FROM**: `social` ドメイン
> **TO**: `post` ドメイン

#### Scenario: CommentService in Post Domain

- **GIVEN** Post ドメインが存在する
- **WHEN** コメント関連の API が呼び出される
- **THEN** `post` ドメインの CommentService が処理する
- **AND** proto パッケージは `post.v1` である
