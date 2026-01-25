---
sidebar_position: 40
---

# Ritual Domain

データの整合性が命となる「トランザクション系」のサービス。単なる予約ツールではなく、情緒的な「儀式」を提供する。

## Responsibilities

- 招待状（Offer）から予約（Confirmation）へのステータス遷移
- 「長押し」による確定処理（排他制御） - **The Pledge**
- No Show（無断キャンセル）のステータス更新
- 将来的な決済処理の統合

## Database Tables

- `reservations` - 予約

## Why Separate?

ビジネスの核（金銭や信用の授受）であり、他の機能の変更によるバグの影響を避けるため。絶対にデータをロストしてはいけない。ACID 特性が重要。

## The Ritual Experience

- **The Pledge (誓約):** 予約は事務処理ではない。「招待状」を受け取り、ボタンを「長押し (Long Press)」して誓いを立て、「封蝋 (Sealed)」アニメーションで確定する。
- **Sanctuary (秩序):** 無断キャンセル (No Show) はシステムレベルで厳罰化し、キャストの時間を守る。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/ritual/` |
| Frontend | `web/nyx/workspace/src/modules/ritual/` |
| Proto | `proto/ritual/v1/service.proto` |

## Status

**未実装** - UI のみモックで存在

## Related Specs

- `openspec/specs/ritual/`
