# Phase 1b-A: AppShell Implementation Plan (TopBar + BottomTab + Drawer + 5 stub pages)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1b の最大 PR。`src/components/shell/` 配下に AppShell + TopBar + BottomTab + Drawer + ComposerFAB の 5 component、`src/app/layout.tsx` を AppShell 化、5 stub pages (`/search`、`/messages`、`/footprints`、`/bookmarks`、`/ranking`) を新規追加、`/u/[username]` から NotificationBell を削除して shell 集約。これで全 nav 項目が tap 可能 + bell badge が shell-wide で 1 箇所のみ表示される状態にする。

**Architecture:** rx-sns 準拠 mobile-first 二層 nav。AppShell は AuthProvider/SWRProvider の内側、`useAuthStore(selectUserId)` で認証時のみ shell 展開 / 未認証時は children 素通り。Bottom-tab は 4 slot 均等幅、右下 corner FAB は独立 layer (bottom-tab 上に重ね)、Drawer は overlay slide-in。

**Tech Stack:** Next.js 16 / React / TypeScript / Tailwind / 既存 UI primitives (`Avatar` / `Button`)。

**Spec:** `docs/superpowers/specs/2026-06-17-app-shell-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-app-shell-1b-a`、branch `feat/app-shell-1b-a` (origin/main = `8330cdb8`、spec #698 マージ後)。**push しない**。
- 触らない: 他 page (`/`、`/notifications`、`/oshi`、`/settings*`、`/profile`、`/posts/[id]` の中身)、modules (`@/modules/social`、`@/modules/notifications`、`@/modules/profile` 等の中身は無改変)、BFFs、monolith、proto。

### 既存パターン (踏襲)

- `useAuthStore` + `selectUserId` selector で viewer 判定 (S5 `FollowButton` / `BlockButton` で確立)
- `useUnreadCount()` from `@/modules/notifications/hooks` で polling 30s badge
- `usePublicProfile(username)` for self profile (drawer の avatar / handle 取得)
  - alternative: `useProfile()` (self profile editor で使用済) で `accountId / username / displayName / avatarUrl` を直接取得可能
- 既存 UI primitive: `Avatar` (`@/components/ui/avatar`)、`Button` (variants: primary/secondary/ghost)
- icon = emoji を採用 (lucide-react などの追加 dependency 無し、Phase 1a で確立)
- AuthGuard pattern: `useAuthStore(selectIsHydrated)` で hydration 完了確認、`selectUserId` で auth 判定

### Layout 構造

```
RootLayout (server component)
  └─ AuthProvider (client)
      └─ SWRProvider (client)
          └─ AppShell (client、新規)
              ├─ TopBar (sticky top)
              ├─ <main className="mx-auto max-w-xl pb-24 ...">{children}</main>
              ├─ BottomTab (sticky bottom、md:hidden)
              ├─ ComposerFAB (fixed bottom-right、md:hidden)
              └─ Drawer (overlay、avatar tap で open)
```

AppShell は内部 state `drawerOpen` を持つ。avatar tap で `setDrawerOpen(true)`、Drawer 内 close button / overlay click で `setDrawerOpen(false)`。

### Stub page pattern

各 stub page は client component で 1 行 message:

```tsx
"use client";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center text-text-secondary">
      検索機能は準備中です。
    </main>
  );
}
```

ただし AppShell が `<main>` を提供する場合、stub page の `<main>` は不要 (shell の main 内に nest される)。spec 通り **shell の main の中に各 page の content** が入る方針。stub page も `<div>` でラップして shell に従う:

```tsx
"use client";

export default function SearchPage() {
  return (
    <div className="p-6 text-center text-text-secondary">
      検索機能は準備中です。
    </div>
  );
}
```

ただし既存 page (`/`、`/notifications` 等) は `<main className="mx-auto max-w-xl ...">` を内部に持つ。AppShell の `<main>` と二重 `<main>` 問題を避けるため、**AppShell の slot は `<main>` ではなく `<div>` にし、既存 page の `<main>` は据置** とする方針を採用 (既存 page 無改変が優先)。

→ AppShell layout 修正:

```tsx
<div className="min-h-screen flex flex-col bg-bg">
  <TopBar onAvatarClick={() => setDrawerOpen(true)} />
  <div className="flex-1 pb-24 md:pb-0">{children}</div>
  <BottomTab unreadCount={count} />
  <ComposerFAB />
  <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
</div>
```

各既存 page の `<main className="mx-auto max-w-xl bg-bg ...">` がそのまま children に入り問題なし。stub page も既存と同 pattern で `<main>` を持たせる:

```tsx
"use client";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center text-text-secondary">
      検索機能は準備中です。
    </main>
  );
}
```

## File Structure

**New (10 file):**
- `src/components/shell/AppShell.tsx`
- `src/components/shell/TopBar.tsx`
- `src/components/shell/BottomTab.tsx`
- `src/components/shell/Drawer.tsx`
- `src/components/shell/ComposerFAB.tsx`
- `src/components/shell/index.ts`
- `src/app/search/page.tsx`
- `src/app/messages/page.tsx`
- `src/app/footprints/page.tsx`
- `src/app/bookmarks/page.tsx`
- `src/app/ranking/page.tsx`

**Modify (2 file):**
- `src/app/layout.tsx` (AppShell wrapper 追加)
- `src/app/u/[username]/page.tsx` (NotificationBell import + 配置削除)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-app-shell-1b-a.md`

合計 13 file。

---

## Task 1: `TopBar` component

**Files:** Create `src/components/shell/TopBar.tsx`。

avatar (左) + テキストロゴ (中央) + 右空。avatar click で props の `onAvatarClick`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { useProfile } from "@/modules/profile/hooks";

interface TopBarProps {
  onAvatarClick: () => void;
}

export function TopBar({ onAvatarClick }: TopBarProps) {
  const { profile } = useProfile();
  const avatarUrl = profile?.avatarUrl || undefined;
  const fallback = (profile?.displayName || "?").slice(0, 1);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/95 px-4 py-2 backdrop-blur">
      <button
        type="button"
        onClick={onAvatarClick}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="メニューを開く"
      >
        <Avatar src={avatarUrl} fallback={fallback} size="sm" />
      </button>
      <div className="text-base font-bold text-text-primary tracking-tight">dystopia.city</div>
      <div className="w-8" aria-hidden="true" /> {/* 右側の見た目バランス用 */}
    </header>
  );
}
```

---

## Task 2: `BottomTab` component

**Files:** Create `src/components/shell/BottomTab.tsx`。

4 slot 均等幅。active state は `usePathname()` で判定。通知 slot は badge。

- [ ] **Step 1: 実装**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/modules/notifications/hooks";

const TABS = [
  { id: "home", path: "/", label: "ホーム", icon: "🏠" },
  { id: "search", path: "/search", label: "検索", icon: "🔍" },
  { id: "notifications", path: "/notifications", label: "通知", icon: "🔔" },
  { id: "messages", path: "/messages", label: "メッセージ", icon: "💬" },
];

export function BottomTab() {
  const pathname = usePathname();
  const { count } = useUnreadCount();

  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-bg/95 px-2 py-1 backdrop-blur md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        const isNotif = tab.id === "notifications";
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs ${
              active ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="text-xl" aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
            {isNotif && count > 0 && (
              <span className="absolute right-2 top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

---

## Task 3: `ComposerFAB` component

**Files:** Create `src/components/shell/ComposerFAB.tsx`。

右下 fixed、brand gradient 円、click で alert。

- [ ] **Step 1: 実装**

```tsx
"use client";

export function ComposerFAB() {
  return (
    <button
      type="button"
      onClick={() => alert("投稿機能は近日対応です")}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-2xl text-white shadow-brand-glow active:scale-95 md:hidden"
      aria-label="投稿を作成"
    >
      ＋
    </button>
  );
}
```

> **Note:** `bg-gradient-brand` と `shadow-brand-glow` は Phase 0 token に存在 (`docs/superpowers/specs/2026-05-29-design-system-design.md` §3)。未定義なら `bg-accent`、`shadow-lg` で fallback。

---

## Task 4: `Drawer` component

**Files:** Create `src/components/shell/Drawer.tsx`。

overlay + 左 slide-in。9 nav 項目 + ログアウト。avatar header に viewer 情報、`useSocialCounts` で count 表示。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useProfile } from "@/modules/profile/hooks";
import { useSocialCounts } from "@/modules/social";
import { useUnreadCount } from "@/modules/notifications/hooks";
import { useAuthStore } from "@/stores/authStore";

const NAV_ITEMS = [
  { path: "/profile", label: "プロフィール", icon: "👤" },
  { path: "/search", label: "検索", icon: "🔍" },
  { path: "/notifications", label: "通知", icon: "🔔", badgeKey: "unread" as const },
  { path: "/footprints", label: "足跡", icon: "👣" },
  { path: "/messages", label: "メッセージ", icon: "💬" },
  { path: "/bookmarks", label: "ブックマーク", icon: "🔖" },
  { path: "/oshi", label: "推し！", icon: "⭐" },
  { path: "/ranking", label: "ランキング", icon: "🏆" },
  { path: "/settings", label: "設定", icon: "⚙" },
];

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

export function Drawer({ open, onClose }: DrawerProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const { followingCount, followersCount } = useSocialCounts(profile?.accountId);
  const { count: unread } = useUnreadCount();
  const clearTokens = useAuthStore((s) => s.clearTokens);

  // ESC で close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onLogout = () => {
    clearTokens();
    onClose();
    router.push("/");
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[80vw] flex-col bg-bg shadow-2xl"
        role="dialog"
        aria-label="メニュー"
      >
        <div className="border-b border-border px-4 py-4">
          <Avatar
            src={profile?.avatarUrl || undefined}
            fallback={(profile?.displayName || "?").slice(0, 1)}
            size="lg"
            className="h-16 w-16 text-xl"
          />
          <p className="pt-2 font-bold text-text-primary">{profile?.displayName || "—"}</p>
          <p className="text-sm text-text-secondary">@{profile?.username || "—"}</p>
          <p className="pt-1 text-xs text-text-secondary">
            <strong className="text-text-primary">{followingCount}</strong> フォロー中{" "}
            <strong className="text-text-primary">{followersCount}</strong> フォロワー
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const showBadge = item.badgeKey === "unread" && unread > 0;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-text-primary hover:bg-bg-secondary"
              >
                <span className="text-xl" aria-hidden="true">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 text-sm text-text-secondary hover:text-text-primary"
          >
            <Avatar
              src={profile?.avatarUrl || undefined}
              fallback={(profile?.displayName || "?").slice(0, 1)}
              size="sm"
            />
            <span className="flex-1 text-left">@{profile?.username || "—"}</span>
            <span aria-hidden="true">➜</span>
            <span className="sr-only">ログアウト</span>
          </button>
        </div>
      </aside>
    </>
  );
}
```

> **Note:** `bg-bg-secondary` の token が未定義なら `bg-bg/50` で fallback。

---

## Task 5: `AppShell` orchestrator

**Files:** Create `src/components/shell/AppShell.tsx`。

未認証 bypass + 4 component の組合せ。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useState } from "react";
import { useAuthStore, selectUserId, selectIsHydrated } from "@/stores/authStore";
import { TopBar } from "./TopBar";
import { BottomTab } from "./BottomTab";
import { ComposerFAB } from "./ComposerFAB";
import { Drawer } from "./Drawer";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isHydrated = useAuthStore(selectIsHydrated);
  const viewerId = useAuthStore(selectUserId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // hydration 前 or 未認証 = shell bypass
  if (!isHydrated || !viewerId) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar onAvatarClick={() => setDrawerOpen(true)} />
      <div className="flex-1 pb-24 md:pb-0">{children}</div>
      <BottomTab />
      <ComposerFAB />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
```

---

## Task 6: `src/components/shell/index.ts`

```typescript
export * from "./AppShell";
export * from "./TopBar";
export * from "./BottomTab";
export * from "./Drawer";
export * from "./ComposerFAB";
```

---

## Task 7: `src/app/layout.tsx` を AppShell 化

**Files:** Modify `src/app/layout.tsx`。

旧:
```tsx
<AuthProvider>
  <SWRProvider>{children}</SWRProvider>
</AuthProvider>
```

新:
```tsx
<AuthProvider>
  <SWRProvider>
    <AppShell>{children}</AppShell>
  </SWRProvider>
</AuthProvider>
```

`import { AppShell } from "@/components/shell";` を file 上部に追加。

---

## Task 8: 5 stub pages 作成

**Files:** Create 5 `page.tsx` files, all using the same template.

`src/app/search/page.tsx`:
```tsx
"use client";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center text-text-secondary">
      検索機能は準備中です。
    </main>
  );
}
```

同 pattern で:
- `src/app/messages/page.tsx`: "メッセージ機能は準備中です。"
- `src/app/footprints/page.tsx`: "足跡機能は準備中です。"
- `src/app/bookmarks/page.tsx`: "ブックマーク機能は準備中です。"
- `src/app/ranking/page.tsx`: "ランキング機能は準備中です。"

各 file 名と message のみ差替え。

---

## Task 9: `/u/[username]/page.tsx` から NotificationBell 削除

**Files:** Modify `src/app/u/[username]/page.tsx`。

shell の bottom-tab + drawer で badge が出るため、profile page 内の重複表示を削除。

- [ ] **Step 1: import 削除**

旧:
```tsx
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
import { NotificationBell } from "@/modules/notifications";
```

新:
```tsx
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
```

- [ ] **Step 2: button block から NotificationBell 削除**

旧:
```tsx
<div className="flex items-center gap-2 px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
  <BlockButton targetAccountId={profile.accountId} />
  <NotificationBell targetAccountId={profile.accountId} />
</div>
```

新:
```tsx
<div className="flex items-center gap-2 px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
  <BlockButton targetAccountId={profile.accountId} />
</div>
```

(`items-center` は維持、bell が無くなっても button が縦中央揃え)

---

## Task 10: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -30
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、新 5 route 出力に登場 (`/search`、`/messages`、`/footprints`、`/bookmarks`、`/ranking`)
- lint baseline 同等 (5 errors / 7 warnings、本 PR 増減なし)

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/search|/messages|/footprints|/bookmarks|/ranking|/u/|/notifications|/oshi" | /usr/bin/head -10
```

期待: 5 new stub + 既存 4 route 全部出る。

- [ ] **Step 3: NotificationBell 削除確認**

```bash
/usr/bin/grep -rn "NotificationBell" services/frontend/workspace/src --include="*.tsx" 2>&1 | /usr/bin/head -5
```

期待: `src/modules/notifications/components/NotificationBell.tsx` (定義) と `src/modules/notifications/components/index.ts` (re-export)、`src/app/dev/ui/page.tsx` の mock のみ。`/u/[username]/page.tsx` には残らない。

- [ ] **Step 4: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 11 new (10 component/page + plan) + 2 modify = **13 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-app-shell-1b-a
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-17-app-shell-1b-a.md
/usr/bin/git commit -s -m "feat(shell): Phase 1b-A app shell (TopBar + BottomTab + Drawer + FAB + 5 stubs)"
```

push しない。

---

## Deferred

- **1b-B**: `/dev/ui` に AppShell mock section 追加
- **composer modal / `/posts/new`**: Post module 拡張、別 PR
- **検索 / メッセージ / 足跡 / ブックマーク / ランキング の実機能**: 各自 brainstorming + 縦実装、別 spec
- **desktop 3-col layout**: Phase 2 以降
- **Drawer 開閉アニメーション微調整 (slide-in easing 等)**: 実装後 polish

## Self-Review

- **Spec coverage (1b-A 範囲)**: AppShell + TopBar + BottomTab + Drawer + ComposerFAB + 5 stub pages + NotificationBell 移管 = 全項目
- **Placeholder 無し**: 全 component / page 完全 code 提示
- **既存パターン踏襲**:
  - `useAuthStore` + selector パターン (FollowButton 等で確立済)
  - `useUnreadCount` polling 30s (notifications N5 で確立)
  - `Avatar` component の `src / fallback / size` API
- **未認証 bypass**: `isHydrated && viewerId` 両方確認、SSR 時のチラつき防止
- **bell badge 集約**: bottom-tab + drawer の 2 箇所のみ、`/u/[username]` からは削除
- **rx-sns 準拠**: bottom-tab = ホーム / 検索 / 通知 / メッセージ、FAB は右下 corner overlay、drawer は spec §4 line 158 通りの 9 nav 項目順序
- **検証**: tsc / build / lint baseline 維持、5 stub route smoke、NotificationBell 削除 grep smoke
