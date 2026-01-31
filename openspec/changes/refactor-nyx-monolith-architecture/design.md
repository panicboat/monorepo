# Design: nyx / monolith アーキテクチャリファクタリング

## Context

Nyx.PLACE は Modular Monolith アーキテクチャを採用しており、6つのドメイン（Identity, Portfolio, Social, Concierge, Ritual, Trust）に分離されている。しかし、フロントエンド（nyx）とバックエンド（monolith）の両方で構造的な不整合が発生している。

### 現状の構成差分

#### Frontend (modules/)

| モジュール | components/ | hooks/ | lib/ | types.ts | 備考 |
|-----------|:-----------:|:------:|:----:|:--------:|------|
| identity | ✓ | ✓ | - | - | シンプル |
| portfolio | ✓ (cast/guest) | ✓ (6+) | ✓ | ✓ | 最も充実（基準） |
| social | - | ✓ | ✓ | ✓ | **components なし** |
| discovery | ✓ (guest) | - | - | - | ドメイン外 |
| shell | ✓ (cast/guest) | - | - | - | ドメイン外 |
| concierge | ✓ (cast/guest) | - | - | - | hooks なし |
| ritual | ✓ (cast/guest) | ✓ | - | - | lib なし |
| trust | ✓ (cast/guest) | - | - | - | hooks なし |
| common | ✓ (guest) | - | - | - | 1ファイルのみ |

**特定された問題:**
- `social` に components/ がない（TimelineFeed は discovery に配置）
- `discovery`, `shell`, `common` はドメインではなく `components/` に移動すべき
- `concierge`, `trust` に hooks/ がなく状態管理が未整備

#### Backend (slices/)

| スライス | action.rb | operation.rb | view.rb | adapters/ |
|----------|:---------:|:------------:|:-------:|:---------:|
| identity | ✓ | ✓ | ✓ | - |
| portfolio | - | - | - | - |
| social | - | - | - | - |

**共通ディレクトリ（全スライスに存在）:**
- `db/` (relation.rb, repo.rb, struct.rb)
- `grpc/handler.rb`
- `repositories/`, `contracts/`, `presenters/`, `relations/`, `use_cases/`

**特定された問題:**
- `identity` のみ基底クラス（action.rb, operation.rb, view.rb）がある
- 全スライスに `adapters/` がない（スライス間通信の抽象化不足）
- `social/grpc/handler.rb:103` で `Portfolio::Slice["repositories.cast_repository"]` を直接参照

**制約:**
- 既存の認証フローを維持しながら移行する必要がある
- 段階的なリファクタリングが可能であること
- Tailwind CSS v4 の `@theme inline` 機能を活用

## Goals / Non-Goals

### Goals
- modules/ をドメインと 1:1 に統一
- 状態管理パターンを Zustand + SWR に統一
- デザイントークンによるスタイリングの一元管理
- スライス間の直接依存を解消

### Non-Goals
- ダークモード対応（将来のタスク）
- マイクロサービス化（構造の準備のみ）
- 認証方式の変更（localStorage → httpOnly Cookie は別提案）

## Decisions

### D1: Frontend ディレクトリ構造

**Decision:** shell, common, discovery を解体し、ドメイン外コンポーネントを components/ に移動

```
src/
├── modules/           # ドメイン固有（6ドメインのみ）
│   ├── identity/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types.ts   # MUST
│   ├── portfolio/
│   ├── social/
│   ├── concierge/
│   ├── ritual/
│   └── trust/
├── components/
│   ├── ui/           # プリミティブ（既存）
│   ├── layout/       # shell → ここに移動
│   ├── shared/       # クロスドメイン共有コンポーネント
│   └── providers/    # グローバル Provider
├── stores/            # Zustand Stores（src直下）
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── socialStore.ts
├── lib/
│   ├── auth/         # トークン操作ロジック
│   │   ├── tokens.ts
│   │   ├── migration.ts
│   │   └── index.ts
│   └── ...
├── config/
│   └── theme.ts      # デザイントークン参照用
└── app/
```

**Module 内部構造（標準）:**
```
modules/{domain}/
├── components/
│   ├── cast/       # Cast向けコンポーネント
│   └── guest/      # Guest向けコンポーネント
├── hooks/          # データフェッチ、状態管理
├── lib/            # マッパー、ユーティリティ
└── types.ts        # ドメイン型定義 (MUST)
```

**Alternatives considered:**
1. shell をドメインとして維持 → 却下（UIレイアウトはドメインではない）
2. discovery を独立ドメインとして維持 → 却下（Portfolio/Social の機能を横断しており曖昧）

### D2: 状態管理パターン

**Decision:** Zustand for global state, SWR for server state

| 状態タイプ | ツール | 理由 |
|-----------|--------|------|
| 認証・トークン | Zustand (persist) | グローバル + 永続化 |
| UI状態（モーダル、サイドバー） | Zustand | グローバル、非永続 |
| Social状態（following等） | Zustand (persist) | ローカル永続化 |
| サーバーデータ | SWR | キャッシュ、再検証、deduplication |

**Store 配置:** `stores/` (src直下)
- stores は状態管理の中核であり、独立したディレクトリとして扱う
- `lib/` はユーティリティ関数向け

