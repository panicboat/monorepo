# Portfolio Spec Delta

## CHANGED Requirements

### Requirement: Enhanced Cast Profile Data

システムは、UI要件に合わせてキャストプロフィールの詳細な身体的・個人的属性をサポートしなければならない (MUST)。

#### Data Model

`CastProfile` に以下のフィールドを追加:

| Field | Type | Description |
|-------|------|-------------|
| `age` | int32 | 年齢 |
| `height` | int32 | 身長 (cm) |
| `blood_type` | string | 血液型 (A/B/O/AB/Unknown) |
| `three_sizes` | ThreeSizes | スリーサイズ |
| `tags` | repeated string | 自由記述タグ |

`ThreeSizes` メッセージ:

| Field | Type | Description |
|-------|------|-------------|
| `bust` | int32 | バスト (cm) |
| `waist` | int32 | ウエスト (cm) |
| `hip` | int32 | ヒップ (cm) |
| `cup` | string | カップサイズ (A-M) |

#### Scenario: Physical Attributes

- **Given** プロフィールを編集中のキャストユーザーが
- **When** 年齢、身長、血液型、スリーサイズ（B/W/H/Cup）を入力したとき
- **Then** これらのフィールドがバックエンドに永続化されなければならない (MUST)
- **And** `GetCastProfile` レスポンスで返却されなければならない (MUST)

#### Scenario: Tag Management

- **Given** キャストユーザーが
- **When** 自由記述のタグ（例：「英語OK」、「モデル」）を追加または削除したとき
- **Then** システムはプロフィールに関連付けられたタグのリストを永続化しなければならない (MUST)
