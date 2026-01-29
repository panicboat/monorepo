# Change: Implement Concierge (Chat) System

## Why
キャストとゲストの間のコミュニケーション手段（チャット）が現在モックのみ。予約フロー（Ritual）の前提となるため、メッセージング機能を実装してリアルタイムなやり取りを可能にする。

## What Changes
- Concierge ドメインにメッセージング機能を実装
- 会話一覧・個別チャットルームをリアルデータ化
- 招待状（Invitation）カードの送受信機能
- 既読管理・未読カウント

## Impact
- Affected specs: `concierge`
- Affected code:
  - `services/monolith/workspace/slices/concierge/` (新規ドメイン)
  - `proto/concierge/v1/service.proto` (新規)
  - `web/nyx/workspace/src/app/(cast)/cast/concierge/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/guest/concierge/page.tsx`
  - `web/nyx/workspace/src/modules/concierge/` (新規モジュール)
