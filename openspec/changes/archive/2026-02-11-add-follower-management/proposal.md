# Proposal: add-follower-management

## Summary

キャストが自分のフォロワー一覧を確認し、必要に応じてブロックできる機能を追加する。

## Background

`refactor-slim-cast-ui` の一環として、キャスト向けのフォロワー管理画面（`/cast/followers`）を追加した。
しかし、バックエンド API が未実装のため、現在はモックデータでのみ動作している。

### 現状

| 機能 | Proto | Backend | API Route | Frontend |
|------|-------|---------|-----------|----------|
| フォローリクエスト一覧 | ✓ | ✓ | ✓ | ✓ |
| リクエスト承認/拒否 | ✓ | ✓ | ✓ | ✓ |
| **フォロワー一覧** | ❌ | ❌ | ❌ | ✓ (mock) |

## Scope

### In Scope

1. **Proto 定義追加**
   - `ListFollowers` RPC

2. **Backend 実装**
   - `ListFollowers` ハンドラー追加
   - フォロワー一覧取得時にブロック済みを除外
   - ブロック時にフォロー関係も自動削除

3. **API Route 追加**
   - `GET /api/cast/followers`

4. **Frontend 修正**
   - フォロワー一覧にブロックボタンを追加
   - モックハンドラー削除

### Out of Scope

- フォロワー数の集計ロジック変更

## Design Decisions

### 1. ブロック時のフォロー解除

ブロック時に `cast_follows` テーブルからも該当レコードを削除する。

```ruby
# block_user.rb
def call(...)
  block_repo.block(...)
  follow_repo.unfollow(...)  # 追加
  { success: true }
end
```

### 2. フォロワー一覧のフィルタリング

フォロワー一覧取得時、ブロック済みユーザーを除外する（念のため）。

```sql
SELECT * FROM cast_follows
WHERE cast_id = ? AND status = 'approved'
  AND guest_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
```

### 3. フォロワー一覧からのブロック

フォロワー一覧の各行にブロックボタンを表示。
既存の `BlockService.BlockUser` RPC を使用。

## Risks

- **Low**: 既存の Follow/Block 機能への影響は最小限（フィルタリング追加のみ）
