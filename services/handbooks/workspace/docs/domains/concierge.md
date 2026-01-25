---
sidebar_position: 50
---

# Concierge Domain

WebSocket を扱う「リアルタイム系」のサービス。

## Responsibilities

- チャットルームの管理
- メッセージの送受信
- 招待状（Invitation）のペイロード生成
- 未読管理
- Web Push 通知のトリガー

## Database Tables

- `rooms` - チャットルーム
- `messages` - メッセージ

## Why Separate?

スケーリングの特性（CPU/メモリ負荷）が他と全く異なるため。長時間のコネクション維持が必要で、RDB よりも NoSQL（Cassandra や DynamoDB）や、軽量な KV ストアが向いている場合がある。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/concierge/` |
| Frontend | `web/nyx/workspace/src/modules/concierge/` |
| Proto | `proto/concierge/v1/service.proto` |

## Status

**未実装** - UI のみモックで存在

## Related Specs

- `openspec/specs/concierge/`
