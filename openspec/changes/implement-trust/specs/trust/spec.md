## MODIFIED Requirements

### Requirement: Trust Visualization (MUST)
ユーザーは、キャストの信頼性とサービス品質を直感的に理解できなければならない (MUST be able to visually understand)。スコアは承認済みレビューから計算される。

#### Scenario: View Radar Chart
- **WHEN** キャストのレビューセクションを参照したとき
- **THEN** 5角形（Looks, Charm, Tech, Service, Love）のレーダーチャートが表示される
- **AND** 各軸のスコアは承認済みレビューの平均値である

#### Scenario: No Reviews Yet
- **WHEN** キャストにまだ承認済みレビューがないとき
- **THEN** レーダーチャートは表示されない（またはデフォルト値で表示）
- **AND** 「まだレビューがありません」メッセージが表示される

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

## ADDED Requirements

### Requirement: Submit Review (MUST)
ゲストは、完了した予約に対してレビューを投稿できなければならない (MUST)。

#### Scenario: Submit Review After Completion
- **GIVEN** ゲストの予約が「完了」ステータスになったとき
- **WHEN** レビュー投稿フォームにコメントと5軸評価を入力して送信したとき
- **THEN** レビューが「承認待ち」ステータスで保存される
- **AND** キャストにレビュー承認依頼が通知される

#### Scenario: Rate on Five Axes
- **WHEN** ゲストがレビューを投稿するとき
- **THEN** 5つの軸（Looks, Charm, Tech, Service, Love）それぞれに1-5のスコアを付けられる

### Requirement: Review Moderation (MUST)
キャストは、投稿されたレビューを承認または非承認できなければならない (MUST)。

#### Scenario: Approve Review
- **GIVEN** キャストがレビュー管理ページで承認待ちレビューを表示しているとき
- **WHEN** 「承認」ボタンをタップしたとき
- **THEN** レビューが「承認済み」ステータスに変更される
- **AND** レビューがキャスト詳細ページに公開される
- **AND** TrustScoreが再計算される

#### Scenario: Reject Review
- **GIVEN** キャストがレビュー管理ページで承認待ちレビューを表示しているとき
- **WHEN** 「非承認」ボタンをタップしたとき
- **THEN** レビューが「非承認」ステータスに変更される
- **AND** レビューは公開されない

#### Scenario: View Pending Reviews
- **WHEN** キャストがレビュー管理ページを開いたとき
- **THEN** 承認待ちのレビュー一覧が表示される
- **AND** 各レビューのゲスト名、コメント、評価が表示される

### Requirement: Display Reviews (MUST)
ゲストは、キャストの承認済みレビュー一覧を閲覧できなければならない (MUST)。

#### Scenario: View Review List
- **WHEN** ゲストがキャスト詳細ページのレビューセクションを開いたとき
- **THEN** 承認済みレビューが新しい順で表示される
- **AND** 各レビューのコメントと投稿日時が表示される
