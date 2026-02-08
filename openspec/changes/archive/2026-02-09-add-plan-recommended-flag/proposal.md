# Change: Add Recommended Flag to Cast Plans

## Why

キャストが複数のプランを提供している場合、ゲストがどのプランを選べばよいか迷うことがある。キャストが推奨するプランに「おすすめ」フラグを設定できるようにすることで、ゲストの意思決定をサポートし、コンバージョン率の向上が期待できる。

## What Changes

- `cast_plans` テーブルに `is_recommended` カラムを追加
- Proto 定義 (`CastPlan` message) に `is_recommended` フィールドを追加
- キャスト管理画面（PlanEditor）でおすすめフラグの設定 UI を追加（1つのみ選択可能）
- ゲスト向け詳細ページでおすすめバッジを表示
- おすすめフラグが付いたプランを優先的に上位に表示

## Impact

- Affected specs: `portfolio`
- Affected code:
  - Backend: `services/monolith/workspace/slices/portfolio/` (migration, relation, server)
  - Proto: `proto/portfolio/v1/service.proto`
  - Frontend: `web/nyx/workspace/src/modules/portfolio/` (PlanEditor, CostAndSchedule)
