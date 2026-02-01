# Change: nyx / monolith アーキテクチャリファクタリング

## Why

nyx（フロントエンド）と monolith（バックエンド）の構造的な課題を解消し、保守性・拡張性を向上させる。

**現状の問題:**
- **Frontend**: モジュール構造の不統一（shell, common, discovery がドメイン外）、トークン管理の分散（localStorage + pathname依存）、Zustand未使用
- **Frontend (Styling)**: デザイントークン未定義、カラー・スペーシングがハードコード
- **Backend**: スライス間の直接依存（Social→Portfolio）、ディレクトリ構造の不統一

## Current State

### Frontend モジュール構成の差分

| モジュール | components/ | hooks/ | lib/ | types.ts | 問題点 |
|-----------|:-----------:|:------:|:----:|:--------:|--------|
| identity | ✓ | ✓ | - | - | - |
| portfolio | ✓ (cast/guest) | ✓ (6+) | ✓ | ✓ | 最も充実（基準） |
| social | - | ✓ | ✓ | ✓ | **components なし** |
| discovery | ✓ (guest) | - | - | - | hooks なし、ドメイン外 |
| shell | ✓ (cast/guest) | - | - | - | ドメイン外 |
| concierge | ✓ (cast/guest) | - | - | - | hooks なし |
| ritual | ✓ (cast/guest) | ✓ | - | - | lib なし |
| trust | ✓ (cast/guest) | - | - | - | hooks なし |
| common | ✓ (guest) | - | - | - | 1ファイルのみ |

**主な問題:**
- social に components/ がない（TimelineFeed は discovery に配置されている）
- discovery, shell はドメインではなく components/ に移動すべき
- concierge, trust に hooks/ がなく状態管理が未整備

### Backend スライス構成の差分

| スライス | action.rb | operation.rb | view.rb | adapters/ | 問題点 |
|----------|:---------:|:------------:|:-------:|:---------:|--------|
| identity | ✓ | ✓ | ✓ | - | 基準 |
| portfolio | - | - | - | - | **基底クラスなし** |
| social | - | - | - | - | **基底クラスなし、直接依存あり** |

**共通して存在するディレクトリ:**
- `db/` (relation.rb, repo.rb, struct.rb)
- `grpc/handler.rb`
- `repositories/`
- `contracts/`
- `presenters/`
- `relations/`
- `use_cases/`

**主な問題:**
- identity のみ `action.rb`, `operation.rb`, `view.rb` がある（不統一）
- 全スライスに `adapters/` がない（スライス間通信の抽象化不足）
- social が `Portfolio::Slice["repositories.cast_repository"]` を直接参照

## What Changes

### Phase 1: Frontend モジュール構造の再編成
- `modules/shell/` → `components/layout/` へ移動
- `modules/common/` → `components/shared/` へ移動
- `modules/discovery/` を解体し、portfolio / social に再配置
- modules は 6ドメイン（identity, portfolio, social, concierge, ritual, trust）と 1:1 に統一

### Phase 2: トークン管理の一元化
- `lib/auth/` にトークン操作ロジックを集約
- `stores/authStore.ts` で状態管理（src直下に配置）
- pathname依存のRole推論を削除（トークンペイロードから取得）

### Phase 3: 状態管理の統一
- `stores/` ディレクトリを src直下に作成
- 認証状態・UI状態を Zustand に移行
- SWR はサーバーデータ取得に専念
- useSocial の localStorage 依存を Zustand Store に置換

### Phase 4: デザイントークンシステムの構築
- globals.css にブランドカラー・セマンティックカラー定義を追加
- `@theme inline` ブロックを拡張
- `config/theme.ts` に TypeScript 参照用定数を定義
- CVA ベースのコンポーネントをトークン参照に更新

### Phase 5: Backend スライス構造の統一
- Social→Portfolio の直接依存を Anti-Corruption Layer パターン（adapters/）で解消
- identity の基底クラス（action.rb, operation.rb, view.rb）を削除（app/ のみに統一）
- 共通認証ロジックを `lib/grpc/authenticatable.rb` に抽出
- contracts/, use_cases/ を機能別（{feature}/）に整理

## Impact

### Affected Specs
- `nyx-modules` (新規): フロントエンドモジュール構造
- `nyx-state-management` (新規): 状態管理パターン
- `nyx-design-tokens` (新規): デザイントークンシステム
- `monolith-slices` (新規): バックエンドスライス構造

### Affected Code

**Frontend:**
- `web/nyx/workspace/src/modules/` - 構造変更、types.ts を必須化
- `web/nyx/workspace/src/components/` - layout, shared 追加
- `web/nyx/workspace/src/stores/` - Zustand Store 新規作成（src直下）
- `web/nyx/workspace/src/lib/auth/` - トークン操作ロジック
- `web/nyx/workspace/src/config/theme.ts` - デザイントークン参照用
- `web/nyx/workspace/src/app/globals.css` - トークン定義追加

**Backend:**
- `services/monolith/workspace/slices/identity/` - 基底クラス（action.rb等）削除
- `services/monolith/workspace/slices/social/grpc/handler.rb` - 直接依存解消
- `services/monolith/workspace/slices/social/adapters/` - 新規作成
- `services/monolith/workspace/lib/grpc/` - 共通ロジック抽出

### Breaking Changes
- **BREAKING**: import パスの変更（modules/shell → components/layout）
- **BREAKING**: localStorage キー変更（トークンマイグレーション必要）
