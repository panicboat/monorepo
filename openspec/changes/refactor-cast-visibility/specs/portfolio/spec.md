## MODIFIED Requirements

### Requirement: Cast Profile Management (MUST)
キャストは自身のプロフィールを作成・管理できなければならない (MUST)。visibility は公開設定（public/private）を制御し、オンボーディング完了状態は registered_at で判定する。

#### Scenario: Create Profile
- **Given** 新規登録した直後のキャストユーザーであるとき
- **When** プロフィール作成画面で handle、名前、自己紹介、画像を登録すると
- **Then** キャストプロフィールが作成される
- **And** registered_at は NULL のままである
- **And** visibility のデフォルト値は "public" である

#### Scenario: Complete Onboarding
- **Given** オンボーディング中のキャストユーザーであるとき
- **When** オンボーディングの最終ステップを完了すると
- **Then** registered_at に現在日時がセットされる
- **And** ゲストから検索・閲覧可能になる

#### Scenario: View Profile (Registered)
- **Given** registered_at がセットされたキャストプロフィールがあるとき
- **When** ゲストがそのキャストの handle を指定してプロフィールを取得すると
- **Then** プロフィール情報が返される

#### Scenario: View Profile (Unregistered)
- **Given** registered_at が NULL のキャストプロフィールがあるとき
- **When** ゲストがそのキャストの handle を指定してプロフィールを取得すると
- **Then** 404 Not Found が返される

#### Scenario: Change Visibility
- **Given** 登録済みのキャストユーザーであるとき
- **When** visibility を "private" に変更すると
- **Then** フォロー承認制が有効になる
- **And** 既存のフォロワーは維持される

## ADDED Requirements

### Requirement: Cast Registration Status (MUST)
システムはキャストのオンボーディング完了状態を registered_at カラムで管理しなければならない (MUST)。

#### Scenario: Initial State
- **Given** 新規キャストプロフィールを作成したとき
- **Then** registered_at は NULL である

#### Scenario: Registration Complete
- **Given** オンボーディングを完了したとき
- **Then** registered_at に完了日時がセットされる
- **And** 以降変更されない

#### Scenario: Guest Visibility
- **Given** registered_at が NULL のキャストは
- **Then** ゲスト向け API（検索、プロフィール取得）から除外される

#### Scenario: Search Excludes Unregistered
- **Given** registered_at が NULL のキャストが存在するとき
- **When** ゲストがキャスト検索を実行すると
- **Then** そのキャストは検索結果に含まれない

#### Scenario: Search Includes Public Cast
- **Given** registered_at がセットされ、visibility が "public" のキャストが存在するとき
- **When** ゲストがキャスト検索を実行すると
- **Then** そのキャストは検索結果に含まれる

#### Scenario: Search Includes Private Cast
- **Given** registered_at がセットされ、visibility が "private" のキャストが存在するとき
- **When** ゲストがキャスト検索を実行すると
- **Then** そのキャストは検索結果に含まれる
- **And** プロフィールは閲覧可能である
- **And** フォローするには承認が必要である

### Requirement: Visibility Settings (MUST)
キャストは自身の visibility（公開設定）を変更できなければならない (MUST)。

#### Scenario: Access Visibility Settings
- **Given** 登録済みのキャストユーザーであるとき
- **When** 設定画面にアクセスすると
- **Then** 現在の visibility 設定が表示される
- **And** public/private を切り替えるトグルが表示される

#### Scenario: Change to Private
- **Given** visibility が "public" のキャストであるとき
- **When** 設定画面で "private" に変更すると
- **Then** visibility が "private" に更新される
- **And** 以降のフォローは承認制になる
- **And** 既存のフォロワーは維持される

#### Scenario: Change to Public
- **Given** visibility が "private" のキャストであるとき
- **When** 設定画面で "public" に変更すると
- **Then** visibility が "public" に更新される
- **And** pending 状態のフォローリクエストは全て approved に自動昇格される
- **And** 以降のフォローは即時成立になる

#### Scenario: Visibility Change API
- **Given** 登録済みのキャストユーザーであるとき
- **When** SaveCastVisibility API を呼び出すと
- **Then** visibility が更新される
- **And** 更新後のプロフィール情報が返される

### Requirement: Private Cast Indicator (MUST)
private キャストは視覚的に識別可能でなければならない (MUST)。

#### Scenario: Display Lock Icon in Search Results
- **Given** visibility が "private" のキャストが検索結果に含まれるとき
- **When** ゲストが検索結果を閲覧すると
- **Then** キャスト名の横に南京錠アイコンが表示される

#### Scenario: Display Lock Icon on Profile
- **Given** visibility が "private" のキャストのプロフィールページを閲覧するとき
- **When** ゲストがプロフィールを表示すると
- **Then** キャスト名の横に南京錠アイコンが表示される

#### Scenario: No Lock Icon for Public Cast
- **Given** visibility が "public" のキャストが表示されるとき
- **When** ゲストがキャストを閲覧すると
- **Then** 南京錠アイコンは表示されない
