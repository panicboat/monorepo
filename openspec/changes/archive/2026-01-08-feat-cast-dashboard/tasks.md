## 1. Preparation - MSW Mock Data Setup
- [ ] 1.1 Add `/api/cast/stats` GET endpoint to `src/mocks/handlers/cast.ts`:
  - Response: `{ earningsToday, earningsThisWeek, earningsThisMonth, reservationsThisMonth, promiseRate, followers }`
  - Mock data: earningsToday: 45000, earningsThisWeek: 180000, earningsThisMonth: 720000, reservationsThisMonth: 12, promiseRate: 100, followers: 24
- [ ] 1.2 Add `/api/cast/upcoming-reservations` GET endpoint to `src/mocks/handlers/cast.ts`:
  - Response: `{ reservations: [{ id, guestName, date, startTime, planName, status }] }`
  - Mock data: 3-4 sample reservations with varied statuses (confirmed, pending, completed)
- [ ] 1.3 Add `/api/cast/status` PUT endpoint to `src/mocks/handlers/cast.ts`:
  - Request: `{ status: "online" | "offline" | "asking" | "tonight" }`
  - Response: `{ success: true, status: string }`
  - Include 1 second delay to simulate network latency

## 2. Components Implementation
**デザイン方針**: 既存の Guest 側コンポーネントおよび Hime-Channel のスタイルを踏襲。新規デザインは行わず、既存の Tailwind クラスとレイアウトパターンを再利用する。

### 2.1 Shared Component (Shell Module)
- [ ] 2.1.1 Create `src/modules/shell/components/cast/StatusToggle.tsx`:
  - Dropdown button component with 4 status options
  - Color indicators: Offline (gray), Asking (yellow), Online (green), Tonight (blue)
  - Accepts `currentStatus` prop and `onStatusChange` callback
  - Uses optimistic UI pattern (immediate visual feedback)
  - **Style**: 既存のドロップダウンコンポーネント（あれば）を参考にする
  - **Location Rationale**: TopNavBar で使用するグローバルコンポーネントのため shell に配置

### 2.2 Page-Specific Components (Dashboard Colocation)
- [ ] 2.2.1 Create `src/app/(cast)/manage/dashboard/components/EarningsSummary.tsx`:
  - Section component displaying 6 stats in a grid layout (2 rows × 3 columns on desktop, stacked on mobile)
  - Fetches data from `/api/cast/stats` internally
  - Displays: earningsToday, earningsThisWeek, earningsThisMonth, reservationsThisMonth, promiseRate, followers
  - Currency formatting for earnings (¥ symbol with commas)
  - Percentage formatting for promiseRate
  - Loading skeleton state support
  - Error state with retry button
  - **Style**: 白背景カード、既存の `rounded-lg` `shadow-sm` `border` パターンを使用。Discovery の統計表示などを参考にする
  - **Location Rationale**: 複数ドメイン (Ritual + Trust + Portfolio) にまたがるダッシュボード専用コンポーネント
- [ ] 2.2.2 Create `src/app/(cast)/manage/dashboard/components/UpcomingReservations.tsx`:
  - Section component displaying list of upcoming reservations
  - Fetches data from `/api/cast/upcoming-reservations` internally
  - Empty state with message ("シフトを更新して予約を受け付けましょう！")
  - Loading indicator support
  - Error state with retry button
  - Reservation item rendering (inline or separate component)
  - **Style**: リスト形式、各アイテムは白背景カード。既存の ProfileCard のスタイルを参考
  - **Location Rationale**: ダッシュボード専用の表示形式で再利用性がない

## 3. Shell Integration
- [ ] 3.1 Update `src/modules/shell/components/cast/CastTopNavBar.tsx`:
  - Import and render `StatusToggle` component in the `rightSlot` prop
  - Replace current placeholder avatar with `StatusToggle`
  - Fetch current status from `/api/cast/dashboard`
  - Handle status change with PUT request to `/api/cast/status`
  - Display toast notification on status update success/failure

## 4. Page Implementation (Thin Layer)
- [ ] 4.1 Implement `src/app/(cast)/manage/dashboard/page.tsx`:
  - セクション配置のみを行う薄いレイヤーとして実装（Page Colocation パターン）
  - Import `EarningsSummary` from `./components/EarningsSummary`
  - Import `UpcomingReservations` from `./components/UpcomingReservations`
  - レイアウト: 適切なスペーシングとレスポンシブデザイン
  - データフェッチングやローディング状態は各コンポーネント内で処理（page.tsx では行わない）
  - **Style**: 既存ページ（Discovery など）のコンテナスタイルを踏襲。白背景 `bg-white`、適切な padding/gap を使用

## 5. Error Handling & Edge Cases
- [ ] 5.1 Implement toast notification system (or use existing if available):
  - Success message on status update
  - Error message on API failures
- [ ] 5.2 Domain components handle their own errors gracefully:
  - `EarningsSummary`: Show user-friendly error message with retry button
  - `UpcomingReservations`: Show error message with retry button, empty state when no data
  - Log errors to console for debugging
- [ ] 5.3 Implement optimistic UI rollback for status changes:
  - `StatusToggle`: Revert UI to previous status if API call fails
  - Show error notification explaining the failure

## 6. Verification & Testing
- [ ] 6.1 Verify dashboard page structure:
  - Page at `/manage/dashboard` renders correctly
  - `EarningsSummary` and `UpcomingReservations` sections are properly laid out
  - Components are correctly imported from `./components/` directory
  - Responsive design works on mobile and desktop
- [ ] 6.2 Verify `dashboard/components/EarningsSummary.tsx`:
  - All 6 stats display with proper formatting (currency, percentage)
  - Loading skeleton appears during data fetch
  - Error state shows retry button and works correctly
- [ ] 6.3 Verify `dashboard/components/UpcomingReservations.tsx`:
  - Reservation cards show correct information
  - Empty state message displays when no reservations
  - Loading indicator appears during data fetch
  - Error state shows retry button and works correctly
- [ ] 6.4 Verify `shell/components/cast/StatusToggle.tsx` in `CastTopNavBar`:
  - Clicking each status option updates UI immediately (optimistic)
  - Status change persists after API response
  - Error state reverts to previous status with toast notification
  - All 4 status colors display correctly
- [ ] 6.5 Verify mobile responsiveness:
  - Stats grid stacks properly on mobile (< 768px)
  - Reservation cards are readable on small screens
  - Status toggle dropdown is accessible on touch devices
- [ ] 6.6 Verify navigation integration:
  - Home tab highlights correctly when on `/manage/dashboard`
  - Home tab un-highlights when navigating to other pages
  - Active indicator animation plays smoothly
