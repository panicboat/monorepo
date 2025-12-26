# Proposal: Guest Application Features

## Why
ゲストユーザーがログインした後の主要な体験（ホーム画面、チャット一覧）を提供するため。
`demo` アプリで検証されたデザインと機能を `shell` アプリケーションに移行し、実際のユーザーフローを構築する。

## What Changes
`web/apps/shell` に以下の機能を追加する：
1.  **Guest Layout**: 共通のボトムナビゲーション (Home, Talk, History)。
2.  **Home Screen (`/home`)**:
    *   Following / Discover タブ切り替え。
    *   "PrivateHeaven" ヘッダー。
3.  **Chat List Screen (`/chats`)**:
    *   メッセージ一覧表示。
    *   未読/招待状タブ切り替え。

## Impact
- `web/apps/shell`: 新規ページ (`app/home/page.tsx`, `app/chats/page.tsx`) とコンポーネントの追加。
