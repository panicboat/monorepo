---
sidebar_position: 60
---

# Trust Domain

非同期で処理しても良い「集計・分析系」のサービス。キャストの資産としての「信用」を管理する。

## Responsibilities

- レビューの投稿受付と保存
- レーダーチャート（5 角形パラメータ）の再計算
- 顧客の No Show カウントの管理
- キャスト用 CRM メモ（顧客カルテ）の管理

## Database Tables

- `reviews` - レビュー
- `radar_stats` - レーダーチャート統計
- `customers` - 顧客情報
- `customer_memos` - 顧客メモ

## Why Separate?

結果整合性（Eventual Consistency）で良い。レビュー投稿後、レーダーチャートへの反映は数秒遅れても問題ない。

## Asset Ownership

顧客リスト（CRM）や評価（Review）は、店の持ち物ではなく**キャスト個人の資産**とする。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/trust/` |
| Frontend | `web/nyx/workspace/src/modules/trust/` |
| Proto | `proto/trust/v1/service.proto` |

## Status

**未実装** - UI のみモックで存在

## Related Specs

- `openspec/specs/trust/`
- `openspec/specs/history-reviews/`
