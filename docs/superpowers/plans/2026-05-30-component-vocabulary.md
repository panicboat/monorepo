# Phase 1a: Presentation Demolition + Component Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** presentation 層を破壊先行で一掃し、空のキャンバスに spec §6 のコンポーネント語彙（Button / Input / Tab / Toggle / Avatar / UserCard / PostCard）を greenfield 構築する。

**Architecture:** 旧ページ・旧 component・shell を dir ごと削除し、残す側（root layout / error / module index）の最小 fixup と placeholder home で build green を保つ。データ/ドメイン層（modules の hooks/lib/api・auth・stores）は domain spec まで保留で触らない。新コンポーネントは新 token のみ・role variant なしで `src/components/ui/` に構築。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Tailwind v4 / TypeScript / pnpm。CVA + `cn`（`@/lib/utils`）+ Radix（avatar/slot）。

**Spec:** `docs/superpowers/specs/2026-05-30-component-vocabulary-design.md`、語彙の設計は `2026-05-29-design-system-design.md` §6。

---

## Context for the implementer

- 作業ディレクトリは `services/frontend/workspace`。以降の相対パスはここ基準。
- test script は無い。検証は `pnpm build`（型チェック込み）＋ `pnpm dev` 目視。
- `cn` は `@/lib/utils`（保持）。CVA=`class-variance-authority`、Radix avatar=`@radix-ui/react-avatar`、slot=`@radix-ui/react-slot` は導入済み。**新 dep は追加しない**（Toggle/Tab は custom）。
- 破壊先行: アプリは本 plan 後「root layout + globals(Phase 0 token) + データ層 + placeholder home + 新 §6 component（`/dev/ui` でのみ可視）」になる。機能復帰は後続フェーズ。**この非機能状態は想定どおり**。
- **データ/ドメイン層は触らない**: `src/modules/*/{hooks,lib,types}`、`src/stores`、`src/hooks`、`src/lib`、`src/components/providers`、`src/app/api` は保持。

## File Structure

**Delete（presentation）:**
- `src/app/(cast)/`、`src/app/(guest)/`、`src/app/login/`、`src/app/storage/`
- `src/components/ui/`、`src/components/layout/`、`src/components/shared/`
- `src/modules/feed/components/`、`src/modules/identity/components/`、`src/modules/portfolio/components/`、`src/modules/post/components/`、`src/modules/trust/components/`

**Modify（残す側 fixup）:**
- `src/app/layout.tsx` — `ToastProvider` 配線除去
- `src/app/error.tsx` — `ErrorFallback` 参照を最小 error UI に置換
- `src/modules/post/index.ts`、`src/modules/feed/index.ts`、`src/modules/trust/index.ts` — `export * from "./components"` 行を除去

**Create:**
- `src/app/page.tsx` — placeholder home（`/`）
- `src/components/ui/button.tsx` / `input.tsx` / `tab.tsx` / `toggle.tsx` / `avatar.tsx` / `user-card.tsx` / `post-card.tsx`
- `src/app/dev/ui/page.tsx` — プレビュールート（`/dev/ui`）

---

## Task 1: Presentation demolition

**Files:** 上記 Delete 一式、Modify 一式、`src/app/page.tsx` 新規。

- [ ] **Step 1: presentation の dir を削除**

```bash
cd services/frontend/workspace
git rm -r "src/app/(cast)" "src/app/(guest)" src/app/login src/app/storage \
  src/components/ui src/components/layout src/components/shared \
  src/modules/feed/components src/modules/identity/components \
  src/modules/portfolio/components src/modules/post/components src/modules/trust/components
```

- [ ] **Step 2: root `layout.tsx` から ToastProvider 配線を除去**

`src/app/layout.tsx` の import 行 `import { ToastProvider } from "@/components/ui/Toast";` を削除し、JSX の `<ToastProvider>{children}</ToastProvider>` を `{children}` に置換する。結果の body 内ツリー:

```tsx
        <AuthProvider>
          <SWRProvider>{children}</SWRProvider>
        </AuthProvider>
```

`AuthProvider`（`@/modules/identity/hooks/useAuth`）と `SWRProvider`（`@/components/providers/SWRProvider`）の import はそのまま残す。

- [ ] **Step 3: `error.tsx` を最小 error UI に置換**

