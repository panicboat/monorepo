# Theme Switcher (light mode + 外観 tab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light theme and a Settings 外観 tab (light/dark/system) using a self-rolled no-flash script + React context, with the light palette layered on the existing token system.

**Architecture:** A `[data-theme="light"]` block in globals.css overrides the dark semantic color aliases; a no-flash inline script in the root layout sets `<html data-theme>` before paint from localStorage; a `ThemeProvider`/`useTheme` context manages the choice (light/dark/system), persists it, and follows the OS in system mode; an `AppearanceSettings` component drives it from a new Settings tab.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (CSS custom properties / `@theme inline`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-19-theme-switcher-design.md`

**Verification conventions:**
- No frontend unit-test harness exists; the gate is `tsc --noEmit` + `pnpm lint` (0e/0w) + `pnpm build`, plus the manual checks listed per task.
- Run frontend commands from `services/frontend/workspace` with `env -u NODE_OPTIONS`.
- Bare `find`/`grep` are shadowed in this environment — use `/usr/bin/find` / `/usr/bin/grep`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `services/frontend/workspace/src/app/globals.css` | add `[data-theme="light"]` semantic-alias overrides | Modify |
| `services/frontend/workspace/src/components/providers/ThemeProvider.tsx` | theme choice context: persist, apply to `<html data-theme>`, follow OS in system mode | Create |
| `services/frontend/workspace/src/app/layout.tsx` | no-flash inline script + wrap app in `ThemeProvider` | Modify |
| `services/frontend/workspace/src/modules/profile/components/AppearanceSettings.tsx` | 外観 tab UI (light/dark/system radio group) | Create |
| `services/frontend/workspace/src/app/settings/page.tsx` | add "外観" tab | Modify |

---

## Task 1: Theme infrastructure (CSS + no-flash script + provider)

**Files:**
- Modify: `services/frontend/workspace/src/app/globals.css`
- Create: `services/frontend/workspace/src/components/providers/ThemeProvider.tsx`
- Modify: `services/frontend/workspace/src/app/layout.tsx`

- [ ] **Step 1: Add the light palette to globals.css**

In `services/frontend/workspace/src/app/globals.css`, immediately AFTER the closing `}` of the existing `:root { ... }` block (the one that ends right before `/* root font-size 15px ... */`), insert this block. The existing `:root` already holds the dark values and stays unchanged; this override wins for light because it has equal specificity and comes later in source order.

```css
/* Light theme: override only the semantic aliases. Neutral/brand scales,
   gradients, and radius stay shared in :root (dark default). */
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-surface: var(--color-neutral-100);
  --color-bg-secondary: var(--color-neutral-200);
  --color-divider: var(--color-neutral-200);
  --color-border: var(--color-neutral-300);
  --color-text-primary: var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-500);
  --color-text-muted: var(--color-neutral-400);
  --color-input-bg: var(--color-neutral-100);
  --color-accent: var(--color-brand-primary);
}
```

- [ ] **Step 2: Create the ThemeProvider**

Create `services/frontend/workspace/src/components/providers/ThemeProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [loaded, setLoaded] = useState(false);

  // Read the stored choice on the client. Until this runs, leave the value the
  // no-flash inline script already set (don't clobber it on the server-default).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setThemeState(
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system"
    );
    setLoaded(true);
  }, []);

  // Apply on change, and follow the OS while in system mode.
  useEffect(() => {
    if (!loaded) return;
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, loaded]);

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 3: Wire the no-flash script + provider into layout**

In `services/frontend/workspace/src/app/layout.tsx`:

Add the import alongside the other provider imports (after `import { AppShell } from "@/components/shell";`):

```tsx
import { ThemeProvider } from "@/components/providers/ThemeProvider";
```

Replace the current body block:

```tsx
      <body className="antialiased bg-bg">
        <AuthProvider>
          <SWRProvider>
            <AppShell>{children}</AppShell>
          </SWRProvider>
        </AuthProvider>
      </body>
```

with (the inline script must be the first child of `<body>` so it runs before content paints; `<html suppressHydrationWarning>` is already present):

```tsx
      <body className="antialiased bg-bg">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <SWRProvider>
              <AppShell>{children}</AppShell>
            </SWRProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
```

- [ ] **Step 4: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint `0 errors / 0 warnings`; build `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/workspace/src/app/globals.css \
        services/frontend/workspace/src/components/providers/ThemeProvider.tsx \
        services/frontend/workspace/src/app/layout.tsx
git commit -s -m "feat(frontend): theme infrastructure (light palette + no-flash script + ThemeProvider)"
```

---

## Task 2: AppearanceSettings + Settings 外観 tab

**Files:**
- Create: `services/frontend/workspace/src/modules/profile/components/AppearanceSettings.tsx`
- Modify: `services/frontend/workspace/src/app/settings/page.tsx`

- [ ] **Step 1: Create AppearanceSettings**

