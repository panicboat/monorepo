# Navigation Spec Delta

## MODIFIED Requirements

### Requirement: Navigation Items Update
キャストのナビゲーションバーの項目は以下の順序と構成に変更されなければならない (MUST)。
- Home
- Timeline
- MyPage

**Note**: Concierge タブは削除され、Schedule は Timeline に名称変更。

#### Scenario: Verify Navigation Items
1. キャストがアプリにログインする。
2. 画面下部のナビゲーションバーを確認する。
3. 左から順に "Home", "Timeline", "MyPage" が表示されていることを確認する。
4. "Concierge" タブが存在しないことを確認する。
5. "Schedule" タブが存在しないことを確認する（Timelineに統合）。

#### Scenario: MyPage Navigation
1. "MyPage" タブをタップする。
2. マイページ画面 (`/manage/mypage`) に遷移することを確認する。
