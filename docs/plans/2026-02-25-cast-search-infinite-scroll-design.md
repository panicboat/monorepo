# Cast Search Infinite Scroll Design

## Overview

キャスト検索ページに無限スクロール機能を追加する。同時に、無限スクロールの共通部品（UIコンポーネント）を作成し、既存の無限スクロール実装をリファクタリングする。

## Requirements

| 項目 | 値 |
|------|-----|
| 初期表示件数 | 20件 (MUST) |
| 追加読み込み | 20件/回 (MUST) |
| トリガー位置 | リスト末尾の100px手前 (MUST) |
| ローディング | スピナー (MUST) |
| ページング方式 | カーソルベース（既存パターン準拠） (MUST) |
| 部品化 | UIコンポーネント (MUST) |

## Current State Analysis

### 既存の無限スクロール実装箇所

| 箇所 | フック | UIコンポーネント |
|------|--------|------------------|
| レビュー一覧 | `useInfiniteReviews` | `ReviewListPage.tsx` |
| ゲストタイムライン | `useGuestTimeline` | `TimelineFeed.tsx` |
| キャスト投稿一覧 | `useGuestTimeline` | `CastTimeline.tsx` |
| コメント | `useComments` | `CommentSection.tsx` |
| **キャスト検索** | **なし（今回追加）** | **なし（今回追加）** |

### 既存の汎用フック

- `lib/hooks/usePaginatedFetch.ts` - 汎用ページネーションフック（ほとんど未使用）

### 課題

1. UIコンポーネント（IntersectionObserver）が各コンポーネントで重複実装
2. 汎用フック `usePaginatedFetch` があるが活用されていない
3. 無限スクロールのUIパターンが統一されていない

## Architecture

```
【変更箇所】

Frontend:
  ├── components/ui/
  │   └── InfiniteScroll.tsx           (新規: 汎用UIコンポーネント)
  ├── modules/portfolio/hooks/
  │   └── useInfiniteCasts.ts          (新規: キャスト検索用)
  ├── app/(guest)/search/
  │   └── page.tsx                     (改修: 無限スクロール対応)
  │
  │ [リファクタリング対象]
  ├── modules/trust/components/
  │   └── ReviewListPage.tsx           (改修: InfiniteScroll使用)
  ├── modules/feed/components/
  │   ├── feed/TimelineFeed.tsx        (改修: InfiniteScroll使用)
  │   └── guest/CastTimeline.tsx       (改修: InfiniteScroll使用)
  └── modules/post/components/comments/
      └── CommentSection.tsx           (改修: InfiniteScroll使用)

Backend:
  └── 変更なし
```

## InfiniteScroll Component

```typescript
interface InfiniteScrollProps {
  /** 追加データがあるか */
  hasMore: boolean;
  /** 追加読み込み中か */
  loading: boolean;
  /** 追加読み込み関数 */
  onLoadMore: () => void;
  /** IntersectionObserver の rootMargin (default: "100px") */
  rootMargin?: string;
  /** 終端メッセージ (optional) */
  endMessage?: string;
  /** children */
  children: React.ReactNode;
}

export function InfiniteScroll(props: InfiniteScrollProps) {
  // - IntersectionObserver によるトリガー
  // - ローディングスピナー表示
  // - 終端メッセージ表示（オプション）
}
```

### 使用例

```tsx
<InfiniteScroll
  hasMore={hasMore}
  loading={loadingMore}
  onLoadMore={fetchMore}
  endMessage="すべてのキャストを表示しました"
>
  <div className="grid grid-cols-2 gap-3">
    {casts.map((cast) => (
      <CastCard key={cast.id} cast={cast} />
    ))}
  </div>
</InfiniteScroll>
```

## useInfiniteCasts Hook

```typescript
interface UseInfiniteCastsOptions {
  genreId?: string;
  tag?: string;
  status?: StatusFilter;
  query?: string;
}

export function useInfiniteCasts(options: UseInfiniteCastsOptions) {
  // usePaginatedFetch を活用
  return {
    casts: CastItem[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    fetchInitial: () => Promise<void>;
    fetchMore: () => Promise<void>;
    reset: () => void;
  };
}
```

## Data Flow

```
Browser
  → useInfiniteCasts({ genreId, tag, status, query })
  → /api/guest/search?limit=20
  → 20件 + next_cursor + has_more を返却

  ↓ スクロール（InfiniteScroll コンポーネント）

  → fetchMore()
  → /api/guest/search?...&cursor=ABC123
  → 次の20件を返却
  → 既存のリストに追加
```

## Implementation Files

### Phase 1: 共通コンポーネント作成

| File | Change |
|------|--------|
| `components/ui/InfiniteScroll.tsx` | New: generic infinite scroll UI |

### Phase 2: キャスト検索実装

| File | Change |
|------|--------|
| `modules/portfolio/hooks/useInfiniteCasts.ts` | New: cast search infinite scroll hook |
| `modules/portfolio/hooks/index.ts` | Export useInfiniteCasts |
| `app/(guest)/search/page.tsx` | Integrate infinite scroll |

### Phase 3: 既存コンポーネントのリファクタリング

| File | Change |
|------|--------|
| `modules/trust/components/ReviewListPage.tsx` | Use InfiniteScroll component |
| `modules/feed/components/feed/TimelineFeed.tsx` | Use InfiniteScroll component |
| `modules/feed/components/guest/CastTimeline.tsx` | Use InfiniteScroll component |
| `modules/post/components/comments/CommentSection.tsx` | Use InfiniteScroll component |

## Testing

- InfiniteScroll コンポーネントの動作確認
- キャスト検索の無限スクロール
- 既存機能のリグレッションテスト（リファクタリング後）

## Migration

フロントエンドのみの変更。バックエンドへの影響なし。既存機能は動作を変えずにリファクタリング。
