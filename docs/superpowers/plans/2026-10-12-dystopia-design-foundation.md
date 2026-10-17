# Dystopia Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モックの配色・右から入るシート・ルート変更時のフェードを、バックエンドとの連携を変えずに frontend の土台として導入する。

**Architecture:** 既存のセマンティックトークンの値を差し替えるので、画面側のクラス名は変わらない。動きは 2 つの部品で提供する。`SideSheet`（Radix Dialog + CSS アニメーション + 履歴連携）と `useEnterAnimation`（Web Animations API、再マウントなし）。作成ボタンから開く 2 つのモーダルを `SideSheet` に載せ替える。

**Tech Stack:** Next.js 16.4 (App Router) / React 19.3 / Tailwind CSS 4.3 (`@theme inline`) / `@radix-ui/react-dialog` 1.2 / vitest 5 + happy-dom 20

**Spec:** `docs/superpowers/specs/2026-10-12-dystopia-design-foundation-design.md`

## Global Constraints

- 作業ディレクトリは worktree の `dystopia/frontend`。すべてのコマンドをここで実行する
- `dystopia/frontend/src/app/api`、`dystopia/frontend/src/stub`、`proto`、`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容（URL・method・body）を変更しない
- モバイルの FAB（`ComposeLauncher` の `fab` variant）は見た目も動作も変更しない。`FlowerMenu` を変更しない
- ドロワー、プロフィール切り替え、未読バッジ、`resolveNavItems`、`BottomTab` の `sticky` 配置、`resolveShellLayout` を変更しない
- ブレークポイントは `md`・`xl` のままにする
- 依存を追加しない。削除するのは `motion` だけ
- トークンの値は spec の表のとおりに書く（下の各 Task に転記済み）
- UI の文言は次のとおりにする: `作成する`、`前に戻る`、`閉じる`
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけを書く。タスクや修正への言及を書かない
- コマンドは `env -u NODE_OPTIONS` を付けて実行する（例: `env -u NODE_OPTIONS pnpm exec vitest run <path>`）
- コミットは `git commit -s` で行う。`Co-Authored-By` を付けない。メッセージは英語
- テストは既存の流儀に合わせる。DOM を使うテストはファイル先頭に `// @vitest-environment happy-dom` を書き、`createRoot` + `act` で描画する。testing-library は使わない
- 各 Task の完了前に、追加したコメントを上の規約と突き合わせ、満たさないものを削除する

## Review Focus

- ブラウザの「戻る」でシートを閉じたとき、ページが再読み込みされず URL も変わらない（Task 3 の URL 不変のテスト、Task 9 の実機確認）
- シートを開いたまま別ルートへ移ったとき、シートは閉じ、履歴を戻して遷移を取り消さない（Task 4 のルート変更テスト、Task 3 の置き換え済みエントリのテスト）
- すでに開いているスレッドの相手を作成メニューから選んだとき、シートがその場で閉じる（Task 8）
- メッセージの開始に失敗したとき、シートは開いたまま理由を表示し、遷移しない（Task 7 の失敗テスト、Task 8 のエラー表示テスト）
- OS の動き軽減が有効なとき、フェードを再生せず、duration トークンが 0 になる（Task 1・Task 2）

---

## File Structure

| ファイル | 責務 | Task |
|---|---|---|
| `src/app/globals.css` | 色・動きのトークン、シートのアニメーション | 1, 4 |
| `src/app/globals.tokens.test.ts`（新規） | トークンの値を固定する | 1 |
| `src/app/layout.tsx` | ブラウザのステータスバー色 | 1 |
| `src/lib/motion/useEnterAnimation.ts`（新規） | キーが変わったときの入場アニメーション | 2 |
| `src/lib/motion/{variants,hooks,index}.ts` | 削除 | 2 |
| `src/components/ui/useBackDismiss.ts`（新規） | 「戻る」で閉じるための履歴エントリ管理 | 3 |
| `src/components/ui/side-sheet.tsx`（新規） | 右から入るシート | 4 |
| `src/components/ui/{button,tab,page-header,toggle,rating-stars,ToastHost}.tsx` | 見た目 | 5 |
| `src/components/shell/{AppShell,SideNav,TopBar,BottomTab,SuggestedUsersPane}.tsx` | シェルの見た目とルートのフェード | 6 |
| `src/modules/messaging/hooks/useStartChat.ts` | 遷移方法の選択と遷移先パスの返却 | 7 |
| `src/modules/post/components/PostComposerSheet.tsx`（改名） | 投稿作成シート | 8 |
| `src/components/compose/ComposeToSheet.tsx`（改名） | 宛先を選んで書くシート | 8 |
| `src/components/compose/ComposeLauncher.tsx` | 開閉状態の保持、PC ボタンの文言 | 8 |

パスはすべて `dystopia/frontend/` からの相対。

---

### Task 1: Design tokens

**Files:**
- Modify: `src/app/globals.css:1-121`
- Modify: `src/app/layout.tsx:20-23`
- Test: `src/app/globals.tokens.test.ts`（新規。既存の `src/app/globals.test.ts` は文字サイズのテストなので変更しない）

**Interfaces:**
- Consumes: なし
- Produces: CSS 変数 `--color-backdrop` `--color-bg-elevated` `--color-rating` `--color-brand-gradient-from` `--color-brand-gradient-to` `--duration-slide` `--duration-fade` `--duration-quick` `--ease-emphasized`。Tailwind ユーティリティ `bg-backdrop` `bg-bg-elevated` `text-rating`

- [ ] **Step 1: 依存を導入する**

Run: `env -u NODE_OPTIONS pnpm install --frozen-lockfile --prefer-offline`
Expected: `Lockfile is up to date` を含み、エラーなく終わる

- [ ] **Step 2: 失敗するテストを書く**

`src/app/globals.tokens.test.ts` を作成する。

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

function declarations(source: string, opener: string): Record<string, string> {
  const start = source.indexOf(opener);
  if (start < 0) throw new Error(`${opener} is missing`);
  const body = source.slice(start + opener.length, source.indexOf("}", start));
  return Object.fromEntries(
    Array.from(body.matchAll(/(--[\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2].replace(/\s+/g, " ").trim()])
  );
}

const dark = declarations(css, ":root {");
const light = declarations(css, '[data-theme="light"] {');
const reducedMotion = declarations(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), ":root {");
const theme = declarations(css, "@theme inline {");

