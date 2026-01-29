## MODIFIED Requirements

### Requirement: Reservation Detail View
システムは、予約および招待の詳細情報（日時、料金、ステータス）を表示しなければならない (SHALL display reservation details)。データはバックエンドから取得される。

#### Scenario: View Reservation
- **GIVEN** キャストが予約詳細画面を表示するとき
- **WHEN** ページを開いたとき
- **THEN** ゲストの名前とアイコンが表示される
- **AND** 予約ステータス（招待中、誓約済み、完了、キャンセル）が表示される
- **AND** 日時と料金明細が表示される

### Requirement: Reject/Cancel Action
システムは、予約（招待）を取り消しまたはキャンセルする機能を提供しなければならない (SHALL provide cancel action)。

#### Scenario: Cancel Invitation
- **GIVEN** キャストが「招待中」の予約を表示しているとき
- **WHEN** 「招待を取り消す」ボタンをクリックしたとき
- **THEN** 招待が無効化される
- **AND** コンシェルジュにシステムメッセージが送信される

#### Scenario: Cancel Sealed Reservation
- **GIVEN** キャストが「誓約済み（Sealed）」の予約を表示しているとき
- **WHEN** 「キャンセル」ボタンをクリックしたとき
- **THEN** 予約がキャンセルされる（ペナルティ確認が表示される）
- **AND** コンシェルジュにシステムメッセージが送信される

## ADDED Requirements

### Requirement: Create Invitation (MUST)
キャストは、ゲストに対して招待状を作成・送信できなければならない (MUST)。

#### Scenario: Create Invitation from Chat
- **GIVEN** キャストがゲストとのチャットを開いているとき
- **WHEN** 「招待状を作成」ボタンをタップし、日時・プランを選択して送信したとき
- **THEN** 招待状がバックエンドに保存される
- **AND** チャットに招待状カードが送信される

#### Scenario: Select Available Time
- **WHEN** 招待状作成画面を開いたとき
- **THEN** キャストのスケジュールに基づいた空き時間が表示される
- **AND** 空き枠から日時を選択できる

### Requirement: Accept Invitation (MUST)
ゲストは、キャストからの招待状を受諾（誓約）できなければならない (MUST)。

#### Scenario: Accept Invitation
- **GIVEN** ゲストがチャットで招待状カードを受け取ったとき
- **WHEN** 「誓約する」ボタンをタップしたとき
- **THEN** 予約が「誓約済み」ステータスに変更される
- **AND** キャストに通知される

#### Scenario: Decline Invitation
- **GIVEN** ゲストがチャットで招待状カードを受け取ったとき
- **WHEN** 「辞退する」ボタンをタップしたとき
- **THEN** 招待状が辞退ステータスに変更される
- **AND** キャストに通知される

### Requirement: Reservation History (MUST)
キャストは、過去の予約履歴を一覧で確認できなければならない (MUST)。

#### Scenario: View History List
- **WHEN** キャストが履歴ページを開いたとき
- **THEN** 過去の予約が日付順で表示される
- **AND** 各予約のステータス、ゲスト名、プラン、金額が表示される

#### Scenario: Filter History
- **WHEN** キャストがフィルター条件（期間、ゲスト名、プラン）を指定したとき
- **THEN** 条件に合致する予約のみが表示される

### Requirement: Earnings Statistics (MUST)
キャストは、収益統計をダッシュボードで確認できなければならない (MUST)。

#### Scenario: View Earnings Summary
- **WHEN** キャストがホームダッシュボードを開いたとき
- **THEN** 今日/今週/今月の収益が表示される
- **AND** 予約件数と Promise Rate（履行率）が表示される

### Requirement: Upcoming Reservations (MUST)
キャストは、直近の予約一覧をダッシュボードで確認できなければならない (MUST)。

#### Scenario: View Upcoming List
- **WHEN** キャストがホームダッシュボードを開いたとき
- **THEN** 今日以降の確定済み予約が時系列で表示される
- **AND** 各予約のゲスト名、時間、プランが表示される
