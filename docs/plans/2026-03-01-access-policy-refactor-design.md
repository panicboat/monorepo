# Access Policy Refactor Design

Date: 2026-03-01

## Goal

アクセスポリシーを想定通りの設計に修正する。3つの変更を実施：

1. Guest → Cast ブロック機能の削除
2. Cast → Guest ブロック時のプロフィール閲覧制御の強化
3. お気に入り機能（デッドコード）の完全削除

## 1. Guest → Cast ブロック削除

### 方針

Guest → Cast ブロックの概念自体が不要。全レイヤーから関連コードを削除する。`social__blocks` テーブルと `block_repository` は Cast → Guest ブロックで引き続き使用するため、Guest が blocker になるコードパスのみ削除。

### 削除対象

**Frontend:**
- `src/app/api/guest/blocks/route.ts` — Guest ブロック API route
- `src/modules/relationship/hooks/useBlock.ts` — Guest 側ブロックロジック
- `src/stores/socialStore.ts` — blocking 関連 state

**Backend:**
- `slices/relationship/grpc/block_handler.rb` — Guest が blocker になる RPC の削除
- `slices/relationship/repositories/block_repository.rb` — `blocked_cast_ids` など Guest 固有メソッド削除

**Proto:**
- `block_service.proto` — Guest が blocker となるケースの整理

**AccessPolicy:**
- `PostAccessPolicy` — Guest → Cast ブロック判定を削除
- `ProfileAccessPolicy` — Guest → Cast ブロック判定を削除
- `list_guest_feed.rb` — Guest → Cast ブロック除外を削除
- `Post::Adapters::RelationshipAdapter` — `blocked?`, `blocked_cast_ids` メソッド削除
- `Portfolio::Adapters::SocialAdapter` — `blocked?` メソッド削除

**ドキュメント:**
- `ACCESS_POLICY.md` — Guest → Cast ブロック関連の全記述を削除

**シードデータ:**
- 太郎の Rin ブロックを削除

## 2. Cast → Guest プロフィール閲覧制御の強化

### 方針

既存の `SocialAdapter.cast_blocked_guest?` と `RelationshipAdapter.blocked_guest_ids` を活用し、各 Policy に Cast → Guest 方向のチェックを追加。

### Cast → Guest ブロック時の効果（変更後）

| リソース | 効果 |
|---------|------|
| 基本プロフィール | Allow（変更なし） |
| 詳細プロフィール（プラン・スケジュール・タイムライン） | **Deny（新規）** |
| 投稿の閲覧 | **Deny（新規）** |
| フィード | **除外（新規）** |
| Like / Comment | **Deny（新規）** |
| Follow | Deny（既存） |

### 変更箇所

**ProfileAccessPolicy:**
- `can_view_profile?` → 変更なし（基本プロフィールは見える）
- `can_view_profile_details?` → Cast→Guest ブロック時は Deny を追加

**PostAccessPolicy:**
- `can_view_post?` → Cast→Guest ブロックチェックを追加
- `filter_viewable_posts` → Cast→Guest ブロック済みキャストの投稿を除外

**Feed Filtering:**
- `list_guest_feed` → `blocked_guest_ids` チェックを追加し、Cast→Guest ブロック済みキャストの投稿を除外

### 新しい Access Rules

```
Post Access:
1. Cast → Guest ブロック → Deny
2. cast.public && post.public → Allow
3. 未認証 → Deny
4. follow.approved → Allow
5. Otherwise → Deny
```

### 新しい Access Matrix（簡略）

| 条件 | 基本プロフィール | 詳細プロフィール | 投稿 | Feed |
|------|-----------------|-----------------|------|------|
| Cast→Guest ブロック | Allow | Deny | Deny | 除外 |
| cast.public | Allow | Allow | public: Allow | 表示 |
| cast.private + approved | Allow | Allow | Allow | 表示 |
| cast.private + not approved | Allow | Deny | Deny | 除外 |

## 3. お気に入り機能の完全削除

### 方針

デッドコードを全レイヤーから完全に削除する。

### 削除対象

**Proto:**
- `proto/relationship/v1/favorite_service.proto` — ファイル全体

**Backend:**
- `slices/relationship/grpc/favorite_handler.rb`
- `slices/relationship/repositories/favorite_repository.rb`
- `slices/relationship/relations/favorites.rb`
- `slices/relationship/use_cases/favorites/` — ディレクトリ全体
- `slices/post/adapters/relationship_adapter.rb` — `favorite_cast_user_ids` メソッド
- `slices/feed/use_cases/list_guest_feed.rb` — FAVORITES フィルタ

**Frontend:**
- `src/modules/relationship/hooks/useFavorite.ts`
- `src/app/api/guest/favorites/route.ts`
- `src/app/api/guest/favorites/status/route.ts`
- `src/stores/socialStore.ts` — favorites 関連 state
- `src/modules/relationship/types.ts` — `FavoriteCast`, `FavoriteState` 型

**DB:**
- `social__cast_favorites` テーブルの drop migration を作成

**ドキュメント:**
- `ACCESS_POLICY.md` — FAVORITES フィルタ、Favorite アクション関連を削除
- Feed Filtering Matrix から FAVORITES 行を削除

### 影響
- Feed フィルタが ALL / FOLLOWING の 2 種類になる
- Action Permissions から Favorite 行が消える
