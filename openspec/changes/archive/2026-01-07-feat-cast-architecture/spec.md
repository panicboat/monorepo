# Cast Architecture & Foundation

## Purpose
Nyxプラットフォームにおけるキャスト向け機能（Cast-facing features）の技術的基盤を確立する。
ゲスト向け機能（Guest-facing）との適切な分離を保ちつつ、開発効率と保守性を最大化するためのアーキテクチャを定義する。

## Architecture Definitions

### 1. Frontend Structure: Twin Route Groups
モノレポ内の `web/nyx` アプリケーションにおいて、Next.js App Router の **Route Groups** 機能を活用し、ゲスト機能とキャスト機能を最上位レベルで分離する。

- **`src/app/(guest)/`**: ゲスト用ルート（一般公開）
    - `page.tsx` (Top)
    - `search/`, `cast/[id]/` 等
- **`src/app/(cast)/manage/`**: キャスト用ルート（要ログイン）
    - `onboarding/`: 登録ウィザード
    - `dashboard/`: ホーム
    - `schedule/`: スケジュール管理
- **`src/app/layout.tsx`**: 共通ルートレイアウト
    - Global Providers (Theme, QueryClient, Session) のみを提供し、UIヘッダー等は各GroupのLayoutで定義する。

### 2. Component Strategy: Domain First, Role Second
UIコンポーネントの共有による弊害（過度な条件分岐、意図しない変更の影響）を防ぐため、以下のディレクトリ構造を採用する。

- **`src/components/ui/` (Shared Atoms)**
    - Shadcn UI をベースとした、純粋な見た目（Style）と振る舞い（Behavior）のみを持つ汎用コンポーネント。
    - ビジネスロジックを含まない。`Button`, `Input`, `Dialog` 等。

- **`src/modules/[domain]/components/` (Feature Components)**
    - ドメインごとにディレクトリを切り、その中でさらに利用者の役割（Role）でディレクトリを分割する。
    - `src/modules/ritual/components/guest/`: ゲスト用予約フォーム等
    - `src/modules/ritual/components/cast/`: キャスト用シフト入力画面等
    - **ルール**: `guest` と `cast` でファイル自体を分ける。似ていても共通化を焦らない（DRYより結合度の低さを優先）。

### 3. Identity & Authentication (RBAC)
単一の認証基盤を用いつつ、ロールベースで認可を制御する。

- **Auth Model**
    - `users` テーブル: 全ユーザー共通の認証情報（ID, Email/Phone）。
    - `casts` テーブル: `users.id` を外部キーとして持ち、キャスト固有情報（プロフィール等）を保持する。
- **Login Flow**
    - **Guest**: Google Login / SMS OTP
    - **Cast**: Email + Password (業務利用としての安定性重視)
- **Session**
    - セッション情報に `role: 'guest' | 'cast'` を含め、Middleware で `(cast)/manage` へのアクセスをガードする。

### 4. Core Domains
キャスト機能開発における主要ドメイン定義。

#### A. Portfolio (Profile Management)
- **Role**: 自己表現、販売促進。
- **Features**: 写真アップロード、タグ設定、プロフィール文編集、料金プラン設定。
- **State**: `Draft` (下書き) -> `Pending` (審査提出) -> `Published` (公開)。

#### B. Ritual (Schedule & Reservation)
- **Role**: 在庫管理、取引実行。
- **Features**:
    - **Shift Management**: 日時指定での「空き枠」登録。
    - **Booking Approval**: ゲストからの予約リクエストの承認/否認。
    - **Calendar Sync**: Google Calendar連携による自動在庫調整（Pro機能）。

#### C. Trust (Dashboard & CRM)
- **Role**: 成果確認、顧客管理。
- **Features**:
    - **Dashboard**: 売上、PV数、直近の予約の可視化。
    - **CRM**: 顧客ごとのメモ、タグ付け、ブロック管理。
