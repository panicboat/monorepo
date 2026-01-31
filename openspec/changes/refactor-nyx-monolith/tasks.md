# Tasks: Nyx + Monolith Refactoring

## Phase 1: Frontend Module Standardization

- [ ] 1.1 全モジュールに `types.ts` を追加（common, concierge, discovery, ritual, trust, shell）
- [ ] 1.2 social モジュールに `components/` ディレクトリを追加
- [ ] 1.3 モジュール構造のテンプレートドキュメントを作成

## Phase 2: Frontend Token Management

- [ ] 2.1 `lib/auth/tokens.ts` を作成（トークン定数・ユーティリティ）
- [ ] 2.2 `lib/auth/context.tsx` に AuthProvider をリファクタリング
- [ ] 2.3 各フックからトークン直接アクセスを削除
- [ ] 2.4 Cast/Guest トークン判定ロジックを統一

## Phase 3: Frontend Zustand Implementation

- [ ] 3.1 `stores/user-store.ts` を作成
- [ ] 3.2 AuthProvider を Zustand ストアに移行
- [ ] 3.3 プロフィール状態を Zustand に移行
- [ ] 3.4 SWR との統合パターンを確立

## Phase 4: Frontend API Standardization

- [ ] 4.1 API レスポンスエンベロープ型を定義（`types/api.ts`）
- [ ] 4.2 既存 API ルートを統一形式にリファクタリング
- [ ] 4.3 エラーレスポンス形式を標準化
- [ ] 4.4 SWR fetcher をエンベロープ対応に更新

## Phase 5: Frontend Error Handling

- [ ] 5.1 `components/ErrorBoundary.tsx` を作成
- [ ] 5.2 各レイアウトにエラーバウンダリを追加
- [ ] 5.3 gRPC エラーコードのマッピングを作成
- [ ] 5.4 ユーザーフレンドリーなエラーメッセージを実装

## Phase 6: Backend Slice Decoupling

- [ ] 6.1 `lib/shared_services/cast_lookup_service.rb` を作成
- [ ] 6.2 Social handler から Portfolio 直接参照を削除
- [ ] 6.3 共有サービス経由のアクセスに変更
- [ ] 6.4 スライス境界テストを追加

## Phase 7: Backend Directory Standardization

- [ ] 7.1 Portfolio に `db/struct.rb` を追加
- [ ] 7.2 Social に `db/struct.rb` を追加
- [ ] 7.3 Portfolio のコントラクトを `contracts/` 直下に移動
- [ ] 7.4 ディレクトリ構造ガイドラインを文書化

## Phase 8: Backend Presenter Refactoring

- [ ] 8.1 `profile_presenter.rb` を機能別に分割
- [ ] 8.2 共通プレゼンターユーティリティを `lib/presenters/` に抽出
- [ ] 8.3 プレゼンターのテストを追加

## Phase 9: Backend TODO Resolution

- [ ] 9.1 OAuth コールバックエンドポイントの実装
- [ ] 9.2 SMS サービスインターフェースの抽象化
- [ ] 9.3 Twilio/SNS アダプターのスタブ実装

## Phase 10: Validation & Documentation

- [ ] 10.1 全テストが通ることを確認
- [ ] 10.2 リファクタリングガイドラインを文書化
- [ ] 10.3 domains/README.md の実装状況を更新
