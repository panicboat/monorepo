## ADDED Requirements
### Requirement: Cast Plans Management Page
キャストは `/cast/plans` ページで料金プランを管理できなければならない (MUST)。データはバックエンドに永続化される。

#### Scenario: View Existing Plans
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** `/cast/plans` にアクセスしたとき
- **THEN** バックエンドから取得した既存のプラン一覧が表示される
- **AND** プランがない場合は空の状態で表示される

#### Scenario: Add New Plan
- **GIVEN** `/cast/plans` ページにいる
- **WHEN** 新しいプランを追加して保存したとき
- **THEN** プランがバックエンドに永続化される
- **AND** 成功メッセージが表示される

#### Scenario: Edit Existing Plan
- **GIVEN** 既存のプランがある状態で
- **WHEN** プランの内容（名前、時間、価格）を編集して保存したとき
- **THEN** 変更内容がバックエンドに永続化される

#### Scenario: Delete Plan
- **GIVEN** 既存のプランがある状態で
- **WHEN** プランを削除して保存したとき
- **THEN** プランがバックエンドから削除される
