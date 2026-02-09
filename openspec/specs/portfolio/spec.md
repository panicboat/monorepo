# Portfolio Spec

## Purpose
Define the portfolio, timeline, and media interaction features for casts.
## Requirements
### Requirement: Rich Timeline Data Models
The system MUST support extended data models for media posts.

#### Scenario: PostItem Structure
- **Data Models**:
  - `PostItem` includes `media` array with `type` ('image' | 'video' | 'gif').
  - `PostMedia` includes `url`, `thumbnail`, `aspectRatio`.

### Requirement: Rich Timeline UI/UX
The system MUST provide a rich media timeline with list and grid views.

#### Scenario: Timeline View
- **List View**: Displays full media cards.
- **Grid View**: Displays 3-column mosaic grid.
- **Media Modal**: Tap to view full screen video/image.

### Requirement: Timeline Page Structure
The system MUST provide a dedicated timeline page with filters.

#### Scenario: Page Layout
- **Header**: Back button, Cast Name, Layout Toggle.
- **Filters**: All, Photos, Videos tabs.

### Requirement: Vow Completion Flow
The system MUST support the vow completion workflow where guests report completion and casts approve it.

#### Scenario: Guest Reports Completion and Review from My Page (マイページからの完了報告)
Given 予約終了時刻を過ぎたアクティブな誓約があり
When ゲストがマイページから「完了報告＆レビュー」フォームを入力し送信した時
Then キャストに「完了承認リクエスト」が送られるべきである
And レビュー内容はシステムに一時保存されるべきである

#### Scenario: Cast Approves Completion (キャストによる完了承認)
Given ゲストからの「完了承認リクエスト」がある状態で
When キャストが「承認」を実行した時
Then 誓約ステータスが「完了」になるべきである
And レビューがプロフィールに公開（または設定により非表示）されるべきである
And キャストはあとからレビューの表示/非表示を切り替え可能であるべきである

### Requirement: Timeline Interactions
The system MUST support interactive features such as liking and commenting on timeline posts.
#### Scenario: Liking a Post
Given タイムラインの投稿がある状態で
When ユーザーが「いいね」ボタンをタップした時
Then いいね数が増加すべきである
And ボタンの状態がアクティブ（ピンク色）に変更されるべきである

#### Scenario: Commenting on a Post
Given タイムラインの投稿がある状態で
When ユーザーがコメント欄にテキストを入力し
And 「送信」をタップした時
Then コメントが投稿のコメントリストに追加されるべきである

### Requirement: Cast URL Structure (MUST)
キャスト向け機能の URL は、一貫して `/cast` をプレフィックスとしなければならない (MUST)。

#### Scenario: Access Dashboard
- **Given** ログイン済みのキャストユーザーであるとき
- **When** URL `/cast/home` にアクセスすると
- **Then** キャスト用ダッシュボードが表示される。

#### Scenario: Access Onboarding
- **Given** 未完了のキャストユーザーであるとき
- **When** URL `/cast/onboarding` にアクセスすると
- **Then** オンボーディング画面が表示される。

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

### Requirement: Area Master Data (MUST)
システムは活動エリアのマスターデータをDB管理しなければならない (MUST)。エリアは都道府県とエリア名の2階層で構成される。

#### Scenario: List available areas
- **GIVEN** キャストがエリア選択画面を開く
- **WHEN** エリア一覧を取得する
- **THEN** 都道府県ごとにグループ化されたエリア一覧が返される
- **AND** 各エリアには id, prefecture, name, code が含まれる

#### Scenario: Filter areas by prefecture
- **GIVEN** キャストがエリア選択画面で都道府県を選択する
- **WHEN** 「東京都」を選択する
- **THEN** 東京都のエリアのみが表示される（渋谷, 新宿, 池袋, ...）

### Requirement: Cast Area Selection (MUST)
キャストは活動エリアをマスターデータから選択できなければならない (MUST)。複数エリアの選択が可能である。

#### Scenario: Select multiple areas
- **GIVEN** キャストがエリア選択画面を開いている
- **WHEN** 「渋谷」と「新宿」を選択して保存する
- **THEN** 両方のエリアがキャストに関連付けられる
- **AND** プロフィール表示時に両エリアが表示される

#### Scenario: Change selected areas
- **GIVEN** キャストに「渋谷」「新宿」が設定されている
- **WHEN** プロフィール編集で「渋谷」を削除し「池袋」を追加する
- **THEN** キャストのエリアが「新宿」「池袋」に更新される

#### Scenario: Area required during onboarding
- **GIVEN** キャストがオンボーディング中である
- **WHEN** エリアを選択せずに次へ進もうとする
- **THEN** 「エリアを選択してください」というエラーが表示される
- **AND** 最低1つのエリア選択が必須である

