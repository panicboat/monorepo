# Task List for feat-profile-edit

- [ ] **Data & Mocking**
  - [ ] `types/cast.ts` (または shared) の `Reservation` と `CastProfile` 型を更新し、プロフィール詳細データをサポートする。
  - [ ] MSW で `GET /api/cast/profile` を実装する。
  - [ ] MSW で `PUT /api/cast/profile` を実装する。

- [ ] **Component Refactoring**
  - [ ] `PhotoUpload` を Onboarding から shared/profile フォルダに抽出・共通化する。
  - [ ] `ProfileInputs` / `BasicInfo` を Onboarding から shared/profile フォルダに抽出・共通化する。
  - [ ] `PlanSettings` を Onboarding から shared/profile フォルダに抽出・共通化する。
  - [ ] `WeeklyShiftInput` を Onboarding から shared/ritual フォルダに抽出・共通化する。
  - [ ] 既存の Onboarding ページが、移動したコンポーネントでも正しく動作することを確認する。

- [ ] **Page Implementation**
  - [ ] `src/app/(cast)/manage/profile/page.tsx` のスケルトンを実装する。
  - [ ] `PhotoUpload` セクションを統合する。
  - [ ] `BasicInfo` セクションを統合する。
  - [ ] `PlanSettings` セクションを統合する。
  - [ ] `WeeklyShift` セクションを統合する（プロフィールの非公開設定カテゴリとして）。
  - [ ] 「保存 (Save)」機能とローディング状態を実装する。
  - [ ] 成功/エラー時のトースト通知を追加する。

- [ ] **Verification**
  - [ ] データ取得時にモックデータが正しく表示されることを検証する。
  - [ ] 更新操作が反映されること（Optimistic UI または再取得）を検証する。
  - [ ] Onboarding フローに回帰バグ（リグレッション）がないか確認する。
