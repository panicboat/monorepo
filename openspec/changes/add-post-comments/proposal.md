# Change: Add Post Comment System

## Why

タイムラインのポストにコメント機能がない。現在 `comments_count` は常に0を返し、コメントボタンは存在するが機能しない。キャストがポストを投稿し、ゲストがコメントを付け、さらにキャストがそれに返信するというインタラクションフローを実現することで、キャストとゲストの関係性を深め、エンゲージメントを向上させる。

## What Changes

- **DB**: `social.post_comments` テーブルの新規作成
- **Proto**: コメント関連の message と RPC の追加（`ListPostComments`, `CreatePostComment`, `DeletePostComment`）
- **Backend**: コメントの CRUD UseCase・Repository・Contract の実装
- **Frontend**: コメント表示 UI、投稿フォーム、スレッド表示（1階層返信）
- **BREAKING**: Proto `social.v1.TimelineService` に新規 RPC を追加

## Impact

- Affected specs: social (new capability: post-comments), timeline
- Affected code:
  - `proto/social/v1/service.proto` - 新規 message と RPC
  - `services/monolith/workspace/` - DB migration, social slice 全般
  - `web/nyx/workspace/src/modules/social/` - types, hooks, components
  - `web/nyx/workspace/src/app/api/` - BFF API route
  - `web/nyx/workspace/src/modules/discovery/components/guest/TimelineFeed.tsx` - コメント表示
