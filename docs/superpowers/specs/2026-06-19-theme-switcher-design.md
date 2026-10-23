# Theme Switcher Design — light mode + Settings 外観 tab (#101)

Date: 2026-06-19
Status: Design spec (implementation-ready)
Scope: ダークのみだった frontend に light テーマを追加し、Settings に「外観」tab（ライト / ダーク / システムの 3 択）を設ける。テーマは自前の no-flash script + React context で `<html data-theme>` を切替え、CSS の semantic alias を `[data-theme="light"]` で上書きする。

Related:
- `docs/superpowers/specs/2026-05-29-design-system-design.md`（token foundation, Phase 0）
- rx-sns capture: `.superpowers/rx-sns-render/p04-settings-外観.png`（3 radio: ライト / ダーク / システム）
- handoff doc Section 5 B `#101 Settings 外観 tab`

## Goal

ユーザーが外観（テーマ）をライト / ダーク / システムから選べるようにする。選択は永続化し、再読み込み・OS 設定変更に追従する。既存コンポーネントは無変更で両テーマに対応する。

## Grounding

- `src/app/globals.css` は `:root` に dark の semantic alias（`--color-bg` 等）を定義し、`@theme inline` でそれらを Tailwind utility（`bg-bg` / `text-text-primary` 等）へ再export している。utility は `var(--color-*)` を参照するため、`data-theme` 切替で実行時に全 utility が追従する。
- `src/app/layout.tsx` の `<html>` は既に `suppressHydrationWarning` 付き（inline script が html 属性を書き換える前提を満たす）。provider は `@/components/providers/`（`SWRProvider` 等）に集約されている。
- Settings (`src/app/settings/page.tsx`) は `Tabs` ベース。tab を 1 つ足すだけで拡張できる。
- raw color（`neutral-*` / `text-white` / `bg-white` / `bg-black`）の .tsx 使用は 17 箇所のみ。大半は brand-gradient ボタン上の `text-white` でテーマ非依存。
- Radio コンポーネントは未存在。

## Decisions

| 項目 | 決定 | Why |
|---|---|---|
| テーマ適用 | **自前実装**（inline no-flash script + React context）。依存追加なし | `next-themes` は最終リリース 2025-03 / 最終コミット 2025-05 で ~13ヶ月 dormant のため不採用。theme 切替は小規模で自前可能。CLAUDE.md「頼まれてない依存を追加しない」とも整合 |
| デフォルト | `system`（OS 追従） | rx-sns も「システム」を含む。標準的 |
| token 機構 | semantic alias のみ `[data-theme="light"]` で上書き。neutral/brand scale・gradient は共通 | コンポーネント無変更で両テーマ対応。差分最小 |
| 外観 tab の対象 | 全ユーザー（role 非依存） | テーマは Cast/Guest 共通設定 |
| status 色 (error/warning/info) | 両テーマ共通のまま（light 最適化しない） | §10 未確定の interim 値。本 spec の scope 外 |

## Token architecture

`globals.css` の `:root` ブロックの **semantic alias 部分**を dark/light で出し分ける。neutral scale・brand・gradient・radius は共通のまま。

```css
:root,
[data-theme="dark"] {
  --color-bg: var(--color-neutral-950);
  --color-bg-secondary: var(--color-neutral-800);
  --color-surface: var(--color-neutral-900);
  --color-divider: var(--color-neutral-800);
  --color-border: var(--color-neutral-700);
  --color-text-primary: var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-400);
  --color-text-muted: var(--color-neutral-500);
  --color-input-bg: #303030;
  --color-accent: var(--color-brand-primary);
}

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

- neutral scale (`--color-neutral-50..950`)・brand・gradient・glow・radius の定義は現状どおり `:root` に残す（両テーマ共通）。
- `@theme inline` ブロックは変更不要（`var(--color-*)` 参照のまま）。
- `body { background: var(--color-bg); color: var(--color-text-primary) }` も変更不要。

### Light palette（semantic alias 一覧）

| token | dark | light |
|---|---|---|
| `--color-bg` | `#14161a` (neutral-950) | `#ffffff` |
| `--color-surface` | `#0f172a` (neutral-900) | `#f1f5f9` (neutral-100) |
| `--color-bg-secondary` | `#1e293b` (neutral-800) | `#e2e8f0` (neutral-200) |
| `--color-divider` | neutral-800 | neutral-200 |
| `--color-border` | `#334155` (neutral-700) | `#cbd5e1` (neutral-300) |
| `--color-text-primary` | `#f8fafc` (neutral-50) | `#0f172a` (neutral-900) |
| `--color-text-secondary` | `#94a3b8` (neutral-400) | `#64748b` (neutral-500) |
| `--color-text-muted` | neutral-500 | neutral-400 |
| `--color-input-bg` | `#303030` | neutral-100 |
| `--color-accent` | brand-primary | brand-primary（共通） |

