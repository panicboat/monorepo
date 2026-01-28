## ADDED Requirements

### Requirement: Cast Avatar Image
キャストは専用のアバター画像を設定できなければならない (MUST)。アバターは画像ファイルのみ受付し、正方形にクロップして保存する。

#### Scenario: Upload avatar image
- **GIVEN** ログイン済みのキャストユーザーである
- **WHEN** アバター設定画面で画像ファイルを選択し、正方形にクロップして保存する
- **THEN** アバター画像が `avatar_path` としてサーバーに保存される
- **AND** タイムラインや検索結果でそのアバターが表示される

#### Scenario: Reject video as avatar
- **GIVEN** ログイン済みのキャストユーザーである
- **WHEN** アバターとして動画ファイルを選択しようとする
- **THEN** システムは動画ファイルを受け付けず、画像ファイルのみ選択可能であることを示す

#### Scenario: Avatar fallback
- **GIVEN** アバター画像が未設定のキャストである
- **WHEN** そのキャストのアバターを表示する場面がある
- **THEN** ポートフォリオの最初の画像ファイル（`image_path`）がフォールバックとして使用される
- **AND** ポートフォリオ画像もない場合はデフォルトアバターが表示される

#### Scenario: Square crop enforcement
- **GIVEN** アバター設定画面で画像を選択した
- **WHEN** 画像のアスペクト比が正方形でない場合
- **THEN** 正方形クロップ UI が表示され、ユーザーがトリミング範囲を選択できる
- **AND** クロップ後の画像のみがアップロードされる

## MODIFIED Requirements

### Requirement: Cast Profile Management (MUST)
キャストは自身のプロフィールを作成・管理できなければならない (MUST)。アバター画像はプロフィール画像とは独立して管理される。

#### Scenario: Create Profile
- **Given** 新規登録した直後のキャストユーザーであるとき
- **When** プロフィール作成画面で名前、自己紹介、画像を登録すると
- **Then** キャストプロフィールが作成され、公開状態（またはステータス設定）となる

#### Scenario: View Profile
- **Given** 作成済みのキャストプロフィールがあるとき
- **When** ゲストがそのキャストのIDを指定してプロフィールを取得すると
- **Then** 名前、自己紹介、ステータスなどの基本情報が返される
- **And** アバター画像が設定されている場合は `avatar_path` から表示される

#### Scenario: Avatar displayed in timeline author
- **Given** アバター画像を設定したキャストが投稿を作成している
- **When** タイムラインでその投稿を表示する
- **Then** 投稿の author 画像として `avatar_path` の画像が表示される
