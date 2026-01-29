# Change: Implement Social Engagement Features

## Why
ゲストがキャストと関係を構築するためのソーシャル機能（フォロー、お気に入り、ブロック、足あと）が現在モックのみ。これらを実装することで、ゲストのエンゲージメントを高め、Cast の mypage に Followers 数を表示できるようにする。

## What Changes
- Social ドメインにフォロー/お気に入り/ブロック機能を実装
- 足あと（Footprints）記録・表示機能を実装
- Guest の Following/Favorites/Blocking 一覧ページをリアルデータ化
- Cast の Followers リストを実装

## Impact
- Affected specs: `discovery`, `portfolio`
- Affected code:
  - `services/monolith/workspace/slices/social/` (新規エンティティ)
  - `proto/social/v1/service.proto` (新規)
  - `web/nyx/workspace/src/app/(guest)/guest/following/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/guest/favorites/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/guest/blocking/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/guest/footprints/page.tsx`
  - `web/nyx/workspace/src/app/api/cast/mypage/route.ts` (新規)
