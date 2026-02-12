# Proposal: Decouple Schedule from Plan

## Summary

Schedule（スケジュール）と Plan（料金プラン）を完全に分離し、独立したエンティティとして管理する。

## Background

現在の実装では、`CastSchedule` が `plan_id` フィールドを通じて `CastPlan` に紐付けられている。これにより：

1. Schedule 保存時に Plan の存在を意識する必要がある
2. フロントエンドで Schedule と Plan を常にセットで処理している
3. Plan を削除すると関連する Schedule の `plan_id` が SET NULL になる

しかし、ビジネス要件として Schedule と Plan は本来独立した概念である：

- **Schedule**: キャストが「いつ」稼働可能か（時間的な利用可能性）
- **Plan**: キャストが「どのような」サービスを提供するか（サービス内容と価格）

この結合は将来の機能拡張（例：複数プランを組み合わせた予約、時間帯別プライシング等）の障壁となる。

## Goals

1. Schedule から Plan への参照（`plan_id`）を完全に削除する
2. Schedule と Plan を独立して CRUD 可能にする
3. API レスポンスから `plan_id` フィールドを削除する
4. フロントエンドの UI/UX をシンプル化する

## Non-Goals

- 新しい関連付けモデルの導入（例：予約時に Plan と Schedule を紐付ける）は本提案のスコープ外
- 既存データのマイグレーション（破壊的変更として `plan_id` カラムを削除）

## Affected Specs

- `portfolio` - Schedule 関連の Requirements を更新

## Impact

- **Breaking Change**: API レスポンスから `CastSchedule.plan_id` フィールドが削除される
- **Database**: `plan_id` カラムと外部キー制約を削除
- **Frontend/Backend**: 同時デプロイが必要
