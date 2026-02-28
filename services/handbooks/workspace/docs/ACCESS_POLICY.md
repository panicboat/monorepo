---
sidebar_position: 50
---

# Access Policy

アクセス制御の仕様と判定ルールを定義する。

## Overview

Nyx.PLACE では、キャストの visibility（公開設定）と投稿の visibility、フォロー状態、ブロック状態の組み合わせでアクセス可否を判定する。

## Terminology

| 用語 | 説明 |
|------|------|
| Cast | サービスを提供する側のユーザー |
| Guest | サービスを利用する側のユーザー |
| Cast Visibility | キャストのプロフィール公開設定（`public` / `private`） |
| Post Visibility | 投稿の公開設定（`public` / `private`） |
| Follow Status | フォロー状態（`none` / `pending` / `approved`） |
| Block | ユーザー間のブロック状態（双方向：Guest → Cast / Cast → Guest） |

## Block Policy

ブロックは **双方向** で機能する。

| 方向 | 説明 | Backend | Frontend UI |
|------|------|---------|-------------|
| Guest → Cast | ゲストがキャストをブロック | ✓ | 未実装（hook・API route は実装済み） |
| Cast → Guest | キャストがゲストをブロック | ✓ | ✓（ゲスト詳細画面のブロックボタン） |

### Block Effects

**Guest → Cast ブロック時（Backend で制御）：**
- 投稿の閲覧 → Deny
- 基本プロフィールの閲覧 → Deny
- フィードから除外
- Like / Comment / Follow / Favorite → Deny

**Cast → Guest ブロック時：**
- フォロー関係を自動削除（`BlockUser` use case）
- 以後そのゲストからのフォロー申請を拒否（`FollowCast` use case）
- キャストの管理画面でブロック状態を表示

---

## Access Rules

### Post Access

投稿の閲覧可否は以下の優先順位で判定：

```
1. blocked → Deny
2. cast.public && post.public → Allow (誰でも閲覧可)
3. follow.approved → Allow (全投稿閲覧可)
4. Otherwise → Deny
```

### Profile Access

| リソース | 条件 | 結果 |
|----------|------|------|
| 基本プロフィール | blocked | Deny |
| 基本プロフィール | not blocked | Allow |
| 詳細プロフィール（プラン・スケジュール） | blocked | Deny |
| 詳細プロフィール | cast.public | Allow |
| 詳細プロフィール | cast.private && follow.approved | Allow |
| 詳細プロフィール | cast.private && not follow.approved | Deny |

### Action Permissions

| アクション | 条件 | 結果 |
|------------|------|------|
| Like | blocked | Deny |
| Like | 投稿を閲覧可能 | Allow |
| Comment | blocked | Deny |
| Comment | 投稿を閲覧可能 | Allow |
| Follow | blocked | Deny |
| Follow | not blocked | Allow |
| Favorite | blocked | Deny |
| Favorite | not blocked | Allow |

---

## Access Matrix

### Post Visibility Matrix

ゲストから見た投稿の閲覧可否：

| Cast Visibility | Post Visibility | Follow Status | Blocked | Result |
|-----------------|-----------------|---------------|---------|--------|
| public | public | any | No | **Allow** |
| public | public | any | Yes | Deny |
| public | private | none | No | Deny |
| public | private | pending | No | Deny |
| public | private | approved | No | **Allow** |
| public | private | any | Yes | Deny |
| private | public | none | No | Deny |
| private | public | pending | No | Deny |
| private | public | approved | No | **Allow** |
| private | public | any | Yes | Deny |
| private | private | none | No | Deny |
| private | private | pending | No | Deny |
| private | private | approved | No | **Allow** |
| private | private | any | Yes | Deny |

### Simplified View

| | public cast | private cast |
|---|-------------|--------------|
| **public post** | 誰でも閲覧可 | approved フォロワーのみ |
| **private post** | approved フォロワーのみ | approved フォロワーのみ |

ブロックしている場合は常に Deny。

---

## Test Scenarios (Seed Data)

シードデータで以下のシナリオをテスト可能：

### Casts

| Phone | Name | Visibility | 用途 |
|-------|------|------------|------|
| 09011111111 | Yuna | public | 公開キャスト |
| 09022222222 | Mio | private | 非公開キャスト |
| 09033333333 | Rin | public | 公開キャスト（ブロックテスト用） |

### Guests

| Phone | Name | Follow Status | Block | 用途 |
|-------|------|---------------|-------|------|
| 08011111111 | 太郎 | Yuna: approved, Mio: approved | Rin をブロック | フォロー済み＋ブロックあり |
| 08022222222 | 次郎 | none | none | 非フォロー |
| 08033333333 | 三郎 | Mio: pending | none | フォロー申請中 |
| 08044444444 | 四郎 | Rin: approved | none | 一部フォロー済み |

### Expected Results

| Guest | Yuna (public) | | Mio (private) | | Rin (public) | |
|-------|---------------|---|---------------|---|--------------|---|
| | public post | private post | public post | private post | public post | private post |
| 太郎 | Allow | Allow | Allow | Allow | **Deny** | **Deny** |
| 次郎 | Allow | Deny | Deny | Deny | Allow | Deny |
| 三郎 | Allow | Deny | Deny | Deny | Allow | Deny |
| 四郎 | Allow | Deny | Deny | Deny | Allow | Allow |
| 未認証 | Allow | Deny | Deny | Deny | Allow | Deny |

※ 太郎は Rin をブロックしているため、Rin の投稿は全て Deny

---

## Implementation

### Location

アクセスポリシーはドメインごとに分離：

| Domain | Policy | Purpose |
|--------|--------|---------|
| Social | `slices/social/policies/access_policy.rb` | 投稿のアクセス制御 |
| Portfolio | `slices/portfolio/policies/profile_access_policy.rb` | プロフィールのアクセス制御 |

### Social::Policies::AccessPolicy

| Method | Purpose |
|--------|---------|
| `can_view_post?` | 投稿の閲覧可否 |
| `filter_viewable_posts` | バッチ処理用（タイムライン） |

### Portfolio::Policies::ProfileAccessPolicy

| Method | Purpose |
|--------|---------|
| `can_view_profile?` | 基本プロフィールの閲覧可否 |
| `can_view_profile_details?` | 詳細プロフィール（プラン等）の閲覧可否 |

### Cross-Domain Access

Portfolio から Social のデータにアクセスする場合は Adapter を使用：

```
Portfolio::Adapters::SocialAdapter
├── blocked?(guest_user_id:, cast_user_id:)
├── approved_follower?(guest_user_id:, cast_user_id:)
└── follow_status(guest_user_id:, cast_user_id:)
```

### Dependencies

| Repository | Domain | Purpose |
|------------|--------|---------|
| `follow_repository` | Social | フォロー状態の取得 |
| `block_repository` | Social | ブロック状態の取得 |

---

## Notes

### Block Direction

ブロックは **一方向のみ**（ゲスト → キャスト）。キャストがゲストをブロックする機能は存在しない。

### Onboarding Incomplete

`registered_at = NULL` のキャストはオンボーディング未完了。現在の実装では AccessPolicy での明示的なチェックはないが、そもそも検索結果に表示されない。

### Future Considerations

- ロールベースアクセス制御（RBAC）の導入時は別途検討
- キャスト間のアクセス制御は現時点では対象外
