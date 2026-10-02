# Profile Avatar Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フォロー中/フォロワー一覧とユーザー検索結果でユーザーアイコンからプロフィールへ遷移できない不具合を修正し、同じ目的で重複実装されていたアイコン単体のプロフィールリンクを `Avatar` コンポーネント自身の機能として共通化する。

**Architecture:** `dystopia/frontend/src/components/ui/avatar.tsx` の `Avatar` に任意の `href` prop を追加し、渡された場合のみ内部で `next/link` の `Link` によって自身をラップする（渡されなければ従来通り表示専任）。これにより、呼び出し側は `href` を渡すだけでアイコン単体のプロフィールリンクを得られる。バグ修正対象の2箇所（`FollowListView.tsx` の `ProfileRow`、`search/page.tsx` のユーザー検索結果行）はこの `href` を使って新規にアイコンと名前をリンクする。加えて、既に同種のリンクを自前実装していた4箇所（`FootprintRow.tsx` / `SuggestedUsersPane.tsx` の行全体Linkパターン、`CommentList.tsx` / `post-card.tsx` のアイコン単体Linkパターン）を、アイコン部分は `Avatar.href` に、名前部分は引き続き個別の `Link` に置き換えて統一する。`FootprintRow.tsx` と `SuggestedUsersPane.tsx` は、この置き換えによりアイコンと名前の間の余白や付随情報（訪問時刻など）がクリック不可になる変化を許容する（ユーザー確認済み）。

**Tech Stack:** Next.js (App Router) / React 19 / TypeScript / Vitest（`renderToStaticMarkup` によるスナップショット的アサーションと、`happy-dom` + `react-dom/client` による実DOMマウントの2パターンを既存コードから踏襲）/ Radix UI (`@radix-ui/react-avatar`)

**Spec:** 本チャットでのユーザーとの合意事項（spec文書なし）。決定事項:
1. `Avatar` に `href` prop を追加する方式を採用（Link独自実装の並立ではなく共通コンポーネント側に寄せる）
2. 既存4箇所（`FootprintRow` / `CommentList` / `post-card` / `SuggestedUsersPane`）も新方式に置き換える
3. `FootprintRow` / `SuggestedUsersPane` の「行全体を1つのLinkで包む」実装も置き換え対象とする（クリック可能領域の縮小を許容）

## Global Constraints

- プロフィールURLは `/u/${encodeURIComponent(username)}` 形式（`src/app/u/[username]/page.tsx` のルーティングに準拠)
- `FootprintVisitorView.username` が空文字の場合はリンクを生成しない(`href` を `undefined` にする) — 既存の `FootprintRow.tsx` 自身の `"#"` フォールバック実装が前提にしていた規約を維持する。`SocialAccountView.username`(FollowListView / search / SuggestedUsersPane が扱う型)は元々この種のガードを持たない既存パターンであり、本タスクでも新規に追加しない(Simplicity First: 頼まれていない検証を追加しない)
- テストは `vitest run`(node環境既定、DOM操作が要る場合のみファイル先頭に `// @vitest-environment happy-dom` を付与)で実行する
- 本タスクで変更しない既存の `Avatar` 呼び出し箇所(`TopBar.tsx` / `Drawer.tsx` / `SideNav.tsx` / `ProfileHeader.tsx` / `ReplyList.tsx` / `ReplyWithParentRow.tsx` / `user-card.tsx` / 設定画面系ページ)は一切触らない

## Review Focus

- `FootprintRow` で visitor の `username` が空文字列の場合に、アイコン/名前がリンク化されずクラッシュもしないこと(既存行動の維持。Task 6 でテスト化する)
- `Avatar` に `href` を渡さない既存の全呼び出し箇所が、今回の変更後も `<a>` タグを生成しないこと(非破壊の確認)
- `search/page.tsx` でクエリが空文字の間はユーザー一覧自体が描画されない(既存の `trimmed.length === 0` 分岐を壊さない)
- `FollowButton` / 訪問時刻などの `Link` 対象外要素が、新しい行構造でも `<a>` の外側に留まり、ネストした `<a>` を生成しないこと
- `post-card.tsx` の画像ライトボックス機能(`PostCard` 内の `Dialog` 操作)が、アイコン部分のLink構造変更後も壊れていないこと(既存テストで担保)

---

### Task 1: Avatar に href prop を追加

**Files:**
- Modify: `dystopia/frontend/src/components/ui/avatar.tsx`
- Test: `dystopia/frontend/src/components/ui/avatar.test.tsx`(新規)

