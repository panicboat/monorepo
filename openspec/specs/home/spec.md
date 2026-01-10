# home Specification

## Purpose
TBD - created by archiving change refactor-cast-layout. Update Purpose after archive.

## Requirements
### Requirement: Dashboard URL Change
現在のダッシュボード画面の URL は `/manage/dashboard` から `/manage/home` に変更されなければならない (MUST)。

#### Scenario: Accessing Home
1. ナビゲーションバーの "Home" をタップする。
2. URL が `/manage/home` であることを確認する。
3. 以前のダッシュボードと同じ内容が表示されていることを確認する。

#### Scenario: Legacy Redirect
1. ブラウザで `/manage/dashboard` にアクセスする。
2. `/manage/home` にリダイレクトされることを確認する。

### Requirement: Cast Home View
キャストは、自身の現在の活動状況とパフォーマンスをまとめたホームビューにアクセスできなければならない (MUST be able to access)。

#### Scenario: Home initial load
- **WHEN** ログイン済みのキャストが `/manage/home` にアクセスする
- **THEN** システムは「Quick Stats」セクションを表示し、以下の情報を含む:
  - 本日の売上を円形式で表示（例: "¥45,000"）
  - 今週の売上
  - 今月の売上
  - 今月の予約確定数
  - 約束率（パーセンテージ）
  - フォロワー数
- **AND** システムは「Upcoming Reservations」セクションに今後の予約リストを表示する

#### Scenario: Home with no reservations
- **WHEN** ログイン済みのキャストが `/manage/home` にアクセスし、今後の予約が存在しない
- **THEN** システムは「Upcoming Reservations」セクションに空状態メッセージを表示する
- **AND** メッセージはキャストにスケジュールの更新を促す内容である

#### Scenario: Home data loading
- **WHEN** ホームがAPIからデータを取得中である
- **THEN** システムはQuick Statsカードにスケルトンローダーを表示する
- **AND** システムは予約リストにローディングインジケーターを表示する

#### Scenario: Home data fetch error
- **WHEN** ホーム読み込み中にAPIリクエストが失敗する
- **THEN** システムはリトライボタン付きのエラーメッセージを表示する
- **AND** システムはデバッグ用にエラーをログに記録する

### Requirement: Cast Status Management
キャストは、グローバルナビゲーションから直接、自身の稼働ステータスを切り替えられなければならない (MUST be able to toggle)。

#### Scenario: Status toggle display
- **WHEN** キャストがホーム画面を表示している
- **THEN** システムはトップナビゲーションバー（右側スロット）にステータス切り替えボタンを表示する
- **AND** ボタンは現在のステータスを適切なカラーインジケーターで示す

#### Scenario: Changing status to Online
- **WHEN** キャストがステータス切り替えドロップダウンから「Online」を選択する
- **THEN** システムは即座にUIに「Online」ステータスを反映する（Optimistic Update）
- **AND** システムは `/api/cast/status` に `{ "status": "online" }` を含むPUTリクエストを送信する
- **AND** ボタンは緑色のインジケーターを表示する

#### Scenario: Changing status to Offline
- **WHEN** キャストがステータス切り替えドロップダウンから「Offline」を選択する
- **THEN** システムはUIを「Offline」ステータスに更新する
- **AND** ボタンは灰色のインジケーターを表示する

#### Scenario: Changing status to Asking
- **WHEN** キャストがステータス切り替えドロップダウンから「Asking」（休止中・要相談）を選択する
- **THEN** システムはUIを「Asking」ステータスに更新する
- **AND** ボタンは黄色のインジケーターを表示する

#### Scenario: Changing status to Tonight
- **WHEN** キャストがステータス切り替えドロップダウンから「Tonight」（本日営業）を選択する
- **THEN** システムはUIを「Tonight」ステータスに更新する
- **AND** ボタンは青色のインジケーターを表示する

#### Scenario: Status update API failure
- **WHEN** ステータス更新のAPIリクエストが失敗する
- **THEN** システムはUIを前回のステータスに戻す（Optimistic Updateのロールバック）
- **AND** システムはエラーメッセージを含むトースト通知を表示する

### Requirement: Reservation List Display
キャストは、ホーム上で今後の予約を時系列順に表示できなければならない (MUST be able to view)。

#### Scenario: Reservation card display
- **WHEN** キャストに今後の予約が存在する
- **THEN** 各予約カードは以下を表示する:
  - ゲスト名またはイニシャル（例: "T様"）
  - 日付と開始時刻（例: "2026-01-10 19:00"）
  - プラン名と時間（例: "Standard 60min"）
  - ステータスバッジ（Confirmed / Pending / Completed）
- **AND** 予約は日時順（最も近いものが先）にソートされる

#### Scenario: Reservation status colors
- **WHEN** 予約カードを表示する
- **THEN** 「Confirmed」ステータスは緑色を使用する
- **AND** 「Pending」ステータスは黄色を使用する
- **AND** 「Completed」ステータスは灰色を使用する

### Requirement: Navigation Integration
キャストのボトムナビゲーションバーは、キャストがホームにいる際に「Home」タブを正しくハイライト表示しなければならない (MUST correctly highlight)。

#### Scenario: Home tab active on home
- **WHEN** キャストが `/manage/home` にアクセスする
- **THEN** ボトムナビゲーションバーの「Home」タブがアクティブとしてハイライトされる
- **AND** 「Home」アイコンの下にアクティブインジケーターアニメーションが表示される

#### Scenario: Home tab inactive on other pages
- **WHEN** キャストが `/manage/schedule` または他のサブページに遷移する
- **THEN** 「Home」タブのハイライトが解除される
- **AND** 現在のページに対応するタブがハイライトされる
