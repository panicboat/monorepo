# Proposal: Chat Room Feature

## Why
ゲストがキャストとコミュニケーションを取り、予約（デート）を確定させるためのチャットルームが必要。
`demo` アプリのチャットUI（吹き出し、スタンプ、アクションバー）を `shell` に移植する。

## What Changes
`web/apps/shell` に以下の機能を追加する：
1.  **Chat Room Page (`/chats/[id]`)**:
    *   メッセージリスト（自分の送信、相手の返信、スタンプ）。
    *   アクションバー（テキスト入力、スタンプメニュー、チップ）。
    *   ヘッダー（キャスト情報、通話ボタン）。
2.  **UI Components**:
    *   `MessageBubble`: 吹き出しコンポーネント。
    *   `ChatInput`: 入力エリアコンポーネント。
3.  **Mock Data**:
    *   チャット履歴データ (`/api/chats/:id/messages`) の MSW モック。

## Impact
- `web/apps/shell`: 新規ページ (`app/chats/[id]/page.tsx`) とコンポーネント。
