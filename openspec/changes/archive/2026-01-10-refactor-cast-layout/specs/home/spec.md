# Cast Home Screen Requirements

## ADDED Requirements

### Requirement: Dashboard URL Change
現在のダッシュボード画面の URL は `/manage/dashboard` から `/manage/home` に変更されなければならない (MUST)。

#### Scenario: Accessing Home
1. ナビゲーションバーの "Home" をタップする。
2. URL が `/manage/home` であることを確認する。
3. 以前のダッシュボードと同じ内容が表示されていることを確認する。

#### Scenario: Legacy Redirect
1. ブラウザで `/manage/dashboard` にアクセスする。
2. `/manage/home` にリダイレクトされることを確認する。
