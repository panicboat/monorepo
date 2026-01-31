# Design: Nyx + Monolith Refactoring

## Context

Nyx.PLACE は Modular Monolith アーキテクチャを採用しており、現在 Identity, Portfolio, Social の3ドメインが実装済み。今後 Concierge, Ritual, Trust を追加する前に、既存コードの技術的負債を解消する必要がある。

### Current State

**Frontend Issues:**
- モジュール構造が不統一（social に components/ がない、複数モジュールに types.ts がない）
- トークン管理が分散（各フックで localStorage を直接参照）
- Zustand v5 がインストール済みだが未使用（現在は SWR + Context）
- API レスポンス形式が不統一

**Frontend Styling Issues:**
- デザイントークンが未定義（カラー、スペーシング、タイポグラフィがハードコード）
- テキストサイズのハードコード（`text-[8px]`, `text-[9px]`, `text-[10px]` が散在）
- ボタン実装が3パターン存在（Button.tsx, ActionButton.tsx, インラインスタイル）
- シャドウのハードコード（`shadow-pink-200` 等が直接記述）
- border-radius の不統一（カードに `rounded-xl`, `rounded-2xl`, `rounded-lg` が混在）
- スペーシングスケールの不統一

**Backend Issues:**
- Social handler が Portfolio の repository を直接参照（スライス境界違反）
- ディレクトリ構造が不統一（struct.rb の配置、コントラクトのネスト）
- 一部プレゼンターが肥大化（180行超）

## Goals / Non-Goals

### Goals
- 全モジュール/スライスで一貫したディレクトリ構造を確立
- スライス間の直接依存を排除し、将来のマイクロサービス化を容易に
- 認証・状態管理のパターンを標準化
- 新ドメイン追加時のテンプレートを明確化

### Non-Goals
- 新機能の追加（リファクタリングのみ）
- パフォーマンス最適化
- UI/UX の変更
- データベーススキーマの変更

## Decisions

### 1. Frontend Module Structure

**Decision:** 全モジュールに以下の構造を適用する

```
modules/{domain}/
├── components/
│   ├── cast/       # Cast向けコンポーネント
│   └── guest/      # Guest向けコンポーネント
├── hooks/          # データフェッチ、状態管理
├── lib/            # マッパー、ユーティリティ
└── types.ts        # ドメイン型定義
```

**Rationale:**
- 一貫性により新規開発者のオンボーディングが容易
- ファイル配置の迷いを排除
- 将来のドメイン追加時のテンプレートとして機能

### 2. Token Management Centralization

**Decision:** `lib/auth/` に認証ロジックを集約

```typescript
// lib/auth/tokens.ts
export const TOKEN_KEYS = {
  CAST_ACCESS: 'nyx_cast_access_token',
  GUEST_ACCESS: 'nyx_guest_access_token',
} as const

export function getToken(role: 'cast' | 'guest'): string | null
export function setToken(role: 'cast' | 'guest', token: string): void
export function clearToken(role: 'cast' | 'guest'): void
```

**Rationale:**
- Magic string の排除
- 将来のトークン戦略変更（httpOnly cookie 等）に対応しやすい
- テストしやすい

### 3. Zustand Integration Strategy

**Decision:** SWR と Zustand を併用、persist middleware を使用

```
Zustand + persist: クライアントサイドの状態（認証状態、UI状態）
SWR: サーバーサイドのデータ（プロフィール、投稿、リスト）
```

```typescript
// stores/auth.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  role: 'cast' | 'guest' | null
  setAuth: (role: 'cast' | 'guest') => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      role: null,
      setAuth: (role) => set({ isAuthenticated: true, role }),
      clearAuth: () => set({ isAuthenticated: false, role: null }),
    }),
    {
      name: 'nyx-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
)
```

**Rationale:**
- SWR の強力なキャッシュ機能を維持
- Zustand で認証コンテキストを置き換え、より予測可能な状態管理を実現
- persist middleware でページリロード後も状態維持
- 段階的な移行が可能

### 4. Backend Slice Decoupling

**Decision:** 共有サービス層を `lib/shared_services/` に導入

```ruby
# lib/shared_services/cast_lookup_service.rb
module SharedServices
  class CastLookupService
    def find_cast_by_user_id(user_id)
      # Portfolio の repo を直接参照するのではなく、
      # このサービスを介してアクセス
    end
  end
end
```

**Alternatives Considered:**
1. **ドメインイベント**: 過度な複雑さ（現時点では不要）
2. **gRPC 内部呼び出し**: ネットワークオーバーヘッド（モノリス内では不要）
3. **共有サービス**: シンプルで効果的（採用）

**Rationale:**
- スライス間の直接依存を排除
- 依存方向を明確化（Social → SharedServices ← Portfolio）
- 将来のマイクロサービス化時に API 化が容易

### 5. Presenter Refactoring

