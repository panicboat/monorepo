# Design: Remove Cross-Schema Foreign Key Constraints

## Overview

本ドキュメントでは、クロススキーマ FK 制約を削除し、アプリケーションレベルの整合性チェックに移行するための技術設計を記述する。

## Current State

### Cross-Schema FK Dependencies

```
┌─────────────────┐     FK      ┌─────────────────┐
│  post.comments  │────────────▶│ identity.users  │
│    user_id      │             │       id        │
└─────────────────┘             └─────────────────┘

┌─────────────────┐     FK      ┌─────────────────┐
│offer.cast_plans │────────────▶│ portfolio.casts │
│    cast_id      │             │       id        │
└─────────────────┘             └─────────────────┘

┌──────────────────────┐   FK   ┌─────────────────┐
│ offer.cast_schedules │───────▶│ portfolio.casts │
│      cast_id         │        │       id        │
└──────────────────────┘        └─────────────────┘
```

### Current Migration Files

| File | FK Definition |
|------|---------------|
| `20260205000000_create_post_comments.rb` | `foreign_key [:user_id], :"identity__users", on_delete: :cascade` |
| `20260118120000_create_cast_plans_and_schedules.rb` | `foreign_key :cast_id, :portfolio__casts, on_delete: :cascade` |

## Target State

### Architecture After FK Removal

```
┌─────────────────┐  Adapter   ┌─────────────────┐
│  post.comments  │───────────▶│ identity.users  │
│    user_id      │  (runtime) │       id        │
└─────────────────┘             └─────────────────┘
        │
        └── INDEX on user_id (maintained)

┌─────────────────┐  Adapter   ┌─────────────────┐
│offer.cast_plans │───────────▶│ portfolio.casts │
│    cast_id      │  (runtime) │       id        │
└─────────────────┘             └─────────────────┘
        │
        └── INDEX on cast_id (maintained)
```

## Implementation Approach

### 1. Migration Strategy

新しいマイグレーションファイルを作成し、FK 制約を削除する。インデックスは維持。

```ruby
# Example: 20260218000000_remove_cross_schema_foreign_keys.rb
ROM::SQL.migration do
  up do
    # Drop FK constraints (indexes remain)
    alter_table :"post__comments" do
      drop_constraint :post_comments_user_id_fkey, if_exists: true
    end

    alter_table :"offer__cast_plans" do
      drop_constraint :cast_plans_cast_id_fkey, if_exists: true
    end

    alter_table :"offer__cast_schedules" do
      drop_constraint :cast_schedules_cast_id_fkey, if_exists: true
    end
  end

  down do
    # Re-add FK constraints
    alter_table :"post__comments" do
      add_foreign_key [:user_id], :"identity__users",
        name: :post_comments_user_id_fkey, on_delete: :cascade
    end

    alter_table :"offer__cast_plans" do
      add_foreign_key [:cast_id], :"portfolio__casts",
        name: :cast_plans_cast_id_fkey, on_delete: :cascade
    end

    alter_table :"offer__cast_schedules" do
      add_foreign_key [:cast_id], :"portfolio__casts",
        name: :cast_schedules_cast_id_fkey, on_delete: :cascade
    end
  end
end
```

### 2. Application-Level Validation

既存の Adapter パターンを活用して、書き込み時に参照先の存在を確認する。

#### Post Domain: UserAdapter Enhancement

`Post::Adapters::UserAdapter` に存在確認メソッドを追加（既存メソッドで代用可能）。

```ruby
# slices/post/adapters/user_adapter.rb
def user_exists?(user_id)
  !identity_user_repository.find_by_id(user_id).nil?
end
```

#### Offer Domain: PortfolioAdapter

`Offer::Adapters::PortfolioAdapter` は既に `cast_exists?` メソッドを持っている。

```ruby
# slices/offer/adapters/portfolio_adapter.rb (既存)
def cast_exists?(cast_id)
  !portfolio_cast_repository.find_by_id(cast_id).nil?
end
```

### 3. Validation in Use Cases

#### Create Comment Use Case

```ruby
# slices/post/actions/create_comment.rb
def call(post_id:, user_id:, content:)
  # Validate user exists
  unless user_adapter.user_exists?(user_id)
    raise InvalidReferenceError, "User not found: #{user_id}"
  end
  # ... rest of implementation
end
```

#### Create Plan/Schedule Use Cases

```ruby
# slices/offer/actions/create_plan.rb
def call(cast_id:, ...)
  # Validate cast exists
  unless portfolio_adapter.cast_exists?(cast_id)
    raise InvalidReferenceError, "Cast not found: #{cast_id}"
  end
  # ... rest of implementation
end
```

### 4. Handling ON DELETE CASCADE Replacement

FK 削除により `ON DELETE CASCADE` が機能しなくなる。以下の方法で対処：

#### Option A: Application-Level Cascade (Recommended)

削除処理時に関連ドメインの Adapter を呼び出して連鎖削除を行う。

```ruby
# Example: When a user is deleted
# Identity domain publishes an event or calls Portfolio
# Portfolio then calls Offer to cascade deletions
```

#### Option B: Background Job for Orphan Cleanup

定期的なバッチ処理で孤立データを検出・削除する。

```ruby
# Example: Orphan cleanup job
class CleanupOrphanComments
  def call
    # Find comments where user no longer exists
    orphan_comments = comment_repo.find_orphans
    orphan_comments.each { |c| comment_repo.delete(c.id) }
  end
end
```

**本提案では Option A を推奨するが、初期実装では孤立データは許容し、将来の Trust ドメインでクリーンアップ機能を実装する。**

## Testing Strategy

### 1. Migration Test

- マイグレーション up/down が正常に動作することを確認
- FK 制約が削除/再追加されることを確認

### 2. Validation Test

- 存在しない user_id でコメント作成時にエラーが発生することを確認
- 存在しない cast_id でプラン/スケジュール作成時にエラーが発生することを確認

### 3. Existing Test Compatibility

- 既存のテストがすべてパスすることを確認
- テストデータのセットアップ順序に問題がないことを確認

## Rollback Strategy

1. マイグレーションの down を実行して FK を再追加
2. 孤立データが存在する場合は事前にクリーンアップが必要

## Considerations

### Why Not Use Database Triggers?

トリガーによる参照整合性チェックも選択肢だが、以下の理由で採用しない：

1. アプリケーションロジックがDBに分散する
2. テストが複雑になる
3. Adapter パターンとの一貫性を保てない

### Performance Impact

- 書き込み時に追加の SELECT が発生する（存在確認）
- ただし、これらのテーブルの書き込み頻度は低いため影響は軽微
- インデックスが維持されるため、読み取り性能に影響なし