describe("design tokens", () => {
  it("paints the dark theme with the mock's surfaces, rules and text", () => {
    expect(dark).toMatchObject({
      "--color-backdrop": "#090a0e",
      "--color-bg": "#13151b",
      "--color-bg-elevated": "#181a21",
      "--color-surface": "#1b1e27",
      "--color-bg-secondary": "#20232b",
      "--color-input-bg": "#2b2c30",
      "--color-border": "#303744",
      "--color-divider": "#28313e",
      "--color-text-primary": "#f6f4f8",
      "--color-text-secondary": "#a4b1c5",
      "--color-text-muted": "#8390a5",
      "--color-rating": "#eab270",
    });
  });

  it("draws the brand from the mock's violet and pink", () => {
    expect(dark).toMatchObject({
      "--color-brand-primary": "#b54bf1",
      "--color-brand-secondary": "#e344ae",
      "--color-brand-gradient-from": "#a345ed",
      "--color-brand-gradient-to": "#e448a8",
      "--color-accent": "var(--color-brand-primary)",
      "--gradient-brand-2": "linear-gradient(110deg, var(--color-brand-gradient-from), var(--color-brand-gradient-to))",
      "--shadow-brand-glow": "0 7px 21px rgb(168 44 146 / 0.27)",
    });
  });

  it("keeps the light theme's own surfaces and gives it the added tokens", () => {
    expect(light).toMatchObject({
      "--color-bg": "#ffffff",
      "--color-backdrop": "var(--color-neutral-50)",
      "--color-bg-elevated": "#ffffff",
      "--color-rating": "var(--color-warning)",
    });
    expect(light).not.toHaveProperty("--color-brand-primary");
  });

  it("exposes the added colors as utilities and keeps form controls at a 12px corner", () => {
    expect(theme).toMatchObject({
      "--color-backdrop": "var(--color-backdrop)",
      "--color-bg-elevated": "var(--color-bg-elevated)",
      "--color-rating": "var(--color-rating)",
      "--radius-md": "0.75rem",
    });
  });

  it("times motion from three durations and removes them for reduced motion", () => {
    expect(dark).toMatchObject({
      "--duration-slide": "330ms",
      "--duration-fade": "200ms",
      "--duration-quick": "170ms",
      "--ease-emphasized": "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    expect(reducedMotion).toEqual({
      "--duration-slide": "0ms",
      "--duration-fade": "0ms",
      "--duration-quick": "0ms",
    });
  });

  it("carries no token without a consumer", () => {
    expect(css).not.toMatch(/brand-tertiary|gradient-brand-3|neutral-(600|700|800|950)/);
  });

  it("colors the browser chrome like the dark app surface", () => {
    expect(layout).toContain(`{ media: "(prefers-color-scheme: dark)", color: "${dark["--color-bg"]}" }`);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/globals.tokens.test.ts`
Expected: FAIL。最初の失敗は `--color-backdrop` が存在しないこと

- [ ] **Step 4: トークンを書き換える**

`src/app/globals.css` の 1 行目から `.shadow-brand-glow { ... }` の閉じ括弧（現在の 121 行目付近）までを、次の内容に置き換える。それより後ろ（`body` 以降）は変更しない。

```css
@import "tailwindcss";

:root {
  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-900: #0f172a;

  --color-brand-primary: #b54bf1;
  --color-brand-secondary: #e344ae;
  --color-brand-gradient-from: #a345ed;
  --color-brand-gradient-to: #e448a8;

  --color-input-bg: #2b2c30;
  --color-success-bg: #166534;
  --color-success-text: #4ade80;

  /* TODO: Replace interim status colors when the design specification is finalized. */
  --color-error: #f87171;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;

  --color-rating: #eab270;

  --color-backdrop: #090a0e;
  --color-bg: #13151b;
  --color-bg-elevated: #181a21;
  --color-bg-secondary: #20232b;
  --color-surface: #1b1e27;
  --color-divider: #28313e;
  --color-border: #303744;
  --color-text-primary: #f6f4f8;
  --color-text-secondary: #a4b1c5;
  --color-text-muted: #8390a5;
  --color-accent: var(--color-brand-primary);

  --gradient-brand-2: linear-gradient(110deg, var(--color-brand-gradient-from), var(--color-brand-gradient-to));
  --shadow-brand-glow: 0 7px 21px rgb(168 44 146 / 0.27);

  --duration-slide: 330ms;
  --duration-fade: 200ms;
  --duration-quick: 170ms;
  --ease-emphasized: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-slide: 0ms;
    --duration-fade: 0ms;
    --duration-quick: 0ms;
  }
}

[data-theme="light"] {
  --color-backdrop: var(--color-neutral-50);
  --color-bg: #ffffff;
  --color-bg-elevated: #ffffff;
  --color-surface: var(--color-neutral-100);
  --color-bg-secondary: var(--color-neutral-200);
  --color-divider: var(--color-neutral-200);
  --color-border: var(--color-neutral-300);
  --color-text-primary: var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-500);
  --color-text-muted: var(--color-neutral-400);
  --color-input-bg: var(--color-neutral-100);
  /* Keep the light-theme error color dark enough for AA contrast on white surfaces. */
  --color-error: #dc2626;
  --color-rating: var(--color-warning);
}

html {
  font-size: 100%;
}

@theme inline {
  --font-sans: var(--font-noto-sans-jp), "Segoe UI", Meiryo, sans-serif;

  --color-neutral-50: var(--color-neutral-50);
  --color-neutral-100: var(--color-neutral-100);
  --color-neutral-200: var(--color-neutral-200);
  --color-neutral-300: var(--color-neutral-300);
  --color-neutral-400: var(--color-neutral-400);
  --color-neutral-500: var(--color-neutral-500);
  --color-neutral-900: var(--color-neutral-900);

  --color-brand-primary: var(--color-brand-primary);
  --color-brand-secondary: var(--color-brand-secondary);

  --color-input-bg: var(--color-input-bg);
  --color-success-bg: var(--color-success-bg);
  --color-success-text: var(--color-success-text);

  --color-error: var(--color-error);
  --color-warning: var(--color-warning);
  --color-info: var(--color-info);

  --color-rating: var(--color-rating);

  --color-backdrop: var(--color-backdrop);
  --color-bg: var(--color-bg);
  --color-bg-elevated: var(--color-bg-elevated);
  --color-bg-secondary: var(--color-bg-secondary);
  --color-surface: var(--color-surface);
  --color-divider: var(--color-divider);
  --color-border: var(--color-border);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-accent: var(--color-accent);

  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-full: 9999px;
}

.bg-gradient-brand {
  background-image: var(--gradient-brand-2);
}

.shadow-brand-glow {
  box-shadow: var(--shadow-brand-glow);
}
```

`body` の `background: var(--color-bg);` は変更しない。シェルを持たないページ（ログインなど）の面を保つため。

- [ ] **Step 5: ステータスバー色を変える**

`src/app/layout.tsx` の `viewport.themeColor` のダークの行を次にする。

```ts
    { media: "(prefers-color-scheme: dark)", color: "#13151b" },
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/globals.tokens.test.ts`
Expected: PASS（7 tests）

- [ ] **Step 7: 削除したトークンの利用箇所がないことを確認する**

Run: `/usr/bin/grep -rnE --exclude='*.test.ts' 'brand-tertiary|gradient-brand-3|neutral-(600|700|800|950)' src`
Expected: 出力なし（終了コード 1）

- [ ] **Step 8: コミットする**

```bash
git add src/app/globals.css src/app/globals.tokens.test.ts src/app/layout.tsx
git commit -s -m "refactor(dystopia/frontend): take the dark palette and motion timings from the mock"
```

---

### Task 2: Route fade hook

**Files:**
- Create: `src/lib/motion/useEnterAnimation.ts`
- Test: `src/lib/motion/useEnterAnimation.test.ts`（新規）
- Delete: `src/lib/motion/variants.ts`, `src/lib/motion/hooks.ts`, `src/lib/motion/index.ts`
- Modify: `package.json`, `pnpm-lock.yaml`（`motion` の削除）

**Interfaces:**
- Consumes: CSS 変数 `--duration-fade`（Task 1）
- Produces: `useEnterAnimation(ref: RefObject<HTMLElement | null>, key: string): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/motion/useEnterAnimation.test.ts` を作成する。

```ts
// @vitest-environment happy-dom
import { act, createElement, useRef, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { useEnterAnimation } from "./useEnterAnimation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Page({ route, fade }: { route: string; fade: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterAnimation(ref, route);
  return createElement("div", { ref, style: { "--duration-fade": fade } as CSSProperties });
}

let root: Root;
let container: HTMLElement;
let animate: MockInstance;

const show = (route: string, fade: string) => act(async () => root.render(createElement(Page, { route, fade })));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  animate = vi.spyOn(Element.prototype, "animate").mockReturnValue({} as Animation);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  animate.mockRestore();
});

