# Tasks: Add Cast Guest Detail

## Phase 1: Backend API

- [x] **1.1** Proto 定義の追加
  - `GetGuestProfileById` RPC を `guest_service.proto` に追加
  - `GetGuestProfileByIdRequest` / `GetGuestProfileByIdResponse` メッセージを定義
  - レスポンスにフォロー日を含める

- [x] **1.2** Backend 実装
  - `GetGuestProfileById` アクションを Portfolio スライスに追加
  - キャストロールの認可チェックを実装
  - フォロー情報を Social ドメインから取得して結合

- [x] **1.3** Backend テスト
  - `GetGuestProfileById` のユニットテストを追加
  - 認可エラーケースのテストを追加

## Phase 2: Frontend API Route

- [x] **2.1** API Route 作成
  - `GET /api/cast/guests/[id]` を作成
  - gRPC クライアントで `GetGuestProfileById` を呼び出し

## Phase 3: Frontend UI

- [x] **3.1** ゲスト詳細ページ作成
  - `/cast/guests/[id]/page.tsx` を作成
  - ゲスト詳細コンポーネントを作成

- [x] **3.2** フォロワー一覧からの導線
  - フォロワー一覧のゲストアイテムをタップ可能に変更
  - `/cast/guests/[id]` へのリンクを追加

- [x] **3.3** いいね/コメントからの導線
  - コメント一覧のゲストアバター/名前をタップ可能に変更
  - `/cast/guests/[id]` へのリンクを追加
  - Note: いいね一覧は現在未実装のためスキップ

- [x] **3.4** ブロック機能の統合
  - ゲスト詳細ページにブロック/ブロック解除ボタンを配置
  - 既存のブロック API を利用

## Verification

- [ ] フォロワー一覧 → ゲスト詳細 → ブロックのフローを確認
- [ ] コメント一覧 → ゲスト詳細のフローを確認
- [ ] 未認証/ゲストロールでのアクセス拒否を確認
