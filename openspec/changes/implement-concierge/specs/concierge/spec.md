## MODIFIED Requirements

### Requirement: Concierge Chat Interface
システムは、キャストがゲストとリアルタイムでメッセージをやり取りできるチャットインターフェースを提供しなければならない (SHALL provide chat interface)。メッセージはバックエンドに永続化され、両者がアクセス可能である。

#### Scenario: View Message History
- **WHEN** キャストがコンシェルジュページを開いたとき
- **THEN** ゲストとの過去のメッセージ履歴が表示される

#### Scenario: Send Message
- **WHEN** キャストがメッセージを入力し送信ボタンを押したとき
- **THEN** メッセージが送信され、履歴に追加される
- **AND** 相手側のチャット画面に新しいメッセージが表示される

#### Scenario: View Conversation List
- **WHEN** キャストがコンシェルジュ一覧ページを開いたとき
- **THEN** 全てのゲストとの会話が最終メッセージ日時順で表示される
- **AND** 未読メッセージ数がバッジで表示される

#### Scenario: Mark as Read
- **WHEN** キャストがチャットルームを開いたとき
- **THEN** その会話の未読メッセージが既読としてマークされる

## ADDED Requirements

### Requirement: Guest Chat Interface (MUST)
システムは、ゲストがキャストとメッセージをやり取りできるチャットインターフェースを提供しなければならない (MUST)。

#### Scenario: Guest Sends Message
- **WHEN** ゲストがチャットルームでメッセージを入力し送信したとき
- **THEN** メッセージがキャストに送信される
- **AND** 履歴に追加される

#### Scenario: Guest Views Conversation List
- **WHEN** ゲストがコンシェルジュ一覧ページを開いたとき
- **THEN** 全てのキャストとの会話が表示される

### Requirement: Message Types (MUST)
システムは、複数の種類のメッセージ（テキスト、招待状、システム）をサポートしなければならない (MUST)。

#### Scenario: Send Text Message
- **WHEN** ユーザーがテキストメッセージを送信したとき
- **THEN** 通常のテキストとして表示される

#### Scenario: Send Invitation Message
- **WHEN** キャストが招待状を送信したとき
- **THEN** 招待状カードとして表示される（日時、プラン、料金を含む）

#### Scenario: Display System Message
- **WHEN** システムイベント（予約確定、キャンセル等）が発生したとき
- **THEN** システムメッセージとして会話に表示される
