# Token Migration Strategy — Phase 0

Date: 2026-05-30
Status: Design spec (implementation-ready)
Scope: 現行 frontend の token システムから design system spec §3 への移行方式。token 値そのものは spec §3 が SoT。
Related: `2026-05-29-design-system-design.md` §3 / §9、`../2026-05-30-frontend-rebuild-roadmap.md`

## Problem

現行 `globals.css` は完成済みの token システム（neutral スケール / semantic surface・text・border / status / radius / shadow / role-cast・role-guest）を**ライトテーマ既定 + ダークモード上書き**で持つ。spec §3 が定義する新 token（`--color-surface` / `--color-text-*` / `--color-border` / `--color-accent` / `--radius-sm` / `--radius-md` / neutral）は**同名で既存と衝突**し、値が異なる（ライト→ダーク、radius 拡大）。よって「既存を壊さず追加するだけ」の additive は成立しない。

## Decision: clean-slate replacement

`globals.css` / `theme.ts` を spec §3 の token **だけ**に置換し、旧 token を削除する。

### Why clean-slate（additive / 並行名前空間ではなく）

- ゴールがフル再構築（roadmap 参照）で、既存ライト画面は最終的に置き換わる。共存を保つコストが何も買わない。
- spec §3 は token 名を確定している（`--color-surface` 等）。並行名前空間は後でリネームが必要になり二度手間。
- 検証の結果、clean-slate は **build / lint を壊さない**（下記）。崩れるのは旧画面の見た目のみで、これは許容済み。

## Build/lint safety (verified)

clean-slate で旧 token を削除しても安全であることを実コードで確認した。

- **`@apply` は src 全体で 0 件** — CSS token 削除がビルドを落とす経路がない。
- **`theme.ts` の実 import は 0 件**（dead code）— TS 削除でコンパイルが壊れない。
- **`var(--color-neutral-*)` の component 直接参照は 0 件**（11 件は globals.css 自身の `@theme` 自己参照のみ）— hex 形式で問題ない。
- **Tailwind class 参照（`bg-role-cast` 等 200+ 件）** は、token 削除で未定義 utility となり**黙って無スタイル化**（ビルドエラーにならない）。視覚崩れのみ。
- **lint**: `eslint-plugin-tailwindcss` 系は未導入のため、未定義 class が lint エラーにならない。
- `--z-*` / `--duration-*` / `--spacing-*` は `var()` 参照 0 件の dead token（`@theme` 外で utility も生成しない）。`z-50` / `duration-300` 等は Tailwind デフォルトで賄われている。

## Color format: hex (not `R G B`)

spec §3.1 を hex に修正済み。Tailwind v4 は opacity modifier を `color-mix()` で解決するため v3 の `R G B` チャンネル形式は不要で、`@theme` に bare channel を入れると utility が無効 CSS になる。現行コードは hex token に alpha modifier を多用して動作実績がある。gradient は `var(--color-brand-*)` 直、glow shadow は channel ハードコード（既存 `--shadow-*` の慣習）。

## Scope of Phase 0

### Add / replace（spec §3）

- neutral（hex、50-900 は現行値と一致、950 のみ `#14161a`）/ brand / functional / semantic alias / radius（sm・md・full）
- gradient（`--gradient-brand-2` / `-3`）・glow（`--shadow-brand-glow`）+ utility class
- Noto Sans JP（variable で試行、不可なら weight 400/500/700 へフォールバック）、`--font-sans` 接続
- root font-size 15px（`html { font-size: 93.75% }`）— spec §3.2 が全 token の前提とするため Phase 0 に含める

### Keep

- `@import "tailwindcss";`、`@utility pb-safe` / `pt-safe` / `no-scrollbar`、mobile の iOS ズーム防止（`input,textarea,select { font-size: 16px !important }`）

### Delete

- role-cast / role-guest / special / accent-hover / accent-light / 旧 semantic 値（surface-secondary・tertiary / border-secondary / text-inverted）
- ライト用 `--background` / `--foreground` と `body` の旧配線、`@media (prefers-color-scheme: dark)` と `.dark` 上書き（ダーク既定化）
- shadow-cast / guest / sm / md / lg / xl、radius-lg / xl、spacing-* / z-* / duration-*
- `config/theme.ts` 全体（dead code）

### Interim

- status の error / warning / info は spec §10 で未確定のため、暗色テーマ用仮値を TODO コメント付きで採用し、画面側の引っ越しをブロックしない。

## Consequence on plan structure

旧 plan の Plan B/C（role token の段階撤去）は消滅する。role token は Phase 0 で削除し、consumer（旧 Tailwind class 参照）の整理は後続フェーズの画面再構築で自然に消化される。Phase 0 は単一 plan に一本化する。

## Verification

- `pnpm build` が green。
- `pnpm lint` に新規エラーなし。
- `pnpm dev` で本文フォントが Noto Sans JP、新 token utility（`bg-bg` / `text-text-primary` / `bg-gradient-brand` / `shadow-brand-glow` 等）が効くことを目視。旧画面の視覚崩れは想定内。
