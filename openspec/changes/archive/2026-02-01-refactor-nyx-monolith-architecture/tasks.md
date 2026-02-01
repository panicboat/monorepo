# Tasks: nyx / monolith アーキテクチャリファクタリング

## 1. Phase 2: トークン管理の一元化（優先度: Critical）✅

- [x] 1.1 `lib/auth/` ディレクトリを作成
- [x] 1.2 `lib/auth/tokens.ts` を作成
  - getAccessToken, setTokens, clearTokens 関数
- [x] 1.3 `lib/auth/migration.ts` を作成
  - 旧キー（nyx_cast_access_token 等）からの読み取り
  - 新形式への変換ロジック
- [x] 1.4 `lib/auth/index.ts` を作成
  - エクスポート定義
- [x] 1.5 `stores/` ディレクトリを作成（src直下）
- [x] 1.6 `stores/authStore.ts` を作成
  - Zustand Store 定義
  - persist ミドルウェア設定
  - lib/auth を呼び出すアクション
- [x] 1.7 `useAuth.tsx` を authStore を使用するよう修正
  - localStorage 直接操作を削除
  - pathname 依存の Role 推論を削除
- [x] 1.8 `lib/swr.ts` の getToken を authStore 参照に変更
- [ ] 1.9 認証フローのテスト（手動確認必要）
  - ログイン → トークン保存確認
  - リフレッシュ → トークン更新確認
  - ログアウト → トークンクリア確認

## 2. Phase 1: Frontend モジュール構造の再編成（優先度: High）✅

- [x] 2.1 `components/layout/` ディレクトリを作成
- [x] 2.2 shell コンポーネントを移動
  - `modules/shell/components/TopNavBar.tsx` → `components/layout/`
  - `modules/shell/components/BottomNavBar.tsx` → `components/layout/`
  - `modules/shell/components/ResponsiveMainContainer.tsx` → `components/layout/`
  - `modules/shell/components/guest/*` → `components/layout/guest/`
  - `modules/shell/components/cast/*` → `components/layout/cast/`
- [x] 2.3 `modules/shell/` ディレクトリを削除
- [x] 2.4 `components/shared/` ディレクトリを作成
- [x] 2.5 common コンポーネントを移動
  - `modules/common/components/guest/MediaModal.tsx` → `components/shared/`
- [x] 2.6 `modules/common/` ディレクトリを削除
- [x] 2.7 discovery コンポーネントを再配置
  - `modules/discovery/components/guest/TimelineFeed.tsx` → `modules/social/components/guest/`
  - `modules/discovery/components/guest/RankingWidget.tsx` → `modules/portfolio/components/guest/`
  - `modules/discovery/components/guest/EventSlider.tsx` → `modules/portfolio/components/guest/`
- [x] 2.8 `modules/discovery/` ディレクトリを削除
- [x] 2.9 全 import パスを更新
  - `@/modules/shell/` → `@/components/layout/`
  - `@/modules/common/` → `@/components/shared/`
  - `@/modules/discovery/` → 移動先に応じて変更
- [x] 2.10 モジュール内部構造の統一
  - `modules/social/components/` ディレクトリを作成
  - `modules/social/components/guest/` ディレクトリを作成
- [x] 2.11 各モジュールに types.ts を追加（存在しない場合）
  - `modules/identity/types.ts`
  - `modules/concierge/types.ts`
  - `modules/ritual/types.ts`
  - `modules/trust/types.ts`
- [x] 2.12 ビルド確認（`npm run build`）
- [ ] 2.13 全ページの表示確認（手動確認必要）

## 3. Phase 3: 状態管理の統一（優先度: High）✅

依存: Phase 2 完了後

- [x] 3.1 `stores/uiStore.ts` を作成
  - isSidebarOpen, activeModal 状態
  - openSidebar, closeSidebar, openModal, closeModal アクション
- [x] 3.2 `stores/socialStore.ts` を作成
  - following, blocking, favorites 状態
  - toggleFollow, toggleBlock, toggleFavorite アクション
  - persist ミドルウェア設定
- [x] 3.3 `useSocial.ts` を socialStore を使用するよう修正
  - localStorage 直接操作を削除
  - useState を Zustand に置換
