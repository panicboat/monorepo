# Design: Cast Domain Implementation

## Architectural Decisions

### 1. User-Cast Relationship (1:1)
- **Decision**: `Cast` レコードは `user_id` を介して `User` と 1:1 で紐づくが、物理的な外部キー制約（Foreign Key）は設定しない。
- **Reasoning**: 将来的なマイクロサービス化（DB分割）を見据え、ドメイン（スキーマ）を跨ぐ物理制約を排除するため。整合性はアプリケーション層（Service/Usecase）で担保する。
- **Constraint**: 同一の電話番号でゲストとキャストを兼ねることは現状考慮しない。

### 2. Strict Data Ownership
- **Philosophy**: "No Shop Entity"（店舗概念の排除）。
- **Implementation**: スケジュール、料金、レビュー等の全データは `cast_id` に紐づく。`shop_id` はシステム上に存在させない。

### 3. Identity vs Cast Separation
- **Identity Domain**: 認証（AuthN）と基本的な役割（Guest/Cast）を管理する。
- **Cast Domain**: プロフィール（外見・詳細）、ステータス（稼働状況）、ビジネスロジックを管理する。
- **Interface**: フロントエンド（`nyx`）がまず Identity で認証し、得られたトークン（`user_id`含有）を用いて Cast Service を利用する。キャスト作成時はアプリケーション層で `user_id` を渡す。

## Data Model

### `casts` table (Schema: `portfolio`)
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | PK |
| `user_id` | UUID | Logical Link to `users.id` (No FK Constraint, Unique Index) |
| `name` | String | 表示名 (Nickname) |
| `tagline` | String | キャッチコピー (One liner) |
| `bio` | Text | 自己紹介 |
| `service_category` | String | `standard`, `vip` etc. |
| `location_type` | String | `dispatch` (出張), `room` (ルーム) |
| `area` | String | 活動エリア |
| `status` | String | 'online', 'offline', 'unavailable' |
| `promise_rate` | Float | 0.0 - 1.0 (信頼度スコア) |
| `age` | Integer | 年齢 |
| `height` | Integer | 身長 (cm) |
| `blood_type` | String | 血液型 |
| `occupation` | String | 職業 |
| `charm_point` | String | チャームポイント |
| `personality` | String | 性格 |
| `bust` | Integer | バスト (cm) |
| `waist` | Integer | ウエスト (cm) |
| `hip` | Integer | ヒップ (cm) |
| `cup_size` | String | カップ数 |
| `images` | JSONB | 画像/動画リスト `[{ url, type: 'image'\|'video', thumbnail? }]` |
| `tags` | JSONB | 特徴タグのリスト (String[]) |
| `social_links` | JSONB | SNSリンク集 |
| `default_shift_start` | String | デフォルトシフト開始時間 (HH:MM) |
| `default_shift_end` | String | デフォルトシフト終了時間 (HH:MM) |

### URL / Routing Design
- **Root / Portal**: `/cast`
    - Guestの `/` に相当する、キャスト向けランディング兼認証ページ。
    - 未認証なら LP + 登録/ログインフォームを表示。
    - 認証済みなら `/cast/onboarding` (未完了) または `/cast/home` (完了) へリダイレクトする。
    - **UI**: 登録とログインをシームレスに切り替える（GuestのTopなどと同様の体験）。
- **Onboarding**: `/cast/onboarding`
    - **Step-by-Step Persistence**: ユーザーが入力を進めるごとに（Stepごとに）状態を保存する。これにより離脱後の再開を容易にする。
- **Dashboard**: `/cast/home` (Moved from `/manage`)

### 4. Authentication & Onboarding Flow (Detailed)
- **Shared Login Component**:
    - ゲスト用の `LoginGate` コンポーネントを改修し、キャスト認証フローでも利用可能にする（共通化）。
    - **UI Colors**: キャスト用は**ピンク**系、ゲスト用は**黒**系（既存踏襲）を使用する。
- **Token Management**:
    - 登録・ログイン成功時に発行されるアクセストークンは、クライアントの `localStorage` に保存する（キー: `access_token`）。
    - アプリ起動時（または `/cast` アクセス時）、`localStorage` に有効なトークンが存在すれば、自動的にログイン後の画面へ遷移する。
- **Redirection Logic**:
    - ログイン済み（トークン有効）の場合の遷移先：
        - **Onboarding未完了**: `/cast/onboarding` へ強制リダイレクト。
        - **Onboarding完了済**: `/cast/home`（ダッシュボード）へ遷移。
    - キャスト登録完了直後は `/cast/onboarding` へ遷移する。

### 5. Frontend UI/UX
- **Video Playback**:
    - `images` に動画が含まれる場合、一覧では GIF (または自動再生ミュート動画) として表示する。
    - タップ/クリック時に動画プレイヤーを起動し、音声付きで再生可能にする。

### Domain Mapping
- **Cast Service** is part of **Portfolio Domain**.
    - 実装場所: `services/monolith/slices/cast` (Backend) / `web/nyx/src/modules/portfolio` (Frontend)
    - 役割: キャストのカタログ情報（プロフィール、メディア、プラン）を管理する。
