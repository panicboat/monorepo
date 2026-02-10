# social Specification

## Purpose

キャストとゲスト間のソーシャル機能（フォロー、タイムライン、いいね、コメント）を提供する。

## ADDED Requirements

### Requirement: Follower List View

キャストは、自分をフォローしているゲストの一覧を確認できなければならない (MUST)。

#### Scenario: List Followers

- **WHEN** キャストが `/cast/followers` にアクセスする
- **THEN** システムは承認済みフォロワーの一覧を表示する
- **AND** 各フォロワーには以下の情報が含まれる:
  - ゲスト名
  - アバター画像（設定されている場合）
  - フォロー開始日
  - ブロックボタン
- **AND** フォロワーはフォロー開始日の降順（新しい順）でソートされる
- **AND** ブロック済みユーザーは一覧に含まれない

#### Scenario: Empty Follower List

- **WHEN** キャストにフォロワーがいない場合
- **THEN** システムは「フォロワーはいません」というメッセージを表示する
- **AND** タイムライン投稿を促すガイダンスを表示する

#### Scenario: Block from Follower List

- **WHEN** キャストがフォロワーのブロックボタンをタップする
- **THEN** 該当ゲストがブロックされる
- **AND** フォロー関係も同時に解除される
- **AND** 該当ゲストは一覧から消える

### Requirement: Follower API Endpoint

バックエンドは以下の API エンドポイントを提供しなければならない (MUST)。

#### Scenario: GET /api/cast/followers

- **WHEN** 認証済みキャストが `GET /api/cast/followers` を呼び出す
- **THEN** システムは承認済みフォロワーの一覧を返す
- **AND** ブロック済みユーザーは除外される
- **AND** レスポンスには `followers`, `total`, `hasMore` が含まれる

## MODIFIED Requirements

### Requirement: Block User Behavior

ユーザーをブロックすると、フォロー関係も自動的に解除されなければならない (MUST)。

#### Scenario: Block Removes Follow

- **WHEN** キャストがゲストをブロックする
- **THEN** ブロックリストに追加される
- **AND** 該当ゲストのフォロー関係が削除される
- **AND** 該当ゲストはキャストのタイムラインを閲覧できなくなる

#### Scenario: Blocked User Cannot Re-follow

- **WHEN** ブロック済みゲストがキャストをフォローしようとする
- **THEN** システムはフォローを拒否する
- **AND** フォロー関係は作成されない