describe("useEnterAnimation", () => {
  it("stays still on the first render", async () => {
    await show("/", "200ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("fades the element in when the key changes, for the length of the fade token", async () => {
    await show("/", "200ms");
    await show("/search", "200ms");

    expect(animate.mock.calls).toEqual([
      [
        [
          { opacity: 0.55, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 200, easing: "ease" },
      ],
    ]);
  });

  it("stays still while the key is unchanged", async () => {
    await show("/", "200ms");
    await show("/", "200ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still when the fade token is zero, as under reduced motion", async () => {
    await show("/", "0ms");
    await show("/search", "0ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("reads a fade token written in seconds", async () => {
    await show("/", "0.2s");
    await show("/search", "0.2s");

    expect(animate.mock.calls[0][1]).toEqual({ duration: 200, easing: "ease" });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/motion/useEnterAnimation.test.ts`
Expected: FAIL（`./useEnterAnimation` を解決できない）

- [ ] **Step 3: hook を実装する**

`src/lib/motion/useEnterAnimation.ts` を作成する。

```ts
"use client";

import { useEffect, useRef, type RefObject } from "react";

const ENTER_KEYFRAMES: Keyframe[] = [
  { opacity: 0.55, transform: "translateY(5px)" },
  { opacity: 1, transform: "translateY(0)" },
];

function fadeDurationMs(element: HTMLElement): number {
  const value = getComputedStyle(element).getPropertyValue("--duration-fade").trim();
  const amount = Number.parseFloat(value);
  if (Number.isNaN(amount)) return 0;
  return value.endsWith("ms") ? amount : amount * 1000;
}

export function useEnterAnimation(ref: RefObject<HTMLElement | null>, key: string): void {
  const shownKey = useRef(key);

  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    const element = ref.current;
    if (!element) return;
    // Read the length from the token so the reduced-motion override in CSS also silences this animation.
    const duration = fadeDurationMs(element);
    if (duration === 0) return;
    element.animate(ENTER_KEYFRAMES, { duration, easing: "ease" });
  }, [ref, key]);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/motion/useEnterAnimation.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: 利用箇所のない動きの定義を削除する**

```bash
git rm src/lib/motion/variants.ts src/lib/motion/hooks.ts src/lib/motion/index.ts
```

Run: `/usr/bin/grep -rnE 'from "motion|lib/motion"' src | /usr/bin/grep -v useEnterAnimation`
Expected: 出力なし

- [ ] **Step 6: `motion` を依存から外す**

Run: `env -u NODE_OPTIONS pnpm remove motion && env -u NODE_OPTIONS pnpm install --frozen-lockfile`
Expected: `package.json` から `"motion"` の行が消え、2 つ目のコマンドが `Lockfile is up to date` で終わる

- [ ] **Step 7: 型検査が通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit`
Expected: 出力なし（終了コード 0）

- [ ] **Step 8: コミットする**

```bash
git add src/lib/motion package.json pnpm-lock.yaml
git commit -s -m "refactor(dystopia/frontend): fade content in on a key change without remounting it"
```

---

### Task 3: Back dismissal

**Files:**
- Create: `src/components/ui/useBackDismiss.ts`
- Test: `src/components/ui/useBackDismiss.test.ts`（新規）

**Interfaces:**
- Consumes: なし
- Produces: `useBackDismiss(open: boolean, onDismiss: () => void): void`。開いている間は `history.state.sideSheet` に数値の印を持つ履歴エントリを 1 つ保持する

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/useBackDismiss.test.ts` を作成する。

```ts
// @vitest-environment happy-dom
import { StrictMode, act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackDismiss } from "./useBackDismiss";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Sheet({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  useBackDismiss(open, onDismiss);
  return null;
}

const mounted: { root: Root; container: HTMLElement }[] = [];

async function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(element));
  return { rerender: (next: ReactElement) => act(async () => root.render(next)) };
}

const popped = () => new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const marker = () => (window.history.state as { sideSheet?: number } | null)?.sideSheet;

afterEach(async () => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!;
    await act(async () => root.unmount());
    container.remove();
  }
});

describe("useBackDismiss", () => {
  it("adds one history entry while open and keeps the URL", async () => {
    const entries = window.history.length;
    const href = window.location.href;

    await render(createElement(Sheet, { open: true, onDismiss: vi.fn() }));

    expect(window.history.length).toBe(entries + 1);
    expect(marker()).toBeTypeOf("number");
    expect(window.location.href).toBe(href);
  });

  it("adds a single entry and stays open when effects run twice", async () => {
    const entries = window.history.length;
    const onDismiss = vi.fn();

    await render(createElement(StrictMode, null, createElement(Sheet, { open: true, onDismiss })));
    await settle();

    expect(window.history.length).toBe(entries + 1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses when the user goes back", async () => {
    const onDismiss = vi.fn();
    await render(createElement(Sheet, { open: true, onDismiss }));

    const back = popped();
    window.history.back();
    await act(async () => back);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("takes its entry off the history when closed from the UI, without dismissing again", async () => {
    const onDismiss = vi.fn();
    const view = await render(createElement(Sheet, { open: true, onDismiss }));
    const own = marker();

    const back = popped();
    await view.rerender(createElement(Sheet, { open: false, onDismiss }));
    await act(async () => back);

    expect(marker()).not.toBe(own);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("leaves the history alone when a navigation replaced its entry", async () => {
    const view = await render(createElement(Sheet, { open: true, onDismiss: vi.fn() }));
    window.history.replaceState({ replaced: true }, "");
    const back = vi.spyOn(window.history, "back");

    await view.rerender(createElement(Sheet, { open: false, onDismiss: vi.fn() }));

    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("leaves the history alone when it was never opened", async () => {
    const back = vi.spyOn(window.history, "back");

    await render(createElement(Sheet, { open: false, onDismiss: vi.fn() }));

    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui/useBackDismiss.test.ts`
Expected: FAIL（`./useBackDismiss` を解決できない）

- [ ] **Step 3: hook を実装する**

`src/components/ui/useBackDismiss.ts` を作成する。

```ts
"use client";

import { useEffect, useRef } from "react";

const STATE_KEY = "sideSheet";

let lastEntry = 0;

function currentEntry(): unknown {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null ? (state as Record<string, unknown>)[STATE_KEY] : undefined;
}

export function useBackDismiss(open: boolean, onDismiss: () => void): void {
  const entry = useRef<number | null>(null);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) {
      // Go back only while the entry is still current: after a navigation replaced it, going back would undo that navigation.
      if (entry.current !== null && currentEntry() === entry.current) window.history.back();
      entry.current = null;
      return;
    }
    // Keep the entry across an effect re-run: pushing again would leave a second entry behind the sheet.
    if (entry.current === null) {
      entry.current = ++lastEntry;
      window.history.pushState({ [STATE_KEY]: entry.current }, "");
    }
    const onPopState = () => {
      entry.current = null;
      dismiss.current();
    };
    window.addEventListener("popstate", onPopState);
    // Leave the history alone on cleanup: going back here would close the sheet when StrictMode re-runs the effect.
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui/useBackDismiss.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Next.js が独自の `state` を保つことを確認する**

Run: `/usr/bin/grep -nE 'copyNextJsInternalHistoryState|useInsertionEffect' node_modules/next/dist/client/components/app-router.js | head -6`
Expected: `copyNextJsInternalHistoryState` が `pushState` と `replaceState` の差し替えの中で呼ばれており、`HistoryUpdater` が `useInsertionEffect` を使っている。どちらかが見つからない場合は実装を進めず、その旨を報告する

- [ ] **Step 6: コミットする**

```bash
git add src/components/ui/useBackDismiss.ts src/components/ui/useBackDismiss.test.ts
git commit -s -m "feat(dystopia/frontend): close an overlay with the browser's back action"
```

---

### Task 4: SideSheet

**Files:**
- Create: `src/components/ui/side-sheet.tsx`
- Test: `src/components/ui/side-sheet.test.tsx`（新規）
- Modify: `src/app/globals.css`（`@theme inline` の末尾と、その直後）

**Interfaces:**
- Consumes: `useBackDismiss(open, onDismiss)`（Task 3）、`bg-bg-elevated` と duration トークン（Task 1）
- Produces:

```ts
export interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onBack?: () => void;
  stepKey?: string;
  children: React.ReactNode;
}
export function SideSheet(props: SideSheetProps): JSX.Element;
```

利用側は `SideSheet` を mount したまま `open` を切り替える。戻るボタンの `aria-label` は `前に戻る`、閉じるボタンは `閉じる`。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/side-sheet.test.tsx` を作成する。

```tsx
// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const { SideSheet } = await import("./side-sheet");

type Props = Parameters<typeof SideSheet>[0];

const sheet = (props: Partial<Props> & Pick<Props, "onOpenChange">) =>
  createElement(SideSheet, { open: true, title: "カルテを作成", children: createElement("p", null, "本文"), ...props });

const mounted: { root: Root; container: HTMLElement }[] = [];

async function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(element));
  return { rerender: (next: ReactElement) => act(async () => root.render(next)) };
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const button = (label: string) => document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

afterEach(async () => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!;
    await act(async () => root.unmount());
    container.remove();
  }
  navigation.pathname = "/";
});

describe("SideSheet", () => {
  it("shows the title and the content while open", async () => {
    await render(sheet({ onOpenChange: vi.fn() }));

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("カルテを作成");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("本文");
  });

  it("shows nothing while closed", async () => {
    await render(sheet({ onOpenChange: vi.fn(), open: false }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("asks to close from the close button", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));

    await act(async () => button("閉じる")!.click());

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("asks to close on Escape", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("asks to close when the page behind it is pressed", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));
    await settle();
    const overlay = document.querySelector("[data-sheet-overlay]") as HTMLElement;

    await act(async () => {
      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      overlay.click();
    });
    await settle();

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("offers a back button only when a step can be undone", async () => {
    const onBack = vi.fn();
    const view = await render(sheet({ onOpenChange: vi.fn() }));
    expect(button("前に戻る")).toBeNull();

    await view.rerender(sheet({ onOpenChange: vi.fn(), onBack }));
    await act(async () => button("前に戻る")!.click());

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("asks to close when the route changes under it", async () => {
    const onOpenChange = vi.fn();
    const view = await render(sheet({ onOpenChange }));

    navigation.pathname = "/messages/thread-1";
    await view.rerender(sheet({ onOpenChange }));

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("returns focus to the element that had it before opening", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const view = await render(sheet({ onOpenChange: vi.fn() }));
    await settle();

    await view.rerender(sheet({ onOpenChange: vi.fn(), open: false }));
    await settle();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("scrolls long content inside the sheet", async () => {
    await render(sheet({ onOpenChange: vi.fn() }));

    const body = document.querySelector("[data-sheet-body]")!.className.split(/\s+/);

    expect(body).toEqual(expect.arrayContaining(["min-h-0", "flex-1", "overflow-y-auto"]));
  });

  it("brings the content in again when the step changes", async () => {
    const view = await render(sheet({ onOpenChange: vi.fn(), stepKey: "pick" }));
    const first = document.querySelector(".animate-sheet-step");

    await view.rerender(sheet({ onOpenChange: vi.fn(), stepKey: "compose" }));

    expect(document.querySelector(".animate-sheet-step")).not.toBe(first);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui/side-sheet.test.tsx`
Expected: FAIL（`./side-sheet` を解決できない）

- [ ] **Step 3: アニメーションを定義する**

`src/app/globals.css` の `@theme inline { ... }` の中、`--radius-full: 9999px;` の次の行に追加する。

```css

  --animate-sheet-in: sheet-in var(--duration-slide) var(--ease-emphasized) both;
  --animate-sheet-out: sheet-out var(--duration-slide) var(--ease-emphasized) both;
  --animate-overlay-in: overlay-in var(--duration-fade) ease both;
  --animate-overlay-out: overlay-out var(--duration-fade) ease both;
  --animate-sheet-step: sheet-step var(--duration-fade) var(--ease-emphasized) both;
```

`@theme inline { ... }` の閉じ括弧の直後に追加する。

```css

@keyframes sheet-in {
  from {
    transform: translateX(103%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes sheet-out {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(103%);
  }
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes overlay-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes sheet-step {
  from {
    opacity: 0.4;
    transform: translateX(13px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

- [ ] **Step 4: `SideSheet` を実装する**

`src/components/ui/side-sheet.tsx` を作成する。

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { useBackDismiss } from "./useBackDismiss";

export interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onBack?: () => void;
  stepKey?: string;
  children: React.ReactNode;
}

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-bg-secondary hover:text-text-primary";

export function SideSheet({ open, onOpenChange, title, onBack, stepKey, children }: SideSheetProps) {
  const pathname = usePathname();
  const openedOn = useRef(pathname);
  const opener = useRef<HTMLElement | null>(null);

  useBackDismiss(open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) {
      openedOn.current = pathname;
      return;
    }
    if (openedOn.current !== pathname) onOpenChange(false);
  }, [open, pathname, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-sheet-overlay
          className="fixed inset-0 z-50 bg-black/70 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in"
        />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          // Restore focus by hand: without a Dialog.Trigger the dialog has no element to return it to.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[510px] flex-col bg-bg-elevated shadow-2xl data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in md:border-l md:border-border"
        >
          <header className="flex min-h-[72px] items-center gap-3 border-b border-divider px-4 md:px-5">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="前に戻る" className={ICON_BUTTON}>
                <ArrowLeft className="size-5" />
              </button>
            )}
            <Dialog.Title className="min-w-0 flex-1 truncate text-lg font-bold text-text-primary">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="閉じる" className={ICON_BUTTON}>
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </header>
          <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-5">
            <div key={stepKey} className="animate-sheet-step">
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui/side-sheet.test.tsx src/app/globals.tokens.test.ts`
Expected: PASS（side-sheet 10 tests、globals 7 tests）

- [ ] **Step 6: コミットする**

```bash
git add src/components/ui/side-sheet.tsx src/components/ui/side-sheet.test.tsx src/app/globals.css
git commit -s -m "feat(dystopia/frontend): add a sheet that slides in from the right"
```

---

### Task 5: Shared components

**Files:**
- Modify: `src/components/ui/button.tsx:14-15`
- Modify: `src/components/ui/tab.tsx`
- Modify: `src/components/ui/page-header.tsx`
- Modify: `src/components/ui/toggle.tsx`
- Modify: `src/components/ui/rating-stars.tsx:22`
- Modify: `src/components/ui/ToastHost.tsx`
- Test: `src/components/ui/button.test.tsx`（新規）, `src/components/ui/toggle.test.tsx`（新規）, `src/components/ui/ToastHost.test.tsx`（新規）, `src/components/ui/tab.test.tsx`, `src/components/ui/page-header.test.tsx`, `src/components/ui/rating-stars.test.tsx`

**Interfaces:**
- Consumes: `bg-bg-elevated` `text-rating` と duration トークン（Task 1）
- Produces: なし（props は変えない）

`Input`・`Textarea`・`Select` は変更しない。`rounded-md` は `--radius-md: 0.75rem`（12px）、高さは `h-11`（44px）、フォーカスは `focus-visible:border-accent` で、spec の指定をトークン経由で既に満たしているため。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/button.test.tsx` を作成する。

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

const classes = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

describe("Button", () => {
  it("fills the primary button with the brand gradient and its glow", () => {
    const button = classes(renderToStaticMarkup(<Button>保存</Button>));

    expect(button).toEqual(expect.arrayContaining(["bg-gradient-brand", "shadow-brand-glow", "rounded-full"]));
  });

  it("outlines the secondary button in a tint of the accent with primary text", () => {
    const button = classes(renderToStaticMarkup(<Button variant="secondary">キャンセル</Button>));

    expect(button).toEqual(expect.arrayContaining(["border-accent/50", "bg-accent/10", "text-text-primary", "rounded-full"]));
    expect(button).not.toContain("text-accent");
  });
});
```

`src/components/ui/toggle.test.tsx` を作成する。

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Toggle } from "./toggle";

const track = (checked: boolean) =>
  (/<button[^>]*class="([^"]*)"/.exec(renderToStaticMarkup(<Toggle checked={checked} onCheckedChange={() => {}} />))?.[1] ?? "").split(/\s+/);

describe("Toggle", () => {
  it("colors the track with the accent while on", () => {
    expect(track(true)).toContain("bg-accent");
  });

  it("colors the track with the border color while off, so it stands out from the surface", () => {
    expect(track(false)).toContain("bg-border");
    expect(track(false)).not.toContain("bg-accent");
  });

  it("reports its state to assistive technology", () => {
    const html = renderToStaticMarkup(<Toggle checked onCheckedChange={() => {}} aria-label="通知" />);

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });
});
```

`src/components/ui/ToastHost.test.tsx` を作成する。

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/stores/toastStore";
import { ToastHost } from "./ToastHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

const say = (message: string) => act(async () => useToastStore.setState({ message }));

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ToastHost)));
});

afterEach(async () => {
  await act(async () => useToastStore.getState().hide());
  await act(async () => root.unmount());
  container.remove();
});

describe("ToastHost", () => {
  it("shows nothing without a message", () => {
    expect(container.innerHTML).toBe("");
  });

  it("announces the message on a raised surface outlined in the accent", async () => {
    await say("カルテを保存しました");

    const toast = container.querySelector('[role="status"] button')!;

    expect(toast.textContent).toBe("カルテを保存しました");
    expect(toast.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-bg-elevated", "border-accent", "text-text-primary"]));
  });

  it("stays above the bottom bar on a phone and above an open sheet", async () => {
    await say("保存しました");

    const host = container.querySelector('[role="status"]')!.className.split(/\s+/);

    expect(host).toEqual(expect.arrayContaining(["bottom-[calc(88px+env(safe-area-inset-bottom))]", "md:bottom-6", "z-[60]"]));
  });

  it("goes away when pressed", async () => {
    await say("保存しました");

    await act(async () => container.querySelector("button")!.click());

    expect(container.innerHTML).toBe("");
  });
});
```

`src/components/ui/tab.test.tsx` の `describe("Tabs", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("stands on the app surface and underlines the selected tab in the brand's pink", () => {
    const [tablist] = classesOf(html, "tablist");
    const underline = /<span class="([^"]*)"><\/span>/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(tablist).toContain("bg-bg");
    expect(underline).toContain("bg-brand-secondary");
    expect(html.match(/<span class="[^"]*"><\/span>/g)).toHaveLength(1);
  });
```

`src/components/ui/page-header.test.tsx` の `describe("PageHeader", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("sets the title at 21px in the heaviest weight over a small description", () => {
    const html = renderToStaticMarkup(<PageHeader title="通知" description="お知らせ" />);

    expect(/<h1 class="([^"]*)"/.exec(html)?.[1].split(/\s+/)).toEqual(expect.arrayContaining(["text-[21px]", "font-extrabold"]));
    expect(/<p class="([^"]*)"/.exec(html)?.[1].split(/\s+/)).toEqual(expect.arrayContaining(["text-xs", "text-text-secondary"]));
  });
```

`src/components/ui/rating-stars.test.tsx` の `describe("RatingStars", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("fills the stars with the rating color", () => {
    const html = renderToStaticMarkup(<RatingStars value={4} />);

    expect(html).toContain("text-rating");
    expect(html).not.toContain("text-warning");
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui/button.test.tsx src/components/ui/toggle.test.tsx src/components/ui/ToastHost.test.tsx src/components/ui/tab.test.tsx src/components/ui/page-header.test.tsx src/components/ui/rating-stars.test.tsx`
Expected: FAIL。各ファイルで追加した見た目のテストが落ち、既存のテストは通る

- [ ] **Step 3: `Button` の `secondary` を変える**

`src/components/ui/button.tsx` の `secondary` を次にする。

```ts
        secondary:
          "border border-accent/50 bg-accent/10 text-text-primary rounded-full hover:border-accent",
```

- [ ] **Step 4: `Tabs` を変える**

`src/components/ui/tab.tsx` の `Tabs` 関数を次にする。

```tsx
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex overflow-x-auto border-b border-divider bg-bg no-scrollbar", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-[17px] py-3.5 text-sm font-bold transition-colors",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-secondary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: `PageHeader` を変える**

`src/components/ui/page-header.tsx` の JSX を次にする。

```tsx
    <>
      <h1 className="text-[21px] font-extrabold">{title}</h1>
      <p className="pt-0.5 text-xs text-text-secondary">{description}</p>
    </>
```

- [ ] **Step 6: `Toggle` を変える**

`src/components/ui/toggle.tsx` の `<button>` と `<span>` の `className` を次にする。

```tsx
      className={cn(
        "relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full transition-colors duration-(--duration-quick) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
        checked ? "bg-accent" : "bg-border",
        className
      )}
```

```tsx
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-(--duration-quick) ease-(--ease-emphasized)",
          checked ? "translate-x-[21px]" : "translate-x-[3px]"
        )}
```

- [ ] **Step 7: `RatingStars` を変える**

`src/components/ui/rating-stars.tsx` の塗りの `<span>` の `className` を次にする。

```tsx
        className="absolute inset-y-0 left-0 overflow-hidden text-rating"
```

- [ ] **Step 8: `ToastHost` を変える**

`src/components/ui/ToastHost.tsx` の `return` を次にする。

```tsx
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6"
    >
      <button
        type="button"
        onClick={hide}
        className="pointer-events-auto max-w-sm rounded-xl border border-accent bg-bg-elevated px-[18px] py-3 text-center text-sm text-text-primary shadow-lg"
      >
        {message}
      </button>
    </div>
  );
```

- [ ] **Step 9: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/ui`
Expected: PASS（`src/components/ui` 配下の全ファイル）

- [ ] **Step 10: コミットする**

```bash
git add src/components/ui
git commit -s -m "refactor(dystopia/frontend): restyle the shared controls after the mock"
```

---

### Task 6: Shell

**Files:**
- Modify: `src/components/shell/AppShell.tsx`
- Modify: `src/components/shell/SideNav.tsx`
- Modify: `src/components/shell/TopBar.tsx:22`
- Modify: `src/components/shell/BottomTab.tsx:36-56`
- Modify: `src/components/shell/SuggestedUsersPane.tsx:15-17`
- Test: `src/components/shell/AppShell.layout.test.tsx`, `src/components/shell/SideNav.test.tsx`, `src/components/shell/BottomTab.test.tsx`, `src/components/shell/SuggestedUsersPane.test.tsx`, `src/components/shell/TopBar.test.tsx`（新規）

**Interfaces:**
- Consumes: `useEnterAnimation(ref, key)`（Task 2）、`bg-backdrop`（Task 1）
- Produces: なし

`ComposeLauncher`（PC の作成ボタンの文言を含む）は Task 8 で扱う。このタスクでは変更しない。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/shell/AppShell.layout.test.tsx` の `mountAt` を次に置き換える（`rerender` を返すようにする）。

```tsx
async function mountAt(pathname: string) {
  navigation.pathname = pathname;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  const render = () =>
    act(async () => {
      root.render(createElement(AppShell, null, createElement("div", { "data-testid": "page" })));
    });
  await render();
  const page = container.querySelector('[data-testid="page"]');
  if (!page) throw new Error(`the page did not render: ${container.innerHTML}`);
  const main = page.parentElement as HTMLElement;
  const frame = main.parentElement?.parentElement as HTMLElement;
  return { container, main, frame, page, rerender: render };
}
```

同じファイルの `describe("AppShell layout", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("sets the content column apart from the page behind the columns", async () => {
    const { main, frame } = await mountAt("/messages");

    expect(frame.className).toContain("bg-backdrop");
    expect(main.className).toContain("bg-bg");
    expect(main.className).toContain("xl:max-w-[620px]");
    expect(main.parentElement?.className).toContain("max-w-[1400px]");
  });

  it("fades the content in when the route changes, keeping the same content element", async () => {
    const animate = vi.spyOn(Element.prototype, "animate").mockReturnValue({} as Animation);
    const { main, page, container, rerender } = await mountAt("/messages");
    main.style.setProperty("--duration-fade", "200ms");

    navigation.pathname = "/search";
    await rerender();

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(main);
    expect(container.querySelector('[data-testid="page"]')).toBe(page);
    animate.mockRestore();
  });
```

`src/components/shell/SideNav.test.tsx` の `describe("SideNav", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("marks the entry of the current page with a surface and an accent icon", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<SideNav />);
    const linkClasses = (path: string) =>
      (/class="([^"]*)"/.exec(new RegExp(`<a([^>]*href="${path}"[^>]*)><svg`).exec(html)?.[1] ?? "")?.[1] ?? "").split(/\s+/);

    expect(linkClasses("/")).toEqual(expect.arrayContaining(["bg-bg-secondary", "text-text-primary"]));
    expect(linkClasses("/search")).not.toContain("bg-bg-secondary");
    expect(linkClasses("/search")).toContain("text-text-secondary");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*><svg[^>]*text-accent/);
    expect(html).not.toMatch(/<a[^>]*href="\/search"[^>]*><svg[^>]*text-accent/);
  });

  it("stands 266px wide on the app surface with a rule on its right", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const aside = /<aside class="([^"]*)"/.exec(renderToStaticMarkup(<SideNav />))?.[1].split(/\s+/) ?? [];

    expect(aside).toEqual(expect.arrayContaining(["w-[266px]", "bg-bg", "border-r", "border-divider"]));
  });
