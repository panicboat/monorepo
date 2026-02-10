# Change: Slim Cast UI - 3 Domain Architecture

## Why

現在のキャスト向けUIは、将来的な機能（Ritual、Trust、Concierge）を含む広範な構成になっている。プロジェクトの方針として、まずは**Identity、Portfolio、Social**の3ドメインに集中し、UIをスリム化することで、コア機能の完成度を高める。

## What Changes

### Domain Cleanup Summary

| Category | Keep | Remove |
|----------|------|--------|
| Domains | Identity, Portfolio, Social | Ritual, Trust, Concierge |
| Bottom Nav | Home, Timeline, MyPage | Schedule |
| Onboarding | Step 1-3 | Step 4 (WeeklySchedule) |

### Specs Removed

| Spec | Domain |
|------|--------|
| `concierge` | Concierge |
| `ritual` | Ritual |
| `trust` | Trust |
| `history-reviews` | Trust |
| `schedule` | Ritual |

### Pages Removed

| Page | Domain |
|------|--------|
| `/cast/reviews` | Trust |
| `/cast/history` | Ritual |
| `/cast/pledges/*` | Ritual |
| `/cast/schedules` | Ritual |
| `/cast/onboarding/step-4` | Ritual |

### Modules Removed

| Module | Contents |
|--------|----------|
| `modules/ritual/` | WeeklyScheduleInput, ReservationDetail, RitualPledge, etc. |
| `modules/trust/` | ReviewList, TrustRadar, GuestInfoSheet, etc. |

### API Routes Removed

| Route | Domain |
|-------|--------|
| `/api/ritual/*` | Ritual |
| `/api/trust/*` | Trust |

### Home Screen Changes

- **REMOVED**: EarningsSummary（売上サマリー）
- **REMOVED**: UpcomingReservations（予約一覧）
- **ADDED**: フォローリクエスト一覧
- **ADDED**: 新着フォロワー一覧

### MyPage Changes

- **REMOVED**: レビュー管理メニュー
- **REMOVED**: 履歴・売上メニュー
- **ADDED**: フォロワーリストメニュー
- **MODIFIED**: Stats表示をフォロワー数のみに

### Navigation Changes

- **Bottom Nav**: 4タブ → 3タブ (Schedule削除)
- **Top Nav**: 削除ページのタイトル判定を削除

### Profile Edit

- **MODIFIED**: セクションをデフォルトで展開状態に

## Impact

### Affected Specs

**Modified:**
- `home` - ホーム画面の内容を Social 向けに変更
- `mypage` - マイページのメニュー構成を変更

**Removed:**
- `concierge`, `ritual`, `trust`, `history-reviews`, `schedule`

### Affected Code

**Deleted:**
- `app/(cast)/cast/reviews/`
- `app/(cast)/cast/history/`
- `app/(cast)/cast/pledges/`
- `app/(cast)/cast/schedules/`
- `app/(cast)/cast/onboarding/step-4/`
- `app/(cast)/cast/home/components/EarningsSummary.tsx`
- `app/(cast)/cast/home/components/UpcomingReservations.tsx`
- `modules/ritual/`
- `modules/trust/`
- `app/api/ritual/`
- `app/api/trust/`

**Modified:**
- `app/(cast)/cast/home/page.tsx`
- `app/(cast)/cast/mypage/page.tsx`
- `app/(cast)/cast/profile/page.tsx`
- `components/layout/cast/CastTopNavBar.tsx`
- `components/layout/cast/CastBottomNavBar.tsx`
- `mocks/handlers/cast.ts`

**Created:**
- `app/(cast)/cast/followers/page.tsx`
- Home: FollowRequestList component
- Home: NewFollowersList component

### Not Affected

- Identity ドメイン（認証・認可）
- Portfolio ドメイン（プロフィール編集、プラン設定）
- Social ドメイン（タイムライン、投稿、コメント、いいね）
- ブロックリスト機能
- バックエンド API・データベース

## Notes

- 既存のフォローリクエスト機能（`/cast/followers/requests`）は実装済み、ホーム画面に統合
- 削除する機能のバックエンド API やデータベーススキーマは変更しない（UI のみの変更）
- 将来 Ritual/Trust/Concierge を実装する際は、Git 履歴から復元可能
