# Design: Nyx + Monolith Refactoring

## Context

Nyx.PLACE は Modular Monolith アーキテクチャを採用しており、現在 Identity, Portfolio, Social の3ドメインが実装済み。今後 Concierge, Ritual, Trust を追加する前に、既存コードの技術的負債を解消する必要がある。

### Current State

**Frontend Issues:**
- モジュール構造が不統一（social に components/ がない、複数モジュールに types.ts がない）
- トークン管理が分散（各フックで localStorage を直接参照）
- Zustand v5 がインストール済みだが未使用（現在は SWR + Context）
- API レスポンス形式が不統一

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

**Decision:** SWR と Zustand を併用

```
Zustand: クライアントサイドの状態（認証状態、UI状態、フォーム状態）
SWR: サーバーサイドのデータ（プロフィール、投稿、リスト）
```

**Rationale:**
- SWR の強力なキャッシュ機能を維持
- Zustand で認証コンテキストを置き換え、より予測可能な状態管理を実現
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

## Open Questions

1. Zustand の persist middleware を使用するか？（ローカルストレージへの永続化）
2. 共有サービスに DI コンテナを使用するか、シンプルなクラスとして実装するか？
3. OAuth 実装のプロバイダー優先順位（Google, Apple, LINE？）