`src/app/error.tsx` を以下で全置換（削除した `ErrorFallback` 依存を除去、新 token 使用）:

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <p className="text-text-primary">エラーが発生しました</p>
      <button
        onClick={reset}
        className="rounded-full border border-accent px-4 py-2 text-accent"
      >
        再試行
      </button>
    </div>
  );
}
```

- [ ] **Step 4: module index の component 再 export を除去**

`src/modules/post/index.ts`、`src/modules/feed/index.ts`、`src/modules/trust/index.ts` から `export * from "./components";` の行を削除する（他の export 行は残す）。

- [ ] **Step 5: placeholder home を新設**

Create `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg p-6 text-center">
      <h1 className="text-2xl font-bold text-text-primary">Under construction</h1>
      <p className="text-text-secondary">再構築中です</p>
    </main>
  );
}
```

- [ ] **Step 6: build で残存参照を確認**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功。もし「Module not found: `@/components/ui|layout|shared` ...」等が出たら、それは想定外の keeper-side 参照。その import 元を開き、削除対象への参照を除去する（presentation なら削除、データ参照なら別 import に修正）。本 plan 既知の keeper 参照は Step 2-4 で網羅済み。

- [ ] **Step 7: Commit**

```bash
cd services/frontend/workspace
git add -A
git commit -s -m "feat(frontend): demolish legacy presentation layer (Phase 1a)"
```

---

## Task 2: spec §6 コンポーネント語彙を構築

**Files:** `src/components/ui/{button,input,tab,toggle,avatar,user-card,post-card}.tsx` を新規作成。

- [ ] **Step 1: Button（CTA）**

Create `src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-brand text-white shadow-brand-glow rounded-full hover:opacity-90",
        secondary:
          "border border-accent text-accent rounded-full hover:bg-accent/10",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
```

- [ ] **Step 2: Input**

Create `src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md border border-transparent bg-input-bg px-4 text-base text-text-primary placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

- [ ] **Step 3: Tab（下線 + active gradient line）**

Create `src/components/ui/tab.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex border-b border-divider", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Toggle（角丸ピル、on = accent）**

Create `src/components/ui/toggle.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-neutral-700",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
```

- [ ] **Step 5: Avatar（Radix）**

Create `src/components/ui/avatar.tsx`:

```tsx
"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  return (
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
}
```

- [ ] **Step 6: UserCard**

Create `src/components/ui/user-card.tsx`:

```tsx
import * as React from "react";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface UserCardProps {
  name: string;
  handle: string;
  avatarSrc?: string;
  following?: boolean;
  onFollow?: () => void;
  className?: string;
}

