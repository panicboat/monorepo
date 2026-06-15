# Social S5: frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S4 で揃った frontend data layer の上に **FollowButton + /u/[username] 拡張 + /oshi page 新規 + /settings/follow-requests page 新規 + /dev/ui mock 追加** を実装。これで viewer が他人のプロフィールから follow/unfollow し、自分のフォロー中/フォロワーを一覧で見て、申請を承認できる状態になる。

**Architecture:** S4 の hooks (`useFollow` / `useBlock` / `useFollowList` / `useFollowerList` / `useFollowRequests`) を component 層から呼ぶ。`FollowButton` だけ新規 UI component、ページは Next 16 App Router の "use client" page で hooks をそのまま消費する thin wrapper。viewer == owner 判定は `useAuthStore` の `userId` と `profile.accountId` 比較。

**Tech Stack:** Next.js 16 App Router / React / TypeScript / Tailwind / 既存 UI primitives (`Button` / `Avatar` / `Tabs`)。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (Frontend > UI 節)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s5-frontend-ui`、branch `feat/social-s5-frontend-ui` (origin/main = `65428d5c`、S4 #680 マージ後)。**push しない**。
- 触らない: 旧 `src/modules/relationship/*`、旧 socialStore (`useSocialStore`、cleanup で drop)、monolith、proto、S4 で追加した social hooks / BFFs / types は無改変。

### 既存パターン (踏襲)

- page: `"use client"` + Next 16 `useParams<{...}>()` (`/u/[username]/page.tsx` 参考)
- UI primitive: `Button`、`Avatar`、`Tabs`、`UserCard` (`src/components/ui/*`)
- profile loader: `usePublicProfile(username || null)` で `ProfileView { accountId, isPrivate, ... }` 取得
- viewer accountId: `useAuthStore` の `userId` (selector `selectUserId`)
- isLoading 表示: 既存ページ同様 `text-text-secondary` の "読み込み中…" / 空表示
- 旧 follow UI は `UserCard` の `following` prop で binary 描画されていたが、3 状態を扱う今は FollowButton に専念

### S4 hook API (Read-only。修正禁止)

```typescript
useFollow(targetAccountId): { status, isFollowing, isPending, follow, unfollow, cancelRequest, loading }
useFollowList(accountId?): { profiles, nextCursor, hasMore, loading, error, refresh }
useFollowerList(accountId?): { profiles, nextCursor, hasMore, loading, error, refresh }
useFollowRequests(): { requests, hasMore, nextCursor, pendingCount, loading, error, approve, reject, refresh }
useBlock(targetAccountId): { isBlocked, block, unblock, loading }   // S5 で UI 採用しない (defer)
```

`profiles` は `SocialAccountView { accountId, username, displayName, avatarUrl, isPrivate }`。

## File Structure

**New (5 file):**
- `src/modules/social/components/FollowButton.tsx`
- `src/modules/social/components/index.ts` (re-export)
- `src/app/oshi/page.tsx`
- `src/app/settings/follow-requests/page.tsx`

**Modify (3 file):**
- `src/modules/social/index.ts` (`./components` re-export 追加)
- `src/app/u/[username]/page.tsx` (FollowButton 配置)
- `src/app/dev/ui/page.tsx` (Social mock section 追加)

---

## Task 1: `FollowButton` component

**Files:** Create `src/modules/social/components/FollowButton.tsx`、`src/modules/social/components/index.ts`。

3 状態:
- `NONE` → "フォロー" (primary)、click で `follow()`
- `PENDING` → "申請中" (secondary)、click で confirm → `cancelRequest()`
- `APPROVED` → "フォロー中" (secondary)、click で confirm → `unfollow()`

`targetAccountId` が null/空 or viewer 自身の場合は何も描画しない (`return null`)。

- [ ] **Step 1: 実装**

`src/modules/social/components/FollowButton.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useFollow } from "@/modules/social/hooks";
import { FollowStatus } from "@/modules/social/types";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface FollowButtonProps {
  targetAccountId: string;
  className?: string;
}

export function FollowButton({ targetAccountId, className }: FollowButtonProps) {
  const viewerId = useAuthStore(selectUserId);
  const { status, isFollowing, isPending, follow, unfollow, cancelRequest, loading } =
    useFollow(targetAccountId);

  if (!targetAccountId || (viewerId && viewerId === targetAccountId)) return null;

  const onClick = async () => {
    if (isFollowing) {
      if (!confirm("フォローを解除しますか?")) return;
      await unfollow();
    } else if (isPending) {
      if (!confirm("フォロー申請をキャンセルしますか?")) return;
      await cancelRequest();
    } else {
      await follow();
    }
  };

  const label = isFollowing ? "フォロー中" : isPending ? "申請中" : "フォロー";
  const variant = status === FollowStatus.NONE ? "primary" : "secondary";

  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={loading} className={className}>
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: components/index.ts**

```typescript
export * from "./FollowButton";
```

- [ ] **Step 3: `src/modules/social/index.ts` に追記**

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

## Task 2: `/u/[username]/page.tsx` 拡張 (FollowButton 配置)

**Files:** Modify `src/app/u/[username]/page.tsx`。

`ProfileHeader` の下に FollowButton を配置。viewer == owner の場合 FollowButton は自動的に何も描画しないので条件分岐不要。

- [ ] **Step 1: import + 配置**

旧:
```tsx
"use client";

import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";

export default function PublicProfilePage() {
  // ...
  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} />
    </main>
  );
}
```

新:
```tsx
"use client";

import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { FollowButton } from "@/modules/social";

export default function PublicProfilePage() {
  // ...
  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} />
      <div className="px-4 pt-3">
        <FollowButton targetAccountId={profile.accountId} />
      </div>
    </main>
  );
}
```

---

## Task 3: `/oshi/page.tsx` 新規 (フォロー中 / フォロワー tabs)

**Files:** Create `src/app/oshi/page.tsx`。

viewer 自身のフォロー中 / フォロワー一覧を tabs で切替。`useFollowList()` / `useFollowerList()` を accountId=undefined で呼んで viewer 自身を対象に。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { useFollowList, useFollowerList, FollowButton } from "@/modules/social";
import type { SocialAccountView } from "@/modules/social/types";

const TABS: TabItem[] = [
  { id: "following", label: "フォロー中" },
  { id: "followers", label: "フォロワー" },
];

function ProfileRow({ profile }: { profile: SocialAccountView }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Avatar src={profile.avatarUrl || undefined} fallback={profile.displayName.slice(0, 1) || "?"} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{profile.displayName}</p>
        <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
      </div>
      <FollowButton targetAccountId={profile.accountId} />
    </div>
  );
}

export default function OshiPage() {
  const [tab, setTab] = useState("following");
  const following = useFollowList();
  const followers = useFollowerList();

  const active = tab === "following" ? following : followers;

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 pb-2 pt-4 text-xl font-bold">推し</h1>
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {active.loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {!active.loading && active.profiles.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">
          {tab === "following" ? "フォロー中のアカウントはまだいません。" : "フォロワーはまだいません。"}
        </p>
      )}
      {active.profiles.map((p) => (
        <ProfileRow key={p.accountId} profile={p} />
      ))}
    </main>
  );
}
```

> **Note:** S4 の `useFollowList` / `useFollowerList` は単発 fetch (cursor 連結未実装)。続きはユーザーが明示 "もっと見る" を押した時に `refresh()` 後の cursor 渡し、別 PR で hook 拡張。今は `hasMore` を表示しないシンプル list。

---

## Task 4: `/settings/follow-requests/page.tsx` 新規 (pending list + approve/reject)

**Files:** Create `src/app/settings/follow-requests/page.tsx`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFollowRequests } from "@/modules/social";

export default function FollowRequestsPage() {
  const { requests, pendingCount, loading, error, approve, reject } = useFollowRequests();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">フォロー申請</h1>
        <p className="pt-1 text-sm text-text-secondary">
          承認待ちの申請 {pendingCount} 件
        </p>
      </div>

      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && requests.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">申請はありません。</p>
      )}

      {requests.map((r) => (
        <div
          key={r.requesterAccountId}
          className="flex items-center gap-3 border-b border-border px-4 py-3"
        >
          <Avatar src={r.avatarUrl || undefined} fallback={r.displayName.slice(0, 1) || "?"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text-primary">{r.displayName}</p>
            <p className="truncate text-sm text-text-secondary">@{r.username}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => approve(r.requesterAccountId)}>
              承認
            </Button>
            <Button variant="secondary" size="sm" onClick={() => reject(r.requesterAccountId)}>
              拒否
            </Button>
          </div>
        </div>
      ))}
    </main>
  );
}
```

---

## Task 5: `/dev/ui/page.tsx` に Social mock section 追加

**Files:** Modify `src/app/dev/ui/page.tsx`。

末尾 (既存 mock の後ろ) に Social section 追加。実 BFF は叩かず、純粋に visual primitives + 3 状態の `Button` を直書きして mock 化 (`FollowButton` は実 hook を呼ぶので mock 用途には合わない → primitive 表示で 3 状態を見せる)。

- [ ] **Step 1: import 追加 (page 上部、useState や他 import 列の隣)**

```tsx
import { Button } from "@/components/ui/button";  // 既存重複なら省く
```

(既に import 済の場合は追記不要)

- [ ] **Step 2: page return JSX 末尾に section 追加**

既存 page の末尾、`</main>` 直前に下記を挿入:

```tsx
<section className="px-4 pt-8">
  <h2 className="pb-3 text-lg font-bold">Social</h2>
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-text-secondary">NONE</span>
      <Button variant="primary" size="sm">フォロー</Button>
    </div>
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-text-secondary">PENDING</span>
      <Button variant="secondary" size="sm">申請中</Button>
    </div>
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-text-secondary">APPROVED</span>
      <Button variant="secondary" size="sm">フォロー中</Button>
    </div>
    <div className="flex items-center gap-3 pt-2">
      <span className="w-24 text-sm text-text-secondary">申請 1 件</span>
      <Button variant="primary" size="sm">承認</Button>
      <Button variant="secondary" size="sm">拒否</Button>
    </div>
  </div>
</section>
```

> **Note:** dev/ui は実機が無い環境でも見られる visual sandbox の役割。実 hook を呼ぶ `FollowButton` を貼ると authStore に viewer がいないと何も描画されないので、敢えて Button primitive で 3 状態を並べる。

---

## Task 6: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、新 `/oshi` / `/settings/follow-requests` route 出力に登場
- lint baseline 同等 (新規 error 増加無し)

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/oshi|/settings/follow-requests|/u/" | /usr/bin/head -10
```

期待: `/oshi`、`/settings/follow-requests`、`/u/[username]` 登場。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 4 new file + 3 modified file + plan = **8 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s5-frontend-ui
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-15-social-s5-frontend-ui.md
/usr/bin/git commit -s -m "feat(social): frontend UI (FollowButton + /oshi + follow-requests + dev/ui mock)"
```

push しない。

---

## Deferred

- **followers/following count display** on /u/[username] — `profile.v1.Profile` に count フィールド無し、別 RPC か profile 拡張が必要、別 PR
- **sidebar/nav pending count badge** — sidebar component 全体構造把握 + integration が大きい、別 PR
- **/oshi cursor pagination の "もっと見る"** — hook を cursor 連結対応に拡張する必要、別 PR
- **`useBlock` / `useBlockedList` の UI** (block button、blocked list 画面) — 設定画面の余裕で別 PR
- **「いいねを送る」** UI — spec で言及あるが今回未スコープ
- **/dev/ui 内の実 FollowButton 表示** — authStore 注入を伴うため別 PR
- **旧 `/u/[username]` 内 ProfileHeader への follow button 統合** — ProfileHeader を触らず外側 FollowButton 配置で同等の見た目を確保 (surgical change)

## Self-Review

- **Spec coverage (S5 範囲)**:
  - FollowButton component ✓ (3 状態)
  - /u/[username] follow button 配置 ✓
  - /oshi page tabs フォロー中 / フォロワー ✓
  - /settings/follow-requests pending list + approve/reject ✓
  - /dev/ui mock section ✓
  - count badge / cursor pagination / block UI は Deferred 明記
- **Placeholder 無し**: 全 component / page 完全 code。
- **既存パターン踏襲**: `"use client"` + `useParams` + UI primitive (`Button`/`Avatar`/`Tabs`) で /u/[username] と同じ trim level
- **型 / 命名整合**:
  - `targetAccountId: string` (FollowButton)、`accountId` (profile)、`requesterAccountId` (request item) — S4 type と一致
  - `FollowStatus` re-export 経由 (`@/modules/social/types`)
- **viewer == owner 判定**: `useAuthStore` の `selectUserId` で取得した viewer id と target 比較、一致時 FollowButton 自動非描画 → /u/[username] 配置に条件分岐不要
- **検証**: tsc/build/lint 既存 baseline 維持、2 新規 route + 1 修正 route が build 出力に登場で smoke
