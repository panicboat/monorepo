# Tasks: Private Cast Visibility Control

## Phase 0: Database Migration (Breaking Change)

### 0.1 Create Migration
- [ ] `cast_posts.visible` (boolean) → `cast_posts.visibility` (text) に変更
- [ ] データ変換: `true` → `'public'`, `false` → `'private'`
- [ ] `visible` カラムを削除

### 0.2 Update Relations
- [ ] `Social::Relations::CastPosts` の `visible` を `visibility` に変更

### 0.3 Update Contracts
- [ ] `SavePostContract` の `visible` (boolean) を `visibility` (string enum) に変更

### 0.4 Update Proto
- [ ] `social/v1/service.proto` の Post message を更新
- [ ] `visible` → `visibility` に変更

### 0.5 Remove Guest Block UI
- [ ] フロントエンドからゲストのブロック UI を削除
- [ ] ※ バックエンドのブロック機能はそのまま残す（将来の拡張用）

## Phase 1: Backend - AccessPolicy

### 1.1 Create AccessPolicy Class
- [ ] `Social::Policies::AccessPolicy` クラスを新規作成
- [ ] `can_view_cast_details?(cast)` メソッドを実装
  - キャストにブロックされている場合は false
  - cast.visibility == 'public' の場合は true
  - それ以外は approved フォロワーのみ true
- [ ] `can_view_post?(post, cast)` メソッドを実装
  - キャストにブロックされている場合は false
  - cast.visibility == 'public' AND post.visibility == 'public' の場合は true
  - それ以外は approved フォロワーのみ true
- [ ] `blocked_by_cast?(cast_id)` メソッドを実装
  - キャスト → ゲストのブロックのみチェック
- [ ] `approved_follower_of?(cast_id)` メソッドを実装（FollowRepository を使用）

### 1.2 AccessPolicy Tests
- [ ] キャストによるブロック状態でのアクセス拒否テスト
- [ ] visibility と follow 状態の組み合わせテスト
- [ ] 未認証ユーザーのテスト

## Phase 2: Backend - Post Visibility

### 2.1 Update PostRepository
- [ ] `list_with_access_control` メソッドを追加
- [ ] Combined Visibility Rule + Block のフィルタリングを実装
- [ ] フォロー関係を効率的にチェックするクエリを実装（JOIN + サブクエリ）

### 2.2 Update ListPublicPosts UseCase
- [ ] `viewer_guest_id` パラメータを受け取るように更新
- [ ] `AccessPolicy` を使用してフィルタリング

### 2.3 Update GetPost UseCase
- [ ] `AccessPolicy.can_view_post?` を使用してアクセス制御
- [ ] 権限がない場合は適切なエラーを返す

### 2.4 Update Social gRPC Handler
- [ ] ListPublicPosts に viewer_guest_id を渡す
- [ ] GetPost にアクセス制御を追加

### 2.5 Backend Tests - Post Visibility
- [ ] PostRepository のテスト更新
- [ ] ListPublicPosts UseCase のテスト追加
- [ ] GetPost UseCase のテスト追加

## Phase 3: Backend - Profile Visibility

### 3.1 Update ProfilePresenter
- [ ] `profile_access` フィールドを追加 ("public" / "private")
- [ ] Limited アクセス時のフィールド制限ロジックを実装（plans, schedules のみ除外）

### 3.2 Update GetCast UseCase
- [ ] `viewer_guest_id` パラメータを追加
- [ ] `AccessPolicy.can_view_cast_details?` を使用
- [ ] ブロックされている場合は 404 を返す

### 3.3 Update Portfolio gRPC Handler
- [ ] GetCast に viewer_guest_id を渡す

### 3.4 Backend Tests - Profile Visibility
- [ ] ProfilePresenter のテスト追加
- [ ] GetCast UseCase のテスト追加
- [ ] ブロック時の挙動テスト

## Phase 4: Frontend - Timeline

### 4.1 Update Guest Timeline API Route
- [ ] viewer_guest_id（認証済みの場合）を gRPC に渡す

### 4.2 Update Cast Detail Timeline Tab
- [ ] Limited access 時の「フォローして投稿を見る」UI を実装

### 4.3 Update Post Detail Page
- [ ] 403 エラー時の「フォローが必要です」UI を実装

## Phase 5: Frontend - Profile

### 5.1 Update Cast Detail API Route
- [ ] `profile_access` フィールドを取得・返却

### 5.2 Update CastDetailView Component
- [ ] `profile_access: "private"` 時の限定表示 UI を実装
- [ ] プラン・スケジュールセクションの非表示と CTA 表示

### 5.3 Update Profile Types
- [ ] `profile_access` フィールドを型定義に追加

## Phase 6: Integration & Testing

### 6.1 E2E Scenarios
- [ ] Public キャスト + Public 投稿: 全員に表示
- [ ] Private キャスト + フォロワー: 全情報表示
- [ ] Private キャスト + 非フォロワー: 限定表示（プラン・スケジュールのみ非表示）
- [ ] ブロック状態: 完全に非表示

### 6.2 Performance Check
- [ ] タイムラインクエリのパフォーマンス確認
- [ ] 必要に応じてインデックス追加

## Dependencies

- Phase 1 (AccessPolicy) → Phase 2, 3 の前提
- Phase 2, 3 は並行実施可能
- Phase 4, 5 は対応する Backend Phase 完了後
- Phase 6 は全 Phase 完了後
