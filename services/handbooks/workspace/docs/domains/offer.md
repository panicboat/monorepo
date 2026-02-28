---
sidebar_position: 25
---

# Offer Domain

キャストが「何を・いつ・いくらで提供するか」を管理するドメイン。Portfolio（静的な発見情報）から分離し、動的な提供情報を専門に扱う。

## Status

**Implemented** - Portfolio ドメインから Plan/Schedule 機能を移行済み。

## Responsibilities

- 料金プラン（Plan）の管理
- スケジュール（Schedule）の管理
- 提供可能な時間枠の計算

## Why Separate?

Portfolio は「キャストを見つける・知る」という**発見（Discovery）**の文脈を担当する。一方、Offer は以下の理由で分離する:

1. **性質の違い**: プロフィールは静的、スケジュールは動的（日々変化）
2. **予約との結合**: 将来の予約機能と密接に連携
3. **変更頻度の違い**: スケジュールは頻繁に更新される

## Database Tables

- `plans` - 料金プラン
- `schedules` - スケジュール

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/offer/` |
| Frontend | `web/nyx/workspace/src/modules/offer/` |
| Proto | `proto/offer/v1/service.proto` |

## Key APIs

### OfferService

- `GetPlans` - 料金プラン取得
- `SavePlans` - 料金プラン保存
- `GetSchedules` - スケジュール取得
- `SaveSchedules` - スケジュール保存

## Domain Relationships

```
Portfolio (発見)          Offer (提供)
├── Cast Profile         ├── Plan
├── Photos               ├── Schedule
├── Areas                └── Availability
└── Status
         ↓                      ↓
    「どんな人か」          「何を提供するか」
```