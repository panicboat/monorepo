# Change: Add Cast Handle

## Why

キャストにユーザー定義のユニークIDを追加する。現在の `name` フィールドは表示名として扱い、新しい `handle` フィールドをシステム内で一意の識別子として使用する。これにより、プロフィールURLを `/casts/{handle}` 形式で提供できるようになる。

## What Changes

- Portfolio ドメインの casts テーブルに `handle` カラムを追加（unique制約）
- オンボーディングで handle を必須入力
- プロフィール編集画面で handle を変更可能（重複チェック付き）
- ゲスト向けプロフィールURLを `/casts/{uuid}` から `/casts/{handle}` に変更
- handle のバリデーション: 英数字のみ、先頭数字禁止

## Impact

- Affected specs: portfolio
- Affected code:
  - `services/monolith/workspace/slices/portfolio/` - DB, relations, repositories
  - `proto/portfolio/v1/service.proto` - handle field
  - `web/nyx/workspace/src/app/(cast)/cast/onboarding/` - handle input
  - `web/nyx/workspace/src/app/(cast)/cast/profile/` - handle edit
  - `web/nyx/workspace/src/app/(guest)/casts/[handle]/` - URL routing change
