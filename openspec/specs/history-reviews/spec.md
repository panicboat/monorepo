# history-reviews Specification

## Purpose
TBD - created by archiving change feat-add-engagement. Update Purpose after archive.
## Requirements
### Requirement: Guest Reviews Viewing
ゲストはキャストのレビューを閲覧できなければならない (MUST be able to view reviews for a Cast).
#### Scenario: ゲストがキャストのレビューを閲覧する
- **Given** 私はキャストのプロフィールを閲覧しているゲストである
- **When** 私がレビューセクションまでスクロールする
- **Then** レビューの一覧（評価とコメント）が表示される
- **And** 統計サマリー（平均評価）が表示される

### Requirement: Cast Reviews Management
キャストは自身のレビューを管理・閲覧できなければならない (MUST be able to manage and view their reviews).
#### Scenario: キャストが自身のレビューを閲覧する
- **Given** 私はログイン済みのキャストである
- **When** 私がレビュー管理ページにアクセスする
- **Then** ゲストから投稿された全てのレビューが表示される
- **And** それらを評価や日付でフィルタリングできる

### Requirement: Cast Review Approval
キャストはゲストからのレビューを承認できなければならない (MUST be able to approve reviews).
#### Scenario: キャストがレビューを承認する
- **Given** 私は「承認待ち」のレビューがあるキャストである
- **When** 私がレビュー管理ページで「承認」ボタンをクリックする
- **Then** レビューのステータスが「公開」になる
- **And** それが私のプロフィールページに表示されるようになる

### Requirement: Cast Review Status Clarity
承認後のステータスが「公開」であることが明確でなければならない (MUST clearly indicate Public status after approval).
#### Scenario: 承認後の表示確認
- **Given** 私はレビューを承認した直後のキャストである
- **Then** そのレビューには「公開中」という明確な表示がある
- **And** 「非表示にする」操作が可能であることがわかる

### Requirement: Cast Review Visibility Management
キャストはレビューの公開ステータスをいつでも変更できなければならない (MUST be able to change review visibility at any time).
#### Scenario: キャストがレビューを非公開にする
- **Given** 私は「公開済み」のレビューがあるキャストである
- **When** 私がそのレビューのステータスを「非公開」に変更する
- **Then** そのレビューは私のプロフィールページから消える（管理画面には残る）

#### Scenario: キャストがレビューを再公開する
- **Given** 私は「非公開」のレビューがあるキャストである
- **When** 私がそのレビューのステータスを「公開」に変更する
- **Then** そのレビューは再び私のプロフィールページに表示される

### Requirement: Cast History
キャストは自身の履歴を閲覧できなければならない (MUST be able to view their reservation history).
#### Scenario: キャストが履歴を閲覧する
- **Given** 私はログイン済みのキャストである
- **When** 私が履歴ページにアクセスする
- **Then** 過去に完了した儀式（予約）の一覧が表示される
- **And** ゲストの詳細と支払いステータスを確認できる

