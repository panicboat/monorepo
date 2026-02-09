# Proposal: Private Cast Visibility Control

## Summary

Private キャストの投稿およびプロフィール詳細の可視性を制御する機能を追加する。

## Background

現在の実装では:
- キャストは `visibility` を `public` / `private` に設定できる
- `private` キャストへのフォローは承認制（pending → approved）
- しかし、**投稿の可視性**は現在全てのゲストに表示されている
- **プロフィール詳細**（bio、料金プラン、スケジュール等）も非フォロワーに全て見えている

この提案では、private キャストに対して以下の可視性制御を追加する:
1. **投稿の可視性**: フォロワー（approved）のみに投稿を表示
2. **プロフィール詳細の可視性**: 非フォロワーには制限された情報のみ表示

## Goals

- Private キャストのプライバシーを保護する
- フォロー承認制の価値を高める（フォローすることで詳細が見られる）
- Public/Private の意味を明確にし、キャストが自分のコンテンツをコントロールできるようにする

## Non-Goals

- プロフィール項目ごとの細かい可視性設定（シンプルな全体制御のみ）

## Design

### 投稿の可視性モデル

#### スキーマ変更

`cast_posts.visible` (boolean) を `cast_posts.visibility` (text enum) に変更する。

| Before | After |
|--------|-------|
| `visible: true` | `visibility: 'public'` |
| `visible: false` | `visibility: 'private'` |

これにより `casts.visibility` と命名・型が統一される。

#### 投稿の可視性ルール

投稿の表示は **キャストの visibility** と **投稿の visibility** の両方で制御される。

| Cast Visibility | Post Visibility | Viewer | Result |
|-----------------|-----------------|--------|--------|
| public | public | Anyone | Visible |
| public | private | Approved Follower | Visible |
| private | public | Approved Follower | Visible |
| private | private | Approved Follower | Visible |

**ルール**: `cast.visibility == 'public' AND post.visibility == 'public'` の場合のみ誰でも閲覧可能。それ以外は approved フォロワーのみ。

> **Note**: 将来的に運営による非公開設定が追加される可能性があるため、実装時は両方の visibility 値を明示的にチェックすること。

### プロフィール詳細の可視性

Private キャストのプロフィールを非フォロワーが閲覧する場合:

| Field | Visibility |
|-------|------------|
| Handle, Name | Visible |
| Avatar, Profile Image | Visible |
| Tagline | Visible |
| Bio | Visible |
| Images (gallery) | Visible |
| Tags | Visible |
| Areas (活動エリア) | Visible |
| Genres (ジャンル) | Visible |
| Social Links | Visible |
| Age, Height, Blood Type, Three Sizes | Visible |
| Lock Icon (private indicator) | Visible |
| **Plans (料金プラン)** | **Hidden** |
| **Schedules (スケジュール)** | **Hidden** |

プランとスケジュールのセクションには「フォローして詳細を見る」のような CTA を表示する。

## Implementation Approach

### AccessPolicy パターンの導入

アクセス制御ロジックを共通化するため、`AccessPolicy` クラスを導入する。これにより visibility、フォロー状態、ブロック状態を一元管理できる。

```ruby
# Social::Policies::AccessPolicy
class AccessPolicy
  def initialize(viewer_id:, viewer_type:)
    @viewer_id = viewer_id
    @viewer_type = viewer_type
  end

  # キャストのプロフィール詳細（プラン・スケジュール）を閲覧可能か
  def can_view_cast_details?(cast)
    return false if blocked_by_cast?(cast.id)
    return true if cast.visibility == "public"
    approved_follower_of?(cast.id)
  end

  # 投稿を閲覧可能か
  def can_view_post?(post, cast)
    return false if blocked_by_cast?(cast.id)
    return true if cast.visibility == "public" && post.visibility == "public"
    approved_follower_of?(cast.id)
  end

  private

  def blocked_by_cast?(cast_id)
    # キャストがこのゲストをブロックしているか
    # ※ ゲスト → キャストのブロックは廃止
  end

  def approved_follower_of?(cast_id)
    # viewer が cast の approved フォロワーか
  end
end
```

#### ブロック機能の方向性

| 方向 | Backend | UI |
|------|---------|-----|
| キャスト → ゲスト | 有効 | 有効 |
| ゲスト → キャスト | 有効（残す） | **削除** |

> ゲスト → キャストのブロック機能は AccessPolicy では使用しない。UI のみ削除し、バックエンドは将来の拡張用に残す。

#### 考慮する条件

| Check | 説明 |
|-------|------|
| `blocked_by_cast?` | キャストがゲストをブロックしている場合、全て非表示 |
| `cast.visibility` | キャストの公開設定 |
| `post.visibility` | 投稿の公開設定 |
| `approved_follower?` | viewer が approved フォロワーか |

#### 適用箇所

- `ListPublicPosts` - タイムライン取得
- `GetPost` - 投稿詳細取得
- `GetCast` - プロフィール取得
- `ListCasts` / `SearchCasts` - 検索結果

### Backend Changes

1. **Social Domain - AccessPolicy**
   - `Social::Policies::AccessPolicy` クラスを新規作成
   - ブロック、フォロー、visibility を一元管理
   - 各 UseCase から呼び出し

2. **Social Domain - Post Visibility**
   - `ListPublicPosts` で `AccessPolicy` を使用
   - `GetPost` で `AccessPolicy` を使用

3. **Portfolio Domain - Profile Visibility**
   - `GetCast` で `AccessPolicy` を使用（Social ドメインを参照）
   - `profile_access` フラグを追加（public/private）

### Frontend Changes

1. **Guest Timeline**
   - API から返される投稿のみ表示（バックエンドで制御）

2. **Cast Detail Page**
   - `profile_access: "private"` の場合、プラン・スケジュールセクションを非表示
   - 「フォローして詳細を見る」CTA を表示
   - フォロー承認後に自動的に詳細が表示される

### API Changes

- `GetCast` レスポンスに `profile_access` フィールドを追加
- `ListPublicPosts` に `viewer_guest_id` パラメータを追加

## Affected Specs

- `portfolio` - プロフィール可視性制御
- `timeline` - 投稿可視性制御

## Migration

### Database Changes

1. `cast_posts.visible` (boolean) → `cast_posts.visibility` (text) に変更
   - `true` → `'public'`
   - `false` → `'private'`

```sql
-- Migration
ALTER TABLE social.cast_posts ADD COLUMN visibility text DEFAULT 'public' NOT NULL;
UPDATE social.cast_posts SET visibility = CASE WHEN visible THEN 'public' ELSE 'private' END;
ALTER TABLE social.cast_posts DROP COLUMN visible;
```

### Breaking Changes

- `cast_posts.visible` カラムが削除される
- API レスポンスで `visible` → `visibility` に変更

## Risks

- **パフォーマンス**: フォロー関係のチェックがタイムラインクエリに追加される
  - 対策: 適切なインデックスの確認、キャッシュ検討
- **UX の複雑さ**: Private キャストの詳細が見られない場合のユーザー体験
  - 対策: 明確な CTA と説明テキストで誘導
