# concierge Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
### Requirement: Smart Concierge (MUST)
システムは、チャットを通じて予約日程の調整を支援しなければならない (MUST)。

#### Scenario: Send Invitation
- **WHEN** キャスト（モック）が招待状送信アクションを行ったとき
- **THEN** スマートドロワーが開き、空き枠（Availability）に基づいた推奨日時が表示される。

### Requirement: Smart Invitation
システムは、キャストがゲストに対して条件を指定した招待状を作成・送信する機能を提供しなければならない (SHALL provide smart invitation)。

#### Scenario: Create Invitation
- **GIVEN** キャストがゲストとのチャット画面を開いているとき
- **WHEN** 「招待状を作成」を選択したとき
- **THEN** 日時選択（推奨・指定）とプラン選択画面が表示される
- **AND** 「送信」を押すと招待状カードがチャットに送信される

### Requirement: Display Guest Profile
システムは、ゲストの基本情報を表示しなければならない (SHALL display guest profile)。

#### Scenario: View Guest Profile
- **GIVEN** キャストがゲスト詳細画面を表示するとき
- **WHEN** ページを開いたとき
- **THEN** ゲストの名前、アイコン、年齢、職業（ある場合）が表示される
- **AND** 過去の来店回数が表示される

### Requirement: Deep CRM (Notes)
システムは、過去のメモや運営からの引継ぎ事項（Deep CRM）を表示しなければならない (SHALL display CRM notes)。

#### Scenario: View CRM Notes
- **GIVEN** キャストがゲストについて詳しく知りたいとき
- **WHEN** メモセクションまでスクロールしたとき
- **THEN** 過去のメモ一覧（日付、内容）が表示される

### Requirement: Concierge Chat Interface
システムは、キャストがゲストとリアルタイムでメッセージをやり取りできるチャットインターフェースを提供しなければならない (SHALL provide chat interface)。

#### Scenario: View Message History
- **WHEN** キャストがコンシェルジュページを開いたとき
- **THEN** ゲストとの過去のメッセージ履歴が表示される

#### Scenario: Send Message
- **WHEN** キャストがメッセージを入力し送信ボタンを押したとき
- **THEN** メッセージが送信され、履歴に追加される

### Requirement: Smart Suggestions
システムは、キャストの空き状況に基づいて、招待状の日時を自動的に提案しなければならない (SHALL suggest available times)。

#### Scenario: Suggest Times
- **WHEN** 招待状作成画面を開いたとき
- **THEN** 「今日」「明日」などの近い日程の空き枠が優先的に表示される

