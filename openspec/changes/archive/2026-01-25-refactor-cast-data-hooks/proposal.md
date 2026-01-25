# Change: Refactor Cast Data Management to Unified Hooks

## Why
現在、キャストのデータ管理（プロフィール、プラン、スケジュール）が複数箇所で重複実装されている:
- `stores/onboarding.ts` - Zustand store でオンボーディング用
- `/cast/profile/page.tsx` - useState + useEffect で独自実装
- `/cast/plans/page.tsx` - 同上（予定）
- `/cast/schedules/page.tsx` - 同上（予定）

この重複により:
- API レスポンスのマッピングロジックが分散
- データ構造の変更時に複数箇所の修正が必要
- バグの温床になりやすい

## What Changes
- 統一された hooks を作成:
  - `useCastProfile()` - プロフィールの取得・更新
  - `useCastPlans()` - プランの取得・更新
  - `useCastSchedules()` - スケジュールの取得・更新
  - `useCastImages()` - 画像の取得・アップロード
- `stores/onboarding.ts` を廃止し、上記 hooks に置き換え
- オンボーディングページは hooks を組み合わせて使用
- プロフィール編集ページも同じ hooks を使用

## Impact
- Affected specs: portfolio
- Affected code:
  - `stores/onboarding.ts` → 廃止
  - `modules/portfolio/hooks/` → 新規作成
  - `/cast/onboarding/step-*` → hooks 使用に変更
  - `/cast/profile/page.tsx` → hooks 使用に変更
  - `/cast/plans/page.tsx` → hooks 使用に変更
  - `/cast/schedules/page.tsx` → hooks 使用に変更

## Non-Goals
- API エンドポイントの変更は行わない
- バックエンドの変更は行わない