**トークン管理の分離:**
```
lib/auth/
├── tokens.ts       # トークン操作（get/set/clear）
├── migration.ts    # 旧トークンのマイグレーション
└── index.ts

stores/authStore.ts # 状態のみ（lib/auth を呼び出す）
```
- 責務を明確に分離
- トークン操作ロジックのテストが容易

### D3: デザイントークン

**Decision:** CSS カスタムプロパティ（globals.css）+ TypeScript 参照用（config/theme.ts）

**globals.css:**
```css
:root {
  /* Brand Colors */
  --color-brand-primary: #ec4899;      /* pink-500 */
  --color-brand-primary-hover: #db2777; /* pink-600 */
  --color-brand-secondary: #60a5fa;    /* blue-400 */
  --color-brand-secondary-hover: #3b82f6; /* blue-500 */

  /* Semantic Colors */
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;

  /* Status Colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: var(--color-brand-secondary);

  /* Role Colors */
  --color-role-guest: var(--color-brand-primary);
  --color-role-cast: var(--color-brand-secondary);
}

@theme inline {
  --color-brand: var(--color-brand-primary);
  --color-brand-hover: var(--color-brand-primary-hover);
  --color-brand-cast: var(--color-brand-secondary);
  --color-brand-cast-hover: var(--color-brand-secondary-hover);
  --color-surface: var(--color-surface);
  --color-border: var(--color-border);
}
```

**config/theme.ts:**
```typescript
// TypeScript から CSS 変数を参照するための定数
export const colors = {
  brand: 'var(--color-brand-primary)',
  brandHover: 'var(--color-brand-primary-hover)',
  brandCast: 'var(--color-brand-secondary)',
  brandCastHover: 'var(--color-brand-secondary-hover)',
  surface: 'var(--color-surface)',
  border: 'var(--color-border)',
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
} as const;
```

**Rationale:**
- globals.css が実際のスタイリング定義（Tailwind `@theme inline` と連携）
- config/theme.ts は TypeScript からの参照用（型安全、IDE補完）

### D4: Backend スライス構造

**Decision:** Anti-Corruption Layer パターン（adapters/）+ 機能別整理

**標準スライス構造:**
```
slices/{domain}/
├── adapters/           # 他スライスへのアダプター
│   └── *_adapter.rb
├── contracts/
│   └── {feature}/      # 機能別に整理
│       └── *_contract.rb
├── db/
│   ├── relation.rb
│   ├── repo.rb
│   └── struct.rb       # MUST
├── grpc/
│   └── handler.rb
├── presenters/
│   └── *_presenter.rb
├── relations/
│   └── *.rb
├── repositories/
│   └── *_repository.rb
└── use_cases/
    └── {feature}/      # 機能別に整理
        └── *.rb
```

**基底クラス:**
- `action.rb`, `operation.rb`, `view.rb` は **app/ のみ**（スライス固有は不要）
- 現状は gRPC API のみで、Web Action/View は使用していない
- **identity の基底クラスは削除**

**adapters/ の例:**
```ruby
# slices/social/adapters/cast_adapter.rb
module Social
  module Adapters
    class CastAdapter
      include Social::Deps["cast_client"]

      CastInfo = Data.define(:id, :name, :image_path, :handle)

      def find_by_user_id(user_id)
        response = cast_client.get_cast_profile(user_id: user_id)
        return nil unless response
        CastInfo.new(
          id: response.profile.id,
          name: response.profile.name,
          image_path: response.profile.image_path,
          handle: response.profile.handle
        )
      end
    end
  end
end
```

**Rationale:**
- Social が必要とする Cast 情報のみを抽象化
- 将来のマイクロサービス化時にアダプター実装のみ変更
- Portfolio の内部実装からの独立性を確保

**Alternatives considered:**
1. 共有 lib/ にリポジトリを移動 → 却下（ドメイン境界が曖昧になる）
2. イベント駆動 → 過剰（現時点では同期呼び出しで十分）

## Risks / Trade-offs

| リスク | 影響度 | 緩和策 |
|--------|:------:|--------|
| import パス変更による破損 | High | TypeScript path alias 設定、全テスト実行 |
| トークンマイグレーション失敗 | Critical | 旧キー読み取り → 新キー書き込みのマイグレーション処理 |
| Zustand 学習コスト | Low | シンプルな API、既存 Context パターンとの類似性 |
| デザイントークン移行漏れ | Medium | ESLint ルールでハードコードカラーを警告 |

## Migration Plan

### Phase 順序
```
Phase 2 (トークン管理) → Phase 1 (モジュール) → Phase 3 (状態管理) → Phase 4 (トークン) → Phase 5 (Backend)
```

**理由:** トークン管理を先に整備することで、他の Phase での認証エラーを回避

### トークンマイグレーション
```typescript
// lib/auth/migration.ts
export const migrateTokens = () => {
  const oldKeys = ['nyx_cast_access_token', 'nyx_guest_access_token'];
  // 旧キーから読み取り、新 Store に移行
};
```

### Rollback
- 各 Phase は独立してデプロイ可能
- Feature flag による段階的ロールアウトを推奨

## Open Questions

1. **httpOnly Cookie への移行は本提案に含めるか？**
   - 現時点では localStorage + Zustand で進め、セキュリティ強化は別提案とする

2. **Social の following/favorites はサーバー同期すべきか？**
   - 現時点ではローカル永続化で維持。API 実装後に別途同期を検討
