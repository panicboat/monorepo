## ADDED Requirements

### Requirement: Smart Concierge (MUST)
システムは、チャットを通じて予約日程の調整を支援しなければならない。

#### Scenario: Send Invitation
- **WHEN** キャスト（モック）が招待状送信アクションを行ったとき
- **THEN** スマートドロワーが開き、空き枠（Availability）に基づいた推奨日時が表示される。
