# Phase 1a Design — Presentation Demolition + Component Vocabulary

Date: 2026-05-30
Status: Design spec (implementation-ready)
Scope: presentation 層の破壊先行と、spec §6 コンポーネント語彙の greenfield 構築。
Related: `2026-05-29-design-system-design.md` §6、`../2026-05-30-frontend-rebuild-roadmap.md`（Rebuild principle = destroy-first）

## Goal

presentation 層（旧ページ・旧 component・旧 shell）をまとめて削除して空のキャンバスにし、spec §6 のコンポーネント語彙をクリーンに新規構築する。データ/ドメイン層は domain spec まで保留。

## Why destroy-first

新旧共存（新 component を別名前空間に足して旧を後で消す）は、旧コンセプト由来の cruft（role variant・cast/guest 分離・エスコート型ポートフォリオ UI）をしばらく残す。最終形をクリーンに保つため、salvage せず先に破壊する。データ層と presentation は import 上分離している（`src/modules/*/hooks|lib`・`src/stores` → `@/components`/`@/app` 参照は 0 件）ため、presentation のみ安全に削除できる。

## Part 1: Presentation demolition

### Delete

- `src/app/(cast)/`・`src/app/(guest)/`・`src/app/login/`・`src/app/storage/`（ページ＋レイアウト）
- `src/components/ui/`・`src/components/layout/`・`src/components/shared/`（旧 UI・shell）
- `src/modules/{feed,identity,portfolio,post,trust}/components/`（モジュール内 UI）

### Keep（データ/インフラ）

- root `src/app/layout.tsx`（Toast 配線のみ除去）・`globals.css`・`error.tsx`・`apple-icon.tsx`・`favicon.ico`・`src/app/api/`
- `src/components/providers/`（SWRProvider）
- `src/modules/*/{hooks,lib,types.ts}`（`identity/hooks` の useAuth 含む）
- `src/stores/`・`src/hooks/`・`src/lib/`

### Fixups（削除に伴う最小修正）

- `src/modules/{post,feed,trust}/index.ts` の `export * from "./components"` を除去。
- root `layout.tsx` から `ToastProvider`（`@/components/ui/Toast`）の import と使用を除去。
- `src/app/error.tsx` が削除対象（`components/shared/ErrorFallback` 等）を参照する場合、最小の error UI に置換。
- placeholder の `src/app/page.tsx`（最小の「under construction」）を新設し `/` を成立させる。

### Verification

`pnpm build` が green（placeholder で成立）。アプリは非機能（最小）になるのは想定内。

## Part 2: Component vocabulary（spec §6）

### Components

spec §6 の語彙のみを構築（汎用 primitive は JIT、カルテ系は Phase 3）:

1. **Button**（CTA）— CVA variant: `primary` = brand gradient pill / weight 700 / brand glow / radius-full、`secondary` = accent borderline pill。
2. **Input** — input-bg fill / radius-md / focus 時 accent border + ring。
3. **Tab** — 下線方式（active 下に gradient line）。
4. **Toggle** — 角丸ピル、on = accent。
5. **Avatar** — 丸 / radius-full。
6. **UserCard** — avatar + 名前 + ハンドル + フォロー gradient pill。
7. **PostCard** — avatar / 名前 / ハンドル / 時刻 / 本文 / 画像 grid（1-4）/ 反応行。container は transparent + divider。

### Location / conventions

- 置き場所: `src/components/ui/`（破壊で空になった既存 alias `@/components/ui` を再利用）。
- CVA で variant、`cn()`（tailwind-merge、既存依存）でクラス結合。
- 対話系は Radix を活用（Toggle = Radix Switch、Tab = Radix Tabs か簡易下線）。a11y を作り直さない。
- 新 token のみ・**role variant なし**。単一デザイン言語。TypeScript props。

### Verification

ページ consumer がまだ無いため、**dev 専用プレビュールート** `src/app/dev/ui/page.tsx`（= `/dev/ui`）で各コンポーネントを状態込みに描画し目視。`_` 接頭辞は Next の private folder でルートにならないため使わない。`pnpm build` ＋ 型チェックも。プレビューは後で削除可能な一時面。

## Out of scope / Deferred

- modal / select / toast 等の汎用 primitive → JIT（1b / Phase 2 で必要時）。
- カルテ系コンポーネント → Phase 3。
- shell / 各ページへの配線、ルート再編、role トグル → 1b / Phase 2（domain/IA spec 後）。
- **データ/ドメイン層の再編**（modules の hooks/lib/api・auth・stores）→ domain/IA spec が契約を決めてから。本 spec では保留。

## Consequence

demolition 後、アプリは「root layout + globals(Phase 0 token) + データ層 + placeholder home + 新 §6 component（プレビューでのみ可視）」になる。機能復帰は 1b（shell）/ Phase 2（pages）。この非機能状態は feature ブランチ上に置き、deployable な区切りまで main へはマージしない。
