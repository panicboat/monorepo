# user_id 統一デザイン

## 背景

`user_id`（Identity ドメイン）と `profile_id`（Portfolio ドメインの cast_id / guest_id）の混在により、頻繁にバグが発生している。

**実際に起きたバグ:**
- バックエンド: `trust_handler.rb` で `my_cast.id`（profile_id）を `reviewee_id`（user_id が必要）に渡していた
- フロントエンド: `cast/guests/[id]/page.tsx` で URL パラメータ `id`（guest profile_id）を `revieweeId`（user_id が必要）に渡していた

## 方針

**profile_id（cast_id / guest_id）を完全に廃止し、全層で user_id に統一する。**

- cast/guest テーブルの PK を `user_id` に変更（`id` カラム廃止）
- FK カラムは `cast_user_id` / `guest_user_id` にリネーム
- URL、Proto、フロントエンドも全て user_id ベースに

## データベース変更

### PK 変更

| テーブル | 旧 PK | 新 PK |
|---------|-------|-------|
| `portfolio__casts` | `id` (UUID) | `user_id` (FK → identity__users) |
| `portfolio__guests` | `id` (UUID) | `user_id` (FK → identity__users) |

### FK カラムリネーム + データ移行

**Portfolio スキーマ内（FK制約あり）:**

| テーブル | 旧カラム | 新カラム |
|---------|---------|---------|
| `portfolio__cast_areas` | `cast_id` | `cast_user_id` |
| `portfolio__cast_gallery_media` | `cast_id` | `cast_user_id` |
| `portfolio__cast_genres` | `cast_id` | `cast_user_id` |

**クロススキーマ（FK制約なし）:**

| テーブル | 旧カラム | 新カラム |
|---------|---------|---------|
| `offer__plans` | `cast_id` | `cast_user_id` |
| `offer__schedules` | `cast_id` | `cast_user_id` |
| `post__posts` | `cast_id` | `cast_user_id` |
| `post__likes` | `guest_id` | `guest_user_id` |
| `relationship__follows` | `cast_id`, `guest_id` | `cast_user_id`, `guest_user_id` |
| `relationship__favorites` | `cast_id`, `guest_id` | `cast_user_id`, `guest_user_id` |

**変更不要:**

| テーブル | カラム | 理由 |
|---------|-------|------|
| `relationship__blocks` | `blocker_id`, `blocked_id` | 既に user_id ベース |
| `trust__reviews` | `reviewer_id`, `reviewee_id` | 既に user_id ベース |
| `trust__taggings` | `tagger_id`, `target_id` | 既に user_id ベース |

## バックエンド変更

### ROM リレーション

全リレーションファイルでカラム名を更新。cast/guest リレーションは PK を `user_id` に変更。

### リポジトリ

- `cast_repository.rb`: `find_by_id` と `find_by_user_id` が統合され `find` に一本化
- `guest_repository.rb`: 同上
- 他リポジトリ: カラム名更新

### gRPC ハンドラー

- `my_cast.id` と `current_user_id` の取り違えが構造的に不可能になる
- `trust_handler.rb` の `guest_adapter.find_by_user_ids` が簡素化
- 全ハンドラーでカラム名に合わせた更新

## Proto 変更

### Portfolio Proto

- `CastProfile.id` フィールド廃止 → `user_id` が唯一の識別子
- `GuestProfile.id` / `GuestDetailProfile.id` 同様に廃止

### Trust Proto

- `Review.reviewer_profile_id` フィールド廃止 → `reviewer_id`（user_id）で直接リンク可能

### 他の Proto

| Proto | 変更 |
|-------|------|
| `offer/v1/service.proto` | `cast_id` → `cast_user_id` |
| `post/v1/service.proto` | `cast_id` → `cast_user_id` |
| `relationship/v1/*_service.proto` | `cast_id` → `cast_user_id`、`guest_id` → `guest_user_id` |
| `feed/v1/feed_service.proto` | `cast_id` → `cast_user_id`、`guest_id` → `guest_user_id` |

## フロントエンド変更

### URL ルーティング

```
/cast/guests/[id]     → /cast/guests/[userId]
/(guest)/casts/[id]   → /(guest)/casts/[userId]
```

### 型定義・Hooks

- Proto 生成型: `id` フィールド消滅、`userId` が PK
- `useCastProfile` hook: `profileId` 廃止、`userId` のみ返す
- `useGuestDetail` hook: 同上
- `ReviewCard`: `reviewerProfileId` → `reviewerId`（user_id）でリンク生成
- `WriteTrustModal`: `targetId` が user_id であることが自明に

### API ルート

- `/api/cast/guests/[id]/route.ts` → パラメータが user_id に
- 他の cast/guest 関連ルート: proto 型変更に追従
- `/api/me/trust/reviews/route.ts`: 変更なし（既に user_id）

## シードデータ

`config/db/seeds/` 配下の全ジェネレーターで `cast_id` / `guest_id` → `cast_user_id` / `guest_user_id` に更新。`build_cast_user_map` / `build_guest_user_map` のようなマッピングは不要になる。
