# Architecture Reset & Project Plan (2026.01)

## 1. Goal Description
「Ritual over Transaction（取引ではなく儀式を）」という哲学に基づき、Nyx.placeの現在の実装をリセットします。「店舗（Shop）」という概念を持たないCtoCプラットフォームとして再構築します。

## 2. Implementtion Strategy

### Directory Strategy
- **Design Source of Truth**: `hime-channel.com` (レイアウト、配色、密度、余白感など全てにおいて最優先)。
- **Functional Reference**: `demo/.html/` (Hime-Channelにない機能: 儀式、スマート招待状など。ただしデザインはHime-Channelに合わせる)。
- **Source**: `web/nyx/workspace/` (ここをリセット対象とします)。
- **Cleanup**:
    - `apps/shell/src/app/*` を削除 (レイアウトや共通設定が汎用的であれば保持)
    - `packages/features/*` を削除 (古いロジックのため)
    - `packages/ui/*` を整理 (基本プリミティブ以外はリセット)

### Modular Monolith Structure
Next.js App Router 上で以下のモジュール構成を採用します。
- **Root**: `apps/shell/src/`
    - `app/`: ルーティング層 (Next.js 14+)
    - `modules/ritual/`: 予約・スケジュール管理 (Reservation, Schedule)
    - `modules/concierge/`: チャット・通知ロジック (Chat, Notification)
    - `modules/trust/`: レビュー・CRM・プロフィール管理 (Review, CRM)
    - `modules/identity/`: 認証・ユーザーデータ (Auth, User)
    - `modules/portfolio/`: キャスト一覧・検索 (Cast List, Profile)
    - `components/`: 共通UIコンポーネント (Shared UI)

### Database Schema (Implemented)
- **Schema `cast`**:
    - `casts`: `id`, `user_id`, `name`, `bio`, `image_url`, `status` (online/tonight), `area`, `price_system`, `opentime`, `promise_rate`.
    - `availabilities`: `id`, `cast_id`, `start_time`, `end_time`, `status`.
    - `cast_plans`: (Existing) `id`, `cast_id`, `name`, `price`, `duration`.
- **Schema `ritual`**:
    - `rituals`: `id`, `cast_id`, `user_id`, `start_time`, `end_time`, `status` (pending/sealed), `price`.
- **Schema `identity`**:
    - `users`: (Existing) `id`, `email`, `role`.

### Component Implementation (Scaffold)
- **Source**: `apps/shell/src/`
- **Modules**:
    - `portfolio/components/CastList.tsx`: Logic for "Living Portfolio" (Top Page).
    - `ritual/components/RitualPledge.tsx`: "Long Press" -> "Sealed" Animation (Framer Motion).
    - `concierge/components/SmartDrawer.tsx`: Schedule Suggestion Drawer (Framer Motion).
- **Test Routes**:
    - `/` -> Cast List (Top)
    - `/ritual/test` -> Ritual Pledge Demo
    - `/chat/test` -> Smart Drawer Demo

## 3. Core Views & References
- **Cast List (Top Page)**: Realtime status focused. (Ref: `hime-channel` top)
- **Cast Profile**: Living Portfolio。(Ref: `hime-channel` profile + `profile_demo.html`)
- **Smart Concierge**: チャット & スケジューラー。(Ref: `chat_smart_invite_demo.html`)
- **Ritual**: 予約フロー。(Ref: `cast_schedule_demo.html`)

## 4. Verification Plan
- **Automated**: `Ritual` フロー（在庫引き落とし、予約確定）のドメインロジックテスト。
- **Manual**:
    - **Visual**: `hime-channel.com` とのビジュアル比較(White Theme)。
    - **Ritual**: `/ritual/test` にて「長押し完了」の挙動確認。
    - **Concierge**: `/chat/test` にて「ドロワー開閉」「日付提案」の挙動確認。
