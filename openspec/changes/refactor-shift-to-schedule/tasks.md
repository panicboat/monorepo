# Tasks

## 1. Proto 定義の変更

- [ ] 1.1 `proto/portfolio/v1/service.proto` の field 名を変更
  - `default_shift_start` → `default_schedule_start`
  - `default_shift_end` → `default_schedule_end`
- [ ] 1.2 `pnpm proto:gen` で TypeScript 型を再生成
- [ ] 1.3 Backend の stub を再生成

## 2. Database マイグレーション

- [ ] 2.1 カラム名変更のマイグレーションを作成
  - `default_shift_start` → `default_schedule_start`
  - `default_shift_end` → `default_schedule_end`

## 3. Backend の修正

- [ ] 3.1 `slices/portfolio/relations/casts.rb` の attribute 名を修正
- [ ] 3.2 `slices/portfolio/contracts/cast/save_profile_contract.rb` を修正
- [ ] 3.3 `slices/portfolio/use_cases/cast/profile/save_profile.rb` を修正
- [ ] 3.4 `slices/portfolio/presenters/cast/profile_presenter.rb` を修正
- [ ] 3.5 `slices/portfolio/grpc/handler.rb` を修正

## 4. Frontend の修正

- [ ] 4.1 `src/modules/portfolio/types.ts` の型定義を修正
- [ ] 4.2 `src/stores/onboarding.ts` の変数名を修正
- [ ] 4.3 `src/modules/ritual/components/cast/WeeklyShiftInput.tsx` をリネーム・修正
- [ ] 4.4 `src/modules/portfolio/components/cast/StyleInputs.tsx` を修正
- [ ] 4.5 関連する API routes を修正
- [ ] 4.6 関連するページコンポーネントを修正

## 5. テスト

- [ ] 5.1 Backend の spec を修正・実行
- [ ] 5.2 オンボーディングフローの動作確認
- [ ] 5.3 プロフィール編集の動作確認
