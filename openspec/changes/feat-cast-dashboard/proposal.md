# Change: Cast Dashboard Implementation

## Why
現在、キャストはオンボーディング完了後に表示されるホーム画面（ダッシュボード）が実装されておらず、自身の売上状況や予約状況を確認できません。
Phase 1として、キャストが日々の活動を行うための拠点となるダッシュボード画面と、基本的なステータス管理機能を提供する必要があります。

## What Changes

### 1. Page Implementation
`src/app/(cast)/manage/dashboard/page.tsx` を実装し、以下のセクションを配置します:

#### Quick Stats Section
- **本日の売上**: 今日の総売上額（円表示）
- **今週の売上**: 今週の累計売上
- **今月の売上**: 今月の累計売上
- **今月の指名数**: 予約確定数
- **約束率**: キャンセル率から算出された信頼指標（%）
- **フォロワー**: フォロワー数

#### Upcoming Reservations Section
直近の予約を時系列で表示:
- ゲスト名（匿名の場合はイニシャル）
- 予約日時
- プラン名・時間
- ステータス（Confirmed / Pending / Completed）

### 2. Shell Integration

#### CastTopNavBar Enhancement
右側スロットに `StatusToggle` コンポーネントを配置し、キャストのリアルタイムステータスを切り替え可能にします:
- **Offline**: オフライン（灰色）
- **Asking**: 休止中・要相談（黄色）
- **Online**: オンライン・返信早め（緑色）
- **Tonight**: 本日営業（青色）

#### CastBottomNavBar (変更不要)
- "Home" タブの href は既に `/manage/dashboard` なので修正不要
- アクティブ判定ロジックも現状のまま動作する

### 3. Component Architecture

Onboarding と同じパターンで、ページはセクション配置のみを行い、実装はドメイン別コンポーネントに委譲します:

#### Page Layer
- `src/app/(cast)/manage/dashboard/page.tsx`: セクション配置のみ（薄いレイヤー）

#### Domain Components (新規作成)
- `src/modules/trust/components/cast/EarningsSummary.tsx`: 売上統計セクション全体（6つの指標を含む）
- `src/modules/ritual/components/cast/UpcomingReservations.tsx`: 予約リストセクション全体
- `src/modules/ritual/components/cast/ReservationListItem.tsx`: 個別の予約カード（必要に応じて）
- `src/modules/shell/components/cast/StatusToggle.tsx`: ステータス切り替えドロップダウン

### 4. API & Mocking

MSW ハンドラに以下のエンドポイントを追加:

#### `/api/cast/stats` (GET)
```json
{
  "earningsToday": 45000,
  "earningsThisWeek": 180000,
  "earningsThisMonth": 720000,
  "reservationsThisMonth": 12,
  "promiseRate": 100,
  "followers": 24
}
```

#### `/api/cast/upcoming-reservations` (GET)
```json
{
  "reservations": [
    {
      "id": "r1",
      "guestName": "T様",
      "date": "2026-01-10",
      "startTime": "19:00",
      "planName": "Standard 60min",
      "status": "confirmed"
    }
  ]
}
```

#### `/api/cast/status` (PUT)
```json
// Request
{ "status": "online" }

// Response
{ "success": true, "status": "online" }
```

### 5. State Management
- ステータス変更は Optimistic UI で即座に反映
- データフェッチは `fetch` または `SWR` を使用（現在のプロジェクト方針に従う）
- エラー時はトースト通知で表示

### 6. Design & Styling
project.md の UI/UX Guidelines (Clone Strategy) に従い、以下のデザイン方針を採用します:
- **参考**: Hime-Channel のデザインおよび既存の Guest 側コンポーネント（Discovery の ProfileCard など）
- **配色**: 白ベース (#ffffff)、既存の Tailwind カラーパレットを使用
- **レイアウト**: カード型デザイン、既存のスペーシング・角丸・影を踏襲
- **フォント**: 既存のフォント設定（`font-serif` など）を統一
- **アニメーション**: 既存の Framer Motion パターンを使用（必要に応じて）
- **新規デザインの試行錯誤は行わない**: 既存コンポーネントのスタイルをコピー・参考にすることで実装速度を優先

## Impact
- **Affected Specs**: `cast-dashboard` (New)
- **Affected Code**:
  - `web/nyx/workspace/src/app/(cast)/manage/dashboard/page.tsx` (New)
  - `web/nyx/workspace/src/modules/shell/components/cast/CastTopNavBar.tsx`
  - `web/nyx/workspace/src/modules/shell/components/cast/StatusToggle.tsx` (New)
  - `web/nyx/workspace/src/modules/trust/components/cast/EarningsSummary.tsx` (New)
  - `web/nyx/workspace/src/modules/ritual/components/cast/UpcomingReservations.tsx` (New)
  - `web/nyx/workspace/src/modules/ritual/components/cast/ReservationListItem.tsx` (New - 必要に応じて)
  - `web/nyx/workspace/src/mocks/handlers/cast.ts`
