# Proposal: Cast Smart Scheduling & Invitation

- **Change ID:** `feat-cast-scheduling`
- **Author:** Antigravity
- **Status:** Proposed

## Summary
キャストのスケジュール管理機能と、チャット画面におけるスマートな招待状作成機能（ドロワー）を実装する。
提供された `cast_schedule_demo.html` と `chat_smart_invite_demo.html` をベースに移植を行う。

## Motivation
キャストとゲストの日程調整を円滑にするため。キャストは自身の空き状況を管理し、チャット中にその空き状況に基づいてスムーズに招待状を作成・送信できる必要がある。

## Proposed Changes

### Frontend (`web/heaven/apps/shell`)

#### Pages
- `src/app/cast/schedule/page.tsx`:
    - カレンダー表示によるスケジュール管理。
    - 「Available」状態の設定、削除。
    - Google Calendar連携ボタン（モック）。

#### Components
- `src/components/features/chat/SmartInvitationDrawer.tsx`:
    - チャット画面から引き出せるドロワーコンポーネント。
    - 空き枠（Today, Tomorrow etc.）の自動提案。
    - プラン（VIP/Short）の選択。
    - 招待状送信ボタン。

#### MSW Handlers
- `src/mocks/handlers/cast.ts`:
    - `GET /api/cast/schedule`: スケジュールデータの取得。
    - `POST /api/chats/:id/invitations`: 招待状の送信処理（擬似）。

## Verification Plan
1.  `/cast/schedule` ページを表示し、カレンダー操作ができることを確認。
2.  チャット画面 (`/cast/chats/[id]`) にドロワー呼び出しボタンを設置（または既存UIに組み込み）。
3.  ドロワーを開き、日時・プランを選択して「送信」できることを確認。
