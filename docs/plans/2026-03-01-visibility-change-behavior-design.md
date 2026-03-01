# Visibility 変更時の挙動 + Portfolio Adapter 分割

## 概要

キャストが visibility を `private` → `public` に変更した際、pending 状態のフォローリクエストを自動承認する機能を実装する。合わせて、Portfolio スライスの `SocialAdapter` をドメイン概念ごとに分割する。

## ビジネスルール

| 変更方向 | 挙動 |
|----------|------|
| `private` → `public` | 全 pending フォローリクエストを自動承認 |
| `public` → `private` | 既存 approved フォロワーは維持。新規フォローのみ pending になる（現行通り） |

## 設計

### Portfolio Adapter 分割

`SocialAdapter` をドメイン概念ごとに分割する。

**新規作成：**

| ファイル | メソッド |
|---------|---------|
| `slices/portfolio/adapters/follow_adapter.rb` | `approved_follower?`, `follow_status`, `get_follow_detail`, `approve_all_pending` |
| `slices/portfolio/adapters/block_adapter.rb` | `blocked?`, `cast_blocked_guest?` |

**削除：**

| ファイル | 理由 |
|---------|------|
| `slices/portfolio/adapters/social_adapter.rb` | FollowAdapter + BlockAdapter に分割 |

### 呼び出しフロー

```
CastHandler#save_cast_visibility
  → SaveCastVisibility use case（変更なし）
  → result[:visibility_changed_to_public] == true の場合
    → FollowAdapter#approve_all_pending(cast_user_id:)
      → Relationship::Slice["repositories.follow_repository"]#approve_all_pending（既存メソッド）
```

### 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `slices/portfolio/adapters/follow_adapter.rb` | 新規作成 |
| `slices/portfolio/adapters/block_adapter.rb` | 新規作成 |
| `slices/portfolio/adapters/social_adapter.rb` | 削除 |
| `slices/portfolio/grpc/cast_handler.rb` | visibility 変更後に follow_adapter.approve_all_pending を呼び出す |
| `slices/portfolio/grpc/guest_handler.rb` | social_adapter → follow_adapter / block_adapter に置換 |
| `slices/portfolio/policies/profile_access_policy.rb` | social_adapter → follow_adapter / block_adapter に置換 |
| `docs/ACCESS_POLICY.md` | Future Considerations 更新 |

### 変更しないもの

- `SaveCastVisibility` use case — 既に `visibility_changed_to_public` フラグを返している
- `follow_repository.rb` — 既に `approve_all_pending` メソッドが存在
- Proto 定義 — API インターフェースに変更なし

## 次のタスク: Feed/Post の RelationshipAdapter 分割

今回の Portfolio Adapter 分割と同じ方針で、Feed/Post スライスの `RelationshipAdapter` もドメイン概念ごとに分割する。

| スライス | 現在の Adapter | 分割先 |
|---------|---------------|--------|
| Feed | `RelationshipAdapter` | `FollowAdapter`, `BlockAdapter`, `FavoriteAdapter` |
| Post | `RelationshipAdapter` | `FollowAdapter`, `BlockAdapter`, `FavoriteAdapter` |

※ Favorites 削除（Access Policy リファクタリング）と合わせて実施するのが効率的。
