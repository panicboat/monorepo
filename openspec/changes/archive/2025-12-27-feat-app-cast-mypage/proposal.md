# Proposal: Cast MyPage Top Screen

- **Change ID:** `feat-app-cast-mypage`
- **Author:** Antigravity
- **Status:** Proposed

## Summary
キャストユーザーが地震のステータスやこれまでの実績 (Stats) を確認し、各種設定画面へアクセスするためのマイページ（トップ画面）を実装する。
各詳細設定画面への遷移は本変更には含めず、プレースホルダーとしておく。

## Motivation
キャストが自身の活動状況を把握し、必要な設定にアクセスするためのハブとなる画面が必要。
`demo` アプリで検証されたデザインをベースに、本番アプリケーションに移植する。

## Proposed Changes

### Frontend (`web/heaven/apps/shell`)

#### Pages
- `src/app/cast/mypage/page.tsx`:
    - マイページトップ画面。
    - Stats（売上、フォロワー数、Promise Rate）の表示。
    - メニューリスト（プロフィール編集、フォロワーリスト、招待状設定、ブロックリスト、ログアウト）。

### Mock API (MSW)
- `src/mocks/handlers/cast.ts`:
    - `GET /api/cast/mypage`: マイページ表示用のStatsデータを返すモックを追加。

## Verification Plan
1.  `pnpm dev` でアプリケーションを起動。
2.  Castとしてログイン。
3.  下部ナビゲーションの「My Page」をクリック。
4.  Statsが正しく表示されているか確認。
5.  各メニューボタンをクリックし、ログアウト以外は何も起きない（またはToast表示）ことを確認。
6.  「ログアウト」ボタンでログイン画面に戻ることを確認。
