# Change: Concierge Feature (Phase 1)

## Why
Phase 1の完了に向け、キャストがゲストとコミュニケーションを取り、予約を促進するための「Concierge」機能を実装します。
既存のモック (`chat_smart_invite_demo.html`) をベースに、Manage画面内で実際に動作する機能として統合し、"Smart Invitation" によるスムーズな日程調整を実現します。

## What Changes
- **Cast Dashboard (/manage)** に `Concierge` ページを追加
- **Chat Interface**: メッセージ一覧と送信機能
- **Smart Invitation**:
    - 招待状作成ドロワーの実装
    - 日時選択（推奨・手動）
    - プラン選択
    - 招待状の送信

## Impact
- **Specs**: `concierge` spec の更新 (MODIFIED/ADDED)
- **Frontend**: `src/app/(cast)/manage/concierge` の実装, `src/components/ui` の活用
