## ADDED Requirements

### Requirement: Cast Profile Data Model
The system SHALL support the storage and management of Cast Profiles with the following structure.

#### Scenario: Data Definition
- **WHEN** a cast registers
- **THEN** the following data structure is supported

# Cast Profile Specification

## 1. Data Model

### Basic Info
| Field | Type | Required | Description |
|---|---|---|---|
| `nickname` | string | Yes | 源氏名。Unique constraintは不要（同名はありうる）。 |
| `tagline` | string | Yes | 検索結果や一覧で表示される「一言キャッチコピー」。20文字以内推奨。 |
| `bio` | string | Yes | 詳細な自己紹介。マークダウン等は非対応、プレーンテキスト。 |
| `service_category` | enum | Yes | `advanced`, `standard`, `social` |
| `location_type` | enum | Yes | `store`, `dispatch`, `hotel` |
| `area` | string | Yes | 活動エリア（例: Roppongi, Kabukicho）。初期はフリーテキストだが、将来的にマスタ化推奨。 |
| `social_links` | json | No | 外部SNSリンク集 (`{ cityheaven?: url, x?: url, instagram?: url, tiktok?: url, litlink?: url, others?: url[] }`). |

### Visuals
| Field | Type | Required | Description |
|---|---|---|---|
| `gallery` | url[] | Yes (1+) | ポートフォリオ画像。最低1枚必須。3枚以上推奨。**1枚目は自動的にカバー写真およびプロフィールアイコンとして扱われる。** |

## 2. Validation Rules
- **Nickname**: 空文字不可。特殊文字（絵文字）は許容。
- **Bio**: 最低100文字以上（推奨）だが、システム的には10文字以上で通過とする。
- **Gallery**: アップロードされた画像のURLが必要。Onboarding中は一時ストレージ、Publish時に確定。

## 3. UI Components
- `ProfileEditForm`: 基本情報入力用フォーム。
- `PhotoUploader`: 画像アップロード、プレビュー、並び替え機能。
