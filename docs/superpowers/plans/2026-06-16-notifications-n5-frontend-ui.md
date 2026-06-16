# Notifications N5: frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N4 (#695) で揃った frontend data 層を消費する UI を実装し、notifications slice の縦切り完成 (最終段)。`NotificationBell` component を `/u/[username]` に viewer==owner 条件で配置、`/notifications` page を新規作成、`/dev/ui` に mock 追加。

**Architecture:** social S5 と同 layout。`NotificationBell` は `useUnreadCount` (30s polling) + 数値 badge、`/notifications` page は `useNotifications` (useSWRInfinite + markRead optimistic update) + cursor "もっと見る" + 行 click で `markRead` + 対象 resource ナビゲート。

**Tech Stack:** Next.js 16 / React / TypeScript / Tailwind。

**Spec:** `docs/superpowers/specs/2026-06-16-notifications-slice-design.md` Frontend > UI 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n5-frontend-ui`、branch `feat/notifications-n5-frontend-ui` (origin/main = `3b615588`、N4 #695 マージ後)。**push しない**。
- 触らない: 他 hook / module / BFF、monolith、proto、N4 で追加した `src/modules/notifications/{types,lib,hooks}` の中身。

### 既存パターン (踏襲)

- social `FollowButton` / `BlockButton` の pattern (`useAuthStore.selectUserId` 比較 + 自分自身は描画スキップ) → NotificationBell は **viewer==owner 時のみ表示**
- social `/oshi/page.tsx` の cursor pagination "もっと見る" + tabs pattern → `/notifications` で消費
- social `/settings/follow-requests/page.tsx` の list row pattern → `/notifications` で同形

### UX 決定

- `NotificationBell` は単純な icon (絵文字 🔔 or SVG) + 数値 badge (`useUnreadCount.count > 0` のとき表示)
- click で `/notifications` 遷移
- 行 click 時の挙動: `markRead(id)` を fire-and-forget で呼んだ後、type に応じて target ナビゲート — ただし target 解決 (post_id → /posts/[id] 等) は target_resource 配下のルーティングが未整備なため、本 PR では **markRead のみ実行 + 行を視覚的に既読化**、ナビゲートは defer (alert / console で id 出すだけにとどめる、後続 PR で正規ルート定義)

## File Structure

**New (4 file):**
- `src/modules/notifications/components/NotificationBell.tsx`
- `src/modules/notifications/components/index.ts`
- `src/app/notifications/page.tsx`
- `docs/superpowers/plans/2026-06-16-notifications-n5-frontend-ui.md`

**Modify (3 file):**
- `src/modules/notifications/index.ts` (`./components` re-export 追加)
- `src/app/u/[username]/page.tsx` (NotificationBell 配置)
- `src/app/dev/ui/page.tsx` (Notifications mock section 追加)

合計 7 file。

---

## Task 1: `NotificationBell` component

**Files:** Create `src/modules/notifications/components/NotificationBell.tsx`。

`useUnreadCount` で count、`viewerId == targetAccountId` 以外は描画しない。link で `/notifications` へ。

- [ ] **Step 1: 実装**

```tsx
"use client";

import Link from "next/link";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface NotificationBellProps {
  targetAccountId: string;
  className?: string;
}

