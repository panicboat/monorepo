# Plan A: Design Tokens Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現行 frontend の token システムを clean-slate で置換し、design system spec §3 の dark/brand token（hex）と Noto Sans JP / root 15px を導入する。

**Architecture:** 旧 token（role / 旧 semantic / status / shadow / radius-lg,xl / spacing / z / duration / theme.ts）を削除し、`globals.css` を spec §3 の token だけに置き換える。色は hex（Tailwind v4 は `color-mix()` で alpha 合成するため `R G B` チャンネル形式は不要）。実値は `:root` に置き `@theme inline` で Tailwind token に写す既存パターンを踏襲する。旧画面の視覚崩れは許容（フル再構築のため）で、`@apply` 0 件・theme.ts import 0 件・tailwind lint plugin 不在のため build / lint は green を維持する。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Tailwind v4 (`@tailwindcss/postcss`) / TypeScript / pnpm。

**Spec:** `docs/superpowers/specs/2026-05-29-design-system-design.md` §3、移行方式は `docs/superpowers/specs/2026-05-30-token-migration-strategy-design.md`。

---

## Context for the implementer

- 作業ディレクトリは `services/frontend/workspace`。以降の相対パスはここ基準。
- test script は存在しない（`package.json` の scripts は dev/build/start/lint/format/proto:gen）。検証は `pnpm build` / `pnpm lint` / `pnpm dev` 目視で行う。
- Tailwind v4。`globals.css` の既存パターン = 実値を `:root` に定義し `@theme inline` で同名 token に `var()` で写す。本 plan もこれを踏襲する。
- 旧 token を参照する Tailwind class（`bg-role-cast` 等 200+ 箇所）は削除後に未定義 utility となり**無スタイル化するがビルドエラーにはならない**。これは想定内。

## File Structure

- Modify: `src/app/layout.tsx` — Geist を Noto Sans JP に置換、`--font-noto-sans-jp` を `<html>` に公開、body の背景 class を `bg-bg` に変更
- Modify: `src/app/globals.css` — token システム全体を spec §3 に置換
- Delete: `src/config/theme.ts` — import 0 件の dead code

---

## Task 1: Noto Sans JP をロードする

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: layout.tsx の font とフォント変数を差し替える**

`src/app/layout.tsx` の現状は Geist / Geist_Mono を読み込み、`<body>` の className に `geistSans.variable` 等と `bg-surface-secondary` を付けている。これを以下に置き換える。`weight` を明示指定する（next/font/google の Noto Sans JP は静的ウェイト供給。spec §3.2 が使う 400/500/700 を読む。将来 variable 軸が使えるなら `weight` を外す）:

ファイル冒頭の import とフォント定義:

```tsx
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});
```

`<html>` と `<body>` を以下に変更（`notoSansJP.variable` を `<html>` に付け、body の旧 class を `bg-bg` に置換。Geist 系・`--font-geist-*`・`bg-surface-secondary` は削除）:

```tsx
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <body className="antialiased bg-bg">
```

その他（`metadata`、`AuthProvider` / `SWRProvider` / `ToastProvider`、`RootLayout` の構造）は現状のまま変更しない。

- [ ] **Step 2: 型・参照の取りこぼしを確認**

Run: `cd services/frontend/workspace && grep -n "geist\|Geist\|font-geist\|surface-secondary" src/app/layout.tsx`
Expected: 出力なし（Geist 系と旧 class を残していない）。

> この時点ではまだ build しない（globals.css が旧状態で `--font-geist-sans` を参照しており不整合なため、Task 2 と合わせて 1 コミットにする）。

---

## Task 2: globals.css を spec §3 の token に置換する

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: globals.css を全置換する**

`src/app/globals.css` の内容を以下で**全置換**する。実値は `:root`、Tailwind token は `@theme inline` で写す（既存パターン踏襲）。radius と `--font-sans` は `@theme inline` に直接記述する。

