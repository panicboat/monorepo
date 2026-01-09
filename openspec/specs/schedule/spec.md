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
キャストは、自身のスケジュール（シフト）をカレンダー形式で確認・編集できなければならない (MUST be able to view and edit)。

#### Scenario: Viewing schedule editor
- **WHEN** キャストがナビゲーションメニューの「Schedule」をクリックしたとき
- **THEN** スケジュール編集ページが表示される
- **AND** 現在設定されているシフト（Weekly Plan）が表示される
- **AND** オンボーディングと同様のUI (`WeeklyShiftInput`) で編集が可能である