export function NotificationBell({ targetAccountId, className }: NotificationBellProps) {
  const viewerId = useAuthStore(selectUserId);
  const { count } = useUnreadCount();

  if (!targetAccountId || !viewerId || viewerId !== targetAccountId) return null;

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex items-center justify-center rounded-full p-2 text-xl text-text-primary hover:bg-bg-secondary ${className || ""}`}
      aria-label={count > 0 ? `通知 ${count} 件` : "通知"}
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: components/index.ts**

```typescript
export * from "./NotificationBell";
```

- [ ] **Step 3: `src/modules/notifications/index.ts` に追記**

旧:
```typescript
export * from "./types";
export * from "./lib";
export * from "./hooks";
```

新:
```typescript
export * from "./types";
export * from "./lib";
export * from "./hooks";
export * from "./components";
```

---

## Task 2: `/u/[username]/page.tsx` に NotificationBell 配置

**Files:** Modify `src/app/u/[username]/page.tsx`。

`FollowButton` + `BlockButton` の隣 (`flex gap-2 px-4 pt-3` 内) に追加。viewer == owner 時のみ自動表示。

- [ ] **Step 1: import 追加**

旧:
```tsx
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
```

新:
```tsx
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
import { NotificationBell } from "@/modules/notifications";
```

- [ ] **Step 2: button block に NotificationBell 追加**

`<FollowButton />` と `<BlockButton />` が並んでいる `div` の中に追加 (Follow / Block の隣):

旧:
```tsx
<div className="flex gap-2 px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
  <BlockButton targetAccountId={profile.accountId} />
</div>
```

新:
```tsx
<div className="flex items-center gap-2 px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
  <BlockButton targetAccountId={profile.accountId} />
  <NotificationBell targetAccountId={profile.accountId} />
</div>
```

(`items-center` 追加で bell icon の縦位置を button と揃える。)

---

## Task 3: `/notifications/page.tsx` 新規

**Files:** Create `src/app/notifications/page.tsx`。

`useNotifications` で list + markRead + cursor pagination。type に応じて表示メッセージを切り替え。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNotifications, NotificationType } from "@/modules/notifications";
import type { NotificationView } from "@/modules/notifications/types";

function describe(n: NotificationView): string {
  const actorName = n.latestActor?.displayName || "誰か";
  const othersSuffix = n.actorCount > 1 ? ` 他 ${n.actorCount - 1} 人` : "";
  switch (n.type) {
    case NotificationType.LIKE:
      return `${actorName}${othersSuffix} さんがいいねしました`;
    case NotificationType.COMMENT:
      return `${actorName}${othersSuffix} さんがコメントしました`;
    case NotificationType.REPLY:
      return `${actorName}${othersSuffix} さんが返信しました`;
    case NotificationType.FOLLOW_REQUEST:
      return `${actorName} さんからフォロー申請が届きました`;
    case NotificationType.FOLLOW_APPROVED:
      return `${actorName} さんがフォロー承認しました`;
    default:
      return `${actorName} さんから通知`;
  }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP");
}

export default function NotificationsPage() {
  const { notifications, hasMore, unreadCount, loading, loadMore, markRead } = useNotifications();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">通知</h1>
        <p className="pt-1 text-sm text-text-secondary">未読 {unreadCount} 件</p>
      </div>

      {loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {!loading && notifications.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">通知はまだありません。</p>
      )}

      {notifications.map((n) => {
        const isUnread = !n.readAt;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => markRead(n.id)}
            className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left hover:bg-bg-secondary ${
              isUnread ? "bg-bg-secondary/50" : ""
            }`}
          >
            <Avatar
              src={n.latestActor?.avatarUrl || undefined}
              fallback={(n.latestActor?.displayName || "?").slice(0, 1)}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-primary">{describe(n)}</p>
              <p className="text-xs text-text-secondary">{formatDate(n.latestEventAt)}</p>
            </div>
            {isUnread && (
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="未読" />
            )}
          </button>
        );
      })}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
