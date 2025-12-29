# 変更: モノリスの Ruby (Hanami) への移行

## Why (なぜ行うのか)
モノリスバックエンドサービスの実装言語を Go から Ruby (Hanami フレームワーク) に移行することを決定しました。この変更は、Ruby の高い開発生産性と豊富なエコシステムを活用することを目的としています。特に Hanami 2.x は "Slices" という概念を通じてモジュラーモノリスアーキテクチャを強力にサポートしており、今回のプロジェクト構造に適しています。

## What Changes (何を変更するのか)
- `services/monolith` に新規 Hanami 2.x アプリケーションを初期化します。
- モジュラーモノリスのためのディレクトリ構造を確立します。

## Open Questions & Discussion Points (論点)

### 1. "Slices" によるモジュラーモノリス戦略
モジュール（Slice）の境界を以下の5つのドメインに基づき定義します。

#### A. Identity (認証・認可)
- **責務:** ゲートキーパー (ユーザー登録, Auth, ロール管理)。
- **特性:** セキュリティリスクの局所化。

#### B. Portfolio (カタログ・検索)
- **責務:** 参照系メイン (プロフィール, ステータス, 検索)。
- **特性:** 高負荷・読み込み重視。キャッシュ戦略重要。

#### C. Concierge (チャット・通信)
- **責務:** リアルタイム系 (チャット, 招待状生成, 通知)。
- **特性:** WebSocket, 長時間接続。スケーリング特性が異なる。

#### D. Ritual (予約・取引)
- **責務:** トランザクション系 (予約確定, 排他制御, 決済)。
- **特性:** データ整合性 (ACID) 最優先。ビジネスの核。

#### E. Trust (信用・評価)
- **責務:** 集計・分析系 (レビュー, レーダーチャート計算, CRM)。
- **特性:** 結果整合性で可。非同期処理。

### 2. ORM 戦略: ROM.rb vs ActiveRecord
Hanami はデフォルトで `ROM.rb` (Ruby Object Mapper) を採用しており、これは Rails の `ActiveRecord` とは異なり、永続化層とドメインロジックを分離します。
- **議論:** 一貫したアーキテクチャのために Hanami 標準 (`ROM`) を使用するか、慣れ親しんだ速度重視の `ActiveRecord` を導入するか？
- **推奨:** Hanami のアーキテクチャ上の利点と厳密な境界を維持するため、**ROM.rb** の使用を推奨します。

### 3. API プロトコル & フロントエンド統合
当初 Go バックエンドでは gRPC が計画されていました。Ruby への移行に伴い、"Web App" の性質により適した選択肢を検討できます。
- **案 A: GraphQL (`graphql-ruby`)** - 複雑な UI (ダッシュボード, チャット) に対する柔軟なデータ取得が可能。
- **案 B: REST (JSON API)** - シンプルで標準的な Hanami Actions を利用。
- **案 C: gRPC (`gruf`)** - 厳密なスキーマ定義と高パフォーマンス。将来的なマイクロサービス分割に有利。
- **推奨:** スマートドロワーやスケジュールグリッドのような複雑でインタラクティブな UI を構築するため、**GraphQL** を強く推奨します。

### 4. リアルタイム基盤 (チャット)
チャット機能（スマート招待状、DM）には WebSocket サポートが不可欠です。
- **議論:** Hanami には Rails の ActionCable のような機能が標準では組み込まれていません。
- **提案:** WebSocket 接続を効率的に処理するために、**AnyCable** または専用のリアルタイムサービスの利用を検討します。

## Implementation Roadmap (実装ロードマップ)

### Phase 1: Foundation (Current Step)
- Hanami プロジェクトの初期化。
- 開発環境と共通ライブラリの整備。
- モジュラーモノリス構造 (`slices/`) の基盤作成。

### Phase 2: Identity (The Gatekeeper)
- `slices/identity` の実装。
- ユーザー登録、認証 (JWT)、ロール管理。

### Phase 3: Portfolio (The Catalog)
- `slices/portfolio` の実装。
- キャストプロフィール、検索、ステータス管理。

### Phase 4: Ritual & Concierge (The Core)
- `slices/ritual` (予約・取引) の実装: 招待状〜予約確定フロー。
- `slices/concierge` (チャット) の実装: メッセージング、WebSocket 基盤。

### Phase 5: Trust (The Reputation)
- `slices/trust` の実装。
- レビュー、レーダーチャート計算、CRM。

## Verification Plan (検証計画)

### Automated Tests
- `bundle exec hanami version` を実行し、インストールを確認する。
- `bundle exec rake db:create db:migrate` を実行し、DB 接続を確認する。
- RSpec の初期セットアップ検証。
