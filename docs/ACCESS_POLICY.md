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
| Block | キャストがゲストをブロックしている状態（Cast → Guest の単方向） |

## Block Policy

ブロックは **Cast → Guest の単方向** で機能する。

| 方向 | 説明 | Backend | Frontend UI |
|------|------|---------|-------------|
| Cast → Guest | キャストがゲストをブロック | ✓ | ✓（ゲスト詳細画面のブロックボタン） |

### Block Effects

**Cast → Guest ブロック時：**
- フォロー関係を自動削除（`BlockUser` use case）
- 以後そのゲストからのフォロー申請を拒否（`FollowCast` use case）
- 詳細プロフィールの閲覧 → Deny
- 投稿の閲覧 → Deny
- フィードから除外
- Like / Comment → Deny
- キャストの管理画面でブロック状態を表示

---

## Access Rules

### Post Access

投稿の閲覧可否は以下の優先順位で判定：

```
1. Cast → Guest ブロック → Deny
2. cast.public && post.public → Allow（誰でも閲覧可）
3. 未認証 → Deny
4. follow.approved → Allow（全投稿閲覧可）
5. Otherwise → Deny
```

### Profile Access

| リソース | 条件 | 結果 |
|----------|------|------|
| 基本プロフィール | any（未認証含む） | Allow |
| 詳細プロフィール（プラン・スケジュール・タイムライン） | Cast → Guest ブロック | Deny |
| 詳細プロフィール | cast.public | Allow |
| 詳細プロフィール | cast.private && follow.approved | Allow |
| 詳細プロフィール | cast.private && not follow.approved | Deny |
| 詳細プロフィール | 未認証 && cast.private | Deny |

### Feed Filtering

ゲストのフィードは 2 種のフィルタで表示内容が異なる。
全フィルタ共通で、Cast → Guest ブロック済みキャストの投稿は除外される。

| Filter | 表示対象 |
|--------|---------|
| ALL | public cast の public post + followed cast の全 post |
| FOLLOWING | followed cast の全 post（public + private） |

### Action Permissions

| アクション | 条件 | 結果 |
|------------|------|------|
| Like | Cast → Guest ブロック | Deny |
| Like | 投稿を閲覧可能 | Allow |
| Comment | Cast → Guest ブロック | Deny |
| Comment | 投稿を閲覧可能 | Allow |
| Follow | Cast → Guest ブロック | Deny |
| Follow | not blocked | Allow（public cast: approved / private cast: pending） |

---

## Access Matrix

### Post Visibility Matrix

ゲストから見た投稿の閲覧可否：

| Cast Visibility | Post Visibility | Follow Status | Blocked (C→G) | Result |
|-----------------|-----------------|---------------|----------------|--------|
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

Cast → Guest ブロックしている場合は常に Deny。

### Profile Access Matrix

| Cast Visibility | Follow Status | Blocked (C→G) | 基本プロフィール | 詳細プロフィール |
|-----------------|---------------|----------------|------------------|------------------|
| public | any | No | **Allow** | **Allow** |
| public | any | Yes | **Allow** | Deny |
| private | none | No | **Allow** | Deny |
| private | pending | No | **Allow** | Deny |
| private | approved | No | **Allow** | **Allow** |
| private | any | Yes | **Allow** | Deny |
| public | - | 未認証 | **Allow** | **Allow** |
| private | - | 未認証 | **Allow** | Deny |

### Feed Filtering Matrix

| Filter | Cast Visibility | Follow Status | Post Visibility | Blocked (C→G) | Result |
|--------|-----------------|---------------|-----------------|----------------|--------|
| ALL | public | any | public | No | **Allow** |
| ALL | public | approved | private | No | **Allow** |
| ALL | public | not approved | private | No | Deny |
| ALL | private | approved | any | No | **Allow** |
| ALL | private | not approved | any | No | Deny |
| ALL | any | any | any | Yes | Deny |
| FOLLOWING | any | approved | any | No | **Allow** |
| FOLLOWING | any | approved | any | Yes | Deny |

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
| 08011111111 | 太郎 | Yuna: approved, Mio: approved | Rin が太郎をブロック | フォロー済み＋ブロックあり |
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

※ Rin が太郎をブロック（Cast → Guest）しているため、太郎から Rin の投稿は全て Deny

---

## Implementation

### Location

アクセスポリシーはドメインごとに分離：

| Domain | Policy | Purpose |
|--------|--------|---------|
| Post | `slices/post/policies/access_policy.rb` | 投稿のアクセス制御 |
| Portfolio | `slices/portfolio/policies/profile_access_policy.rb` | プロフィールのアクセス制御 |
| Feed | `slices/feed/use_cases/list_guest_feed.rb` | フィードのフィルタリング |

### Post::Policies::AccessPolicy

| Method | Purpose |
|--------|---------|
| `can_view_post?` | 投稿の閲覧可否 |
| `filter_viewable_posts` | バッチ処理用（タイムライン） |

### Portfolio::Policies::ProfileAccessPolicy

| Method | Purpose |
|--------|---------|
| `can_view_profile?` | 基本プロフィールの閲覧可否 |
| `can_view_profile_details?` | 詳細プロフィール（プラン等）の閲覧可否 |

### Cross-Domain Adapters

Portfolio → Relationship:

```text
Portfolio::Adapters::SocialAdapter
├── approved_follower?(guest_user_id:, cast_user_id:)
├── follow_status(guest_user_id:, cast_user_id:)
├── get_follow_detail(guest_user_id:, cast_user_id:)
└── cast_blocked_guest?(cast_user_id:, guest_user_id:)
```

Post → Relationship:

```text
Post::Adapters::RelationshipAdapter
├── following?(cast_user_id:, guest_user_id:)
├── following_status_batch(cast_user_ids:, guest_user_id:)
├── following_cast_user_ids(guest_user_id:)
├── blocked_guest_ids(blocker_id:)
├── cast_blocked_guest?(cast_user_id:, guest_user_id:)
└── blocked_by_cast_ids(guest_user_id:)
```

Feed → Relationship:

```text
Feed::Adapters::RelationshipAdapter
├── following_cast_user_ids(guest_user_id:)
├── blocked_guest_ids(blocker_id:)
└── blocker_cast_ids_for_guest(guest_user_id:)
```

### Dependencies

| Repository | Domain | Purpose |
|------------|--------|---------|
| `follow_repository` | Relationship | フォロー状態の取得 |
| `block_repository` | Relationship | ブロック状態の取得 |

---

## Notes

### Block Direction

ブロックは **Cast → Guest の単方向**。

- Cast → Guest: キャストがゲストをブロック。フォロー自動削除 + フォロー拒否 + コンテンツアクセス制御（詳細プロフィール・投稿・フィード・アクション全て Deny）。

ゲストからキャストをブロックする機能は存在しない。

### Onboarding Incomplete

`registered_at = NULL` のキャストはオンボーディング未完了。現在の実装では AccessPolicy での明示的なチェックはないが、そもそも検索結果に表示されない。

### Follow on Visibility Change

キャストが visibility を変更した場合：
- `public` → `private`: 既存の approved フォロワーはそのまま。新規フォローは pending になる。
- `private` → `public`: `approve_all_pending` メソッドは存在するが **現在は呼ばれていない**。pending リクエストは自動承認されない。

### Future Considerations

- `private` → `public` 切り替え時の pending リクエスト自動承認
- ロールベースアクセス制御（RBAC）の導入時は別途検討
- キャスト間のアクセス制御は現時点では対象外
