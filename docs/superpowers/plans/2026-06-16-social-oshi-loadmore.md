# Social /oshi load-more (cursor pagination) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `useFollowList` / `useFollowerList` を `useSWRInfinite` 経由で cursor 連結対応に refactor し、`/oshi` page に "もっと見る" button を追加する。S5 で deferred されていた cursor pagination を回収。

**Architecture:** SWR `useSWRInfinite` で page 配列を内部管理、hook は flat な `profiles` 配列 + `hasMore` + `loadMore` 関数を expose。page 側は新しい `loadMore` を末尾 button で叩く。`accountId` (optional viewer-or-other) は cache key の一部。

**Tech Stack:** Next.js 16 / React / TypeScript / SWR (`swr/infinite`)。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Frontend > UI 節 (cursor pagination が S5 で deferred、本 PR で回収)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-oshi-loadmore`、branch `feat/social-oshi-loadmore` (origin/main = `693326e3`、block UI #687 マージ後)。**push しない**。
- 触らない: `useFollowRequests` / `useFollowStatusBatch` / `useBlockStatusBatch` / `useBlock` / `useFollow` / `useBlockedList`、BFFs、monolith、proto。

### 既存 hook (refactor 前)

```typescript
export function useFollowList(accountId?: string) {
  const token = getAuthToken();
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    token ? `/api/social/following${qs}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    profiles: data?.profiles || [],
    nextCursor: data?.nextCursor || "",
    hasMore: data?.hasMore || false,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

### 新 hook (refactor 後)

```typescript
import useSWRInfinite from "swr/infinite";

export function useFollowList(accountId?: string) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const accountQs = accountId ? `account_id=${encodeURIComponent(accountId)}` : "";
    const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const sep = accountQs && cursorQs ? "&" : "";
    const qs = (accountQs || cursorQs) ? `?${accountQs}${sep}${cursorQs}` : "";
    return `/api/social/following${qs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`refresh` の戻り値型変更等は無し (どちらも `void/Promise<any>`)。caller (`/oshi`) は新 `loadMore` を消費可能。

`nextCursor` の expose は drop (caller が直接持つ必要無し、`loadMore` 経由で hook が管理)。

`useFollowerList` は完全に rhyme (path だけ `/api/social/followers`)。

### 既存 page

```tsx
const following = useFollowList();
// ...
{active.profiles.map((p) => <ProfileRow ... />)}
```

### 新 page (修正)

`active.profiles.map(...)` の後に "もっと見る" を条件追加。

## File Structure

**Modify (3 file):**
- `src/modules/social/hooks/useFollowList.ts`
- `src/modules/social/hooks/useFollowerList.ts`
- `src/app/oshi/page.tsx`

---

## Task 1: `useFollowList.ts` を `useSWRInfinite` 化

**Files:** Modify `src/modules/social/hooks/useFollowList.ts`。

- [ ] **Step 1: 全置換**

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowList(accountId?: string) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const accountQs = accountId ? `account_id=${encodeURIComponent(accountId)}` : "";
    const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const sep = accountQs && cursorQs ? "&" : "";
    const qs = (accountQs || cursorQs) ? `?${accountQs}${sep}${cursorQs}` : "";
    return `/api/social/following${qs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

---

## Task 2: `useFollowerList.ts` を同形 refactor

**Files:** Modify `src/modules/social/hooks/useFollowerList.ts`。

- [ ] **Step 1: 全置換 (path 以外 useFollowList と同形)**

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowerList(accountId?: string) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const accountQs = accountId ? `account_id=${encodeURIComponent(accountId)}` : "";
    const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    const sep = accountQs && cursorQs ? "&" : "";
    const qs = (accountQs || cursorQs) ? `?${accountQs}${sep}${cursorQs}` : "";
    return `/api/social/followers${qs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedProfilesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

---

## Task 3: `/oshi/page.tsx` に "もっと見る" button 追加

**Files:** Modify `src/app/oshi/page.tsx`。

- [ ] **Step 1: import に `Button` 追加**

旧 (line 4):
```tsx
import { Avatar } from "@/components/ui/avatar";
```

新 (line 4 の隣に):
```tsx
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: profiles.map の直後に load-more block を追記**

旧:
```tsx
{active.profiles.map((p) => (
  <ProfileRow key={p.accountId} profile={p} />
))}
```

新:
```tsx
{active.profiles.map((p) => (
  <ProfileRow key={p.accountId} profile={p} />
))}
{active.hasMore && (
  <div className="flex justify-center px-4 py-6">
    <Button variant="secondary" size="md" onClick={() => active.loadMore()} disabled={active.loading}>
      もっと見る
    </Button>
  </div>
)}
```

> **Note:** `Button` の `size="md"` が存在しない場合 (Button primitive が size variant を `sm` / `lg` のみ持つ場合)、`size="sm"` で fallback。実装時に Button signature を確認。

---

## Task 4: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑 (useSWRInfinite の型推論 + Hook 戻り値 shape 変更が consumer (/oshi) と整合)
- build 緑、`/oshi` route 健在
- lint baseline 同等 (5 errors / 7 warnings)

- [ ] **Step 2: build route smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/oshi" | /usr/bin/head -5
```

期待: `/oshi` 登場。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 3 modified + plan = **4 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-oshi-loadmore
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-16-social-oshi-loadmore.md
/usr/bin/git commit -s -m "feat(social): /oshi cursor pagination (load-more button)"
```

push しない。

---

## Deferred

- **infinite scroll (auto-trigger)** — IntersectionObserver で末端に達したら自動 loadMore、別 PR
- **pending requests list cursor** — `useFollowRequests` も同形拡張可能だが現状 pending は少数想定、別 PR
- **/settings/blocks cursor** — `useBlockedList` 同形拡張、別 PR
- **followers/following count display** on /u/[username] — proto 拡張必要、別 PR

## Self-Review

- **Spec coverage**: S5 deferred の cursor pagination "もっと見る" を回収
- **Placeholder 無し**: 全 hook 完全 code、page 修正 diff も完全表示
- **既存 API 互換性**: hook 戻り値 shape は `{ profiles, hasMore, loading, error, refresh }` 据置 + `loadMore` 追加、`nextCursor` のみ drop (page は元々消費していない)
- **swr/infinite 依存**: 既存 SWR 4.x が `useSWRInfinite` を提供、別途 install 不要
- **検証**: tsc / build / lint baseline 維持で smoke
