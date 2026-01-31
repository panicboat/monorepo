# Change: Nyx + Monolith Refactoring

## Why

フロントエンド（nyx）とバックエンド（monolith）が急速に成長し、いくつかの技術的負債が蓄積している。現時点でリファクタリングを行うことで、今後のドメイン実装（Concierge, Ritual, Trust）をスムーズに進められる。

主な課題：
- **Frontend**: モジュール構造の不統一、トークン管理の分散、Zustand 未使用
- **Backend**: スライス間の直接依存、ディレクトリ構造の不統一

## What Changes

### Frontend (nyx)

1. **モジュール構造の標準化**
   - 全モジュールに `types.ts`, `hooks/`, `lib/` を追加
   - social モジュールに `components/` を追加

2. **トークン管理の一元化**
   - `lib/auth/` に認証ロジックを集約
   - Magic string（トークンキー名）を定数化

3. **Zustand ストアの導入**
   - ユーザー状態管理を SWR + Context から Zustand に移行
   - クロスモジュールの状態共有を改善

4. **API レスポンス形式の統一**
   - BFF エンドポイントのレスポンス形式を統一
   - エラーハンドリングパターンの標準化

5. **エラー境界の追加**
   - 主要セクションにエラーバウンダリを追加
   - gRPC エラーのハンドリング改善

### Backend (monolith)

1. **スライス間依存の解消** **BREAKING**
   - Social → Portfolio の直接依存を排除
   - 共有サービスまたはドメインイベント経由に変更

2. **ディレクトリ構造の標準化**
   - 全スライスに `db/struct.rb` を配置
   - コントラクトとプレゼンターの命名規則統一

3. **大規模プレゼンターの分割**
   - `profile_presenter.rb` (180行) を機能別に分割

4. **TODO 解消**
   - OAuth コールバックエンドポイントの実装
   - SMS 送信サービスの抽象化

## Impact

- Affected specs: identity, portfolio, social
- Affected code:
  - Frontend: `web/nyx/workspace/src/modules/`, `web/nyx/workspace/src/lib/`, `web/nyx/workspace/src/app/api/`
  - Backend: `services/monolith/workspace/slices/`, `services/monolith/workspace/lib/`
