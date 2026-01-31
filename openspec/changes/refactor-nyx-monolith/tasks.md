# Tasks: Nyx + Monolith Refactoring

## Phase 1: Frontend Module Standardization ✅

- [x] 1.1 全モジュールに `types.ts` を追加（common, concierge, discovery, ritual, trust, shell）
- [x] 1.2 social モジュールに `components/` ディレクトリを追加
- [x] 1.3 モジュール構造のテンプレートドキュメントを作成

## Phase 2: Frontend Token Management ✅

- [x] 2.1 `lib/auth/tokens.ts` を作成（トークン定数・ユーティリティ）
- [x] 2.2 `lib/auth/context.tsx` に AuthProvider をリファクタリング
- [x] 2.3 各フックからトークン直接アクセスを削除
- [x] 2.4 Cast/Guest トークン判定ロジックを統一

## Phase 3: Frontend Zustand Implementation ✅

- [x] 3.1 `stores/auth-store.ts` を作成
- [x] 3.2 AuthProvider を Zustand ストアに移行
- [x] 3.3 プロフィール状態を Zustand に移行
- [x] 3.4 SWR との統合パターンを確立

## Phase 4: Frontend API Standardization ✅

- [x] 4.1 API レスポンスエンベロープ型を定義（`types/api.ts`）
- [x] 4.2 既存 API ルートを統一形式にリファクタリング
- [x] 4.3 エラーレスポンス形式を標準化
- [x] 4.4 SWR fetcher をエンベロープ対応に更新

## Phase 5: Frontend Error Handling ✅

- [x] 5.1 `components/ErrorBoundary.tsx` を作成
- [x] 5.2 各レイアウトにエラーバウンダリを追加
- [x] 5.3 gRPC エラーコードのマッピングを作成
- [x] 5.4 ユーザーフレンドリーなエラーメッセージを実装

## Phase 6: Frontend Design Tokens & Styling ✅

- [x] 6.1 `config/theme.ts` を作成（カラー、スペーシング、タイポグラフィ）
- [x] 6.2 Tailwind v4 の `@theme` に design tokens を定義
- [x] 6.3 ハードコードされたテキストサイズ（text-[8px], text-[9px], text-[10px]）を統一
- [x] 6.4 ハードコードされたシャドウ（shadow-pink-200 等）を token 化
- [x] 6.5 Button コンポーネントを統一（ActionButton を Button に統合）
- [x] 6.6 カード・バッジのスタイルを統一（border-radius, padding）
- [x] 6.7 スペーシングスケールを定義・適用

## Phase 7: Backend Slice Decoupling ✅

- [x] 7.1 `lib/shared_services/cast_lookup_service.rb` を作成（DI コンテナ使用）
- [x] 7.2 Social handler から Portfolio 直接参照を削除
- [x] 7.3 共有サービス経由のアクセスに変更
- [x] 7.4 スライス境界テストを追加

## Phase 8: Backend Directory Standardization ✅

- [x] 8.1 Portfolio に `db/struct.rb` を追加
- [x] 8.2 Social に `db/struct.rb` を追加
- [x] 8.3 Contract 構造は既に統一済み（サブディレクトリパターン維持）
- [x] 8.4 ディレクトリ構造ガイドラインを ARCHITECTURE.md に文書化

## Phase 9: Backend Presenter Refactoring ✅

- [x] 9.1 profile_presenter.rb は適切なサイズ（129行）のため分割不要
- [x] 9.2 共通プレゼンターユーティリティを `lib/presenters/base.rb` に抽出
- [x] 9.3 プレゼンターのテストを追加（base_spec.rb）

## Phase 10: Backend TODO Resolution ✅

- [x] 10.1 SMS サービスインターフェースの抽象化（`lib/sms/service.rb`）
- [x] 10.2 Mock/Twilio/SNS アダプターのスタブ実装

## Phase 11: Validation & Documentation ✅

- [x] 11.1 テストファイルを追加・更新
- [x] 11.2 ARCHITECTURE.md にディレクトリ構造ガイドラインを追加
- [x] 11.3 tasks.md を更新