export function UserCard({
  name,
  handle,
  avatarSrc,
  following,
  onFollow,
  className,
}: UserCardProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar src={avatarSrc} fallback={name.slice(0, 1)} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{name}</p>
        <p className="truncate text-sm text-text-secondary">@{handle}</p>
      </div>
      {onFollow && (
        <Button
          variant={following ? "secondary" : "primary"}
          size="sm"
          onClick={onFollow}
        >
          {following ? "フォロー中" : "フォロー"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: PostCard**

Create `src/components/ui/post-card.tsx`:

```tsx
import * as React from "react";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";

export interface PostCardProps {
  author: { name: string; handle: string; avatarSrc?: string };
  time: string;
  body: string;
  images?: string[];
  reactions?: React.ReactNode;
  className?: string;
}

export function PostCard({
  author,
  time,
  body,
  images,
  reactions,
  className,
}: PostCardProps) {
  return (
    <article className={cn("border-b border-divider px-4 py-3", className)}>
      <div className="flex gap-3">
        <Avatar src={author.avatarSrc} fallback={author.name.slice(0, 1)} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold text-text-primary">{author.name}</span>
            <span className="text-text-secondary">@{author.handle}</span>
            <span className="text-text-muted">· {time}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
          {images && images.length > 0 && (
            <div
              className={cn(
                "mt-2 grid gap-1 overflow-hidden rounded-md",
                images.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {images.slice(0, 4).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              ))}
            </div>
          )}
          {reactions && (
            <div className="mt-3 flex items-center gap-6 text-text-secondary">
              {reactions}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 8: build と型チェック**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功（型エラー・未解決 import なし）。

- [ ] **Step 9: Commit**

```bash
cd services/frontend/workspace
git add src/components/ui
git commit -s -m "feat(frontend): add design-system component vocabulary (spec §6)"
```

---

## Task 3: プレビュールートで検証

**Files:** Create `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: プレビューページを作成**

Create `src/app/dev/ui/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tab";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/ui/avatar";
import { UserCard } from "@/components/ui/user-card";
import { PostCard } from "@/components/ui/post-card";

export default function DevUiPage() {
  const [tab, setTab] = useState("home");
  const [on, setOn] = useState(false);
  const [following, setFollowing] = useState(false);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section className="flex flex-wrap items-center gap-3">
        <Button variant="primary">投稿する</Button>
        <Button variant="secondary">フォロー</Button>
        <Button variant="primary" size="sm">
          sm
        </Button>
        <Button variant="primary" disabled>
          disabled
        </Button>
      </section>

      <section>
        <Input placeholder="検索" />
      </section>

      <section>
        <Tabs
          items={[
            { id: "home", label: "ホーム" },
            { id: "trend", label: "トレンド" },
            { id: "new", label: "新着" },
          ]}
          value={tab}
          onValueChange={setTab}
        />
      </section>

      <section className="flex items-center gap-4">
        <Toggle checked={on} onCheckedChange={setOn} aria-label="toggle" />
        <Avatar fallback="A" size="sm" />
        <Avatar fallback="B" size="md" />
        <Avatar fallback="C" size="lg" />
      </section>

      <section>
        <UserCard
          name="さくら"
          handle="sakura"
          following={following}
          onFollow={() => setFollowing((v) => !v)}
        />
      </section>

      <section>
        <PostCard
          author={{ name: "さくら", handle: "sakura" }}
          time="3分前"
          body={"はじめての投稿です。\nよろしくお願いします。"}
          reactions={<span className="text-sm">♥ 12 · 💬 3</span>}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: build**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功。

- [ ] **Step 3: dev で目視**

Run: `cd services/frontend/workspace && pnpm dev`
ブラウザで `http://localhost:3000/dev/ui` を開き確認:
- Button primary が紫→ピンクの gradient pill + glow、secondary が accent ボーダーピル。
- Input が input-bg fill + focus 時 accent ring。
- Tabs の active 下に gradient ライン。
- Toggle が on で accent。
- Avatar が円形・fallback 文字表示。
- UserCard のフォローボタンが押下で primary↔secondary 切替。
- PostCard が divider 区切り・本文・反応行表示。
確認後、dev を停止する。

- [ ] **Step 4: Commit**

```bash
cd services/frontend/workspace
git add src/app/dev
git commit -s -m "feat(frontend): add /dev/ui component preview"
```

---

## Deferred（本 plan では実施しない）

- modal / select / toast 等の汎用 primitive → JIT（1b / Phase 2 で必要時）。
- shell / nav / 各ページ・ルート再編・role トグル → 1b / Phase 2（domain/IA spec 後）。
- データ/ドメイン層（modules の hooks/lib/api・auth・stores）の再編 → domain/IA spec 後。
- プレビュールート `/dev/ui` は一時面。shell/pages 整備後に削除可。

## Self-Review（作成者チェック済）

- **Spec coverage**: demolition（Part1 → Task1）、§6 の 7 component（Part2 → Task2 Step1-7）、プレビュー検証（Task3）を網羅。
- **keeper fixup の網羅**: 削除対象を import する keeper は `layout.tsx`・`error.tsx` の 2 件のみ（grep 済）＋ module index 3 件の `export * from "./components"`。Task1 Step2-4 で対応。Step6 で残存を build 検出。
- **型・命名整合**: Button の variant=`primary|secondary`/size=`sm|md` を UserCard が参照。Avatar の props（`fallback` 必須、`size`）を UserCard/PostCard が一致して使用。Tabs/Toggle の props 名も preview と一致。
- **新 dep なし**: Toggle/Tab は custom、Avatar/Button は導入済み Radix。`cn` は保持された `@/lib/utils`。
- **token 整合**: `bg-gradient-brand` / `shadow-brand-glow` / `bg-input-bg` / `bg-accent` / `bg-neutral-700` / `border-divider` / `text-text-*` は Phase 0 globals に存在（PR #645）。
- **Placeholder**: なし。
