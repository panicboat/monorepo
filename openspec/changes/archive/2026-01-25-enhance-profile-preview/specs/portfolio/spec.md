## ADDED Requirements

### Requirement: Guest-Facing Cast Profile API
システムは、ゲストがキャストの公開プロフィールを取得できる API を提供しなければならない (MUST)。

#### Scenario: Fetch public profile
Given ゲストユーザーである
When `/api/guest/casts/{id}` にアクセスすると
Then キャストの公開プロフィール情報が返される
And 以下のフィールドが含まれる：name, tagline, bio, locationType, area, serviceCategory, images, tags, socialLinks, plans, weeklySchedules

#### Scenario: Cast not found
Given 存在しないキャスト ID を指定した場合
When `/api/guest/casts/{id}` にアクセスすると
Then 404 Not Found が返される

#### Scenario: Unpublished profile
Given キャストのプロフィールが未公開（draft/offline）の場合
When `/api/guest/casts/{id}` にアクセスすると
Then 404 Not Found が返される

### Requirement: Cast Profile Detail Page Data Integration
ゲスト向けキャスト詳細ページは、API から取得した実データを表示しなければならない (MUST)。ハードコードされた mock データを表示してはならない (MUST NOT)。

#### Scenario: Display real profile data
Given キャスト詳細ページ `/casts/{id}` にアクセスしている
When ページが読み込まれると
Then API から取得したプロフィールデータが表示される
And ハードコードされた fallback 値は表示されない

#### Scenario: Display service information
Given キャスト詳細ページ `/casts/{id}` にアクセスしている
When ページが読み込まれると
Then キャストの plans（料金プラン）が表示される
And キャストの weeklySchedules（週間スケジュール）が表示される

#### Scenario: Display location and category
Given キャスト詳細ページ `/casts/{id}` にアクセスしている
When ページが読み込まれると
Then locationType（店舗/派遣/ホテル）が表示される
And area（活動エリア）が表示される
And serviceCategory（サービスカテゴリ）が表示される