```css
@import "tailwindcss";

:root {
  /* Neutral scale */
  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;
  --color-neutral-950: #14161a;

  /* Brand */
  --color-brand-primary: #a855f7;
  --color-brand-secondary: #ec4899;
  --color-brand-tertiary: #f97316;

  /* Functional */
  --color-input-bg: #303030;
  --color-success-bg: #166534;
  --color-success-text: #4ade80;

  /* Status — spec §10 未確定。暗色テーマ用の仮値 */
  /* TODO: spec §10 で error/warning/info の正式色が確定したら差し替える */
  --color-error: #f87171;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;

  /* Semantic aliases */
  --color-bg: var(--color-neutral-950);
  --color-surface: var(--color-neutral-900);
  --color-divider: var(--color-neutral-800);
  --color-border: var(--color-neutral-700);
  --color-text-primary: var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-400);
  --color-text-muted: var(--color-neutral-500);
  --color-accent: var(--color-brand-primary);

  /* Brand gradient & glow — hex token を直接利用。glow は alpha 合成のため channel をハードコード */
  --gradient-brand-2: linear-gradient(
    to right,
    var(--color-brand-primary),
    var(--color-brand-secondary)
  );
  --gradient-brand-3: linear-gradient(
    135deg,
    var(--color-brand-primary),
    var(--color-brand-secondary),
    var(--color-brand-tertiary)
  );
  --shadow-brand-glow:
    0 10px 15px -3px rgb(168 85 247 / 0.2),
    0 4px 6px -4px rgb(168 85 247 / 0.2);
}

/* root font-size 15px — spec §3.2 が全 rem token の前提とする */
html {
  font-size: 93.75%;
}

@theme inline {
  --font-sans: var(--font-noto-sans-jp), "Segoe UI", Meiryo, sans-serif;

  /* Neutral scale */
  --color-neutral-50: var(--color-neutral-50);
  --color-neutral-100: var(--color-neutral-100);
  --color-neutral-200: var(--color-neutral-200);
  --color-neutral-300: var(--color-neutral-300);
  --color-neutral-400: var(--color-neutral-400);
  --color-neutral-500: var(--color-neutral-500);
  --color-neutral-600: var(--color-neutral-600);
  --color-neutral-700: var(--color-neutral-700);
  --color-neutral-800: var(--color-neutral-800);
  --color-neutral-900: var(--color-neutral-900);
  --color-neutral-950: var(--color-neutral-950);

  /* Brand */
  --color-brand-primary: var(--color-brand-primary);
  --color-brand-secondary: var(--color-brand-secondary);
  --color-brand-tertiary: var(--color-brand-tertiary);

  /* Functional */
  --color-input-bg: var(--color-input-bg);
  --color-success-bg: var(--color-success-bg);
  --color-success-text: var(--color-success-text);

  /* Status (interim) */
  --color-error: var(--color-error);
  --color-warning: var(--color-warning);
  --color-info: var(--color-info);

  /* Semantic */
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-divider: var(--color-divider);
  --color-border: var(--color-border);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-accent: var(--color-accent);

  /* Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-full: 9999px;
}

.bg-gradient-brand {
  background-image: var(--gradient-brand-2);
}

.bg-gradient-brand-3 {
  background-image: var(--gradient-brand-3);
}

.shadow-brand-glow {
  box-shadow: var(--shadow-brand-glow);
}

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans), sans-serif;
}

@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

@utility pt-safe {
  padding-top: env(safe-area-inset-top);
}

@utility no-scrollbar {
  &::-webkit-scrollbar {
    display: none;
  }

  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media screen and (max-width: 899px) {
  /* iOS の input focus ズーム防止のため 16px を強制 */
  input,
  textarea,
  select {
    font-size: 16px !important;
  }
}
```

- [ ] **Step 2: 旧 token の残骸が無いことを確認**

Run: `cd services/frontend/workspace && grep -nE "role-cast|role-guest|--color-special|--color-accent-hover|surface-secondary|surface-tertiary|text-inverted|border-secondary|--background|--foreground|prefers-color-scheme|\.dark|shadow-cast|shadow-guest|--spacing-|--z-|--duration-|font-geist" src/app/globals.css`
Expected: 出力なし。