Create `services/frontend/workspace/src/modules/profile/components/AppearanceSettings.tsx`. The `mounted` guard prevents a hydration mismatch: the provider's `theme` starts at `"system"` on the server but may differ once localStorage is read, so no option renders as selected until mounted.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme, type ThemeChoice } from "@/components/providers/ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "システム" },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-3 py-4">
      <h2 className="text-sm font-semibold text-text-secondary">テーマ</h2>
      <div role="radiogroup" aria-label="テーマ" className="flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const selected = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm ${
                selected
                  ? "border-accent text-text-primary"
                  : "border-border text-text-secondary hover:bg-bg-secondary"
              }`}
            >
              <span>{opt.label}</span>
              <span
                aria-hidden="true"
                className={`h-4 w-4 rounded-full border ${
                  selected ? "border-accent bg-accent" : "border-border"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the 外観 tab to the settings page**

In `services/frontend/workspace/src/app/settings/page.tsx`:

Add the import after `import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";`:

```tsx
import { AppearanceSettings } from "@/modules/profile/components/AppearanceSettings";
```

Change the `items` array to include 外観 (after privacy, before account — keeps account last):

```tsx
  const items = [
    { id: "notifications", label: "通知設定" },
    ...(role === "cast" ? [{ id: "area", label: "エリア" }] : []),
    { id: "privacy", label: "プライバシー" },
    { id: "appearance", label: "外観" },
    { id: "account", label: "アカウント" },
  ];
```

Add the render branch in the tab content block (after the privacy branch, before account):

```tsx
        {tab === "privacy" && <PrivacySettings profile={profile} save={saveProfile} />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "account" && <AccountSettings profile={profile} save={saveProfile} />}
```

- [ ] **Step 3: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint `0 errors / 0 warnings`; build `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/workspace/src/modules/profile/components/AppearanceSettings.tsx \
        services/frontend/workspace/src/app/settings/page.tsx
git commit -s -m "feat(frontend): Settings 外観 tab (light/dark/system selector)"
```

---

## Task 3: Raw color audit for light mode

**Files:**
- Modify: any `.tsx` under `services/frontend/workspace/src` that uses dark-assuming fixed colors (determined in Step 1).

- [ ] **Step 1: List raw color usages**

Run:
```bash
cd services/frontend/workspace
/usr/bin/grep -rn "neutral-\|text-white\|bg-white\|bg-black\|text-black\|#fff\|#000" src --include=*.tsx
```
This yields ~17 hits. For each, classify:
- **Keep** (theme-agnostic): `text-white` on a `bg-gradient-brand` / accent element (white reads on the brand gradient in both themes); usages inside `src/app/dev/ui/` (the dev-only mock page).
- **Fix** (dark-assuming): a fixed `text-white` / `bg-black` / `text-black` / raw `neutral-*` / hex that sits on a theme surface and would become invisible or wrong in light mode.

- [ ] **Step 2: Replace dark-assuming usages with semantic tokens**

For each "Fix" hit, replace the fixed color with the semantic token that matches its intent:
- body/heading text → `text-text-primary`
- secondary/meta text → `text-text-secondary` / `text-text-muted`
- surface backgrounds → `bg-surface` / `bg-bg` / `bg-bg-secondary`
- borders/dividers → `border-border` / `border-divider`

Do NOT change `text-white` that sits on `bg-gradient-brand`/`bg-accent` (intentional in both themes). If a hit is genuinely theme-agnostic, leave it and move on.

- [ ] **Step 3: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint `0 errors / 0 warnings`; build `✓ Compiled successfully`.

- [ ] **Step 4: Commit** (skip if Step 1 found nothing to fix)

```bash
git add -A
git commit -s -m "fix(frontend): use semantic color tokens for light-mode correctness"
```

---

## Task 4: Update session handoff doc

**Files:**
- Modify: `docs/superpowers/2026-06-18-session-handoff.md`

- [ ] **Step 1: Mark #101 done**

In `docs/superpowers/2026-06-18-session-handoff.md`, Section 5 B, change the `#101 Settings 外観 tab` row to completed (`~~...~~ | ✅ 完了 (本 PR) | ...`), noting: self-rolled theme infra (no-flash script + ThemeProvider, no dependency — next-themes was ~13mo dormant; @wrksz/themes evaluated but too young/single-maintainer), `[data-theme="light"]` palette, 外観 tab (light/dark/system). Match the surrounding `✅`/strikethrough table style.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/2026-06-18-session-handoff.md
git commit -s -m "docs: mark #101 theme switcher complete in session handoff"
```

---

## Final verification (before PR)

- [ ] `cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit && env -u NODE_OPTIONS pnpm lint && env -u NODE_OPTIONS pnpm build` (tsc clean, 0e/0w, build ok)
- [ ] Manual (local e2e, if run): 外観 tab switches light/dark/system → `<html data-theme>` updates immediately; reload persists the choice (localStorage `theme`); "システム" follows OS dark/light toggle; no FOUC on first load; feed / profile / settings / footprints / messages are readable in light mode; dark mode looks unchanged from before.
- [ ] Push branch, open Draft PR (conventional title), `gh pr ready`, `gh pr merge --squash --delete-branch --auto`.

**Success criteria (from spec):**
- 3 choices work, persist, and follow the OS
- existing components are legible in light mode (no contrast breakage)
- dark mode is visually unchanged
