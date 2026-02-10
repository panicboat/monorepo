# Change: Pivot to Cast-Centric SNS

## Why

現在の Nyx.PLACE は予約プラットフォーム（CtoC）として設計されているが、まずはキャスト主体のSNSとしてサービスを立ち上げ、ユーザーベースを構築してから予約機能を追加する方針に転換する。

## What Changes

### Phase 1: ドメイン削減（このproposal）

**削除するドメイン:**
- Concierge（チャット機能）
- Ritual（予約機能）
- Trust（評価・CRM機能）

**残すドメイン:**
- Identity（認証・認可）
- Portfolio（プロフィール管理）
- Social（タイムライン・投稿）

### Phase 2: ゲスト機能のスリム化（このproposal）

**削除する機能:**
1. ホーム画面のキャストリストタブ - タイムラインのみに集中
2. Tonight Pick 機能 - スケジュール関連機能の削除
3. Concierge（チャット）機能 - ドメイン削除に伴う

**残す機能:**
- タイムライン閲覧
- キャストのフォロー
- 投稿へのいいね・コメント
- お気に入り機能

## Impact

### Affected Code

**フロントエンド（削除）:**
- `web/nyx/workspace/src/app/(guest)/concierge/` - チャットページ
- `web/nyx/workspace/src/modules/concierge/` - チャットモジュール
- `web/nyx/workspace/src/modules/portfolio/components/guest/CastList.tsx` - キャストリストコンポーネント
- `web/nyx/workspace/src/app/api/concierge/` - Concierge API routes

**フロントエンド（修正）:**
- `web/nyx/workspace/src/app/(guest)/page.tsx` - ホーム画面（タブ削除）
- `web/nyx/workspace/src/components/layout/guest/GuestBottomNavBar.tsx` - ナビゲーション修正

**バックエンド（削除）:**
- `services/monolith/workspace/slices/concierge/` - Conciergeスライス
- `services/monolith/workspace/slices/ritual/` - Ritualスライス
- `services/monolith/workspace/slices/trust/` - Trustスライス

**Proto（削除）:**
- `proto/concierge/` - 未実装のため影響なし
- `proto/ritual/` - 未実装のため影響なし
- `proto/trust/` - 未実装のため影響なし

### Breaking Changes

- **BREAKING**: Concierge API エンドポイントの削除
- **BREAKING**: ホーム画面UIの変更（キャストリストタブ削除）

### Risk Assessment

- **低リスク**: Concierge/Ritual/Trust は未実装またはモック状態
- **低リスク**: Tonight Pick はモックデータのみ
- **中リスク**: ホーム画面のUI変更はユーザー体験に影響

## Success Criteria

1. ドメインが3つ（Identity, Portfolio, Social）のみになっている
2. ホーム画面がタイムラインのみのシンプルなUIになっている
3. Concierge関連のコードが完全に削除されている
4. アプリケーションが正常に起動・動作する
