## ADDED Requirements
### Requirement: Guest Profile View (CRM)
キャストは、接客（サービス）の準備のために、ゲストのプロフィールと履歴を閲覧できなければならない (MUST be able to view)。

#### Scenario: Viewing guest profile
- **WHEN** キャストが予約詳細でゲストのアイコンまたは名前をクリックしたとき
- **THEN** ゲストプロフィールモーダル/シートが開く
- **AND** システムは以下を表示する:
  - ゲスト基本情報（名前、年齢、職業 - 公開されている場合）
  - Trustスコア / レーティング（該当する場合）
  - 来店履歴（過去の日付、指名したキャスト）
  - キャストによるこのゲストへのプライベートメモ (CRM)
