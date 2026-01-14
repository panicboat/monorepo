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

