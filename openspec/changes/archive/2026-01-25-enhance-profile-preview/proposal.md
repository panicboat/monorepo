# Change: Align Cast Profile Display

## Why
現在の `/casts` (ゲスト向け) ページは以下の問題を抱えている：
1. **データが全て Mock** - 一覧・詳細ページともにハードコードされた "Yuna" データを表示
2. **Guest API 不在** - ゲストがキャストのプロフィールを取得する API エンドポイントがない
3. **表示項目の不足** - バックエンドに保存されているフィールド（locationType, area, serviceCategory, socialLinks, plans, schedules）が表示されていない
4. **Preview との乖離** - キャストが編集・プレビューする内容と、ゲストが見る内容が一致しない

## What Changes

### Phase 1: Guest API & Data Flow
- `/api/guest/casts/[id]` エンドポイントを作成（公開プロフィール取得用）
- `/casts/[id]` 詳細ページでプロフィールデータを fetch
- コンポーネントに実データを props で渡す

### Phase 2: Display All Persisted Fields
- ProfileSpecs に locationType, area, serviceCategory を表示
- socialLinks セクションを追加
- plans[], weeklySchedules[] を実データから表示

### Phase 3: Remove Hardcoded Mock Data
- ProfileSpecs のハードコードされた fallback を削除（occupation, charm point, personality, social metrics）
- PhotoGallery の MOCK_GALLERIES を削除
- ScheduleCalendar を weeklySchedules から表示
- PriceSystem を plans から表示

### Phase 4: Preview Alignment
- Cast 編集ページのプレビューとゲスト詳細ページで同じコンポーネント・同じデータ構造を使用
- 「プレビュー中」インジケーターを追加

## Impact
- Affected specs: profile, portfolio
- Affected code:
  - `web/nyx/workspace/src/app/api/guest/casts/[id]/route.ts` (NEW)
  - `web/nyx/workspace/src/app/(guest)/casts/[id]/page.tsx`
  - `web/nyx/workspace/src/modules/portfolio/components/guest/detail/ProfileSpecs.tsx`
  - `web/nyx/workspace/src/modules/portfolio/components/guest/detail/PhotoGallery.tsx`
  - `web/nyx/workspace/src/modules/portfolio/components/guest/detail/CostAndSchedule.tsx`
  - `web/nyx/workspace/src/app/(cast)/cast/profile/components/ProfilePreviewModal.tsx`