**Decision:** 機能別に分割し、Composition で組み合わせ

```ruby
# presenters/profile/base_presenter.rb
# presenters/profile/plans_presenter.rb
# presenters/profile/schedules_presenter.rb
# presenters/profile_presenter.rb (Composition)
```

**Rationale:**
- 単一責任の原則
- テストしやすい
- 再利用可能

### 6. Design Tokens & Styling Strategy

**Decision:** Tailwind v4 の `@theme` と `config/theme.ts` でデザイントークンを集約

```css
/* globals.css */
@theme inline {
  /* Colors */
  --color-brand-primary: theme('colors.pink.500');
  --color-brand-primary-hover: theme('colors.pink.600');
  --color-text-primary: theme('colors.slate.900');
  --color-text-secondary: theme('colors.slate.500');
  --color-text-tertiary: theme('colors.slate.400');
  --color-bg-primary: theme('colors.white');
  --color-bg-secondary: theme('colors.slate.50');

  /* Typography - Small variants */
  --font-size-2xs: 0.625rem;  /* 10px - replacing text-[10px] */
  --font-size-3xs: 0.5rem;    /* 8px - replacing text-[8px] */

  /* Border Radius */
  --radius-card: 1rem;        /* 16px - unified card radius */
  --radius-button: 0.75rem;   /* 12px */
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-brand: 0 4px 6px -1px theme('colors.pink.200');
}
```

```typescript
// config/theme.ts
export const theme = {
  colors: {
    brand: {
      primary: 'var(--color-brand-primary)',
      primaryHover: 'var(--color-brand-primary-hover)',
    },
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary: 'var(--color-text-tertiary)',
    },
  },
  radius: {
    card: 'var(--radius-card)',
    button: 'var(--radius-button)',
    pill: 'var(--radius-pill)',
  },
} as const
```

**Rationale:**
- Tailwind v4 の CSS-first approach と整合
- 一箇所の変更で全体に反映
- TypeScript で型安全なアクセス

### 7. Button Component Unification

**Decision:** `ActionButton` を廃止し、`Button` に統合

```typescript
// Before: ActionButton.tsx (廃止)
// After: Button.tsx に status variant を追加
const buttonVariants = cva(..., {
  variants: {
    variant: {
      brand: "bg-brand-primary text-white hover:bg-brand-primary-hover shadow-brand",
      // ...existing variants
    },
    status: {
      idle: "",
      loading: "cursor-not-allowed opacity-70",
      success: "bg-green-500",
    },
  },
})
```

**Rationale:**
- 重複コードの排除
- CVA による一貫した variant 管理
- テスト・メンテナンス性の向上

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| リファクタリング中の機能リグレッション | 各フェーズでテストを実行、段階的にマージ |
| Zustand 移行による学習コスト | 段階的移行、既存 SWR パターンを維持 |
| 共有サービス層による間接性増加 | 明確なインターフェース定義、ドキュメント整備 |

## Migration Plan

1. **Phase 1-5 (Frontend)**: 各フェーズ完了後にテスト実行、PR マージ
2. **Phase 6-9 (Backend)**: 各フェーズ完了後にテスト実行、PR マージ
3. **Phase 10 (Validation)**: 全体テスト、ドキュメント更新

### Rollback Strategy

- 各フェーズは独立してロールバック可能
- 特に Phase 6（Backend Slice Decoupling）は慎重に実施
- 問題発生時は該当フェーズの変更を revert

## Resolved Questions

### 1. Zustand の persist middleware を使用するか？

**Answer: Yes（使用する）**

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      role: null,
      setAuth: (role) => set({ isAuthenticated: true, role }),
      clearAuth: () => set({ isAuthenticated: false, role: null }),
    }),
    {
      name: 'nyx-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
)
```

**注意点:**
- トークン自体は persist しない（セキュリティ）
- `partialize` で永続化する項目を明示的に指定
- SSR hydration 対策として `skipHydration` オプションを検討

### 2. 共有サービスに DI コンテナを使用するか？

**Answer: Yes（DI コンテナを使用する）**

```ruby
# lib/shared_services/cast_lookup_service.rb
module SharedServices
  class CastLookupService
    include Monolith::Deps[
      cast_repo: "slices.portfolio.repositories.cast_repository"
    ]

    def find_by_user_id(user_id)
      cast_repo.find_by_user_id(user_id)
    end
  end
end

# config/providers/shared_services.rb
Monolith::App.register_provider :shared_services do
  start do
    register "shared_services.cast_lookup", SharedServices::CastLookupService.new
  end
end
```

**Rationale:**
- 既存の Hanami Deps パターンと一貫性
- テストでモック差し替えが容易
- 依存関係が明示的

### 3. OAuth 実装のプロバイダー優先順位

**Answer: スコープ外（今回のリファクタリングでは実装しない）**
