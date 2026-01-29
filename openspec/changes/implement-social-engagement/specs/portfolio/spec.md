## ADDED Requirements

### Requirement: Followers Count (MUST)
キャストは、自分のフォロワー数をマイページで確認できなければならない (MUST)。

#### Scenario: View Followers Count
- **WHEN** キャストがマイページを開いたとき
- **THEN** 現在のフォロワー数が統計セクションに表示される

### Requirement: Followers List (SHALL)
キャストは、自分をフォローしているゲストの一覧を確認できなければならない (SHALL)。

#### Scenario: View Followers List
- **WHEN** キャストがフォロワーリストページを開いたとき
- **THEN** フォロワーのゲスト一覧が表示される
- **AND** 各ゲストの最終来店日時が表示される（履歴がある場合）