#### Scenario: Display areas on profile
- **GIVEN** キャストに複数のエリアが設定されている
- **WHEN** ゲストがそのキャストのプロフィールを閲覧する
- **THEN** 設定されたエリアがタグ形式で表示される

### Requirement: Portfolio Domain Integration (MUST)
Portfolio ドメインは、従来のトップレベル `cast` スライスに代わり、キャストのプロフィール管理ロジックを統合しなければならない (MUST)。

#### Scenario: Manage Cast Profiles
- **Given** ユーザーがキャストであるとき
- **When** プロフィールを更新すると
- **Then** `Portfolio` サービスが永続化を処理する
- **And** データは `Portfolio::Repositories::CastRepo` を介して保存される

### Requirement: Architectural Alignment (MUST)
システムは、ドメインロジックを適切なスライスに配置することで、Modular Monolith アーキテクチャを順守しなければならない (MUST)。

#### Scenario: Eliminate Top-Level Cast Slice
- **Given** モノリス構造において
- **Then** `Cast` 関連のロジックは `Portfolio` スライスに存在する
- **And** トップレベルの `Cast` スライスは存在しない

### Requirement: Incremental Onboarding Persistence (MUST)
システムは、キャストのオンボーディングプロセスにおいて、各ステップごとにユーザーの入力データをサーバーに永続化しなければならない (MUST)。

#### Scenario: Data Saving per Step
- **Given** オンボーディング中のユーザーであるとき
- **When** 任意のステップ（例：プロフィール入力）を完了して「次へ」を押すと
- **Then** 入力されたデータがサーバーに保存される

### Requirement: Independent Plan Management (MUST)
プラン情報（Plans）は、プロフィール情報とは独立したエンティティとして管理・永続化されなければならない (MUST)。

#### Scenario: Plan Persistence
- **Given** プラン入力ステップにいるユーザーであるとき
- **When** 複数のプランを入力して保存すると
- **Then** プロフィール情報とは別に、関連付けられたプランデータとしてDBに保存される

### Requirement: Resumption Flow (MUST)
システムは、ユーザーがオンボーディングを中断した場合でも、前回の続きから再開できなければならない (MUST)。

#### Scenario: Resume from Interruption
- **Given** オンボーディングを途中まで進めたユーザーであるとき
- **When** 再度オンボーディングページにアクセスすると
- **Then** 前回保存されたデータがフォームに入力された状態で表示される

### Requirement: Authenticated Steps (MUST)
オンボーディングの各入力ステップは、サーバーへのデータ保存を行うため、認証済みユーザーのみがアクセス可能でなければならない (MUST)。

#### Scenario: Unauthenticated Access
- **Given** 未ログインのユーザーであるとき
- **When** オンボーディングの入力ステップ（`/cast/onboarding/step-*`）にアクセスしようとすると
- **Then** ログイン画面にリダイレクトされる

### Requirement: Guest-Facing Cast Profile API
システムは、ゲストがキャストの公開プロフィールを取得できる API を提供しなければならない (MUST)。

#### Scenario: Fetch public profile
Given ゲストユーザーである
When `/api/guest/casts/{handle}` にアクセスすると
Then キャストの公開プロフィール情報が返される
And 以下のフィールドが含まれる：handle, name, tagline, bio, locationType, areas, serviceCategory, images, tags, socialLinks, plans, weeklySchedules
And areas は選択されたエリアオブジェクトの配列である

#### Scenario: Cast not found
Given 存在しない handle を指定した場合
When `/api/guest/casts/{handle}` にアクセスすると
Then 404 Not Found が返される

#### Scenario: Unpublished profile
Given キャストのプロフィールが未公開（draft/offline）の場合
When `/api/guest/casts/{handle}` にアクセスすると
Then 404 Not Found が返される

### Requirement: Cast Profile Detail Page Data Integration
ゲスト向けキャスト詳細ページは、API から取得した実データを表示しなければならない (MUST)。ハードコードされた mock データを表示してはならない (MUST NOT)。

#### Scenario: Display real profile data
Given キャスト詳細ページ `/casts/{handle}` にアクセスしている
When ページが読み込まれると
Then API から取得したプロフィールデータが表示される
And ハードコードされた fallback 値は表示されない

#### Scenario: Display service information
Given キャスト詳細ページ `/casts/{handle}` にアクセスしている
When ページが読み込まれると
Then キャストの plans（料金プラン）が表示される
And キャストの weeklySchedules（週間スケジュール）が表示される

#### Scenario: Display location and category
Given キャスト詳細ページ `/casts/{handle}` にアクセスしている
When ページが読み込まれると
Then locationType（店舗/派遣/ホテル）が表示される
And areas（活動エリア）がタグ形式で表示される
And serviceCategory（サービスカテゴリ）が表示される

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

