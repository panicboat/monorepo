## REMOVED Requirements

### Requirement: Cast Home View
**Reason**: 売上サマリーと予約一覧は Ritual/Trust ドメインに属するため、3ドメイン構成では不要。
**Migration**: フォローリクエストと新着フォロワーに置き換え。

### Requirement: Cast Status Management
**Reason**: ステータス管理は Ritual ドメインに属するため、3ドメイン構成では不要。
**Migration**: 将来 Ritual ドメイン実装時に復活予定。

### Requirement: Reservation List Display
**Reason**: 予約リストは Ritual ドメインに属するため、3ドメイン構成では不要。
**Migration**: 将来 Ritual ドメイン実装時に復活予定。

### Requirement: Dashboard URL Change
**Reason**: 既に `/cast/home` に移行済みのため、この要件は不要。
**Migration**: 削除。

## MODIFIED Requirements

### Requirement: Navigation Integration
キャストのボトムナビゲーションバーは、キャストがホームにいる際に「Home」タブを正しくハイライト表示しなければならない (MUST correctly highlight)。

#### Scenario: Home tab active on home
- **WHEN** キャストが `/cast/home` にアクセスする
- **THEN** ボトムナビゲーションバーの「Home」タブがアクティブとしてハイライトされる
- **AND** 「Home」アイコンの下にアクティブインジケーターアニメーションが表示される

#### Scenario: Home tab inactive on other pages
- **WHEN** キャストが `/cast/schedules` または他のサブページに遷移する
- **THEN** 「Home」タブのハイライトが解除される
- **AND** 現在のページに対応するタブがハイライトされる

## ADDED Requirements

### Requirement: Follow Request List on Home
キャストは、ホーム画面で保留中のフォローリクエストを確認・管理できなければならない (MUST be able to view and manage).

#### Scenario: View pending follow requests
- **WHEN** キャストが `/cast/home` にアクセスする
- **THEN** システムは「フォローリクエスト」セクションを表示する
- **AND** 保留中のリクエストがある場合、リクエスト一覧（ゲスト名、アバター、リクエスト日時）が表示される
- **AND** 各リクエストに「承認」「拒否」ボタンが表示される

#### Scenario: Approve follow request
- **WHEN** キャストがフォローリクエストの「承認」ボタンをタップする
- **THEN** リクエストが承認され、リストから消える
- **AND** 承認成功のフィードバックが表示される

#### Scenario: Reject follow request
- **WHEN** キャストがフォローリクエストの「拒否」ボタンをタップする
- **THEN** リクエストが拒否され、リストから消える

#### Scenario: No pending requests
- **WHEN** キャストにフォローリクエストがない
- **THEN** 「フォローリクエストはありません」という空状態メッセージが表示される

### Requirement: New Followers List on Home
キャストは、ホーム画面で最近フォローしてくれたゲストを確認できなければならない (MUST be able to view).

#### Scenario: View new followers
- **WHEN** キャストが `/cast/home` にアクセスする
- **THEN** システムは「新着フォロワー」セクションを表示する
- **AND** 最近のフォロワー（直近7日間など）が一覧表示される
- **AND** 各フォロワーのアバター、名前、フォロー日時が表示される

#### Scenario: No new followers
- **WHEN** キャストに新着フォロワーがいない
- **THEN** 「新着フォロワーはいません」という空状態メッセージが表示される

#### Scenario: Navigate to follower profile
- **WHEN** キャストが新着フォロワーの行をタップする
- **THEN** そのゲストのプロフィール画面に遷移する
