# Social block UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S4 で揃った `useBlock` / `useBlockedList` hook と `/api/social/blocks*` BFFs に **UI** を載せる。S5 で deferred されていた block UI を追加し、social.v1 BlockService を画面から実際に呼べる状態にする。

**Architecture:** 既存 social `FollowButton` と同 pattern で `BlockButton` を新規追加 (confirm + viewer/owner skip)。`/settings/blocks` page を `/settings/follow-requests` の rhyme で新設、`useBlockedList()` を消費。`/u/[username]` に BlockButton を FollowButton の下に並置。`/dev/ui` に 2 状態 mock 追記。

**Tech Stack:** Next.js 16 / React / TypeScript / 既存 Tailwind / 既存 UI primitives (`Button`、`Avatar`)。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Frontend > UI 節 (block UI が S5 で deferred、本 PR で回収)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-block-ui`、branch `feat/social-block-ui` (origin/main = `c21741a0`、cleanup C5 #686 マージ後)。**push しない**。
- 触らない: 新 `src/modules/social/{types,lib,hooks}`、`src/app/api/social/*` BFFs、monolith、proto、`useFollow` 経路 UI。

### 既存パターン (踏襲)

- `src/modules/social/components/FollowButton.tsx` (S5) — confirm + `useAuthStore` selector + own skip
- `src/app/settings/follow-requests/page.tsx` (S5) — pending list + approve/reject buttons
- `useBlock(targetAccountId)` (S4) — `{ isBlocked, block, unblock, loading }`
- `useBlockedList()` (S4) — `{ profiles, nextCursor, hasMore, loading, error, refresh }`

### UX 判断

- 単独 BlockButton を `FollowButton` の下に 1 行で配置 (overflow menu primitive 未整備のため YAGNI、後日 menu 化可能)
- confirm message は単純 `confirm()` (existing FollowButton と同じ pattern)
- /settings/blocks list は profile row + 「解除」secondary button、follow-requests page と同レイアウト

## File Structure

**New (3 file):**
- `src/modules/social/components/BlockButton.tsx`
- `src/app/settings/blocks/page.tsx`
- (なし — components/index.ts は既存に追記、modules/social/index.ts は変更不要 `components/*` を re-export しているため)

**Modify (3 file):**
- `src/modules/social/components/index.ts` (BlockButton 追記)
- `src/app/u/[username]/page.tsx` (BlockButton 配置)
- `src/app/dev/ui/page.tsx` (Social section に block 状態追記)

---

## Task 1: `BlockButton` component

**Files:** Create `src/modules/social/components/BlockButton.tsx`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface BlockButtonProps {
  targetAccountId: string;
  className?: string;
}

export function BlockButton({ targetAccountId, className }: BlockButtonProps) {
  const viewerId = useAuthStore(selectUserId);
  const { isBlocked, block, unblock, loading } = useBlock(targetAccountId);

  if (!targetAccountId || (viewerId && viewerId === targetAccountId)) return null;

  const onClick = async () => {
    if (isBlocked) {
      if (!confirm("ブロックを解除しますか?")) return;
      await unblock();
    } else {
      if (!confirm("このアカウントをブロックします。よろしいですか?")) return;
      await block();
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {isBlocked ? "ブロック解除" : "ブロック"}
    </Button>
  );
}
```

- [ ] **Step 2: tsc check (個別)**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/grep -i "blockbutton" | /usr/bin/head -5
```

期待: BlockButton 関連の error 無し。

---

## Task 2: `src/modules/social/components/index.ts` 追記

**Files:** Modify `src/modules/social/components/index.ts`。

旧:
```typescript
export * from "./FollowButton";
```

新:
```typescript
export * from "./FollowButton";
export * from "./BlockButton";
```

---

## Task 3: `/u/[username]/page.tsx` に BlockButton 配置

**Files:** Modify `src/app/u/[username]/page.tsx`。

`FollowButton` の下に BlockButton を並置。

旧 (line 1-29 抜粋):
```tsx
import { FollowButton } from "@/modules/social";
// ...
<div className="px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
</div>
```

新:
```tsx
import { FollowButton, BlockButton } from "@/modules/social";
// ...
<div className="flex gap-2 px-4 pt-3">
  <FollowButton targetAccountId={profile.accountId} />
  <BlockButton targetAccountId={profile.accountId} />
</div>
```

---

## Task 4: `/settings/blocks/page.tsx` 新規

**Files:** Create `src/app/settings/blocks/page.tsx`。

`useBlockedList()` で list 表示 + 行内に BlockButton (= isBlocked: true 状態なので "ブロック解除" 表示)。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { BlockButton, useBlockedList } from "@/modules/social";

export default function BlockedAccountsPage() {
  const { profiles, loading, error } = useBlockedList();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブロック一覧</h1>
        <p className="pt-1 text-sm text-text-secondary">
          ブロック中のアカウント {profiles.length} 件
        </p>
      </div>

      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && profiles.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">ブロック中のアカウントはありません。</p>
      )}

      {profiles.map((p) => (
        <div
          key={p.accountId}
          className="flex items-center gap-3 border-b border-border px-4 py-3"
        >
          <Avatar
            src={p.avatarUrl || undefined}
            fallback={p.displayName.slice(0, 1) || "?"}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text-primary">{p.displayName}</p>
            <p className="truncate text-sm text-text-secondary">@{p.username}</p>
          </div>
          <BlockButton targetAccountId={p.accountId} />
        </div>
      ))}
    </main>
  );
}
```

> **Note:** unblock 後の list 自動 refresh は本 PR scope 外 (S4 hook の `mutate` 経由で別途 wire 可能、現状は手動 reload で見える)。

---

## Task 5: `/dev/ui/page.tsx` の Social mock section に block 状態追記

**Files:** Modify `src/app/dev/ui/page.tsx`。

既存 Social section の末尾 (申請ボタンの下) に block 状態 2 つを追加。

- [ ] **Step 1: 既存 Social section 末尾の `</div>` 直前 (申請ボタン行の後) に追記**

旧:
```tsx
<div className="flex items-center gap-3 pt-2">
  <span className="w-24 text-sm text-text-secondary">申請 1 件</span>
  <Button variant="primary" size="sm">承認</Button>
  <Button variant="secondary" size="sm">拒否</Button>
</div>
```

新 (上記の後ろに追記):
```tsx
<div className="flex items-center gap-3 pt-2">
  <span className="w-24 text-sm text-text-secondary">申請 1 件</span>
  <Button variant="primary" size="sm">承認</Button>
  <Button variant="secondary" size="sm">拒否</Button>
</div>
<div className="flex items-center gap-3 pt-2">
  <span className="w-24 text-sm text-text-secondary">未ブロック</span>
  <Button variant="secondary" size="sm">ブロック</Button>
</div>
<div className="flex items-center gap-3">
  <span className="w-24 text-sm text-text-secondary">ブロック中</span>
  <Button variant="secondary" size="sm">ブロック解除</Button>
</div>
```

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
- build 緑、`/settings/blocks` route 出力に登場、`/u/[username]` / `/settings/follow-requests` も健在
- lint baseline 同等 (5 errors / 7 warnings、本 PR 増減無し)

- [ ] **Step 2: 新 route smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/settings/blocks|/u/" | /usr/bin/head -5
```

期待: `/settings/blocks`、`/u/[username]` 両方登場。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 2 new file + 3 modified file + plan = **6 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-block-ui
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-16-social-block-ui.md
/usr/bin/git commit -s -m "feat(social): block UI (BlockButton + /settings/blocks + dev/ui mock)"
```

push しない。

---

## Deferred

- **unblock 後の list 自動 refresh** — `useBlockedList()` の `mutate` を BlockButton 経由で trigger する設計、別 PR
- **overflow menu (3-dot)** — primitive 未整備、別 PR で `DropdownMenu` 追加と統合
- **followers/following count display** on /u/[username] — proto 拡張必要、別 PR
- **sidebar pending count badge** — sidebar 構造把握必要、別 PR
- **/oshi cursor pagination "もっと見る"** — hook 拡張必要、別 PR

## Self-Review

- **Spec coverage**: S5 deferred の block UI を回収
- **Placeholder 無し**: 全 component / page 完全 code
- **既存パターン踏襲**: FollowButton (confirm + viewer/owner skip) と follow-requests page (header + list rows) を rhyme
- **型 / 命名整合**:
  - `targetAccountId: string` (BlockButton)、`accountId` (profile)
  - `useBlock` / `useBlockedList` の戻り値 shape は S4 type と一致
- **viewer == owner 判定**: BlockButton で `useAuthStore.selectUserId` 比較、自分自身は描画スキップ
- **検証**: tsc / build / lint baseline 維持、`/settings/blocks` route smoke
