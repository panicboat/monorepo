## ADDED Requirements

### Requirement: Cast Handle (MUST)
キャストはシステム内で一意の handle（ユーザー定義ID）を持たなければならない (MUST)。handle はプロフィールURLのキーとして使用される。

#### Scenario: Set handle during onboarding
- **GIVEN** 新規キャストがオンボーディング中である
- **WHEN** プロフィール入力ステップで handle を入力する
- **THEN** handle が英数字のみで、先頭が数字でないことが検証される
- **AND** handle がシステム内で一意であることが検証される
- **AND** 検証に成功した場合、handle が保存される

#### Scenario: Check handle availability
- **GIVEN** キャストが handle を入力している
- **WHEN** 入力内容が変更される
- **THEN** リアルタイムで handle の使用可否がフィードバックされる
- **AND** 既に使用されている場合は「この ID は使用できません」と表示される

#### Scenario: Edit handle
- **GIVEN** 既存のキャストプロフィールがある
- **WHEN** プロフィール編集画面で handle を変更する
- **THEN** 新しい handle の一意性が検証される
- **AND** 検証に成功した場合、handle が更新される

#### Scenario: Handle validation rules
- **GIVEN** キャストが handle を入力している
- **WHEN** 無効な形式の handle を入力する
- **THEN** 以下のバリデーションエラーが表示される:
  - 数字で始まる場合: 「先頭に数字は使用できません」
  - 英数字以外を含む場合: 「英数字のみ使用できます」
  - 空の場合: 「ID は必須です」

#### Scenario: Access profile by handle
- **GIVEN** handle が「sakura」のキャストが存在する
- **WHEN** ゲストが `/casts/sakura` にアクセスする
- **THEN** そのキャストのプロフィールページが表示される

#### Scenario: Handle not found
- **GIVEN** 存在しない handle でアクセスする
- **WHEN** ゲストが `/casts/nonexistent` にアクセスする
- **THEN** 404 Not Found が返される

## MODIFIED Requirements

### Requirement: Cast Profile Management (MUST)
キャストは自身のプロフィールを作成・管理できなければならない (MUST)。アバター画像はプロフィール画像とは独立して管理される。handle（ユーザー定義ID）は一意でなければならない。

#### Scenario: Create Profile
- **Given** 新規登録した直後のキャストユーザーであるとき
- **When** プロフィール作成画面で handle、名前、自己紹介、画像を登録すると
- **Then** キャストプロフィールが作成され、公開状態（またはステータス設定）となる
- **And** handle はシステム内で一意であることが保証される

#### Scenario: View Profile
- **Given** 作成済みのキャストプロフィールがあるとき
- **When** ゲストがそのキャストの handle を指定してプロフィールを取得すると
- **Then** handle、名前、自己紹介、ステータスなどの基本情報が返される
- **And** アバター画像が設定されている場合は `avatar_path` から表示される

#### Scenario: Avatar displayed in timeline author
- **Given** アバター画像を設定したキャストが投稿を作成している
- **When** タイムラインでその投稿を表示する
- **Then** 投稿の author 画像として `avatar_path` の画像が表示される

### Requirement: Guest-Facing Cast Profile API
システムは、ゲストがキャストの公開プロフィールを取得できる API を提供しなければならない (MUST)。

#### Scenario: Fetch public profile
Given ゲストユーザーである
When `/api/guest/casts/{handle}` にアクセスすると
Then キャストの公開プロフィール情報が返される
And 以下のフィールドが含まれる：handle, name, tagline, bio, locationType, area, serviceCategory, images, tags, socialLinks, plans, weeklySchedules

#### Scenario: Cast not found
Given 存在しない handle を指定した場合
When `/api/guest/casts/{handle}` にアクセスすると
Then 404 Not Found が返される

#### Scenario: Unpublished profile
Given キャストのプロフィールが未公開（draft/offline）の場合
When `/api/guest/casts/{handle}` にアクセスすると
Then 404 Not Found が返される