**Interfaces:**
- Consumes: なし(最も基礎のコンポーネント)
- Produces: `Avatar` コンポーネントが新たに受け取れる `href?: string` prop。渡されれば `Avatar` 自身が `<a href={href}>` でラップされた状態でレンダリングされる。渡さなければ従来通り `<a>` を含まない。後続タスクはすべてこの `href` prop を利用する。

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/components/ui/avatar.test.tsx` を新規作成する。

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("wraps itself in a link to href when href is given", () => {
    const html = renderToStaticMarkup(<Avatar fallback="T" href="/u/test_taro" />);

    expect(html).toContain(`<a href="/u/test_taro"`);
  });

  it("renders without a link when href is not given", () => {
    const html = renderToStaticMarkup(<Avatar fallback="T" />);

    expect(html).not.toContain("<a ");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && npx vitest run src/components/ui/avatar.test.tsx`
Expected: 1件目が `href` prop が存在しないため型エラーもしくは `<a href="/u/test_taro"` が含まれず FAIL

- [ ] **Step 3: 最小実装を書く**

`dystopia/frontend/src/components/ui/avatar.tsx` を以下に置き換える。

```tsx
"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({ src, alt, fallback, size = "md", className, href }: AvatarProps) {
  const avatar = (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-surface",
        sizeMap[size],
        className
      )}
    >
      <AvatarPrimitive.Image
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
      />
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center font-medium text-text-secondary">
        {fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );

  if (!href) return avatar;

  return <Link href={href}>{avatar}</Link>;
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && npx vitest run src/components/ui/avatar.test.tsx`
Expected: PASS(2件とも)

- [ ] **Step 5: コミット**

```bash
cd dystopia/frontend
git add src/components/ui/avatar.tsx src/components/ui/avatar.test.tsx
git commit -s -m "feat(dystopia/frontend): add optional href to Avatar for profile linking"
```

---

### Task 2: フォロー中/フォロワー一覧のアイコンと名前をプロフィールへリンク(バグ修正)

**Files:**
- Modify: `dystopia/frontend/src/modules/social/components/FollowListView.tsx`
- Modify(テスト追加): `dystopia/frontend/src/modules/social/components/FollowListView.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/modules/social/components/FollowListView.test.tsx` の `describe("FollowListView", () => { ... })` 内、最後の `it` ブロックの直後に以下を追加する。

```tsx
  it("links each profile's avatar and name to their profile page", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView accountId="account-1" />);

    expect(html).toContain(`<a href="/u/yuna"`);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && npx vitest run src/modules/social/components/FollowListView.test.tsx`
Expected: 新規追加した `it` が FAIL(`<a href="/u/yuna"` が出力に含まれない)

- [ ] **Step 3: 最小実装を書く**

`dystopia/frontend/src/modules/social/components/FollowListView.tsx` の先頭 import に `Link` を追加し、`ProfileRow` を書き換える。

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { useFollowList, useFollowerList } from "@/modules/social/hooks";
import { FollowButton } from "./FollowButton";
import type { SocialAccountView } from "../types";
```

`ProfileRow` 関数を以下に置き換える。

```tsx
function ProfileRow({ profile }: { profile: SocialAccountView }) {
  const href = `/u/${encodeURIComponent(profile.username)}`;
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Avatar
        src={profile.avatarUrl || undefined}
        fallback={profile.displayName.slice(0, 1) || "?"}
        size="md"
        href={href}
      />
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{profile.displayName}</p>
        <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
      </Link>
      <FollowButton targetAccountId={profile.accountId} />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && npx vitest run src/modules/social/components/FollowListView.test.tsx`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd dystopia/frontend
git add src/modules/social/components/FollowListView.tsx src/modules/social/components/FollowListView.test.tsx
git commit -s -m "fix(dystopia/frontend): link follow list avatars and names to profile"
```

---

### Task 3: ユーザー検索結果のアイコンと名前をプロフィールへリンク(バグ修正)

**Files:**
- Modify: `dystopia/frontend/src/app/search/page.tsx`
- Test: `dystopia/frontend/src/app/search/page.test.tsx`(新規)

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(ページコンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/app/search/page.test.tsx` を新規作成する。

```tsx
// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hookMocks = vi.hoisted(() => ({
  useSearchUsers: vi.fn(),
  useSearchPosts: vi.fn(),
}));

vi.mock("@/modules/discovery", () => ({
  useSearchUsers: hookMocks.useSearchUsers,
  useSearchPosts: hookMocks.useSearchPosts,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => null,
}));

vi.mock("@/modules/post/components/PostCardBinding", () => ({
  PostCardBinding: () => null,
}));

const { default: SearchPage } = await import("./page");

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

