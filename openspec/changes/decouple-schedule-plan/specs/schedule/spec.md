# Schedule Spec Delta

## MODIFIED Requirements

### Requirement: Independent Schedule Management (MUST)

スケジュール情報（Schedules）は、プラン情報（Plans）とは**完全に独立した**エンティティとして管理・永続化されなければならない (MUST)。スケジュールはプランへの参照を持ってはならない (MUST NOT)。

#### Scenario: Schedule Persistence Without Plan Reference

- **Given** スケジュール入力ステップにいるユーザーであるとき
- **When** 複数のスケジュールを入力して保存すると
- **Then** スケジュールデータが DB に保存される
- **And** スケジュールデータはプランへの参照（plan_id）を含まない

#### Scenario: Schedule Data Structure

- **Given** スケジュールデータモデルがあるとき
- **Then** 以下のフィールドのみを含む:
  - `id`: UUID
  - `cast_id`: キャストへの参照
  - `date`: 日付（YYYY-MM-DD）
  - `start_time`: 開始時刻（HH:mm）
  - `end_time`: 終了時刻（HH:mm）
- **And** `plan_id` フィールドは存在しない

#### Scenario: API Response Structure

- **Given** キャストプロフィール取得 API を呼び出すとき
- **When** レスポンスに schedules が含まれる
- **Then** 各 schedule は以下のフィールドのみを含む:
  - `date`: 日付
  - `start_time`: 開始時刻
  - `end_time`: 終了時刻
- **And** `plan_id` フィールドは含まれない

#### Scenario: Schedule and Plan Independence

- **Given** キャストにスケジュールとプランが設定されているとき
- **When** プランを削除すると
- **Then** スケジュールは影響を受けない
- **And** スケジュールはそのまま維持される

### Requirement: Schedule Display (MUST)

スケジュール表示は、プランとの紐付けなしに、稼働可能時間のみを表示しなければならない (MUST)。

#### Scenario: Display Schedule Calendar

- **Given** キャスト詳細ページを閲覧しているとき
- **When** スケジュールカレンダーが表示されると
- **Then** 日付ごとの稼働可能時間帯が表示される
- **And** プラン情報との関連付けは表示されない

#### Scenario: Plan Display Without Schedule Association

- **Given** キャスト詳細ページを閲覧しているとき
- **When** プラン一覧が表示されると
- **Then** すべてのプランが独立したリストとして表示される
- **And** スケジュールとの関連付けによる活性/非活性の表示はない
- **And** 日付が選択されている場合、スケジュールが存在すれば全プランが活性表示される

## REMOVED Requirements

### ~~Requirement: Schedule-Plan Association~~

~~スケジュールは特定のプランに紐付けることができる (MAY)。~~

この要件は削除。Schedule と Plan の関連付けは不要となった。
