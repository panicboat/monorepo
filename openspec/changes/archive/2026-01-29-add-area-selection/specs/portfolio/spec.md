## ADDED Requirements

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

## MODIFIED Requirements

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