```

---

## Task 4: `/dev/ui/page.tsx` に Notifications mock section 追加

**Files:** Modify `src/app/dev/ui/page.tsx`。

既存 Social section の後ろに Notifications section 追加。実 hook を呼ばずに primitive で 5 type の見た目を並べる (`/dev/ui` の visual sandbox 性質に従う)。

- [ ] **Step 1: section 追加**

既存 Social section の末尾 (`</section>` 直前と直後) を探し、Social の `</section>` の直後、`</main>` の前に下記を挿入:

```tsx
<section className="px-4 pt-8">
  <h2 className="pb-3 text-lg font-bold">Notifications</h2>
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3 rounded border border-border bg-bg-secondary/50 px-3 py-2">
      <span className="text-xl" aria-hidden="true">🔔</span>
      <div className="flex-1 text-sm">
        <p className="text-text-primary">A さん他 3 人がいいねしました</p>
        <p className="text-xs text-text-secondary">2 分前 / 未読</p>
      </div>
      <span className="h-2 w-2 rounded-full bg-accent" />
    </div>
    <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
      <span className="text-xl" aria-hidden="true">💬</span>
      <div className="flex-1 text-sm">
        <p className="text-text-primary">B さんがコメントしました</p>
        <p className="text-xs text-text-secondary">15 分前 / 既読</p>
      </div>
    </div>
    <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
      <span className="text-xl" aria-hidden="true">↩</span>
      <div className="flex-1 text-sm">
        <p className="text-text-primary">C さんが返信しました</p>
        <p className="text-xs text-text-secondary">1 時間前 / 既読</p>
      </div>
    </div>
    <div className="flex items-center gap-3 rounded border border-border bg-bg-secondary/50 px-3 py-2">
      <span className="text-xl" aria-hidden="true">➕</span>
      <div className="flex-1 text-sm">
        <p className="text-text-primary">D さんからフォロー申請が届きました</p>
        <p className="text-xs text-text-secondary">3 時間前 / 未読</p>
      </div>
      <span className="h-2 w-2 rounded-full bg-accent" />
    </div>
    <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
      <span className="text-xl" aria-hidden="true">✅</span>
      <div className="flex-1 text-sm">
        <p className="text-text-primary">E さんがフォロー承認しました</p>
        <p className="text-xs text-text-secondary">昨日 / 既読</p>
      </div>
    </div>
    <div className="flex items-center gap-3 pt-3">
      <span className="w-24 text-sm text-text-secondary">Bell badge</span>
      <span className="relative inline-flex items-center justify-center rounded-full p-2 text-xl text-text-primary">
        🔔
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">5</span>
      </span>
    </div>
  </div>
</section>
```

---

## Task 5: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、`/notifications` route 出力に登場、既存 route 健在
- lint baseline 同等 (5 errors / 7 warnings、本 PR 増減なし)

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/notifications|/u/" | /usr/bin/head -5
```

期待: `/notifications` (Static か Dynamic で 1 件)、`/u/[username]`、`/api/notifications*` (3 件) 全部出る。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 4 new + 3 modified = **7 files** (plan 含む)。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n5-frontend-ui
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-16-notifications-n5-frontend-ui.md
/usr/bin/git commit -s -m "feat(notifications): frontend UI (NotificationBell + /notifications + /dev/ui mock, N5)"
```

push しない。

---

## Deferred

- **target_resource ナビゲート** (post_id → /posts/[id] 等): post route 整備込みで別 PR
- **mark all as read** UI: spec で v1 drop、別 PR
- **per-trigger mute / preferences** UI: 別 PR
- **bell badge を shell nav に移管**: Phase 1b の shell rebuild 後

## Self-Review

- **Spec coverage (N5 範囲)**: NotificationBell + /notifications page + /dev/ui mock = spec の UI 節全項目
- **Placeholder 無し**: 全 component / page 完全 code、type 5 種すべて describe() で網羅
- **既存パターン踏襲**: NotificationBell の viewer==owner 判定は FollowButton/BlockButton と同 selector、page layout は /settings/follow-requests と同形
- **型 / 命名整合**:
  - `NotificationType` enum を proto stub から re-export、page の switch 内で消費
  - `latestActor` は `SocialAccountView | null`、describe() / Avatar で null safe
  - `markRead` は optimistic update 込み (N4 hook で実装済)
- **a11y**: bell に aria-label、未読ドットに aria-label
- **検証**: tsc / build / lint baseline 維持、新 route 1 件 + modified route 1 件で smoke