## テーマ適用（自前実装）

依存追加なし。3 ピースで構成する。

### (a) No-flash inline script（FOUC 回避）

`layout.tsx` の `<body>` 先頭に、hydration 前に同期実行される inline script を置き、localStorage の選択を解決して `<html data-theme>` を paint 前に設定する。

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

body 先頭で同期実行されるため、後続 DOM の paint 前に `data-theme` が確定し FOUC が出ない。`<html suppressHydrationWarning>` は既存（script が html 属性を変えるため必要、すでに付与済）。

### (b) ThemeProvider + useTheme（`src/components/providers/ThemeProvider.tsx`, client）

React context で `theme`（ユーザー選択: `"light" | "dark" | "system"`）と `setTheme` を提供する。

- 初期 state は `"system"`（SSR と一致）。`useEffect` で localStorage の値に同期する。
- `setTheme(t)`: state 更新 + `localStorage.setItem("theme", t)` + 解決済みテーマを `document.documentElement.dataset.theme` に反映。
- `theme === "system"` のとき `window.matchMedia("(prefers-color-scheme: dark)")` の `change` を購読し、OS 切替に追従して `data-theme` を更新する。`theme` が light/dark のときはリスナーを外す。
- `useTheme()` フックで `{ theme, setTheme }` を公開。

型: `type ThemeChoice = "light" | "dark" | "system";`

`layout.tsx` で既存 provider 群を `<ThemeProvider>` でラップ（最外）。

### (c) localStorage キー

`"theme"`（値は `ThemeChoice`）。inline script と ThemeProvider で同一キーを使う。

## Settings 外観 tab

`src/app/settings/page.tsx` の `items` に追加（role 非依存）:

```tsx
const items = [
  { id: "notifications", label: "通知設定" },
  ...(role === "cast" ? [{ id: "area", label: "エリア" }] : []),
  { id: "appearance", label: "外観" },
  { id: "privacy", label: "プライバシー" },
  { id: "account", label: "アカウント" },
];
```

`{tab === "appearance" && <AppearanceSettings />}` を描画。

新規 `src/modules/profile/components/AppearanceSettings.tsx`（client）:
- 自前 `useTheme()`（(b)）の `theme` / `setTheme` を使う。
- 3 つの選択肢を radio 風 UI で表示: `{ value: "light", label: "ライト" }`, `{ value: "dark", label: "ダーク" }`, `{ value: "system", label: "システム" }`。
- SSR/hydration 不一致を避けるため、`mounted` フラグ（`useEffect` で true）が立つまで選択状態をプレースホルダ表示にする（初期 state が "system" 固定で実選択と異なりうるため）。
- 各行は `NotificationSettings` の `ToggleRow` 風の見た目（label + 右側に選択コントロール）に合わせ、Settings 内の一貫性を保つ。

## Raw color audit

`neutral-*` / `text-white` / `bg-white` / `bg-black` の 17 箇所を確認し、**dark を前提に固定色を使っている箇所のみ** semantic token（`text-text-primary` 等）へ置換する。brand-gradient 上の `text-white`（ボタン等）はテーマ非依存なので据え置く。置換が必要な代表例は light で視認できなくなる固定 `text-white`/`bg-black` 等。

## Decomposition（実装段）

| 段 | スコープ |
|---|---|
| T1 | globals.css の `[data-theme]` 出し分け（dark 既定維持）+ no-flash inline script + 自前 `ThemeProvider`/`useTheme` + layout 統合 |
| T2 | `AppearanceSettings` + Settings 外観 tab |
| T3 | raw color audit & 置換（light で破綻する箇所のみ） |

## Deferred / out of scope

- status 色（error/warning/info）の light 最適化（§10 未確定）
- brand 色の light 調整（共通で十分）
- per-route / 印刷用テーマ
- テーマ別の画像・ロゴ出し分け

## Verification

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint                # 0e/0w
env -u NODE_OPTIONS pnpm build
```

手動確認（local e2e）:
- 外観 tab でライト/ダーク/システム切替 → `<html data-theme>` が即時反映
- reload しても選択が永続（localStorage）
- 「システム」選択時に OS のダーク/ライト切替へ追従
- 初回ロード（未選択）で FOUC が出ない（自前 no-flash inline script）
- 主要ページ（feed / profile / settings / footprints / messages）が light で破綻しない

成功基準:
- 3 択が機能し永続・OS 追従する
- 既存コンポーネントが light で読める（コントラスト破綻なし）
- dark の見た目は現状から不変