---

## Task 3: build と lint を検証してコミットする

**Files:**
- なし（検証とコミット）

- [ ] **Step 1: build を通す**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功。font 取得エラー・CSS エラーが出ないこと。`pnpm build` が落ちる場合の典型は Noto Sans JP の weight 指定（その場合 Step は失敗として扱い、`weight` の値や variable 化を見直す）。

- [ ] **Step 2: lint を通す**

Run: `cd services/frontend/workspace && pnpm lint`
Expected: 新規エラーなし。

- [ ] **Step 3: コミット**

layout と globals は相互依存（globals が `--font-noto-sans-jp` を参照）するため 1 コミットにまとめる。

```bash
cd services/frontend/workspace
git add src/app/layout.tsx src/app/globals.css
git commit -s -m "feat(frontend): replace design tokens with rx-sns dark system and Noto Sans JP"
```

---

## Task 4: 未使用の theme.ts を削除する

**Files:**
- Delete: `src/config/theme.ts`

- [ ] **Step 1: import が無いことを再確認する**

Run: `cd services/frontend/workspace && grep -rn "@/config/theme" src/ | grep -v "src/config/theme.ts"`
Expected: 出力なし（theme.ts を import するファイルが無い）。

- [ ] **Step 2: 削除する**

```bash
cd services/frontend/workspace
git rm src/config/theme.ts
```

- [ ] **Step 3: build を再確認してコミットする**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 成功（TS 参照が無いため影響なし）。

```bash
cd services/frontend/workspace
git commit -s -m "chore(frontend): remove unused theme.ts token mirror"
```

---

## Task 5: dev で目視検証する

**Files:**
- なし（目視）

- [ ] **Step 1: dev サーバを起動して確認する**

Run: `cd services/frontend/workspace && pnpm dev`

ブラウザで確認:
- 本文フォントが Noto Sans JP になっている（OS デフォルト sans から変わる）。
- 新 token utility が効く: 一時要素に `className="bg-bg text-text-primary"`、`className="bg-surface border border-border"`、`className="bg-gradient-brand shadow-brand-glow rounded-full px-4 py-2"` を当て、ダーク背景・紫→ピンクのピル + グロー・角丸が出ること（確認後その一時要素は戻す）。
- 旧画面（`(cast)` / `(guest)` 配下）が部分的に無スタイル化・サイズ変化しているのは想定内（後続フェーズで再構築）。

- [ ] **Step 2: dev サーバを停止する**

確認後、dev プロセスを停止する。

---

## Deferred（本 plan では実施しない）

- **error / warning / info の正式 semantic color**: spec §10 未確定。本 plan は暗色仮値（TODO コメント付き）で先行。確定後に `:root` / `@theme inline` の該当 3 token を差し替える。
- **App shell / nav / component / 各ページの再構築**: roadmap の Phase 1 以降。
- **font-mono**: Geist_Mono 撤去により `font-mono` は Tailwind デフォルトの mono スタックにフォールバックする。専用 mono が必要になった時点で別途検討。

## Self-Review（作成者チェック済）

- **Spec §3 coverage**: color(§3.1, Task2) / font=Noto(§3.2, Task1) / root 15px(§3.2, Task2) / radius(§3.4, Task2) / gradient・glow(§3.1, Task2) を網羅。spacing は Tailwind デフォルト（§3.3）で token 追加なし。
- **Placeholder**: なし。未確定の status 3 色のみ仮値 + TODO で隔離。
- **整合**: token 名・hex 値は spec §3.1（hex 修正済）と一致。`--font-noto-sans-jp`（layout 公開）↔ `--font-sans`（globals 参照）が一致。
- **build/lint 安全性**: `@apply` 0・theme.ts import 0・tailwind lint plugin 不在を確認済（migration strategy doc 参照）。旧 token 参照 class は無スタイル化するがエラーにならない。
