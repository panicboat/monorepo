# Tasks: Pivot to Cast-Centric SNS

## 1. Frontend - Guest UI Simplification

### 1.1 ホーム画面の修正
- [x] 1.1.1 `(guest)/page.tsx` からキャストリストタブを削除
- [x] 1.1.2 タイムラインのみ表示するシンプルなUIに変更
- [x] 1.1.3 Tonight Pick バッジ関連コードの削除

### 1.2 Concierge 機能の削除
- [x] 1.2.1 `(guest)/concierge/` ディレクトリの削除
- [x] 1.2.2 `modules/concierge/` ディレクトリの削除
- [x] 1.2.3 `GuestBottomNavBar` からConciergeリンクを削除

### 1.3 キャストリスト関連の削除
- [x] 1.3.1 `CastList.tsx` コンポーネントの削除
- [x] 1.3.2 関連するhooks/typesの削除（未使用になるもの）

### 1.4 API Routes の整理
- [x] 1.4.1 `api/concierge/` ディレクトリの削除
- [x] 1.4.2 不要になったAPI routesの確認と削除

## 2. Backend - Domain Cleanup

### 2.1 Concierge スライスの削除
- [x] 2.1.1 `slices/concierge/` ディレクトリの削除
- [x] 2.1.2 関連するマイグレーションの確認

### 2.2 Ritual スライスの削除
- [x] 2.2.1 `slices/ritual/` ディレクトリの削除
- [x] 2.2.2 関連するマイグレーションの確認

### 2.3 Trust スライスの削除
- [x] 2.3.1 `slices/trust/` ディレクトリの削除
- [x] 2.3.2 関連するマイグレーションの確認

### 2.4 アプリケーション設定の更新
- [x] 2.4.1 `config/slices.rb` またはスライス登録からの削除（Hanamiの自動検出を使用）
- [x] 2.4.2 ルーティング設定の確認と修正

## 3. Protocol Buffers

### 3.1 Proto ディレクトリの整理
- [x] 3.1.1 `proto/concierge/` の削除
- [x] 3.1.2 `proto/ritual/` の削除
- [x] 3.1.3 `proto/trust/` の削除

## 4. Documentation & Configuration

### 4.1 ドキュメント更新
- [x] 4.1.1 `CLAUDE.md` のドメイン一覧を更新
- [x] 4.1.2 `handbooks/docs/domains/` の整理

### 4.2 その他の設定
- [x] 4.2.1 シードデータの確認と整理（変更なし）
- [x] 4.2.2 テストの確認と整理（変更なし）

## 5. Verification

### 5.1 動作確認
- [x] 5.1.1 フロントエンドのビルド確認
- [ ] 5.1.2 バックエンドの起動確認（手動確認推奨）
- [ ] 5.1.3 E2Eテストの実行（該当する場合）
