# navigation Specification

## Purpose

キャストがアプリ内を移動するためのナビゲーションバーを提供する。

## Requirements

### Requirement: Navigation Items Update
ナビゲーションバーの項目は以下の順序と構成でなければならない (MUST)。
- Home
- Timeline
- MyPage

#### Scenario: Verify Navigation Items
1. キャストがアプリにログインする。
2. 画面下部のナビゲーションバーを確認する。
3. 左から順に "Home", "Timeline", "MyPage" が表示されていることを確認する。

#### Scenario: MyPage Navigation
1. "MyPage" タブをタップする。
2. マイページ画面 (`/cast/mypage`) に遷移することを確認する。

#### Scenario: Home Navigation
1. "Home" タブをタップする。
2. ホーム画面 (`/cast/home`) に遷移することを確認する。

#### Scenario: Timeline Navigation
1. "Timeline" タブをタップする。
2. タイムライン画面 (`/cast/timeline`) に遷移することを確認する。
