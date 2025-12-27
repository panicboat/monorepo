# Proposal: Cast Application Features

- **Change ID:** `feat-app-cast`
- **Author:** Antigravity
- **Status:** Proposed

## Summary
キャストユーザー向けのダッシュボードとオンボーディング体験を実装する。
これには、売上・ステータス管理機能を持つホーム画面と、初回ユーザー向けの初期設定ウィザードが含まれる。

## Motivation
現在、キャストユーザー向けの画面はプレースホルダーのみであるため、`demo` アプリで検証済みのリッチなUIを本番環境 (`shell`) に移植し、実際に機能するアプリケーションとして提供する必要がある。

## Proposed Changes

### Frontend (`web/heaven/apps/shell`)

#### Pages
- `src/app/cast/dashboard/page.tsx`:
    - キャスト用ホーム画面。
    - 現在のステータス（Online/Offline等）の切り替え。
    - 今日の予約状況 (Today's Promise) の表示。
    - 簡易チャットリストとフォロワー数の表示。
- `src/app/cast/onboarding/page.tsx`:
    - 初回ユーザー向けウィザードのエントリーポイント。
    - `OnboardingWizard` コンポーネントを使用。

#### Components
- `src/components/features/cast/OnboardingWizard.tsx`:
    - ステップバイステップの入力フォーム（プロフィール、写真登録など）。
    - 完了時にダッシュボードへ遷移。

### Mock API (MSW)
- `src/mocks/handlers/cast.ts`:
    - `GET /api/cast/dashboard`: ダッシュボード表示用のデータ（ステータス、予約、統計）を返すモックを追加。

## Verification Plan
1.  `pnpm dev` でアプリケーションを起動。
2.  ログイン画面で「Cast」を選択しログイン。
3.  `/cast/dashboard` に遷移し、UIが正しく表示されることを確認。
4.  ステータス変更セレクトボックスが動作することを確認（モック動作）。
5.  `/cast/onboarding` にアクセスし、ウィザードが進行できることを確認。
