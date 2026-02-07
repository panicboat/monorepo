# Tasks: Add Favorites Feature

## Phase 1: Backend Infrastructure

### 1.1 Database Migration
- [x] `cast_favorites` テーブルを作成する migration を追加
  - `id`, `cast_id`, `guest_id`, `created_at`
  - `(cast_id, guest_id)` にユニーク制約
  - `guest_id` と `cast_id` にインデックス
- **Files:** `services/monolith/workspace/config/db/migrate/20260208000000_create_cast_favorites.rb`
- **Validation:** `bin/rails db:migrate` が成功する

### 1.2 Seed Data
- [x] 開発用のお気に入りシードデータを追加
- **Files:** `services/monolith/workspace/config/db/seeds.rb`
- **Validation:** `bin/rails db:seed` でお気に入りデータが作成される

### 1.3 Proto Definition
- [x] `AddFavorite`, `RemoveFavorite`, `ListFavorites`, `GetFavoriteStatus` RPC を追加
- [x] Favorite messages を追加
- **Files:** `proto/social/v1/service.proto`
- **Validation:** `buf build` が成功する

### 1.4 Backend Stubs Generation
- [x] Proto から Ruby スタブを生成
- **Command:** `grpc_tools_ruby_protoc`
- **Validation:** スタブファイルが生成される

## Phase 2: Backend Implementation

### 2.1 Relation
- [x] `CastFavorites` relation を作成
- **Files:** `services/monolith/workspace/slices/social/relations/cast_favorites.rb`
- **Pattern:** `CastFollows` を参考に実装

### 2.2 Repository
- [x] `FavoriteRepository` を作成
  - `add_favorite(cast_id:, guest_id:)`
  - `remove_favorite(cast_id:, guest_id:)`
  - `favorite?(cast_id:, guest_id:)`
  - `list_favorites(guest_id:, limit:, cursor:)`
  - `favorite_cast_ids(guest_id:)`
  - `favorite_status_batch(cast_ids:, guest_id:)`
- **Files:** `services/monolith/workspace/slices/social/repositories/favorite_repository.rb`
- **Pattern:** `FollowRepository` を参考に実装

### 2.3 Use Cases
- [x] `AddFavorite` use case を作成
- [x] `RemoveFavorite` use case を作成
- [x] `ListFavorites` use case を作成
- [x] `GetFavoriteStatus` use case を作成
- **Files:** `services/monolith/workspace/slices/social/use_cases/favorites/*.rb`
- **Pattern:** `follows/` を参考に実装

### 2.4 gRPC Handler
- [x] TimelineService handler に Favorites RPC を追加
- **Files:** `services/monolith/workspace/slices/social/grpc/handler.rb`
- **Validation:** gRPC エンドポイントが応答する

### 2.5 Timeline Filtering
- [x] `ListCastPosts` に `filter=favorites` オプションを追加
- **Files:** `services/monolith/workspace/slices/social/grpc/handler.rb`
- **Validation:** Favorites フィルタで正しい投稿のみ返される

## Phase 3: Frontend Implementation

### 3.1 TypeScript Stubs Generation
- [x] Proto から TypeScript スタブを生成
- **Command:** `npm run proto:gen`
- **Validation:** スタブファイルが生成される

### 3.2 API Routes
- [x] `POST /api/guest/favorites` - お気に入り追加
- [x] `DELETE /api/guest/favorites` - お気に入り解除
- [x] `GET /api/guest/favorites` - お気に入りリスト取得
- [x] `GET /api/guest/favorites/status` - お気に入り状態一括取得
- **Files:** `web/nyx/workspace/src/app/api/guest/favorites/route.ts`, `status/route.ts`
- **Pattern:** `following/` を参考に実装

### 3.3 useFavorite Hook
- [x] `useFavorite` hook を作成
  - `addFavorite(castId)`
  - `removeFavorite(castId)`
  - `toggleFavorite(castId)`
  - `isFavorite(castId)`
  - `fetchFavoritesList()`
  - `fetchFavoriteStatus(castIds)`
- **Files:** `web/nyx/workspace/src/modules/social/hooks/useFavorite.ts`
- **Pattern:** `useFollow.ts` を参考に実装

### 3.4 socialStore Update
- [x] `socialStore` の favorites を API 同期対応に変更
  - `setFavorites(castIds)` action 追加
  - `addFavorite/removeFavorite` action 追加
  - persist から favorites を除外（サーバー同期のため）
- **Files:** `web/nyx/workspace/src/stores/socialStore.ts`

### 3.5 Timeline Favorites Tab
- [x] Favorites タブのフィルタリングを API 連携に変更
- [x] `filter=favorites` パラメータを送信
- **Files:** `web/nyx/workspace/src/modules/social/components/feed/TimelineFeed.tsx`
- **Validation:** Favorites タブでサーバーフィルタリングされた投稿が表示される

### 3.6 Favorite Button UI
- [x] キャスト詳細ページのお気に入りボタンを API 連携に更新
- [x] お気に入り状態の視覚的フィードバック（塗りつぶしハート/枠線ハート）
- **Files:** `web/nyx/workspace/src/app/(guest)/casts/[id]/page.tsx`

## Phase 4: Testing & Validation

### 4.1 Backend Tests
- [ ] FavoriteRepository のテスト
- [ ] Favorites use cases のテスト
- **Validation:** `bundle exec rspec` がパスする

### 4.2 Integration Testing
- [ ] お気に入り追加/解除が正常に動作する
- [ ] タイムラインの Favorites フィルタが正常に動作する
- [ ] デバイス間でお気に入りが同期される

## Dependencies

- Phase 2 は Phase 1 完了後に実行
- Phase 3 は Phase 1.3〜1.4 完了後に並行実行可能
- Phase 4 は Phase 2, 3 完了後に実行

## Parallelizable Work

以下のタスクは並行して実行可能：
- 2.1〜2.3 (Backend Relation/Repository/UseCases)
- 3.2〜3.4 (Frontend API Routes/Hook/Store) - Proto 生成後