async function typeQuery(input: HTMLInputElement, value: string) {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;

  await act(async () => {
    nativeValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

describe("SearchPage", () => {
  it("links each matched user's avatar and name to their profile", async () => {
    hookMocks.useSearchUsers.mockReturnValue({
      profiles: [{ accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });
    hookMocks.useSearchPosts.mockReturnValue({
      posts: [],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchPage />);
    });

    const input = container.querySelector('input[aria-label="検索"]') as HTMLInputElement;
    await typeQuery(input, "yuna");

    expect(container.innerHTML).toContain(`<a href="/u/yuna"`);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && npx vitest run src/app/search/page.test.tsx`
Expected: FAIL(`<a href="/u/yuna"` が出力に含まれない)

- [ ] **Step 3: 最小実装を書く**

`dystopia/frontend/src/app/search/page.tsx` の先頭 import に `Link` を追加する。

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { FollowButton } from "@/modules/social";
import { useSearchUsers, useSearchPosts } from "@/modules/discovery";
import type { SearchUsersRoleFilter } from "@/modules/discovery/hooks/useSearchUsers";
import { cn } from "@/lib/utils";
```

`users.profiles.map((p) => ( ... ))` のブロックを以下に置き換える。

```tsx
          {users.profiles.map((p) => {
            const href = `/u/${encodeURIComponent(p.username)}`;
            return (
              <div
                key={p.accountId}
                className="flex items-center gap-3 border-b border-border px-4 py-3"
              >
                <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" href={href} />
                <Link href={href} className="min-w-0 flex-1">
                  <p className="truncate font-bold text-text-primary">{p.displayName}</p>
                  <p className="truncate text-sm text-text-secondary">@{p.username}</p>
                </Link>
                <FollowButton targetAccountId={p.accountId} />
              </div>
            );
          })}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && npx vitest run src/app/search/page.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd dystopia/frontend
git add src/app/search/page.tsx src/app/search/page.test.tsx
git commit -s -m "fix(dystopia/frontend): link user search result avatars and names to profile"
```

---

### Task 4: CommentList のアイコンリンクを Avatar.href に置き換え(重複解消)

**Files:**
- Modify: `dystopia/frontend/src/modules/post/components/CommentList.tsx`
- 既存テスト(変更不要、回帰確認のみ): `dystopia/frontend/src/modules/post/components/CommentList.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 既存テストが現状で通ることを確認する(回帰の基準点)**

Run: `cd dystopia/frontend && npx vitest run src/modules/post/components/CommentList.test.tsx`
Expected: PASS(変更前の時点で全件green)

- [ ] **Step 2: 実装を変更する**

`dystopia/frontend/src/modules/post/components/CommentList.tsx` 内、`comments.map` 直下の `avatar` 定義と、その直後のレンダリング箇所を以下のように変更する。

変更前:
```tsx
        const avatar = (
          <Avatar
            src={c.author?.imageUrl || undefined}
            fallback={(c.author?.name || "?").slice(0, 1)}
            size="sm"
          />
        );
        return (
          <div key={c.id}>
            <article className="flex gap-3 border-b border-divider px-4 py-3">
              {authorHref ? <Link href={authorHref}>{avatar}</Link> : avatar}
```

変更後:
```tsx
        const avatar = (
          <Avatar
            src={c.author?.imageUrl || undefined}
            fallback={(c.author?.name || "?").slice(0, 1)}
            size="sm"
            href={authorHref}
          />
        );
        return (
          <div key={c.id}>
            <article className="flex gap-3 border-b border-divider px-4 py-3">
              {avatar}
```

名前部分の `{authorHref ? <Link href={authorHref} className="font-bold text-text-primary">{c.author?.name || "—"}</Link> : ...}` は変更しない。

- [ ] **Step 3: テストを実行して通ることを確認する(挙動が変わっていないことの確認)**

Run: `cd dystopia/frontend && npx vitest run src/modules/post/components/CommentList.test.tsx`
Expected: PASS(Step 1 と同じ件数がgreen)

- [ ] **Step 4: コミット**

```bash
cd dystopia/frontend
git add src/modules/post/components/CommentList.tsx
git commit -s -m "refactor(dystopia/frontend): use Avatar.href for comment author link"
```

---

### Task 5: PostCard のアイコンリンクを Avatar.href に置き換え(重複解消)

**Files:**
- Modify: `dystopia/frontend/src/components/ui/post-card.tsx`
- 既存テスト(変更不要、回帰確認のみ): `dystopia/frontend/src/components/ui/post-card.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 既存テストが現状で通ることを確認する(回帰の基準点)**

Run: `cd dystopia/frontend && npx vitest run src/components/ui/post-card.test.tsx`
Expected: PASS(変更前の時点で全件green)

- [ ] **Step 2: 実装を変更する**

`dystopia/frontend/src/components/ui/post-card.tsx` 内、`avatar` 定義とそのレンダリング箇所を変更する。

変更前:
```tsx
  const avatar = <Avatar src={author.avatarSrc} fallback={author.name.slice(0, 1)} size="md" />;
  const nameAndHandle = (
```

変更後:
```tsx
  const avatar = <Avatar src={author.avatarSrc} fallback={author.name.slice(0, 1)} size="md" href={authorHref} />;
  const nameAndHandle = (
```

レンダリング側の変更前:
```tsx
        {authorHref ? <Link href={authorHref}>{avatar}</Link> : avatar}
        <div className="min-w-0 flex-1">
```

変更後:
```tsx
        {avatar}
        <div className="min-w-0 flex-1">
```

`nameAndHandle` 側の `{authorHref ? <Link href={authorHref}>{nameAndHandle}</Link> : nameAndHandle}` は変更しない。

- [ ] **Step 3: テストを実行して通ることを確認する(挙動が変わっていないことの確認)**

Run: `cd dystopia/frontend && npx vitest run src/components/ui/post-card.test.tsx`
Expected: PASS(Step 1 と同じ件数がgreen。ライトボックス関連のテストも含め全件)

- [ ] **Step 4: コミット**

```bash
cd dystopia/frontend
git add src/components/ui/post-card.tsx
git commit -s -m "refactor(dystopia/frontend): use Avatar.href for post card author link"
```

---

### Task 6: FootprintRow を Avatar.href + 個別Linkへ置き換え

**Files:**
- Modify: `dystopia/frontend/src/modules/footprints/components/FootprintRow.tsx`
- Test: `dystopia/frontend/src/modules/footprints/components/FootprintRow.test.tsx`(新規)

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/modules/footprints/components/FootprintRow.test.tsx` を新規作成する。

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FootprintRow } from "./FootprintRow";
import type { FootprintView } from "@/modules/footprints/types";

const footprint: FootprintView = {
  visitor: { accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: null },
  lastVisitedAt: new Date().toISOString(),
  isUnread: false,
  visitCount: 1,
};

describe("FootprintRow", () => {
  it("links the visitor's avatar and name to their profile as two separate links", () => {
    const html = renderToStaticMarkup(<FootprintRow footprint={footprint} />);
    const matches = html.match(/<a href="\/u\/yuna"/g) ?? [];

    expect(matches.length).toBe(2);
  });

  it("does not link when the visitor has no username", () => {
    const html = renderToStaticMarkup(
      <FootprintRow footprint={{ ...footprint, visitor: { ...footprint.visitor, username: "" } }} />
    );

    expect(html).not.toContain("<a ");
  });
});
```

既存実装は行全体(アイコン・名前・訪問時刻などすべて)を1つの `<Link>` で包んでいるため、`<a href="/u/yuna"` は1回しか出現しない。新実装ではアイコン用と名前用で別々の `<Link>`(`Avatar.href` と名前側の `Link`)になるため2回出現するようになる、という違いでRed/Greenを判定する。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && npx vitest run src/modules/footprints/components/FootprintRow.test.tsx`
Expected: 1件目が FAIL(`matches.length` が実際には `1`)。2件目は既存の `href="#"` フォールバックにより `<a href="#"` が出力されるため `not.toContain("<a ")` が FAIL する。

- [ ] **Step 3: 最小実装を書く**

`dystopia/frontend/src/modules/footprints/components/FootprintRow.tsx` を以下に置き換える。

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import type { FootprintView } from "@/modules/footprints/types";

export interface FootprintRowProps {
  footprint: FootprintView;
}

export function FootprintRow({ footprint }: FootprintRowProps) {
  const { visitor, lastVisitedAt, isUnread, visitCount } = footprint;
  const href = visitor.username ? `/u/${encodeURIComponent(visitor.username)}` : undefined;
  const nameAndHandle = (
    <>
      <p className="truncate font-bold text-text-primary">{visitor.displayName || "—"}</p>
      <p className="truncate text-sm text-text-secondary">@{visitor.username || "—"}</p>
    </>
  );

  return (
    <div className="flex items-center gap-3 border-b border-divider px-4 py-3 hover:bg-bg-surface/50">
      {isUnread && (
        <span aria-hidden="true" className="-ml-2 h-12 w-0.5 rounded-full bg-gradient-brand" />
      )}
      <Avatar
        src={visitor.avatarUrl || undefined}
        fallback={(visitor.displayName || "?").slice(0, 1)}
        size="md"
        href={href}
      />
      {href ? (
        <Link href={href} className="min-w-0 flex-1">
          {nameAndHandle}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{nameAndHandle}</div>
      )}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-text-muted">
          {lastVisitedAt ? formatTimeAgo(lastVisitedAt) : ""}
        </span>
        {visitCount > 1 && (
          <span className="text-xs text-text-secondary">{visitCount}回訪問</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && npx vitest run src/modules/footprints/components/FootprintRow.test.tsx`
Expected: PASS(2件とも)

- [ ] **Step 5: コミット**

```bash
cd dystopia/frontend
git add src/modules/footprints/components/FootprintRow.tsx src/modules/footprints/components/FootprintRow.test.tsx
git commit -s -m "refactor(dystopia/frontend): use Avatar.href for footprint row link"
```

---

### Task 7: SuggestedUsersPane を Avatar.href + 個別Linkへ置き換え

**Files:**
- Modify: `dystopia/frontend/src/components/shell/SuggestedUsersPane.tsx`
- Test: `dystopia/frontend/src/components/shell/SuggestedUsersPane.test.tsx`(新規)

**Interfaces:**
- Consumes: Task 1 の `Avatar` の `href?: string` prop
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/components/shell/SuggestedUsersPane.test.tsx` を新規作成する。

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hookMocks = vi.hoisted(() => ({
  useSuggestedUsers: vi.fn(),
}));

vi.mock("@/modules/discovery/hooks", () => ({
  useSuggestedUsers: hookMocks.useSuggestedUsers,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => null,
}));

const { SuggestedUsersPane } = await import("./SuggestedUsersPane");

describe("SuggestedUsersPane", () => {
  it("links each suggested user's avatar and name to their profile as two separate links", () => {
    hookMocks.useSuggestedUsers.mockReturnValue({
      profiles: [{ accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      loading: false,
    });

    const html = renderToStaticMarkup(<SuggestedUsersPane />);
    const matches = html.match(/<a href="\/u\/yuna"/g) ?? [];

    expect(matches.length).toBe(2);
  });
});
```

既存実装はアイコンと名前を1つの `<Link>` で包んでいるため、`<a href="/u/yuna"` は1回しか出現しない。新実装ではアイコン用(`Avatar.href`)と名前用の `Link` が分かれるため2回出現するようになる。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd dystopia/frontend && npx vitest run src/components/shell/SuggestedUsersPane.test.tsx`
Expected: FAIL(`matches.length` が実際には `1`)

- [ ] **Step 3: 実装を変更する**

`dystopia/frontend/src/components/shell/SuggestedUsersPane.tsx` を以下に置き換える。

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/modules/social";
import { useSuggestedUsers } from "@/modules/discovery/hooks";

export function SuggestedUsersPane() {
  const { profiles, loading } = useSuggestedUsers(10);

  if (!loading && profiles.length === 0) return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto px-4 py-4 xl:block">
      <h2 className="px-2 pb-2 text-base font-bold text-text-primary">おすすめユーザー</h2>
      <div className="rounded-2xl bg-surface">
        {loading && profiles.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-secondary">読み込み中…</p>
        )}
        {profiles.map((p) => {
          const href = `/u/${encodeURIComponent(p.username)}`;
          return (
            <div key={p.accountId} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" href={href} />
              <Link href={href} className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{p.displayName}</p>
                <p className="truncate text-xs text-text-secondary">@{p.username}</p>
              </Link>
              <FollowButton targetAccountId={p.accountId} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `cd dystopia/frontend && npx vitest run src/components/shell/SuggestedUsersPane.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd dystopia/frontend
git add src/components/shell/SuggestedUsersPane.tsx src/components/shell/SuggestedUsersPane.test.tsx
git commit -s -m "refactor(dystopia/frontend): use Avatar.href for suggested users pane link"
```

---

### Task 8: 型チェックとフロントエンド全体のテストで最終確認

**Files:**
- 変更なし(検証のみ)

**Interfaces:**
- Consumes: Task 1〜7 で変更した全ファイル
- Produces: なし

- [ ] **Step 1: 型チェックを実行する**

Run: `cd dystopia/frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: フロントエンドの全テストを実行する**

Run: `cd dystopia/frontend && npx vitest run`
Expected: 全件PASS(既存テストに回帰がないこと、Task 1〜7で追加したテストも含め全てgreenであること)

- [ ] **Step 3: 完了をユーザーに報告する**

ここまでのコミット一覧を `git log --oneline` で確認し、VERIFIED(実行コマンドと出力)付きでユーザーに報告する。PRを作成する場合は `superpowers:finishing-a-development-branch` の判断に従う。
