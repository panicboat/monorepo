# Capability: Ritual

## MODIFIED Requirements

### Requirement: Reservation Detail View
システムは、予約および招待の詳細情報（日時、料金、ステータス）を表示しなければならない (SHALL display reservation details)。

#### Scenario: View Reservation
- **GIVEN** キャストが予約詳細画面を表示するとき
- **WHEN** ページを開いたとき
- **THEN** ゲストの名前とアイコンが表示される
- **AND** 予約ステータス（招待中、誓約済み、等）が表示される
- **AND** 日時と料金明細が表示される

## ADDED Requirements

### Requirement: Reject/Cancel Action
システムは、予約（招待）を取り消しまたはキャンセルする機能を提供しなければならない (SHALL provide cancel action)。

#### Scenario: Cancel Invitation
- **GIVEN** キャストが「招待中」の予約を表示しているとき
- **WHEN** 「招待を取り消す」ボタンをクリックしたとき
- **THEN** 招待が無効化される

#### Scenario: Cancel Sealed Reservation
- **GIVEN** キャストが「誓約済み（Sealed）」の予約を表示しているとき
- **WHEN** 「キャンセル」ボタンをクリックしたとき
- **THEN** 予約がキャンセルされる（ペナルティ確認が表示される）