- [ ] 3.4 モーダル/サイドバーコンポーネントを uiStore に接続（将来対応）
- [x] 3.5 AuthContext の簡素化
  - 大部分のロジックを authStore に移譲
  - SWR でのユーザープロフィール取得のみに限定
- [ ] 3.6 状態管理の動作確認（手動確認必要）
  - フォロー/お気に入りの永続化確認
  - モーダル開閉の動作確認

## 4. Phase 4: デザイントークンシステムの構築（優先度: Medium）✅

- [x] 4.1 `globals.css` にカラートークンを追加
  - Brand colors (primary, secondary, hover)
  - Semantic colors (surface, border, text-*)
  - Status colors (success, warning, error, info)
  - Role colors (guest, cast)
- [x] 4.2 `@theme inline` ブロックを拡張
  - Tailwind ユーティリティへのマッピング
- [x] 4.3 `config/` ディレクトリを作成
- [x] 4.4 `config/theme.ts` を作成
  - colors オブジェクトのエクスポート
  - CSS変数参照（var(--color-*)）
  - as const による型安全性
- [x] 4.5 `Button.tsx` をトークン参照に更新
  - `bg-pink-500` → `bg-brand`
  - `bg-blue-400` → `bg-brand-cast`
- [x] 4.6 `ActionButton.tsx` をトークン参照に更新
- [x] 4.7 `Toast.tsx` をトークン参照に更新
  - `text-red-500` → `text-error`
  - `text-green-500` → `text-success`
- [ ] 4.8 その他コンポーネントのハードコードカラーを置換（将来対応）
  - `SectionCard.tsx`
  - `HashtagInput.tsx`
  - ナビゲーションコンポーネント
- [ ] 4.9 スタイリングの表示確認（手動確認必要）

## 5. Phase 5: Backend スライス構造の統一（優先度: Medium）✅

- [x] 5.1 `lib/grpc/authenticatable.rb` を作成
  - authenticate_user! メソッド
  - current_user_id メソッド
- [x] 5.2 social スライスのハンドラーを Authenticatable に移行
  - `slices/social/grpc/handler.rb`
- [x] 5.3 `slices/social/adapters/` ディレクトリを作成
- [x] 5.4 `slices/social/adapters/cast_adapter.rb` を作成
  - CastInfo Data.define
  - find_by_user_id メソッド
- [x] 5.5 `slices/social/grpc/handler.rb` の直接依存を削除
  - `Portfolio::Slice["repositories.cast_repository"]` → `cast_adapter`
- [x] 5.6 identity の基底クラスを削除
  - `slices/identity/action.rb` を削除
  - `slices/identity/operation.rb` を削除
  - `slices/identity/view.rb` を削除
- [ ] 5.7 gRPC テストの実行確認（手動確認必要）
- [ ] 5.8 API 動作確認（手動確認必要）

## 6. ドキュメント整備 ✅

- [x] 6.1 `services/handbooks/workspace/docs/ARCHITECTURE.md` を更新
  - Frontend ディレクトリ構造の更新（modules/, stores/, config/）
  - Backend スライス構造の更新（adapters/, 基底クラス削除）
- [x] 6.2 フロントエンド構造のドキュメント追加
  - `stores/` ディレクトリの説明
  - `lib/auth/` の説明
  - `config/theme.ts` の説明
- [x] 6.3 バックエンド構造のドキュメント追加
  - `adapters/` パターンの説明
  - `lib/grpc/authenticatable.rb` の説明
- [x] 6.4 状態管理パターンのドキュメント追加
  - Zustand + SWR の使い分け
- [x] 6.5 デザイントークンのドキュメント追加
  - カラートークン一覧
  - 使用方法（globals.css, config/theme.ts）

## 7. 最終確認 ✅

- [x] 7.1 ビルド確認（`npm run build`）
- [ ] 7.2 E2E 動作確認（手動確認必要）
  - ログイン → プロフィール表示 → 投稿 → ログアウト
- [ ] 7.3 パフォーマンス確認（手動確認必要）
  - 初期ロード時間
  - 状態更新の応答性
