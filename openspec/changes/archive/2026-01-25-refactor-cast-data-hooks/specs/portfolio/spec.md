## ADDED Requirements
### Requirement: Unified Cast Data Hooks
キャストのデータ管理は、再利用可能な hooks を通じて行わなければならない (MUST)。

#### Scenario: Use useCastProfile hook
- **GIVEN** キャスト向けページにいる
- **WHEN** プロフィールデータが必要なとき
- **THEN** `useCastProfile` hook を使用してデータを取得・更新する
- **AND** ローディング状態とエラー状態が提供される

#### Scenario: Use useCastPlans hook
- **GIVEN** キャスト向けページにいる
- **WHEN** プランデータが必要なとき
- **THEN** `useCastPlans` hook を使用してデータを取得・更新する

#### Scenario: Use useCastSchedules hook
- **GIVEN** キャスト向けページにいる
- **WHEN** スケジュールデータが必要なとき
- **THEN** `useCastSchedules` hook を使用してデータを取得・更新する

#### Scenario: Hooks share consistent data mapping
- **GIVEN** API からデータを取得したとき
- **WHEN** フロントエンドの状態にマッピングするとき
- **THEN** 共通のマッピングユーティリティを使用する
- **AND** オンボーディングとプロフィール編集で同じデータ構造を使用する

## REMOVED Requirements
### Requirement: Onboarding Store
**Reason**: 統一された hooks に置き換えられるため
**Migration**: 各オンボーディングページは個別の hooks を使用する
