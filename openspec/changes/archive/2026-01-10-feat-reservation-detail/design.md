# Design: Reservation Detail & Guest Info

## Architecture
- **Module:** `modules/ritual` (Reservation) & `modules/concierge` (Guest Info)
- **UI Components:** `src/components/ui` (Button, Card, etc.)
- **State:** Server Components + Client Components for interaction (Long Press).

## UI/UX Rules
- **Pink Premium:** ゲスト向けと同様のピンク（Brand Color）を基調としたデザイン。
- **Long Press Ritual:**
    - 予約確定ボタンは通常のクリックではなく、1〜2秒の長押しで発火する。
    - 指を離した瞬間に「封蝋（Seeding/Stamp）」アニメーションを表示する。
    - これにより「事務作業」ではなく「誓い」であることを演出する。
- **Guest Link:**
    - 予約詳細のゲストアイコン/名前はクリッカブルとし、Guest Infoへ遷移する。

## Data Flow
- **Mock Data:** First implementation will use mock data (until Backend API is ready).
- **Type Safety:** Define shared types in `modules/ritual/types.ts`.
