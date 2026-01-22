# schedule Specification

## Purpose
TBD - created by archiving change feat-cast-onboarding. Update Purpose after archive.
## Requirements
### Requirement: Schedule Data Model
The system SHALL support the storage of cast availability (shifts).

#### Scenario: Data Definition
- **WHEN** a cast defines availability
- **THEN** the following data structure is supported

# Schedule Specification

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

