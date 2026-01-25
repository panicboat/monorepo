## ADDED Requirements
### Requirement: Cast Schedules Management Page
キャストは `/cast/schedules` ページでスケジュールを管理できなければならない (MUST)。データはバックエンドに永続化される。

#### Scenario: View Existing Schedules
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** `/cast/schedules` にアクセスしたとき
- **THEN** バックエンドから取得した既存のスケジュール一覧が表示される
- **AND** スケジュールがない場合は空の状態で表示される

#### Scenario: Add New Schedule Entry
- **GIVEN** `/cast/schedules` ページにいる
- **WHEN** 新しいスケジュールエントリを追加して保存したとき
- **THEN** スケジュールがバックエンドに永続化される
- **AND** 成功メッセージが表示される

#### Scenario: Edit Existing Schedule
- **GIVEN** 既存のスケジュールエントリがある状態で
- **WHEN** スケジュールの内容（日付、開始時間、終了時間）を編集して保存したとき
- **THEN** 変更内容がバックエンドに永続化される

#### Scenario: Delete Schedule Entry
- **GIVEN** 既存のスケジュールエントリがある状態で
- **WHEN** エントリを削除して保存したとき
- **THEN** スケジュールがバックエンドから削除される

## MODIFIED Requirements
### Requirement: Schedule Management View

システムは、キャストがデフォルトのスケジュール時間を設定できなければならない (MUST)。

#### Scenario: Set Default Schedule Time

- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** プロフィール編集またはオンボーディングでデフォルトスケジュール時間を設定するとき
- **THEN** `defaultScheduleStart` と `defaultScheduleEnd` として保存される
- **AND** 将来の予約枠生成のためのデフォルト値として使用される

#### Scenario: View Default Schedule Time

- **GIVEN** キャストプロフィールが存在するとき
- **WHEN** プロフィール情報を取得するとき
- **THEN** `defaultScheduleStart` と `defaultScheduleEnd` が返される
- **AND** UI には「デフォルトスケジュール」として表示される

#### Scenario: Access Schedule Management Page
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** `/cast/schedules` にアクセスするとき
- **THEN** スケジュール管理ページが表示される
- **AND** URL は複数形 `/cast/schedules` を使用する（`/cast/schedule` ではない）
