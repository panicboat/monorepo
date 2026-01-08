## ADDED Requirements

### Requirement: Schedule Data Model
The system SHALL support the storage of cast availability (shifts).

#### Scenario: Data Definition
- **WHEN** a cast defines availability
- **THEN** the following data structure is supported

# Schedule Specification

## 1. Data Model

### Shift (Availability)
| Field | Type | Required | Description |
|---|---|---|---|
| `cast_id` | uuid | Yes | FK to Casts |
| `start_at` | datetime | Yes | 空き枠の開始日時 |
| `end_at` | datetime | Yes | 空き枠の終了日時 |

※ MVPでは「休憩時間」などは考慮せず、連続した1つの枠として登録する。分割したい場合は複数のレコードとして登録する。

## 2. Onboarding Logic
- **Submission**: ウィザード完了時（Review Step）に一括送信される。
- **Scope**: 「直近7日間（今週）」または「翌週」を選択して入力可能。
- **Minimum**: 最低1件以上の登録を必須とする（アクティブなキャストであることを保証するため）。

## 3. UI Components
- `WeeklyShiftInput`: 週表示のリストUI。
- `TimeRangePicker`: 開始・終了時間を選択するドラムロール/プルダウン。
