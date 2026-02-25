# Comprehensive Refactoring Design

## Overview

monolith (Backend) と nyx (Frontend) の全コードを対象とした包括的リファクタリング。
パターン統一・命名整理・技術的負債解消を、**基盤優先アプローチ**で実施する。

## Design Principles

| 原則 | 内容 |
|------|------|
| モジュラーモノリス尊重 | スライス間の独立性を維持。共通化は純粋ユーティリティのみ |
| 最小限の共通化 | 「重複 = 悪」ではない。意図的な重複は許容する |
| モジュール内凝集 | mapper等はモジュール内に配置。共通libに集めない |
| パターン統一 | 既存の良いパターン（usePaginatedFetch等）を全体に展開 |

---

## Phase 1: Monolith 共通基盤の整備

### 1-1. `lib/errors/` — 共通エラー構造体

**問題**: 26の Use Case が全く同じ構造の `ValidationError` を独自定義している。
これはモジュール独立性ではなく、コピペの結果。

**対応**: 共通エラー構造体を `lib/errors/` に抽出。

```
lib/errors/
├── validation_error.rb
├── not_found_error.rb
└── access_denied_error.rb
```

**対象ファイル**:
- `slices/identity/use_cases/auth/login.rb` (lines 10-17)
- `slices/identity/use_cases/auth/register.rb` (lines 11-18)
- `slices/post/use_cases/posts/save_post.rb` (lines 7-14)
- `slices/post/use_cases/comments/add_comment.rb` (lines 61-68)
- その他 22+ Use Case

### 1-2. `Concerns::CursorPagination` の徹底適用

**問題**: `lib/concerns/cursor_pagination.rb` が存在するが、半数のファイルが未使用で手動実装している。

**対応**: 全 Use Case / Handler で concern を使用するよう統一。

**対象ファイル**:
- `slices/post/grpc/handler.rb` (lines 159-170) — 手動 decode_cursor/encode_cursor を削除
- `slices/relationship/grpc/handler.rb` (lines 109-120) — 同上
- `slices/feed/use_cases/list_guest_feed.rb` (lines 109-120) — concern を include
- `slices/feed/use_cases/list_cast_feed.rb` (lines 46-57) — concern を include
- `slices/post/use_cases/posts/list_public_posts.rb` (lines 70-81) — concern を使用
- その他 10+ ファイル

### 1-3. 各スライス内のフォールバック値整理

**問題**: FALLBACK コメント付きの値が散在し、一部に不適切なデフォルト値がある。

**対応**: 各スライス内で適切なデフォルトを明示化。一元化はしない。

**対象例**:
- JWT シークレットのハードコードデフォルト (`"pan1cb0at"`) — Identity スライス内で整理
- ページネーション limit のバラツキ（20, 50, 100）— 各ハンドラーで意図を明確化
- メディア URL フォールバック (`""`) — 各プレゼンター内で整理

---

## Phase 2: Nyx 共通基盤の整備

### 2-1. gRPC エラーコード定数 + HTTP マッピング

**問題**: ConnectError コード（3, 5, 16）がマジックナンバーとして 30+ ルートに散在。
コード→HTTPステータスのマッピングもルートごとにバラバラ。

**対応**: 定数ファイルとエラーハンドリングユーティリティを作成。

```typescript
// lib/grpc-errors.ts
export const GRPC_ERROR_CODES = {
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
} as const;
```

```typescript
// lib/api-helpers.ts
export function handleGrpcError(error: unknown): NextResponse { ... }
export function requireAuth(req: NextRequest): string | NextResponse { ... }
export function extractPaginationParams(url: URL): { limit: number; cursor: string } { ... }
```

### 2-2. 不足しているドメイン mapper の追加

**問題**: Post/Portfolio にはmapperがあるが、Relationship/Trust にはない。
変換ロジックが API ルートにインライン記述されている。

**対応**: 各モジュール内に `lib/mappers.ts` を追加。

```
modules/relationship/lib/mappers.ts  — Follow/Block/Favorite 変換
modules/trust/lib/mappers.ts         — Review 変換
```

### 2-3. API ルートのデータマッピング重複解消

**問題**: Post/Author/Media の変換が `api/guest/timeline`, `api/cast/timeline`, `api/feed/guest` で丸ごと複製。

**対応**: 既存の `post/lib/mappers.ts` を API ルートからも参照するよう変更。

---

## Phase 3: Nyx フック・状態管理の整理

### 3-1. デッドコード削除

**削除対象** (247行):
- `modules/feed/hooks/useGuestFeed.ts` — useTimeline に置き換え済み、未使用
- `modules/feed/hooks/useCastFeed.ts` — useTimeline に置き換え済み、未使用
- `modules/feed/hooks/index.ts` から対応 export を削除

### 3-2. レガシーフックの `usePaginatedFetch` 移行

| フック | 行数 | 対応 |
|-------|------|------|
| `useCastPosts` | 204行 | `usePaginatedFetch` + `authFetch` に移行。CRUD操作は維持 |
| `useReviews` | 164行 | `useInfiniteReviews` との統合・置き換えを検討 |

### 3-3. 型安全性の強化

`any[]` を適切な型に置き換え。

**対象ファイル**:
- `portfolio/hooks/useCastData.ts` — `CastDataApiResponse` の `any` を型定義
- `portfolio/hooks/useCastProfile.ts` — `ProfileApiResponse` の `any` を型定義
- `portfolio/lib/cast/mappers.ts` — 引数の `any[]` を型定義

### 3-4. fetch パターンの統一

手動 `Authorization: Bearer ${token}` を `authFetch` に統一。

**対象**: `useCastPosts` 等の手動 fetch 実装

---

## Phase 4: 適用

### Monolith 適用
- 全 Use Case で `Concerns::CursorPagination` を使用
- 共通エラークラスへの移行（26 Use Case）
- 各スライスのフォールバック値整理

### Nyx API ルート適用
- 30+ ルートに新ユーティリティ（認証チェック、エラーハンドリング）を適用
- 既存 mapper を API ルートから参照
- 新規 mapper（Relationship, Trust）を作成・適用

### Nyx フック適用
- デッドコード削除
- レガシーフック移行
- 型修正

---

## What We Are NOT Doing

モジュラーモノリスの原則に基づき、以下は**意図的に対応しない**:

| 項目 | 理由 |
|------|------|
| Post/Feed アダプターの共通化 | スライス間結合を避ける。重複は許容 |
| ハンドラーの profile_finder mixin | 各ハンドラーのドメイン文脈が異なる |
| ハンドラーの blocked_users_helper | スライスごとにロジックが分岐しうる |
| ハンドラーの media_loader mixin | Post/Feed でメディアの扱いが変わりうる |
| フォールバック値の一元化 config | スライス間の暗黙的依存を避ける |

## Summary

| レイヤー | 方針 |
|---------|------|
| Monolith | スライス独立性を尊重。共通化は純粋ユーティリティ（エラー構造体・ページネーションconcern）のみ |
| Nyx API Routes | ボイラープレート削減。mapper はモジュール内に配置 |
| Nyx Hooks | `usePaginatedFetch` + `authFetch` パターンに統一。デッドコード除去 |
