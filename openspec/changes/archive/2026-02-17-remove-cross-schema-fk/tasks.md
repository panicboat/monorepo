# Tasks: Remove Cross-Schema Foreign Key Constraints

## Phase 1: Preparation

- [x] **1.1** 現在の structure.sql で FK 制約の正確な名前を確認する
- [x] **1.2** 孤立データが存在しないことを確認するクエリを作成・実行

## Phase 2: Migration

- [x] **2.1** FK 削除マイグレーションファイルを作成 (`20260218000000_remove_cross_schema_foreign_keys.rb`)
- [ ] **2.2** マイグレーションを実行し、structure.sql の差分を確認（**手動で実行が必要**）
- [ ] **2.3** down マイグレーションをテストして、FK が再追加されることを確認（**手動で実行が必要**）

## Phase 3: Application-Level Validation

- [x] **3.1** `Post::Adapters::UserAdapter` に `user_exists?` メソッドを追加
- [x] **3.2** `Post::UseCases::Comments::AddComment` で user_id の存在確認バリデーションを追加
- [x] **3.3** `Offer::UseCases::Plans::SavePlans` で cast_id の存在確認バリデーションを確認（既存で実装済み）
- [x] **3.4** `Offer::UseCases::Schedules::SaveSchedules` で cast_id の存在確認バリデーションを確認（既存で実装済み）

## Phase 4: Testing

- [x] **4.1** UserAdapter の `user_exists?` メソッドのテストを作成
- [x] **4.2** AddComment のバリデーションエラーテストを作成
- [x] **4.3** 全テストスイートを実行し、既存テストが壊れていないことを確認

## Phase 5: Verification

- [ ] **5.1** structure.sql にクロススキーマ FK が存在しないことを確認（**マイグレーション実行後**）
- [x] **5.2** 本番環境へのデプロイ手順を文書化（下記参照）

## Deployment Instructions

1. **マイグレーション実行**:
   ```bash
   cd services/monolith/workspace
   bundle exec hanami db migrate
   ```

2. **FK 削除の確認**:
   ```bash
   psql -c "SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_table_schema
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema != ccu.table_schema;"
   ```
   結果が空であることを確認

3. **ロールバック手順**（必要な場合）:
   ```bash
   bundle exec hanami db migrate --target 20260217000000
   ```

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                        ↓
              (3.1, 3.2 は並行可能)
              (3.3, 3.4 は並行可能)
```

## Files Changed

- `config/db/migrate/20260218000000_remove_cross_schema_foreign_keys.rb` (新規)
- `slices/post/adapters/user_adapter.rb` (変更: user_exists? 追加)
- `slices/post/use_cases/comments/add_comment.rb` (変更: UserNotFoundError バリデーション追加)
- `spec/slices/post/adapters/user_adapter_spec.rb` (新規)
- `spec/slices/post/use_cases/comments/add_comment_spec.rb` (新規)