```

`src/components/shell/BottomTab.test.tsx` の `describe("BottomTab", ...)` の中、`describe("tapping the home tab ...")` の前に追加する。

```tsx
  it("stands on the app surface under a rule, clear of the home indicator, with 11px labels", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    authMocks.useAuthStore.mockReturnValue(null);

    const html = renderToStaticMarkup(<BottomTab />);
    const nav = /<nav class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];
    const home = /<a href="\/"[^>]*class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(nav).toEqual(expect.arrayContaining(["sticky", "bottom-0", "bg-bg", "border-t", "border-divider", "pb-safe"]));
    expect(home).toEqual(expect.arrayContaining(["text-[11px]", "text-accent"]));
  });
```

`src/components/shell/SuggestedUsersPane.test.tsx` の `describe("SuggestedUsersPane", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("fills the width left of the content column and lists users on an outlined card", () => {
    hookMocks.useSuggestedUsers.mockReturnValue({
      profiles: [{ profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      loading: false,
    });

    const html = renderToStaticMarkup(<SuggestedUsersPane />);
    const aside = /<aside class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];
    const card = /<\/h2><div class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(aside).toEqual(expect.arrayContaining(["flex-1", "min-w-[185px]", "xl:block"]));
    expect(card).toEqual(expect.arrayContaining(["rounded-[17px]", "border", "border-border", "bg-surface"]));
  });
```

`src/components/shell/TopBar.test.tsx` を作成する。

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("@/modules/notifications/hooks", () => ({ useUnreadCount: () => ({ count: 0 }) }));

const { TopBar } = await import("./TopBar");

describe("TopBar", () => {
  it("stands 62px tall on the app surface with a rule below", () => {
    const html = renderToStaticMarkup(<TopBar onAvatarClick={() => {}} />);
    const header = /<header class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(header).toEqual(expect.arrayContaining(["h-[62px]", "bg-bg", "border-b", "border-divider"]));
  });

  it("opens the menu from the avatar and links to notifications", () => {
    const html = renderToStaticMarkup(<TopBar onAvatarClick={() => {}} />);

    expect(html).toContain('aria-label="メニューを開く"');
    expect(html).toContain('href="/notifications"');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/shell`
Expected: FAIL。追加した 8 つのテストのうち、`TopBar` の 2 つ目（メニューと通知リンク）を除く 7 つが落ちる。既存のテストは通る

- [ ] **Step 3: `AppShell` を変える**

`src/components/shell/AppShell.tsx` に import を追加する（`import { cn } from "@/lib/utils";` の前の行）。

```tsx
import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";
```

`const router = useRouter();` の次の行に追加する。

```tsx
  const mainRef = useRef<HTMLElement>(null);
  useEnterAnimation(mainRef, pathname);
```

最後の `return` の中の 3 箇所の `className` と `<main>` を次にする。`<main>` に `key` を付けない（`/messages` の layout が持つ polling の状態を保つため）。

```tsx
        <div
          className={cn(
            "flex flex-col bg-backdrop [touch-action:pan-y_pinch-zoom]",
            fitsViewport ? "h-dvh overflow-hidden" : "min-h-dvh"
          )}
        >
          <div className="md:hidden">
            <TopBar onAvatarClick={() => setDrawerOpen(true)} />
          </div>
          <div className={cn("mx-auto flex w-full max-w-[1400px] flex-1", fitsViewport && "min-h-0")}>
            <SideNav />
            <main
              ref={mainRef}
              className={cn(
                "min-w-0 flex-1 bg-bg md:border-r md:border-divider xl:max-w-[620px]",
                fitsViewport ? "min-h-0" : "pb-24 md:pb-0"
              )}
            >
              {pathSwitchedAwayFrom === pathname ? null : children}
            </main>
            <SuggestedUsersPane />
          </div>
```

- [ ] **Step 4: `SideNav` を変える**

`src/components/shell/SideNav.tsx` に import を追加する。

```tsx
import { cn } from "@/lib/utils";
```

`return` の中の `<aside>` の開始タグ、`<BrandMark>`、ナビ項目の `<Link>` とアイコン、下部のプロフィールリンクの `className` を次にする。バッジ、`ComposeLauncher`、`ProfileSwitcher`、`Avatar` とその中身は変更しない。

```tsx
    <aside className="sticky top-0 hidden h-screen w-[266px] shrink-0 flex-col border-r border-divider bg-bg px-4 py-[18px] md:flex">
      <BrandMark className="px-4 pb-3 text-lg" />
```

```tsx
            <Link
              key={item.path}
              href={href}
              className={cn(
                "relative flex h-[51px] items-center gap-4 rounded-[10px] px-4 text-base hover:bg-bg-secondary hover:text-text-primary",
                active ? "bg-bg-secondary text-text-primary" : "text-text-secondary"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={cn("size-[22px] shrink-0", active && "text-accent")} strokeWidth={active ? 2.5 : 2} />
```

```tsx
      <Link
        href={profileHref}
        className="mt-3 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg-secondary"
      >
```

- [ ] **Step 5: `TopBar` を変える**

`src/components/shell/TopBar.tsx` の `<header>` の `className` を次にする。

```tsx
    <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-divider bg-bg px-3.5">
```

- [ ] **Step 6: `BottomTab` を変える**

`src/components/shell/BottomTab.tsx` の `<nav>`、`<Link>`、アイコンの `className` を次にする。`onClick`、`aria-current`、バッジは変更しない。

```tsx
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-divider bg-bg px-1 pb-safe md:hidden">
```

```tsx
            className={`relative flex min-h-[61px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
              active ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
```

```tsx
            <tab.icon className="size-[23px]" strokeWidth={active ? 2.5 : 2} />
```

- [ ] **Step 7: `SuggestedUsersPane` を変える**

`src/components/shell/SuggestedUsersPane.tsx` の `<aside>`、`<h2>`、カードの `<div>` の `className` を次にする。

```tsx
    <aside className="sticky top-0 hidden h-screen min-w-[185px] flex-1 overflow-y-auto px-5 py-6 xl:block">
      <h2 className="pb-3 text-[15px] font-bold text-text-primary">おすすめユーザー</h2>
      <div className="rounded-[17px] border border-border bg-surface">
```

- [ ] **Step 8: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/shell`
Expected: PASS（`src/components/shell` 配下の全ファイル）

- [ ] **Step 9: 型検査が通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit`
Expected: 出力なし（終了コード 0）

- [ ] **Step 10: コミットする**

```bash
git add src/components/shell
git commit -s -m "refactor(dystopia/frontend): lay out the shell after the mock and fade pages in"
```

---

### Task 7: Chat start navigation

**Files:**
- Modify: `src/modules/messaging/hooks/useStartChat.ts`
- Test: `src/modules/messaging/hooks/useStartChat.test.ts`（新規）

**Interfaces:**
- Consumes: なし
- Produces: `start(targetProfileId: string, options?: { replace?: boolean }): Promise<string>`。返り値は遷移先のパス（例: `/messages/thread-1`）。`options` を省くと `router.push`、`{ replace: true }` で `router.replace`

リクエスト（`POST /api/messaging/threads`、body `{ recipientProfileId }`）は変更しない。既存の `StartChatButton.request.test.tsx` がこれを固定している。

- [ ] **Step 1: 失敗するテストを書く**

`src/modules/messaging/hooks/useStartChat.test.ts` を作成する。

```ts
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

const { useStartChat } = await import("./useStartChat");

const hook: { current: ReturnType<typeof useStartChat> | null } = { current: null };

function Probe() {
  hook.current = useStartChat();
  return null;
}

let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({ thread: { id: "thread-1" } });
  mocks.push.mockReset();
  mocks.replace.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useStartChat", () => {
  it("adds the conversation to the history by default and returns its path", async () => {
    let path = "";
    await act(async () => {
      path = await hook.current!.start("target-1");
    });

    expect(path).toBe("/messages/thread-1");
    expect(mocks.push.mock.calls).toEqual([["/messages/thread-1"]]);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("puts the conversation in place of the current history entry when asked to replace", async () => {
    let path = "";
    await act(async () => {
      path = await hook.current!.start("target-1", { replace: true });
    });

    expect(path).toBe("/messages/thread-1");
    expect(mocks.replace.mock.calls).toEqual([["/messages/thread-1"]]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sends the same request whichever way it navigates", async () => {
    await act(async () => {
      await hook.current!.start("target-1", { replace: true });
    });

    expect(mocks.authFetch.mock.calls).toEqual([
      ["/api/messaging/threads", { method: "POST", body: { recipientProfileId: "target-1" } }],
    ]);
  });

  it("stays on the page and reports the failure when no conversation comes back", async () => {
    mocks.authFetch.mockResolvedValue({ thread: null });
    let failure: unknown;

    await act(async () => {
      failure = await hook.current!.start("target-1", { replace: true }).catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("メッセージスレッドの作成に失敗しました");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/messaging/hooks/useStartChat.test.ts`
Expected: FAIL。1 つ目は `path` が `undefined`、2 つ目は `replace` が呼ばれない

- [ ] **Step 3: hook を変える**

`src/modules/messaging/hooks/useStartChat.ts` の `GetOrCreateThreadResponse` の後に型を追加し、`start` を次にする。

```ts
interface StartChatOptions {
  replace?: boolean;
}
```

```ts
  const start = useCallback(
    async (targetProfileId: string, { replace = false }: StartChatOptions = {}) => {
      setLoading(true);
      try {
        const res = await authFetch<GetOrCreateThreadResponse>("/api/messaging/threads", {
          method: "POST",
          body: { recipientProfileId: targetProfileId },
        });
        if (!res.thread?.id) throw new Error("メッセージスレッドの作成に失敗しました");
        const path = `/messages/${encodeURIComponent(res.thread.id)}`;
        if (replace) router.replace(path);
        else router.push(path);
        return path;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/messaging`
Expected: PASS（`useStartChat.test.ts` の 4 tests と、既存の `StartChatButton` のテストを含む）

- [ ] **Step 5: コミットする**

```bash
git add src/modules/messaging/hooks/useStartChat.ts src/modules/messaging/hooks/useStartChat.test.ts
git commit -s -m "feat(dystopia/frontend): let a conversation take the place of the current history entry"
```

---

### Task 8: Compose launcher and sheets

**Files:**
- Rename: `src/modules/post/components/PostComposerModal.tsx` → `PostComposerSheet.tsx`
- Rename: `src/components/compose/ComposeToDialog.tsx` → `ComposeToSheet.tsx`
- Rename: `src/components/compose/ComposeToDialog.test.tsx` → `ComposeToSheet.test.tsx`
- Modify: `src/components/compose/ComposeLauncher.tsx`
- Modify: `src/components/compose/ComposeLauncher.test.tsx`
- Modify: `src/components/shell/SideNav.test.tsx:25-27`
- Test: `src/modules/post/components/PostComposerSheet.test.tsx`（新規）

**Interfaces:**
- Consumes: `SideSheet`（Task 4）、`start(targetProfileId, { replace: true }): Promise<string>`（Task 7）
- Produces:
  - `PostComposerSheet({ open, onClose }: { open: boolean; onClose: () => void })`
  - `ComposeToSheet({ kind, open, onClose }: { kind: RecipientKind; open: boolean; onClose: () => void })`

- [ ] **Step 1: ファイルを改名する**

```bash
git mv src/modules/post/components/PostComposerModal.tsx src/modules/post/components/PostComposerSheet.tsx
git mv src/components/compose/ComposeToDialog.tsx src/components/compose/ComposeToSheet.tsx
git mv src/components/compose/ComposeToDialog.test.tsx src/components/compose/ComposeToSheet.test.tsx
```

- [ ] **Step 2: 失敗するテストを書く**

`src/modules/post/components/PostComposerSheet.test.tsx` を作成する。

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  mutate: vi.fn(),
  notifyPostCreated: vi.fn(),
  payload: { body: "こんにちは", isPrivate: false },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/postFeedStore", () => ({
  usePostFeedStore: (selector: (state: { notifyPostCreated: () => void }) => unknown) =>
    selector({ notifyPostCreated: mocks.notifyPostCreated }),
}));
vi.mock("./PostComposer", () => ({
  PostComposer: ({ onSubmit }: { onSubmit: (payload: unknown) => Promise<unknown> }) => (
    <button type="button" onClick={() => void onSubmit(mocks.payload)}>
      submit
    </button>
  ),
}));

const { PostComposerSheet } = await import("./PostComposerSheet");

let root: Root;
let container: HTMLElement;

const show = (open: boolean, onClose: () => void) =>
  act(async () => root.render(createElement(PostComposerSheet, { open, onClose })));

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.mutate.mockReset();
  mocks.notifyPostCreated.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("PostComposerSheet", () => {
  it("shows the composer in a sheet titled for writing a post", async () => {
    await show(true, vi.fn());

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("投稿を作成");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("submit");
  });

  it("shows nothing while closed", async () => {
    await show(false, vi.fn());

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("posts what the composer submits, tells the feeds, and closes", async () => {
    const onClose = vi.fn();
    await show(true, onClose);

    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "submit") as HTMLButtonElement).click();
    });

    expect(mocks.authFetch.mock.calls).toEqual([["/api/posts", { method: "POST", body: mocks.payload }]]);
    expect(mocks.notifyPostCreated).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

`src/components/compose/ComposeToSheet.test.tsx` を次の内容に置き換える。

```tsx
// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const target: SocialProfileView = { profileId: "guest-1", username: "taro", displayName: "たろう", avatarUrl: "", isPrivate: false, role: "guest" };

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  toast: vi.fn(),
  created: null as null | (() => void),
  pathname: "/",
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("./RecipientPicker", () => ({
  RecipientPicker: ({ onPick }: { onPick: (profile: SocialProfileView) => void }) => (
    <button type="button" onClick={() => onPick(target)}>
      pick
    </button>
  ),
}));
vi.mock("@/modules/messaging/hooks/useStartChat", () => ({ useStartChat: () => ({ start: mocks.start, loading: false }) }));
vi.mock("@/modules/karte/components/KarteComposer", () => ({
  KarteComposer: ({ targetProfileId, onCreated }: { targetProfileId: string; onCreated: () => void }) => {
    mocks.created = onCreated;
    return <div>karte-composer:{targetProfileId}</div>;
  },
}));
vi.mock("@/modules/review/components/ReviewComposer", () => ({
  ReviewComposer: ({ targetProfileId }: { targetProfileId: string }) => <div>review-composer:{targetProfileId}</div>,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string }) => unknown) => selector({ role: "cast" }),
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { ComposeToSheet } = await import("./ComposeToSheet");

async function mount(kind: "message" | "karte" | "review", open = true) {
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () =>
    act(async () => {
      root.render(createElement(ComposeToSheet, { kind, open, onClose }));
    });
  await render();
  return {
    onClose,
    rerender: render,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent === label || candidate.getAttribute("aria-label") === label) as HTMLButtonElement;

async function pick() {
  await act(async () => {
    button("pick").click();
  });
}

beforeEach(() => {
  mocks.start.mockReset().mockResolvedValue("/messages/thread-1");
  mocks.toast.mockReset();
  mocks.created = null;
  mocks.pathname = "/";
});

describe("ComposeToSheet", () => {
  it("opens the conversation in place of the sheet's history entry and closes once the route changes", async () => {
    const view = await mount("message");
    expect(document.body.textContent).toContain("メッセージの相手を選ぶ");

    await pick();

    expect(mocks.start.mock.calls).toEqual([["guest-1", { replace: true }]]);
    expect(view.onClose).not.toHaveBeenCalled();

    mocks.pathname = "/messages/thread-1";
    await view.rerender();

    expect(view.onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("closes at once when the conversation is already the current page", async () => {
    mocks.pathname = "/messages/thread-1";
    const view = await mount("message");

    await pick();

    expect(view.onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("shows why the conversation could not be opened and stays on the list", async () => {
    mocks.start.mockRejectedValue(new Error("相手をフォローするとメッセージを送れます"));
    const view = await mount("message");

    await pick();

    expect(document.querySelector('[role="alert"]')?.textContent).toBe("相手をフォローするとメッセージを送れます");
    expect(view.onClose).not.toHaveBeenCalled();
    expect(button("pick")).toBeDefined();
    await view.unmount();
  });

  it("moves on to the karte form for the chosen guest, and back to the list", async () => {
    const view = await mount("karte");
    expect(button("前に戻る")).toBeUndefined();

    await pick();
    expect(document.body.textContent).toContain("カルテを書く");
    expect(document.body.textContent).toContain("たろう");
    expect(document.body.textContent).toContain("karte-composer:guest-1");

    await act(async () => {
      button("前に戻る").click();
    });
    expect(document.body.textContent).toContain("カルテを書くゲストを選ぶ");
    await view.unmount();
  });

  it("confirms a saved karte entry and closes", async () => {
    const view = await mount("karte");
    await pick();

    await act(async () => {
      mocks.created?.();
    });

    expect(mocks.toast.mock.calls).toEqual([["カルテを保存しました"]]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("moves on to the review form for the chosen cast", async () => {
    const view = await mount("review");

    await pick();

    expect(document.body.textContent).toContain("レビューを書く");
    expect(document.body.textContent).toContain("review-composer:guest-1");
    await view.unmount();
  });

  it("shows nothing while closed", async () => {
    const view = await mount("karte", false);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await view.unmount();
  });
});
```

`src/components/compose/ComposeLauncher.test.tsx` の 2 つの `vi.mock`（`PostComposerModal` と `./ComposeToDialog`）を次に置き換える。

```tsx
vi.mock("@/modules/post/components/PostComposerSheet", () => ({
  PostComposerSheet: ({ open }: { open: boolean }) => (open ? <div>post-composer</div> : null),
}));
vi.mock("./ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, onClose }: { kind: string; open: boolean; onClose: () => void }) => (
    <button type="button" data-testid="compose-to" onClick={onClose}>
      compose-to:{kind}:{open ? "open" : "closed"}
    </button>
  ),
}));
```

同じファイルの `describe("ComposeLauncher", ...)` の中、最後の `it` の後に追加する。

```tsx
  it("keeps the sheet mounted while it closes, so it can slide out", async () => {
    mocks.role = "cast";
    mocks.karteAccess = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ComposeLauncher, { variant: "fab" }));
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes("カルテ")) as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("compose-to:karte:open");

    await act(async () => {
      (container.querySelector('[data-testid="compose-to"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose-to:karte:closed");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("labels the sidebar button as creating, since it leads to more than a post", () => {
    mocks.role = "cast";
    mocks.karteAccess = true;

    expect(renderToStaticMarkup(<ComposeLauncher variant="sidebar" />)).toContain("作成する");
  });
```

`src/components/shell/SideNav.test.tsx` の `PostComposerModal` の `vi.mock` を次に置き換える。

```tsx
vi.mock("@/modules/post/components/PostComposerSheet", () => ({
  PostComposerSheet: () => null,
}));
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/compose src/modules/post/components/PostComposerSheet.test.tsx src/components/shell/SideNav.test.tsx`
Expected: FAIL。`PostComposerSheet` と `ComposeToSheet` の export が存在しない

- [ ] **Step 4: `PostComposerSheet` を実装する**

`src/modules/post/components/PostComposerSheet.tsx` を次の内容にする。

```tsx
"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { usePostFeedStore } from "@/stores/postFeedStore";

interface PostComposerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function PostComposerSheet({ open, onClose }: PostComposerSheetProps) {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: payload });
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    notifyPostCreated();
    onClose();
  }, [mutate, notifyPostCreated, onClose]);

  return (
    <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="投稿を作成">
      <PostComposer onSubmit={handleSubmit} />
    </SideSheet>
  );
}
```

- [ ] **Step 5: `ComposeToSheet` を実装する**

`src/components/compose/ComposeToSheet.tsx` を次の内容にする。

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SideSheet } from "@/components/ui/side-sheet";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { ReviewComposer } from "@/modules/review/components/ReviewComposer";
import { useStartChat } from "@/modules/messaging/hooks/useStartChat";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { RecipientPicker } from "./RecipientPicker";
import { resolveRecipientSource, type RecipientKind } from "./resolveRecipientSource";

const COMPOSE_TITLE = { karte: "カルテを書く", review: "レビューを書く" } as const;
const SAVED_MESSAGE = { karte: "カルテを保存しました", review: "レビューを投稿しました" } as const;

interface ComposeToSheetProps {
  kind: RecipientKind;
  open: boolean;
  onClose: () => void;
}

export function ComposeToSheet({ kind, open, onClose }: ComposeToSheetProps) {
  const viewerRole = useAuthStore(selectRole);
  const showToast = useToastStore((s) => s.show);
  const { start, loading: opening } = useStartChat();
  const pathname = usePathname();
  const [target, setTarget] = useState<SocialProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = resolveRecipientSource(kind, viewerRole);
  const composeKind = target && kind !== "message" ? kind : null;

  const pick = async (profile: SocialProfileView) => {
    setError(null);
    if (kind !== "message") return setTarget(profile);
    try {
      // The route change closes the sheet, so close here only when the conversation is already the current page.
      if ((await start(profile.profileId, { replace: true })) === pathname) onClose();
    } catch (e) {
      // FALLBACK: Use a generic message when the failure carries none.
      setError(e instanceof Error && e.message ? e.message : "メッセージを始められませんでした");
    }
  };

  const saved = () => {
    if (kind !== "message") showToast(SAVED_MESSAGE[kind]);
    onClose();
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={composeKind ? COMPOSE_TITLE[composeKind] : source.title}
      onBack={composeKind ? () => setTarget(null) : undefined}
      stepKey={composeKind ? "compose" : "pick"}
    >
      {error && (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {!target && (
        <div className={opening ? "pointer-events-none opacity-60" : undefined}>
          <RecipientPicker source={source} onPick={pick} />
        </div>
      )}

      {target && composeKind && (
        <>
          <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
            <Avatar src={target.avatarUrl || undefined} fallback={target.displayName.slice(0, 1) || "?"} size="sm" />
            <span className="min-w-0 truncate text-sm font-bold text-text-primary">{target.displayName}</span>
            <span className="truncate text-xs text-text-secondary">@{target.username}</span>
          </div>
          {composeKind === "karte" ? (
            <KarteComposer targetProfileId={target.profileId} onCreated={saved} />
          ) : (
            <ReviewComposer targetProfileId={target.profileId} onCreated={saved} />
          )}
        </>
      )}
    </SideSheet>
  );
}
```

- [ ] **Step 6: `ComposeLauncher` を変える**

`src/components/compose/ComposeLauncher.tsx` を次の内容にする。`fab` variant の値は変更しない。

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FlowerMenu } from "@/components/ui/flower-menu";
import { PostComposerSheet } from "@/modules/post/components/PostComposerSheet";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { ComposeToSheet } from "./ComposeToSheet";
import { COMPOSE_ICONS, COMPOSE_LABELS } from "./compose-icons";
import { resolveComposeKinds, type ComposeKind } from "./resolveComposeKinds";

const VARIANTS = {
  fab: {
    spread: "up-left",
    radius: 96,
    className: "fixed bottom-20 right-4 z-40 md:hidden",
    triggerClassName:
      "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-white shadow-brand-glow active:scale-95",
    content: <Plus className="size-7" />,
  },
  sidebar: {
    spread: "up",
    radius: 92,
    className: "mt-3",
    triggerClassName:
      "flex min-h-[47px] w-full items-center justify-center gap-2 rounded-full bg-gradient-brand font-bold text-white shadow-brand-glow active:scale-95",
    content: (
      <>
        <Plus className="size-5" />
        作成する
      </>
    ),
  },
} as const;

interface Composing {
  kind: ComposeKind;
  session: number;
  open: boolean;
}

export function ComposeLauncher({ variant }: { variant: keyof typeof VARIANTS }) {
  const role = useAuthStore(selectRole);
  const { hasAccess: karteAccess } = useMyKarteAccess();
  // Keep the chosen kind after closing: dropping it would unmount the sheet before it slides out.
  const [composing, setComposing] = useState<Composing | null>(null);
  const { content, ...menu } = VARIANTS[variant];
  const kinds = resolveComposeKinds({ role, karteAccess });
  const close = () => setComposing((current) => current && { ...current, open: false });

  return (
    <>
      <FlowerMenu
        {...menu}
        label="作成メニュー"
        items={kinds.map((id) => ({ id, label: COMPOSE_LABELS[id], icon: COMPOSE_ICONS[id] }))}
        onSelect={(id) =>
          setComposing((current) => ({ kind: id as ComposeKind, session: (current?.session ?? 0) + 1, open: true }))
        }
      >
        {content}
      </FlowerMenu>
      <PostComposerSheet open={composing?.kind === "post" && composing.open} onClose={close} />
      {composing && composing.kind !== "post" && (
        <ComposeToSheet key={composing.session} kind={composing.kind} open={composing.open} onClose={close} />
      )}
    </>
  );
}
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/components/compose src/modules/post/components/PostComposerSheet.test.tsx src/components/shell`
Expected: PASS（`ComposeToSheet` 7 tests、`ComposeLauncher` 6 tests、`PostComposerSheet` 3 tests、`src/components/shell` の全ファイル）

- [ ] **Step 8: 旧名が残っていないことを確認する**

Run: `/usr/bin/grep -rnE 'PostComposerModal|ComposeToDialog' src`
Expected: 出力なし（終了コード 1）

- [ ] **Step 9: 型検査が通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit`
Expected: 出力なし（終了コード 0）

- [ ] **Step 10: コミットする**

```bash
git add src/components/compose src/modules/post/components src/components/shell/SideNav.test.tsx
git commit -s -m "refactor(dystopia/frontend): open the compose flows in the side sheet"
```

---

### Task 9: Whole-branch verification

このタスクは実装担当ではなく、plan を進行するセッション（controller）が行う。コードを変更した場合は該当 Task のテストを足してからコミットする。

**Files:**
- Modify: なし（確認で不具合が見つかった場合のみ、該当 Task のファイル）

**Interfaces:**
- Consumes: Task 1〜8 の成果
- Produces: Draft PR #1521 の説明に載せる検証結果

- [ ] **Step 1: 全テストを実行する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run`
Expected: すべて PASS。失敗が 0 件

- [ ] **Step 2: 型検査とビルドを実行する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit && env -u NODE_OPTIONS pnpm build`
Expected: `tsc` は出力なし。`next build` は `Compiled successfully` を含み終了コード 0

- [ ] **Step 3: ビルドした CSS にアニメーションが含まれることを確認する**

Run: `/usr/bin/grep -lE 'sheet-in|sheet-step' .next/static/chunks/*.css .next/static/css/*.css 2>/dev/null | head -3`
Expected: 1 つ以上のファイルが表示される

- [ ] **Step 4: バックエンド連携に触れていないことを確認する**

Run: `git diff --stat origin/main -- src/app/api src/stub ../../proto ../monolith`
Expected: 出力なし

Run: `git diff -M origin/main -- src ':!*.test.ts' ':!*.test.tsx' | /usr/bin/grep -E '^[-+].*(authFetch|fetch)[<(]'`
Expected: 出力なし。改名が検出されなかった場合に限り、`PostComposerModal.tsx` の削除行と `PostComposerSheet.tsx` の追加行として、内容が同一の `await authFetch("/api/posts", { method: "POST", body: payload });` の組だけが出る

- [ ] **Step 5: ローカルで monolith と frontend を起動する**

`dystopia/monolith` で使い捨ての DB を作り、gRPC server を起動する。

```bash
cd ../monolith
DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e HANAMI_ENV=test rbenv exec bundle exec hanami db create
DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e HANAMI_ENV=test rbenv exec bundle exec hanami db migrate
DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e HANAMI_ENV=test rbenv exec bundle exec hanami db seed
set -a && . ./.env && . ./.env.test && set +a && export DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e_test GRPC_BIND_ADDRESS=127.0.0.1:9055 RACK_ENV=production && rbenv exec bundle exec ruby bin/grpc
```

`dystopia/frontend` で frontend を起動する。

```bash
MONOLITH_URL=http://127.0.0.1:9055 env -u NODE_OPTIONS pnpm exec next dev --port 3055
```

ブラウザは `http://localhost:3055` で開く（`127.0.0.1` では hydration されない）。seed 済みのアカウントは phone `+819000000101`〜`107`（`101`〜`103` が cast、残りが guest）、password は `password`。

- [ ] **Step 6: 見た目を実機で確認する**

幅 1440px・1024px・390px のそれぞれで、ダークとライト（設定の外観、または `localStorage.theme`）を切り替えて次の画面を開き、スクリーンショットを残す。

| 画面 | 確認すること |
|---|---|
| ホーム `/` | 3 カラム（1440px）の面の色が背後と中央で分かれている。タブの下線がピンク |
| プロフィール `/u/<username>` | ボタン・星・タブが崩れていない |
| 設定 `/settings` | トグルのオフが面から区別できる |
| 自分のカルテ `/karte/my`（cast） | 一覧が崩れていない |
| メッセージスレッド `/messages/<id>` | 入力欄が下部ナビに隠れていない（390px） |

Expected: どの組み合わせでも、文字が背景に埋もれている箇所、はみ出し、重なりがない

- [ ] **Step 7: シートの動きを実機で確認する**

| 操作 | 期待する結果 |
|---|---|
| 作成メニュー → 投稿 | シートが右から入る。390px では全幅 |
| ×、Esc、背後の押下 | それぞれシートが右へ出て閉じる |
| シートを開いてブラウザの「戻る」 | シートが閉じる。ページは再読み込みされず、スクロール位置が変わらない |
| シートを 3 回開閉してから「戻る」 | 1 回で前のページへ戻る（履歴にエントリが溜まっていない） |
| 作成メニュー → メッセージ → 宛先を選ぶ | スレッドへ移りシートが閉じる。「戻る」1 回で元のページに戻る |
| 作成メニュー → カルテ → ゲストを選ぶ → 保存（cast） | 段の切り替えで本文が入り直す。保存でトーストが出てシートが閉じる。一覧に追加される |
| 作成メニュー → レビュー → キャストを選ぶ → 投稿（guest） | 同上 |
| 投稿を作成して送信 | シートが閉じ、フィードに投稿が現れる |
| ナビでページを移動 | 中央カラムの内容が短くフェードする |
| OS の「視差効果を減らす」を有効にして上の操作 | シートとフェードが動きなしで切り替わり、開閉は成立する |

Expected: すべての行が期待どおり。monolith と frontend のログに ERROR が出ていない

- [ ] **Step 8: 後片付けをする**

```bash
lsof -nP -iTCP:9055 -sTCP:LISTEN
```

表示された PID の cwd がこの worktree であることを確かめてから `kill <pid>` し、frontend の `next dev` を止める。その後に次を実行する。

```bash
/opt/homebrew/opt/postgresql@18/bin/psql postgres://postgres:password@localhost:5432/postgres -c 'drop database "monolith_e2e_test"'
rm -f AGENTS.md CLAUDE.md
git status --short
```

Expected: `git status --short` が出力なし（`next dev` が書き出した `AGENTS.md` と `CLAUDE.md` が残っていない）

- [ ] **Step 9: push して PR を更新する**

```bash
git push
```

Draft PR #1521 の説明の `## Status` を、実施した検証（コマンドと結果、スクリーンショット）に書き換える。PR は Draft のままにする。

---

## Post-review amendments

最終レビューを受けて、Task 5・6・8 のコードを次のとおり変更した。上の各 Task の記述は当初の内容のままである。

| 対象 | 当初 | 変更後 | 理由 |
|---|---|---|---|
| `AppShell` の `<main>` | `xl:max-w-[620px]` | `xl:w-[620px] xl:flex-none` | `<main>` と `SuggestedUsersPane` がともに `flex-1` で残り幅を分け合い、620px に達しなかった |
| `ComposeToSheet` | 宛先を選んだ後も操作できる | ルートが変わるまで宛先リストを操作不可にし、閉じる要求を受け付けない | 二度押しでスレッド作成が 2 回走り、この間に閉じると遷移が元のページの履歴エントリを置き換えた |
| `PageHeader` の見出し | `text-[21px] font-extrabold` | `text-[1.3125rem] font-bold` | フォントは 400・500・700 しか読み込んでおらず 800 は描画されない。px はブラウザの文字サイズ設定に従わない |
| `BottomTab` のラベル | `text-[11px]` | `text-[0.6875rem]` | 同上 |
| `SuggestedUsersPane` の見出し | `text-[15px]` | `text-[0.9375rem]` | 同上 |
| `BottomTab` の `<nav>` | `pb-safe` あり | なし | `viewport-fit=cover` を宣言していないので効果がない |

