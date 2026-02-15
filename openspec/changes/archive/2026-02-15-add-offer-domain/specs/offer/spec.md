## ADDED Requirements

### Requirement: Offer Domain Scope
Offer ドメインは「キャストが提供するもの」を管理しなければならない (MUST)。これには料金プラン（Plan）と提供可能日時（Schedule）が含まれる。

#### Scenario: Domain Responsibility
- **GIVEN** システムアーキテクチャにおいて
- **THEN** Offer ドメインは以下を管理する:
  - 料金プラン（Plan）
  - 提供可能日時（Schedule）
- **AND** プロフィール情報（Portfolio）とは独立して管理される

### Requirement: Plan Management (MUST)
キャストは料金プランを管理できなければならない (MUST)。プランには名前、時間、価格が含まれる。

#### Scenario: Save Plans
- **GIVEN** キャストがログイン済みである
- **WHEN** 料金プランを保存する
- **THEN** プランが `cast_plans` テーブルに保存される
- **AND** 既存のプランは削除され、新しいプランで置き換えられる

#### Scenario: Get Plans
- **GIVEN** キャストに料金プランが設定されている
- **WHEN** プラン一覧を取得する
- **THEN** そのキャストの全プランが返される
- **AND** 各プランには id, name, duration_minutes, price が含まれる

### Requirement: Schedule Management (MUST)
キャストはスケジュール（提供可能日時）を管理できなければならない (MUST)。

#### Scenario: Save Schedules
- **GIVEN** キャストがログイン済みである
- **WHEN** スケジュールを保存する
- **THEN** スケジュールが `cast_schedules` テーブルに保存される
- **AND** 過去の日付のスケジュールは保持され、未来の日付のみ更新される

#### Scenario: Get Schedules
- **GIVEN** キャストにスケジュールが設定されている
- **WHEN** スケジュール一覧を取得する
- **THEN** 指定期間のスケジュールが返される
- **AND** 各スケジュールには id, date, start_time, end_time が含まれる

#### Scenario: Schedule Validation
- **GIVEN** キャストがスケジュールを入力する
- **WHEN** 開始時刻が終了時刻より後の場合
- **THEN** バリデーションエラーが返される

### Requirement: Offer Service API (MUST)
システムは OfferService gRPC API を提供しなければならない (MUST)。

#### Scenario: OfferService Endpoints
- **GIVEN** gRPC サービス定義において
- **THEN** 以下のエンドポイントが提供される:
  - `GetPlans`: 料金プラン取得
  - `SavePlans`: 料金プラン保存
  - `GetSchedules`: スケジュール取得
  - `SaveSchedules`: スケジュール保存

### Requirement: Cross-Domain Reference (MUST)
Offer ドメインは cast_id を通じて Portfolio ドメインのキャスト情報を参照しなければならない (MUST)。

#### Scenario: Cast Reference
- **GIVEN** Offer ドメインでプランまたはスケジュールを操作する
- **WHEN** cast_id が指定される
- **THEN** Portfolio ドメインの casts テーブルとの整合性が保証される
- **AND** 存在しない cast_id の場合はエラーが返される
