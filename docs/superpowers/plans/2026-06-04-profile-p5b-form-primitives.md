# Profile P5b: form primitives (Textarea / Select / Label / FormField) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** デザインシステム `src/components/ui/` に編集フォーム用のプリミティブ（`Textarea` / `Select` / `Label` / `FormField`）を追加し、`dev/ui` キッチンシンクで可視化する。

**Architecture:** **Additive**。既存コンポーネント（Button/Input/Toggle/Avatar 等）の cva・トークン・`forwardRef` パターンに合わせた新規プリミティブのみ追加。`Select` は依存追加を避け **styled native `<select>`**（`@radix-ui/react-select` は未導入）。これらは P5c の編集フォームが消費する。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind v4（design tokens）/ `cn`（clsx + tailwind-merge）。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`（§Frontend）。前提: P5a（data 層）完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない・PR 作らない**。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`。import alias `@/` → `src/`。
- **テストランナー無し**。検証は `pnpm exec tsc --noEmit`（各タスク）+ `pnpm build`（最終）。**依存追加禁止**（native select + inline SVG を使う。lucide 等を import しない）。
- **build-green / additive**: 既存 `src/components/ui/*` は触らない（新規追加のみ）。`dev/ui/page.tsx` のみ既存改変（セクション追記）。

### 既存パターン（踏襲する）

- `cn` は `@/lib/utils`（`import { cn } from "@/lib/utils"`）。
- **Input**: `forwardRef`、`cn("flex h-11 w-full rounded-md border border-border bg-input-bg px-4 text-base text-text-primary placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50", className)`。
- **トークン**（globals.css の `@theme`）: `bg-input-bg` / `border-border` / `text-text-primary` / `text-text-secondary` / `text-text-muted` / `text-error` / `ring-accent` / `border-accent` / `bg-surface`。
- コンポーネントは default export せず named export + `displayName`。

## File Structure

- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/form-field.tsx`
- Modify: `src/app/dev/ui/page.tsx`（Form primitives セクション追記）

---

## Task 1: Textarea / Label / Select / FormField を追加

**Files:** Create 4 component ファイル。

- [ ] **Step 1: `src/components/ui/textarea.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border bg-input-bg px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 2: `src/components/ui/label.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-text-secondary", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";
```

- [ ] **Step 3: `src/components/ui/select.tsx`**（styled native select + inline SVG chevron、依存追加なし）

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full appearance-none rounded-md border border-border bg-input-bg pl-4 pr-10 text-base text-text-primary focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
);
Select.displayName = "Select";
```

- [ ] **Step 4: `src/components/ui/form-field.tsx`**（label + 子 + error/hint レイアウト）

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規コンポーネントの型エラーなし。

---

## Task 2: dev/ui キッチンシンクで可視化 + 検証 + コミット

**Files:** Modify `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: import を追加**

`src/app/dev/ui/page.tsx` の import 群（`PostCard` import の下）に追加:

```tsx
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
```

- [ ] **Step 2: state を追加**

`DevUiPage` 関数内の既存 `useState` 群の下に追加:

```tsx
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("東京都");
```

- [ ] **Step 3: Form primitives セクションを追加**

`<main>` 内の最後の `</section>` の後（`</main>` の直前）に追加:

```tsx
      <section className="flex flex-col gap-4">
        <FormField label="表示名" htmlFor="dn" required hint="公開されます">
          <Input id="dn" placeholder="ゆな" />
        </FormField>
        <FormField label="自己紹介" htmlFor="bio" hint={`${bio.length}/160`}>
          <Textarea
            id="bio"
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="自己紹介を入力"
          />
        </FormField>
        <FormField label="都道府県" htmlFor="pref">
          <Select
            id="pref"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
          >
            <option value="東京都">東京都</option>
            <option value="大阪府">大阪府</option>
            <option value="福岡県">福岡県</option>
          </Select>
        </FormField>
        <FormField
          label="ユーザー名"
          htmlFor="un"
          error="このユーザー名は使用されています"
        >
          <Input id="un" placeholder="username" />
        </FormField>
      </section>
```

- [ ] **Step 4: ビルド検証**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -20`
Expected: 成功（型 + バンドル。`/dev/ui` がビルド出力に存在、型エラーなし）。

- [ ] **Step 5: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/components/ui/textarea.tsx src/components/ui/label.tsx src/components/ui/select.tsx src/components/ui/form-field.tsx src/app/dev/ui/page.tsx
git commit -s -m "feat(ui): add form primitives (Textarea, Select, Label, FormField)"
```
（push しない。可視確認はオーケストレータが dev サーバ + ブラウザで実施する。）

---

## Deferred（P5b では実施しない）

- **画像アップロード部品**（avatar / cover）= media サービスへのアップロード flow を伴うため **P5c**（編集ページで media flow と一緒に）。
- **エリア階層セレクタ**（地方→都道府県→エリア、最大2）= profile 固有の複合 UI なので **P5c**。
- **編集ページ `/profile/edit`** 本体 = **P5c**（rx-sns 準拠レイアウト、design + ブラウザ検証）。

## Self-Review（作成者チェック済）

- **Spec coverage（P5b 範囲）**: 編集フォームに必要な汎用プリミティブ（複数行テキスト=Textarea、単一選択=Select、ラベル/エラー/補助文=Label+FormField）を提供。char counter は FormField の hint で表現可能（bio 160 用）。
- **Additive で build-green**: 既存 ui コンポーネント無改変。`dev/ui/page.tsx` のみセクション追記。依存追加なし（native select + inline SVG）。
- **既存パターン整合**: `cn`・`forwardRef`・named export + `displayName`・トークン（`bg-input-bg`/`border-border`/`text-text-*`/`ring-accent`/`text-error`）を Input/Button に合わせた。
- **Placeholder 無し**: 4 component + dev/ui セクションすべて完全コード。
- **検証**: `tsc --noEmit` + `pnpm build`（型）。視覚確認は `/dev/ui` をブラウザで（オーケストレータ実施）。
