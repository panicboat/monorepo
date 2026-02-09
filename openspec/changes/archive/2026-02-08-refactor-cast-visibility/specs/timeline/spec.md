## ADDED Requirements

### Requirement: Follow Approval Workflow (MUST)
private キャストへのフォローは承認制でなければならない (MUST)。public キャストは即時フォローが成立する。

#### Scenario: Follow Public Cast
- **Given** visibility が "public" のキャストがいるとき
- **When** ゲストがフォローボタンを押すと
- **Then** 即座にフォロー関係が成立する（status: approved）
- **And** ゲストのタイムラインにキャストの投稿が表示される

#### Scenario: Request Follow Private Cast
- **Given** visibility が "private" のキャストがいるとき
- **When** ゲストがフォローリクエストを送ると
- **Then** フォローリクエストが作成される（status: pending）
- **And** キャストの承認待ち一覧に表示される

#### Scenario: Approve Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** キャストが承認すると
- **Then** status が "approved" に更新される
- **And** ゲストのタイムラインにキャストの投稿が表示される

#### Scenario: Reject Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** キャストが拒否すると
- **Then** フォローリクエストが削除される
- **And** ゲストは再度フォローリクエストを送れる

#### Scenario: Cancel Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** ゲストがリクエストをキャンセルすると
- **Then** フォローリクエストが削除される

#### Scenario: Change to Private
- **Given** public キャストが private に変更したとき
- **Then** 既存の approved フォローは維持される
- **And** 新規フォローは承認制になる

#### Scenario: Change to Public
- **Given** private キャストが public に変更したとき
- **Then** 既存の approved フォローは維持される
- **And** pending 状態のフォローリクエストは全て approved に自動昇格される
- **And** 新規フォローは即時フォローになる
