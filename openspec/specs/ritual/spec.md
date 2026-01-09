# ritual Specification

## Purpose
TBD - created by archiving change feat-reservation-detail. Update Purpose after archive.
## Requirements
### Requirement: Reservation Detail View
キャストは、個別の予約の詳細情報を閲覧できなければならない (MUST be able to view)。

#### Scenario: Viewing reservation details
- **WHEN** キャストがダッシュボードで予約カードをクリックしたとき
- **THEN** 予約詳細ページに遷移する
- **AND** システムは以下を表示する:
  - ゲスト名とアイコン
  - 日付、時刻、所要時間
  - 場所（住所/マップリンク）
  - プラン詳細とオプション
  - 支払いステータスと金額（見込み）

