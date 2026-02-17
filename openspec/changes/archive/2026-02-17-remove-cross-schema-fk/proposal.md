# Proposal: Remove Cross-Schema Foreign Key Constraints

## Summary

モジュラーモノリスの設計原則に従い、異なるスキーマ間の外部キー（FK）制約を削除し、アプリケーションレベルの整合性チェックに移行する。

## Problem Statement

現在、以下のクロススキーマ FK 制約が存在し、モジュラーモノリスの設計原則に反している：

| 参照元 | 参照先 | FK名 |
|--------|--------|------|
| `post.comments.user_id` | `identity.users.id` | `post_comments_user_id_fkey` |
| `offer.cast_plans.cast_id` | `portfolio.casts.id` | `cast_plans_cast_id_fkey` |
| `offer.cast_schedules.cast_id` | `portfolio.casts.id` | `cast_schedules_cast_id_fkey` |

### Why This Is a Problem

1. **モジュール間の密結合**: 各ドメインは独立して進化すべきだが、DB レベルで依存関係が強制されている
2. **将来的なサービス分離の障壁**: マイクロサービス化時に FK 制約がブロッカーになる
3. **マイグレーション順序の制約**: スキーマ移動時に FK 制約の処理が必要
4. **テストの複雑性**: 他ドメインのテーブルを事前にセットアップする必要がある

## Proposed Solution

クロススキーマ FK 制約を削除し、以下のアプローチで整合性を担保する：

1. **アプリケーションレベルのバリデーション**: 参照先の存在確認を Adapter 経由で行う
2. **インデックスの維持**: FK 削除後も参照カラムのインデックスは維持（クエリ性能のため）
3. **ON DELETE CASCADE の代替**: ドメインイベント or バッチ処理で孤立データをクリーンアップ

## Scope

### In Scope

- `post.comments.user_id` → `identity.users.id` の FK 削除
- `offer.cast_plans.cast_id` → `portfolio.casts.id` の FK 削除
- `offer.cast_schedules.cast_id` → `portfolio.casts.id` の FK 削除
- 既存 Adapter への存在確認メソッド追加（必要に応じて）

### Out of Scope

- 同一スキーマ内の FK 制約（例：`post.comments` → `post.posts`）
- データ整合性の自動修復機能（将来の Trust ドメインで検討）

## Success Criteria

- すべてのクロススキーマ FK 制約が削除されている
- 既存のテストがすべてパスする
- Adapter 経由でのバリデーションが追加されている
- structure.sql にクロススキーマ FK が存在しない

## Dependencies

- 特になし（独立して実装可能）

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 参照整合性の喪失 | 孤立データの発生 | Adapter での存在確認 + 定期的なクリーンアップ |
| パフォーマンス低下 | 参照確認のオーバーヘッド | 必要な箇所のみでバリデーション |
| 既存データの不整合 | 既に孤立データがある可能性 | マイグレーション時にチェック |

## Approval

- [ ] Reviewed by: (awaiting review)
- [ ] Approved: (awaiting approval)
