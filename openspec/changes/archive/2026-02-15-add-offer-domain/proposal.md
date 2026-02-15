# Change: Add Offer Domain

## Why

現在 Portfolio ドメインに含まれている料金プラン（Plan）とスケジュール（Schedule）は、プロフィール情報とは性質が異なる。Portfolio は「キャストを見つける・知る」という発見（Discovery）の文脈を担当するが、Plan と Schedule は「何を・いつ・いくらで提供するか」という提供情報であり、将来の予約機能と密接に連携する。

この責務の違いを明確にするため、Offer ドメインを新設し、Plan と Schedule を分離する。

## What Changes

- **NEW:** Offer ドメインを新設
- **MOVE:** `cast_plans` テーブルを Portfolio → Offer へ移行
- **MOVE:** `cast_schedules` テーブルを Portfolio → Offer へ移行
- **MOVE:** 関連する UseCase, Contract, Presenter を移行
- **NEW:** `proto/offer/v1/service.proto` を作成
- **MODIFY:** Portfolio の gRPC ハンドラから Plan/Schedule API を削除

## Impact

- Affected specs: `portfolio`, `offer` (new)
- Affected code:
  - Backend: `slices/portfolio/` → `slices/offer/` (Plan, Schedule 関連)
  - Frontend: `modules/portfolio/` → `modules/offer/` (Plan, Schedule 関連)
  - Proto: `proto/portfolio/v1/service.proto` → `proto/offer/v1/service.proto`

## Migration Strategy

1. **Phase 1:** Offer ドメインの基盤を作成（slice, proto, フロントエンドモジュール）
2. **Phase 2:** Plan 関連のロジックを Offer に移行
3. **Phase 3:** Schedule 関連のロジックを Offer に移行
4. **Phase 4:** Portfolio から Plan/Schedule API を削除

## Risks

- フロントエンドの API 呼び出し先の変更が必要
- 一時的に両方のドメインで同じ機能が存在する期間が発生
